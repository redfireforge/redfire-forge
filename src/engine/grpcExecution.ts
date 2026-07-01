/**
 * gRPC harness action execution for the standard test runner (non-workflow).
 *
 * Maps `GrpcCallActionConfig` scenarios to `GrpcHarnessOperations` and returns
 * `RequestResult` with `transportType: 'grpcCall'` and `grpcResultMeta`.
 */
import type { Scenario, RequestResult, GrpcResultMeta, FailureDetail } from '../shared/types';
import type { GrpcHarnessAssertion } from '../shared/types/grpc-harness';
import type { GrpcHarnessCallOutcome } from '../shared/types/grpc-harness-snapshot';
import type { GrpcHarnessResult } from '../shared/types/grpc-harness-result';
import { nextResultId, buildErrorResult } from './requestExecution';
import { buildValidationResult, type ValidationOutput } from './validationResult';
import { parseJsonSafe, toErrorMessage } from '../shared/utils/helpers';
import { round2 as roundMs } from '../shared/utils/percentiles';
import {
  buildGrpcHarnessOperations,
  type GrpcHarnessOperations,
} from '../shared/grpc/buildGrpcHarnessOperations';
import { createGrpcHarnessSnapshotBuildContext, mergeGrpcHarnessRuntimeContext, resolveGrpcHarnessEnv, type GrpcHarnessRuntimeOverrides } from '../shared/grpc/grpcHarnessRuntimeContext';
import {
  buildGrpcHarnessSnapshotForScenario,
  executeGrpcHarnessSnapshot,
} from '../shared/grpc/grpcHarnessExecutor';
import { evaluateGrpcHarnessAssertionsDetailed } from '../shared/grpc/grpcHarnessAssertEngine';
import { hasGrpcHarnessTerminalBody } from '../shared/grpc/grpcHarnessAssertPath';
import { buildGrpcHarnessResult, GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR } from '../shared/grpc/grpcHarnessResultBuilder';
import { resolveGrpcInterpolationHarnessPreTransportCategory } from '../shared/grpc/grpcInterpolationError';

export interface ExecuteGrpcActionOptions {
  abortSignal?: AbortSignal;
  grpcHarnessEnv?: Record<string, string>;
  /** Connection profiles / TLS material for snapshot build (caller-supplied; runner hydration deferred). */
  runtimeOverrides?: GrpcHarnessRuntimeOverrides;
}

function grpcMethodLabel(callType: GrpcHarnessCallOutcome['callType']): string {
  switch (callType) {
    case 'unary': return 'UNARY';
    case 'server_streaming': return 'SERVER_STREAM';
    case 'client_streaming': return 'CLIENT_STREAM';
    case 'bidi_streaming': return 'BIDI_STREAM';
    default: return 'GRPC';
  }
}

function outcomeResponseBody(outcome: GrpcHarnessCallOutcome): string {
  if (outcome.callType === 'client_streaming' && hasGrpcHarnessTerminalBody(outcome.body)) {
    return JSON.stringify(outcome.body, null, 2);
  }
  if (outcome.messages?.length) {
    return JSON.stringify(outcome.messages, null, 2);
  }
  if (outcome.body) {
    return JSON.stringify(outcome.body, null, 2);
  }
  return '';
}

function buildGrpcResultMeta(
  scenario: Scenario,
  outcome: GrpcHarnessCallOutcome,
  target: string,
  assertionFailures?: string[],
  harnessResult?: GrpcHarnessResult,
): GrpcResultMeta {
  const config = scenario.grpcCallAction!;
  const meta: GrpcResultMeta = {
    service: config.service,
    method: config.method,
    target,
    grpcStatus: outcome.grpcStatus,
    grpcStatusMessage: outcome.grpcStatusMessage,
    messageCount: outcome.messages?.length,
    streamStopReason: outcome.streamStopReason,
    attempts: outcome.attempts,
  };
  if (assertionFailures !== undefined) {
    meta.assertionFailures = assertionFailures;
  }
  if (harnessResult) {
    meta.harnessResult = harnessResult;
    if (harnessResult.errorCategory) {
      meta.errorCategory = harnessResult.errorCategory;
    }
  }
  return meta;
}

function assertionFailuresToDetails(failures: string[]): FailureDetail[] {
  return failures.map((message) => ({
    path: '(grpcAssertion)',
    expected: 'pass',
    actual: message,
  }));
}

function validationFailureDetail(vr: ValidationOutput): string | undefined {
  if (vr.passed) return undefined;
  if (vr.errorMessage) return vr.errorMessage;
  const first = vr.failureDetails[0];
  if (!first) return undefined;
  return `${first.path}: expected ${String(first.expected)}, got ${String(first.actual)}`;
}

function mapOutcomeToRequestResult(
  scenario: Scenario,
  outcome: GrpcHarnessCallOutcome,
  target: string,
  startedAt: number,
  assertions: GrpcHarnessAssertion[] = [],
): RequestResult {
  const id = nextResultId();
  const responseTimeMs = roundMs(outcome.durationMs || (performance.now() - startedAt));
  const responseBody = outcomeResponseBody(outcome);
  const responseObj = parseJsonSafe(responseBody);
  const httpStatus = outcome.passed ? 200 : 0;
  const errorMessage = outcome.passed
    ? undefined
    : (outcome.errorDetail ?? outcome.grpcStatusMessage ?? GRPC_HARNESS_DEFAULT_TRANSPORT_ERROR);

  const harnessAssertionsConfigured = assertions.length > 0;
  const assertOutcome = harnessAssertionsConfigured
    ? evaluateGrpcHarnessAssertionsDetailed(outcome, assertions)
    : { passed: true, failures: [] as string[], assertionResults: [] };
  const assertionFailures = harnessAssertionsConfigured ? assertOutcome.failures : undefined;

  const vr = buildValidationResult({
    httpStatus,
    responseTimeMs,
    responseHeaders: outcome.trailers ?? {},
    responseBody,
    responseObj,
    errorMessage,
    validation: scenario.validation ?? { mode: 'none' as const },
    assertions: scenario.validation?.assertions ?? [],
    transportType: 'grpcCall',
  });

  const harnessResult = buildGrpcHarnessResult({
    scenarioId: scenario.id,
    dataRowId: scenario.dataRowId,
    callType: outcome.callType,
    durationMs: responseTimeMs,
    transportOutcome: outcome,
    assertionResults: assertOutcome.assertionResults,
    assertionsPassed: assertOutcome.passed,
    validationPassed: vr.passed,
    harnessAssertionsConfigured,
    validationFailureDetail: validationFailureDetail(vr),
  });
  const grpcResultMeta = buildGrpcResultMeta(
    scenario,
    outcome,
    target,
    assertionFailures,
    harnessResult,
  );

  const transportAndAssertionsPassed = outcome.passed && assertOutcome.passed;
  const combinedFailureDetails = [
    ...vr.failureDetails,
    ...assertionFailuresToDetails(assertOutcome.failures),
  ];

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    featureGroupName: scenario.featureGroupName,
    groupName: scenario.groupName,
    url: `grpc://${target}/${configServiceMethod(scenario)}`,
    method: grpcMethodLabel(outcome.callType),
    httpStatus,
    responseTimeMs,
    responseBody,
    responseHeaders: outcome.trailers ?? {},
    timestamp: Date.now(),
    passed: transportAndAssertionsPassed && vr.passed,
    validationMode: scenario.validation?.mode ?? 'none',
    failureDetails: combinedFailureDetails,
    errorMessage: harnessResult.errorDetail,
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
    scenarioTags: scenario.scenarioTags,
    transportType: 'grpcCall',
    grpcResultMeta,
  };
}

function buildGrpcHarnessErrorResult(
  scenario: Scenario,
  err: unknown,
  target?: string,
  startedAt?: number,
): RequestResult {
  const result = buildErrorResult(scenario, err);
  result.transportType = 'grpcCall';
  const cfg = scenario.grpcCallAction;
  const durationMs = startedAt !== undefined
    ? roundMs(performance.now() - startedAt)
    : result.responseTimeMs;
  const errorDetail = toErrorMessage(err);
  const preTransportCategory = resolveGrpcInterpolationHarnessPreTransportCategory(err);
  if (cfg) {
    result.method = grpcMethodLabel(cfg.callType ?? 'unary');
    const harnessResult = buildGrpcHarnessResult({
      scenarioId: scenario.id,
      dataRowId: scenario.dataRowId,
      callType: cfg.callType ?? 'unary',
      durationMs,
      assertionResults: [],
      assertionsPassed: true,
      validationPassed: true,
      harnessAssertionsConfigured: false,
      preTransportError: {
        errorCategory: preTransportCategory,
        errorDetail,
      },
    });
    result.grpcResultMeta = {
      service: cfg.service,
      method: cfg.method,
      target: target ?? cfg.target,
      errorCategory: harnessResult.errorCategory,
      harnessResult,
    };
    result.errorMessage = harnessResult.errorDetail ?? result.errorMessage;
  }
  return result;
}

function configServiceMethod(scenario: Scenario): string {
  const cfg = scenario.grpcCallAction;
  if (!cfg) return '';
  return `${cfg.service}/${cfg.method}`;
}

/**
 * Execute a gRPC harness scenario and return a `RequestResult`.
 * Called by `executor.ts` via `RunOpts.executeNonHttp`.
 */
export async function executeGrpcAction(
  scenario: Scenario,
  operations?: GrpcHarnessOperations,
  options?: ExecuteGrpcActionOptions,
): Promise<RequestResult> {
  const ops = operations ?? buildGrpcHarnessOperations();
  const envMap = resolveGrpcHarnessEnv({ grpcHarnessEnv: options?.grpcHarnessEnv });
  const startedAt = performance.now();

  try {
    const buildContext = options?.runtimeOverrides
      ? mergeGrpcHarnessRuntimeContext(envMap, options.runtimeOverrides)
      : createGrpcHarnessSnapshotBuildContext(envMap);
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, buildContext);
    const outcome = await executeGrpcHarnessSnapshot(snapshot, {
      operations: ops,
      buildContext,
      abortSignal: options?.abortSignal,
    });
    const target = snapshot.execute.target.address;
    const assertions = snapshot.assertions ?? scenario.grpcCallAction?.assertions ?? [];
    return mapOutcomeToRequestResult(scenario, outcome, target, startedAt, assertions);
  } catch (err) {
    const fallbackTarget = scenario.grpcCallAction?.target;
    return buildGrpcHarnessErrorResult(scenario, err, fallbackTarget, startedAt);
  }
}
