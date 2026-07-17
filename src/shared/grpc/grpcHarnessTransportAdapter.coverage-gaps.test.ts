/**
 * Coverage gaps — grpcHarnessTransportAdapter.ts (workflow 6B parity).
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
import { buildGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';
import {
  buildGrpcHarnessRuntimeCallBoundary,
  grpcHarnessSnapshotToStreamStartRequest,
  grpcHarnessSnapshotToUnaryRequest,
  grpcHarnessTransportRequestFingerprint,
} from './grpcHarnessTransportAdapter';
import type { GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };
const CONTEXT = { resolveTemplate: (v: string) => v, profiles: [], pageDefaults: PAGE_DEFAULTS };

function makeUnarySnapshot() {
  return buildGrpcHarnessExecuteSnapshot(
    {
      scenario: _makeScenario({
        id: 'grpc-u',
        name: 'Unary',
        url: '',
        method: 'GRPC',
        actionType: 'grpcCall',
        grpcCallAction: {
          callType: 'unary',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: {},
        },
      }) as Scenario,
      requestId: 'req-u',
      capturedAt: '2026-06-29T00:00:00.000Z',
    },
    CONTEXT,
  );
}

function makeStreamSnapshot() {
  return buildGrpcHarnessExecuteSnapshot(
    {
      scenario: _makeScenario({
        id: 'grpc-s',
        name: 'Stream',
        url: '',
        method: 'GRPC',
        actionType: 'grpcCall',
        grpcCallAction: {
          callType: 'server_streaming',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: 'ServerStream',
          body: {},
          collect: { maxMessages: 1 },
        },
      }) as Scenario,
      requestId: 'req-s',
      capturedAt: '2026-06-29T00:00:00.000Z',
    },
    CONTEXT,
  );
}

describe('grpcHarnessTransportAdapter coverage gaps', () => {
  it('grpcHarnessSnapshotToUnaryRequest rejects non-unary snapshots', () => {
    expect(() => grpcHarnessSnapshotToUnaryRequest(makeStreamSnapshot())).toThrow(/requires a unary snapshot/);
  });

  it('grpcHarnessSnapshotToStreamStartRequest rejects unary snapshots', () => {
    expect(() => grpcHarnessSnapshotToStreamStartRequest(makeUnarySnapshot())).toThrow(/requires a streaming snapshot/);
  });

  it('buildGrpcHarnessRuntimeCallBoundary rejects unsupported call types', () => {
    const snapshot = makeUnarySnapshot();
    const unsupported = {
      ...snapshot,
      execute: { ...snapshot.execute, callType: 'invalid_type' },
    } as GrpcHarnessExecuteSnapshot;
    expect(() => buildGrpcHarnessRuntimeCallBoundary(unsupported)).toThrow(/Unsupported harness gRPC callType/);
  });

  it('grpcHarnessTransportRequestFingerprint returns empty string when no request is present', () => {
    const snapshot = makeUnarySnapshot();
    expect(grpcHarnessTransportRequestFingerprint({ snapshot })).toBe('');
  });

  it('grpcHarnessTransportRequestFingerprint serializes stream start requests', () => {
    const boundary = buildGrpcHarnessRuntimeCallBoundary(makeStreamSnapshot());
    expect(grpcHarnessTransportRequestFingerprint(boundary)).toBe(
      JSON.stringify(boundary.streamStartRequest),
    );
  });

  it('buildGrpcHarnessRuntimeCallBoundary attaches sendMessages on harness snapshot for client streaming', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: _makeScenario({
          id: 'grpc-cs',
          name: 'Client stream',
          url: '',
          method: 'GRPC',
          actionType: 'grpcCall',
          grpcCallAction: {
            callType: 'client_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'ClientStream',
            sendMessages: [{ message: 'frame' }],
          },
        }) as Scenario,
        requestId: 'req-cs',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      CONTEXT,
    );
    const boundary = buildGrpcHarnessRuntimeCallBoundary(snapshot);
    expect(boundary.streamStartRequest?.callType).toBe('client_streaming');
    expect(boundary.snapshot.sendMessages).toEqual([{ message: 'frame' }]);
  });
});
