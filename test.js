/**
 * test.js
 * 
 * Comprehensive unit test suite for verifying the hierarchical relationship processor
 * against the official PDF sample case and complex edge cases.
 */

const { processData } = require('./processData');

const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`${ANSI_GREEN}✔ PASS:${ANSI_RESET} ${message}`);
  } else {
    failedTests++;
    console.log(`${ANSI_RED}✘ FAIL:${ANSI_RESET} ${message}`);
  }
}

function runTests() {
  console.log(`${ANSI_BOLD}Starting Chitkara Challenge Test Suite...${ANSI_RESET}\n`);

  // ==========================================================================
  // Test Case 1: Official Sample Case from PDF
  // ==========================================================================
  console.log(`${ANSI_BOLD}--- Test Case 1: Official PDF Sample Case ---${ANSI_RESET}`);
  
  const officialInput = [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ];

  const result1 = processData(officialInput);

  // Assert Invalid Entries
  assert(
    JSON.stringify(result1.invalid_entries) === JSON.stringify(["hello", "1->2", "A->"]),
    "Should correctly track invalid entries: " + JSON.stringify(result1.invalid_entries)
  );

  // Assert Duplicate Edges
  assert(
    JSON.stringify(result1.duplicate_edges) === JSON.stringify(["G->H"]),
    "Should correctly track duplicate edges: " + JSON.stringify(result1.duplicate_edges)
  );

  // Assert Summary Counts
  assert(result1.summary.total_trees === 3, `Should have 3 trees, got: ${result1.summary.total_trees}`);
  assert(result1.summary.total_cycles === 1, `Should have 1 cycle, got: ${result1.summary.total_cycles}`);
  assert(result1.summary.largest_tree_root === "A", `Largest tree root should be 'A', got: '${result1.summary.largest_tree_root}'`);

  // Assert Hierarchy Structures
  assert(result1.hierarchies.length === 4, `Should have 4 hierarchies, got: ${result1.hierarchies.length}`);

  // Component 1: Tree A
  const treeA = result1.hierarchies.find(h => h.root === "A");
  assert(!!treeA, "Tree with root 'A' should exist");
  if (treeA) {
    assert(treeA.depth === 4, `Tree 'A' depth should be 4, got: ${treeA.depth}`);
    assert(!treeA.has_cycle, "Tree 'A' should not have has_cycle flag");
    // Verify tree shape
    const expectedTreeA = {
      "A": {
        "B": { "D": {} },
        "C": { "E": { "F": {} } }
      }
    };
    assert(
      JSON.stringify(treeA.tree) === JSON.stringify(expectedTreeA),
      "Tree 'A' structure should match expected nested object"
    );
  }

  // Component 2: Cycle X
  const cycleX = result1.hierarchies.find(h => h.root === "X");
  assert(!!cycleX, "Cyclic component with root 'X' should exist");
  if (cycleX) {
    assert(cycleX.has_cycle === true, "Cyclic component 'X' should have has_cycle: true");
    assert(JSON.stringify(cycleX.tree) === JSON.stringify({}), "Cyclic component 'X' tree should be empty {}");
    assert(cycleX.depth === undefined, "Cyclic component 'X' depth should be undefined");
  }

  // Component 3: Tree P
  const treeP = result1.hierarchies.find(h => h.root === "P");
  assert(!!treeP, "Tree with root 'P' should exist");
  if (treeP) {
    assert(treeP.depth === 3, `Tree 'P' depth should be 3, got: ${treeP.depth}`);
    assert(
      JSON.stringify(treeP.tree) === JSON.stringify({ "P": { "Q": { "R": {} } } }),
      "Tree 'P' structure should match expected nested object"
    );
  }

  // Component 4: Tree G
  const treeG = result1.hierarchies.find(h => h.root === "G");
  assert(!!treeG, "Tree with root 'G' should exist");
  if (treeG) {
    assert(treeG.depth === 2, `Tree 'G' depth should be 2, got: ${treeG.depth}`);
    assert(
      JSON.stringify(treeG.tree) === JSON.stringify({ "G": { "H": {}, "I": {} } }),
      "Tree 'G' structure should match expected nested object"
    );
  }

  console.log("");

  // ==========================================================================
  // Test Case 2: Multi-Parent & Silently Discarded Edges
  // ==========================================================================
  console.log(`${ANSI_BOLD}--- Test Case 2: Multi-Parent & Silent Discard ---${ANSI_RESET}`);
  
  // Here, D gets parent A first. Then B->D and C->D are multi-parents, so they should be silently discarded.
  const multiParentInput = [
    "A->D", "B->D", "C->D", 
    "A->E", "B->F"
  ];
  const result2 = processData(multiParentInput);

  // D has parent A. E has parent A. F has parent B.
  // B has no child other than F (since B->D is discarded).
  // Thus we have:
  // Component 1 (edges with A, D, E): Tree A with children D, E. (Depth 2)
  // Component 2 (edges with B, F): Tree B with child F. (Depth 2)
  assert(result2.summary.total_trees === 2, `Should have 2 trees, got: ${result2.summary.total_trees}`);
  assert(result2.summary.total_cycles === 0, `Should have 0 cycles, got: ${result2.summary.total_cycles}`);
  // Root A (A) vs Root B (B). Equal depth (2). Lexicographically smaller root: A.
  assert(result2.summary.largest_tree_root === "A", `Largest tree root with tie-breaker should be 'A', got: '${result2.summary.largest_tree_root}'`);
  
  const treeA2 = result2.hierarchies.find(h => h.root === "A");
  assert(
    JSON.stringify(treeA2.tree) === JSON.stringify({ "A": { "D": {}, "E": {} } }),
    "Tree 'A' should have children 'D' and 'E'"
  );

  const treeB2 = result2.hierarchies.find(h => h.root === "B");
  assert(
    JSON.stringify(treeB2.tree) === JSON.stringify({ "B": { "F": {} } }),
    "Tree 'B' should have child 'F' only (since B->D was discarded)"
  );
  
  console.log("");

  // ==========================================================================
  // Test Case 3: Self-Loops, Whitespace Trimming, and Edge Anomalies
  // ==========================================================================
  console.log(`${ANSI_BOLD}--- Test Case 3: Self-loops, Whitespace, & Errors ---${ANSI_RESET}`);
  
  const errorInput = [
    "  X->Y  ",  // Whitespace trimmed first, then valid
    "A->A",      // Self-loop (invalid)
    "U->V", 
    "U->V",      // Duplicate
    "U->V",      // Duplicate again
    "1->2"       // Invalid format
  ];
  const result3 = processData(errorInput);

  assert(
    JSON.stringify(result3.invalid_entries) === JSON.stringify(["A->A", "1->2"]),
    "Should correctly track invalid self-loops and numeric patterns"
  );

  assert(
    JSON.stringify(result3.duplicate_edges) === JSON.stringify(["U->V"]),
    "Should track duplicate edges once only"
  );

  assert(result3.summary.total_trees === 2, "Should have 2 trees (X->Y and U->V)");

  console.log("");

  // ==========================================================================
  // Summary Results
  // ==========================================================================
  console.log(`\n${ANSI_BOLD}Test Execution Completed:${ANSI_RESET}`);
  console.log(`- ${ANSI_GREEN}Passed Tests: ${passedTests}${ANSI_RESET}`);
  console.log(`- ${ANSI_RED}Failed Tests: ${failedTests}${ANSI_RESET}`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log(`\n${ANSI_GREEN}${ANSI_BOLD}ALL TESTS PASSED SUCCESSFULLY!${ANSI_RESET}`);
  }
}

runTests();
