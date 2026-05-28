/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkflowDesignerInspectActions } from './useWorkflowDesignerInspectActions';
import type { Workflow } from '../types/workflow';

function makeWorkflow(id: string, nodeCount: number, edgeCount: number): Workflow {
  return {
    id,
    name: `Workflow ${id}`,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}` }) as never),
    edges: Array.from({ length: edgeCount }, (_, i) => ({ id: `e${i}` }) as never),
    variables: {},
    createdAt: '',
    updatedAt: '',
  };
}

describe('useWorkflowDesignerInspectActions', () => {
  const openStepDetail = vi.fn();
  const openVariableDetail = vi.fn();
  const openNodeConfig = vi.fn();
  const navigateToWorkflow = vi.fn();

  it('returns all provided callbacks unchanged', () => {
    const workflows: Workflow[] = [];
    const { result } = renderHook(() =>
      useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows),
    );
    expect(result.current.openStepDetail).toBe(openStepDetail);
    expect(result.current.openVariableDetail).toBe(openVariableDetail);
    expect(result.current.openNodeConfig).toBe(openNodeConfig);
    expect(result.current.navigateToWorkflow).toBe(navigateToWorkflow);
  });

  it('getWorkflowPreview returns nodeCount and edgeCount for known workflow', () => {
    const workflows = [makeWorkflow('wf-1', 5, 4)];
    const { result } = renderHook(() =>
      useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows),
    );
    expect(result.current.getWorkflowPreview('wf-1')).toEqual({ nodeCount: 5, edgeCount: 4 });
  });

  it('getWorkflowPreview returns undefined for unknown workflow id', () => {
    const workflows = [makeWorkflow('wf-1', 3, 2)];
    const { result } = renderHook(() =>
      useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows),
    );
    expect(result.current.getWorkflowPreview('unknown-id')).toBeUndefined();
  });

  it('getWorkflowPreview returns undefined when workflows list is empty', () => {
    const { result } = renderHook(() =>
      useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, []),
    );
    expect(result.current.getWorkflowPreview('any')).toBeUndefined();
  });

  it('returns a stable reference when deps do not change', () => {
    const workflows: Workflow[] = [];
    const { result, rerender } = renderHook(() =>
      useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a new reference when workflows list changes', () => {
    let workflows: Workflow[] = [];
    const { result, rerender } = renderHook(
      ({ wfs }) => useWorkflowDesignerInspectActions(openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, wfs),
      { initialProps: { wfs: workflows } },
    );
    const first = result.current;
    workflows = [makeWorkflow('new-wf', 1, 0)];
    rerender({ wfs: workflows });
    expect(result.current).not.toBe(first);
  });
});
