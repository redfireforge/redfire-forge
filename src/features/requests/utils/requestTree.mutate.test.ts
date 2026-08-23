import { describe, it, expect } from 'vitest';
import type { RequestFolder, RequestItem, RequestCollection } from '@shared/types';
import {
  countReqsInFolders,
  countAllRequests,
  mapReqInFolders,
  mapRequests,
  removeReqFromFolders,
  removeRequestFrom,
  mapFolderDeep,
  addToFolderDeep,
  removeFolderDeep,
  addReqToFolderDeep,
  reorderInFolders,
  swapInFolders,
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

// ─── countReqsInFolders / countAllRequests ───────────────

describe('counting', () => {
  it('countReqsInFolders counts across nested folders', () => {
    const inner = makeFolder('inner', [makeReq('r1'), makeReq('r2')]);
    const outer = makeFolder('outer', [makeReq('r3')], [inner]);
    expect(countReqsInFolders([outer])).toBe(3);
  });

  it('countAllRequests counts root + folder requests', () => {
    const f = makeFolder('f1', [makeReq('r2')]);
    const col = makeCollection({ requests: [makeReq('r1')], folders: [f] });
    expect(countAllRequests(col)).toBe(2);
  });

  it('countReqsInFolders returns 0 for empty', () => {
    expect(countReqsInFolders([])).toBe(0);
  });
});

// ─── mapReqInFolders / mapRequests ───────────────────────

describe('mapping requests', () => {
  it('mapReqInFolders transforms a matching request', () => {
    const req = makeReq('r1', 'old');
    const f = makeFolder('f1', [req]);
    const result = mapReqInFolders([f], 'r1', r => ({ ...r, name: 'new' }));
    expect(result[0].requests[0].name).toBe('new');
  });

  it('mapRequests transforms at collection root', () => {
    const req = makeReq('r1', 'old');
    const col = makeCollection({ requests: [req] });
    const result = mapRequests(col, 'r1', r => ({ ...r, name: 'new' }));
    expect(result.requests[0].name).toBe('new');
  });

  it('mapRequests transforms inside folders', () => {
    const req = makeReq('r1', 'old');
    const col = makeCollection({ folders: [makeFolder('f1', [req])] });
    const result = mapRequests(col, 'r1', r => ({ ...r, name: 'new' }));
    expect(result.folders![0].requests[0].name).toBe('new');
  });

  it('mapRequests leaves non-matching requests unchanged', () => {
    const r1 = makeReq('r1', 'keep');
    const r2 = makeReq('r2', 'keep');
    const col = makeCollection({ requests: [r1, r2] });
    const result = mapRequests(col, 'r1', r => ({ ...r, name: 'changed' }));
    expect(result.requests[0].name).toBe('changed');
    expect(result.requests[1].name).toBe('keep');
  });
});

// ─── removeReqFromFolders / removeRequestFrom ────────────

describe('removing requests', () => {
  it('removeReqFromFolders removes from nested folder', () => {
    const inner = makeFolder('inner', [makeReq('r1'), makeReq('r2')]);
    const outer = makeFolder('outer', [], [inner]);
    const result = removeReqFromFolders([outer], 'r1');
    expect(result[0].folders![0].requests).toHaveLength(1);
    expect(result[0].folders![0].requests[0].id).toBe('r2');
  });

  it('removeRequestFrom removes from collection root', () => {
    const col = makeCollection({ requests: [makeReq('r1'), makeReq('r2')] });
    const result = removeRequestFrom(col, 'r1');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].id).toBe('r2');
  });

  it('removeRequestFrom removes from folder', () => {
    const f = makeFolder('f1', [makeReq('r1')]);
    const col = makeCollection({ folders: [f] });
    const result = removeRequestFrom(col, 'r1');
    expect(result.folders![0].requests).toHaveLength(0);
  });
});

// ─── mapFolderDeep ───────────────────────────────────────

describe('mapFolderDeep', () => {
  it('transforms a matching folder', () => {
    const f = makeFolder('f1');
    const result = mapFolderDeep([f], 'f1', folder => ({ ...folder, name: 'renamed' }));
    expect(result[0].name).toBe('renamed');
  });

  it('transforms a nested folder', () => {
    const inner = makeFolder('inner');
    const outer = makeFolder('outer', [], [inner]);
    const result = mapFolderDeep([outer], 'inner', f => ({ ...f, name: 'renamed' }));
    expect(result[0].folders![0].name).toBe('renamed');
  });

  it('leaves non-matching folders unchanged', () => {
    const f = makeFolder('f1');
    const result = mapFolderDeep([f], 'nonexistent', folder => ({ ...folder, name: 'changed' }));
    expect(result[0].name).toBe('f1');
  });
});

// ─── addToFolderDeep ─────────────────────────────────────

describe('addToFolderDeep', () => {
  it('adds a child folder to the target', () => {
    const parent = makeFolder('parent');
    const child = makeFolder('child');
    const result = addToFolderDeep([parent], 'parent', child);
    expect(result[0].folders).toHaveLength(1);
    expect(result[0].folders![0].id).toBe('child');
  });

  it('adds to a nested parent', () => {
    const inner = makeFolder('inner');
    const outer = makeFolder('outer', [], [inner]);
    const child = makeFolder('child');
    const result = addToFolderDeep([outer], 'inner', child);
    expect(result[0].folders![0].folders).toHaveLength(1);
  });
});

// ─── removeFolderDeep ────────────────────────────────────

describe('removeFolderDeep', () => {
  it('removes a top-level folder and returns orphans', () => {
    const req = makeReq('r1');
    const f = makeFolder('f1', [req]);
    const { folders, orphaned } = removeFolderDeep([f], 'f1');
    expect(folders).toHaveLength(0);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].id).toBe('r1');
  });

  it('removes a nested folder', () => {
    const inner = makeFolder('inner', [makeReq('r1')]);
    const outer = makeFolder('outer', [], [inner]);
    const { folders, orphaned } = removeFolderDeep([outer], 'inner');
    expect(folders).toHaveLength(1);
    expect(folders[0].folders).toHaveLength(0);
    expect(orphaned).toHaveLength(1);
  });

  it('collects nested orphans from deeply nested folders', () => {
    const deepReq = makeReq('deep-r');
    const deep = makeFolder('deep', [deepReq]);
    const mid = makeFolder('mid', [makeReq('mid-r')], [deep]);
    const { orphaned } = removeFolderDeep([mid], 'mid');
    expect(orphaned).toHaveLength(2);
  });
});

// ─── addReqToFolderDeep ──────────────────────────────────

describe('addReqToFolderDeep', () => {
  it('adds a request to the target folder', () => {
    const f = makeFolder('f1');
    const req = makeReq('new');
    const result = addReqToFolderDeep([f], 'f1', req);
    expect(result[0].requests).toHaveLength(1);
    expect(result[0].requests[0].id).toBe('new');
  });

  it('inserts before a specific request', () => {
    const existing = makeReq('existing');
    const f = makeFolder('f1', [existing]);
    const req = makeReq('new');
    const result = addReqToFolderDeep([f], 'f1', req, 'existing');
    expect(result[0].requests).toHaveLength(2);
    expect(result[0].requests[0].id).toBe('new');
    expect(result[0].requests[1].id).toBe('existing');
  });

  it('appends when beforeReqId not found', () => {
    const existing = makeReq('existing');
    const f = makeFolder('f1', [existing]);
    const req = makeReq('new');
    const result = addReqToFolderDeep([f], 'f1', req, 'nonexistent');
    expect(result[0].requests).toHaveLength(2);
    expect(result[0].requests[1].id).toBe('new');
  });

  it('adds to a nested folder', () => {
    const inner = makeFolder('inner');
    const outer = makeFolder('outer', [], [inner]);
    const req = makeReq('new');
    const result = addReqToFolderDeep([outer], 'inner', req);
    expect(result[0].folders![0].requests).toHaveLength(1);
  });

  it('no-ops when folder not found (returns unchanged copy)', () => {
    const f = makeFolder('f1', [makeReq('r1')]);
    const req = makeReq('new');
    const result = addReqToFolderDeep([f], 'nonexistent', req);
    expect(result[0].requests).toHaveLength(1);
    expect(result[0].requests[0].id).toBe('r1');
  });
});

// ─── reorderInFolders ────────────────────────────────────

describe('reorderInFolders', () => {
  it('moves a folder before another', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const f3 = makeFolder('f3');
    const result = reorderInFolders([f1, f2, f3], 'f3', 'f1');
    expect(result.map(f => f.id)).toEqual(['f3', 'f1', 'f2']);
  });

  it('moves a folder to the end when beforeId is null', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const result = reorderInFolders([f1, f2], 'f1', null);
    expect(result.map(f => f.id)).toEqual(['f2', 'f1']);
  });

  it('appends when beforeId not found', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const result = reorderInFolders([f1, f2], 'f1', 'nonexistent');
    expect(result[result.length - 1].id).toBe('f1');
  });

  it('recurses into nested folders when not found at top level', () => {
    const inner1 = makeFolder('inner1');
    const inner2 = makeFolder('inner2');
    const outer = makeFolder('outer', [], [inner1, inner2]);
    const result = reorderInFolders([outer], 'inner2', 'inner1');
    expect(result[0].folders!.map(f => f.id)).toEqual(['inner2', 'inner1']);
  });

  it('reorders nested siblings when beforeId is the first folder', () => {
    const a = makeFolder('a');
    const b = makeFolder('b');
    const c = makeFolder('c');
    const outer = makeFolder('outer', [], [a, b, c]);
    const result = reorderInFolders([outer], 'c', 'a');
    expect(result[0].folders!.map(f => f.id)).toEqual(['c', 'a', 'b']);
  });
});

// ─── swapInFolders ───────────────────────────────────────

describe('swapInFolders', () => {
  it('swaps a folder up', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const result = swapInFolders([f1, f2], 'f2', 'up');
    expect(result.map(f => f.id)).toEqual(['f2', 'f1']);
  });

  it('swaps a folder down', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const result = swapInFolders([f1, f2], 'f1', 'down');
    expect(result.map(f => f.id)).toEqual(['f2', 'f1']);
  });

  it('does not swap beyond boundaries', () => {
    const f1 = makeFolder('f1');
    const f2 = makeFolder('f2');
    const up = swapInFolders([f1, f2], 'f1', 'up');
    expect(up.map(f => f.id)).toEqual(['f1', 'f2']);
    const down = swapInFolders([f1, f2], 'f2', 'down');
    expect(down.map(f => f.id)).toEqual(['f1', 'f2']);
  });

  it('recurses into nested folders', () => {
    const inner1 = makeFolder('inner1');
    const inner2 = makeFolder('inner2');
    const outer = makeFolder('outer', [], [inner1, inner2]);
    const result = swapInFolders([outer], 'inner2', 'up');
    expect(result[0].folders!.map(f => f.id)).toEqual(['inner2', 'inner1']);
  });

  it('recurses twice when the folder is two levels below the root list', () => {
    const leaf = makeFolder('leaf');
    const mid = makeFolder('mid', [], [leaf]);
    const top = makeFolder('top', [], [mid]);
    const result = swapInFolders([top], 'leaf', 'up');
    expect(result[0].folders![0].folders![0].id).toBe('leaf');
  });
});
