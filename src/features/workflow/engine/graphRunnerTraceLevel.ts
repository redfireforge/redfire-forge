import type { TraceCaptureLevel, ExecutionTraceOptions } from '../../../shared/types';

/**
 * Resolve the effective trace capture level from ExecutionTraceOptions.
 * When `traceLevel` is set it takes precedence; otherwise we derive from `captureFullTrace`.
 *
 * Extracted to a leaf module to avoid circular imports between graphRunner ↔ handlers.
 */
export function resolveTraceLevel(opts?: ExecutionTraceOptions): TraceCaptureLevel {
  if (opts?.traceLevel) return opts.traceLevel;
  return opts?.captureFullTrace ? 'full' : 'standard';
}
