/**
 * Phase 6B — workflow snapshot → gRPC transport request adapter.
 */
import type { GrpcCallRequest, GrpcStreamStartRequest } from '@shared/grpc/contracts';
import {
  snapshotToStreamStartRequest,
  snapshotToUnaryCallRequest,
} from '@grpc/grpcStudioTypes';
import type {
  GrpcWorkflowExecuteSnapshot,
  GrpcWorkflowRuntimeCallBoundary,
} from '../types/workflow/grpcWorkflowSnapshot';

export function grpcWorkflowSnapshotToUnaryRequest(
  snapshot: GrpcWorkflowExecuteSnapshot,
): GrpcCallRequest {
  if (snapshot.execute.callType !== 'unary') {
    throw new Error('grpcWorkflowSnapshotToUnaryRequest requires a unary snapshot');
  }
  return snapshotToUnaryCallRequest(snapshot.execute);
}

export function grpcWorkflowSnapshotToStreamStartRequest(
  snapshot: GrpcWorkflowExecuteSnapshot,
): GrpcStreamStartRequest {
  if (snapshot.execute.callType !== 'server_streaming') {
    throw new Error('grpcWorkflowSnapshotToStreamStartRequest requires a server_streaming snapshot');
  }
  return snapshotToStreamStartRequest(snapshot.execute);
}

/** Build the runtime boundary object consumed by workflow gRPC handlers (6C/6D). */
export function buildGrpcWorkflowRuntimeCallBoundary(
  snapshot: GrpcWorkflowExecuteSnapshot,
): GrpcWorkflowRuntimeCallBoundary {
  if (snapshot.execute.callType === 'unary') {
    return {
      snapshot,
      unaryRequest: grpcWorkflowSnapshotToUnaryRequest(snapshot),
    };
  }
  if (snapshot.execute.callType === 'server_streaming') {
    return {
      snapshot,
      streamStartRequest: grpcWorkflowSnapshotToStreamStartRequest(snapshot),
    };
  }
  throw new Error(`Unsupported workflow gRPC callType: ${snapshot.execute.callType as string}`);
}

/** Deterministic outbound payload fingerprint for transport adapter tests. */
export function grpcWorkflowTransportRequestFingerprint(
  boundary: GrpcWorkflowRuntimeCallBoundary,
): string {
  if (boundary.unaryRequest) {
    return JSON.stringify(boundary.unaryRequest);
  }
  if (boundary.streamStartRequest) {
    return JSON.stringify(boundary.streamStartRequest);
  }
  return '';
}
