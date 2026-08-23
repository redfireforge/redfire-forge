/**
 * Tests for kafkaExecution.ts — Kafka produce/consume execution and kafkaField assertions.
 */
import { describe, it, expect, vi } from 'vitest';
import { executeKafkaAction } from './kafkaExecution';
import { evaluateAssertions, type AssertionContext } from './validator';
import type { Scenario, Assertion } from '@shared/types';
import type { KafkaNodeOperations } from '@workflow/engine/graphRunnerNodeHandlerContext';
import { makeScenario as _makeScenario } from '@test-utils/factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({
    url: '',
    method: 'KAFKA',
    ...overrides,
  }) as unknown as Scenario;

function makeProduceScenario(overrides: Partial<Scenario> = {}): Scenario {
  return makeScenario({
    actionType: 'kafkaProduce',
    kafkaProduceAction: {
      clusterId: 'cluster-1',
      topic: 'order-events',
      key: 'order-42',
      value: '{"orderId":42,"status":"created"}',
      headers: { 'x-source': 'test-runner' },
    },
    ...overrides,
  });
}

function makeConsumeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return makeScenario({
    actionType: 'kafkaConsume',
    kafkaConsumeAction: {
      clusterId: 'cluster-1',
      topic: 'order-events',
      maxMessages: 1,
      timeoutMs: 5000,
    },
    ...overrides,
  });
}

function mockOps(
  produceResult?: Awaited<ReturnType<KafkaNodeOperations['produce']>>,
  consumeResult?: Awaited<ReturnType<KafkaNodeOperations['consume']>>,
): KafkaNodeOperations {
  return {
    produce: vi.fn().mockResolvedValue(
      produceResult ?? { topic: 'order-events', partition: 0, offset: '42', timestamp: '1700000000000' },
    ),
    consume: vi.fn().mockResolvedValue(
      consumeResult ?? [],
    ),
  };
}

function kafkaCtx(overrides: Partial<AssertionContext> = {}): AssertionContext {
  return {
    httpStatus: 200,
    responseTimeMs: 80,
    responseHeaders: { 'x-correlation-id': 'corr-1' },
    responseBody: { status: 'ok' },
    rawBody: '{"status":"ok"}',
    kafkaContext: { key: 'msg-key', offset: 100, partition: 2, topic: 'events' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// executeKafkaAction — Produce
// ---------------------------------------------------------------------------

describe('executeKafkaAction — produce success', () => {
  it('returns passed:true with kafkaResultMeta populated', async () => {
    const ops = mockOps({ topic: 'order-events', partition: 0, offset: '42', timestamp: '1000', key: 'order-42' });
    const scenario = makeProduceScenario();
    const result = await executeKafkaAction(scenario, ops);

    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.transportType).toBe('kafkaProduce');
    expect(result.kafkaResultMeta).toMatchObject({
      topic: 'order-events',
      partition: 0,
      offset: 42,          // parsed from string '42'
      key: 'order-42',
    });
  });

  it('captures produce request body as responseBody', async () => {
    const ops = mockOps({ topic: 'order-events', partition: 0, offset: '1', timestamp: '1000' });
    const scenario = makeProduceScenario();
    const result = await executeKafkaAction(scenario, ops);

    expect(result.responseBody).toBe('{"orderId":42,"status":"created"}');
  });

  it('sets transportType to kafkaProduce', async () => {
    const ops = mockOps();
    const result = await executeKafkaAction(makeProduceScenario(), ops);
    expect(result.transportType).toBe('kafkaProduce');
  });
});

describe('executeKafkaAction — produce failure', () => {
  it('returns passed:false on produce error', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('Broker not available')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.kafkaResultMeta).toBeUndefined();
    expect(result.errorMessage).toMatch(/Broker not available/);
  });
});

describe('executeKafkaAction — produce error classification', () => {
  it('prefixes auth errors with [auth] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('SASL authentication failed')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[auth\]/);
  });

  it('prefixes TLS errors with [tls] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('SSL handshake failed')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[tls\]/);
  });

  it('prefixes timeout errors with [timeout] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('Request timeout after 5000ms')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[timeout\]/);
  });

  it('prefixes validation errors with [validation] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('Topic not found: invalid topic name')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[validation\]/);
  });

  it('does not prefix network errors', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused to broker')),
      consume: vi.fn(),
    };
    const result = await executeKafkaAction(makeProduceScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).not.toMatch(/^\[/);
    expect(result.errorMessage).toMatch(/ECONNREFUSED/);
  });
});

// ---------------------------------------------------------------------------
// executeKafkaAction — Consume
// ---------------------------------------------------------------------------

describe('executeKafkaAction — consume success', () => {
  const sampleMessage = {
    topic: 'order-events',
    partition: 2,
    offset: '100',
    timestamp: '2000',
    key: 'msg-key',
    value: '{"status":"ok","orderId":99}',
    headers: { 'x-correlation-id': 'corr-123' },
  };

  it('populates kafkaResultMeta from consumed message', async () => {
    const ops = mockOps(undefined, [sampleMessage]);
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(true);
    expect(result.transportType).toBe('kafkaConsume');
    expect(result.kafkaResultMeta).toMatchObject({
      topic: 'order-events',
      partition: 2,
      offset: 100,           // parsed from string '100'
      key: 'msg-key',
      matchedMessages: 1,
    });
  });

  it('sets responseBody to message value', async () => {
    const ops = mockOps(undefined, [sampleMessage]);
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.responseBody).toBe('{"status":"ok","orderId":99}');
  });

  it('maps message headers to responseHeaders', async () => {
    const ops = mockOps(undefined, [sampleMessage]);
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.responseHeaders['x-correlation-id']).toBe('corr-123');
  });

  it('succeeds and captures raw string responseBody when message value is not valid JSON', async () => {
    const nonJsonMessage = { ...sampleMessage, value: 'plain-text-not-json' };
    const ops = mockOps(undefined, [nonJsonMessage]);
    // parseJsonSafe falls back to returning the raw string when JSON.parse throws —
    // the result should not error out; the raw value is used for body assertions
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(true);
    expect(result.responseBody).toBe('plain-text-not-json');
  });
});

describe('executeKafkaAction — consume no match', () => {
  it('returns passed:false with timeout error when 0 messages received', async () => {
    const ops = mockOps(undefined, []);  // empty array = no messages
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.errorMessage).toBe('No messages received within timeout');
    expect(result.kafkaResultMeta).toBeUndefined();
  });
});

describe('executeKafkaAction — consume error classification', () => {
  it('prefixes auth errors with [auth] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn(),
      consume: vi.fn().mockRejectedValue(new Error('SASL authentication failed')),
    };
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[auth\]/);
  });

  it('prefixes TLS errors with [tls] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn(),
      consume: vi.fn().mockRejectedValue(new Error('SSL handshake failed')),
    };
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[tls\]/);
  });

  it('prefixes timeout errors with [timeout] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn(),
      consume: vi.fn().mockRejectedValue(new Error('Request timeout after 5000ms')),
    };
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[timeout\]/);
  });

  it('prefixes validation errors with [validation] classifier', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn(),
      consume: vi.fn().mockRejectedValue(new Error('Topic not found: invalid topic name')),
    };
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[validation\]/);
  });

  it('does not prefix network errors', async () => {
    const ops: KafkaNodeOperations = {
      produce: vi.fn(),
      consume: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused to broker')),
    };
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).not.toMatch(/^\[/);
    expect(result.errorMessage).toMatch(/ECONNREFUSED/);
  });
});

// ---------------------------------------------------------------------------
// executeKafkaAction — assertion integration
// ---------------------------------------------------------------------------

describe('executeKafkaAction — assertion integration', () => {
  const sampleMessage = {
    topic: 'payments',
    partition: 1,
    offset: '55',
    timestamp: '3000',
    key: 'pay-1',
    value: '{"amount":50,"currency":"USD"}',
    headers: {},
  };

  it('passes body assertion using kafkaField contains on consumed message', async () => {
    const ops = mockOps(undefined, [sampleMessage]);
    const scenario = makeConsumeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: '"amount"' } as Assertion,
        ],
      },
    });
    const result = await executeKafkaAction(scenario, ops);

    expect(result.passed).toBe(true);
    expect(result.failureDetails).toHaveLength(0);
  });

  it('fails body assertion when value does not match', async () => {
    const ops = mockOps(undefined, [sampleMessage]);
    const scenario = makeConsumeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: '"missingField"' } as Assertion,
        ],
      },
    });
    const result = await executeKafkaAction(scenario, ops);

    expect(result.passed).toBe(false);
    expect(result.failureDetails?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — kafkaField case
// ---------------------------------------------------------------------------

describe('evaluateAssertions — kafkaField assertions', () => {
  it('passes kafka.key equals assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: 'msg-key' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('fails kafka.key equals when key does not match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: 'wrong-key' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(kafkaField:kafka.key)');
  });

  it('passes kafka.partition equals assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.partition', operator: 'equals', value: '2' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('passes kafka.offset equals assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.offset', operator: 'equals', value: '100' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('passes kafka.header.* exists assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.header.x-correlation-id', operator: 'exists' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('fails kafka.header.* exists when header is absent', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.header.x-missing', operator: 'exists' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(kafkaField:kafka.header.x-missing)');
  });

  it('passes kafka.header.* equals assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.header.x-correlation-id', operator: 'equals', value: 'corr-1' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('passes kafka.body contains assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: '"status"' } as Assertion],
      kafkaCtx({ rawBody: '{"status":"ok"}' }),
    );
    expect(failures).toHaveLength(0);
  });

  it('fails kafka.body contains when not present', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: '"missing_field"' } as Assertion],
      kafkaCtx({ rawBody: '{"status":"ok"}' }),
    );
    expect(failures).toHaveLength(1);
  });

  it('fails kafka.key exists assertion when key is undefined', () => {
    // kafka.key is undefined — 'exists' should fail
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.key', operator: 'exists' } as Assertion],
      kafkaCtx({ kafkaContext: { key: undefined, offset: 5, partition: 0, topic: 'x' } }),
    );
    expect(failures).toHaveLength(1);
  });

  it('passes kafka.key regex assertion when key matches pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.key', operator: 'regex', value: '^msg-' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(0);
  });

  it('fails kafka.key regex assertion when key does not match pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'kafkaField', target: 'kafka.key', operator: 'regex', value: '^order-' } as Assertion],
      kafkaCtx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(kafkaField:kafka.key)');
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — custom assertion with kafka.* variable resolution
// ---------------------------------------------------------------------------

describe('evaluateAssertions — custom assertions with kafka.* variables', () => {
  it('resolves kafka.key as truthy when key is present', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '{{kafka.key}}',
    } as Assertion;
    const { failures } = evaluateAssertions([assertion], kafkaCtx());
    expect(failures).toHaveLength(0);
  });

  it('resolves kafka.key as falsy when key is absent ($isEmpty check)', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '$isEmpty({{kafka.key}})',
    } as Assertion;
    // key = 'msg-key' → not empty → $isEmpty returns false → assertion FAILS
    const { failures } = evaluateAssertions([assertion], kafkaCtx());
    expect(failures).toHaveLength(1);
  });

  it('resolves kafka.topic via resolveVariable', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '{{kafka.topic}}',
    } as Assertion;
    // resolves to 'events' → truthy → passes
    const { failures } = evaluateAssertions([assertion], kafkaCtx());
    expect(failures).toHaveLength(0);
  });

  it('resolves kafka.offset as truthy when offset is a number', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '{{kafka.offset}}',
    } as Assertion;
    // resolves to 100 → truthy → passes
    const { failures } = evaluateAssertions([assertion], kafkaCtx());
    expect(failures).toHaveLength(0);
  });

  it('resolves kafka.body as truthy when rawBody is present', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '{{kafka.body}}',
    } as Assertion;
    // rawBody = '{"status":"ok"}' → truthy → passes
    const { failures } = evaluateAssertions([assertion], kafkaCtx({ rawBody: '{"status":"ok"}' }));
    expect(failures).toHaveLength(0);
  });

  it('resolves kafka.header.* via resolveVariable', () => {
    const assertion: Assertion = {
      type: 'custom',
      expression: '{{kafka.header.x-correlation-id}}',
    } as Assertion;
    // header value = 'corr-1' → truthy → passes
    const { failures } = evaluateAssertions(
      [assertion],
      kafkaCtx({ responseHeaders: { 'x-correlation-id': 'corr-1' } }),
    );
    expect(failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// executeKafkaAction — filter mapping
// ---------------------------------------------------------------------------

describe('executeKafkaAction — consume filter mapping', () => {
  it('maps fromBeginning:true to startPosition:"earliest"', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'cluster-1',
        topic: 'order-events',
        fromBeginning: true,
        maxMessages: 1,
        timeoutMs: 5000,
      },
    });
    await executeKafkaAction(scenario, ops);
    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ startPosition: 'earliest' }),
    );
  });

  it('maps fromBeginning:false to startPosition:"latest"', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'cluster-1',
        topic: 'order-events',
        fromBeginning: false,
        maxMessages: 1,
        timeoutMs: 5000,
      },
    });
    await executeKafkaAction(scenario, ops);
    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ startPosition: 'latest' }),
    );
  });

  it('maps filter.keyEquals to keyRegex param', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c',
        topic: 't',
        maxMessages: 1,
        timeoutMs: 5000,
        filter: { keyEquals: 'order-42' },
      },
    });
    await executeKafkaAction(scenario, ops);
    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ keyRegex: '^order-42$' }),
    );
  });

  it('maps filter.headersMatch to headerFilters array', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c',
        topic: 't',
        maxMessages: 1,
        timeoutMs: 5000,
        filter: { headersMatch: { 'x-env': 'prod' } },
      },
    });
    await executeKafkaAction(scenario, ops);
    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ headerFilters: [{ key: 'x-env', value: 'prod' }] }),
    );
  });

  it('maps filter.jsonPath + filter.jsonEquals to jsonPathFilters', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c',
        topic: 't',
        maxMessages: 1,
        timeoutMs: 5000,
        filter: { jsonPath: '$.status', jsonEquals: 'created' },
      },
    });
    await executeKafkaAction(scenario, ops);
    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPathFilters: [{ jsonPath: '$.status', expectedValue: 'created' }],
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// executeKafkaAction — unsupported actionType fallback
// ---------------------------------------------------------------------------

describe('executeKafkaAction — unsupported actionType', () => {
  it('returns an error result for unsupported actionType', async () => {
    const ops = mockOps();
    // actionType 'http' is unsupported in kafkaExecution (it should go through requestExecution)
    const scenario = makeScenario({ actionType: 'http' });
    const result = await executeKafkaAction(scenario, ops);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/unsupported/i);
  });
});

// ---------------------------------------------------------------------------
// Branch coverage — parameter edge cases
// ---------------------------------------------------------------------------

describe('executeKafkaAction — produce branch coverage', () => {
  it('sends empty string value and undefined ackMode when value and acks are absent', async () => {
    const ops = mockOps();
    const scenario = makeProduceScenario({
      kafkaProduceAction: {
        clusterId: 'c1',
        topic: 'orders',
        // value and acks intentionally omitted to exercise ?? '' and ternary false branches
      },
    });
    const result = await executeKafkaAction(scenario, ops);

    expect(result.passed).toBe(true);
    expect(ops.produce).toHaveBeenCalledWith(
      expect.objectContaining({ value: '', ackMode: undefined }),
    );
    // responseBody is '' when cfg.value is absent → parseJsonSafe('') returns null (line 245 covered)
    expect(result.responseBody).toBe('');
  });

  it('uses fallback timeout 5000ms when produce action has no timeoutMs', async () => {
    const ops = mockOps();
    const scenario = makeProduceScenario({
      kafkaProduceAction: {
        clusterId: 'c1',
        topic: 'orders',
        value: 'x',
        // timeoutMs omitted — exercises ?? timeoutMs ?? 5_000 default chain
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.produce).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 5000 }),
    );
  });

  it('passes ackMode as string when acks is explicitly set', async () => {
    const ops = mockOps();
    const scenario = makeProduceScenario({
      kafkaProduceAction: {
        clusterId: 'c1',
        topic: 'orders',
        value: 'msg',
        acks: 1,
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.produce).toHaveBeenCalledWith(
      expect.objectContaining({ ackMode: '1' }),
    );
  });
});

describe('executeKafkaAction — consume branch coverage', () => {
  it('uses earliest startPosition when fromBeginning is true', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'orders',
        maxMessages: 1,
        timeoutMs: 1000,
        fromBeginning: true,
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ startPosition: 'earliest' }),
    );
  });

  it('uses default maxMessages=1 and timeoutMs=10000 when absent from action config', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'orders',
        // maxMessages and timeoutMs intentionally absent
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ maxMessages: 1, timeoutMs: 10000 }),
    );
  });

  it('passes keyRegex when filter.keyEquals is set', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'orders',
        maxMessages: 1,
        timeoutMs: 1000,
        filter: { keyEquals: 'order-42' },
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({ keyRegex: '^order-42$' }),
    );
  });

  it('passes headerFilters when filter.headersMatch is set', async () => {
    const ops = mockOps(undefined, []);
    const scenario = makeConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'orders',
        maxMessages: 1,
        timeoutMs: 1000,
        filter: { headersMatch: { 'x-env': 'prod' } },
      },
    });
    await executeKafkaAction(scenario, ops);

    expect(ops.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        headerFilters: [{ key: 'x-env', value: 'prod' }],
      }),
    );
  });

  it('uses empty object for responseHeaders when consumed message has no headers', async () => {
    const msgNoHeaders = {
      topic: 'orders',
      partition: 0,
      offset: '1',
      timestamp: '1000',
      key: 'k',
      value: '{"x":1}',
      // headers intentionally absent
    };
    const ops = mockOps(undefined, [msgNoHeaders]);
    const result = await executeKafkaAction(makeConsumeScenario(), ops);

    expect(result.passed).toBe(true);
    // msg.headers ?? {} → {} branch covered
    expect(result.responseHeaders).toEqual({});
  });
});
