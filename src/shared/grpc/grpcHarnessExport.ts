/**
 * Phase 8H — gRPC harness result export redaction and reporting safety.
 */
import type { GrpcAuthConfig, GrpcTabExecuteSnapshot } from './contracts';
import { normalizeGrpcMetadata } from './contracts';
import type { GrpcHarnessResult } from '../types/grpc-harness-result';
import type { GrpcResultMeta } from '../types/kafka';
import type { RequestResult } from '../types';
import type { GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';
import {
  GRPC_REDACTED_PLACEHOLDER,
  redactGrpcExecuteSnapshotForExport,
  redactGrpcMetadataForExport,
  redactGrpcNestedValueForExport,
  sanitizeGrpcErrorMessage,
} from './grpcRedaction';
import { assertGrpcCrossFeatureExportSafe } from './grpcPersistRedactionMiddleware';
import { detectGrpcSecretLikeString } from './grpcSecretLeakScan';
import { formatGrpcHarnessResultSummary } from './grpcHarnessResultBuilder';

/** Sanitize harness diagnostic text (errorDetail, assertion messages, failureDetails). */
export function sanitizeGrpcHarnessDiagnosticText(text: string): string {
  return sanitizeGrpcErrorMessage(text);
}

function redactHarnessRecordForExport(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!record) return undefined;
  return redactGrpcNestedValueForExport(record) as Record<string, unknown>;
}

function redactHarnessMetadataForExport(
  metadata: Record<string, string> | undefined,
  auth?: GrpcAuthConfig,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const normalizedOriginal = normalizeGrpcMetadata(metadata);
  const redacted = redactGrpcMetadataForExport(metadata, auth);
  const hardened: Record<string, string> = {};
  for (const [key, value] of Object.entries(redacted)) {
    const original = normalizedOriginal[key];
    hardened[key] = detectGrpcSecretLikeString(original ?? value)
      ? GRPC_REDACTED_PLACEHOLDER
      : value;
  }
  return hardened;
}

function redactHarnessFailureDetailsForExport(
  details: RequestResult['failureDetails'],
): RequestResult['failureDetails'] {
  return details.map((detail) => ({
    ...detail,
    expected: typeof detail.expected === 'string'
      ? sanitizeGrpcHarnessDiagnosticText(detail.expected)
      : detail.expected,
    actual: typeof detail.actual === 'string'
      ? sanitizeGrpcHarnessDiagnosticText(detail.actual)
      : detail.actual,
  }));
}

function redactHarnessResponseBodyForExport(body: string): string {
  if (!body) return body;
  try {
    const parsed = JSON.parse(body) as unknown;
    return JSON.stringify(redactGrpcNestedValueForExport(parsed), null, 2);
  } catch {
    return sanitizeGrpcHarnessDiagnosticText(body);
  }
}

/** Redact a published `GrpcHarnessResult` for export/report consumers. */
export function redactGrpcHarnessResultForExport(
  result: GrpcHarnessResult,
  auth?: GrpcAuthConfig,
): GrpcHarnessResult {
  return {
    ...result,
    body: redactHarnessRecordForExport(result.body),
    messages: result.messages?.map((message) => redactHarnessRecordForExport(message) ?? message),
    trailers: result.trailers
      ? redactHarnessMetadataForExport(result.trailers, auth)
      : undefined,
    grpcStatusMessage: result.grpcStatusMessage
      ? sanitizeGrpcHarnessDiagnosticText(result.grpcStatusMessage)
      : undefined,
    errorDetail: result.errorDetail
      ? sanitizeGrpcHarnessDiagnosticText(result.errorDetail)
      : undefined,
    assertionResults: result.assertionResults.map((item) => ({
      ...item,
      message: item.message
        ? sanitizeGrpcHarnessDiagnosticText(item.message)
        : undefined,
    })),
  };
}

/** Redact `grpcResultMeta` including nested `harnessResult`. */
export function redactGrpcResultMetaForExport(
  meta: GrpcResultMeta,
  auth?: GrpcAuthConfig,
): GrpcResultMeta {
  const redacted: GrpcResultMeta = { ...meta };
  if (meta.grpcStatusMessage) {
    redacted.grpcStatusMessage = sanitizeGrpcHarnessDiagnosticText(meta.grpcStatusMessage);
  }
  if (meta.harnessResult) {
    redacted.harnessResult = redactGrpcHarnessResultForExport(meta.harnessResult, auth);
  }
  if (meta.assertionFailures) {
    redacted.assertionFailures = meta.assertionFailures.map(sanitizeGrpcHarnessDiagnosticText);
  }
  return redacted;
}

function isGrpcHarnessTransportResult(result: RequestResult): boolean {
  return (result.transportType ?? 'http') === 'grpcCall' || Boolean(result.grpcResultMeta);
}

/** Redact a harness `RequestResult` row for runner artifacts / reports. */
export function redactGrpcHarnessRequestResultForExport(
  result: RequestResult,
  auth?: GrpcAuthConfig,
): RequestResult {
  if (!isGrpcHarnessTransportResult(result)) {
    return result;
  }

  const redacted: RequestResult = {
    ...result,
    errorMessage: result.errorMessage
      ? sanitizeGrpcHarnessDiagnosticText(result.errorMessage)
      : undefined,
    failureDetails: redactHarnessFailureDetailsForExport(result.failureDetails),
    responseBody: redactHarnessResponseBodyForExport(result.responseBody),
    responseHeaders: result.responseHeaders
      ? redactHarnessMetadataForExport(result.responseHeaders, auth)
      : undefined,
  };

  if (result.requestLog) {
    redacted.requestLog = {
      headers: redactHarnessMetadataForExport(result.requestLog.headers, auth) ?? {},
      body: result.requestLog.body
        ? redactHarnessResponseBodyForExport(result.requestLog.body)
        : undefined,
    };
  }

  if (result.grpcResultMeta) {
    redacted.grpcResultMeta = redactGrpcResultMetaForExport(result.grpcResultMeta, auth);
  }

  return redacted;
}

/** Export-safe one-line harness summary (redacts before formatting). */
export function formatGrpcHarnessResultSummaryForExport(
  result: GrpcHarnessResult,
  auth?: GrpcAuthConfig,
): string {
  return formatGrpcHarnessResultSummary(redactGrpcHarnessResultForExport(result, auth));
}

export interface GrpcHarnessResultReportSnapshot {
  kind: 'grpc_scenario';
  name: string;
  snapshot: GrpcTabExecuteSnapshot;
}

export interface GrpcHarnessResultReportExport {
  schemaVersion: 1;
  kind: 'grpc_harness_result_report';
  scenarioName: string;
  snapshot?: GrpcHarnessResultReportSnapshot;
  result: RequestResult;
  exportedAt: string;
}

/** Build a leak-scanned harness result report bundle (snapshot + redacted result). */
export function prepareGrpcHarnessResultReportExport(input: {
  scenarioName: string;
  snapshot?: GrpcHarnessExecuteSnapshot;
  result: RequestResult;
  auth?: GrpcAuthConfig;
  exportedAt?: string;
}): GrpcHarnessResultReportExport {
  const report: GrpcHarnessResultReportExport = {
    schemaVersion: 1,
    kind: 'grpc_harness_result_report',
    scenarioName: input.scenarioName,
    snapshot: input.snapshot
      ? {
        kind: 'grpc_scenario',
        name: input.snapshot.scenarioName,
        snapshot: redactGrpcExecuteSnapshotForExport(input.snapshot.execute),
      }
      : undefined,
    result: redactGrpcHarnessRequestResultForExport(input.result, input.auth),
    exportedAt: input.exportedAt ?? new Date().toISOString(),
  };
  assertGrpcCrossFeatureExportSafe({ harness_result_export: report }, 'harness_result_export');
  return report;
}

/** Redact gRPC harness rows in a runner result batch; non-gRPC rows pass through. */
export function redactGrpcHarnessRunnerArtifactsForExport(
  results: RequestResult[],
  authByScenarioId?: ReadonlyMap<string, GrpcAuthConfig>,
): RequestResult[] {
  const redacted = results.map((result) => {
    if (!isGrpcHarnessTransportResult(result)) {
      return result;
    }
    return redactGrpcHarnessRequestResultForExport(
      result,
      authByScenarioId?.get(result.scenarioId),
    );
  });
  const grpcRows = redacted.filter(isGrpcHarnessTransportResult);
  if (grpcRows.length > 0) {
    assertGrpcCrossFeatureExportSafe({ runner_artifacts: grpcRows }, 'runner_artifacts');
  }
  return redacted;
}
