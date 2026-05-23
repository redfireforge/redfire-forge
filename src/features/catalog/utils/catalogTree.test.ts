import { describe, it, expect } from 'vitest';
import { findEndpointInEntry, findEndpointInFolders } from './catalogTree';
import type { CatalogEntry, CatalogEndpoint, CatalogFolder } from '../types/catalog';

function makeEndpoint(id: string, overrides: Partial<CatalogEndpoint> = {}): CatalogEndpoint {
  return {
    id,
    summary: `Endpoint ${id}`,
    method: 'GET',
    path: `/api/${id}`,
    parameters: [],
    responses: [],
    ...overrides,
  };
}

function makeFolder(
  id: string,
  endpoints: CatalogEndpoint[] = [],
  folders: CatalogFolder[] = [],
): CatalogFolder {
  return { id, name: id, endpoints, folders };
}

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'entry-1',
    name: 'Catalog',
    currentVersionId: 'v1',
    versions: [],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { mode: 'direct', baseUrl: 'https://api.example.com' },
    authConfig: { type: 'none' },
    ...overrides,
  };
}

describe('findEndpointInEntry', () => {
  it('finds endpoint at root level', () => {
    const root = makeEndpoint('ep-root');
    const entry = makeEntry({ endpoints: [root] });
    expect(findEndpointInEntry(entry, 'ep-root')).toBe(root);
  });

  it('finds endpoint in nested folder', () => {
    const nested = makeEndpoint('ep-nested');
    const entry = makeEntry({
      folders: [
        makeFolder('f1', [], [
          makeFolder('f2', [nested]),
        ]),
      ],
    });
    expect(findEndpointInEntry(entry, 'ep-nested')).toBe(nested);
  });

  it('returns undefined when endpoint is not found', () => {
    const entry = makeEntry({
      endpoints: [makeEndpoint('other')],
      folders: [makeFolder('f1', [makeEndpoint('folder-ep')])],
    });
    expect(findEndpointInEntry(entry, 'missing')).toBeUndefined();
  });

  it('searches folders when entry.folders is undefined', () => {
    const root = makeEndpoint('ep-only-root');
    const entry = makeEntry({ endpoints: [root], folders: undefined as unknown as CatalogFolder[] });
    expect(findEndpointInEntry(entry, 'ep-only-root')).toBe(root);
    expect(findEndpointInEntry(entry, 'missing')).toBeUndefined();
  });
});

describe('findEndpointInFolders', () => {
  it('returns undefined for empty folders array', () => {
    expect(findEndpointInFolders([], 'any')).toBeUndefined();
  });

  it('finds endpoint in deeply nested folders (3+ levels)', () => {
    const deep = makeEndpoint('ep-deep');
    const folders: CatalogFolder[] = [
      makeFolder('l1', [], [
        makeFolder('l2', [], [
          makeFolder('l3', [deep]),
        ]),
      ]),
    ];
    expect(findEndpointInFolders(folders, 'ep-deep')).toBe(deep);
  });

  it('handles folder with no folders property (undefined guard)', () => {
    const direct = makeEndpoint('ep-direct');
    const folder = { id: 'leaf', name: 'Leaf', endpoints: [direct] } as CatalogFolder;
    expect(findEndpointInFolders([folder], 'ep-direct')).toBe(direct);
    expect(findEndpointInFolders([folder], 'missing')).toBeUndefined();
  });

  it('finds endpoint in sibling folder after scanning earlier folders', () => {
    const target = makeEndpoint('target');
    const folders = [
      makeFolder('empty', []),
      makeFolder('with-endpoint', [target]),
    ];
    expect(findEndpointInFolders(folders, 'target')).toBe(target);
  });
});
