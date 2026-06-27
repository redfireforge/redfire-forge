/**
 * batchRouteHelpers.ts — Phase 3F (task 3F-3)
 *
 * Pure helper functions for the POST /api/graphql/batch route handler.
 * Extracted from graphql-routes.ts to enable isolated unit testing.
 *
 * All network I/O functions accept a `BatchContext` so the same logic can be
 * tested against mock HTTP servers without standing up the full Express app.
 */
import http from 'node:http';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shared execution context for one batch request. */
export interface BatchContext {
  /** node:http or node:https transport (derived from endpoint protocol). */
  transport: typeof http | typeof https;
  /** Parsed upstream endpoint URL. */
  targetUrl: URL;
  /** Shared request headers (Content-Type, Accept, any auth headers). */
  baseHeaders: Record<string, string>;
  /** TLS agent for self-signed certificates. Undefined for HTTP or verified HTTPS. */
  tlsAgent: https.Agent | undefined;
  /** Wall-clock deadline (Date.now() + batchTimeoutMs) for the entire batch. */
  batchDeadline: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export interface BatchResultWireMeta {
  headers?: Record<string, string>;
  latencyMs?: number;
}

/** Normalize Node incoming headers to a lowercase string map for the client. */
export function collectIncomingHttpHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

export function attachBatchResultMeta(
  result: Record<string, unknown>,
  status: number,
  meta?: BatchResultWireMeta,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...result, _httpStatus: status };
  if (meta?.headers && Object.keys(meta.headers).length > 0) {
    out._httpHeaders = meta.headers;
  }
  if (meta?.latencyMs !== undefined && Number.isFinite(meta.latencyMs) && meta.latencyMs >= 0) {
    out._latencyMs = meta.latencyMs;
  }
  return out;
}

/**
 * Parse a raw HTTP response body into a GraphQL ExecutionResult-like object.
 * On JSON parse failure returns a synthetic error entry so the batch result
 * array always has the same length as the operations array.
 */
export function parseResult(
  raw: string,
  status: number,
  meta?: BatchResultWireMeta,
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return attachBatchResultMeta(parsed, status, meta);
  } catch {
    return attachBatchResultMeta(
      { data: null, errors: [{ message: `Non-JSON response (HTTP ${status})` }] },
      status,
      meta,
    );
  }
}

/**
 * Pad a partial sequential results array with timeout-error entries so every
 * operation slot is populated even when the batch deadline is reached mid-way.
 */
export function padTimedOutResults(
  partial: Record<string, unknown>[],
  totalOps: number,
): Record<string, unknown>[] {
  const padded = [...partial];
  for (let i = padded.length; i < totalOps; i++) {
    padded.push({
      data: null,
      errors: [{ message: 'Batch timeout: operation not reached' }],
      _httpStatus: 408,
      _index: i,
    });
  }
  return padded;
}

// ─── Network helpers ──────────────────────────────────────────────────────────

/**
 * Send a single GraphQL POST to the upstream and return the raw response.
 * Respects the wall-clock deadline — returns a 408 synthetic result immediately
 * if the deadline has already passed, or fires a socket-level timeout timer
 * for the remaining window.
 *
 * Per-operation headers (e.g. per-tab auth overrides) are merged on top of the
 * shared base headers. Non-string per-op header values are silently dropped to
 * maintain a consistent wire format.
 */
export function sendSinglePostWithTimeout(
  opBody: Record<string, unknown>,
  ctx: BatchContext,
  perOpHeaders?: Record<string, string>,
): Promise<{ status: number; body: string; headers: Record<string, string>; latencyMs: number }> {
  const { transport, targetUrl, baseHeaders, tlsAgent, batchDeadline } = ctx;
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const remainingMs = Math.max(0, batchDeadline - Date.now());
    if (remainingMs === 0) {
      resolve({
        status: 408,
        body: JSON.stringify({ errors: [{ message: 'Batch timeout' }] }),
        headers: {},
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    const bodyStr = JSON.stringify(opBody);
    const bodyBuf = Buffer.from(bodyStr, 'utf8');

    // Merge per-operation headers on top of shared base headers (lower-cased for consistency).
    const mergedPerOp: Record<string, string> = {};
    if (perOpHeaders) {
      for (const [k, v] of Object.entries(perOpHeaders)) {
        if (typeof v === 'string') mergedPerOp[k.toLowerCase()] = v;
      }
    }
    const headers = { ...baseHeaders, ...mergedPerOp, 'content-length': String(bodyBuf.length) };

    const holder: { req?: ReturnType<typeof transport.request> } = {};
    const timer = setTimeout(() => {
      holder.req?.destroy();
      resolve({
        status: 408,
        body: JSON.stringify({ errors: [{ message: 'Batch timeout' }] }),
        headers: {},
        latencyMs: Date.now() - startedAt,
      });
    }, remainingMs);

    holder.req = transport.request(
      {
        method:   'POST',
        hostname: targetUrl.hostname,
        port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path:     targetUrl.pathname + targetUrl.search,
        headers,
        ...(tlsAgent ? { agent: tlsAgent } : {}),
      },
      (r) => {
        let raw = '';
        r.on('data', (c: Buffer) => { raw += c.toString('utf8'); });
        r.on('end', () => {
          clearTimeout(timer);
          resolve({
            status: r.statusCode ?? 200,
            body: raw,
            headers: collectIncomingHttpHeaders(r.headers),
            latencyMs: Date.now() - startedAt,
          });
        });
      },
    );
    holder.req.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        status: 0,
        body: JSON.stringify({ errors: [{ message: (err as Error).message }] }),
        headers: {},
        latencyMs: Date.now() - startedAt,
      });
    });
    holder.req.write(bodyBuf);
    holder.req.end();
  });
}

/**
 * Run each operation as a sequential individual POST, deadline-aware.
 *
 * Checks the wall-clock deadline BEFORE each operation and after each
 * socket-level timeout (status=408) so the result array contains as many
 * completed operations as possible rather than discarding them all.
 *
 * Returns partial results together with a `timedOut` flag so the caller can
 * pad the remainder with timeout-error entries.
 */
export async function runSequentialWithTimeout(
  operations: Record<string, unknown>[],
  ctx: BatchContext,
): Promise<{ results: Record<string, unknown>[]; timedOut: boolean }> {
  const { batchDeadline } = ctx;
  const results: Record<string, unknown>[] = [];

  for (const op of operations) {
    // Check wall-clock deadline BEFORE each op so a queue of slow operations
    // never holds the proxy open indefinitely.
    if (Date.now() >= batchDeadline) {
      return { results, timedOut: true };
    }

    const opBody: Record<string, unknown> = { query: op['query'] };
    if (op['variables'] !== undefined) opBody.variables = op['variables'];
    if (typeof op['operationName'] === 'string' && op['operationName']) {
      opBody.operationName = op['operationName'];
    }

    // Per-operation headers (e.g. per-tab auth overrides) override shared base headers.
    const perOpHeaders =
      op['headers'] && typeof op['headers'] === 'object' && !Array.isArray(op['headers'])
        ? (op['headers'] as Record<string, string>)
        : null;

    const { status, body: raw, headers, latencyMs } = await sendSinglePostWithTimeout(
      opBody,
      ctx,
      perOpHeaders ?? undefined,
    );

    if (status === 408) {
      // Socket-level timeout fired — return what we have so far.
      return { results, timedOut: true };
    }

    results.push(parseResult(raw, status, { headers, latencyMs }));
  }

  return { results, timedOut: false };
}
