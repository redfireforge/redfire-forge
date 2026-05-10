import type { TraceCaptureLevel, WorkflowExecutionTrace } from '../../../shared/types';

/**
 * Infer the capture level from trace content for backward compatibility.
 * Pre-existing traces don't have an explicit `captureLevel` field,
 * so we detect the level from what data is present.
 */
export function inferCaptureLevel(trace: WorkflowExecutionTrace): TraceCaptureLevel {
  if (trace.captureLevel) return trace.captureLevel;

  for (const iter of trace.iterations) {
    if (!iter.sampled && iter.sampled !== undefined) continue;
    for (const event of iter.events) {
      const d = event.details;
      if (!d) continue;

      if (d.logLines && d.logLines.length > 0) return 'debug';

      if (d.request || d.response) return 'full';

      if (
        d.statusCode !== undefined ||
        d.extractedVariables ||
        d.assertions
      ) {
        return 'standard';
      }
    }
  }

  if (trace.fullTraceCaptured) return 'full';

  const hasAnyEvents = trace.iterations.some(
    iter => iter.events && iter.events.length > 0
  );
  return hasAnyEvents ? 'standard' : 'minimal';
}
