import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { captureGrpcLoadTestExecuteSnapshot } from './grpcAdvancedFeatureContracts';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  prepareGrpcLoadTestRunSummaryExportSafe,
  prepareGrpcSchemaDiffReportExportSafe,
  sanitizeGrpcLoadTestAttemptForExport,
  serializeGrpcLoadTestRunSummaryExportSafeJson,
  serializeGrpcLoadTestRunSummaryExportSafeCsv,
  serializeGrpcSchemaDiffReportExportSafeJson,
  serializeGrpcSchemaDiffReportExportSafeMarkdown,
} from './grpcAdvancedFeatureExport';
import { buildGrpcLoadTestRunSummaryExport } from './grpcLoadTestMetrics';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import { scanForbiddenGrpcPersistTargets } from './grpcSecretLeakScan';

const SECRET = 'phase11h-export-leak-token-abc123xyz';

function makeExecuteSnapshotForSourceMetadata() {
  return {
    tabId: 'tab-11h',
    requestId: 'req-11h',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: { address: '{{grpcHost}}:50051', tlsMode: 'disabled' as const },
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hello', apiKey: SECRET },
    metadata: { authorization: `Bearer ${SECRET}` },
    timeoutMs: 10_000,
    descriptorKey: 'reflection:localhost:50051',
    auth: { type: 'bearer' as const, bearerToken: SECRET },
    transportMode: 'express' as const,
  };
}

function makeExecuteSnapshotForSummary() {
  return {
    ...makeExecuteSnapshotForSourceMetadata(),
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    body: { message: 'hello' },
    metadata: {},
    auth: undefined,
  };
}

function makeSummaryWithSecretError() {
  const snapshot = captureGrpcLoadTestExecuteSnapshot({
    runId: 'run-11h',
    executeSnapshot: makeExecuteSnapshotForSummary(),
    config: { concurrency: 2, totalCalls: 2 },
    resolvedEnvName: 'local',
  });
  return buildGrpcLoadTestRunSummaryExport({
    snapshot,
    report: {
      runId: 'run-11h',
      startedAt: '2026-07-01T00:00:01.000Z',
      completedAt: '2026-07-01T00:00:02.000Z',
      durationMs: 1000,
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 1,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 2,
      },
      attempts: [
        {
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:01.000Z',
          finishedAt: '2026-07-01T00:00:01.500Z',
          durationMs: 500,
          ok: false,
          statusCode: 16,
          errorMessage: `rpc error: code = Unauthenticated desc = Bearer ${SECRET}`,
        },
      ],
    },
  });
}

describe('grpcAdvancedFeatureExport (Phase 11H)', () => {
  it('buildGrpcAdvancedFeatureSourceMetadata excludes secrets from export surface', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata(), {
      connectionId: 'conn-1',
    });
    expect(metadata.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(metadata.targetTemplate).toBe('{{grpcHost}}:50051');
    expect(metadata.transportMode).toBe('express');
    expect(metadata.connectionId).toBe('conn-1');
    expect(JSON.stringify(metadata)).not.toContain(SECRET);
    expect(metadata).not.toHaveProperty('metadata');
    expect(metadata).not.toHaveProperty('auth');
    expect(metadata).not.toHaveProperty('body');
  });

  it('buildGrpcAdvancedFeatureSourceMetadata redacts standalone credential-like target templates', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata({
      ...makeExecuteSnapshotForSourceMetadata(),
      target: {
        address: SECRET,
        tlsMode: 'disabled',
      },
    });
    expect(metadata.targetTemplate).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(metadata.targetTemplate).not.toContain(SECRET);
  });

  it('buildGrpcAdvancedFeatureSourceMetadata redacts bearer-shaped target templates', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata({
      ...makeExecuteSnapshotForSourceMetadata(),
      target: {
        address: `Bearer ${SECRET}`,
        tlsMode: 'disabled',
      },
    });
    expect(metadata.targetTemplate).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(metadata.targetTemplate).not.toContain(SECRET);
  });

  it('buildGrpcAdvancedFeatureSourceMetadata preserves env template targets', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata());
    expect(metadata.targetTemplate).toBe('{{grpcHost}}:50051');
  });

  it('sanitizeGrpcLoadTestAttemptForExport redacts bearer tokens in errorMessage', () => {
    const sanitized = sanitizeGrpcLoadTestAttemptForExport({
      attemptNumber: 1,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: false,
      errorMessage: `Bearer ${SECRET}`,
    });
    expect(sanitized.errorMessage).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(sanitized.errorMessage).not.toContain(SECRET);
  });

  it('prepareGrpcLoadTestRunSummaryExportSafe re-sanitizes poisoned sourceMetadata targetTemplate', () => {
    const summary = makeSummaryWithSecretError();
    const poisonedMetadata = {
      ...buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata()),
      targetTemplate: SECRET,
    };
    const safe = prepareGrpcLoadTestRunSummaryExportSafe(summary, poisonedMetadata);
    expect(safe.sourceMetadata.targetTemplate).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(safe)).not.toContain(SECRET);
    const leaks = scanForbiddenGrpcPersistTargets({ grpc_load_test_export: safe });
    expect(leaks).toHaveLength(0);
  });

  it('prepareGrpcLoadTestRunSummaryExportSafe stamps sourceMetadata and passes leak scan', () => {
    const summary = makeSummaryWithSecretError();
    const sourceMetadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata());
    const safe = prepareGrpcLoadTestRunSummaryExportSafe(summary, sourceMetadata);
    expect(safe.sourceMetadata.descriptorKey).toBe('reflection:localhost:50051');
    expect(safe.attempts[0]?.errorMessage).not.toContain(SECRET);
    const leaks = scanForbiddenGrpcPersistTargets({ grpc_load_test_export: safe });
    expect(leaks).toHaveLength(0);
  });

  it('serializeGrpcLoadTestRunSummaryExportSafeJson includes sourceMetadata block', () => {
    const summary = makeSummaryWithSecretError();
    const sourceMetadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata());
    const json = serializeGrpcLoadTestRunSummaryExportSafeJson(summary, sourceMetadata);
    const parsed = JSON.parse(json) as { sourceMetadata?: { service?: string } };
    expect(parsed.sourceMetadata?.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(json).not.toContain(SECRET);
  });

  it('serializeGrpcLoadTestRunSummaryExportSafeCsv redacts secrets and includes source metadata columns', () => {
    const summary = makeSummaryWithSecretError();
    const sourceMetadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata());
    const csv = serializeGrpcLoadTestRunSummaryExportSafeCsv(summary, sourceMetadata);
    expect(csv).not.toContain(SECRET);
    expect(csv).toContain('measuredAttemptsPerSecond');
    expect(csv).toContain('sourceService');
    expect(csv).toContain(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(csv).toContain('sourceDescriptorKey');
  });

  it('detectGrpcSecretMaterialInDiagnosticText flags standalone credential fragments', async () => {
    const { detectGrpcSecretMaterialInDiagnosticText } = await import('./grpcSecretLeakScan');
    expect(detectGrpcSecretMaterialInDiagnosticText(SECRET)).toBe(true);
    expect(detectGrpcSecretMaterialInDiagnosticText('Field removed from message')).toBe(false);
    expect(detectGrpcSecretMaterialInDiagnosticText(`prefix Bearer ${SECRET} suffix`)).toBe(true);
  });

  it('prepareGrpcSchemaDiffReportExportSafe redacts secret-like tokens in descriptions', () => {
    const safe = prepareGrpcSchemaDiffReportExportSafe({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 1, nonBreaking: 0, informational: 0 },
      changes: [{
        severity: 'breaking',
        entityType: 'method',
        entityPath: 'echo.EchoService/Echo',
        changeType: 'removed',
        description: SECRET,
      }],
    });
    expect(safe.changes[0]?.description).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('prepareGrpcSchemaDiffReportExportSafe stamps exportMeta and sanitizes descriptions', () => {
    const safe = prepareGrpcSchemaDiffReportExportSafe({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 1, nonBreaking: 0, informational: 0 },
      changes: [{
        severity: 'breaking',
        entityType: 'method',
        entityPath: 'echo.EchoService/Echo',
        changeType: 'removed',
        description: `RPC removed with token Bearer ${SECRET}`,
      }],
    }, { baselineCapturedAt: '2026-06-30T12:00:00.000Z' });
    expect(safe.exportMeta.exportedFrom).toBe('grpc_studio_advanced');
    expect(safe.exportMeta.baselineCapturedAt).toBe('2026-06-30T12:00:00.000Z');
    expect(safe.changes[0]?.description).not.toContain(SECRET);
    const leaks = scanForbiddenGrpcPersistTargets({ grpc_schema_diff_export: safe });
    expect(leaks).toHaveLength(0);
  });

  it('serializeGrpcSchemaDiffReportExportSafeJson includes exportMeta', () => {
    const json = serializeGrpcSchemaDiffReportExportSafeJson({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 0, nonBreaking: 0, informational: 0 },
      changes: [],
    });
    const parsed = JSON.parse(json) as { exportMeta?: { exportedFrom?: string } };
    expect(parsed.exportMeta?.exportedFrom).toBe('grpc_studio_advanced');
  });

  it('serializeGrpcSchemaDiffReportExportSafeMarkdown appends export metadata footer', () => {
    const markdown = serializeGrpcSchemaDiffReportExportSafeMarkdown({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 0, nonBreaking: 0, informational: 0 },
      changes: [],
    }, { baselineCapturedAt: '2026-06-30T12:00:00.000Z', exportedAt: '2026-07-01T00:00:00.000Z' });
    expect(markdown).toContain('## Export metadata');
    expect(markdown).toContain('grpc_studio_advanced');
    expect(markdown).toContain('2026-06-30T12:00:00.000Z');
  });

  it('buildGrpcAdvancedFeatureSourceMetadata omits optional connectionId', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata(makeExecuteSnapshotForSourceMetadata());
    expect(metadata.connectionId).toBeUndefined();
    expect(metadata.capturedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('sanitizeGrpcLoadTestAttemptForExport returns attempt unchanged when errorMessage is absent', () => {
    const attempt = {
      attemptNumber: 1,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: true,
    };
    expect(sanitizeGrpcLoadTestAttemptForExport(attempt)).toEqual(attempt);
  });

  it('sanitizeGrpcLoadTestAttemptForExport sanitizes non-secret error text without redacting', () => {
    const sanitized = sanitizeGrpcLoadTestAttemptForExport({
      attemptNumber: 2,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: false,
      errorMessage: 'connection reset by peer',
    });
    expect(sanitized.errorMessage).toBe('connection reset by peer');
    expect(sanitized.errorMessage).not.toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('prepareGrpcSchemaDiffReportExportSafe preserves sanitized caveat text', () => {
    const safe = prepareGrpcSchemaDiffReportExportSafe({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 0, nonBreaking: 1, informational: 0 },
      changes: [{
        severity: 'non_breaking',
        entityType: 'field',
        entityPath: 'msg.field',
        changeType: 'type_changed',
        description: 'type widened',
        caveat: 'verify clients',
      }],
    });
    expect(safe.changes[0]?.caveat).toBe('verify clients');
  });

  it('serializeGrpcSchemaDiffReportExportSafeMarkdown omits baseline footer when not captured', () => {
    const markdown = serializeGrpcSchemaDiffReportExportSafeMarkdown({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 0, nonBreaking: 0, informational: 0 },
      changes: [],
    }, { exportedAt: '2026-07-01T00:00:00.000Z' });
    expect(markdown).toContain('## Export metadata');
    expect(markdown).not.toContain('Baseline captured at');
  });
});
