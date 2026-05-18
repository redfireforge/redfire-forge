/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import type { Workflow, WorkflowFolder } from '../types/workflow';
import { useWorkflowMultiSelect } from './useWorkflowMultiSelect';

function makeWorkflow(overrides: Partial<Workflow> & { id: string }): Workflow {
  const now = Date.now();
  return {
    name: overrides.id,
    variables: {},
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<WorkflowFolder> & { id: string }): WorkflowFolder {
  return {
    name: overrides.id,
    order: overrides.order ?? 0,
    ...overrides,
  };
}

function workflowClick(mouse: Partial<React.MouseEvent> & Pick<React.MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): React.MouseEvent {
  return {
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...mouse,
  } as unknown as React.MouseEvent;
}

describe('useWorkflowMultiSelect', () => {
  const defaultFolders: WorkflowFolder[] = [
    makeFolder({ id: 'f1', order: 0 }),
    makeFolder({ id: 'f2', parentId: 'f1', order: 0 }),
  ];
  /** Tree order from buildFolderTree: f1 workflows, then recurse children → f2 workflows, then unfiled */
  const defaultWorkflows: Workflow[] = [
    makeWorkflow({ id: 'w-root', folderId: 'f1', folderOrder: 0 }),
    makeWorkflow({ id: 'w-nested', folderId: 'f2', folderOrder: 0 }),
    makeWorkflow({ id: 'w-unfiled', folderOrder: 0 }),
  ];

  function render(opts?: Partial<Parameters<typeof useWorkflowMultiSelect>[0]>) {
    const onSelect = vi.fn();
    const workflows = opts?.workflows ?? defaultWorkflows;
    const folders = opts?.folders ?? defaultFolders;
    const wrapper = renderHook(() =>
      useWorkflowMultiSelect({
        workflows,
        selectedId: opts?.selectedId ?? null,
        folders,
        foldersLoaded: opts?.foldersLoaded ?? true,
        onSelect,
        ...opts,
        onSelect: opts?.onSelect ?? onSelect,
      }),
    );
    return { ...wrapper, onSelect };
  }

  it('initial state has empty multiSelected', () => {
    const { result } = render();
    expect(result.current.multiSelected.size).toBe(0);
  });

  it('Ctrl/Meta click toggles workflow in multiSelected and anchors lastClickedId for shift-range', () => {
    const { result, onSelect } = render({ selectedId: 'w-root' });

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-nested');
    });

    expect(result.current.multiSelected.has('w-nested')).toBe(true);
    expect(result.current.multiSelected.has('w-root')).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-nested');
    });

    expect(result.current.multiSelected.has('w-nested')).toBe(false);
  });

  it('Shift+click selects range between lastClickedId and clicked id using flatWorkflowOrder', () => {
    const { result, onSelect } = render();

    act(() => {
      result.current.handleWorkflowClick(workflowClick({}), 'w-root');
    });
    expect(result.current.multiSelected.size).toBe(0);

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ shiftKey: true }), 'w-unfiled');
    });

    const ids = [...result.current.multiSelected];
    expect(ids).toEqual(expect.arrayContaining(['w-root', 'w-nested', 'w-unfiled']));
    expect(ids).toHaveLength(3);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('w-root');
  });

  it('plain click clears multi-select, updates anchor, and calls onSelect', () => {
    const { result, onSelect } = render();

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-root');
    });
    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-nested');
    });

    expect(result.current.multiSelected.size).toBe(2);

    act(() => {
      result.current.handleWorkflowClick(workflowClick({}), 'w-unfiled');
    });

    expect(result.current.multiSelected.size).toBe(0);
    expect(onSelect).toHaveBeenCalledWith('w-unfiled');
  });

  it('effectiveSelection is multiSelected when non-empty', () => {
    const { result } = render({ selectedId: 'w-root' });

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ metaKey: true }), 'w-nested');
    });

    const eff = result.current.effectiveSelection;
    expect(eff.has('w-nested')).toBe(true);
    expect(eff.has('w-root')).toBe(true);
    /** When multi-selection is active the hook exposes the live Set reference */
    expect(eff).toBe(result.current.multiSelected);
  });

  it('effectiveSelection falls back to single selectedId when multiSelected empty', () => {
    const { result } = render({ selectedId: 'w-nested' });
    expect([...result.current.effectiveSelection]).toEqual(['w-nested']);

    expect(result.current.effectiveSelection).not.toBe(result.current.multiSelected);
  });

  it('effectiveSelection is empty when neither multi-select nor selectedId', () => {
    const { result } = render();
    expect(result.current.effectiveSelection.size).toBe(0);
  });

  it('isMultiDrag is true only when multiSelected.size > 1', () => {
    const { result } = render();

    expect(result.current.isMultiDrag).toBe(false);

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-root');
    });
    expect(result.current.multiSelected.size).toBe(1);
    expect(result.current.isMultiDrag).toBe(false);

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ ctrlKey: true }), 'w-nested');
    });
    expect(result.current.multiSelected.size).toBe(2);
    expect(result.current.isMultiDrag).toBe(true);
  });

  it('when folders empty, flatWorkflowOrder matches workflow array order', () => {
    const workflows = [
      makeWorkflow({ id: 'aa' }),
      makeWorkflow({ id: 'bb' }),
    ];
    const { result, onSelect } = render({
      workflows,
      folders: [],
      foldersLoaded: true,
    });

    act(() => {
      result.current.handleWorkflowClick(workflowClick({}), 'aa');
    });
    act(() => {
      result.current.handleWorkflowClick(workflowClick({ shiftKey: true }), 'bb');
    });

    expect([...result.current.multiSelected]).toEqual(['aa', 'bb']);
    expect(onSelect).toHaveBeenCalledWith('aa');
  });

  it('when shift-range anchor id drops out of flat order, shift click does nothing to multi-selection', () => {
    const onSelect = vi.fn();
    const { result, rerender } = renderHook(
      ({ workflows }: { workflows: Workflow[] }) =>
        useWorkflowMultiSelect({
          workflows,
          selectedId: null,
          folders: [],
          foldersLoaded: false,
          onSelect,
        }),
      {
        initialProps: {
          workflows: [
            makeWorkflow({ id: 'gone', folderOrder: 0 }),
            makeWorkflow({ id: 'stay', folderOrder: 1 }),
          ],
        },
      },
    );

    act(() => {
      result.current.handleWorkflowClick(workflowClick({}), 'gone');
    });

    rerender({
      workflows: [makeWorkflow({ id: 'stay', folderOrder: 0 })],
    });

    act(() => {
      result.current.handleWorkflowClick(workflowClick({ shiftKey: true }), 'stay');
    });

    expect(result.current.multiSelected.size).toBe(0);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
