import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

/** Compact node types get smaller layout dimensions. */
const COMPACT_NODE_TYPES = new Set(['start', 'fork', 'join', 'condition', 'delay', 'end', 'webhook', 'schedule']);
const COMPACT_WIDTH = 160;
const COMPACT_HEIGHT = 60;

/** Minimum gap between nodes on the same rank after overlap resolution. */
const MIN_GAP = 30;

/**
 * Compute auto-layout positions for a directed graph using dagre.
 * Returns new nodes array with updated positions (does not mutate originals).
 */
export function getAutoLayoutNodes<N extends Node>(
  nodes: N[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): N[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  // Detect whether the graph has fork/join — increase spacing for parallel branches
  const hasFork = nodes.some(n => n.type === 'fork');

  // Dynamically adjust spacing based on workflow complexity
  const n = nodes.length;
  const baseNodesep = n <= 5 ? 40 : n <= 15 ? 30 : 20;
  const baseRanksep = n <= 5 ? 50 : n <= 15 ? 40 : 30;

  // Use moderately wider node separation for fork/join to give branches room
  const nodesep = hasFork ? Math.max(baseNodesep, 50) : baseNodesep;
  const ranksep = hasFork ? Math.max(baseRanksep, 50) : baseRanksep;

  g.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    marginx: 20,
    marginy: 20,
  });

  const nodeWidths = new Map<string, number>();
  const nodeHeights = new Map<string, number>();
  for (const node of nodes) {
    const isCompact = COMPACT_NODE_TYPES.has(node.type ?? '');
    const w = node.measured?.width ?? (isCompact ? COMPACT_WIDTH : NODE_WIDTH);
    const h = node.measured?.height ?? (isCompact ? COMPACT_HEIGHT : NODE_HEIGHT);
    nodeWidths.set(node.id, w);
    nodeHeights.set(node.id, h);
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  const positioned = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    const w = nodeWidths.get(node.id)!;
    const h = nodeHeights.get(node.id)!;
    positioned.set(node.id, {
      x: pos.x - w / 2,
      y: pos.y - h / 2,
    });
  }

  // Post-process: for condition/start/fork/trigger nodes with branching source handles,
  // ensure the "true"/Yes target is to the left of the "false"/No target to prevent
  // edge crossings (the Yes handle is at left:30%, No handle at left:70%).
  fixBranchOrdering(edges, positioned, direction);

  // Post-process: align direct children of fork nodes to the same rank (y in TB)
  // so parallel branches visually start at the same level.
  if (hasFork) {
    alignForkChildren(nodes, edges, positioned, direction);
  }

  // Post-process: resolve any node overlaps on the same rank
  resolveOverlaps(nodes, positioned, nodeWidths, nodeHeights, direction);

  // Post-process: center condition branch children symmetrically under their parent
  centerConditionBranches(nodes, edges, positioned, nodeWidths, direction);

  // Post-process: center fork/join/start/end/trigger nodes over their branches
  if (hasFork) {
    centerForkJoinNodes(nodes, edges, positioned, nodeWidths, nodeHeights, direction);
    // Re-run overlap resolution after centering may have introduced new overlaps
    resolveOverlaps(nodes, positioned, nodeWidths, nodeHeights, direction);
  }

  // Post-process: align nodes in linear chains (single parent + single child)
  // to share the same center as their neighbors, fixing vertical misalignment
  alignLinearChains(nodes, edges, positioned, nodeWidths, direction);

  // Post-process: resolve overlaps again after all centering operations
  // This catches cases where end nodes were centered under close parents
  resolveOverlaps(nodes, positioned, nodeWidths, nodeHeights, direction);

  // Final step: normalize positions to ensure all nodes have positive coordinates
  // The centering operations above can shift nodes into negative territory
  const MARGIN = 20;
  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positioned.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  
  // If any coordinate is negative or too close to zero, shift all nodes
  const shiftX = minX < MARGIN ? MARGIN - minX : 0;
  const shiftY = minY < MARGIN ? MARGIN - minY : 0;
  
  if (shiftX > 0 || shiftY > 0) {
    for (const pos of positioned.values()) {
      pos.x += shiftX;
      pos.y += shiftY;
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: { ...positioned.get(node.id)! },
  }));
}

/**
 * Align all direct children of fork nodes to the same rank position.
 *
 * Dagre sometimes pushes short fork branches (e.g. fork→node→join) down to a
 * lower rank to minimize total edge length, but visually all fork children should
 * start at the same level.  This shifts each fork's children (and their subtrees)
 * so they share the topmost child's y position (TB) or leftmost x position (LR).
 */
function alignForkChildren<N extends Node>(
  nodes: N[],
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  direction: 'TB' | 'LR',
): void {
  const rankAxis = direction === 'TB' ? 'y' : 'x';

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const out = outgoing.get(e.source) ?? [];
    out.push(e.target);
    outgoing.set(e.source, out);
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
  }

  // For each join, find which nodes feed into it — these subtrees should NOT
  // be shifted past the join.
  const joinNodes = new Set(nodes.filter(n => n.type === 'join').map(n => n.id));

  for (const node of nodes) {
    if (node.type !== 'fork') continue;
    const children = outgoing.get(node.id);
    if (!children || children.length < 2) continue;

    // Find the topmost (smallest y in TB) child position — that's the target rank
    const childPositions = children
      .map(cid => ({ id: cid, val: positions.get(cid)?.[rankAxis] }))
      .filter((c): c is { id: string; val: number } => c.val !== undefined);

    if (childPositions.length < 2) continue;

    const targetRank = Math.min(...childPositions.map(c => c.val));

    // Shift each child (and its subtree, excluding join) to align at targetRank
    for (const cp of childPositions) {
      const delta = cp.val - targetRank;
      if (Math.abs(delta) < 1) continue; // already aligned

      // Collect subtree from this child down to (but not including) join nodes
      const subtree = collectSubtreeUntil(cp.id, childrenOf, joinNodes);
      for (const id of subtree) {
        const p = positions.get(id);
        if (p) p[rankAxis] -= delta;
      }
    }
  }
}

/**
 * Collect subtree nodes via BFS, stopping at (not including) any node in the stopSet.
 */
function collectSubtreeUntil(
  root: string,
  childrenOf: Map<string, string[]>,
  stopSet: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    if (stopSet.has(id)) continue; // don't include or traverse past stop nodes
    visited.add(id);
    if (stopSet.has(id)) continue; // don't traverse past stop nodes, but include them
    for (const child of childrenOf.get(id) ?? []) {
      queue.push(child);
    }
  }
  return visited;
}

/**
 * Detect and resolve node overlaps. Groups nodes by approximate rank (same y in TB,
 * same x in LR) and pushes overlapping nodes apart.
 */
function resolveOverlaps<N extends Node>(
  nodes: N[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>,
  nodeHeights: Map<string, number>,
  direction: 'TB' | 'LR',
): void {
  // In TB layout, nodes at similar y are on the same rank; check x overlap.
  // In LR layout, nodes at similar x are on the same rank; check y overlap.
  const rankAxis = direction === 'TB' ? 'y' : 'x';
  const sepAxis = direction === 'TB' ? 'x' : 'y';
  const sizeMap = direction === 'TB' ? nodeWidths : nodeHeights;

  // Group nodes into ranks (within a tolerance)
  const RANK_TOLERANCE = 20;
  const ranks: { id: string; pos: { x: number; y: number }; size: number }[][] = [];

  for (const node of nodes) {
    const p = positions.get(node.id);
    if (!p) continue;
    const size = sizeMap.get(node.id) ?? 0;
    const rankVal = p[rankAxis];

    let found = false;
    for (const rank of ranks) {
      if (Math.abs(rank[0].pos[rankAxis] - rankVal) < RANK_TOLERANCE) {
        rank.push({ id: node.id, pos: p, size });
        found = true;
        break;
      }
    }
    if (!found) {
      ranks.push([{ id: node.id, pos: p, size }]);
    }
  }

  // For each rank, sort by position on the separation axis and fix overlaps
  for (const rank of ranks) {
    if (rank.length < 2) continue;
    rank.sort((a, b) => a.pos[sepAxis] - b.pos[sepAxis]);

    for (let i = 1; i < rank.length; i++) {
      const prev = rank[i - 1];
      const curr = rank[i];
      const prevEnd = prev.pos[sepAxis] + prev.size;
      const currStart = curr.pos[sepAxis];
      const overlap = prevEnd + MIN_GAP - currStart;

      if (overlap > 0) {
        // Push current node (and all subsequent nodes in this rank) to the right
        for (let j = i; j < rank.length; j++) {
          rank[j].pos[sepAxis] += overlap;
        }
      }
    }
  }
}

/**
 * For each node that has edges with both 'true' and 'false' sourceHandles,
 * swap child subtree positions if needed so that the 'true' target is on the
 * left (TB) or top (LR) side, matching the handle layout on condition nodes.
 */
function fixBranchOrdering(
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  direction: 'TB' | 'LR',
): void {
  // Group edges by source
  const bySource = new Map<string, Edge[]>();
  for (const e of edges) {
    const arr = bySource.get(e.source) ?? [];
    arr.push(e);
    bySource.set(e.source, arr);
  }

  // Build child→descendants map for subtree swapping
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
  }

  for (const [, outEdges] of bySource) {
    const trueEdge = outEdges.find(e => e.sourceHandle === 'true' || (e.label === 'Yes' && !e.sourceHandle));
    const falseEdge = outEdges.find(e => e.sourceHandle === 'false' || (e.label === 'No' && !e.sourceHandle));
    if (!trueEdge || !falseEdge) continue;

    const truePos = positions.get(trueEdge.target);
    const falsePos = positions.get(falseEdge.target);
    if (!truePos || !falsePos) continue;

    // In TB direction, true-branch should be left (smaller x); in LR, top (smaller y)
    const needsSwap = direction === 'TB'
      ? truePos.x > falsePos.x
      : truePos.y > falsePos.y;

    if (needsSwap) {
      // Collect all nodes in each subtree
      const trueSubtree = collectSubtree(trueEdge.target, childrenOf);
      const falseSubtree = collectSubtree(falseEdge.target, childrenOf);

      // Mirror the two subtrees around their combined center
      const axis = direction === 'TB' ? 'x' : 'y';
      swapSubtrees(trueSubtree, falseSubtree, positions, axis);
    }
  }
}

/** Collect all descendant node IDs (BFS) including the root. */
function collectSubtree(root: string, childrenOf: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of childrenOf.get(id) ?? []) {
      queue.push(child);
    }
  }
  return visited;
}

/** Swap positions of two subtrees by mirroring them around their combined center on the given axis. */
function swapSubtrees(
  setA: Set<string>,
  setB: Set<string>,
  positions: Map<string, { x: number; y: number }>,
  axis: 'x' | 'y',
): void {
  // Compute center of each subtree on the axis
  const center = (s: Set<string>) => {
    let sum = 0;
    for (const id of s) sum += positions.get(id)![axis];
    return sum / s.size;
  };
  const centerA = center(setA);
  const centerB = center(setB);
  const mid = (centerA + centerB) / 2;

  // Mirror each node in both subtrees around the midpoint
  for (const id of setA) {
    const p = positions.get(id)!;
    p[axis] = 2 * mid - p[axis];
  }
  for (const id of setB) {
    const p = positions.get(id)!;
    p[axis] = 2 * mid - p[axis];
  }
}

/**
 * Align nodes in linear chains to share the same vertical center.
 * A "linear chain" node has exactly one incoming edge and one outgoing edge.
 * We center each such node to align with its parent's center on the layout axis.
 * This fixes misalignment when fork/join centering shifts some nodes but leaves
 * intermediate single-chain nodes at their dagre positions.
 */
function alignLinearChains<N extends Node>(
  nodes: N[],
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>,
  direction: 'TB' | 'LR',
): void {
  const axis = direction === 'TB' ? 'x' : 'y';

  // Build incoming/outgoing counts and maps
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();
  for (const e of edges) {
    const inc = incomingEdges.get(e.target) ?? [];
    inc.push(e.source);
    incomingEdges.set(e.target, inc);
    const out = outgoingEdges.get(e.source) ?? [];
    out.push(e.target);
    outgoingEdges.set(e.source, out);
  }

  // Walk each chain: start from nodes that are NOT single-in/single-out
  // (anchors like start, trigger, fork, join, condition with branches) and propagate
  // their center down through single-child chains.
  const visited = new Set<string>();

  function propagateDown(nodeId: string) {
    const children = outgoingEdges.get(nodeId) ?? [];
    if (children.length !== 1) return; // not a single-child link

    const childId = children[0];
    if (visited.has(childId)) return;

    const childIncoming = incomingEdges.get(childId) ?? [];
    if (childIncoming.length !== 1) return; // child has multiple parents (e.g. join)

    visited.add(childId);

    // Center child under parent
    const parentPos = positions.get(nodeId);
    const parentW = nodeWidths.get(nodeId) ?? 0;
    const childPos = positions.get(childId);
    const childW = nodeWidths.get(childId) ?? 0;

    if (parentPos && childPos) {
      const parentCenter = parentPos[axis] + parentW / 2;
      childPos[axis] = parentCenter - childW / 2;
    }

    // Continue propagating
    propagateDown(childId);
  }

  // Start propagation from every node
  for (const node of nodes) {
    const inc = incomingEdges.get(node.id) ?? [];
    const out = outgoingEdges.get(node.id) ?? [];

    // Start propagation from anchors (not single-in/single-out)
    // or from nodes that have already been positioned (start, trigger, fork, join, condition, end)
    const isSingleChain = inc.length === 1 && out.length === 1;
    if (!isSingleChain && out.length === 1) {
      propagateDown(node.id);
    }
  }
}

/**
 * Center condition branch children (Yes/No) symmetrically under the condition node.
 * Also shifts each branch's subtree so the layout stays coherent.
 */
function centerConditionBranches<N extends Node>(
  nodes: N[],
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>,
  direction: 'TB' | 'LR',
): void {
  const axis = direction === 'TB' ? 'x' : 'y';

  // Build edge lookup by source
  const bySource = new Map<string, Edge[]>();
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = bySource.get(e.source) ?? [];
    arr.push(e);
    bySource.set(e.source, arr);
    const ch = childrenOf.get(e.source) ?? [];
    ch.push(e.target);
    childrenOf.set(e.source, ch);
  }

  // Stop subtree collection at join nodes
  const joinIds = new Set(nodes.filter(n => n.type === 'join').map(n => n.id));

  for (const node of nodes) {
    if (node.type !== 'condition') continue;
    const outEdges = bySource.get(node.id) ?? [];
    const trueEdge = outEdges.find(e => e.sourceHandle === 'true' || e.label === 'Yes');
    const falseEdge = outEdges.find(e => e.sourceHandle === 'false' || e.label === 'No');
    if (!trueEdge || !falseEdge) continue;

    const condPos = positions.get(node.id);
    const condW = nodeWidths.get(node.id) ?? 0;
    if (!condPos) continue;
    const condCenter = condPos[axis] + condW / 2;

    // Collect each branch's subtree (stop at join)
    const trueSubtree = collectSubtreeUntil(trueEdge.target, childrenOf, joinIds);
    const falseSubtree = collectSubtreeUntil(falseEdge.target, childrenOf, joinIds);

    // Compute bounding box of each subtree on the axis
    const getBounds = (subtree: Set<string>) => {
      let min = Infinity, max = -Infinity;
      for (const id of subtree) {
        const p = positions.get(id);
        const w = nodeWidths.get(id) ?? 0;
        if (p) {
          min = Math.min(min, p[axis]);
          max = Math.max(max, p[axis] + w);
        }
      }
      return { min, max, width: max - min };
    };

    const trueBounds = getBounds(trueSubtree);
    const falseBounds = getBounds(falseSubtree);
    if (!isFinite(trueBounds.min) || !isFinite(falseBounds.min)) continue;

    // Desired layout: [trueSubtree] GAP [falseSubtree], centered on condCenter
    const GAP = MIN_GAP;
    const totalWidth = trueBounds.width + GAP + falseBounds.width;
    const desiredTrueLeft = condCenter - totalWidth / 2;
    const desiredFalseLeft = desiredTrueLeft + trueBounds.width + GAP;

    // Shift true subtree
    const trueDelta = desiredTrueLeft - trueBounds.min;
    for (const id of trueSubtree) {
      const p = positions.get(id);
      if (p) p[axis] += trueDelta;
    }

    // Shift false subtree
    const falseDelta = desiredFalseLeft - falseBounds.min;
    for (const id of falseSubtree) {
      const p = positions.get(id);
      if (p) p[axis] += falseDelta;
    }
  }
}

/**
 * Post-process: center fork and join nodes horizontally (TB) or vertically (LR)
 * over the midpoint of their immediate branch children/parents.
 *
 * Dagre doesn't understand fork/join semantics, so it often places these nodes
 * off-center relative to their parallel branches.
 */
function centerForkJoinNodes<N extends Node>(
  nodes: N[],
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>,
  nodeHeights: Map<string, number>,
  direction: 'TB' | 'LR',
): void {
  const axis = direction === 'TB' ? 'x' : 'y';
  const rankAxis = direction === 'TB' ? 'y' : 'x';
  const rankSizeMap = direction === 'TB' ? nodeHeights : nodeWidths;

  // Build adjacency
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const out = outgoing.get(e.source) ?? [];
    out.push(e.target);
    outgoing.set(e.source, out);

    const inc = incoming.get(e.target) ?? [];
    inc.push(e.source);
    incoming.set(e.target, inc);
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Build child→descendants map
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
  }
  const joinIds = new Set(nodes.filter(n => n.type === 'join').map(n => n.id));

  // Center fork nodes over the full bounding box of their subtree (excluding join)
  for (const node of nodes) {
    if (node.type !== 'fork') continue;
    const children = outgoing.get(node.id);
    if (!children || children.length < 2) continue;

    // Gather all subtree nodes between fork and join
    const subtreeNodes: string[] = [];
    for (const cid of children) {
      const sub = collectSubtreeUntil(cid, childrenOf, joinIds);
      for (const id of sub) {
        if (!joinIds.has(id)) subtreeNodes.push(id);
      }
    }

    if (subtreeNodes.length < 2) continue;

    const bounds = subtreeNodes
      .map(id => {
        const p = positions.get(id);
        const w = nodeWidths.get(id) ?? 0;
        return p ? { left: p[axis], right: p[axis] + w } : null;
      })
      .filter((v): v is { left: number; right: number } => v !== null);

    const minLeft = Math.min(...bounds.map(b => b.left));
    const maxRight = Math.max(...bounds.map(b => b.right));
    const forkW = nodeWidths.get(node.id) ?? 0;
    const forkCenter = (minLeft + maxRight) / 2;

    const forkPos = positions.get(node.id)!;
    forkPos[axis] = forkCenter - forkW / 2;
  }

  // Center join nodes horizontally AND push below the deepest parent
  for (const node of nodes) {
    if (node.type !== 'join') continue;
    const parents = incoming.get(node.id);
    if (!parents || parents.length < 2) continue;

    const bounds = parents
      .map(pid => {
        const p = positions.get(pid);
        const w = nodeWidths.get(pid) ?? 0;
        const h = rankSizeMap.get(pid) ?? 0;
        return p ? { left: p[axis], right: p[axis] + w, bottom: p[rankAxis] + h } : null;
      })
      .filter((v): v is { left: number; right: number; bottom: number } => v !== null);

    if (bounds.length < 2) continue;

    // Center horizontally
    const minLeft = Math.min(...bounds.map(b => b.left));
    const maxRight = Math.max(...bounds.map(b => b.right));
    const joinW = nodeWidths.get(node.id) ?? 0;
    const joinCenter = (minLeft + maxRight) / 2;

    const joinPos = positions.get(node.id)!;
    joinPos[axis] = joinCenter - joinW / 2;

    // Push below the deepest parent + gap
    const deepestBottom = Math.max(...bounds.map(b => b.bottom));
    const JOIN_GAP = 40;
    if (joinPos[rankAxis] < deepestBottom + JOIN_GAP) {
      joinPos[rankAxis] = deepestBottom + JOIN_GAP;
    }
  }

  // Also center start node if it feeds directly into a fork
  for (const node of nodes) {
    if (node.type !== 'start' && node.type !== 'webhook' && node.type !== 'schedule') continue;
    const children = outgoing.get(node.id);
    if (!children || children.length !== 1) continue;
    const child = nodeMap.get(children[0]);
    if (child?.type !== 'fork') continue;

    const forkPos = positions.get(child.id);
    const forkW = nodeWidths.get(child.id) ?? 0;
    const startW = nodeWidths.get(node.id) ?? 0;
    if (forkPos) {
      const startPos = positions.get(node.id)!;
      startPos[axis] = forkPos[axis] + (forkW - startW) / 2;
    }
  }

  // Center end nodes over their parent(s)
  for (const node of nodes) {
    if (node.type !== 'end') continue;
    const parents = incoming.get(node.id);
    if (!parents || parents.length === 0) continue;

    const endW = nodeWidths.get(node.id) ?? 0;
    const endPos = positions.get(node.id)!;

    if (parents.length === 1) {
      // Single parent: center under it
      const parentPos = positions.get(parents[0]);
      const parentW = nodeWidths.get(parents[0]) ?? 0;
      if (parentPos) {
        endPos[axis] = parentPos[axis] + (parentW - endW) / 2;
      }
    } else {
      // Multiple parents: center over the bounding box
      const bounds = parents
        .map(pid => {
          const p = positions.get(pid);
          const w = nodeWidths.get(pid) ?? 0;
          return p ? { left: p[axis], right: p[axis] + w } : null;
        })
        .filter((v): v is { left: number; right: number } => v !== null);
      if (bounds.length > 0) {
        const minLeft = Math.min(...bounds.map(b => b.left));
        const maxRight = Math.max(...bounds.map(b => b.right));
        endPos[axis] = (minLeft + maxRight) / 2 - endW / 2;
      }
    }
  }
}
