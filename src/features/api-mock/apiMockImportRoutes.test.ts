import { describe, it, expect, vi, beforeAll } from 'vitest';
import { prepareImportedRoutes } from './apiMockImportRoutes';
import type { ApiMockServerDefinitionV1, ApiMockRouteV1 } from '@shared/api-mock/contracts';

// Minimal mock for crypto.randomUUID used inside the module
let uuidCounter = 0;
beforeAll(() => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `00000000-0000-0000-0000-${String(++uuidCounter).padStart(12, '0')}` as ReturnType<typeof crypto.randomUUID>,
  );
});

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'rte-original',
    name: 'GET /foo',
    enabled: true,
    method: 'GET',
    path: { type: 'exact', value: '/foo' },
    priority: 0,
    predicates: { groups: [] },
    responseMode: 'sequence',
    responses: [{ id: 'rsp-original', name: '200 OK', enabled: true, delay: { type: 'none' }, fault: { type: 'none' }, body: { mode: 'static', static: '{}' }, status: 200, headers: [] }],
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Test Server',
    enabled: true,
    host: '127.0.0.1',
    port: 8080,
    basePath: '/',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: {} as ApiMockServerDefinitionV1['settings'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('prepareImportedRoutes', () => {
  it('merge mode — appends routes to existing routes', () => {
    const existingRoute = makeRoute({ id: 'rte-existing', name: 'existing' });
    const importedRoute = makeRoute({ id: 'rte-import', name: 'imported' });
    const server = makeServer({ routes: [existingRoute] });

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'merge' },
    });

    expect(result.nextRoutes).toHaveLength(2);
    expect(result.nextRoutes[0].id).toBe('rte-existing');
    expect(result.nextRoutes[1].id).toBe('rte-import');
    expect(result.importedCount).toBe(1);
    expect(result.selectedRouteId).toBe('rte-import');
    expect(result.nextFolders).toEqual([]);
  });

  it('replace mode — replaces all existing routes', () => {
    const existingRoute = makeRoute({ id: 'rte-existing' });
    const importedRoute = makeRoute({ id: 'rte-import' });
    const server = makeServer({ routes: [existingRoute] });

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'replace' },
    });

    expect(result.nextRoutes).toHaveLength(1);
    expect(result.nextRoutes[0].id).toBe('rte-import');
    expect(result.importedCount).toBe(1);
  });

  it('copy mode — generates new ids for routes and responses', () => {
    const importedRoute = makeRoute({ id: 'rte-source', name: 'Original' });
    const server = makeServer();

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'copy' },
    });

    expect(result.nextRoutes).toHaveLength(1);
    expect(result.nextRoutes[0].id).not.toBe('rte-source');
    expect(result.nextRoutes[0].name).toBe('Original (copy)');
    expect(result.nextRoutes[0].responses[0].id).not.toBe('rsp-original');
    expect(result.importedCount).toBe(1);
  });

  it('newFolderName — creates a new folder and assigns routes to it', () => {
    const importedRoute = makeRoute({ id: 'rte-import' });
    const server = makeServer();

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'merge', newFolderName: 'Imported Folder' },
    });

    expect(result.nextFolders).toHaveLength(1);
    expect(result.nextFolders[0].name).toBe('Imported Folder');
    expect(result.nextFolders[0].expanded).toBe(true);
    expect(result.nextFolders[0].sortOrder).toBe(0);
    const folderId = result.nextFolders[0].id;
    expect(result.nextRoutes[0].folderId).toBe(folderId);
  });

  it('newFolderName + copy — copies routes into new folder with new ids', () => {
    const importedRoute = makeRoute({ id: 'rte-source', name: 'My Route' });
    const server = makeServer();

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'copy', newFolderName: 'Copied Folder' },
    });

    expect(result.nextFolders).toHaveLength(1);
    expect(result.nextRoutes[0].name).toBe('My Route (copy)');
    expect(result.nextRoutes[0].id).not.toBe('rte-source');
    const folderId = result.nextFolders[0].id;
    expect(result.nextRoutes[0].folderId).toBe(folderId);
  });

  it('preserves existing folders when adding a new folder', () => {
    const existingFolder = { id: 'fld-old', name: 'Old Folder', expanded: false, sortOrder: 0 };
    const server = makeServer({ folders: [existingFolder] });
    const importedRoute = makeRoute({ id: 'rte-import' });

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'merge', newFolderName: 'New Folder' },
    });

    expect(result.nextFolders).toHaveLength(2);
    expect(result.nextFolders[0].id).toBe('fld-old');
    expect(result.nextFolders[1].name).toBe('New Folder');
    expect(result.nextFolders[1].sortOrder).toBe(1);
  });

  it('selectedRouteId is the first prepared route id', () => {
    const r1 = makeRoute({ id: 'rte-a' });
    const r2 = makeRoute({ id: 'rte-b' });
    const server = makeServer();

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [r1, r2],
      options: { mode: 'merge' },
    });

    expect(result.selectedRouteId).toBe('rte-a');
    expect(result.importedCount).toBe(2);
  });

  it('no newFolderName — folders are unchanged', () => {
    const existingFolder = { id: 'fld-1', name: 'Existing', expanded: true, sortOrder: 0 };
    const server = makeServer({ folders: [existingFolder] });
    const importedRoute = makeRoute({ id: 'rte-import' });

    const result = prepareImportedRoutes({
      activeServer: server,
      routes: [importedRoute],
      options: { mode: 'merge' },
    });

    expect(result.nextFolders).toHaveLength(1);
    expect(result.nextFolders[0].id).toBe('fld-1');
    expect(result.nextRoutes[0].folderId).toBeUndefined();
  });
});
