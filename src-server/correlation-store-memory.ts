/**
 * In-memory server-side correlation store.
 * Extracted from the original correlation-handler.ts module-level Map.
 */

import type { ServerPausedEntry } from './correlation-handler.js';
import type { IServerCorrelationStore } from './correlation-store-interface.js';

const MAX_UNMATCHED_LOG = 100;

export class InMemoryServerStore implements IServerCorrelationStore {
  private entries = new Map<string, ServerPausedEntry>();
  private unmatchedWebhooks: Array<{
    path: string;
    correlationId?: string;
    payload: unknown;
    receivedAt: number;
  }> = [];

  async init(): Promise<void> {
    // Nothing to initialize
  }

  add(entry: ServerPausedEntry): boolean {
    if (this.entries.has(entry.correlationId)) return false;
    this.entries.set(entry.correlationId, entry);
    return true;
  }

  remove(correlationId: string): ServerPausedEntry | undefined {
    const entry = this.entries.get(correlationId);
    if (entry) this.entries.delete(correlationId);
    return entry;
  }

  find(correlationId: string): ServerPausedEntry | undefined {
    return this.entries.get(correlationId);
  }

  listAll(): ServerPausedEntry[] {
    return [...this.entries.values()];
  }

  count(): number {
    return this.entries.size;
  }

  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, entry] of this.entries) {
      if (entry.timeoutAt > 0 && entry.timeoutAt <= now) {
        this.entries.delete(id);
        count++;
      }
    }
    return count;
  }

  logUnmatched(path: string, correlationId: string | undefined, payload: unknown): void {
    this.unmatchedWebhooks.push({ path, correlationId, payload, receivedAt: Date.now() });
    while (this.unmatchedWebhooks.length > MAX_UNMATCHED_LOG) {
      this.unmatchedWebhooks.shift();
    }
  }

  getUnmatched() {
    return [...this.unmatchedWebhooks];
  }

  clearAll(): void {
    this.entries.clear();
    this.unmatchedWebhooks.length = 0;
  }

  async close(): Promise<void> {
    // Nothing to close
  }
}
