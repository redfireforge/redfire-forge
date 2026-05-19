/**
 * Shared formatting utilities used across pages and components.
 */

/** Format an ISO timestamp string to locale-friendly display. */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/** Pretty-print an unknown payload as indented JSON (or fallback to String). */
export function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/** Generate a unique execution ID for webhook/schedule runs. */
export function generateExecutionId(workflowId: string, triggerId: string): string {
  return `${workflowId}-${triggerId}-${Date.now()}`;
}
