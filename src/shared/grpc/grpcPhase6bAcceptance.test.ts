/**
 * Phase 6B — acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';

describe('Phase 6B acceptance checklist', () => {
  it('exports workflow snapshot contracts', async () => {
    const contracts = await import('../../features/workflow/types/workflow/grpcWorkflowSnapshot');
    expect(typeof contracts).toBe('object');
  });

  it('exports snapshot builder and transport adapter', async () => {
    const builder = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    expect(typeof builder.buildGrpcWorkflowExecuteSnapshot).toBe('function');
    expect(typeof builder.cloneGrpcWorkflowExecuteSnapshot).toBe('function');
    expect(typeof builder.grpcWorkflowExecuteSnapshotTransportFingerprint).toBe('function');

    const adapter = await import('../../features/workflow/utils/grpcWorkflowTransportAdapter');
    expect(typeof adapter.buildGrpcWorkflowRuntimeCallBoundary).toBe('function');
    expect(typeof adapter.grpcWorkflowSnapshotToUnaryRequest).toBe('function');
    expect(typeof adapter.grpcWorkflowSnapshotToStreamStartRequest).toBe('function');
  });

  it('builds deterministic unary snapshot + transport boundary', async () => {
    const { buildGrpcWorkflowExecuteSnapshot, grpcWorkflowExecuteSnapshotTransportFingerprint } =
      await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { buildGrpcWorkflowRuntimeCallBoundary, grpcWorkflowTransportRequestFingerprint } =
      await import('../../features/workflow/utils/grpcWorkflowTransportAdapter');

    const input = {
      nodeId: 'grpc-accept',
      requestId: 'req-accept',
      capturedAt: '2026-06-29T00:00:00.000Z',
      data: {
        label: 'Echo',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary' as const,
        body: { message: 'accept' },
      },
    };
    const context = {
      resolveTemplate: (value: string) => value,
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
    };

    const snapshot = buildGrpcWorkflowExecuteSnapshot(input, context);
    expect(snapshot.execute.callType).toBe('unary');
    expect(snapshot.execute.tabId).toBe('workflow:grpc-accept');

    const boundary = buildGrpcWorkflowRuntimeCallBoundary(snapshot);
    expect(boundary.unaryRequest?.requestId).toBe('req-accept');
    expect(grpcWorkflowTransportRequestFingerprint(boundary)).toContain('"message":"accept"');
    expect(grpcWorkflowExecuteSnapshotTransportFingerprint(snapshot)).toContain('"message":"accept"');
  });
});
