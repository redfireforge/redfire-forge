import { describe, it, expect } from 'vitest';
import {
  isKafkaScenario,
  makeDefaultKafkaConsumeAction,
  makeDefaultKafkaProduceAction,
  resolveKafkaActionType,
  validateKafkaActionConfig,
} from './kafkaScenarioDefaults';
import type { Scenario } from '../types';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    method: 'GET',
    url: 'http://example.com',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  } as Scenario;
}

describe('kafkaScenarioDefaults', () => {
  it('makeDefaultKafkaProduceAction returns a valid default config', () => {
    const config = makeDefaultKafkaProduceAction('cluster-1', 'events');
    expect(config.clusterId).toBe('cluster-1');
    expect(config.topic).toBe('events');
    expect(config.acks).toBe(-1);
    expect(config.timeoutMs).toBe(5000);
  });

  it('makeDefaultKafkaConsumeAction returns a valid default config', () => {
    const config = makeDefaultKafkaConsumeAction('cluster-1', 'events');
    expect(config.clusterId).toBe('cluster-1');
    expect(config.topic).toBe('events');
    expect(config.fromBeginning).toBe(false);
    expect(config.timeoutMs).toBe(10000);
    expect(config.maxMessages).toBe(1);
  });

  it('isKafkaScenario returns false for http scenarios', () => {
    expect(isKafkaScenario(makeScenario())).toBe(false);
    expect(isKafkaScenario(makeScenario({ actionType: 'http' }))).toBe(false);
  });

  it('isKafkaScenario returns true for kafka scenarios', () => {
    expect(isKafkaScenario(makeScenario({ actionType: 'kafkaProduce' }))).toBe(true);
    expect(isKafkaScenario(makeScenario({ actionType: 'kafkaConsume' }))).toBe(true);
  });

  it('resolveKafkaActionType defaults to http when actionType is absent', () => {
    expect(resolveKafkaActionType(makeScenario({ actionType: undefined }))).toBe('http');
    expect(resolveKafkaActionType(makeScenario({ actionType: 'kafkaProduce' }))).toBe('kafkaProduce');
  });

  it('validateKafkaActionConfig returns empty array for http scenarios', () => {
    expect(validateKafkaActionConfig(makeScenario())).toEqual([]);
    expect(validateKafkaActionConfig(makeScenario({ actionType: 'http' }))).toEqual([]);
  });

  it('validateKafkaActionConfig requires kafkaProduceAction when actionType is kafkaProduce', () => {
    const errors = validateKafkaActionConfig(makeScenario({ actionType: 'kafkaProduce' }));
    expect(errors).toEqual(['kafkaProduceAction is required when actionType is "kafkaProduce"']);
  });

  it('validateKafkaActionConfig validates kafkaProduceAction fields', () => {
    expect(validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaProduce',
      kafkaProduceAction: makeDefaultKafkaProduceAction('cluster-1', 'events'),
    }))).toEqual([]);

    const errorsCluster = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaProduce',
      kafkaProduceAction: makeDefaultKafkaProduceAction('   ', 'events'),
    }));
    expect(errorsCluster).toContain('kafkaProduceAction.clusterId is required');

    const errorsTopic = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaProduce',
      kafkaProduceAction: makeDefaultKafkaProduceAction('cluster-1', '   '),
    }));
    expect(errorsTopic).toContain('kafkaProduceAction.topic is required');
  });

  it('validateKafkaActionConfig requires kafkaConsumeAction when actionType is kafkaConsume', () => {
    const errors = validateKafkaActionConfig(makeScenario({ actionType: 'kafkaConsume' }));
    expect(errors).toEqual(['kafkaConsumeAction is required when actionType is "kafkaConsume"']);
  });

  it('validateKafkaActionConfig validates kafkaConsumeAction fields', () => {
    expect(validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaConsume',
      kafkaConsumeAction: makeDefaultKafkaConsumeAction('cluster-1', 'events'),
    }))).toEqual([]);

    const errorsCluster = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaConsume',
      kafkaConsumeAction: makeDefaultKafkaConsumeAction('   ', 'events'),
    }));
    expect(errorsCluster).toContain('kafkaConsumeAction.clusterId is required');

    const errorsTopic = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaConsume',
      kafkaConsumeAction: makeDefaultKafkaConsumeAction('cluster-1', '   '),
    }));
    expect(errorsTopic).toContain('kafkaConsumeAction.topic is required');
  });

  it('validateKafkaActionConfig validates kafkaConsumeAction filter.jsonEquals requires jsonPath', () => {
    const errors = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaConsume',
      kafkaConsumeAction: {
        ...makeDefaultKafkaConsumeAction('cluster-1', 'events'),
        filter: { jsonEquals: { key: 'value' } },
      },
    }));
    expect(errors).toContain('kafkaConsumeAction.filter.jsonEquals requires filter.jsonPath to be set');
  });

  it('validateKafkaActionConfig accepts filter with both jsonEquals and jsonPath', () => {
    const errors = validateKafkaActionConfig(makeScenario({
      actionType: 'kafkaConsume',
      kafkaConsumeAction: {
        ...makeDefaultKafkaConsumeAction('cluster-1', 'events'),
        filter: { jsonEquals: { key: 'value' }, jsonPath: '$.key' },
      },
    }));
    expect(errors).toEqual([]);
  });
});
