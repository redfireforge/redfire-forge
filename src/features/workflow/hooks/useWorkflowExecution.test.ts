/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowExecution } from './useWorkflowExecution';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow, HttpNodeData } from '../types/workflow';
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

import { runGraph } from '@workflow/engine/graphRunner';
import { checkEnvReadiness } from '../utils/workflowEnvReadiness';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';

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
    resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRunGraph.mockResolvedValue([]);
    mockCheckEnvReadiness.mockReturnValue({ ready: true, issues: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes setIsRunning for advanced control', () => {
    const opts = createMockOptions();
    const { result } = renderHook(() => useWorkflowExecution(opts));
    act(() => { result.current.setIsRunning(false); });
    expect(result.current.isRunning).toBe(false);
  });

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const opts = createMockOptions();
      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.isRunning).toBe(false);
      expect(result.current.isDebugMode).toBe(false);
      expect(result.current.runProgress).toBeNull();
      expect(result.current.failedStepLabel).toBeNull();
      expect(result.current.lastQuickTestRequestUrl).toBeNull();
    });

    it('provides expected callback functions', () => {
      const opts = createMockOptions();
      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(typeof result.current.handleQuickTest).toBe('function');
      expect(typeof result.current.handleDebugQuickTest).toBe('function');
      expect(typeof result.current.handleDebugStep).toBe('function');
      expect(typeof result.current.handleDebugStop).toBe('function');
      expect(typeof result.current.handleResetRunStatus).toBe('function');
    });
  });

  describe('handleQuickTest', () => {
    it('does nothing if no workflow is selected', async () => {
      const opts = createMockOptions();
      opts.selected = null;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('does nothing if nodes array is empty', async () => {
      const opts = createMockOptions();
      opts.nodes = [];
      opts.nodesRef.current = [];

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('starts workflow run with nodes', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('start-1', 'start'), createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('running');
      expect(opts.setNodeStatuses).toHaveBeenCalledWith({});
      expect(mockRunGraph).toHaveBeenCalled();
    });

    it('blocks Quick Test when gRPC nodes fail graph validation', async () => {
      const opts = createMockOptions();
      opts.nodes = [{
        id: 'grpc-1',
        type: 'grpcUnary',
        position: { x: 0, y: 0 },
        data: {
          label: 'gRPC Unary',
          target: '',
          descriptorKey: '',
          service: '',
          method: '',
          callType: 'unary',
          body: {},
        },
      }];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(mockRunGraph).not.toHaveBeenCalled();
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('fail');
      expect(opts.setLastRunError).toHaveBeenCalledWith(expect.stringContaining('Target address or connection profile is required'));
      expect(opts.toast.show).toHaveBeenCalledWith(
        'error',
        'gRPC workflow validation failed',
        expect.any(String),
        6000,
      );
    });

    it('allows Quick Test when gRPC nodes pass graph validation', async () => {
      const opts = createMockOptions();
      opts.nodes = [{
        id: 'grpc-1',
        type: 'grpcUnary',
        position: { x: 0, y: 0 },
        data: {
          label: 'gRPC Unary',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'hello' },
        },
      }];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(mockRunGraph).toHaveBeenCalled();
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('running');
      expect(opts.toast.show).not.toHaveBeenCalledWith(
        'error',
        'gRPC workflow validation failed',
        expect.any(String),
        6000,
      );
    });

    it('stops running workflow when called during run', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(result.current.isRunning).toBe(true);

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('stopped');
      expect(result.current.isRunning).toBe(false);
    });

    it('clears console when runBehavior is not append', async () => {
      const opts = createMockOptions();
      opts.consoleRunBehaviorRef.current = 'clear';
      opts.consoleLinesRef.current = [];
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.clearConsole).toHaveBeenCalled();
    });

    it('appends separator when runBehavior is append and has existing lines', async () => {
      const opts = createMockOptions();
      opts.consoleRunBehaviorRef.current = 'append';
      opts.consoleLinesRef.current = [{ prefix: '>', text: 'existing', ts: Date.now() }];
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.pushConsoleLine).toHaveBeenCalledWith(expect.objectContaining({
        prefix: '---',
      }));
    });
  });

  describe('handleDebugQuickTest', () => {
    it('creates debug controller and starts debug run', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      expect(result.current.isDebugMode).toBe(true);
      expect(mockRunGraph).toHaveBeenCalled();
    });

    it('stops debug run when called during debug', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.isDebugMode).toBe(true);

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('stopped');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isDebugMode).toBe(false);
    });
  });

  describe('handleDebugStep', () => {
    it('calls stepNode on debug controller', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockDebugStepNode.mockClear();

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      act(() => {
        result.current.handleDebugStep('http-1');
      });

      expect(mockDebugStepNode).toHaveBeenCalledWith('http-1');
    });
  });

  describe('handleDebugStop', () => {
    it('stops debug controller and resets state', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockDebugStop.mockClear();

      mockRunGraph.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      act(() => {
        result.current.handleDebugStop();
      });

      expect(mockDebugStop).toHaveBeenCalled();
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('stopped');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isDebugMode).toBe(false);
    });
  });

  describe('handleResetRunStatus', () => {
    it('resets all run state', () => {
      const opts = createMockOptions();
      const { result } = renderHook(() => useWorkflowExecution(opts));

      act(() => {
        result.current.handleResetRunStatus();
      });

      expect(opts.setNodeStatuses).toHaveBeenCalledWith({});
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('idle');
      expect(opts.setLastRunTime).toHaveBeenCalledWith(undefined);
      expect(opts.setLastRunError).toHaveBeenCalledWith(null);
    });
  });

  describe('runProgress', () => {
    it('returns null when lastRunStatus is idle', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'idle';

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.runProgress).toBeNull();
    });

    it('calculates progress from node statuses', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'running';
      opts.nodes = [
        createMockNode('start-1', 'start'),
        createMockNode('http-1', 'http'),
        createMockNode('http-2', 'http'),
        createMockNode('end-1', 'end'),
      ];
      opts.nodeStatuses = {
        'http-1': { state: 'pass' },
        'http-2': { state: 'pending' },
      };

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.runProgress).not.toBeNull();
      expect(result.current.runProgress?.total).toBe(2);
      expect(result.current.runProgress?.completed).toBe(1);
      expect(result.current.runProgress?.failed).toBe(0);
    });

    it('counts failed nodes', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'fail';
      opts.nodes = [
        createMockNode('http-1', 'http'),
        createMockNode('http-2', 'http'),
      ];
      opts.nodeStatuses = {
        'http-1': { state: 'pass' },
        'http-2': { state: 'fail' },
      };

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.runProgress?.completed).toBe(2);
      expect(result.current.runProgress?.failed).toBe(1);
    });

    it('excludes non-executable nodes from total', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'running';
      opts.nodes = [
        createMockNode('start-1', 'start'),
        createMockNode('webhook-1', 'webhook'),
        createMockNode('schedule-1', 'schedule'),
        createMockNode('http-1', 'http'),
        createMockNode('end-1', 'end'),
      ];

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.runProgress?.total).toBe(1);
    });
  });

  describe('failedStepLabel', () => {
    it('returns null when lastRunStatus is not fail', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'pass';

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.failedStepLabel).toBeNull();
    });

    it('returns label of first failed HTTP node', () => {
      const opts = createMockOptions();
      opts.lastRunStatus = 'fail';
      opts.nodes = [
        {
          id: 'http-1',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { label: 'Get Users' } as HttpNodeData,
        } as WorkflowRFNode,
      ];
      opts.nodeStatuses = {
        'http-1': { state: 'fail' },
      };

      const { result } = renderHook(() => useWorkflowExecution(opts));

      expect(result.current.failedStepLabel).toBe('Get Users');
    });
  });

  describe('environment readiness check', () => {
    it('shows toast warning when env is not ready', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.workflowServices = [{ id: 'svc-1', name: 'API', urls: {} }];

      mockCheckEnvReadiness.mockReturnValue({
        ready: false,
        issues: [{ serviceId: 'svc-1', serviceName: 'API', hasUrlForEnv: false }],
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.toast.show).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('Some services not configured'),
        expect.stringContaining('API'),
        5000
      );
    });

    it('uses selected env id in toast title when environment name is missing', async () => {
      const opts = createMockOptions();
      opts.environments = [];
      opts.selectedEnvId = 'env-missing-label';
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.workflowServices = [{ id: 'svc-1', name: 'SVC', urls: {} }];
      mockCheckEnvReadiness.mockReturnValue({
        ready: false,
        issues: [{ serviceId: 'svc-1', serviceName: 'SVC', hasUrlForEnv: false }],
      });
      const { result } = renderHook(() => useWorkflowExecution(opts));
      await act(async () => { result.current.handleQuickTest(); });
      expect(opts.toast.show).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('env-missing-label'),
        expect.stringContaining('SVC'),
        5000,
      );
    });
  });

  describe('onComplete callback', () => {
    it('handles successful completion', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('http-1', { state: 'pass', statusCode: 200, responseTimeMs: 50 });
        callbacks.onVariablesChange({ token: 'abc' });
        callbacks.onLog({ prefix: '>', text: 'GET /api', ts: Date.now() });
        callbacks.onComplete([{ url: 'https://api.example.com/users', passed: true, statusCode: 200, responseTime: 50 }], true, 120);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('pass');
      expect(opts.setLastRunTime).toHaveBeenCalledWith(120);
      expect(opts.setLastRunError).toHaveBeenCalledWith(null);
      expect(opts.pushRunHistory).toHaveBeenCalledWith(expect.objectContaining({
        passed: true,
        durationMs: 120,
      }));
      expect(opts.setRunVariableSnapshot).toHaveBeenCalledWith({ token: 'abc' });
      expect(opts.pushConsoleLine).toHaveBeenCalled();
    });

    it('handles failed completion with error summary', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('http-1', { state: 'fail', statusCode: 500, responseTimeMs: 30 });
        callbacks.onComplete([{ url: 'https://api.example.com/fail', passed: false, statusCode: 500, responseTime: 30 }], false, 80);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('fail');
      expect(opts.setLastRunError).toHaveBeenCalledWith('Step failed');
      expect(opts.pushRunHistory).toHaveBeenCalledWith(expect.objectContaining({
        passed: false,
        error: 'Step failed',
      }));
    });

    it('captures lastQuickTestRequestUrl from failed result', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('http-1', { state: 'fail', statusCode: 500 });
        callbacks.onComplete([{ url: 'https://api.example.com/broken', passed: false, statusCode: 500, responseTime: 10 }], false, 50);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      await waitFor(() => {
        expect(result.current.lastQuickTestRequestUrl).toBe('https://api.example.com/broken');
      });
    });

    it('cleans up debug mode on complete during debug run', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('http-1', { state: 'pass', statusCode: 200, responseTimeMs: 20 });
        callbacks.onComplete([{ url: 'https://api.example.com', passed: true, statusCode: 200, responseTime: 20 }], true, 30);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.isDebugMode).toBe(false);
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('pass');
    });

    it('includes subWorkflow summaries in run history', async () => {
      const opts = createMockOptions();
      opts.nodes = [
        { id: 'sw-1', type: 'subWorkflow', position: { x: 0, y: 0 }, data: { label: 'Auth Sub' } } as unknown as WorkflowRFNode,
      ];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('sw-1', { state: 'pass', responseTimeMs: 100 });
        callbacks.onSubWorkflowComplete({
          parentNodeId: 'sw-1',
          childWorkflowName: 'Auth Flow',
          childSteps: [{ nodeId: 'ch1', label: 'Login', state: 'pass' as const, statusCode: 200, responseTimeMs: 50 }],
          durationMs: 100,
          attempt: 0,
        });
        callbacks.onComplete([{ url: 'https://api.example.com', passed: true, statusCode: 200, responseTime: 100 }], true, 150);
        return [];
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(opts.pushRunHistory).toHaveBeenCalledWith(expect.objectContaining({
        stepSummaries: expect.arrayContaining([
          expect.objectContaining({
            childWorkflowName: 'Auth Flow',
            childDurationMs: 100,
          }),
        ]),
      }));
    });
  });

  describe('runGraph catch handler', () => {
    it('handles runGraph rejection', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockRejectedValue(new Error('Unexpected crash'));

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('fail');
      expect(opts.setLastRunError).toHaveBeenCalledWith('Workflow run failed or was interrupted.');
    });

    it('handles runGraph rejection during debug run', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockRejectedValue(new Error('Debug crash'));

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleDebugQuickTest();
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.isDebugMode).toBe(false);
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('fail');
      expect(opts.setLastRunError).toHaveBeenCalledWith('Workflow debug run failed or was interrupted.');
    });

    it('does not override stopped status on rejection', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, _callbacks, _signal) => {
        await new Promise((r) => setTimeout(r, 2000));
        throw new Error('aborted');
      });

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      // Stop the run manually
      await act(async () => {
        result.current.handleQuickTest();
      });

      expect(opts.setLastRunStatus).toHaveBeenCalledWith('stopped');
      // Let the rejection fire
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      // Should still be 'stopped', not 'fail'
      const lastCall = opts.setLastRunStatus.mock.calls[opts.setLastRunStatus.mock.calls.length - 1];
      expect(lastCall[0]).toBe('stopped');
    });
  });

  describe('baseUrl resolution', () => {
    it('passes baseUrl in envLayer when no workflowServices and no previewWorkflow', async () => {
      const opts = createMockOptions();
      opts.nodes = [createMockNode('http-1', 'http')];
      opts.nodesRef.current = opts.nodes;
      opts.workflowServices = [];
      opts.previewWorkflow = null;
      opts.resolvedBaseUrl = 'https://api.test.com/';

      const { result } = renderHook(() => useWorkflowExecution(opts));

      await act(async () => {
        result.current.handleQuickTest();
      });

      const callArgs = mockRunGraph.mock.calls[0];
      expect(callArgs[5]).toEqual(expect.objectContaining({ baseUrl: 'https://api.test.com' }));
    });
  });

});
