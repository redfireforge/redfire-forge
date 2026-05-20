import { describe, it, expect } from 'vitest';
import { getEndpointVersionInfo, getNewEndpointsCount, buildVersionInfoMap } from './versionStatus';
import { RequestCollection, RequestItem } from '../../../shared/types';
import { CatalogEndpoint, HttpMethod as CatMethod } from '../types/catalog';

function makeReq(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'r1', name: 'Test', method: 'GET', url: '/pets',
    headers: [], body: '', auth: { type: 'none' },
    ...overrides,
  };
}

function makeCol(requests: RequestItem[], overrides?: Partial<RequestCollection>): RequestCollection {
  return {
    id: 'col1', name: 'Col', mode: 'direct', requests, folders: [],
    ...overrides,
  };
}

function makeEndpoint(id: string, method: CatMethod = 'GET', path = '/pets'): CatalogEndpoint {
  return {
    id, method, path, summary: '', description: '', tags: [],
    parameters: [], responses: [], deprecated: false, security: [],
  };
}

describe('versionStatus', () => {
  describe('getEndpointVersionInfo', () => {
    it('returns "new" when no matching requests exist', () => {
      const col = makeCol([makeReq()]);
      expect(getEndpointVersionInfo('ep-123', [col])).toEqual({ status: 'new' });
    });

    it('returns "exported" with version when matching request found', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'ep-123',
          catalogVersion: '1.0.7',
          originalPath: '/pets',
          tags: [],
        },
      });
      const col = makeCol([req]);
      expect(getEndpointVersionInfo('ep-123', [col])).toEqual({
        status: 'exported',
        exportedVersion: '1.0.7',
      });
    });

    it('returns "exported" without version when catalogVersion is missing', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'ep-123',
          originalPath: '/pets',
          tags: [],
        },
      });
      const col = makeCol([req]);
      const info = getEndpointVersionInfo('ep-123', [col]);
      expect(info.status).toBe('exported');
      expect(info.exportedVersion).toBeUndefined();
    });

    it('finds requests in nested folders', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'ep-deep',
          catalogVersion: '2.0.0',
          originalPath: '/deep',
          tags: [],
        },
      });
      const col: RequestCollection = {
        id: 'c1', name: 'C', mode: 'direct', requests: [],
        folders: [{ id: 'f1', name: 'F', requests: [req], folders: [] }],
      };
      expect(getEndpointVersionInfo('ep-deep', [col])).toEqual({
        status: 'exported',
        exportedVersion: '2.0.0',
      });
    });

    it('handles collections whose folder tree metadata is uninitialized', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'ep-orphan',
          catalogVersion: '0.9.0',
          originalPath: '/z',
          tags: [],
        },
      });
      const col = {
        id: 'col-raw',
        name: 'Raw',
        mode: 'direct' as const,
        requests: [req],
        folders: undefined,
      } as unknown as RequestCollection;

      expect(getEndpointVersionInfo('ep-orphan', [col]).status).toBe('exported');
    });

    it('searches across multiple collections', () => {
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'ep-456',
          catalogVersion: '1.0.0',
          originalPath: '/users',
          tags: [],
        },
      });
      const col1 = makeCol([], { id: 'c1' });
      const col2 = makeCol([req], { id: 'c2' });
      expect(getEndpointVersionInfo('ep-456', [col1, col2]).status).toBe('exported');
    });
  });

  describe('getNewEndpointsCount', () => {
    it('counts all as new when no exports exist', () => {
      const eps = [makeEndpoint('a'), makeEndpoint('b'), makeEndpoint('c')];
      expect(getNewEndpointsCount(eps, [])).toBe(3);
    });

    it('excludes exported endpoints from new count', () => {
      const eps = [makeEndpoint('a'), makeEndpoint('b')];
      const req = makeReq({
        catalogMeta: { catalogEndpointId: 'a', catalogVersion: '1.0', originalPath: '/x', tags: [] },
      });
      expect(getNewEndpointsCount(eps, [makeCol([req])])).toBe(1);
    });

    it('returns 0 when all are exported', () => {
      const eps = [makeEndpoint('a')];
      const req = makeReq({
        catalogMeta: { catalogEndpointId: 'a', catalogVersion: '1.0', originalPath: '/x', tags: [] },
      });
      expect(getNewEndpointsCount(eps, [makeCol([req])])).toBe(0);
    });
  });

  describe('buildVersionInfoMap', () => {
    it('builds a map for all endpoints', () => {
      const eps = [makeEndpoint('a'), makeEndpoint('b')];
      const req = makeReq({
        catalogMeta: { catalogEndpointId: 'a', catalogVersion: '1.0.5', originalPath: '/x', tags: [] },
      });
      const map = buildVersionInfoMap(eps, [makeCol([req])]);
      expect(map.get('a')).toEqual({ status: 'exported', exportedVersion: '1.0.5' });
      expect(map.get('b')).toEqual({ status: 'new' });
    });

    it('returns empty map for no endpoints', () => {
      expect(buildVersionInfoMap([], []).size).toBe(0);
    });

    it('ignores requests whose catalog meta omits catalogEndpointId when building lookups', () => {
      const ep = makeEndpoint('ep-meta');
      const noise = makeReq({
        catalogMeta: {
          catalogEndpointId: undefined as unknown as string,
          originalPath: '/x',
          tags: [],
        },
      });
      const map = buildVersionInfoMap([ep], [makeCol([noise])]);
      expect(map.get('ep-meta')).toEqual({ status: 'new' });
    });

    it('prefers exported version even when duplicates exist for same endpoint', () => {
      const ep = makeEndpoint('dup');
      const older = makeReq({
        catalogMeta: {
          catalogEndpointId: 'dup',
          catalogVersion: 'old',
          originalPath: '/a',
          tags: [],
        },
      });
      const newer = makeReq({
        catalogMeta: {
          catalogEndpointId: 'dup',
          catalogVersion: 'new',
          originalPath: '/b',
          tags: [],
        },
      });
      const map = buildVersionInfoMap([ep], [makeCol([older, newer])]);
      expect(map.get('dup')).toEqual({ status: 'exported', exportedVersion: 'old' });
    });

    it('tracks exports when catalogVersion field is absent', () => {
      const ep = makeEndpoint('no-semver');
      const req = makeReq({
        catalogMeta: {
          catalogEndpointId: 'no-semver',
          originalPath: '/y',
          tags: [],
        },
      });
      expect(buildVersionInfoMap([ep], [makeCol([req])]).get('no-semver')).toEqual({
        status: 'exported',
        exportedVersion: undefined,
      });
    });

    it('builds lookup map using nested exported requests', () => {
      const ep = makeEndpoint('ep-nested');
      const req = makeReq({
        catalogMeta: { catalogEndpointId: 'ep-nested', catalogVersion: '7', originalPath: '/n', tags: [] },
      });
      const col: RequestCollection = {
        id: 'c-root',
        name: 'Root',
        mode: 'direct',
        requests: [],
        folders: [{
          id: 'f',
          name: 'Folder',
          requests: [],
          folders: [{
            id: 'inner',
            name: 'Inner',
            requests: [req],
            folders: [],
          }],
        }],
      };
      expect(buildVersionInfoMap([ep], [col]).get('ep-nested')).toEqual({
        status: 'exported',
        exportedVersion: '7',
      });
    });
  });
});
