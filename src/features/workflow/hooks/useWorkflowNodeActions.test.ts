/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowNodeActions } from './useWorkflowNodeActions';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));
vi.mock('../utils/workflowNodeFactory', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return { ...actual, defaultNodeData: (type: string) => ({ label: `New ${type}` }) };
});
vi.mock('../utils/workflowNodeMerge', () => ({
  mergeWorkflowNodeData: (existing: any, patch: any) => ({ ...existing, ...patch }),
}));
vi.mock('../utils/workflowRequestHost', () => ({
  resolveQuickTestHostForRequest: vi.fn(() => ({})),
}));
vi.mock('../utils/workflowExtractSubWorkflow', () => ({
  extractToSubWorkflow: vi.fn(() => null),
}));

const makeRef = <T,>(value: T) => ({ current: value });

const defaultOpts = () => ({
  selected: { id: 'wf-1', name: 'Test' } as any,
  collections: [] as any[],
  catalogEntries: [] as any[],
  environments: [] as any[],
  microservices: [] as any[],
  selectedEnvId: 'env-1',
  resolvedBaseUrl: 'http://localhost',
  selectedNodeId: null as string | null,
  setSelectedNodeId: vi.fn(),
  setNodes: vi.fn((fn: any) => fn([])),
  setEdges: vi.fn((fn: any) => fn([])),
  setNodeInitialVars: vi.fn(),
  nodeInitialVarsRef: makeRef({}),
  nodesRef: makeRef([] as WorkflowRFNode[]),
  edgesRef: makeRef([] as WorkflowRFEdge[]),
  serializeNodes: vi.fn((nodes: any) => nodes),
  serializeEdges: vi.fn((edges: any) => edges),
  update: vi.fn(),
  persistWorkflow: vi.fn(),
  undoRedo: { takeSnapshot: vi.fn() },
  workflows: [] as any[],
  create: vi.fn(),
  toast: { show: vi.fn() } as any,
  nextNodeY: makeRef(100),
});

describe('useWorkflowNodeActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleAddNode adds a node to canvas', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddNode('http'));
    expect(opts.undoRedo.takeSnapshot).toHaveBeenCalledWith('Add node');
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('advances nextNodeY after adding a node', () => {
    const opts = defaultOpts();
    opts.nextNodeY.current = 100;
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddNode('http'));
    expect(opts.nextNodeY.current).toBe(220);
  });

  it('does nothing when selected is null', () => {
    const opts = defaultOpts();
    opts.selected = null;
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddNode('http'));
    expect(opts.setNodes).not.toHaveBeenCalled();
  });

  it('handleDeleteNode removes node and related edges', () => {
    const opts = defaultOpts();
    const node = { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: {} } as any;
    opts.setNodes = vi.fn((fn: any) => fn([node]));
    opts.setEdges = vi.fn((fn: any) => fn([{ id: 'e1', source: 'n1', target: 'n2' }]));
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleDeleteNode('n1'));
    expect(opts.undoRedo.takeSnapshot).toHaveBeenCalledWith('Delete node');
    expect(opts.setNodes).toHaveBeenCalled();
    expect(opts.setEdges).toHaveBeenCalled();
    expect(opts.setNodeInitialVars).toHaveBeenCalled();
  });

  it('handleDeleteNode clears selectedNodeId when deleting selected', () => {
    const opts = defaultOpts();
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleDeleteNode('n1'));
    expect(opts.setSelectedNodeId).toHaveBeenCalledWith(null);
  });

  it('handleDeleteNode does not clear selectedNodeId for other nodes', () => {
    const opts = defaultOpts();
    opts.selectedNodeId = 'n2';
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleDeleteNode('n1'));
    expect(opts.setSelectedNodeId).not.toHaveBeenCalled();
  });

  it('handleUpdateNode with initialVariables updates nodeInitialVarsRef', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleUpdateNode('n1', { initialVariables: { token: 'xyz' } } as any));
    expect(opts.nodeInitialVarsRef.current.n1).toEqual({ token: 'xyz' });
    expect(opts.setNodeInitialVars).toHaveBeenCalled();
    expect(opts.persistWorkflow).toHaveBeenCalled();
  });

  it('handleUpdateNode with non-IV patch updates via setNodes', () => {
    const opts = defaultOpts();
    opts.setNodes = vi.fn((fn: any) => {
      const result = fn([{ id: 'n1', type: 'http', data: { label: 'Old' }, position: { x: 0, y: 0 } }]);
      opts.nodesRef.current = result;
      return result;
    });
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleUpdateNode('n1', { label: 'New' } as any));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleAddFromRequest finds request in collection', () => {
    const opts = defaultOpts();
    opts.collections = [{
      id: 'col-1',
      requests: [{ id: 'req-1', name: 'Get Users', url: '/users', method: 'GET' }],
      folders: [],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromRequest('col-1', 'req-1'));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleAddFromRequest does nothing for missing collection', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromRequest('missing', 'req-1'));
    expect(opts.setNodes).not.toHaveBeenCalled();
  });

  it('handleAddFromRequest searches folders recursively', () => {
    const opts = defaultOpts();
    opts.collections = [{
      id: 'col-1',
      requests: [],
      folders: [{
        id: 'f1', name: 'Folder', requests: [
          { id: 'req-deep', name: 'Deep', url: '/deep', method: 'POST' },
        ], folders: [],
      }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromRequest('col-1', 'req-deep'));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleAddFromCatalog adds endpoint from catalog', () => {
    const opts = defaultOpts();
    opts.catalogEntries = [{
      id: 'cat-1',
      servers: [{ url: 'https://api.example.com' }],
      endpoints: [{ id: 'ep-1', path: '/pets', method: 'get', summary: 'List Pets' }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromCatalog('cat-1', 'ep-1'));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleAddFromCatalog does nothing for missing entry', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromCatalog('missing', 'ep-1'));
    expect(opts.setNodes).not.toHaveBeenCalled();
  });
});
