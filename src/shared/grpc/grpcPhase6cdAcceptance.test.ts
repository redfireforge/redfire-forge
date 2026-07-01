/**
 * Phase 6C+6D — acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';

describe('Phase 6C+6D acceptance checklist', () => {
  it('exports workflow executors and operations bridge', async () => {
    const retry = await import('../../features/workflow/utils/grpcWorkflowRetryPolicy');
    const unary = await import('../../features/workflow/utils/grpcWorkflowUnaryExecutor');
    const stream = await import('../../features/workflow/utils/grpcWorkflowStreamCollector');
    const ops = await import('./buildGrpcNodeOperations');
    const handlers = await import('../../features/workflow/engine/graphRunnerGrpcNodeHandlers');

    expect(typeof retry.resolveGrpcWorkflowRetryPolicy).toBe('function');
    expect(typeof unary.executeGrpcWorkflowUnary).toBe('function');
    expect(typeof stream.collectGrpcWorkflowServerStream).toBe('function');
    expect(typeof ops.buildGrpcNodeOperations).toBe('function');
    expect(typeof handlers.handleGrpcUnaryNode).toBe('function');
    expect(typeof handlers.handleGrpcServerStreamNode).toBe('function');
  });

  it('builds unary snapshot and executes through transport adapter boundary', async () => {
    const { buildGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { buildGrpcWorkflowRuntimeCallBoundary } = await import('../../features/workflow/utils/grpcWorkflowTransportAdapter');
    const { executeGrpcWorkflowUnary } = await import('../../features/workflow/utils/grpcWorkflowUnaryExecutor');

    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'accept-unary',
        requestId: 'req-accept-unary',
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'accept' },
          retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
        },
      },
      {
        resolveTemplate: (value: string) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const boundary = buildGrpcWorkflowRuntimeCallBoundary(snapshot);
    expect(boundary.unaryRequest?.requestId).toBe('req-accept-unary');

    let calls = 0;
    const outcome = await executeGrpcWorkflowUnary(snapshot, {
      invokeUnary: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            status: 14,
            statusMessage: 'UNAVAILABLE',
            headers: {},
            trailers: {},
            durationMs: 1,
          };
        }
        return {
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'accept' },
          durationMs: 2,
        };
      },
    });
    expect(calls).toBe(2);
    expect(outcome.stepResult.status).toBe('success');
  });

  it('documents transport immutability across retry attempts', async () => {
    const { buildGrpcWorkflowExecuteSnapshot, cloneGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { grpcWorkflowSnapshotToUnaryRequest } = await import('../../features/workflow/utils/grpcWorkflowTransportAdapter');

    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'accept-immutable',
        requestId: 'req-immutable',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'immutable' },
          retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
        },
      },
      {
        resolveTemplate: (value: string) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const frozen = cloneGrpcWorkflowExecuteSnapshot(snapshot);
    const first = grpcWorkflowSnapshotToUnaryRequest(frozen);
    const second = grpcWorkflowSnapshotToUnaryRequest(frozen);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
