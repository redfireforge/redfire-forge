/**
 * Phase 9E — safe interpolation diagnostics (no secret value disclosure).
 */
import {
  GRPC_INTERPOLATION_ERROR_CODES,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import { isGrpcSecretMetadataKey } from './grpcSecretPolicy';

/** Env keys whose resolved values must never appear in interpolation diagnostics. */
export function isGrpcSecretInterpolationEnvKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (isGrpcSecretMetadataKey(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return lower.includes('bearer')
    || lower.includes('credential')
    || lower.includes('passwd');
}

export function formatGrpcInterpolationCyclePath(path: readonly string[]): string {
  if (path.length <= 1) {
    return path[0] ?? '';
  }
  return path.join(' → ');
}

export function formatGrpcInterpolationCycleMessage(path: readonly string[]): string {
  const formatted = formatGrpcInterpolationCyclePath(path);
  if (!formatted) {
    return 'Circular variable reference detected in environment variables';
  }
  return `Circular variable reference: ${formatted}`;
}

export function buildGrpcInterpolationCycleIssue(
  path: readonly string[],
): GrpcInterpolationValidationIssue {
  return {
    field: 'interpolationEnv',
    code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
    message: formatGrpcInterpolationCycleMessage(path),
  };
}

export interface SanitizeGrpcInterpolationDiagnosticOptions {
  env?: Readonly<Record<string, string>>;
  /** When true, redact all env values (not only secret-backed keys). */
  redactAllEnvValues?: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace whole env value occurrences without corrupting token names
 * (e.g. secret value `host` must not redact inside `grpcHost`).
 */
function redactEnvValueInDiagnosticMessage(message: string, value: string): string {
  if (!value || !message.includes(value)) {
    return message;
  }
  const escaped = escapeRegExp(value);
  const pattern = new RegExp(`(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`, 'g');
  return message.replace(pattern, GRPC_REDACTED_PLACEHOLDER);
}

/**
 * Strip secret env values from interpolation error text.
 * Cycle messages are token-name-only; this guards missing-token and resolver errors.
 */
export function sanitizeGrpcInterpolationDiagnosticMessage(
  message: string,
  options?: SanitizeGrpcInterpolationDiagnosticOptions,
): string {
  const env = options?.env;
  if (!env || !message) {
    return message;
  }
  let sanitized = message;
  const entries = Object.entries(env)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [key, value] of entries) {
    const shouldRedact = options?.redactAllEnvValues
      || isGrpcSecretInterpolationEnvKey(key);
    if (!shouldRedact) continue;
    sanitized = redactEnvValueInDiagnosticMessage(sanitized, value);
  }
  return sanitized;
}

export interface GrpcInterpolationDiagnosticPayload {
  code: string;
  message: string;
  tokenPath?: readonly string[];
}

/** Build a redacted diagnostic payload safe for logs, toasts, and harness errors. */
export function buildSafeGrpcInterpolationDiagnosticPayload(
  issue: GrpcInterpolationValidationIssue,
  options?: {
    env?: Readonly<Record<string, string>>;
    cyclePath?: readonly string[];
  },
): GrpcInterpolationDiagnosticPayload {
  const cyclePath = options?.cyclePath
    ?? (issue.code === GRPC_INTERPOLATION_ERROR_CODES.CYCLE
      ? issue.message.replace(/^Circular variable reference: /, '').split(' → ')
      : undefined);
  return {
    code: issue.code,
    message: sanitizeGrpcInterpolationDiagnosticMessage(issue.message, {
      env: options?.env,
    }),
    ...(cyclePath && cyclePath.length > 0 ? { tokenPath: cyclePath } : {}),
  };
}
