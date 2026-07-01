import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import { startGrpcLoadTestSchedulerRun } from '../../../shared/grpc/grpcLoadTestSchedulerCore';
import { invokeGrpcUnary } from '../../../shared/grpc/grpcTransportFacade';
import {
  buildMockConfigSourceFromEditor,
  finalizeGrpcLoadTestRun,
  getGrpcStudioMockRuntimeRegistry,
  resetAdvancedOpToIdle,
  resetGrpcStudioMockRuntimeRegistryForTests,
  resolveGrpcStudioMockConfig,
  startGrpcStudioLoadTestRun,
  transitionAdvancedOpToCancelled,
  transitionAdvancedOpToCompleted,
  transitionAdvancedOpToFailed,
  transitionAdvancedOpToRunning,
  transitionAdvancedOpQuickComplete,
  validateLoadTestPreconditions,
} from './grpcStudioAdvancedCommands';

vi.mock('../../../shared/grpc/grpcTransportFacade', () => ({
  invokeGrpcUnary: vi.fn(),
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

  it('validateLoadTestPreconditions reports unresolved methods', () => {
    expect(
      validateLoadTestPreconditions('unary', { concurrency: 1, totalCalls: 1 }, { methodResolved: false }),
    ).toMatch(/not found/i);
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

  it('transitionAdvancedOpToRunning resets non-idle non-terminal state', () => {
    const completed = { status: 'completed' as const, cancellationRequested: false };
    expect(transitionAdvancedOpToRunning(completed, 'op-new').status).toBe('running');
  });

  it('transitionAdvancedOpToCompleted completes an already running operation', () => {
    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-1' };
    expect(transitionAdvancedOpToCompleted(running).status).toBe('completed');
  });

  it('transitionAdvancedOpToCancelled handles failed and validating states', () => {
    const failed = transitionAdvancedOpToFailed({ status: 'idle', cancellationRequested: false }, 'x');
    expect(transitionAdvancedOpToCancelled(failed).status).toBe('cancelled');

    const validating = { status: 'validating' as const, cancellationRequested: false, operationId: 'op-v' };
    expect(transitionAdvancedOpToCancelled(validating).status).toBe('cancelled');
  });

  it('transitionAdvancedOpToFailed and resetAdvancedOpToIdle handle non-terminal states', () => {
    const failed = transitionAdvancedOpToFailed({ status: 'idle', cancellationRequested: false }, 'boom');
    expect(failed.status).toBe('failed');
    expect(failed.error?.message).toBe('boom');

    const running = { status: 'running' as const, cancellationRequested: false, operationId: 'op-1' };
    expect(resetAdvancedOpToIdle(running).status).toBe('idle');

    const runningFailed = transitionAdvancedOpToFailed(running, 'late failure');
    expect(runningFailed.status).toBe('failed');

    const completed = transitionAdvancedOpToCompleted(
      transitionAdvancedOpToRunning({ status: 'idle', cancellationRequested: false }, 'op-2'),
    );
    expect(transitionAdvancedOpToCancelled(completed).status).toBe('cancelled');
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

  it('computeGrpcStudioSchemaDiffReport detects descriptor changes', async () => {
    const { computeGrpcStudioSchemaDiffReport } = await import('./grpcStudioAdvancedCommands');
    const candidate = structuredClone(FIXTURE_DESCRIPTOR);
    candidate.services[0]!.methods = candidate.services[0]!.methods.slice(0, 1);
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate,
    });
    expect(report.changes.length).toBeGreaterThan(0);
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
});
