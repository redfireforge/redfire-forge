/**
 * Shared factories for GrpcLoadTestPanel coverage-gap tests.
 */
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../../grpcStudioAdvancedTypes';
import { buildGrpcAdvancedFeatureSourceMetadata } from '@shared/grpc/grpcAdvancedFeatureExport';
import { captureGrpcLoadTestExecuteSnapshot } from '@shared/grpc/grpcAdvancedFeatureContracts';
import { FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import { makeLoadTestSummary } from '../../test-helpers/grpcAdvancedPanel.testHelpers';

export function makeSummaryWithAttempts(runId: string, attemptOverrides: Partial<{
  durationMs: number;
  ok: boolean;
  warmup: boolean;
  finishedAt: string;
  statusCode: number | string;
}> = {}) {
  const summary = makeLoadTestSummary();
  summary.runId = runId;
  summary.startedAt = '2026-07-01T00:00:00.000Z';
  summary.completedAt = '2026-07-01T00:00:05.000Z';
  summary.metrics.latency.p50Ms = 20;
  summary.metrics.latency.p95Ms = 40;
  summary.metrics.latency.p99Ms = 80;
  summary.metrics.throughput.measuredAttemptsPerSecond = 6.5;
  summary.metrics.statusDistribution.measuredAttempts = 4;
  summary.metrics.statusDistribution.failedAttempts = 1;
  summary.metrics.statusDistribution.byStatusCode = { '0': 3, '14': 1, unknown: 1 };
  summary.attempts = [
    {
      attemptNumber: 1,
      warmup: true,
      startedAt: '2026-07-01T00:00:00.050Z',
      finishedAt: '2026-07-01T00:00:00.150Z',
      durationMs: 100,
      ok: true,
      statusCode: 0,
    },
    {
      attemptNumber: 2,
      warmup: false,
      startedAt: '2026-07-01T00:00:01.000Z',
      finishedAt: attemptOverrides.finishedAt ?? '2026-07-01T00:00:01.200Z',
      durationMs: attemptOverrides.durationMs ?? 20,
      ok: attemptOverrides.ok ?? true,
      statusCode: 0,
    },
    {
      attemptNumber: 3,
      warmup: false,
      startedAt: '2026-07-01T00:00:02.000Z',
      finishedAt: '2026-07-01T00:00:02.500Z',
      durationMs: 50,
      ok: true,
      statusCode: 0,
    },
    {
      attemptNumber: 4,
      warmup: false,
      startedAt: '2026-07-01T00:00:03.000Z',
      finishedAt: '2026-07-01T00:00:03.800Z',
      durationMs: 80,
      ok: false,
      statusCode: 14,
      errorMessage: 'UNAVAILABLE',
    },
  ];
  return summary;
}

export function makeExportSource() {
  return buildGrpcAdvancedFeatureSourceMetadata(
    captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-ui',
      executeSnapshot: {
        tabId: 'tab-ui',
        requestId: 'req-ui',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      config: { concurrency: 2, totalCalls: 4 },
    }).executeSnapshot,
  );
}

export function completedRuntime() {
  return {
    ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
    loadTest: { status: 'completed' as const, cancellationRequested: false },
  };
}
