import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowNode, NodeRunStatus } from '../../types/workflow';
import type { NodeHandlerContext, PassedFlag } from '../graphRunnerNodeHandlers';
import type { ICorrelationStore } from '../correlationStore';
import type { WorkflowPausedState } from '../../types/workflow';

// Mock dependencies
vi.mock('../workflowStateSerializer', () => ({
  serializeWorkflowState: vi.fn(() => ({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    visitedNodes: [],
    pausedNodeId: 'cw1',
    threadId: 'main',
    joinArrived: {},
    results: [],
    startTime: 1000,
    initialVariables: {},
  } satisfies WorkflowPausedState)),
}));

import { handleCorrelationWaitNode } from '../graphRunnerNodeHandlers';
import { VariableContext } from '../variableContext';

// ── helpers ──────────────────────────────────────────

function makePassedFlag(value = true): PassedFlag {
  return { value };
}

interface MockCallbackResult {
  states: Record<string, NodeRunStatus>;
  variables: Record<string, string>[];
  logLines: Array<{ prefix: string; text: string }>;
  callbacks: NodeHandlerContext['callbacks'];
}

function makeCallbacks(): MockCallbackResult {
  const states: Record<string, NodeRunStatus> = {};
  const variables: Record<string, string>[] = [];
  const logLines: Array<{ prefix: string; text: string }> = [];
  return {
    states,
    variables,
    logLines,
    callbacks: {
      onNodeStateChange: vi.fn((id, status) => { states[id] = status; }),
      onVariablesChange: vi.fn((v) => variables.push({ ...v })),
      onComplete: vi.fn(),
      onLog: vi.fn((line) => logLines.push(line)),
    },
  };
}

function makeNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'cw1',
    type: 'correlationWait',
    position: { x: 0, y: 0 },
    data: {
      label: 'Correlation Wait',
      correlationIdExpression: '{{paymentId}}',
      webhookPath: '/webhooks/payment',
      correlationSource: 'body',
      correlationJsonPath: '$.correlationId',
      extractVariables: [],
      timeoutMs: 5000,
      ...data,
    },
  };
}

function makeMockStore(overrides: Partial<ICorrelationStore> = {}): ICorrelationStore {
  return {
    pause: vi.fn(() => Promise.resolve({ status: 'approved' })),
    resume: vi.fn(() => true),
    isPaused: vi.fn(() => false),
    cancel: vi.fn(() => false),
    get: vi.fn(() => undefined),
    cleanup: vi.fn(() => 0),
    listPaused: vi.fn(() => []),
    size: 0,
    ...overrides,
  };
}

function makeHandlerContext(overrides: Partial<NodeHandlerContext> = {}): NodeHandlerContext {
  const ctx = overrides.ctx ?? new VariableContext({ paymentId: 'pay_123' });
  const { callbacks, logLines } = makeCallbacks();
  return {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx,
    tokenManager: {} as never,
    results: [],
    allPassed: true,
    visited: new Set(),
    joinArrived: new Map(),
    incomingCount: new Map(),
    callbacks: overrides.callbacks ?? callbacks,
    log: overrides.log ?? ((line) => logLines.push(line)),
    nodeLabel: overrides.nodeLabel ?? (() => 'Correlation Wait'),
    visit: overrides.visit ?? vi.fn(),
    visitOutgoing: overrides.visitOutgoing ?? vi.fn(),
    threadId: 'main',
    initialVariables: {},
    correlationStore: makeMockStore(),
    executionId: 'exec-1',
    workflowId: 'wf-1',
    startTime: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────

describe('handleCorrelationWaitNode', () => {

  beforeEach(() => {
    resetAllMocks();
  });

  describe('loadTestMode synthetic-inject (inline fallback, no store)', () => {
    // These tests verify the inline delay fallback when NO correlation store is provided.
    // When a store IS provided, synthetic-inject uses store-based pause/resume.

    it('waits for synthetic delay before resuming', async () => {
      vi.useFakeTimers();

      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: undefined, // No store -> inline delay fallback
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: { cw1: { status: 'synthetic' } },
          syntheticDelayMs: 500,
          syntheticJitterMs: 0,
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should show paused state while waiting
      expect(states['cw1']?.state).toBe('paused');

      // Fast-forward past the delay
      await vi.advanceTimersByTimeAsync(600);
      await promise;

      // Should pass after delay
      expect(states['cw1']?.state).toBe('pass');
      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"synthetic"}');

      vi.useRealTimers();
    });

    it('respects abort signal during synthetic delay', async () => {
      vi.useFakeTimers();

      const abortController = new AbortController();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: undefined, // No store -> inline delay fallback
        loadTestMode: true,
        abortSignal: abortController.signal,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: { cw1: { status: 'synthetic' } },
          syntheticDelayMs: 5000,
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Abort before delay completes
      await vi.advanceTimersByTimeAsync(100);
      abortController.abort();
      await vi.advanceTimersByTimeAsync(100);
      await promise;

      // Should fail due to abort
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toContain('Aborted');

      vi.useRealTimers();
    });

    it('adds jitter to synthetic delay', async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.75); // Will add 0.75 * 200 - 100 = +50ms jitter

      const store = undefined; // No store -> inline delay fallback
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: { cw1: { status: 'jittery' } },
          syntheticDelayMs: 500,
          syntheticJitterMs: 100, // ±100ms
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // With jitter, delay should be 500 + 50 = 550ms
      await vi.advanceTimersByTimeAsync(540);
      expect(states['cw1']?.state).toBe('paused'); // Still waiting

      await vi.advanceTimersByTimeAsync(20);
      await promise;
      expect(states['cw1']?.state).toBe('pass');

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('logs synthetic inject mode message', async () => {
      vi.useFakeTimers();

      const logLines: Array<{ prefix: string; text: string }> = [];
      const log = vi.fn((line: { prefix: string; text: string }) => logLines.push(line));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: undefined, // No store -> inline delay fallback
        loadTestMode: true,
        log,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: {},
          syntheticDelayMs: 100,
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(logLines.some(l => l.text.includes('Synthetic inject (inline)'))).toBe(true);

      vi.useRealTimers();
    });

    it('extracts variables from mock payload in synthetic-inject mode', async () => {
      vi.useFakeTimers();

      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: undefined, // No store -> inline delay fallback
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: { cw1: { result: { code: 'SUCCESS', value: 42 } } },
          syntheticDelayMs: 50,
        },
      });
      const node = makeNode({
        extractVariables: [
          { name: 'resultCode', jsonPath: '$.result.code' },
          { name: 'resultValue', jsonPath: '$.result.value' },
        ],
      });
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);
      await vi.advanceTimersByTimeAsync(100);
      await promise;

      expect(ctx.resolve('{{resultCode}}')).toBe('SUCCESS');
      expect(ctx.resolve('{{resultValue}}')).toBe('42');

      vi.useRealTimers();
    });
  });

  describe('loadTestMode synthetic-inject (store-based)', () => {
    // These tests verify the store-based flow when a correlation store IS provided.
    // The handler calls store.pause() and waits for external resume.

    it('uses correlation store pause/resume flow', async () => {
      vi.useFakeTimers();

      const store = makeMockStore();
      // Mock pause to resolve after a delay (simulating injector)
      (store.pause as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 100));
        return { status: 'from-store' };
      });

      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          mockPayloads: { cw1: { status: 'ignored-when-store-used' } },
          syntheticDelayMs: 500, // Ignored when store is used
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should be paused initially
      expect(states['cw1']?.state).toBe('paused');

      // Advance past the mock store delay
      await vi.advanceTimersByTimeAsync(150);
      await promise;

      // Should pass with the payload from store
      expect(states['cw1']?.state).toBe('pass');
      // In synthetic-inject mode with loadTestMode, correlation ID gets unique suffix
      expect(store.pause).toHaveBeenCalledWith(
        expect.stringMatching(/^pay_123-\d+-[a-z0-9]+$/),
        '/webhooks/payment',
        expect.any(Object),
        5000, // default timeout from node
        undefined,
      );
      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"from-store"}');

      vi.useRealTimers();
    });

    it('handles abort signal during store-based synthetic-inject', async () => {
      const abortController = new AbortController();
      const store = makeMockStore();
      // Pause never resolves — the abort will race it
      (store.pause as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}),
      );

      const ctx = new VariableContext({ paymentId: 'pay_abort' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        abortSignal: abortController.signal,
        correlationWaitConfig: { mode: 'synthetic-inject' },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(states['cw1']?.state).toBe('paused');

      // Abort before the store resolves
      abortController.abort();
      await promise;

      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('Aborted');
    });

    it('marks as fail when store-based synthetic-inject throws a non-abort error', async () => {
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('store exploded'));

      const ctx = new VariableContext({ paymentId: 'pay_err' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('store exploded');
      expect(passed.value).toBe(false);
    });
  });

  describe('normal mode abort handling', () => {
    it('handles abort via debugController.isStopped', async () => {
      const store = makeMockStore();
      // Never resolves — debugController.isStopped will race it
      (store.pause as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}),
      );

      const debugController = { isStopped: true } as { isStopped: boolean };
      const ctx = new VariableContext({ paymentId: 'pay_stop' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        debugController: debugController as Parameters<typeof makeHandlerContext>[0]['debugController'],
      });
      const node = makeNode();
      const passed = makePassedFlag();

      // createAbortPromise returns null when no AbortSignal — the catch block will handle debugController.isStopped
      // Reject the store to trigger the catch block
      (store.pause as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('stopped'));
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // When debugController.isStopped, it is treated as an abort
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('Aborted');
    });

    it('logs timeout string when timeoutMs is zero', async () => {
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const ctx = new VariableContext({ paymentId: 'pay_notimeout' });
      const { callbacks, states } = makeCallbacks();
      const logs: string[] = [];
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        log: (_line: { prefix: string; text: string }) => { logs.push(_line.text); },
      });
      const nodeWithNoTimeout = makeNode();
      (nodeWithNoTimeout.data as import('../../types/workflow').CorrelationWaitNodeData).timeoutMs = 0;
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', nodeWithNoTimeout, hCtx, passed);

      expect(states['cw1']?.state).toBe('pass');
      const resumeLog = logs.find(l => l.includes('Resumed'));
      // timeoutMs === 0 means no timeout string appended
      expect(resumeLog).not.toContain('within');
    });
  });

  describe('branch coverage for null-coalescing fallbacks', () => {
    it('uses 300000 as default timeout when timeoutMs is undefined in store-based synthetic-inject', async () => {
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ok' });

      const ctx = new VariableContext({ paymentId: 'pay_undef' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
      });
      const nodeNoTimeout = makeNode();
      // Make timeoutMs undefined to exercise the `?? 300000` fallback
      (nodeNoTimeout.data as import('../../types/workflow').CorrelationWaitNodeData).timeoutMs = undefined as never;
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', nodeNoTimeout, hCtx, passed);

      expect(states['cw1']?.state).toBe('pass');
      expect(store.pause).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        300000,
        undefined,
      );
    });

    it('stringifies non-Error objects in store-based synthetic-inject error handler', async () => {
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockRejectedValue('plain string error');

      const ctx = new VariableContext({ paymentId: 'pay_str' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('plain string error');
    });

    it('uses fallback executionId and workflowId when not provided', async () => {
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const ctx = new VariableContext({ paymentId: 'pay_fallback' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        executionId: undefined,
        workflowId: undefined,
        startTime: undefined,
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(states['cw1']?.state).toBe('pass');
      // serializeWorkflowState should have been called with fallback ids
      const { serializeWorkflowState } = await import('../workflowStateSerializer');
      expect(serializeWorkflowState).toHaveBeenCalledWith(
        expect.anything(),
        'cw1',
        expect.stringMatching(/^exec-\d+$/),
        'unknown',
        expect.any(Number),
      );
    });

    it('uses Promise.race when abortSignal is present in normal mode', async () => {
      const abortController = new AbortController();
      const store = makeMockStore();
      (store.pause as ReturnType<typeof vi.fn>).mockResolvedValue({ final: true });

      const ctx = new VariableContext({ paymentId: 'pay_race' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        abortSignal: abortController.signal,
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(states['cw1']?.state).toBe('pass');
      expect(store.pause).toHaveBeenCalled();
    });
  });
});
