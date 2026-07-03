import { describe, expect, it } from 'vitest';
import type { GrpcTabExecuteSnapshot } from './contracts';
import {
  GrpcLoadTestConfigValidationError,
  buildGrpcLoadTestRunFailureMessage,
  captureGrpcLoadTestStreamExecuteSnapshot,
  createInitialGrpcAdvancedOperationState,
  deriveGrpcLoadTestOperationOutcome,
  deriveGrpcLoadTestSummaryStatus,
  transitionGrpcAdvancedOperationState,
  validateGrpcLoadTestConfig,
} from './grpcAdvancedFeatureContracts';

function makeSnapshot(overrides: Partial<GrpcTabExecuteSnapshot> = {}): GrpcTabExecuteSnapshot {
  return {
    tabId: 'tab-1',
    requestId: 'req-1',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary',
    target: { address: 'localhost:50051', tlsMode: 'disabled' },
    service: 'demo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: 'desc-1',
    ...overrides,
  };
}

describe('grpcAdvancedFeatureContracts coverage gaps', () => {
  it('running transition reuses existing operationId when no option is provided', () => {
    const state = transitionGrpcAdvancedOperationState(
      transitionGrpcAdvancedOperationState(createInitialGrpcAdvancedOperationState(), 'validating'),
      'running',
      { operationId: 'op-existing' },
    );

    const rerun = transitionGrpcAdvancedOperationState(state, 'running');
    expect(rerun.operationId).toBe('op-existing');
  });

  it('validateGrpcLoadTestConfig flags invalid numeric boundaries', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 0,
      durationMs: 0,
      rampUpMs: -1,
      warmupCalls: -1,
      maxMessagesPerStream: 0,
    });

    expect(issues.some((i) => i.path === 'totalCalls')).toBe(true);
    expect(issues.some((i) => i.path === 'durationMs')).toBe(true);
    expect(issues.some((i) => i.path === 'rampUpMs')).toBe(true);
    expect(issues.some((i) => i.path === 'warmupCalls')).toBe(true);
    expect(issues.some((i) => i.path === 'maxMessagesPerStream')).toBe(true);
  });

  it('validateGrpcLoadTestConfig flags upper-bound violations', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 2,
      durationMs: 1000,
      rampUpMs: 1001,
      warmupCalls: 10001,
      maxMessagesPerStream: 10001,
    });

    expect(issues.some((i) => i.path === 'rampUpMs' && i.message.includes('must not exceed'))).toBe(true);
    expect(issues.some((i) => i.path === 'warmupCalls' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'maxMessagesPerStream' && i.message.includes('exceeds max'))).toBe(true);
  });

  it('derive summary and operation outcome return success/completed paths', () => {
    const input = {
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 2,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: 'completed_total_calls' as const,
    };

    expect(deriveGrpcLoadTestSummaryStatus(input)).toBe('success');
    expect(deriveGrpcLoadTestOperationOutcome(input)).toBe('completed');
  });

  it('buildGrpcLoadTestRunFailureMessage covers both branches', () => {
    expect(buildGrpcLoadTestRunFailureMessage({
      scheduled: 1,
      completed: 1,
      succeeded: 0,
      failed: 1,
      warmupScheduled: 0,
      warmupCompleted: 0,
      peakInFlight: 1,
    })).toContain('1 failed call');

    expect(buildGrpcLoadTestRunFailureMessage({
      scheduled: 1,
      completed: 0,
      succeeded: 0,
      failed: 0,
      warmupScheduled: 0,
      warmupCompleted: 0,
      peakInFlight: 0,
    })).toBe('Load test produced no completed calls');
  });

  it('GrpcLoadTestConfigValidationError falls back to default message with empty issues', () => {
    const err = new GrpcLoadTestConfigValidationError([]);
    expect(err.message).toBe('Invalid load-test config');
  });

  it('captureGrpcLoadTestStreamExecuteSnapshot accepts server_streaming and clones input', () => {
    const executeSnapshot = makeSnapshot({ callType: 'server_streaming' });
    const config = { concurrency: 1, totalCalls: 2, maxMessagesPerStream: 10 };

    const out = captureGrpcLoadTestStreamExecuteSnapshot({
      runId: 'run-stream',
      executeSnapshot,
      config,
      resolvedEnvName: 'local',
      capturedAt: '2026-07-01T00:00:00.000Z',
    });

    executeSnapshot.service = 'mutated.Service';
    config.totalCalls = 999;

    expect(out.executeSnapshot.service).toBe('demo.EchoService');
    expect(out.config.totalCalls).toBe(2);
    expect(out.runId).toBe('run-stream');
  });
});
