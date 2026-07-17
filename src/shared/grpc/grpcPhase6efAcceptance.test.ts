/**
 * Phase 6E+6F — acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';

describe('Phase 6E+6F acceptance checklist', () => {
  it('exports assert engine, step store, and output registry', async () => {
    const assertEngine = await import('../../features/workflow/utils/grpcWorkflowAssertEngine');
    const assertPath = await import('../../features/workflow/utils/grpcWorkflowAssertPath');
    const store = await import('../../features/workflow/utils/grpcWorkflowStepResultStore');
    const registry = await import('../../features/workflow/utils/grpcWorkflowOutputRegistry');
    const handlers = await import('../../features/workflow/engine/graphRunnerGrpcNodeHandlers');

    expect(typeof assertEngine.evaluateGrpcWorkflowAssertions).toBe('function');
    expect(typeof assertPath.resolveGrpcAssertFieldValue).toBe('function');
    expect(typeof store.GrpcWorkflowStepResultStore).toBe('function');
    expect(typeof registry.GrpcWorkflowOutputRegistry).toBe('function');
    expect(typeof handlers.handleGrpcAssertNode).toBe('function');
  });

  it('evaluates assertions from frozen step results without transport', async () => {
    const { GrpcWorkflowStepResultStore } = await import('../../features/workflow/utils/grpcWorkflowStepResultStore');
    const { evaluateGrpcWorkflowAssertions } = await import('../../features/workflow/utils/grpcWorkflowAssertEngine');
    const { buildGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { publishGrpcWorkflowStepOutput } = await import('../../features/workflow/utils/grpcWorkflowStepOutput');
    const { GrpcWorkflowOutputRegistry } = await import('../../features/workflow/utils/grpcWorkflowOutputRegistry');
    const { VariableContext } = await import('../../features/workflow/engine/variableContext');

    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'accept-unary',
        requestId: 'req-accept',
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'accept' },
          saveAs: 'echoCall',
        },
      },
      {
        resolveTemplate: (value: string) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const ctx = new VariableContext({});
    const store = new GrpcWorkflowStepResultStore();
    const registry = new GrpcWorkflowOutputRegistry();
    const stepResult = {
      nodeId: 'accept-unary',
      callType: 'unary' as const,
      status: 'success' as const,
      grpcStatus: 0,
      body: { message: 'accept' },
    };

    publishGrpcWorkflowStepOutput(ctx, snapshot, stepResult, { stepStore: store, outputRegistry: registry });

    const frozen = store.resolveSource('echoCall');
    expect(frozen).toBeDefined();
    const outcome = evaluateGrpcWorkflowAssertions(frozen!, [
      { grpcStatus: 0 },
      { grpcField: '$.message', equals: 'accept' },
    ]);
    expect(outcome.passed).toBe(true);
    expect(JSON.parse(ctx.get('steps.accept-unary.grpc.body')!)).toEqual({ message: 'accept' });
    expect(JSON.parse(ctx.get('grpc.echoCall.body')!)).toEqual({ message: 'accept' });
  });
});
