/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RequestCollection } from '../../shared/types';
import { useWorkbenchActions } from './useWorkbenchActions';
import type { useRequests } from '../../features/requests/hooks/useRequests';

type Wb = ReturnType<typeof useRequests>;

function makeWb(collections: RequestCollection[] = []): Wb {
  return {
    collections,
    updateCollection: vi.fn(),
    addCollection: vi.fn(),
    addRequest: vi.fn(),
  } as unknown as Wb;
}

function setup(collections: RequestCollection[] = [], activeTab: 'requests' | 'environments' = 'requests') {
  const wb = makeWb(collections);
  const setActiveTab = vi.fn();
  const hook = renderHook(() => useWorkbenchActions({ wb, activeTab, setActiveTab }));
  return { hook, wb, setActiveTab };
}

describe('useWorkbenchActions', () => {
  it('opens the modal for a new collection with mode and group', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleWbNewCollection('multi-env', 'grp-1'));
    expect(hook.result.current.showWbCollectionModal).toBe(true);
    expect(hook.result.current.editingWbCollection).toBeNull();
    expect(hook.result.current.newColMode).toBe('multi-env');
    expect(hook.result.current.newColGroupId).toBe('grp-1');
  });

  it('opens the modal for editing an existing collection', () => {
    const { hook } = setup();
    const col = { id: 'c1', name: 'C', requests: [] } as unknown as RequestCollection;
    act(() => hook.result.current.handleWbEditCollection(col));
    expect(hook.result.current.showWbCollectionModal).toBe(true);
    expect(hook.result.current.editingWbCollection).toBe(col);
  });

  it('updates an existing collection on save', () => {
    const { hook, wb } = setup();
    act(() => hook.result.current.handleWbSaveCollection({ id: 'c1', name: 'New', mode: 'direct' }));
    expect(wb.updateCollection).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'New', mode: 'direct' }));
    expect(hook.result.current.showWbCollectionModal).toBe(false);
  });

  it('adds a new collection on save when no id', () => {
    const { hook, wb } = setup();
    act(() => hook.result.current.handleWbNewCollection('direct', 'grp-9'));
    act(() => hook.result.current.handleWbSaveCollection({ name: 'Fresh', mode: 'direct' }));
    expect(wb.addCollection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fresh', groupId: 'grp-9' }));
  });

  it('adds a request and switches to the requests tab when needed', () => {
    const { hook, wb, setActiveTab } = setup([], 'environments');
    act(() => hook.result.current.handleWbNewRequest('c1', 'f1'));
    expect(wb.addRequest).toHaveBeenCalledWith('c1', 'f1');
    expect(setActiveTab).toHaveBeenCalledWith('requests');
  });

  it('does not switch tab when already on requests', () => {
    const { hook, setActiveTab } = setup([], 'requests');
    act(() => hook.result.current.handleWbNewRequest('c1'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('resolves subColForEdit when collection and folder exist', () => {
    const col = {
      id: 'c1', name: 'C', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [] }],
    } as unknown as RequestCollection;
    const { hook } = setup([col]);
    act(() => hook.result.current.handleEditSubCollection('c1', 'f1'));
    expect(hook.result.current.subColForEdit).toEqual({ col, folder: col.folders![0] });
  });

  it('returns null subColForEdit when nothing is being edited', () => {
    const { hook } = setup();
    expect(hook.result.current.subColForEdit).toBeNull();
  });

  it('returns null subColForEdit when the folder is missing', () => {
    const col = { id: 'c1', name: 'C', requests: [], folders: [] } as unknown as RequestCollection;
    const { hook } = setup([col]);
    act(() => hook.result.current.handleEditSubCollection('c1', 'missing'));
    expect(hook.result.current.subColForEdit).toBeNull();
  });

  it('returns null subColForEdit when collection cannot be found in collections list', () => {
    // editingSubCol set but no matching collection → col is undefined → false branch of `col ?`
    const { hook } = setup([]); // no collections
    act(() => hook.result.current.handleEditSubCollection('nonexistent-col', 'f1'));
    expect(hook.result.current.subColForEdit).toBeNull();
  });

  it('handleWbNewCollection with no arguments uses undefined defaults', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleWbNewCollection());
    expect(hook.result.current.showWbCollectionModal).toBe(true);
    expect(hook.result.current.newColMode).toBeUndefined();
    expect(hook.result.current.newColGroupId).toBeUndefined();
  });
});
