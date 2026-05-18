/**
 * Source module: `useWorkflowNodeActions.ts` (workflow node / object actions).
 * @vitest-environment jsdom
 */
import type { SetStateAction } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowNodeActions } from './useWorkflowNodeActions';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow, WorkflowNode, WorkflowNodeData } from '../types/workflow';
import type { RequestCollection, Environment, Microservice } from '../../../shared/types';
import type { CatalogEntry } from '../../catalog/types/catalog';
import type { ToastApi } from '../components/WorkflowToastProvider';
import type { ExtractResult } from '../utils/workflowExtractSubWorkflow';

type NodeActionsOpts = Parameters<typeof useWorkflowNodeActions>[0];

const minimalWorkflow = (): Workflow => ({
  id: 'wf-1',
  name: 'Test',
  schemaVersion: 5,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
});

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));
vi.mock('../utils/workflowNodeFactory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/workflowNodeFactory')>();
  return {
    ...actual,
    defaultNodeData: (type: Parameters<typeof actual.defaultNodeData>[0]) =>
      ({ ...actual.defaultNodeData(type), label: `New ${type}` }),
  };
});
vi.mock('../utils/workflowNodeMerge', () => ({
  mergeWorkflowNodeData: (existing: WorkflowNodeData, patch: Partial<WorkflowNodeData>) =>
    ({ ...existing, ...patch } as WorkflowNodeData),
}));
vi.mock('../utils/workflowRequestHost', () => ({
  resolveQuickTestHostForRequest: vi.fn(() => ({})),
}));
vi.mock('../utils/workflowExtractSubWorkflow', () => ({
  extractToSubWorkflow: vi.fn(() => null),
}));

import { extractToSubWorkflow } from '../utils/workflowExtractSubWorkflow';
const mockExtract = vi.mocked(extractToSubWorkflow);

const makeRef = <T,>(value: T) => ({ current: value });

const defaultOpts = (): NodeActionsOpts => ({
  selected: minimalWorkflow(),
  collections: [] as RequestCollection[],
  catalogEntries: [] as CatalogEntry[],
  environments: [] as Environment[],
  microservices: [] as Microservice[],
  selectedEnvId: 'env-1',
  resolvedBaseUrl: 'http://localhost',
  selectedNodeId: null as string | null,
  setSelectedNodeId: vi.fn(),
  setNodes: vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => (typeof fn === 'function' ? fn([]) : fn)),
  setEdges: vi.fn((fn: SetStateAction<WorkflowRFEdge[]>) => (typeof fn === 'function' ? fn([]) : fn)),
  setNodeInitialVars: vi.fn(),
  nodeInitialVarsRef: makeRef({}),
  nodesRef: makeRef([] as WorkflowRFNode[]),
  edgesRef: makeRef([] as WorkflowRFEdge[]),
  serializeNodes: vi.fn((nodes: WorkflowRFNode[]) => nodes as unknown as WorkflowNode[]),
  serializeEdges: vi.fn((edges: WorkflowRFEdge[]) => edges),
  update: vi.fn(),
  persistWorkflow: vi.fn(),
  undoRedo: { takeSnapshot: vi.fn() },
  workflows: [] as Workflow[],
  create: vi.fn(),
  toast: { show: vi.fn(), dismiss: vi.fn() } as ToastApi,
  nextNodeYRef: makeRef(100),
});

describe('useWorkflowObjectActions (useWorkflowNodeActions)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleAddNode adds a node to canvas', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddNode('http'));
    expect(opts.undoRedo.takeSnapshot).toHaveBeenCalledWith('Add node');
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('advances nextNodeYRef after adding a node', () => {
    const opts = defaultOpts();
    opts.nextNodeYRef.current = 100;
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddNode('http'));
    expect(opts.nextNodeYRef.current).toBe(220);
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
    const node: WorkflowRFNode = { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'n1' } as WorkflowNodeData };
    opts.setNodes = vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => (typeof fn === 'function' ? fn([node]) : fn));
    opts.setEdges = vi.fn((fn: SetStateAction<WorkflowRFEdge[]>) => (typeof fn === 'function' ? fn([{ id: 'e1', source: 'n1', target: 'n2' }]) : fn));
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
    act(() => result.current.handleUpdateNode('n1', { initialVariables: { token: 'xyz' } }));
    expect(opts.nodeInitialVarsRef.current.n1).toEqual({ token: 'xyz' });
    expect(opts.setNodeInitialVars).toHaveBeenCalled();
    expect(opts.persistWorkflow).toHaveBeenCalled();
  });

  it('handleUpdateNode with non-IV patch updates via setNodes', () => {
    const opts = defaultOpts();
    opts.setNodes = vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => {
      const resultNodes = fn([{ id: 'n1', type: 'http', data: { label: 'Old' }, position: { x: 0, y: 0 } }]);
      opts.nodesRef.current = resultNodes;
      return resultNodes;
    });
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleUpdateNode('n1', { label: 'New' }));
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

  it('handleAddFromCatalog does nothing for missing endpoint', () => {
    const opts = defaultOpts();
    opts.catalogEntries = [{
      id: 'cat-1',
      servers: [{ url: 'https://api.example.com' }],
      endpoints: [{ id: 'ep-1', path: '/pets', method: 'get', summary: 'List Pets' }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromCatalog('cat-1', 'ep-99'));
    expect(opts.setNodes).not.toHaveBeenCalled();
  });

  it('handleAddFromCatalog uses relative URL when server list is empty', () => {
    const opts = defaultOpts();
    opts.catalogEntries = [{
      id: 'cat-1',
      servers: [],
      endpoints: [{ id: 'ep-1', path: '/z', method: 'get', summary: '' }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromCatalog('cat-1', 'ep-1'));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleAddFromRequest does nothing when request not found anywhere', () => {
    const opts = defaultOpts();
    opts.collections = [{
      id: 'col-1',
      requests: [{ id: 'req-1', name: 'R1', url: '/', method: 'GET' }],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromRequest('col-1', 'req-missing'));
    expect(opts.setNodes).not.toHaveBeenCalled();
  });

  it('handleAddFromRequest searches nested folders', () => {
    const opts = defaultOpts();
    opts.collections = [{
      id: 'col-1',
      requests: [],
      folders: [{
        id: 'f1', name: 'Top', requests: [],
        folders: [{
          id: 'f2', name: 'Sub', requests: [
            { id: 'req-nested', name: 'Nested', url: '/nested', method: 'PUT' },
          ], folders: [],
        }],
      }],
    }];
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleAddFromRequest('col-1', 'req-nested'));
    expect(opts.setNodes).toHaveBeenCalled();
  });

  it('handleUpdateNode with initialVariables AND other patch fields', () => {
    const opts = defaultOpts();
    opts.setNodes = vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => {
      const resultNodes = fn([{ id: 'n1', type: 'http', data: { label: 'Old' }, position: { x: 0, y: 0 } }]);
      opts.nodesRef.current = resultNodes;
      return resultNodes;
    });
    const { result } = renderHook(() => useWorkflowNodeActions(opts));
    act(() => result.current.handleUpdateNode('n1', { initialVariables: { token: 'x' }, label: 'Updated' }));
    expect(opts.nodeInitialVarsRef.current.n1).toEqual({ token: 'x' });
    expect(opts.setNodeInitialVars).toHaveBeenCalled();
    expect(opts.setNodes).toHaveBeenCalled();
  });

  describe('handleExtractToSubWorkflow', () => {
    it('does nothing when selected is null', () => {
      const opts = defaultOpts();
      opts.selected = null;
      const { result } = renderHook(() => useWorkflowNodeActions(opts));
      act(() => result.current.handleExtractToSubWorkflow('n1'));
      expect(mockExtract).not.toHaveBeenCalled();
    });

    it('does nothing when prompt returns empty', () => {
      const opts = defaultOpts();
      vi.stubGlobal('prompt', vi.fn(() => ''));
      const { result } = renderHook(() => useWorkflowNodeActions(opts));
      act(() => result.current.handleExtractToSubWorkflow('n1'));
      expect(mockExtract).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('shows toast warning when extraction returns null', () => {
      const opts = defaultOpts();
      vi.stubGlobal('prompt', vi.fn(() => 'Sub WF'));
      mockExtract.mockReturnValue(null);
      const { result } = renderHook(() => useWorkflowNodeActions(opts));
      act(() => result.current.handleExtractToSubWorkflow('n1'));
      expect(mockExtract).toHaveBeenCalled();
      expect(opts.toast.show).toHaveBeenCalledWith('warning', 'Cannot extract', expect.any(String));
      vi.unstubAllGlobals();
    });

    it('performs full extraction when result is valid', () => {
      const opts = defaultOpts();
      vi.stubGlobal('prompt', vi.fn(() => 'Auth Sub'));

      const extractResult = {
        childWorkflow: {
          name: 'Auth Sub',
          nodes: [{ id: 'cn1', type: 'http', data: {}, position: { x: 0, y: 0 } }],
          edges: [],
          variables: { key: 'val' },
        },
        subWorkflowNode: {
          id: 'sw-1',
          type: 'subWorkflow',
          data: { label: 'Auth Sub', workflowId: '', workflowName: '' },
          position: { x: 0, y: 0 },
        },
        extractedNodeIds: new Set(['n1']),
        extractedEdgeIds: new Set(['e1']),
      };
      mockExtract.mockReturnValue(extractResult as ExtractResult);

      const createdWf: Workflow = { ...minimalWorkflow(), id: 'new-wf', name: 'Auth Sub' };
      opts.workflows = [createdWf];
      opts.setNodes = vi.fn((fn: SetStateAction<WorkflowRFNode[]>) => (typeof fn === 'function' ? fn([
        { id: 'n1', type: 'http', data: { label: 'n1' } as WorkflowNodeData, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'http', data: { label: 'n2' } as WorkflowNodeData, position: { x: 0, y: 100 } },
      ]) : fn));
      opts.setEdges = vi.fn((fn: SetStateAction<WorkflowRFEdge[]>) => (typeof fn === 'function' ? fn([
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]) : fn));

      const { result } = renderHook(() => useWorkflowNodeActions(opts));
      act(() => result.current.handleExtractToSubWorkflow('n1'));

      expect(opts.undoRedo.takeSnapshot).toHaveBeenCalledWith('Extract to sub-workflow');
      expect(opts.create).toHaveBeenCalledWith('Auth Sub');
      expect(opts.update).toHaveBeenCalledWith('new-wf', expect.objectContaining({
        nodes: extractResult.childWorkflow.nodes,
        edges: extractResult.childWorkflow.edges,
        variables: extractResult.childWorkflow.variables,
      }));
      expect(opts.toast.show).toHaveBeenCalledWith('success', 'Extracted', expect.stringContaining('Auth Sub'));

      vi.unstubAllGlobals();
    });

    it('handles extraction when created workflow not found', () => {
      const opts = defaultOpts();
      vi.stubGlobal('prompt', vi.fn(() => 'Missing WF'));

      const extractResult = {
        childWorkflow: { name: 'Missing WF', nodes: [], edges: [], variables: {} },
        subWorkflowNode: { id: 'sw-1', type: 'subWorkflow', data: { label: 'Missing WF' }, position: { x: 0, y: 0 } },
        extractedNodeIds: new Set(['n1']),
        extractedEdgeIds: new Set<string>(),
      };
      mockExtract.mockReturnValue(extractResult as ExtractResult);
      opts.workflows = [];

      const { result } = renderHook(() => useWorkflowNodeActions(opts));
      act(() => result.current.handleExtractToSubWorkflow('n1'));

      expect(opts.create).toHaveBeenCalledWith('Missing WF');
      expect(opts.update).not.toHaveBeenCalled();
      expect(opts.toast.show).toHaveBeenCalledWith('success', 'Extracted', expect.any(String));

      vi.unstubAllGlobals();
    });
  });
});
