/**
 * Phase 9D — user-facing target validation messages and remediation hints.
 */
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import type { GrpcInterpolationErrorCode } from './grpcInterpolationConstants';

export type GrpcTargetValidationFailureKind =
  | 'empty'
  | 'unresolved_token'
  | 'missing_grpc_host'
  | 'missing_grpc_port'
  | 'illegal_scheme'
  | 'invalid_format'
  | 'invalid_port'
  | 'invalid_grpc_host_env'
  | 'invalid_grpc_port_env';

export interface GrpcTargetValidationMessage {
  reason: string;
  hint?: string;
  code: GrpcInterpolationErrorCode;
  kind: GrpcTargetValidationFailureKind;
}

const TARGET_SCHEME_RE = /^(https?|grpcs?|dns):\/\//i;

export function grpcTargetHasIllegalScheme(raw: string): boolean {
  return TARGET_SCHEME_RE.test(raw.trim());
}

export function buildGrpcTargetValidationFailure(
  kind: GrpcTargetValidationFailureKind,
  details?: { tokenName?: string },
): GrpcTargetValidationMessage {
  switch (kind) {
    case 'empty':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'Target address is required',
        hint: 'Enter host:port (e.g. localhost:50051), in-process:<name>, or {{grpcHost}} from the active environment',
      };
    case 'illegal_scheme':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'gRPC target must be host:port without a URL scheme',
        hint: 'Remove http://, https://, grpc://, or dns:// — use host:port (e.g. localhost:50051)',
      };
    case 'missing_grpc_host':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
        reason: '{{grpcHost}} is not configured for the active environment',
        hint: 'Open Environment Manager → gRPC panel and set a host:port address for this environment',
      };
    case 'missing_grpc_port':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
        reason: '{{grpcPort}} is not configured for the active environment',
        hint: 'Configure a gRPC host:port address — grpcPort is derived from that setting',
      };
    case 'unresolved_token':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
        reason: details?.tokenName
          ? `Resolve {{${details.tokenName}}} before connecting`
          : 'Resolve environment variables before connecting',
        hint: details?.tokenName === 'grpcHost' || details?.tokenName === 'grpcPort'
          ? 'Configure the variable in Environment Manager or choose a literal host:port target'
          : 'Add the missing variable to the active environment or use a literal value',
      };
    case 'invalid_port':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'Port must be between 1 and 65535',
        hint: 'Use a valid TCP port number (Spring Boot gRPC often uses 9090)',
      };
    case 'invalid_grpc_host_env':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'grpcHost must be host:port without a URL scheme',
        hint: 'In Environment Manager, set gRPC address to host:port (e.g. grpc.example.com:50051)',
      };
    case 'invalid_grpc_port_env':
      return {
        kind,
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'grpcPort must be a numeric port between 1 and 65535',
        hint: 'grpcPort is derived automatically when gRPC address is host:port',
      };
    case 'invalid_format':
    default:
      return {
        kind: 'invalid_format',
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        reason: 'Target must be host:port or in-process:<name>',
        hint: 'Accepted formats: localhost:50051, [ipv6]:port, in-process:my-server',
      };
  }
}

/** Format user-facing execute/reflect error including optional remediation hint. */
export function formatGrpcTargetValidationError(
  message: Pick<GrpcTargetValidationMessage, 'reason' | 'hint'>,
): string {
  if (!message.hint) {
    return message.reason;
  }
  return `${message.reason} — ${message.hint}`;
}

/** Map unresolved {{token}} in a partially resolved target to a specific failure. */
export function buildUnresolvedGrpcTargetFailure(resolvedTarget: string): GrpcTargetValidationMessage {
  const tokenMatch = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/.exec(resolvedTarget);
  const tokenName = tokenMatch?.[1];
  if (tokenName === 'grpcHost') {
    return buildGrpcTargetValidationFailure('missing_grpc_host');
  }
  if (tokenName === 'grpcPort') {
    return buildGrpcTargetValidationFailure('missing_grpc_port');
  }
  return buildGrpcTargetValidationFailure('unresolved_token', { tokenName });
}
