/**
 * Phase 9D — validate canonical gRPC env tokens (grpcHost, grpcPort).
 */
import {
  GRPC_CANONICAL_ENV_TOKENS,
  GRPC_INTERPOLATION_ERROR_CODES,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';
import { extractGrpcInterpolationTokenNamesSafe } from './grpcInterpolationGrammar';
import {
  buildGrpcTargetValidationFailure,
  formatGrpcTargetValidationError,
  grpcTargetHasIllegalScheme,
} from './grpcTargetValidationCatalog';
import { validateGrpcTargetAddress } from './targetValidation';
import type {
  GrpcConnectionProfile,
  GrpcTabConnectionPageDefaults,
} from '../../features/grpc/utils/resolveGrpcTabConnection';
import { resolveGrpcTabConnection } from '../../features/grpc/utils/resolveGrpcTabConnection';
import type { GrpcTlsMode } from './contracts';

const GRPC_PORT_ENV_RE = /^\d{1,5}$/;

/** Parse port digits from a validated host:port string. */
export function extractGrpcPortFromHostPort(hostPort: string): string | undefined {
  const check = validateGrpcTargetAddress(hostPort);
  if (!check.valid || check.kind !== 'host_port') {
    return undefined;
  }
  const colonIdx = check.normalized.lastIndexOf(':');
  if (colonIdx < 0) {
    return undefined;
  }
  const hostPart = check.normalized.slice(0, colonIdx);
  const portPart = check.normalized.slice(colonIdx + 1);
  if (hostPart.startsWith('[') && hostPart.endsWith(']')) {
    return portPart;
  }
  return portPart;
}

/** Derive grpcPort companion token when grpcHost is a valid host:port. */
export function deriveGrpcPortEnvValue(grpcHost: string | undefined): string | undefined {
  const trimmed = grpcHost?.trim();
  if (!trimmed) {
    return undefined;
  }
  return extractGrpcPortFromHostPort(trimmed);
}

function validateGrpcHostEnvValue(value: string): GrpcInterpolationValidationIssue | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    const failure = buildGrpcTargetValidationFailure('missing_grpc_host');
    return {
      field: 'grpcHost',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  if (grpcTargetHasIllegalScheme(trimmed)) {
    const failure = buildGrpcTargetValidationFailure('invalid_grpc_host_env');
    return {
      field: 'grpcHost',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  const check = validateGrpcTargetAddress(trimmed);
  if (!check.valid || check.kind !== 'host_port') {
    const failure = buildGrpcTargetValidationFailure('invalid_grpc_host_env');
    return {
      field: 'grpcHost',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  return undefined;
}

function validateGrpcPortEnvValue(value: string): GrpcInterpolationValidationIssue | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    const failure = buildGrpcTargetValidationFailure('missing_grpc_port');
    return {
      field: 'grpcPort',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  if (!GRPC_PORT_ENV_RE.test(trimmed)) {
    const failure = buildGrpcTargetValidationFailure('invalid_grpc_port_env');
    return {
      field: 'grpcPort',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  const port = Number(trimmed);
  if (port < 1 || port > 65535) {
    const failure = buildGrpcTargetValidationFailure('invalid_grpc_port_env');
    return {
      field: 'grpcPort',
      code: failure.code,
      message: formatGrpcTargetValidationError(failure),
      context: 'target',
    };
  }
  return undefined;
}

/** Validate canonical env token values present in a merged env map. */
export function validateGrpcCanonicalEnvTokens(
  env: Readonly<Record<string, string>>,
): GrpcInterpolationValidationIssue[] {
  const issues: GrpcInterpolationValidationIssue[] = [];
  for (const token of GRPC_CANONICAL_ENV_TOKENS) {
    if (!(token in env)) {
      continue;
    }
    const value = env[token] ?? '';
    const issue = token === 'grpcHost'
      ? validateGrpcHostEnvValue(value)
      : validateGrpcPortEnvValue(value);
    if (issue) {
      issues.push(issue);
    }
  }
  return issues;
}

/** Connection fields used to resolve the effective target template (tab → profile → page). */
export interface GrpcConnectionTargetInput {
  target?: string;
  connectionId?: string;
  tlsMode?: GrpcTlsMode;
}

/** Effective target template after Phase 1A connection precedence (before env interpolation). */
export function resolveGrpcConnectionTargetTemplate(
  connection: GrpcConnectionTargetInput,
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaults: GrpcTabConnectionPageDefaults,
): string {
  return resolveGrpcTabConnection(connection, profiles, pageDefaults).target;
}

/** Validate canonical env tokens referenced by a connection target template. */
export function validateGrpcCanonicalEnvTokensForConnection(
  env: Readonly<Record<string, string>>,
  connection: GrpcConnectionTargetInput,
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaults: GrpcTabConnectionPageDefaults,
): GrpcInterpolationValidationIssue[] {
  return validateGrpcCanonicalEnvTokensForTarget(
    env,
    resolveGrpcConnectionTargetTemplate(connection, profiles, pageDefaults),
  );
}

/** Throw when canonical tokens referenced by the connection target template are invalid. */
export function assertGrpcCanonicalEnvTokensValidForConnection(
  env: Readonly<Record<string, string>>,
  connection: GrpcConnectionTargetInput,
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaults: GrpcTabConnectionPageDefaults,
): void {
  const issues = validateGrpcCanonicalEnvTokensForConnection(
    env,
    connection,
    profiles,
    pageDefaults,
  );
  if (issues.length > 0) {
    throw new Error(issues[0]!.message);
  }
}

/** Validate canonical env tokens referenced by a target template. */
export function validateGrpcCanonicalEnvTokensForTarget(
  env: Readonly<Record<string, string>>,
  targetTemplate: string,
): GrpcInterpolationValidationIssue[] {
  const extracted = extractGrpcInterpolationTokenNamesSafe(targetTemplate);
  const referenced = new Set(extracted.ok ? extracted.names : []);
  return validateGrpcCanonicalEnvTokens(env).filter((issue) => (
    (GRPC_CANONICAL_ENV_TOKENS as readonly string[]).includes(issue.field)
    && referenced.has(issue.field)
  ));
}

/** Throw when canonical tokens referenced by the target template are invalid. */
export function assertGrpcCanonicalEnvTokensValidForTarget(
  env: Readonly<Record<string, string>>,
  targetTemplate: string,
): void {
  const issues = validateGrpcCanonicalEnvTokensForTarget(env, targetTemplate);
  if (issues.length > 0) {
    throw new Error(issues[0]!.message);
  }
}

/** Throw the first canonical env issue — for execute/snapshot preflight. */
export function assertGrpcCanonicalEnvTokensValid(
  env: Readonly<Record<string, string>>,
): void {
  const issues = validateGrpcCanonicalEnvTokens(env);
  if (issues.length > 0) {
    throw new Error(issues[0]!.message);
  }
}

/** First canonical env issue for a specific token name, if any. */
export function findGrpcCanonicalEnvIssue(
  env: Readonly<Record<string, string>>,
  token: typeof GRPC_CANONICAL_ENV_TOKENS[number],
): GrpcInterpolationValidationIssue | undefined {
  return validateGrpcCanonicalEnvTokens(env).find((issue) => issue.field === token);
}

/** Map server-side validation issues to GRPC error codes when needed. */
export function grpcCanonicalEnvIssueToGrpcErrorCode(
  issue: GrpcInterpolationValidationIssue,
): string {
  if (issue.code === GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN) {
    return 'GRPC_INVALID_TARGET';
  }
  return 'GRPC_INVALID_TARGET';
}
