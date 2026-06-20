/**
 * schemaDiffAck.test.ts — Phase 3D (task 3D-10)
 *
 * Tests the IDB CRUD functions in schemaDiffAck.ts using fake-indexeddb.
 *
 * Covers:
 *  - addAck creates an ack with correct composite key
 *  - getAcks retrieves only acks matching connectionId + snapshotId
 *  - deleteAck removes a single ack by id
 *  - deleteAcksForSnapshot batch-removes all acks for a snapshot
 *  - ackId produces a stable composite key
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let addAck: typeof import('./schemaDiffAck').addAck;
let getAcks: typeof import('./schemaDiffAck').getAcks;
let deleteAck: typeof import('./schemaDiffAck').deleteAck;
let deleteAcksForSnapshot: typeof import('./schemaDiffAck').deleteAcksForSnapshot;
let ackId: typeof import('./schemaDiffAck').ackId;

beforeEach(async () => {
  vi.resetModules();
  await import('fake-indexeddb/auto');

  const mod = await import('./schemaDiffAck');
  addAck               = mod.addAck;
  getAcks              = mod.getAcks;
  deleteAck            = mod.deleteAck;
  deleteAcksForSnapshot = mod.deleteAcksForSnapshot;
  ackId                = mod.ackId;
});

// ─── ackId ────────────────────────────────────────────────────────────────────

describe('ackId', () => {
  it('produces a stable composite key with __ separators', () => {
    const id = ackId('http://localhost/gql', 'snap-1', 'User.name');
    expect(id).toBe('http://localhost/gql__snap-1__User.name');
  });
});

// ─── addAck + getAcks ─────────────────────────────────────────────────────────

describe('addAck + getAcks', () => {
  it('stores an ack and retrieves it by connectionId + snapshotId', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    const ack = await addAck(conn, snapId, 'User.name', 'intentional refactor');

    expect(ack.id).toBe(ackId(conn, snapId, 'User.name'));
    expect(ack.connectionId).toBe(conn);
    expect(ack.snapshotId).toBe(snapId);
    expect(ack.changePath).toBe('User.name');
    expect(ack.note).toBe('intentional refactor');
    expect(typeof ack.acknowledgedAt).toBe('number');

    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].changePath).toBe('User.name');
  });

  it('getAcks returns empty array for unknown snapshotId', async () => {
    const conn = `conn-${crypto.randomUUID()}`;
    const loaded = await getAcks(conn, 'non-existent-snap');
    expect(loaded).toHaveLength(0);
  });

  it('addAck overwrites an existing ack with the same composite key (upsert)', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    await addAck(conn, snapId, 'User.name', 'first note');
    await addAck(conn, snapId, 'User.name', 'updated note');

    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].note).toBe('updated note');
  });

  it('stores multiple acks for the same snapshot', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    await addAck(conn, snapId, 'User.name', 'note A');
    await addAck(conn, snapId, 'Order.total', 'note B');

    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(2);
    const paths = loaded.map((a) => a.changePath).sort();
    expect(paths).toEqual(['Order.total', 'User.name']);
  });

  it('isolates acks by snapshotId', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapA  = `snap-A-${crypto.randomUUID()}`;
    const snapB  = `snap-B-${crypto.randomUUID()}`;
    await addAck(conn, snapA, 'User.name', 'ack for A');
    await addAck(conn, snapB, 'Order.total', 'ack for B');

    const acksA = await getAcks(conn, snapA);
    const acksB = await getAcks(conn, snapB);
    expect(acksA).toHaveLength(1);
    expect(acksA[0].changePath).toBe('User.name');
    expect(acksB).toHaveLength(1);
    expect(acksB[0].changePath).toBe('Order.total');
  });

  it('isolates acks by connectionId (belt-and-suspenders filter)', async () => {
    const connA  = `conn-A-${crypto.randomUUID()}`;
    const connB  = `conn-B-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    await addAck(connA, snapId, 'User.name', 'ack for conn-A');
    await addAck(connB, snapId, 'User.name', 'ack for conn-B');

    const acksA = await getAcks(connA, snapId);
    const acksB = await getAcks(connB, snapId);
    expect(acksA).toHaveLength(1);
    expect(acksA[0].connectionId).toBe(connA);
    expect(acksB).toHaveLength(1);
    expect(acksB[0].connectionId).toBe(connB);
  });
});

// ─── deleteAck ────────────────────────────────────────────────────────────────

describe('deleteAck', () => {
  it('removes a single ack by id', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    const ack = await addAck(conn, snapId, 'User.name', 'to delete');
    await deleteAck(ack.id);

    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(0);
  });

  it('leaves other acks intact when only one is deleted', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    const ackA = await addAck(conn, snapId, 'User.name', 'keep');
    const ackB = await addAck(conn, snapId, 'Order.total', 'delete this');
    await deleteAck(ackB.id);

    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(ackA.id);
  });

  it('is a no-op for non-existent id', async () => {
    await expect(deleteAck('does-not-exist')).resolves.not.toThrow();
  });
});

// ─── deleteAcksForSnapshot ───────────────────────────────────────────────────

describe('deleteAcksForSnapshot', () => {
  it('removes all acks for a snapshot', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapId = `snap-${crypto.randomUUID()}`;
    await addAck(conn, snapId, 'User.name', 'ack 1');
    await addAck(conn, snapId, 'Order.total', 'ack 2');
    await addAck(conn, snapId, 'Query.users', 'ack 3');

    await deleteAcksForSnapshot(snapId);
    const loaded = await getAcks(conn, snapId);
    expect(loaded).toHaveLength(0);
  });

  it('does not affect acks for other snapshots', async () => {
    const conn   = `conn-${crypto.randomUUID()}`;
    const snapA  = `snap-A-${crypto.randomUUID()}`;
    const snapB  = `snap-B-${crypto.randomUUID()}`;
    await addAck(conn, snapA, 'User.name', 'delete this');
    await addAck(conn, snapB, 'Order.total', 'keep this');

    await deleteAcksForSnapshot(snapA);
    const acksA = await getAcks(conn, snapA);
    const acksB = await getAcks(conn, snapB);
    expect(acksA).toHaveLength(0);
    expect(acksB).toHaveLength(1);
  });

  it('is a no-op for snapshot with no acks', async () => {
    await expect(deleteAcksForSnapshot('no-acks-snap')).resolves.not.toThrow();
  });
});

// ─── Error path coverage ─────────────────────────────────────────────────────
// These tests exercise the onerror / tx.onerror callbacks by mocking openDB.

/** Helper to build a fake IDB request that fires onerror after setup */
function makeErrorReq(fakeError: DOMException) {
  const req = { result: null as unknown, error: fakeError, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
  setTimeout(() => req.onerror?.(), 0);
  return req;
}

/** Helper to build an index stub whose getAll fires onerror */
function makeErrorIndex(fakeError: DOMException) {
  return { getAll: () => makeErrorReq(fakeError) };
}

/** Helper to build an index stub whose getAll fires onsuccess with given rows */
function makeSuccessIndex(rows: unknown[]) {
  const req = { result: rows, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
  setTimeout(() => req.onsuccess?.(), 0);
  return { getAll: () => req };
}

describe('getAcks — null result branch (line 41)', () => {
  it('returns [] when req.result is null (null-coalescing branch)', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const req = { result: null as unknown, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
          setTimeout(() => req.onsuccess?.(), 0);
          return { objectStore: () => ({ index: () => ({ getAll: () => req }) }) };
        },
      }),
    }));
    const { getAcks: getAcksNull } = await import('./schemaDiffAck');
    const result = await getAcksNull('conn', 'snap');
    expect(result).toEqual([]);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});

describe('getAcks — error path', () => {
  it('rejects when the IDB index request fires onerror', async () => {
    vi.resetModules();
    const fakeError = new DOMException('read error');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => ({
          objectStore: () => ({ index: () => makeErrorIndex(fakeError) }),
        }),
      }),
    }));
    const { getAcks: getAcksErr } = await import('./schemaDiffAck');
    await expect(getAcksErr('c', 's')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});

describe('addAck — error path', () => {
  it('rejects when the write transaction fires onerror', async () => {
    vi.resetModules();
    const fakeError = new DOMException('write error');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const tx = { objectStore: () => ({ put: vi.fn() }), error: fakeError, oncomplete: null as null | (() => void), onerror: null as null | (() => void) };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { addAck: addAckErr } = await import('./schemaDiffAck');
    await expect(addAckErr('c', 's', 'path', 'note')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});

describe('deleteAck — error path', () => {
  it('rejects when the delete transaction fires onerror', async () => {
    vi.resetModules();
    const fakeError = new DOMException('delete error');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const tx = { objectStore: () => ({ delete: vi.fn() }), error: fakeError, oncomplete: null as null | (() => void), onerror: null as null | (() => void) };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { deleteAck: deleteAckErr } = await import('./schemaDiffAck');
    await expect(deleteAckErr('bad-id')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});

describe('deleteAcksForSnapshot — error paths', () => {
  it('rejects when the read phase fires onerror', async () => {
    vi.resetModules();
    const fakeError = new DOMException('batch read error');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => ({
          objectStore: () => ({ index: () => makeErrorIndex(fakeError) }),
        }),
      }),
    }));
    const { deleteAcksForSnapshot: deleteSnap } = await import('./schemaDiffAck');
    await expect(deleteSnap('bad-snap')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('rejects when the write phase fires onerror (has acks to delete)', async () => {
    vi.resetModules();
    const fakeError = new DOMException('batch write error');
    const fakeAck = { id: 'ack-1', connectionId: 'c', snapshotId: 's', changePath: 'p', note: '', acknowledgedAt: 0 };
    let callCount = 0;
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          callCount += 1;
          if (callCount === 1) {
            // Read phase: return one ack to trigger the write phase
            return { objectStore: () => ({ index: () => makeSuccessIndex([fakeAck]) }) };
          }
          // Write phase: fire onerror
          const tx = { objectStore: () => ({ delete: vi.fn() }), error: fakeError, oncomplete: null as null | (() => void), onerror: null as null | (() => void) };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { deleteAcksForSnapshot: deleteSnap } = await import('./schemaDiffAck');
    await expect(deleteSnap('some-snap')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('covers the null-result branch (req.result ?? [])', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const req = { result: null as unknown, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
          setTimeout(() => req.onsuccess?.(), 0);
          return { objectStore: () => ({ index: () => ({ getAll: () => req }) }) };
        },
      }),
    }));
    const { deleteAcksForSnapshot: deleteSnap } = await import('./schemaDiffAck');
    // null result is coalesced to [] so this should resolve without deleting anything
    await expect(deleteSnap('snap-with-null')).resolves.not.toThrow();
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});
