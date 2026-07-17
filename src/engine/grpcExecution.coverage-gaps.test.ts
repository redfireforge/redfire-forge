/**
 * Coverage gaps — grpcExecution.ts (Phase 8C/8D runner mapping).
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../shared/grpc/contractFixtures';
import type { Scenario } from '../shared/types';
import { makeScenario as _makeScenario } from '../test-utils/factories';
import { executeGrpcAction } from './grpcExecution';
import type { GrpcHarnessOperations } from '../shared/grpc/buildGrpcHarnessOperations';
import * as buildOpsModule from '../shared/grpc/buildGrpcHarnessOperations';
import * as harnessExecutor from '../shared/grpc/grpcHarnessExecutor';
import * as grpcHarnessResultBuilder from '../shared/grpc/grpcHarnessResultBuilder';
import * as validationResultModule from './validationResult';

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-exec-gap',
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
      trailers: {},
      body: { message: 'hello' },
      durationMs: 15,
    })),
    collectHarnessServerStream: vi.fn(),
    executeClientStream: vi.fn(),
    executeBidiStream: vi.fn(),
    ...overrides,
  };
}

describe('grpcExecution coverage gaps', () => {
  it('maps bidi_streaming success with message response body', async () => {
    const ops = mockOps({
      executeBidiStream: vi.fn(async () => ({
        callType: 'bidi_streaming' as const,
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 9,
        messages: [{ n: 1 }, { n: 2 }],
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'BidiStream',
        sendMessages: [{ message: 'ping' }],
        collect: { maxMessages: 2 },
        assertions: [{ grpcStreamLength: { equals: 2 } }],
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.method).toBe('BIDI_STREAM');
    expect(result.passed).toBe(true);
    expect(result.responseBody).toContain('"n": 2');
  });

  it('uses grpcHarnessEnv and runtimeOverrides merge path', async () => {
    const ops = mockOps();
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
    const result = await executeGrpcAction(scenario, ops, {
      grpcHarnessEnv: { grpcHost: 'env-host:50051' },
      runtimeOverrides: {
        profiles: [],
        pageDefaults: { target: 'ignored:50051', tlsMode: 'disabled' },
      },
    });
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.target).toBe('env-host:50051');
  });

  it('maps client_streaming and server_streaming method labels', async () => {
    const clientOps = mockOps({
      executeClientStream: vi.fn(async () => ({
        callType: 'client_streaming' as const,
        passed: true,
        grpcStatus: 0,
        durationMs: 4,
        body: { ok: true },
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const clientResult = await executeGrpcAction(grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
      },
    }), clientOps);
    expect(clientResult.method).toBe('CLIENT_STREAM');

    const streamOps = mockOps({
      collectHarnessServerStream: vi.fn(async () => ({
        callType: 'server_streaming' as const,
        passed: true,
        grpcStatus: 0,
        durationMs: 4,
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const streamResult = await executeGrpcAction(grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    }), streamOps);
    expect(streamResult.method).toBe('SERVER_STREAM');
    expect(streamResult.responseBody).toBe('');
  });

  it('maps internal pre-transport errors when snapshot build throws non-serialization error', async () => {
    const scenario = grpcScenario();
    const ops = mockOps({
      invokeUnary: vi.fn(async () => {
        throw new Error('unexpected invoke failure');
      }),
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('internal');
  });

  it('maps serialization and missing grpcCallAction error paths', async () => {
    const scenario = grpcScenario();
    scenario.grpcCallAction!.target = '{{unresolved}}';
    const result = await executeGrpcAction(scenario, mockOps(), { grpcHarnessEnv: {} });
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');

    const broken = grpcScenario();
    broken.grpcCallAction = undefined;
    const internal = await executeGrpcAction(broken, mockOps());
    expect(internal.passed).toBe(false);
    expect(internal.transportType).toBe('grpcCall');
  });

  it('surfaces validation failure detail on selective field mismatch', async () => {
    const scenario = grpcScenario({
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$.message', expectedValue: 'wrong' }],
      },
    });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('$.message');
  });

  it('uses default transport error message when failure lacks grpc status text', async () => {
    const ops = mockOps({
      invokeUnary: vi.fn(async () => ({
        status: 13,
        durationMs: 2,
        headers: {},
        trailers: {},
      })),
    });
    const result = await executeGrpcAction(grpcScenario(), ops);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('uses createGrpcHarnessSnapshotBuildContext when runtimeOverrides are omitted', async () => {
    const result = await executeGrpcAction(grpcScenario(), mockOps(), {
      grpcHarnessEnv: { grpcHost: 'localhost:50051' },
    });
    expect(result.passed).toBe(true);
  });

  it('builds harness error result for non-serialization invoke failures', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    const result = await executeGrpcAction(scenario, mockOps({
      invokeUnary: vi.fn(async () => {
        throw new Error('invoke blew up');
      }),
    }));
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('internal');
    expect(result.errorMessage).toContain('invoke blew up');
  });

  it('maps non-Error invoke failures through harness error builder', async () => {
    const scenario = grpcScenario();
    const result = await executeGrpcAction(scenario, mockOps({
      invokeUnary: vi.fn(async () => {
        throw 'plain invoke failure';
      }),
    }));
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('plain invoke failure');
  });

  it('defaults validation config when scenario omits validation block', async () => {
    const scenario = grpcScenario({ validation: undefined });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.validationMode).toBe('none');
    expect(result.passed).toBe(true);
  });

  it('builds default harness operations when executeGrpcAction omits operations', async () => {
    const builtOps = mockOps();
    const buildSpy = vi.spyOn(buildOpsModule, 'buildGrpcHarnessOperations').mockReturnValue(builtOps);
    const result = await executeGrpcAction(grpcScenario());
    expect(buildSpy).toHaveBeenCalled();
    expect(result.passed).toBe(true);
    buildSpy.mockRestore();
  });

  it('uses existing responseTimeMs when harness error result omits startedAt', async () => {
    const scenario = grpcScenario();
    scenario.grpcCallAction!.target = '{{unresolved}}';
    const result = await executeGrpcAction(scenario, mockOps(), { grpcHarnessEnv: {} });
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('labels unknown transport call types as GRPC in request method', async () => {
    const ops = mockOps({
      executeBidiStream: vi.fn(async () => ({
        callType: 'legacy' as never,
        passed: true,
        grpcStatus: 0,
        durationMs: 2,
        attempts: 1,
        streamStopReason: 'stream_end' as const,
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
        collect: { maxMessages: 1 },
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.method).toBe('GRPC');
  });

  it('maps non-Error snapshot build failures through harness error builder', async () => {
    const buildSpy = vi.spyOn(harnessExecutor, 'buildGrpcHarnessSnapshotForScenario')
      .mockImplementation(() => {
        throw 'snapshot exploded';
      });
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.errorMessage).toContain('snapshot exploded');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('internal');
    buildSpy.mockRestore();
  });

  it('uses cfg defaults when grpcCallAction omits callType during error mapping', async () => {
    const scenario = grpcScenario();
    delete (scenario.grpcCallAction as { callType?: string }).callType;
    const buildSpy = vi.spyOn(harnessExecutor, 'buildGrpcHarnessSnapshotForScenario')
      .mockImplementation(() => {
        throw new Error('forced build failure');
      });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.method).toBe('UNARY');
    expect(result.grpcResultMeta?.target).toBe(FIXTURE_UNARY_CALL_REQUEST.target.address);
    buildSpy.mockRestore();
  });

  it('falls back to transport errorMessage when harness errorDetail is absent', async () => {
    const buildSpy = vi.spyOn(harnessExecutor, 'buildGrpcHarnessSnapshotForScenario')
      .mockImplementation(() => {
        throw new Error('forced build failure');
      });
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.errorMessage).toContain('forced build failure');
    buildSpy.mockRestore();
  });

  it('returns empty config service method when grpcCallAction is missing', async () => {
    const broken = grpcScenario();
    broken.grpcCallAction = undefined;
    const result = await executeGrpcAction(broken, mockOps());
    expect(result.passed).toBe(false);
    expect(result.transportType).toBe('grpcCall');
  });

  it('uses validation failure detail fallback when failureDetails are empty', async () => {
    const validationSpy = vi.spyOn(validationResultModule, 'buildValidationResult').mockReturnValue({
      passed: false,
      failureDetails: [],
      errorMessage: 'validation failed without details',
    });
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('validation failed without details');
    validationSpy.mockRestore();
  });

  it('maps server_streaming unary-style body fallback when only body is present', async () => {
    const ops = mockOps({
      collectHarnessServerStream: vi.fn(async () => ({
        callType: 'server_streaming' as const,
        passed: true,
        grpcStatus: 0,
        durationMs: 5,
        body: { summary: 'only-body' },
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
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    const result = await executeGrpcAction(scenario, ops);
    expect(result.responseBody).toContain('only-body');
  });

  it('prefers transport errorDetail over grpcStatusMessage when call fails', async () => {
    const ops = mockOps({
      invokeUnary: vi.fn(async () => ({
        callType: 'unary' as const,
        passed: false,
        grpcStatus: 13,
        grpcStatusMessage: 'INTERNAL',
        errorDetail: 'custom transport detail',
        durationMs: 3,
        headers: {},
        trailers: {},
        attempts: 1,
      })),
    });
    const result = await executeGrpcAction(grpcScenario(), ops);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('custom transport detail');
  });

  it('formats validation failure detail from failureDetails when errorMessage is absent', async () => {
    const validationSpy = vi.spyOn(validationResultModule, 'buildValidationResult').mockReturnValue({
      passed: false,
      failureDetails: [{ path: '$.payload', expected: 'alpha', actual: 'beta' }],
    });
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('$.payload: expected alpha, got beta');
    validationSpy.mockRestore();
  });

  it('returns undefined validation failure detail when failureDetails are empty', async () => {
    const validationSpy = vi.spyOn(validationResultModule, 'buildValidationResult').mockReturnValue({
      passed: false,
      failureDetails: [],
    });
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.harnessResult?.errorDetail).toBeUndefined();
    validationSpy.mockRestore();
  });

  it('falls back to buildErrorResult message when harness errorDetail is absent', async () => {
    const buildSpy = vi.spyOn(harnessExecutor, 'buildGrpcHarnessSnapshotForScenario')
      .mockImplementation(() => {
        throw new Error('snapshot build failed');
      });
    const harnessSpy = vi.spyOn(grpcHarnessResultBuilder, 'buildGrpcHarnessResult')
      .mockReturnValue({
        schemaVersion: 1,
        scenarioId: 'grpc-exec-gap',
        callType: 'unary',
        status: 'error',
        durationMs: 0,
        assertionResults: [],
        errorCategory: 'internal',
        errorDetail: undefined,
      });
    try {
      const result = await executeGrpcAction(grpcScenario(), mockOps());
      expect(result.errorMessage).toContain('snapshot build failed');
    } finally {
      buildSpy.mockRestore();
      harnessSpy.mockRestore();
    }
  });

  it('uses cfg.target when error mapping receives undefined target override', async () => {
    const buildSpy = vi.spyOn(harnessExecutor, 'buildGrpcHarnessSnapshotForScenario')
      .mockImplementation(() => {
        throw new Error('forced build failure');
      });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: 'resolved-host:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    let targetReads = 0;
    Object.defineProperty(scenario.grpcCallAction!, 'target', {
      configurable: true,
      get() {
        targetReads += 1;
        return targetReads === 1 ? undefined : 'resolved-host:50051';
      },
    });
    const result = await executeGrpcAction(scenario, mockOps());
    expect(result.grpcResultMeta?.target).toBe('resolved-host:50051');
    buildSpy.mockRestore();
  });

  it('omits grpcResultMeta errorCategory when harness result has no category', async () => {
    const result = await executeGrpcAction(grpcScenario(), mockOps());
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.harnessResult).toBeDefined();
    expect(result.grpcResultMeta?.errorCategory).toBeUndefined();
  });
});
