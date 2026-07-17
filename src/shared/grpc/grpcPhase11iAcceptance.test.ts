/**
 * Phase 11I — Hardening gate acceptance checklist.
 *
 * Consolidates Phase 11A–11H traceability into a deterministic sign-off gate.
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

describe('Phase 11I acceptance checklist', () => {
  it('checklist-1: exports core advanced feature modules from Phase 11A–11H', async () => {
    const contracts11a = await import('./grpcAdvancedFeatureContracts');
    const scheduler11b = await import('./grpcLoadTestSchedulerCore');
    const metrics11c = await import('./grpcLoadTestMetrics');
    const rules11d = await import('./grpcMockRuleEvaluatorCore');
    const runtime11e = await import('./grpcMockRuntimeRegistry');
    const diff11f = await import('./grpcSchemaDiffEngine');
    const diffExport11f = await import('./grpcSchemaDiffExport');
    const ui11g = await import('../../features/grpc/grpcStudioAdvancedTypes');
    const export11h = await import('./grpcAdvancedFeatureExport');

    expect(typeof contracts11a.validateGrpcLoadTestConfig).toBe('function');
    expect(typeof scheduler11b.startGrpcLoadTestSchedulerRun).toBe('function');
    expect(typeof metrics11c.buildGrpcLoadTestRunSummaryExport).toBe('function');
    expect(typeof rules11d.evaluateGrpcMockRuleSet).toBe('function');
    expect(typeof runtime11e.createGrpcMockRuntimeRegistry).toBe('function');
    expect(typeof diff11f.computeGrpcSchemaDiff).toBe('function');
    expect(typeof diffExport11f.serializeGrpcSchemaDiffReportMarkdown).toBe('function');
    expect(typeof ui11g.createInitialGrpcTabAdvancedFeaturesUiState).toBe('function');
    expect(typeof export11h.prepareGrpcLoadTestRunSummaryExportSafe).toBe('function');
  });

  it('checklist-2: phase acceptance and regression test files exist for 11A–11H', async () => {
    const fs = await import('fs/promises');
    const requiredFiles = [
      'src/shared/grpc/grpcPhase11aAcceptance.test.ts',
      'src/shared/grpc/grpcPhase11bAcceptance.test.ts',
      'src/shared/grpc/grpcLoadTestMetrics.test.ts',
      'src/shared/grpc/grpcPhase11dAcceptance.test.ts',
      'src/shared/grpc/grpcPhase11eAcceptance.test.ts',
      'src/shared/grpc/grpcPhase11fAcceptance.test.ts',
      'src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx',
      'src/shared/grpc/grpcAdvancedFeatureExport.test.ts',
      'src/shared/grpc/grpcAdvancedFeatureExport.coverage-gaps.test.ts',
      'src/shared/grpc/grpcPhase11hAcceptance.test.ts',
    ] as const;

    for (const relPath of requiredFiles) {
      await expect(fs.access(path.join(ROOT, relPath))).resolves.toBeUndefined();
    }
  });

  it('checklist-3: gate scripts are registered for 11A–11I and chained regression from 11I to 11H', () => {
    const pkg = readSrc('package.json');
    for (const phase of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const) {
      expect(pkg).toContain(`"test:grpc:phase11${phase}"`);
    }
    expect(pkg).toContain('"test:grpc:phase11i:fast"');
    expect(pkg).toContain('"test:grpc:phase11i:full"');

    const gate = readSrc('scripts/test-grpc-phase11i.sh');
    const gate11h = readSrc('scripts/test-grpc-phase11h.sh');
    expect(gate).toContain('test:grpc:phase11h');
    expect(gate).toContain('grpcPhase11iAcceptance.test.ts');
    expect(gate).toContain('grpc_gate_run_regression');
    expect(gate11h).toContain('grpc_gate_run_regression');
  });

  it('checklist-4: runbook and validation report are published with Phase 11 sign-off sections', () => {
    const runbook = readSrc('docs/guides/grpc-phase11-runbook.md');
    const report = readSrc('docs/guides/grpc-phase11-validation-report.md');

    expect(runbook).toContain('test:grpc:phase11i');
    expect(runbook).toContain('Troubleshooting: Load test panel');
    expect(runbook).toContain('Troubleshooting: Mock server runtime');
    expect(runbook).toContain('Troubleshooting: Schema diff panel');
    expect(runbook).toContain('Troubleshooting: Advanced export safety');

    expect(report).toContain('Phase | 11I (Hardening Gate)');
    expect(report).toContain('Sign-off status | ✅ PASS');
    expect(report).toContain('Known limitations');
  });

  it('checklist-5: export safety targets remain forbidden persist sinks and wiring remains safe', () => {
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_load_test_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_schema_diff_export');

    const advanced = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    const exportCallbacks = readSrc('src/features/grpc/hooks/useGrpcAdvancedExportCallbacks.ts');
    expect(advanced).toContain('useGrpcAdvancedExportCallbacks');
    expect(exportCallbacks).toContain('serializeGrpcLoadTestRunSummaryExportSafeJson');
    expect(exportCallbacks).toContain('serializeGrpcLoadTestRunSummaryExportSafeCsv');
    expect(exportCallbacks).toContain('serializeGrpcSchemaDiffReportExportSafeJson');
    expect(exportCallbacks).toContain('serializeGrpcSchemaDiffReportExportSafeMarkdown');

    const exportSafety = readSrc('src/shared/grpc/grpcAdvancedFeatureExport.ts');
    expect(exportSafety).toContain('hardenedSourceMetadata');
    expect(exportSafety).toContain('sanitizeTargetTemplateForExport(sourceMetadata.targetTemplate)');
  });

  it('checklist-6: plan and matrix documents reflect Phase 11 hardening and integration coverage', () => {
    const plan = readSrc('docs/plan/future/grpc/grpc-studio-plan.md');
    const matrix = readSrc('docs/plan/future/grpc/grpc-cross-feature-matrix.md');

    expect(plan).toContain('Phase 11I');
    expect(plan).toContain('test:grpc:phase11i');
    expect(plan).toContain('11A–11I');
    expect(plan).toContain('Phase 12');
    expect(plan).not.toMatch(/Phase 11 \(Advanced\) ◄── 🔴 NEXT/);
    expect(matrix).toContain('Phase 11H — Advanced feature exports');
    expect(matrix).toContain('prepareGrpcLoadTestRunSummaryExportSafe');
  });
});
