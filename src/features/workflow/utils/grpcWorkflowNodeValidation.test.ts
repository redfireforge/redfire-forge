/**
 * Phase 6A — gRPC workflow node validation tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import type { WorkflowNode } from '../types/workflow';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from '../types/workflow/node-grpc';
import {
  GRPC_WORKFLOW_VALIDATION_CODES,
  isValidGrpcWorkflowSaveAsAlias,
  isValidGrpcWorkflowTargetTemplate,
  validateGrpcAssertNodeData,
  validateGrpcServerStreamNodeData,
  validateGrpcUnaryNodeData,
} from './grpcWorkflowNodeValidation';
import {
  summarizeGrpcWorkflowGraphValidation,
  validateGrpcWorkflowGraph,
  workflowGraphHasGrpcNodes,
  hasGrpcWorkflowGraphConfigErrors,
} from './validateGrpcWorkflowGraph';

function validUnary(overrides: Partial<GrpcUnaryNodeData> = {}): GrpcUnaryNodeData {
  return {
    label: 'Echo',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    callType: 'unary',
    body: { message: 'hello' },
    ...overrides,
  };
}

function validStream(overrides: Partial<GrpcServerStreamNodeData> = {}): GrpcServerStreamNodeData {
  return {
    label: 'Stream',
    target: '{{grpcHost}}',
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'ServerStreamEcho',
    callType: 'server_streaming',
    body: {},
    collect: { maxMessages: 5 },
    ...overrides,
  };
}

function makeNode(id: string, type: WorkflowNode['type'], data: WorkflowNode['data']): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('grpcWorkflowNodeValidation (Phase 6A)', () => {
  it('isValidGrpcWorkflowTargetTemplate accepts host:port and env templates', () => {
    expect(isValidGrpcWorkflowTargetTemplate('localhost:50051')).toBe(true);
    expect(isValidGrpcWorkflowTargetTemplate('in-process:test-server')).toBe(true);
    expect(isValidGrpcWorkflowTargetTemplate('{{grpcHost}}')).toBe(true);
    expect(isValidGrpcWorkflowTargetTemplate('')).toBe(false);
    expect(isValidGrpcWorkflowTargetTemplate('not-a-target')).toBe(false);
  });

  it('isValidGrpcWorkflowSaveAsAlias enforces identifier rules', () => {
    expect(isValidGrpcWorkflowSaveAsAlias('createOrder')).toBe(true);
    expect(isValidGrpcWorkflowSaveAsAlias('1bad')).toBe(false);
    expect(isValidGrpcWorkflowSaveAsAlias('bad-alias')).toBe(false);
  });

  it('validateGrpcUnaryNodeData accepts a complete unary config', () => {
    const result = validateGrpcUnaryNodeData(validUnary());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('validateGrpcUnaryNodeData accepts connection-profile-only target binding', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      target: '',
      connectionId: 'profile-a',
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('validateGrpcUnaryNodeData rejects missing required fields', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      target: '',
      descriptorKey: '',
      service: '',
      method: '',
      body: [] as unknown as Record<string, unknown>,
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_TARGET)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_BODY)).toBe(true);
  });

  it('validateGrpcUnaryNodeData rejects invalid retry and saveAs', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      saveAs: 'bad alias',
      retry: { maxAttempts: 0, backoffMs: -1, retryOnStatuses: [99] },
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_SAVE_AS)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_RETRY)).toBe(true);
  });

  it('validateGrpcServerStreamNodeData requires a collect stop rule', () => {
    const missing = validateGrpcServerStreamNodeData(validStream({ collect: {} }));
    expect(missing.valid).toBe(false);
    expect(missing.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_COLLECT_RULE)).toBe(true);

    const untilExpr = validateGrpcServerStreamNodeData(validStream({
      collect: { untilExpression: '$.done == true' },
    }));
    expect(untilExpr.valid).toBe(true);
  });

  it('validateGrpcAssertNodeData validates assertion shapes', () => {
    const empty = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [],
    });
    expect(empty.valid).toBe(false);

    const badStatus = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcStatus: 99 }],
    });
    expect(badStatus.valid).toBe(false);

    const ok = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [
        { grpcStatus: 0 },
        { grpcField: 'message', equals: 'hello' },
        { grpcTrailer: 'x-test', exists: true },
        { grpcDuration: { max: 1000 } },
        { grpcStreamLength: { min: 1 } },
      ],
    });
    expect(ok.valid).toBe(true);
  });

  it('validateGrpcAssertNodeData rejects ambiguous and operator-less assertions', () => {
    const ambiguous = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcStatus: 0, grpcField: 'message', equals: 'x' }],
    });
    expect(ambiguous.valid).toBe(false);
    expect(ambiguous.issues.some((i) => i.message.includes('exactly one'))).toBe(true);

    const noFieldOp = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcField: 'message' }],
    });
    expect(noFieldOp.valid).toBe(false);

    const noTrailerOp = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcTrailer: 'x-trace' }],
    });
    expect(noTrailerOp.valid).toBe(false);
  });

  it('validateGrpcAssertNodeData validates grpcField JSONPath syntax at config time', () => {
    const invalid = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcField: '$.messages[foo]', equals: 'x' }],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.some((i) => i.message.includes('valid JSONPath'))).toBe(true);

    const valid = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcField: 'messages[0].message', equals: 'hello' }],
    });
    expect(valid.valid).toBe(true);
  });

  it('validateGrpcAssertNodeData adversarial grpcField matrix rejects malformed paths', () => {
    const malformedFields = [
      '$.',
      '$..message',
      '$message',
      '$.messages[foo]',
      '$.messages[]',
      '$.messages[1',
      '$.messages]1[',
      '$.messages[*][foo]',
      '.message',
      'message.',
      'message..text',
      'messages[1a]',
      'messages[-1]',
      'messages[1][*x]',
      'messages[1]]',
      'messages[[1]]',
      'messages[1].',
    ];

    for (const grpcField of malformedFields) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [{ grpcField, equals: 'x' }],
      });
      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (issue) => issue.field === 'assertions[0].grpcField' && issue.message.includes('valid JSONPath'),
        ),
      ).toBe(true);
    }

    const acceptedFields = [
      '$',
      '$.message',
      '$[0]',
      '$[0].message',
      '$.messages[0]',
      '$.messages[*]',
      'message',
      'messages[0].text',
      'payload.items[1].name',
    ];

    for (const grpcField of acceptedFields) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [{ grpcField, exists: true }],
      });
      expect(result.valid).toBe(true);
    }
  });

  it('validateGrpcAssertNodeData adversarial grpcTrailer matrix enforces name/operator contract', () => {
    const invalidTrailerAssertions = [
      { grpcTrailer: '' },
      { grpcTrailer: '   ' },
      { grpcTrailer: 'grpc-status-details-bin' },
    ];

    for (const assertion of invalidTrailerAssertions) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [assertion as unknown as { grpcTrailer: string; equals?: string; exists?: boolean }],
      });
      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (issue) => issue.field?.startsWith('assertions[0].grpcTrailer') || issue.message.includes('grpcTrailer assertion requires'),
        ),
      ).toBe(true);
    }

    const acceptedTrailerAssertions = [
      { grpcTrailer: 'grpc-status-details-bin', exists: true },
      { grpcTrailer: 'grpc-message', equals: 'ok' },
      { grpcTrailer: '  x-trace-id  ', exists: false },
    ];

    for (const assertion of acceptedTrailerAssertions) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [assertion],
      });
      expect(result.valid).toBe(true);
    }
  });

  it('validateGrpcAssertNodeData adversarial grpcDuration matrix requires finite min/max', () => {
    const invalidDurationAssertions = [
      { grpcDuration: {} },
      { grpcDuration: { min: Number.NaN } },
      { grpcDuration: { max: Number.NaN } },
      { grpcDuration: { min: Number.POSITIVE_INFINITY } },
      { grpcDuration: { max: Number.NEGATIVE_INFINITY } },
      { grpcDuration: { min: '10' } },
      { grpcDuration: { max: '25' } },
    ];

    for (const assertion of invalidDurationAssertions) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [assertion as unknown as { grpcDuration: { min?: number; max?: number } }],
      });
      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (issue) => issue.field === 'assertions[0].grpcDuration' && issue.message.includes('requires min and/or max'),
        ),
      ).toBe(true);
    }

    const acceptedDurationAssertions = [
      { grpcDuration: { min: 0 } },
      { grpcDuration: { max: 1500 } },
      { grpcDuration: { min: -1, max: 25 } },
    ];

    for (const assertion of acceptedDurationAssertions) {
      const result = validateGrpcAssertNodeData({
        label: 'Assert',
        source: 'grpc-1',
        assertions: [assertion],
      });
      expect(result.valid).toBe(true);
    }
  });

  it('validateGrpcUnaryNodeData rejects reserved saveAs aliases', () => {
    const result = validateGrpcUnaryNodeData(validUnary({ saveAs: 'response' }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.RESERVED_SAVE_AS)).toBe(true);
  });

  it('validateGrpcUnaryNodeData accepts bearer token env templates at graph validation time', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      auth: { type: 'bearer', bearerToken: '{{grpcToken}}' },
    }));
    expect(result.valid).toBe(true);
  });

  it('validateGrpcUnaryNodeData rejects wrong callType', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      callType: 'server_streaming' as unknown as 'unary',
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_CALL_TYPE)).toBe(true);
  });

  it('validateGrpcServerStreamNodeData accepts maxDurationMs-only collect rule', () => {
    const result = validateGrpcServerStreamNodeData(validStream({
      collect: { maxDurationMs: 5000 },
    }));
    expect(result.valid).toBe(true);
  });

  it('validateGrpcServerStreamNodeData rejects non-positive maxMessages', () => {
    const result = validateGrpcServerStreamNodeData(validStream({
      collect: { maxMessages: 0 },
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_COLLECT_RULE)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_COLLECT_RULE)).toBe(true);
  });

  it('hasGrpcWorkflowNodeConfigErrors mirrors per-node validation', async () => {
    const { hasGrpcWorkflowNodeConfigErrors } = await import('./grpcWorkflowNodeValidation');
    expect(hasGrpcWorkflowNodeConfigErrors('grpcUnary', validUnary())).toBe(false);
    expect(hasGrpcWorkflowNodeConfigErrors('grpcUnary', validUnary({ target: '' }))).toBe(true);
    expect(hasGrpcWorkflowNodeConfigErrors(
      'grpcUnary',
      validUnary({ target: '', connectionId: 'profile-a' }),
    )).toBe(false);
    expect(hasGrpcWorkflowNodeConfigErrors('http', { label: 'HTTP' })).toBe(false);
  });
});

describe('validateGrpcWorkflowGraph (Phase 6A)', () => {
  it('returns valid for workflows without gRPC nodes', () => {
    const nodes: WorkflowNode[] = [
      makeNode('http-1', 'http', { label: 'HTTP', method: 'GET', url: '/x' } as WorkflowNode['data']),
    ];
    expect(workflowGraphHasGrpcNodes(nodes)).toBe(false);
    expect(validateGrpcWorkflowGraph(nodes).valid).toBe(true);
    expect(hasGrpcWorkflowGraphConfigErrors(nodes)).toBe(false);
  });

  it('hasGrpcWorkflowGraphConfigErrors reflects full graph validation', () => {
    const validNodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary()),
    ];
    expect(hasGrpcWorkflowGraphConfigErrors(validNodes)).toBe(false);

    const invalidNodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary({ target: '' })),
    ];
    expect(hasGrpcWorkflowGraphConfigErrors(invalidNodes)).toBe(true);
  });

  it('does not emit DUPLICATE_SAVE_AS for duplicate reserved saveAs values', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary({ saveAs: 'response' })),
      makeNode('grpc-2', 'grpcUnary', validUnary({ saveAs: 'response' })),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS)).toBe(false);
    expect(result.issues.filter((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.RESERVED_SAVE_AS)).toHaveLength(2);
  });

  it('passes for a valid unary + assert chain', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary({ saveAs: 'echoCall' })),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert echo',
        source: 'echoCall',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(true);
  });

  it('allows assert source by upstream grpc node id', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary()),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert echo',
        source: 'grpc-1',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    expect(validateGrpcWorkflowGraph(nodes).valid).toBe(true);
  });

  it('rejects assert source pointing at non-gRPC node id', () => {
    const nodes: WorkflowNode[] = [
      makeNode('http-1', 'http', { label: 'HTTP', method: 'GET', url: '/x' } as WorkflowNode['data']),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'http-1',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.UNKNOWN_ASSERT_SOURCE)).toBe(true);
  });

  it('rejects duplicate saveAs aliases', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary({ saveAs: 'dup' })),
      makeNode('grpc-2', 'grpcServerStream', validStream({ saveAs: 'dup' })),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS)).toBe(true);
  });

  it('allows saveAs equal to the same node id when id is a valid identifier', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc_call_1', 'grpcUnary', validUnary({ saveAs: 'grpc_call_1' })),
    ];
    expect(validateGrpcWorkflowGraph(nodes).valid).toBe(true);
  });

  it('rejects grpcStreamLength assertions against unary source', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary()),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'grpc-1',
        assertions: [{ grpcStreamLength: { min: 1 } }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.ASSERT_SOURCE_CALL_TYPE_MISMATCH)).toBe(true);
  });

  it('allows grpcStreamLength assertions against server stream source', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcServerStream', validStream()),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'grpc-1',
        assertions: [{ grpcStreamLength: { min: 1 } }],
      } satisfies GrpcAssertNodeData),
    ];
    expect(validateGrpcWorkflowGraph(nodes).valid).toBe(true);
  });

  it('allows grpcStreamLength assertions against server stream saveAs alias', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcServerStream', validStream({ saveAs: 'ordersStream' })),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'ordersStream',
        assertions: [{ grpcStreamLength: { min: 1 } }],
      } satisfies GrpcAssertNodeData),
    ];
    expect(validateGrpcWorkflowGraph(nodes).valid).toBe(true);
  });

  it('rejects saveAs that shadows a non-gRPC node id', () => {
    const nodes: WorkflowNode[] = [
      makeNode('http_step', 'http', { label: 'HTTP', method: 'GET', url: '/x' } as WorkflowNode['data']),
      makeNode('grpc-1', 'grpcUnary', validUnary({ saveAs: 'http_step' })),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.SAVE_AS_SHADOWS_NODE_ID)).toBe(true);
  });

  it('does not treat invalid saveAs strings as graph-tracked aliases', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary({ saveAs: 'bad alias' })),
      makeNode('grpc-2', 'grpcUnary', validUnary({ saveAs: 'bad alias' })),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'bad alias',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS)).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_SAVE_AS)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.UNKNOWN_ASSERT_SOURCE)).toBe(true);
  });

  it('rejects assert source pointing at another grpcAssert node id', () => {
    const nodes: WorkflowNode[] = [
      makeNode('grpc-1', 'grpcUnary', validUnary()),
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert A',
        source: 'grpc-1',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
      makeNode('assert-2', 'grpcAssert', {
        label: 'Assert B',
        source: 'assert-1',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.UNKNOWN_ASSERT_SOURCE)).toBe(true);
  });

  it('rejects saveAs that shadows another gRPC node id', () => {
    const nodes: WorkflowNode[] = [
      makeNode('first_call', 'grpcUnary', validUnary()),
      makeNode('grpc-2', 'grpcUnary', validUnary({ saveAs: 'first_call' })),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.SAVE_AS_SHADOWS_NODE_ID)).toBe(true);
  });

  it('rejects assert source that does not exist in graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('assert-1', 'grpcAssert', {
        label: 'Assert',
        source: 'missingAlias',
        assertions: [{ grpcStatus: 0 }],
      } satisfies GrpcAssertNodeData),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.UNKNOWN_ASSERT_SOURCE)).toBe(true);
  });

  it('summarizeGrpcWorkflowGraphValidation returns first issue message', () => {
    const summary = summarizeGrpcWorkflowGraphValidation({
      valid: false,
      issues: [{
        nodeId: 'n1',
        field: 'target',
        code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_TARGET,
        message: 'Target address is required',
      }],
    });
    expect(summary).toBe('[n1] Target address is required');
  });

  it('validates advanced gRPC nodes and tracks saveAs collisions (Phase 11N)', () => {
    const nodes: WorkflowNode[] = [
      makeNode('lt-1', 'grpcLoadTest', {
        label: 'Load',
        target: 'localhost:50051',
        descriptorKey: 'dk',
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        loadTest: { concurrency: 1, totalCalls: 1 },
        saveAs: 'loadAlias',
      }),
      makeNode('sd-1', 'grpcSchemaDiff', {
        label: 'Diff',
        leftDescriptorKey: 'left',
        rightDescriptorKey: 'right',
        saveAs: 'loadAlias',
      }),
    ];
    const result = validateGrpcWorkflowGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS)).toBe(true);
    expect(workflowGraphHasGrpcNodes(nodes)).toBe(true);
  });
});
