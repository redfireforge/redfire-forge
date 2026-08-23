import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';
import { isSampledIteration } from './sampledIterations';

export interface TimelineBar {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  state: 'pass' | 'fail' | 'skipped';
  startMs: number;
  durationMs: number;
  lane: number;
  statusCode?: number;
  responseTimeMs?: number;
}

export interface TimelineTick {
  positionMs: number;
  label: string;
}

const MIN_BAR_WIDTH_MS = 1;

/**
 * Build timeline bars from an iteration's events.
 * Normalizes timestamps so the earliest event starts at 0.
 */
export function buildTimelineBars(events: ExecutionEvent[]): TimelineBar[] {
  if (events.length === 0) return [];

  const minTimestamp = Math.min(...events.map(e => e.timestamp));

  const bars: TimelineBar[] = events.map(e => ({
    nodeId: e.nodeId,
    nodeLabel: e.nodeLabel,
    nodeType: e.nodeType,
    state: e.state,
    startMs: e.timestamp - minTimestamp,
    durationMs: Math.max(e.durationMs ?? MIN_BAR_WIDTH_MS, MIN_BAR_WIDTH_MS),
    lane: 0,
    statusCode: e.details?.statusCode,
    responseTimeMs: e.details?.responseTimeMs,
  }));

  assignLanes(bars);
  return bars;
}

/**
 * Assign swim lanes to bars using greedy interval scheduling.
 * Bars that overlap in time are placed in different lanes.
 */
export function assignLanes(bars: TimelineBar[]): void {
  const sorted = [...bars].sort((a, b) => a.startMs - b.startMs || a.durationMs - b.durationMs);
  const laneEnds: number[] = [];

  for (const bar of sorted) {
    const end = bar.startMs + bar.durationMs;
    let assigned = false;
    for (let i = 0; i < laneEnds.length; i++) {
      if (bar.startMs >= laneEnds[i]) {
        laneEnds[i] = end;
        bar.lane = i;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      bar.lane = laneEnds.length;
      laneEnds.push(end);
    }
  }
}

const TICK_INTERVALS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1_000, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000,
  120_000, 300_000, 600_000,
];

/**
 * Generate time axis ticks for a given duration.
 * Picks a tick interval that produces 4–12 ticks.
 */
export function generateTicks(totalMs: number): TimelineTick[] {
  if (totalMs <= 0) return [{ positionMs: 0, label: '0ms' }];

  let interval = TICK_INTERVALS[TICK_INTERVALS.length - 1];
  for (const candidate of TICK_INTERVALS) {
    const count = Math.floor(totalMs / candidate);
    if (count >= 4 && count <= 12) {
      interval = candidate;
      break;
    }
    if (count < 4) {
      interval = candidate;
      break;
    }
  }

  const ticks: TimelineTick[] = [];
  for (let t = 0; t <= totalMs; t += interval) {
    ticks.push({ positionMs: t, label: formatTickLabel(t) });
  }
  if (ticks.length > 0 && ticks[ticks.length - 1].positionMs < totalMs) {
    ticks.push({ positionMs: totalMs, label: formatTickLabel(totalMs) });
  }
  return ticks;
}

function formatTickLabel(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) {
    const s = ms / 1_000;
    return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
  }
  const m = ms / 60_000;
  return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

/**
 * Calculate total timeline span from a set of bars.
 */
export function getTimelineSpan(bars: TimelineBar[]): number {
  if (bars.length === 0) return 0;
  return Math.max(...bars.map(b => b.startMs + b.durationMs));
}

/**
 * Get the max lane count (number of parallel tracks needed).
 */
export function getMaxLane(bars: TimelineBar[]): number {
  if (bars.length === 0) return 0;
  return Math.max(...bars.map(b => b.lane)) + 1;
}

/**
 * Build aggregate bars from multiple iterations (for overlay mode).
 * Groups events by nodeId, returning one bar per node per iteration.
 */
export function buildAggregateBars(iterations: WorkflowIterationTrace[]): TimelineBar[][] {
  return iterations
    .filter(isSampledIteration)
    .map(iter => buildTimelineBars(iter.events));
}

/**
 * Calculate P95 duration from a list of durations.
 */
export function calcP95(durations: number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

interface SnapshotNode {
  id: string;
  type?: string;
  data?: { label?: string; name?: string };
}

interface SnapshotEdge {
  source: string;
  target: string;
}

/**
 * Build a topologically-sorted list of node IDs from the workflow snapshot.
 * Falls back to snapshot array order for any nodes unreachable from edges.
 */
export function topologicalNodeOrder(
  nodes: SnapshotNode[],
  edges: SnapshotEdge[],
): string[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    children.set(id, []);
  }

  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    children.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const child of children.get(id) ?? []) {
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  for (const id of nodeIds) {
    if (!result.includes(id)) result.push(id);
  }

  return result;
}
