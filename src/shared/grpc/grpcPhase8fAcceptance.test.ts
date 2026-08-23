/**
 * Phase 8F — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { expandDataSource, resolveScenarioFromDataRow } from '@engine/core/dataSourceExpander';
import { executeGrpcAction } from '@engine/grpc/grpcExecution';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { interpolateGrpcHarnessCallAction } from './grpcHarnessDataSourceInterpolation';
import { buildGrpcHarnessRowTraceKey } from './grpcHarnessRowIdentity';
import type { Scenario } from '../types';
import type { GrpcHarnessOperations } from './buildGrpcHarnessOperations';
import { vi } from 'vitest';

describe('Phase 8F acceptance checklist', () => {
  it('exports interpolation and row trace helpers', () => {
    expect(typeof interpolateGrpcHarnessCallAction).toBe('function');
    expect(buildGrpcHarnessRowTraceKey('sc-1', 'row-1')).toBe('sc-1::row-1');
  });

  it('dataSourceExpander wires grpc interpolation', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/core/dataSourceExpander.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('interpolateGrpcHarnessCallAction');
    expect(source).toContain('grpcCallAction');
  });

  it('expanded grpc rows keep unique dataRowId attribution', () => {
    const scenario = {
      id: 'sc-grpc',
      name: 'Param gRPC',
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
        body: { message: '{{msg}}' },
      },
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'c1', name: 'msg', type: 'body', mapping: 'msg' }],
        rows: [
          { id: 'row-a', values: { c1: 'A' }, enabled: true },
          { id: 'row-b', values: { c1: 'B' }, enabled: true },
        ],
        source: { type: 'inline' },
      },
    } as Scenario;

    const expanded = expandDataSource(scenario);
    expect(expanded.map((row) => row.dataRowId)).toEqual(['row-a', 'row-b']);
    expect(expanded[0].grpcCallAction?.body).toEqual({ message: 'A' });
    expect(expanded[1].grpcCallAction?.body).toEqual({ message: 'B' });
  });

  it('classifies unresolved template failures as serialization on grpcResultMeta', async () => {
    const scenario = {
      id: 'sc-grpc-serial',
      name: 'Unresolved',
      url: '',
      method: 'GRPC',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: '{{missingHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    } as Scenario;

    const ops = {
      invokeUnary: vi.fn(),
      collectHarnessServerStream: vi.fn(),
      executeClientStream: vi.fn(),
      executeBidiStream: vi.fn(),
    } as unknown as GrpcHarnessOperations;

    const result = await executeGrpcAction(scenario, ops, { grpcHarnessEnv: {} });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('classifies unresolved assertion templates as serialization after row expand', async () => {
    const scenario = {
      id: 'sc-grpc-assert-serial',
      name: 'Partial assertion',
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
        assertions: [{ grpcTrailer: 'x-order', equals: '{{orderId}}' }],
      },
    } as Scenario;

    const [expanded] = expandDataSource({
      ...scenario,
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'c1', name: 'greeting', type: 'body', mapping: 'greeting' }],
        rows: [{ id: 'row-1', values: { c1: 'hello' }, enabled: true }],
        source: { type: 'inline' },
      },
    });
    expect(expanded.grpcCallAction?.assertions?.[0]).toEqual({
      grpcTrailer: 'x-order',
      equals: '{{orderId}}',
    });

    const ops = {
      invokeUnary: vi.fn(),
      collectHarnessServerStream: vi.fn(),
      executeClientStream: vi.fn(),
      executeBidiStream: vi.fn(),
    } as unknown as GrpcHarnessOperations;

    const result = await executeGrpcAction(expanded, ops, { grpcHarnessEnv: {} });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('classifies unresolved metadata templates as serialization after row expand', async () => {
    const [expanded] = expandDataSource({
      id: 'sc-grpc-meta-serial',
      name: 'Partial metadata',
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
      },
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'c1', name: 'greeting', type: 'body', mapping: 'greeting' }],
        rows: [{ id: 'row-1', values: { c1: 'hello' }, enabled: true }],
        source: { type: 'inline' },
      },
    } as Scenario);

    expect(expanded.grpcCallAction?.metadata?.['x-order']).toBe('{{orderId}}');

    const ops = {
      invokeUnary: vi.fn(),
      collectHarnessServerStream: vi.fn(),
      executeClientStream: vi.fn(),
      executeBidiStream: vi.fn(),
    } as unknown as GrpcHarnessOperations;

    const result = await executeGrpcAction(expanded, ops, { grpcHarnessEnv: {} });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('resolveScenarioFromDataRow leaves env tokens for snapshot-time resolution', () => {
    const scenario = {
      id: 'sc-grpc-env',
      name: 'Env token',
      url: '',
      method: 'GRPC',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
      },
    } as Scenario;

    const resolved = resolveScenarioFromDataRow(
      scenario,
      [{ id: 'c1', name: 'greeting', type: 'body', mapping: 'greeting' }],
      { id: 'r1', values: { c1: 'hello' }, enabled: true },
      0,
    );
    expect(resolved.grpcCallAction?.target).toBe('{{grpcHost}}');
    expect(resolved.grpcCallAction?.body).toEqual({ message: 'hello' });
  });

  it('supports two-phase assertion resolution: data-source row then env snapshot', async () => {
    const scenario = {
      id: 'sc-grpc-two-phase',
      name: 'Two-phase assertion',
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
        assertions: [
          { grpcField: '$.message', equals: '{{greeting}}' },
          { grpcTrailer: 'x-env', equals: '{{traceId}}' },
        ],
      },
      dataSource: {
        id: 'ds-1',
        columns: [
          { id: 'c1', name: 'greeting', type: 'body', mapping: 'greeting' },
        ],
        rows: [{ id: 'row-1', values: { c1: 'hello' }, enabled: true }],
        source: { type: 'inline' },
      },
    } as Scenario;

    const [expanded] = expandDataSource(scenario);
    expect(expanded.grpcCallAction?.assertions?.[0]).toEqual({
      grpcField: '$.message',
      equals: 'hello',
    });
    expect(expanded.grpcCallAction?.assertions?.[1]).toEqual({
      grpcTrailer: 'x-env',
      equals: '{{traceId}}',
    });

    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: { 'x-env': 'trace-9' },
        body: { message: 'hello' },
        durationMs: 3,
      })),
      collectHarnessServerStream: vi.fn(),
      executeClientStream: vi.fn(),
      executeBidiStream: vi.fn(),
    } as unknown as GrpcHarnessOperations;

    const result = await executeGrpcAction(expanded, ops, {
      grpcHarnessEnv: { traceId: 'trace-9' },
    });
    expect(result.passed).toBe(true);
    expect(ops.invokeUnary).toHaveBeenCalledOnce();
  });
});
