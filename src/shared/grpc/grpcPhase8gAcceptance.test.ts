/**
 * Phase 8G — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';

describe('Phase 8G acceptance checklist', () => {
  it('exports harness result builder modules', async () => {
    const types = await import('../types/grpc-harness-result');
    expect(types.GRPC_HARNESS_RESULT_SCHEMA_VERSION).toBe('1.0');

    const builder = await import('./grpcHarnessResultBuilder');
    expect(typeof builder.buildGrpcHarnessResult).toBe('function');
    expect(typeof builder.resolveGrpcHarnessResultStatus).toBe('function');
    expect(typeof builder.formatGrpcHarnessResultSummary).toBe('function');
  });

  it('assert engine exports stable assertion names and detailed evaluation', async () => {
    const engine = await import('./grpcHarnessAssertEngine');
    expect(typeof engine.buildGrpcHarnessAssertionName).toBe('function');
    expect(typeof engine.evaluateGrpcHarnessAssertionsDetailed).toBe('function');
  });

  it('grpcExecution wires buildGrpcHarnessResult and publishes harnessResult', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/grpcExecution.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('buildGrpcHarnessResult');
    expect(source).toContain('evaluateGrpcHarnessAssertionsDetailed');
    expect(source).toContain('harnessResult');
  });

  it('GrpcResultMeta includes harnessResult field', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../types/kafka.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('harnessResult?: GrpcHarnessResult');
  });

  it('publishes harnessResult on successful unary execution', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcStatus: 0 }, { grpcField: '$.message', equals: 'hello' }],
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });

    const harness = result.grpcResultMeta?.harnessResult;
    expect(harness?.schemaVersion).toBe(GRPC_HARNESS_RESULT_SCHEMA_VERSION);
    expect(harness?.status).toBe('passed');
    expect(harness?.assertionResults).toHaveLength(2);
    expect(harness?.assertionResults.every((item) => item.passed)).toBe(true);
    assertHarnessInvariants(result, true);
  });

  it('publishes assertion category on harness assertion failure', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcField: '$.message', equals: 'wrong' }],
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });

    expect(result.grpcResultMeta?.harnessResult?.status).toBe('failed');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('assertion');
    expect(result.grpcResultMeta?.errorCategory).toBe('assertion');
    expect(result.grpcResultMeta?.harnessResult?.assertionResults[0]?.name).toBe('grpcField:$.message');
    assertHarnessInvariants(result, false);
  });

  it('publishes serialization error harness result on snapshot failure', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: '{{missingHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    }, { grpcHarnessEnv: {} });

    expect(result.grpcResultMeta?.harnessResult?.status).toBe('error');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
    assertHarnessInvariants(result, false);
  });

  it('always publishes harnessResult including skipAssertions runs', async () => {
    const { buildSelectedTests } = await import('../../features/test-runner/utils/buildSelectedTests');
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const { makeScenario: makeTestScenario } = await import('../../test-utils/factories');
    const fg = {
      name: 'FG',
      scenarios: [{
        id: 'sc-1',
        name: 'Scenario',
        kind: 'standard' as const,
        tests: [makeTestScenario({
          id: 't1',
          actionType: 'grpcCall',
          method: 'GRPC',
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hello' },
            assertions: [{ grpcField: '$.message', equals: 'would-fail' }],
          },
        })],
      }],
    };
    const [selected] = buildSelectedTests(
      [fg],
      new Set(['sc-1']),
      'hardcoded',
      '',
      undefined,
      false,
      true,
      'default',
      'default',
      [],
    );
    const result = await executeGrpcAction(selected, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 3,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('passed');
    expect(result.grpcResultMeta?.harnessResult?.assertionResults).toEqual([]);
    expect(result.grpcResultMeta?.assertionFailures).toBeUndefined();
    assertHarnessInvariants(result, true);
  });

  it('maps DEADLINE_EXCEEDED to timeout harness result end-to-end', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 4,
        statusMessage: 'DEADLINE_EXCEEDED',
        headers: {},
        trailers: {},
        durationMs: 30_000,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });

    expect(result.grpcResultMeta?.harnessResult?.status).toBe('timeout');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('timeout');
    expect(result.grpcResultMeta?.errorCategory).toBe('timeout');
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
    assertHarnessInvariants(result, false);
  });

  it('keeps assertionFailures aligned with failed harness assertionResults messages', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [
          { grpcStatus: 0 },
          { grpcField: '$.message', equals: 'wrong' },
        ],
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });

    const harness = result.grpcResultMeta?.harnessResult;
    const failedMessages = harness?.assertionResults
      .filter((item) => !item.passed)
      .map((item) => item.message);
    expect(result.grpcResultMeta?.assertionFailures).toEqual(failedMessages);
    assertHarnessInvariants(result, false);
  });

  function assertHarnessInvariants(
    result: import('../types').RequestResult,
    expectPassed: boolean,
  ): void {
    const harness = result.grpcResultMeta?.harnessResult;
    expect(harness).toBeDefined();
    expect(result.passed).toBe(expectPassed);
    expect(harness!.status === 'passed').toBe(expectPassed);
    if (expectPassed) {
      expect(harness!.errorCategory).toBeUndefined();
      expect(harness!.errorDetail).toBeUndefined();
      expect(result.errorMessage).toBeUndefined();
      return;
    }
    expect(harness!.errorDetail).toBeTruthy();
    expect(result.errorMessage).toBe(harness!.errorDetail);
  }

  it('publishes dataRowId on harnessResult for expanded parameterized rows', async () => {
    const { expandDataSource } = await import('../../engine/dataSourceExpander');
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
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
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{msg}}' },
      },
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'c1', name: 'msg', type: 'body', mapping: 'msg' }],
        rows: [{ id: 'row-a', values: { c1: 'A' }, enabled: true }],
        source: { type: 'inline' },
      },
    } as import('../types').Scenario;

    const [expanded] = expandDataSource(scenario);
    const result = await executeGrpcAction(expanded, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'A' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });

    expect(result.dataRowId).toBe('row-a');
    expect(result.grpcResultMeta?.harnessResult?.dataRowId).toBe('row-a');
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('passed');
    assertHarnessInvariants(result, true);
  });
});
