import { describe, it, expect } from 'vitest';
import { aggregatePublishedEndpoints, filterPublishedEndpoints, type PublishedEndpointItem } from './publishedEndpointAggregator';
import type { CatalogEntry, CatalogEndpoint, WorkflowPublication } from '../types/catalog';

function makePub(overrides?: Partial<WorkflowPublication>): WorkflowPublication {
  return {
    publishedAt: Date.now(),
    publishedFromVersionId: 'v1',
    ...overrides,
  };
}

function makeEp(id: string, method: string, path: string, pub?: WorkflowPublication): CatalogEndpoint {
  return {
    id,
    method: method as CatalogEndpoint['method'],
    path,
    summary: `${method} ${path}`,
    parameters: [],
    responses: [],
    tags: [],
    workflowPublication: pub,
  };
}

function makeEntry(id: string, name: string, endpoints: CatalogEndpoint[], currentVersionId = 'v1'): CatalogEntry {
  return {
    id,
    name,
    currentVersionId,
    versions: [{ id: currentVersionId, version: '1.0.0', importedAt: Date.now(), specHash: 'abc', specSize: 100 }],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints,
    hostConfig: { baseUrl: '', environmentId: undefined, microserviceId: undefined },
    authConfig: { type: 'none' },
  };
}

describe('aggregatePublishedEndpoints', () => {
  it('returns empty array for no entries', () => {
    expect(aggregatePublishedEndpoints([])).toEqual([]);
  });

  it('returns empty array when no endpoints are published', () => {
    const entry = makeEntry('e1', 'API A', [makeEp('ep1', 'GET', '/foo')]);
    expect(aggregatePublishedEndpoints([entry])).toEqual([]);
  });

  it('collects published endpoints from top-level', () => {
    const pub = makePub();
    const entry = makeEntry('e1', 'API A', [
      makeEp('ep1', 'GET', '/foo', pub),
      makeEp('ep2', 'POST', '/bar'),
    ]);
    const result = aggregatePublishedEndpoints([entry]);
    expect(result).toHaveLength(1);
    expect(result[0].endpointId).toBe('ep1');
    expect(result[0].entryName).toBe('API A');
    expect(result[0].method).toBe('GET');
    expect(result[0].isStale).toBe(false);
  });

  it('detects stale endpoints (version mismatch)', () => {
    const pub = makePub({ publishedFromVersionId: 'v-old' });
    const entry = makeEntry('e1', 'API A', [makeEp('ep1', 'GET', '/foo', pub)], 'v-current');
    const result = aggregatePublishedEndpoints([entry]);
    expect(result).toHaveLength(1);
    expect(result[0].isStale).toBe(true);
  });

  it('collects endpoints from folders', () => {
    const pub = makePub();
    const entry: CatalogEntry = {
      ...makeEntry('e1', 'API A', []),
      folders: [{
        id: 'f1',
        name: 'Folder',
        endpoints: [makeEp('ep-f1', 'DELETE', '/item', pub)],
        folders: [{
          id: 'f2',
          name: 'Nested',
          endpoints: [makeEp('ep-f2', 'PUT', '/nested', pub)],
          folders: [],
        }],
      }],
    };
    const result = aggregatePublishedEndpoints([entry]);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.endpointId).sort()).toEqual(['ep-f1', 'ep-f2']);
  });

  it('aggregates across multiple entries', () => {
    const pub = makePub();
    const e1 = makeEntry('e1', 'API A', [makeEp('ep1', 'GET', '/a', pub)]);
    const e2 = makeEntry('e2', 'API B', [makeEp('ep2', 'POST', '/b', pub)]);
    const result = aggregatePublishedEndpoints([e1, e2]);
    expect(result).toHaveLength(2);
    expect(result[0].entryName).toBe('API A');
    expect(result[1].entryName).toBe('API B');
  });
});

describe('filterPublishedEndpoints', () => {
  const items: PublishedEndpointItem[] = [
    { entryId: 'e1', entryName: 'Users API', endpointId: 'ep1', method: 'GET', path: '/users', summary: 'List users', currentVersionId: 'v1', publication: makePub(), isStale: false },
    { entryId: 'e1', entryName: 'Users API', endpointId: 'ep2', method: 'POST', path: '/users', summary: 'Create user', currentVersionId: 'v1', publication: makePub({ publishedFromVersionId: 'v-old' }), isStale: true },
    { entryId: 'e2', entryName: 'Orders API', endpointId: 'ep3', method: 'DELETE', path: '/orders/{id}', summary: 'Delete order', currentVersionId: 'v2', publication: makePub(), isStale: false },
  ];

  it('returns all items when no filter applied', () => {
    expect(filterPublishedEndpoints(items, '', 'all')).toHaveLength(3);
  });

  it('filters by status: current', () => {
    const result = filterPublishedEndpoints(items, '', 'current');
    expect(result).toHaveLength(2);
    expect(result.every(i => !i.isStale)).toBe(true);
  });

  it('filters by status: stale', () => {
    const result = filterPublishedEndpoints(items, '', 'stale');
    expect(result).toHaveLength(1);
    expect(result[0].endpointId).toBe('ep2');
  });

  it('searches by method', () => {
    expect(filterPublishedEndpoints(items, 'DELETE', 'all')).toHaveLength(1);
  });

  it('searches by path', () => {
    expect(filterPublishedEndpoints(items, '/users', 'all')).toHaveLength(2);
  });

  it('searches by summary', () => {
    expect(filterPublishedEndpoints(items, 'create user', 'all')).toHaveLength(1);
  });

  it('searches by API name', () => {
    expect(filterPublishedEndpoints(items, 'orders', 'all')).toHaveLength(1);
  });

  it('combines search and status filter', () => {
    const result = filterPublishedEndpoints(items, 'users', 'stale');
    expect(result).toHaveLength(1);
    expect(result[0].endpointId).toBe('ep2');
  });

  it('trims whitespace from search query', () => {
    expect(filterPublishedEndpoints(items, '  GET  ', 'all')).toHaveLength(1);
  });

  it('returns empty for non-matching search', () => {
    expect(filterPublishedEndpoints(items, 'zzz-nonexistent', 'all')).toHaveLength(0);
  });
});
