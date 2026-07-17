import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));
vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));
vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import { handleCorrelationWaitNode } from './graphRunnerCorrelationWaitHandler';
import {
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';
import type { ICorrelationStore } from './correlationStore';


// ── Mock correlation store factory ────────────────────────────────────────────

function makeCorrelationStore(overrides: Partial<ICorrelationStore> = {}): ICorrelationStore {
  return {
    pause: vi.fn(),
    resume: vi.fn().mockReturnValue(true),
    isPaused: vi.fn().mockReturnValue(false),
    cancel: vi.fn().mockReturnValue(true),
    get: vi.fn().mockReturnValue(undefined),
    cleanup: vi.fn().mockReturnValue(0),
    listPaused: vi.fn().mockReturnValue([]),
    size: 0,
    ...overrides,
  };
}

function makeResumeData(data: Record<string, unknown> = {}): Record<string, unknown> {
  return { event: 'test', value: 42, ...data };
}

beforeEach(() => {
  resetAllMocks();
});

// ── handleCorrelationWaitNode ─────────────────────────────────────────────────

describe('handleCorrelationWaitNode', () => {
  describe('correlation ID resolution', () => {
    it('fails when correlationIdExpression resolves to empty string', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ empty: '' });
      const hCtx = makeHandlerContext({ callbacks, ctx });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: '{{empty}}',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toContain('empty string');
    });

    it('resolves literal correlation ID from expression', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(makeResumeData()),
      });
      const ctx = makeCtx({ orderId: 'ord-999' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: '{{orderId}}',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'ord-999',
        '/hook',
        expect.any(Object),
        5000,
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('auto-resume mode', () => {
    it('skips wait and injects mock payload in auto-resume mode', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume' },
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: '{{orderId}}',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(states['cw1']?.state).toBe('pass');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('cw1', 'main');
      // No correlation store needed in auto-resume mode
    });

    it('seeds webhook.body and __cwWaitDurationMs on auto-resume', async () => {
      const ctx = makeCtx({ orderId: 'ord-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume', mockPayloads: { cw1: { foo: 'bar' } } },
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-123',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(ctx.get('webhook.body')).toBeTruthy();
      expect(ctx.get('webhook.correlationId')).toBe('ord-123');
      expect(ctx.get('__cwWaitDurationMs')).toBeTruthy();
    });
  });

  describe('synthetic inject mode (inline, no store)', () => {
    it('waits the configured delay then injects mock payload', async () => {
      vi.useFakeTimers();
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject', syntheticDelayMs: 50 },
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-123',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const p = handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      vi.advanceTimersByTime(100);
      await p;
      expect(states['cw1']?.state).toBe('pass');
      vi.useRealTimers();
    });

    it('fails if aborted during synthetic delay', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject', syntheticDelayMs: 10000 },
        abortSignal: controller.signal,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-123',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const p = handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      controller.abort();
      vi.advanceTimersByTime(100);
      await p;
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('Aborted');
      vi.useRealTimers();
    });
  });

  describe('synthetic inject mode (with store)', () => {
    it('pauses in store and resolves on resume', async () => {
      const webhookData = makeResumeData({ synthetic: true });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(webhookData),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
        correlationStore: store,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-123',
        webhookPath: '/hook/callback',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(states['cw1']?.state).toBe('pass');
      // Handler appends unique suffix in synthetic-inject mode; verify topic routing
      expect(store.pause).toHaveBeenCalledWith(
        expect.stringContaining('ord-123'), '/hook/callback', expect.any(Object), 5000, undefined,
      );
    });

    it('calls cancel and reports aborted state when abort fires during synthetic-inject store wait', async () => {
      const controller = new AbortController();
      controller.abort();
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(new Error('Workflow run aborted')),
        cancel: vi.fn().mockReturnValue(true),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-abort-si' });
      const hCtx = makeHandlerContext({
        callbacks, ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
        correlationStore: store,
        abortSignal: controller.signal,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-abort-si',
        webhookPath: '/hook/callback',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('Aborted');
      expect(store.cancel).toHaveBeenCalledWith(expect.stringContaining('ord-abort-si'));
    });

    it('calls cancel and marks passed=false on store error during synthetic-inject', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(new Error('Synthetic inject timeout')),
        cancel: vi.fn().mockReturnValue(false),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-err-si' });
      const hCtx = makeHandlerContext({
        callbacks, ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
        correlationStore: store,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-err-si',
        webhookPath: '/hook/callback',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toContain('Synthetic inject timeout');
      expect(store.cancel).toHaveBeenCalledWith(expect.stringContaining('ord-err-si'));
    });
  });

  describe('wait-for-real mode', () => {
    it('fails if no correlation store available', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-123' });
      const hCtx = makeHandlerContext({ callbacks, ctx });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-123',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toContain('No correlation store');
    });

    it('pauses, then resumes and seeds webhook.* context on success', async () => {
      const webhookData = makeResumeData({ payload: 'hello' });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(webhookData),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-456' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        correlationStore: store,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-456',
        webhookPath: '/callbacks/order',
        timeoutMs: 10000,
        correlationSource: 'body',
        correlationJsonPath: '$.correlationId',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(states['cw1']?.state).toBe('pass');
      expect(ctx.get('webhook.correlationId')).toBe('ord-456');
      expect(ctx.get('webhook.body')).toContain('payload');
      expect(ctx.get('__cwWaitDurationMs')).toBeTruthy();
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('cw1', 'main');
    });

    it('extracts user-configured variables on resume', async () => {
      const webhookData = { orderId: 'ord-789', status: 'shipped' };
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(webhookData),
      });
      const ctx = makeCtx({ orderId: 'ord-789' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-789',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
        extractVariables: [{ name: 'orderStatus', jsonPath: '$.status' }],
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(ctx.get('orderStatus')).toBe('shipped');
    });

    it('marks passed=false and calls cancel on store error (timeout)', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(new Error('Correlation timeout: no webhook received within 1000ms')),
        cancel: vi.fn().mockReturnValue(false), // already removed by timeout
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-timeout' });
      const passed = makePassedFlag();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-timeout',
        webhookPath: '/hook',
        timeoutMs: 1000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toContain('timeout');
      expect(store.cancel).toHaveBeenCalledWith('ord-timeout');
    });

    it('reports aborted state when abort signal fires', async () => {
      const controller = new AbortController();
      controller.abort(); // pre-aborted
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(new Error('Workflow run aborted')),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'ord-abort' });
      const hCtx = makeHandlerContext({
        callbacks, ctx, correlationStore: store,
        abortSignal: controller.signal,
      });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ord-abort',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleCorrelationWaitNode('cw1', node, hCtx, passed);
      expect(states['cw1']?.state).toBe('fail');
      expect(states['cw1']?.error).toBe('Aborted');
    });

    it('uses unique correlation ID per load-test iteration in synthetic-inject', async () => {
      const capturedIds: string[] = [];
      const store = makeCorrelationStore({
        pause: vi.fn().mockImplementation((cId: string) => {
          capturedIds.push(cId);
          return Promise.resolve(makeResumeData());
        }),
      });
      const { callbacks } = makeCallbacks();
      for (let i = 0; i < 2; i++) {
        const ctx = makeCtx({ orderId: 'ord-shared' });
        const hCtx = makeHandlerContext({
          callbacks,
          ctx,
          loadTestMode: true,
          correlationWaitConfig: { mode: 'synthetic-inject' },
          correlationStore: store,
        });
        const node = makeNode('cw1', 'correlationWait', {
          correlationIdExpression: 'ord-shared',
          webhookPath: '/hook',
          timeoutMs: 5000,
          correlationSource: 'body',
        });
        await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      }
      // Both iterations should have different correlation IDs (unique suffix added)
      expect(capturedIds.length).toBe(2);
      expect(capturedIds[0]).not.toBe(capturedIds[1]);
    });
  });

  describe('correlation config forwarding', () => {
    it('passes header correlationSource config to store', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(makeResumeData()),
      });
      const ctx = makeCtx({ refId: 'ref-001' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'ref-001',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'header',
        correlationHeader: 'X-Request-Id',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'ref-001', '/hook', expect.any(Object), 5000, undefined,
        expect.objectContaining({ correlationSource: 'header', correlationHeader: 'X-Request-Id' }),
      );
    });

    it('seeds __cwWebhookPayload on wait-for-real resume', async () => {
      const webhookData = { result: 'ok' };
      const store = makeCorrelationStore({ pause: vi.fn().mockResolvedValue(webhookData) });
      const ctx = makeCtx({ id: 'test-id' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('cw1', 'correlationWait', {
        correlationIdExpression: 'test-id',
        webhookPath: '/hook',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleCorrelationWaitNode('cw1', node, hCtx, makePassedFlag());
      const payload = ctx.get('__cwWebhookPayload');
      expect(payload).toBeTruthy();
      expect(JSON.parse(payload!)).toEqual(webhookData);
    });
  });
});
