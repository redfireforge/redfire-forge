/**
 * routeUtils.ts — Shared utilities for GraphQL Studio server-side routes.
 *
 * Extracted from graphql-routes.ts to reduce its size and allow upload /
 * APQ / batch route modules to reuse the same constants and helpers without
 * circular imports.
 */
import type { LogLine } from '../../../src/shared/types/server-api.js';

// ─── Logging helper ───────────────────────────────────────────────────────────

export function log(
  onLog: ((line: LogLine) => void) | undefined,
  level: LogLine['level'],
  message: string,
  meta?: Record<string, unknown>,
): void {
  onLog?.({
    level,
    message: meta ? `[graphql] ${message} ${JSON.stringify(meta)}` : `[graphql] ${message}`,
    timestamp: Date.now(),
  });
}

// ─── Hop-by-hop headers ───────────────────────────────────────────────────────

/**
 * Headers that must never be forwarded to the upstream server.
 * Content-Type and Content-Length are explicitly set for the reconstructed body.
 */
export const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'upgrade', 'proxy-authorization', 'proxy-authenticate',
  'x-graphql-endpoint', 'host',
  'content-type', 'content-length',
]);

// ─── String escaping ──────────────────────────────────────────────────────────

/**
 * Escape a quoted-string value for use in a Content-Disposition header.
 * Escapes backslashes first, then double quotes (RFC 7230 §3.2.6).
 */
export function escapeQuotedString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
