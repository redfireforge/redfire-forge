/**
 * Server-side correlation webhook handler.
 *
 * Provides:
 * - An in-memory store of paused workflow correlations
 * - POST /api/correlations/pause   — register a paused workflow
 * - POST /api/correlations/resume  — resume via correlation ID (called by webhooks)
 * - GET  /api/correlations         — list all paused correlations
 * - DELETE /api/correlations/:id   — cancel a paused correlation
 * - POST /webhooks/callback/:path  — generic webhook callback that matches correlations
 */

import { Router, type Request, type Response } from 'express';
import type { IServerCorrelationStore } from './correlation-store-interface.js';
import { InMemoryServerStore } from './correlation-store-memory.js';
import {
  isSecurityEnabled, isIpAllowed, validateRequestSignature,
  extractAndVerifyToken, generateWebhookToken,
} from './webhook-security.js';
import {
  extractIdempotencyKey, checkIdempotency, recordProcessed, cleanupIdempotency,
  getIdempotencySize, extractKafkaIdempotencyKey,
} from './webhook-idempotency.js';
import { preValidateWebhook } from './webhook-validation.js';

// ── Types ────────────────────────────────────────────

export interface ServerPausedEntry {
  correlationId: string;
  webhookPath: string;
  executionId: string;
  workflowId: string;
  pausedNodeId: string;
  pausedAt: number;
  timeoutAt: number;
  webhookFilter?: string;
  /**
   * Where to extract the correlation ID for matching:
   * - `body`: extract from JSON body via `correlationJsonPath` (HTTP webhook or Kafka message value)
   * - `header`: extract from a header value via `correlationHeader`
   * - `query`: extract from a query parameter via `correlationQueryParam` (HTTP webhook only)
   * - `key`: use the Kafka message key directly (Kafka only — not applicable for HTTP webhooks)
   */
  correlationSource: 'body' | 'header' | 'query' | 'key';
  correlationJsonPath?: string;
  correlationHeader?: string;
  correlationQueryParam?: string;
}

export interface ResumeResult {
  resumed: boolean;
  correlationId: string;
  executionId?: string;
  workflowId?: string;
  webhookData?: Record<string, unknown>;
}

// ── Store (injectable) ───────────────────────────────

let activeStore: IServerCorrelationStore = new InMemoryServerStore();

/** Replace the active correlation store (for DI / config switch). */
export function setCorrelationStore(store: IServerCorrelationStore): void {
  activeStore = store;
}

/** Get the currently active store instance. */
export function getCorrelationStore(): IServerCorrelationStore {
  return activeStore;
}

export function getPausedCorrelations(): ServerPausedEntry[] {
  return activeStore.listAll();
}

export function getPausedCount(): number {
  return activeStore.count();
}

export function getUnmatchedWebhooks() {
  return activeStore.getUnmatched();
}

export function clearAllCorrelations(): void {
  activeStore.clearAll();
}

export function addPausedCorrelation(entry: ServerPausedEntry): boolean {
  return activeStore.add(entry);
}

export function removePausedCorrelation(correlationId: string): ServerPausedEntry | undefined {
  return activeStore.remove(correlationId);
}

export function findByCorrelationId(correlationId: string): ServerPausedEntry | undefined {
  return activeStore.find(correlationId);
}

// ── Resume queue / waiters ───────────────────────────
// When a webhook matches & resumes a correlation, the data is queued so the
// originating browser (which long-polls /api/correlations/:id/wait) can
// retrieve it and resume in-process.

export interface QueuedResume {
  webhookData: Record<string, unknown>;
  executionId: string;
  workflowId: string;
  ts: number;
}
const RESUME_QUEUE_TTL_MS = 5 * 60 * 1000;
const queuedResumes = new Map<string, QueuedResume>();
const resumeWaiters = new Map<string, Array<(r: QueuedResume) => void>>();

/** Notify waiters or queue resume data for later pickup. */
export function notifyResume(correlationId: string, data: QueuedResume): void {
  const waiters = resumeWaiters.get(correlationId);
  if (waiters && waiters.length > 0) {
    resumeWaiters.delete(correlationId);
    for (const w of waiters) w(data);
    return;
  }
  queuedResumes.set(correlationId, data);
}

/**
 * Register an in-process waiter for a correlation ID.
 * The callback is invoked by notifyResume() exactly once when the correlation is resumed,
 * exactly like the HTTP long-poll mechanism but without an HTTP response.
 * Used by ServerCorrelationBridge for server-side workflow execution.
 */
export function registerResumeWaiter(correlationId: string, waiter: (data: QueuedResume) => void): void {
  const arr = resumeWaiters.get(correlationId) ?? [];
  arr.push(waiter);
  resumeWaiters.set(correlationId, arr);
}

/**
 * Deregister an in-process waiter (e.g. on timeout before notifyResume fires).
 */
export function deregisterResumeWaiter(correlationId: string, waiter: (data: QueuedResume) => void): void {
  const arr = resumeWaiters.get(correlationId);
  if (!arr) return;
  const idx = arr.indexOf(waiter);
  if (idx >= 0) arr.splice(idx, 1);
  if (arr.length === 0) resumeWaiters.delete(correlationId);
}

/** Cleanup expired queued resumes (called periodically). */
function cleanupResumeQueue(): void {
  const now = Date.now();
  for (const [id, data] of queuedResumes.entries()) {
    if (now - data.ts > RESUME_QUEUE_TTL_MS) queuedResumes.delete(id);
  }
}
setInterval(cleanupResumeQueue, 60_000).unref?.();

/** Trigger resume queue cleanup immediately (test and maintenance helper). */
export function runResumeQueueCleanup(): void {
  cleanupResumeQueue();
}


/**
 * Extract correlation ID from an incoming webhook request
 * based on the paused entry's configuration.
 */
export function extractCorrelationId(
  entry: ServerPausedEntry,
  body: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, string | string[] | undefined>,
): string | undefined {
  switch (entry.correlationSource) {
    case 'body': {
      if (!entry.correlationJsonPath) return undefined;
      const path = entry.correlationJsonPath.replace(/^\$\.?/, '');
      const parts = path.split('.');
      let current: unknown = body;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current != null ? String(current) : undefined;
    }
    case 'header': {
      if (!entry.correlationHeader) return undefined;
      const headerValue = headers[entry.correlationHeader.toLowerCase()];
      return headerValue != null ? String(headerValue) : undefined;
    }
    case 'query': {
      if (!entry.correlationQueryParam) return undefined;
      const queryValue = query[entry.correlationQueryParam];
      return queryValue != null ? String(queryValue) : undefined;
    }
    case 'key':
      // 'key' source only applies to Kafka messages — not applicable for HTTP webhooks.
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Find a paused correlation that matches the incoming webhook path
 * and extract the correlation ID from the request.
 */
export function matchCorrelation(
  webhookPath: string,
  body: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, string | string[] | undefined>,
): { entry: ServerPausedEntry; correlationId: string } | undefined {
  for (const entry of activeStore.listAll()) {
    // Check webhook path match
    if (entry.webhookPath !== webhookPath) continue;

    // Check if timed out
    if (entry.timeoutAt > 0 && Date.now() > entry.timeoutAt) {
      activeStore.remove(entry.correlationId);
      continue;
    }

    // Extract correlation ID from this entry's configuration
    const extractedId = extractCorrelationId(entry, body, headers, query);
    if (extractedId && extractedId === entry.correlationId) {
      return { entry, correlationId: extractedId };
    }
  }
  return undefined;
}

/**
 * Remove expired entries.
 */
export function cleanupExpired(): number {
  return activeStore.cleanupExpired();
}

function logUnmatchedWebhook(path: string, correlationId: string | undefined, payload: unknown): void {
  activeStore.logUnmatched(path, correlationId, payload);
}

// ── Kafka message dispatch ────────────────────────────────────────────────────
//
// Phase 5D: when the server's Kafka consumer receives a message on a subscribed
// topic, it calls dispatchKafkaResumeMessage() to match against waiting
// KafkaWait correlations and resume the paused workflow execution exactly once.

/**
 * Represents an incoming Kafka message passed to the server-side correlation
 * dispatcher when a consumer receives a message.
 */
export interface KafkaResumeMessage {
  topic: string;
  partition: number;
  offset: string;
  key?: string;
  value?: string;
  headers?: Record<string, string>;
}

/**
 * Result of attempting to dispatch a Kafka message to a waiting correlation.
 * - `resumed: true`  — matched a waiting correlation and resumed it
 * - `reason: 'no-match'`   — no paused correlation matched this message
 * - `reason: 'duplicate'`  — this message position was already processed (idempotent replay)
 */
export type KafkaDispatchOutcome =
  | { resumed: true; correlationId: string; executionId: string; workflowId: string }
  | { resumed: false; reason: 'no-match' }
  | { resumed: false; reason: 'duplicate'; correlationId: string };

/**
 * Extract a correlation ID from an incoming Kafka message based on a paused
 * entry's correlation source configuration.
 *
 * - `key`:    use the Kafka message key directly
 * - `body`:   parse message value as JSON and apply correlationJsonPath
 * - `header`: look up a named message header
 * - `query`:  not applicable for Kafka — returns undefined
 */
export function extractKafkaCorrelationId(
  entry: ServerPausedEntry,
  message: KafkaResumeMessage,
): string | undefined {
  switch (entry.correlationSource) {
    case 'key':
      return message.key !== undefined && message.key !== '' ? message.key : undefined;
    case 'body': {
      if (!entry.correlationJsonPath) return undefined;
      let parsed: unknown;
      try {
        parsed = message.value ? JSON.parse(message.value) : {};
      } catch {
        return undefined;
      }
      const path = entry.correlationJsonPath.replace(/^\$\.?/, '');
      const parts = path.split('.');
      let current: unknown = parsed;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current != null ? String(current) : undefined;
    }
    case 'header': {
      if (!entry.correlationHeader) return undefined;
      const hdr = entry.correlationHeader;
      // Try exact name then lowercase (Kafka headers are case-sensitive but we normalise)
      const val = message.headers?.[hdr] ?? message.headers?.[hdr.toLowerCase()];
      return val !== undefined ? String(val) : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Find the first paused correlation whose topic matches `topic` and whose
 * correlation ID extracted from `message` matches the stored correlationId.
 *
 * Expired entries encountered during the scan are removed from the store.
 */
export function matchKafkaCorrelation(
  topic: string,
  message: KafkaResumeMessage,
): { entry: ServerPausedEntry; correlationId: string } | undefined {
  for (const entry of activeStore.listAll()) {
    // Kafka topic is stored as webhookPath
    if (entry.webhookPath !== topic) continue;

    // Remove timed-out entries during the scan
    if (entry.timeoutAt > 0 && Date.now() > entry.timeoutAt) {
      activeStore.remove(entry.correlationId);
      continue;
    }

    const extractedId = extractKafkaCorrelationId(entry, message);
    if (extractedId && extractedId === entry.correlationId) {
      return { entry, correlationId: extractedId };
    }
  }
  return undefined;
}

/**
 * Dispatch an incoming Kafka message to a waiting KafkaWait correlation.
 *
 * Flow:
 * 1. Build a Kafka-specific idempotency key from topic+partition+offset.
 * 2. Find a matching paused correlation via matchKafkaCorrelation().
 * 3. If no match: check whether this is a duplicate of a previously processed
 *    message (idempotency store hit) and return the appropriate outcome.
 * 4. If match found: check the idempotency store to guard against replay
 *    when the correlation is no longer in the active store.
 * 5. Remove the matched entry, fire notifyResume(), record idempotency key.
 *
 * Called by the server-side Kafka consumer subscription callback when a
 * message arrives on a topic that has waiting KafkaWait nodes.
 */
export function dispatchKafkaResumeMessage(message: KafkaResumeMessage): KafkaDispatchOutcome {
  const idempotencyKey = extractKafkaIdempotencyKey(message.topic, message.partition, message.offset);

  // Find a matching paused correlation
  const match = matchKafkaCorrelation(message.topic, message);

  if (!match) {
    // No match — check if this offset was already processed (duplicate delivery after resume)
    const cached = checkIdempotency(idempotencyKey);
    if (cached) {
      const prev = cached.responseBody as { correlationId?: string };
      console.log(`[Kafka Dispatch] Idempotent duplicate (no active match): ${idempotencyKey}`);
      return { resumed: false, reason: 'duplicate', correlationId: prev.correlationId ?? '' };
    }
    logUnmatchedWebhook(message.topic, undefined, message);
    console.log(`[Kafka Dispatch] No match for topic="${message.topic}" key="${message.key ?? ''}"`);
    return { resumed: false, reason: 'no-match' };
  }

  // Match found — guard against replay when correlation is no longer in the active store
  const cached = checkIdempotency(idempotencyKey);
  if (cached && !activeStore.find(match.correlationId)) {
    console.log(`[Kafka Dispatch] Idempotent duplicate: ${idempotencyKey}`);
    return { resumed: false, reason: 'duplicate', correlationId: match.correlationId };
  }

  // Remove matched entry and resume
  activeStore.remove(match.correlationId);

  const resumeData: QueuedResume = {
    webhookData: {
      topic: message.topic,
      partition: message.partition,
      offset: message.offset,
      key: message.key ?? '',
      value: message.value ?? '',
      headers: message.headers ?? {},
    },
    executionId: match.entry.executionId,
    workflowId: match.entry.workflowId,
    ts: Date.now(),
  };

  notifyResume(match.correlationId, resumeData);

  const resultRecord = {
    resumed: true,
    correlationId: match.correlationId,
    executionId: match.entry.executionId,
    workflowId: match.entry.workflowId,
  };
  recordProcessed(idempotencyKey, 200, resultRecord);

  console.log(
    `[Kafka Dispatch] Matched: ${match.correlationId} → execution=${match.entry.executionId}` +
    ` (${message.topic}:${message.partition}:${message.offset})`,
  );

  return {
    resumed: true,
    correlationId: match.correlationId,
    executionId: match.entry.executionId,
    workflowId: match.entry.workflowId,
  };
}

// ── Router ───────────────────────────────────────────

interface CorrelationRouterOptions {
  defaultWaitMs?: number;
  minWaitMs?: number;
  maxWaitMs?: number;
}

export function createCorrelationRouter(options: CorrelationRouterOptions = {}): Router {
  const defaultWaitMs = options.defaultWaitMs ?? 30000;
  const minWaitMs = options.minWaitMs ?? 1000;
  const maxWaitMs = options.maxWaitMs ?? 120000;
  const router = Router();

  // Register a paused workflow correlation
  router.post('/api/correlations/pause', (req: Request, res: Response) => {
    const {
      correlationId, webhookPath, executionId, workflowId,
      pausedNodeId, timeoutMs, webhookFilter,
      correlationSource, correlationJsonPath, correlationHeader, correlationQueryParam,
    } = req.body;

    if (!correlationId || !webhookPath || !executionId) {
      return res.status(400).json({
        error: 'Missing required fields: correlationId, webhookPath, executionId',
      });
    }

    const now = Date.now();
    const entry: ServerPausedEntry = {
      correlationId,
      webhookPath,
      executionId,
      workflowId: workflowId ?? 'unknown',
      pausedNodeId: pausedNodeId ?? 'unknown',
      pausedAt: now,
      timeoutAt: timeoutMs > 0 ? now + timeoutMs : 0,
      webhookFilter,
      correlationSource: correlationSource ?? 'body',
      correlationJsonPath,
      correlationHeader,
      correlationQueryParam,
    };

    const added = addPausedCorrelation(entry);
    if (!added) {
      return res.status(409).json({
        error: `Correlation ID "${correlationId}" is already paused`,
      });
    }

    console.log(`[Correlation] Paused: ${correlationId} (workflow=${workflowId}, node=${pausedNodeId})`);

    // Generate signed webhook token if security is enabled
    const token = isSecurityEnabled()
      ? generateWebhookToken(correlationId, webhookPath)
      : undefined;

    res.status(201).json({
      paused: true,
      correlationId,
      timeoutAt: entry.timeoutAt,
      ...(token ? { webhookToken: token } : {}),
    });
  });

  // Resume a paused workflow by correlation ID (direct)
  router.post('/api/correlations/resume', (req: Request, res: Response) => {
    const { correlationId, webhookData } = req.body;

    if (!correlationId) {
      return res.status(400).json({ error: 'Missing required field: correlationId' });
    }

    const entry = removePausedCorrelation(correlationId);
    if (!entry) {
      console.log(`[Correlation] Resume failed — no match for: ${correlationId}`);
      return res.json({ resumed: false, correlationId });
    }

    console.log(`[Correlation] Resumed: ${correlationId} (execution=${entry.executionId})`);
    notifyResume(correlationId, {
      webhookData: (webhookData ?? {}) as Record<string, unknown>,
      executionId: entry.executionId,
      workflowId: entry.workflowId,
      ts: Date.now(),
    });
    res.json({
      resumed: true,
      correlationId,
      executionId: entry.executionId,
      workflowId: entry.workflowId,
      webhookData: webhookData ?? {},
    } satisfies ResumeResult);
  });

  // Long-poll endpoint — browser runner waits here until a webhook resumes its correlation
  router.get('/api/correlations/:correlationId/wait', (req: Request, res: Response) => {
    const { correlationId } = req.params;
    const timeoutMs = Math.min(
      Math.max(parseInt((req.query.timeoutMs as string) || String(defaultWaitMs), 10) || defaultWaitMs, minWaitMs),
      maxWaitMs,
    );

    // Already queued?
    const queued = queuedResumes.get(correlationId);
    if (queued) {
      queuedResumes.delete(correlationId);
      return res.json({ resumed: true, correlationId, ...queued });
    }

    // Park the request
    let settled = false;
    const arr = resumeWaiters.get(correlationId) ?? [];
    const resolver = (data: QueuedResume) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      res.json({ resumed: true, correlationId, ...data });
    };
    arr.push(resolver);
    resumeWaiters.set(correlationId, arr);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const list = resumeWaiters.get(correlationId);
      if (list) {
        const idx = list.indexOf(resolver);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) resumeWaiters.delete(correlationId);
      }
      res.json({ resumed: false, correlationId, timedOut: true });
    }, timeoutMs);

    req.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const list = resumeWaiters.get(correlationId);
      if (list) {
        const idx = list.indexOf(resolver);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) resumeWaiters.delete(correlationId);
      }
    });
  });

  // List all paused correlations
  router.get('/api/correlations', (_req: Request, res: Response) => {
    const entries = getPausedCorrelations();
    res.json({
      correlations: entries,
      count: entries.length,
    });
  });

  // Cancel a paused correlation
  router.delete('/api/correlations/:correlationId', (req: Request, res: Response) => {
    const { correlationId } = req.params;
    const entry = removePausedCorrelation(correlationId);
    if (!entry) {
      return res.status(404).json({ error: `Correlation "${correlationId}" not found` });
    }
    console.log(`[Correlation] Cancelled: ${correlationId}`);
    res.json({ cancelled: true, correlationId });
  });

  // Get unmatched webhook log
  router.get('/api/correlations/unmatched', (_req: Request, res: Response) => {
    const unmatched = activeStore.getUnmatched();
    res.json({
      unmatched,
      count: unmatched.length,
    });
  });

  // Cleanup expired
  router.post('/api/correlations/cleanup', (_req: Request, res: Response) => {
    const count = cleanupExpired();
    const idempotencyCleared = cleanupIdempotency();
    res.json({ cleaned: count, idempotencyCleared, remaining: getPausedCount() });
  });

  // Idempotency stats
  router.get('/api/correlations/idempotency', (_req: Request, res: Response) => {
    res.json({ size: getIdempotencySize() });
  });

  // Generic webhook callback — matches incoming webhooks against paused correlations
  router.all('/webhooks/callback/*', (req: Request, res: Response) => {
    const webhookPath = req.path; // e.g. /webhooks/callback/payment
    const { method, headers, query, body } = req;

    console.log(`[Webhook Callback] ${method} ${webhookPath}`);

    // ── 7D.1: IP whitelist check ──
    if (isSecurityEnabled() && !isIpAllowed(req.ip)) {
      console.log(`[Webhook Callback] IP blocked: ${req.ip}`);
      return res.status(403).json({ error: 'IP not allowed', ip: req.ip });
    }

    // ── 7D.1: Request signature validation ──
    if (isSecurityEnabled()) {
      const rawBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
      const sigResult = validateRequestSignature(
        rawBody,
        headers as Record<string, string | string[] | undefined>,
      );
      if (!sigResult.valid) {
        console.log(`[Webhook Callback] Signature rejected: ${sigResult.reason}`);
        return res.status(401).json({ error: sigResult.reason });
      }
    }

    // ── Match correlation ──
    const match = matchCorrelation(
      webhookPath,
      body ?? {},
      headers as Record<string, string | string[] | undefined>,
      query as Record<string, string | string[] | undefined>,
    );

    if (!match) {
      const possibleId = body?.correlationId ?? body?.correlation_id ?? body?.id;
      logUnmatchedWebhook(webhookPath, possibleId != null ? String(possibleId) : undefined, body);
      console.log(`[Webhook Callback] No matching correlation for ${webhookPath}`);
      return res.status(404).json({
        resumed: false,
        error: 'No matching paused workflow found',
        webhookPath,
      });
    }

    // ── 7D.1: Token verification (if token provided in query) ──
    const tokenParam = query.webhookToken;
    if (isSecurityEnabled() && tokenParam) {
      const tokenCheck = extractAndVerifyToken(
        Array.isArray(tokenParam) ? String(tokenParam[0]) : String(tokenParam),
        match.correlationId,
        webhookPath,
      );
      if (!tokenCheck.valid) {
        console.log(`[Webhook Callback] Token rejected: ${tokenCheck.reason}`);
        return res.status(401).json({ error: tokenCheck.reason });
      }
    }

    // ── 7D.2: Idempotency check ──
    // Only honor the cached reply if the matched correlation is no longer paused —
    // otherwise this is a re-run of the workflow with the same idempotency key
    // and we must process it normally so the new pause gets resumed.
    const idempotencyKey = extractIdempotencyKey(
      match.correlationId,
      webhookPath,
      headers as Record<string, string | string[] | undefined>,
    );
    const cached = checkIdempotency(idempotencyKey);
    if (cached && !activeStore.find(match.correlationId)) {
      console.log(`[Webhook Callback] Idempotent duplicate: ${idempotencyKey}`);
      return res.status(cached.statusCode).json(cached.responseBody);
    }

    // ── 7D.3: Webhook filter validation ──
    const filterResult = preValidateWebhook(body ?? {}, match.entry.webhookFilter, match.correlationId);
    if (!filterResult.valid) {
      console.log(`[Webhook Callback] Filter rejected: ${filterResult.reason}`);
      return res.status(422).json({
        resumed: false,
        error: filterResult.reason,
        correlationId: match.correlationId,
      });
    }

    // ── Remove the matched entry and resume ──
    activeStore.remove(match.correlationId);

    const responseBody = {
      resumed: true,
      correlationId: match.correlationId,
      executionId: match.entry.executionId,
      workflowId: match.entry.workflowId,
      webhookData: body ?? {},
    } satisfies ResumeResult;

    // Notify any in-process browser runner that's waiting on this correlation
    notifyResume(match.correlationId, {
      webhookData: (body ?? {}) as Record<string, unknown>,
      executionId: match.entry.executionId,
      workflowId: match.entry.workflowId,
      ts: Date.now(),
    });

    // ── 7D.2: Record for idempotency ──
    recordProcessed(idempotencyKey, 200, responseBody);

    console.log(`[Webhook Callback] Matched correlation: ${match.correlationId} → execution=${match.entry.executionId}`);
    res.json(responseBody);
  });

  return router;
}
