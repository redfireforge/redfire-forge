/**
 * Server-side bridge implementing ICorrelationStore for in-process workflow execution.
 *
 * When a workflow runs server-side (via executeWorkflow.ts), it needs an ICorrelationStore
 * to pause/resume on CorrelationWait or KafkaWait nodes. This bridge:
 *
 *  1. Registers the paused state in the server's IServerCorrelationStore (for webhook routing).
 *  2. Registers an in-process resume waiter via registerResumeWaiter() (same mechanism used
 *     by the HTTP long-poll endpoint), so notifyResume() resolves the Promise immediately
 *     without needing an HTTP round-trip.
 *  3. Handles timeout / cancellation by deregistering the waiter and clearing the server entry.
 *
 * This approach reuses the existing notifyResume() infrastructure without introducing any new
 * side channels.
 */
import type {
  ICorrelationStore,
  PausedEntry,
  CorrelationWaitConfig,
} from '../src/features/workflow/engine/correlationStore.js';
import type { WorkflowPausedState } from '../src/features/workflow/types/workflow.js';
import {
  addPausedCorrelation,
  removePausedCorrelation,
  registerResumeWaiter,
  deregisterResumeWaiter,
  type QueuedResume,
  type ServerPausedEntry,
} from './correlation-handler.js';

export class ServerCorrelationBridge implements ICorrelationStore {
  private callbacks = new Map<string, {
    resolve: (data: Record<string, unknown>) => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
    waiter: (r: QueuedResume) => void;
    pausedAt: number;
    timeoutAt: number;
    webhookPath: string;
    state: WorkflowPausedState;
  }>();

  constructor(
    private readonly executionId: string,
    private readonly workflowId: string,
  ) {}

  get size(): number {
    return this.callbacks.size;
  }

  pause(
    correlationId: string,
    webhookPath: string,
    state: WorkflowPausedState,
    timeoutMs: number,
    webhookFilter?: string,
    config?: CorrelationWaitConfig,
  ): Promise<Record<string, unknown>> {
    if (this.callbacks.has(correlationId)) {
      return Promise.reject(new Error(`Correlation ID "${correlationId}" is already paused`));
    }

    const now = Date.now();
    const timeoutAt = timeoutMs > 0 ? now + timeoutMs : 0;

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      // Build the resume waiter — called by notifyResume() when a webhook/Kafka event matches
      const waiter = (queued: QueuedResume) => {
        const entry = this.callbacks.get(correlationId);
        if (!entry) return;
        if (entry.timer) clearTimeout(entry.timer);
        this.callbacks.delete(correlationId);
        resolve(queued.webhookData);
      };

      const callbackEntry = {
        resolve,
        reject,
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
        waiter,
        pausedAt: now,
        timeoutAt,
        webhookPath,
        state,
      };

      // Register in the server store so webhook routing can find this entry
      const correlationSource = config?.correlationSource ?? 'body';
      const serverEntry: ServerPausedEntry = {
        correlationId,
        webhookPath,
        executionId: this.executionId,
        workflowId: this.workflowId,
        pausedNodeId: state.pausedNodeId,
        pausedAt: now,
        timeoutAt,
        webhookFilter,
        correlationSource,
        correlationJsonPath: config?.correlationJsonPath,
        correlationHeader: config?.correlationHeader,
        correlationQueryParam: config?.correlationQueryParam,
      };
      addPausedCorrelation(serverEntry);

      // Register in-process resume waiter
      registerResumeWaiter(correlationId, waiter);

      // Set up timeout
      if (timeoutMs > 0) {
        callbackEntry.timer = setTimeout(() => {
          if (!this.callbacks.has(correlationId)) return;
          this.callbacks.delete(correlationId);
          deregisterResumeWaiter(correlationId, waiter);
          removePausedCorrelation(correlationId);
          reject(new Error(`Correlation timeout: no webhook received within ${timeoutMs}ms for "${correlationId}"`));
        }, timeoutMs);
      }

      this.callbacks.set(correlationId, callbackEntry);
    });
  }

  resume(correlationId: string, webhookData: Record<string, unknown>): boolean {
    const entry = this.callbacks.get(correlationId);
    if (!entry) return false;

    if (entry.timer) clearTimeout(entry.timer);
    deregisterResumeWaiter(correlationId, entry.waiter);
    removePausedCorrelation(correlationId);
    this.callbacks.delete(correlationId);
    entry.resolve(webhookData);
    return true;
  }

  isPaused(correlationId: string): boolean {
    return this.callbacks.has(correlationId);
  }

  cancel(correlationId: string): boolean {
    const entry = this.callbacks.get(correlationId);
    if (!entry) return false;

    if (entry.timer) clearTimeout(entry.timer);
    deregisterResumeWaiter(correlationId, entry.waiter);
    removePausedCorrelation(correlationId);
    this.callbacks.delete(correlationId);
    entry.reject(new Error(`Correlation cancelled for "${correlationId}"`));
    return true;
  }

  get(correlationId: string): PausedEntry | undefined {
    const entry = this.callbacks.get(correlationId);
    if (!entry) return undefined;
    return {
      correlationId,
      webhookPath: entry.webhookPath,
      state: entry.state,
      pausedAt: entry.pausedAt,
      timeoutAt: entry.timeoutAt,
      resolve: entry.resolve,
      reject: entry.reject,
    };
  }

  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, entry] of this.callbacks.entries()) {
      if (entry.timeoutAt > 0 && entry.timeoutAt <= now) {
        if (entry.timer) clearTimeout(entry.timer);
        deregisterResumeWaiter(id, entry.waiter);
        removePausedCorrelation(id);
        this.callbacks.delete(id);
        entry.reject(new Error(`Correlation expired for "${id}"`));
        count++;
      }
    }
    return count;
  }

  listPaused(): PausedEntry[] {
    return [...this.callbacks.entries()].map(([correlationId, entry]) => ({
      correlationId,
      webhookPath: entry.webhookPath,
      state: entry.state,
      pausedAt: entry.pausedAt,
      timeoutAt: entry.timeoutAt,
      resolve: entry.resolve,
      reject: entry.reject,
    }));
  }
}
