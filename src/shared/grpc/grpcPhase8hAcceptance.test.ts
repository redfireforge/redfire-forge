/**
 * Phase 8H — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS } from './grpcSecretPolicy';

describe('Phase 8H acceptance checklist', () => {
  it('exports harness export redaction modules', async () => {
    const mod = await import('./grpcHarnessExport');
    expect(typeof mod.redactGrpcHarnessResultForExport).toBe('function');
    expect(typeof mod.redactGrpcHarnessRequestResultForExport).toBe('function');
    expect(typeof mod.prepareGrpcHarnessResultReportExport).toBe('function');
    expect(typeof mod.redactGrpcHarnessRunnerArtifactsForExport).toBe('function');
    expect(typeof mod.formatGrpcHarnessResultSummaryForExport).toBe('function');
    expect(typeof mod.sanitizeGrpcHarnessDiagnosticText).toBe('function');
  });

  it('exports secret-like string detector from leak scan', async () => {
    const scan = await import('./grpcSecretLeakScan');
    expect(typeof scan.detectGrpcSecretLikeString).toBe('function');
  });

  it('exports nested value redaction helper from grpcRedaction', async () => {
    const mod = await import('./grpcRedaction');
    expect(typeof mod.redactGrpcNestedValueForExport).toBe('function');
  });

  it('includes harness result export targets in forbidden persist list', () => {
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('harness_result_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('runner_artifacts');
  });

  it('reportGenerator wires runner artifact redaction', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../features/results/utils/reportGenerator.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('redactGrpcHarnessRunnerArtifactsForExport');
    expect(source).toContain('exportSafeResults');
  });

  it('results exportJson/exportCsv wire runner artifact redaction', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../utils/export.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('redactGrpcHarnessRunnerArtifactsForExport');
    expect(source).toContain('exportSafeResults');
  });

  it('redacted harness report passes leak scan across all call types', async () => {
    const { prepareGrpcHarnessResultReportExport } = await import('./grpcHarnessExport');
    const { buildGrpcHarnessResult } = await import('./grpcHarnessResultBuilder');
    const { scanForbiddenGrpcPersistTargets } = await import('./grpcSecretLeakScan');
    const SECRET = 'phase8h-acceptance-secret-token';
    const callTypes = ['unary', 'server_streaming', 'client_streaming', 'bidi_streaming'] as const;

    for (const callType of callTypes) {
      const harnessResult = buildGrpcHarnessResult({
        scenarioId: 'sc-acc',
        callType,
        durationMs: 5,
        transportOutcome: {
          callType,
          passed: true,
          grpcStatus: 0,
          durationMs: 5,
          attempts: 1,
          trailers: { authorization: `Bearer ${SECRET}` },
          body: callType === 'unary' || callType === 'client_streaming'
            ? { bearerToken: SECRET }
            : undefined,
          messages: callType === 'server_streaming' || callType === 'bidi_streaming'
            ? [{ apiKey: SECRET }]
            : undefined,
        },
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: true,
        harnessAssertionsConfigured: false,
      });
      const rawResult: import('../types').RequestResult = {
        id: `r-${callType}`,
        scenarioId: 'sc-acc',
        scenarioName: 'Acc',
        url: 'grpc://localhost:50051/svc/m',
        method: callType,
        httpStatus: 200,
        responseTimeMs: 5,
        responseBody: JSON.stringify(harnessResult.body ?? harnessResult.messages ?? {}),
        responseHeaders: { authorization: `Bearer ${SECRET}` },
        timestamp: Date.now(),
        passed: true,
        validationMode: 'none',
        failureDetails: [],
        transportType: 'grpcCall',
        grpcResultMeta: {
          service: 'svc',
          method: 'm',
          target: 'localhost:50051',
          harnessResult,
        },
      };

      const report = prepareGrpcHarnessResultReportExport({
        scenarioName: 'Acc',
        result: rawResult,
        auth: { type: 'bearer', bearerToken: SECRET },
      });
      expect(JSON.stringify(report)).not.toContain(SECRET);
      expect(scanForbiddenGrpcPersistTargets({ harness_result_export: report })).toHaveLength(0);
    }
  });

  it('grpcCrossFeatureExport re-exports prepareGrpcHarnessResultReportExport', async () => {
    const mod = await import('../../features/grpc/utils/grpcCrossFeatureExport');
    expect(typeof mod.prepareGrpcHarnessResultReportExport).toBe('function');
  });
});
