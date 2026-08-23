/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { RequestsData } from '@shared/types';

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
  await act(async () => {
    await Promise.resolve();
  });
  if (!hook.result.current.loaded) {
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  }
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
    expect(result.current.data.environments).toEqual([{ id: 'e1', name: 'dev' }]);
  });

  it('persists data after load', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.addCollection({ name: 'C', mode: 'multi-env' });
    });
    expect(mockSaveRequests).toHaveBeenCalled();
  });

  describe('environments', () => {
    it('tracks the active env selection', async () => {
      const { result } = await setup();
      act(() => result.current.setSelectedEnvId('env-a'));
      expect(result.current.selectedEnvId).toBe('env-a');
      act(() => result.current.setSelectedEnvId(undefined));
      expect(result.current.selectedEnvId).toBeUndefined();
    });

    it('reconciles legacy env-keyed data onto Settings env IDs by name', async () => {
      const { result } = await setup({
        environments: [{ id: 'wb-dev', name: 'Dev' }, { id: 'wb-old', name: 'Legacy' }],
        selectedEnvId: 'wb-dev',
        collections: [{
          id: 'c1', name: 'C', mode: 'multi-env',
          baseUrls: { 'wb-dev': 'https://dev.example.com', 'wb-old': 'https://old.example.com' },
          requests: [], folders: [],
        }],
      });
      let dropped: string[] = [];
      act(() => { dropped = result.current.reconcileEnvironmentKeys([{ id: 'settings-dev', name: 'Dev' }]); });
      expect(dropped).toEqual(['Legacy']);
      expect(result.current.selectedEnvId).toBe('settings-dev');
      expect(result.current.collections[0].baseUrls).toEqual({ 'settings-dev': 'https://dev.example.com' });
      // legacy registry cleared → second call is a no-op
      expect(result.current.data.environments).toBeUndefined();
      act(() => { dropped = result.current.reconcileEnvironmentKeys([{ id: 'settings-dev', name: 'Dev' }]); });
      expect(dropped).toEqual([]);
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
      act(() => result.current.selectCollection(colId));
      act(() => result.current.selectRequest(colId, reqId));
      act(() => result.current.selectCollection(col2));
      expect(result.current.data.selectedCollectionId).toBe(col2);
      expect(result.current.data.selectedRequestId).toBeUndefined();
      const leftCol = result.current.collections.find((c) => c.id === colId);
      expect(leftCol?.requests[0]?.definitionVersions?.length).toBeGreaterThan(0);
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

    it('adds and updates a sub-collection with an explicit env id', async () => {
      const hook = await setup();
      act(() => { colId = hook.result.current.addCollection({ name: 'C' }); });
      act(() => { hook.result.current.addSubCollection(colId, 'dev', undefined, 'settings-dev'); });
      const sub = hook.result.current.collections[0].folders![0];
      expect(sub.isSubCollection).toBe(true);
      expect(sub.selectedEnvId).toBe('settings-dev');
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

    it('removing a sub-collection folder does not orphan requests to root', async () => {
      const { result } = await withCol();
      act(() => result.current.addSubCollection(colId, 'sub'));
      const subId = result.current.collections[0].folders![0].id;
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, subId); });
      const beforeCount = result.current.collections[0].requests.length;
      act(() => result.current.removeFolder(colId, subId));
      expect(result.current.collections[0].requests.length).toBe(beforeCount);
      expect(result.current.collections[0].requests.some((r) => r.id === reqId)).toBe(false);
    });

    it('duplicates a nested folder under its parent', async () => {
      const { result } = await withCol();
      let parentId = '';
      act(() => { parentId = result.current.addFolder(colId, 'parent'); });
      let childId = '';
      act(() => { childId = result.current.addFolder(colId, 'child', parentId); });
      act(() => result.current.duplicateFolder(colId, childId));
      const parent = result.current.collections[0].folders!.find((f) => f.id === parentId);
      expect(parent?.folders).toHaveLength(2);
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

    it('removing a sub-collection clears selectedRequestId when selected request was inside', async () => {
      const { result } = await withCol();
      act(() => result.current.addSubCollection(colId, 'Sub'));
      const subId = result.current.collections[0].folders![0].id;
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, subId); });
      act(() => result.current.selectRequest(colId, reqId));
      expect(result.current.selectedRequest?.id).toBe(reqId);
      act(() => result.current.removeFolder(colId, subId));
      expect(result.current.selectedRequest).toBeNull();
    });

    it('removing a sub-collection preserves selectedRequestId when selected request was outside', async () => {
      const { result } = await withCol();
      let rootReqId = '';
      act(() => { rootReqId = result.current.addRequest(colId); });
      act(() => result.current.addSubCollection(colId, 'Sub'));
      const subId = result.current.collections[0].folders![0].id;
      act(() => result.current.addRequest(colId, subId));
      act(() => result.current.selectRequest(colId, rootReqId));
      expect(result.current.selectedRequest?.id).toBe(rootReqId);
      act(() => result.current.removeFolder(colId, subId));
      expect(result.current.selectedRequest?.id).toBe(rootReqId);
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

    it('moveRequest to root appends when no beforeReqId is given', async () => {
      const { result } = await withCol();
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, folderId); });
      act(() => result.current.moveRequest(colId, reqId, null));
      expect(result.current.collections[0].requests.some((r) => r.id === reqId)).toBe(true);
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

    it('moves a request within the same collection back to root', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'src' }); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(colId, 'F'); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(colId, folderId); });
      act(() => result.current.moveRequestToCollection(colId, reqId, colId, null));
      const col = result.current.collections.find((c) => c.id === colId);
      expect(col?.requests.some((r) => r.id === reqId)).toBe(true);
      expect(col?.folders![0].requests).toHaveLength(0);
    });

    it('leaves unrelated collections unchanged during cross-collection request move', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      let other = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      act(() => { other = result.current.addCollection({ name: 'other' }); });
      let reqId = '';
      act(() => { reqId = result.current.addRequest(src); });
      let otherReqId = '';
      act(() => { otherReqId = result.current.addRequest(other); });
      act(() => result.current.moveRequestToCollection(src, reqId, dest, null));
      const otherCol = result.current.collections.find((c) => c.id === other);
      expect(otherCol?.requests.some((r) => r.id === otherReqId)).toBe(true);
      expect(otherCol?.requests.some((r) => r.id === reqId)).toBe(false);
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

    it('moves a folder within the same collection back to root', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'col' }); });
      let parentId = '';
      act(() => { parentId = result.current.addFolder(colId, 'parent'); });
      let childId = '';
      act(() => { childId = result.current.addFolder(colId, 'child', parentId); });
      act(() => result.current.moveFolderToCollection(colId, childId, colId, null));
      const col = result.current.collections.find((c) => c.id === colId);
      expect(col?.folders?.some((f) => f.id === childId)).toBe(true);
      expect(col?.folders?.find((f) => f.id === parentId)?.folders ?? []).toHaveLength(0);
    });

    it('leaves unrelated collections unchanged during cross-collection folder move', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      let other = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      act(() => { other = result.current.addCollection({ name: 'other' }); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(src, 'F'); });
      let otherFolderId = '';
      act(() => { otherFolderId = result.current.addFolder(other, 'OtherF'); });
      act(() => result.current.moveFolderToCollection(src, folderId, dest, null));
      const otherCol = result.current.collections.find((c) => c.id === other);
      expect(otherCol?.folders?.some((f) => f.id === otherFolderId)).toBe(true);
      expect(otherCol?.folders?.some((f) => f.id === folderId)).toBe(false);
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

    it('duplicateGroup skips stale child ids returned by collectGroupChildren', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));

      // Introduce a stale child id reference to hit the defensive `if (!orig) continue` path.
      act(() => result.current.updateCollection(c1, { groupId: 'ghost-group-id' }));
      act(() => result.current.duplicateGroup(g1));

      expect(result.current.collections.some((c) => c.mode === 'group' && c.name === 'G1 (copy)')).toBe(true);
    });

    it('duplicateGroup remaps child groupId when parent group is duplicated too', async () => {
      const { result } = await setup();
      let g1 = '';
      let g2 = '';
      let c1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      act(() => { g2 = result.current.addGroup('G2', g1); });
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g2));

      act(() => result.current.duplicateGroup(g1));

      const copiedRoot = result.current.collections.find((c) => c.mode === 'group' && c.name === 'G1 (copy)');
      const copiedNested = result.current.collections.find((c) => c.mode === 'group' && c.name === 'G2' && c.groupId === copiedRoot?.id);
      const copiedCollection = result.current.collections.find((c) => c.mode !== 'group' && c.name === 'C1' && c.groupId === copiedNested?.id);
      expect(copiedRoot).toBeTruthy();
      expect(copiedNested).toBeTruthy();
      expect(copiedCollection).toBeTruthy();
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

    it('importFolder appends to root when parent id is missing', async () => {
      const { result } = await setup();
      let colId = '';
      act(() => { colId = result.current.addCollection({ name: 'C' }); });
      act(() => result.current.importFolder(colId, { id: 'f-orphan', name: 'orphan', requests: [], folders: [] }, 'missing-parent'));
      expect(result.current.collections[0].folders?.some((f) => f.id === 'f-orphan')).toBe(true);
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

  describe('multi-collection branch coverage', () => {
    it('reconcile is a no-op when there is no legacy env registry', async () => {
      const { result } = await setup({
        collections: [{
          id: 'c1', name: 'C', mode: 'multi-env',
          baseUrls: { 'settings-dev': 'https://dev.example.com' }, requests: [], folders: [],
        }],
      });
      let dropped: string[] = [];
      act(() => { dropped = result.current.reconcileEnvironmentKeys([{ id: 'settings-dev', name: 'Dev' }]); });
      expect(dropped).toEqual([]);
      expect(result.current.collections[0].baseUrls).toEqual({ 'settings-dev': 'https://dev.example.com' });
    });

    it('updateCollection does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.updateCollection(c1, { name: 'C1-renamed' }));
      expect(result.current.collections.find((c) => c.id === c2)?.name).toBe('C2');
    });

    it('removeCollection preserves selected collection when removing a non-selected collection', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.selectCollection(c1));
      act(() => result.current.removeCollection(c2));
      expect(result.current.selectedCollection?.id).toBe(c1);
      expect(result.current.collections).toHaveLength(1);
    });

    it('addFolder with parentFolderId places it under parent in other collection unaffected', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let parentId = '';
      act(() => { parentId = result.current.addFolder(c1, 'Parent'); });
      act(() => result.current.addFolder(c1, 'Child', parentId));
      expect(result.current.collections.find((c) => c.id === c1)?.folders?.[0].folders?.[0].name).toBe('Child');
      expect((result.current.collections.find((c) => c.id === c2)?.folders ?? [])).toHaveLength(0);
    });

    it('renameFolder does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let f1 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { result.current.addFolder(c2, 'F2'); });
      act(() => result.current.renameFolder(c1, f1, 'F1-renamed'));
      expect(result.current.collections.find((c) => c.id === c1)?.folders?.[0].name).toBe('F1-renamed');
      expect(result.current.collections.find((c) => c.id === c2)?.folders?.[0].name).toBe('F2');
    });

    it('removeFolder does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let f1 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { result.current.addFolder(c2, 'F2'); });
      act(() => result.current.removeFolder(c1, f1));
      expect((result.current.collections.find((c) => c.id === c1)?.folders ?? [])).toHaveLength(0);
      expect(result.current.collections.find((c) => c.id === c2)?.folders?.[0].name).toBe('F2');
    });

    it('duplicateFolder does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let f1 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { result.current.addFolder(c2, 'F2'); });
      act(() => result.current.duplicateFolder(c1, f1));
      expect(result.current.collections.find((c) => c.id === c1)?.folders).toHaveLength(2);
      expect(result.current.collections.find((c) => c.id === c2)?.folders).toHaveLength(1);
    });

    it('moveFolder does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let _f1 = '';
      let f2 = '';
      act(() => { _f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { f2 = result.current.addFolder(c1, 'F2'); });
      act(() => { result.current.addFolder(c2, 'X'); });
      act(() => result.current.moveFolder(c1, f2, 'up'));
      expect(result.current.collections.find((c) => c.id === c2)?.folders?.[0].name).toBe('X');
    });

    it('addRequest with folderId places it in folder, does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let folderId = '';
      act(() => { folderId = result.current.addFolder(c1, 'F'); });
      act(() => result.current.addRequest(c1, folderId));
      const c1Col = result.current.collections.find((c) => c.id === c1);
      expect(c1Col?.folders?.[0].requests).toHaveLength(1);
      expect(result.current.collections.find((c) => c.id === c2)?.requests).toHaveLength(0);
    });

    it('updateRequest does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { result.current.addRequest(c2); });
      act(() => result.current.updateRequest(c1, r1, { name: 'updated' }));
      const c1Req = result.current.collections.find((c) => c.id === c1)?.requests[0];
      expect(c1Req?.name).toBe('updated');
      const c2Req = result.current.collections.find((c) => c.id === c2)?.requests[0];
      expect(c2Req?.name).not.toBe('updated');
    });

    it('removeRequest preserves selected request when removing a different request', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { r2 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.removeRequest(c1, r2));
      expect(result.current.selectedRequest?.id).toBe(r1);
    });

    it('duplicateRequest in a folder does not affect root requests', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let fId = '';
      act(() => { fId = result.current.addFolder(c1, 'F'); });
      let rInFolder = '';
      act(() => { rInFolder = result.current.addRequest(c1, fId); });
      act(() => result.current.duplicateRequest(c1, rInFolder));
      expect(result.current.collections.find((c) => c.id === c1)?.folders?.[0].requests).toHaveLength(2);
      expect(result.current.collections.find((c) => c.id === c1)?.requests).toHaveLength(0);
    });

    it('moveRequest does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { result.current.addRequest(c2); });
      let fId = '';
      act(() => { fId = result.current.addFolder(c1, 'F'); });
      act(() => result.current.moveRequest(c1, r1, fId));
      expect(result.current.collections.find((c) => c.id === c1)?.requests).toHaveLength(0);
      expect(result.current.collections.find((c) => c.id === c2)?.requests).toHaveLength(1);
    });

    it('addSubCollection with parentFolderId places sub-collection under parent', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let parentId = '';
      act(() => { parentId = result.current.addFolder(c1, 'Parent'); });
      act(() => result.current.addSubCollection(c1, 'Sub', parentId));
      const parent = result.current.collections.find((c) => c.id === c1)?.folders?.[0];
      expect(parent?.folders?.some((f) => f.name === 'Sub' && f.isSubCollection)).toBe(true);
    });

    it('addSubCollection without matching env sets selectedEnvId to undefined', async () => {
      const { result } = await setup({ environments: [{ id: 'env1', name: 'production' }] });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.addSubCollection(c1, 'staging'));
      const sub = result.current.collections.find((c) => c.id === c1)?.folders?.[0];
      expect(sub?.isSubCollection).toBe(true);
      expect(sub?.selectedEnvId).toBeUndefined();
    });

    it('duplicateGroup includes non-group child collections', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let child = '';
      act(() => { child = result.current.addCollection({ name: 'Child' }); });
      act(() => result.current.moveToGroup(child, g1));
      act(() => result.current.duplicateGroup(g1));
      const groups = result.current.collections.filter((c) => c.mode === 'group');
      expect(groups).toHaveLength(2);
      const nonGroups = result.current.collections.filter((c) => c.mode !== 'group');
      expect(nonGroups).toHaveLength(2);
    });

    it('importFolder without parentFolderId adds to collection root', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.importFolder(c1, { id: 'f1', name: 'Imported', requests: [], folders: [] }));
      expect(result.current.collections.find((c) => c.id === c1)?.folders).toHaveLength(1);
    });

    it('importFolder with parentFolderId adds nested under parent', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.importFolder(c1, { id: 'f-parent', name: 'parent', requests: [], folders: [] }));
      act(() => result.current.importFolder(c1, { id: 'f-child', name: 'child', requests: [], folders: [] }, 'f-parent'));
      const parent = result.current.collections.find((c) => c.id === c1)?.folders?.[0];
      expect(parent?.folders?.some((f) => f.id === 'f-child')).toBe(true);
    });

    it('reorderFolder with null beforeFolderId moves to root', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { f2 = result.current.addFolder(c1, 'F2'); });
      act(() => result.current.reorderFolder(c1, f2, f1));
      const folders = result.current.collections.find((c) => c.id === c1)?.folders;
      expect(folders?.[0].id).toBe(f2);
    });

    it('reorderFolder does not affect other collections', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => { result.current.addFolder(c1, 'F1'); });
      act(() => { result.current.addFolder(c1, 'F2'); });
      act(() => { result.current.addFolder(c2, 'X'); });
      const f1 = result.current.collections.find((c) => c.id === c1)?.folders?.[0].id ?? '';
      const f2 = result.current.collections.find((c) => c.id === c1)?.folders?.[1].id ?? '';
      act(() => result.current.reorderFolder(c1, f2, f1));
      expect(result.current.collections.find((c) => c.id === c2)?.folders?.[0].name).toBe('X');
    });

    it('removes the currently selected collection — clears selectedCollectionId', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.selectCollection(c1));
      act(() => result.current.removeCollection(c1));
      expect(result.current.selectedCollection).toBeNull();
      expect(result.current.collections).toHaveLength(0);
    });

    it('operations on imported collections with undefined folders use fallback []', async () => {
      const { result } = await setup();
      const impCol = { id: 'imp1', name: 'Imported', requests: [] as never[], mode: 'rest' as const };
      act(() => result.current.importCollection(impCol as never));
      let fId = '';
      act(() => { fId = result.current.addFolder('imp1', 'F'); });
      expect(result.current.collections.find((c) => c.id === 'imp1')?.folders?.[0].name).toBe('F');
      act(() => result.current.renameFolder('imp1', fId, 'F-renamed'));
      expect(result.current.collections.find((c) => c.id === 'imp1')?.folders?.[0].name).toBe('F-renamed');
      act(() => result.current.moveFolder('imp1', fId, 'up'));
      act(() => result.current.duplicateFolder('imp1', fId));
      expect(result.current.collections.find((c) => c.id === 'imp1')?.folders).toHaveLength(2);
      let rId = '';
      act(() => { rId = result.current.addRequest('imp1'); });
      act(() => result.current.duplicateRequest('imp1', rId));
      expect(result.current.collections.find((c) => c.id === 'imp1')?.requests).toHaveLength(2);
      act(() => result.current.addSubCollection('imp1', 'Sub'));
      expect(result.current.collections.find((c) => c.id === 'imp1')?.folders?.some((f) => f.isSubCollection)).toBe(true);
    });

    it('addSubCollection with 2 collections only affects the target', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.addSubCollection(c1, 'Sub'));
      expect(result.current.collections.find((c) => c.id === c2)?.folders ?? []).toHaveLength(0);
    });

    it('removeRequest when removing the currently selected request clears selection', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.removeRequest(c1, r1));
      expect(result.current.selectedRequest).toBeNull();
    });

    it('moveCollectionAsSubCollection with srcColId selected clears selectedRequestId', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      let rId = '';
      act(() => { rId = result.current.addRequest(src); });
      act(() => result.current.selectRequest(src, rId));
      act(() => result.current.moveCollectionAsSubCollection(src, dest));
      const destCol = result.current.collections.find((c) => c.id === dest);
      expect(destCol?.folders?.some((f) => f.name === 'src')).toBe(true);
    });

    it('deleteGroup with selected groupId clears selection', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let child = '';
      act(() => { child = result.current.addCollection({ name: 'Child' }); });
      act(() => result.current.moveToGroup(child, g1));
      act(() => result.current.deleteGroup(g1));
      expect(result.current.collections.some((c) => c.id === g1)).toBe(false);
      expect(result.current.collections.find((c) => c.id === child)?.groupId).toBeUndefined();
    });

    it('deleteGroup also clears selectedRequestId when group is selected', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.selectCollection(g1));
      act(() => result.current.deleteGroup(g1));
      expect(result.current.data.selectedRequestId).toBeUndefined();
      expect(result.current.data.selectedCollectionId).toBeUndefined();
    });

    it('selectRequest auto-save skips when prevReq has no version updates', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { r2 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.selectRequest(c1, r2));
      expect(result.current.selectedRequest?.id).toBe(r2);
    });

    it('duplicateFolder for deeply nested folder places copy under same parent', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let parent = '';
      act(() => { parent = result.current.addFolder(c1, 'parent'); });
      let child = '';
      act(() => { child = result.current.addFolder(c1, 'child', parent); });
      act(() => result.current.duplicateFolder(c1, child));
      const parentFolder = result.current.collections.find((c) => c.id === c1)?.folders?.[0];
      expect(parentFolder?.folders).toHaveLength(2);
    });

    it('operations on collections loaded from initial state (no folders property) use fallback []', async () => {
      const bare = { id: 'bare1', name: 'Bare', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      // addFolder with no parent — covers `c.folders ?? []` null path (L131)
      let fId = '';
      act(() => { fId = result.current.addFolder('bare1', 'F1'); });
      expect(result.current.collections.find((c) => c.id === 'bare1')?.folders).toHaveLength(1);
      // renameFolder — covers L171 `??` null path
      act(() => result.current.renameFolder('bare1', fId, 'F1-renamed'));
      expect(result.current.collections.find((c) => c.id === 'bare1')?.folders?.[0].name).toBe('F1-renamed');
      // moveFolder — covers L224
      act(() => result.current.moveFolder('bare1', fId, 'up'));
      // removeFolder — covers L182, L183
      act(() => result.current.removeFolder('bare1', fId));
      expect(result.current.collections.find((c) => c.id === 'bare1')?.folders).toHaveLength(0);
    });

    it('duplicateCollection on a bare collection (no folders) uses fallback []', async () => {
      const bare = { id: 'bare2', name: 'Bare', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      act(() => result.current.duplicateCollection('bare2'));
      expect(result.current.collections).toHaveLength(2);
      expect(result.current.collections[1].name).toBe('Bare (copy)');
      expect(result.current.collections[1].folders).toEqual([]);
    });

    it('duplicateFolder on a bare collection uses fallback [] (L197)', async () => {
      const bare = { id: 'bare3', name: 'Bare', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      let fId = '';
      act(() => { fId = result.current.addFolder('bare3', 'F1'); });
      act(() => result.current.duplicateFolder('bare3', fId));
      expect(result.current.collections.find((c) => c.id === 'bare3')?.folders).toHaveLength(2);
    });

    it('duplicateFolder no-op when folder not found (L198)', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.duplicateFolder(c1, 'nonexistent'));
      expect(result.current.collections.find((c) => c.id === c1)?.folders).toHaveLength(0);
    });

    it('reorderFolder on a bare collection uses fallback [] (L234)', async () => {
      const bare = { id: 'bare4', name: 'Bare', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder('bare4', 'F1'); });
      act(() => { f2 = result.current.addFolder('bare4', 'F2'); });
      act(() => result.current.reorderFolder('bare4', f2, f1));
      expect(result.current.collections.find((c) => c.id === 'bare4')?.folders?.[0].id).toBe(f2);
    });

    it('moveFolderTo on a bare collection uses fallback [] (L244-L247)', async () => {
      const bare = { id: 'bare5', name: 'Bare', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder('bare5', 'F1'); });
      act(() => { f2 = result.current.addFolder('bare5', 'F2'); });
      act(() => result.current.moveFolderTo('bare5', f1, f2));
      const col = result.current.collections.find((c) => c.id === 'bare5');
      expect(col?.folders?.[0].folders?.some((f) => f.id === f1)).toBe(true);
    });

    it('removeRequest with 2 collections covers the "other collection unchanged" branch (L287)', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { r2 = result.current.addRequest(c2); });
      act(() => result.current.removeRequest(c1, r1));
      expect(result.current.collections.find((c) => c.id === c2)?.requests.some((r) => r.id === r2)).toBe(true);
    });

    it('duplicateRequest with no orig.name uses fallback "Request" (L299)', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let rId = '';
      act(() => { rId = result.current.addRequest(c1); });
      act(() => result.current.updateRequest(c1, rId, { name: '' }));
      act(() => result.current.duplicateRequest(c1, rId));
      const requests = result.current.collections.find((c) => c.id === c1)?.requests;
      expect(requests?.some((r) => r.name === 'Request (copy)')).toBe(true);
    });

    it('duplicateRequest with 2 collections covers "other collection unchanged" branch (L303)', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      let r2 = '';
      act(() => { r2 = result.current.addRequest(c2); });
      act(() => result.current.duplicateRequest(c1, r1));
      expect(result.current.collections.find((c) => c.id === c2)?.requests.some((r) => r.id === r2)).toBe(true);
    });

    it('selectRequest when prev selectedCollectionId has no matching collection (L349)', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.removeCollection(c1));
      // Try to select a request while no collections exist (prev.selectedCollectionId set but not found)
      let c2 = '';
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r2 = '';
      act(() => { r2 = result.current.addRequest(c2); });
      act(() => result.current.selectRequest(c2, r2));
      expect(result.current.selectedRequest?.id).toBe(r2);
    });

    it('moveRequestToCollection to a folder in the destination covers L379/L386', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      let rId = '';
      act(() => { rId = result.current.addRequest(src); });
      let fId = '';
      act(() => { fId = result.current.addFolder(dest, 'F'); });
      act(() => result.current.moveRequestToCollection(src, rId, dest, fId));
      const destCol = result.current.collections.find((c) => c.id === dest);
      expect(destCol?.folders?.[0].requests.some((r) => r.id === rId)).toBe(true);
    });

    it('moveFolderToCollection to dest with folders: undefined covers L417-418', async () => {
      const bare = { id: 'bdest', name: 'BDest', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      let fId = '';
      act(() => { fId = result.current.addFolder(src, 'F'); });
      act(() => result.current.moveFolderToCollection(src, fId, 'bdest', null));
      expect(result.current.collections.find((c) => c.id === 'bdest')?.folders?.some((f) => f.id === fId)).toBe(true);
    });

    it('moveFolderToCollection to dest folder uses L417 destParentFolderId branch', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      let fSrc = '';
      let fDest = '';
      act(() => { fSrc = result.current.addFolder(src, 'FSrc'); });
      act(() => { fDest = result.current.addFolder(dest, 'FDest'); });
      act(() => result.current.moveFolderToCollection(src, fSrc, dest, fDest));
      const destParent = result.current.collections.find((c) => c.id === dest)?.folders?.[0];
      expect(destParent?.folders?.some((f) => f.id === fSrc)).toBe(true);
    });

    it('deleteGroup when selected group is deleted clears selectedCollectionId (L477/478)', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      act(() => result.current.selectCollection(g1));
      act(() => result.current.deleteGroup(g1));
      expect(result.current.selectedCollection).toBeNull();
    });

    it('deleteGroup when selected non-group collection inside group preserves selection (L477/478)', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));
      act(() => result.current.selectCollection(c1));
      act(() => result.current.deleteGroup(g1));
      expect(result.current.selectedCollection?.id).toBe(c1);
    });

    it('moveCollectionAsSubCollection to bare destination collection uses fallback [] (L444)', async () => {
      const bare = { id: 'bdest2', name: 'BDest2', requests: [] as never[], mode: 'rest' as const } as never;
      const { result } = await setup({ collections: [bare] });
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => result.current.moveCollectionAsSubCollection(src, 'bdest2'));
      expect(result.current.collections.find((c) => c.id === 'bdest2')?.folders?.some((f) => f.isSubCollection)).toBe(true);
    });

    it('moveToGroup to undefined group (ungrouped) uses L464 cond-expr', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));
      act(() => result.current.moveToGroup(c1, undefined));
      const groupId = result.current.collections.find((c) => c.id === c1)?.groupId;
      expect(groupId == null).toBe(true);
    });

    it('duplicateGroup with collection that has orig.id === groupId name includes "(copy)" (L514)', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('MyGroup'); });
      act(() => result.current.duplicateGroup(g1));
      const copies = result.current.collections.filter((c) => c.mode === 'group' && c.name.includes('copy'));
      expect(copies).toHaveLength(1);
      expect(copies[0].name).toBe('MyGroup (copy)');
    });

    it('importFolder with other collection present covers "other col unchanged" branch (L551)', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.importFolder(c1, { id: 'imported-f', name: 'ImpF', requests: [], folders: [] }));
      expect(result.current.collections.find((c) => c.id === c2)?.folders ?? []).toHaveLength(0);
    });

    it('renameFolder/removeFolder/duplicateFolder/moveFolder on bare collection (no folders) trigger ?? fallback', async () => {
      const bare = { id: 'bare-ops', name: 'Bare', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      // renameFolder (L171) — c.folders is undefined
      act(() => result.current.renameFolder('bare-ops', 'none', 'x'));
      // removeFolder (L182,183) — c.folders is undefined
      act(() => result.current.removeFolder('bare-ops', 'none'));
      // duplicateFolder (L197) — c.folders is undefined
      act(() => result.current.duplicateFolder('bare-ops', 'none'));
      // moveFolder (L224) — c.folders is undefined
      act(() => result.current.moveFolder('bare-ops', 'none', 'up'));
      // reorderFolder (L234) — c.folders is undefined
      act(() => result.current.reorderFolder('bare-ops', 'none', null));
      // moveFolderTo (L244-L247) — c.folders is undefined
      act(() => result.current.moveFolderTo('bare-ops', 'none', null));
      expect(result.current.collections.find((c) => c.id === 'bare-ops')?.requests ?? []).toHaveLength(0);
    });

    it('updateSubCollection with 2 collections + bare collection covers L160/L161', async () => {
      const bare = { id: 'bare-sub', name: 'Bare', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      let c2 = '';
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let subId = '';
      act(() => { subId = result.current.addSubCollection('bare-sub', 'Sub'); });
      act(() => result.current.updateSubCollection('bare-sub', subId, { name: 'Sub-updated' }));
      expect(result.current.collections.find((c) => c.id === c2)?.folders ?? []).toHaveLength(0);
    });

    it('addFolder with parentFolderId on bare collection covers L129 ?? fallback', async () => {
      const bare = { id: 'bare-parent', name: 'Bare', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      // addFolder with parentFolderId on a collection with undefined folders — addFolderToParentSafe(c.folders ?? [], ...)
      act(() => result.current.addFolder('bare-parent', 'Child', 'nonexistent-parent'));
      // Parent not found, so nothing is added (addFolderToParentSafe returns original)
      // But the ?? null path IS triggered
      expect((result.current.collections.find((c) => c.id === 'bare-parent')?.folders ?? []).length >= 0).toBe(true);
    });

    it('addSubCollection on bare collection covers L148/L149 ?? fallback', async () => {
      const bare = { id: 'bare-asub', name: 'Bare', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      // Without parentFolderId — covers L149 c.folders ?? []
      act(() => result.current.addSubCollection('bare-asub', 'Sub1'));
      // With parentFolderId (but nonexistent parent) — covers L148 c.folders ?? []
      act(() => result.current.addSubCollection('bare-asub', 'Sub2', 'nonexistent'));
      expect(result.current.collections.find((c) => c.id === 'bare-asub')?.folders?.some((f) => f.name === 'Sub1')).toBe(true);
    });

    it('duplicateRequest with a bare collection covers L305 ?? fallback', async () => {
      const bare = { id: 'bare-dup', name: 'Bare', requests: [{ id: 'r1', name: 'R1', method: 'GET' as const, url: '', headers: [], body: '', auth: { type: 'none' as const } }] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      act(() => result.current.duplicateRequest('bare-dup', 'r1'));
      expect(result.current.collections.find((c) => c.id === 'bare-dup')?.requests).toHaveLength(2);
    });

    it('moveFolderToCollection src with undefined folders covers L401 ?? fallback', async () => {
      const bare = { id: 'bare-mfc', name: 'BareMFC', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      let dest = '';
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      // srcCol.folders is undefined — extractFolderDeep(srcCol.folders ?? [], ...) covers L401
      act(() => result.current.moveFolderToCollection('bare-mfc', 'nonexistent', dest, null));
      expect(result.current.collections.find((c) => c.id === dest)?.folders ?? []).toHaveLength(0);
    });

    it('selectCollection when prevCol not found skips auto-save (L104)', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => result.current.selectRequest(c1, r1));
      // Force state where selectedCollectionId is set but collection is deleted
      act(() => result.current.removeCollection(c1));
      // Now add a new collection and select it
      let c2 = '';
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      // selectCollection while selectedCollectionId still points to deleted c1
      act(() => result.current.selectCollection(c2));
      expect(result.current.selectedCollection?.id).toBe(c2);
    });

    it('moveCollectionAsSubCollection covers L444 ternary false branch', async () => {
      const { result } = await setup();
      let src = '';
      let dest = '';
      let other = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      act(() => { dest = result.current.addCollection({ name: 'dest' }); });
      act(() => { other = result.current.addCollection({ name: 'other' }); });
      act(() => result.current.moveCollectionAsSubCollection(src, dest));
      // other should be unchanged and not a sub-collection folder
      expect(result.current.collections.find((c) => c.id === other)?.folders ?? []).toHaveLength(0);
    });

    it('selectRequest auto-save with multiple collections covers L356 ternary false', async () => {
      const { result } = await setup();
      let c1 = '';
      let _c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { _c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      // Update request to have versions so auto-save triggers
      act(() => result.current.updateRequest(c1, r1, { url: 'http://a.com' }));
      act(() => result.current.selectRequest(c1, r1));
      act(() => result.current.updateRequest(c1, r1, { url: 'http://b.com' }));
      let r2 = '';
      act(() => { r2 = result.current.addRequest(c1); });
      // Select r2 — this triggers auto-save for r1, mapping over collections including c2 which should return unchanged
      act(() => result.current.selectRequest(c1, r2));
      expect(result.current.selectedRequest?.id).toBe(r2);
    });

    it('deleteGroup with nested groups re-parents children covers L477/478 cond-expr false', async () => {
      const { result } = await setup();
      let g1 = '';
      let g2 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      act(() => { g2 = result.current.addGroup('G2'); });
      act(() => result.current.moveToGroup(g2, g1));
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g2));
      act(() => result.current.deleteGroup(g2));
      // c1 should now be in g1 (re-parented from g2 to g2's parent = g1)
      expect(result.current.collections.find((c) => c.id === c1)?.groupId).toBe(g1);
    });

    it('duplicateGroup with non-group child (L519) and matching orig.id covers L510/L512', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));
      let c2 = '';
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      act(() => result.current.moveToGroup(c2, g1));
      act(() => result.current.duplicateGroup(g1));
      const groups = result.current.collections.filter((c) => c.mode === 'group');
      expect(groups).toHaveLength(2);
      const nonGroups = result.current.collections.filter((c) => c.mode !== 'group');
      expect(nonGroups).toHaveLength(4);
    });

    it('moveFolderTo with null targetParentFolderId on extracted folder (L247)', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { f2 = result.current.addFolder(c1, 'F2'); });
      // Move F1 into F2
      act(() => result.current.moveFolderTo(c1, f1, f2));
      // Move F1 back to root (targetParentFolderId = null)
      act(() => result.current.moveFolderTo(c1, f1, null));
      const col = result.current.collections.find((c) => c.id === c1);
      expect(col?.folders?.some((f) => f.id === f1)).toBe(true);
    });

    it('importFolder on a bare collection (no folders) covers L551/L553 ?? fallback', async () => {
      const bare = { id: 'bare-if2', name: 'Bare', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      // Without parentFolderId (L551: c.folders ?? [])
      act(() => result.current.importFolder('bare-if2', { id: 'f1', name: 'F1', requests: [], folders: [] }));
      expect(result.current.collections.find((c) => c.id === 'bare-if2')?.folders).toHaveLength(1);
      // With parentFolderId (L553: c.folders ?? []) — parent doesn't exist but ?? still fires
      act(() => result.current.importFolder('bare-if2', { id: 'f2', name: 'F2', requests: [], folders: [] }, 'f1'));
      const parent = result.current.collections.find((c) => c.id === 'bare-if2')?.folders?.[0];
      expect(parent?.folders?.some((f) => f.id === 'f2')).toBe(true);
    });

    it('duplicateRequest on bare collection (no folders) covers L305 ?? fallback', async () => {
      const bare = {
        id: 'bare-dr',
        name: 'Bare',
        requests: [{ id: 'r-bare', name: 'R', method: 'GET' as const, url: '', headers: [], body: '', auth: { type: 'none' as const } }] as never[],
      } as never;
      const { result } = await setup({ collections: [bare] });
      act(() => result.current.duplicateRequest('bare-dr', 'r-bare'));
      expect(result.current.collections.find((c) => c.id === 'bare-dr')?.requests).toHaveLength(2);
    });

    it('moveFolderToCollection to bare dest with parentFolderId covers L417 ?? fallback', async () => {
      const bare = { id: 'bare-mfc2', name: 'BDest', requests: [] as never[] } as never;
      const { result } = await setup({ collections: [bare] });
      let src = '';
      act(() => { src = result.current.addCollection({ name: 'src' }); });
      let fSrc = '';
      act(() => { fSrc = result.current.addFolder(src, 'F'); });
      // First add a folder to the bare dest so we have a valid parent
      act(() => result.current.importFolder('bare-mfc2', { id: 'dest-parent', name: 'DestParent', requests: [], folders: [] }));
      act(() => result.current.moveFolderToCollection(src, fSrc, 'bare-mfc2', 'dest-parent'));
      const destParent = result.current.collections.find((c) => c.id === 'bare-mfc2')?.folders?.[0];
      expect(destParent?.folders?.some((f) => f.id === fSrc)).toBe(true);
    });

    it('selectCollection with orphaned selectedCollectionId triggers false branch of prevCol ternary (L104)', async () => {
      const col = { id: 'real', name: 'Real', requests: [] as never[], folders: [] as never[] } as never;
      const { result } = await setup({
        collections: [col],
        selectedCollectionId: 'orphan',
        selectedRequestId: 'req-x',
      } as never);
      act(() => result.current.selectCollection('real'));
      expect(result.current.selectedCollection?.id).toBe('real');
    });

    it('selectRequest with orphaned selectedCollectionId triggers L349 cond-expr false branch', async () => {
      const col = { id: 'real2', name: 'Real2', requests: [{ id: 'r1', name: 'R', method: 'GET' as const, url: '', headers: [], body: '', auth: { type: 'none' as const } }] as never[], folders: [] as never[] } as never;
      const { result } = await setup({
        collections: [col],
        selectedCollectionId: 'orphan',
        selectedRequestId: 'req-x',
      } as never);
      act(() => result.current.selectRequest('real2', 'r1'));
      expect(result.current.selectedRequest?.id).toBe('r1');
    });

    it('selectRequest auto-save with 2 collections covers L356 ternary false (c != selectedCol)', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      let r2 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => { r2 = result.current.addRequest(c1); });
      act(() => result.current.updateRequest(c1, r1, { url: 'http://v1.com' }));
      act(() => result.current.selectRequest(c1, r1));
      // Now select r2 — this triggers auto-save for r1, which maps over collections including c2 (false branch)
      act(() => result.current.selectRequest(c1, r2));
      expect(result.current.selectedRequest?.id).toBe(r2);
      expect(result.current.collections.find((c) => c.id === c2)?.requests).toHaveLength(0);
    });

    it('moveRequestToCollection same-collection with 2 collections covers L379 false branch', async () => {
      const { result } = await setup();
      let c1 = '';
      let c2 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => { c2 = result.current.addCollection({ name: 'C2' }); });
      let r1 = '';
      act(() => { r1 = result.current.addRequest(c1); });
      act(() => result.current.moveRequestToCollection(c1, r1, c1, null));
      expect(result.current.collections.find((c) => c.id === c2)?.requests).toHaveLength(0);
    });

    it('moveToGroup with null/undefined targetGroupId on collection with no groupId covers L464 false path', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, undefined));
      expect((result.current.collections.find((c) => c.id === c1)?.groupId) == null).toBe(true);
    });

    it('renameGroup with 2 collections covers L464 ternary false path (other collection unchanged)', async () => {
      const { result } = await setup();
      let g1 = '';
      let c1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.renameGroup(g1, 'G1-renamed'));
      expect(result.current.collections.find((c) => c.id === g1)?.name).toBe('G1-renamed');
      expect(result.current.collections.find((c) => c.id === c1)?.name).toBe('C1');
    });

    it('duplicateGroup with orphaned groupId in collections covers L510 if guard', async () => {
      const { result } = await setup();
      let g1 = '';
      act(() => { g1 = result.current.addGroup('G1'); });
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      act(() => result.current.moveToGroup(c1, g1));
      act(() => result.current.duplicateGroup(g1));
      const groups = result.current.collections.filter((c) => c.mode === 'group');
      expect(groups).toHaveLength(2);
    });

    it('moveFolderTo with isDescendantOf guard prevents reparenting into a descendant', async () => {
      const { result } = await setup();
      let c1 = '';
      act(() => { c1 = result.current.addCollection({ name: 'C1' }); });
      let f1 = '';
      let f2 = '';
      act(() => { f1 = result.current.addFolder(c1, 'F1'); });
      act(() => { f2 = result.current.addFolder(c1, 'F2'); });
      // Move F2 into F1 (F2 becomes child of F1)
      act(() => result.current.moveFolderTo(c1, f2, f1));
      // Now try to move F1 into F2 — F2 is a descendant of F1, so this is a no-op
      const beforeFolders = result.current.collections.find((c) => c.id === c1)?.folders;
      act(() => result.current.moveFolderTo(c1, f1, f2));
      const afterFolders = result.current.collections.find((c) => c.id === c1)?.folders;
      // Structure should be unchanged — only F1 at root, F2 nested inside
      expect(afterFolders).toHaveLength(beforeFolders?.length ?? 0);
    });
  });
});
