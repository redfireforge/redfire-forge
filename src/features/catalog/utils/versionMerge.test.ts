import { describe, it, expect } from 'vitest';
import type { RequestFolder, RequestItem, RequestCollection } from '../../../shared/types';
import {
  buildSpecVersion,
  applySpecVersion,
  mergeExportIntoCollections,
  isCollectionEmpty,
} from './versionMerge';

function makeRequest(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.com/users',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: '',
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeCollection(overrides: Partial<RequestCollection> = {}): RequestCollection {
  return {
    id: 'col-1',
    name: 'Test Collection',
    mode: 'direct',
    requests: [],
    ...overrides,
  };
}

describe('buildSpecVersion', () => {
  it('creates a snapshot with correct catalog fields', () => {
    const req = makeRequest({
      url: 'https://api.com/v2/users',
      method: 'POST',
      catalogMeta: {
        catalogEndpointId: 'ep-1',
        originalPath: '/users',
        tags: [],
      },
    });

    const sv = buildSpecVersion(req, '1.0.7', 'entry-abc');
    expect(sv.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sv.catalogVersion).toBe('1.0.7');
    expect(sv.catalogEntryId).toBe('entry-abc');
    expect(sv.catalogEndpointId).toBe('ep-1');
    expect(sv.url).toBe('https://api.com/v2/users');
    expect(sv.method).toBe('POST');
    expect(sv.importedAt).toBeGreaterThan(0);
  });

  it('sets catalogEndpointId to empty string when snapshot has no catalogMeta', () => {
    const sv = buildSpecVersion(makeRequest(), '1', 'entry');
    expect(sv.catalogEndpointId).toBe('');
  });

  it('captures headers, body, params in snapshot', () => {
    const req = makeRequest({
      headers: [{ key: 'X-Api-Key', value: '123' }],
      body: '{"name":"test"}',
      bodyType: 'json',
      savedQueryParams: [{ key: 'q', value: 'hello', enabled: true }],
      savedPathParams: [{ key: 'id', value: '42' }],
      catalogMeta: { catalogEndpointId: 'ep-2', originalPath: '/items', tags: [] },
    });
    const sv = buildSpecVersion(req, '2.0.0', 'entry-1');
    expect(sv.headers).toEqual(req.headers);
    expect(sv.body).toBe('{"name":"test"}');
    expect(sv.bodyType).toBe('json');
    expect(sv.savedQueryParams).toEqual(req.savedQueryParams);
    expect(sv.savedPathParams).toEqual(req.savedPathParams);
  });

  it('copies optional bodyForm into snapshot when set', () => {
    const req = makeRequest({
      bodyForm: [{ key: 'k', value: 'v' }],
      catalogMeta: { catalogEndpointId: 'bf', originalPath: '/form', tags: [] },
    });
    expect(buildSpecVersion(req, '1', 'entry').bodyForm).toEqual([{ key: 'k', value: 'v' }]);
  });
});

describe('applySpecVersion', () => {
  it('includes saved path params when present on snapshot', () => {
    const sv = {
      id: 'sv-p',
      catalogVersion: '1',
      catalogEntryId: 'e',
      catalogEndpointId: 'ep',
      importedAt: Date.now(),
      url: '/a',
      method: 'GET' as const,
      headers: [],
      body: '',
      savedPathParams: [{ key: 'x', value: 'y' }],
    };
    expect(applySpecVersion(sv).savedPathParams).toEqual([{ key: 'x', value: 'y' }]);
  });

  it('produces a patch with all snapshot fields', () => {
    const sv = {
      id: 'sv-1',
      catalogVersion: '1.0.0',
      catalogEntryId: 'entry-1',
      catalogEndpointId: 'ep-1',
      importedAt: Date.now(),
      url: 'https://new.api.com/users',
      method: 'PUT' as const,
      headers: [{ key: 'Authorization', value: 'Bearer x' }],
      body: '{"updated":true}',
      bodyType: 'json' as const,
      bodyForm: [{ key: 'a', value: 'b' }],
      savedQueryParams: [{ key: 'page', value: '2', enabled: true }],
      savedPathParams: undefined,
    };

    const patch = applySpecVersion(sv);
    expect(patch.url).toBe('https://new.api.com/users');
    expect(patch.method).toBe('PUT');
    expect(patch.headers).toEqual(sv.headers);
    expect(patch.body).toBe('{"updated":true}');
    expect(patch.bodyForm).toEqual([{ key: 'a', value: 'b' }]);
    expect(patch.activeSpecVersionId).toBe('sv-1');
  });
});

describe('mergeExportIntoCollections', () => {
  it('skips exported rows missing catalogEndpointId', () => {
    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEntryId: 'entry-1', originalPath: '/a', tags: [] },
        }),
      ],
    });
    const noneId = mergeExportIntoCollections(exported, [], '1.0.0', 'entry-1');
    expect(noneId.mergedCount).toBe(0);
    expect(noneId.newCount).toBe(1);

    const noMeta = makeCollection({ requests: [makeRequest()] });
    expect(mergeExportIntoCollections(noMeta, [], '1.0.0', 'entry-1').mergedCount).toBe(0);
  });

  it('returns all new when no existing collections', () => {
    const exported = makeCollection({
      id: 'new-col',
      requests: [
        makeRequest({ catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/a', tags: [] } }),
      ],
    });

    const result = mergeExportIntoCollections(exported, [], '1.0.0', 'entry-1');
    expect(result.mergedCount).toBe(0);
    expect(result.newCount).toBe(1);
    expect(result.updates).toHaveLength(0);
    expect(result.newCollection.requests).toHaveLength(1);
  });

  it('merges when existing request matches by catalogEndpointId', () => {
    const existingReq = makeRequest({
      id: 'existing-req',
      catalogMeta: {
        catalogEndpointId: 'ep-1',
        catalogEntryId: 'entry-1',
        catalogVersion: '1.0.0',
        originalPath: '/users',
        tags: [],
      },
      specVersions: [{
        id: 'sv-old',
        catalogVersion: '1.0.0',
        catalogEntryId: 'entry-1',
        catalogEndpointId: 'ep-1',
        importedAt: 1000,
        url: 'https://old.api.com/users',
        method: 'GET',
        headers: [],
        body: '',
      }],
      activeSpecVersionId: 'sv-old',
    });
    const existingCol = makeCollection({ requests: [existingReq] });

    const newReq = makeRequest({
      id: 'new-req-id',
      url: 'https://new.api.com/v2/users',
      catalogMeta: {
        catalogEndpointId: 'ep-1',
        catalogEntryId: 'entry-1',
        originalPath: '/users',
        tags: [],
      },
    });
    const exported = makeCollection({ id: 'exp-col', requests: [newReq] });

    const result = mergeExportIntoCollections(exported, [existingCol], '2.0.0', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.newCount).toBe(0);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].collectionId).toBe('col-1');
    expect(result.updates[0].requestId).toBe('existing-req');
    expect(result.updates[0].patch.specVersions).toHaveLength(2);
    expect(result.updates[0].patch.url).toBe('https://new.api.com/v2/users');
  });

  it('splits correctly with mixed new and existing', () => {
    const existingReq = makeRequest({
      id: 'existing-req',
      catalogMeta: {
        catalogEndpointId: 'ep-1',
        catalogEntryId: 'entry-1',
        originalPath: '/users',
        tags: [],
      },
    });
    const existingCol = makeCollection({ requests: [existingReq] });

    const matchReq = makeRequest({
      id: 'match',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/users', tags: [] },
    });
    const brandNewReq = makeRequest({
      id: 'brand-new',
      catalogMeta: { catalogEndpointId: 'ep-99', catalogEntryId: 'entry-1', originalPath: '/items', tags: [] },
    });
    const exported = makeCollection({ id: 'exp-col', requests: [matchReq, brandNewReq] });

    const result = mergeExportIntoCollections(exported, [existingCol], '2.0.0', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.newCount).toBe(1);
    expect(result.newCollection.requests).toHaveLength(1);
    expect(result.newCollection.requests[0].catalogMeta?.catalogEndpointId).toBe('ep-99');
  });

  it('finds requests in nested folders', () => {
    const existingReq = makeRequest({
      id: 'nested-req',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/x', tags: [] },
    });
    const existingCol = makeCollection({
      requests: [],
      folders: [{ id: 'f-1', name: 'env', requests: [existingReq] }],
    });

    const newReq = makeRequest({
      id: 'new-1',
      url: 'https://updated.com/x',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/x', tags: [] },
    });
    const exported = makeCollection({ requests: [newReq] });

    const result = mergeExportIntoCollections(exported, [existingCol], '3.0.0', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.updates[0].requestId).toBe('nested-req');
  });

  it('does not match when catalogEntryId differs', () => {
    const existingReq = makeRequest({
      id: 'req-1',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-A', originalPath: '/x', tags: [] },
    });
    const existingCol = makeCollection({ requests: [existingReq] });

    const newReq = makeRequest({
      id: 'req-2',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-B', originalPath: '/x', tags: [] },
    });
    const exported = makeCollection({ requests: [newReq] });

    const result = mergeExportIntoCollections(exported, [existingCol], '1.0.0', 'entry-B');
    expect(result.mergedCount).toBe(0);
    expect(result.newCount).toBe(1);
  });

  it('updates catalogMeta.catalogVersion on merged request', () => {
    const existingReq = makeRequest({
      id: 'req-1',
      catalogMeta: {
        catalogEndpointId: 'ep-1',
        catalogEntryId: 'entry-1',
        catalogVersion: '1.0.0',
        originalPath: '/x',
        tags: [],
      },
    });
    const existingCol = makeCollection({ requests: [existingReq] });
    const newReq = makeRequest({
      id: 'new-1',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/x', tags: [] },
    });
    const exported = makeCollection({ requests: [newReq] });

    const result = mergeExportIntoCollections(exported, [existingCol], '2.0.0', 'entry-1');
    expect(result.updates[0].patch.catalogMeta?.catalogVersion).toBe('2.0.0');
  });

  it('targets first collection when multiple contain the same endpoint', () => {
    const sharedMeta = {
      catalogEndpointId: 'ep-shared',
      catalogEntryId: 'entry-1',
      originalPath: '/x',
      tags: [],
    };
    const colA = makeCollection({ id: 'A', requests: [makeRequest({ id: 'a1', catalogMeta: sharedMeta })] });
    const colB = makeCollection({ id: 'B', requests: [makeRequest({ id: 'b1', catalogMeta: sharedMeta })] });

    const newReq = makeRequest({
      catalogMeta: sharedMeta,
    });
    const exported = makeCollection({ requests: [newReq] });
    const result = mergeExportIntoCollections(exported, [colA, colB], '9.9.9', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.updates[0].collectionId).toBe('A');
    expect(result.updates[0].requestId).toBe('a1');
  });

  it('strips merged requests from exported folder', () => {
    const existingReq = makeRequest({
      id: 'existing',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/a', tags: [] },
    });
    const existingCol = makeCollection({ requests: [existingReq] });

    const mergeReq = makeRequest({
      id: 'merge',
      catalogMeta: { catalogEndpointId: 'ep-1', catalogEntryId: 'entry-1', originalPath: '/a', tags: [] },
    });
    const newReq = makeRequest({
      id: 'new',
      catalogMeta: { catalogEndpointId: 'ep-2', catalogEntryId: 'entry-1', originalPath: '/b', tags: [] },
    });
    const exported = makeCollection({
      requests: [],
      folders: [{ id: 'f-1', name: 'env', requests: [mergeReq, newReq] }],
    });

    const result = mergeExportIntoCollections(exported, [existingCol], '2.0.0', 'entry-1');
    expect(result.newCollection.folders![0].requests).toHaveLength(1);
    expect(result.newCollection.folders![0].requests[0].catalogMeta?.catalogEndpointId).toBe('ep-2');
  });

  it('strips merged requests nested two folder levels deep', () => {
    const existingReq = makeRequest({
      catalogMeta: { catalogEndpointId: 'ep-deep', catalogEntryId: 'entry-1', originalPath: '/d', tags: [] },
    });
    const exported = makeCollection({
      folders: [{
        id: 'outer',
        name: 'o',
        requests: [],
        folders: [{
          id: 'inner',
          name: 'i',
          requests: [
            makeRequest({ catalogMeta: { catalogEndpointId: 'ep-deep', catalogEntryId: 'entry-1', originalPath: '/d', tags: [] } }),
            makeRequest({ catalogMeta: { catalogEndpointId: 'ep-other', catalogEntryId: 'entry-1', originalPath: '/e', tags: [] } }),
          ],
        }],
      }],
    });

    const result = mergeExportIntoCollections(exported, [makeCollection({ requests: [existingReq] })], '1.1.1', 'entry-1');
    const inner = result.newCollection.folders![0].folders![0];
    expect(inner.requests).toHaveLength(1);
    expect(inner.requests[0].catalogMeta?.catalogEndpointId).toBe('ep-other');
  });

  it('merges only when exported endpoint maps to catalog entry id used in lookup', () => {
    const expReq = makeRequest({
      catalogMeta: {
        catalogEndpointId: 'ep-align',
        catalogEntryId: 'entry-1',
        originalPath: '/x',
        tags: [],
      },
    });
    const alignedExisting = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: {
            catalogEndpointId: 'ep-align',
            catalogEntryId: 'entry-1',
            originalPath: '/x',
            tags: [],
          },
        }),
      ],
    });
    expect(
      mergeExportIntoCollections(
        makeCollection({ requests: [expReq] }),
        [alignedExisting],
        '1',
        'entry-1',
      ).mergedCount,
    ).toBe(1);

    const mismatchedExisting = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: {
            catalogEndpointId: 'ep-align',
            catalogEntryId: 'entry-other',
            originalPath: '/x',
            tags: [],
          },
        }),
      ],
    });
    expect(
      mergeExportIntoCollections(
        makeCollection({ requests: [expReq] }),
        [mismatchedExisting],
        '1',
        'entry-1',
      ).mergedCount,
    ).toBe(0);
  });

  it('ignores exported rows whose catalog endpoint id is empty string', () => {
    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEndpointId: '', catalogEntryId: 'entry-1', originalPath: '/a', tags: [] },
        }),
      ],
    });
    const result = mergeExportIntoCollections(exported, [], '1.0.0', 'entry-1');
    expect(result.mergedCount).toBe(0);
    expect(result.newCollection.requests).toHaveLength(1);
  });

  it('searches multiple collections until endpoint match is found', () => {
    const lateMatch = makeRequest({
      id: 'late',
      catalogMeta: { catalogEndpointId: 'late-ep', catalogEntryId: 'entry-1', originalPath: '/l', tags: [] },
    });
    const colFirst = makeCollection({ id: 'first', requests: [] });
    const colSecond = makeCollection({ id: 'second', requests: [lateMatch] });

    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEndpointId: 'late-ep', catalogEntryId: 'entry-1', originalPath: '/l', tags: [] },
        }),
      ],
    });

    const result = mergeExportIntoCollections(exported, [colFirst, colSecond], '1.2.3', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.updates[0].collectionId).toBe('second');
  });

  it('matches requests inside folders when root requests are unrelated', () => {
    const inFolder = makeRequest({
      id: 'in-folder',
      catalogMeta: { catalogEndpointId: 'nest-only', catalogEntryId: 'entry-1', originalPath: '/n', tags: [] },
    });
    const existingCol = makeCollection({
      requests: [makeRequest({ id: 'other', catalogMeta: { catalogEndpointId: 'x', catalogEntryId: 'entry-1', originalPath: '/y', tags: [] } })],
      folders: [{ id: 'f-n', name: 'n', requests: [inFolder] }],
    });
    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEndpointId: 'nest-only', catalogEntryId: 'entry-1', originalPath: '/n', tags: [] },
        }),
      ],
    });
    expect(mergeExportIntoCollections(exported, [existingCol], '4', 'entry-1').updates[0].requestId).toBe('in-folder');
  });

  it('recurses folders when nested folder list property is omitted', () => {
    const folder: RequestFolder = {
      id: 'solo',
      name: 'solo',
      requests: [
        makeRequest({
          id: 'solo-req',
          catalogMeta: { catalogEndpointId: 'solo-ep', catalogEntryId: 'entry-1', originalPath: '/s', tags: [] },
        }),
      ],
    };

    const existingCol = makeCollection({
      requests: [],
      folders: [folder],
    });

    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEndpointId: 'solo-ep', catalogEntryId: 'entry-1', originalPath: '/s', tags: [] },
        }),
      ],
    });

    expect(mergeExportIntoCollections(exported, [existingCol], '1', 'entry-1').mergedCount).toBe(1);
  });

  it('recurses sibling folders until endpoint match is discovered', () => {
    const target = makeRequest({
      id: 'deep-hit',
      catalogMeta: { catalogEndpointId: 'ep-last', catalogEntryId: 'entry-1', originalPath: '/z', tags: [] },
    });
    const existingCol = makeCollection({
      requests: [],
      folders: [
        {
          id: 'noise',
          name: 'Noise',
          requests: [],
          folders: [{
            id: 'noise-inner',
            name: 'Ni',
            requests: [makeRequest({ id: 'unrelated', catalogMeta: { catalogEndpointId: 'other', catalogEntryId: 'entry-1', originalPath: '/a', tags: [] } })],
          }],
        },
        {
          id: 'carrier',
          name: 'Carrier',
          requests: [],
          folders: [{
            id: 'final',
            name: 'Final',
            requests: [target],
          }],
        },
      ],
    });
    const exported = makeCollection({
      requests: [
        makeRequest({
          catalogMeta: { catalogEndpointId: 'ep-last', catalogEntryId: 'entry-1', originalPath: '/z', tags: [] },
        }),
      ],
    });
    const result = mergeExportIntoCollections(exported, [existingCol], '7.7.7', 'entry-1');
    expect(result.mergedCount).toBe(1);
    expect(result.updates[0].requestId).toBe('deep-hit');
  });
});

describe('isCollectionEmpty', () => {
  it('returns true for empty collection', () => {
    expect(isCollectionEmpty(makeCollection())).toBe(true);
  });

  it('returns false when collection has root requests', () => {
    expect(isCollectionEmpty(makeCollection({ requests: [makeRequest()] }))).toBe(false);
  });

  it('returns false when folder has requests', () => {
    const col = makeCollection({
      requests: [],
      folders: [{ id: 'f', name: 'f', requests: [makeRequest()] }],
    });
    expect(isCollectionEmpty(col)).toBe(false);
  });
});
