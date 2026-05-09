/**
 * @vitest-environment jsdom
 */
import type { RefObject, SetStateAction } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowDragDrop } from './useWorkflowDragDrop';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow, WorkflowNode } from '../types/workflow';
import { findClosestEdge } from '../utils/workflowEdgeGeometry';

let uuidSeq = 0;
vi.mock('uuid', () => ({ v4: vi.fn(() => `uuid-${++uuidSeq}`) }));

const screenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 }));
const getNodes = vi.fn(() => [] as WorkflowRFNode[]);

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    screenToFlowPosition,
    getNodes,
  }),
}));

vi.mock('../utils/workflowEdgeGeometry', () => ({
  findClosestEdge: vi.fn(),
}));

const mockFindClosest = vi.mocked(findClosestEdge);

const makeRefs = (nodes: WorkflowRFNode[], edges: WorkflowRFEdge[]) => ({
  nodesRef: { current: nodes } as RefObject<WorkflowRFNode[]>,
  edgesRef: { current: edges } as RefObject<WorkflowRFEdge[]>,
});

const wf: Workflow = {
  id: 'wf-1',
  name: 'W',
  schemaVersion: 6,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
};

const defaultOpts = () => {
  const addNodeToCanvas = vi.fn();
  const insertNodeAndPersist = vi.fn();
  const setNodes = vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => {
    if (typeof fn === 'function') return fn([]);
    return fn;
  });
  const setEdges = vi.fn((fn: SetStateAction<WorkflowRFEdge[]>) => {
    if (typeof fn === 'function') return fn([]);
    return fn;
  });
  const serializeNodes = vi.fn((n: WorkflowRFNode[]) => n as unknown as WorkflowNode[]);
  const serializeEdges = vi.fn((e: WorkflowRFEdge[]) => e);
  const update = vi.fn();
  const undoRedo = { takeSnapshot: vi.fn() };

  return {
    ...makeRefs([], []),
    selected: { id: wf.id } as { id: string },
    addNodeToCanvas,
    insertNodeAndPersist,
    setNodes,
    setEdges,
    serializeNodes,
    serializeEdges,
    update,
    undoRedo,
  };
};

describe('useWorkflowDragDrop', () => {
  beforeEach(() => {
    uuidSeq = 0;
    vi.clearAllMocks();
    mockFindClosest.mockReturnValue(null);
    getNodes.mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes drag state and exposes ref', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    expect(result.current.isDragOver).toBe(false);
    expect(result.current.dropTargetEdgeId).toBe(null);
    expect(result.current.canvasAreaRef).toBeTruthy();
  });

  it('handleCanvasDragOver ignores non-reactflow drags', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const e = {
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 20,
      dataTransfer: { types: ['text/plain'], dropEffect: 'none' },
    } as unknown as globalThis.DragEvent;
    act(() => result.current.handleCanvasDragOver(e));
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(result.current.isDragOver).toBe(false);
  });

  it('handleCanvasDragOver sets drag-over and highlights closest edge', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    mockFindClosest.mockReturnValue({ id: 'e1', source: 'a', target: 'b' } as WorkflowRFEdge);
    const opts = defaultOpts();
    opts.nodesRef = { current: [] };
    opts.edgesRef = { current: [{ id: 'e1', source: 'a', target: 'b' }] };
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const e = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 200,
      dataTransfer: { types: ['application/reactflow-type'], dropEffect: 'none' },
    } as unknown as globalThis.DragEvent;

    act(() => {
      result.current.handleCanvasDragOver(e);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(result.current.isDragOver).toBe(true);
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 100, y: 200 });

    act(() => {
      vi.spyOn(performance, 'now').mockReturnValue(130);
      result.current.handleCanvasDragOver(e);
    });
    expect(mockFindClosest).toHaveBeenCalled();
    expect(result.current.dropTargetEdgeId).toBe('e1');
  });

  it('handleCanvasDragLeave clears state', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    act(() => {
      result.current.handleCanvasDragOver({
        preventDefault: vi.fn(),
        clientX: 0,
        clientY: 0,
        dataTransfer: { types: ['application/reactflow-type'], dropEffect: 'none' },
      } as unknown as React.DragEvent);
    });
    act(() => result.current.handleCanvasDragLeave());
    expect(result.current.isDragOver).toBe(false);
    expect(result.current.dropTargetEdgeId).toBe(null);
  });

  it('handleCanvasDrop returns early when no workflow selected', () => {
    const opts = defaultOpts();
    opts.selected = null;
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => 'http') },
    } as unknown as globalThis.DragEvent;
    act(() => result.current.handleCanvasDrop(e));
    expect(opts.insertNodeAndPersist).not.toHaveBeenCalled();
    expect(opts.addNodeToCanvas).not.toHaveBeenCalled();
  });

  it('handleCanvasDrop calls addNodeToCanvas when canvas has no .react-flow bounds', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const e = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 60,
      dataTransfer: { getData: vi.fn(() => 'delay') },
    } as unknown as globalThis.DragEvent;
    act(() => {
      result.current.canvasAreaRef.current = document.createElement('div');
      result.current.handleCanvasDrop(e);
    });
    expect(opts.addNodeToCanvas).toHaveBeenCalledWith('delay');
    expect(opts.insertNodeAndPersist).not.toHaveBeenCalled();
  });

  it('handleCanvasDrop inserts on free space via insertNodeAndPersist when bounds exist', () => {
    mockFindClosest.mockReturnValue(null);
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const root = document.createElement('div');
    const flow = document.createElement('div');
    flow.className = 'react-flow';
    flow.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} } as DOMRect);
    root.appendChild(flow);

    const e = {
      preventDefault: vi.fn(),
      clientX: 200,
      clientY: 100,
      dataTransfer: { getData: vi.fn(() => 'http') },
    } as unknown as globalThis.DragEvent;

    act(() => {
      result.current.canvasAreaRef.current = root;
      result.current.handleCanvasDrop(e);
    });

    expect(screenToFlowPosition).toHaveBeenCalled();
    expect(opts.insertNodeAndPersist).toHaveBeenCalled();
    const [newNode, label] = vi.mocked(opts.insertNodeAndPersist).mock.calls[0];
    expect(label).toBe('Add node');
    expect(newNode.type).toBe('http');
    expect(newNode.position).toEqual(screenToFlowPosition({ x: 200, y: 100 }));
  });

  it('handleCanvasDrop splits closest edge and persists', async () => {
    const edge: WorkflowRFEdge = { id: 'e-split', source: 'n1', target: 'n2', label: 'L' };
    mockFindClosest.mockReturnValue(edge);
    getNodes.mockReturnValue([{ id: 'old', type: 'http', position: { x: 0, y: 0 }, data: {} as never }]);
    const opts = defaultOpts();
    opts.edgesRef = { current: [edge] };
    opts.setEdges = vi.fn((fn: React.SetStateAction<WorkflowRFEdge[]>) => {
      if (typeof fn === 'function') return fn([edge]);
      return fn;
    });

    const { result } = renderHook(() => useWorkflowDragDrop(opts));
    const root = document.createElement('div');
    const flow = document.createElement('div');
    flow.className = 'react-flow';
    flow.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect);
    root.appendChild(flow);

    const e = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: { getData: vi.fn(() => 'if') },
    } as unknown as globalThis.DragEvent;

    await act(async () => {
      result.current.canvasAreaRef.current = root;
      result.current.handleCanvasDrop(e);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.undoRedo.takeSnapshot).toHaveBeenCalledWith('Insert node on edge');
    expect(opts.setNodes).toHaveBeenCalled();
    expect(opts.setEdges).toHaveBeenCalled();
    expect(opts.update).toHaveBeenCalled();
  });
});
