/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkflowPreviewReactFlowInit } from './useWorkflowPreviewReactFlowInit';
import type { Workflow } from '../types/workflow';

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    nodes: [],
    edges: [],
    variables: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeMockInstance() {
  return {
    getNodes: vi.fn().mockReturnValue([]),
    getEdges: vi.fn().mockReturnValue([]),
    setNodes: vi.fn(),
    fitView: vi.fn(),
    setViewport: vi.fn(),
  };
}

describe('useWorkflowPreviewReactFlowInit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stable callback reference when deps do not change', () => {
    const setLaidOutId = vi.fn();
    const workflow = makeWorkflow();
    const { result, rerender } = renderHook(() =>
      useWorkflowPreviewReactFlowInit(workflow, null, setLaidOutId),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  describe('preview workflow path', () => {
    it('calls setLaidOutId immediately when no nodes are measured', () => {
      const setLaidOutId = vi.fn();
      const preview = makeWorkflow({ id: 'preview-1', nodes: [] });
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(preview, null, setLaidOutId),
      );
      const instance = makeMockInstance();
      instance.getNodes.mockReturnValue([]);

      result.current(instance);
      vi.advanceTimersByTime(150);

      expect(setLaidOutId).toHaveBeenCalledWith('preview-1');
      expect(instance.setNodes).not.toHaveBeenCalled();
    });

    it('auto-layouts and fits view when nodes are present', () => {
      const setLaidOutId = vi.fn();
      const preview = makeWorkflow({ id: 'preview-2' });
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(preview, null, setLaidOutId),
      );
      const mockNode = { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'http' } as never;
      const instance = makeMockInstance();
      instance.getNodes.mockReturnValue([mockNode]);

      result.current(instance);
      vi.advanceTimersByTime(150);

      expect(instance.setNodes).toHaveBeenCalled();
      expect(setLaidOutId).toHaveBeenCalledWith('preview-2');
    });

    it('does not run before 150ms timeout', () => {
      const setLaidOutId = vi.fn();
      const preview = makeWorkflow({ id: 'preview-3' });
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(preview, null, setLaidOutId),
      );
      const instance = makeMockInstance();

      result.current(instance);
      vi.advanceTimersByTime(100);

      expect(setLaidOutId).not.toHaveBeenCalled();
    });
  });

  describe('saved viewport path', () => {
    it('restores exact viewport when selectedWorkflow has savedViewport', () => {
      const setLaidOutId = vi.fn();
      const saved = makeWorkflow({
        savedViewport: { x: 100, y: 200, zoom: 1.5 },
      });
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(null, saved, setLaidOutId),
      );
      const instance = makeMockInstance();

      result.current(instance);
      vi.advanceTimersByTime(150);
      // requestAnimationFrame inside setTimeout — flush it
      vi.runAllTimers();

      expect(instance.setViewport).toHaveBeenCalledWith(
        { x: 100, y: 200, zoom: 1.5 },
        { duration: 0 },
      );
      expect(setLaidOutId).not.toHaveBeenCalled();
    });
  });

  describe('first-load path (no preview, no saved viewport)', () => {
    it('auto-layouts and fits view on first load when nodes are present', () => {
      const setLaidOutId = vi.fn();
      const workflow = makeWorkflow({ savedViewport: undefined });
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(null, workflow, setLaidOutId),
      );
      const mockNode = { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'http' } as never;
      const instance = makeMockInstance();
      instance.getNodes.mockReturnValue([mockNode]);

      result.current(instance);
      vi.advanceTimersByTime(150);

      expect(instance.setNodes).toHaveBeenCalled();
      expect(setLaidOutId).not.toHaveBeenCalled();
    });

    it('does not call setNodes when no nodes present on first load', () => {
      const setLaidOutId = vi.fn();
      const { result } = renderHook(() =>
        useWorkflowPreviewReactFlowInit(null, null, setLaidOutId),
      );
      const instance = makeMockInstance();
      instance.getNodes.mockReturnValue([]);

      result.current(instance);
      vi.advanceTimersByTime(150);

      expect(instance.setNodes).not.toHaveBeenCalled();
      expect(setLaidOutId).not.toHaveBeenCalled();
    });
  });
});
