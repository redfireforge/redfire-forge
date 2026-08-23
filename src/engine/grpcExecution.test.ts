/**
 * Phase 8C/8D — harness executeNonHttp RequestResult mapping tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import type { Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '../test-utils/factories';
import { executeGrpcAction } from './grpcExecution';
import type { GrpcHarnessOperations } from '@shared/grpc/buildGrpcHarnessOperations';

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-1',
    name: 'Echo unary',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
    },
    ...overrides,
  }) as Scenario;
}

function mockOps(overrides: Partial<GrpcHarnessOperations> = {}): GrpcHarnessOperations {
  return {
    invokeUnary: vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: { 'x-test': '1' },
      body: { message: 'hello' },
      durationMs: 15,
    })),
    collectHarnessServerStream: vi.fn(),
    executeClientStream: vi.fn(),
    executeBidiStream: vi.fn(),
    ...overrides,
  };
}

describe('executeGrpcAction (Phase 8C/8D)', () => {
  it('maps unary success to RequestResult with transportType grpcCall', async () => {
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.transportType).toBe('grpcCall');
    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.method).toBe('UNARY');
    expect(result.grpcResultMeta).toMatchObject({
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      grpcStatus: 0,
      attempts: 1,
    });
    expect(result.responseBody).toContain('hello');
  });

  it('maps unary failure to error RequestResult', async () => {
    const ops = mockOps();
    ops.invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
    }));
    const result = await executeGrpcAction(grpcScenario(), ops);
    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.grpcResultMeta?.grpcStatus).toBe(3);
    expect(result.errorMessage).toBeTruthy();
  });

  it('maps missing grpcHost snapshot failure to serialization errorCategory', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    const ops = mockOps();
    const result = await executeGrpcAction(scenario, ops, { grpcHarnessEnv: { greeting: 'hello' } });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('maps snapshot template failures to serialization errorCategory', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{missingHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    const ops = mockOps();
    const result = await executeGrpcAction(scenario, ops, { grpcHarnessEnv: {} });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('error');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('maps cyclic env variables to serialization errorCategory (Phase 9E)', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    const ops = mockOps();
    const result = await executeGrpcAction(scenario, ops, {
      grpcHarnessEnv: {
        grpcHost: '{{apiHost}}',
        apiHost: '{{grpcHost}}',
      },
    });
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(result.errorMessage).toMatch(/Circular variable reference/);
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });

  it('prefers transport error message when transport and assertions both fail', async () => {
    const ops = mockOps();
    ops.invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcStatus: 0 }, { grpcField: '$.message', equals: 'hello' }],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('INVALID_ARGUMENT');
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
    expect(result.grpcResultMeta?.assertionFailures?.length).toBeGreaterThan(0);
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('error');
  });

  it('returns buildErrorResult when snapshot build fails', async () => {
    const scenario = grpcScenario();
    scenario.grpcCallAction!.target = '{{unresolved}}';
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.passed).toBe(false);
    expect(result.transportType).toBe('grpcCall');
    expect(result.grpcResultMeta?.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(result.errorMessage).toMatch(/unresolved/i);
  });

  it('fails when grpc assertions do not match transport outcome', async () => {
    const ops = mockOps();
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcField: '$.message', equals: 'expected-other' }],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.assertionFailures).toHaveLength(1);
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('failed');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('assertion');
    expect(result.failureDetails.some((d) => d.path === '(grpcAssertion)')).toBe(true);
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
    expect(result.errorMessage).toContain('assertions[0]:');
  });

  it('passes with empty assertionFailures when grpc assertions match', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcStatus: 0 }, { grpcField: '$.message', equals: 'hello' }],
      },
    });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.assertionFailures).toEqual([]);
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('passed');
    expect(result.grpcResultMeta?.harnessResult?.assertionResults).toHaveLength(2);
  });

  it('publishes failed harnessResult with validation error detail when scenario validation fails', async () => {
    const scenario = grpcScenario({
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$.message', expectedValue: 'wrong' }],
      },
    });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('failed');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBeUndefined();
    expect(result.grpcResultMeta?.harnessResult?.errorDetail).toContain('$.message');
    expect(result.errorMessage).toContain('$.message');
    expect(result.errorMessage).toBe(result.grpcResultMeta?.harnessResult?.errorDetail);
  });

  it('keeps RequestResult.passed aligned with harnessResult.status', async () => {
    const ops = mockOps();
    const cases = [
      { label: 'success', scenario: grpcScenario(), expectPassed: true, expectStatus: 'passed' as const },
      {
        label: 'assertion-fail',
        scenario: grpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hello' },
            assertions: [{ grpcField: '$.message', equals: 'wrong' }],
          },
        }),
        expectPassed: false,
        expectStatus: 'failed' as const,
      },
      {
        label: 'transport-fail',
        scenario: grpcScenario(),
        ops: mockOps({
          invokeUnary: vi.fn(async () => ({
            status: 3,
            statusMessage: 'INVALID_ARGUMENT',
            headers: {},
            trailers: {},
            durationMs: 4,
          })),
        }),
        expectPassed: false,
        expectStatus: 'error' as const,
      },
      {
        label: 'validation-fail',
        scenario: grpcScenario({
          validation: {
            mode: 'selective',
            expectedFields: [{ jsonPath: '$.message', expectedValue: 'wrong' }],
          },
        }),
        expectPassed: false,
        expectStatus: 'failed' as const,
      },
    ];

    for (const testCase of cases) {
      const result = await executeGrpcAction(testCase.scenario, testCase.ops ?? ops);
      expect(result.passed, testCase.label).toBe(testCase.expectPassed);
      expect(result.grpcResultMeta?.harnessResult?.status, testCase.label).toBe(testCase.expectStatus);
      if (result.grpcResultMeta?.harnessResult?.errorDetail) {
        expect(result.errorMessage, testCase.label).toBe(result.grpcResultMeta.harnessResult.errorDetail);
      }
    }
  });

  it('skips grpc assertion evaluation when assertions array is cleared (skipAssertions parity)', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [],
      },
    });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.assertionFailures).toBeUndefined();
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('passed');
    expect(result.grpcResultMeta?.harnessResult?.assertionResults).toEqual([]);
  });

  it('prefers terminal body over inbound messages for client_streaming results', async () => {
    const ops = mockOps({
      executeClientStream: vi.fn(async () => ({
        callType: 'client_streaming' as const,
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 4,
        body: { message: 'aggregated' },
        messages: [{ message: 'ignored-inbound' }],
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
        assertions: [{ grpcField: '$.message', equals: 'aggregated' }],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.responseBody).toContain('aggregated');
    expect(result.responseBody).not.toContain('ignored-inbound');
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.assertionFailures).toEqual([]);
  });

  it('uses inbound messages when client_streaming terminal body is empty', async () => {
    const ops = mockOps({
      executeClientStream: vi.fn(async () => ({
        callType: 'client_streaming' as const,
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 4,
        body: {},
        messages: [{ message: 'from-stream' }],
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
        assertions: [{ grpcField: '$.message', equals: 'from-stream' }],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.passed).toBe(true);
    expect(result.responseBody).toContain('from-stream');
  });

  it('evaluates server_streaming grpcStreamField assertions end-to-end', async () => {
    const ops = mockOps({
      collectHarnessServerStream: vi.fn(async () => ({
        callType: 'server_streaming' as const,
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 12,
        messages: [{ n: 1 }, { n: 2 }],
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: {},
        collect: { maxMessages: 5 },
        assertions: [
          { grpcStreamLength: { equals: 2 } },
          { grpcStreamField: '$.n', index: 1, equals: 2 },
        ],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.assertionFailures).toEqual([]);
    expect(result.method).toBe('SERVER_STREAM');
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('passed');
    expect(result.grpcResultMeta?.harnessResult?.assertionResults.map((item) => item.name)).toEqual([
      'grpcStreamLength',
      'grpcStreamField:$.n@1',
    ]);
  });

  it('resolves profile-only scenarios when runtimeOverrides.profiles is supplied', async () => {
    const ops = mockOps();
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '',
        connectionId: 'profile-a',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    const result = await executeGrpcAction(scenario, ops, {
      runtimeOverrides: {
        profiles: [{
          id: 'profile-a',
          name: 'Echo profile',
          target: 'profile-host:50052',
          tlsMode: 'disabled',
        }],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    });
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.target).toBe('profile-host:50052');
    expect(ops.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ address: 'profile-host:50052' }),
      }),
      expect.any(String),
    );
  });
});
