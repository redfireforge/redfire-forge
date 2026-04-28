/**
 * Server-side correlation store interface.
 *
 * Three implementations:
 * - InMemoryServerStore  (default, no persistence)
 * - SqliteServerStore    (dev, file-based persistence — Option A: write-through cache)
 * - PostgresServerStore  (prod, event-driven — Option B)
 */

import type { ServerPausedEntry } from './correlation-handler.js';

export interface IServerCorrelationStore {
  /** Initialize the store (create tables, etc.). */
  init(): Promise<void>;

  /** Add a paused correlation entry. Returns false if correlationId already exists. */
  add(entry: ServerPausedEntry): boolean;

  /** Remove and return a paused entry by correlationId. */
  remove(correlationId: string): ServerPausedEntry | undefined;

  /** Find a paused entry by correlationId. */
  find(correlationId: string): ServerPausedEntry | undefined;

  /** List all active (non-resumed) paused entries. */
  listAll(): ServerPausedEntry[];

  /** Get count of active paused entries. */
  count(): number;

  /** Remove expired entries. Returns number removed. */
  cleanupExpired(): number;

  /** Log an unmatched webhook. */
  logUnmatched(path: string, correlationId: string | undefined, payload: unknown): void;

  /** Get unmatched webhook log. */
  getUnmatched(): Array<{ path: string; correlationId?: string; payload: unknown; receivedAt: number }>;

  /** Clear all data (for testing). */
  clearAll(): void;

  /** Shut down the store (close connections, etc.). */
  close(): Promise<void>;
}
