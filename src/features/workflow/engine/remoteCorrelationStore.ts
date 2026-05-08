/**
 * Browser-side bridge to the webhook server's correlation API.
 *
 * Implements `ICorrelationStore` by:
 *  1. POST /api/correlations/pause  — registers paused state on the server
 *  2. Long-polling GET /api/correlations/:id/wait until the server reports
 *     a matching webhook (or the wait times out)
 *
 * This lets the in-browser workflow runner participate in real async
 * correlation: a paused `CorrelationWait` node waits here until an external
 * caller hits the server's /webhooks/callback/* endpoint with the matching
 * correlationId, at which point the server pushes resume data back.
 */

import type { WorkflowPausedState } from '../types/workflow';
import type {
  ICorrelationStore,
  PausedEntry,
  CorrelationWaitConfig,
} from './correlationStore';

const DEFAULT_LONG_POLL_TIMEOUT_MS = 30_000;
const MAX_OVERALL_TIMEOUT_MS = 60 * 60 * 1000; // hard cap 1h

interface RemoteOptions {
  /** Base URL of the correlation server. Defaults to current origin or http://localhost:3001. */
  baseUrl?: string;
  /** Per-poll timeout in ms passed to the server's wait endpoint. */
  pollTimeoutMs?: number;
  /** Optional fetch impl (for tests). */
  fetchImpl?: typeof fetch;
}

function resolveBaseUrl(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  // Vite dev: app on 5173, server on 3001
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3001`;
  }
  return 'http://localhost:3001';
}

export class RemoteCorrelationStore implements ICorrelationStore {
  private baseUrl: string;
  private pollTimeoutMs: number;
  private fetchImpl: typeof fetch;
  /** Local registry so size/listPaused/cancel work for in-flight waits. */
  private inflight = new Map<string, {
    correlationId: string;
    webhookPath: string;
    state: WorkflowPausedState;
    pausedAt: number;
    timeoutAt: number;
    webhookFilter?: string;
    abort: AbortController;
    settle: (data: Record<string, unknown>) => void;
    fail: (err: Error) => void;
  }>();

  constructor(opts: RemoteOptions = {}) {
    this.baseUrl = resolveBaseUrl(opts.baseUrl);
    this.pollTimeoutMs = opts.pollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  get size(): number { return this.inflight.size; }

  isPaused(correlationId: string): boolean {
    return this.inflight.has(correlationId);
  }

  get(correlationId: string): PausedEntry | undefined {
    const ent = this.inflight.get(correlationId);
    if (!ent) return undefined;
    return {
      correlationId: ent.correlationId,
      webhookPath: ent.webhookPath,
      state: ent.state,
      pausedAt: ent.pausedAt,
      timeoutAt: ent.timeoutAt,
      webhookFilter: ent.webhookFilter,
      resolve: ent.settle,
      reject: ent.fail,
    };
  }

  listPaused(): PausedEntry[] {
    return Array.from(this.inflight.keys()).map(id => this.get(id)!).filter(Boolean);
  }

  cleanup(): number {
    const now = Date.now();
    let n = 0;
    for (const [id, ent] of this.inflight.entries()) {
      if (ent.timeoutAt > 0 && now > ent.timeoutAt) {
        ent.abort.abort();
        ent.fail(new Error(`Correlation "${id}" timed out`));
        this.inflight.delete(id);
        n++;
      }
    }
    return n;
  }

  cancel(correlationId: string): boolean {
    const ent = this.inflight.get(correlationId);
    if (!ent) return false;
    ent.abort.abort();
    ent.fail(new Error(`Correlation "${correlationId}" cancelled`));
    this.inflight.delete(correlationId);
    // Best-effort tell the server too
    void this.fetchImpl(`${this.baseUrl}/api/correlations/${encodeURIComponent(correlationId)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
    return true;
  }

  /** Locally resume — primarily for tests. Production resume comes from server long-poll. */
  resume(correlationId: string, webhookData: Record<string, unknown>): boolean {
    const ent = this.inflight.get(correlationId);
    if (!ent) return false;
    ent.abort.abort();
    ent.settle(webhookData);
    this.inflight.delete(correlationId);
    return true;
  }

  async pause(
    correlationId: string,
    webhookPath: string,
    state: WorkflowPausedState,
    timeoutMs: number,
    webhookFilter?: string,
    config?: CorrelationWaitConfig,
  ): Promise<Record<string, unknown>> {
    if (this.inflight.has(correlationId)) {
      throw new Error(`Correlation ID "${correlationId}" is already paused`);
    }

    const now = Date.now();
    const overallTimeout = timeoutMs > 0
      ? Math.min(timeoutMs, MAX_OVERALL_TIMEOUT_MS)
      : MAX_OVERALL_TIMEOUT_MS;
    const overallDeadline = now + overallTimeout;

    // Register on server
    const registerBody = JSON.stringify({
      correlationId,
      webhookPath,
      executionId: state.executionId,
      workflowId: state.workflowId,
      pausedNodeId: state.pausedNodeId,
      timeoutMs: overallTimeout,
      webhookFilter,
      correlationSource: config?.correlationSource ?? 'body',
      correlationJsonPath: config?.correlationJsonPath ?? '$.correlationId',
      correlationHeader: config?.correlationHeader,
      correlationQueryParam: config?.correlationQueryParam,
    });

    let registerRes = await this.fetchImpl(`${this.baseUrl}/api/correlations/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerBody,
    });

    // Recover from a stale server-side entry left over by a previous run that
    // was abandoned (page reload, abort, etc.). Delete and retry once.
    if (registerRes.status === 409) {
      await this.fetchImpl(
        `${this.baseUrl}/api/correlations/${encodeURIComponent(correlationId)}`,
        { method: 'DELETE' },
      ).catch(() => undefined);
      registerRes = await this.fetchImpl(`${this.baseUrl}/api/correlations/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: registerBody,
      });
    }

    if (!registerRes.ok && registerRes.status !== 201) {
      const txt = await registerRes.text().catch(() => '');
      throw new Error(`Failed to register correlation pause: ${registerRes.status} ${txt}`);
    }

    const abort = new AbortController();
    let settle!: (d: Record<string, unknown>) => void;
    let fail!: (e: Error) => void;
    const promise = new Promise<Record<string, unknown>>((res, rej) => {
      settle = res; fail = rej;
    });
    this.inflight.set(correlationId, {
      correlationId, webhookPath, state,
      pausedAt: now,
      timeoutAt: overallTimeout > 0 ? overallDeadline : 0,
      webhookFilter, abort, settle, fail,
    });

    // Long-poll loop in background
    void this.runWaitLoop(correlationId, overallDeadline, abort.signal);

    return promise;
  }

  private async runWaitLoop(
    correlationId: string,
    overallDeadline: number,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      while (!signal.aborted) {
        const remaining = overallDeadline - Date.now();
        if (remaining <= 0) {
          this.failAndDelete(correlationId, new Error(`Correlation "${correlationId}" timed out`));
          return;
        }
        const pollMs = Math.min(this.pollTimeoutMs, Math.max(remaining, 1000));
        const url = `${this.baseUrl}/api/correlations/${encodeURIComponent(correlationId)}/wait?timeoutMs=${pollMs}`;
        let res: Response;
        try {
          res = await this.fetchImpl(url, { signal });
        } catch {
          if (signal.aborted) return;
          // Network blip — brief backoff, retry
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        const data = await res.json().catch(() => ({})) as {
          resumed?: boolean;
          timedOut?: boolean;
          webhookData?: Record<string, unknown>;
        };
        if (data.resumed) {
          const ent = this.inflight.get(correlationId);
          if (ent) {
            this.inflight.delete(correlationId);
            ent.settle(data.webhookData ?? {});
          }
          return;
        }
        // timedOut → loop again until overall deadline
      }
    } catch (err) {
      if (!signal.aborted) {
        this.failAndDelete(
          correlationId,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
  }

  private failAndDelete(correlationId: string, err: Error): void {
    const ent = this.inflight.get(correlationId);
    if (!ent) return;
    this.inflight.delete(correlationId);
    ent.fail(err);
    void this.fetchImpl(`${this.baseUrl}/api/correlations/${encodeURIComponent(correlationId)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  }
}
