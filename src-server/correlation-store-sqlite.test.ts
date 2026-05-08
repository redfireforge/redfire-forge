import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteServerStore } from './correlation-store-sqlite';
import type { ServerPausedEntry } from './correlation-handler';
import fs from 'fs';
import path from 'path';

const MAX_UNMATCHED_LOG = 100;

const TEST_DB_PATH = path.join(__dirname, '../test-data/test-correlations.db');

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

describe('SqliteServerStore', () => {
  let store: SqliteServerStore;

  beforeEach(async () => {
    // Ensure test-data dir exists
    const dir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Remove old DB if exists
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    // Also clean WAL/SHM files
    for (const ext of ['-wal', '-shm']) {
      const f = TEST_DB_PATH + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  // ── add / find / remove ──

  it('adds and finds an entry', () => {
    const entry = makeEntry();
    expect(store.add(entry)).toBe(true);
    expect(store.find('corr-1')).toEqual(entry);
    expect(store.count()).toBe(1);
  });

  it('add persists optional body/header/query fields as null when omitted', () => {
    const entry = makeEntry({
      correlationId: 'minimal',
      webhookFilter: undefined,
      correlationJsonPath: undefined,
      correlationHeader: undefined,
      correlationQueryParam: undefined,
    });
    expect(store.add(entry)).toBe(true);
    expect(store.find('minimal')).toBeDefined();
  });

  it('rejects duplicate correlation IDs', () => {
    store.add(makeEntry());
    expect(store.add(makeEntry())).toBe(false);
  });

  it('removes an entry', () => {
    store.add(makeEntry());
    const removed = store.remove('corr-1');
    expect(removed?.correlationId).toBe('corr-1');
    expect(store.find('corr-1')).toBeUndefined();
    expect(store.count()).toBe(0);
  });

  it('returns undefined for non-existent remove', () => {
    expect(store.remove('nope')).toBeUndefined();
  });

  // ── listAll ──

  it('lists all active entries', () => {
    store.add(makeEntry({ correlationId: 'a' }));
    store.add(makeEntry({ correlationId: 'b' }));
    store.add(makeEntry({ correlationId: 'c' }));
    expect(store.listAll()).toHaveLength(3);
  });

  // ── cleanupExpired ──

  it('cleans up expired entries', () => {
    store.add(makeEntry({ correlationId: 'expired', timeoutAt: Date.now() - 1000 }));
    store.add(makeEntry({ correlationId: 'active', timeoutAt: Date.now() + 60000 }));
    store.add(makeEntry({ correlationId: 'no-timeout', timeoutAt: 0 }));

    const cleaned = store.cleanupExpired();
    expect(cleaned).toBe(1);
    expect(store.count()).toBe(2);
    expect(store.find('expired')).toBeUndefined();
    expect(store.find('active')).toBeDefined();
    expect(store.find('no-timeout')).toBeDefined();
  });

  // ── unmatched webhooks ──

  it('logs and retrieves unmatched webhooks', () => {
    store.logUnmatched('/webhooks/test', 'corr-x', { foo: 'bar' });
    const unmatched = store.getUnmatched();
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].path).toBe('/webhooks/test');
    expect(unmatched[0].correlationId).toBe('corr-x');
  });

  it('trims in-memory unmatched webhooks past cap', () => {
    for (let i = 0; i < MAX_UNMATCHED_LOG + 5; i++) {
      store.logUnmatched(`/p/${i}`, `c-${i}`, { i });
    }
    expect(store.getUnmatched()).toHaveLength(MAX_UNMATCHED_LOG);
    const paths = store.getUnmatched().map((u) => u.path);
    expect(paths).toContain(`/p/${MAX_UNMATCHED_LOG + 4}`);
    expect(paths).not.toContain('/p/0');
  });

  // ── clearAll ──

  it('clears all data', () => {
    store.add(makeEntry());
    store.logUnmatched('/test', undefined, {});
    store.clearAll();
    expect(store.count()).toBe(0);
    expect(store.getUnmatched()).toHaveLength(0);
  });

  // ── Persistence / rehydration ──

  it('rehydrates entries on init', async () => {
    store.add(makeEntry({ correlationId: 'persist-1' }));
    store.add(makeEntry({ correlationId: 'persist-2' }));
    await store.close();

    // Re-open
    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    expect(store2.count()).toBe(2);
    expect(store2.find('persist-1')).toBeDefined();
    expect(store2.find('persist-2')).toBeDefined();

    await store2.close();
    // Replace store ref so afterEach doesn't double-close
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  it('does not rehydrate resumed entries', async () => {
    store.add(makeEntry({ correlationId: 'resumed-1' }));
    store.remove('resumed-1'); // marks as resumed
    store.add(makeEntry({ correlationId: 'active-1' }));
    await store.close();

    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    expect(store2.count()).toBe(1);
    expect(store2.find('resumed-1')).toBeUndefined();
    expect(store2.find('active-1')).toBeDefined();

    await store2.close();
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  it('does not rehydrate expired entries', async () => {
    store.add(makeEntry({ correlationId: 'expired-1', timeoutAt: Date.now() - 5000 }));
    store.add(makeEntry({ correlationId: 'active-1', timeoutAt: Date.now() + 60000 }));
    await store.close();

    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    expect(store2.count()).toBe(1);
    expect(store2.find('expired-1')).toBeUndefined();
    expect(store2.find('active-1')).toBeDefined();

    await store2.close();
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  it('rehydrates unmatched webhooks with JSON payload from disk', async () => {
    store.logUnmatched('/persist-u', 'u1', { n: 42 });
    await store.close();

    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    const list = store2.getUnmatched();
    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('/persist-u');
    expect(list[0].correlationId).toBe('u1');
    expect(list[0].payload).toEqual({ n: 42 });

    await store2.close();
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  it('rehydrates paused entry when correlation_json_path is null in DB', async () => {
    store.add(
      makeEntry({
        correlationId: 'no-json-path',
        correlationJsonPath: undefined,
      }),
    );
    await store.close();

    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    const found = store2.find('no-json-path');
    expect(found).toBeDefined();
    expect(found?.correlationJsonPath).toBeUndefined();

    await store2.close();
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });

  it('rehydrates unmatched rows with null correlation_id and payload', async () => {
    await store.close();

    const raw = new Database(TEST_DB_PATH);
    raw
      .prepare(
        'INSERT INTO unmatched_webhooks (path, correlation_id, payload, received_at) VALUES (?, ?, ?, ?)',
      )
      .run('/hook-nulls', null, null, Date.now());
    raw.close();

    const store2 = new SqliteServerStore(TEST_DB_PATH);
    await store2.init();

    const list = store2.getUnmatched();
    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('/hook-nulls');
    expect(list[0].correlationId).toBeUndefined();
    expect(list[0].payload).toBeUndefined();

    await store2.close();
    store = new SqliteServerStore(TEST_DB_PATH);
    await store.init();
  });
});
