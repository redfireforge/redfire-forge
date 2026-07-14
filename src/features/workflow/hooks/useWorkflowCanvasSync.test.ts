/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkflowCanvasSync, useWorkflowVariableHints } from './useWorkflowCanvasSync';
import { Workflow, WorkflowNode, WorkflowEdge, HttpNodeData } from '../types/workflow';
import { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';

function createMockWorkflow(id = 'wf-1', nodes: WorkflowNode[] = [], edges: WorkflowEdge[] = []): Workflow {
  return {
    id,
    name: 'Test Workflow',
    nodes,
    edges,
    variables: { baseUrl: 'https://api.example.com' },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createMockNode(id: string, type: string, position = { x: 0, y: 0 }, data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    position,
    data: { label: `${type} ${id}`, ...data },
  } as WorkflowNode;
}

function createMockEdge(id: string, source: string, target: string): WorkflowEdge {
  return { id, source, target };
}

function createMockCanvasSyncOpts() {
  const abortRef = { current: null as AbortController | null };
  const debugControllerRef = { current: null };
  const nextNodeYRef = { current: 100 };

  return {
    selected: null as Workflow | null,
    previewWorkflow: null as Workflow | null,
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setSelectedNodeId: vi.fn(),
    setLayoutVersion: vi.fn(),
    setWorkflowVariables: vi.fn(),
    setWorkflowHostProfiles: vi.fn(),
    setWorkflowAuthProfiles: vi.fn(),
    setWorkflowServices: vi.fn(),
    setWorkflowErrorConfig: vi.fn(),
    setNodeInitialVars: vi.fn(),
    nextNodeYRef,
    isRunning: false,
    abortRef,
    setIsRunning: vi.fn(),
    setIsDebugMode: vi.fn(),
    debugControllerRef,
  };
}

describe('useWorkflowCanvasSync', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('workflow selection', () => {
    it('does nothing when no workflow is selected', () => {
      const opts = createMockCanvasSyncOpts();

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setNodes).not.toHaveBeenCalled();
      expect(opts.setEdges).not.toHaveBeenCalled();
    });

    it('syncs canvas when workflow is selected', () => {
      const opts = createMockCanvasSyncOpts();
      const nodes = [createMockNode('start-1', 'start', { x: 0, y: 0 })];
      const edges = [createMockEdge('e1', 'start-1', 'end-1')];
      opts.selected = createMockWorkflow('wf-1', nodes, edges);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setNodes).toHaveBeenCalled();
      expect(opts.setEdges).toHaveBeenCalled();
      expect(opts.setSelectedNodeId).toHaveBeenCalledWith(null);
      expect(opts.setWorkflowVariables).toHaveBeenCalledWith({ baseUrl: 'https://api.example.com' });
    });

    it('assigns wf-edge-false-branch className to false-handle edges', () => {
      const opts = createMockCanvasSyncOpts();
      const nodes = [createMockNode('a', 'condition', { x: 0, y: 0 }), createMockNode('b', 'http', { x: 0, y: 100 })];
      const edges = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'false', label: 'No' },
        { id: 'e2', source: 'a', target: 'b', sourceHandle: 'true', label: 'Yes' },
      ];
      opts.selected = createMockWorkflow('wf-1', nodes, edges);

      renderHook(() => useWorkflowCanvasSync(opts));

      const setEdgesCall = opts.setEdges.mock.calls[0][0] as Array<{ id: string; className?: string }>;
      const falseEdge = setEdgesCall.find(e => e.id === 'e1');
      const trueEdge = setEdgesCall.find(e => e.id === 'e2');
      expect(falseEdge?.className).toBe('wf-edge-false-branch');
      expect(trueEdge?.className).toBeUndefined();
    });

    it('syncs workflow variables from selected workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      opts.selected.variables = { token: 'abc123', apiKey: 'key456' };

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setWorkflowVariables).toHaveBeenCalledWith({ token: 'abc123', apiKey: 'key456' });
    });

    it('syncs workflow services from selected workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      opts.selected.services = [{ id: 'svc-1', name: 'API', urls: { prod: 'https://api.example.com' } }];

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setWorkflowServices).toHaveBeenCalledWith(opts.selected.services);
    });

    it('syncs host profiles from selected workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      opts.selected.hostProfiles = [{ id: 'hp-1', name: 'Prod', baseUrl: 'https://prod.api.com' }];

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setWorkflowHostProfiles).toHaveBeenCalledWith(opts.selected.hostProfiles);
    });

    it('syncs auth profiles from selected workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      opts.selected.authProfiles = [{ id: 'ap-1', name: 'Bearer', auth: { type: 'bearer', token: 'abc' } }];

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setWorkflowAuthProfiles).toHaveBeenCalledWith(opts.selected.authProfiles);
    });

    it('extracts initialVariables from HTTP nodes', () => {
      const opts = createMockCanvasSyncOpts();
      const httpNode = createMockNode('http-1', 'http', { x: 0, y: 100 }, {
        scenario: { id: 'sc-1', name: 'Test', url: '/api/test', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
        initialVariables: { userId: '123', token: 'abc' },
      });
      opts.selected = createMockWorkflow('wf-1', [httpNode], []);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setNodeInitialVars).toHaveBeenCalledWith(expect.objectContaining({
        'http-1': { userId: '123', token: 'abc' },
      }));
    });

    it('calculates nextNodeYRef from highest node position', () => {
      const opts = createMockCanvasSyncOpts();
      const nodes = [
        createMockNode('n1', 'start', { x: 0, y: 0 }),
        createMockNode('n2', 'http', { x: 0, y: 200 }),
        createMockNode('n3', 'end', { x: 0, y: 400 }),
      ];
      opts.selected = createMockWorkflow('wf-1', nodes, []);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.nextNodeYRef.current).toBeGreaterThan(400);
    });

    it('aborts running execution when workflow changes', () => {
      const opts = createMockCanvasSyncOpts();
      opts.isRunning = true;
      opts.abortRef.current = new AbortController();
      const abortSpy = vi.spyOn(opts.abortRef.current, 'abort');
      opts.selected = createMockWorkflow('wf-1', [], []);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(abortSpy).toHaveBeenCalled();
      expect(opts.setIsRunning).toHaveBeenCalledWith(false);
      expect(opts.setIsDebugMode).toHaveBeenCalledWith(false);
    });

    it('does not re-sync when same workflow is re-rendered', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);

      const { rerender } = renderHook(() => useWorkflowCanvasSync(opts));

      resetAllMocks();
      rerender();

      expect(opts.setNodes).not.toHaveBeenCalled();
    });

    it('re-syncs when switching to different workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);

      const { rerender } = renderHook(() => useWorkflowCanvasSync(opts));

      resetAllMocks();
      opts.selected = createMockWorkflow('wf-2', [], []);
      rerender();

      expect(opts.setNodes).toHaveBeenCalled();
      expect(opts.setEdges).toHaveBeenCalled();
    });

    it('triggers layout version increment for preview workflow', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      opts.previewWorkflow = createMockWorkflow('preview-1', [], []);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setLayoutVersion).toHaveBeenCalled();
    });

    it('uses empty defaults when optional workflow fields are omitted', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = {
        id: 'wf-partial',
        name: 'Partial',
        nodes: [],
        edges: [],
        createdAt: 1,
        updatedAt: 2,
      } as Workflow;

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setWorkflowVariables).toHaveBeenCalledWith({});
      expect(opts.setWorkflowHostProfiles).toHaveBeenCalledWith([]);
      expect(opts.setWorkflowAuthProfiles).toHaveBeenCalledWith([]);
      expect(opts.setWorkflowServices).toHaveBeenCalledWith([]);
      expect(opts.setWorkflowErrorConfig).toHaveBeenCalledWith(undefined);
    });

    it('handles nodes with invalid positions', () => {
      const opts = createMockCanvasSyncOpts();
      const nodeWithBadPosition = {
        id: 'n1',
        type: 'start' as const,
        position: { x: undefined, y: undefined } as unknown as { x: number; y: number },
        data: { label: 'Start' },
      };
      opts.selected = createMockWorkflow('wf-1', [nodeWithBadPosition], []);

      renderHook(() => useWorkflowCanvasSync(opts));

      expect(opts.setNodes).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ position: { x: 0, y: 0 } }),
      ]));
    });

    it('does not sync when selected workflow becomes null', () => {
      const opts = createMockCanvasSyncOpts();
      opts.selected = createMockWorkflow('wf-1', [], []);
      const { rerender } = renderHook(() => useWorkflowCanvasSync(opts));
      resetAllMocks();
      opts.selected = null;
      rerender();
      expect(opts.setNodes).not.toHaveBeenCalled();
    });
  });
});

describe('useWorkflowVariableHints', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  function createMockVariableHintsOpts() {
    return {
      selectedNodeId: null as string | null,
      nodes: [] as WorkflowRFNode[],
      edges: [] as WorkflowRFEdge[],
      nodeInitialVars: {} as Record<string, Record<string, string>>,
      workflowVariables: {} as Record<string, string>,
    };
  }

  describe('selectedNode', () => {
    it('returns null when no node is selected', () => {
      const opts = createMockVariableHintsOpts();

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.selectedNode).toBeNull();
    });

    it('returns null when selected node is not found', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'non-existent';
      opts.nodes = [];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.selectedNode).toBeNull();
    });

    it('returns enriched node when found', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'http-1';
      opts.nodes = [{
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'HTTP',
          scenario: {
            id: 'sc-1', name: 'Test', url: '/test', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
          initialVariables: {},
        } as HttpNodeData,
      }];
      opts.nodeInitialVars = { 'http-1': { baseUrl: 'https://api.example.com' } };

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.selectedNode).not.toBeNull();
      expect(result.current.selectedNode?.id).toBe('http-1');
    });
  });

  describe('hintNodes', () => {
    it('returns enriched nodes array', () => {
      const opts = createMockVariableHintsOpts();
      opts.nodes = [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } } as WorkflowRFNode,
        { id: 'end-1', type: 'end', position: { x: 0, y: 100 }, data: { label: 'End' } } as WorkflowRFNode,
      ];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.hintNodes).toHaveLength(2);
      expect(result.current.hintNodes[0].id).toBe('start-1');
      expect(result.current.hintNodes[1].id).toBe('end-1');
    });
  });

  describe('hintEdges', () => {
    it('returns mapped edges array', () => {
      const opts = createMockVariableHintsOpts();
      opts.edges = [
        { id: 'e1', source: 'start-1', target: 'http-1', sourceHandle: 'a', label: 'yes' },
        { id: 'e2', source: 'http-1', target: 'end-1' },
      ];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.hintEdges).toHaveLength(2);
      expect(result.current.hintEdges[0]).toEqual({
        id: 'e1', source: 'start-1', target: 'http-1', sourceHandle: 'a', label: 'yes',
      });
      expect(result.current.hintEdges[1]).toEqual({
        id: 'e2', source: 'http-1', target: 'end-1', sourceHandle: undefined, label: undefined,
      });
    });

    it('handles non-string labels by setting to undefined', () => {
      const opts = createMockVariableHintsOpts();
      opts.edges = [
        { id: 'e1', source: 's', target: 't', label: 123 as unknown as string },
      ];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.hintEdges[0].label).toBeUndefined();
    });
  });

  describe('conditionVariableHints', () => {
    it('returns empty array when no node is selected', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = null;

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.conditionVariableHints).toEqual([]);
    });

    it('returns empty array for non-condition node types', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'http-1';
      opts.nodes = [{
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'HTTP',
          scenario: {
            id: 'sc-1', name: 'Test', url: '/test', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
          initialVariables: {},
        } as HttpNodeData,
      }];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.conditionVariableHints).toEqual([]);
    });

    it('collects hints for waitForCondition nodes', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'w1';
      opts.nodes = [
        {
          id: 'w1',
          type: 'waitForCondition',
          position: { x: 0, y: 0 },
          data: {
            label: 'Wait',
            conditionExpression: 'true',
            pollIntervalMs: 100,
            timeoutMs: 1000,
            maxAttempts: 0,
          },
        } as WorkflowRFNode,
      ];
      const { result } = renderHook(() => useWorkflowVariableHints(opts));
      expect(Array.isArray(result.current.conditionVariableHints)).toBe(true);
    });

    it('collects hints for condition nodes', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'c1';
      opts.nodes = [
        {
          id: 'c1',
          type: 'condition',
          position: { x: 0, y: 0 },
          data: { label: 'If', left: '{{x}}', operator: '==', right: '1' },
        } as WorkflowRFNode,
      ];
      const { result } = renderHook(() => useWorkflowVariableHints(opts));
      expect(Array.isArray(result.current.conditionVariableHints)).toBe(true);
    });

    it('collects hints for switch nodes', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'sw1';
      opts.nodes = [
        {
          id: 'sw1',
          type: 'switch',
          position: { x: 0, y: 0 },
          data: { label: 'Switch', expression: '{{x}}', cases: [] },
        } as WorkflowRFNode,
      ];
      const { result } = renderHook(() => useWorkflowVariableHints(opts));
      expect(Array.isArray(result.current.conditionVariableHints)).toBe(true);
    });

    it('collects hints for kafka nodes', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'kafka-1';
      opts.nodes = [
        {
          id: 'sv1',
          type: 'setVariable',
          position: { x: 0, y: 0 },
          data: { label: 'Set Vars', assignments: [{ id: 'a1', name: 'token', expression: 'abc' }] },
        } as WorkflowRFNode,
        {
          id: 'kafka-1',
          type: 'kafkaProduce',
          position: { x: 0, y: 0 },
          data: { label: 'Kafka', clusterId: 'c1', topic: 'orders' },
        } as WorkflowRFNode,
      ];
      opts.edges = [{ id: 'e1', source: 'sv1', target: 'kafka-1' }];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.conditionVariableHints.map((hint) => hint.ref)).toContain('token');
    });
  });

  describe('httpVariableHints', () => {
    it('returns empty array when no node is selected', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = null;

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.httpVariableHints).toEqual([]);
    });

    it('returns empty array for non-HTTP node', () => {
      const opts = createMockVariableHintsOpts();
      opts.selectedNodeId = 'delay-1';
      opts.nodes = [{
        id: 'delay-1',
        type: 'delay',
        position: { x: 0, y: 0 },
        data: { label: 'Delay', delayMs: 1000, mode: 'fixed' },
      }];

      const { result } = renderHook(() => useWorkflowVariableHints(opts));

      expect(result.current.httpVariableHints).toEqual([]);
    });
  });
});
