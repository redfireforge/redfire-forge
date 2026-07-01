/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
const stores: Record<string, StoreData> = {
  'grpc-collections': new Map(),
  'grpc-collection-items': new Map(),
};

vi.mock('./idbHelpers', () => ({
  idbAvailable: vi.fn(() => true),
  wrap: <T>(req: IDBRequest<T> | { _value: T }) => Promise.resolve((req as { _value: T })._value as T),
  txComplete: () => Promise.resolve(),
}));

vi.mock('./idbOpen', () => {
  const makeRequest = <T>(value: T) => ({ _value: value });
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
  idbLoadGrpcCollectionsStore,
  idbMigrateGrpcCollectionsFromLocalStorage,
  idbSaveGrpcCollectionsStore,
  resetGrpcCollectionsHealPromiseForTests,
} from './idbGrpcCollections';
import {
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
} from '../grpc/grpcPersistenceSchema';
import { idbAvailable } from './idbHelpers';

beforeEach(() => {
  stores['grpc-collections'].clear();
  stores['grpc-collection-items'].clear();
  resetGrpcCollectionsHealPromiseForTests();
});

describe('idbGrpcCollections coverage gaps', () => {
  it('migrates legacy localStorage envelope when IDB is empty', async () => {
    const raw = JSON.stringify([{
      id: 'col-legacy',
      name: 'Legacy',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
      }],
    }]);
    const migrated = await idbMigrateGrpcCollectionsFromLocalStorage(raw);
    expect(migrated).toBe(true);
    expect(stores['grpc-collections'].size).toBeGreaterThan(0);
  });

  it('returns false when localStorage payload is empty', async () => {
    expect(await idbMigrateGrpcCollectionsFromLocalStorage('[]')).toBe(false);
  });

  it('merge prefers IDB saved-request values when collection ids collide', async () => {
    const TS = '2026-06-29T12:00:00.000Z';
    const idbStore = createEmptyGrpcCollectionsStore(TS);
    idbStore.collections = [{
      id: 'col-shared',
      name: 'IDB name',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [{
        ...createGrpcSavedRequestIdentity('sr-shared', TS),
        name: 'idb-version',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
      }],
    }];
    await idbSaveGrpcCollectionsStore(idbStore);

    const legacy = JSON.stringify([{
      id: 'col-shared',
      name: 'Legacy name',
      savedRequests: [{
        id: 'sr-shared',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        name: 'legacy-version',
      }],
    }]);
    expect(await idbMigrateGrpcCollectionsFromLocalStorage(legacy)).toBe(true);
    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections[0].name).toBe('IDB name');
    expect(loaded?.collections[0].savedRequests[0].name).toBe('idb-version');
  });

  it('merge combines saved requests from both stores for the same collection', async () => {
    const TS = '2026-06-29T12:00:00.000Z';
    const idbStore = createEmptyGrpcCollectionsStore(TS);
    idbStore.collections = [{
      id: 'col-shared',
      name: 'Shared',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [{
        ...createGrpcSavedRequestIdentity('sr-idb-only', TS),
        name: 'idb-only',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
      }],
    }];
    await idbSaveGrpcCollectionsStore(idbStore);

    const legacy = JSON.stringify([{
      id: 'col-shared',
      name: 'Shared',
      savedRequests: [{
        id: 'sr-ls-only',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        name: 'ls-only',
      }],
    }]);
    expect(await idbMigrateGrpcCollectionsFromLocalStorage(legacy)).toBe(true);
    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections[0].savedRequests.map((saved) => saved.id).sort()).toEqual([
      'sr-idb-only',
      'sr-ls-only',
    ]);
  });

  it('returns false when sync throws on invalid payload', async () => {
    expect(await idbMigrateGrpcCollectionsFromLocalStorage('not-json')).toBe(false);
  });

  it('short-circuits when IndexedDB is unavailable', async () => {
    vi.mocked(idbAvailable).mockReturnValue(false);
    expect(await idbLoadGrpcCollectionsStore()).toBeNull();
    expect(await idbMigrateGrpcCollectionsFromLocalStorage('[]')).toBe(false);
    await expect(idbSaveGrpcCollectionsStore(createEmptyGrpcCollectionsStore('2026-06-29T00:00:00.000Z')))
      .rejects.toThrow(/IndexedDB not available/i);
    vi.mocked(idbAvailable).mockReturnValue(true);
  });

  it('skips heal pass after the first successful load', async () => {
    const TS = '2026-06-29T12:00:00.000Z';
    const store = createEmptyGrpcCollectionsStore(TS);
    store.collections = [{
      id: 'col-heal-once',
      name: 'Once',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [],
    }];
    await idbSaveGrpcCollectionsStore(store);
    expect(await idbLoadGrpcCollectionsStore()).not.toBeNull();
    expect(await idbLoadGrpcCollectionsStore()).not.toBeNull();
  });
});
