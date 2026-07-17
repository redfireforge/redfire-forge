/**
 * Coverage gaps — grpcHarnessResultBuilder.ts (Phase 8G).
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import {
  buildGrpcHarnessResult,
  formatGrpcHarnessResultSummary,
} from './grpcHarnessResultBuilder';

function transportOutcome(overrides: Partial<GrpcHarnessCallOutcome> = {}): GrpcHarnessCallOutcome {
  return {
    callType: 'unary',
    passed: true,
    grpcStatus: 0,
    grpcStatusMessage: 'OK',
    durationMs: 5,
    attempts: 1,
    ...overrides,
  };
}

describe('grpcHarnessResultBuilder coverage gaps', () => {
  it('uses grpcStatusMessage when failed transport omits errorDetail', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-gap',
      callType: 'unary',
      durationMs: 8,
      transportOutcome: transportOutcome({
        passed: false,
        grpcStatus: 14,
        grpcStatusMessage: 'UNAVAILABLE',
        errorDetail: undefined,
      }),
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
    });
    expect(result.status).toBe('error');
    expect(result.errorDetail).toBe('UNAVAILABLE');
  });

  it('falls back to assertion message on transport error when outcome is absent', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-gap',
      callType: 'unary',
      durationMs: 4,
      transportOutcome: undefined,
      assertionResults: [{
        name: 'grpcStatus',
        passed: false,
        message: 'transport assertion failed',
      }],
      assertionsPassed: false,
      validationPassed: true,
      harnessAssertionsConfigured: true,
    });
    expect(result.status).toBe('error');
    expect(result.errorDetail).toBe('transport assertion failed');
  });

  it('marks transport passed when outcome succeeds without pre-transport error', () => {
    const result = buildGrpcHarnessResult({
      scenarioId: 'sc-gap',
      callType: 'server_streaming',
      durationMs: 12,
      transportOutcome: transportOutcome({
        callType: 'server_streaming',
        messages: [{ n: 1 }],
      }),
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
    });
    expect(result.status).toBe('passed');
    expect(result.errorDetail).toBeUndefined();
  });

  it('formats summary without grpc status, category, failures, or error detail when absent', () => {
    const summary = formatGrpcHarnessResultSummary(buildGrpcHarnessResult({
      scenarioId: 'sc-gap',
      callType: 'unary',
      durationMs: 3,
      transportOutcome: {
        callType: 'unary',
        passed: true,
        durationMs: 3,
        attempts: 1,
      },
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
    }));
    expect(summary).toBe('[PASSED] unary 3ms');
    expect(summary).not.toContain('grpc=');
    expect(summary).not.toContain('category=');
  });
});
