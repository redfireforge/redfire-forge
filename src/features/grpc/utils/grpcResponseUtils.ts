/**
 * gRPC Studio — response panel formatting helpers (Phase 1G).
 */
import type { GrpcAuthConfig, GrpcCallResult, GrpcErrorBody } from '../../../shared/grpc/contracts';
import type { GrpcTlsFailureCategory } from '../../../shared/grpc/contracts';
import { formatGrpcTransportFailureMessage } from '../../../shared/grpc/grpcTransportErrors';
import { formatBrowserTransportFailureHint } from '../../../shared/grpc/grpcBrowserTransportErrorMapper';
import { redactGrpcCallResultForExport } from '../../../shared/grpc/grpcRedaction';

export function formatGrpcRpcStatusLabel(status: number, statusMessage: string): string {
  const label = statusMessage?.trim() || 'UNKNOWN';
  return `${label} · ${status}`;
}

export function grpcStatusBadgeModifier(status: number): 'ok' | 'error' {
  return status === 0 ? 'ok' : 'error';
}

export function formatGrpcDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '—';
  return `${Math.round(durationMs)}ms`;
}

export function countGrpcHeaderEntries(headers: Record<string, string> | undefined): number {
  if (!headers) return 0;
  return Object.keys(headers).length;
}

export function sortedGrpcHeaderEntries(
  headers: Record<string, string> | undefined,
): Array<{ key: string; value: string }> {
  if (!headers) return [];
  return Object.entries(headers)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function serializeGrpcResponseBody(body: Record<string, unknown> | undefined): string {
  if (!body || Object.keys(body).length === 0) {
    return '{}';
  }
  return JSON.stringify(body, null, 2);
}

export function buildGrpcResponseCopyText(
  result: GrpcCallResult,
  auth?: GrpcAuthConfig,
): string {
  const redacted = redactGrpcCallResultForExport(result, auth);
  return serializeGrpcResponseBody(redacted.body);
}

export function formatGrpcErrorSummary(error: GrpcErrorBody): string {
  const code = error.code?.trim() || 'GRPC_ERROR';
  return `${code}: ${error.message}`;
}

export function extractTlsFailureFromError(error: GrpcErrorBody | undefined): GrpcTlsFailureCategory | undefined {
  if (!error?.details || typeof error.details !== 'object') return undefined;
  const tlsFailure = (error.details as { tlsFailure?: GrpcTlsFailureCategory }).tlsFailure;
  return tlsFailure;
}

export function formatGrpcTlsFailureHint(error: GrpcErrorBody | undefined): string | undefined {
  const tlsFailure = extractTlsFailureFromError(error);
  if (!tlsFailure) return undefined;
  return formatGrpcTransportFailureMessage({ tlsFailure });
}

export function formatGrpcBrowserTransportFailureHint(error: GrpcErrorBody | undefined): string | undefined {
  return formatBrowserTransportFailureHint(error);
}
