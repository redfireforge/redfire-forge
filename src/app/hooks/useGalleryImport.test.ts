/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGalleryImport } from './useGalleryImport';
import type { GalleryEntry } from '../../data/galleries/types';

function makeDeps(overrides = {}) {
  return {
    wb: {
      collections: [] as any[],
      addCollection: vi.fn().mockReturnValue('col-1'),
      addRequest: vi.fn().mockReturnValue('req-1'),
      updateRequest: vi.fn(),
    },
    featureGroups: [],
    environments: [],
    microservices: [],
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

function makeEntry(domain: string, overrides = {}): GalleryEntry<unknown> {
  return {
    id: 'e1',
    domain: domain as any,
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
  });
});
