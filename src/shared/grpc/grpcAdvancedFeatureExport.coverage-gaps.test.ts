import { describe, expect, it } from 'vitest';
import {
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
});
