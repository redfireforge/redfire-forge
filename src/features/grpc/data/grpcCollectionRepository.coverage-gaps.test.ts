/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyGrpcCollectionsStore,
} from '../../../shared/grpc/grpcPersistenceSchema';

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
  createGrpcCollectionInStore,
  duplicateGrpcSavedRequestInStore,
  loadGrpcCollectionsStoreFromPersistence,
  persistGrpcCollectionsStore,
  resetGrpcCollectionsPersistQueueForTests,
  updateGrpcCollectionInStore,
} from './grpcCollectionRepository';

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
});
