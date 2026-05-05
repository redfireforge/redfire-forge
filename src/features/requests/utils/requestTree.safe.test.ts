import { describe, it, expect } from 'vitest';
import type { RequestFolder, RequestItem, RequestCollection } from '../../../shared/types';
import {
  findFolderDeep,
  findReqInFolders,
  findRequestInCollection,
  findAncestorSubCollection,
  countReqsInFolders,
  countAllRequests,
  mapReqInFolders,
  mapRequests,
  removeReqFromFolders,
  removeRequestFrom,
  mapFolderDeep,
  addToFolderDeep,
  removeFolderDeep,
  collectAllRequests,
  cloneFolder,
  extractFolderDeep,
  isDescendantOf,
  addReqToFolderDeep,
  findReqParentFolder,
  reorderInFolders,
  swapInFolders,
  addReqToFolderSafe,
  addFolderToParentSafe,
  countGroupRequests,
  collectGroupIds,
  collectGroupChildren,
  collectAllGroups,
  countFolderReqs,
  findSiblingFolders,
} from './requestTree';

function makeReq(id: string, name = ''): RequestItem {
  return {
    id, name: name || id, method: 'GET', url: '/test', headers: [], body: '',
    auth: { type: 'none' },
  };
}

function makeFolder(id: string, requests: RequestItem[] = [], subfolders: RequestFolder[] = []): RequestFolder {
  return { id, name: id, requests, folders: subfolders };
}

function makeCollection(overrides: Partial<RequestCollection> = {}): RequestCollection {
  return {
    id: 'col-1', name: 'Test Collection', mode: 'direct',
    requests: [], folders: [], ...overrides,
  };
}

function makeFolderNoSub(id: string, requests: RequestItem[] = []): RequestFolder {
  return { id, name: id, requests } as RequestFolder;
}

describe('addReqToFolderSafe', () => {
  it('adds request to existing folder', () => {
    const req = makeReq('r1');
    const folder = makeFolder('f1');
    const col = makeCollection({ folders: [folder] });
    const result = addReqToFolderSafe(col, 'f1', req);
    expect(result.folders![0].requests).toHaveLength(1);
    expect(result.folders![0].requests[0].id).toBe('r1');
    expect(result.requests).toHaveLength(0);
  });

  it('falls back to collection root when folder not found', () => {
    const req = makeReq('r1');
    const col = makeCollection({ folders: [] });
    const result = addReqToFolderSafe(col, 'nonexistent', req);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].id).toBe('r1');
  });

  it('adds request before a specific request in folder', () => {
    const existing = makeReq('r-existing');
    const newReq = makeReq('r-new');
    const folder = makeFolder('f1', [existing]);
    const col = makeCollection({ folders: [folder] });
    const result = addReqToFolderSafe(col, 'f1', newReq, 'r-existing');
    expect(result.folders![0].requests.map(r => r.id)).toEqual(['r-new', 'r-existing']);
  });

  it('appends to folder when beforeReqId is not found', () => {
    const existing = makeReq('r-existing');
    const newReq = makeReq('r-new');
    const folder = makeFolder('f1', [existing]);
    const col = makeCollection({ folders: [folder] });
    const result = addReqToFolderSafe(col, 'f1', newReq, 'no-such-req');
    expect(result.folders![0].requests.map(r => r.id)).toEqual(['r-existing', 'r-new']);
  });
});

describe('addFolderToParentSafe', () => {
  it('adds child to existing parent folder', () => {
    const parent = makeFolder('parent');
    const child = makeFolder('child');
    const result = addFolderToParentSafe([parent], 'parent', child);
    expect(result[0].folders).toHaveLength(1);
    expect(result[0].folders![0].id).toBe('child');
  });

  it('falls back to root level when parent not found', () => {
    const existing = makeFolder('existing');
    const child = makeFolder('child');
    const result = addFolderToParentSafe([existing], 'nonexistent', child);
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('child');
  });

  it('adds to deeply nested parent', () => {
    const deep = makeFolder('deep');
    const mid = makeFolder('mid', [], [deep]);
    const root = makeFolder('root', [], [mid]);
    const child = makeFolder('child');
    const result = addFolderToParentSafe([root], 'deep', child);
    expect(findFolderDeep(result, 'child')).toBeTruthy();
    expect(result).toHaveLength(1);
  });
});

// ─── countGroupRequests ─────────────────────────────────

describe('countGroupRequests', () => {
  it('counts requests in direct child collections', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'grp-1', requests: [makeReq('r1'), makeReq('r2')] }),
      makeCollection({ id: 'col-2', mode: 'direct', groupId: 'grp-1', requests: [makeReq('r3')] }),
    ];
    expect(countGroupRequests('grp-1', collections)).toBe(3);
  });

  it('counts requests in nested groups recursively', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'outer-grp', mode: 'group' }),
      makeCollection({ id: 'inner-grp', mode: 'group', groupId: 'outer-grp' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'inner-grp', requests: [makeReq('r1')] }),
    ];
    expect(countGroupRequests('outer-grp', collections)).toBe(1);
  });

  it('returns 0 for an empty group', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
    ];
    expect(countGroupRequests('grp-1', collections)).toBe(0);
  });

  it('includes folder requests in the count', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({
        id: 'col-1', mode: 'direct', groupId: 'grp-1',
        requests: [makeReq('r1')],
        folders: [makeFolder('f1', [makeReq('r2'), makeReq('r3')])],
      }),
    ];
    expect(countGroupRequests('grp-1', collections)).toBe(3);
  });

  it('does not count collections outside the group', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-in', mode: 'direct', groupId: 'grp-1', requests: [makeReq('r1')] }),
      makeCollection({ id: 'col-out', mode: 'direct', requests: [makeReq('r2'), makeReq('r3')] }),
    ];
    expect(countGroupRequests('grp-1', collections)).toBe(1);
  });
});

// ─── collectGroupIds ────────────────────────────────────

describe('collectGroupIds', () => {
  it('returns only the root group id when no nested groups', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'grp-1' }),
    ];
    expect(collectGroupIds('grp-1', collections)).toEqual(['grp-1']);
  });

  it('collects nested group ids recursively', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-root', mode: 'group' }),
      makeCollection({ id: 'grp-child', mode: 'group', groupId: 'grp-root' }),
      makeCollection({ id: 'grp-grandchild', mode: 'group', groupId: 'grp-child' }),
    ];
    const ids = collectGroupIds('grp-root', collections);
    expect(ids).toContain('grp-root');
    expect(ids).toContain('grp-child');
    expect(ids).toContain('grp-grandchild');
    expect(ids).toHaveLength(3);
  });

  it('does not include non-group children', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'grp-1' }),
      makeCollection({ id: 'col-2', mode: 'multi-env', groupId: 'grp-1' }),
    ];
    expect(collectGroupIds('grp-1', collections)).toEqual(['grp-1']);
  });

  it('does not include groups from other branches', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-a', mode: 'group' }),
      makeCollection({ id: 'grp-b', mode: 'group' }),
      makeCollection({ id: 'grp-a1', mode: 'group', groupId: 'grp-a' }),
      makeCollection({ id: 'grp-b1', mode: 'group', groupId: 'grp-b' }),
    ];
    expect(collectGroupIds('grp-a', collections)).toEqual(['grp-a', 'grp-a1']);
  });
});

// ─── collectAllGroups ───────────────────────────────────

describe('collectAllGroups', () => {
  it('returns empty array when no groups exist', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'col-1', mode: 'direct' }),
    ];
    expect(collectAllGroups(collections)).toEqual([]);
  });

  it('returns top-level groups at depth 0', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', name: 'Group A', mode: 'group' }),
      makeCollection({ id: 'grp-2', name: 'Group B', mode: 'group' }),
    ];
    const result = collectAllGroups(collections);
    expect(result).toHaveLength(2);
    expect(result[0].group.id).toBe('grp-1');
    expect(result[0].depth).toBe(0);
    expect(result[1].group.id).toBe('grp-2');
    expect(result[1].depth).toBe(0);
  });

  it('returns nested groups with correct depth', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-root', mode: 'group' }),
      makeCollection({ id: 'grp-child', mode: 'group', groupId: 'grp-root' }),
      makeCollection({ id: 'grp-grandchild', mode: 'group', groupId: 'grp-child' }),
    ];
    const result = collectAllGroups(collections);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ group: expect.objectContaining({ id: 'grp-root' }), depth: 0 });
    expect(result[1]).toEqual({ group: expect.objectContaining({ id: 'grp-child' }), depth: 1 });
    expect(result[2]).toEqual({ group: expect.objectContaining({ id: 'grp-grandchild' }), depth: 2 });
  });

  it('filters by parentGroupId when provided', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-root', mode: 'group' }),
      makeCollection({ id: 'grp-child', mode: 'group', groupId: 'grp-root' }),
      makeCollection({ id: 'grp-other', mode: 'group' }),
    ];
    const result = collectAllGroups(collections, 'grp-root');
    expect(result).toHaveLength(1);
    expect(result[0].group.id).toBe('grp-child');
  });

  it('does not include non-group collections', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'grp-1' }),
    ];
    const result = collectAllGroups(collections);
    expect(result).toHaveLength(1);
    expect(result[0].group.id).toBe('grp-1');
  });
});

// ─── collectGroupChildren ───────────────────────────────

describe('collectGroupChildren', () => {
  it('includes both group and non-group children', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-root', mode: 'group' }),
      makeCollection({ id: 'col-1', mode: 'direct', groupId: 'grp-root' }),
      makeCollection({ id: 'col-2', mode: 'multi-env', groupId: 'grp-root' }),
      makeCollection({ id: 'grp-child', mode: 'group', groupId: 'grp-root' }),
    ];
    const ids = collectGroupChildren('grp-root', collections);
    expect(ids).toContain('grp-root');
    expect(ids).toContain('col-1');
    expect(ids).toContain('col-2');
    expect(ids).toContain('grp-child');
    expect(ids).toHaveLength(4);
  });

  it('recursively collects from nested groups', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-root', mode: 'group' }),
      makeCollection({ id: 'grp-child', mode: 'group', groupId: 'grp-root' }),
      makeCollection({ id: 'col-deep', mode: 'direct', groupId: 'grp-child' }),
    ];
    const ids = collectGroupChildren('grp-root', collections);
    expect(ids).toContain('grp-root');
    expect(ids).toContain('grp-child');
    expect(ids).toContain('col-deep');
    expect(ids).toHaveLength(3);
  });

  it('returns only root when group has no children', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
    ];
    expect(collectGroupChildren('grp-1', collections)).toEqual(['grp-1']);
  });

  it('does not include collections outside the group', () => {
    const collections: RequestCollection[] = [
      makeCollection({ id: 'grp-1', mode: 'group' }),
      makeCollection({ id: 'col-in', mode: 'direct', groupId: 'grp-1' }),
      makeCollection({ id: 'col-out', mode: 'direct' }),
    ];
    const ids = collectGroupChildren('grp-1', collections);
    expect(ids).not.toContain('col-out');
    expect(ids).toHaveLength(2);
  });
});

// ─── countFolderReqs ────────────────────────────────────

describe('countFolderReqs', () => {
  it('counts requests in a flat folder', () => {
    const f = makeFolder('f1', [makeReq('r1'), makeReq('r2')]);
    expect(countFolderReqs(f)).toBe(2);
  });

  it('counts requests in nested folders', () => {
    const inner = makeFolder('inner', [makeReq('r1')]);
    const outer = makeFolder('outer', [makeReq('r2'), makeReq('r3')], [inner]);
    expect(countFolderReqs(outer)).toBe(3);
  });

  it('returns 0 for empty folder', () => {
    expect(countFolderReqs(makeFolder('empty'))).toBe(0);
  });
});

// ── Edge cases: folders property undefined (tests ?? [] fallback branches) ──

describe('requestTree — folders undefined fallback branches', () => {
  it('findFolderDeep handles folders without subfolders', () => {
    const f = makeFolderNoSub('f1');
    expect(findFolderDeep([f], 'f1')).toEqual(f);
    expect(findFolderDeep([f], 'not-found')).toBeNull();
  });

  it('findReqInFolders handles folders without subfolders', () => {
    const req = makeReq('r1');
    const f = makeFolderNoSub('f1', [req]);
    expect(findReqInFolders([f], 'r1')).toEqual(req);
    expect(findReqInFolders([f], 'not-found')).toBeNull();
  });

  it('findRequestInCollection handles collection with undefined folders', () => {
    const req = makeReq('r1');
    const col = makeCollection({ requests: [req] }) as RequestCollection;
    delete (col as any).folders;
    expect(findRequestInCollection(col, 'r1')).toEqual(req);
  });

  it('countReqsInFolders handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1'), makeReq('r2')]);
    expect(countReqsInFolders([f])).toBe(2);
  });

  it('countFolderReqs handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    expect(countFolderReqs(f)).toBe(1);
  });

  it('findSiblingFolders handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    expect(findSiblingFolders([f], 'not-found')).toBeNull();
  });

  it('countAllRequests handles collection with undefined folders', () => {
    const col = makeCollection({ requests: [makeReq('r1')] }) as RequestCollection;
    delete (col as any).folders;
    expect(countAllRequests(col)).toBe(1);
  });

  it('mapReqInFolders handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    const result = mapReqInFolders([f], 'r1', (r) => ({ ...r, name: 'updated' }));
    expect(result[0].requests[0].name).toBe('updated');
  });

  it('mapRequests handles collection with undefined folders', () => {
    const col = makeCollection({ requests: [makeReq('r1')] }) as RequestCollection;
    delete (col as any).folders;
    const result = mapRequests(col, 'r1', (r) => ({ ...r, name: 'up' }));
    expect(result.requests[0].name).toBe('up');
  });

  it('removeReqFromFolders handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    const result = removeReqFromFolders([f], 'r1');
    expect(result[0].requests).toHaveLength(0);
  });

  it('removeRequestFrom handles collection with undefined folders', () => {
    const col = makeCollection({ requests: [makeReq('r1')] }) as RequestCollection;
    delete (col as any).folders;
    const result = removeRequestFrom(col, 'r1');
    expect(result.requests).toHaveLength(0);
  });

  it('mapFolderDeep handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    const result = mapFolderDeep([f], 'f1', (folder) => ({ ...folder, name: 'updated' }));
    expect(result[0].name).toBe('updated');
  });

  it('addToFolderDeep handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    const child = makeFolder('child');
    const result = addToFolderDeep([f], 'f1', child);
    expect(result[0].folders).toHaveLength(1);
  });

  it('removeFolderDeep handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    const { folders } = removeFolderDeep([f], 'not-found');
    expect(folders).toHaveLength(1);
  });

  it('collectAllRequests handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    expect(collectAllRequests(f)).toHaveLength(1);
  });

  it('cloneFolder handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    const cloned = cloneFolder(f);
    expect(cloned.id).not.toBe('f1');
    expect(cloned.requests).toHaveLength(1);
  });

  it('extractFolderDeep handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    const { remaining, extracted } = extractFolderDeep([f], 'f1');
    expect(remaining).toHaveLength(0);
    expect(extracted).toEqual(f);
  });

  it('isDescendantOf handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    expect(isDescendantOf([f], 'f1', 'not-found')).toBe(false);
  });

  it('addReqToFolderDeep handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    const req = makeReq('r1');
    const result = addReqToFolderDeep([f], 'f1', req);
    expect(result[0].requests).toHaveLength(1);
  });

  it('findReqParentFolder handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1', [makeReq('r1')]);
    expect(findReqParentFolder([f], 'r1')).toEqual(f);
    expect(findReqParentFolder([f], 'not-found')).toBeNull();
  });

  it('reorderInFolders handles undefined subfolders', () => {
    const f1 = makeFolderNoSub('f1');
    const f2 = makeFolderNoSub('f2');
    const result = reorderInFolders([f1, f2], 'f2', 'f1');
    expect(result[0].id).toBe('f2');
  });

  it('swapInFolders handles undefined subfolders', () => {
    const f = makeFolderNoSub('f1');
    // folder not found at top level - should recurse into undefined subfolders
    const result = swapInFolders([f], 'not-found', 'down');
    expect(result).toHaveLength(1);
  });

  it('findAncestorSubCollection handles undefined subfolders', () => {
    const req = makeReq('r1');
    const f: RequestFolder = { id: 'f1', name: 'f1', requests: [req], isSubCollection: true } as RequestFolder;
    expect(findAncestorSubCollection([f], 'r1')).toEqual(f);
  });

  it('findAncestorSubCollection with baseUrls ancestor', () => {
    const req = makeReq('r1');
    const f: RequestFolder = { id: 'f1', name: 'f1', requests: [req], baseUrls: { env1: 'https://example.com' } } as any;
    expect(findAncestorSubCollection([f], 'r1')).toEqual(f);
  });

  it('findAncestorSubCollection returns null when no qualifying ancestor', () => {
    const req = makeReq('r1');
    const f = makeFolderNoSub('f1', [req]);
    expect(findAncestorSubCollection([f], 'r1')).toBeNull();
  });
});
