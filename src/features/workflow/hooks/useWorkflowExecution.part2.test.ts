/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowExecution } from './useWorkflowExecution';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow, WorkflowNode, HttpNodeData } from '../types/workflow';
import type { ConsoleLine } from '../../requests/hooks/useResponseCache';

// Mock dependencies
vi.mock('../engine/graphRunner', () => ({
  runGraph: vi.fn(),
}));

const mockDebugStop = vi.fn();
const mockDebugStepNode = vi.fn();

vi.mock('../engine/debugController', () => {
  return {
    DebugController: class MockDebugController {
      stop = mockDebugStop;
      stepNode = mockDebugStepNode;
    },
  };
});

vi.mock('../engine/remoteCorrelationStore', () => ({
  RemoteCorrelationStore: vi.fn(),
}));

vi.mock('../utils/workflowEnvReadiness', () => ({
  checkEnvReadiness: vi.fn().mockReturnValue({ ready: true, issues: [] }),
}));

vi.mock('../utils/workflowRunErrors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/workflowRunErrors')>();
  return {
    ...actual,
    summarizeRequestFailure: vi.fn().mockReturnValue('Mock error summary'),
  };
});

import { runGraph } from '../engine/graphRunner';
import { checkEnvReadiness } from '../utils/workflowEnvReadiness';

const mockRunGraph = vi.mocked(runGraph);
const mockCheckEnvReadiness = vi.mocked(checkEnvReadiness);

function createMockWorkflow(): Workflow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    nodes: [],
    edges: [],
    variables: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createMockNode(id: string, type: string): WorkflowRFNode {
  return {
    id,
    type: type as WorkflowRFNode['type'],
    position: { x: 0, y: 0 },
    data: { label: `${type} ${id}` },
  };
}

function createMockOptions() {
  const nodesRef = { current: [] as WorkflowRFNode[] };
  const edgesRef = { current: [] as WorkflowRFEdge[] };
  const workflowVariablesRef = { current: {} as Record<string, string> };
  const nodeInitialVarsRef = { current: {} as Record<string, Record<string, string>> };
  const consoleOpenRef = { current: true };
  const consoleRunBehaviorRef = { current: 'append' };
  const consoleLinesRef = { current: [] as ConsoleLine[] };

  return {
    selected: createMockWorkflow(),
    nodes: [] as WorkflowRFNode[],
    nodesRef,
    edgesRef,
    workflowVariablesRef,
    nodeInitialVarsRef,
    consoleOpenRef,
    consoleRunBehaviorRef,
    consoleLinesRef,
    resolvedBaseUrl: 'https://api.example.com',
    selectedEnvId: 'env-1',
    environments: [{ id: 'env-1', name: 'Production' }],
    workflowServices: [],
    workflowErrorConfig: undefined,
    resolveHttpBaseUrlForGraph: vi.fn(),
    resolveHttpAuthForGraph: vi.fn(),
    previewWorkflow: null,
    workflows: [],
    nodeStatuses: {},
    setNodeStatuses: vi.fn(),
    lastRunStatus: 'idle' as const,
    setLastRunStatus: vi.fn(),
    lastRunTime: undefined,
    setLastRunTime: vi.fn(),
    lastRunError: null,
    setLastRunError: vi.fn(),
    setRunVariableSnapshot: vi.fn(),
    pushRunHistory: vi.fn().mockReturnValue('history-1'),
    clearConsole: vi.fn(),
    pushConsoleLine: vi.fn(),
    sampleWorkflowCatalog: [],
    toast: {
      show: vi.fn(),
      dismiss: vi.fn(),
    },
  };
}

describe('useWorkflowExecution', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRunGraph.mockResolvedValue([]);
    mockCheckEnvReadiness.mockReturnValue({ ready: true, issues: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('workflow resolver', () => {
    it('resolves companion workflows from previewWorkflow catalog', async () => {
      const companionWf: Workflow = { id: 'companion-1', name: 'Companion', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 };
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.previewWorkflow = { id: 'preview-1', name: 'Preview', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 };
      opts.sampleWorkflowCatalog = [{ id: 'preview-1', companionFactories: [() => companionWf] }];

      let resolverFn: ((id: string) => Workflow | undefined) | undefined;
      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, _callbacks, _signal, _env, _baseUrl, _auth, _debug, _err, resolver) => {
        resolverFn = resolver as (id: string) => Workflow | undefined;
        _callbacks.onComplete([], true, 10);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(resolverFn!('companion-1')).toEqual(companionWf);
      expect(resolverFn!('unknown-id')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('failedStepLabel is null when failed HTTP node has no label', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'fail';
      const node = createMockNode('http-1', 'http');
      node.data = {};
      opts.nodes = [node];
      opts.nodeStatuses = { 'http-1': { state: 'fail' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBeNull();
    });

    it('skips env readiness when selectedEnvId is empty', async () => {
      mockCheckEnvReadiness.mockReturnValue({ ready: false, issues: [{ serviceId: 's', serviceName: 'S', hasUrlForEnv: false }] });
      const opts = createMockOptions();
      opts.selectedEnvId = '';
      opts.workflowServices = [{ id: 'svc-1', name: 'API', urls: {} }];
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(opts.toast.show).not.toHaveBeenCalled();
    });

    it('leaves envLayer empty when previewWorkflow is active', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.workflowServices = [];
      opts.previewWorkflow = createMockWorkflow();
      opts.resolvedBaseUrl = 'https://api.test.com/';
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => {
        cb.onComplete([], true, 1);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(mockRunGraph.mock.calls[0][5]).toEqual({});
    });

    it('ignores onComplete after abort signal marked aborted', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks, signal) => {
        Object.defineProperty(signal, 'aborted', { value: true, configurable: true });
        callbacks.onComplete([{ url: 'x', passed: true, statusCode: 200, responseTime: 1 }], true, 99);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(opts.setLastRunStatus).not.toHaveBeenCalledWith('pass');
      expect(result.current.isRunning).toBe(true);
    });

    it('uses generic error when failure has no failing result row', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => {
        cb.onComplete([], false, 10);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      await waitFor(() => { expect(result.current.isRunning).toBe(false); });
      expect(opts.setLastRunError).toHaveBeenCalledWith('One or more workflow steps failed.');
    });

    it('does not push console when console panel closed', async () => {
      const opts = createMockOptions();
      opts.consoleOpenRef.current = false;
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => {
        cb.onLog({ prefix: '>', text: 'hidden', ts: 1 });
        cb.onComplete([], true, 2);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(opts.pushConsoleLine).not.toHaveBeenCalled();
    });

    it('runProgress ignores pending node state', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'running';
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodeStatuses = { 'http-1': { state: 'pending' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress?.completed).toBe(0);
    });

    it('runProgress uses lastRunTime when run finished', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'pass';
      opts.lastRunTime = 444;
      opts.nodes = [createMockNode('http-1', 'http')];
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress?.elapsedMs).toBe(444);
    });

    it('runProgress counts skipped steps', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'pass';
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodeStatuses = { 'http-1': { state: 'skipped' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress?.completed).toBe(1);
    });

    it('failedStepLabel returns label when a non-HTTP node failed', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'fail';
      opts.nodes = [
        { id: 'sw', type: 'subWorkflow', position: { x: 0, y: 0 }, data: { label: 'Sub' } } as WorkflowRFNode,
      ];
      opts.nodeStatuses = { sw: { state: 'fail' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBe('Sub');
    });

    it('records last request URL from successful run', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => {
        cb.onComplete([
          { url: 'https://first', passed: true, statusCode: 200, responseTime: 1 },
          { url: 'https://last', passed: true, statusCode: 200, responseTime: 1 },
        ], true, 5);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      await waitFor(() => { expect(result.current.lastQuickTestRequestUrl).toBe('https://last'); });
    });

    it('step summaries mark HTTP steps as skipped when applicable', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => {
        cb.onNodeStateChange('http-1', { state: 'skipped', responseTimeMs: 0 });
        cb.onComplete([{ url: 'https://x', passed: true, statusCode: 200, responseTime: 1 }], true, 3);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      await waitFor(() => { expect(opts.pushRunHistory).toHaveBeenCalled(); });
      const entry = opts.pushRunHistory.mock.calls[0][0] as { stepSummaries: { state: string }[] };
      expect(entry.stepSummaries.some(s => s.state === 'skipped')).toBe(true);
    });

    it('workflow resolver returns workflow from workflows list', async () => {
      const child: Workflow = { id: 'child-wf', name: 'Child', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 };
      const opts = createMockOptions();
      opts.workflows = [child];
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      let resolver: ((id: string) => Workflow | undefined) | undefined;
      mockRunGraph.mockImplementation(async (...args) => {
        resolver = args[10] as (id: string) => Workflow | undefined;
        args[3].onComplete([], true, 1);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(resolver!('child-wf')).toEqual(child);
    });

    it('workflow resolver scans companion factories until id matches', async () => {
      const match: Workflow = { id: 'wanted', name: 'W', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 };
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.previewWorkflow = { id: 'preview-1', name: 'P', nodes: [], edges: [], variables: {}, createdAt: 0, updatedAt: 0 };
      opts.sampleWorkflowCatalog = [{
        id: 'preview-1',
        companionFactories: [
          () => ({ id: 'other', name: 'O', nodes: [], edges: [], variables: {} } as Workflow),
          () => match,
        ],
      }];
      let resolver: ((id: string) => Workflow | undefined) | undefined;
      mockRunGraph.mockImplementation(async (...args) => {
        resolver = args[10] as (id: string) => Workflow | undefined;
        args[3].onComplete([], true, 1);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(resolver!('wanted')).toEqual(match);
    });

    it('skips envLayer baseUrl when resolved base is whitespace only', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.resolvedBaseUrl = '  \n\t  ';
      opts.previewWorkflow = null;
      opts.workflowServices = [];
      mockRunGraph.mockImplementation(async (_a, _b, _c, cb) => { cb.onComplete([], true, 1); return []; });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(mockRunGraph.mock.calls[0][5]).toEqual({});
    });

    it('merges HTTP node data with per-node initial variable overrides', async () => {
      const opts = createMockOptions();
      const httpNode: WorkflowRFNode = {
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { label: 'Step', initialVariables: { a: 'fromData' } } as HttpNodeData,
      };
      opts.nodes = [httpNode];
      opts.nodesRef.current = [httpNode];
      opts.workflowVariablesRef.current = { globalX: 'G' };
      opts.nodeInitialVarsRef.current = { 'http-1': { a: 'fromRef' } };
      let mapped: WorkflowNode[] = [];
      mockRunGraph.mockImplementation(async (nodes, _e, _v, callbacks) => {
        mapped = nodes;
        callbacks.onComplete([], true, 1);
        return [];
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      const httpPayload = mapped.find(n => n.id === 'http-1')?.data as HttpNodeData;
      expect(httpPayload.initialVariables).toEqual({ globalX: 'G', a: 'fromRef' });
    });
  });
});
