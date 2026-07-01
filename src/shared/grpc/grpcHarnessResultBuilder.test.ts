/**
 * Phase 8G — gRPC harness result builder tests.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';
import {
  GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR,
  GRPC_STATUS_DEADLINE_EXCEEDED,
  buildGrpcHarnessResult,
  formatGrpcHarnessResultSummary,
  resolveGrpcHarnessErrorCategory,
  resolveGrpcHarnessResultStatus,
} from './grpcHarnessResultBuilder';

function unaryOutcome(overrides: Partial<GrpcHarnessCallOutcome> = {}): GrpcHarnessCallOutcome {
  return {
    callType: 'unary',
    passed: true,
    grpcStatus: 0,
    grpcStatusMessage: 'OK',
    durationMs: 12,
    body: { message: 'hello' },
    attempts: 1,
    ...overrides,
  };
}

describe('resolveGrpcHarnessResultStatus (Phase 8G)', () => {
  it('applies strict precedence timeout > error > failed > passed', () => {
    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: false,
      assertionsPassed: false,
      validationPassed: false,
      errorCategory: 'timeout',
      grpcStatus: 0,
    })).toBe('timeout');

    expect(resolveGrpcHarnessResultStatus({
      preTransportError: true,
      transportPassed: false,
      assertionsPassed: true,
      validationPassed: true,
    })).toBe('error');

    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: false,
      assertionsPassed: true,
      validationPassed: true,
      errorCategory: 'network',
    })).toBe('error');

    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: true,
      assertionsPassed: false,
      validationPassed: true,
    })).toBe('failed');

    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: true,
      assertionsPassed: true,
      validationPassed: true,
    })).toBe('passed');
  });

  it('maps grpc DEADLINE_EXCEEDED to timeout even when transport passed flag is false', () => {
    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: false,
      assertionsPassed: true,
      validationPassed: true,
      grpcStatus: GRPC_STATUS_DEADLINE_EXCEEDED,
    })).toBe('timeout');
  });
});

describe('resolveGrpcHarnessErrorCategory (Phase 8G)', () => {
  it('maps transport, assertion, and pre-transport categories', () => {
    expect(resolveGrpcHarnessErrorCategory({
      preTransportCategory: 'serialization',
      assertionsPassed: true,
      harnessAssertionsConfigured: false,
    })).toBe('serialization');

    expect(resolveGrpcHarnessErrorCategory({
      transportOutcome: unaryOutcome({ passed: false, errorCategory: 'network' }),
      assertionsPassed: true,
      harnessAssertionsConfigured: false,
    })).toBe('network');

    expect(resolveGrpcHarnessErrorCategory({
      transportOutcome: unaryOutcome({
        passed: false,
        grpcStatus: GRPC_STATUS_DEADLINE_EXCEEDED,
      }),
      assertionsPassed: true,
      harnessAssertionsConfigured: false,
    })).toBe('timeout');

    expect(resolveGrpcHarnessErrorCategory({
      transportOutcome: unaryOutcome(),
      assertionsPassed: false,
      harnessAssertionsConfigured: true,
    })).toBe('assertion');
  });

  it('leaves category undefined for validation-only failures', () => {
    expect(resolveGrpcHarnessErrorCategory({
      transportOutcome: unaryOutcome(),
      assertionsPassed: true,
      harnessAssertionsConfigured: false,
    })).toBeUndefined();
    expect(resolveGrpcHarnessResultStatus({
      preTransportError: false,
      transportPassed: true,
      assertionsPassed: true,
      validationPassed: false,
    })).toBe('failed');
  });
});

describe('buildGrpcHarnessResult (Phase 8G)', () => {
  it('builds passed result with schema version and assertion results', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      dataRowId: 'row-2',
      callType: 'unary',
      durationMs: 15,
      transportOutcome: unaryOutcome(),
      assertionResults: [
        { name: 'grpcStatus', passed: true },
        { name: 'grpcField:$.message', passed: true },
      ],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(result.schemaVersion).toBe(GRPC_HARNESS_RESULT_SCHEMA_VERSION);
    expect(result.status).toBe('passed');
    expect(result.dataRowId).toBe('row-2');
    expect(result.assertionResults).toHaveLength(2);
    expect(result.errorCategory).toBeUndefined();
  });

  it('prefers transport error over assertion failure for status', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 8,
      transportOutcome: unaryOutcome({
        passed: false,
        grpcStatus: 3,
        grpcStatusMessage: 'INVALID_ARGUMENT',
        errorDetail: 'INVALID_ARGUMENT',
      }),
      assertionResults: [
        { name: 'grpcField:$.message', passed: false, message: 'assertions[0]: mismatch' },
      ],
      assertionsPassed: false,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(result.status).toBe('error');
    expect(result.errorCategory).toBe('internal');
    expect(result.errorDetail).toBe('INVALID_ARGUMENT');
  });

  it('builds failed assertion result with assertion category', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 5,
      transportOutcome: unaryOutcome(),
      assertionResults: [
        { name: 'grpcField:$.message', passed: false, message: 'assertions[0]: equals expected "x", got "hello"' },
      ],
      assertionsPassed: false,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(result.status).toBe('failed');
    expect(result.errorCategory).toBe('assertion');
    expect(result.errorDetail).toContain('assertions[0]:');
  });

  it('builds pre-transport serialization error result', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 0,
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
      preTransportError: {
        errorCategory: 'serialization',
        errorDetail: 'unresolved template variables in target',
      },
    });
    expect(result.status).toBe('error');
    expect(result.errorCategory).toBe('serialization');
    expect(result.grpcStatus).toBeUndefined();
  });

  it('builds failed validation result with validation error detail', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 9,
      transportOutcome: unaryOutcome(),
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: false,
      harnessAssertionsConfigured: false,
      validationFailureDetail: '$.message: expected "x", got "hello"',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCategory).toBeUndefined();
    expect(result.errorDetail).toBe('$.message: expected "x", got "hello"');
  });

  it('uses default transport diagnostic when failed outcome omits explicit detail', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 3,
      transportOutcome: unaryOutcome({
        passed: false,
        grpcStatus: 13,
        errorDetail: undefined,
        grpcStatusMessage: undefined,
      }),
      assertionResults: [
        { name: 'grpcField:$.message', passed: false, message: 'assertions[0]: mismatch' },
      ],
      assertionsPassed: false,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(result.status).toBe('error');
    expect(result.errorDetail).toBe(GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR);
  });

  it('maps DEADLINE_EXCEEDED transport outcome to timeout status and category', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 30_000,
      transportOutcome: unaryOutcome({
        passed: false,
        grpcStatus: GRPC_STATUS_DEADLINE_EXCEEDED,
        grpcStatusMessage: 'DEADLINE_EXCEEDED',
        errorDetail: 'DEADLINE_EXCEEDED',
        errorCategory: 'internal',
      }),
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
    });
    expect(result.status).toBe('timeout');
    expect(result.errorCategory).toBe('timeout');
    expect(result.errorDetail).toBe('DEADLINE_EXCEEDED');
  });

  it('always sets errorDetail when status is not passed', () => {
    const cases = [
      buildGrpcHarnessResult({
        scenarioId: 'sc-1',
        callType: 'unary',
        durationMs: 8,
        transportOutcome: unaryOutcome({
          passed: false,
          grpcStatus: 3,
          grpcStatusMessage: 'INVALID_ARGUMENT',
          errorDetail: 'INVALID_ARGUMENT',
        }),
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: true,
        harnessAssertionsConfigured: false,
      }),
      buildGrpcHarnessResult({
        scenarioId: 'sc-1',
        callType: 'unary',
        durationMs: 5,
        transportOutcome: unaryOutcome(),
        assertionResults: [
          { name: 'grpcField:$.message', passed: false, message: 'assertions[0]: mismatch' },
        ],
        assertionsPassed: false,
        validationPassed: true,
        harnessAssertionsConfigured: true,
      }),
      buildGrpcHarnessResult({
        scenarioId: 'sc-1',
        callType: 'unary',
        durationMs: 9,
        transportOutcome: unaryOutcome(),
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: false,
        harnessAssertionsConfigured: false,
        validationFailureDetail: '$.message: expected "x", got "hello"',
      }),
      buildGrpcHarnessResult({
        scenarioId: 'sc-1',
        callType: 'unary',
        durationMs: 30_000,
        transportOutcome: unaryOutcome({
          passed: false,
          grpcStatus: GRPC_STATUS_DEADLINE_EXCEEDED,
          grpcStatusMessage: 'DEADLINE_EXCEEDED',
          errorDetail: 'DEADLINE_EXCEEDED',
        }),
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: true,
        harnessAssertionsConfigured: false,
      }),
      buildGrpcHarnessResult({
        scenarioId: 'sc-1',
        callType: 'unary',
        durationMs: 0,
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: true,
        harnessAssertionsConfigured: false,
        preTransportError: {
          errorCategory: 'serialization',
          errorDetail: 'unresolved template variables in target',
        },
      }),
    ];
    for (const result of cases) {
      expect(result.status, result.status).not.toBe('passed');
      expect(result.errorDetail, result.status).toBeTruthy();
    }
  });

  it('locks stable GrpcHarnessResult field keys for downstream consumers', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'unary',
      durationMs: 1,
      transportOutcome: unaryOutcome(),
      assertionResults: [{ name: 'grpcStatus', passed: true }],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(Object.keys(result).sort()).toEqual([
      'assertionResults',
      'body',
      'callType',
      'dataRowId',
      'durationMs',
      'errorCategory',
      'errorDetail',
      'grpcStatus',
      'grpcStatusMessage',
      'messages',
      'scenarioId',
      'schemaVersion',
      'status',
      'trailers',
    ]);
  });
});

describe('formatGrpcHarnessResultSummary (Phase 8G)', () => {
  it('formats a debugging-friendly summary line', () => {
    const summary = formatGrpcHarnessResultSummary(buildGrpcHarnessResult({
      scenarioId: 'sc-1',
      callType: 'server_streaming',
      durationMs: 42,
      transportOutcome: unaryOutcome({
        callType: 'server_streaming',
        messages: [{ n: 1 }],
      }),
      assertionResults: [
        { name: 'grpcStreamLength', passed: false, message: 'assertions[0]: stream length expected 2, got 1' },
      ],
      assertionsPassed: false,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    }));
    expect(summary).toContain('[FAILED]');
    expect(summary).toContain('server_streaming');
    expect(summary).toContain('42ms');
    expect(summary).toContain('assertions=1/1 failed');
  });
});
