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
  getIdempotencySize,
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
  correlationSource: 'body' | 'header' | 'query';
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

// ── Router ───────────────────────────────────────────

export function createCorrelationRouter(): Router {
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
    res.json({
      resumed: true,
      correlationId,
      executionId: entry.executionId,
      workflowId: entry.workflowId,
      webhookData: webhookData ?? {},
    } satisfies ResumeResult);
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
    const idempotencyKey = extractIdempotencyKey(
      match.correlationId,
      webhookPath,
      headers as Record<string, string | string[] | undefined>,
    );
    const cached = checkIdempotency(idempotencyKey);
    if (cached) {
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

    // ── 7D.2: Record for idempotency ──
    recordProcessed(idempotencyKey, 200, responseBody);

    console.log(`[Webhook Callback] Matched correlation: ${match.correlationId} → execution=${match.entry.executionId}`);
    res.json(responseBody);
  });

  return router;
}
