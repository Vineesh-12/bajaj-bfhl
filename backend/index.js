const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options(/.*/, cors());
app.use(express.json());

// ─── Identity (fill these in before submission) ───────────────────────────────
const USER_ID = "kattavineeshreddy_16042004";          // firstname_lastname_ddmmyyyy  ← UPDATE
const EMAIL_ID = "vk2677@srmist.edu.in";     // your college email            ← UPDATE
const COLLEGE_ROLL_NUMBER = "RA2311003010709";      // your roll number              ← UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and parse a single entry string.
 * Valid format: X->Y  where X and Y are each a SINGLE uppercase A–Z letter, X ≠ Y.
 * Returns { valid: true, parent, child } or { valid: false }.
 */
function parseEntry(raw) {
  const entry = String(raw).trim();

  // Pattern: exactly one uppercase letter, then "->", then exactly one uppercase letter
  const match = entry.match(/^([A-Z])->([A-Z])$/);
  if (!match) return { valid: false };

  const [, parent, child] = match;
  if (parent === child) return { valid: false }; // self-loop

  return { valid: true, parent, child };
}

/**
 * Build hierarchies from valid, deduplicated edges.
 * Returns { hierarchies, duplicate_edges }
 */
function buildHierarchies(validEdges) {
  // ── 1. Deduplicate edges (keep first occurrence, collect subsequent as duplicates)
  const seenEdges = new Set();
  const uniqueEdges = [];
  const duplicate_edges = [];

  for (const { parent, child } of validEdges) {
    const key = `${parent}->${child}`;
    if (seenEdges.has(key)) {
      if (!duplicate_edges.includes(key)) duplicate_edges.push(key);
    } else {
      seenEdges.add(key);
      uniqueEdges.push({ parent, child });
    }
  }

  // ── 2. Build adjacency & parent maps (diamond rule: first parent wins)
  const children = {};   // parent → [child, ...]
  const parents = {};    // child  → parent  (first occurrence wins)
  const allNodes = new Set();

  for (const { parent, child } of uniqueEdges) {
    allNodes.add(parent);
    allNodes.add(child);

    if (!children[parent]) children[parent] = [];

    // Diamond / multi-parent: if child already has a parent, silently discard edge
    if (parents[child] !== undefined) continue;

    parents[child] = parent;
    children[parent].push(child);
  }

  // ── 3. Find root candidates (nodes that are never a child after multi-parent resolution)
  const roots = [...allNodes].filter((n) => parents[n] === undefined);

  // ── 4. Detect cycles via DFS
  function hasCycle(startNode) {
    // Collect all nodes reachable from startNode (including itself)
    const visited = new Set();
    const stack = [startNode];
    while (stack.length) {
      const node = stack.pop();
      if (visited.has(node)) return true;
      visited.add(node);
      for (const ch of children[node] || []) stack.push(ch);
    }
    return false;
  }

  // Check if a group (reachable from a root) contains a cycle
  function groupHasCycle(root) {
    const visited = new Set();
    const recStack = new Set();

    function dfs(node) {
      visited.add(node);
      recStack.add(node);
      for (const ch of children[node] || []) {
        if (!visited.has(ch)) {
          if (dfs(ch)) return true;
        } else if (recStack.has(ch)) {
          return true;
        }
      }
      recStack.delete(node);
      return false;
    }

    return dfs(root);
  }

  // ── 5. Build tree object recursively
  function buildTree(node) {
    const subtree = {};
    for (const ch of children[node] || []) {
      subtree[ch] = buildTree(ch);
    }
    return subtree;
  }

  // ── 6. Calculate depth (longest root-to-leaf path, counting nodes)
  function calcDepth(node) {
    const kids = children[node] || [];
    if (kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(calcDepth));
  }

  // ── 7. Handle pure cycles (groups with no external root)
  //       Identify all nodes not reachable from any root
  const reachableFromRoots = new Set();
  function markReachable(node) {
    if (reachableFromRoots.has(node)) return;
    reachableFromRoots.add(node);
    for (const ch of children[node] || []) markReachable(ch);
  }
  roots.forEach(markReachable);

  const cycleOnlyNodes = [...allNodes].filter((n) => !reachableFromRoots.has(n));

  // Group pure-cycle nodes into connected components
  // Use undirected reachability for grouping
  const undirAdj = {};
  for (const { parent, child } of uniqueEdges) {
    if (!undirAdj[parent]) undirAdj[parent] = new Set();
    if (!undirAdj[child]) undirAdj[child] = new Set();
    undirAdj[parent].add(child);
    undirAdj[child].add(parent);
  }

  const cycleVisited = new Set();
  const cycleGroups = [];

  function collectCycleGroup(start) {
    const group = [];
    const q = [start];
    while (q.length) {
      const n = q.pop();
      if (cycleVisited.has(n)) continue;
      cycleVisited.add(n);
      group.push(n);
      for (const nb of undirAdj[n] || []) {
        if (!cycleVisited.has(nb) && cycleOnlyNodes.includes(nb)) q.push(nb);
      }
    }
    return group;
  }

  for (const n of cycleOnlyNodes) {
    if (!cycleVisited.has(n)) {
      cycleGroups.push(collectCycleGroup(n));
    }
  }

  // ── 8. Assemble hierarchies array
  const hierarchies = [];

  // Trees from proper roots
  for (const root of roots.sort()) {
    const cycle = groupHasCycle(root);
    if (cycle) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      hierarchies.push({ root, tree: buildTree(root), depth: calcDepth(root) });
    }
  }

  // Pure-cycle groups
  for (const group of cycleGroups) {
    const root = [...group].sort()[0]; // lexicographically smallest
    hierarchies.push({ root, tree: {}, has_cycle: true });
  }

  return { hierarchies, duplicate_edges };
}

// ── GET /bfhl  (optional health-check)
app.get("/bfhl", (req, res) => {
  res.json({ operation_code: 1 });
});

// ── POST /bfhl  (main endpoint)
app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }

    const invalid_entries = [];
    const validEdges = [];

    for (const item of data) {
      const result = parseEntry(item);
      if (!result.valid) {
        invalid_entries.push(String(item).trim());
      } else {
        validEdges.push({ parent: result.parent, child: result.child });
      }
    }

    const { hierarchies, duplicate_edges } = buildHierarchies(validEdges);

    // Summary
    const nonCyclicTrees = hierarchies.filter((h) => !h.has_cycle);
    const cyclicGroups = hierarchies.filter((h) => h.has_cycle);

    let largest_tree_root = null;
    let maxDepth = -1;
    for (const h of nonCyclicTrees) {
      if (
        h.depth > maxDepth ||
        (h.depth === maxDepth && h.root < largest_tree_root)
      ) {
        maxDepth = h.depth;
        largest_tree_root = h.root;
      }
    }

    const summary = {
      total_trees: nonCyclicTrees.length,
      total_cycles: cyclicGroups.length,
      largest_tree_root,
    };

    return res.json({
      user_id: USER_ID,
      email_id: EMAIL_ID,
      college_roll_number: COLLEGE_ROLL_NUMBER,
      hierarchies,
      invalid_entries,
      duplicate_edges,
      summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  Server running on port ${PORT}`));
