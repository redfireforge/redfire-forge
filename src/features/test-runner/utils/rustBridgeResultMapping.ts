import type { FailureDetail, RequestResult, Scenario, ValidationMode } from '@shared/types';
import { buildGrpcHarnessRowTraceKey } from '@shared/grpc/grpcHarnessRowIdentity';
import { buildValidationResult } from '@engine/core/validationResult';
import { evaluateAssertions } from '@engine/core/validator';
import type { RustExecutionResult } from './rustBridge';

function buildBaseRequestResult(
  rustResult: RustExecutionResult,
  scenario?: Scenario,
): Omit<RequestResult, 'passed' | 'validationMode' | 'failureDetails' | 'errorMessage'> {
  return {
    id: rustResult.id,
    scenarioId: rustResult.scenarioId,
    scenarioName: rustResult.scenarioName,
    featureGroupName: rustResult.featureGroupName ?? undefined,
    groupName: rustResult.groupName ?? undefined,
    url: rustResult.url,
    method: rustResult.method,
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseBody: rustResult.responseBody,
    responseHeaders: rustResult.responseHeaders,
    timestamp: rustResult.timestamp,
    timing: rustResult.timing,
    requestLog: {
      headers: rustResult.requestLog.headers,
      body: rustResult.requestLog.body ?? undefined,
    },
    dataRowId: rustResult.dataRowId ?? undefined,
    dataRowLabel: rustResult.dataRowLabel ?? undefined,
    scenarioTags: scenario?.scenarioTags,
  };
}

/**
 * Passthrough path: Rust validated — trust passed/failureDetails from Rust,
 * then evaluate any custom assertions JS-side and merge.
 */
function mapRustResultPassthrough(
  rustResult: RustExecutionResult,
  scenario: Scenario,
  errorMessage: string | undefined,
): RequestResult {
  let passed = rustResult.passed!;
  let failureDetails: FailureDetail[] = rustResult.failureDetails ?? [];

  const customAssertions = (scenario.validation.assertions ?? [])
    .filter(a => a.type === 'custom');

  if (customAssertions.length > 0) {
    let responseObj: unknown = null;
    if (rustResult.responseBody) {
      try { responseObj = JSON.parse(rustResult.responseBody); } catch { /* use null */ }
    }
    const { failures: customFailures } = evaluateAssertions(customAssertions, {
      httpStatus: rustResult.httpStatus,
      responseTimeMs: rustResult.responseTimeMs,
      responseHeaders: rustResult.responseHeaders,
      responseBody: responseObj,
      rawBody: rustResult.responseBody,
    });
    if (customFailures.length > 0) {
      failureDetails = [...failureDetails, ...customFailures];
      passed = false;
    }
  }

  let finalErrorMessage = errorMessage;
  if (rustResult.retryCount > 0 && !passed) {
    finalErrorMessage = `${finalErrorMessage ?? 'Failed'} (after ${rustResult.retryCount + 1} attempts)`;
  }

  return {
    ...buildBaseRequestResult(rustResult, scenario),
    passed,
    validationMode: (rustResult.validationMode ?? scenario.validation.mode) as ValidationMode,
    failureDetails,
    errorMessage: finalErrorMessage,
  };
}

/**
 * Fallback path: Rust didn't validate (passed === undefined) — run full JS-side validation.
 * Backward compatible with older Rust binaries that don't emit validation fields.
 */
function mapRustResultJsFallback(
  rustResult: RustExecutionResult,
  scenario: Scenario,
  errorMessage: string | undefined,
): RequestResult {
  let responseObj: unknown;
  const needsParse =
    (rustResult.httpStatus >= 400 || rustResult.httpStatus === 0)
    || scenario.validation.mode !== 'none'
    || (scenario.validation.assertions?.length ?? 0) > 0
    || (scenario.validation.expectedFields?.length ?? 0) > 0;

  if (needsParse && rustResult.responseBody) {
    try {
      responseObj = JSON.parse(rustResult.responseBody);
    } catch {
      responseObj = rustResult.responseBody;
    }
  } else {
    responseObj = rustResult.responseBody;
  }

  const assertions = scenario.validation.assertions ?? [];
  const vr = buildValidationResult({
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseHeaders: rustResult.responseHeaders,
    responseBody: rustResult.responseBody,
    responseObj,
    errorMessage,
    validation: scenario.validation,
    assertions,
  });

  let finalErrorMessage = vr.errorMessage ?? errorMessage;
  if (rustResult.retryCount > 0 && !vr.passed) {
    finalErrorMessage = `${finalErrorMessage ?? 'Failed'} (after ${rustResult.retryCount + 1} attempts)`;
  }

  return {
    ...buildBaseRequestResult(rustResult, scenario),
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: finalErrorMessage,
  };
}

/**
 * Map a RustExecutionResult to a RequestResult.
 *
 * When Rust emits `passed` (not undefined), we passthrough the Rust validation results
 * and only run custom assertions JS-side (Rust skips them). When `passed` is undefined
 * (backward compat with older Rust binary), we fall back to full JS-side validation.
 */
export function mapRustResult(
  rustResult: RustExecutionResult,
  scenario: Scenario,
): RequestResult {
  let errorMessage = rustResult.errorMessage ?? undefined;

  const httpFailed = rustResult.httpStatus >= 400 || rustResult.httpStatus === 0;
  if (httpFailed && !errorMessage && rustResult.responseBody) {
    try {
      const parsed = JSON.parse(rustResult.responseBody);
      const obj = typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
      const raw = obj?.message ?? obj?.error ?? obj?.detail ?? obj?.errorMessage;
      if (typeof raw === 'string') errorMessage = raw;
      else if (raw != null) errorMessage = JSON.stringify(raw);
      else errorMessage = rustResult.responseBody.slice(0, 300);
    } catch {
      errorMessage = rustResult.responseBody.slice(0, 300);
    }
  }

  if (rustResult.passed !== undefined) {
    return mapRustResultPassthrough(rustResult, scenario, errorMessage);
  }
  return mapRustResultJsFallback(rustResult, scenario, errorMessage);
}

/**
 * Build a lookup map from scenario ID → Scenario for efficient result mapping.
 * For data-source-expanded scenarios, also maps by composite key "id::dataRowId".
 */
export function buildScenarioLookup(scenarios: Scenario[], expandedQueue: Scenario[]): Map<string, Scenario> {
  const lookup = new Map<string, Scenario>();
  for (const s of scenarios) {
    lookup.set(s.id, s);
  }
  for (const s of expandedQueue) {
    if (s.dataRowId) {
      lookup.set(buildGrpcHarnessRowTraceKey(s.id, s.dataRowId), s);
    }
    if (!lookup.has(s.id)) {
      lookup.set(s.id, s);
    }
  }
  return lookup;
}

export function findScenario(lookup: Map<string, Scenario>, result: RustExecutionResult): Scenario | undefined {
  if (result.dataRowId) {
    const composite = lookup.get(buildGrpcHarnessRowTraceKey(result.scenarioId, result.dataRowId));
    if (composite) return composite;
  }
  return lookup.get(result.scenarioId);
}

/**
 * Fallback for when a scenario can't be found in the lookup (shouldn't happen normally).
 * Creates a minimal RequestResult without validation.
 * Note: scenarioTags are unavailable here since we don't have the scenario object.
 */
export function mapRustResultWithoutValidation(rustResult: RustExecutionResult): RequestResult {
  const httpFailed = rustResult.httpStatus >= 400 || rustResult.httpStatus === 0;
  return {
    ...buildBaseRequestResult(rustResult),
    passed: !httpFailed,
    validationMode: 'none',
    failureDetails: httpFailed
      ? [{ path: '(http)', expected: '2xx', actual: rustResult.errorMessage ?? (rustResult.httpStatus === 0 ? 'network error' : `HTTP ${rustResult.httpStatus}`) }]
      : [],
    errorMessage: rustResult.errorMessage ?? undefined,
  };
}
