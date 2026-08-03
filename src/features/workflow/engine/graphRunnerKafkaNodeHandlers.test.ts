/**
 * Tests for Kafka node handlers (produce and consume).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKafkaProduceNode, handleKafkaConsumeNode, getKafkaSourceValue } from './graphRunnerKafkaNodeHandlers';
import type { KafkaProduceNodeData, KafkaConsumeNodeData } from '../types/workflow';
import type { KafkaNodeOperations, KafkaProduceResult, KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

function mockKafkaOps(overrides: Partial<KafkaNodeOperations> = {}): KafkaNodeOperations {
  return {
    produce: vi.fn<KafkaNodeOperations['produce']>().mockResolvedValue({
      topic: 'test-topic',
      partition: 0,
      offset: '42',
      timestamp: '1700000000000',
      key: 'k1',
    }),
    consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([]),
    ...overrides,
  };
}

function produceNode(id: string, data: Partial<KafkaProduceNodeData> = {}) {
  return makeNode(id, 'kafkaProduce', {
    label: 'Produce',
    clusterId: 'c1',
    topic: 'test-topic',
    bodyTemplate: '{"msg": "hello"}',
    ...data,
  });
}

function consumeNode(id: string, data: Partial<KafkaConsumeNodeData> = {}) {
  return makeNode(id, 'kafkaConsume', {
    label: 'Consume',
    clusterId: 'c1',
    topic: 'test-topic',
    ...data,
  });
}

describe('handleKafkaProduceNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('produces a message and advances the graph', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(ops.produce).toHaveBeenCalledOnce();
    expect(ops.produce).toHaveBeenCalledWith(expect.objectContaining({
      clusterId: 'c1',
      topic: 'test-topic',
      value: '{"msg": "hello"}',
    }));
    expect(passed.value).toBe(true);
    expect(cbResult.states['p1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('p1', 'main');
  });

  it('resolves template variables in topic, key, body, and headers', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      initialVariables: { env: 'prod', orderId: '123' },
    });
    const passed = makePassedFlag();
    const node = produceNode('p1', {
      topic: '{{env}}-orders',
      keyTemplate: 'order-{{orderId}}',
      bodyTemplate: '{"id": "{{orderId}}"}',
      headers: [
        { id: 'h1', key: 'X-Env', value: '{{env}}', enabled: true },
        { id: 'h2', key: 'X-Disabled', value: 'nope', enabled: false },
      ],
    });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(ops.produce).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'prod-orders',
      key: 'order-123',
      value: '{"id": "123"}',
      headers: { 'X-Env': 'prod' },
    }));
    expect(passed.value).toBe(true);
  });

  it('writes output bindings from produce result', async () => {
    const result: KafkaProduceResult = {
      topic: 'orders',
      partition: 2,
      offset: '100',
      timestamp: '1700000000000',
      key: 'k1',
    };
    const ops = mockKafkaOps({ produce: vi.fn<KafkaNodeOperations['produce']>().mockResolvedValue(result) });
    const passed = makePassedFlag();
    const node = produceNode('p1', {
      outputBindings: [
        { id: 'b1', source: 'partition', targetVariable: 'outPart', enabled: true },
        { id: 'b2', source: 'offset', targetVariable: 'outOff', enabled: true },
        { id: 'b3', source: 'key', targetVariable: 'skip', enabled: false },
      ],
    });

    const logSpy = vi.fn();
    const hCtxWithLog = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops, log: logSpy });
    await handleKafkaProduceNode('p1', node, hCtxWithLog, passed);

    expect(hCtxWithLog.ctx.get('outPart')).toBe('2');
    expect(hCtxWithLog.ctx.get('outOff')).toBe('100');
    expect(hCtxWithLog.ctx.get('skip')).toBeUndefined();

    // Per-binding log lines: "source → targetVariable = value"
    const logs = logSpy.mock.calls.map((c: [{ text: string }]) => c[0].text);
    expect(logs.some((l) => l.includes('partition → outPart = 2'))).toBe(true);
    expect(logs.some((l) => l.includes('offset → outOff = 100'))).toBe(true);
    // Summary line still present
    expect(logs.some((l) => l.includes('Wrote 2 output binding(s)'))).toBe(true);
  });

  it('fails when topic is blank', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = produceNode('p1', { topic: '  ' });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['p1']?.state).toBe('fail');
    expect(ops.produce).not.toHaveBeenCalled();
  });

  it('fails when kafkaOperations is not provided', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['p1']?.state).toBe('fail');
  });

  it('fails on produce error and reports it', async () => {
    const ops = mockKafkaOps({
      produce: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['p1']?.state).toBe('fail');
    expect(cbResult.states['p1']?.error).toContain('Connection refused');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });
});

describe('handleKafkaConsumeNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('consumes messages and advances the graph', async () => {
    const msg: KafkaConsumedMessage = {
      topic: 'test-topic',
      partition: 1,
      offset: '55',
      timestamp: '1700000000000',
      key: 'k1',
      value: '{"status":"ok"}',
    };
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([msg]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).toHaveBeenCalledOnce();
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('{"status":"ok"}');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('1');
    expect(passed.value).toBe(true);
    expect(cbResult.states['c1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('c1', 'main');
  });

  it('writes output bindings from consumed message', async () => {
    const msg: KafkaConsumedMessage = {
      topic: 'events',
      partition: 3,
      offset: '99',
      timestamp: '1700000000000',
      key: 'event-123',
      value: '{}',
    };
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([msg]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      outputBindings: [
        { id: 'b1', source: 'topic', targetVariable: 'outTopic', enabled: true },
        { id: 'b2', source: 'offset', targetVariable: 'outOff', enabled: true },
        { id: 'b3', source: 'key', targetVariable: 'outKey', enabled: true },
      ],
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(hCtx.ctx.get('outTopic')).toBe('events');
    expect(hCtx.ctx.get('outOff')).toBe('99');
    expect(hCtx.ctx.get('outKey')).toBe('event-123');
  });

  it('passes with 0 messages on timeout', async () => {
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('0');
    expect(cbResult.states['c1']?.state).toBe('pass');
  });

  it('fails on consume error', async () => {
    const ops = mockKafkaOps({
      consume: vi.fn().mockRejectedValue(new Error('SASL auth failed')),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(cbResult.states['c1']?.error).toContain('SASL auth failed');
  });

  it('fails when topic is blank', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1', { topic: '' });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(ops.consume).not.toHaveBeenCalled();
  });

  it('resolves filter expressions from variables', async () => {
    const msg: KafkaConsumedMessage = {
      topic: 'test-topic', partition: 0, offset: '0', timestamp: '0', key: '', value: '{}',
    };
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([msg]) });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      initialVariables: { correlationId: 'abc-123' },
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      keyRegex: '{{correlationId}}',
      headerFilters: [
        { id: 'f1', key: 'X-Corr', value: '{{correlationId}}', enabled: true },
        { id: 'f2', key: 'X-Off', value: 'ignored', enabled: false },
      ],
      jsonPathFilters: [
        { id: 'j1', jsonPath: '$.id', expectedValue: '{{correlationId}}', enabled: true },
      ],
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).toHaveBeenCalledWith(expect.objectContaining({
      keyRegex: 'abc-123',
      headerFilters: [{ key: 'X-Corr', value: 'abc-123' }],
      jsonPathFilters: [{ jsonPath: '$.id', expectedValue: 'abc-123' }],
    }));
  });

  it('uses startPosition earliest when configured', async () => {
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1', { startPosition: 'earliest' });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).toHaveBeenCalledWith(expect.objectContaining({
      startPosition: 'earliest',
    }));
  });

  // ── Load test mode ──

  it('auto-resume skips consume in load test mode', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: { mode: 'auto-resume' },
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).not.toHaveBeenCalled();
    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('0');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('defaults to auto-resume when loadTestBehavior is absent in load test mode (Phase 7B)', async () => {
    // Phase 7B: changed default from 'wait-for-real' to 'auto-resume' so that
    // nodes without explicit behavior skip the consume and continue the graph.
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1'); // no loadTestBehavior — relies on new default

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).not.toHaveBeenCalled();
    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('0');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });

  it('synthetic-inject injects mock payload in load test mode', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: {
        mode: 'synthetic-inject',
        mockPayload: { event: 'payment_completed' },
        syntheticDelayMs: 0,
      },
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).not.toHaveBeenCalled();
    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('{"event":"payment_completed"}');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('1');
  });

  it('wait-for-real uses normal consume even in load test mode', async () => {
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([]) });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: { mode: 'wait-for-real' },
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(ops.consume).toHaveBeenCalledOnce();
  });

  it('synthetic-inject aborts during delay when abortSignal fires', async () => {
    const ops = mockKafkaOps();
    const ac = new AbortController();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      loadTestMode: true,
      abortSignal: ac.signal,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: {
        mode: 'synthetic-inject',
        mockPayload: { x: 1 },
        syntheticDelayMs: 60_000,
      },
    });

    // Abort shortly after starting
    setTimeout(() => ac.abort(), 20);
    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(cbResult.states['c1']?.error).toBe('Aborted');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when kafkaOperations is not provided', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
  });

  it('auto-resume succeeds even when kafkaOperations is not provided', async () => {
    // auto-resume bypasses network calls entirely — kafkaOperations must not be required
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: { mode: 'auto-resume' },
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['c1']?.state).toBe('pass');
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('0');
  });

  it('synthetic-inject succeeds even when kafkaOperations is not provided', async () => {
    // synthetic-inject bypasses network calls — kafkaOperations must not be required
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      loadTestMode: true,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      loadTestBehavior: {
        mode: 'synthetic-inject',
        mockPayload: { injected: true },
        syntheticDelayMs: 0,
      },
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['c1']?.state).toBe('pass');
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('{"injected":true}');
  });

  it('writes empty string bindings when 0 messages received', async () => {
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      outputBindings: [
        { id: 'b1', source: 'topic', targetVariable: 'outTopic', enabled: true },
        { id: 'b2', source: 'offset', targetVariable: 'outOff', enabled: true },
      ],
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(hCtx.ctx.get('outTopic')).toBe('');
    expect(hCtx.ctx.get('outOff')).toBe('');
    expect(passed.value).toBe(true);
  });

  it('writes partition and timestamp bindings from consumed message', async () => {
    const msg: KafkaConsumedMessage = {
      topic: 'events',
      partition: 7,
      offset: '200',
      timestamp: '1700000099999',
      key: 'k2',
      value: '{}',
    };
    const ops = mockKafkaOps({ consume: vi.fn<KafkaNodeOperations['consume']>().mockResolvedValue([msg]) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = consumeNode('c1', {
      outputBindings: [
        { id: 'b1', source: 'partition', targetVariable: 'outPart', enabled: true },
        { id: 'b2', source: 'timestamp', targetVariable: 'outTs', enabled: true },
      ],
    });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(hCtx.ctx.get('outPart')).toBe('7');
    expect(hCtx.ctx.get('outTs')).toBe('1700000099999');
  });
});

describe('handleKafkaProduceNode — extra binding sources', () => {
  it('writes timestamp binding from produce result', async () => {
    const cbResult = makeCallbacks();
    const result: KafkaProduceResult = {
      topic: 'orders',
      partition: 0,
      offset: '10',
      timestamp: '1700000012345',
      key: 'k3',
    };
    const ops = mockKafkaOps({ produce: vi.fn<KafkaNodeOperations['produce']>().mockResolvedValue(result) });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, kafkaOperations: ops });
    const passed = makePassedFlag();
    const node = produceNode('p1', {
      outputBindings: [
        { id: 'b1', source: 'timestamp', targetVariable: 'outTs', enabled: true },
        { id: 'b2', source: 'topic', targetVariable: 'outTopic', enabled: true },
      ],
    });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(hCtx.ctx.get('outTs')).toBe('1700000012345');
    expect(hCtx.ctx.get('outTopic')).toBe('orders');
  });
});

describe('getKafkaSourceValue', () => {
  const meta = {
    topic: 'my-topic',
    partition: 3,
    offset: '77',
    timestamp: '1700000000000',
    key: 'my-key',
  };

  it.each([
    ['topic',     'my-topic'],
    ['partition', '3'],
    ['offset',    '77'],
    ['timestamp', '1700000000000'],
    ['key',       'my-key'],
  ] as const)('returns correct value for source=%s', (source, expected) => {
    expect(getKafkaSourceValue(source, meta)).toBe(expected);
  });

  it('returns empty string for unknown source', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getKafkaSourceValue('unknown' as any, meta)).toBe('');
  });

  it('returns empty string when field is missing from meta', () => {
    const sparse = { topic: 't' }; // no partition/offset/key/timestamp
    expect(getKafkaSourceValue('partition', sparse)).toBe('');
    expect(getKafkaSourceValue('offset', sparse)).toBe('');
    expect(getKafkaSourceValue('timestamp', sparse)).toBe('');
    expect(getKafkaSourceValue('key', sparse)).toBe('');
  });
});
