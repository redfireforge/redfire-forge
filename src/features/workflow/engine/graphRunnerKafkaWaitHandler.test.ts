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

import { handleKafkaWaitNode } from './graphRunnerKafkaWaitHandler';
import {
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';
import type { ICorrelationStore } from './correlationStore';
import type { KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';

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

function makeMockKafkaMessage(overrides: Partial<KafkaConsumedMessage> = {}): KafkaConsumedMessage {
  return {
    topic:     'orders',
    partition: 0,
    offset:    '42',
    timestamp: '2024-01-01T00:00:00Z',
    key:       'order-123',
    value:     JSON.stringify({ orderId: 'order-123', status: 'placed' }),
    headers:   { 'X-Request-Id': 'req-001', 'X-Source': 'svc-a' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── handleKafkaWaitNode ───────────────────────────────────────────────────────

describe('handleKafkaWaitNode', () => {
  describe('correlation ID resolution', () => {
    it('fails when correlationIdExpression resolves to empty string', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ empty: '' });
      const hCtx = makeHandlerContext({ callbacks, ctx });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: '{{empty}}',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleKafkaWaitNode('kw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['kw1']?.state).toBe('fail');
      expect(states['kw1']?.error).toContain('empty string');
    });

    it('resolves correlation ID from variable expression', async () => {
      const kafkaMsg = makeMockKafkaMessage();
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: '{{orderId}}',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
        correlationJsonPath: '$.orderId',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'order-123',
        'orders', // topic used as webhookPath
        expect.any(Object),
        5000,
        undefined,
        expect.objectContaining({ correlationSource: 'body' }),
      );
    });
  });

  describe('auto-resume mode', () => {
    it('skips wait and injects mock Kafka message', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume' },
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: '{{orderId}}',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(states['kw1']?.state).toBe('pass');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('kw1', 'main');
    });

    it('seeds kafka.wait.* context keys with defaults when no mock override', async () => {
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume' },
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(ctx.get('kafka.wait.topic')).toBe('orders');
      expect(ctx.get('kafka.wait.partition')).toBe('0');
      expect(ctx.get('kafka.wait.offset')).toBe('0');
      expect(ctx.get('kafka.wait.correlationId')).toBe('order-123');
      expect(ctx.get('__kwWaitDurationMs')).toBeTruthy();
      expect(ctx.get('__kwOutcome')).toBe('matched');
    });

    it('uses node-level mock payload via runner config mockPayloads', async () => {
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: {
          mode: 'auto-resume',
          mockPayloads: { kw1: { topic: 'custom-topic', value: '{"custom":true}', partition: 3 } },
        },
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(ctx.get('kafka.wait.topic')).toBe('custom-topic');
      expect(ctx.get('kafka.wait.partition')).toBe('3');
    });
  });

  describe('synthetic inject mode (inline, no store)', () => {
    it('waits configured delay then injects mock message', async () => {
      vi.useFakeTimers();
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject', syntheticDelayMs: 50 },
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const p = handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      vi.advanceTimersByTime(100);
      await p;
      expect(states['kw1']?.state).toBe('pass');
      expect(ctx.get('__kwOutcome')).toBe('matched');
      vi.useRealTimers();
    });

    it('fails if aborted during inline synthetic delay', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject', syntheticDelayMs: 10000 },
        abortSignal: controller.signal,
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const p = handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      controller.abort();
      vi.advanceTimersByTime(100);
      await p;
      expect(states['kw1']?.state).toBe('fail');
      expect(states['kw1']?.error).toBe('Aborted');
      expect(ctx.get('__kwOutcome')).toBe('cancelled');
      vi.useRealTimers();
    });
  });

  describe('synthetic inject mode (with store)', () => {
    it('pauses in store and resolves when store resolves', async () => {
      const kafkaMsg = makeMockKafkaMessage({ topic: 'orders' });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'synthetic-inject' },
        correlationStore: store,
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(states['kw1']?.state).toBe('pass');
      expect(store.pause).toHaveBeenCalled();
      expect(ctx.get('__kwOutcome')).toBe('matched');
    });

    it('makes correlation ID unique per iteration in synthetic-inject', async () => {
      const capturedIds: string[] = [];
      const store = makeCorrelationStore({
        pause: vi.fn().mockImplementation((cId: string) => {
          capturedIds.push(cId);
          return Promise.resolve(makeMockKafkaMessage() as unknown as Record<string, unknown>);
        }),
      });
      const { callbacks } = makeCallbacks();
      for (let i = 0; i < 2; i++) {
        const ctx = makeCtx({ orderId: 'shared-order' });
        const hCtx = makeHandlerContext({
          callbacks,
          ctx,
          loadTestMode: true,
          correlationWaitConfig: { mode: 'synthetic-inject' },
          correlationStore: store,
        });
        const node = makeNode('kw1', 'kafkaWait', {
          correlationIdExpression: 'shared-order',
          topic: 'orders',
          clusterId: 'cluster-1',
          timeoutMs: 5000,
          correlationSource: 'body',
        });
        await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      }
      expect(capturedIds.length).toBe(2);
      expect(capturedIds[0]).not.toBe(capturedIds[1]);
    });
  });

  describe('wait-for-real mode', () => {
    it('fails if no correlation store available', async () => {
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({ callbacks, ctx });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleKafkaWaitNode('kw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['kw1']?.state).toBe('fail');
      expect(states['kw1']?.error).toContain('No correlation store');
    });

    it('pauses on topic, then seeds kafka.wait.* keys on resume', async () => {
      const kafkaMsg = makeMockKafkaMessage();
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-123' });
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 10000,
        correlationSource: 'body',
        correlationJsonPath: '$.orderId',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());

      expect(states['kw1']?.state).toBe('pass');
      expect(ctx.get('kafka.wait.topic')).toBe('orders');
      expect(ctx.get('kafka.wait.partition')).toBe('0');
      expect(ctx.get('kafka.wait.offset')).toBe('42');
      expect(ctx.get('kafka.wait.key')).toBe('order-123');
      expect(ctx.get('kafka.wait.value')).toContain('orderId');
      expect(ctx.get('kafka.wait.correlationId')).toBe('order-123');
      expect(ctx.get('__kwWaitDurationMs')).toBeTruthy();
      expect(ctx.get('__kwOutcome')).toBe('matched');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('kw1', 'main');
    });

    it('seeds kafka.wait.header.* for each header in resume message', async () => {
      const kafkaMsg = makeMockKafkaMessage({
        headers: { 'X-Request-Id': 'req-abc', 'X-Source': 'producer-1' },
      });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-h1' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-h1',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'header',
        correlationHeader: 'X-Request-Id',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(ctx.get('kafka.wait.header.X-Request-Id')).toBe('req-abc');
      expect(ctx.get('kafka.wait.header.X-Source')).toBe('producer-1');
    });

    it('seeds __kwResumeData with full message JSON on resume', async () => {
      const kafkaMsg = makeMockKafkaMessage();
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      const raw = ctx.get('__kwResumeData');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.topic).toBe('orders');
    });

    it('extracts user-configured variables from message body', async () => {
      const kafkaMsg = makeMockKafkaMessage({
        value: JSON.stringify({ orderId: 'order-123', status: 'confirmed', amount: 99 }),
      });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
        extractVariables: [
          { name: 'orderStatus', jsonPath: '$.status' },
          { name: 'orderAmount', jsonPath: '$.amount' },
        ],
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(ctx.get('orderStatus')).toBe('confirmed');
      expect(ctx.get('orderAmount')).toBe('99');
    });

    it('skips extractVariables gracefully when value is not JSON', async () => {
      const kafkaMsg = makeMockKafkaMessage({ value: 'plain-text-value' });
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(kafkaMsg as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-plain' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-plain',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
        extractVariables: [{ name: 'orderStatus', jsonPath: '$.status' }],
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      // Should still pass even though extract found nothing
      expect(states['kw1']?.state).toBe('pass');
      expect(ctx.get('orderStatus')).toBeUndefined();
    });

    it('marks passed=false and calls cancel on timeout error', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(
          new Error('Correlation timeout: no webhook received within 5000ms for "order-timeout"'),
        ),
        cancel: vi.fn().mockReturnValue(false),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-timeout' });
      const passed = makePassedFlag();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-timeout',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, passed);
      expect(passed.value).toBe(false);
      expect(states['kw1']?.state).toBe('fail');
      expect(states['kw1']?.error).toContain('timeout');
      expect(ctx.get('__kwOutcome')).toBe('timed_out');
      expect(store.cancel).toHaveBeenCalledWith('order-timeout');
    });

    it('reports aborted state when pre-aborted signal fires', async () => {
      const controller = new AbortController();
      controller.abort();
      const store = makeCorrelationStore({
        pause: vi.fn().mockRejectedValue(new Error('Workflow run aborted')),
        cancel: vi.fn().mockReturnValue(true),
      });
      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx({ orderId: 'order-abort' });
      const hCtx = makeHandlerContext({
        callbacks, ctx, correlationStore: store,
        abortSignal: controller.signal,
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-abort',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      const passed = makePassedFlag();
      await handleKafkaWaitNode('kw1', node, hCtx, passed);
      expect(states['kw1']?.state).toBe('fail');
      expect(states['kw1']?.error).toBe('Aborted');
      expect(ctx.get('__kwOutcome')).toBe('cancelled');
      expect(store.cancel).toHaveBeenCalledWith('order-abort');
    });
  });

  describe('correlation config forwarding', () => {
    it('passes body correlationSource and jsonPath to store', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(makeMockKafkaMessage() as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ orderId: 'order-123' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-123',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
        correlationJsonPath: '$.orderId',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'order-123', 'orders', expect.any(Object), 5000, undefined,
        expect.objectContaining({ correlationSource: 'body', correlationJsonPath: '$.orderId' }),
      );
    });

    it('passes header correlationSource and header name to store', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(makeMockKafkaMessage() as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ reqId: 'req-001' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'req-001',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'header',
        correlationHeader: 'X-Correlation-Id',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'req-001', 'orders', expect.any(Object), 5000, undefined,
        expect.objectContaining({ correlationSource: 'header', correlationHeader: 'X-Correlation-Id' }),
      );
    });

    it('passes key correlationSource to store', async () => {
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(
          makeMockKafkaMessage({ key: 'order-k1' }) as unknown as Record<string, unknown>,
        ),
      });
      const ctx = makeCtx({ orderId: 'order-k1' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-k1',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'key',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'order-k1', 'orders', expect.any(Object), 5000, undefined,
        expect.objectContaining({ correlationSource: 'key' }),
      );
    });

    it('falls back to body correlationSource for unrecognized correlationSource values (default branch)', async () => {
      // Tests the `default:` case in buildKafkaCorrelationConfig
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(makeMockKafkaMessage() as unknown as Record<string, unknown>),
      });
      const ctx = makeCtx({ someId: 'val-1' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'val-1',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'unknown-source' as unknown as 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());
      expect(store.pause).toHaveBeenCalledWith(
        'val-1', 'orders', expect.any(Object), 5000, undefined,
        expect.objectContaining({ correlationSource: 'body' }),
      );
    });
  });

  // ── injectKafkaWaitPayload — sparse message covers ?? '' null branches ────

  describe('injectKafkaWaitPayload null-field branches', () => {
    it('seeds kafka.wait.* to empty strings when resume message has no fields', async () => {
      // Sends a message with all fields omitted to hit the `?? ''` branches in injectKafkaWaitPayload
      const sparseMessage = {} as unknown as Record<string, unknown>;
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(sparseMessage),
      });
      const ctx = makeCtx({ orderId: 'order-sparse' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'order-sparse',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());

      expect(ctx.get('kafka.wait.topic')).toBe('');
      expect(ctx.get('kafka.wait.key')).toBe('');
      expect(ctx.get('kafka.wait.value')).toBe('');
      expect(ctx.get('kafka.wait.partition')).toBe('');
      expect(ctx.get('kafka.wait.offset')).toBe('');
    });

    it('skips header seeding when resume message has no headers object', async () => {
      // message.headers is undefined → the `if (message.headers && typeof message.headers === 'object')` branch is false
      const messageNoHeaders = {
        topic: 'orders',
        partition: 0,
        offset: '1',
        key: 'k1',
        value: '{"orderId":"k1"}',
        // headers intentionally omitted
      } as unknown as Record<string, unknown>;
      const store = makeCorrelationStore({
        pause: vi.fn().mockResolvedValue(messageNoHeaders),
      });
      const ctx = makeCtx({ orderId: 'k1' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, ctx, correlationStore: store });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'k1',
        topic: 'orders',
        clusterId: 'cluster-1',
        timeoutMs: 5000,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());

      // No header keys should be set
      expect(ctx.get('kafka.wait.header.X-Request-Id')).toBeUndefined();
      expect(ctx.get('kafka.wait.topic')).toBe('orders');
    });

    it('buildMockKafkaMessage uses no-behavior path when no mock payloads are configured', async () => {
      // auto-resume with no mockPayloads → buildMockKafkaMessage returns topic-seeded defaults
      const ctx = makeCtx({ orderId: 'o-99' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        ctx,
        loadTestMode: true,
        correlationWaitConfig: { mode: 'auto-resume', mockPayloads: undefined },
      });
      const node = makeNode('kw1', 'kafkaWait', {
        correlationIdExpression: 'o-99',
        topic: 'inventory.events',
        clusterId: 'cluster-1',
        timeoutMs: 0,
        correlationSource: 'body',
      });
      await handleKafkaWaitNode('kw1', node, hCtx, makePassedFlag());

      // topic should be seeded from the node's topic field
      expect(ctx.get('kafka.wait.topic')).toBe('inventory.events');
    });
  });
});
