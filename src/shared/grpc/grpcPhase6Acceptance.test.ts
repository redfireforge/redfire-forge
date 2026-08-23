/**
 * Phase 6A — acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';

describe('Phase 6A acceptance checklist', () => {
  it('exports frozen gRPC workflow node contracts', async () => {
    const contracts = await import('../../features/workflow/types/workflow/node-grpc');
    expect(contracts.GRPC_WORKFLOW_NODE_TYPES).toEqual([
      'grpcUnary',
      'grpcServerStream',
      'grpcAssert',
    ]);
    expect(typeof contracts.isGrpcWorkflowNodeType).toBe('function');
    expect(typeof contracts.isGrpcWorkflowCallNodeType).toBe('function');
  });

  it('exports node validators and error catalog', async () => {
    const validation = await import('../../features/workflow/utils/grpcWorkflowNodeValidation');
    expect(typeof validation.validateGrpcUnaryNodeData).toBe('function');
    expect(typeof validation.validateGrpcServerStreamNodeData).toBe('function');
    expect(typeof validation.validateGrpcAssertNodeData).toBe('function');
    expect(validation.GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS).toBe('grpc.workflow.duplicate_save_as');
    expect(validation.GRPC_WORKFLOW_NODE_CONTRACT_MATRIX.grpcUnary.required).toContain('descriptorKey');
    expect(typeof validation.hasGrpcWorkflowNodeConfigErrors).toBe('function');
    expect(validation.GRPC_WORKFLOW_VALIDATION_CODES.RESERVED_SAVE_AS).toBe('grpc.workflow.reserved_save_as');
    expect(validation.GRPC_WORKFLOW_VALIDATION_CODES.ASSERT_SOURCE_CALL_TYPE_MISMATCH).toBe(
      'grpc.workflow.assert_source_call_type_mismatch',
    );
  });

  it('exports graph validation for Quick Test run gate', async () => {
    const graph = await import('../../features/workflow/utils/validateGrpcWorkflowGraph');
    expect(typeof graph.validateGrpcWorkflowGraph).toBe('function');
    expect(typeof graph.workflowGraphHasGrpcNodes).toBe('function');
    expect(typeof graph.hasGrpcWorkflowGraphConfigErrors).toBe('function');
    expect(typeof graph.summarizeGrpcWorkflowGraphValidation).toBe('function');
  });

  it('default node data factories produce structurally typed defaults', async () => {
    const factory = await import('../../features/workflow/utils/workflowNodeFactory');
    const unary = factory.defaultGrpcUnaryNodeData();
    expect(unary.callType).toBe('unary');
    expect(unary.body).toEqual({});
    const stream = factory.defaultGrpcServerStreamNodeData();
    expect(stream.collect.maxMessages).toBe(10);
    const assertNode = factory.defaultGrpcAssertNodeData();
    expect(assertNode.assertions).toEqual([]);
  });

  it('valid unary config passes graph validation', async () => {
    const { validateGrpcWorkflowGraph } = await import('../../features/workflow/utils/validateGrpcWorkflowGraph');
    const result = validateGrpcWorkflowGraph([{
      id: 'grpc-1',
      type: 'grpcUnary',
      position: { x: 0, y: 0 },
      data: {
        label: 'Echo',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary',
        body: { message: 'hello' },
      },
    }]);
    expect(result.valid).toBe(true);
  });
});
