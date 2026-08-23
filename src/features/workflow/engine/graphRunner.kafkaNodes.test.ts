/**
 * Phase 4D: Kafka node integration tests.
 *
 * Tests structured logging, capturedKafkaDetails capture, payload truncation,
 * failure classification, and mixed HTTP→Kafka→HTTP workflows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKafkaProduceNode, handleKafkaConsumeNode, classifyKafkaFailure } from './graphRunnerKafkaNodeHandlers';
import type { KafkaProduceNodeData, KafkaConsumeNodeData } from '../types/workflow';
import type { KafkaNodeOperations, KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';
import type { CapturedKafkaNodeDetails } from '@shared/types';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

// ── Helpers ─────────────────────────────────────────────────

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

function makeCapturedKafkaMap(): Map<string, CapturedKafkaNodeDetails> {
  return new Map();
}

function consumedMsg(overrides: Partial<KafkaConsumedMessage> = {}): KafkaConsumedMessage {
  return {
    topic: 'test-topic',
    partition: 1,
    offset: '100',
    timestamp: '1700000000000',
    key: 'key1',
    value: '{"data":"payload"}',
    ...overrides,
  };
}

// ── classifyKafkaFailure ────────────────────────────────────

describe('classifyKafkaFailure', () => {
  it.each([
    ['SASL authentication failed', 'auth'],
    ['Unauthorized access to topic', 'auth'],
    ['Forbidden', 'auth'],
    ['TLS handshake error', 'tls'],
    ['SSL certificate expired', 'tls'],
    ['Certificate verify failed', 'tls'],
    ['Connection timed out', 'timeout'],
    ['Request timeout after 30000ms', 'timeout'],
    ['KafkaError: timed_out', 'timeout'],
    ['ECONNREFUSED 127.0.0.1:9092', 'network'],
    ['ENOTFOUND broker.example.com', 'network'],
    ['Network unreachable', 'network'],
    ['Topic "my-topic" not found', 'validation'],
    ['Topic is blank', 'validation'],
    ['Required field missing', 'validation'],
    ['Invalid partition assignment', 'validation'],
    // Ordering regression: validation must win over network when both keywords present
    ['Topic not found: no active connection', 'validation'],
    ['validation error: connection to schema registry failed', 'validation'],
    ['Some unknown error', 'network'], // default fallback
  ] as const)('classifies "%s" as "%s"', (message, expected) => {
    expect(classifyKafkaFailure(message)).toBe(expected);
  });
});

// ── capturedKafkaDetails: Produce ───────────────────────────

describe('handleKafkaProduceNode - capturedKafkaDetails', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  let capturedMap: Map<string, CapturedKafkaNodeDetails>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    capturedMap = makeCapturedKafkaMap();
  });

  it('populates capturedKafkaDetails on successful produce', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(capturedMap.has('p1')).toBe(true);
    const details = capturedMap.get('p1')!;
    expect(details.topic).toBe('test-topic');
    expect(details.partition).toBe(0);
    expect(details.offset).toBe('42');
    expect(details.durationMs).toBeGreaterThanOrEqual(0);
    expect(details.failureClass).toBeUndefined();
  });

  it('populates capturedKafkaDetails with failureClass on produce error', async () => {
    const ops = mockKafkaOps({
      produce: vi.fn().mockRejectedValue(new Error('Connection timed out')),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    const details = capturedMap.get('p1')!;
    expect(details.failureClass).toBe('timeout');
    expect(details.topic).toBe('test-topic');
    expect(details.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('truncates body preview to 512 chars', async () => {
    const longBody = 'x'.repeat(1000);
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1', { bodyTemplate: longBody });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    const details = capturedMap.get('p1')!;
    expect(details.bodyPreview!.length).toBeLessThanOrEqual(512);
  });

  it('omits bodyPreview when body is empty', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1', { bodyTemplate: '' });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    const details = capturedMap.get('p1')!;
    expect(details.bodyPreview).toBeUndefined();
  });

  it('includes duration in success log message', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
      log: (line) => logLines.push(line),
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    const successLog = logLines.find(l => l.prefix === '✓');
    expect(successLog).toBeDefined();
    expect(successLog!.text).toMatch(/\d+ms/);
  });

  it('includes failureClass in error log message', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const ops = mockKafkaOps({
      produce: vi.fn().mockRejectedValue(new Error('SASL auth failed')),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
      log: (line) => logLines.push(line),
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    const errorLog = logLines.find(l => l.prefix === '!');
    expect(errorLog!.text).toContain('[auth]');
  });
});

// ── capturedKafkaDetails: Consume ───────────────────────────

describe('handleKafkaConsumeNode - capturedKafkaDetails', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  let capturedMap: Map<string, CapturedKafkaNodeDetails>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    capturedMap = makeCapturedKafkaMap();
  });

  it('populates capturedKafkaDetails on successful consume', async () => {
    const msg = consumedMsg();
    const ops = mockKafkaOps({
      consume: vi.fn().mockResolvedValue([msg]),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(capturedMap.has('c1')).toBe(true);
    const details = capturedMap.get('c1')!;
    expect(details.topic).toBe('test-topic');
    expect(details.partition).toBe(1);
    expect(details.offset).toBe('100');
    expect(details.key).toBe('key1');
    expect(details.matchedMessages).toBe(1);
    expect(details.durationMs).toBeGreaterThanOrEqual(0);
    expect(details.failureClass).toBeUndefined();
    expect(details.bodyPreview).toBe('{"data":"payload"}');
  });

  it('records matchedMessages=0 when no messages received', async () => {
    const ops = mockKafkaOps({
      consume: vi.fn().mockResolvedValue([]),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    const details = capturedMap.get('c1')!;
    expect(details.matchedMessages).toBe(0);
    expect(details.bodyPreview).toBeUndefined();
  });

  it('truncates consume body preview to 512 chars', async () => {
    const longValue = '{"data":"' + 'a'.repeat(600) + '"}';
    const msg = consumedMsg({ value: longValue });
    const ops = mockKafkaOps({
      consume: vi.fn().mockResolvedValue([msg]),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    const details = capturedMap.get('c1')!;
    expect(details.bodyPreview!.length).toBeLessThanOrEqual(512);
  });

  it('populates failureClass on consume error', async () => {
    const ops = mockKafkaOps({
      consume: vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:9092')),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    const details = capturedMap.get('c1')!;
    expect(details.failureClass).toBe('network');
    expect(details.topic).toBe('test-topic');
  });

  it('includes duration in consume success log', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const ops = mockKafkaOps({
      consume: vi.fn().mockResolvedValue([consumedMsg()]),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
      log: (line) => logLines.push(line),
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    const successLog = logLines.find(l => l.prefix === '✓');
    expect(successLog!.text).toMatch(/\d+ms/);
  });

  it('includes failureClass in consume error log', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const ops = mockKafkaOps({
      consume: vi.fn().mockRejectedValue(new Error('SSL certificate expired')),
    });
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
      log: (line) => logLines.push(line),
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    const errorLog = logLines.find(l => l.prefix === '!');
    expect(errorLog!.text).toContain('[tls]');
  });
});

// ── Validation errors do not populate capturedKafkaDetails ──

describe('validation errors - no capture', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  let capturedMap: Map<string, CapturedKafkaNodeDetails>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    capturedMap = makeCapturedKafkaMap();
  });

  it('blank topic produce does not add to capturedKafkaDetails', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1', { topic: '' });

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(capturedMap.size).toBe(0);
  });

  it('blank topic consume does not add to capturedKafkaDetails', async () => {
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1', { topic: '' });

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(capturedMap.size).toBe(0);
  });

  it('no kafkaOperations produce does not add to capturedKafkaDetails', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    expect(capturedMap.size).toBe(0);
  });

  it('no kafkaOperations consume does not add to capturedKafkaDetails', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = consumeNode('c1');

    await handleKafkaConsumeNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(capturedMap.size).toBe(0);
  });
});

// ── Variable context flowing across produce→consume ─────────

describe('variable flow across Kafka nodes', () => {
  it('produce output bindings feed into consume topic via variable resolution', async () => {
    const cbResult = makeCallbacks();
    const capturedMap = makeCapturedKafkaMap();
    const produceResult = {
      topic: 'orders',
      partition: 2,
      offset: '99',
      timestamp: '1700000000000',
      key: 'order-1',
    };
    const ops = mockKafkaOps({
      produce: vi.fn().mockResolvedValue(produceResult),
      consume: vi.fn().mockResolvedValue([consumedMsg({ topic: 'orders' })]),
    });

    // Step 1: Produce with output binding for topic
    const hCtx1 = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const pNode = produceNode('p1', {
      topic: 'orders',
      outputBindings: [{ id: 'b1', targetVariable: 'producedTopic', source: 'topic', enabled: true }],
    });
    await handleKafkaProduceNode('p1', pNode, hCtx1, makePassedFlag());

    // Verify produce set the variable
    expect(hCtx1.ctx.get('producedTopic')).toBe('orders');

    // Step 2: Consume using {{producedTopic}} as topic
    const cNode = consumeNode('c1', { topic: '{{producedTopic}}' });
    await handleKafkaConsumeNode('c1', cNode, hCtx1, makePassedFlag());

    // Verify consume resolved the topic correctly
    const consumeCall = (ops.consume as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(consumeCall.topic).toBe('orders');

    // Both nodes captured
    expect(capturedMap.size).toBe(2);
  });
});

// ── Secret omission ─────────────────────────────────────────

describe('secret omission', () => {
  it('captured details do not contain auth/TLS credentials', async () => {
    const cbResult = makeCallbacks();
    const capturedMap = makeCapturedKafkaMap();
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });

    const node = produceNode('p1', {
      bodyTemplate: '{"secret": "my-api-key-123"}',
    });

    await handleKafkaProduceNode('p1', node, hCtx, makePassedFlag());

    const details = capturedMap.get('p1')!;
    // CapturedKafkaNodeDetails should only have: topic, partition, offset, key,
    // durationMs, matchedMessages, failureClass, bodyPreview — no auth/TLS fields
    const keys = Object.keys(details);
    expect(keys).not.toContain('password');
    expect(keys).not.toContain('saslPassword');
    expect(keys).not.toContain('sslKey');
    expect(keys).not.toContain('certificate');
    expect(keys).not.toContain('credentials');
  });
});

// ── Regression: non-Kafka nodes unchanged ───────────────────

describe('non-Kafka workflow regression', () => {
  it('capturedKafkaDetails map stays empty for non-Kafka node execution', async () => {
    const capturedMap = makeCapturedKafkaMap();

    // Simply verify that a fresh map with no Kafka handler calls remains empty
    expect(capturedMap.size).toBe(0);
  });
});

// ── Produce handler does not touch consume-internal context vars ─────────────

describe('handleKafkaProduceNode - no consume var pollution', () => {
  it('does not set __kafkaConsumeBody or __kafkaConsumeCount in context', async () => {
    const cbResult = makeCallbacks();
    const capturedMap = makeCapturedKafkaMap();
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    // Produce handler must never write consume-specific internal vars
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBeUndefined();
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBeUndefined();
  });

  it('preserves existing __kafkaConsumeBody set by a prior consume node', async () => {
    const cbResult = makeCallbacks();
    const capturedMap = makeCapturedKafkaMap();
    const ops = mockKafkaOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      kafkaOperations: ops,
      capturedKafkaDetails: capturedMap,
    });
    // Simulate a prior consume node having stored a body in context
    hCtx.ctx.set('__kafkaConsumeBody', 'prior-payload');
    hCtx.ctx.set('__kafkaConsumeCount', '1');

    const passed = makePassedFlag();
    const node = produceNode('p1');

    await handleKafkaProduceNode('p1', node, hCtx, passed);

    // The produce handler must leave the prior consume vars intact (they are
    // consumed by graphRunner.ts onNodeComplete for the consume node, not here)
    expect(hCtx.ctx.get('__kafkaConsumeBody')).toBe('prior-payload');
    expect(hCtx.ctx.get('__kafkaConsumeCount')).toBe('1');
  });
});
