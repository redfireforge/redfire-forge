import { describe, expect, it } from 'vitest';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  prepareGrpcLoadTestRunSummaryExportSafe,
  prepareGrpcSchemaDiffReportExportSafe,
  sanitizeGrpcLoadTestAttemptForExport,
  sanitizeGrpcSchemaDiffChangeTextForExport,
} from './grpcAdvancedFeatureExport';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';

const SECRET = 'phase11h-gap-leak-token-xyz789';

describe('grpcAdvancedFeatureExport coverage gaps', () => {
  it('sanitizeGrpcSchemaDiffChangeTextForExport returns sanitized text when no secret material', () => {
    expect(sanitizeGrpcSchemaDiffChangeTextForExport('field type widened')).toBe('field type widened');
  });

  it('sanitizeGrpcSchemaDiffChangeTextForExport redacts when secret material survives sanitization', () => {
    const result = sanitizeGrpcSchemaDiffChangeTextForExport(SECRET);
    expect(result).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(result).not.toContain(SECRET);
  });

  it('sanitizeGrpcLoadTestAttemptForExport redacts bearer-shaped diagnostic text via auth scheme pattern', () => {
    const sanitized = sanitizeGrpcLoadTestAttemptForExport({
      attemptNumber: 3,
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

  it('prepareGrpcSchemaDiffReportExportSafe redacts secret caveat text', () => {
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
        caveat: `Bearer ${SECRET}`,
      }],
    });
    expect(safe.changes[0]?.caveat).not.toContain(SECRET);
    expect(safe.changes[0]?.caveat).toContain(GRPC_REDACTED_PLACEHOLDER);
  });

  it('sanitizeGrpcSchemaDiffChangeTextForExport returns sanitized text when sanitizer removes secret material', () => {
    const result = sanitizeGrpcSchemaDiffChangeTextForExport(`prefix Bearer ${SECRET} suffix`);
    expect(result).not.toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(result).not.toContain(SECRET);
  });

  it('sanitizeGrpcLoadTestAttemptForExport returns attempt unchanged when errorMessage is null', () => {
    const attempt = {
      attemptNumber: 1,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: true,
      errorMessage: null,
    };
    expect(sanitizeGrpcLoadTestAttemptForExport(attempt)).toEqual(attempt);
  });

  it('buildGrpcAdvancedFeatureSourceMetadata preserves normal target templates', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata({
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    });
    expect(metadata.targetTemplate).toBe('localhost:50051');
  });

  it('sanitizeGrpcLoadTestAttemptForExport keeps sanitized diagnostic when auth scheme pattern is absent', () => {
    const sanitized = sanitizeGrpcLoadTestAttemptForExport({
      attemptNumber: 2,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: false,
      errorMessage: `token=${SECRET}`,
    });
    expect(sanitized.errorMessage).not.toContain(SECRET);
  });

  it('buildGrpcAdvancedFeatureSourceMetadata redacts secret-like target templates', () => {
    const metadata = buildGrpcAdvancedFeatureSourceMetadata({
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: { address: `Bearer ${SECRET}`, tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    });
    expect(metadata.targetTemplate).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('prepareGrpcLoadTestRunSummaryExportSafe sanitizes attempts in export payload', () => {
    const safe = prepareGrpcLoadTestRunSummaryExportSafe(
      {
        runId: 'run-1',
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: '2026-07-01T00:00:01.000Z',
        durationMs: 1000,
        totalCalls: 1,
        successfulCalls: 0,
        failedCalls: 1,
        attempts: [{
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:01.000Z',
          durationMs: 1000,
          ok: false,
          errorMessage: `Bearer ${SECRET}`,
        }],
        metrics: {
          latencyMs: { min: 1, max: 1, mean: 1, p50: 1, p95: 1, p99: 1 },
          throughputRps: 1,
        },
      },
      {
        schemaVersion: 1,
        exportedFrom: 'grpc_studio_advanced',
        tabId: 'tab-1',
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        descriptorKey: 'desc-1',
        targetTemplate: 'localhost:50051',
      },
    );
    expect(safe.attempts[0]?.errorMessage).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('sanitizeGrpcLoadTestAttemptForExport keeps sanitized diagnostic text when scan passes', () => {
    const sanitized = sanitizeGrpcLoadTestAttemptForExport({
      attemptNumber: 1,
      warmup: false,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      ok: false,
      errorMessage: 'rpc error: code = Unavailable desc = connection reset',
    });
    expect(sanitized.errorMessage).toContain('connection reset');
  });
});
