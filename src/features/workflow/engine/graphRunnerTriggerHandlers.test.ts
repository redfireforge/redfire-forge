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
import { handleStartNode, handleWebhookNode, handleScheduleNode, handleKafkaTriggerNode, matchesKafkaMessageFilters } from './graphRunnerTriggerHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  resetAllMocks();
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

// ── handleKafkaTriggerNode ──
describe('handleKafkaTriggerNode', () => {
  it('seeds kafka.trigger.* variables from a runtime message', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msg = {
      topic: 'orders',
      partition: 2,
      offset: '42',
      key: 'order-123',
      value: '{"orderId":"123","amount":99}',
      timestamp: '1700000000000',
    };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(msg));
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'my-cluster', topic: 'orders' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('kafka.trigger.topic')).toBe('orders');
    expect(ctx.get('kafka.trigger.partition')).toBe('2');
    expect(ctx.get('kafka.trigger.offset')).toBe('42');
    expect(ctx.get('kafka.trigger.key')).toBe('order-123');
    expect(ctx.get('kafka.trigger.value')).toBe('{"orderId":"123","amount":99}');
    expect(callbacks.onVariablesChange).toHaveBeenCalled();
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('seeds message headers as kafka.trigger.header.<name>', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msg = {
      topic: 't1',
      partition: 0,
      offset: '1',
      value: '{}',
      timestamp: '0',
      headers: { 'X-Correlation-Id': 'abc-123', 'Content-Type': 'application/json' },
    };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(msg));
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'c', topic: 't1' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('kafka.trigger.header.X-Correlation-Id')).toBe('abc-123');
    expect(ctx.get('kafka.trigger.header.Content-Type')).toBe('application/json');
  });

  it('runs user extractVariables from the message body', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msg = {
      topic: 't1',
      partition: 0,
      offset: '5',
      value: '{"order":{"id":"ABC","amount":50}}',
      timestamp: '0',
    };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(msg));
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 't1',
      extractVariables: [
        { name: 'orderId', jsonPath: '$.order.id' },
        { name: 'amount', jsonPath: '$.order.amount' },
      ],
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('orderId')).toBe('ABC');
    expect(ctx.get('amount')).toBe('50');
  });

  it('accepts a runtime message object (not a JSON string)', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msgObj = { topic: 'test', partition: 0, offset: '0', value: '{}', timestamp: '0' };
    ctx.set('__kafkaTriggerMessage', msgObj);
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'c', topic: 'test' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('kafka.trigger.topic')).toBe('test');
  });

  it('clears __kafkaTriggerMessage after use', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msg = { topic: 't', partition: 0, offset: '0', value: '{}', timestamp: '0' };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(msg));
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'c', topic: 't' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('__kafkaTriggerMessage')).toBeUndefined();
  });

  it('falls back to empty strings when no runtime message is present', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    // No __kafkaTriggerMessage in context (manual / design-time run)
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'c', topic: 'fallback-topic' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    // topic falls back to node config value
    expect(ctx.get('kafka.trigger.topic')).toBe('fallback-topic');
    // partition/offset/key/value are empty
    expect(ctx.get('kafka.trigger.partition')).toBe('');
    expect(ctx.get('kafka.trigger.offset')).toBe('');
    expect(ctx.get('kafka.trigger.key')).toBe('');
    expect(ctx.get('kafka.trigger.value')).toBe('');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('falls back gracefully when __kafkaTriggerMessage is invalid JSON', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    ctx.set('__kafkaTriggerMessage', 'not-json');
    const node = makeNode('kt1', 'kafkaTrigger', { clusterId: 'c', topic: 'my-topic' });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('kafka.trigger.topic')).toBe('my-topic');
    // __kafkaTriggerMessage is cleared even on parse failure
    expect(ctx.get('__kafkaTriggerMessage')).toBeUndefined();
  });

  it('skips extractVariables when message body is not JSON', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const msg = { topic: 't', partition: 0, offset: '0', value: 'plain text body', timestamp: '0' };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(msg));
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 't',
      extractVariables: [{ name: 'x', jsonPath: '$.x' }],
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('x')).toBeUndefined();
  });

  // ── Sample Payload (Quick Test) ──

  it('uses samplePayload when no runtime message is present', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'orders.created',
      samplePayload: '{"orderId": "ORD-001", "amount": 99.99}',
      sampleKey: 'ORD-001',
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('kafka.trigger.topic')).toBe('orders.created');
    expect(ctx.get('kafka.trigger.key')).toBe('ORD-001');
    expect(ctx.get('kafka.trigger.value')).toBe('{"orderId": "ORD-001", "amount": 99.99}');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('samplePayload seeds headers from sampleHeaders JSON', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'events',
      samplePayload: '{"event":"test"}',
      sampleHeaders: '{"X-Source": "test-runner", "X-Region": "us-east"}',
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('kafka.trigger.header.X-Source')).toBe('test-runner');
    expect(ctx.get('kafka.trigger.header.X-Region')).toBe('us-east');
  });

  it('ignores invalid sampleHeaders JSON gracefully', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'events',
      samplePayload: '{"event":"test"}',
      sampleHeaders: 'not-json',
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    // No headers should be seeded
    expect(ctx.get('kafka.trigger.header.X-Source')).toBeUndefined();
  });

  it('runtime message takes precedence over samplePayload', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const runtimeMsg = { topic: 'live-topic', partition: 5, offset: '100', key: 'live-key', value: '{"live":true}', timestamp: '0' };
    ctx.set('__kafkaTriggerMessage', JSON.stringify(runtimeMsg));
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'configured-topic',
      samplePayload: '{"sample":true}',
      sampleKey: 'sample-key',
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('kafka.trigger.topic')).toBe('live-topic');
    expect(ctx.get('kafka.trigger.key')).toBe('live-key');
    expect(ctx.get('kafka.trigger.value')).toBe('{"live":true}');
  });

  it('whitespace-only samplePayload falls through to dry-run', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'dry-topic',
      samplePayload: '   ',
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(states['kt1']?.state).toBe('pass');
    expect(ctx.get('kafka.trigger.topic')).toBe('dry-topic');
    expect(ctx.get('kafka.trigger.value')).toBe('');
  });

  it('samplePayload extracts variables via extractVariables', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('kt1', 'kafkaTrigger', {
      clusterId: 'c',
      topic: 'orders',
      samplePayload: '{"orderId":"ORD-X","amount":55}',
      extractVariables: [
        { name: 'orderId', jsonPath: '$.orderId' },
        { name: 'orderAmount', jsonPath: '$.amount' },
      ],
    });

    await handleKafkaTriggerNode('kt1', node, hCtx);

    expect(ctx.get('orderId')).toBe('ORD-X');
    expect(ctx.get('orderAmount')).toBe('55');
  });
});

// ── matchesKafkaMessageFilters ──
describe('matchesKafkaMessageFilters', () => {
  const baseMsg = {
    topic: 'orders',
    partition: 0,
    offset: '1',
    timestamp: '0',
    key: 'order-abc',
    value: '{"status":"new","amount":100}',
    headers: { 'X-Env': 'production' },
  };

  it('returns true when no filters are specified', () => {
    expect(matchesKafkaMessageFilters(baseMsg)).toBe(true);
  });

  it('returns true when keyRegex matches', () => {
    expect(matchesKafkaMessageFilters(baseMsg, '^order-')).toBe(true);
  });

  it('returns false when keyRegex does not match', () => {
    expect(matchesKafkaMessageFilters(baseMsg, '^invoice-')).toBe(false);
  });

  it('skips an invalid keyRegex rather than throwing', () => {
    expect(matchesKafkaMessageFilters(baseMsg, '[')).toBe(true);
  });

  it('returns true when header filter matches', () => {
    const filters = [{ id: '1', key: 'X-Env', value: 'production', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, filters)).toBe(true);
  });

  it('returns false when header value does not match', () => {
    const filters = [{ id: '1', key: 'X-Env', value: 'staging', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, filters)).toBe(false);
  });

  it('returns false when expected header is absent', () => {
    const filters = [{ id: '1', key: 'X-Missing', value: 'anything', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, filters)).toBe(false);
  });

  it('skips disabled header filters', () => {
    const filters = [{ id: '1', key: 'X-Env', value: 'staging', enabled: false }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, filters)).toBe(true);
  });

  it('returns true when jsonPath filter matches with expected value', () => {
    const filters = [{ id: '1', jsonPath: '$.status', expectedValue: 'new', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(true);
  });

  it('returns false when jsonPath resolves to wrong value', () => {
    const filters = [{ id: '1', jsonPath: '$.status', expectedValue: 'fulfilled', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(false);
  });

  it('returns false when jsonPath does not exist in body', () => {
    const filters = [{ id: '1', jsonPath: '$.nonExistent', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(false);
  });

  it('returns true when jsonPath exists and no expectedValue is set', () => {
    const filters = [{ id: '1', jsonPath: '$.amount', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(true);
  });

  it('returns false for jsonPath filter when message body is not JSON', () => {
    const nonJsonMsg = { ...baseMsg, value: 'plain text' };
    const filters = [{ id: '1', jsonPath: '$.status', expectedValue: 'new', enabled: true }];
    expect(matchesKafkaMessageFilters(nonJsonMsg, undefined, undefined, filters)).toBe(false);
  });

  it('skips disabled jsonPath filters', () => {
    const filters = [{ id: '1', jsonPath: '$.nonExistent', enabled: false }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(true);
  });

  it('combines all filter types (all pass)', () => {
    const headerFilters = [{ id: '1', key: 'X-Env', value: 'production', enabled: true }];
    const jsonFilters = [{ id: '2', jsonPath: '$.status', expectedValue: 'new', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, '^order-', headerFilters, jsonFilters)).toBe(true);
  });

  it('returns false when one filter in a combined set fails', () => {
    const headerFilters = [{ id: '1', key: 'X-Env', value: 'production', enabled: true }];
    const jsonFilters = [{ id: '2', jsonPath: '$.status', expectedValue: 'fulfilled', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, '^order-', headerFilters, jsonFilters)).toBe(false);
  });

  it('handles missing message key gracefully in keyRegex check', () => {
    const noKeyMsg = { ...baseMsg, key: undefined };
    // regex matches empty string
    expect(matchesKafkaMessageFilters(noKeyMsg, '^$')).toBe(true);
    // regex does not match empty string
    expect(matchesKafkaMessageFilters(noKeyMsg, '^order-')).toBe(false);
  });

  it('trims whitespace from header filter key before lookup', () => {
    const filters = [{ id: '1', key: '  X-Env  ', value: 'production', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, filters)).toBe(true);
  });

  it('trims whitespace from jsonPath before lookup', () => {
    const filters = [{ id: '1', jsonPath: '  $.status  ', expectedValue: 'new', enabled: true }];
    expect(matchesKafkaMessageFilters(baseMsg, undefined, undefined, filters)).toBe(true);
  });
});
