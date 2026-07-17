/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist, type GrpcCallHistoryEntryV1 } from '../grpc/grpcPersistenceSchema';
import { GRPC_CALL_HISTORY_MAX_ENTRIES } from '../grpc/grpcPersistenceSchema';

type StoreData = Map<string, unknown>;

const stores: Record<string, StoreData> = {
  'grpc-call-history': new Map(),
};

vi.mock('./idbHelpers', () => ({
  idbAvailable: () => true,
  wrap: <T>(req: IDBRequest<T> | { _value: T }) => Promise.resolve((req as { _value: T })._value as T),
  txComplete: () => Promise.resolve(),
}));

vi.mock('./idbOpen', () => {
  const makeRequest = <T>(value: T) => ({ _value: value });

  const makeIndex = (storeName: string, indexField: string) => ({
    getAll: (range?: IDBKeyRange) => {
      const store = stores[storeName]!;
      const all = Array.from(store.values()) as Record<string, unknown>[];
      const filtered = range
        ? all.filter((item) => item[indexField] === (range as unknown as { lower: unknown }).lower)
        : all;
      return makeRequest(filtered);
    },
  });

  const makeObjectStore = (storeName: string) => ({
    getAll: () => makeRequest(Array.from((stores[storeName] ?? new Map()).values())),
    getAllKeys: () => makeRequest(Array.from((stores[storeName] ?? new Map()).keys())),
    put: (value: unknown) => {
      const id = (value as Record<string, unknown>).id as string;
      stores[storeName]?.set(id, value);
      return makeRequest(id);
    },
    delete: (key: string) => {
      stores[storeName]?.delete(key);
      return makeRequest(undefined);
    },
    index: (indexField: string) => makeIndex(storeName, indexField),
  });

  const mockDB = {
    transaction: (storeNames: string | string[]) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore: (name: string) => {
          if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
          return makeObjectStore(name);
        },
      };
    },
  };

  return { openDB: vi.fn().mockResolvedValue(mockDB) };
});

import {
  idbAppendGrpcCallHistoryEntry,
  idbClearGrpcCallHistory,
  idbLoadGrpcCallHistoryEntries,
  idbReplaceGrpcCallHistoryEntries,
  idbSyncGrpcCallHistoryFromLocalStorage,
  resetGrpcCallHistoryAppendQueueForTests,
  resetGrpcCallHistoryHealPromiseForTests,
} from './idbGrpcCallHistory';

const TS = '2026-06-29T12:00:00.000Z';

function makeEntry(id: string, capturedAt: string, service = 'echo.EchoService') {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: id },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    },
  });
}

beforeEach(() => {
  stores['grpc-call-history'].clear();
  resetGrpcCallHistoryAppendQueueForTests();
  resetGrpcCallHistoryHealPromiseForTests();
});

describe('idbGrpcCallHistory (Phase 5D)', () => {
  it('appends and loads entries newest-first', async () => {
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-1', '2026-06-29T10:00:00.000Z'));
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-2', '2026-06-29T11:00:00.000Z'));
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded.map((entry) => entry.id)).toEqual(['h-2', 'h-1']);
  });

  it('evicts oldest entries when max cap is exceeded', async () => {
    for (let i = 0; i < GRPC_CALL_HISTORY_MAX_ENTRIES + 3; i += 1) {
      const ts = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
      await idbAppendGrpcCallHistoryEntry(makeEntry(`h-${i}`, ts));
    }
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded).toHaveLength(GRPC_CALL_HISTORY_MAX_ENTRIES);
    expect(loaded.some((entry) => entry.id === 'h-0')).toBe(false);
    expect(loaded.some((entry) => entry.id === 'h-1')).toBe(false);
    expect(loaded.some((entry) => entry.id === 'h-2')).toBe(false);
  });

  it('loads by service index', async () => {
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-a', TS, 'alpha.Service'));
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-b', TS, 'beta.Service'));
    const all = await idbLoadGrpcCallHistoryEntries();
    const alpha = all.filter((entry) => entry.service === 'alpha.Service');
    expect(alpha).toHaveLength(1);
    expect(alpha[0].id).toBe('h-a');
  });

  it('clears all entries', async () => {
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-1', TS));
    await idbClearGrpcCallHistory();
    expect(await idbLoadGrpcCallHistoryEntries()).toEqual([]);
  });

  it('truncates oversized body snapshots on append', async () => {
    const largeBody = { payload: 'x'.repeat(70_000) };
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-large',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-large',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: largeBody,
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });
    await idbAppendGrpcCallHistoryEntry(entry);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded[0].bodyTruncated).toBe(true);
  });

  it('migrates legacy localStorage envelope into IDB when empty', async () => {
    const entry = makeEntry('h-1', TS);
    const envelope = {
      schemaVersion: 1,
      updatedAt: TS,
      entries: [entry],
    };
    const migrated = await idbSyncGrpcCallHistoryFromLocalStorage(JSON.stringify(envelope));
    expect(migrated).toBe(true);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('h-1');
  });

  it('merges legacy localStorage rows into partial IDB without losing entries', async () => {
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-idb', '2026-06-29T11:00:00.000Z'));
    const lsOnly = makeEntry('h-ls', '2026-06-29T10:00:00.000Z');
    const envelope = {
      schemaVersion: 1,
      updatedAt: TS,
      entries: [lsOnly],
    };
    const synced = await idbSyncGrpcCallHistoryFromLocalStorage(JSON.stringify(envelope));
    expect(synced).toBe(true);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded.map((entry) => entry.id).sort()).toEqual(['h-idb', 'h-ls']);
  });

  it('idbReplaceGrpcCallHistoryEntries replaces rows atomically', async () => {
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-old', TS));
    await idbReplaceGrpcCallHistoryEntries([makeEntry('h-new', '2026-06-29T12:00:00.000Z')]);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded.map((entry) => entry.id)).toEqual(['h-new']);
  });

  it('redacts raw secrets when syncing legacy localStorage envelope', async () => {
    const envelope = {
      schemaVersion: 1,
      updatedAt: TS,
      entries: [{
        id: 'h-leak',
        callType: 'unary',
        target: 'localhost:50051',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        capturedAt: TS,
        bodyTruncated: false,
        record: {
          capturedAt: TS,
          snapshot: {
            tabId: 'tab-1',
            requestId: 'req-leak',
            capturedAt: TS,
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: {},
            metadata: { authorization: 'Bearer raw-secret-token-value' },
            timeoutMs: 30_000,
            descriptorKey: 'desc-1',
            auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
          },
        },
      }],
    };
    const synced = await idbSyncGrpcCallHistoryFromLocalStorage(JSON.stringify(envelope));
    expect(synced).toBe(true);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded[0].record.snapshot.auth?.bearerToken).toBe('[REDACTED]');
  });

  it('preserves bodyTruncated when re-sanitizing an already-capped entry', async () => {
    const largeBody = { payload: 'x'.repeat(70_000) };
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-trunc',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-trunc',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: largeBody,
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });
    expect(entry.bodyTruncated).toBe(true);
    await idbAppendGrpcCallHistoryEntry(entry);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded[0].bodyTruncated).toBe(true);
  });

  it('heals pre-5E leaky rows on first IDB load', async () => {
    stores['grpc-call-history'].set('h-leak', {
      id: 'h-leak',
      callType: 'unary',
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-1',
      capturedAt: TS,
      bodyTruncated: false,
      record: {
        capturedAt: TS,
        snapshot: {
          tabId: 'tab-1',
          requestId: 'req-leak',
          capturedAt: TS,
          callType: 'unary',
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: {},
          metadata: { authorization: 'Bearer raw-secret-token-value' },
          timeoutMs: 30_000,
          descriptorKey: 'desc-1',
          auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
        },
      },
    });

    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded[0].record.snapshot.auth?.bearerToken).toBe('[REDACTED]');
    const stored = stores['grpc-call-history'].get('h-leak') as GrpcCallHistoryEntryV1;
    expect(stored.record.snapshot.auth?.bearerToken).toBe('[REDACTED]');
  });

  it('sanitizes legacy entries on append instead of persisting raw secrets', async () => {
    const legacyEntry = {
      id: 'h-legacy',
      callType: 'unary' as const,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-1',
      capturedAt: TS,
      bodyTruncated: false,
      record: {
        capturedAt: TS,
        snapshot: {
          tabId: 'tab-1',
          requestId: 'req-legacy',
          capturedAt: TS,
          callType: 'unary' as const,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: {},
          metadata: { authorization: 'Bearer raw-secret-token-value' },
          timeoutMs: 30_000,
          descriptorKey: 'desc-1',
          auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
        },
      },
    };
    await idbAppendGrpcCallHistoryEntry(legacyEntry);
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded[0].record.snapshot.auth?.bearerToken).toBe('[REDACTED]');
  });
});
