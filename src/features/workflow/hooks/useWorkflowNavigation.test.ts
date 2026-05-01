/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowNavigation } from './useWorkflowNavigation';
import type { Workflow } from '../types/workflow';

const wf = (id: string, name = id): Workflow => ({
  id, name,
  nodes: [], edges: [],
  variables: {}, hostProfiles: [], authProfiles: [], services: [],
  createdAt: 0, updatedAt: 0,
} as unknown as Workflow);

function setup(opts?: { selected?: Workflow | null; workflows?: Workflow[] }) {
  const select = vi.fn();
  const persistWorkflow = vi.fn();
  const workflows = opts?.workflows ?? [wf('a'), wf('b'), wf('c')];
  const selected = opts && 'selected' in opts ? opts.selected ?? null : workflows[0];
  const r = renderHook(() => useWorkflowNavigation({ selected, workflows, select, persistWorkflow }));
  return { ...r, select, persistWorkflow };
}

describe('useWorkflowNavigation', () => {
  it('starts with empty stack', () => {
    const { result } = setup();
    expect(result.current.navStack).toEqual([]);
  });

  it('navigateToWorkflow pushes current to stack and selects target', () => {
    const { result, select, persistWorkflow } = setup();
    act(() => result.current.navigateToWorkflow('b'));
    expect(persistWorkflow).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('b');
    expect(result.current.navStack).toEqual([{ id: 'a', name: 'a' }]);
  });

  it('navigateToWorkflow is no-op when no selected', () => {
    const { result, select } = setup({ selected: null });
    act(() => result.current.navigateToWorkflow('b'));
    expect(select).not.toHaveBeenCalled();
    expect(result.current.navStack).toEqual([]);
  });

  it('navigateToWorkflow is no-op when target id missing', () => {
    const { result, select } = setup();
    act(() => result.current.navigateToWorkflow('zzz'));
    expect(select).not.toHaveBeenCalled();
    expect(result.current.navStack).toEqual([]);
  });

  it('handleBreadcrumbNavigate pops back to ancestor and selects it', () => {
    const { result, select } = setup();
    act(() => result.current.navigateToWorkflow('b'));
    act(() => result.current.navigateToWorkflow('c'));
    expect(result.current.navStack).toHaveLength(2);
    act(() => result.current.handleBreadcrumbNavigate(0));
    expect(select).toHaveBeenLastCalledWith('a');
    expect(result.current.navStack).toEqual([]);
  });

  it('handleBreadcrumbNavigate ignores out-of-range index', () => {
    const { result, select } = setup();
    act(() => result.current.handleBreadcrumbNavigate(5));
    expect(select).not.toHaveBeenCalled();
  });

  it('setNavStack exposes manual reset', () => {
    const { result } = setup();
    act(() => result.current.navigateToWorkflow('b'));
    act(() => result.current.setNavStack([]));
    expect(result.current.navStack).toEqual([]);
  });
});
