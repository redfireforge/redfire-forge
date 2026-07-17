/**
 * Phase 6C/6D/6F — gRPC workflow step output publication.
 */
import type { VariableContext } from '../engine/variableContext';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';
import { GrpcWorkflowOutputRegistry } from './grpcWorkflowOutputRegistry';
import { GrpcWorkflowStepResultStore } from './grpcWorkflowStepResultStore';

export interface GrpcWorkflowPublishOptions {
  outputRegistry?: GrpcWorkflowOutputRegistry;
  stepStore?: GrpcWorkflowStepResultStore;
}

/** Commit step result to store and publish variables on success. */
export function publishGrpcWorkflowStepOutput(
  ctx: VariableContext,
  snapshot: GrpcWorkflowExecuteSnapshot,
  result: GrpcWorkflowStepResult,
  options?: GrpcWorkflowPublishOptions,
): void {
  options?.stepStore?.commit(snapshot.nodeId, snapshot.saveAs, result);

  if (result.status !== 'success') return;

  const registry = options?.outputRegistry;
  if (!registry) {
    throw new Error('GrpcWorkflowOutputRegistry is required to publish successful gRPC call outputs');
  }
  registry.publishCallNodeOutput(ctx, snapshot, result);
}
