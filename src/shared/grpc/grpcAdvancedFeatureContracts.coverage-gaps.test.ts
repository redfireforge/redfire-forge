import { describe, expect, it } from 'vitest';
import type { GrpcTabExecuteSnapshot } from './contracts';
import {
  GRPC_LOAD_TEST_SAFETY_LIMITS,
  GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS,
  GrpcAdvancedOperationTransitionError,
  GrpcLoadTestConfigValidationError,
  assertGrpcLoadTestConfig,
  assertGrpcLoadTestRunSnapshot,
  buildGrpcLoadTestRunFailureMessage,
  canTransitionGrpcAdvancedOperationStatus,
  captureGrpcLoadTestExecuteSnapshot,
  captureGrpcLoadTestStreamExecuteSnapshot,
  createInitialGrpcAdvancedFeatureRuntimeState,
  createInitialGrpcAdvancedOperationState,
  deriveGrpcLoadTestOperationOutcome,
  deriveGrpcLoadTestSummaryStatus,
  patchGrpcAdvancedFeatureNamespaceState,
  requestGrpcAdvancedOperationCancellation,
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

const baseCounts = {
  scheduled: 2,
  completed: 2,
  succeeded: 2,
  failed: 0,
  warmupScheduled: 0,
  warmupCompleted: 0,
  peakInFlight: 1,
};

describe('grpcAdvancedFeatureContracts coverage gaps', () => {
  it('creates isolated namespace runtime state and supports metadata patches', () => {
    const runtime = createInitialGrpcAdvancedFeatureRuntimeState();
    expect(runtime.loadTest.status).toBe('idle');
    expect(runtime.mockRuntime.status).toBe('idle');
    expect(runtime.schemaDiff.status).toBe('idle');

    const patched = patchGrpcAdvancedFeatureNamespaceState(runtime, 'loadTest', {
      operationId: 'op-load',
    });
    expect(patched.loadTest.operationId).toBe('op-load');
    expect(runtime.loadTest.operationId).toBeUndefined();
  });

  it('guards lifecycle transitions and exposes transition errors', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('idle', 'validating')).toBe(true);
    expect(canTransitionGrpcAdvancedOperationStatus('idle', 'completed')).toBe(false);

    expect(() =>
      transitionGrpcAdvancedOperationState(createInitialGrpcAdvancedOperationState(), 'completed'),
    ).toThrow(GrpcAdvancedOperationTransitionError);

    const idle = createInitialGrpcAdvancedOperationState();
    expect(requestGrpcAdvancedOperationCancellation(idle)).toBe(idle);

    const running = transitionGrpcAdvancedOperationState(
      transitionGrpcAdvancedOperationState(createInitialGrpcAdvancedOperationState(), 'validating'),
      'running',
      { operationId: 'op-cancel-idempotent' },
    );
    const cancelledOnce = requestGrpcAdvancedOperationCancellation(running);
    expect(requestGrpcAdvancedOperationCancellation(cancelledOnce)).toBe(cancelledOnce);

    const completed = transitionGrpcAdvancedOperationState(running, 'completed', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    expect(transitionGrpcAdvancedOperationState(completed, 'idle')).toEqual({
      status: 'idle',
      cancellationRequested: false,
    });
  });

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
      concurrency: 0,
      totalCalls: 0,
      durationMs: 0,
      rampUpMs: -1,
      warmupCalls: -1,
      requestRateRps: -1,
      requestTemplateJson: '{bad',
      maxMessagesPerStream: 0,
    });

    expect(issues.some((i) => i.path === 'concurrency')).toBe(true);
    expect(issues.some((i) => i.path === 'totalCalls')).toBe(true);
    expect(issues.some((i) => i.path === 'durationMs')).toBe(true);
    expect(issues.some((i) => i.path === 'rampUpMs')).toBe(true);
    expect(issues.some((i) => i.path === 'warmupCalls')).toBe(true);
    expect(issues.some((i) => i.path === 'requestRateRps')).toBe(true);
    expect(issues.some((i) => i.path === 'requestTemplateJson')).toBe(true);
    expect(issues.some((i) => i.path === 'maxMessagesPerStream')).toBe(true);
  });

  it('validateGrpcLoadTestConfig flags upper-bound violations', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: GRPC_LOAD_TEST_SAFETY_LIMITS.maxConcurrency + 1,
      totalCalls: GRPC_LOAD_TEST_SAFETY_LIMITS.maxTotalCalls + 1,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.maxDurationMs + 1,
      rampUpMs: GRPC_LOAD_TEST_SAFETY_LIMITS.maxRampUpMs + 1,
      warmupCalls: GRPC_LOAD_TEST_SAFETY_LIMITS.maxWarmupCalls + 1,
      requestRateRps: GRPC_LOAD_TEST_SAFETY_LIMITS.maxRequestRateRps + 1,
      maxMessagesPerStream: GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.maxMaxMessagesPerStream + 1,
    });

    expect(issues.some((i) => i.path === 'concurrency' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'totalCalls' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'durationMs' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'rampUpMs' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'warmupCalls' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'requestRateRps' && i.message.includes('exceeds max'))).toBe(true);
    expect(issues.some((i) => i.path === 'maxMessagesPerStream' && i.message.includes('exceeds max'))).toBe(true);
  });

  it('validateGrpcLoadTestConfig rejects rampUpMs greater than durationMs', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: 5_000,
      rampUpMs: 6_000,
    });
    expect(issues.some((i) => i.path === 'rampUpMs' && i.message.includes('must not exceed durationMs'))).toBe(true);
  });

  it('validateGrpcLoadTestConfig accepts minimal valid unary and server_streaming configs', () => {
    expect(validateGrpcLoadTestConfig('unary', { concurrency: 1, totalCalls: 1 })).toEqual([]);
    expect(validateGrpcLoadTestConfig('server_streaming', {
      concurrency: 1,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs,
      maxMessagesPerStream: 1,
    })).toEqual([]);
  });

  it('validateGrpcLoadTestConfig rejects non-integer and null JSON template values', () => {
    const floatIssues = validateGrpcLoadTestConfig('unary', {
      concurrency: 1.5,
      totalCalls: 1.2,
      durationMs: 1000.5,
      rampUpMs: 1.5,
      warmupCalls: 1.1,
      requestRateRps: 2.5,
    });
    expect(floatIssues.some((i) => i.path === 'concurrency')).toBe(true);
    expect(floatIssues.some((i) => i.path === 'totalCalls')).toBe(true);
    expect(floatIssues.some((i) => i.path === 'durationMs')).toBe(true);

    const nullTemplateIssues = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: 'null',
    });
    expect(nullTemplateIssues.some((i) => i.path === 'requestTemplateJson')).toBe(true);
  });

  it('validateGrpcLoadTestConfig rejects unsupported call types early', () => {
    const issues = validateGrpcLoadTestConfig('client_streaming', {
      concurrency: 1,
      totalCalls: 1,
    });
    expect(issues).toEqual([{
      path: 'callType',
      message: 'Load testing supports unary and server_streaming calls only.',
    }]);
  });

  it('validateGrpcLoadTestConfig requires totalCalls or durationMs', () => {
    const issues = validateGrpcLoadTestConfig('unary', { concurrency: 2 });
    expect(issues.some((i) => i.path === 'totalCalls' && i.message.includes('Either totalCalls or durationMs'))).toBe(true);
  });

  it('validateGrpcLoadTestConfig enforces duration minimum', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs - 1,
    });
    expect(issues.some((i) => i.path === 'durationMs' && i.message.includes('at least'))).toBe(true);
  });

  it('validateGrpcLoadTestConfig rejects warmupCalls greater than or equal to totalCalls', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: 50,
      warmupCalls: 50,
    });
    expect(issues.some((i) => i.path === 'warmupCalls' && i.message.includes('lower than totalCalls'))).toBe(true);
  });

  it('validateGrpcLoadTestConfig rejects rampUpMs above safety cap', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: 100,
      rampUpMs: GRPC_LOAD_TEST_SAFETY_LIMITS.maxRampUpMs + 1,
    });
    expect(issues.some((i) => i.path === 'rampUpMs' && i.message.includes('exceeds max'))).toBe(true);
  });

  it('allows empty requestTemplateJson and rejects template for non-unary call type', () => {
    expect(validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '   ',
    })).toEqual([]);

    const streamingIssues = validateGrpcLoadTestConfig('server_streaming', {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '{"ok":true}',
    });
    expect(streamingIssues.some((issue) => issue.path === 'requestTemplateJson')).toBe(true);
  });

  it('validateGrpcLoadTestConfig rejects requestTemplateJson array values', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '[]',
    });
    expect(issues.some((i) => i.path === 'requestTemplateJson' && i.message.includes('JSON object'))).toBe(true);
  });

  it('assertGrpcLoadTestConfig throws GrpcLoadTestConfigValidationError', () => {
    expect(() =>
      assertGrpcLoadTestConfig('bidi_streaming', { concurrency: 1, totalCalls: 1 }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('assertGrpcLoadTestRunSnapshot throws for invalid execute snapshot', () => {
    expect(() =>
      assertGrpcLoadTestRunSnapshot({
        runId: 'run-invalid',
        executeSnapshot: makeSnapshot({ method: '' }),
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('captureGrpcLoadTestExecuteSnapshot stores metadata and deep-clones input', () => {
    const executeSnapshot = makeSnapshot();
    const config = { concurrency: 4, totalCalls: 100, warmupCalls: 10 };

    const out = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-1',
      executeSnapshot,
      config,
      resolvedEnvName: 'local',
      capturedAt: '2026-07-01T00:00:00.000Z',
    });

    executeSnapshot.body = { message: 'mutated' };
    config.totalCalls = 999;

    expect(out.runId).toBe('run-1');
    expect(out.resolvedEnvName).toBe('local');
    expect(out.capturedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(out.executeSnapshot.body).toEqual({ message: 'hello' });
    expect(out.config.totalCalls).toBe(100);
  });

  it('captureGrpcLoadTestExecuteSnapshot rejects empty runId and non-unary call type', () => {
    expect(() =>
      captureGrpcLoadTestExecuteSnapshot({
        runId: '   ',
        executeSnapshot: makeSnapshot(),
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);

    expect(() =>
      captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-stream',
        executeSnapshot: makeSnapshot({ callType: 'server_streaming' }),
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('derive summary and operation outcome cover success and completed paths', () => {
    const input = {
      counts: baseCounts,
      stopReason: 'completed_total_calls' as const,
    };

    expect(deriveGrpcLoadTestSummaryStatus(input)).toBe('success');
    expect(deriveGrpcLoadTestOperationOutcome(input)).toBe('completed');
  });

  it('deriveGrpcLoadTestSummaryStatus returns failed for zero completed, failures, and cancelled', () => {
    expect(deriveGrpcLoadTestSummaryStatus({
      counts: { ...baseCounts, completed: 0 },
      stopReason: 'completed_total_calls',
    })).toBe('failed');

    expect(deriveGrpcLoadTestSummaryStatus({
      counts: { ...baseCounts, failed: 1, succeeded: 1 },
      stopReason: 'completed_total_calls',
    })).toBe('failed');

    expect(deriveGrpcLoadTestSummaryStatus({
      counts: baseCounts,
      stopReason: 'cancelled',
    })).toBe('failed');
  });

  it('deriveGrpcLoadTestOperationOutcome returns cancelled, failed, and completed branches', () => {
    expect(deriveGrpcLoadTestOperationOutcome({
      counts: baseCounts,
      stopReason: 'cancelled',
    })).toBe('cancelled');

    expect(deriveGrpcLoadTestOperationOutcome({
      counts: { ...baseCounts, completed: 0 },
      stopReason: 'completed_duration',
    })).toBe('failed');

    expect(deriveGrpcLoadTestOperationOutcome({
      counts: { ...baseCounts, failed: 2, succeeded: 0 },
      stopReason: 'completed_total_calls',
    })).toBe('failed');
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

  it('GrpcLoadTestConfigValidationError uses first issue message when present', () => {
    const err = new GrpcLoadTestConfigValidationError([
      { path: 'concurrency', message: 'concurrency must be a positive integer.' },
    ]);
    expect(err.message).toBe('concurrency must be a positive integer.');
    expect(err.issues).toHaveLength(1);
  });

  it('GrpcLoadTestConfigValidationError falls back to default message with empty issues', () => {
    const err = new GrpcLoadTestConfigValidationError([]);
    expect(err.message).toBe('Invalid load-test config');
  });

  it('captureGrpcLoadTestExecuteSnapshot defaults capturedAt when omitted', () => {
    const out = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-default-captured',
      executeSnapshot: makeSnapshot(),
      config: { concurrency: 1, totalCalls: 1 },
    });
    expect(out.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('assertGrpcLoadTestRunSnapshot honors custom allowedCallTypes', () => {
    expect(() =>
      assertGrpcLoadTestRunSnapshot({
        runId: 'run-stream-assert',
        executeSnapshot: makeSnapshot({ callType: 'server_streaming' }),
        config: { concurrency: 1, totalCalls: 1, maxMessagesPerStream: 1 },
      }, { allowedCallTypes: ['server_streaming'] }),
    ).not.toThrow();

    expect(() =>
      assertGrpcLoadTestRunSnapshot({
        runId: 'run-stream-assert',
        executeSnapshot: makeSnapshot({ callType: 'unary' }),
        config: { concurrency: 1, totalCalls: 1 },
      }, { allowedCallTypes: ['server_streaming'] }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('validateGrpcLoadTestConfig rejects partial method override pairs', () => {
    const serviceOnly = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      methodOverrideService: 'demo.EchoService',
    });
    expect(serviceOnly.some((i) => i.path === 'methodOverrideMethod')).toBe(true);

    const methodOnly = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      methodOverrideMethod: 'Echo',
    });
    expect(methodOnly.some((i) => i.path === 'methodOverrideService')).toBe(true);

    const invalidType = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      methodOverrideService: 123 as unknown as string,
      methodOverrideMethod: 'Echo',
    });
    expect(invalidType.some((i) => i.path === 'methodOverrideService')).toBe(true);

    const invalidMethodType = validateGrpcLoadTestConfig('unary', {
      concurrency: 1,
      totalCalls: 1,
      methodOverrideService: 'demo.EchoService',
      methodOverrideMethod: 42 as unknown as string,
    });
    expect(invalidMethodType.some((i) => i.path === 'methodOverrideMethod')).toBe(true);
  });

  it('failed transition applies default validation/runtime error categories', () => {
    const validating = transitionGrpcAdvancedOperationState(
      createInitialGrpcAdvancedOperationState(),
      'validating',
      { operationId: 'op-val-default', nowIso: '2026-06-30T01:00:00.000Z' },
    );
    const validatingFailed = transitionGrpcAdvancedOperationState(validating, 'failed', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    expect(validatingFailed.error?.category).toBe('validation');

    const running = transitionGrpcAdvancedOperationState(validating, 'running', {
      operationId: 'op-run-default',
      nowIso: '2026-06-30T01:00:02.000Z',
    });
    const runningFailed = transitionGrpcAdvancedOperationState(running, 'failed', {
      nowIso: '2026-06-30T01:00:03.000Z',
    });
    expect(runningFailed.error?.category).toBe('runtime');
  });

  it('captureGrpcLoadTestStreamExecuteSnapshot rejects unary call type', () => {
    expect(() =>
      captureGrpcLoadTestStreamExecuteSnapshot({
        runId: 'run-stream-invalid',
        executeSnapshot: makeSnapshot({ callType: 'unary' }),
        config: { concurrency: 1, totalCalls: 1 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
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
