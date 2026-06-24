/**
 * app.js
 * 
 * Frontend application logic for the Hierarchy Insight Engine.
 * Manages event listeners, handles prefilled demos, communicates with
 * the Node.js + Express API, and renders insights dynamically.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const hierarchyForm = document.getElementById('hierarchy-form');
  const nodeDataInput = document.getElementById('node-data-input');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnLoadComplex = document.getElementById('btn-load-complex');
  const btnClear = document.getElementById('btn-clear');
  const btnSubmit = document.getElementById('btn-submit');
  const btnCopyJson = document.getElementById('btn-copy-json');
  const spinner = btnSubmit.querySelector('.spinner');
  const btnText = btnSubmit.querySelector('.btn-text');

  const errorBanner = document.getElementById('error-banner');
  const errorTitle = document.getElementById('error-title');
  const errorDesc = document.getElementById('error-desc');

  const resultsPanel = document.getElementById('results-panel');
  const placeholderPanel = document.getElementById('placeholder-panel');
  const analysisLoader = document.getElementById('analysis-loader');
  
  const statTrees = document.getElementById('stat-trees');
  const statCycles = document.getElementById('stat-cycles');
  const statLargestRoot = document.getElementById('stat-largest-root');
  
  const treeVisualizerContainer = document.getElementById('tree-visualizer-container');
  const duplicateEdgesList = document.getElementById('duplicate-edges-list');
  const invalidEntriesList = document.getElementById('invalid-entries-list');
  const rawJsonOutput = document.getElementById('raw-json-output');

  const badgeDuplicatesCount = document.getElementById('badge-duplicates-count');
  const badgeInvalidCount = document.getElementById('badge-invalid-count');

  // Last successful JSON response cached for copy actions
  let cachedResponse = null;

  // Preset Data Sets
  const standardDemo = [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ];

  const complexDemo = [
    "A->B", "B->C", "C->D", "D->A", // Cycle group
    "M->N", "P->N", "N->O",         // Multi-parent case: P->N is discarded, M->N->O wins
    "U->V", "U->V",                 // Duplicate edge
    "S->T", "T->W",                 // Valid Tree
    "XYZ", "1->2", "A->A"           // Invalid inputs
  ];

  // ==========================================================================
  // Preset & Control Listeners
  // ==========================================================================
  
  // Prefill standard demo from PDF challenge description
  btnLoadSample.addEventListener('click', () => {
    nodeDataInput.value = JSON.stringify(standardDemo, null, 2);
    hideError();
  });

  // Prefill complex edge cases (multi-parents, duplicates, self-loops)
  btnLoadComplex.addEventListener('click', () => {
    nodeDataInput.value = JSON.stringify(complexDemo, null, 2);
    hideError();
  });

  // Clear text area and hide results, restoring placeholder
  btnClear.addEventListener('click', () => {
    nodeDataInput.value = '';
    resultsPanel.classList.add('hidden');
    analysisLoader.classList.add('hidden');
    placeholderPanel.classList.remove('hidden');
    hideError();
  });

  // Copy raw JSON response to clipboard
  btnCopyJson.addEventListener('click', () => {
    if (cachedResponse) {
      navigator.clipboard.writeText(JSON.stringify(cachedResponse, null, 2))
        .then(() => {
          const originalText = btnCopyJson.textContent;
          btnCopyJson.textContent = 'Copied!';
          btnCopyJson.style.color = '#d946ef';
          setTimeout(() => {
            btnCopyJson.textContent = originalText;
            btnCopyJson.style.color = '';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy JSON:', err);
        });
    }
  });

  // Prefill standard demo on load
  nodeDataInput.value = JSON.stringify(standardDemo, null, 2);

  // ==========================================================================
  // Form Submission & API Request
  // ==========================================================================
  hierarchyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    let rawInputValue = nodeDataInput.value.trim();
    if (!rawInputValue) {
      showError("Empty Input", "Please enter relationship edges before submitting.");
      return;
    }

    let parsedDataArray = [];

    // Attempt to parse input as either JSON array or plain comma-separated strings
    try {
      if (rawInputValue.startsWith('[') && rawInputValue.endsWith(']')) {
        parsedDataArray = JSON.parse(rawInputValue);
        if (!Array.isArray(parsedDataArray)) {
          throw new Error("JSON structure must be an array.");
        }
      } else {
        // Fallback: parse comma/newline separated values
        parsedDataArray = rawInputValue
          .split(/[\n,]+/)
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
    } catch (parseError) {
      showError("Formatting Error", "Could not parse input. Provide a valid JSON array or a comma-separated list of edges.");
      return;
    }

    // Set loading state in UI
    setLoading(true);

    try {
      // POST Request to Express REST API
      const response = await fetch('/bfhl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: parsedDataArray })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server responded with status ${response.status}`);
      }

      // Store in cache and render
      cachedResponse = result;
      renderResults(result);

      // Smooth switch of panels
      analysisLoader.classList.add('hidden');
      placeholderPanel.classList.add('hidden');
      resultsPanel.classList.remove('hidden');

    } catch (apiError) {
      console.error("API Call failed:", apiError);
      showError("API Connection Failed", apiError.message || "Failed to communicate with the REST backend.");
      resultsPanel.classList.add('hidden');
      analysisLoader.classList.add('hidden');
      placeholderPanel.classList.remove('hidden');
    } finally {
      setLoading(false);
    }
  });

  // ==========================================================================
  // Rendering Engine
  // ==========================================================================
  
  /**
   * Renders the complete result dashboard from the API response
   * @param {Object} response - The validated API response schema
   */
  function renderResults(response) {
    // 1. Update stats cards
    statTrees.textContent = response.summary.total_trees;
    statCycles.textContent = response.summary.total_cycles;
    statLargestRoot.textContent = response.summary.largest_tree_root || "None";

    // 2. Clear lists and containers
    treeVisualizerContainer.innerHTML = '';
    duplicateEdgesList.innerHTML = '';
    invalidEntriesList.innerHTML = '';

    // 3. Render Anomalies (Duplicate Edges)
    badgeDuplicatesCount.textContent = response.duplicate_edges.length;
    response.duplicate_edges.forEach(edge => {
      const li = document.createElement('li');
      li.className = 'meta-item meta-item-duplicate';
      li.textContent = edge;
      duplicateEdgesList.appendChild(li);
    });

    // 4. Render Anomalies (Invalid Entries)
    badgeInvalidCount.textContent = response.invalid_entries.length;
    response.invalid_entries.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'meta-item meta-item-invalid';
      li.textContent = entry;
      invalidEntriesList.appendChild(li);
    });

    // 5. Render Raw JSON Output
    rawJsonOutput.textContent = JSON.stringify(response, null, 2);

    // 6. Render Visual Hierarchies
    if (response.hierarchies.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'cycle-fallback';
      emptyMsg.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <strong>No Hierarchies Processed</strong>
        <p>No valid relationship edges were detected in your input.</p>
      `;
      treeVisualizerContainer.appendChild(emptyMsg);
    } else {
      response.hierarchies.forEach(hierarchy => {
        const groupEl = document.createElement('div');
        groupEl.className = 'hierarchy-group';

        // Header for each group
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';

        const titleArea = document.createElement('div');
        titleArea.className = 'group-title-area';
        
        const typeIcon = document.createElement('div');
        typeIcon.className = `group-type-icon ${hierarchy.has_cycle ? 'type-cycle' : 'type-tree'}`;
        
        const titleText = document.createElement('span');
        titleText.className = 'group-title';
        titleText.textContent = `Root: ${hierarchy.root}`;

        titleArea.appendChild(typeIcon);
        titleArea.appendChild(titleText);
        groupHeader.appendChild(titleArea);

        // Add appropriate badges (Tree with depth OR Cycle warning)
        const badgesArea = document.createElement('div');
        badgesArea.className = 'group-badges';

        if (hierarchy.has_cycle) {
          const badgeCycle = document.createElement('span');
          badgeCycle.className = 'badge badge-danger';
          badgeCycle.textContent = 'Cyclic';
          badgesArea.appendChild(badgeCycle);
        } else {
          const badgeTree = document.createElement('span');
          badgeTree.className = 'badge badge-success';
          badgeTree.textContent = 'Tree';
          badgesArea.appendChild(badgeTree);

          const badgeDepth = document.createElement('span');
          badgeDepth.className = 'badge badge-info';
          badgeDepth.textContent = `Depth: ${hierarchy.depth}`;
          badgesArea.appendChild(badgeDepth);
        }

        groupHeader.appendChild(badgesArea);
        groupEl.appendChild(groupHeader);

        // Render the tree body or cycle warning
        if (hierarchy.has_cycle) {
          const cycleFallback = document.createElement('div');
          cycleFallback.className = 'cycle-fallback';
          cycleFallback.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <strong>Cycle Detected</strong>
            <p>A closed loop exists within this component. Self-contained loops cannot be represented in a tree hierarchy.</p>
          `;
          groupEl.appendChild(cycleFallback);
        } else {
          // It's a valid non-cyclic tree, build it recursively
          const treeRootKey = Object.keys(hierarchy.tree)[0];
          const treeRootChildren = hierarchy.tree[treeRootKey];
          const visualTree = createVisualTreeNode(treeRootKey, treeRootChildren, true);
          groupEl.appendChild(visualTree);
        }

        treeVisualizerContainer.appendChild(groupEl);
      });
    }

    // Scroll to the results panel with a smooth animation
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Recursive DOM Builder for visual tree nodes
   * @param {string} nodeName - Label of the current node
   * @param {Object} childrenObj - Child nodes subtree object
   * @param {boolean} isRoot - True if it's the root node of the hierarchy
   */
  function createVisualTreeNode(nodeName, childrenObj, isRoot = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node-wrapper' + (isRoot ? ' root-node-wrapper' : '');

    const nodeEl = document.createElement('div');
    nodeEl.className = 'node-element';
    
    // Add special styling hooks for roots vs children
    if (isRoot) {
      nodeEl.classList.add('node-root');
    }

    const bullet = document.createElement('span');
    bullet.className = 'node-bullet';
    bullet.textContent = nodeName[0];

    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = nodeName;

    nodeEl.appendChild(bullet);
    nodeEl.appendChild(label);
    wrapper.appendChild(nodeEl);

    // Recursively append children
    const childKeys = Object.keys(childrenObj);
    if (childKeys.length > 0) {
      childKeys.forEach(child => {
        const childNode = createVisualTreeNode(child, childrenObj[child], false);
        wrapper.appendChild(childNode);
      });
    }

    return wrapper;
  }

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================
  
  function setLoading(isLoading) {
    if (isLoading) {
      btnSubmit.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Analyzing...';
      
      // Toggle panels to show loading overlay
      placeholderPanel.classList.add('hidden');
      resultsPanel.classList.add('hidden');
      analysisLoader.classList.remove('hidden');
    } else {
      btnSubmit.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Analyze Hierarchy';
    }
  }

  function showError(title, message) {
    errorTitle.textContent = title;
    errorDesc.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }
});
