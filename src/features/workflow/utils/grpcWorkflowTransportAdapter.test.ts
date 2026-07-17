/**
 * Phase 6B — gRPC workflow transport adapter tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import {
  buildGrpcWorkflowExecuteSnapshot,
  grpcWorkflowExecuteSnapshotTransportFingerprint,
} from './grpcWorkflowSnapshotBuilder';
import {
  buildGrpcWorkflowRuntimeCallBoundary,
  grpcWorkflowSnapshotToStreamStartRequest,
  grpcWorkflowSnapshotToUnaryRequest,
  grpcWorkflowTransportRequestFingerprint,
} from './grpcWorkflowTransportAdapter';
import { snapshotToStreamStartRequest, snapshotToUnaryCallRequest } from '../../grpc/grpcStudioTypes';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

describe('grpcWorkflowTransportAdapter (Phase 6B)', () => {
  it('maps unary snapshot to GrpcCallRequest', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-1',
        requestId: 'req-1',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'hello' },
        },
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    const request = grpcWorkflowSnapshotToUnaryRequest(snapshot);
    expect(request.callType).toBe('unary');
    expect(request.requestId).toBe('req-1');
    expect(request.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(request.method).toBe(FIXTURE_UNARY_CALL_REQUEST.method);
    expect(request.body).toEqual({ message: 'hello' });
  });

  it('buildGrpcWorkflowRuntimeCallBoundary selects unary vs stream adapter', () => {
    const unary = buildGrpcWorkflowExecuteSnapshot(
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
      { resolveTemplate: (v) => v, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );
    const unaryBoundary = buildGrpcWorkflowRuntimeCallBoundary(unary);
    expect(unaryBoundary.unaryRequest).toBeDefined();
    expect(unaryBoundary.streamStartRequest).toBeUndefined();

    const stream = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 's1',
        requestId: 'req-s',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: {
          label: 'Stream',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: 'ServerStreamEcho',
          callType: 'server_streaming',
          body: {},
          collect: { maxMessages: 3 },
        },
      },
      { resolveTemplate: (v) => v, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );
    const streamBoundary = buildGrpcWorkflowRuntimeCallBoundary(stream);
    expect(streamBoundary.streamStartRequest).toBeDefined();
    expect(grpcWorkflowSnapshotToStreamStartRequest(stream).callType).toBe('server_streaming');
  });

  it('produces stable transport fingerprints across rebuilds', () => {
    const input = {
      nodeId: 'grpc-7',
      requestId: 'req-7',
      capturedAt: '2026-06-29T00:00:00.000Z',
      data: {
        label: 'Echo',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary' as const,
        body: { message: 'stable' },
      },
    };
    const context = { resolveTemplate: (v: string) => v, profiles: [], pageDefaults: PAGE_DEFAULTS };
    const boundaryA = buildGrpcWorkflowRuntimeCallBoundary(buildGrpcWorkflowExecuteSnapshot(input, context));
    const boundaryB = buildGrpcWorkflowRuntimeCallBoundary(buildGrpcWorkflowExecuteSnapshot(input, context));
    expect(grpcWorkflowTransportRequestFingerprint(boundaryA)).toBe(
      grpcWorkflowTransportRequestFingerprint(boundaryB),
    );
    expect(grpcWorkflowExecuteSnapshotTransportFingerprint(boundaryA.snapshot)).toBe(
      grpcWorkflowExecuteSnapshotTransportFingerprint(boundaryB.snapshot),
    );
  });

  it('isolates transport requests from later snapshot mutation', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-immutable',
        requestId: 'req-immutable',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'frozen' },
        },
      },
      { resolveTemplate: (v) => v, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );
    const boundary = buildGrpcWorkflowRuntimeCallBoundary(snapshot);
    const unaryFingerprint = grpcWorkflowTransportRequestFingerprint(boundary);

    snapshot.execute.body.message = 'mutated';
    expect(grpcWorkflowTransportRequestFingerprint(boundary)).toBe(unaryFingerprint);
    expect(boundary.unaryRequest?.body).toEqual({ message: 'frozen' });
    expect(snapshotToUnaryCallRequest(snapshot.execute).body).toEqual({ message: 'mutated' });
  });

  it('stream transport request matches snapshotToStreamStartRequest', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'stream-immutable',
        requestId: 'req-stream-immutable',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: {
          label: 'Stream',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: 'ServerStreamEcho',
          callType: 'server_streaming',
          body: { message: 'stream' },
          collect: { maxMessages: 2 },
        },
      },
      { resolveTemplate: (v) => v, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );
    expect(grpcWorkflowSnapshotToStreamStartRequest(snapshot)).toEqual(
      snapshotToStreamStartRequest(snapshot.execute),
    );
  });
});
