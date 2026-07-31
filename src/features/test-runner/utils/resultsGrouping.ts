import type { RequestResult } from '../../../shared/types';

export type GroupByLevel = 'feature' | 'group' | 'test' | 'dataRow' | 'workflowStep' | 'iteration';

export interface GroupNode {
  key: string;
  results: RequestResult[];
  children: GroupNode[];
  total: number;
  passed: number;
  failed: number;
  validationFailed: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  /** Percentile metrics for workflow step summaries */
  p50Time?: number;
  p95Time?: number;
  p99Time?: number;
}

export function computeStats(results: RequestResult[]): Omit<GroupNode, 'key' | 'results' | 'children'> {
  const times = results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const n = times.length;
  const passedCount = results.filter((r) => r.passed).length;
  const valFailed = results.filter((r) => !r.passed && (r.failureDetails?.length ?? 0) > 0).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount - valFailed,
    validationFailed: valFailed,
    avgTime: n ? Math.round(times.reduce((a, b) => a + b, 0) / n) : 0,
    minTime: n ? times[0] : 0,
    maxTime: n ? times[n - 1] : 0,
    p50Time: n ? times[Math.floor(n * 0.5)] : 0,
    p95Time: n ? times[Math.floor(n * 0.95)] : 0,
    p99Time: n ? times[Math.floor(n * 0.99)] : 0,
  };
}

export function buildGroups(results: RequestResult[], levels: GroupByLevel[]): GroupNode[] {
  if (levels.length === 0 || results.length === 0) return [];

  const [level, ...rest] = levels;
  const map = new Map<string, RequestResult[]>();

  for (const r of results) {
    let key: string;
    if (level === 'feature') key = r.featureGroupName || '';
    else if (level === 'group') key = r.groupName || r.scenarioName || '(unknown group)';
    else if (level === 'dataRow') key = r.dataRowLabel || r.dataRowId || '(no data row)';
    else if (level === 'workflowStep') key = r.workflowNodeId || r.scenarioName || '(unknown step)';
    else if (level === 'iteration') key = r.iterationIndex !== undefined ? `Iteration #${r.iterationIndex}` : '(unknown iteration)';
    else key = r.scenarioName;
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }

  const entries = Array.from(map.entries());
  
  if (level === 'iteration') {
    entries.sort((a, b) => {
      const aNum = parseInt(a[0].replace('Iteration #', '')) || 0;
      const bNum = parseInt(b[0].replace('Iteration #', '')) || 0;
      return aNum - bNum;
    });
  }

  return entries.map(([key, items]) => ({
    key,
    results: items,
    children: rest.length > 0 ? buildGroups(items, rest) : [],
    ...computeStats(items),
  }));
}

/** Check if results have workflow iteration data */
export function hasWorkflowData(results: RequestResult[]): boolean {
  return results.some(r => r.iterationIndex !== undefined || r.workflowNodeId !== undefined);
}

/** Get unique workflow step names from results */
export function getWorkflowSteps(results: RequestResult[]): string[] {
  const steps = new Set<string>();
  for (const r of results) {
    if (r.workflowNodeId) steps.add(r.workflowNodeId);
    else if (r.scenarioName) steps.add(r.scenarioName);
  }
  return Array.from(steps);
}

/** Get iteration count from results */
export function getIterationCount(results: RequestResult[]): number {
  const iterations = new Set<number>();
  for (const r of results) {
    if (r.iterationIndex !== undefined) iterations.add(r.iterationIndex);
  }
  return iterations.size;
}

/** Compute per-step summary for workflow results */
export interface WorkflowStepSummary {
  stepName: string;
  total: number;
  passed: number;
  passRate: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50Time: number;
  p95Time: number;
  p99Time: number;
}

export function computeWorkflowStepSummaries(results: RequestResult[]): WorkflowStepSummary[] {
  const stepGroups = buildGroups(results, ['workflowStep']);
  return stepGroups.map(g => ({
    stepName: g.key,
    total: g.total,
    passed: g.passed,
    passRate: g.total > 0 ? Math.round((g.passed / g.total) * 100) : 0,
    avgTime: g.avgTime,
    minTime: g.minTime,
    maxTime: g.maxTime,
    p50Time: g.p50Time ?? 0,
    p95Time: g.p95Time ?? 0,
    p99Time: g.p99Time ?? 0,
  }));
}

/** Compute per-iteration summary for workflow results */
export interface WorkflowIterationSummary {
  iterationIndex: number;
  total: number;
  passed: number;
  allPassed: boolean;
  totalTime: number;
  results: RequestResult[];
}

export function computeWorkflowIterationSummaries(results: RequestResult[]): WorkflowIterationSummary[] {
  const iterGroups = buildGroups(results, ['iteration']);
  return iterGroups.map(g => {
    const idx = Number.parseInt(g.key.replace('Iteration #', ''), 10);
    const iterationIndex = Number.isNaN(idx) ? 0 : idx;
    const totalTime = Math.round(g.results.reduce((sum, r) => sum + r.responseTimeMs, 0) * 10) / 10;
    return {
      iterationIndex,
      total: g.total,
      passed: g.passed,
      allPassed: g.passed === g.total,
      totalTime,
      results: g.results,
    };
  }).sort((a, b) => a.iterationIndex - b.iterationIndex);
}
