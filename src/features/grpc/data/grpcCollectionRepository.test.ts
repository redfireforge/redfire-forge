/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyGrpcCollectionsStore } from '../../../shared/grpc/grpcPersistenceSchema';
import { makeGrpcSavedRequest, GRPC_TEST_TIMESTAMP as TS } from '../../../test-utils/grpcFactories';

const saveMock = vi.fn().mockResolvedValue(undefined);
const loadMock = vi.fn();

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => false,
}));

vi.mock('../../../shared/utils/idbGrpcCollections', () => ({
  GRPC_COLLECTIONS_STORAGE_KEY: 'grpc_collections_v1',
  idbLoadGrpcCollectionsStore: (...args: unknown[]) => loadMock(...args),
  idbSaveGrpcCollectionsStore: (...args: unknown[]) => saveMock(...args),
  idbSyncGrpcCollectionsFromLocalStorage: (...args: unknown[]) => syncMock(...args),
}));

const syncMock = vi.fn().mockResolvedValue(false);

vi.mock('../../../shared/utils/idbHelpers', () => ({
  idbAvailable: () => true,
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import {
  addGrpcSavedRequestToStore,
  createGrpcCollectionInStore,
  deleteGrpcCollectionFromStore,
  deleteGrpcSavedRequestFromStore,
  duplicateGrpcCollectionInStore,
  duplicateGrpcSavedRequestInStore,
  enqueueGrpcCollectionsPersist,
  loadGrpcCollectionsStoreFromPersistence,
  resetGrpcCollectionsPersistQueueForTests,
  runGrpcCollectionMutation,
  updateGrpcCollectionInStore,
  updateGrpcSavedRequestInStore,
} from './grpcCollectionRepository';
import { readKey } from '../../../shared/utils/storage';

beforeEach(() => {
  saveMock.mockClear();
  loadMock.mockReset();
  loadMock.mockResolvedValue(null);
  syncMock.mockReset();
  syncMock.mockResolvedValue(false);
  resetGrpcCollectionsPersistQueueForTests();
});

describe('grpcCollectionRepository (Phase 5B)', () => {
  it('loads empty store when persistence is empty', async () => {
    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(store.collections).toEqual([]);
  });

  it('syncs legacy localStorage when IDB has no collections', async () => {
    const migratedStore = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Legacy' }, TS);
    const envelope = JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      collections: migratedStore.collections,
    });
    vi.mocked(readKey).mockResolvedValue(envelope);
    syncMock.mockResolvedValueOnce(true);
    loadMock.mockResolvedValueOnce(migratedStore);

    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(store.collections).toHaveLength(1);
    expect(store.collections[0].name).toBe('Legacy');
  });

  it('creates, updates, and deletes collections immutably', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'Echo' }, TS);
    expect(store.collections).toHaveLength(1);

    const collectionId = store.collections[0].id;
    store = updateGrpcCollectionInStore(store, collectionId, { name: 'Echo Updated' }, TS);
    expect(store.collections[0].name).toBe('Echo Updated');

    store = deleteGrpcCollectionFromStore(store, collectionId, TS);
    expect(store.collections).toHaveLength(0);
  });

  it('rejects empty collection names on create', () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    expect(() => createGrpcCollectionInStore(store, { name: '   ' }, TS)).toThrow(/name is required/i);
  });

  it('rejects empty collection names on update', () => {
    const store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    expect(() => updateGrpcCollectionInStore(store, collectionId, { name: '  ' }, TS)).toThrow(/name is required/i);
  });

  it('manages saved requests with revision bump on update', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    store = addGrpcSavedRequestToStore(store, collectionId, makeGrpcSavedRequest(), TS);

    const savedId = store.collections[0].savedRequests[0].id;
    const priorRevision = store.collections[0].savedRequests[0].revisionId;
    store = updateGrpcSavedRequestInStore(store, collectionId, savedId, { name: 'Renamed' }, TS);
    const updated = store.collections[0].savedRequests[0];
    expect(updated.name).toBe('Renamed');
    expect(updated.revisionId).not.toBe(priorRevision);
    expect(updated.createdAt).toBe(TS);

    store = deleteGrpcSavedRequestFromStore(store, collectionId, savedId, TS);
    expect(store.collections[0].savedRequests).toHaveLength(0);
  });

  it('removes responseBaseline when cleared with undefined patch', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    store = addGrpcSavedRequestToStore(
      store,
      collectionId,
      {
        ...makeGrpcSavedRequest(),
        responseBaseline: {
          capturedAt: TS,
          grpcStatus: 0,
          body: { message: 'hello' },
        },
      },
      TS,
    );
    const savedId = store.collections[0].savedRequests[0].id;
    expect(store.collections[0].savedRequests[0].responseBaseline).toBeDefined();

    store = updateGrpcSavedRequestInStore(store, collectionId, savedId, { responseBaseline: undefined }, TS);
    expect(store.collections[0].savedRequests[0].responseBaseline).toBeUndefined();
    expect('responseBaseline' in store.collections[0].savedRequests[0]).toBe(false);
  });

  it('duplicates collections and saved requests with new ids', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    store = addGrpcSavedRequestToStore(store, collectionId, makeGrpcSavedRequest('sr-1'), TS);

    store = duplicateGrpcSavedRequestInStore(store, collectionId, 'sr-1', TS);
    expect(store.collections[0].savedRequests).toHaveLength(2);
    expect(store.collections[0].savedRequests[1].id).not.toBe('sr-1');

    store = duplicateGrpcCollectionInStore(store, collectionId, TS);
    expect(store.collections).toHaveLength(2);
    expect(store.collections[1].savedRequests[0].id).not.toBe('sr-1');
  });

  it('serializes concurrent persist operations', async () => {
    const order: number[] = [];
    saveMock.mockImplementation(async () => {
      order.push(Date.now());
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    });

    const store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'One' }, TS);
    const p1 = enqueueGrpcCollectionsPersist(store);
    const p2 = enqueueGrpcCollectionsPersist(store);
    await Promise.all([p1, p2]);
    expect(saveMock).toHaveBeenCalledTimes(2);
  });

  it('runGrpcCollectionMutation persists mutated store', async () => {
    loadMock.mockResolvedValue(createEmptyGrpcCollectionsStore(TS));
    const { store, result } = await runGrpcCollectionMutation((base) => {
      const next = createGrpcCollectionInStore(base, { name: 'Persisted' }, TS);
      return { store: next, result: next.collections[0].id };
    });

    expect(result).toBeTruthy();
    expect(store.collections).toHaveLength(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('enqueueGrpcCollectionsPersist redacts secrets at the persist boundary', async () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'Secrets' }, TS);
    const collectionId = store.collections[0].id;
    store = addGrpcSavedRequestToStore(store, collectionId, {
      ...makeGrpcSavedRequest(),
      auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
    }, TS);

    await enqueueGrpcCollectionsPersist({
      ...store,
      collections: [{
        ...store.collections[0],
        savedRequests: [{
          ...store.collections[0].savedRequests[0],
          auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
        }],
      }],
    });
    const savedArg = saveMock.mock.calls.at(-1)?.[0];
    expect(savedArg.collections[0].savedRequests[0].auth?.bearerToken).toBe('[REDACTED]');
  });

  it('rejects duplicate saved request ids across collections', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, { name: 'A' }, TS);
    store = createGrpcCollectionInStore(store, { name: 'B' }, TS);
    const [collectionA, collectionB] = store.collections;
    store = addGrpcSavedRequestToStore(store, collectionA.id, makeGrpcSavedRequest('sr-dup'), TS);
    expect(() => addGrpcSavedRequestToStore(store, collectionB.id, makeGrpcSavedRequest('sr-dup'), TS))
      .toThrow(/duplicate saved request id/i);
  });

  it('serializes concurrent runGrpcCollectionMutation without lost updates', async () => {
    let memoryStore = createEmptyGrpcCollectionsStore(TS);
    loadMock.mockImplementation(async () => memoryStore);
    saveMock.mockImplementation(async (saved: typeof memoryStore) => {
      memoryStore = saved;
    });

    await Promise.all([
      runGrpcCollectionMutation((base) => ({
        store: createGrpcCollectionInStore(base, { name: 'A' }, TS),
        result: 'a',
      })),
      runGrpcCollectionMutation((base) => ({
        store: createGrpcCollectionInStore(base, { name: 'B' }, TS),
        result: 'b',
      })),
    ]);

    expect(memoryStore.collections).toHaveLength(2);
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
