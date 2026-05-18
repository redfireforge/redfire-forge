import { describe, it, expect } from 'vitest';
import { buildCoverageMap, getEndpointCoverage, coverageKey } from './coverageChecker';
import type { RequestCollection, RequestItem } from '../../../shared/types';

function makeReq(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'r1',
    name: 'Test',
    method: 'GET',
    url: '/pets',
    headers: [],
    body: '',
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeCol(requests: RequestItem[], folders?: RequestCollection['folders'], overrides?: Partial<RequestCollection>): RequestCollection {
  return {
    id: 'col1',
    name: 'Test Collection',
    mode: 'direct',
    requests,
    folders: folders ?? [],
    ...overrides,
  };
}

describe('coverageChecker', () => {
  describe('coverageKey', () => {
    it('produces METHOD + path string', () => {
      expect(coverageKey('GET', '/pets/{petId}')).toBe('GET /pets/{petId}');
    });
  });

  describe('buildCoverageMap', () => {
    it('returns empty map when no collections match', () => {
      const map = buildCoverageMap('entry-1', 'Petstore', []);
      expect(map.size).toBe(0);
    });

    it('matches by catalogEntryId when present', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEntryId: 'entry-1',
          originalPath: '/pets/{petId}',
          tags: ['pets'],
          sourceSpec: 'Petstore 1.0.7',
        },
      });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      const cov = map.get('GET /pets/{petId}')!;
      expect(cov.exported).toBe(true);
      expect(cov.count).toBe(1);
      expect(cov.locations).toHaveLength(1);
      expect(cov.locations[0].collectionName).toBe('Test Collection');
      expect(cov.locations[0].requestId).toBe('r1');
    });

    it('falls back to sourceSpec prefix match when no catalogEntryId', () => {
      const req = makeReq({
        catalogMeta: {
          originalPath: '/pets/{petId}',
          tags: ['pets'],
          sourceSpec: 'Petstore 1.0.7',
        },
      });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.get('GET /pets/{petId}')!.exported).toBe(true);
    });

    it('counts matching requests by originalPath + method', () => {
      const req1 = makeReq({
        id: 'r1',
        name: 'Req 1',
        method: 'GET',
        catalogMeta: {
          catalogEntryId: 'entry-1',
          originalPath: '/pets/{petId}',
          tags: ['pets'],
        },
      });
      const req2 = makeReq({
        id: 'r2',
        name: 'Req 2',
        method: 'GET',
        catalogMeta: {
          catalogEntryId: 'entry-1',
          originalPath: '/pets/{petId}',
          tags: ['pets'],
        },
      });
      const col = makeCol([req1, req2]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);

      const cov = map.get('GET /pets/{petId}')!;
      expect(cov.count).toBe(2);
      expect(cov.locations).toHaveLength(2);
    });

    it('ignores requests from a different entry', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEntryId: 'entry-other',
          originalPath: '/users',
          tags: [],
          sourceSpec: 'Other API',
        },
      });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.size).toBe(0);
    });

    it('ignores requests without catalogMeta', () => {
      const req = makeReq({ catalogMeta: undefined });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.size).toBe(0);
    });

    it('skips rows whose originalPath is blank', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEntryId: 'entry-1',
          originalPath: '',
          tags: [],
        },
      });
      expect(buildCoverageMap('entry-1', 'Petstore', [makeCol([req])]).size).toBe(0);
    });

    it('walks only root requests when folders property is absent', () => {
      const req = makeReq({
        catalogMeta: { catalogEntryId: 'entry-1', originalPath: '/only-root', tags: [] },
      });
      const loose = { id: 'loose', name: 'Loose', mode: 'direct' as const, requests: [req] } as RequestCollection;
      const map = buildCoverageMap('entry-1', 'Petstore', [loose]);
      expect(map.get('GET /only-root')!.count).toBe(1);
    });

    it('finds requests inside nested folders', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEntryId: 'entry-1',
          originalPath: '/pets',
          tags: [],
        },
      });
      const col = makeCol([], [
        {
          id: 'f1', name: 'Folder', requests: [],
          folders: [{ id: 'f2', name: 'Sub', requests: [req], folders: [] }],
        },
      ]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      const cov = map.get('GET /pets')!;
      expect(cov.count).toBe(1);
      expect(cov.locations[0].folderPath).toBe('Test Collection / Folder / Sub / Test');
      expect(cov.locations[0].folderId).toBe('f2');
    });

    it('includes folderPath for root-level requests', () => {
      const req = makeReq({
        name: 'Get Pet',
        catalogMeta: { catalogEntryId: 'entry-1', originalPath: '/pets', tags: [] },
      });
      const col = makeCol([req], [], { name: 'My API' });
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.get('GET /pets')!.locations[0].folderPath).toBe('My API / Get Pet');
    });

    it('counts across multiple collections and tracks locations', () => {
      const meta = {
        catalogEntryId: 'entry-1',
        originalPath: '/pets',
        tags: [] as string[],
      };
      const col1 = makeCol([makeReq({ id: 'r1', name: 'A' , catalogMeta: meta })], [], { id: 'col-a', name: 'Collection A' });
      const col2 = makeCol([makeReq({ id: 'r2', name: 'B', catalogMeta: meta })], [], { id: 'col-b', name: 'Collection B' });
      const map = buildCoverageMap('entry-1', 'Petstore', [col1, col2]);
      const cov = map.get('GET /pets')!;
      expect(cov.count).toBe(2);
      expect(cov.locations).toHaveLength(2);
      expect(cov.locations.map(l => l.collectionName)).toEqual(['Collection A', 'Collection B']);
    });

    it('distinguishes different methods for the same path', () => {
      const col = makeCol([
        makeReq({ id: 'r1', method: 'GET', catalogMeta: { catalogEntryId: 'entry-1', originalPath: '/pets', tags: [] } }),
        makeReq({ id: 'r2', method: 'POST', catalogMeta: { catalogEntryId: 'entry-1', originalPath: '/pets', tags: [] } }),
      ]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.size).toBe(2);
      expect(map.get('GET /pets')!.count).toBe(1);
      expect(map.get('POST /pets')!.count).toBe(1);
    });

    it('does not match when sourceSpec does not start with entryName', () => {
      const req = makeReq({
        catalogMeta: {
          originalPath: '/users',
          tags: [],
          sourceSpec: 'Completely Different API',
        },
      });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.size).toBe(0);
    });

    it('matches old requests exported before catalogEntryId existed', () => {
      const req = makeReq({
        catalogMeta: {
          originalPath: '/pets',
          tags: [],
          sourceSpec: 'Petstore',
        },
      });
      const col = makeCol([req]);
      const map = buildCoverageMap('entry-1', 'Petstore', [col]);
      expect(map.get('GET /pets')!.exported).toBe(true);
    });
  });

  describe('getEndpointCoverage', () => {
    it('returns coverage when endpoint is in map', () => {
      const map = new Map([['GET /pets', { exported: true, count: 3, locations: [] }]]);
      expect(getEndpointCoverage('GET', '/pets', map)).toEqual({ exported: true, count: 3, locations: [] });
    });

    it('returns default when endpoint is not in map', () => {
      const map = new Map<string, { exported: boolean; count: number; locations: never[] }>();
      expect(getEndpointCoverage('DELETE', '/pets', map)).toEqual({ exported: false, count: 0, locations: [] });
    });
  });
});
