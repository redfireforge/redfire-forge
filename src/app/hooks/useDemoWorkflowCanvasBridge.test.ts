/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useDemoWorkflowCanvasBridge,
  patchDemoWorkflowNodeDataByType,
  patchDemoWorkflowNodeDataById,
} from './useDemoWorkflowCanvasBridge';

describe('useDemoWorkflowCanvasBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType;
    delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataById;
  });

  it('patches the first node matching type via handleUpdateNode', () => {
    const handleUpdateNode = vi.fn();
    const nodes = [
      { id: 'q1', type: 'graphqlQuery', position: { x: 0, y: 0 }, data: { label: 'Q' } },
    ] as never[];

    renderHook(() => useDemoWorkflowCanvasBridge(nodes, handleUpdateNode));

    const ok = patchDemoWorkflowNodeDataByType('graphqlQuery', { endpoint: 'http://localhost:4010/graphql' });
    expect(ok).toBe(true);
    expect(handleUpdateNode).toHaveBeenCalledWith('q1', { endpoint: 'http://localhost:4010/graphql' });
  });

  it('returns false when no node matches type', () => {
    renderHook(() => useDemoWorkflowCanvasBridge([], vi.fn()));
    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', { endpoint: 'x' })).toBe(false);
  });

  it('patchDemoWorkflowNodeDataByType is false when bridge absent', () => {
    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', {})).toBe(false);
  });

  it('patches a node by id via handleUpdateNode', () => {
    const handleUpdateNode = vi.fn();
    const nodes = [
      { id: 'm1', type: 'graphqlMutation', position: { x: 0, y: 0 }, data: { label: 'Create' } },
      { id: 'm2', type: 'graphqlMutation', position: { x: 0, y: 0 }, data: { label: 'M' } },
    ] as never[];

    renderHook(() => useDemoWorkflowCanvasBridge(nodes, handleUpdateNode));

    const ok = patchDemoWorkflowNodeDataById('m2', { label: 'Delete User' });
    expect(ok).toBe(true);
    expect(handleUpdateNode).toHaveBeenCalledWith('m2', { label: 'Delete User' });
  });

  it('patchDemoWorkflowNodeDataById is false when bridge absent', () => {
    expect(patchDemoWorkflowNodeDataById('m1', {})).toBe(false);
  });

  it('cleans up window bridge on unmount', () => {
    const { unmount } = renderHook(() => useDemoWorkflowCanvasBridge([], vi.fn()));
    expect((window as unknown as Record<string, unknown>).__wfPatchNodeDataByType).toBeDefined();
    expect((window as unknown as Record<string, unknown>).__wfPatchNodeDataById).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfPatchNodeDataByType).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__wfPatchNodeDataById).toBeUndefined();
  });
});
