/**
 * Audit trail for publication lifecycle events.
 *
 * Currently logs to `console.debug` in development mode. When a shared
 * backend is introduced, this will be swapped to a real API call.
 */

export type PublicationAuditAction = 'publish' | 'unpublish' | 'republish';

export interface PublicationAuditEvent {
  action: PublicationAuditAction;
  entryId: string;
  endpointId: string;
  method: string;
  path: string;
  timestamp: number;
  /** Version ID at time of action. */
  versionId?: string;
  /** Note provided during publish. */
  note?: string;
  /** Number of workflows affected (for unpublish-and-remove). */
  affectedWorkflows?: number;
}

/**
 * Log a publication audit event.
 * In development mode, writes to console.debug.
 * In production, this is a no-op (placeholder for future backend integration).
 */
export function logPublicationAudit(event: PublicationAuditEvent, options?: { devOverride?: boolean }): void {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const isDev = options?.devOverride ?? (String(env?.['DEV']).toLowerCase() === 'true');
  if (isDev) {
    console.debug('[PublicationAudit]', event.action, `${event.method} ${event.path}`, event);
  }
}
