/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RequestItem, RequestCollection, RequestsData } from '../../../shared/types';
import { useRequestTabCoordinator } from './useRequestTabCoordinator';
import type { UseRequestsReturn } from './useRequests';
import { _clearPendingSave, _STORAGE_KEY } from './useRequestTabPersistence';
import { readKey } from '../../../shared/utils/storage';

// ─── Mock storage (prevent real readKey/writeKey) ────────────────

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
}));

// ─── Mock useResponseCache ───────────────────────────────────────

const mockPruneResponseCache = vi.fn();
const mockPruneResponseCacheMany = vi.fn();

vi.mock('./useResponseCache', () => ({
  pruneResponseCache: (...args: unknown[]) => mockPruneResponseCache(...args),
  pruneResponseCacheMany: (...args: unknown[]) => mockPruneResponseCacheMany(...args),
}));

// ─── Factories ───────────────────────────────────────────────────

function makeReq(id: string, name = 'Req'): RequestItem {
  return { id, name, method: 'GET', url: '', headers: [], body: '', auth: { type: 'none' } };
}

function makeCol(id: string, reqs: RequestItem[] = []): RequestCollection {
  return { id, name: `Col ${id}`, mode: 'direct', requests: reqs } as RequestCollection;
}

function makeMockWb(overrides: Partial<UseRequestsReturn> = {}): UseRequestsReturn {
  const data: RequestsData = {
    collections: [makeCol('c1', [makeReq('r1', 'Get Users'), makeReq('r2', 'Create User')])],
    selectedCollectionId: 'c1',
    selectedRequestId: 'r1',
    ...overrides.data,
  };

  return {
    data,
    loaded: true,
    collections: data.collections,
    selectedCollection: data.collections.find(c => c.id === data.selectedCollectionId) ?? null,
    selectedRequest: null,
    selectedEnvId: data.selectedEnvId,
    setSelectedEnvId: vi.fn(),
    selectCollection: vi.fn(),
    selectRequest: vi.fn(),
    addCollection: vi.fn().mockReturnValue('new-col'),
    removeCollection: vi.fn(),
    addRequest: vi.fn().mockReturnValue('new-req'),
    removeRequest: vi.fn(),
    removeFolder: vi.fn(),
    updateRequest: vi.fn(),
    moveRequestToCollection: vi.fn(),
    moveFolderToCollection: vi.fn(),
    moveCollectionAsSubCollection: vi.fn(),
    ...overrides,
  } as unknown as UseRequestsReturn;
}

// ─── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  _clearPendingSave();
  mockPruneResponseCache.mockReset();
  mockPruneResponseCacheMany.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  _clearPendingSave();
});

// ─── Tests ───────────────────────────────────────────────────────

describe('useRequestTabCoordinator', () => {
  it('skips restore effect until workbench is loaded', async () => {
    const readKeyMock = vi.mocked(readKey);
    const wb = makeMockWb({ loaded: false });
    const { rerender } = renderHook(({ value }) => useRequestTabCoordinator(value), {
      initialProps: { value: wb },
    });
    await act(async () => { await Promise.resolve(); });
    expect(readKeyMock).not.toHaveBeenCalled();

    rerender({ value: { ...wb, loaded: true } as UseRequestsReturn });
    await act(async () => { await Promise.resolve(); });
    expect(readKeyMock).toHaveBeenCalled();
  });

  it('selectRequest opens a tab and syncs sidebar selection', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab?.requestId).toBe('r1');
  });

  it('openInNewTab opens a second tab for a different request', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTab?.requestId).toBe('r2');
  });

  it('re-selecting the already-active request keeps a stable single-tab snapshot', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.selectRequest('c1', 'r1'); });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab?.requestId).toBe('r1');
  });

  it('removeRequest prunes tab and response cache', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    expect(result.current.tabs).toHaveLength(2);

    act(() => { result.current.removeRequest('c1', 'r1'); });

    expect(wb.removeRequest).toHaveBeenCalledWith('c1', 'r1');
    expect(mockPruneResponseCache).toHaveBeenCalledWith('r1');
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].requestId).toBe('r2');
  });

  it('removeCollection prunes all tabs for that collection and response caches', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    act(() => { result.current.removeCollection('c1'); });

    expect(wb.removeCollection).toHaveBeenCalledWith('c1');
    expect(mockPruneResponseCacheMany).toHaveBeenCalledWith(['r1', 'r2']);
    expect(result.current.tabs).toHaveLength(0);
  });

  it('removeCollection still removes tabs and prunes empty cache list when collection is missing', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.removeCollection('missing-col'); });

    expect(wb.removeCollection).toHaveBeenCalledWith('missing-col');
    expect(mockPruneResponseCacheMany).toHaveBeenCalledWith([]);
    expect(result.current.tabs).toHaveLength(1);
  });

  it('openTabRequestIds contains all open request IDs', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    expect(result.current.openTabRequestIds.has('r1')).toBe(true);
    expect(result.current.openTabRequestIds.has('r2')).toBe(true);
    expect(result.current.openTabRequestIds.has('r-nonexistent')).toBe(false);
  });

  it('envChange updates both wb and active tab', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.envChange('env-2'); });

    expect(wb.setSelectedEnvId).toHaveBeenCalledWith('env-2');
    expect(result.current.activeTab?.envId).toBe('env-2');
  });

  it('updateTabUI updates sub-tab state on active tab', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    const tabId = result.current.activeTab!.id;

    act(() => { result.current.updateTabUI(tabId, { activeSubTab: 'body' }); });
    expect(result.current.activeTab?.activeSubTab).toBe('body');

    act(() => { result.current.updateTabUI(tabId, { responseSubTab: 'console' }); });
    expect(result.current.activeTab?.responseSubTab).toBe('console');

    act(() => { result.current.updateTabUI(tabId, { inputMode: 'curlExport' }); });
    expect(result.current.activeTab?.inputMode).toBe('curlExport');

    act(() => { result.current.updateTabUI(tabId, { activeHistoryId: 'h-1' }); });
    expect(result.current.activeTab?.activeHistoryId).toBe('h-1');
  });

  it('restores persisted tabs when storage has tab state', async () => {
    const readKeyMock = vi.mocked(readKey);
    readKeyMock.mockImplementationOnce(async (key: string) => {
      if (key === _STORAGE_KEY) {
        return JSON.stringify({
          tabs: [{
            id: 'req-tab-7',
            collectionId: 'c1',
            requestId: 'r2',
            label: 'Create User',
            activeSubTab: 'params',
            responseSubTab: 'preview',
            inputMode: 'builder',
          }],
          activeTabId: 'req-tab-7',
        });
      }
      return null;
    });
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.activeTab?.requestId).toBe('r2');
  });

  it('seeds one tab from legacy selected collection/request when no persisted tabs exist', async () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab?.requestId).toBe('r1');
  });

  it('beforeunload flush path executes only when tabs exist', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    act(() => {
      result.current.selectRequest('c1', 'r1');
    });
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    expect(result.current.tabs.length).toBeGreaterThanOrEqual(1);
  });

  it('removeFolder only prunes when folder is a sub-collection', () => {
    const wb = makeMockWb({
      data: {
        collections: [
          {
            ...makeCol('c1', [makeReq('r1'), makeReq('r2')]),
            folders: [
              { id: 'f-sub', name: 'Sub', isSubCollection: true, requests: [makeReq('r1')], folders: [] },
              { id: 'f-plain', name: 'Plain', isSubCollection: false, requests: [makeReq('r2')], folders: [] },
            ],
          } as RequestCollection,
        ],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    act(() => { result.current.removeFolder('c1', 'f-plain'); });
    expect(mockPruneResponseCacheMany).not.toHaveBeenCalledWith(['r2']);

    act(() => { result.current.removeFolder('c1', 'f-sub'); });
    expect(mockPruneResponseCacheMany).toHaveBeenCalledWith(['r1']);
  });

  it('removeFolder no-ops cleanup when collection or folder cannot be found', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.removeFolder('missing-col', 'missing-folder'); });
    expect(wb.removeFolder).toHaveBeenCalledWith('missing-col', 'missing-folder');
    expect(mockPruneResponseCacheMany).not.toHaveBeenCalled();
  });

  it('removeFolder handles collection without folders using nullish fallback', () => {
    const wb = makeMockWb({
      data: {
        collections: [makeCol('c1', [makeReq('r1')])],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.removeFolder('c1', 'no-folder'); });
    expect(wb.removeFolder).toHaveBeenCalledWith('c1', 'no-folder');
    expect(mockPruneResponseCacheMany).not.toHaveBeenCalled();
  });

  it('updates tab collection ids for cross-collection move wrappers', () => {
    const wb = makeMockWb({
      data: {
        collections: [
          {
            ...makeCol('c1', [makeReq('r1')]),
            folders: [{ id: 'f-sub', name: 'Sub', isSubCollection: true, requests: [makeReq('r1')], folders: [] }],
          } as RequestCollection,
          makeCol('c2', []),
        ],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.moveRequestToCollection('c1', 'r1', 'c2', null); });
    expect(result.current.activeTab?.collectionId).toBe('c2');

    act(() => { result.current.moveFolderToCollection('c1', 'f-sub', 'c2', null); });
    expect(result.current.activeTab?.collectionId).toBe('c2');
  });

  it('keeps tab collection unchanged for same-collection move wrappers', () => {
    const wb = makeMockWb({
      data: {
        collections: [
          {
            ...makeCol('c1', [makeReq('r1')]),
            folders: [{ id: 'f-sub', name: 'Sub', isSubCollection: true, requests: [makeReq('r1')], folders: [] }],
          } as RequestCollection,
        ],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.moveRequestToCollection('c1', 'r1', 'c1', null); });
    act(() => { result.current.moveFolderToCollection('c1', 'f-sub', 'c1', null); });

    expect(result.current.activeTab?.collectionId).toBe('c1');
  });

  it('handles moveFolder/moveCollection merge when source lookup is missing', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.moveFolderToCollection('missing-col', 'missing-folder', 'c2', null); });
    act(() => { result.current.mergeCollectionInto('missing-col', 'c2'); });

    expect(wb.moveFolderToCollection).toHaveBeenCalledWith('missing-col', 'missing-folder', 'c2', null);
    expect(wb.moveCollectionAsSubCollection).toHaveBeenCalledWith('missing-col', 'c2');
  });

  it('covers folder nullish fallback and merge reqId sync for existing source', () => {
    const wb = makeMockWb({
      data: {
        collections: [
          makeCol('c1', [makeReq('r1'), makeReq('r2')]),
          makeCol('c2', []),
        ],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.moveFolderToCollection('c1', 'missing-folder', 'c2', null); });
    act(() => { result.current.mergeCollectionInto('c1', 'c2'); });

    expect(wb.moveFolderToCollection).toHaveBeenCalledWith('c1', 'missing-folder', 'c2', null);
    expect(wb.moveCollectionAsSubCollection).toHaveBeenCalledWith('c1', 'c2');
    expect(result.current.activeTab?.collectionId).toBe('c2');
  });

  it('addTab does nothing when no selected collection/request and envChange no-op without active tab', () => {
    const wb = makeMockWb({
      data: {
        collections: [],
        selectedCollectionId: undefined,
        selectedRequestId: undefined,
      } as RequestsData,
      selectedCollection: null,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.envChange('env-z'); });
    act(() => { result.current.addTab(); });
    expect(result.current.tabs).toHaveLength(0);
    expect(wb.setSelectedEnvId).toHaveBeenCalledWith('env-z');
  });

  it('addTab skips opening when selected collection has no requests', () => {
    const wb = makeMockWb({
      data: {
        collections: [makeCol('c1', [])],
        selectedCollectionId: 'c1',
        selectedRequestId: undefined,
      } as RequestsData,
      selectedCollection: makeCol('c1', []),
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.addTab(); });
    expect(result.current.tabs).toHaveLength(0);
  });

  it('addTab uses Untitled fallback when first request has no name/url', () => {
    const wb = makeMockWb({
      data: {
        collections: [makeCol('c1', [{ ...makeReq('r1', ''), url: '' }])],
        selectedCollectionId: 'c1',
        selectedRequestId: undefined,
      } as RequestsData,
      selectedCollection: makeCol('c1', [{ ...makeReq('r1', ''), url: '' }]),
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.addTab(); });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab?.label).toBe('Untitled');
  });

  it('select/open handlers no-op when collection id is unknown', () => {
    const wb = makeMockWb();
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.selectRequest('missing-col', 'r1'); });
    act(() => { result.current.openInNewTab('missing-col', 'r1'); });
    expect(result.current.tabs).toHaveLength(0);
  });

  it('uses url and untitled fallbacks for request tab labels', () => {
    const wb = makeMockWb({
      data: {
        collections: [
          makeCol('c1', [
            { ...makeReq('r1', ''), url: 'https://service.local' },
            { ...makeReq('r2', ''), url: '' },
          ]),
        ],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));

    act(() => { result.current.selectRequest('c1', 'r1'); });
    act(() => { result.current.openInNewTab('c1', 'r2'); });

    expect(result.current.tabs.find(t => t.requestId === 'r1')?.label).toBe('https://service.local');
    expect(result.current.tabs.find(t => t.requestId === 'r2')?.label).toBe('Untitled');
  });

  it('selectRequest uses Untitled fallback when request has no name/url', () => {
    const wb = makeMockWb({
      data: {
        collections: [makeCol('c1', [{ ...makeReq('r1', ''), url: '' }])],
        selectedCollectionId: 'c1',
        selectedRequestId: 'r1',
      } as RequestsData,
    });
    const { result } = renderHook(() => useRequestTabCoordinator(wb));
    act(() => { result.current.selectRequest('c1', 'r1'); });
    expect(result.current.activeTab?.label).toBe('Untitled');
  });
});
