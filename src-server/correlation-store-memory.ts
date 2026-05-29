/**
 * In-memory server-side correlation store.
 * Extracted from the original correlation-handler.ts module-level Map.
 */

import type { ServerPausedEntry } from './correlation-handler.js';
import type { IServerCorrelationStore } from './correlation-store-interface.js';
import {
  appendUnmatchedEntry,
  cleanupExpiredEntries,
  type UnmatchedWebhookEntry,
} from './correlation-store-shared.js';

export class InMemoryServerStore implements IServerCorrelationStore {
  private entries = new Map<string, ServerPausedEntry>();
  private unmatchedWebhooks: UnmatchedWebhookEntry[] = [];

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
    return cleanupExpiredEntries(this.entries, Date.now());
  }

  logUnmatched(path: string, correlationId: string | undefined, payload: unknown): void {
    appendUnmatchedEntry(this.unmatchedWebhooks, {
      path,
      correlationId,
      payload,
      receivedAt: Date.now(),
    });
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
