/**
 * SQLite server-side correlation store (Option A: write-through cache).
 *
 * In-memory Map holds the live entries (same as InMemoryServerStore).
 * SQLite writes a persistent copy on add/remove for crash recovery.
 * On init, rehydrates from SQLite.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { SCHEMA_SQLITE, type PausedWorkflowRow } from './correlation-schema.js';
import type { ServerPausedEntry } from './correlation-handler.js';
import type { IServerCorrelationStore } from './correlation-store-interface.js';
import {
  appendUnmatchedEntry,
  cleanupExpiredEntries,
  MAX_UNMATCHED_LOG,
  type UnmatchedWebhookEntry,
} from './correlation-store-shared.js';

const DEFAULT_DB_PATH = './data/correlations.db';

export class SqliteServerStore implements IServerCorrelationStore {
  private db: Database.Database;
  private entries = new Map<string, ServerPausedEntry>();
  private unmatchedWebhooks: UnmatchedWebhookEntry[] = [];

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    // Create tables
    this.db.exec(SCHEMA_SQLITE);

    // Rehydrate from disk — load non-resumed entries
    const rows = this.db.prepare(
      'SELECT * FROM paused_workflows WHERE resumed = 0',
    ).all() as PausedWorkflowRow[];

    for (const row of rows) {
      // Check if already expired
      if (row.timeout_at > 0 && row.timeout_at <= Date.now()) {
        this.db.prepare('DELETE FROM paused_workflows WHERE correlation_id = ?').run(row.correlation_id);
        continue;
      }

      const entry: ServerPausedEntry = this.rowToEntry(row);
      this.entries.set(entry.correlationId, entry);
    }

    // Rehydrate unmatched webhooks (most recent)
    const unmatchedRows = this.db.prepare(
      'SELECT * FROM unmatched_webhooks ORDER BY received_at DESC LIMIT ?',
    ).all(MAX_UNMATCHED_LOG) as Array<{
      path: string;
      correlation_id: string | null;
      payload: string | null;
      received_at: number;
    }>;

    for (const row of unmatchedRows.reverse()) {
      this.unmatchedWebhooks.push({
        path: row.path,
        correlationId: row.correlation_id ?? undefined,
        payload: row.payload ? JSON.parse(row.payload) : undefined,
        receivedAt: row.received_at,
      });
    }

    console.log(`[SQLite Store] Initialized — ${this.entries.size} paused entries rehydrated`);
  }

  add(entry: ServerPausedEntry): boolean {
    if (this.entries.has(entry.correlationId)) return false;

    // Write to memory
    this.entries.set(entry.correlationId, entry);

    // Write-through to SQLite
    this.db.prepare(`
      INSERT INTO paused_workflows (
        correlation_id, webhook_path, execution_id, workflow_id,
        paused_node_id, paused_at, timeout_at, webhook_filter,
        correlation_source, correlation_json_path, correlation_header,
        correlation_query_param, state_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.correlationId,
      entry.webhookPath,
      entry.executionId,
      entry.workflowId,
      entry.pausedNodeId,
      entry.pausedAt,
      entry.timeoutAt,
      entry.webhookFilter ?? null,
      entry.correlationSource,
      (entry as Record<string, unknown>).correlationJsonPath as string ?? null,
      (entry as Record<string, unknown>).correlationHeader as string ?? null,
      (entry as Record<string, unknown>).correlationQueryParam as string ?? null,
      JSON.stringify({}), // state_json — serialized workflow state
    );

    return true;
  }

  remove(correlationId: string): ServerPausedEntry | undefined {
    const entry = this.entries.get(correlationId);
    if (!entry) return undefined;

    // Remove from memory
    this.entries.delete(correlationId);

    // Mark as resumed in SQLite (don't delete — keep for audit)
    this.db.prepare(
      'UPDATE paused_workflows SET resumed = 1 WHERE correlation_id = ?',
    ).run(correlationId);

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
    return cleanupExpiredEntries(this.entries, Date.now(), (id) => {
      this.db.prepare('DELETE FROM paused_workflows WHERE correlation_id = ?').run(id);
    });
  }

  logUnmatched(path: string, correlationId: string | undefined, payload: unknown): void {
    const now = Date.now();
    appendUnmatchedEntry(this.unmatchedWebhooks, {
      path,
      correlationId,
      payload,
      receivedAt: now,
    });

    // Write to SQLite
    this.db.prepare(
      'INSERT INTO unmatched_webhooks (path, correlation_id, payload, received_at) VALUES (?, ?, ?, ?)',
    ).run(path, correlationId ?? null, JSON.stringify(payload), now);

    // Trim old rows
    this.db.prepare(
      'DELETE FROM unmatched_webhooks WHERE id NOT IN (SELECT id FROM unmatched_webhooks ORDER BY received_at DESC LIMIT ?)',
    ).run(MAX_UNMATCHED_LOG);
  }

  getUnmatched() {
    return [...this.unmatchedWebhooks];
  }

  clearAll(): void {
    this.entries.clear();
    this.unmatchedWebhooks.length = 0;
    this.db.prepare('DELETE FROM paused_workflows').run();
    this.db.prepare('DELETE FROM unmatched_webhooks').run();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // ── Helpers ──────────────────────────────────────────

  private rowToEntry(row: PausedWorkflowRow): ServerPausedEntry {
    return {
      correlationId: row.correlation_id,
      webhookPath: row.webhook_path,
      executionId: row.execution_id,
      workflowId: row.workflow_id,
      pausedNodeId: row.paused_node_id,
      pausedAt: row.paused_at,
      timeoutAt: row.timeout_at,
      webhookFilter: row.webhook_filter ?? undefined,
      correlationSource: row.correlation_source as 'body' | 'header' | 'query',
      correlationJsonPath: row.correlation_json_path ?? undefined,
      correlationHeader: row.correlation_header ?? undefined,
      correlationQueryParam: row.correlation_query_param ?? undefined,
    };
  }
}
