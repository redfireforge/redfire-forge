/**
 * Phase 8B — acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

function grpcScenario(): Scenario {
  return _makeScenario({
    id: 'grpc-accept',
    name: 'Echo unary',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'accept' },
    },
  }) as Scenario;
}

describe('Phase 8B acceptance checklist', () => {
  it('exports harness snapshot contracts', async () => {
    const contracts = await import('../types/grpc-harness-snapshot');
    expect(typeof contracts).toBe('object');
  });

  it('exports snapshot builder, transport adapter, and attempt lifecycle', async () => {
    const builder = await import('./grpcHarnessSnapshotBuilder');
    expect(typeof builder.buildGrpcHarnessExecuteSnapshot).toBe('function');
    expect(typeof builder.cloneGrpcHarnessExecuteSnapshot).toBe('function');
    expect(typeof builder.grpcHarnessExecuteSnapshotTransportFingerprint).toBe('function');

    const adapter = await import('./grpcHarnessTransportAdapter');
    expect(typeof adapter.buildGrpcHarnessRuntimeCallBoundary).toBe('function');
    expect(typeof adapter.grpcHarnessSnapshotToUnaryRequest).toBe('function');
    expect(typeof adapter.grpcHarnessSnapshotToStreamStartRequest).toBe('function');

    const lifecycle = await import('./grpcHarnessAttemptLifecycle');
    expect(typeof lifecycle.createGrpcHarnessExecutionSession).toBe('function');
    expect(typeof lifecycle.startGrpcHarnessAttempt).toBe('function');
    expect(typeof lifecycle.completeGrpcHarnessAttempt).toBe('function');
    expect(typeof lifecycle.shouldRetryGrpcHarnessAttempt).toBe('function');
  });

  it('builds deterministic unary snapshot + transport boundary', async () => {
    const { buildGrpcHarnessExecuteSnapshot, grpcHarnessExecuteSnapshotTransportFingerprint } =
      await import('./grpcHarnessSnapshotBuilder');
    const { buildGrpcHarnessRuntimeCallBoundary, grpcHarnessTransportRequestFingerprint } =
      await import('./grpcHarnessTransportAdapter');

    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: grpcScenario(),
        requestId: 'req-accept',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    expect(snapshot.execute.callType).toBe('unary');
    expect(snapshot.execute.tabId).toBe('harness:grpc-accept');

    const boundary = buildGrpcHarnessRuntimeCallBoundary(snapshot);
    expect(boundary.unaryRequest?.requestId).toBe('req-accept');
    expect(grpcHarnessTransportRequestFingerprint(boundary)).toContain('"message":"accept"');
    expect(grpcHarnessExecuteSnapshotTransportFingerprint(snapshot)).toContain('"message":"accept"');
  });

  it('builds transport boundaries for all four harness call types', async () => {
    const { buildGrpcHarnessExecuteSnapshot } = await import('./grpcHarnessSnapshotBuilder');
    const { buildGrpcHarnessRuntimeCallBoundary } = await import('./grpcHarnessTransportAdapter');
    const context = {
      resolveTemplate: (value: string) => value,
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
    };

    const unary = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: grpcScenario(),
        requestId: 'req-u',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      context,
    );
    expect(buildGrpcHarnessRuntimeCallBoundary(unary).unaryRequest).toBeDefined();

    const streamTypes = [
      {
        callType: 'server_streaming' as const,
        method: 'ServerStream',
        body: { message: 'hi' },
        collect: { maxMessages: 2 },
      },
      {
        callType: 'client_streaming' as const,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
      },
      {
        callType: 'bidi_streaming' as const,
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
        collect: { maxMessages: 2 },
      },
    ];

    for (const stream of streamTypes) {
      const scenario = _makeScenario({
        id: `grpc-${stream.callType}`,
        name: stream.callType,
        url: '',
        method: 'GRPC',
        actionType: 'grpcCall',
        grpcCallAction: {
          callType: stream.callType,
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: stream.method,
          body: stream.body,
          sendMessages: stream.sendMessages,
          collect: stream.collect,
        },
      }) as Scenario;
      const snapshot = buildGrpcHarnessExecuteSnapshot(
        { scenario, requestId: `req-${stream.callType}`, capturedAt: '2026-06-29T00:00:00.000Z' },
        context,
      );
      expect(buildGrpcHarnessRuntimeCallBoundary(snapshot).streamStartRequest?.callType)
        .toBe(stream.callType);
    }
  });
});
