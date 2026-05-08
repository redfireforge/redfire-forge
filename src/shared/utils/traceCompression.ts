import LZString from 'lz-string';
import type { TestRun, WorkflowExecutionTrace, WorkflowIterationTrace } from '../types';

const SAMPLING_THRESHOLD = 50;
const KEEP_FIRST = 10;
const KEEP_LAST = 5;
const KEEP_EVERY_NTH = 10;

/**
 * Compress a WorkflowExecutionTrace into a base64 string for storage.
 * Typical compression ratio: 75-85% size reduction on trace JSON.
 */
export function compressTrace(trace: WorkflowExecutionTrace): string {
  const json = JSON.stringify(trace);
  const compressed = LZString.compressToBase64(json);
  if (!compressed) throw new Error('Trace compression produced empty result');
  return compressed;
}

/**
 * Decompress a base64 lz-string back into a WorkflowExecutionTrace.
 * Throws if the compressed data is invalid or corrupt.
 */
export function decompressTrace(compressed: string): WorkflowExecutionTrace {
  const json = LZString.decompressFromBase64(compressed);
  if (!json) throw new Error('Failed to decompress trace data');
  return JSON.parse(json) as WorkflowExecutionTrace;
}

/**
 * Sample iterations for large runs (>50 iterations).
 * Keeps: first 10, last 5, all failed, every 10th.
 * Non-sampled iterations are replaced with lightweight stubs (passed/duration only).
 * Returns the original array unchanged if under the threshold.
 */
export function sampleIterations(
  iterations: WorkflowIterationTrace[],
  threshold = SAMPLING_THRESHOLD,
): WorkflowIterationTrace[] {
  if (iterations.length <= threshold) {
    return iterations.map(iter => ({ ...iter, sampled: true }));
  }

  const keepIndices = new Set<number>();

  // First N
  for (let i = 0; i < Math.min(KEEP_FIRST, iterations.length); i++) {
    keepIndices.add(i);
  }

  // Last N
  for (let i = Math.max(0, iterations.length - KEEP_LAST); i < iterations.length; i++) {
    keepIndices.add(i);
  }

  // All failed
  for (let i = 0; i < iterations.length; i++) {
    if (!iterations[i].passed) keepIndices.add(i);
  }

  // Every Nth
  for (let i = KEEP_FIRST; i < iterations.length - KEEP_LAST; i += KEEP_EVERY_NTH) {
    keepIndices.add(i);
  }

  return iterations.map((iter, i) => {
    if (keepIndices.has(i)) {
      return { ...iter, sampled: true };
    }
    return {
      index: iter.index,
      passed: iter.passed,
      durationMs: iter.durationMs,
      events: [],
      finalVariables: {},
      traversedEdges: [],
      sampled: false,
    };
  });
}

/**
 * Check whether a TestRun has execution trace data (compressed or uncompressed).
 */
export function hasExecutionTrace(run: TestRun): boolean {
  return !!(run.executionTrace || run.compressedTrace);
}

/**
 * Get the execution trace from a TestRun, decompressing if necessary.
 * Returns undefined for non-workflow runs. Prefers uncompressed if both exist.
 */
export function getExecutionTrace(run: TestRun): WorkflowExecutionTrace | undefined {
  if (run.executionTrace) return run.executionTrace;
  if (run.compressedTrace) return decompressTrace(run.compressedTrace);
  return undefined;
}
