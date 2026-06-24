/**
 * processData.js
 * 
 * Core processing module for the Chitkara Full Stack Engineering Challenge.
 * This module takes an array of raw relationship strings, validates them,
 * filters duplicates, resolves multi-parent cases, groups nodes into components,
 * detects cycles, builds nested trees, and generates the final response object.
 */

/**
 * Main processing function
 * @param {Array<string>} rawData - Array of raw relationship strings (e.g., ["A->B", "C->D"])
 * @returns {Object} Structured insights matching the API response schema
 */
function processData(rawData) {
  // Initialize response arrays and sets
  const invalid_entries = [];
  const duplicateEdgesSet = new Set();
  const seenEdges = new Set();

  // Maps to track graph relationships
  // parentOf: child -> parent (enforces 1 parent limit)
  const parentOf = new Map();
  // activeEdges: parent -> list of children (for tree building)
  const activeChildren = new Map();
  // Keep track of all unique active nodes
  const activeNodes = new Set();

  // Track all valid, non-duplicate edges in the order they were processed
  // This will help us reconstruct the component insertion order later
  const validEdgesOrdered = [];

  // Step 1: Validation of node format & Duplicate/Multi-parent filtering
  if (Array.isArray(rawData)) {
    rawData.forEach((entry) => {
      // Rule 2: Trim whitespace first, then validate
      if (typeof entry !== 'string') {
        invalid_entries.push(String(entry));
        return;
      }
      const trimmed = entry.trim();

      // Rule 2: Valid Node Format is X->Y where X and Y are single uppercase letters (A-Z)
      const formatRegex = /^[A-Z]->[A-Z]$/;
      if (!formatRegex.test(trimmed)) {
        invalid_entries.push(entry);
        return;
      }

      // Extract parent and child
      const [parent, child] = trimmed.split('->');

      // Rule 2: Self-loop (A->A) is treated as invalid
      if (parent === child) {
        invalid_entries.push(entry);
        return;
      }

      // Rule 3: Duplicate Edges
      // If the same Parent->Child pair appears more than once, use the first occurrence.
      // Push subsequent occurrences to duplicate_edges once each.
      if (seenEdges.has(trimmed)) {
        duplicateEdgesSet.add(trimmed);
        return;
      }
      seenEdges.add(trimmed);

      // Rule 4: Diamond / Multi-parent case
      // If a node has more than one parent (e.g. A->D and B->D), the first-encountered
      // parent edge wins; subsequent parent edges for that child are silently discarded.
      if (parentOf.has(child)) {
        // Child already has a parent from an earlier edge. Silently discard this edge.
        return;
      }

      // Record parent-child relationship
      parentOf.set(child, parent);
      activeNodes.add(parent);
      activeNodes.add(child);

      // Store in order of appearance
      validEdgesOrdered.push({ parent, child, originalString: trimmed });

      // Add to adjacency list for children
      if (!activeChildren.has(parent)) {
        activeChildren.set(parent, []);
      }
      activeChildren.get(parent).push(child);
    });
  }

  // Convert duplicate edges set to sorted array (or keep original order, let's keep array order)
  // Let's preserve the order of duplicate detection by using the set conversion.
  const duplicate_edges = Array.from(duplicateEdgesSet);

  // Step 2: Grouping into Connected Components (Independent Groups)
  // We treat the active edges as an undirected graph to find all connected components.
  const undirectedAdj = new Map();
  activeNodes.forEach(node => undirectedAdj.set(node, []));

  validEdgesOrdered.forEach(({ parent, child }) => {
    undirectedAdj.get(parent).push(child);
    undirectedAdj.get(child).push(parent);
  });

  const visited = new Set();
  const components = [];

  // Traverse the graph to find connected components
  activeNodes.forEach(node => {
    if (!visited.has(node)) {
      const componentNodes = new Set();
      const queue = [node];
      visited.add(node);

      while (queue.length > 0) {
        const curr = queue.shift();
        componentNodes.add(curr);

        const neighbors = undirectedAdj.get(curr) || [];
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      components.push(componentNodes);
    }
  });

  // Step 3: Sort components by their first appearance in the input data
  // This ensures the hierarchies are returned in a predictable, logical order.
  const componentWithMinIndex = components.map(compNodes => {
    // Find the minimum index of any edge that contains nodes from this component
    let minIndex = Infinity;
    if (Array.isArray(rawData)) {
      rawData.forEach((entry, idx) => {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          const formatRegex = /^[A-Z]->[A-Z]$/;
          if (formatRegex.test(trimmed)) {
            const [parent, child] = trimmed.split('->');
            // If the edge belongs to this component
            if (compNodes.has(parent) || compNodes.has(child)) {
              if (idx < minIndex) {
                minIndex = idx;
              }
            }
          }
        }
      });
    }
    return { nodes: compNodes, minIndex };
  });

  // Sort components by minIndex ascending
  componentWithMinIndex.sort((a, b) => a.minIndex - b.minIndex);

  // Step 4: Tree Construction & Cycle Detection for each component
  const hierarchies = [];
  let total_trees = 0;
  let total_cycles = 0;
  let maxDepth = -1;
  let largest_tree_root = "";

  componentWithMinIndex.forEach(({ nodes }) => {
    // 4a. Find the root candidate(s)
    // A root is a node in the component that never appears as a child in any active edge (in-degree 0)
    const roots = [];
    nodes.forEach(node => {
      if (!parentOf.has(node)) {
        roots.push(node);
      }
    });

    // 4b. Determine if the component is cyclic or a tree
    // Since each node has at most 1 parent, if there is exactly 1 node with no parent,
    // the component is a valid tree. If there are 0 nodes with no parent, the component is a cycle.
    const hasCycle = roots.length === 0;
    let rootNode = "";

    if (hasCycle) {
      total_cycles++;
      // Rule 4: If a group has no valid root (pure cycle), use the lexicographically smallest node as root
      const sortedNodes = Array.from(nodes).sort();
      rootNode = sortedNodes[0];

      hierarchies.push({
        root: rootNode,
        tree: {},
        has_cycle: true
      });
    } else {
      total_trees++;
      // The unique node with in-degree 0 is the root
      rootNode = roots[0];

      // Build the nested tree recursively starting from the root
      const buildTree = (currNode) => {
        const treeObj = {};
        const children = activeChildren.get(currNode) || [];
        
        // Sort children lexicographically for deterministic output order
        const sortedChildren = [...children].sort();
        
        sortedChildren.forEach(child => {
          treeObj[child] = buildTree(child);
        });
        return treeObj;
      };

      const nestedTree = {
        [rootNode]: buildTree(rootNode)
      };

      // Calculate depth (number of nodes on the longest root-to-leaf path)
      const calculateDepth = (currNode) => {
        const children = activeChildren.get(currNode) || [];
        if (children.length === 0) {
          return 1;
        }
        const childDepths = children.map(child => calculateDepth(child));
        return 1 + Math.max(...childDepths);
      };

      const depth = calculateDepth(rootNode);

      // Rule 7: Track largest tree root (tiebreaker: lexicographically smaller root wins)
      if (depth > maxDepth) {
        maxDepth = depth;
        largest_tree_root = rootNode;
      } else if (depth === maxDepth) {
        if (rootNode < largest_tree_root || largest_tree_root === "") {
          largest_tree_root = rootNode;
        }
      }

      hierarchies.push({
        root: rootNode,
        tree: nestedTree,
        depth: depth
      });
    }
  });

  // Assemble the summary object
  const summary = {
    total_trees,
    total_cycles,
    largest_tree_root: total_trees > 0 ? largest_tree_root : ""
  };

  return {
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary
  };
}

module.exports = {
  processData
};
