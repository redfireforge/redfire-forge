/**
 * Phase 8G — gRPC harness result builder with status/category precedence.
 */
import type { GrpcCallType } from '../grpc/contracts';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import type {
  GrpcHarnessAssertionResult,
  GrpcHarnessErrorCategory,
  GrpcHarnessResult,
  GrpcHarnessResultStatus,
} from '../types/grpc-harness-result';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';

/** gRPC status code DEADLINE_EXCEEDED — maps to harness timeout category. */
export const GRPC_STATUS_DEADLINE_EXCEEDED = 4;

export interface ResolveGrpcHarnessResultStatusInput {
  preTransportError?: boolean;
  transportPassed: boolean;
  assertionsPassed: boolean;
  validationPassed: boolean;
  errorCategory?: GrpcHarnessErrorCategory;
  grpcStatus?: number;
}

export interface ResolveGrpcHarnessErrorCategoryInput {
  preTransportCategory?: GrpcHarnessErrorCategory;
  transportOutcome?: GrpcHarnessCallOutcome;
  assertionsPassed: boolean;
  harnessAssertionsConfigured: boolean;
}

export interface BuildGrpcHarnessResultInput {
  scenarioId: string;
  dataRowId?: string;
  callType: GrpcCallType;
  durationMs: number;
  transportOutcome?: GrpcHarnessCallOutcome;
  assertionResults: GrpcHarnessAssertionResult[];
  assertionsPassed: boolean;
  validationPassed: boolean;
  harnessAssertionsConfigured: boolean;
  /** First scenario validation failure message when transport + harness assertions pass. */
  validationFailureDetail?: string;
  preTransportError?: {
    errorCategory: GrpcHarnessErrorCategory;
    errorDetail: string;
  };
}

function isHarnessTimeout(
  errorCategory?: GrpcHarnessErrorCategory,
  grpcStatus?: number,
): boolean {
  return errorCategory === 'timeout' || grpcStatus === GRPC_STATUS_DEADLINE_EXCEEDED;
}

/**
 * Strict precedence: `timeout` > `error` > `failed` > `passed`.
 */
export function resolveGrpcHarnessResultStatus(
  input: ResolveGrpcHarnessResultStatusInput,
): GrpcHarnessResultStatus {
  if (isHarnessTimeout(input.errorCategory, input.grpcStatus)) {
    return 'timeout';
  }
  if (input.preTransportError || !input.transportPassed) {
    return 'error';
  }
  if (!input.assertionsPassed || !input.validationPassed) {
    return 'failed';
  }
  return 'passed';
}

export function resolveGrpcHarnessErrorCategory(
  input: ResolveGrpcHarnessErrorCategoryInput,
): GrpcHarnessErrorCategory | undefined {
  if (input.preTransportCategory) {
    return input.preTransportCategory;
  }

  const outcome = input.transportOutcome;
  if (outcome && !outcome.passed) {
    if (isHarnessTimeout(outcome.errorCategory, outcome.grpcStatus)) {
      return 'timeout';
    }
    return outcome.errorCategory ?? 'internal';
  }

  if (
    input.harnessAssertionsConfigured
    && !input.assertionsPassed
  ) {
    return 'assertion';
  }

  return undefined;
}

/** Default transport diagnostic when a failed outcome omits explicit detail. */
export const GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR = 'gRPC call failed';

function transportErrorDetail(outcome: GrpcHarnessCallOutcome | undefined): string | undefined {
  if (!outcome || outcome.passed) return undefined;
  return outcome.errorDetail
    ?? outcome.grpcStatusMessage
    ?? GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR;
}

function pickErrorDetail(
  status: GrpcHarnessResultStatus,
  transportOutcome: GrpcHarnessCallOutcome | undefined,
  assertionResults: GrpcHarnessAssertionResult[],
  preTransportError?: BuildGrpcHarnessResultInput['preTransportError'],
  validationFailureDetail?: string,
): string | undefined {
  if (preTransportError?.errorDetail) {
    return preTransportError.errorDetail;
  }
  if (status === 'failed') {
    const failedAssertion = assertionResults.find((result) => !result.passed);
    if (failedAssertion?.message) return failedAssertion.message;
    return validationFailureDetail;
  }
  if (status === 'error' || status === 'timeout') {
    return transportErrorDetail(transportOutcome)
      ?? assertionResults.find((result) => !result.passed)?.message;
  }
  return undefined;
}

/** Build the canonical `GrpcHarnessResult` from transport + assertion evaluation. */
export function buildGrpcHarnessResult(input: BuildGrpcHarnessResultInput): GrpcHarnessResult {
  const transportPassed = input.preTransportError
    ? false
    : (input.transportOutcome?.passed ?? false);

  const errorCategory = resolveGrpcHarnessErrorCategory({
    preTransportCategory: input.preTransportError?.errorCategory,
    transportOutcome: input.transportOutcome,
    assertionsPassed: input.assertionsPassed,
    harnessAssertionsConfigured: input.harnessAssertionsConfigured,
  });

  const status = resolveGrpcHarnessResultStatus({
    preTransportError: Boolean(input.preTransportError),
    transportPassed,
    assertionsPassed: input.assertionsPassed,
    validationPassed: input.validationPassed,
    errorCategory,
    grpcStatus: input.transportOutcome?.grpcStatus,
  });

  const outcome = input.transportOutcome;

  return {
    schemaVersion: GRPC_HARNESS_RESULT_SCHEMA_VERSION,
    scenarioId: input.scenarioId,
    dataRowId: input.dataRowId,
    callType: input.callType,
    status,
    grpcStatus: outcome?.grpcStatus,
    grpcStatusMessage: outcome?.grpcStatusMessage,
    durationMs: input.durationMs,
    body: outcome?.body,
    messages: outcome?.messages,
    trailers: outcome?.trailers,
    assertionResults: input.assertionResults,
    errorCategory,
    errorDetail: pickErrorDetail(
      status,
      outcome,
      input.assertionResults,
      input.preTransportError,
      input.validationFailureDetail,
    ),
  };
}

/** Human-readable one-line summary for logs and debugging. */
export function formatGrpcHarnessResultSummary(result: GrpcHarnessResult): string {
  const parts = [
    `[${result.status.toUpperCase()}]`,
    result.callType,
    `${result.durationMs}ms`,
  ];
  if (result.grpcStatus !== undefined) {
    parts.push(`grpc=${result.grpcStatus}`);
  }
  if (result.errorCategory) {
    parts.push(`category=${result.errorCategory}`);
  }
  const failedCount = result.assertionResults.filter((item) => !item.passed).length;
  if (failedCount > 0) {
    parts.push(`assertions=${failedCount}/${result.assertionResults.length} failed`);
  }
  if (result.errorDetail) {
    parts.push(result.errorDetail);
  }
  return parts.join(' ');
}
