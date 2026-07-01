/**
 * Phase 8C — harness call-type dispatch + attempt orchestration.
 */
import type { Scenario } from '../types';
import type { GrpcHarnessCallOutcome, GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';
import { GrpcApiClientError } from './grpcApiClient';
import {
  buildGrpcHarnessExecuteSnapshot,
  type GrpcHarnessSnapshotBuildContext,
} from './grpcHarnessSnapshotBuilder';
import { grpcHarnessSnapshotToStreamStartRequest } from './grpcHarnessTransportAdapter';
import {
  canStartNextGrpcHarnessAttempt,
  completeGrpcHarnessAttempt,
  createGrpcHarnessExecutionSession,
  grpcHarnessRetryDelayMs,
  resolveGrpcHarnessRetryPolicy,
  shouldRetryGrpcHarnessAttempt,
  sleepGrpcHarnessBackoff,
  startGrpcHarnessAttempt,
} from './grpcHarnessAttemptLifecycle';
import { executeGrpcHarnessUnary } from './grpcHarnessUnaryExecutor';
import type { GrpcHarnessOperations } from './buildGrpcHarnessOperations';

export interface ExecuteGrpcHarnessDeps {
  operations: GrpcHarnessOperations;
  buildContext: GrpcHarnessSnapshotBuildContext;
  abortSignal?: AbortSignal;
}

function harnessRequestId(scenarioId: string): string {
  return `harness-req:${scenarioId}:${Date.now()}`;
}

/** Build immutable snapshot — throws on unresolved templates (never retried). */
export function buildGrpcHarnessSnapshotForScenario(
  scenario: Scenario,
  buildContext: GrpcHarnessSnapshotBuildContext,
): GrpcHarnessExecuteSnapshot {
  return buildGrpcHarnessExecuteSnapshot(
    { scenario, requestId: harnessRequestId(scenario.id) },
    buildContext,
  );
}

async function executeStreamAttempt(
  snapshot: GrpcHarnessExecuteSnapshot,
  operations: GrpcHarnessOperations,
  abortSignal?: AbortSignal,
): Promise<GrpcHarnessCallOutcome> {
  const callType = snapshot.execute.callType;
  const tabId = snapshot.execute.tabId;
  const streamRequest = grpcHarnessSnapshotToStreamStartRequest(snapshot);

  if (callType === 'server_streaming') {
    if (!snapshot.collect) {
      throw new Error('server_streaming harness snapshot requires collect config');
    }
    return operations.collectHarnessServerStream(
      streamRequest,
      tabId,
      snapshot.collect,
      { abortSignal },
    );
  }

  if (callType === 'client_streaming') {
    return operations.executeClientStream(
      streamRequest,
      tabId,
      snapshot.sendMessages ?? [],
      { abortSignal },
    );
  }

  if (callType === 'bidi_streaming') {
    if (!snapshot.collect) {
      throw new Error('bidi_streaming harness snapshot requires collect config');
    }
    return operations.executeBidiStream(
      streamRequest,
      tabId,
      snapshot.sendMessages ?? [],
      snapshot.collect,
      { abortSignal },
    );
  }

  throw new Error(`Unsupported harness stream callType: ${callType as string}`);
}

function streamTransportFailureOutcome(
  snapshot: GrpcHarnessExecuteSnapshot,
  attempts: number,
  message: string,
  error: unknown,
): GrpcHarnessCallOutcome {
  const callType = snapshot.execute.callType;
  if (
    callType !== 'server_streaming'
    && callType !== 'client_streaming'
    && callType !== 'bidi_streaming'
  ) {
    throw new Error(`Expected streaming callType, got ${callType as string}`);
  }
  return {
    callType,
    passed: false,
    durationMs: 0,
    attempts,
    errorDetail: message,
    errorCategory: error instanceof GrpcApiClientError && error.retryable ? 'network' : 'internal',
    streamStopReason: 'transport_error',
  };
}

async function executeGrpcHarnessStreamWithRetry(
  snapshot: GrpcHarnessExecuteSnapshot,
  deps: ExecuteGrpcHarnessDeps,
): Promise<GrpcHarnessCallOutcome> {
  const policy = resolveGrpcHarnessRetryPolicy(snapshot.retry);
  const session = createGrpcHarnessExecutionSession(
    snapshot,
    `harness-stream:${snapshot.scenarioId}`,
  );

  let lastOutcome: GrpcHarnessCallOutcome | undefined;

  while (canStartNextGrpcHarnessAttempt(session)) {
    if (deps.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const attempt = startGrpcHarnessAttempt(session);

    try {
      const outcome = await executeStreamAttempt(
        attempt.snapshot,
        deps.operations,
        deps.abortSignal,
      );
      lastOutcome = { ...outcome, attempts: attempt.attemptNumber };

      if (outcome.passed) {
        completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'succeeded');
        return lastOutcome;
      }

      const canRetry = attempt.attemptNumber < policy.maxAttempts
        && shouldRetryGrpcHarnessAttempt(undefined, outcome.grpcStatus, policy.retryOnStatuses);
      completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'failed', {
        errorMessage: outcome.errorDetail ?? outcome.grpcStatusMessage,
      });
      if (!canRetry) {
        return lastOutcome;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'failed', {
        errorMessage: message,
      });
      const canRetry = attempt.attemptNumber < policy.maxAttempts
        && shouldRetryGrpcHarnessAttempt(error, undefined, policy.retryOnStatuses);
      if (!canRetry) {
        return streamTransportFailureOutcome(snapshot, attempt.attemptNumber, message, error);
      }
    }

    if (attempt.attemptNumber < policy.maxAttempts) {
      await sleepGrpcHarnessBackoff(grpcHarnessRetryDelayMs(policy.backoffMs), deps.abortSignal);
    }
  }

  if (lastOutcome) {
    return lastOutcome;
  }

  const callType = snapshot.execute.callType;
  if (
    callType !== 'server_streaming'
    && callType !== 'client_streaming'
    && callType !== 'bidi_streaming'
  ) {
    throw new Error(`Expected streaming callType, got ${callType as string}`);
  }

  return {
    callType,
    passed: false,
    durationMs: 0,
    attempts: 0,
    errorDetail: 'No harness stream attempts executed',
    errorCategory: 'internal',
  };
}

/** Execute a harness scenario snapshot through call-type dispatch. */
export async function executeGrpcHarnessSnapshot(
  snapshot: GrpcHarnessExecuteSnapshot,
  deps: ExecuteGrpcHarnessDeps,
): Promise<GrpcHarnessCallOutcome> {
  const callType = snapshot.execute.callType;

  if (callType === 'unary') {
    return executeGrpcHarnessUnary(snapshot, {
      invokeUnary: deps.operations.invokeUnary,
      abortSignal: deps.abortSignal,
    });
  }

  if (
    callType === 'server_streaming'
    || callType === 'client_streaming'
    || callType === 'bidi_streaming'
  ) {
    return executeGrpcHarnessStreamWithRetry(snapshot, deps);
  }

  throw new Error(`Unsupported harness gRPC callType: ${callType as string}`);
}

/** Build snapshot from scenario config, then execute. */
export async function executeGrpcHarnessScenario(
  scenario: Scenario,
  deps: ExecuteGrpcHarnessDeps,
): Promise<GrpcHarnessCallOutcome> {
  const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, deps.buildContext);
  return executeGrpcHarnessSnapshot(snapshot, deps);
}
