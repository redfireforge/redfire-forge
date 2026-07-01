/**
 * Phase 8B — harness transport adapter tests.
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

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

function makeGrpcScenario(callType: 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming'): Scenario {
  const base = {
    callType,
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'Echo',
  };
  if (callType === 'unary') {
    return _makeScenario({
      id: `grpc-${callType}`,
      name: callType,
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: { ...base, body: { message: 'hi' } },
    }) as Scenario;
  }
  if (callType === 'server_streaming') {
    return _makeScenario({
      id: `grpc-${callType}`,
      name: callType,
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        ...base,
        body: { message: 'hi' },
        collect: { maxMessages: 2 },
      },
    }) as Scenario;
  }
  return _makeScenario({
    id: `grpc-${callType}`,
    name: callType,
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      ...base,
      sendMessages: [{ message: 'one' }],
      collect: callType === 'bidi_streaming' ? { maxMessages: 2 } : undefined,
    },
  }) as Scenario;
}

const CONTEXT = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: PAGE_DEFAULTS,
};

describe('grpcHarnessTransportAdapter (Phase 8B)', () => {
  it('maps unary snapshot to GrpcCallRequest', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      { scenario: makeGrpcScenario('unary'), requestId: 'req-u', capturedAt: '2026-06-29T00:00:00.000Z' },
      CONTEXT,
    );
    const request = grpcHarnessSnapshotToUnaryRequest(snapshot);
    expect(request.callType).toBe('unary');
    expect(request.requestId).toBe('req-u');
    expect(request.body).toEqual({ message: 'hi' });
  });

  it('maps streaming snapshots to GrpcStreamStartRequest for all streaming call types', () => {
    for (const callType of ['server_streaming', 'client_streaming', 'bidi_streaming'] as const) {
      const snapshot = buildGrpcHarnessExecuteSnapshot(
        {
          scenario: makeGrpcScenario(callType),
          requestId: `req-${callType}`,
          capturedAt: '2026-06-29T00:00:00.000Z',
        },
        CONTEXT,
      );
      const request = grpcHarnessSnapshotToStreamStartRequest(snapshot);
      expect(request.callType).toBe(callType);
    }
  });

  it('buildGrpcHarnessRuntimeCallBoundary selects correct transport payload', () => {
    const unary = buildGrpcHarnessExecuteSnapshot(
      { scenario: makeGrpcScenario('unary'), requestId: 'req-1', capturedAt: '2026-06-29T00:00:00.000Z' },
      CONTEXT,
    );
    const unaryBoundary = buildGrpcHarnessRuntimeCallBoundary(unary);
    expect(unaryBoundary.unaryRequest).toBeDefined();
    expect(unaryBoundary.streamStartRequest).toBeUndefined();
    expect(grpcHarnessTransportRequestFingerprint(unaryBoundary)).toContain('"callType":"unary"');

    const stream = buildGrpcHarnessExecuteSnapshot(
      { scenario: makeGrpcScenario('server_streaming'), requestId: 'req-2', capturedAt: '2026-06-29T00:00:00.000Z' },
      CONTEXT,
    );
    const streamBoundary = buildGrpcHarnessRuntimeCallBoundary(stream);
    expect(streamBoundary.streamStartRequest).toBeDefined();
    expect(streamBoundary.unaryRequest).toBeUndefined();
  });

  it('rejects unary adapter on streaming snapshot', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      { scenario: makeGrpcScenario('server_streaming'), requestId: 'req-x', capturedAt: '2026-06-29T00:00:00.000Z' },
      CONTEXT,
    );
    expect(() => grpcHarnessSnapshotToUnaryRequest(snapshot)).toThrow('unary snapshot');
  });
});
