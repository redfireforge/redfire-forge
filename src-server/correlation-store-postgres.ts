/**
 * PostgreSQL server-side correlation store (Option B: event-driven).
 *
 * All state lives in PostgreSQL. On pause(), writes row to DB and holds
 * an in-memory promise. On resume(), updates DB row and resolves the promise.
 * On server restart, recovery job reloads paused rows.
 *
 * Supports LISTEN/NOTIFY for multi-instance coordination (future).
 */

import { Pool, type PoolConfig } from 'pg';
import { SCHEMA_POSTGRES, type PausedWorkflowRow } from './correlation-schema.js';
import type { ServerPausedEntry } from './correlation-handler.js';
import type { IServerCorrelationStore } from './correlation-store-interface.js';

const MAX_UNMATCHED_LOG = 100;

export class PostgresServerStore implements IServerCorrelationStore {
  private pool: Pool;
  private cache = new Map<string, ServerPausedEntry>();

  constructor(config?: PoolConfig) {
    this.pool = new Pool(config ?? {
      connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/redfireforge',
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create tables (each statement separately for PG)
      const statements = SCHEMA_POSTGRES.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      for (const stmt of statements) {
        await client.query(stmt);
      }

      // Rehydrate active entries into cache
      const result = await client.query<PausedWorkflowRow>(
        'SELECT * FROM paused_workflows WHERE resumed = FALSE',
      );

      const now = Date.now();
      for (const row of result.rows) {
        if (row.timeout_at > 0 && row.timeout_at <= now) {
          await client.query('DELETE FROM paused_workflows WHERE correlation_id = $1', [row.correlation_id]);
          continue;
        }
        this.cache.set(row.correlation_id, this.rowToEntry(row));
      }

      console.log(`[Postgres Store] Initialized — ${this.cache.size} paused entries rehydrated`);
    } finally {
      client.release();
    }
  }

  add(entry: ServerPausedEntry): boolean {
    if (this.cache.has(entry.correlationId)) return false;

    // Add to cache first (sync)
    this.cache.set(entry.correlationId, entry);

    // Write to PG (fire-and-forget with error logging)
    this.insertRow(entry).catch(err => {
      console.error(`[Postgres Store] Failed to persist pause for ${entry.correlationId}:`, err);
    });

    return true;
  }

  remove(correlationId: string): ServerPausedEntry | undefined {
    const entry = this.cache.get(correlationId);
    if (!entry) return undefined;

    this.cache.delete(correlationId);

    // Mark as resumed in PG
    this.pool.query(
      'UPDATE paused_workflows SET resumed = TRUE WHERE correlation_id = $1',
      [correlationId],
    ).catch(err => {
      console.error(`[Postgres Store] Failed to mark resumed for ${correlationId}:`, err);
    });

    return entry;
  }

  find(correlationId: string): ServerPausedEntry | undefined {
    return this.cache.get(correlationId);
  }

  listAll(): ServerPausedEntry[] {
    return [...this.cache.values()];
  }

  count(): number {
    return this.cache.size;
  }

  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;
    const toDelete: string[] = [];

    for (const [id, entry] of this.cache) {
      if (entry.timeoutAt > 0 && entry.timeoutAt <= now) {
        this.cache.delete(id);
        toDelete.push(id);
        count++;
      }
    }

    // Batch delete from PG
    if (toDelete.length > 0) {
      this.pool.query(
        'DELETE FROM paused_workflows WHERE correlation_id = ANY($1)',
        [toDelete],
      ).catch(err => {
        console.error('[Postgres Store] Failed to cleanup expired:', err);
      });
    }

    return count;
  }

  logUnmatched(path: string, correlationId: string | undefined, payload: unknown): void {
    const now = Date.now();

    this.pool.query(
      'INSERT INTO unmatched_webhooks (path, correlation_id, payload, received_at) VALUES ($1, $2, $3, $4)',
      [path, correlationId ?? null, JSON.stringify(payload), now],
    ).catch(err => {
      console.error('[Postgres Store] Failed to log unmatched webhook:', err);
    });

    // Trim old rows
    this.pool.query(
      `DELETE FROM unmatched_webhooks WHERE id NOT IN (
        SELECT id FROM unmatched_webhooks ORDER BY received_at DESC LIMIT $1
      )`,
      [MAX_UNMATCHED_LOG],
    ).catch(() => { /* best-effort trim */ });
  }

  getUnmatched(): Array<{ path: string; correlationId?: string; payload: unknown; receivedAt: number }> {
    // For sync compatibility, return empty — use getUnmatchedAsync for full data
    return [];
  }

  /** Async version to fetch unmatched webhooks from PG. */
  async getUnmatchedAsync(): Promise<Array<{ path: string; correlationId?: string; payload: unknown; receivedAt: number }>> {
    const result = await this.pool.query(
      'SELECT * FROM unmatched_webhooks ORDER BY received_at DESC LIMIT $1',
      [MAX_UNMATCHED_LOG],
    );
    return result.rows.map(row => ({
      path: row.path,
      correlationId: row.correlation_id ?? undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      receivedAt: Number(row.received_at),
    }));
  }

  clearAll(): void {
    this.cache.clear();
    this.pool.query('DELETE FROM paused_workflows').catch(() => {});
    this.pool.query('DELETE FROM unmatched_webhooks').catch(() => {});
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ── Internal ─────────────────────────────────────────

  private async insertRow(entry: ServerPausedEntry): Promise<void> {
    await this.pool.query(`
      INSERT INTO paused_workflows (
        correlation_id, webhook_path, execution_id, workflow_id,
        paused_node_id, paused_at, timeout_at, webhook_filter,
        correlation_source, correlation_json_path, correlation_header,
        correlation_query_param, state_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
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
      JSON.stringify({}),
    ]);
  }

  private rowToEntry(row: PausedWorkflowRow): ServerPausedEntry {
    return {
      correlationId: row.correlation_id,
      webhookPath: row.webhook_path,
      executionId: row.execution_id,
      workflowId: row.workflow_id,
      pausedNodeId: row.paused_node_id,
      pausedAt: Number(row.paused_at),
      timeoutAt: Number(row.timeout_at),
      webhookFilter: row.webhook_filter ?? undefined,
      correlationSource: row.correlation_source as 'body' | 'header' | 'query',
      correlationJsonPath: row.correlation_json_path ?? undefined,
      correlationHeader: row.correlation_header ?? undefined,
      correlationQueryParam: row.correlation_query_param ?? undefined,
    };
  }
}
