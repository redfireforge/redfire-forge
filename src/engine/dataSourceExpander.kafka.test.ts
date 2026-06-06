/**
 * Phase 6C: Parameterized runner support — Kafka field interpolation tests.
 *
 * Covers:
 * - Variable substitution in kafkaProduceAction fields (topic, key, value, headers)
 * - Variable substitution in kafkaConsumeAction fields (topic, filter.*)
 * - Variable substitution in kafkaField assertion values
 * - dataRowId / dataRowLabel attribution flows through to expanded scenarios
 * - Mixed-valid/invalid rows: only rows with matching body columns are substituted
 * - expandDataSource integration: multi-row expansion with Kafka scenarios
 */
import { describe, it, expect } from 'vitest';
import { resolveScenarioFromDataRow, expandDataSource } from './dataSourceExpander';
import type { Scenario, DataSourceColumn, DataSourceRow, Assertion } from '../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBodyCol(id: string, mapping: string): DataSourceColumn {
  return { id, name: mapping, type: 'body', mapping };
}

function makeRow(id: string, values: Record<string, string>): DataSourceRow {
  return { id, values, enabled: true };
}

function makeKafkaProduceScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-kafka-produce',
    name: 'Kafka Produce',
    url: '',
    method: 'KAFKA' as Scenario['method'],
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    actionType: 'kafkaProduce',
    kafkaProduceAction: {
      clusterId: 'cluster-1',
      topic: 'orders.{{env}}',
      key: '{{orderId}}',
      value: '{"orderId":"{{orderId}}","amount":{{amount}}}',
      headers: { 'x-source': '{{source}}', 'static-header': 'no-change' },
    },
    ...overrides,
  } as unknown as Scenario;
}

function makeKafkaConsumeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-kafka-consume',
    name: 'Kafka Consume',
    url: '',
    method: 'KAFKA' as Scenario['method'],
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    actionType: 'kafkaConsume',
    kafkaConsumeAction: {
      clusterId: 'cluster-1',
      topic: 'orders.{{env}}',
      maxMessages: 1,
      timeoutMs: 5000,
      filter: {
        keyEquals: '{{orderId}}',
        jsonEquals: '{{expectedStatus}}',
        headersMatch: { 'x-env': '{{env}}' },
      },
    },
    ...overrides,
  } as unknown as Scenario;
}

// ---------------------------------------------------------------------------
// kafkaProduceAction field interpolation
// ---------------------------------------------------------------------------

describe('resolveScenarioFromDataRow — kafkaProduceAction interpolation', () => {
  const cols: DataSourceColumn[] = [
    makeBodyCol('c-env', 'env'),
    makeBodyCol('c-order', 'orderId'),
    makeBodyCol('c-amount', 'amount'),
    makeBodyCol('c-src', 'source'),
  ];
  const row = makeRow('r1', {
    'c-env': 'prod',
    'c-order': 'order-99',
    'c-amount': '150',
    'c-src': 'web',
  });

  it('substitutes topic', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.kafkaProduceAction?.topic).toBe('orders.prod');
  });

  it('substitutes key', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.kafkaProduceAction?.key).toBe('order-99');
  });

  it('substitutes value (message body)', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.kafkaProduceAction?.value).toBe('{"orderId":"order-99","amount":150}');
  });

  it('substitutes header values but preserves static header keys', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.kafkaProduceAction?.headers?.['x-source']).toBe('web');
    expect(resolved.kafkaProduceAction?.headers?.['static-header']).toBe('no-change');
  });

  it('leaves unresolved {{var}} in place when no matching body column', () => {
    const partialCols: DataSourceColumn[] = [makeBodyCol('c-env', 'env')];
    const partialRow = makeRow('r2', { 'c-env': 'staging' });
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), partialCols, partialRow, 0);
    expect(resolved.kafkaProduceAction?.topic).toBe('orders.staging');
    // orderId was not in body columns — remains as template placeholder
    expect(resolved.kafkaProduceAction?.key).toBe('{{orderId}}');
  });

  it('preserves kafkaProduceAction unchanged when no body columns exist', () => {
    const noCols: DataSourceColumn[] = [];
    const emptyRow = makeRow('r3', {});
    const base = makeKafkaProduceScenario();
    const resolved = resolveScenarioFromDataRow(base, noCols, emptyRow, 0);
    expect(resolved.kafkaProduceAction).toBe(base.kafkaProduceAction); // same reference
  });

  it('handles missing optional key field gracefully', () => {
    const scenario = makeKafkaProduceScenario({
      kafkaProduceAction: {
        clusterId: 'c', topic: 'orders.{{env}}',
        // key is absent
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    expect(resolved.kafkaProduceAction?.key).toBeUndefined();
    expect(resolved.kafkaProduceAction?.topic).toBe('orders.prod');
  });
});

// ---------------------------------------------------------------------------
// kafkaConsumeAction field interpolation
// ---------------------------------------------------------------------------

describe('resolveScenarioFromDataRow — kafkaConsumeAction interpolation', () => {
  const cols: DataSourceColumn[] = [
    makeBodyCol('c-env', 'env'),
    makeBodyCol('c-order', 'orderId'),
    makeBodyCol('c-status', 'expectedStatus'),
  ];
  const row = makeRow('r1', {
    'c-env': 'prod',
    'c-order': 'order-99',
    'c-status': 'SHIPPED',
  });

  it('substitutes topic', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaConsumeScenario(), cols, row, 0);
    expect(resolved.kafkaConsumeAction?.topic).toBe('orders.prod');
  });

  it('substitutes filter.keyEquals', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaConsumeScenario(), cols, row, 0);
    expect(resolved.kafkaConsumeAction?.filter?.keyEquals).toBe('order-99');
  });

  it('substitutes filter.jsonEquals', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaConsumeScenario(), cols, row, 0);
    expect(resolved.kafkaConsumeAction?.filter?.jsonEquals).toBe('SHIPPED');
  });

  it('substitutes filter.headersMatch values', () => {
    const resolved = resolveScenarioFromDataRow(makeKafkaConsumeScenario(), cols, row, 0);
    expect(resolved.kafkaConsumeAction?.filter?.headersMatch?.['x-env']).toBe('prod');
  });

  it('preserves kafkaConsumeAction unchanged when no body columns exist', () => {
    const noCols: DataSourceColumn[] = [];
    const emptyRow = makeRow('r3', {});
    const base = makeKafkaConsumeScenario();
    const resolved = resolveScenarioFromDataRow(base, noCols, emptyRow, 0);
    expect(resolved.kafkaConsumeAction).toBe(base.kafkaConsumeAction); // same reference
  });

  it('handles absent filter gracefully', () => {
    const scenario = makeKafkaConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'c', topic: 'orders.{{env}}', maxMessages: 1, timeoutMs: 5000,
        // no filter
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    expect(resolved.kafkaConsumeAction?.filter).toBeUndefined();
    expect(resolved.kafkaConsumeAction?.topic).toBe('orders.prod');
  });

  it('preserves filter.jsonPath unchanged — jsonPath is a static expression, not interpolated', () => {
    const scenario = makeKafkaConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'cluster-1',
        topic: 'orders.{{env}}',
        maxMessages: 1,
        timeoutMs: 5000,
        filter: {
          keyEquals: '{{orderId}}',
          jsonPath: '$.status',
          jsonEquals: '{{expectedStatus}}',
        },
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    // jsonPath is a static JSONPath expression — variable substitution must NOT occur
    expect(resolved.kafkaConsumeAction?.filter?.jsonPath).toBe('$.status');
    // jsonEquals IS substituted (it's the expected match value)
    expect(resolved.kafkaConsumeAction?.filter?.jsonEquals).toBe('SHIPPED');
    // keyEquals IS substituted too
    expect(resolved.kafkaConsumeAction?.filter?.keyEquals).toBe('order-99');
  });

  it('preserves groupId unchanged — groupId does not support variable interpolation', () => {
    const scenario = makeKafkaConsumeScenario({
      kafkaConsumeAction: {
        clusterId: 'cluster-1',
        topic: 'orders.{{env}}',
        groupId: 'my-group',
        maxMessages: 1,
        timeoutMs: 5000,
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    // groupId is a static identifier — not interpolated
    expect(resolved.kafkaConsumeAction?.groupId).toBe('my-group');
    // topic IS interpolated
    expect(resolved.kafkaConsumeAction?.topic).toBe('orders.prod');
  });
});

// ---------------------------------------------------------------------------
// kafkaField assertion value interpolation
// ---------------------------------------------------------------------------

describe('resolveScenarioFromDataRow — kafkaField assertion interpolation', () => {
  const cols: DataSourceColumn[] = [
    makeBodyCol('c-order', 'orderId'),
    makeBodyCol('c-env', 'env'),
  ];
  const row = makeRow('r1', { 'c-order': 'order-42', 'c-env': 'prod' });

  it('substitutes value in kafkaField assertion', () => {
    const scenario = makeKafkaProduceScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: '{{orderId}}' } as Assertion,
        ],
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    expect(assertion?.type).toBe('kafkaField');
    if (assertion?.type === 'kafkaField') {
      expect(assertion.value).toBe('order-42');
    }
  });

  it('substitutes multiple kafkaField assertions independently', () => {
    const scenario = makeKafkaProduceScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: '{{orderId}}' } as Assertion,
          { type: 'kafkaField', target: 'kafka.header.x-env', operator: 'equals', value: '{{env}}' } as Assertion,
        ],
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const [a0, a1] = resolved.validation.assertions ?? [];
    if (a0?.type === 'kafkaField') expect(a0.value).toBe('order-42');
    if (a1?.type === 'kafkaField') expect(a1.value).toBe('prod');
  });

  it('does not mutate non-kafkaField assertions', () => {
    const scenario = makeKafkaProduceScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: '{{orderId}}' } as Assertion,
          { type: 'status', expected: '200' } as Assertion,
          { type: 'header', name: 'x-req-id', operator: 'exists' } as Assertion,
        ],
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const [kf, status, header] = resolved.validation.assertions ?? [];
    if (kf?.type === 'kafkaField') expect(kf.value).toBe('order-42');
    expect(status?.type).toBe('status');
    expect(header?.type).toBe('header');
  });

  it('leaves kafkaField value unchanged when no matching body column', () => {
    const scenario = makeKafkaProduceScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: '{{missingVar}}' } as Assertion,
        ],
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'kafkaField') {
      expect(assertion.value).toBe('{{missingVar}}');
    }
  });

  it('skips assertion substitution when kafkaField.value is undefined (exists operator)', () => {
    const scenario = makeKafkaProduceScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'kafkaField', target: 'kafka.key', operator: 'exists' } as Assertion,
        ],
      },
    });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'kafkaField') {
      expect(assertion.value).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// dataRowId / dataRowLabel attribution
// ---------------------------------------------------------------------------

describe('resolveScenarioFromDataRow — dataRowId/dataRowLabel attribution', () => {
  const cols: DataSourceColumn[] = [makeBodyCol('c-env', 'env')];

  it('sets dataRowId from row.id', () => {
    const row = makeRow('row-abc', { 'c-env': 'prod' });
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.dataRowId).toBe('row-abc');
  });

  it('sets dataRowLabel with row index', () => {
    const row = makeRow('row-1', { 'c-env': 'prod' });
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 2);
    expect(resolved.dataRowLabel).toMatch(/^Row 3/); // label starts with "Row 3" (may include column value suffix)
  });

  it('clears dataSource after expansion', () => {
    const row = makeRow('r1', { 'c-env': 'staging' });
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    expect(resolved.dataSource).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// expandDataSource integration — multi-row Kafka expansion
// ---------------------------------------------------------------------------

describe('expandDataSource — multi-row Kafka produce expansion', () => {
  it('expands to one resolved scenario per enabled row', () => {
    const scenario: Scenario = {
      ...makeKafkaProduceScenario(),
      dataSource: {
        columns: [
          makeBodyCol('c-env', 'env'),
          makeBodyCol('c-order', 'orderId'),
        ],
        rows: [
          makeRow('r1', { 'c-env': 'prod', 'c-order': 'order-1' }),
          makeRow('r2', { 'c-env': 'staging', 'c-order': 'order-2' }),
          { id: 'r3', values: { 'c-env': 'dev', 'c-order': 'order-3' }, enabled: false },
        ],
      },
    } as unknown as Scenario;

    const expanded = expandDataSource(scenario);
    expect(expanded).toHaveLength(2); // r3 is disabled
    expect(expanded[0].kafkaProduceAction?.topic).toBe('orders.prod');
    expect(expanded[0].kafkaProduceAction?.key).toBe('order-1');
    expect(expanded[0].dataRowId).toBe('r1');
    expect(expanded[1].kafkaProduceAction?.topic).toBe('orders.staging');
    expect(expanded[1].kafkaProduceAction?.key).toBe('order-2');
    expect(expanded[1].dataRowId).toBe('r2');
  });

  it('each expanded row has its dataSource cleared', () => {
    const scenario: Scenario = {
      ...makeKafkaProduceScenario(),
      dataSource: {
        columns: [makeBodyCol('c-env', 'env')],
        rows: [makeRow('r1', { 'c-env': 'prod' })],
      },
    } as unknown as Scenario;

    const [expanded] = expandDataSource(scenario);
    expect(expanded.dataSource).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Mixed-valid / mixed-invalid rows
// ---------------------------------------------------------------------------

describe('mixed-valid/invalid row expansion', () => {
  it('substitutes body column with empty string value — replaces {{var}} with empty string', () => {
    const cols: DataSourceColumn[] = [makeBodyCol('c-order', 'orderId')];
    // row has an orderId column but its value is empty string
    const row = makeRow('r1', { 'c-order': '' });
    const resolved = resolveScenarioFromDataRow(makeKafkaProduceScenario(), cols, row, 0);
    // Empty string value substitutes {{orderId}} with ''
    expect(resolved.kafkaProduceAction?.key).toBe('');
  });

  it('mixed produce + consume scenario row-set: both expanded correctly', () => {
    const produceScenario: Scenario = {
      ...makeKafkaProduceScenario(),
      dataSource: {
        columns: [makeBodyCol('c-env', 'env')],
        rows: [makeRow('r1', { 'c-env': 'prod' })],
      },
    } as unknown as Scenario;

    const consumeScenario: Scenario = {
      ...makeKafkaConsumeScenario(),
      dataSource: {
        columns: [makeBodyCol('c-env', 'env')],
        rows: [makeRow('r1', { 'c-env': 'prod' })],
      },
    } as unknown as Scenario;

    const [produce] = expandDataSource(produceScenario);
    const [consume] = expandDataSource(consumeScenario);

    expect(produce.kafkaProduceAction?.topic).toBe('orders.prod');
    expect(consume.kafkaConsumeAction?.topic).toBe('orders.prod');
    expect(produce.dataRowId).toBe('r1');
    expect(consume.dataRowId).toBe('r1');
  });
});

// ---------------------------------------------------------------------------
// HTTP scenario is unaffected
// ---------------------------------------------------------------------------

describe('resolveScenarioFromDataRow — HTTP scenarios unaffected', () => {
  it('HTTP scenario with body columns still resolves body correctly', () => {
    const scenario: Scenario = {
      id: 'http-1',
      name: 'HTTP POST',
      url: 'https://api.example.com/orders',
      method: 'POST',
      headers: [],
      body: '{"id":"{{orderId}}"}',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    };
    const cols: DataSourceColumn[] = [makeBodyCol('c-order', 'orderId')];
    const row = makeRow('r1', { 'c-order': 'order-1' });
    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    expect(resolved.body).toBe('{"id":"order-1"}');
    expect(resolved.kafkaProduceAction).toBeUndefined();
    expect(resolved.kafkaConsumeAction).toBeUndefined();
  });
});
