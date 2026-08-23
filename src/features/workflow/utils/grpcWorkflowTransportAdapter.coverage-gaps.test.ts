/**
 * Coverage gaps — grpcWorkflowTransportAdapter.ts
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import { buildGrpcWorkflowExecuteSnapshot } from './grpcWorkflowSnapshotBuilder';
import {
  buildGrpcWorkflowRuntimeCallBoundary,
  grpcWorkflowSnapshotToStreamStartRequest,
  grpcWorkflowSnapshotToUnaryRequest,
  grpcWorkflowTransportRequestFingerprint,
} from './grpcWorkflowTransportAdapter';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };
const CONTEXT = { resolveTemplate: (v: string) => v, profiles: [], pageDefaults: PAGE_DEFAULTS };

function makeUnarySnapshot() {
  return buildGrpcWorkflowExecuteSnapshot(
    {
      nodeId: 'u1',
      requestId: 'req-u',
      capturedAt: '2026-06-29T00:00:00.000Z',
      data: {
        label: 'Unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary',
        body: {},
      },
    },
    CONTEXT,
  );
}

function makeStreamSnapshot() {
  return buildGrpcWorkflowExecuteSnapshot(
    {
      nodeId: 's1',
      requestId: 'req-s',
      capturedAt: '2026-06-29T00:00:00.000Z',
      data: {
        label: 'Stream',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        callType: 'server_streaming',
        body: {},
        collect: { maxMessages: 1 },
      },
    },
    CONTEXT,
  );
}

describe('grpcWorkflowTransportAdapter coverage gaps', () => {
  it('grpcWorkflowSnapshotToUnaryRequest rejects non-unary snapshots', () => {
    expect(() => grpcWorkflowSnapshotToUnaryRequest(makeStreamSnapshot())).toThrow(/requires a unary snapshot/);
  });

  it('grpcWorkflowSnapshotToStreamStartRequest rejects non-server_streaming snapshots', () => {
    expect(() => grpcWorkflowSnapshotToStreamStartRequest(makeUnarySnapshot())).toThrow(/requires a server_streaming snapshot/);
  });

  it('buildGrpcWorkflowRuntimeCallBoundary rejects unsupported call types', () => {
    const snapshot = makeUnarySnapshot();
    const unsupported = {
      ...snapshot,
      execute: { ...snapshot.execute, callType: 'client_streaming' },
    } as GrpcWorkflowExecuteSnapshot;
    expect(() => buildGrpcWorkflowRuntimeCallBoundary(unsupported)).toThrow(/Unsupported workflow gRPC callType/);
  });

  it('grpcWorkflowTransportRequestFingerprint returns empty string when no request is present', () => {
    const snapshot = makeUnarySnapshot();
    expect(grpcWorkflowTransportRequestFingerprint({ snapshot })).toBe('');
  });

  it('grpcWorkflowTransportRequestFingerprint serializes stream start requests', () => {
    const boundary = buildGrpcWorkflowRuntimeCallBoundary(makeStreamSnapshot());
    expect(grpcWorkflowTransportRequestFingerprint(boundary)).toBe(
      JSON.stringify(boundary.streamStartRequest),
    );
  });
});
