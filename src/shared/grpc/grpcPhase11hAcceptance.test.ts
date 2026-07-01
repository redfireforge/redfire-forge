/**
 * Phase 11H — Cross-surface integration and export safety acceptance tests.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS } from './grpcSecretPolicy';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11H acceptance checklist', () => {
  it('exports advanced feature export safety modules', async () => {
    const mod = await import('./grpcAdvancedFeatureExport');
    expect(typeof mod.buildGrpcAdvancedFeatureSourceMetadata).toBe('function');
    expect(typeof mod.prepareGrpcLoadTestRunSummaryExportSafe).toBe('function');
    expect(typeof mod.prepareGrpcSchemaDiffReportExportSafe).toBe('function');
    expect(typeof mod.serializeGrpcLoadTestRunSummaryExportSafeJson).toBe('function');
    expect(typeof mod.serializeGrpcSchemaDiffReportExportSafeMarkdown).toBe('function');
  });

  it('includes advanced export targets in forbidden persist list', () => {
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_load_test_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_schema_diff_export');
  });

  it('useGrpcStudioAdvancedFeatures wires safe export serializers', () => {
    const src = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    expect(src).toContain('buildGrpcAdvancedFeatureSourceMetadata');
    expect(src).toContain('serializeGrpcLoadTestRunSummaryExportSafeJson');
    expect(src).toContain('serializeGrpcLoadTestRunSummaryExportSafeCsv');
    expect(src).toContain('serializeGrpcSchemaDiffReportExportSafeJson');
    expect(src).toContain('serializeGrpcSchemaDiffReportExportSafeMarkdown');
    expect(src).toContain('lastExportSource');
  });

  it('GrpcLoadTestPanel and GrpcSchemaDiffPanel copy via advanced export helpers', () => {
    const loadPanel = readSrc('src/features/grpc/components/GrpcLoadTestPanel.tsx');
    const diffPanel = readSrc('src/features/grpc/components/GrpcSchemaDiffPanel.tsx');
    expect(loadPanel).toContain('advanced.exportLoadTestJson');
    expect(loadPanel).toContain('advanced.exportLoadTestCsv');
    expect(diffPanel).toContain('advanced.exportSchemaDiffJson');
    expect(diffPanel).toContain('advanced.exportSchemaDiffMarkdown');
  });

  it('cross-feature matrix documents Phase 11H advanced export rows', () => {
    const matrix = readSrc('docs/plan/future/grpc/grpc-cross-feature-matrix.md');
    expect(matrix).toContain('grpc_load_test_export');
    expect(matrix).toContain('grpc_schema_diff_export');
    expect(matrix).toContain('prepareGrpcLoadTestRunSummaryExportSafe');
  });

  it('replay actions land on studio sub-nav (implicit advanced integration path)', () => {
    const replay = readSrc('src/features/grpc/hooks/useGrpcStudioReplayActions.ts');
    expect(replay).toContain("onNavigate('studio')");
    expect(replay).not.toContain("onNavigate('advanced')");
  });

  it('grpcStudioAdvancedTypes stores lastExportSource on tab load-test state', () => {
    const types = readSrc('src/features/grpc/grpcStudioAdvancedTypes.ts');
    expect(types).toContain('lastExportSource');
    expect(types).toContain('GrpcAdvancedFeatureSourceMetadata');
  });

  it('prepareGrpcLoadTestRunSummaryExportSafe hardens sourceMetadata at export boundary', () => {
    const src = readSrc('src/shared/grpc/grpcAdvancedFeatureExport.ts');
    expect(src).toContain('hardenedSourceMetadata');
    expect(src).toContain('sanitizeTargetTemplateForExport(sourceMetadata.targetTemplate)');
  });

  it('grpcAdvancedFeatureExport sanitizes target templates with diagnostic secret detector', () => {
    const src = readSrc('src/shared/grpc/grpcAdvancedFeatureExport.ts');
    expect(src).toContain('sanitizeTargetTemplateForExport');
    expect(src).toContain('detectGrpcSecretMaterialInDiagnosticText');
  });

  it('gate script and package.json entry exist', () => {
    const pkg = readSrc('package.json');
    expect(pkg).toContain('"test:grpc:phase11h"');
    const gate = readSrc('scripts/test-grpc-phase11h.sh');
    expect(gate).toContain('grpcPhase11hAcceptance.test.ts');
    expect(gate).toContain('test:grpc:phase11g');
  });

  it('load test async handler guards generation before clearing polls or export refs', () => {
    const src = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    const finalizeIndex = src.indexOf('await finalizeGrpcLoadTestRun(run)');
    const successGuardIndex = src.indexOf(
      'if (!shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration))',
      finalizeIndex,
    );
    const successClearPollIndex = src.indexOf('clearLoadTestPoll(tabId)', successGuardIndex);
    expect(successGuardIndex).toBeGreaterThan(finalizeIndex);
    expect(successClearPollIndex).toBeGreaterThan(successGuardIndex);

    const catchIndex = src.indexOf('} catch (error) {', finalizeIndex);
    const errorGuardIndex = src.indexOf(
      'if (!shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration))',
      catchIndex,
    );
    const errorDeleteExportIndex = src.indexOf(
      'loadTestExportSourceRef.current.delete(tabId)',
      errorGuardIndex,
    );
    expect(errorGuardIndex).toBeGreaterThan(catchIndex);
    expect(errorDeleteExportIndex).toBeGreaterThan(errorGuardIndex);
  });
});

describe('Phase 11H acceptance — secret leak corpus', () => {
  it('load-test safe export redacts bearer tokens from attempt errors', async () => {
    const {
      buildGrpcAdvancedFeatureSourceMetadata,
      serializeGrpcLoadTestRunSummaryExportSafeJson,
    } = await import('./grpcAdvancedFeatureExport');
    const { buildGrpcLoadTestRunSummaryExport } = await import('./grpcLoadTestMetrics');
    const { captureGrpcLoadTestExecuteSnapshot } = await import('./grpcAdvancedFeatureContracts');
    const SECRET = 'phase11h-acceptance-bearer-leak';

    const executeSnapshot = {
      tabId: 'tab-acc',
      requestId: 'req-acc',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 5000,
      descriptorKey: 'reflection:localhost:50051',
    };
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-acc',
      executeSnapshot,
      config: { concurrency: 1, totalCalls: 1 },
    });
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot,
      report: {
        runId: 'run-acc',
        startedAt: '2026-07-01T00:00:01.000Z',
        completedAt: '2026-07-01T00:00:02.000Z',
        durationMs: 1000,
        stopReason: 'completed_total_calls',
        counts: {
          scheduled: 1,
          completed: 1,
          succeeded: 0,
          failed: 1,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 1,
        },
        attempts: [{
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:01.000Z',
          finishedAt: '2026-07-01T00:00:02.000Z',
          durationMs: 1000,
          ok: false,
          errorMessage: `Bearer ${SECRET}`,
        }],
      },
    });
    const json = serializeGrpcLoadTestRunSummaryExportSafeJson(
      summary,
      buildGrpcAdvancedFeatureSourceMetadata(executeSnapshot),
    );
    expect(json).not.toContain(SECRET);
    expect(json).toContain('sourceMetadata');
  });

  it('schema diff safe markdown export includes metadata footer', async () => {
    const { serializeGrpcSchemaDiffReportExportSafeMarkdown } = await import('./grpcAdvancedFeatureExport');
    const markdown = serializeGrpcSchemaDiffReportExportSafeMarkdown({
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-07-01T00:00:00.000Z',
      summary: { breaking: 0, nonBreaking: 0, informational: 0 },
      changes: [],
    }, { baselineCapturedAt: '2026-06-30T12:00:00.000Z' });
    expect(markdown).toContain('## Export metadata');
  });
});
