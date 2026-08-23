import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '@shared/grpc/contractFixtures';
import { captureGrpcLoadTestExecuteSnapshot } from '@shared/grpc/grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport } from '@shared/grpc/grpcLoadTestMetrics';
import { startGrpcLoadTestSchedulerRun } from '@shared/grpc/grpcLoadTestSchedulerCore';
import { invokeGrpcUnary } from '@shared/grpc/grpcTransportFacade';
import {
  applyGrpcLoadTestRequestTemplate,
  buildMockConfigSourceFromEditor,
  buildLoadTestRunId,
  finalizeGrpcLoadTestRun,
  getGrpcStudioMockRuntimeRegistry,
  isGrpcAdvancedOperationInFlight,
  isGrpcStudioTabLive,
  nextLoadTestRunGeneration,
  resetAdvancedOpIfTerminal,
  resetAdvancedOpToIdle,
  resetGrpcStudioMockRuntimeRegistryForTests,
  resolveFrozenLoadTestTransportMode,
  resolveGrpcStudioMockConfig,
  resolveLoadTestRunOperationTransition,
  shouldApplyLoadTestRunResult,
  startGrpcStudioLoadTestRun,
  transitionAdvancedOpToCancelled,
  transitionAdvancedOpToCompleted,
  transitionAdvancedOpToFailed,
  transitionAdvancedOpToRunning,
  transitionAdvancedOpQuickComplete,
  validateLoadTestPreconditions,
} from './grpcStudioAdvancedCommands';
import { createInitialGrpcAdvancedOperationState, transitionGrpcAdvancedOperationState } from '@shared/grpc/grpcAdvancedFeatureContracts';

vi.mock('../../../shared/grpc/grpcTransportFacade', () => ({
  invokeGrpcUnary: vi.fn(),
}));

const collectGrpcWorkflowServerStreamMock = vi.fn();
vi.mock('../../workflow/utils/grpcWorkflowStreamCollector', () => ({
  collectGrpcWorkflowServerStream: (...args: unknown[]) => collectGrpcWorkflowServerStreamMock(...args),
}));

function makeExecuteSnapshot() {
  return {
    tabId: 'tab-adv',
    requestId: 'req-adv',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hello' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    transportMode: 'express' as const,
  };
}

describe('grpcStudioAdvancedCommands coverage gaps', () => {
  beforeEach(() => {
    resetGrpcStudioMockRuntimeRegistryForTests();
    vi.mocked(invokeGrpcUnary).mockReset();
    collectGrpcWorkflowServerStreamMock.mockReset();
    collectGrpcWorkflowServerStreamMock.mockResolvedValue({
      messages: [{ seq: 1 }],
      durationMs: 8,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'stream_end',
    });
  });

  afterEach(() => {
    resetGrpcStudioMockRuntimeRegistryForTests();
  });

  it('validateLoadTestPreconditions returns undefined for valid unary config', () => {
    expect(validateLoadTestPreconditions('unary', { concurrency: 2, totalCalls: 5 })).toBeUndefined();
  });

  it('validateLoadTestPreconditions treats missing call type as unary', () => {
    expect(validateLoadTestPreconditions(undefined, { concurrency: 1, totalCalls: 1 })).toBeUndefined();
    expect(validateLoadTestPreconditions(undefined, { concurrency: 0, totalCalls: 1 })).toBeTruthy();
  });

  it('applyGrpcLoadTestRequestTemplate overrides unary body from JSON template', () => {
    const snapshot = makeExecuteSnapshot();
    const applied = applyGrpcLoadTestRequestTemplate(snapshot, {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '{"message":"from-template"}',
    });
    expect(applied.body).toEqual({ message: 'from-template' });
    expect(snapshot.body).toEqual({ message: 'hello' });
  });

  it('applyGrpcLoadTestRequestTemplate validates template shape', () => {
    expect(() => applyGrpcLoadTestRequestTemplate(makeExecuteSnapshot(), {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '[]',
    })).toThrow(/JSON object/i);
  });

  it('applyGrpcLoadTestRequestTemplate returns snapshot unchanged for non-unary call types', () => {
    const snapshot = {
      ...makeExecuteSnapshot(),
      callType: 'server_streaming' as const,
    };
    const result = applyGrpcLoadTestRequestTemplate(snapshot, {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '{"message":"ignored"}',
    });
    expect(result).toBe(snapshot);
    expect(result.body).toEqual({ message: 'hello' });
  });

  it('applyGrpcLoadTestRequestTemplate skips empty or whitespace-only templates', () => {
    const snapshot = makeExecuteSnapshot();
    expect(applyGrpcLoadTestRequestTemplate(snapshot, {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '   \n\t',
    })).toBe(snapshot);
    expect(applyGrpcLoadTestRequestTemplate(snapshot, {
      concurrency: 1,
      totalCalls: 1,
    }).body).toEqual({ message: 'hello' });
  });

  it('applyGrpcLoadTestRequestTemplate rejects invalid JSON templates', () => {
    expect(() => applyGrpcLoadTestRequestTemplate(makeExecuteSnapshot(), {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: '{not-json',
    })).toThrow(/valid JSON/i);
    expect(() => applyGrpcLoadTestRequestTemplate(makeExecuteSnapshot(), {
      concurrency: 1,
      totalCalls: 1,
      requestTemplateJson: 'null',
    })).toThrow(/JSON object/i);
  });

  it('validateLoadTestPreconditions reports unresolved methods', () => {
    expect(
      validateLoadTestPreconditions('unary', { concurrency: 1, totalCalls: 1 }, { methodResolved: false }),
    ).toMatch(/not found/i);
  });

  it('validateLoadTestPreconditions rejects browser-direct transport for server_streaming load tests', () => {
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'grpc-web',
    })).toMatch(/Express proxy or native transport/i);
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'spring-servlet',
    })).toMatch(/Express proxy or native transport/i);
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'express',
    })).toBeUndefined();
  });

  it('resolveFrozenLoadTestTransportMode falls back to platform default', () => {
    expect(resolveFrozenLoadTestTransportMode({ transportMode: 'native' })).toBe('native');
    expect(resolveFrozenLoadTestTransportMode({})).toBe('express');
  });

  it('startGrpcStudioLoadTestRun rejects browser-direct transport at dispatch time', () => {
    expect(() => startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: {
        ...makeExecuteSnapshot(),
        callType: 'server_streaming',
        transportMode: 'spring-servlet',
      },
      config: { concurrency: 1, totalCalls: 1 },
    })).toThrow(/Express proxy or native transport/i);
    expect(() => startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: {
        ...makeExecuteSnapshot(),
        callType: 'server_streaming',
        transportMode: 'grpc-web',
      },
      config: { concurrency: 1, totalCalls: 1 },
    })).toThrow(/Express proxy or native transport/i);
  });

  it('startGrpcStudioLoadTestRun dispatches server_streaming through stream collector with frozen transport', async () => {
    const run = startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: {
        ...makeExecuteSnapshot(),
        callType: 'server_streaming',
        transportMode: 'express',
      },
      config: { concurrency: 1, totalCalls: 1 },
    });
    const report = await run.completion;
    expect(report.counts.succeeded).toBe(1);
    expect(collectGrpcWorkflowServerStreamMock).toHaveBeenCalledTimes(1);
    expect(collectGrpcWorkflowServerStreamMock.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({ transportMode: 'express' }),
    );
  });

  it('buildMockConfigSourceFromEditor clones rule set and optional latency policy', () => {
    const ruleSet = { rules: [] };
    const withLatency = buildMockConfigSourceFromEditor(ruleSet, { defaultLatencyMs: 25, jitterMs: 5 });
    expect(withLatency.latencyPolicy?.defaultLatencyMs).toBe(25);
    const withoutLatency = buildMockConfigSourceFromEditor(ruleSet);
    expect(withoutLatency.latencyPolicy).toBeUndefined();
  });

  it('getGrpcStudioMockRuntimeRegistry returns a shared singleton', () => {
    const first = getGrpcStudioMockRuntimeRegistry();
    const second = getGrpcStudioMockRuntimeRegistry();
    expect(first).toBe(second);
    first.setActiveTab('tab-1');
    expect(second.getActiveTabId()).toBe('tab-1');
  });

  it('startGrpcStudioLoadTestRun records success and failure attempts', async () => {
    vi.mocked(invokeGrpcUnary)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          message: {},
          durationMs: 12,
        },
      })
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        data: {
          callType: 'unary',
          status: 16,
          statusMessage: 'Failed',
          headers: {},
          trailers: {},
          message: {},
          durationMs: 8,
        },
      });

    const run = startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: makeExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 3 },
      resolvedEnvName: 'local',
    });

    const report = await run.completion;
    expect(report.counts.completed).toBe(3);
    expect(report.counts.failed).toBeGreaterThanOrEqual(1);
  });

  it('startGrpcStudioLoadTestRun stringifies non-Error transport failures', async () => {
    vi.mocked(invokeGrpcUnary).mockRejectedValueOnce('plain failure');

    const run = startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: makeExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 1 },
    });
    const report = await run.completion;
    expect(report.attempts[0]?.errorMessage).toBe('plain failure');
  });

  it('finalizeGrpcLoadTestRun builds export summary from scheduler run', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-finalize',
      executeSnapshot: makeExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 1 },
    });
    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true, durationMs: 5, statusCode: 0 }),
    });
    const summary = await finalizeGrpcLoadTestRun(run);
    expect(summary.metrics).toBeTruthy();
    expect(summary.kind).toBe('grpc_load_test_summary');
  });

  it('startGrpcStudioLoadTestRun derives durationMs when transport omits it', async () => {
    vi.mocked(invokeGrpcUnary).mockResolvedValueOnce({
      ok: true,
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        message: {},
      },
    });

    const run = startGrpcStudioLoadTestRun({
      tabId: 'tab-adv',
      executeSnapshot: makeExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 1 },
    });
    const report = await run.completion;
    expect(report.attempts[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('transitionAdvancedOpQuickComplete advances validating and running states', () => {
    const idle = { status: 'idle' as const, cancellationRequested: false };
    expect(transitionAdvancedOpQuickComplete(idle).status).toBe('completed');

    const validating = { status: 'validating' as const, cancellationRequested: false, operationId: 'op-v' };
    expect(transitionAdvancedOpQuickComplete(validating).status).toBe('completed');

    const running = transitionAdvancedOpToRunning(idle, 'op-r');
    expect(transitionAdvancedOpQuickComplete(running).status).toBe('completed');
  });

  it('transitionAdvancedOpQuickComplete resets terminal completed state before completing', () => {
    const completed = {
      status: 'completed' as const,
      cancellationRequested: false,
      operationId: 'op-done',
      completedAt: '2026-07-01T00:00:00.000Z',
    };
    const next = transitionAdvancedOpQuickComplete(completed);
    expect(next.status).toBe('completed');
    expect(next.operationId).toBeUndefined();
  });

  it('resetAdvancedOpIfTerminal returns non-terminal state unchanged', () => {
    const validating = {
      status: 'validating' as const,
      cancellationRequested: false,
      operationId: 'op-v',
    };
    expect(resetAdvancedOpIfTerminal(validating)).toBe(validating);

    const running = {
      status: 'running' as const,
      cancellationRequested: false,
      operationId: 'op-r',
    };
    expect(resetAdvancedOpIfTerminal(running)).toBe(running);
  });

  it('transitionAdvancedOpToRunning reinitializes from in-flight validating state', () => {
    const validating = {
      status: 'validating' as const,
      cancellationRequested: false,
      operationId: 'old-op',
    };
    const next = transitionAdvancedOpToRunning(validating, 'new-op');
    expect(next.status).toBe('running');
    expect(next.operationId).toBe('new-op');
  });

  it('transitionAdvancedOpToRunning reinitializes from in-flight running state', () => {
    const running = {
      status: 'running' as const,
      cancellationRequested: false,
      operationId: 'old-op',
    };
    const next = transitionAdvancedOpToRunning(running, 'new-op');
    expect(next.status).toBe('running');
    expect(next.operationId).toBe('new-op');
  });

  it('transitionAdvancedOpToRunning resets terminal completed state before starting', () => {
    const completed = { status: 'completed' as const, cancellationRequested: false };
    expect(transitionAdvancedOpToRunning(completed, 'op-new').status).toBe('running');
  });

  it('transitionAdvancedOpToCompleted completes an already running operation', () => {
    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-1' };
    expect(transitionAdvancedOpToCompleted(running).status).toBe('completed');
  });

  it('transitionAdvancedOpToCompleted uses quick-complete path from non-running state', () => {
    const idle = { status: 'idle' as const, cancellationRequested: false };
    expect(transitionAdvancedOpToCompleted(idle).status).toBe('completed');

    const validating = {
      status: 'validating' as const,
      cancellationRequested: false,
      operationId: 'op-v',
    };
    expect(transitionAdvancedOpToCompleted(validating).status).toBe('completed');
  });

  it('transitionAdvancedOpToCancelled handles failed and validating states', () => {
    const failed = transitionAdvancedOpToFailed({ status: 'idle', cancellationRequested: false }, 'x');
    expect(transitionAdvancedOpToCancelled(failed).status).toBe('cancelled');

    const validating = { status: 'validating' as const, cancellationRequested: false, operationId: 'op-v' };
    expect(transitionAdvancedOpToCancelled(validating).status).toBe('cancelled');
  });

  it('transitionAdvancedOpToCancelled cancels directly from running state', () => {
    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-run' };
    expect(transitionAdvancedOpToCancelled(running).status).toBe('cancelled');
  });

  it('transitionAdvancedOpToCancelled advances idle state through validating to cancelled', () => {
    const idle = { status: 'idle' as const, cancellationRequested: false };
    expect(transitionAdvancedOpToCancelled(idle).status).toBe('cancelled');
  });

  it('transitionAdvancedOpToFailed and resetAdvancedOpToIdle handle non-terminal states', () => {
    const failed = transitionAdvancedOpToFailed({ status: 'idle', cancellationRequested: false }, 'boom');
    expect(failed.status).toBe('failed');
    expect(failed.error?.message).toBe('boom');

    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-1' };
    expect(resetAdvancedOpToIdle(running).status).toBe('idle');

    const runningFailed = transitionAdvancedOpToFailed(running, 'late failure');
    expect(runningFailed.status).toBe('failed');
    expect(runningFailed.error?.message).toBe('late failure');

    const completed = transitionAdvancedOpToCompleted(
      transitionAdvancedOpToRunning({ status: 'idle', cancellationRequested: false }, 'op-2'),
    );
    expect(transitionAdvancedOpToCancelled(completed).status).toBe('cancelled');
  });

  it('transitionAdvancedOpToFailed transitions directly from running without re-validating', () => {
    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-run' };
    const failed = transitionAdvancedOpToFailed(running, 'in-flight failure');
    expect(failed.status).toBe('failed');
    expect(failed.error?.message).toBe('in-flight failure');
  });

  it('resetAdvancedOpToIdle reinitializes validating and running non-terminal states', () => {
    const validating = {
      status: 'validating' as const,
      cancellationRequested: false,
      operationId: 'op-v',
    };
    expect(resetAdvancedOpToIdle(validating)).toEqual(createInitialGrpcAdvancedOperationState());

    const running = {
      status: 'running' as const,
      cancellationRequested: false,
      operationId: 'op-r',
    };
    expect(resetAdvancedOpToIdle(running)).toEqual(createInitialGrpcAdvancedOperationState());
  });

  it('resetAdvancedOpToIdle transitions terminal states to idle', () => {
    const completed = { status: 'completed' as const, cancellationRequested: false };
    expect(resetAdvancedOpToIdle(completed).status).toBe('idle');

    const failed = {
      status: 'failed' as const,
      cancellationRequested: false,
      error: { category: 'runtime' as const, message: 'x' },
    };
    expect(resetAdvancedOpToIdle(failed).status).toBe('idle');

    const cancelled = { status: 'cancelled' as const, cancellationRequested: true };
    expect(resetAdvancedOpToIdle(cancelled).status).toBe('idle');
  });

  it('buildMockConfigSourceFromEditor normalizes partial and empty latency policies', () => {
    const ruleSet = { rules: [] };
    expect(buildMockConfigSourceFromEditor(ruleSet, { seed: 42 }).latencyPolicy).toEqual({ seed: 42 });
    expect(buildMockConfigSourceFromEditor(ruleSet, { defaultLatencyMs: 0, jitterMs: 0 }).latencyPolicy).toEqual({
      defaultLatencyMs: 0,
      jitterMs: 0,
    });
    expect(buildMockConfigSourceFromEditor(ruleSet, {}).latencyPolicy).toBeUndefined();
  });

  it('resolveGrpcStudioMockConfig falls back to workspace when profile mock is absent', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-2',
      workspaceDefault: { ruleSet: { rules: [] } },
    });
    expect(resolved.source).toBe('workspace_default');
  });

  it('resolveGrpcStudioMockConfig uses profile mock config when provided', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      profileConnectionId: 'conn-1',
      profileMockConfig: { ruleSet: { rules: [] } },
      workspaceDefault: { ruleSet: { rules: [] } },
    });
    expect(resolved.source).toBe('connection_profile');
  });

  it('resolveGrpcStudioMockConfig falls back profile connection id to tab id', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-profile-fallback',
      profileMockConfig: { ruleSet: { rules: [] } },
      workspaceDefault: { ruleSet: { rules: [] } },
    });
    expect(resolved.source).toBe('connection_profile');
    expect(resolved.connectionId).toBe('tab-profile-fallback');
  });

  it('computeGrpcStudioSchemaDiffReport detects descriptor changes', async () => {
    const { computeGrpcStudioSchemaDiffReport } = await import('./grpcStudioAdvancedCommands');
    const candidate = structuredClone(FIXTURE_DESCRIPTOR);
    candidate.services[0]!.methods = candidate.services[0]!.methods.slice(0, 1);
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate,
      generatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(report.changes.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('buildGrpcLoadTestRunSummaryExport supports cancelled stop reason in hook consumers', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-cancel',
        executeSnapshot: makeExecuteSnapshot(),
        config: { concurrency: 1, totalCalls: 1 },
      }),
      report: {
        runId: 'run-cancel',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:01.000Z',
        durationMs: 1000,
        stopReason: 'cancelled',
        counts: {
          scheduled: 1,
          completed: 0,
          succeeded: 0,
          failed: 0,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 0,
        },
        attempts: [],
      },
    });
    expect(summary.stopReason).toBe('cancelled');
  });

  it('resolveLoadTestRunOperationTransition fails on partial load-test failures', () => {
    const running = transitionAdvancedOpToRunning(createInitialGrpcAdvancedOperationState(), 'op-1');
    const next = resolveLoadTestRunOperationTransition(running, {
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 1,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
    });
    expect(next.status).toBe('failed');
    expect(next.error?.message).toMatch(/1 failed/);
  });

  it('covers advanced operation helpers and load-test run id generation', () => {
    expect(buildLoadTestRunId('tab-x')).toContain('tab-x');
    expect(nextLoadTestRunGeneration(undefined)).toBe(1);
    expect(nextLoadTestRunGeneration(2)).toBe(3);
    expect(shouldApplyLoadTestRunResult(1, 1)).toBe(true);
    expect(shouldApplyLoadTestRunResult(1, 2)).toBe(false);
    expect(isGrpcAdvancedOperationInFlight('running')).toBe(true);
    expect(isGrpcStudioTabLive([{ id: 'tab-1' }], 'tab-1')).toBe(true);
    expect(isGrpcStudioTabLive([{ id: 'tab-1' }], 'tab-2')).toBe(false);

    const completed = transitionAdvancedOpQuickComplete(
      transitionAdvancedOpToRunning(createInitialGrpcAdvancedOperationState(), 'op-quick'),
    );
    expect(completed.status).toBe('completed');
    expect(resetAdvancedOpIfTerminal(completed).status).toBe('idle');
    expect(resetAdvancedOpIfTerminal({ status: 'running', cancellationRequested: false, operationId: 'op' }).status).toBe('running');
  });

  it('resolveLoadTestRunOperationTransition completes when all attempts succeed', () => {
    const running = transitionAdvancedOpToRunning(createInitialGrpcAdvancedOperationState(), 'op-success');
    const next = resolveLoadTestRunOperationTransition(running, {
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 2,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
    });
    expect(next.status).toBe('completed');
  });

  it('resolveGrpcStudioMockConfig uses tab override when profile is absent', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-override',
      mockConfigOverride: { ruleSet: { rules: [] } },
      workspaceDefault: { ruleSet: { rules: [] } },
    });
    expect(resolved.source).toBe('tab_override');
  });

  it('validateLoadTestPreconditions rejects client and bidi streaming call types', () => {
    expect(validateLoadTestPreconditions('client_streaming', { concurrency: 1, totalCalls: 1 }))
      .toMatch(/unary and server-streaming/i);
    expect(validateLoadTestPreconditions('bidi_streaming', { concurrency: 1, totalCalls: 1 }))
      .toMatch(/unary and server-streaming/i);
  });

  it('validateLoadTestPreconditions defaults server-streaming transport to platform mode', () => {
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 1, totalCalls: 1 }))
      .toBeUndefined();
  });

  it('isGrpcAdvancedOperationInFlight treats validating as in-flight', () => {
    expect(isGrpcAdvancedOperationInFlight('validating')).toBe(true);
  });

  it('resolveLoadTestRunOperationTransition cancels when stop reason is cancelled', () => {
    const running = transitionAdvancedOpToRunning(createInitialGrpcAdvancedOperationState(), 'op-cancel');
    const next = resolveLoadTestRunOperationTransition(running, {
      stopReason: 'cancelled',
      counts: {
        scheduled: 1,
        completed: 0,
        succeeded: 0,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 0,
      },
    });
    expect(next.status).toBe('cancelled');
  });

  it('resolveGrpcStudioMockConfig omits profile branch when profile mock is null', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-no-profile',
      profileConnectionId: 'conn-1',
      profileMockConfig: undefined,
      workspaceDefault: { ruleSet: { rules: [{ id: 'r1', match: {}, response: {} }] } },
    });
    expect(resolved.source).toBe('workspace_default');
  });

  it('transitionAdvancedOp helpers cover non-idle and terminal edge paths', () => {
    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-run' };
    expect(transitionAdvancedOpToCompleted(running).status).toBe('completed');
    expect(transitionAdvancedOpToCancelled(running).status).toBe('cancelled');

    const failed = transitionAdvancedOpToFailed(
      { status: 'failed' as const, cancellationRequested: false, operationId: 'op-fail', error: { category: 'runtime', message: 'x' } },
      'again',
    );
    expect(failed.status).toBe('failed');

    const validatingOnly = transitionGrpcAdvancedOperationState(
      createInitialGrpcAdvancedOperationState(),
      'validating',
      { operationId: 'op-v' },
    );
    expect(transitionAdvancedOpToCancelled(validatingOnly).status).toBe('cancelled');
    expect(resetAdvancedOpToIdle({ status: 'running', cancellationRequested: false, operationId: 'op' }).status).toBe('idle');
  });
});
