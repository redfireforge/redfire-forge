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

import { handleDelayNode } from './graphRunnerNodeHandlers';
import { handleStartNode, handleWebhookNode, handleScheduleNode } from './graphRunnerTriggerHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleDelayNode', () => {
  it('delays for specified duration', async () => {
    vi.useFakeTimers();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('d1', 'delay', { delayMs: 100, mode: 'fixed' });

    const promise = handleDelayNode('d1', node, hCtx);
    vi.advanceTimersByTime(100);
    await promise;

    expect(states['d1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('resolves immediately when abort signal fires', async () => {
    const controller = new AbortController();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, abortSignal: controller.signal });
    const node = makeNode('d1', 'delay', { delayMs: 999999, mode: 'fixed' });

    const promise = handleDelayNode('d1', node, hCtx);
    controller.abort();
    await promise;
    // Should resolve without waiting the full delay
  });

  it('uses random delay in random mode', async () => {
    vi.useFakeTimers();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('d1', 'delay', { delayMs: 200, mode: 'random', minMs: 50, maxMs: 150 });

    const promise = handleDelayNode('d1', node, hCtx);
    vi.advanceTimersByTime(200);
    await promise;
    vi.useRealTimers();
  });
});

// ── handleStartNode ──
describe('handleStartNode', () => {
  it('seeds input variables into context', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('s1', 'start', {
      inputVariables: { baseUrl: 'https://api.test.com', token: 'abc123' },
    });

    await handleStartNode('s1', node, hCtx);

    expect(states['s1']?.state).toBe('pass');
    expect(ctx.resolve('{{baseUrl}}')).toBe('https://api.test.com');
    expect(ctx.resolve('{{token}}')).toBe('abc123');
    expect(callbacks.onVariablesChange).toHaveBeenCalled();
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('handles start node without input variables', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('s1', 'start', {});

    await handleStartNode('s1', node, hCtx);
    expect(states['s1']?.state).toBe('pass');
    expect(callbacks.onVariablesChange).not.toHaveBeenCalled();
  });

  it('start node with empty inputVariables object still notifies variable subscribers', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('s1', 'start', { inputVariables: {} });
    await handleStartNode('s1', node, hCtx);
    expect(states['s1']?.state).toBe('pass');
    expect(callbacks.onVariablesChange).toHaveBeenCalled();
  });
});

// ── handleWebhookNode ──
describe('handleWebhookNode', () => {
  it('extracts variables from sample payload', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      samplePayload: '{"event":"push","data":{"id":42}}',
      extractVariables: [
        { name: 'eventType', jsonPath: '$.event' },
        { name: 'dataId', jsonPath: '$.data.id' },
      ],
    });

    await handleWebhookNode('w1', node, hCtx);

    expect(ctx.resolve('{{eventType}}')).toBe('push');
    expect(ctx.resolve('{{dataId}}')).toBe('42');
    expect(states['w1']?.state).toBe('pass');
  });

  it('handles invalid JSON payload gracefully', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      samplePayload: 'not-json',
      extractVariables: [{ name: 'x', jsonPath: '$.x' }],
    });

    await handleWebhookNode('w1', node, hCtx);
    expect(states['w1']?.state).toBe('pass');
    expect(ctx.get('__webhookInput')).toBe('{}');
  });

  it('handles missing extractVariables', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('w1', 'webhook', {});

    await handleWebhookNode('w1', node, hCtx);
    expect(states['w1']?.state).toBe('pass');
  });

  it('stores webhook input in context for trace capture', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'POST',
      path: '/api/orders',
      samplePayload: '{"orderId":"123","amount":99.99}',
    });

    await handleWebhookNode('w1', node, hCtx);

    // Check that the webhook input is stored in context
    expect(ctx.get('__webhookInput')).toBe('{"orderId":"123","amount":99.99}');
    expect(ctx.get('__webhookMethod')).toBe('POST');
    expect(ctx.get('__webhookPath')).toBe('/api/orders');
  });

  it('uses runtime payload when __webhookPayload is set', async () => {
    const ctx = makeCtx();
    ctx.set('__webhookPayload', '{"runtime":"payload"}');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'POST',
      path: '/api/orders',
      samplePayload: '{"sample":"data"}',
    });

    await handleWebhookNode('w1', node, hCtx);

    // Should use the runtime payload, not sample
    expect(ctx.get('__webhookInput')).toBe('{"runtime":"payload"}');
    // Runtime __webhookPayload should be cleared
    expect(ctx.get('__webhookPayload')).toBeUndefined();
  });

  it('uses runtime payload object without JSON parse', async () => {
    const ctx = makeCtx();
    ctx.set('__webhookPayload', { runtime: 1 });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'POST',
      path: '/hook',
      samplePayload: '{"sample":"data"}',
    });
    await handleWebhookNode('w1', node, hCtx);
    expect(ctx.get('__webhookInput')).toBe('{"runtime":1}');
    expect(ctx.get('__webhookPayload')).toBeUndefined();
  });

  it('falls back to sample when runtime payload string is invalid JSON', async () => {
    const ctx = makeCtx();
    ctx.set('__webhookPayload', 'not-json');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'POST',
      path: '/hook',
      samplePayload: '{"from":"sample"}',
    });
    await handleWebhookNode('w1', node, hCtx);
    expect(ctx.get('__webhookInput')).toBe('{"from":"sample"}');
  });

  it('falls back to empty object when runtime invalid and sample payload blank', async () => {
    const ctx = makeCtx();
    ctx.set('__webhookPayload', 'not-json');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'POST',
      path: '/hook',
      samplePayload: '',
    });
    await handleWebhookNode('w1', node, hCtx);
    expect(ctx.get('__webhookInput')).toBe('{}');
  });

  it('omits extractVariables when list empty', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      samplePayload: '{"x":1}',
      extractVariables: [],
    });
    await handleWebhookNode('w1', node, hCtx);
    expect(callbacks.onVariablesChange).toHaveBeenCalled();
  });

  it('uses only sample payload when no runtime and no extractVariables config', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('w1', 'webhook', {
      method: 'GET',
      path: '/ping',
      samplePayload: '{"only":"sample"}',
    });
    await handleWebhookNode('w1', node, hCtx);
    expect(ctx.get('__webhookInput')).toBe('{"only":"sample"}');
  });
});

// ── handleScheduleNode ──
describe('handleScheduleNode', () => {
  it('sets trigger time variables', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sc1', 'schedule', {});

    await handleScheduleNode('sc1', node, hCtx);

    expect(states['sc1']?.state).toBe('pass');
    expect(ctx.resolve('{{triggerTime}}')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ctx.resolve('{{triggerTimestamp}}')).toMatch(/^\d+$/);
    expect(ctx.resolve('{{triggerDate}}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('seeds configured input variables', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sc1', 'schedule', {
      inputVariables: { env: 'staging' },
    });

    await handleScheduleNode('sc1', node, hCtx);
    expect(ctx.resolve('{{env}}')).toBe('staging');
  });

  it('runs schedule trigger without optional inputVariables', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sc1', 'schedule', {});
    await handleScheduleNode('sc1', node, hCtx);
    expect(states['sc1']?.state).toBe('pass');
    expect(ctx.resolve('{{triggerDate}}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
