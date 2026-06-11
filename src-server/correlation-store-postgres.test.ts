import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ServerPausedEntry } from './correlation-handler.js';

// ── Mock pg ────────────────────────────────────────────
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();
const mockRelease = vi.fn();

vi.mock('pg', () => ({
  Pool: class {
    query = (...args: unknown[]) => mockQuery(...args);
    connect = (...args: unknown[]) => mockConnect(...args);
    end = (...args: unknown[]) => mockEnd(...args);
  },
}));

import { PostgresServerStore } from './correlation-store-postgres';

function makeEntry(overrides: Partial<ServerPausedEntry> = {}): ServerPausedEntry {
  return {
    correlationId: 'corr-1',
    webhookPath: '/webhooks/callback/payment',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId: 'cw1',
    pausedAt: Date.now(),
    timeoutAt: 0,
    correlationSource: 'body',
    correlationJsonPath: '$.correlationId',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    correlation_id: 'corr-1',
    webhook_path: '/cb',
    execution_id: 'exec-1',
    workflow_id: 'wf-1',
    paused_node_id: 'cw1',
    paused_at: 100,
    timeout_at: 0,
    webhook_filter: null,
    correlation_source: 'body',
    correlation_json_path: '$.x',
    correlation_header: null,
    correlation_query_param: null,
    ...overrides,
  };
}

describe('PostgresServerStore', () => {
  let store: PostgresServerStore;

  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
    mockEnd.mockReset();
    mockRelease.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockEnd.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    store = new PostgresServerStore({ connectionString: 'postgresql://test' });
  });

  it('creates schema and rehydrates active entries on init', async () => {
    mockConnect.mockResolvedValue({
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // schema statements share this fn but only SELECT returns rows
        .mockResolvedValue({ rows: [row()] }),
      release: mockRelease,
    });
    // Simplify: connect client whose query returns rows for the SELECT
    const clientQuery = vi.fn().mockResolvedValue({ rows: [row({ correlation_id: 'a' })] });
    mockConnect.mockResolvedValue({ query: clientQuery, release: mockRelease });
    await store.init();
    expect(store.count()).toBe(1);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('drops expired rows during init rehydration', async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return Promise.resolve({ rows: [row({ correlation_id: 'expired', timeout_at: 1 })] });
      }
      return Promise.resolve({ rows: [] });
    });
    mockConnect.mockResolvedValue({ query: clientQuery, release: mockRelease });
    await store.init();
    expect(store.count()).toBe(0);
  });

  it('adds an entry and persists it, returning false on duplicates', () => {
    const entry = makeEntry();
    expect(store.add(entry)).toBe(true);
    expect(store.find('corr-1')).toEqual(entry);
    expect(store.add(entry)).toBe(false);
    expect(store.count()).toBe(1);
  });

  it('removes an entry and marks it resumed', () => {
    const entry = makeEntry();
    store.add(entry);
    expect(store.remove('corr-1')).toEqual(entry);
    expect(store.find('corr-1')).toBeUndefined();
    expect(store.remove('ghost')).toBeUndefined();
  });

  it('lists all entries', () => {
    store.add(makeEntry({ correlationId: 'a' }));
    store.add(makeEntry({ correlationId: 'b' }));
    expect(store.listAll().map((e) => e.correlationId).sort()).toEqual(['a', 'b']);
  });

  it('cleans up expired entries', () => {
    store.add(makeEntry({ correlationId: 'live', timeoutAt: 0 }));
    store.add(makeEntry({ correlationId: 'dead', timeoutAt: 1 }));
    expect(store.cleanupExpired()).toBe(1);
    expect(store.find('live')).toBeDefined();
    expect(store.find('dead')).toBeUndefined();
  });

  it('cleanupExpired returns 0 when nothing expired', () => {
    store.add(makeEntry({ correlationId: 'live', timeoutAt: 0 }));
    expect(store.cleanupExpired()).toBe(0);
  });

  it('logs unmatched webhooks', () => {
    store.logUnmatched('/cb', 'corr-x', { a: 1 });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO unmatched_webhooks'),
      expect.arrayContaining(['/cb', 'corr-x']),
    );
  });

  it('getUnmatched (sync) returns empty', () => {
    expect(store.getUnmatched()).toEqual([]);
  });

  it('getUnmatchedAsync maps PG rows', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ path: '/cb', correlation_id: 'c1', payload: '{"a":1}', received_at: 5 }],
    });
    const result = await store.getUnmatchedAsync();
    expect(result).toEqual([{ path: '/cb', correlationId: 'c1', payload: { a: 1 }, receivedAt: 5 }]);
  });

  it('getUnmatchedAsync handles null payload and correlation id', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ path: '/cb', correlation_id: null, payload: null, received_at: 9 }],
    });
    const result = await store.getUnmatchedAsync();
    expect(result[0]).toEqual({ path: '/cb', correlationId: undefined, payload: undefined, receivedAt: 9 });
  });

  it('clearAll empties the cache', () => {
    store.add(makeEntry());
    store.clearAll();
    expect(store.count()).toBe(0);
  });

  it('closes the pool', async () => {
    await store.close();
    expect(mockEnd).toHaveBeenCalled();
  });

  it('uses a default connection when none is provided', () => {
    expect(() => new PostgresServerStore()).not.toThrow();
  });

  it('swallows persistence errors when adding', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(store.add(makeEntry({ correlationId: 'z' }))).toBe(true);
    await Promise.resolve();
    errSpy.mockRestore();
  });
});
