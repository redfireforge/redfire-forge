import type { WorkflowIterationTrace } from '@shared/types';

/**
 * Returns true if the iteration was actually sampled (not skipped).
 * Unsampled iterations have `sampled === false`; all others are considered sampled.
 */
export function isSampledIteration(iter: WorkflowIterationTrace): boolean {
  return iter.sampled !== false;
}

/**
 * Filter a trace's iterations to only those that were sampled.
 */
export function filterSampledIterations(iterations: WorkflowIterationTrace[]): WorkflowIterationTrace[] {
  return iterations.filter(isSampledIteration);
}
