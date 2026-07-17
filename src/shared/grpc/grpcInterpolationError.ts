/**
 * Phase 9E — typed interpolation errors for harness/workflow classification.
 */
import type { GrpcHarnessErrorCategory } from '../types/grpc-harness-result';
import {
  GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY,
  type GrpcInterpolationErrorCode,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';

export class GrpcInterpolationError extends Error {
  readonly code: GrpcInterpolationErrorCode;
  readonly field?: string;

  constructor(issue: GrpcInterpolationValidationIssue) {
    super(issue.message);
    this.name = 'GrpcInterpolationError';
    this.code = issue.code;
    this.field = issue.field;
  }
}

/** Whether a pre-transport interpolation failure maps to harness `serialization`. */
export function isGrpcInterpolationHarnessSerializationError(err: unknown): boolean {
  return resolveGrpcInterpolationHarnessPreTransportCategory(err) === 'serialization';
}

/**
 * Map pre-transport interpolation/config failures to harness errorCategory.
 * Harness uses `serialization` for all pre-transport template/target/env failures
 * (including constant-mapped `validation` codes) — never transport `call_failed`.
 */
export function resolveGrpcInterpolationHarnessPreTransportCategory(
  err: unknown,
): GrpcHarnessErrorCategory {
  if (err instanceof GrpcInterpolationError) {
    const mapped = GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[err.code];
    if (mapped === 'serialization' || mapped === 'validation') {
      return 'serialization';
    }
    return 'internal';
  }
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes('unresolved template variables')
    || message.includes('Circular variable reference')
    || /grpcHost|Environment Manager|invalid gRPC harness scenario|invalid target/i.test(message)
  ) {
    return 'serialization';
  }
  return 'internal';
}
