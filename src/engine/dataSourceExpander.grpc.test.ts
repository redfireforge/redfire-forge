/**
 * Phase 8F — gRPC harness data-source expansion tests.
 */
import { describe, expect, it } from 'vitest';
import { expandDataSource, expandDataSourceForRows, expandQueue, resolveScenarioFromDataRow, resolveSharedDataSource } from './dataSourceExpander';
import type { DataSourceColumn, DataSourceRow, Scenario } from '../shared/types';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../shared/grpc/contractFixtures';
import { buildGrpcHarnessRowTraceKey } from '../shared/grpc/grpcHarnessRowIdentity';

function makeBodyCol(id: string, mapping: string): DataSourceColumn {
  return { id, name: mapping, type: 'body', mapping };
}

function makeRow(id: string, values: Record<string, string>): DataSourceRow {
  return { id, values, enabled: true };
}

function makeGrpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-grpc-param',
    name: 'gRPC parameterized',
    url: '',
    method: 'GRPC',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: '{{greeting}}' },
      metadata: { 'x-order': '{{orderId}}' },
      assertions: [
        { grpcField: '$.message', equals: '{{greeting}}' },
        { grpcTrailer: 'x-order', equals: '{{orderId}}' },
      ],
    },
    ...overrides,
  } as Scenario;
}

describe('resolveScenarioFromDataRow — grpcCallAction interpolation (Phase 8F)', () => {
  const cols: DataSourceColumn[] = [
    makeBodyCol('c-greeting', 'greeting'),
    makeBodyCol('c-order', 'orderId'),
  ];

  it('substitutes body-column vars into grpcCallAction fields', () => {
    const row = makeRow('r1', { 'c-greeting': 'hello', 'c-order': 'order-99' });
    const resolved = resolveScenarioFromDataRow(makeGrpcScenario(), cols, row, 0);
    expect(resolved.grpcCallAction?.body).toEqual({ message: 'hello' });
    expect(resolved.grpcCallAction?.metadata).toEqual({ 'x-order': 'order-99' });
    expect(resolved.grpcCallAction?.assertions?.[0]).toEqual({
      grpcField: '$.message',
      equals: 'hello',
    });
    expect(resolved.grpcCallAction?.assertions?.[1]).toEqual({
      grpcTrailer: 'x-order',
      equals: 'order-99',
    });
  });

  it('substitutes target and connectionId templates', () => {
    const scenario = makeGrpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}:{{port}}',
        connectionId: '{{profileId}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
      },
    });
    const resolved = resolveScenarioFromDataRow(
      scenario,
      [
        makeBodyCol('c-greeting', 'greeting'),
        makeBodyCol('c-port', 'port'),
        makeBodyCol('c-profile', 'profileId'),
      ],
      makeRow('r1', { 'c-greeting': 'hi', 'c-port': '50051', 'c-profile': 'profile-a' }),
      0,
    );
    expect(resolved.grpcCallAction?.target).toBe('{{grpcHost}}:50051');
    expect(resolved.grpcCallAction?.connectionId).toBe('profile-a');
  });

  it('leaves unresolved templates when no matching body column exists', () => {
    const partialCols = [makeBodyCol('c-greeting', 'greeting')];
    const resolved = resolveScenarioFromDataRow(
      makeGrpcScenario(),
      partialCols,
      makeRow('r1', { 'c-greeting': 'hello' }),
      0,
    );
    expect(resolved.grpcCallAction?.body).toEqual({ message: 'hello' });
    expect(resolved.grpcCallAction?.metadata?.['x-order']).toBe('{{orderId}}');
    expect(resolved.grpcCallAction?.assertions?.[1]).toEqual({
      grpcTrailer: 'x-order',
      equals: '{{orderId}}',
    });
  });

  it('sets dataRowId and dataRowLabel for traceability', () => {
    const row = makeRow('row-abc', { 'c-greeting': 'hi', 'c-order': '1' });
    const resolved = resolveScenarioFromDataRow(makeGrpcScenario(), cols, row, 2);
    expect(resolved.dataRowId).toBe('row-abc');
    expect(resolved.dataRowLabel).toMatch(/^Row 3/);
    expect(buildGrpcHarnessRowTraceKey(resolved.id, resolved.dataRowId!)).toBe('sc-grpc-param::row-abc');
  });

  it('preserves grpcCallAction reference when no body columns exist', () => {
    const base = makeGrpcScenario();
    const resolved = resolveScenarioFromDataRow(base, [], makeRow('r1', {}), 0);
    expect(resolved.grpcCallAction).toBe(base.grpcCallAction);
  });
});

describe('expandDataSource — multi-row gRPC expansion (Phase 8F)', () => {
  it('expands enabled rows with unique dataRowId values in stable order', () => {
    const scenario = makeGrpcScenario({
      dataSource: {
        id: 'ds-grpc',
        columns: [
          makeBodyCol('c-greeting', 'greeting'),
          makeBodyCol('c-order', 'orderId'),
        ],
        rows: [
          makeRow('r1', { 'c-greeting': 'one', 'c-order': 'o1' }),
          makeRow('r2', { 'c-greeting': 'two', 'c-order': 'o2' }),
        ],
        source: { type: 'inline' },
        distribution: 'sequential',
      },
    });

    const expanded = expandDataSource(scenario);
    expect(expanded).toHaveLength(2);
    expect(expanded[0].dataRowId).toBe('r1');
    expect(expanded[1].dataRowId).toBe('r2');
    expect(expanded[0].grpcCallAction?.body).toEqual({ message: 'one' });
    expect(expanded[1].grpcCallAction?.body).toEqual({ message: 'two' });
    expect(expanded[0].dataSource).toBeUndefined();
    expect(expanded[1].dataSource).toBeUndefined();
  });

  it('expands only selected row ids via expandDataSourceForRows', () => {
    const scenario = makeGrpcScenario({
      dataSource: {
        id: 'ds-grpc',
        columns: [
          makeBodyCol('c-greeting', 'greeting'),
          makeBodyCol('c-order', 'orderId'),
        ],
        rows: [
          makeRow('r1', { 'c-greeting': 'one', 'c-order': 'o1' }),
          makeRow('r2', { 'c-greeting': 'two', 'c-order': 'o2' }),
        ],
        source: { type: 'inline' },
      },
    });

    const expanded = expandDataSourceForRows(scenario, ['r2']);
    expect(expanded).toHaveLength(1);
    expect(expanded[0].dataRowId).toBe('r2');
    expect(expanded[0].grpcCallAction?.body).toEqual({ message: 'two' });
  });
});

describe('expandQueue — gRPC parameterized scenarios (Phase 8F)', () => {
  it('expands grpc scenarios inside a queue', () => {
    const scenario = makeGrpcScenario({
      dataSource: {
        id: 'ds-grpc',
        columns: [makeBodyCol('c-greeting', 'greeting')],
        rows: [
          makeRow('r1', { 'c-greeting': 'alpha' }),
          makeRow('r2', { 'c-greeting': 'beta' }),
        ],
        source: { type: 'inline' },
      },
    });

    const expanded = expandQueue([scenario]);
    expect(expanded).toHaveLength(2);
    expect(expanded.map((row) => row.dataRowId)).toEqual(['r1', 'r2']);
    expect(expanded[1].grpcCallAction?.body).toEqual({ message: 'beta' });
  });
});

describe('resolveSharedDataSource + expandDataSource — gRPC (Phase 8F)', () => {
  it('expands grpc scenarios that reference a shared data source', () => {
    const shared = {
      id: 'shared-ds',
      name: 'Shared',
      dataSource: {
        id: 'ds-shared',
        columns: [makeBodyCol('c-greeting', 'greeting')],
        rows: [makeRow('r1', { 'c-greeting': 'from-shared' })],
        source: { type: 'inline' as const },
      },
    };

    const scenario = makeGrpcScenario({
      sharedDataSourceId: 'shared-ds',
      dataSource: undefined,
    });

    const resolved = resolveSharedDataSource(scenario, [shared]);
    const expanded = expandDataSource(resolved);
    expect(expanded).toHaveLength(1);
    expect(expanded[0].grpcCallAction?.body).toEqual({ message: 'from-shared' });
    expect(expanded[0].dataRowId).toBe('r1');
  });
});
