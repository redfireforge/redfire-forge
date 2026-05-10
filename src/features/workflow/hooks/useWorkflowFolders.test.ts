/**
 * @vitest-environment jsdom
 */
import type { WorkflowFolder } from '../types/workflow';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-folder-uuid') }));

const mockLoadFolders = vi.fn<() => Promise<WorkflowFolder[]>>().mockResolvedValue([]);
const mockSaveFolders = vi.fn<(f: WorkflowFolder[]) => Promise<void>>().mockResolvedValue(undefined);

vi.mock('../../../shared/utils/storage', () => ({
  loadWorkflowFolders: () => mockLoadFolders(),
  saveWorkflowFolders: (folders: WorkflowFolder[]) => mockSaveFolders(folders),
}));

vi.mock('../utils/workflowFolderTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/workflowFolderTree')>();
  return {
    ...actual,
  };
});

import { useWorkflowFolders } from './useWorkflowFolders';

const makeFolder = (overrides: Partial<WorkflowFolder> & { id: string }): WorkflowFolder => ({
  name: overrides.id,
  order: 0,
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useWorkflowFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadFolders.mockResolvedValue([]);
  });

  it('loads folders from storage on mount', async () => {
    const stored = [makeFolder({ id: 'f1', name: 'Perf' })];
    mockLoadFolders.mockResolvedValue(stored);

    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0].id).toBe('f1');
  });

  it('ignores loaded folders after unmount (cancels effect)', async () => {
    let resolveLoad!: (folders: WorkflowFolder[]) => void;
    mockLoadFolders.mockImplementation(
      () =>
        new Promise<WorkflowFolder[]>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useWorkflowFolders());
    expect(result.current.loaded).toBe(false);
    expect(result.current.folders).toEqual([]);

    unmount();
    await act(async () => {
      resolveLoad([makeFolder({ id: 'ghost', name: 'Never Applied' })]);
    });

    // If state leaked, another mount should still load fresh (default empty resolves next).
    mockLoadFolders.mockResolvedValue([]);
    const { result: after } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(after.current.loaded).toBe(true));
    expect(after.current.folders).toEqual([]);
  });

  it('creates a folder and persists', async () => {
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.create('New Folder');
    });

    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0].name).toBe('New Folder');
    expect(result.current.folders[0].id).toBe('mock-folder-uuid');
    expect(mockSaveFolders).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'New Folder' })]),
    );
  });

  it('creates a sub-folder with parentId', async () => {
    mockLoadFolders.mockResolvedValue([makeFolder({ id: 'parent', name: 'Parent' })]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.create('Child', 'parent');
    });

    expect(result.current.folders).toHaveLength(2);
    const child = result.current.folders.find((f) => f.name === 'Child');
    expect(child?.parentId).toBe('parent');
  });

  it('renames a folder and persists', async () => {
    mockLoadFolders.mockResolvedValue([makeFolder({ id: 'f1', name: 'Old' })]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.rename('f1', 'New Name');
    });

    expect(result.current.folders[0].name).toBe('New Name');
    expect(mockSaveFolders).toHaveBeenCalled();
  });

  it('rename only touches the matched folder among siblings', async () => {
    mockLoadFolders.mockResolvedValue([
      makeFolder({ id: 'f1', name: 'Alpha' }),
      makeFolder({ id: 'f2', name: 'Beta' }),
    ]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.rename('f1', 'Alpha Renamed');
    });

    expect(result.current.folders.find((f) => f.id === 'f1')?.name).toBe('Alpha Renamed');
    expect(result.current.folders.find((f) => f.id === 'f2')?.name).toBe('Beta');
  });

  it('removes a folder and its descendants', async () => {
    const folders = [
      makeFolder({ id: 'root', order: 0 }),
      makeFolder({ id: 'child', parentId: 'root', order: 0 }),
      makeFolder({ id: 'grandchild', parentId: 'child', order: 0 }),
      makeFolder({ id: 'other', order: 1 }),
    ];
    mockLoadFolders.mockResolvedValue(folders);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let removedIds: Set<string>;
    act(() => {
      removedIds = result.current.remove('root', result.current.folders);
    });

    expect(removedIds!.size).toBe(3);
    expect(removedIds!.has('root')).toBe(true);
    expect(removedIds!.has('child')).toBe(true);
    expect(removedIds!.has('grandchild')).toBe(true);
    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0].id).toBe('other');
    expect(mockSaveFolders).toHaveBeenCalled();
  });

  it('moves a folder to a new parent', async () => {
    const folders = [
      makeFolder({ id: 'a', order: 0 }),
      makeFolder({ id: 'b', order: 1 }),
    ];
    mockLoadFolders.mockResolvedValue(folders);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.move('b', 'a', 0);
    });

    const moved = result.current.folders.find((f) => f.id === 'b');
    expect(moved?.parentId).toBe('a');
    expect(mockSaveFolders).toHaveBeenCalled();
  });

  it('blocks moving a folder into its own descendant', async () => {
    const folders = [
      makeFolder({ id: 'parent', order: 0 }),
      makeFolder({ id: 'child', parentId: 'parent', order: 0 }),
    ];
    mockLoadFolders.mockResolvedValue(folders);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.move('parent', 'child', 0);
    });

    const parent = result.current.folders.find((f) => f.id === 'parent');
    expect(parent?.parentId).toBeUndefined();
  });

  it('toggles collapse state', async () => {
    mockLoadFolders.mockResolvedValue([makeFolder({ id: 'f1', collapsed: false })]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.toggleCollapse('f1');
    });
    expect(result.current.folders[0].collapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse('f1');
    });
    expect(result.current.folders[0].collapsed).toBe(false);
  });

  it('toggleCollapse only affects the folder with the given id', async () => {
    mockLoadFolders.mockResolvedValue([
      makeFolder({ id: 'f1', collapsed: false }),
      makeFolder({ id: 'f2', collapsed: false }),
    ]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.toggleCollapse('f1');
    });
    expect(result.current.folders.find((f) => f.id === 'f1')?.collapsed).toBe(true);
    expect(result.current.folders.find((f) => f.id === 'f2')?.collapsed).toBe(false);
  });

  it('sets collapse state explicitly', async () => {
    mockLoadFolders.mockResolvedValue([makeFolder({ id: 'f1', collapsed: false })]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.setCollapsed('f1', true);
    });
    expect(result.current.folders[0].collapsed).toBe(true);

    act(() => {
      result.current.setCollapsed('f1', false);
    });
    expect(result.current.folders[0].collapsed).toBe(false);
  });

  it('setCollapsed only affects the folder with the given id', async () => {
    mockLoadFolders.mockResolvedValue([
      makeFolder({ id: 'f1', collapsed: false }),
      makeFolder({ id: 'f2', collapsed: false }),
    ]);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.setCollapsed('f1', true);
    });
    expect(result.current.folders.find((f) => f.id === 'f1')?.collapsed).toBe(true);
    expect(result.current.folders.find((f) => f.id === 'f2')?.collapsed).toBe(false);
  });

  it('moves folder to root when newParentId is null', async () => {
    const folders = [
      makeFolder({ id: 'a', order: 0 }),
      makeFolder({ id: 'b', parentId: 'a', order: 0 }),
    ];
    mockLoadFolders.mockResolvedValue(folders);
    const { result } = renderHook(() => useWorkflowFolders());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.move('b', null, 1);
    });

    expect(result.current.folders.find((f) => f.id === 'b')?.parentId).toBeUndefined();
    expect(mockSaveFolders).toHaveBeenCalled();
  });
});
