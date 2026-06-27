/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoWorkflowLivePatchSync } from './useDemoWorkflowLivePatchSync';
import type { WorkflowRFNode } from '../../features/workflow/utils/workflowNodeFactory';

describe('useDemoWorkflowLivePatchSync', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch;
  });

  it('syncs workflow variables and start inputVariables when selected workflow matches', () => {
    const setWorkflowVariables = vi.fn();
    const workflowVariablesRef = { current: {} as Record<string, string> };
    const handleUpdateNode = vi.fn();
    const nodes: WorkflowRFNode[] = [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
    ];

    renderHook(() =>
      useDemoWorkflowLivePatchSync(
        'GraphQL User CRUD Demo',
        nodes,
        setWorkflowVariables,
        workflowVariablesRef,
        handleUpdateNode,
      ),
    );

    const sync = (window as unknown as Record<string, (name: string, patch: object) => boolean>)
      .__wfSyncLiveWorkflowFromPatch;

    const ok = sync('GraphQL User CRUD Demo', {
      variables: { testName: 'Demo User', createdUserId: '' },
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { label: 'Start', inputVariables: { testName: 'Demo User' } },
        },
      ],
    });

    expect(ok).toBe(true);
    expect(workflowVariablesRef.current).toEqual({ testName: 'Demo User', createdUserId: '' });
    expect(setWorkflowVariables).toHaveBeenCalledWith({ testName: 'Demo User', createdUserId: '' });
    expect(handleUpdateNode).toHaveBeenCalledWith('start-1', {
      inputVariables: { testName: 'Demo User' },
    });
  });

  it('returns false when patched workflow is not the selected one', () => {
    const setWorkflowVariables = vi.fn();
    const workflowVariablesRef = { current: {} as Record<string, string> };
    const handleUpdateNode = vi.fn();

    renderHook(() =>
      useDemoWorkflowLivePatchSync(
        'Other Workflow',
        [],
        setWorkflowVariables,
        workflowVariablesRef,
        handleUpdateNode,
      ),
    );

    const sync = (window as unknown as Record<string, (name: string, patch: object) => boolean>)
      .__wfSyncLiveWorkflowFromPatch;

    expect(sync('GraphQL User CRUD Demo', { variables: { testName: 'Demo User' } })).toBe(false);
    expect(setWorkflowVariables).not.toHaveBeenCalled();
    expect(handleUpdateNode).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useDemoWorkflowLivePatchSync(
        'WF',
        [],
        vi.fn(),
        { current: {} },
        vi.fn(),
      ),
    );
    expect((window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch).toBeUndefined();
  });
});
