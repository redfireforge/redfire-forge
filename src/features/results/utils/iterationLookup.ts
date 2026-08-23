import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '@shared/types';

/**
 * Find an iteration by its logical `index` field, not by array position.
 * With concurrent execution, iterations may complete (and be appended) out of order,
 * so `trace.iterations[n]` is NOT guaranteed to have `index === n`.
 */
export function getIterationByIndex(
  trace: WorkflowExecutionTrace,
  index: number,
): WorkflowIterationTrace | undefined {
  return trace.iterations.find(iter => iter.index === index);
}

/**
 * Build a map from iteration index to array position for fast repeated lookups.
 */
export function buildIterationIndexMap(
  trace: WorkflowExecutionTrace,
): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < trace.iterations.length; i++) {
    map.set(trace.iterations[i].index, i);
  }
  return map;
}

/**
 * Get all valid iteration indices sorted in logical order.
 */
export function getSortedIterationIndices(
  trace: WorkflowExecutionTrace,
): number[] {
  return trace.iterations
    .map(iter => iter.index)
    .sort((a, b) => a - b);
}
