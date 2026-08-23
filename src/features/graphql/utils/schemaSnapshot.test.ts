/**
 * schemaSnapshot.test.ts — Phase 3D (task 3D-10)
 *
 * Tests the IDB CRUD functions in schemaSnapshot.ts using fake-indexeddb.
 * Each test resets modules + installs a fresh fake IDB to ensure isolation.
 *
 * Covers:
 *  - save and load (newest-first ordering)
 *  - FIFO eviction when MAX_PER_CONNECTION (20) exceeded
 *  - SDL > 500KB triggers console.warn
 *  - connection isolation (snapshots for conn-A not visible to conn-B)
 *  - deleteSnapshot removes the snapshot and cascades to acks
 *  - relabelSnapshot updates the label field
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphqlSchemaSnapshot } from '@shared/types/graphql';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let saveSnapshot: typeof import('./schemaSnapshot').saveSnapshot;
let loadSnapshots: typeof import('./schemaSnapshot').loadSnapshots;
let deleteSnapshot: typeof import('./schemaSnapshot').deleteSnapshot;
let relabelSnapshot: typeof import('./schemaSnapshot').relabelSnapshot;
let addAck: typeof import('./schemaDiffAck').addAck;
let getAcks: typeof import('./schemaDiffAck').getAcks;

function makeSnapshot(overrides: Partial<GraphqlSchemaSnapshot> = {}): GraphqlSchemaSnapshot {
  return {
    id: crypto.randomUUID(),
    // Use unique connection IDs per test by default to avoid cross-test IDB contamination
    connectionId: `http://localhost/${crypto.randomUUID()}/graphql`,
    sdl: 'type Query { hello: String }',
    typesCount: 1,
    capturedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  // Reset modules first, then install fresh fake IDB (auto-stubs all IDB globals)
  vi.resetModules();
  await import('fake-indexeddb/auto');

  // Re-import after module reset so openDB picks up the fresh fake IDB
  const mod = await import('./schemaSnapshot');
  saveSnapshot    = mod.saveSnapshot;
  loadSnapshots   = mod.loadSnapshots;
  deleteSnapshot  = mod.deleteSnapshot;
  relabelSnapshot = mod.relabelSnapshot;
  const ackMod = await import('./schemaDiffAck');
  addAck  = ackMod.addAck;
  getAcks = ackMod.getAcks;
});

// ─── Save and load ────────────────────────────────────────────────────────────

describe('saveSnapshot + loadSnapshots', () => {
  it('saves a snapshot and loads it back', async () => {
    const conn = `conn-save-${crypto.randomUUID()}`;
    const snap = makeSnapshot({ connectionId: conn });
    await saveSnapshot(snap);
    const loaded = await loadSnapshots(conn);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(snap.id);
    expect(loaded[0].sdl).toBe(snap.sdl);
  });

  it('returns snapshots newest-first (descending capturedAt)', async () => {
    const conn = `conn-order-${crypto.randomUUID()}`;
    const older = makeSnapshot({ connectionId: conn, capturedAt: 1000 });
    const newer = makeSnapshot({ connectionId: conn, capturedAt: 2000 });
    await saveSnapshot(older);
    await saveSnapshot(newer);
    const loaded = await loadSnapshots(conn);
    expect(loaded[0].capturedAt).toBe(2000);
    expect(loaded[1].capturedAt).toBe(1000);
  });

  it('returns empty array for unknown connectionId', async () => {
    const loaded = await loadSnapshots('unknown-connection');
    expect(loaded).toHaveLength(0);
  });
});

// ─── Connection isolation ─────────────────────────────────────────────────────

describe('connection isolation', () => {
  it('conn-A and conn-B have independent snapshot lists', async () => {
    const connA = `conn-A-${crypto.randomUUID()}`;
    const connB = `conn-B-${crypto.randomUUID()}`;
    const snapA = makeSnapshot({ connectionId: connA });
    const snapB = makeSnapshot({ connectionId: connB });
    await saveSnapshot(snapA);
    await saveSnapshot(snapB);

    const loadedA = await loadSnapshots(connA);
    const loadedB = await loadSnapshots(connB);
    expect(loadedA.every((s) => s.connectionId === connA)).toBe(true);
    expect(loadedB.every((s) => s.connectionId === connB)).toBe(true);
    expect(loadedA).toHaveLength(1);
    expect(loadedB).toHaveLength(1);
  });
});

// ─── FIFO eviction at MAX_PER_CONNECTION ─────────────────────────────────────

describe('FIFO eviction', () => {
  it('evicts oldest snapshot when count exceeds 20', async () => {
    const conn = `fifo-conn-${crypto.randomUUID()}`;
    const snaps: GraphqlSchemaSnapshot[] = [];
    // Save 20 snapshots with incrementing capturedAt
    for (let i = 1; i <= 20; i++) {
      const s = makeSnapshot({ connectionId: conn, capturedAt: i * 1000 });
      snaps.push(s);
      await saveSnapshot(s);
    }

    // Verify 20 are stored
    const before = await loadSnapshots(conn);
    expect(before).toHaveLength(20);

    // Save one more — should evict the oldest (capturedAt: 1000)
    const newest = makeSnapshot({ connectionId: conn, capturedAt: 21000 });
    await saveSnapshot(newest);

    const after = await loadSnapshots(conn);
    expect(after).toHaveLength(20);
    // Oldest (capturedAt: 1000) should be gone
    expect(after.some((s) => s.capturedAt === 1000)).toBe(false);
    // Newest should be present
    expect(after.some((s) => s.id === newest.id)).toBe(true);
  }, 15000);
});

// ─── SDL > 500KB warning ──────────────────────────────────────────────────────

describe('SDL size warning', () => {
  it('console.warns when SDL exceeds 500KB but stores anyway', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const largeSdl = 'a'.repeat(500 * 1024 + 1);
    const snap = makeSnapshot({ sdl: largeSdl });
    await saveSnapshot(snap);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('500KB'));
    const loaded = await loadSnapshots(snap.connectionId);
    expect(loaded).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('does not warn for SDL under 500KB', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const snap = makeSnapshot({ sdl: 'type Query { x: String }' });
    await saveSnapshot(snap);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('500KB'));
    warnSpy.mockRestore();
  });
});

// ─── deleteSnapshot ───────────────────────────────────────────────────────────

describe('deleteSnapshot', () => {
  it('removes the snapshot from IDB', async () => {
    const snap = makeSnapshot();
    await saveSnapshot(snap);
    await deleteSnapshot(snap.id);
    const loaded = await loadSnapshots(snap.connectionId);
    expect(loaded).toHaveLength(0);
  });

  it('is a no-op for non-existent id', async () => {
    await expect(deleteSnapshot('does-not-exist')).resolves.not.toThrow();
  });

  it('cascades to delete associated acks when snapshot is deleted', async () => {
    const conn = `conn-cascade-${crypto.randomUUID()}`;
    const snap = makeSnapshot({ connectionId: conn });
    await saveSnapshot(snap);
    // Add an ack for this snapshot
    await addAck(conn, snap.id, 'User.name', 'intentional refactor');
    const acksBeforeDelete = await getAcks(conn, snap.id);
    expect(acksBeforeDelete).toHaveLength(1);
    // Deleting the snapshot should cascade-delete the ack
    await deleteSnapshot(snap.id);
    const acksAfterDelete = await getAcks(conn, snap.id);
    expect(acksAfterDelete).toHaveLength(0);
  });
});

// ─── FIFO eviction cascades ack deletion ─────────────────────────────────────

describe('FIFO eviction + ack cascade', () => {
  it('deletes acks for the evicted snapshot when saving the 21st snapshot', async () => {
    const conn = `fifo-ack-conn-${crypto.randomUUID()}`;
    const snaps: GraphqlSchemaSnapshot[] = [];

    // Save 20 snapshots with incrementing capturedAt
    for (let i = 1; i <= 20; i++) {
      const s = makeSnapshot({ connectionId: conn, capturedAt: i * 1000 });
      snaps.push(s);
      await saveSnapshot(s);
    }

    // Add an ack for the OLDEST snapshot (snaps[0], capturedAt: 1000)
    const oldestSnap = snaps[0];
    await addAck(conn, oldestSnap.id, 'User.name', 'this ack will be evicted');
    const acksBeforeEviction = await getAcks(conn, oldestSnap.id);
    expect(acksBeforeEviction).toHaveLength(1);

    // Save the 21st snapshot — should evict the oldest (capturedAt: 1000)
    const newest = makeSnapshot({ connectionId: conn, capturedAt: 21000 });
    await saveSnapshot(newest);

    // The oldest snapshot should be gone
    const afterSnaps = await loadSnapshots(conn);
    expect(afterSnaps.some((s) => s.id === oldestSnap.id)).toBe(false);

    // The acks for the evicted snapshot should also be gone (cascade delete)
    const acksAfterEviction = await getAcks(conn, oldestSnap.id);
    expect(acksAfterEviction).toHaveLength(0);
  }, 15000);
});

// ─── relabelSnapshot ─────────────────────────────────────────────────────────

describe('relabelSnapshot', () => {
  it('updates the label field on an existing snapshot', async () => {
    const snap = makeSnapshot({ label: undefined });
    await saveSnapshot(snap);
    await relabelSnapshot(snap.id, 'v2.3 — before user refactor');
    const loaded = await loadSnapshots(snap.connectionId);
    expect(loaded[0].label).toBe('v2.3 — before user refactor');
  });

  it('is a no-op for non-existent id (does not throw)', async () => {
    await expect(relabelSnapshot('non-existent', 'label')).resolves.not.toThrow();
  });
});

// ─── Error handler coverage (IDB failure paths) ───────────────────────────────

describe('IDB error paths', () => {
  function makeFakeDb(opts: {
    reqResult?: unknown;
    reqFails?: boolean;
    txFails?: boolean;
    nullErrors?: boolean;
  } = {}) {
    const fakeReq = {
      result: opts.reqResult ?? undefined,
      error: opts.nullErrors ? null : new DOMException('req error'),
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const fakeStore = {
      get: () => {
        if (opts.reqFails) {
          setTimeout(() => fakeReq.onerror?.(), 0);
        } else {
          setTimeout(() => fakeReq.onsuccess?.(), 0);
        }
        return fakeReq;
      },
      index: () => ({
        getAll: (_range: unknown) => {
          void _range;
          const allReq = {
            result: opts.reqResult ?? null, // null triggers ?? [] branch
            error: opts.nullErrors ? null : new DOMException('all error'),
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
          };
          if (opts.reqFails) {
            setTimeout(() => allReq.onerror?.(), 0);
          } else {
            setTimeout(() => allReq.onsuccess?.(), 0);
          }
          return allReq;
        },
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const fakeTx = {
      error: opts.nullErrors ? null : new DOMException('tx error'),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      objectStore: () => fakeStore,
    };
    // Delay timer start until transaction() is called so tx.onerror is set first.
    const fakeDb = {
      transaction: () => {
        if (opts.txFails) {
          setTimeout(() => fakeTx.onerror?.(), 0);
        } else {
          // Non-failing tx: auto-complete after callbacks are registered
          setTimeout(() => fakeTx.oncomplete?.(), 0);
        }
        return fakeTx;
      },
    };
    return fakeDb;
  }

  it('loadSnapshots rejects when IDB request fails (req.onerror)', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ reqFails: true })),
    }));
    const { loadSnapshots: load } = await import('./schemaSnapshot');
    await expect(load('test-conn')).rejects.toBeInstanceOf(DOMException);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('loadSnapshots uses fallback Error when req.error is null', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ reqFails: true, nullErrors: true })),
    }));
    const { loadSnapshots: load } = await import('./schemaSnapshot');
    await expect(load('test-conn')).rejects.toThrow('IndexedDB loadSnapshots failed');
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('loadSnapshots handles null req.result (covers ?? [] branch)', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ reqResult: null })),
    }));
    const { loadSnapshots: load } = await import('./schemaSnapshot');
    const result = await load('test-conn');
    expect(Array.isArray(result)).toBe(true);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('saveSnapshot rejects when write transaction fails (tx.onerror)', async () => {
    vi.resetModules();
    // saveSnapshot calls openDB() first (for write tx), then loadSnapshots internally
    // calls openDB() again. So call #1 should return a failing write DB, call #2 returns
    // a successful read DB (so loadSnapshots can resolve with an empty list).
    let callCount = 0;
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: the write DB — fail the transaction
          return Promise.resolve(makeFakeDb({ txFails: true }));
        }
        // Subsequent calls: loadSnapshots DB — succeed with empty list
        return Promise.resolve(makeFakeDb({ reqResult: [] }));
      }),
    }));
    const { saveSnapshot: save } = await import('./schemaSnapshot');
    await expect(save(makeSnapshot())).rejects.toBeInstanceOf(DOMException);
    vi.doUnmock('../../../shared/utils/idbOpen');
  }, 10000);

  it('saveSnapshot uses fallback Error when tx.error is null', async () => {
    vi.resetModules();
    let callCount = 0;
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(makeFakeDb({ txFails: true, nullErrors: true }));
        }
        return Promise.resolve(makeFakeDb({ reqResult: [] }));
      }),
    }));
    const { saveSnapshot: save } = await import('./schemaSnapshot');
    await expect(save(makeSnapshot())).rejects.toThrow('IndexedDB saveSnapshot failed');
    vi.doUnmock('../../../shared/utils/idbOpen');
  }, 10000);

  it('deleteSnapshot rejects when IDB transaction fails (tx.onerror)', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ txFails: true })),
    }));
    vi.doMock('./schemaDiffAck', () => ({
      deleteAcksForSnapshot: vi.fn().mockResolvedValue(undefined),
    }));
    const { deleteSnapshot: del } = await import('./schemaSnapshot');
    await expect(del('any-id')).rejects.toBeInstanceOf(DOMException);
    vi.doUnmock('../../../shared/utils/idbOpen');
    vi.doUnmock('./schemaDiffAck');
  });

  it('deleteSnapshot uses fallback Error when tx.error is null', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ txFails: true, nullErrors: true })),
    }));
    vi.doMock('./schemaDiffAck', () => ({
      deleteAcksForSnapshot: vi.fn().mockResolvedValue(undefined),
    }));
    const { deleteSnapshot: del } = await import('./schemaSnapshot');
    await expect(del('any-id')).rejects.toThrow('IndexedDB deleteSnapshot failed');
    vi.doUnmock('../../../shared/utils/idbOpen');
    vi.doUnmock('./schemaDiffAck');
  });

  it('relabelSnapshot rejects when IDB transaction fails (tx.onerror)', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ txFails: true })),
    }));
    const { relabelSnapshot: relabel } = await import('./schemaSnapshot');
    await expect(relabel('any-id', 'label')).rejects.toBeInstanceOf(DOMException);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('relabelSnapshot uses fallback Error when tx.error is null', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue(makeFakeDb({ txFails: true, nullErrors: true })),
    }));
    const { relabelSnapshot: relabel } = await import('./schemaSnapshot');
    await expect(relabel('any-id', 'label')).rejects.toThrow('IndexedDB relabelSnapshot failed');
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('deleteSnapshot: covers .catch() callback when deleteAcksForSnapshot throws', async () => {
    vi.resetModules();
    vi.doMock('./schemaDiffAck', () => ({
      deleteAcksForSnapshot: vi.fn().mockRejectedValue(new Error('ack-fail')),
    }));
    await import('fake-indexeddb/auto');
    const { saveSnapshot: save, deleteSnapshot: del, loadSnapshots: load } = await import('./schemaSnapshot');
    const snap = makeSnapshot();
    await save(snap);
    // deleteAcksForSnapshot will throw but .catch() swallows it
    await expect(del(snap.id)).resolves.not.toThrow();
    const after = await load(snap.connectionId);
    expect(after).toHaveLength(0);
    vi.doUnmock('./schemaDiffAck');
  });

  it('saveSnapshot eviction: covers .catch() callback when deleteAcksForSnapshot throws during eviction', async () => {
    vi.resetModules();
    vi.doMock('./schemaDiffAck', () => ({
      deleteAcksForSnapshot: vi.fn().mockRejectedValue(new Error('ack-fail')),
    }));
    await import('fake-indexeddb/auto');
    const { saveSnapshot: save, loadSnapshots: load } = await import('./schemaSnapshot');
    const conn = `catch-evict-${crypto.randomUUID()}`;
    // Save 20 snapshots to trigger eviction on the 21st
    for (let i = 1; i <= 20; i++) {
      await save(makeSnapshot({ connectionId: conn, capturedAt: i * 1000 }));
    }
    const extra = makeSnapshot({ connectionId: conn, capturedAt: 21000 });
    // deleteAcksForSnapshot throws during eviction, but .catch() swallows it; save still succeeds
    await expect(save(extra)).resolves.not.toThrow();
    const after = await load(conn);
    expect(after).toHaveLength(20);
    vi.doUnmock('./schemaDiffAck');
  }, 15000);
});
