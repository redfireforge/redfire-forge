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

  it('resolves correlation ID, pauses, and resumes on webhook', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ status: 'approved', amount: 99 })),
    });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(store.pause).toHaveBeenCalledWith(
      'pay_123',
      '/webhooks/payment',
      expect.any(Object),
      5000,
      undefined,
      expect.any(Object),
    );
    expect(states['cw1']?.state).toBe('pass');
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('cw1', 'main');
  });

  it('injects webhook.body and webhook.correlationId into context', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ status: 'approved' })),
    });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"approved"}');
    expect(ctx.resolve('{{webhook.correlationId}}')).toBe('pay_123');
  });

  it('extracts variables from webhook payload', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ payment: { status: 'approved', amount: 42 } })),
    });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode({
      extractVariables: [
        { name: 'paymentStatus', jsonPath: '$.payment.status' },
        { name: 'paymentAmount', jsonPath: '$.payment.amount' },
      ],
    });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(ctx.resolve('{{paymentStatus}}')).toBe('approved');
    expect(ctx.resolve('{{paymentAmount}}')).toBe('42');
  });

  it('skips undefined extracted variables', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ data: {} })),
    });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode({
      extractVariables: [{ name: 'missing', jsonPath: '$.nonexistent.path' }],
    });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(ctx.resolve('{{missing}}')).toBe('{{missing}}');
  });

  it('fails when correlation ID resolves to empty string', async () => {
    const ctx = new VariableContext({ paymentId: '' });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, ctx });
    const node = makeNode({ correlationIdExpression: '{{paymentId}}' });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(states['cw1']?.state).toBe('fail');
    expect(states['cw1']?.error).toContain('empty string');
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when no correlation store is available', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: undefined });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(states['cw1']?.state).toBe('fail');
    expect(states['cw1']?.error).toContain('No correlation store');
    expect(passed.value).toBe(false);
  });

  it('fails on timeout', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.reject(new Error('Correlation timeout: no webhook received within 5000ms'))),
    });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(states['cw1']?.state).toBe('fail');
    expect(states['cw1']?.error).toContain('Correlation timeout');
    expect(passed.value).toBe(false);
  });

  it('passes webhookFilter to store.pause', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({})),
    });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store });
    const node = makeNode({ webhookFilter: '{{webhook.type}} == payment' });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(store.pause).toHaveBeenCalledWith(
      'pay_123',
      '/webhooks/payment',
      expect.any(Object),
      5000,
      '{{webhook.type}} == payment',
      expect.any(Object),
    );
  });

  it('shows paused state while waiting', async () => {
    let resolvePromise: (v: Record<string, unknown>) => void;
    const pausePromise = new Promise<Record<string, unknown>>((resolve) => { resolvePromise = resolve; });
    const store = makeMockStore({ pause: vi.fn(() => pausePromise) });

    const stateChanges: Array<{ state: string }> = [];
    const { callbacks } = makeCallbacks();
    callbacks.onNodeStateChange = vi.fn((_, status) => { stateChanges.push(status); });

    const hCtx = makeHandlerContext({ callbacks, correlationStore: store });
    const node = makeNode();
    const passed = makePassedFlag();

    const promise = handleCorrelationWaitNode('cw1', node, hCtx, passed);

    // Should have set paused state
    expect(stateChanges.some(s => s.state === 'paused')).toBe(true);

    // Resolve the webhook
    resolvePromise!({ ok: true });
    await promise;

    expect(stateChanges[stateChanges.length - 1].state).toBe('pass');
  });

  it('handles non-Error exceptions', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.reject('string error')),
    });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(states['cw1']?.state).toBe('fail');
    expect(states['cw1']?.error).toBe('string error');
    expect(passed.value).toBe(false);
  });

  it('uses default executionId when not provided', async () => {
    const store = makeMockStore({ pause: vi.fn(() => Promise.resolve({})) });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      correlationStore: store,
      executionId: undefined,
    });
    const node = makeNode();
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(passed.value).toBe(true);
  });

  it('handles empty extractVariables array', async () => {
    const store = makeMockStore({ pause: vi.fn(() => Promise.resolve({ data: 1 })) });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode({ extractVariables: [] });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(callbacks.onVariablesChange).toHaveBeenCalled();
  });

  it('handles undefined extractVariables', async () => {
    const store = makeMockStore({ pause: vi.fn(() => Promise.resolve({ data: 1 })) });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode({ extractVariables: undefined });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(passed.value).toBe(true);
  });

  it('extracts object value as JSON string', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ nested: { a: 1, b: 2 } })),
    });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, correlationStore: store, ctx });
    const node = makeNode({
      extractVariables: [{ name: 'nested', jsonPath: '$.nested' }],
    });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(ctx.resolve('{{nested}}')).toBe('{"a":1,"b":2}');
  });

  it('logs extracted variable values', async () => {
    const store = makeMockStore({
      pause: vi.fn(() => Promise.resolve({ status: 'ok' })),
    });
    const ctx = new VariableContext({ paymentId: 'pay_123' });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const log = vi.fn((line: { prefix: string; text: string }) => logLines.push(line));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, correlationStore: store, ctx, log,
    });
    const node = makeNode({
      extractVariables: [{ name: 'status', jsonPath: '$.status' }],
    });
    const passed = makePassedFlag();

    await handleCorrelationWaitNode('cw1', node, hCtx, passed);

    expect(logLines.some(l => l.prefix === '#' && l.text.includes('status = ok'))).toBe(true);
  });

  // ── 7D.4: Multi-Correlation ──

  it('supports multiple concurrent correlation waits with different IDs', async () => {
    const resolvers: Array<(v: Record<string, unknown>) => void> = [];
    const store = makeMockStore({
      pause: vi.fn(() => new Promise<Record<string, unknown>>((resolve) => { resolvers.push(resolve); })),
    });

    const ctx1 = new VariableContext({ paymentId: 'pay_001' });
    const ctx2 = new VariableContext({ paymentId: 'pay_002' });

    const hCtx1 = makeHandlerContext({ correlationStore: store, ctx: ctx1 });
    const hCtx2 = makeHandlerContext({ correlationStore: store, ctx: ctx2 });

    const node1 = makeNode({ correlationIdExpression: '{{paymentId}}', webhookPath: '/callback/1' });
    const node2 = makeNode({ correlationIdExpression: '{{paymentId}}', webhookPath: '/callback/2' });

    const passed1 = makePassedFlag();
    const passed2 = makePassedFlag();

    // Start both waits concurrently
    const p1 = handleCorrelationWaitNode('cw1', node1, hCtx1, passed1);
    const p2 = handleCorrelationWaitNode('cw2', node2, hCtx2, passed2);

    // Both should have called pause
    expect(store.pause).toHaveBeenCalledTimes(2);

    // Resolve in different order
    resolvers[1]({ status: 'second' });
    resolvers[0]({ status: 'first' });

    await p1;
    await p2;

    expect(passed1.value).toBe(true);
    expect(passed2.value).toBe(true);
  });

  it('one correlation failure does not affect others', async () => {
    let rejectFn: (err: Error) => void;
    let resolveFn: (v: Record<string, unknown>) => void;
    let callCount = 0;

    const store = makeMockStore({
      pause: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise<Record<string, unknown>>((_, reject) => { rejectFn = reject; });
        }
        return new Promise<Record<string, unknown>>((resolve) => { resolveFn = resolve; });
      }),
    });

    const ctx1 = new VariableContext({ paymentId: 'fail_001' });
    const ctx2 = new VariableContext({ paymentId: 'pass_002' });

    const hCtx1 = makeHandlerContext({ correlationStore: store, ctx: ctx1 });
    const hCtx2 = makeHandlerContext({ correlationStore: store, ctx: ctx2 });

    const passed1 = makePassedFlag();
    const passed2 = makePassedFlag();

    const p1 = handleCorrelationWaitNode('cw1', makeNode(), hCtx1, passed1);
    const p2 = handleCorrelationWaitNode('cw2', makeNode(), hCtx2, passed2);

    // Fail the first, succeed the second
    rejectFn!(new Error('Timeout'));
    resolveFn!({ ok: true });

    await p1;
    await p2;

    expect(passed1.value).toBe(false); // failed
    expect(passed2.value).toBe(true);  // succeeded independently
  });

  // ── Phase 7A: Load Test Mode (Auto-Resume) ──
  // Note: Config is now passed via hCtx.correlationWaitConfig (runner-level), not node data

  describe('loadTestMode auto-resume', () => {
    it('immediately resumes with mock payload when loadTestMode=true and mode=auto-resume', async () => {
      const store = makeMockStore();
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'auto-resume',
          mockPayloads: { cw1: { status: 'mocked', amount: 100 } },
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should NOT call pause — auto-resume skips the wait
      expect(store.pause).not.toHaveBeenCalled();

      // Should pass immediately
      expect(states['cw1']?.state).toBe('pass');
      expect(passed.value).toBe(true);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('cw1', 'main');

      // Should inject mock payload
      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"mocked","amount":100}');
      expect(ctx.resolve('{{webhook.correlationId}}')).toBe('pay_123');
    });

    it('uses empty object when mockPayload is not provided in auto-resume mode', async () => {
      const store = makeMockStore();
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume' },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(states['cw1']?.state).toBe('pass');
      expect(ctx.resolve('{{webhook.body}}')).toBe('{}');
    });

    it('extracts variables from mock payload in auto-resume mode', async () => {
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: makeMockStore(),
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'auto-resume',
          mockPayloads: { cw1: { payment: { status: 'approved', amount: 50 } } },
        },
      });
      const node = makeNode({
        extractVariables: [
          { name: 'paymentStatus', jsonPath: '$.payment.status' },
          { name: 'paymentAmount', jsonPath: '$.payment.amount' },
        ],
      });
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(ctx.resolve('{{paymentStatus}}')).toBe('approved');
      expect(ctx.resolve('{{paymentAmount}}')).toBe('50');
    });

    it('does NOT auto-resume when loadTestMode is false', async () => {
      const store = makeMockStore({
        pause: vi.fn(() => Promise.resolve({ status: 'real' })),
      });
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: false, // explicitly false — config is ignored
        correlationWaitConfig: {
          mode: 'auto-resume',
          mockPayloads: { cw1: { status: 'mocked' } },
        },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should still call pause (normal behavior)
      expect(store.pause).toHaveBeenCalled();
      expect(states['cw1']?.state).toBe('pass');
      // Should use real webhook data, not mock
      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"real"}');
    });

    it('does NOT auto-resume when mode is wait-for-real', async () => {
      const store = makeMockStore({
        pause: vi.fn(() => Promise.resolve({ status: 'real' })),
      });
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: store,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'wait-for-real' },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should call pause (normal behavior)
      expect(store.pause).toHaveBeenCalled();
      expect(states['cw1']?.state).toBe('pass');
    });

    it('logs auto-resume mode message', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const log = vi.fn((line: { prefix: string; text: string }) => logLines.push(line));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: makeMockStore(),
        loadTestMode: true,
        log,
        correlationWaitConfig: { mode: 'auto-resume', mockPayloads: {} },
      });
      const node = makeNode();
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      expect(logLines.some(l => l.text.includes('Auto-resume mode'))).toBe(true);
    });

    it('falls back to node-level mockPayload when runner config does not have per-node payload', async () => {
      const ctx = new VariableContext({ paymentId: 'pay_123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        correlationStore: makeMockStore(),
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume' }, // No mockPayloads
      });
      const node = makeNode({
        loadTestBehavior: {
          mode: 'wait-for-real', // This mode is ignored, but mockPayload is used as fallback
          mockPayload: { status: 'from-node' },
        },
      });
      const passed = makePassedFlag();

      await handleCorrelationWaitNode('cw1', node, hCtx, passed);

      // Should use node-level mockPayload as fallback
      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"from-node"}');
    });
  });

});
