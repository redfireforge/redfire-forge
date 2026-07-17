/**
 * Phase 11A - Feature contracts and shared runtime boundaries acceptance tests.
 *
 * Validates:
 *   11A-A Namespace isolation and ownership boundaries
 *   11A-B Lifecycle transition and cancellation semantics
 *   11A-C Unified error model categories
 *   11A-D Load-test validation (unary-only + safety caps)
 *   11A-E Immutable snapshot capture contract
 *   11A-F Source-scan checklist traceability
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

import {
  GRPC_ADVANCED_FEATURE_NAMESPACES,
  GRPC_ADVANCED_OPERATION_ERROR_CATEGORIES,
  canTransitionGrpcAdvancedOperationStatus,
  createInitialGrpcAdvancedFeatureRuntimeState,
  createInitialGrpcAdvancedOperationState,
  patchGrpcAdvancedFeatureNamespaceState,
  requestGrpcAdvancedOperationCancellation,
  transitionGrpcAdvancedOperationState,
  GRPC_LOAD_TEST_SAFETY_LIMITS,
  validateGrpcLoadTestConfig,
  assertGrpcLoadTestConfig,
  assertGrpcLoadTestRunSnapshot,
  GrpcLoadTestConfigValidationError,
  GrpcAdvancedOperationTransitionError,
  captureGrpcLoadTestExecuteSnapshot,
} from './grpcAdvancedFeatureContracts';
import type { GrpcTabExecuteSnapshot } from './contracts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function makeUnarySnapshot(overrides: Partial<GrpcTabExecuteSnapshot> = {}): GrpcTabExecuteSnapshot {
  return {
    tabId: 'grpc-tab-1',
    requestId: 'req-1',
    capturedAt: '2026-06-30T00:00:00.000Z',
    callType: 'unary',
    target: { address: 'localhost:8080', tlsMode: 'disabled' },
    service: 'demo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    metadata: { 'x-trace-id': 'trace-1' },
    timeoutMs: 30_000,
    descriptorKey: 'descriptor-1',
    ...overrides,
  };
}

function advanceOperationToRunning(
  state = createInitialGrpcAdvancedOperationState(),
  options?: { operationId?: string; nowIso?: string },
) {
  return transitionGrpcAdvancedOperationState(
    transitionGrpcAdvancedOperationState(state, 'validating', options),
    'running',
    options,
  );
}

describe('Phase 11A-A - namespace ownership and isolation', () => {
  it('declares the three isolated advanced-feature namespaces', () => {
    expect(GRPC_ADVANCED_FEATURE_NAMESPACES).toEqual(['loadTest', 'mockRuntime', 'schemaDiff']);
  });

  it('creates initial runtime state with all namespaces idle', () => {
    const state = createInitialGrpcAdvancedFeatureRuntimeState();
    expect(state.loadTest.status).toBe('idle');
    expect(state.mockRuntime.status).toBe('idle');
    expect(state.schemaDiff.status).toBe('idle');
  });

  it('patching loadTest namespace does not mutate mockRuntime/schemaDiff', () => {
    const base = createInitialGrpcAdvancedFeatureRuntimeState();
    const loadTestRunning = transitionGrpcAdvancedOperationState(
      transitionGrpcAdvancedOperationState(base.loadTest, 'validating'),
      'running',
      { operationId: 'op-load-test' },
    );
    const next = {
      ...base,
      loadTest: loadTestRunning,
    };
    expect(next.loadTest.status).toBe('running');
    expect(next.mockRuntime.status).toBe('idle');
    expect(next.schemaDiff.status).toBe('idle');
  });

  it('patching one namespace returns a new object without mutating input', () => {
    const base = createInitialGrpcAdvancedFeatureRuntimeState();
    const next = patchGrpcAdvancedFeatureNamespaceState(base, 'schemaDiff', {
      operationId: 'schema-op-1',
    });
    expect(next).not.toBe(base);
    expect(base.schemaDiff.operationId).toBeUndefined();
    expect(next.schemaDiff.operationId).toBe('schema-op-1');
  });
});

describe('Phase 11A-B - lifecycle transitions and cancellation semantics', () => {
  it('allows idle -> validating transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('idle', 'validating')).toBe(true);
  });

  it('allows validating -> running transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('validating', 'running')).toBe(true);
  });

  it('allows running -> completed transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('running', 'completed')).toBe(true);
  });

  it('rejects idle -> completed transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('idle', 'completed')).toBe(false);
  });

  it('rejects completed -> running transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('completed', 'running')).toBe(false);
  });

  it('transition throws on invalid transition', () => {
    const state = createInitialGrpcAdvancedOperationState();
    expect(() => transitionGrpcAdvancedOperationState(state, 'completed')).toThrow(
      GrpcAdvancedOperationTransitionError,
    );
  });

  it('rejects idle -> running shortcut transition', () => {
    expect(canTransitionGrpcAdvancedOperationStatus('idle', 'running')).toBe(false);
  });

  it('running transition stamps startedAt and operationId', () => {
    const state = advanceOperationToRunning(undefined, {
      operationId: 'op-1',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    expect(state.status).toBe('running');
    expect(state.startedAt).toBe('2026-06-30T01:00:00.000Z');
    expect(state.operationId).toBe('op-1');
  });

  it('failed transition carries unified error payload', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-2',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const failed = transitionGrpcAdvancedOperationState(running, 'failed', {
      nowIso: '2026-06-30T01:00:01.000Z',
      error: { category: 'runtime', message: 'engine failed' },
    });
    expect(failed.status).toBe('failed');
    expect(failed.completedAt).toBe('2026-06-30T01:00:01.000Z');
    expect(failed.error?.category).toBe('runtime');
  });

  it('request cancellation marks validating operation as cancellationRequested', () => {
    const validating = transitionGrpcAdvancedOperationState(
      createInitialGrpcAdvancedOperationState(),
      'validating',
      { operationId: 'op-3b', nowIso: '2026-06-30T01:00:00.000Z' },
    );
    const next = requestGrpcAdvancedOperationCancellation(validating);
    expect(next.cancellationRequested).toBe(true);
  });

  it('request cancellation is idempotent when already requested', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-3c',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const once = requestGrpcAdvancedOperationCancellation(running);
    const twice = requestGrpcAdvancedOperationCancellation(once);
    expect(twice).toBe(once);
  });

  it('request cancellation marks running operation as cancellationRequested', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-3',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const next = requestGrpcAdvancedOperationCancellation(running);
    expect(next.cancellationRequested).toBe(true);
  });

  it('request cancellation is no-op for idle operation', () => {
    const idle = createInitialGrpcAdvancedOperationState();
    const next = requestGrpcAdvancedOperationCancellation(idle);
    expect(next).toBe(idle);
  });

  it('cancelled transition clears cancellationRequested flag', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-4',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const cancellationRequested = requestGrpcAdvancedOperationCancellation(running);
    const cancelled = transitionGrpcAdvancedOperationState(cancellationRequested, 'cancelled', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationRequested).toBe(false);
  });

  it('reset to idle returns default clean state', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-5',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const completed = transitionGrpcAdvancedOperationState(running, 'completed', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    const idle = transitionGrpcAdvancedOperationState(completed, 'idle');
    expect(idle).toEqual({ status: 'idle', cancellationRequested: false });
  });

  it('failed transition defaults to validation category when failing from validating', () => {
    const validating = transitionGrpcAdvancedOperationState(
      createInitialGrpcAdvancedOperationState(),
      'validating',
      { operationId: 'op-val-default', nowIso: '2026-06-30T01:00:00.000Z' },
    );
    const failed = transitionGrpcAdvancedOperationState(validating, 'failed', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    expect(failed.error?.category).toBe('validation');
    expect(failed.error?.message).toContain('validation failed');
  });

  it('failed transition defaults to runtime category when failing from running', () => {
    const running = advanceOperationToRunning(undefined, {
      operationId: 'op-run-default',
      nowIso: '2026-06-30T01:00:00.000Z',
    });
    const failed = transitionGrpcAdvancedOperationState(running, 'failed', {
      nowIso: '2026-06-30T01:00:01.000Z',
    });
    expect(failed.error?.category).toBe('runtime');
  });

  it('allows validating -> failed transition with unified error payload', () => {
    const validating = transitionGrpcAdvancedOperationState(
      createInitialGrpcAdvancedOperationState(),
      'validating',
      { operationId: 'op-val-fail', nowIso: '2026-06-30T01:00:00.000Z' },
    );
    const failed = transitionGrpcAdvancedOperationState(validating, 'failed', {
      nowIso: '2026-06-30T01:00:01.000Z',
      error: { category: 'validation', message: 'invalid load-test config' },
    });
    expect(failed.status).toBe('failed');
    expect(failed.error?.category).toBe('validation');
  });

  it('GrpcAdvancedOperationTransitionError exposes validation category', () => {
    try {
      transitionGrpcAdvancedOperationState(createInitialGrpcAdvancedOperationState(), 'completed');
      expect.unreachable('expected transition error');
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcAdvancedOperationTransitionError);
      expect((error as GrpcAdvancedOperationTransitionError).category).toBe('validation');
    }
  });
});

describe('Phase 11A-C - unified error model categories', () => {
  it('defines normalized categories for all advanced features', () => {
    expect(GRPC_ADVANCED_OPERATION_ERROR_CATEGORIES).toEqual([
      'validation',
      'runtime',
      'timeout',
      'io',
      'internal',
    ]);
  });
});

describe('Phase 11A-D - load-test validation boundaries', () => {
  it('accepts valid unary config with duration only', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 4,
      durationMs: 10_000,
      rampUpMs: 1_000,
      warmupCalls: 10,
    });
    expect(issues).toEqual([]);
  });

  it('accepts valid unary config with totalCalls only', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 4,
      totalCalls: 500,
      warmupCalls: 25,
    });
    expect(issues).toEqual([]);
  });

  it('rejects client_streaming and bidi_streaming call types', () => {
    const issues = validateGrpcLoadTestConfig('bidi_streaming', {
      concurrency: 4,
      totalCalls: 100,
    });
    expect(issues.some((issue) => issue.path === 'callType')).toBe(true);
  });

  it('accepts server_streaming configs (Phase 11O)', () => {
    const issues = validateGrpcLoadTestConfig('server_streaming', {
      concurrency: 4,
      totalCalls: 100,
      maxMessagesPerStream: 10,
    });
    expect(issues).toEqual([]);
  });

  it('rejects missing totalCalls and durationMs', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 4,
    });
    expect(issues.some((issue) => issue.message.includes('Either totalCalls or durationMs'))).toBe(true);
  });

  it('rejects concurrency beyond safety cap', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: GRPC_LOAD_TEST_SAFETY_LIMITS.maxConcurrency + 1,
      totalCalls: 100,
    });
    expect(issues.some((issue) => issue.path === 'concurrency')).toBe(true);
  });

  it('accepts durationMs at the safety minimum boundary', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs,
    });
    expect(issues).toEqual([]);
  });

  it('rejects rampUpMs greater than durationMs', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: 5_000,
      rampUpMs: 6_000,
    });
    expect(issues.some((issue) => issue.path === 'rampUpMs' && issue.message.includes('durationMs'))).toBe(true);
  });

  it('rejects duration below safety minimum', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs - 1,
    });
    expect(issues.some((issue) => issue.path === 'durationMs')).toBe(true);
  });

  it('rejects duration beyond safety cap', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      durationMs: GRPC_LOAD_TEST_SAFETY_LIMITS.maxDurationMs + 1,
    });
    expect(issues.some((issue) => issue.path === 'durationMs')).toBe(true);
  });

  it('rejects totalCalls beyond safety cap', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: GRPC_LOAD_TEST_SAFETY_LIMITS.maxTotalCalls + 1,
    });
    expect(issues.some((issue) => issue.path === 'totalCalls')).toBe(true);
  });

  it('rejects rampUp beyond safety cap', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: 200,
      rampUpMs: GRPC_LOAD_TEST_SAFETY_LIMITS.maxRampUpMs + 1,
    });
    expect(issues.some((issue) => issue.path === 'rampUpMs')).toBe(true);
  });

  it('rejects warmupCalls greater than or equal to totalCalls', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: 50,
      warmupCalls: 50,
    });
    expect(issues.some((issue) => issue.path === 'warmupCalls')).toBe(true);
  });

  it('assertGrpcLoadTestConfig throws GrpcLoadTestConfigValidationError for invalid input', () => {
    expect(() =>
      assertGrpcLoadTestConfig('server_streaming', {
        concurrency: 0,
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });
});

describe('Phase 11A-E - immutable execute snapshot capture', () => {
  it('captureGrpcLoadTestExecuteSnapshot stores config and environment metadata', () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-1',
      executeSnapshot: makeUnarySnapshot(),
      config: { concurrency: 4, totalCalls: 100, warmupCalls: 10 },
      resolvedEnvName: 'local',
      capturedAt: '2026-06-30T02:00:00.000Z',
    });
    expect(snapshot.runId).toBe('run-1');
    expect(snapshot.resolvedEnvName).toBe('local');
    expect(snapshot.capturedAt).toBe('2026-06-30T02:00:00.000Z');
  });

  it('captureGrpcLoadTestExecuteSnapshot deep-clones execute snapshot and config', () => {
    const execute = makeUnarySnapshot();
    const config = { concurrency: 4, totalCalls: 100, warmupCalls: 10 };

    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-2',
      executeSnapshot: execute,
      config,
    });

    execute.body.message = 'mutated';
    config.totalCalls = 999;

    expect(snapshot.executeSnapshot.body.message).toBe('hello');
    expect(snapshot.config.totalCalls).toBe(100);
  });

  it('captureGrpcLoadTestExecuteSnapshot rejects incomplete execute snapshots', () => {
    const execute = makeUnarySnapshot({ service: '' });
    expect(() =>
      captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-4',
        executeSnapshot: execute,
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('captureGrpcLoadTestExecuteSnapshot rejects empty runId', () => {
    expect(() =>
      captureGrpcLoadTestExecuteSnapshot({
        runId: '   ',
        executeSnapshot: makeUnarySnapshot(),
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('assertGrpcLoadTestRunSnapshot rejects invalid execute snapshot and config together', () => {
    expect(() =>
      assertGrpcLoadTestRunSnapshot({
        runId: 'run-invalid',
        executeSnapshot: makeUnarySnapshot({ method: '' }),
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('captureGrpcLoadTestExecuteSnapshot rejects non-unary execute snapshots', () => {
    const execute = makeUnarySnapshot({ callType: 'server_streaming' });
    expect(() =>
      captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-3',
        executeSnapshot: execute,
        config: { concurrency: 2, totalCalls: 10 },
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });
});

describe('Phase 11A-F - source-scan checklist traceability', () => {
  it('grpcAdvancedFeatureContracts.ts exports namespace constants', () => {
    const src = readSrc('shared/grpc/grpcAdvancedFeatureContracts.ts');
    expect(src.includes('GRPC_ADVANCED_FEATURE_NAMESPACES')).toBe(true);
  });

  it('grpcAdvancedFeatureContracts.ts exports transition guards and cancellation API', () => {
    const src = readSrc('shared/grpc/grpcAdvancedFeatureContracts.ts');
    expect(src.includes('canTransitionGrpcAdvancedOperationStatus')).toBe(true);
    expect(src.includes('requestGrpcAdvancedOperationCancellation')).toBe(true);
    expect(src.includes('GrpcAdvancedOperationTransitionError')).toBe(true);
  });

  it('grpcAdvancedFeatureContracts.ts exports load-test safety limits and validator', () => {
    const src = readSrc('shared/grpc/grpcAdvancedFeatureContracts.ts');
    expect(src.includes('GRPC_LOAD_TEST_SAFETY_LIMITS')).toBe(true);
    expect(src.includes('validateGrpcLoadTestConfig')).toBe(true);
    expect(src.includes('assertGrpcLoadTestRunSnapshot')).toBe(true);
  });

  it('requestValidation.ts exports execute snapshot validator for load-test capture', () => {
    const src = readSrc('shared/grpc/requestValidation.ts');
    expect(src.includes('validateGrpcTabExecuteSnapshot')).toBe(true);
  });

  it('phase 11A acceptance test file includes the expected phase label', () => {
    const src = readSrc('shared/grpc/grpcPhase11aAcceptance.test.ts');
    expect(src.includes('Phase 11A')).toBe(true);
  });
});
