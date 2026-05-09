import type { WorkflowExecutionTrace } from '../../../shared/types';

export interface BottleneckInsight {
  nodeId: string;
  nodeLabel: string;
  /** Why this node is flagged */
  reason: 'time-dominant' | 'high-variance' | 'high-failure' | 'critical-path';
  severity: 'critical' | 'warning' | 'info';
  /** Human-readable explanation */
  message: string;
  /** Actionable suggestion */
  suggestion: string;
  /** Supporting metric */
  metric: {
    label: string;
    value: string;
  };
}

interface NodeStats {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  stdDevMs: number;
  executionCount: number;
  failureCount: number;
  failureRate: number;
  /** Fraction of total workflow time consumed by this node */
  timeSharePct: number;
  /** Coefficient of variation (stdDev / mean) — higher = more inconsistent */
  cv: number;
}

/**
 * Compute per-node execution statistics across all sampled iterations.
 */
export function computeNodeStats(trace: WorkflowExecutionTrace): NodeStats[] {
  const durationsMap = new Map<string, { durations: number[]; failures: number; label: string; type: string }>();

  const sampledIterations = trace.iterations.filter(it => it.sampled !== false);
  for (const iter of sampledIterations) {
    for (const event of iter.events) {
      if (event.durationMs === undefined) continue;
      let entry = durationsMap.get(event.nodeId);
      if (!entry) {
        entry = { durations: [], failures: 0, label: event.nodeLabel, type: event.nodeType };
        durationsMap.set(event.nodeId, entry);
      }
      entry.durations.push(event.durationMs);
      if (event.state === 'fail') entry.failures++;
    }
  }

  const totalWorkflowTime = sampledIterations.reduce((s, it) => s + it.durationMs, 0);

  const stats: NodeStats[] = [];
  for (const [nodeId, { durations, failures, label, type }] of durationsMap) {
    if (durations.length === 0) continue;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const variance = durations.reduce((a, d) => a + (d - avg) ** 2, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0;

    stats.push({
      nodeId,
      nodeLabel: label,
      nodeType: type,
      totalDurationMs: sum,
      avgDurationMs: avg,
      minDurationMs: min,
      maxDurationMs: max,
      stdDevMs: stdDev,
      executionCount: durations.length,
      failureCount: failures,
      failureRate: failures / durations.length,
      timeSharePct: totalWorkflowTime > 0 ? (sum / totalWorkflowTime) * 100 : 0,
      cv,
    });
  }

  return stats.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
}

/**
 * Identify bottleneck nodes and generate actionable insights.
 * Returns insights sorted by severity (critical first).
 */
export function identifyBottlenecks(trace: WorkflowExecutionTrace): BottleneckInsight[] {
  const stats = computeNodeStats(trace);
  if (stats.length < 2) return [];

  const insights: BottleneckInsight[] = [];
  const seenNodes = new Set<string>();

  const maxAvg = Math.max(...stats.map(s => s.avgDurationMs));

  for (const s of stats) {
    // Skip non-HTTP/script nodes (trigger, start, etc. are usually trivial)
    if (['start', 'fork', 'join'].includes(s.nodeType)) continue;

    // 1. Time-dominant: node consumes ≥40% of total workflow time
    if (s.timeSharePct >= 40 && !seenNodes.has(s.nodeId)) {
      seenNodes.add(s.nodeId);
      insights.push({
        nodeId: s.nodeId,
        nodeLabel: s.nodeLabel,
        reason: 'time-dominant',
        severity: s.timeSharePct >= 60 ? 'critical' : 'warning',
        message: `Consumes ${s.timeSharePct.toFixed(0)}% of total execution time`,
        suggestion: s.nodeType === 'http'
          ? 'Consider caching, payload reduction, or server-side optimization'
          : 'Consider optimizing script logic or breaking into smaller steps',
        metric: { label: 'Time share', value: `${s.timeSharePct.toFixed(1)}%` },
      });
    }

    // 2. High variance: CV > 0.5 and meaningful sample size
    if (s.cv > 0.5 && s.executionCount >= 3 && !seenNodes.has(s.nodeId)) {
      seenNodes.add(s.nodeId);
      insights.push({
        nodeId: s.nodeId,
        nodeLabel: s.nodeLabel,
        reason: 'high-variance',
        severity: s.cv > 1.0 ? 'critical' : 'warning',
        message: `Response time varies ${s.cv > 1 ? 'extremely' : 'significantly'} (CV: ${s.cv.toFixed(2)})`,
        suggestion: 'Investigate unstable endpoint — check server load, timeouts, or retry logic',
        metric: { label: 'Range', value: `${s.minDurationMs.toFixed(0)}–${s.maxDurationMs.toFixed(0)}ms` },
      });
    }

    // 3. High failure rate: ≥20% failure rate
    if (s.failureRate >= 0.2 && s.executionCount >= 2 && !seenNodes.has(s.nodeId)) {
      seenNodes.add(s.nodeId);
      insights.push({
        nodeId: s.nodeId,
        nodeLabel: s.nodeLabel,
        reason: 'high-failure',
        severity: s.failureRate >= 0.5 ? 'critical' : 'warning',
        message: `${(s.failureRate * 100).toFixed(0)}% failure rate (${s.failureCount}/${s.executionCount})`,
        suggestion: 'Check assertion rules, endpoint availability, or auth configuration',
        metric: { label: 'Failure rate', value: `${(s.failureRate * 100).toFixed(0)}%` },
      });
    }

    // 4. Critical path: slowest node overall (only if not already flagged)
    if (s.avgDurationMs === maxAvg && !seenNodes.has(s.nodeId)) {
      seenNodes.add(s.nodeId);
      insights.push({
        nodeId: s.nodeId,
        nodeLabel: s.nodeLabel,
        reason: 'critical-path',
        severity: 'info',
        message: `Slowest node in the workflow (avg ${s.avgDurationMs.toFixed(0)}ms)`,
        suggestion: 'This node determines minimum iteration time — optimize here for maximum impact',
        metric: { label: 'Avg duration', value: `${s.avgDurationMs.toFixed(0)}ms` },
      });
    }
  }

  // Surface all remaining actionable nodes (HTTP, script, subWorkflow) as info-level for context
  const actionableTypes = new Set(['http', 'script', 'subWorkflow', 'aggregate', 'webhook']);
  const remaining = stats.filter(s => actionableTypes.has(s.nodeType) && !seenNodes.has(s.nodeId));
  for (const s of remaining) {
    seenNodes.add(s.nodeId);
    insights.push({
      nodeId: s.nodeId,
      nodeLabel: s.nodeLabel,
      reason: 'critical-path',
      severity: 'info',
      message: `Avg ${s.avgDurationMs.toFixed(0)}ms — ${s.timeSharePct.toFixed(0)}% of total time`,
      suggestion: s.avgDurationMs > maxAvg * 0.5
        ? 'Notable time consumer — consider optimizing if overall time is too high'
        : 'Good performance relative to other nodes',
      metric: { label: 'Avg duration', value: `${s.avgDurationMs.toFixed(0)}ms` },
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Returns the set of bottleneck node IDs for quick lookup.
 */
export function getBottleneckNodeIds(insights: BottleneckInsight[]): Map<string, BottleneckInsight> {
  const map = new Map<string, BottleneckInsight>();
  for (const insight of insights) {
    if (!map.has(insight.nodeId)) {
      map.set(insight.nodeId, insight);
    }
  }
  return map;
}
