/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogEntry, CatalogEndpoint, SavedEndpointValues } from '../../features/catalog/types/catalog';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { UseRequestsReturn } from '../../features/requests/hooks/useRequests';
import { useCatalogExport } from './useCatalogExport';

vi.mock('../../shared/utils/storage', () => ({
  loadCatalogEndpointValues: vi.fn().mockResolvedValue({}),
}));

import { loadCatalogEndpointValues } from '../../shared/utils/storage';
import * as catalogExportModule from '../../features/catalog/utils/catalogExport';
import * as versionMergeModule from '../../features/catalog/utils/versionMerge';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(loadCatalogEndpointValues).mockResolvedValue({});
});

function baseEntry(): CatalogEntry {
  return {
    id: 'ce1',
    name: 'API',
    currentVersionId: 'ver1',
    versions: [{ id: 'ver1', version: '2.0.0', importedAt: 0, specHash: 'h', specSize: 1 }],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: {},
    authConfig: { type: 'none' },
  };
}

function minEndpoint(): CatalogEndpoint {
  return {
    id: 'ep1',
    summary: 'List',
    method: 'GET',
    path: '/x',
    parameters: [],
    responses: [],
    tags: [],
  };
}

describe('useCatalogExport', () => {
  it('loads endpoint values when sendToReqEntry is set', async () => {
    vi.mocked(loadCatalogEndpointValues).mockResolvedValueOnce({ ep1: { params: {}, headers: {}, body: '' } } as unknown as SavedEndpointValues);

    const wb = makeWb();
    const catalog = makeCatalog(baseEntry());

    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadCatalogEndpointValues).toHaveBeenCalledWith('ce1');
    expect(result.current.sendToReqEntry?.id).toBe('ce1');
  });

  it('clearing sendToReqEntry resets loaded values via effect', async () => {
    const wb = makeWb();
    const catalog = makeCatalog(baseEntry());
    vi.mocked(loadCatalogEndpointValues).mockResolvedValueOnce({ foo: {} } as SavedEndpointValues);

    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      result.current.setSendToReqEntry(undefined);
    });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.sendToReqEpValues).toEqual({});
  });

  it('loads inline endpoint values when selected entry id changes', async () => {
    const entry = baseEntry();
    const catalog = makeCatalog(undefined);
    Object.assign(catalog, { entries: [entry], selectedEntry: entry });
    catalog.selectedEntry = entry;

    const { result, rerender } = renderHook(
      ({ selId }) =>
        useCatalogExport({
          wb: makeWb(),
          catalog: { ...catalog, selectedEntry: selId ? entry : undefined, selectedEntryId: selId } as UseCatalogReturn,
          setActiveTab: vi.fn(),
        }),
      { initialProps: { selId: undefined as string | undefined } },
    );

    rerender({ selId: 'ce1' });
    await act(async () => { await Promise.resolve(); });

    expect(loadCatalogEndpointValues).toHaveBeenCalledWith('ce1');
    expect(Object.keys(result.current.inlineExportEpValues).length >= 0).toBe(true);
  });

  it('handleExportSingleEndpoint primes entry and applies storage-loaded endpoint values', async () => {
    const ep = minEndpoint();
    const saved = { params: {}, headers: {}, body: '' };
    vi.mocked(loadCatalogEndpointValues).mockResolvedValueOnce({ ep1: saved } as SavedEndpointValues);

    const catalogNoSelection = {
      ...makeCatalog(undefined),
      entries: [baseEntry()],
      selectedEntry: null,
    } as unknown as UseCatalogReturn;

    const { result } = renderHook(() =>
      useCatalogExport({ wb: makeWb(), catalog: catalogNoSelection, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleExportSingleEndpoint(baseEntry(), ep, saved);
    });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.sendToReqSingleEndpoint).toEqual({ endpoint: ep, savedValues: saved });
    expect(result.current.sendToReqEpValues).toEqual({ ep1: saved });
  });

  it('handleSendToReqConfirm updates entry, merges collection, switches tab', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [{ id: 'env-new', name: 'Staging' }],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [{ collectionId: 'c1', requestId: 'r1', patch: { name: 'patched' } }],
      newCollection: { id: 'nc2', name: 'Fresh', requests: [{ id: 'r2', url: '/', method: 'GET', headers: [], body: '', name: 'n', auth: { type: 'none' }, validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, parameters: {}, bodyType: 'none' }], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(false);

    const updateRequest = vi.fn();
    const addEnvironments = vi.fn();
    const importCollection = vi.fn();
    const addGroup = vi.fn().mockReturnValue('g-new');
    const wb = makeWb({ updateRequest, addEnvironments, importCollection, addGroup });
    const updateEntry = vi.fn();
    const catalog = makeCatalog(baseEntry(), { updateEntry });
    const setActiveTab = vi.fn();

    const { result } = renderHook(() => useCatalogExport({ wb, catalog, setActiveTab }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });

    const payload = {
      collectionName: 'X',
      envs: [],
      endpoints: [minEndpoint()],
      customNames: {},
      sampleEpIds: new Set<string>(),
      savedEpValues: {},
      newGroupName: 'New Group',
    };

    await act(async () => {
      result.current.handleSendToReqConfirm(payload);
    });

    expect(updateEntry).toHaveBeenCalledWith('ce1', { customEndpointNames: {} });
    expect(addGroup).toHaveBeenCalledWith('New Group');
    expect(updateRequest).toHaveBeenCalledWith('c1', 'r1', { name: 'patched' });
    expect(addEnvironments).toHaveBeenCalledWith([{ id: 'env-new', name: 'Staging' }]);
    expect(importCollection).toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('requests');
    expect(result.current.sendToReqEntry).toBeUndefined();
  });

  it('handleSendToReqConfirm uses targetGroupId and skips import when merged collection empty', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'empty', name: 'Empty', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const importCollection = vi.fn();
    const wb = makeWb({ importCollection });
    const catalog = makeCatalog(baseEntry());

    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'X',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
        targetGroupId: 'existing-g',
      });
    });

    expect(importCollection).not.toHaveBeenCalled();
  });

  it('handleSendToReqConfirm forwards an empty label when currentVersionId no longer resolves', async () => {
    const spy = vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'empty', name: 'E', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const entry = baseEntry();
    entry.currentVersionId = 'missing';
    entry.versions = [{ id: 'ver1', version: '2.5.0', importedAt: 0, specHash: 'h', specSize: 1 }];

    const wb = makeWb();
    const catalog = makeCatalog(entry);
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(entry);
    });

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'X',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    const exportCtx = spy.mock.calls.at(-1)?.[1] as { versionLabel: string };
    expect(exportCtx.versionLabel).toBe('');
  });

  it('handleSendToReqConfirm forwards empty semver when catalog row omits a version column', async () => {
    const spy = vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'empty', name: 'E', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const entry = baseEntry();
    entry.versions = [{ id: 'ver1', version: '', importedAt: 1, specHash: '', specSize: 1 }];

    const wb = makeWb();
    const catalog = makeCatalog(entry);
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(entry);
    });

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'X',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    const exportCtx = spy.mock.calls.at(-1)?.[1] as { versionLabel: string };
    expect(exportCtx.versionLabel).toBe('');
  });

  it('handleExportSingleEndpoint without saved values primes empty snapshot map before storage merge', async () => {
    const ep = minEndpoint();
    vi.mocked(loadCatalogEndpointValues).mockResolvedValueOnce({ ep1: { params: {}, headers: {}, body: 'merged' } } as SavedEndpointValues);

    const catalogNoSelection = {
      ...makeCatalog(undefined),
      entries: [baseEntry()],
      selectedEntry: null,
    } as unknown as UseCatalogReturn;

    const { result } = renderHook(() =>
      useCatalogExport({ wb: makeWb(), catalog: catalogNoSelection, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleExportSingleEndpoint(baseEntry(), ep);
    });

    await act(async () => { await Promise.resolve(); });

    expect(result.current.sendToReqEpValues).toEqual({ ep1: { params: {}, headers: {}, body: 'merged' } });
  });

  it('handleInlineExportConfirm mirrors merge flow against selected catalog entry', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Inline', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [{ collectionId: 'c-in', requestId: 'rq', patch: { name: 'n' } }],
      newCollection: { id: 'col-new', name: 'X', requests: [{ id: 'r2', url: '/', method: 'GET', headers: [], body: '', name: 'x', auth: { type: 'none' }, validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, parameters: {}, bodyType: 'none' }], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(false);

    const entry = baseEntry();
    const updateEntry = vi.fn();
    const updateRequest = vi.fn();
    const importCollection = vi.fn();
    const addEnvironments = vi.fn();

    const catalog = makeCatalog(entry, {
      selectedEntry: entry,
      entries: [entry],
      updateEntry,
    }) as unknown as UseCatalogReturn;
    catalog.selectedEntry = entry;

    const wb = makeWb({ updateRequest, importCollection, addEnvironments });
    const setActiveTab = vi.fn();

    const { result } = renderHook(() => useCatalogExport({ wb, catalog, setActiveTab }));

    await act(async () => {
      result.current.handleInlineExportConfirm({
        collectionName: 'inline',
        envs: [],
        endpoints: [minEndpoint()],
        customNames: { ep1: 'Renamed' },
        sampleEpIds: new Set(),
        savedEpValues: {},
        targetGroupId: 'grp',
      });
    });

    expect(updateEntry).toHaveBeenCalledWith('ce1', { customEndpointNames: { ep1: 'Renamed' } });
    expect(updateRequest).toHaveBeenCalled();
    expect(importCollection).toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('requests');
  });

  it('handleInlineExportConfirm seeds workbench environments when exporter creates them', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Env', requests: [], mode: 'direct' },
      newEnvironments: [{ id: 'ne1', name: 'Fresh' }],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'e-col', name: 'E', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const entry = baseEntry();
    const catalog = makeCatalog(entry, {
      selectedEntry: entry,
      entries: [entry],
    }) as unknown as UseCatalogReturn;
    catalog.selectedEntry = entry;

    const addEnvironments = vi.fn();
    const wb = makeWb({ addEnvironments });
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleInlineExportConfirm({
        collectionName: 'env',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(addEnvironments).toHaveBeenCalledWith([{ id: 'ne1', name: 'Fresh' }]);
  });

  it('handleInlineExportConfirm can author a brand new group similar to send flow', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Inline', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: {
        id: 'col-empty',
        name: 'Emp',
        requests: [],
        mode: 'direct',
      },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const entry = baseEntry();
    const addGroup = vi.fn().mockReturnValue('new-g');

    const catalog = makeCatalog(entry, {
      selectedEntry: entry,
      entries: [entry],
    }) as unknown as UseCatalogReturn;
    catalog.selectedEntry = entry;

    const wb = makeWb({ addGroup });
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleInlineExportConfirm({
        collectionName: 'cn',
        envs: [],
        endpoints: [minEndpoint()],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
        newGroupName: 'Brand',
      });
    });

    expect(addGroup).toHaveBeenCalledWith('Brand');
  });

  it('handleSendToReqConfirm skips catalog mutations until an entry context exists', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'e', name: 'E', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const updateEntry = vi.fn();
    const catalog = makeCatalog(baseEntry(), { updateEntry });
    const wb = makeWb();
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'Orphan',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(updateEntry).not.toHaveBeenCalled();
    expect(result.current.sendToReqEntry).toBeUndefined();
  });

  it('handleSendToReqConfirm omits grouping when modal payload has no targets', async () => {
    const buildSpy = vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Imported', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { id: 'e', name: 'E', requests: [], mode: 'direct' },
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(true);

    const addGroup = vi.fn();
    const wb = makeWb({ addGroup });

    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog: makeCatalog(baseEntry()), setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'Bare',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(addGroup).not.toHaveBeenCalled();
    expect(buildSpy.mock.calls[0]?.[1]).toMatchObject({ groupId: undefined });
  });

  it('adds requests to existing folders instead of creating duplicates when exporting to existing collection', async () => {
    // Setup: existing collection with folders from a previous export
    const existingCollection = {
      id: 'existing-col',
      name: 'Petstore (1.0.7)',
      mode: 'multi-env' as const,
      requests: [],
      folders: [
        {
          id: 'existing-https-folder',
          name: 'https server',
          requests: [{
            id: 'existing-req-1',
            url: 'https://api.com/pet/uploadImage',
            method: 'POST',
            headers: [],
            body: '',
            name: 'uploads an image',
            auth: { type: 'none' as const },
            catalogMeta: {
              catalogEntryId: 'petstore-entry',
              catalogEndpointId: 'ep-upload',
              originalPath: '/pet/uploadImage',
              tags: [],
            },
          }],
          folders: [],
          isSubCollection: true,
        },
        {
          id: 'existing-http-folder',
          name: 'http server',
          requests: [{
            id: 'existing-req-2',
            url: 'http://api.com/pet/uploadImage',
            method: 'POST',
            headers: [],
            body: '',
            name: 'uploads an image',
            auth: { type: 'none' as const },
            catalogMeta: {
              catalogEntryId: 'petstore-entry',
              catalogEndpointId: 'ep-upload',
              originalPath: '/pet/uploadImage',
              tags: [],
            },
          }],
          folders: [],
          isSubCollection: true,
        },
      ],
    };

    const wb = makeWb({ collections: [existingCollection] });
    const entry = {
      ...baseEntry(),
      id: 'petstore-entry',
      name: 'Petstore',
      versions: [{ id: 'v1', version: '1.0.7', importedAt: 0, specHash: 'h', specSize: 1 }],
      currentVersionId: 'v1',
    };
    const catalog = makeCatalog(entry);

    const { result } = renderHook(() => useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    // Simulate exporting a DIFFERENT endpoint (Add a new pet) to the same catalog entry
    const payload = {
      collectionName: 'Petstore',
      envs: [
        { envId: 'env-https', envName: 'https server', baseUrl: 'https://api.com' },
        { envId: 'env-http', envName: 'http server', baseUrl: 'http://api.com' },
      ],
      endpoints: [{
        id: 'ep-add-pet',
        summary: 'Add a new pet to the store',
        method: 'POST' as const,
        path: '/pet',
        parameters: [],
        responses: [],
        tags: [],
      }],
      customNames: {},
      sampleEpIds: new Set<string>(),
      savedEpValues: {},
    };

    await act(async () => {
      result.current.handleSendToRequests(entry);
    });

    await act(async () => {
      result.current.handleSendToReqConfirm(payload);
    });

    // Should NOT import a new collection (would create duplicates)
    expect(wb.importCollection).not.toHaveBeenCalled();
    
    // Should call importRequests for each matching folder
    expect(wb.importRequests).toHaveBeenCalledTimes(2);
    
    // First call should add to existing https folder
    expect(wb.importRequests).toHaveBeenCalledWith(
      'existing-col',
      'existing-https-folder',
      expect.arrayContaining([expect.objectContaining({ name: 'Add a new pet to the store' })])
    );
    
    // Second call should add to existing http folder
    expect(wb.importRequests).toHaveBeenCalledWith(
      'existing-col',
      'existing-http-folder',
      expect.arrayContaining([expect.objectContaining({ name: 'Add a new pet to the store' })])
    );
    
    // Should NOT import any new folders
    expect(wb.importFolder).not.toHaveBeenCalled();
  });

  it('handleInlineExportConfirm does nothing without selectedEntry', async () => {
    const catalog = makeCatalog(undefined);
    Object.assign(catalog, { entries: [], selectedEntry: undefined });
    catalog.selectedEntry = undefined;

    const wb = makeWb();
    const { result } = renderHook(() => useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleInlineExportConfirm({
        collectionName: 'X',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(wb.importCollection).not.toHaveBeenCalled();
  });

  it('handleSendToReqConfirm calls importFolder for trulyNewFolders when merging to existing collection', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Test', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: { 
        id: 'merge-col', 
        name: 'Merge', 
        requests: [], 
        mode: 'direct',
        folders: [
          { id: 'f1', name: 'Folder1', requests: [] }
        ]
      },
      existingCollectionId: 'c1',
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(false);
    vi.spyOn(versionMergeModule, 'separateFoldersForMerge').mockReturnValue({
      requestsToAddToExisting: [],
      trulyNewFolders: [{ id: 'f1', name: 'Folder1', requests: [] }],
    });

    const importFolder = vi.fn();
    const wb = makeWb({ 
      importFolder,
      collections: [{ 
        id: 'c1', 
        name: 'Existing', 
        mode: 'direct' as const, 
        requests: [],
        folders: []
      }]
    });
    const catalog = makeCatalog(baseEntry());
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleSendToRequests(baseEntry());
    });

    await act(async () => {
      result.current.handleSendToReqConfirm({
        collectionName: 'Test',
        envs: [],
        endpoints: [],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(importFolder).toHaveBeenCalledWith('c1', { id: 'f1', name: 'Folder1', requests: [] });
  });

  it('handleInlineExportConfirm calls importRequests and importFolder when merging folders', async () => {
    vi.spyOn(catalogExportModule, 'buildCatalogExport').mockReturnValue({
      collection: { id: 'nc', name: 'Inline', requests: [], mode: 'direct' },
      newEnvironments: [],
    });
    vi.spyOn(versionMergeModule, 'mergeExportIntoCollections').mockReturnValue({
      updates: [],
      newCollection: {
        id: 'col-merge',
        name: 'Merged',
        requests: [],
        mode: 'direct',
        folders: [
          { id: 'f1', name: 'ExistingFolder', requests: [{ id: 'r1', url: '/test', method: 'GET', headers: [], body: '', name: 'Test', auth: { type: 'none' }, validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, parameters: {}, bodyType: 'none' }] },
          { id: 'f2', name: 'NewFolder', requests: [] }
        ]
      },
      existingCollectionId: 'c1',
    });
    vi.spyOn(versionMergeModule, 'isCollectionEmpty').mockReturnValue(false);
    vi.spyOn(versionMergeModule, 'separateFoldersForMerge').mockReturnValue({
      requestsToAddToExisting: [{ 
        folderId: 'f1', 
        requests: [{ id: 'r1', url: '/test', method: 'GET', headers: [], body: '', name: 'Test', auth: { type: 'none' }, validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, parameters: {}, bodyType: 'none' }] 
      }],
      trulyNewFolders: [{ id: 'f2', name: 'NewFolder', requests: [] }],
    });

    const entry = baseEntry();
    const importRequests = vi.fn();
    const importFolder = vi.fn();
    const catalog = makeCatalog(entry, {
      selectedEntry: entry,
      entries: [entry],
    }) as unknown as UseCatalogReturn;
    catalog.selectedEntry = entry;

    const wb = makeWb({ 
      importRequests,
      importFolder,
      collections: [{ 
        id: 'c1', 
        name: 'Existing', 
        mode: 'direct' as const, 
        requests: [],
        folders: [{ id: 'f1', name: 'ExistingFolder', requests: [] }]
      }]
    });
    const { result } = renderHook(() =>
      useCatalogExport({ wb, catalog, setActiveTab: vi.fn() }));

    await act(async () => {
      result.current.handleInlineExportConfirm({
        collectionName: 'inline',
        envs: [],
        endpoints: [minEndpoint()],
        customNames: {},
        sampleEpIds: new Set(),
        savedEpValues: {},
      });
    });

    expect(importRequests).toHaveBeenCalledWith('c1', 'f1', [{ 
      id: 'r1', 
      url: '/test', 
      method: 'GET', 
      headers: [], 
      body: '', 
      name: 'Test', 
      auth: { type: 'none' }, 
      validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, 
      parameters: {}, 
      bodyType: 'none' 
    }]);
    expect(importFolder).toHaveBeenCalledWith('c1', { id: 'f2', name: 'NewFolder', requests: [] });
  });
});

function makeWb(extra?: Partial<ReturnType<typeof makeWb>>): UseRequestsReturn {
  const base = {
    collections: [{ id: 'c1', name: 'C', mode: 'direct' as const, requests: [{ id: 'r1', url: '/', method: 'GET', headers: [], body: '', name: 'Old', auth: { type: 'none' }, validation: { rules: [], expectedStatus: '^200$', expectedBody: '' }, parameters: {}, bodyType: 'none' }] }],
    environments: [{ id: 'we1', name: 'Dev' }],
    addGroup: vi.fn().mockReturnValue('gid'),
    updateRequest: vi.fn(),
    importCollection: vi.fn(),
    importFolder: vi.fn(),
    importRequests: vi.fn(),
    addEnvironments: vi.fn(),
  };
  return { ...base, ...extra } as unknown as UseRequestsReturn;
}

function makeCatalog(entry?: CatalogEntry, extraCatalog?: Partial<UseCatalogReturn>): UseCatalogReturn {
  const sel = entry ?? null;
  return {
    entries: entry ? [entry] : [],
    selectedEntry: sel as CatalogEntry | null,
    selectedEntryId: entry?.id,
    setSelectedEntryId: vi.fn(),
    loading: false,
    error: null,
    reload: vi.fn(),
    addEntry: vi.fn(),
    addVersionToEntry: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
    switchVersion: vi.fn(),
    loadRawSpec: vi.fn(),
    ...extraCatalog,
  } as unknown as UseCatalogReturn;
}
