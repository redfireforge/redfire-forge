/**
 * Phase 9A — shared interpolation constants (no grammar imports).
 */

export const GRPC_INTERPOLATION_ERROR_CODES = {
  MISSING_TOKEN: 'grpc.interpolation.missing_token',
  CYCLE: 'grpc.interpolation.cycle',
  INVALID_TARGET: 'grpc.interpolation.invalid_target',
  SERIALIZATION: 'grpc.interpolation.serialization',
  VALIDATION: 'grpc.interpolation.validation',
  INVALID_SYNTAX: 'grpc.interpolation.invalid_syntax',
  STRUCTURAL_KEY_TOKENIZED: 'grpc.interpolation.structural_key_tokenized',
} as const;

export type GrpcInterpolationErrorCode =
  (typeof GRPC_INTERPOLATION_ERROR_CODES)[keyof typeof GRPC_INTERPOLATION_ERROR_CODES];

export const GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY: Partial<
  Record<GrpcInterpolationErrorCode, 'serialization' | 'validation'>
> = {
  [GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN]: 'serialization',
  [GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION]: 'serialization',
  [GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX]: 'serialization',
  [GRPC_INTERPOLATION_ERROR_CODES.CYCLE]: 'serialization',
  [GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET]: 'validation',
  [GRPC_INTERPOLATION_ERROR_CODES.VALIDATION]: 'validation',
  [GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED]: 'validation',
};

export const GRPC_CANONICAL_ENV_TOKENS = ['grpcHost', 'grpcPort'] as const;

export type GrpcCanonicalEnvToken = (typeof GRPC_CANONICAL_ENV_TOKENS)[number];

export const GRPC_INTERPOLATION_ALLOWED_CONTEXTS = [
  'target',
  'metadata_key',
  'metadata_value',
  'body_key',
  'body_value',
  'auth_value',
  'assertion_expected_value',
  'collect_until_expression',
] as const;

export type GrpcInterpolationContext = (typeof GRPC_INTERPOLATION_ALLOWED_CONTEXTS)[number];

export const GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS = [
  'service',
  'method',
  'descriptorKey',
  'callType',
  'grpcField',
  'grpcNumericField',
  'grpcStreamField',
  'grpcTrailer',
] as const;

export type GrpcStructuralInterpolationForbiddenField =
  (typeof GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS)[number];

export const GRPC_INTERPOLATION_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface GrpcInterpolationValidationIssue {
  field: string;
  code: GrpcInterpolationErrorCode;
  message: string;
  context?: GrpcInterpolationContext;
}

export function isGrpcStructuralInterpolationForbiddenField(
  field: string,
): field is GrpcStructuralInterpolationForbiddenField {
  return (GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS as readonly string[])
    .includes(field);
}

export function isGrpcInterpolationAllowedContext(
  context: string,
): context is GrpcInterpolationContext {
  return (GRPC_INTERPOLATION_ALLOWED_CONTEXTS as readonly string[]).includes(context);
}
