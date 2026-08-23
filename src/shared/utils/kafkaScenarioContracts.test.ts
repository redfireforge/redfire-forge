import { describe, it, expect } from 'vitest';
import {
  makeDefaultKafkaProduceAction,
  makeDefaultKafkaConsumeAction,
  isKafkaScenario,
  resolveKafkaActionType,
  validateKafkaActionConfig,
} from './kafkaScenarioDefaults';
import {
  normalizeScenarioActionType,
  normalizeGroupActionTypes,
} from './scenarioMigration';
import type {
  Scenario,
  KafkaProduceActionConfig,
  KafkaConsumeActionConfig,
  KafkaResultMeta,
  KafkaAssertionTarget,
  Assertion,
  FeatureGroup,
  TestScenario,
} from '../types';
import { makeScenario as _makeScenario, makeTestScenario as _makeTestScenario } from '@test-utils/factories';

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeTest(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id,
    name: `Test ${id}`,
    url: '/api',
    ...overrides,
  }) as Scenario;
}

function makeScenario(id: string, tests: Scenario[]): TestScenario {
  return _makeTestScenario({ id, name: `Scenario ${id}`, tests });
}

function makeFg(id: string, scenarios: TestScenario[]): FeatureGroup {
  return { id, name: `FG ${id}`, scenarios } as FeatureGroup;
}

// ─── makeDefaultKafkaProduceAction ────────────────────────────────────────────

describe('makeDefaultKafkaProduceAction', () => {
  it('sets required fields from arguments', () => {
    const config = makeDefaultKafkaProduceAction('cluster-1', 'orders');
    expect(config.clusterId).toBe('cluster-1');
    expect(config.topic).toBe('orders');
  });

  it('fills default acks to -1 (all brokers)', () => {
    const config = makeDefaultKafkaProduceAction('c', 't');
    expect(config.acks).toBe(-1);
  });

  it('fills default timeoutMs to 5000', () => {
    const config = makeDefaultKafkaProduceAction('c', 't');
    expect(config.timeoutMs).toBe(5_000);
  });

  it('leaves optional key/value/headers/partition absent', () => {
    const config = makeDefaultKafkaProduceAction('c', 't');
    expect(config.key).toBeUndefined();
    expect(config.value).toBeUndefined();
    expect(config.headers).toBeUndefined();
    expect(config.partition).toBeUndefined();
  });

  it('satisfies KafkaProduceActionConfig shape (compile-time via assignment)', () => {
    const _check: KafkaProduceActionConfig = makeDefaultKafkaProduceAction('c', 't');
    expect(_check).toBeTruthy();
  });
});

// ─── makeDefaultKafkaConsumeAction ────────────────────────────────────────────

describe('makeDefaultKafkaConsumeAction', () => {
  it('sets required fields from arguments', () => {
    const config = makeDefaultKafkaConsumeAction('cluster-2', 'payments');
    expect(config.clusterId).toBe('cluster-2');
    expect(config.topic).toBe('payments');
  });

  it('defaults fromBeginning to false', () => {
    expect(makeDefaultKafkaConsumeAction('c', 't').fromBeginning).toBe(false);
  });

  it('defaults timeoutMs to 10000', () => {
    expect(makeDefaultKafkaConsumeAction('c', 't').timeoutMs).toBe(10_000);
  });

  it('defaults maxMessages to 1', () => {
    expect(makeDefaultKafkaConsumeAction('c', 't').maxMessages).toBe(1);
  });

  it('leaves optional groupId/filter absent', () => {
    const config = makeDefaultKafkaConsumeAction('c', 't');
    expect(config.groupId).toBeUndefined();
    expect(config.filter).toBeUndefined();
  });

  it('satisfies KafkaConsumeActionConfig shape (compile-time via assignment)', () => {
    const _check: KafkaConsumeActionConfig = makeDefaultKafkaConsumeAction('c', 't');
    expect(_check).toBeTruthy();
  });
});

// ─── resolveKafkaActionType ───────────────────────────────────────────────────

describe('resolveKafkaActionType', () => {
  it('returns "http" when actionType is absent (backward compat)', () => {
    const test = makeTest('t1'); // no actionType
    expect(resolveKafkaActionType(test)).toBe('http');
  });

  it('returns "http" when actionType is explicitly "http"', () => {
    const test = makeTest('t1', { actionType: 'http' });
    expect(resolveKafkaActionType(test)).toBe('http');
  });

  it('returns "kafkaProduce" when actionType is "kafkaProduce"', () => {
    const test = makeTest('t1', { actionType: 'kafkaProduce' });
    expect(resolveKafkaActionType(test)).toBe('kafkaProduce');
  });

  it('returns "kafkaConsume" when actionType is "kafkaConsume"', () => {
    const test = makeTest('t1', { actionType: 'kafkaConsume' });
    expect(resolveKafkaActionType(test)).toBe('kafkaConsume');
  });
});

// ─── isKafkaScenario ─────────────────────────────────────────────────────────

describe('isKafkaScenario', () => {
  it('returns false for standard HTTP scenario (no actionType)', () => {
    expect(isKafkaScenario(makeTest('t1'))).toBe(false);
  });

  it('returns false for explicit actionType "http"', () => {
    expect(isKafkaScenario(makeTest('t1', { actionType: 'http' }))).toBe(false);
  });

  it('returns true for kafkaProduce', () => {
    expect(isKafkaScenario(makeTest('t1', { actionType: 'kafkaProduce' }))).toBe(true);
  });

  it('returns true for kafkaConsume', () => {
    expect(isKafkaScenario(makeTest('t1', { actionType: 'kafkaConsume' }))).toBe(true);
  });
});

// ─── normalizeScenarioActionType ─────────────────────────────────────────────

describe('normalizeScenarioActionType', () => {
  it('adds actionType "http" to a legacy scenario without the field', () => {
    const legacy = makeTest('t1'); // no actionType
    const result = normalizeScenarioActionType(legacy);
    expect(result.actionType).toBe('http');
  });

  it('preserves "kafkaProduce" actionType unchanged', () => {
    const test = makeTest('t1', { actionType: 'kafkaProduce' });
    const result = normalizeScenarioActionType(test);
    expect(result.actionType).toBe('kafkaProduce');
    expect(result).toBe(test); // same reference — no copy needed
  });

  it('preserves "kafkaConsume" actionType unchanged', () => {
    const test = makeTest('t1', { actionType: 'kafkaConsume' });
    const result = normalizeScenarioActionType(test);
    expect(result.actionType).toBe('kafkaConsume');
    expect(result).toBe(test);
  });

  it('preserves all other scenario fields when normalizing', () => {
    const legacy = makeTest('t1', { url: '/orders', method: 'POST', body: '{}' });
    const result = normalizeScenarioActionType(legacy);
    expect(result.url).toBe('/orders');
    expect(result.method).toBe('POST');
    expect(result.body).toBe('{}');
  });
});

// ─── normalizeGroupActionTypes ────────────────────────────────────────────────

describe('normalizeGroupActionTypes', () => {
  it('returns same array reference when no tests need normalization', () => {
    const groups = [
      makeFg('fg1', [makeScenario('sc1', [makeTest('t1', { actionType: 'http' })])]),
    ];
    expect(normalizeGroupActionTypes(groups)).toBe(groups);
  });

  it('normalizes legacy tests (absent actionType) across all groups', () => {
    const groups = [
      makeFg('fg1', [makeScenario('sc1', [makeTest('t1'), makeTest('t2')])]),
      makeFg('fg2', [makeScenario('sc2', [makeTest('t3', { actionType: 'kafkaProduce' })])]),
    ];
    const result = normalizeGroupActionTypes(groups);
    expect(result[0].scenarios[0].tests[0].actionType).toBe('http');
    expect(result[0].scenarios[0].tests[1].actionType).toBe('http');
    // kafkaProduce was already set — unchanged
    expect(result[1].scenarios[0].tests[0].actionType).toBe('kafkaProduce');
  });

  it('does not mutate the original array', () => {
    const t1 = makeTest('t1'); // no actionType
    const groups = [makeFg('fg1', [makeScenario('sc1', [t1])])];
    normalizeGroupActionTypes(groups);
    expect(t1.actionType).toBeUndefined(); // original untouched
  });
});

// ─── KafkaResultMeta type contract ───────────────────────────────────────────

describe('KafkaResultMeta type contract', () => {
  it('accepts a minimal produce result meta (compile-time via assignment)', () => {
    const meta: KafkaResultMeta = {
      topic: 'orders',
      partition: 0,
      offset: 42,
    };
    expect(meta.topic).toBe('orders');
    expect(meta.matchedMessages).toBeUndefined();
  });

  it('accepts a full consume result meta with headers and key', () => {
    const meta: KafkaResultMeta = {
      topic: 'payments',
      partition: 2,
      offset: 100,
      key: 'order-123',
      headers: { 'x-trace-id': 'abc' },
      matchedMessages: 1,
    };
    expect(meta.key).toBe('order-123');
    expect(meta.matchedMessages).toBe(1);
  });
});

// ─── KafkaAssertionTarget type contract ──────────────────────────────────────

describe('KafkaAssertionTarget selector paths', () => {
  it('accepts "kafka.body" as a valid assertion target', () => {
    const target: KafkaAssertionTarget = 'kafka.body';
    expect(target).toBe('kafka.body');
  });

  it('accepts "kafka.key", "kafka.partition", "kafka.offset"', () => {
    const targets: KafkaAssertionTarget[] = ['kafka.key', 'kafka.partition', 'kafka.offset'];
    expect(targets).toHaveLength(3);
  });

  it('accepts a kafka.header.<name> template literal target', () => {
    const target: KafkaAssertionTarget = 'kafka.header.x-order-id';
    expect(target.startsWith('kafka.header.')).toBe(true);
  });
});

// ─── Assertion type: kafkaField discriminant ──────────────────────────────────

describe('Assertion type: kafkaField', () => {
  it('constructs a kafkaField assertion targeting kafka.body with equals operator', () => {
    const assertion: Assertion = {
      type: 'kafkaField',
      target: 'kafka.body',
      operator: 'contains',
      value: 'order-accepted',
    };
    if (assertion.type === 'kafkaField') {
      expect(assertion.target).toBe('kafka.body');
      expect(assertion.operator).toBe('contains');
    }
  });

  it('constructs a kafkaField assertion for a message header', () => {
    const assertion: Assertion = {
      type: 'kafkaField',
      target: 'kafka.header.x-correlation-id',
      operator: 'exists',
    };
    if (assertion.type === 'kafkaField') {
      expect(assertion.target).toBe('kafka.header.x-correlation-id');
    }
  });

  it('supports negate flag on kafkaField assertions', () => {
    const assertion: Assertion = {
      type: 'kafkaField',
      target: 'kafka.key',
      operator: 'equals',
      value: 'bad-key',
      negate: true,
    };
    if (assertion.type === 'kafkaField') {
      expect(assertion.negate).toBe(true);
    }
  });
});

// ─── Scenario Kafka action config contract ────────────────────────────────────

describe('Scenario kafkaProduceAction and kafkaConsumeAction fields', () => {
  it('accepts a scenario with kafkaProduceAction', () => {
    const scenario: Scenario = {
      ...makeTest('t1'),
      method: 'KAFKA',
      actionType: 'kafkaProduce',
      kafkaProduceAction: makeDefaultKafkaProduceAction('cluster-1', 'orders'),
    };
    expect(scenario.actionType).toBe('kafkaProduce');
    expect(scenario.kafkaProduceAction?.topic).toBe('orders');
  });

  it('accepts a scenario with kafkaConsumeAction including a filter', () => {
    const scenario: Scenario = {
      ...makeTest('t2'),
      method: 'KAFKA',
      actionType: 'kafkaConsume',
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'payments',
        timeoutMs: 15_000,
        maxMessages: 5,
        filter: { keyEquals: 'pay-001', jsonPath: '$.status', jsonEquals: 'confirmed' },
      },
    };
    expect(scenario.kafkaConsumeAction?.filter?.keyEquals).toBe('pay-001');
  });

  it('legacy HTTP scenario compiles and resolves to "http" action type', () => {
    const scenario = makeTest('t3'); // no actionType
    expect(resolveKafkaActionType(scenario)).toBe('http');
    expect(isKafkaScenario(scenario)).toBe(false);
  });
});

// ─── validateKafkaActionConfig ───────────────────────────────────────────────

describe('validateKafkaActionConfig', () => {
  it('returns [] for an HTTP scenario (no actionType)', () => {
    expect(validateKafkaActionConfig(makeTest('t1'))).toEqual([]);
  });

  it('returns [] for an explicit actionType "http"', () => {
    expect(validateKafkaActionConfig(makeTest('t1', { actionType: 'http' }))).toEqual([]);
  });

  it('returns an error when kafkaProduce scenario has no config bag', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', { actionType: 'kafkaProduce' }));
    expect(errors).toContain('kafkaProduceAction is required when actionType is "kafkaProduce"');
    expect(errors).toHaveLength(1);
  });

  it('returns errors for kafkaProduce config missing required fields', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaProduce',
      kafkaProduceAction: { clusterId: '', topic: '' },
    }));
    expect(errors).toContain('kafkaProduceAction.clusterId is required');
    expect(errors).toContain('kafkaProduceAction.topic is required');
  });

  it('returns [] for a valid kafkaProduce config', () => {
    const test = makeTest('t1', {
      actionType: 'kafkaProduce',
      kafkaProduceAction: makeDefaultKafkaProduceAction('cluster-1', 'orders'),
    });
    expect(validateKafkaActionConfig(test)).toEqual([]);
  });

  it('returns an error when kafkaConsume scenario has no config bag', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', { actionType: 'kafkaConsume' }));
    expect(errors).toContain('kafkaConsumeAction is required when actionType is "kafkaConsume"');
    expect(errors).toHaveLength(1);
  });

  it('returns errors for kafkaConsume config missing required fields', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: { clusterId: '', topic: '' },
    }));
    expect(errors).toContain('kafkaConsumeAction.clusterId is required');
    expect(errors).toContain('kafkaConsumeAction.topic is required');
  });

  it('returns [] for a valid kafkaConsume config', () => {
    const test = makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: makeDefaultKafkaConsumeAction('cluster-2', 'payments'),
    });
    expect(validateKafkaActionConfig(test)).toEqual([]);
  });

  it('returns [] for kafkaConsume with only clusterId and topic (other fields optional)', () => {
    const test = makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: { clusterId: 'c1', topic: 'events' },
    });
    expect(validateKafkaActionConfig(test)).toEqual([]);
  });

  it('returns errors for kafkaProduce with whitespace-only clusterId', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaProduce',
      kafkaProduceAction: { clusterId: '   ', topic: 'orders' },
    }));
    expect(errors).toContain('kafkaProduceAction.clusterId is required');
  });

  it('returns errors for kafkaProduce with whitespace-only topic', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaProduce',
      kafkaProduceAction: { clusterId: 'cluster-1', topic: '  ' },
    }));
    expect(errors).toContain('kafkaProduceAction.topic is required');
  });

  it('returns errors for kafkaConsume with whitespace-only clusterId', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: { clusterId: '\t', topic: 'events' },
    }));
    expect(errors).toContain('kafkaConsumeAction.clusterId is required');
  });

  it('returns errors for kafkaConsume with whitespace-only topic', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: { clusterId: 'c1', topic: '   ' },
    }));
    expect(errors).toContain('kafkaConsumeAction.topic is required');
  });

  it('returns error when filter.jsonEquals is set without filter.jsonPath', () => {
    const errors = validateKafkaActionConfig(makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'events',
        filter: { jsonEquals: 'active' },
      },
    }));
    expect(errors).toContain('kafkaConsumeAction.filter.jsonEquals requires filter.jsonPath to be set');
  });

  it('returns [] when filter.jsonEquals and filter.jsonPath are both set', () => {
    const test = makeTest('t1', {
      actionType: 'kafkaConsume',
      kafkaConsumeAction: {
        clusterId: 'c1',
        topic: 'events',
        filter: { jsonPath: '$.status', jsonEquals: 'active' },
      },
    });
    expect(validateKafkaActionConfig(test)).toEqual([]);
  });
});
