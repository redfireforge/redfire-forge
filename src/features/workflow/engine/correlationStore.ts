import type { WorkflowPausedState } from '../types/workflow';

// ── Types ────────────────────────────────────────────

export interface PausedEntry {
  /** Correlation ID used to match incoming webhooks. */
  correlationId: string;
  /** Webhook path pattern to match. */
  webhookPath: string;
  /** Serialized workflow execution state. */
  state: WorkflowPausedState;
  /** Timestamp when the workflow was paused (ms since epoch). */
  pausedAt: number;
  /** Timestamp when the entry expires (ms since epoch). 0 = no timeout. */
  timeoutAt: number;
  /** Optional webhook filter expression. */
  webhookFilter?: string;
  /** Promise resolve callback — called when webhook resumes the workflow. */
  resolve: (webhookData: Record<string, unknown>) => void;
  /** Promise reject callback — called on timeout or cancellation. */
  reject: (error: Error) => void;
}

export interface ResumeResult {
  /** The paused workflow state that was matched. */
  state: WorkflowPausedState;
  /** Data from the incoming webhook. */
  webhookData: Record<string, unknown>;
}

// ── Interface ────────────────────────────────────────

export interface ICorrelationStore {
  /**
   * Pause a workflow execution, waiting for a webhook callback.
   * Returns a promise that resolves with webhook data when resumed,
   * or rejects on timeout/cancellation.
   */
  pause(
    correlationId: string,
    webhookPath: string,
    state: WorkflowPausedState,
    timeoutMs: number,
    webhookFilter?: string,
  ): Promise<Record<string, unknown>>;

  /**
   * Resume a paused workflow by correlation ID.
   * Returns true if a matching paused workflow was found and resumed.
   */
  resume(correlationId: string, webhookData: Record<string, unknown>): boolean;

  /**
   * Check if a correlation ID has a paused workflow waiting.
   */
  isPaused(correlationId: string): boolean;

  /**
   * Cancel a paused workflow by correlation ID.
   * Returns true if a matching entry was found and cancelled.
   */
  cancel(correlationId: string): boolean;

  /**
   * Get the paused state for a correlation ID (if any).
   */
  get(correlationId: string): PausedEntry | undefined;

  /**
   * Remove all expired entries.
   * Returns the number of entries cleaned up.
   */
  cleanup(): number;

  /**
   * Get all currently paused entries (for monitoring/admin).
   */
  listPaused(): PausedEntry[];

  /**
   * Get the number of currently paused workflows.
   */
  readonly size: number;
}

// ── In-Memory Implementation ────────────────────────

export class InMemoryCorrelationStore implements ICorrelationStore {
  private entries = new Map<string, PausedEntry>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  get size(): number {
    return this.entries.size;
  }

  pause(
    correlationId: string,
    webhookPath: string,
    state: WorkflowPausedState,
    timeoutMs: number,
    webhookFilter?: string,
  ): Promise<Record<string, unknown>> {
    // Reject if already paused with same correlationId
    if (this.entries.has(correlationId)) {
      return Promise.reject(new Error(`Correlation ID "${correlationId}" is already paused`));
    }

    const now = Date.now();

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const entry: PausedEntry = {
        correlationId,
        webhookPath,
        state,
        pausedAt: now,
        timeoutAt: timeoutMs > 0 ? now + timeoutMs : 0,
        webhookFilter,
        resolve,
        reject,
      };

      this.entries.set(correlationId, entry);

      // Set timeout if specified
      if (timeoutMs > 0) {
        const timer = setTimeout(() => {
          this.entries.delete(correlationId);
          this.timers.delete(correlationId);
          reject(new Error(`Correlation timeout: no webhook received within ${timeoutMs}ms for "${correlationId}"`));
        }, timeoutMs);

        this.timers.set(correlationId, timer);
      }
    });
  }

  resume(correlationId: string, webhookData: Record<string, unknown>): boolean {
    const entry = this.entries.get(correlationId);
    if (!entry) return false;

    // Clear timeout timer
    const timer = this.timers.get(correlationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(correlationId);
    }

    // Remove entry and resolve the promise
    this.entries.delete(correlationId);
    entry.resolve(webhookData);
    return true;
  }

  isPaused(correlationId: string): boolean {
    return this.entries.has(correlationId);
  }

  cancel(correlationId: string): boolean {
    const entry = this.entries.get(correlationId);
    if (!entry) return false;

    // Clear timeout timer
    const timer = this.timers.get(correlationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(correlationId);
    }

    // Remove entry and reject the promise
    this.entries.delete(correlationId);
    entry.reject(new Error(`Correlation cancelled for "${correlationId}"`));
    return true;
  }

  get(correlationId: string): PausedEntry | undefined {
    return this.entries.get(correlationId);
  }

  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [id, entry] of this.entries) {
      if (entry.timeoutAt > 0 && entry.timeoutAt <= now) {
        // Clear timeout timer (may already have fired)
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }

        this.entries.delete(id);
        entry.reject(new Error(`Correlation expired during cleanup for "${id}"`));
        count++;
      }
    }

    return count;
  }

  listPaused(): PausedEntry[] {
    return [...this.entries.values()];
  }
}
