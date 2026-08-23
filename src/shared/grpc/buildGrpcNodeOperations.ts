/**
 * Phase 6C/6D/11N — production GrpcNodeOperations bridge for workflow runner.
 */
import type { GrpcCallRequest, GrpcStreamStartRequest } from './contracts';
import { invokeGrpcUnary, retainGrpcNativeTransport, selectGrpcTransport } from './grpcTransportFacade';
import { isTauri } from '../utils/platform';
import type { GrpcNodeOperations } from '@workflow/engine/graphRunnerNodeHandlerContext';
import type { GrpcServerStreamCollectConfig } from '@workflow/types/workflow/node-grpc';
import { collectGrpcWorkflowServerStream } from '@workflow/utils/grpcWorkflowStreamCollector';
import type { GrpcUnaryInvokeResult } from '@workflow/utils/grpcWorkflowUnaryExecutor';
import { resolveGrpcWorkflowDescriptorByKey } from './grpcWorkflowDescriptorResolver';
import { getGrpcLoadTestProfileById } from '@grpc/data/grpcLoadTestProfileRepository';

let workflowNativeTransportRetained = false;

export function resetBuildGrpcNodeOperationsForTests(): void {
  workflowNativeTransportRetained = false;
}

function ensureWorkflowNativeTransport(): void {
  if (workflowNativeTransportRetained || !isTauri() || selectGrpcTransport() !== 'tauri') {
    return;
  }
  retainGrpcNativeTransport();
  workflowNativeTransportRetained = true;
}

export function buildGrpcNodeOperations(): GrpcNodeOperations {
  ensureWorkflowNativeTransport();
  return {
    async invokeUnary(request: GrpcCallRequest, tabId: string): Promise<GrpcUnaryInvokeResult> {
      const envelope = await invokeGrpcUnary({ request, tabId });
      const result = envelope.data;
      return {
        status: result.status,
        statusMessage: result.statusMessage,
        headers: result.headers,
        trailers: result.trailers,
        body: result.body,
        durationMs: result.durationMs,
        errorDetail: result.errorDetail,
      };
    },
    collectServerStream(
      request: GrpcStreamStartRequest,
      tabId: string,
      collect: GrpcServerStreamCollectConfig,
      options?: { abortSignal?: AbortSignal },
    ) {
      return collectGrpcWorkflowServerStream(request, tabId, collect, {
        abortSignal: options?.abortSignal,
      });
    },
    resolveDescriptor: resolveGrpcWorkflowDescriptorByKey,
    resolveLoadTestProfile: async (profileId) => {
      const profile = await getGrpcLoadTestProfileById(profileId);
      if (!profile) {
        throw new Error(`Load test profile not found: ${profileId}`);
      }
      return profile.config;
    },
  };
}
