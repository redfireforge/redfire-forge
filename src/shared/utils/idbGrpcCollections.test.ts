/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type StoreData = Map<string, unknown>;

const stores: Record<string, StoreData> = {
  'grpc-collections': new Map(),
  'grpc-collection-items': new Map(),
};

vi.mock('./idbHelpers', () => ({
  idbAvailable: () => true,
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
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
} from '../grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../grpc/grpcSavedRequest';
import {
  idbLoadGrpcCollectionsStore,
  idbSaveGrpcCollectionsStore,
  idbSyncGrpcCollectionsFromLocalStorage,
  resetGrpcCollectionsHealPromiseForTests,
} from './idbGrpcCollections';

const TS = '2026-06-29T12:00:00.000Z';

function makeSavedRequest(id = 'sr-1'): GrpcSavedRequest {
  const identity = createGrpcSavedRequestIdentity(id, TS);
  return {
    ...identity,
    name: 'echo.EchoService/Echo',
    callType: 'unary',
    service: 'echo.EchoService',
    method: 'Echo',
    descriptorKey: 'desc-1',
    body: {},
    metadata: {},
    timeoutMs: 30_000,
  };
}

beforeEach(() => {
  stores['grpc-collections'].clear();
  stores['grpc-collection-items'].clear();
  resetGrpcCollectionsHealPromiseForTests();
});

describe('idbGrpcCollections (Phase 5B)', () => {
  it('returns null when stores are empty', async () => {
    expect(await idbLoadGrpcCollectionsStore()).toBeNull();
  });

  it('round-trips collection metadata and saved requests', async () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    store.collections = [{
      id: 'col-1',
      name: 'Echo',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [makeSavedRequest()],
    }];

    await idbSaveGrpcCollectionsStore(store);
    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.schemaVersion).toBe(GRPC_PERSISTENCE_SCHEMA_VERSION);
    expect(loaded?.collections).toHaveLength(1);
    expect(loaded?.collections[0].savedRequests).toHaveLength(1);
    expect(loaded?.collections[0].savedRequests[0].service).toBe('echo.EchoService');
  });

  it('removes deleted collections and saved requests on save', async () => {
    const initial = createEmptyGrpcCollectionsStore(TS);
    initial.collections = [{
      id: 'col-1',
      name: 'Echo',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [makeSavedRequest('sr-1'), makeSavedRequest('sr-2')],
    }];
    await idbSaveGrpcCollectionsStore(initial);

    const trimmed = createEmptyGrpcCollectionsStore(TS);
    trimmed.collections = [{
      id: 'col-1',
      name: 'Echo',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [makeSavedRequest('sr-2')],
    }];
    await idbSaveGrpcCollectionsStore(trimmed);

    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections[0].savedRequests.map((saved) => saved.id)).toEqual(['sr-2']);
    expect(stores['grpc-collection-items'].has('sr-1')).toBe(false);
  });

  it('redacts secrets before write', async () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    store.collections = [{
      id: 'col-1',
      name: 'Secrets',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [{
        ...makeSavedRequest(),
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      }],
    }];
    await idbSaveGrpcCollectionsStore(store);
    const item = stores['grpc-collection-items'].get('sr-1') as { savedRequest: GrpcSavedRequest };
    expect(item.savedRequest.auth?.bearerToken).toBe('[REDACTED]');
  });

  it('rejects invalid collections store before write', async () => {
    await expect(idbSaveGrpcCollectionsStore({
      schemaVersion: 999,
      updatedAt: TS,
      collections: [],
    } as never)).rejects.toThrow(/invalid gRPC collections store/i);
  });

  it('ignores and purges orphan collection items on load', async () => {
    stores['grpc-collection-items'].set('sr-orphan', {
      id: 'sr-orphan',
      collectionId: 'missing-col',
      sortOrder: 0,
      savedRequest: makeSavedRequest('sr-orphan'),
    });

    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections).toEqual([]);
    expect(stores['grpc-collection-items'].has('sr-orphan')).toBe(false);
  });

  it('heals pre-5E leaky collection items on first IDB load', async () => {
    stores['grpc-collections'].set('col-leak', {
      id: 'col-leak',
      name: 'Legacy',
      createdAt: TS,
      updatedAt: TS,
    });
    stores['grpc-collection-items'].set('sr-leak', {
      id: 'sr-leak',
      collectionId: 'col-leak',
      sortOrder: 0,
      savedRequest: {
        ...makeSavedRequest('sr-leak'),
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      },
    });

    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections[0].savedRequests[0].auth?.bearerToken).toBe('[REDACTED]');
    const item = stores['grpc-collection-items'].get('sr-leak') as { savedRequest: GrpcSavedRequest };
    expect(item.savedRequest.auth?.bearerToken).toBe('[REDACTED]');
  });

  it('redacts secrets when syncing legacy localStorage envelope', async () => {
    const legacy = JSON.stringify([{
      id: 'col-ls',
      name: 'Legacy secrets',
      savedRequests: [{
        id: 'sr-leak',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: { authorization: 'Bearer raw-secret-token-value' },
        timeoutMs: 30_000,
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      }],
    }]);
    const synced = await idbSyncGrpcCollectionsFromLocalStorage(legacy);
    expect(synced).toBe(true);
    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections[0].savedRequests[0].auth?.bearerToken).toBe('[REDACTED]');
  });

  it('merges legacy localStorage into partial IDB without losing collections', async () => {
    const idbStore = createEmptyGrpcCollectionsStore(TS);
    idbStore.collections = [{
      id: 'col-idb',
      name: 'IDB',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [makeSavedRequest('sr-idb')],
    }];
    await idbSaveGrpcCollectionsStore(idbStore);

    const legacy = JSON.stringify([{
      id: 'col-ls',
      name: 'Legacy',
      savedRequests: [{
        ...makeSavedRequest('sr-ls'),
        id: 'sr-ls',
      }],
    }]);
    const synced = await idbSyncGrpcCollectionsFromLocalStorage(legacy);
    expect(synced).toBe(true);

    const loaded = await idbLoadGrpcCollectionsStore();
    expect(loaded?.collections.map((col) => col.id).sort()).toEqual(['col-idb', 'col-ls']);
  });
});
