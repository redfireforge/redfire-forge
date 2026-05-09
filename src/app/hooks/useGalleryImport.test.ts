/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../shared/utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/storage')>();
  return {
    ...actual,
    loadSharedDataSources: vi.fn().mockResolvedValue([]),
    saveSharedDataSources: vi.fn().mockResolvedValue(undefined),
    savePreviewSampleId: vi.fn(),
  };
});
import { renderHook, act } from '@testing-library/react';
import * as storage from '../../shared/utils/storage';
import { useGalleryImport } from './useGalleryImport';
import type { GalleryEntry, GalleryDomain } from '../../data/galleries/types';
import type { Environment, Microservice, RequestCollection } from '../../shared/types';
import { LOADED_SENTINEL } from '../../features/gallery/GalleryPage';
import type { Workflow } from '../../features/workflow/types/workflow';

function makeDeps(overrides = {}) {
  return {
    wb: {
      collections: [] as RequestCollection[],
      addCollection: vi.fn().mockReturnValue('col-1'),
      addRequest: vi.fn().mockReturnValue('req-1'),
      updateRequest: vi.fn(),
    },
    featureGroups: [],
    environments: [],
    microservices: [],
    previewWorkflow: null as Workflow | null,
    workflows: [] as Workflow[],
    setActiveTab: vi.fn(),
    setPreviewRequest: vi.fn(),
    setPreviewWorkflow: vi.fn(),
    setCatalogInitialSpec: vi.fn(),
    setShowCatalogImport: vi.fn(),
    setFeatureGroups: vi.fn(),
    setEnvironments: vi.fn(),
    setMicroservices: vi.fn(),
    setSelectedEnvId: vi.fn(),
    setSelectedSvcId: vi.fn(),
    ...overrides,
  };
}

function makeEntry(domain: GalleryDomain, overrides = {}): GalleryEntry<unknown> {
  return {
    id: 'e1',
    domain,
    name: 'Test Entry',
    description: 'desc',
    icon: '🔌',
    category: 'test',
    difficulty: 'easy',
    tags: ['test'],
    liveApis: [],
    factory: () => ({
      id: 'scen-1', name: 'Test', url: 'https://api.test.com',
      method: 'GET', headers: [], body: '', auth: { type: 'none' },
    }),
    ...overrides,
  };
}

describe('useGalleryImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.loadSharedDataSources).mockResolvedValue([]);
    vi.mocked(storage.saveSharedDataSources).mockResolvedValue(undefined);
  });

  describe('importedSamples', () => {
    it('returns empty map when no feature groups have gallery IDs', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({});
    });

    it('maps gallerySampleId to gallerySampleHash', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', gallerySampleId: 's1', gallerySampleHash: 'h1', scenarios: [] },
          { id: 'fg2', gallerySampleId: 's2', gallerySampleHash: 'h2', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({ s1: 'h1', s2: 'h2' });
    });

    it('skips entries without gallerySampleId', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({});
    });

    it('maps legacy gallery imports using stripped Gallery: name when hash/id missing', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', source: 'gallery', name: 'Gallery: Legacy Sample', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({ '__name:Legacy Sample': '' });
    });

    it('skips legacy entry with empty stripped name', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', source: 'gallery', name: 'Gallery:   ', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({});
    });

    it('skips entry with gallerySampleId but no gallerySampleHash', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', gallerySampleId: 's1', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({});
    });

    it('skips gallery source entry without a name', () => {
      const deps = makeDeps({
        featureGroups: [
          { id: 'fg1', source: 'gallery', scenarios: [] },
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples).toEqual({});
    });

    it('includes currently-previewed workflow id with LOADED_SENTINEL', () => {
      const deps = makeDeps({
        previewWorkflow: { id: 'sample-workflow-parallel', name: 'WF', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 } as Workflow,
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples['sample-workflow-parallel']).toBe(LOADED_SENTINEL);
    });

    it('does not add a workflow entry when previewWorkflow is null', () => {
      const deps = makeDeps({ previewWorkflow: null });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(Object.keys(result.current.importedSamples)).toHaveLength(0);
    });

    it('tracks saved workflows that have a gallerySampleId', () => {
      const deps = makeDeps({
        workflows: [
          { id: 'wf-saved', name: 'Saved WF', gallerySampleId: 'sample-workflow-parallel', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 } as Workflow,
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(result.current.importedSamples['sample-workflow-parallel']).toBe(LOADED_SENTINEL);
    });

    it('does not track saved workflows without gallerySampleId', () => {
      const deps = makeDeps({
        workflows: [
          { id: 'wf-manual', name: 'Manual WF', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 } as Workflow,
        ],
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      expect(Object.keys(result.current.importedSamples)).toHaveLength(0);
    });
  });

  describe('onImportRequest', () => {
    it('creates a Gallery Samples collection if not exists', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onImportRequest(makeEntry('requests')));
      expect(deps.wb.addCollection).toHaveBeenCalledWith({ name: 'Gallery Samples', mode: 'direct' });
      expect(deps.wb.addRequest).toHaveBeenCalledWith('col-1');
      expect(deps.wb.updateRequest).toHaveBeenCalled();
      expect(deps.setActiveTab).toHaveBeenCalledWith('requests');
    });

    it('reuses existing Gallery Samples collection', () => {
      const deps = makeDeps({
        wb: {
          collections: [{ id: 'existing-col', name: 'Gallery Samples' }],
          addCollection: vi.fn(),
          addRequest: vi.fn().mockReturnValue('req-1'),
          updateRequest: vi.fn(),
        },
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onImportRequest(makeEntry('requests')));
      expect(deps.wb.addCollection).not.toHaveBeenCalled();
      expect(deps.wb.addRequest).toHaveBeenCalledWith('existing-col');
    });
  });

  describe('onTryItRequest', () => {
    it('sets preview request and switches to requests tab', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onTryItRequest(makeEntry('requests')));
      expect(deps.setPreviewRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({ id: '__preview__' }),
          request: expect.objectContaining({ id: '__preview_req__' }),
          entryName: 'Test Entry',
        }),
      );
      expect(deps.setActiveTab).toHaveBeenCalledWith('requests');
    });
  });

  describe('onImportCatalog', () => {
    it('sets catalog spec and shows import modal', () => {
      const deps = makeDeps();
      const entry = makeEntry('catalog', { factory: () => 'openapi: 3.0\ninfo: ...' });
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onImportCatalog(entry));
      expect(deps.setCatalogInitialSpec).toHaveBeenCalledWith({
        yaml: 'openapi: 3.0\ninfo: ...',
        name: 'Test Entry.yaml',
      });
      expect(deps.setShowCatalogImport).toHaveBeenCalledWith(true);
    });
  });

  describe('onImportTest', () => {
    it('creates gallery environment and microservice if not exist', async () => {
      const deps = makeDeps();
      const entry = makeEntry('tests', {
        factory: () => ({
          id: 'fg', name: 'Test FG', scenarios: [],
        }),
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      expect(deps.setEnvironments).toHaveBeenCalled();
      expect(deps.setMicroservices).toHaveBeenCalled();
      expect(deps.setFeatureGroups).toHaveBeenCalled();
      expect(deps.setSelectedEnvId).toHaveBeenCalled();
      expect(deps.setSelectedSvcId).toHaveBeenCalled();

      const envUpdater = deps.setEnvironments.mock.calls[0][0] as (prev: Environment[]) => Environment[];
      expect(envUpdater([])).toHaveLength(1);

      const svcAppender = deps.setMicroservices.mock.calls[0][0] as (prev: Microservice[]) => Microservice[];
      expect(svcAppender([])).toHaveLength(1);
    });

    it('reuses existing gallery environment', async () => {
      const deps = makeDeps({
        environments: [{ id: 'env-1', name: 'Gallery Samples' }],
        microservices: [{ id: 'svc-1', name: 'Gallery Samples', baseUrls: { 'env-1': '' } }],
      });
      const entry = makeEntry('tests', {
        factory: () => ({ id: 'fg', name: 'Test FG', scenarios: [] }),
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      // Should not create new env/svc
      expect(deps.setEnvironments).not.toHaveBeenCalled();
      expect(deps.setMicroservices).not.toHaveBeenCalled();
      // But should still set feature groups
      expect(deps.setFeatureGroups).toHaveBeenCalled();
    });

    it('adds new env row to existing Gallery microservice when env id is missing', async () => {
      const deps = makeDeps({
        environments: [{ id: 'env-new', name: 'Gallery Samples' }],
        microservices: [{ id: 'svc-1', name: 'Gallery Samples', baseUrls: { 'other-env': '' } }],
      });
      const entry = makeEntry('tests', {
        factory: () => ({ id: 'fg', name: 'Extra FG', scenarios: [] }),
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      expect(deps.setMicroservices).toHaveBeenCalled();
      expect(deps.setFeatureGroups).toHaveBeenCalled();

      const mapSvcUpdater = deps.setMicroservices.mock.calls[0][0] as (prev: Microservice[]) => Microservice[];
      const prev: Microservice[] = [
        { id: 'svc-1', name: 'Gallery Samples', baseUrls: { 'other-env': '' } },
        { id: 'svc-other', name: 'Other', baseUrls: {} },
      ];
      const next = mapSvcUpdater(prev);
      expect(next).toHaveLength(2);
      expect(next[0].baseUrls['env-new']).toBe('');
      expect(next[1]).toBe(prev[1]);
    });

    it('imports additional feature groups from test entry factory', async () => {
      const deps = makeDeps();
      const entry = {
        ...makeEntry('tests', {
          factory: () => ({ id: 'fg', name: 'Main', scenarios: [] }),
        }),
        additionalFeatureGroupsFactory: () => [
          { id: 'sub', name: 'Child', scenarios: [], microserviceId: 'x', environmentId: 'y' },
        ],
      } as GalleryEntry<unknown> & { additionalFeatureGroupsFactory: () => unknown[] };
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      const updater = deps.setFeatureGroups.mock.calls[0][0] as (p: unknown[]) => unknown[];
      const pushed = updater([]);
      expect(pushed).toHaveLength(2);
    });

    it('merges shared data sources when sample provides a factory', async () => {
      vi.mocked(storage.loadSharedDataSources).mockResolvedValue([
        { id: 'ds-existing', name: 'Old', columns: [], rows: [], updatedAt: 0 },
      ] as Awaited<ReturnType<typeof storage.loadSharedDataSources>>);
      const deps = makeDeps();
      const newDs = { id: 'ds-new', name: 'New', columns: [], rows: [], updatedAt: 1 };
      const entry = {
        ...makeEntry('tests', {
          factory: () => ({ id: 'fg', name: 'Has DS', scenarios: [] }),
        }),
        sharedDataSourceFactory: () => [newDs, { ...newDs, id: 'ds-existing' }],
      } as GalleryEntry<unknown> & { sharedDataSourceFactory: () => unknown[] };
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      expect(storage.saveSharedDataSources).toHaveBeenCalled();
      const saved = vi.mocked(storage.saveSharedDataSources).mock.calls[0][0] as { id: string }[];
      expect(saved.some(d => d.id === 'ds-new')).toBe(true);
    });

    it('does not save shared data sources when all are duplicates', async () => {
      vi.mocked(storage.loadSharedDataSources).mockResolvedValue([
        { id: 'ds-1', name: 'Old', columns: [], rows: [], updatedAt: 0 },
      ] as Awaited<ReturnType<typeof storage.loadSharedDataSources>>);
      const deps = makeDeps();
      const entry = {
        ...makeEntry('tests', {
          factory: () => ({ id: 'fg', name: 'Dup DS', scenarios: [] }),
        }),
        sharedDataSourceFactory: () => [{ id: 'ds-1', name: 'Old Dup', columns: [], rows: [], updatedAt: 1 }],
      } as GalleryEntry<unknown> & { sharedDataSourceFactory: () => unknown[] };
      const { result } = renderHook(() => useGalleryImport(deps));
      await act(async () => {
        await result.current.onImportTest(entry);
      });
      expect(storage.saveSharedDataSources).not.toHaveBeenCalled();
    });
  });

  describe('onImportWorkflow', () => {
    it('sets preview workflow with auto-layout and switches tab', () => {
      const deps = makeDeps();
      const entry = makeEntry('workflows', {
        factory: () => ({
          id: 'wf1', name: 'My Workflow',
          nodes: [{ id: 'n1', type: 'request', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        }),
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onImportWorkflow(entry));
      expect(deps.setPreviewWorkflow).toHaveBeenCalled();
      expect(deps.setActiveTab).toHaveBeenCalledWith('workflow');
    });

    it('calls savePreviewSampleId with entry id', () => {
      const deps = makeDeps();
      const entry = makeEntry('workflows', {
        id: 'wf-sample-42',
        factory: () => ({
          id: 'wf1', name: 'My Workflow',
          nodes: [{ id: 'n1', type: 'request', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        }),
      });
      const { result } = renderHook(() => useGalleryImport(deps));
      act(() => result.current.onImportWorkflow(entry));
      expect(storage.savePreviewSampleId).toHaveBeenCalledWith('wf-sample-42');
    });
  });
});
