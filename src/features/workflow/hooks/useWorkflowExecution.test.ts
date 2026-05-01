/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowExecution } from './useWorkflowExecution';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

// ─── Mock heavy dependencies ────────────────────────────────────────────────
vi.mock('../engine/graphRunner', () => ({
  runGraph: vi.fn(() => Promise.resolve()),
}));
vi.mock('../engine/debugController', () => ({
  DebugController: vi.fn().mockImplementation(() => ({
    stop: vi.fn(),
    stepNode: vi.fn(),
  })),
}));
vi.mock('../engine/remoteCorrelationStore', () => ({
  RemoteCorrelationStore: vi.fn(),
}));
vi.mock('../utils/workflowVariableHints', () => ({
  isHttpWorkflowNode: (n: any) => n.type === 'http',
}));
vi.mock('../utils/workflowNodeMerge', () => ({
  cloneWorkflowNodeDataForStorage: (d: any) => ({ ...d }),
}));
vi.mock('../utils/workflowHostResolve', () => ({
  stripTrailingSlash: (s: string) => s.replace(/\/$/, ''),
}));
vi.mock('../utils/workflowEnvReadiness', () => ({
  checkEnvReadiness: vi.fn(() => ({ ready: true, issues: [] })),
}));
vi.mock('../utils/workflowRunErrors', () => ({
  summarizeRequestFailure: vi.fn(() => 'mocked error'),
}));

const makeRef = <T,>(value: T) => ({ current: value });

const defaultOpts = () => ({
  selected: { id: 'wf-1', name: 'Test' } as any,
  nodes: [] as WorkflowRFNode[],
  nodesRef: makeRef([] as WorkflowRFNode[]),
  edgesRef: makeRef([]),
  workflowVariablesRef: makeRef({}),
  nodeInitialVarsRef: makeRef({}),
  consoleOpenRef: makeRef(false),
  consoleRunBehaviorRef: makeRef('clear'),
  consoleLinesRef: makeRef([]),
  resolvedBaseUrl: 'http://localhost',
  selectedEnvId: 'env-1',
  environments: [{ id: 'env-1', name: 'Dev' }],
  workflowServices: [],
  workflowErrorConfig: undefined,
  resolveHttpBaseUrlForGraph: vi.fn(),
  resolveHttpAuthForGraph: vi.fn(),
  previewWorkflow: null,
  workflows: [],
  nodeStatuses: {} as Record<string, any>,
  setNodeStatuses: vi.fn(),
  lastRunStatus: 'idle' as const,
  setLastRunStatus: vi.fn(),
  lastRunTime: undefined as number | undefined,
  setLastRunTime: vi.fn(),
  lastRunError: null as string | null,
  setLastRunError: vi.fn(),
  setRunVariableSnapshot: vi.fn(),
  pushRunHistory: vi.fn(() => 'run-1'),
  clearConsole: vi.fn(),
  pushConsoleLine: vi.fn(),
  sampleWorkflowCatalog: [],
  toast: { show: vi.fn() } as any,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useWorkflowExecution', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── runProgress ──

  describe('runProgress', () => {
    it('returns null when lastRunStatus is idle', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'idle';
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress).toBeNull();
    });

    it('counts executable nodes (excludes start, webhook, schedule, end)', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'running' as any;
      opts.nodes = [
        { id: 'n1', type: 'start', data: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'http', data: {}, position: { x: 0, y: 0 } },
        { id: 'n3', type: 'http', data: {}, position: { x: 0, y: 0 } },
        { id: 'n4', type: 'end', data: {}, position: { x: 0, y: 0 } },
      ] as any;
      opts.nodeStatuses = {
        n2: { state: 'pass' },
        n3: { state: 'fail' },
      };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress).toMatchObject({
        total: 2,
        completed: 2,
        failed: 1,
      });
    });

    it('uses lastRunTime when not running', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'pass' as any;
      opts.lastRunTime = 1234;
      opts.nodes = [{ id: 'n1', type: 'http', data: {}, position: { x: 0, y: 0 } }] as any;
      opts.nodeStatuses = { n1: { state: 'pass' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress?.elapsedMs).toBe(1234);
    });

    it('counts skipped as completed', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'pass' as any;
      opts.nodes = [{ id: 'n1', type: 'http', data: {}, position: { x: 0, y: 0 } }] as any;
      opts.nodeStatuses = { n1: { state: 'skipped' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.runProgress?.completed).toBe(1);
      expect(result.current.runProgress?.failed).toBe(0);
    });
  });

  // ── failedStepLabel ──

  describe('failedStepLabel', () => {
    it('returns null when lastRunStatus is not fail', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'pass' as any;
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBeNull();
    });

    it('returns label of first failed http node', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'fail' as any;
      opts.nodes = [
        { id: 'n1', type: 'http', data: { label: 'GET Users' }, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'http', data: { label: 'POST Users' }, position: { x: 0, y: 0 } },
      ] as any;
      opts.nodeStatuses = {
        n1: { state: 'pass' },
        n2: { state: 'fail' },
      };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBe('POST Users');
    });

    it('returns null when no http nodes failed', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'fail' as any;
      opts.nodes = [
        { id: 'n1', type: 'condition', data: { label: 'Check' }, position: { x: 0, y: 0 } },
      ] as any;
      opts.nodeStatuses = { n1: { state: 'fail' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBeNull();
    });

    it('returns null when failed http node has no label', () => {
      const opts = defaultOpts();
      opts.lastRunStatus = 'fail' as any;
      opts.nodes = [
        { id: 'n1', type: 'http', data: {}, position: { x: 0, y: 0 } },
      ] as any;
      opts.nodeStatuses = { n1: { state: 'fail' } };
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(result.current.failedStepLabel).toBeNull();
    });
  });

  // ── handleResetRunStatus ──

  describe('handleResetRunStatus', () => {
    it('resets all run state', () => {
      const opts = defaultOpts();
      const { result } = renderHook(() => useWorkflowExecution(opts));
      act(() => result.current.handleResetRunStatus());
      expect(opts.setNodeStatuses).toHaveBeenCalledWith({});
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('idle');
      expect(opts.setLastRunTime).toHaveBeenCalledWith(undefined);
      expect(opts.setLastRunError).toHaveBeenCalledWith(null);
    });
  });

  // ── handleQuickTest ──

  describe('handleQuickTest', () => {
    it('does not crash when selected is null', () => {
      const opts = defaultOpts();
      opts.selected = null;
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(() => act(() => result.current.handleQuickTest())).not.toThrow();
    });

    it('does not crash when nodes are empty', () => {
      const opts = defaultOpts();
      opts.nodes = [];
      const { result } = renderHook(() => useWorkflowExecution(opts));
      expect(() => act(() => result.current.handleQuickTest())).not.toThrow();
    });
  });

  // ── initial state ──

  describe('initial state', () => {
    it('starts not running', () => {
      const { result } = renderHook(() => useWorkflowExecution(defaultOpts()));
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isDebugMode).toBe(false);
      expect(result.current.lastQuickTestRequestUrl).toBeNull();
    });
  });

  // ── handleDebugStep ──

  describe('handleDebugStep', () => {
    it('does not throw when no debug controller', () => {
      const { result } = renderHook(() => useWorkflowExecution(defaultOpts()));
      expect(() => act(() => result.current.handleDebugStep('n1'))).not.toThrow();
    });
  });

  // ── handleDebugStop ──

  describe('handleDebugStop', () => {
    it('resets debug state', () => {
      const opts = defaultOpts();
      const { result } = renderHook(() => useWorkflowExecution(opts));
      act(() => result.current.handleDebugStop());
      expect(opts.setLastRunStatus).toHaveBeenCalledWith('stopped');
      expect(opts.setLastRunError).toHaveBeenCalledWith(null);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isDebugMode).toBe(false);
    });
  });
});
