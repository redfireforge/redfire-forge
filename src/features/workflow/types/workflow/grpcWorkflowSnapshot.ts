/**
 * Phase 6B — workflow gRPC execution snapshot + runtime boundary contracts.
 */
import type {
  GrpcCallRequest,
  GrpcStreamStartRequest,
  GrpcTabExecuteSnapshot,
} from '@shared/grpc/contracts';
import type {
  GrpcServerStreamCollectConfig,
  GrpcWorkflowOnErrorPolicy,
  GrpcWorkflowRetryPolicy,
} from './node-grpc';

/** Immutable snapshot captured once at workflow step attempt start. */
export interface GrpcWorkflowExecuteSnapshot {
  nodeId: string;
  label: string;
  saveAs?: string;
  /** Transport-ready payload — same shape as Studio tab execute snapshot. */
  execute: GrpcTabExecuteSnapshot;
  retry?: GrpcWorkflowRetryPolicy;
  onError: GrpcWorkflowOnErrorPolicy;
  /** Server-stream only — `untilExpression` already interpolated. */
  collect?: GrpcServerStreamCollectConfig;
}

/** Runtime boundary passed from workflow engine to gRPC transport handlers (6C/6D). */
export interface GrpcWorkflowRuntimeCallBoundary {
  snapshot: GrpcWorkflowExecuteSnapshot;
  unaryRequest?: GrpcCallRequest;
  streamStartRequest?: GrpcStreamStartRequest;
}
