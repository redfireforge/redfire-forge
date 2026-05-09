/**
 * Fork/Join topology detection for parallel execution visualization.
 *
 * Identifies fork/join pairs in a workflow graph and assigns each
 * intermediate node to a branch index. Supports nested fork/join.
 */

export interface ForkJoinPair {
  forkId: string;
  joinId: string;
  /** Ordered list of branches; each branch is a list of node IDs between fork and join. */
  branches: string[][];
}

export interface BranchAssignment {
  /** Fork/join pair this node belongs to */
  forkId: string;
  joinId: string;
  /** Zero-based branch index within the pair */
  branchIndex: number;
}

export interface ForkJoinTopology {
  pairs: ForkJoinPair[];
  /** Maps node ID → branch assignment (only nodes between a fork and join) */
  assignments: Map<string, BranchAssignment>;
}

interface SimpleNode {
  id: string;
  type?: string;
}

interface SimpleEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Detect all fork/join pairs and assign branch indices to intermediate nodes.
 *
 * Algorithm:
 * 1. Find all fork nodes (type === 'fork')
 * 2. For each fork, find outgoing edges → each edge starts a branch
 * 3. Walk each branch forward until reaching a join node (type === 'join')
 * 4. Collect all intermediate nodes per branch
 * 5. Handle nested forks: if a branch contains another fork, recurse
 */
export function detectForkJoinTopology(
  nodes: SimpleNode[],
  edges: SimpleEdge[],
): ForkJoinTopology {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, SimpleEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }

  const pairs: ForkJoinPair[] = [];
  const assignments = new Map<string, BranchAssignment>();

  const forkNodes = nodes.filter(n => n.type === 'fork');

  for (const fork of forkNodes) {
    const forkEdges = outgoing.get(fork.id) ?? [];
    if (forkEdges.length < 2) continue;

    const branches: string[][] = [];
    let joinId: string | undefined;

    for (const edge of forkEdges) {
      const branch: string[] = [];
      const visited = new Set<string>();
      let current = edge.target;

      while (current) {
        if (visited.has(current)) break;
        visited.add(current);

        const node = nodeMap.get(current);
        if (!node) break;

        if (node.type === 'join') {
          joinId = current;
          break;
        }

        branch.push(current);

        const nextEdges = outgoing.get(current) ?? [];
        if (nextEdges.length === 0) break;

        if (node.type === 'fork') {
          // Nested fork: skip to its matching join, then continue
          const nestedJoin = findMatchingJoin(current, nodeMap, outgoing);
          if (nestedJoin) {
            const nestedOutgoing = outgoing.get(nestedJoin) ?? [];
            current = nestedOutgoing[0]?.target ?? '';
          } else {
            break;
          }
        } else {
          current = nextEdges[0].target;
        }
      }

      branches.push(branch);
    }

    if (joinId && branches.length >= 2) {
      const pair: ForkJoinPair = { forkId: fork.id, joinId, branches };
      pairs.push(pair);

      for (let i = 0; i < branches.length; i++) {
        for (const nodeId of branches[i]) {
          if (!assignments.has(nodeId)) {
            assignments.set(nodeId, {
              forkId: fork.id,
              joinId,
              branchIndex: i,
            });
          }
        }
      }
    }
  }

  return { pairs, assignments };
}

/**
 * Walk forward from a fork to find its matching join.
 * Handles nested forks by tracking depth.
 */
function findMatchingJoin(
  forkId: string,
  nodeMap: Map<string, SimpleNode>,
  outgoing: Map<string, SimpleEdge[]>,
): string | undefined {
  const forkEdges = outgoing.get(forkId) ?? [];
  if (forkEdges.length === 0) return undefined;

  // BFS from all branch starts, looking for a join where all branches converge
  const queue: string[] = forkEdges.map(e => e.target);
  const visited = new Set<string>([forkId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodeMap.get(current);
    if (!node) continue;

    if (node.type === 'join') {
      return current;
    }

    if (node.type === 'fork') {
      // Nested fork — skip to its matching join
      const nestedJoin = findMatchingJoin(current, nodeMap, outgoing);
      if (nestedJoin) {
        const nextEdges = outgoing.get(nestedJoin) ?? [];
        for (const e of nextEdges) {
          if (!visited.has(e.target)) queue.push(e.target);
        }
      }
    } else {
      const nextEdges = outgoing.get(current) ?? [];
      for (const e of nextEdges) {
        if (!visited.has(e.target)) queue.push(e.target);
      }
    }
  }

  return undefined;
}

/**
 * Branch color palette — 8 distinct colors for swim lanes.
 * Uses the same hue family as the app's dark theme.
 */
export const BRANCH_COLORS = [
  'rgba(59, 130, 246, 0.12)',   // blue
  'rgba(168, 85, 247, 0.12)',   // purple
  'rgba(245, 158, 11, 0.12)',   // amber
  'rgba(16, 185, 129, 0.12)',   // emerald
  'rgba(239, 68, 68, 0.12)',    // red
  'rgba(236, 72, 153, 0.12)',   // pink
  'rgba(14, 165, 233, 0.12)',   // sky
  'rgba(132, 204, 22, 0.12)',   // lime
] as const;

export const BRANCH_BORDER_COLORS = [
  'rgba(59, 130, 246, 0.4)',
  'rgba(168, 85, 247, 0.4)',
  'rgba(245, 158, 11, 0.4)',
  'rgba(16, 185, 129, 0.4)',
  'rgba(239, 68, 68, 0.4)',
  'rgba(236, 72, 153, 0.4)',
  'rgba(14, 165, 233, 0.4)',
  'rgba(132, 204, 22, 0.4)',
] as const;

export const BRANCH_LABELS = [
  'Branch A', 'Branch B', 'Branch C', 'Branch D',
  'Branch E', 'Branch F', 'Branch G', 'Branch H',
] as const;

export interface BranchExecutionStats {
  branchIndex: number;
  label: string;
  nodeIds: string[];
  totalDurationMs: number;
  nodeCount: number;
  passRate: number;
  isCriticalPath: boolean;
}

interface TraceIteration {
  events: Array<{
    nodeId: string;
    state: 'pass' | 'fail' | 'skipped';
    durationMs?: number;
    timestamp: number;
  }>;
}

/**
 * Compute per-branch execution statistics from trace data.
 * The "critical path" is the slowest branch (determines fork/join total time).
 */
export function computeBranchStats(
  pair: ForkJoinPair,
  iterations: TraceIteration[],
): BranchExecutionStats[] {
  const stats: BranchExecutionStats[] = pair.branches.map((nodeIds, i) => ({
    branchIndex: i,
    label: BRANCH_LABELS[i % BRANCH_LABELS.length],
    nodeIds,
    totalDurationMs: 0,
    nodeCount: nodeIds.length,
    passRate: 100,
    isCriticalPath: false,
  }));

  for (let i = 0; i < stats.length; i++) {
    const { nodeIds } = stats[i];
    const nodeIdSet = new Set(nodeIds);

    let totalDuration = 0;
    let passCount = 0;
    let totalExec = 0;

    for (const iter of iterations) {
      let branchDuration = 0;
      for (const ev of iter.events) {
        if (!nodeIdSet.has(ev.nodeId)) continue;
        branchDuration += ev.durationMs ?? 0;
        totalExec++;
        if (ev.state === 'pass') passCount++;
      }
      totalDuration += branchDuration;
    }

    const avgDuration = iterations.length > 0 ? totalDuration / iterations.length : 0;
    stats[i].totalDurationMs = Math.round(avgDuration * 100) / 100;
    stats[i].passRate = totalExec > 0 ? Math.round((passCount / totalExec) * 10000) / 100 : 100;
  }

  // Mark the critical path (slowest branch)
  let maxDuration = -1;
  let criticalIdx = 0;
  for (let i = 0; i < stats.length; i++) {
    if (stats[i].totalDurationMs > maxDuration) {
      maxDuration = stats[i].totalDurationMs;
      criticalIdx = i;
    }
  }
  if (stats.length > 0) {
    stats[criticalIdx].isCriticalPath = true;
  }

  return stats;
}

/**
 * Compute the bounding box for a set of node positions.
 * Used by swim-lane rendering to draw background regions.
 */
export function computeBranchBounds(
  nodeIds: string[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeWidth = 220,
  nodeHeight = 60,
  padding = 20,
): { x: number; y: number; width: number; height: number } | null {
  const positions = nodeIds.map(id => nodePositions.get(id)).filter(Boolean) as { x: number; y: number }[];
  if (positions.length === 0) return null;

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + nodeWidth + padding * 2,
    height: (maxY - minY) + nodeHeight + padding * 2,
  };
}
