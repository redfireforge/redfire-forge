/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHealthCheckMock, createUsersApiMock } from '../../data/galleries/api-mock';
import type { ApiMockPredicateGroupV1, ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import {
  API_MOCK_WORKSPACE_CHANGED_EVENT,
  cloneServerForGalleryImport,
  dispatchApiMockWorkspaceChanged,
  loadGalleryImportTracking,
  importApiMockGalleryServer,
  markGallerySampleImported,
} from './apiMockGalleryImport';

const loadWorkspace = vi.fn();
const saveWorkspace = vi.fn();
const readKey = vi.fn();
const writeKey = vi.fn();

vi.mock('./apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveWorkspace(...args),
}));

vi.mock('../../shared/utils/storage', () => ({
  readKey: (...args: unknown[]) => readKey(...args),
  writeKey: (...args: unknown[]) => writeKey(...args),
}));

const nextAutoPort = vi.fn(async (exclude: number[] = []) => {
  for (let port = 4600; port <= 4699; port++) {
    if (!exclude.includes(port)) return { ok: true as const, data: { port } };
  }
  return {
    ok: false as const,
    error: { code: 'NO_PORT_AVAILABLE', message: 'No available port in 4600-4699' },
  };
});

vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    nextAutoPort: (...args: unknown[]) => nextAutoPort(...args),
  },
}));

describe('apiMockGalleryImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWorkspace.mockResolvedValue({ servers: [], activeServerId: undefined });
    saveWorkspace.mockResolvedValue(undefined);
    readKey.mockResolvedValue(null);
    writeKey.mockResolvedValue(undefined);
    nextAutoPort.mockImplementation(async (exclude: number[] = []) => {
      for (let port = 4600; port <= 4699; port++) {
        if (!exclude.includes(port)) return { ok: true as const, data: { port } };
      }
      return {
        ok: false as const,
        error: { code: 'NO_PORT_AVAILABLE', message: 'No available port in 4600-4699' },
      };
    });
  });

  it('clones with new ids and the given port', () => {
    const cloned = cloneServerForGalleryImport(createHealthCheckMock(), 4601);
    expect(cloned.id).not.toBe('srv-gallery-health');
    expect(cloned.port).toBe(4601);
    expect(cloned.routes[0]?.id).not.toBe('route-health');
    expect(cloned.samples[0]?.routeId).toBe(cloned.routes[0]?.id);
  });

  it('remaps folder and route folderIds for users sample', () => {
    const cloned = cloneServerForGalleryImport(createUsersApiMock(), 4600);
    expect(cloned.folders[0]?.id).not.toBe('folder-users');
    expect(cloned.routes.every(r => r.folderId === cloned.folders[0]?.id)).toBe(true);
  });

  it('persists, tracks, and dispatches workspace-changed', async () => {
    const events: Event[] = [];
    const onChanged = (e: Event) => events.push(e);
    window.addEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onChanged);

    const template = createHealthCheckMock();
    const result = await importApiMockGalleryServer(template, 'am-gallery-health');

    expect(result.server.port).toBe(4600);
    expect(saveWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      activeServerId: result.server.id,
      servers: [result.server],
    }));
    expect(writeKey).toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect((events[0] as CustomEvent).detail.servers).toHaveLength(1);

    window.removeEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onChanged);
  });

  it('remaps repeated ids, optional predicates, folders, and samples', () => {
    const template = structuredClone(createHealthCheckMock()) as ApiMockServerDefinitionV1;
    template.folders = [
      { id: 'folder-a', name: 'Folder A', expanded: true, sortOrder: 0 },
      { id: 'folder-b', name: 'Folder B', parentId: 'folder-a', expanded: false, sortOrder: 1 },
    ];
    template.routes[0] = {
      ...template.routes[0],
      folderId: 'folder-a',
      predicates: {
        id: '',
        combinator: 'all',
        children: [
          { id: 'route-health', source: 'pathParam', selector: 'id', operator: 'exact', expected: '1' },
        ],
      } satisfies ApiMockPredicateGroupV1,
      responses: [{
        ...template.routes[0].responses[0],
        id: 'route-health',
        conditions: {
          id: '',
          combinator: 'any',
          children: [
            { id: 'route-health', source: 'header', selector: 'x-test', operator: 'present' },
          ],
        } satisfies ApiMockPredicateGroupV1,
      }],
    };
    template.samples = [{
      ...template.samples[0],
      id: 'sample-health',
      routeId: 'route-health',
      expected: {
        ...template.samples[0].expected,
        routeId: 'route-health',
        responseId: 'route-health',
      },
    }];
    template.variables = [{ id: 'variable-health', name: 'TOKEN', value: 'abc' } as never];

    const cloned = cloneServerForGalleryImport(template, 4601);
    expect(cloned.folders).toHaveLength(2);
    expect(cloned.folders[1]?.parentId).toBe(cloned.folders[0]?.id);
    expect(cloned.routes[0]?.folderId).toBe(cloned.folders[0]?.id);
    expect(cloned.routes[0]?.predicates.id).toMatch(/^pg-/);
    expect(cloned.routes[0]?.responses[0]?.conditions?.id).toMatch(/^pg-/);
    expect(cloned.samples[0]?.routeId).toBe(cloned.routes[0]?.id);
    expect(cloned.samples[0]?.expected?.routeId).toBe(cloned.routes[0]?.id);
    expect(cloned.samples[0]?.expected?.responseId).toBe(cloned.routes[0]?.responses[0]?.id);
    expect(cloned.variables[0]?.id).toMatch(/^var-/);
  });

  it('clones sparse gallery definitions without optional arrays', () => {
    const template = {
      id: 'srv-sparse',
      name: 'Sparse mock',
      enabled: true,
      host: '127.0.0.1',
      port: 4600,
      basePath: '',
      routes: [{
        id: 'route-sparse',
        name: 'Sparse route',
        enabled: true,
        method: 'GET',
        path: { kind: 'exact', value: '/sparse' },
        priority: 10,
        predicates: { id: 'pg-sparse', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [{
          id: 'resp-sparse',
          name: 'Sparse response',
          enabled: true,
          isDefault: true,
          status: 200,
          headers: [],
          cookies: [],
          body: { kind: 'text', content: 'ok' },
          behavior: { delayMs: 0, jitterMs: 0 },
        }],
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      }],
      samples: [
        {
          id: 'sample-no-expected',
          name: 'No expected block',
          request: {
            method: 'GET',
            path: '/sparse',
            rawPath: '/sparse',
            query: {},
            headers: {},
            cookies: {},
            body: null,
            bodyTruncated: false,
            receivedAt: '2026-08-13T00:00:00.000Z',
          },
        },
        {
          id: 'sample-no-links',
          name: 'No linked route or response',
          request: {
            method: 'GET',
            path: '/sparse',
            rawPath: '/sparse',
            query: {},
            headers: {},
            cookies: {},
            body: null,
            bodyTruncated: false,
            receivedAt: '2026-08-13T00:00:00.000Z',
          },
          expected: { outcome: 'matched' },
        },
      ],
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    } as ApiMockServerDefinitionV1;

    const cloned = cloneServerForGalleryImport(template, 4600);
    expect(cloned.folders).toEqual([]);
    expect(cloned.samples).toHaveLength(2);
    expect(cloned.samples[0]?.routeId).toBeUndefined();
    expect(cloned.samples[0]?.expected).toBeUndefined();
    expect(cloned.samples[1]?.routeId).toBeUndefined();
    expect(cloned.samples[1]?.expected?.routeId).toBeUndefined();
    expect(cloned.samples[1]?.expected?.responseId).toBeUndefined();
    expect(cloned.variables).toEqual([]);
    expect(cloned.routes[0]?.folderId).toBeUndefined();
    expect(cloned.routes[0]?.responses[0]?.conditions).toBeUndefined();
  });

  it('imports using existing ports and remaps the port callback', async () => {
    loadWorkspace.mockResolvedValue({
      servers: [createHealthCheckMock()],
      activeServerId: 'srv-gallery-health',
    });

    const result = await importApiMockGalleryServer(createUsersApiMock(), 'am-gallery-users');

    expect(result.server.port).toBe(4601);
    expect(saveWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      servers: expect.arrayContaining([
        expect.objectContaining({ port: 4600 }),
        expect.objectContaining({ port: 4601 }),
      ]),
      activeServerId: result.server.id,
    }));
  });

  it('keeps unmapped sample route/response links unchanged and handles missing samples', () => {
    const withUnknownLinks = structuredClone(createHealthCheckMock()) as ApiMockServerDefinitionV1;
    withUnknownLinks.samples = [{
      ...withUnknownLinks.samples[0],
      id: 'sample-unknown-links',
      routeId: 'route-not-in-routes',
      expected: {
        ...withUnknownLinks.samples[0].expected,
        routeId: 'route-not-in-routes',
        responseId: 'resp-not-in-routes',
      },
    }];

    const clonedUnknown = cloneServerForGalleryImport(withUnknownLinks, 4600);
    expect(clonedUnknown.samples[0]?.routeId).toBe('route-not-in-routes');
    expect(clonedUnknown.samples[0]?.expected?.routeId).toBe('route-not-in-routes');
    expect(clonedUnknown.samples[0]?.expected?.responseId).toBe('resp-not-in-routes');

    const withoutSamples = structuredClone(createHealthCheckMock()) as ApiMockServerDefinitionV1;
    withoutSamples.samples = undefined;
    const clonedNoSamples = cloneServerForGalleryImport(withoutSamples, 4601);
    expect(clonedNoSamples.samples).toEqual([]);
  });

  it('reads tracking with parse errors, non-objects, and valid state', async () => {
    readKey.mockResolvedValueOnce('');
    await expect(loadGalleryImportTracking()).resolves.toEqual({});

    readKey.mockResolvedValueOnce('not-json');
    await expect(loadGalleryImportTracking()).resolves.toEqual({});

    readKey.mockResolvedValueOnce('"string"');
    await expect(loadGalleryImportTracking()).resolves.toEqual({});

    readKey.mockResolvedValueOnce('{"sample-a":"hash-a"}');
    await expect(loadGalleryImportTracking()).resolves.toEqual({ 'sample-a': 'hash-a' });
  });

  it('writes tracking entries and skips workspace events without a window', async () => {
    await markGallerySampleImported('sample-b', 'hash-b');
    expect(writeKey).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ 'sample-b': 'hash-b' }),
      { notifyOnQuotaExhausted: false },
    );

    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    expect(() => dispatchApiMockWorkspaceChanged({ servers: [], activeServerId: undefined })).not.toThrow();
    vi.stubGlobal('window', originalWindow);
  });

  it('rejects when tab ceiling is reached', async () => {
    loadWorkspace.mockResolvedValue({
      servers: Array.from({ length: 8 }, (_, i) => ({
        ...createHealthCheckMock(),
        id: `srv-${i}`,
        port: 4600 + i,
      })),
    });
    await expect(importApiMockGalleryServer(createHealthCheckMock(), 'am-gallery-health'))
      .rejects.toThrow(/at most 8/);
  });

  it('rejects when nextAutoPort fails with explicit and fallback messages', async () => {
    nextAutoPort.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NO_PORT_AVAILABLE', message: 'no port left' },
    });
    await expect(importApiMockGalleryServer(createHealthCheckMock(), 'am-gallery-health'))
      .rejects.toThrow('no port left');

    nextAutoPort.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NO_PORT_AVAILABLE', message: '' },
    });
    await expect(importApiMockGalleryServer(createHealthCheckMock(), 'am-gallery-health'))
      .rejects.toThrow('No available mock port in 4600–4699.');
  });
});
