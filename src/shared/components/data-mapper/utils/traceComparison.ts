/**
 * Trace Comparison Engine — Phase 9D
 *
 * Compares two sets of MappingTrace[] (from different test runs)
 * and produces a per-mapping diff: unchanged, changed, added, removed, regression.
 *
 * A "regression" is a mapping that passed in the baseline but fails in the current run.
 */

import type { MappingTrace } from './mappingTrace';
import { isTraceError } from './mappingTrace';

export type ComparisonStatus = 'unchanged' | 'changed' | 'regression' | 'fixed' | 'added' | 'removed';

export interface TraceComparisonEntry {
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  status: ComparisonStatus;
  baseline?: MappingTrace;
  current?: MappingTrace;
}

export interface TraceComparisonResult {
  entries: TraceComparisonEntry[];
  summary: TraceComparisonSummary;
}

export interface TraceComparisonSummary {
  total: number;
  unchanged: number;
  changed: number;
  regressions: number;
  fixed: number;
  added: number;
  removed: number;
}

/**
 * Compare two trace sets and produce a per-mapping diff.
 *
 * Matching is done by `mappingId`. If a mapping exists in both sets,
 * we compare targetValue and error status to classify the change.
 */
export function compareTraces(
  baseline: MappingTrace[],
  current: MappingTrace[],
): TraceComparisonResult {
  const baseMap = new Map<string, MappingTrace>();
  for (const t of baseline) baseMap.set(t.mappingId, t);

  const currentMap = new Map<string, MappingTrace>();
  for (const t of current) currentMap.set(t.mappingId, t);

  const entries: TraceComparisonEntry[] = [];
  const allIds = new Set([...baseMap.keys(), ...currentMap.keys()]);

  for (const id of allIds) {
    const base = baseMap.get(id);
    const curr = currentMap.get(id);

    if (base && curr) {
      const baseError = isTraceError(base);
      const currError = isTraceError(curr);
      const valuesEqual = serializeValue(base.targetValue) === serializeValue(curr.targetValue)
        && base.error === curr.error;

      let status: ComparisonStatus;
      if (valuesEqual) {
        status = 'unchanged';
      } else if (!baseError && currError) {
        status = 'regression';
      } else if (baseError && !currError) {
        status = 'fixed';
      } else {
        status = 'changed';
      }

      entries.push({
        mappingId: id,
        sourcePath: curr.sourcePath,
        targetPath: curr.targetPath,
        status,
        baseline: base,
        current: curr,
      });
    } else if (base && !curr) {
      entries.push({
        mappingId: id,
        sourcePath: base.sourcePath,
        targetPath: base.targetPath,
        status: 'removed',
        baseline: base,
      });
    } else if (!base && curr) {
      entries.push({
        mappingId: id,
        sourcePath: curr.sourcePath,
        targetPath: curr.targetPath,
        status: 'added',
        current: curr,
      });
    }
  }

  const summary: TraceComparisonSummary = {
    total: entries.length,
    unchanged: entries.filter((e) => e.status === 'unchanged').length,
    changed: entries.filter((e) => e.status === 'changed').length,
    regressions: entries.filter((e) => e.status === 'regression').length,
    fixed: entries.filter((e) => e.status === 'fixed').length,
    added: entries.filter((e) => e.status === 'added').length,
    removed: entries.filter((e) => e.status === 'removed').length,
  };

  return { entries, summary };
}

function serializeValue(v: unknown): string {
  if (v === undefined) return '__undefined__';
  if (v === null) return '__null__';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Format a trace comparison entry for display.
 */
export function formatComparisonValue(trace: MappingTrace | undefined): string {
  if (!trace) return '—';
  if (trace.error) return `Error: ${trace.error}`;
  if (trace.targetValue === undefined) return 'undefined';
  if (trace.targetValue === null) return 'null';
  if (typeof trace.targetValue === 'string') return trace.targetValue;
  try { return JSON.stringify(trace.targetValue); } catch { return String(trace.targetValue); }
}
