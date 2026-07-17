/**
 * @vitest-environment jsdom
 * Coverage gaps — idbGrpcCallHistory.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../grpc/grpcPersistenceSchema';

type StoreData = Map<string, unknown>;
const stores: Record<string, StoreData> = { 'grpc-call-history': new Map() };

const idbAvailableMock = vi.fn(() => true);

vi.mock('./idbHelpers', () => ({
  idbAvailable: () => idbAvailableMock(),
  wrap: <T>(req: IDBRequest<T> | { _value: T }) => Promise.resolve((req as { _value: T })._value as T),
  txComplete: () => Promise.resolve(),
}));

vi.mock('./idbOpen', () => {
  const makeRequest = <T>(value: T) => ({ _value: value });
  const makeIndex = (storeName: string, indexField: string) => ({
    getAll: (range?: IDBKeyRange) => {
      const all = Array.from(stores[storeName]!.values()) as Record<string, unknown>[];
      const filtered = range
        ? all.filter((item) => item[indexField] === (range as unknown as { lower: unknown }).lower)
        : all;
      return makeRequest(filtered);
    },
  });
  const makeObjectStore = (storeName: string) => ({
    getAll: () => makeRequest(Array.from(stores[storeName]!.values())),
    getAllKeys: () => makeRequest(Array.from(stores[storeName]!.keys())),
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
  return {
    openDB: vi.fn().mockResolvedValue({
      transaction: (storeNames: string | string[]) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        return {
          objectStore: (name: string) => {
            if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
            return makeObjectStore(name);
          },
        };
      },
    }),
  };
});

import {
  GRPC_CALL_HISTORY_STORAGE_KEY,
  idbAppendGrpcCallHistoryEntry,
  idbClearGrpcCallHistory,
  idbDeleteGrpcCallHistoryEntries,
  idbDeleteGrpcCallHistoryEntry,
  idbLoadGrpcCallHistoryByService,
  idbLoadGrpcCallHistoryEntries,
  idbMigrateGrpcCallHistoryFromLocalStorage,
  idbReplaceGrpcCallHistoryEntries,
  idbSyncGrpcCallHistoryFromLocalStorage,
  resetGrpcCallHistoryAppendQueueForTests,
  resetGrpcCallHistoryHealPromiseForTests,
} from './idbGrpcCallHistory';

const TS = '2026-06-29T12:00:00.000Z';

function makeEntry(id: string, capturedAt = TS, service = 'echo.EchoService') {
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
      body: {},
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
  idbAvailableMock.mockReturnValue(true);
  (globalThis as { IDBKeyRange?: typeof IDBKeyRange }).IDBKeyRange = {
    only: (value: unknown) => ({ lower: value, upper: value }),
  } as unknown as typeof IDBKeyRange;
});

describe('idbGrpcCallHistory coverage gaps', () => {
  it('returns empty arrays when idb is unavailable', async () => {
    idbAvailableMock.mockReturnValue(false);
    expect(await idbLoadGrpcCallHistoryEntries()).toEqual([]);
    expect(await idbLoadGrpcCallHistoryByService('echo.EchoService')).toEqual([]);
    await idbClearGrpcCallHistory();
    await idbDeleteGrpcCallHistoryEntries(['x']);
    await idbReplaceGrpcCallHistoryEntries([makeEntry('x')]);
    expect(await idbSyncGrpcCallHistoryFromLocalStorage('{}')).toBe(false);
  });

  it('idbLoadGrpcCallHistoryByService falls back to filter when IDBKeyRange is undefined', async () => {
    delete (globalThis as { IDBKeyRange?: typeof IDBKeyRange }).IDBKeyRange;
    stores['grpc-call-history'].set('h-a', makeEntry('h-a', TS, 'alpha.Service'));
    stores['grpc-call-history'].set('h-b', makeEntry('h-b', TS, 'beta.Service'));
    const loaded = await idbLoadGrpcCallHistoryByService('alpha.Service');
    expect(loaded.map((entry) => entry.id)).toEqual(['h-a']);
  });

  it('idbSyncGrpcCallHistoryFromLocalStorage returns false for empty legacy envelope', async () => {
    const envelope = { schemaVersion: 1, updatedAt: TS, entries: [] };
    expect(await idbSyncGrpcCallHistoryFromLocalStorage(JSON.stringify(envelope))).toBe(false);
  });

  it('idbSyncGrpcCallHistoryFromLocalStorage returns false on invalid JSON', async () => {
    expect(await idbSyncGrpcCallHistoryFromLocalStorage('not-json')).toBe(false);
  });

  it('idbClearGrpcCallHistory is a no-op when store is empty', async () => {
    await idbClearGrpcCallHistory();
    expect(stores['grpc-call-history'].size).toBe(0);
  });

  it('idbDeleteGrpcCallHistoryEntries skips work for empty id list', async () => {
    stores['grpc-call-history'].set('h-1', makeEntry('h-1'));
    await idbDeleteGrpcCallHistoryEntries([]);
    expect(stores['grpc-call-history'].has('h-1')).toBe(true);
  });

  it('idbMigrateGrpcCallHistoryFromLocalStorage delegates to sync helper', async () => {
    const entry = makeEntry('h-migrate');
    const envelope = { schemaVersion: 1, updatedAt: TS, entries: [entry] };
    const migrated = await idbMigrateGrpcCallHistoryFromLocalStorage(JSON.stringify(envelope));
    expect(migrated).toBe(true);
    expect(await idbLoadGrpcCallHistoryEntries()).toHaveLength(1);
  });

  it('propagates append queue failures to callers', async () => {
    const { openDB } = await import('./idbOpen');
    vi.mocked(openDB).mockRejectedValueOnce(new Error('db unavailable'));
    await expect(idbAppendGrpcCallHistoryEntry(makeEntry('h-fail'))).rejects.toThrow('db unavailable');
  });

  it('idbDeleteGrpcCallHistoryEntry is a no-op when idb is unavailable', async () => {
    idbAvailableMock.mockReturnValue(false);
    await idbDeleteGrpcCallHistoryEntry('h-1');
  });

  it('idbDeleteGrpcCallHistoryEntries removes multiple rows', async () => {
    stores['grpc-call-history'].set('h-1', makeEntry('h-1'));
    stores['grpc-call-history'].set('h-2', makeEntry('h-2'));
    await idbDeleteGrpcCallHistoryEntries(['h-1', 'h-2']);
    expect(stores['grpc-call-history'].size).toBe(0);
  });

  it('idbSyncGrpcCallHistoryFromLocalStorage returns false when migration throws', async () => {
    const migration = await import('../grpc/grpcPersistenceMigration');
    const spy = vi.spyOn(migration, 'migrateGrpcCallHistoryStore').mockImplementation(() => {
      throw new Error('bad envelope');
    });
    expect(await idbSyncGrpcCallHistoryFromLocalStorage('{}')).toBe(false);
    spy.mockRestore();
  });

  it('idbReplaceGrpcCallHistoryEntries removes stale ids not in replacement set', async () => {
    stores['grpc-call-history'].set('h-old', makeEntry('h-old'));
    stores['grpc-call-history'].set('h-keep', makeEntry('h-keep'));
    await idbReplaceGrpcCallHistoryEntries([makeEntry('h-keep')]);
    expect(stores['grpc-call-history'].has('h-old')).toBe(false);
    expect(stores['grpc-call-history'].has('h-keep')).toBe(true);
  });

  it('sortNewestFirst breaks capturedAt ties by id', async () => {
    const tieTs = '2026-06-29T12:00:00.000Z';
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-b', tieTs));
    await idbAppendGrpcCallHistoryEntry(makeEntry('h-a', tieTs));
    const loaded = await idbLoadGrpcCallHistoryEntries();
    expect(loaded.map((entry) => entry.id)).toEqual(['h-b', 'h-a']);
  });

  it('exports GRPC_CALL_HISTORY_STORAGE_KEY constant', () => {
    expect(GRPC_CALL_HISTORY_STORAGE_KEY).toBeTruthy();
  });
});
