/**
 * Phase 11O — server-streaming load-test scheduler.
 *
 * Reuses the Phase 11B bounded scheduler with stream collection per attempt.
 * Express proxy transport first (via grpcWorkflowStreamCollector / grpcStreamClient).
 */
import type { GrpcStreamStartRequest } from './contracts';
import {
  GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS,
  captureGrpcLoadTestStreamExecuteSnapshot,
  type GrpcLoadTestConfig,
  type GrpcLoadTestExecuteSnapshot,
} from './grpcAdvancedFeatureContracts';
import {
  startGrpcLoadTestSchedulerRun,
  type GrpcLoadTestAttemptContext,
  type GrpcLoadTestAttemptOutcome,
  type GrpcLoadTestSchedulerParams,
  type GrpcLoadTestSchedulerRun,
} from './grpcLoadTestSchedulerCore';
import type { GrpcServerStreamCollectConfig } from '../../features/workflow/types/workflow/node-grpc';
import type { GrpcWorkflowStreamCollectionResult } from '../../features/workflow/utils/grpcWorkflowStreamCollector';

export type GrpcLoadTestStreamCollectFn = (
  request: GrpcStreamStartRequest,
  tabId: string,
  collect: GrpcServerStreamCollectConfig,
  options?: { abortSignal?: AbortSignal },
) => Promise<GrpcWorkflowStreamCollectionResult>;

export interface GrpcLoadTestStreamSchedulerParams
  extends Omit<GrpcLoadTestSchedulerParams, 'executeAttempt' | 'allowedCallTypes'> {
  collectServerStream: GrpcLoadTestStreamCollectFn;
  buildStreamStartRequest: (
    executeSnapshot: GrpcLoadTestExecuteSnapshot['executeSnapshot'],
    attemptNumber: number,
  ) => GrpcStreamStartRequest;
}

export function resolveGrpcLoadTestStreamCollectConfig(
  config: GrpcLoadTestConfig,
): GrpcServerStreamCollectConfig {
  return {
    maxMessages: config.maxMessagesPerStream
      ?? GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.defaultMaxMessagesPerStream,
  };
}

function isSuccessfulStreamAttempt(result: GrpcWorkflowStreamCollectionResult): boolean {
  if (result.grpcStatus !== 0) {
    return false;
  }
  return result.stopReason === 'stream_end'
    || result.stopReason === 'max_messages'
    || result.stopReason === 'max_duration'
    || result.stopReason === 'until_expression';
}

function streamAttemptErrorMessage(result: GrpcWorkflowStreamCollectionResult): string | undefined {
  if (isSuccessfulStreamAttempt(result)) {
    return undefined;
  }
  if (result.errorDetail) {
    return result.errorDetail;
  }
  if (result.grpcStatus !== 0) {
    return result.grpcStatusMessage || `gRPC status ${result.grpcStatus}`;
  }
  return `Stream stopped: ${result.stopReason}`;
}

export function createGrpcLoadTestStreamExecuteAttempt(input: {
  collectServerStream: GrpcLoadTestStreamCollectFn;
  buildStreamStartRequest: GrpcLoadTestStreamSchedulerParams['buildStreamStartRequest'];
  collectConfig: GrpcServerStreamCollectConfig;
}): (ctx: GrpcLoadTestAttemptContext) => Promise<GrpcLoadTestAttemptOutcome> {
  return async (ctx) => {
    const started = Date.now();
    try {
      const request = input.buildStreamStartRequest(ctx.executeSnapshot, ctx.attemptNumber);
      const result = await input.collectServerStream(
        request,
        ctx.executeSnapshot.tabId,
        input.collectConfig,
        { abortSignal: ctx.signal },
      );
      const ok = isSuccessfulStreamAttempt(result);
      return {
        ok,
        durationMs: result.durationMs ?? Math.max(0, Date.now() - started),
        statusCode: result.grpcStatus,
        errorMessage: streamAttemptErrorMessage(result),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          ok: false,
          durationMs: Math.max(0, Date.now() - started),
          errorMessage: 'Cancelled',
        };
      }
      return {
        ok: false,
        durationMs: Math.max(0, Date.now() - started),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

export function startGrpcLoadTestStreamSchedulerRun(
  params: GrpcLoadTestStreamSchedulerParams,
): GrpcLoadTestSchedulerRun {
  const collectConfig = resolveGrpcLoadTestStreamCollectConfig(params.snapshot.config);
  return startGrpcLoadTestSchedulerRun({
    ...params,
    allowedCallTypes: ['server_streaming'],
    executeAttempt: createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: params.collectServerStream,
      buildStreamStartRequest: params.buildStreamStartRequest,
      collectConfig,
    }),
  });
}

export function captureAndStartGrpcLoadTestStreamSchedulerRun(input: {
  runId: string;
  executeSnapshot: GrpcLoadTestExecuteSnapshot['executeSnapshot'];
  config: GrpcLoadTestConfig;
  resolvedEnvName?: string;
  collectServerStream: GrpcLoadTestStreamCollectFn;
  buildStreamStartRequest: GrpcLoadTestStreamSchedulerParams['buildStreamStartRequest'];
  signal?: AbortSignal;
}): GrpcLoadTestSchedulerRun {
  const snapshot = captureGrpcLoadTestStreamExecuteSnapshot({
    runId: input.runId,
    executeSnapshot: input.executeSnapshot,
    config: input.config,
    resolvedEnvName: input.resolvedEnvName,
  });
  return startGrpcLoadTestStreamSchedulerRun({
    snapshot,
    collectServerStream: input.collectServerStream,
    buildStreamStartRequest: input.buildStreamStartRequest,
    signal: input.signal,
  });
}
