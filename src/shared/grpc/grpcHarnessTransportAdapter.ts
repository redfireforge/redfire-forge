/**
 * Phase 8B — harness snapshot → gRPC transport request adapter.
 */
import type { GrpcCallRequest, GrpcStreamStartRequest } from './contracts';
import {
  snapshotToStreamStartRequest,
  snapshotToUnaryCallRequest,
} from '../../features/grpc/grpcStudioTypes';
import type {
  GrpcHarnessExecuteSnapshot,
  GrpcHarnessRuntimeCallBoundary,
} from '../types/grpc-harness-snapshot';

export function grpcHarnessSnapshotToUnaryRequest(
  snapshot: GrpcHarnessExecuteSnapshot,
): GrpcCallRequest {
  if (snapshot.execute.callType !== 'unary') {
    throw new Error('grpcHarnessSnapshotToUnaryRequest requires a unary snapshot');
  }
  return snapshotToUnaryCallRequest(snapshot.execute);
}

export function grpcHarnessSnapshotToStreamStartRequest(
  snapshot: GrpcHarnessExecuteSnapshot,
): GrpcStreamStartRequest {
  if (
    snapshot.execute.callType !== 'server_streaming'
    && snapshot.execute.callType !== 'client_streaming'
    && snapshot.execute.callType !== 'bidi_streaming'
  ) {
    throw new Error('grpcHarnessSnapshotToStreamStartRequest requires a streaming snapshot');
  }
  return snapshotToStreamStartRequest(snapshot.execute);
}

/** Build the runtime boundary object consumed by harness gRPC handlers (8C). */
export function buildGrpcHarnessRuntimeCallBoundary(
  snapshot: GrpcHarnessExecuteSnapshot,
): GrpcHarnessRuntimeCallBoundary {
  if (snapshot.execute.callType === 'unary') {
    return {
      snapshot,
      unaryRequest: grpcHarnessSnapshotToUnaryRequest(snapshot),
    };
  }
  if (
    snapshot.execute.callType === 'server_streaming'
    || snapshot.execute.callType === 'client_streaming'
    || snapshot.execute.callType === 'bidi_streaming'
  ) {
    return {
      snapshot,
      streamStartRequest: grpcHarnessSnapshotToStreamStartRequest(snapshot),
    };
  }
  throw new Error(`Unsupported harness gRPC callType: ${snapshot.execute.callType as string}`);
}

/** Deterministic outbound payload fingerprint for transport adapter tests. */
export function grpcHarnessTransportRequestFingerprint(
  boundary: GrpcHarnessRuntimeCallBoundary,
): string {
  if (boundary.unaryRequest) {
    return JSON.stringify(boundary.unaryRequest);
  }
  if (boundary.streamStartRequest) {
    return JSON.stringify(boundary.streamStartRequest);
  }
  return '';
}
