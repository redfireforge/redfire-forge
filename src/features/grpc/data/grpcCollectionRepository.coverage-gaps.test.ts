/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyGrpcCollectionsStore,
} from '@shared/grpc/grpcPersistenceSchema';

const {
  isTauriMock,
  idbAvailableMock,
  saveMock,
  loadMock,
  syncMock,
  readKeyMock,
  writeKeyMock,
} = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  idbAvailableMock: vi.fn(() => true),
  saveMock: vi.fn().mockResolvedValue(undefined),
  loadMock: vi.fn().mockResolvedValue(null),
  syncMock: vi.fn().mockResolvedValue(false),
  readKeyMock: vi.fn().mockResolvedValue(null),
  writeKeyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('../../../shared/utils/idbGrpcCollections', () => ({
  GRPC_COLLECTIONS_STORAGE_KEY: 'grpc_collections_v1',
  idbLoadGrpcCollectionsStore: (...args: unknown[]) => loadMock(...args),
  idbSaveGrpcCollectionsStore: (...args: unknown[]) => saveMock(...args),
  idbSyncGrpcCollectionsFromLocalStorage: (...args: unknown[]) => syncMock(...args),
}));

vi.mock('../../../shared/utils/idbHelpers', () => ({
  idbAvailable: () => idbAvailableMock(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: (...args: unknown[]) => readKeyMock(...args),
  writeKey: (...args: unknown[]) => writeKeyMock(...args),
}));

import {
  addGrpcSavedRequestToStore,
  createGrpcCollectionInStore,
  deleteGrpcCollectionFromStore,
  deleteGrpcSavedRequestFromStore,
  duplicateGrpcCollectionInStore,
  duplicateGrpcSavedRequestInStore,
  exportGrpcCollectionsStore,
  importGrpcCollectionsStore,
  incrementGrpcSavedRequestRunStatsInStore,
  loadGrpcCollectionsStoreFromPersistence,
  persistGrpcCollectionsStore,
  resetGrpcCollectionsPersistQueueForTests,
  runGrpcCollectionMutation,
  updateGrpcCollectionInStore,
  updateGrpcSavedRequestInStore,
} from './grpcCollectionRepository';
import { createGrpcSavedRequestFromSnapshot } from '@shared/grpc/grpcSavedRequest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';

const TS = '2026-06-29T12:00:00.000Z';

beforeEach(() => {
  isTauriMock.mockReturnValue(false);
  idbAvailableMock.mockReturnValue(true);
  saveMock.mockClear();
  loadMock.mockReset();
  loadMock.mockResolvedValue(null);
  syncMock.mockReset();
  syncMock.mockResolvedValue(false);
  readKeyMock.mockReset();
  readKeyMock.mockResolvedValue(null);
  writeKeyMock.mockClear();
  resetGrpcCollectionsPersistQueueForTests();
});

describe('grpcCollectionRepository coverage gaps', () => {
  it('trims blank defaultTarget and defaultDescriptorKey to undefined on create and update', () => {
    let store = createEmptyGrpcCollectionsStore(TS);
    store = createGrpcCollectionInStore(store, {
      name: 'Echo',
      defaultTarget: '   ',
      defaultDescriptorKey: '  ',
    }, TS);
    expect(store.collections[0].defaultTarget).toBeUndefined();
    expect(store.collections[0].defaultDescriptorKey).toBeUndefined();

    const collectionId = store.collections[0].id;
    store = updateGrpcCollectionInStore(store, collectionId, {
      defaultTarget: ' localhost:50051 ',
      defaultDescriptorKey: ' key-1 ',
    }, TS);
    expect(store.collections[0].defaultTarget).toBe('localhost:50051');
    expect(store.collections[0].defaultDescriptorKey).toBe('key-1');

    store = updateGrpcCollectionInStore(store, collectionId, {
      defaultTarget: '  ',
      defaultDescriptorKey: '',
    }, TS);
    expect(store.collections[0].defaultTarget).toBeUndefined();
    expect(store.collections[0].defaultDescriptorKey).toBeUndefined();
  });

  it('throws when collection or saved request is missing', () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    expect(() => updateGrpcCollectionInStore(store, 'missing', { name: 'X' }, TS))
      .toThrow(/collection not found/i);
    expect(() => duplicateGrpcSavedRequestInStore(store, 'missing', 'sr-1', TS))
      .toThrow(/collection not found/i);

    const withCollection = createGrpcCollectionInStore(store, { name: 'Echo' }, TS);
    expect(() => duplicateGrpcSavedRequestInStore(withCollection, withCollection.collections[0].id, 'missing', TS))
      .toThrow(/saved request not found/i);
  });

  it('persistGrpcCollectionsStore delegates to enqueue persist', async () => {
    const store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const prepared = await persistGrpcCollectionsStore(store);
    expect(prepared.collections).toHaveLength(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('loads from Tauri storage when desktop runtime is active', async () => {
    isTauriMock.mockReturnValue(true);
    const migrated = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Desktop' }, TS);
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      collections: migrated.collections,
    }));

    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(store.collections[0].name).toBe('Desktop');
    expect(loadMock).not.toHaveBeenCalled();
  });

  it('falls back to localStorage migration when IDB is unavailable on web', async () => {
    idbAvailableMock.mockReturnValue(false);
    const migrated = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Legacy' }, TS);
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      collections: migrated.collections,
    }));

    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(store.collections[0].name).toBe('Legacy');
  });

  it('returns empty store when Tauri readKey throws', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockRejectedValue(new Error('read failed'));
    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(store.collections).toEqual([]);
  });

  it('removes legacy localStorage key when migrated collections envelope is empty', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('legacy'),
      removeItem,
    });
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      collections: [],
    }));

    await loadGrpcCollectionsStoreFromPersistence();

    expect(removeItem).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('throws when persisting invalid store shape to Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    const store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const broken = { ...store, schemaVersion: 99 as typeof store.schemaVersion };

    await expect(persistGrpcCollectionsStore(broken)).rejects.toThrow(/invalid gRPC collections store/i);
  });

  function makeSaved(id: string, name: string) {
    return createGrpcSavedRequestFromSnapshot(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id, revisionId: `rev-${id}`, updatedAt: TS, name },
    );
  }

  it('duplicates collections and saved requests in store', () => {
    let store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    const saved = makeSaved('saved-1', 'Echo call');
    store = addGrpcSavedRequestToStore(store, collectionId, saved, TS);

    store = duplicateGrpcCollectionInStore(store, collectionId, TS);
    expect(store.collections).toHaveLength(2);
    expect(store.collections[1].savedRequests[0].name).toBe('Echo call (copy)');

    store = duplicateGrpcSavedRequestInStore(store, collectionId, 'saved-1', TS);
    expect(store.collections[0].savedRequests).toHaveLength(2);
  });

  it('updates and deletes saved requests while clearing optional baseline', () => {
    let store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    const saved = {
      ...makeSaved('saved-1', 'Echo call'),
      responseBaseline: { status: 200, body: '{}' },
    };
    store = addGrpcSavedRequestToStore(store, collectionId, saved, TS);

    store = updateGrpcSavedRequestInStore(store, collectionId, 'saved-1', {
      name: 'Updated',
      responseBaseline: undefined,
    }, TS);
    expect(store.collections[0].savedRequests[0].responseBaseline).toBeUndefined();

    store = deleteGrpcSavedRequestFromStore(store, collectionId, 'saved-1', TS);
    expect(store.collections[0].savedRequests).toHaveLength(0);
  });

  it('increments run stats for success and error outcomes', () => {
    let store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    store = addGrpcSavedRequestToStore(store, collectionId, makeSaved('saved-1', 'Echo call'), TS);

    store = incrementGrpcSavedRequestRunStatsInStore(store, collectionId, 'saved-1', {
      grpcStatus: 0,
      durationMs: 12,
      capturedAt: TS,
    }, TS);
    expect(store.collections[0].savedRequests[0].runStats?.successRuns).toBe(1);

    store = incrementGrpcSavedRequestRunStatsInStore(store, collectionId, 'saved-1', {
      grpcStatus: 13,
      durationMs: 20,
    }, TS);
    expect(store.collections[0].savedRequests[0].runStats?.errorRuns).toBe(1);
  });

  it('throws when duplicate saved request ids are added', () => {
    let store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    const collectionId = store.collections[0].id;
    const saved = makeSaved('saved-1', 'Echo call');
    store = addGrpcSavedRequestToStore(store, collectionId, saved, TS);
    expect(() => addGrpcSavedRequestToStore(store, collectionId, saved, TS))
      .toThrow(/duplicate saved request id/i);
  });

  it('loads from IDB on web and syncs legacy localStorage when needed', async () => {
    const migrated = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Indexed' }, TS);
    loadMock.mockResolvedValue(migrated);
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      collections: migrated.collections,
    }));
    syncMock.mockResolvedValue(true);

    const store = await loadGrpcCollectionsStoreFromPersistence();
    expect(store.collections[0].name).toBe('Indexed');
    expect(syncMock).toHaveBeenCalled();
  });

  it('throws when IDB is unavailable during web persist', async () => {
    idbAvailableMock.mockReturnValue(false);
    const store = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    await expect(persistGrpcCollectionsStore(store)).rejects.toThrow(/indexeddb not available/i);
  });

  it('exports, imports merge/replace payloads, and runs mutations', async () => {
    const base = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Echo' }, TS);
    loadMock.mockResolvedValue(base);

    const exported = await exportGrpcCollectionsStore();
    expect(exported._exportMeta.source).toBe('RedfireForge/gRPC');

    const importedCollection = createGrpcCollectionInStore(createEmptyGrpcCollectionsStore(TS), { name: 'Imported' }, TS);
    await importGrpcCollectionsStore({
      store: importedCollection,
    }, 'merge');
    expect(saveMock).toHaveBeenCalled();

    await importGrpcCollectionsStore({
      schemaVersion: 1,
      updatedAt: TS,
      collections: importedCollection.collections,
    }, 'replace');
    expect(saveMock).toHaveBeenCalled();

    const { result } = await runGrpcCollectionMutation((current) => ({
      store: deleteGrpcCollectionFromStore(current, current.collections[0].id, TS),
      result: 'ok',
    }));
    expect(result).toBe('ok');
  });

  it('rejects invalid import payloads', async () => {
    await expect(importGrpcCollectionsStore(null)).rejects.toThrow(/json object/i);
    await expect(importGrpcCollectionsStore({ foo: 'bar' })).rejects.toThrow(/unrecognized/i);
  });
});
