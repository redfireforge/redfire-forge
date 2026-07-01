/**
 * Coverage gaps — grpcHarnessExport.ts (Phase 8H).
 */
import { describe, expect, it } from 'vitest';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';
import type { GrpcHarnessResult } from '../types/grpc-harness-result';
import type { RequestResult } from '../types';
import {
  redactGrpcHarnessRequestResultForExport,
  redactGrpcHarnessResultForExport,
  redactGrpcHarnessRunnerArtifactsForExport,
} from './grpcHarnessExport';

function minimalHarnessResult(overrides: Partial<GrpcHarnessResult> = {}): GrpcHarnessResult {
  return {
    schemaVersion: GRPC_HARNESS_RESULT_SCHEMA_VERSION,
    scenarioId: 'sc-gap',
    callType: 'unary',
    status: 'passed',
    durationMs: 1,
    assertionResults: [],
    ...overrides,
  };
}

function grpcRequestResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'r-gap',
    scenarioId: 'sc-gap',
    scenarioName: 'Gap',
    url: 'grpc://localhost:50051/echo.Echo/Echo',
    method: 'UNARY',
    httpStatus: 200,
    responseTimeMs: 1,
    responseBody: '{"message":"hello"}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    transportType: 'grpcCall',
    grpcResultMeta: {
      service: 'echo.Echo',
      method: 'Echo',
      target: 'localhost:50051',
      harnessResult: minimalHarnessResult(),
    },
    ...overrides,
  };
}

describe('grpcHarnessExport coverage gaps', () => {
  it('passes through non-string failureDetails expected/actual values unchanged', () => {
    const redacted = redactGrpcHarnessRequestResultForExport(grpcRequestResult({
      passed: false,
      failureDetails: [{
        path: '$.count',
        expected: 2,
        actual: 1,
      }],
    }));
    expect(redacted.failureDetails[0]?.expected).toBe(2);
    expect(redacted.failureDetails[0]?.actual).toBe(1);
  });

  it('redacts harness results without optional grpcStatusMessage, errorDetail, or assertion messages', () => {
    const redacted = redactGrpcHarnessResultForExport(minimalHarnessResult({
      assertionResults: [{ name: 'grpcStatus', passed: true }],
    }));
    expect(redacted.grpcStatusMessage).toBeUndefined();
    expect(redacted.errorDetail).toBeUndefined();
    expect(redacted.assertionResults[0]?.message).toBeUndefined();
  });

  it('preserves message rows when record redaction returns undefined', () => {
    const redacted = redactGrpcHarnessResultForExport(minimalHarnessResult({
      messages: [undefined as unknown as Record<string, unknown>],
    }));
    expect(redacted.messages).toEqual([undefined]);
  });

  it('redacts requestLog with missing headers and body', () => {
    const redacted = redactGrpcHarnessRequestResultForExport(grpcRequestResult({
      requestLog: {},
    }));
    expect(redacted.requestLog?.headers).toEqual({});
    expect(redacted.requestLog?.body).toBeUndefined();
  });

  it('sanitizes invalid JSON response bodies via diagnostic fallback', () => {
    const redacted = redactGrpcHarnessRequestResultForExport(grpcRequestResult({
      responseBody: 'not-json Bearer super-secret-export-token',
    }));
    expect(redacted.responseBody).not.toContain('super-secret-export-token');
    expect(redacted.responseBody).toContain('[REDACTED]');
  });

  it('returns non-gRPC runner rows unchanged without cross-feature leak scan', () => {
    const httpRow: RequestResult = {
      id: 'http-1',
      scenarioId: 'http-sc',
      scenarioName: 'HTTP',
      url: 'https://example.com',
      method: 'GET',
      httpStatus: 200,
      responseTimeMs: 3,
      responseBody: '{"ok":true}',
      timestamp: Date.now(),
      passed: true,
      validationMode: 'none',
      failureDetails: [],
    };
    const redacted = redactGrpcHarnessRunnerArtifactsForExport([httpRow]);
    expect(redacted).toEqual([httpRow]);
  });
});
