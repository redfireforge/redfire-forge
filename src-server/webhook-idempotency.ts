/**
 * Webhook idempotency and deduplication.
 *
 * Prevents duplicate webhook deliveries from resuming the same workflow twice.
 * Tracks processed webhook requests by idempotency key and returns cached responses.
 */

// ── Types ────────────────────────────────────────────

export interface IdempotencyRecord {
  /** The idempotency key (e.g. correlationId, or explicit header). */
  key: string;
  /** When this webhook was first processed (ms since epoch). */
  processedAt: number;
  /** The HTTP status code returned. */
  statusCode: number;
  /** The response body returned. */
  responseBody: unknown;
}

// ── Store ────────────────────────────────────────────

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_ENTRIES = 10000;

let ttlMs = DEFAULT_TTL_MS;
let maxEntries = DEFAULT_MAX_ENTRIES;
const processedRequests = new Map<string, IdempotencyRecord>();

// ── Config ───────────────────────────────────────────

export function configureIdempotency(opts: {
  ttlMs?: number;
  maxEntries?: number;
}): void {
  if (opts.ttlMs !== undefined) ttlMs = opts.ttlMs;
  if (opts.maxEntries !== undefined) maxEntries = opts.maxEntries;
}

// ── Core Functions ───────────────────────────────────

/**
 * Extract an idempotency key from a webhook request.
 *
 * Priority:
 * 1. `x-idempotency-key` header (explicit)
 * 2. `x-request-id` header
 * 3. Combination of correlationId + webhookPath (implicit)
 */
export function extractIdempotencyKey(
  correlationId: string | undefined,
  webhookPath: string,
  headers: Record<string, string | string[] | undefined>,
): string {
  // Explicit idempotency key
  const explicitKey = headers['x-idempotency-key'];
  if (explicitKey) return `idem:${Array.isArray(explicitKey) ? explicitKey[0] : explicitKey}`;

  // Request ID
  const requestId = headers['x-request-id'];
  if (requestId) return `rid:${Array.isArray(requestId) ? requestId[0] : requestId}`;

  // Implicit key from correlation ID
  if (correlationId) return `corr:${correlationId}:${webhookPath}`;

  // No key — each request is unique
  return '';
}

/**
 * Check if a webhook request has already been processed.
 * Returns the cached record if found (and not expired), or undefined.
 */
export function checkIdempotency(key: string): IdempotencyRecord | undefined {
  if (!key) return undefined;

  const record = processedRequests.get(key);
  if (!record) return undefined;

  // Check TTL
  if (Date.now() - record.processedAt > ttlMs) {
    processedRequests.delete(key);
    return undefined;
  }

  return record;
}

/**
 * Record a processed webhook request for idempotency.
 */
export function recordProcessed(
  key: string,
  statusCode: number,
  responseBody: unknown,
): void {
  if (!key) return;

  // Evict oldest entries if at capacity
  if (processedRequests.size >= maxEntries) {
    const oldest = processedRequests.keys().next().value;
    if (oldest !== undefined) processedRequests.delete(oldest);
  }

  processedRequests.set(key, {
    key,
    processedAt: Date.now(),
    statusCode,
    responseBody,
  });
}

/**
 * Clean up expired idempotency records.
 * Returns number of records removed.
 */
export function cleanupIdempotency(): number {
  const now = Date.now();
  let count = 0;
  for (const [key, record] of processedRequests) {
    if (now - record.processedAt > ttlMs) {
      processedRequests.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Get current idempotency store size (for monitoring).
 */
export function getIdempotencySize(): number {
  return processedRequests.size;
}

/**
 * Clear all idempotency records (for testing).
 */
export function clearIdempotency(): void {
  processedRequests.clear();
}
