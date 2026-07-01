/**
 * gRPC target address validation (Phase 1A + Phase 9D hardening).
 * Shared by UI and src-server routes — accepts `host:port` and `in-process:<name>`.
 */
import type { GrpcInterpolationErrorCode } from './grpcInterpolationConstants';
import {
  buildGrpcTargetValidationFailure,
  buildUnresolvedGrpcTargetFailure,
  formatGrpcTargetValidationError,
  grpcTargetHasIllegalScheme,
  type GrpcTargetValidationFailureKind,
} from './grpcTargetValidationCatalog';

const HOST_PORT_RE =
  /^(?:\[([0-9a-fA-F:.]+)\]|([a-zA-Z0-9._-]+)|localhost):(\d{1,5})$/;

const IN_PROCESS_RE = /^in-process:([a-zA-Z0-9_.-]+)$/;

export type GrpcTargetValidationResult =
  | { valid: true; kind: 'host_port' | 'in_process'; normalized: string }
  | {
    valid: false;
    reason: string;
    code?: GrpcInterpolationErrorCode;
    hint?: string;
    kind?: GrpcTargetValidationFailureKind;
  };

function failureFromCatalog(
  catalogKind: GrpcTargetValidationFailureKind,
  details?: { tokenName?: string },
): Extract<GrpcTargetValidationResult, { valid: false }> {
  const message = buildGrpcTargetValidationFailure(catalogKind, details);
  return {
    valid: false,
    reason: message.reason,
    code: message.code,
    hint: message.hint,
    kind: message.kind,
  };
}

export function validateGrpcTargetAddress(raw: string): GrpcTargetValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return failureFromCatalog('empty');
  }

  if (grpcTargetHasIllegalScheme(trimmed)) {
    return failureFromCatalog('illegal_scheme');
  }

  const inProcessMatch = IN_PROCESS_RE.exec(trimmed);
  if (inProcessMatch) {
    return {
      valid: true,
      kind: 'in_process',
      normalized: `in-process:${inProcessMatch[1]}`,
    };
  }

  const hostPortMatch = HOST_PORT_RE.exec(trimmed);
  if (!hostPortMatch) {
    return failureFromCatalog('invalid_format');
  }

  const port = Number(hostPortMatch[3]);
  if (port < 1 || port > 65535) {
    return failureFromCatalog('invalid_port');
  }

  const host = hostPortMatch[1] ?? hostPortMatch[2];
  const normalizedHost = hostPortMatch[1] ? `[${host}]` : host;
  return {
    valid: true,
    kind: 'host_port',
    normalized: `${normalizedHost}:${port}`,
  };
}

export function isValidGrpcTargetAddress(raw: string): boolean {
  return validateGrpcTargetAddress(raw).valid;
}

/** Reject unresolved env tokens like {{grpcHost}} before connect/reflect/call. */
export function validateResolvedGrpcTargetAddress(raw: string): GrpcTargetValidationResult {
  if (/\{\{[^}]+\}\}/.test(raw)) {
    const unresolved = buildUnresolvedGrpcTargetFailure(raw);
    return {
      valid: false,
      reason: unresolved.reason,
      code: unresolved.code,
      hint: unresolved.hint,
      kind: unresolved.kind,
    };
  }
  return validateGrpcTargetAddress(raw);
}

/** Format failure reason + optional remediation hint for throw sites and UI. */
export function grpcTargetValidationMessage(result: GrpcTargetValidationResult): string {
  if (result.valid) {
    return '';
  }
  return formatGrpcTargetValidationError({ reason: result.reason, hint: result.hint });
}

/** Attach hint to reason string while preserving structured fields for tests. */
export function withGrpcTargetValidationMessage(
  result: GrpcTargetValidationResult,
): GrpcTargetValidationResult {
  if (result.valid || !result.hint) {
    return result;
  }
  return {
    ...result,
    reason: formatGrpcTargetValidationError({ reason: result.reason, hint: result.hint }),
  };
}
