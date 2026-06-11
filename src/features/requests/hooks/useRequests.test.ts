/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { RequestsData } from '../../../shared/types';

const mockSaveRequests = vi.fn();
let mockInitial: RequestsData;

vi.mock('../../../shared/utils/storage', () => ({
  loadRequests: () => Promise.resolve(mockInitial),
  saveRequests: (data: RequestsData) => mockSaveRequests(data),
}));

import { useRequests } from './useRequests';

async function setup(initial?: Partial<RequestsData>) {
  mockInitial = { environments: [], collections: [], ...initial };
  const hook = renderHook(() => useRequests());
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

beforeEach(() => {
  mockSaveRequests.mockClear();
  mockInitial = { environments: [], collections: [] };
});

describe('useRequests', () => {
  it('loads initial data and marks loaded', async () => {
    const { result } = await setup({ environments: [{ id: 'e1', name: 'dev' }] });
    expect(result.current.loaded).toBe(true);
    expect(result.current.environments).toEqual([{ id: 'e1', name: 'dev' }]);
  });

  it('persists data after load', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.addEnv('prod');
    });
    expect(mockSaveRequests).toHaveBeenCalled();
  });

  describe('environments', () => {
    it('adds, selects and removes an environment', async () => {
      const { result } = await setup();
      act(() => result.current.addEnv('dev'));
      expect(result.current.environments).toHaveLength(1);
      const envId = result.current.environments[0].id;
      act(() => result.current.setSelectedEnvId(envId));
      expect(result.current.selectedEnvId).toBe(envId);
      act(() => result.current.removeEnv(envId));
      expect(result.current.environments).toHaveLength(0);
      expect(result.current.selectedEnvId).toBeUndefined();
    });

    it('adds only environments with new names', async () => {
      const { result } = await setup({ environments: [{ id: 'e1', name: 'dev' }] });
      act(() => result.current.addEnvironments([{ id: 'x', name: 'dev' }, { id: 'y', name: 'qa' }]));
      expect(result.current.environments.map((e) => e.name)).toEqual(['dev', 'qa']);
      // no-op when all already exist
      act(() => result.current.addEnvironments([{ id: 'z', name: 'dev' }]));
      expect(result.current.environments).toHaveLength(2);
    });
  });

  describe('collections', () => {
    it('adds, updates, duplicates, selects and removes a collection', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C1' }); });
      expect(result.current.collections).toHaveLength(1);
      expect(result.current.selectedCollection?.name).toBe('C1');

      act(() => result.current.updateCollection(colId, { name: 'C1-renamed' }));
      expect(result.current.collections[0].name).toBe('C1-renamed');

      act(() => result.current.duplicateCollection(colId));
      expect(result.current.collections).toHaveLength(2);
      expect(result.current.collections[1].name).toBe('C1-renamed (copy)');

      act(() => result.current.removeCollection(colId));
      expect(result.current.collections).toHaveLength(1);
      expect(result.current.collections[0].name).toBe('C1-renamed (copy)');
    });

    it('duplicateCollection is a no-op for an unknown id', async () => {
      const { result } = await setup();
      act(() => result.current.duplicateCollection('nope'));
      expect(result.current.collections).toHaveLength(0);
    });

    it('selectCollection auto-saves a version of the request being left', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C1' }); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId); });
      act(() => result.current.updateRequest(colId, reqId, { url: 'https://x' }));
      let col2 = '';
      act(() => { col2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.selectCollection(col2));
      expect(result.current.data.selectedCollectionId).toBe(col2);
      expect(result.current.data.selectedRequestId).toBeUndefined();
    });
  });

  describe('folders', () => {
    let colId = '';
    async function withCol() {
      const hook = await setup();
      act(() => { colId = hook.result.current.addCollection({ name: 'C' }); });
      return hook;
    }

    it('adds, renames, duplicates and removes a folder', async () => {
      const { result } = await withCol();
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F1'); });
      expect(result.current.collections[0].folders).toHaveLength(1);

      act(() => result.current.renameFolder(colId, folderId, 'F1-renamed'));
      expect(result.current.collections[0].folders![0].name).toBe('F1-renamed');

      act(() => result.current.duplicateFolder(colId, folderId));
      expect(result.current.collections[0].folders).toHaveLength(2);

      act(() => result.current.removeFolder(colId, folderId));
      expect(result.current.collections[0].folders).toHaveLength(1);
    });

    it('adds a nested folder under a parent', async () => {
      const { result } = await withCol();
      let parentId = '';
      act(() => { parentId = result.current.addFolder(colId, 'parent'); });
      let childId = '';
      act(() => { childId = result.current.addFolder(colId, 'child', parentId); });
      expect(result.current.collections[0].folders![0].folders![0].id).toBe(childId);
    });

    it('adds and updates a sub-collection, matching env by name', async () => {
      const hook = await setup({ environments: [{ id: 'env-dev', name: 'Dev' }] });
      act(() => { colId = hook.result.current.addCollection({ name: 'C' }); });
      act(() => { hook.result.current.addSubCollection(colId, 'dev'); });
      const sub = hook.result.current.collections[0].folders![0];
      expect(sub.isSubCollection).toBe(true);
      expect(sub.selectedEnvId).toBe('env-dev');
      act(() => hook.result.current.updateSubCollection(colId, sub.id, { name: 'renamed' }));
      expect(hook.result.current.collections[0].folders![0].name).toBe('renamed');
    });

    it('adds a sub-collection under a parent folder', async () => {
      const { result } = await withCol();
      let parentId = '';
      act(() => { parentId = result.current.addFolder(colId, 'parent'); });
      act(() => result.current.addSubCollection(colId, 'sub', parentId));
      expect(result.current.collections[0].folders![0].folders![0].isSubCollection).toBe(true);
    });

    it('removing a non-sub folder orphans its requests to the collection', async () => {
      const { result } = await withCol();
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, folderId); });
      act(() => result.current.removeFolder(colId, folderId));
      expect(result.current.collections[0].requests.some((r) => r.id === reqId)).toBe(true);
    });

    it('moves a folder up and down', async () => {
      const { result } = await withCol();
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(colId, 'F1'); });
      act(() => { f2 = result.current.addFolder(colId, 'F2'); });
      act(() => result.current.moveFolder(colId, f2, 'up'));
      expect(result.current.collections[0].folders![0].id).toBe(f2);
      act(() => result.current.moveFolder(colId, f2, 'down'));
      expect(result.current.collections[0].folders![0].id).toBe(f1);
    });

    it('reorders a folder before another', async () => {
      const { result } = await withCol();
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(colId, 'F1'); });
      act(() => { f2 = result.current.addFolder(colId, 'F2'); });
      act(() => result.current.reorderFolder(colId, f2, f1));
      expect(result.current.collections[0].folders![0].id).toBe(f2);
    });

    it('moves a folder into another folder and back to root', async () => {
      const { result } = await withCol();
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(colId, 'F1'); });
      act(() => { f2 = result.current.addFolder(colId, 'F2'); });
      act(() => result.current.moveFolderTo(colId, f2, f1));
      expect(result.current.collections[0].folders).toHaveLength(1);
      expect(result.current.collections[0].folders![0].folders![0].id).toBe(f2);
      act(() => result.current.moveFolderTo(colId, f2, null));
      expect(result.current.collections[0].folders).toHaveLength(2);
    });

    it('moveFolderTo is a no-op when target equals folder', async () => {
      const { result } = await withCol();
      let f1 = '';
      act(() => { f1 = result.current.addFolder(colId, 'F1'); });
      act(() => result.current.moveFolderTo(colId, f1, f1));
      expect(result.current.collections[0].folders).toHaveLength(1);
    });
  });

  describe('requests', () => {
    let colId = '';
    async function withCol() {
      const hook = await setup();
      act(() => { colId = hook.result.current.addCollection({ name: 'C' }); });
      return hook;
    }

    it('adds, updates, duplicates and removes a request', async () => {
      const { result } = await withCol();
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId); });
      expect(result.current.selectedRequest?.id).toBe(reqId);

      act(() => result.current.updateRequest(colId, reqId, { name: 'Updated' }));
      expect(result.current.selectedRequest?.name).toBe('Updated');

      act(() => result.current.duplicateRequest(colId, reqId));
      expect(result.current.collections[0].requests).toHaveLength(2);

      act(() => result.current.removeRequest(colId, reqId));
      expect(result.current.collections[0].requests).toHaveLength(1);
    });

    it('duplicateRequest preserves folder placement', async () => {
      const { result } = await withCol();
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, folderId); });
      act(() => result.current.duplicateRequest(colId, reqId));
      expect(result.current.collections[0].folders![0].requests).toHaveLength(2);
    });

    it('duplicateRequest is a no-op for unknown collection/request', async () => {
      const { result } = await withCol();
      act(() => result.current.duplicateRequest('nope', 'nope'));
      act(() => result.current.duplicateRequest(colId, 'nope'));
      expect(result.current.collections[0].requests).toHaveLength(0);
    });

    it('moves a request to a folder and back to root with ordering', async () => {
      const { result } = await withCol();
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(colId); });
      act(() => { r2 = result.current.addRequest(colId); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      act(() => result.current.moveRequest(colId, r2, folderId));
      expect(result.current.collections[0].folders![0].requests.some((r) => r.id === r2)).toBe(true);
      act(() => result.current.moveRequest(colId, r2, null, r1));
      expect(result.current.collections[0].requests[0].id).toBe(r2);
    });

    it('moveRequest to root appends when beforeReqId not found', async () => {
      const { result } = await withCol();
      let r1 = '';
      act(() => { r1 = result.current.addRequest(colId); });
      act(() => result.current.moveRequest(colId, r1, null, 'missing'));
      expect(result.current.collections[0].requests[0].id).toBe(r1);
    });

    it('moveRequest is a no-op for unknown ids', async () => {
      const { result } = await withCol();
      act(() => result.current.moveRequest('nope', 'x', null));
      act(() => result.current.moveRequest(colId, 'x', null));
      expect(result.current.collections[0].requests).toHaveLength(0);
    });

    it('selectRequest auto-saves a version of the prior request', async () => {
      const { result } = await withCol();
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(colId); });
      act(() => result.current.updateRequest(colId, r1, { url: 'https://a' }));
      act(() => { r2 = result.current.addRequest(colId); });
      act(() => result.current.selectRequest(colId, r1));
      expect(result.current.data.selectedRequestId).toBe(r1);
      expect(r2).not.toBe(r1);
    });
  });

  describe('cross-collection moves', () => {
    it('moves a request to another collection', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(src); });
      act(() => result.current.moveRequestToCollection(src, reqId, dest, null));
      const destCol = result.current.collections.find((c) => c.id === dest);
      expect(destCol?.requests.some((r) => r.id === reqId)).toBe(true);
    });

    it('moves a request within the same collection into a folder', async () => {
      const { result } = await setup();
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(src); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(src, 'F'); });
      act(() => result.current.moveRequestToCollection(src, reqId, src, folderId));
      expect(result.current.collections[0].folders![0].requests.some((r) => r.id === reqId)).toBe(true);
    });

    it('moveRequestToCollection is a no-op for unknown ids', async () => {
      const { result } = await setup();
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => result.current.moveRequestToCollection('nope', 'x', src, null));
      act(() => result.current.moveRequestToCollection(src, 'x', src, null));
      expect(result.current.collections[0].requests).toHaveLength(0);
    });

    it('moves a folder to another collection and within the same collection', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(src, 'F'); });
      act(() => result.current.moveFolderToCollection(src, folderId, dest, null));
      const destCol = result.current.collections.find((c) => c.id === dest);
      expect(destCol?.folders?.some((f) => f.id === folderId)).toBe(true);

      // move within the same collection into a parent folder
      let parent = '';
      act(() => { parent = result.current.addFolder(dest, 'parent'); });
      act(() => result.current.moveFolderToCollection(dest, folderId, dest, parent));
      const updated = result.current.collections.find((c) => c.id === dest);
      expect(updated?.folders?.find((f) => f.id === parent)?.folders?.some((f) => f.id === folderId)).toBe(true);
    });

    it('moveFolderToCollection is a no-op for unknown ids', async () => {
      const { result } = await setup();
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => result.current.moveFolderToCollection('nope', 'x', src, null));
      act(() => result.current.moveFolderToCollection(src, 'x', src, null));
      expect(result.current.collections[0].folders ?? []).toHaveLength(0);
    });

    it('converts a collection into a sub-collection of another', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      act(() => result.current.moveCollectionAsSubCollection(src, dest));
      expect(result.current.collections.some((c) => c.id === src)).toBe(false);
      const destCol = result.current.collections.find((c) => c.id === dest);
      expect(destCol?.folders?.some((f) => f.isSubCollection && f.name === 'src')).toBe(true);
    });

    it('moveCollectionAsSubCollection is a no-op for unknown/same ids', async () => {
      const { result } = await setup();
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => result.current.moveCollectionAsSubCollection(src, src));
      act(() => result.current.moveCollectionAsSubCollection('nope', src));
      expect(result.current.collections).toHaveLength(1);
    });
  });

  describe('groups', () => {
    it('adds, renames, moves and deletes a group', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      expect(result.current.collections.find((c) => c.id === g1)?.mode).toBe('group');

      act(() => result.current.renameGroup(g1, 'G1-renamed'));
      expect(result.current.collections.find((c) => c.id === g1)?.name).toBe('G1-renamed');

      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      act(() => result.current.moveToGroup(colId, g1));
      expect(result.current.collections.find((c) => c.id === colId)?.groupId).toBe(g1);

      act(() => result.current.deleteGroup(g1));
      expect(result.current.collections.some((c) => c.id === g1)).toBe(false);
    });

    it('moveToGroup prevents cyclic nesting', async () => {
      const { result } = await setup();
      let g1 = '';
      let g2 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      act(() => { g2 = result.current.addGroup('G2', g1); });
      // moving g1 into g2 (its own descendant) should be rejected
      act(() => result.current.moveToGroup(g1, g2));
      expect(result.current.collections.find((c) => c.id === g1)?.groupId).toBeUndefined();
    });

    it('moveToGroup is a no-op for unknown collection', async () => {
      const { result } = await setup();
      act(() => result.current.moveToGroup('nope', undefined));
      expect(result.current.collections).toHaveLength(0);
    });

    it('deleteGroup is a no-op for a non-group id', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      act(() => result.current.deleteGroup(colId));
      expect(result.current.collections).toHaveLength(1);
    });

    it('duplicates a group with its children', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      act(() => result.current.moveToGroup(colId, g1));
      act(() => result.current.duplicateGroup(g1));
      expect(result.current.collections.some((c) => c.mode === 'group' && c.name === 'G1 (copy)')).toBe(true);
    });

    it('duplicateGroup is a no-op for a non-group id', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      const before = result.current.collections.length;
      act(() => result.current.duplicateGroup(colId));
      expect(result.current.collections).toHaveLength(before);
    });
  });

  describe('imports', () => {
    it('imports a collection', async () => {
      const { result } = await setup();
      act(() => result.current.importCollection({ id: 'imp', name: 'Imported', requests: [], folders: [] }));
      expect(result.current.selectedCollection?.id).toBe('imp');
    });

    it('imports a folder at root and under a parent', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      act(() => result.current.importFolder(colId, { id: 'f-root', name: 'root', requests: [], folders: [] }));
      expect(result.current.collections[0].folders!.some((f) => f.id === 'f-root')).toBe(true);
      act(() => result.current.importFolder(colId, { id: 'f-child', name: 'child', requests: [], folders: [] }, 'f-root'));
      expect(result.current.collections[0].folders![0].folders!.some((f) => f.id === 'f-child')).toBe(true);
    });

    it('importFolder is a no-op for unknown collection', async () => {
      const { result } = await setup();
      act(() => { result.current.addCollection({ name: 'C' }); });
      act(() => result.current.importFolder('nope', { id: 'x', name: 'x', requests: [], folders: [] }));
      expect(result.current.collections[0].folders ?? []).toHaveLength(0);
    });

    it('imports requests into a folder', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      act(() => result.current.importRequests(colId, folderId, [
        { id: 'r1', name: 'r1', method: 'GET', url: '', headers: [], body: '', auth: { type: 'none' } },
        { id: 'r2', name: 'r2', method: 'GET', url: '', headers: [], body: '', auth: { type: 'none' } },
      ]));
      expect(result.current.collections[0].folders![0].requests).toHaveLength(2);
    });

    it('importRequests is a no-op for unknown collection', async () => {
      const { result } = await setup();
      act(() => { result.current.addCollection({ name: 'C' }); });
      act(() => result.current.importRequests('nope', 'f', []));
      expect(result.current.collections[0].requests).toHaveLength(0);
    });
  });

  it('exposes countAllRequests helper', async () => {
    const { result } = await setup();
    expect(typeof result.current.countAllRequests).toBe('function');
  });
});
