/**
 * Phase 11H — Advanced feature export safety (load test + schema diff).
 *
 * Mirrors Phase 8H harness export: sanitize diagnostic text, stamp reproducible
 * source metadata, and leak-scan at the clipboard/export boundary.
 */
import type { GrpcTabExecuteSnapshot } from './contracts';
import type { GrpcLoadTestExecutionAttempt } from './grpcAdvancedFeatureContracts';
import type { GrpcSchemaDiffReport } from './grpcSchemaDiffContracts';
import type { GrpcLoadTestRunSummaryExport } from './grpcLoadTestMetrics';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import {
  GRPC_REDACTED_PLACEHOLDER,
  sanitizeGrpcErrorMessage,
} from './grpcRedaction';
import { assertGrpcCrossFeatureExportSafe } from './grpcPersistRedactionMiddleware';
import { detectGrpcSecretLikeString, detectGrpcSecretMaterialInDiagnosticText } from './grpcSecretLeakScan';
import {
  serializeGrpcLoadTestRunSummaryCsv,
  serializeGrpcLoadTestRunSummaryJson,
} from './grpcLoadTestMetrics';
import {
  serializeGrpcSchemaDiffReportJson,
  serializeGrpcSchemaDiffReportMarkdown,
} from './grpcSchemaDiffExport';

const REDACTED_AUTH_SCHEME_PATTERN = /\b(?:bearer|basic)\s+\[REDACTED\]/i;

export interface GrpcAdvancedFeatureSourceMetadata {
  schemaVersion: 1;
  exportedFrom: 'grpc_studio_advanced';
  tabId: string;
  service: string;
  method: string;
  callType: 'unary';
  descriptorKey: string;
  transportMode?: GrpcStudioTransportMode;
  /** Target address template at capture time — no TLS PEM or resolved secrets. */
  targetTemplate: string;
  connectionId?: string;
  capturedAt?: string;
}

export interface GrpcLoadTestRunSummaryExportSafe extends GrpcLoadTestRunSummaryExport {
  sourceMetadata: GrpcAdvancedFeatureSourceMetadata;
}

export interface GrpcSchemaDiffReportExportMeta {
  schemaVersion: 1;
  exportedFrom: 'grpc_studio_advanced';
  exportedAt: string;
  baselineCapturedAt?: string;
}

export interface GrpcSchemaDiffReportExportSafe extends GrpcSchemaDiffReport {
  exportMeta: GrpcSchemaDiffReportExportMeta;
}

function sanitizeTargetTemplateForExport(address: string): string {
  const sanitized = sanitizeGrpcErrorMessage(address);
  if (detectGrpcSecretLikeString(address)) {
    return GRPC_REDACTED_PLACEHOLDER;
  }
  if (detectGrpcSecretMaterialInDiagnosticText(address)) {
    return detectGrpcSecretMaterialInDiagnosticText(sanitized)
      ? GRPC_REDACTED_PLACEHOLDER
      : sanitized;
  }
  return sanitized;
}

export function buildGrpcAdvancedFeatureSourceMetadata(
  executeSnapshot: GrpcTabExecuteSnapshot,
  options?: { connectionId?: string },
): GrpcAdvancedFeatureSourceMetadata {
  return {
    schemaVersion: 1,
    exportedFrom: 'grpc_studio_advanced',
    tabId: executeSnapshot.tabId,
    service: executeSnapshot.service,
    method: executeSnapshot.method,
    callType: 'unary',
    descriptorKey: executeSnapshot.descriptorKey,
    transportMode: executeSnapshot.transportMode,
    targetTemplate: sanitizeTargetTemplateForExport(executeSnapshot.target.address),
    connectionId: options?.connectionId,
    capturedAt: executeSnapshot.capturedAt,
  };
}

export function sanitizeGrpcSchemaDiffChangeTextForExport(text: string): string {
  const sanitized = sanitizeGrpcErrorMessage(text);
  if (!detectGrpcSecretMaterialInDiagnosticText(text)) {
    return sanitized;
  }
  if (detectGrpcSecretMaterialInDiagnosticText(sanitized)) {
    return GRPC_REDACTED_PLACEHOLDER;
  }
  return sanitized;
}

export function sanitizeGrpcLoadTestAttemptForExport(
  attempt: GrpcLoadTestExecutionAttempt,
): GrpcLoadTestExecutionAttempt {
  if (attempt.errorMessage == null) {
    return { ...attempt };
  }
  const original = attempt.errorMessage;
  const sanitized = sanitizeGrpcErrorMessage(original);
  if (detectGrpcSecretLikeString(original)) {
    return { ...attempt, errorMessage: GRPC_REDACTED_PLACEHOLDER };
  }
  if (detectGrpcSecretMaterialInDiagnosticText(original)) {
    if (REDACTED_AUTH_SCHEME_PATTERN.test(sanitized)) {
      return { ...attempt, errorMessage: GRPC_REDACTED_PLACEHOLDER };
    }
    return {
      ...attempt,
      errorMessage: detectGrpcSecretMaterialInDiagnosticText(sanitized)
        ? GRPC_REDACTED_PLACEHOLDER
        : sanitized,
    };
  }
  return { ...attempt, errorMessage: sanitized };
}

export function prepareGrpcLoadTestRunSummaryExportSafe(
  summary: GrpcLoadTestRunSummaryExport,
  sourceMetadata: GrpcAdvancedFeatureSourceMetadata,
): GrpcLoadTestRunSummaryExportSafe {
  const hardenedSourceMetadata: GrpcAdvancedFeatureSourceMetadata = {
    ...sourceMetadata,
    targetTemplate: sanitizeTargetTemplateForExport(sourceMetadata.targetTemplate),
  };
  const safe: GrpcLoadTestRunSummaryExportSafe = {
    ...summary,
    attempts: summary.attempts.map(sanitizeGrpcLoadTestAttemptForExport),
    sourceMetadata: hardenedSourceMetadata,
  };
  assertGrpcCrossFeatureExportSafe({ grpc_load_test_export: safe }, 'grpc_load_test_export');
  return safe;
}

export function prepareGrpcSchemaDiffReportExportSafe(
  report: GrpcSchemaDiffReport,
  options?: { baselineCapturedAt?: string; exportedAt?: string },
): GrpcSchemaDiffReportExportSafe {
  const safe: GrpcSchemaDiffReportExportSafe = {
    ...structuredClone(report),
    changes: report.changes.map((change) => ({
      ...change,
      description: sanitizeGrpcSchemaDiffChangeTextForExport(change.description),
      ...(change.caveat != null
        ? { caveat: sanitizeGrpcSchemaDiffChangeTextForExport(change.caveat) }
        : {}),
    })),
    exportMeta: {
      schemaVersion: 1,
      exportedFrom: 'grpc_studio_advanced',
      exportedAt: options?.exportedAt ?? new Date().toISOString(),
      baselineCapturedAt: options?.baselineCapturedAt,
    },
  };
  assertGrpcCrossFeatureExportSafe({ grpc_schema_diff_export: safe }, 'grpc_schema_diff_export');
  return safe;
}

export function serializeGrpcLoadTestRunSummaryExportSafeJson(
  summary: GrpcLoadTestRunSummaryExport,
  sourceMetadata: GrpcAdvancedFeatureSourceMetadata,
): string {
  return serializeGrpcLoadTestRunSummaryJson(
    prepareGrpcLoadTestRunSummaryExportSafe(summary, sourceMetadata),
  );
}

export function serializeGrpcLoadTestRunSummaryExportSafeCsv(
  summary: GrpcLoadTestRunSummaryExport,
  sourceMetadata: GrpcAdvancedFeatureSourceMetadata,
): string {
  return serializeGrpcLoadTestRunSummaryCsv(
    prepareGrpcLoadTestRunSummaryExportSafe(summary, sourceMetadata),
  );
}

export function serializeGrpcSchemaDiffReportExportSafeJson(
  report: GrpcSchemaDiffReport,
  options?: { baselineCapturedAt?: string; exportedAt?: string },
): string {
  return serializeGrpcSchemaDiffReportJson(
    prepareGrpcSchemaDiffReportExportSafe(report, options),
  );
}

export function serializeGrpcSchemaDiffReportExportSafeMarkdown(
  report: GrpcSchemaDiffReport,
  options?: { baselineCapturedAt?: string; exportedAt?: string },
): string {
  const safe = prepareGrpcSchemaDiffReportExportSafe(report, options);
  const body = serializeGrpcSchemaDiffReportMarkdown(safe);
  const footerLines = [
    '---',
    '',
    '## Export metadata',
    '',
    `- **Exported from:** \`${safe.exportMeta.exportedFrom}\``,
    `- **Exported at:** ${safe.exportMeta.exportedAt}`,
  ];
  if (safe.exportMeta.baselineCapturedAt != null) {
    footerLines.push(`- **Baseline captured at:** ${safe.exportMeta.baselineCapturedAt}`);
  }
  footerLines.push('');
  return `${body.trimEnd()}\n\n${footerLines.join('\n')}`;
}
