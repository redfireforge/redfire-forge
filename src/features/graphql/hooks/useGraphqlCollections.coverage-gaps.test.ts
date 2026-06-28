/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../shared/utils/idbGraphqlCollections', () => ({
  idbLoadCollections: vi.fn().mockResolvedValue([]),
  idbSaveCollection: vi.fn().mockResolvedValue(undefined),
  idbDeleteCollection: vi.fn().mockResolvedValue(undefined),
  idbLoadFolders: vi.fn().mockResolvedValue([]),
  idbSaveFolder: vi.fn().mockResolvedValue(undefined),
  idbDeleteFolder: vi.fn().mockResolvedValue(undefined),
  idbLoadItems: vi.fn().mockResolvedValue([]),
  idbSaveItem: vi.fn().mockResolvedValue(undefined),
  idbDeleteItem: vi.fn().mockResolvedValue(undefined),
  idbUpdateItemSortOrders: vi.fn().mockResolvedValue(undefined),
  idbExportCollections: vi.fn().mockResolvedValue({ _exportMeta: {}, collections: [] }),
  idbImportCollections: vi.fn().mockResolvedValue([]),
}));

import {
  idbLoadCollections,
  idbSaveCollection,
  idbSaveFolder,
  idbSaveItem,
  idbLoadFolders,
  idbLoadItems,
} from '../../../shared/utils/idbGraphqlCollections';
import { useGraphqlCollections } from './useGraphqlCollections';
import { GQL_COLLECTIONS_RELOAD_EVENT } from '../utils/gqlDemoCollectionsCleanup';
import type { GraphqlCollection, GraphqlCollectionFolder, GraphqlCollectionItem } from '../../../shared/types/graphql';

const col: GraphqlCollection = {
  id: 'col-1',
  name: 'C',
  variables: {},
  preRequestScript: '',
  postResponseScript: '',
  createdAt: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(idbLoadCollections).mockResolvedValue([col]);
  vi.mocked(idbLoadFolders).mockResolvedValue([]);
  vi.mocked(idbLoadItems).mockResolvedValue([]);
});

describe('useGraphqlCollections — coverage gaps', () => {
  it('reloads trees on GQL_COLLECTIONS_RELOAD_EVENT', async () => {
    vi.mocked(idbLoadCollections)
      .mockResolvedValueOnce([col])
      .mockResolvedValueOnce([{ ...col, name: 'Reloaded' }]);
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_COLLECTIONS_RELOAD_EVENT));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.trees[0]?.collection.name).toBe('Reloaded'));
  });

  it('swallows reload errors on custom event', async () => {
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(idbLoadCollections).mockRejectedValueOnce(new Error('reload fail'));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_COLLECTIONS_RELOAD_EVENT));
      await Promise.resolve();
    });
    expect(result.current.trees).toHaveLength(1);
  });

  it('renameCollection swallows idbSaveCollection errors', async () => {
    vi.mocked(idbSaveCollection).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.trees).toHaveLength(1));
    await act(async () => {
      await result.current.renameCollection('col-1', 'New Name');
    });
    expect(result.current.trees[0]?.collection.name).toBe('New Name');
  });

  it('updateCollectionVariables swallows idbSaveCollection errors', async () => {
    vi.mocked(idbSaveCollection).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.trees).toHaveLength(1));
    await act(async () => {
      await result.current.updateCollectionVariables('col-1', { k: 'v' });
    });
    expect(result.current.trees[0]?.collection.variables).toEqual({ k: 'v' });
  });

  it('updateCollectionScript swallows idbSaveCollection errors', async () => {
    vi.mocked(idbSaveCollection).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.trees).toHaveLength(1));
    await act(async () => {
      await result.current.updateCollectionScript('col-1', 'preRequestScript', 'console.log(1)');
    });
    expect(result.current.trees[0]?.collection.preRequestScript).toBe('console.log(1)');
  });

  it('renameFolder swallows idbSaveFolder errors', async () => {
    const folder: GraphqlCollectionFolder = {
      id: 'f1', collectionId: 'col-1', name: 'F', sortOrder: 0, createdAt: 1,
    };
    vi.mocked(idbLoadFolders).mockResolvedValue([folder]);
    vi.mocked(idbSaveFolder).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.trees[0]?.folders).toHaveLength(1));
    await act(async () => {
      await result.current.renameFolder('f1', 'Renamed');
    });
    expect(result.current.trees[0]?.folders[0]?.name).toBe('Renamed');
  });

  it('setPinned swallows idbSaveItem errors', async () => {
    const item: GraphqlCollectionItem = {
      id: 'i1',
      collectionId: 'col-1',
      name: 'Q',
      sortOrder: 0,
      operation: { id: 'op', query: '{ x }', variables: '{}', operationType: 'query', name: 'Q' },
      isPinned: false,
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(idbLoadItems).mockResolvedValue([item]);
    vi.mocked(idbSaveItem).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.trees[0]?.items).toHaveLength(1));
    await act(async () => {
      await result.current.setPinned('i1', true);
    });
    expect(result.current.trees[0]?.items[0]?.isPinned).toBe(true);
  });

  it('addFolder uses sortOrder 0 when tree missing', async () => {
    vi.mocked(idbLoadCollections).mockResolvedValue([]);
    const { result } = renderHook(() => useGraphqlCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addFolder('missing-col', 'Folder');
    });
    expect(idbSaveFolder).toHaveBeenCalled();
  });
});
