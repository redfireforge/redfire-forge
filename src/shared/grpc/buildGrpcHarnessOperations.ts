/**
 * Phase 8C — production GrpcHarnessOperations bridge for harness runner.
 */
import type { GrpcCallRequest, GrpcStreamStartRequest } from './contracts';
import type { GrpcHarnessCollectConfig } from '../types/grpc-harness';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import type { GrpcUnaryInvokeResult } from '../../features/workflow/utils/grpcWorkflowUnaryExecutor';
import { buildGrpcNodeOperations } from './buildGrpcNodeOperations';
import {
  collectGrpcHarnessServerStream,
  executeGrpcHarnessBidiStream,
  executeGrpcHarnessClientStream,
} from './grpcHarnessStreamCollector';

export interface GrpcHarnessOperations {
  invokeUnary(request: GrpcCallRequest, tabId: string): Promise<GrpcUnaryInvokeResult>;
  collectHarnessServerStream(
    request: GrpcStreamStartRequest,
    tabId: string,
    collect: GrpcHarnessCollectConfig,
    options?: { abortSignal?: AbortSignal },
  ): Promise<GrpcHarnessCallOutcome>;
  executeClientStream(
    request: GrpcStreamStartRequest,
    tabId: string,
    sendMessages: Record<string, unknown>[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<GrpcHarnessCallOutcome>;
  executeBidiStream(
    request: GrpcStreamStartRequest,
    tabId: string,
    sendMessages: Record<string, unknown>[],
    collect: GrpcHarnessCollectConfig,
    options?: { abortSignal?: AbortSignal },
  ): Promise<GrpcHarnessCallOutcome>;
}

/** Production harness operations — reuses workflow transport facade + harness stream executors. */
export function buildGrpcHarnessOperations(): GrpcHarnessOperations {
  const nodeOps = buildGrpcNodeOperations();
  return {
    invokeUnary: (request, tabId) => nodeOps.invokeUnary(request, tabId),
    collectHarnessServerStream: (request, tabId, collect, options) =>
      collectGrpcHarnessServerStream(request, tabId, collect, options),
    executeClientStream: (request, tabId, sendMessages, options) =>
      executeGrpcHarnessClientStream(request, tabId, sendMessages, options),
    executeBidiStream: (request, tabId, sendMessages, collect, options) =>
      executeGrpcHarnessBidiStream(request, tabId, sendMessages, collect, options),
  };
}

export type { GrpcUnaryInvokeResult };
