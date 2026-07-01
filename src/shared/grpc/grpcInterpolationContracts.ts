/**
 * Phase 9A — gRPC environment interpolation contracts (barrel + structural validation).
 */
export {
  GRPC_INTERPOLATION_ERROR_CODES,
  GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY,
  GRPC_CANONICAL_ENV_TOKENS,
  GRPC_INTERPOLATION_ALLOWED_CONTEXTS,
  GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS,
  GRPC_INTERPOLATION_VAR_NAME_PATTERN,
  isGrpcStructuralInterpolationForbiddenField,
  isGrpcInterpolationAllowedContext,
  type GrpcInterpolationErrorCode,
  type GrpcCanonicalEnvToken,
  type GrpcInterpolationContext,
  type GrpcStructuralInterpolationForbiddenField,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';

export {
  tokenizeGrpcInterpolation,
  containsGrpcInterpolationToken,
  extractGrpcInterpolationTokenNames,
  extractGrpcInterpolationTokenNamesSafe,
  hasUnresolvedGrpcInterpolationTokens,
  unescapeGrpcInterpolationLiterals,
  escapeGrpcInterpolationLiterals,
  legacyHasUnresolvedVarsDiffers,
  getGrpcInterpolationTemplateState,
  inspectGrpcInterpolationTemplate,
  LEGACY_UNRESOLVED_VAR_PATTERN,
  GrpcInterpolationSyntaxError,
  type GrpcInterpolationSegment,
  type GrpcInterpolationInspectResult,
} from './grpcInterpolationGrammar';

import {
  GRPC_INTERPOLATION_ERROR_CODES,
  isGrpcStructuralInterpolationForbiddenField,
  type GrpcInterpolationValidationIssue,
  type GrpcStructuralInterpolationForbiddenField,
} from './grpcInterpolationConstants';
import { inspectGrpcInterpolationTemplate } from './grpcInterpolationGrammar';

export function validateGrpcStructuralFieldNotTokenized(
  field: GrpcStructuralInterpolationForbiddenField,
  value: string,
): GrpcInterpolationValidationIssue | undefined {
  const inspected = inspectGrpcInterpolationTemplate(value);
  if (!inspected.ok) {
    return {
      field,
      code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX,
      message: inspected.error.message,
    };
  }
  if (!inspected.hasToken) {
    return undefined;
  }
  return {
    field,
    code: GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED,
    message: `${field} must be a literal identifier; interpolation tokens are not allowed`,
  };
}

/** Dynamic-field wrapper for scenario/workflow validators (9B+). */
export function validateGrpcStructuralFieldIfForbidden(
  field: string,
  value: string,
): GrpcInterpolationValidationIssue | undefined {
  if (!isGrpcStructuralInterpolationForbiddenField(field)) {
    return undefined;
  }
  return validateGrpcStructuralFieldNotTokenized(field, value);
}
