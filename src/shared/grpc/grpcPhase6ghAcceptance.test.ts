/**
 * Phase 6G+6H — acceptance checklist traceability.
 *
 * Covers:
 *  - 6G: gRPC diagnostics adapter exports + NodeRunStatus.grpcMeta shape
 *  - 6H: cross-protocol variable chaining (gRPC→VariableContext), harness
 *        contract shapes for unary / serverStream / assert results
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { GrpcResultMeta, RequestResult } from '../types';
import type { TransportType } from '../types/kafka';

/** Phase 6H — harness contract guard for GrpcResultMeta required fields. */
function assertHarnessGrpcResultMeta(
  meta: GrpcResultMeta | undefined,
  transportType: TransportType,
): void {
  expect(meta, `${transportType}: grpcResultMeta must be defined`).toBeDefined();
  if (transportType === 'grpcAssert') {
    expect(meta!.method, `${transportType}: method must be ASSERT`).toBe('ASSERT');
    expect(meta!.target, `${transportType}: target (assert source) is required`).toBeTruthy();
    if (meta!.assertionFailures === undefined) {
      throw new Error(`${transportType}: assertionFailures should be defined (use [] when passed)`);
    }
    return;
  }
  const required = ['service', 'method', 'target'] as const;
  for (const field of required) {
    expect(
      meta![field],
      `${transportType}: grpcResultMeta.${field} is required for harness ingestion`,
    ).toBeTruthy();
  }
  if (transportType === 'grpcServerStream') {
    expect(meta!.messageCount, `${transportType}: messageCount required`).toBeDefined();
  }
}

function makeHarnessResult(
  overrides: Partial<RequestResult> & Pick<RequestResult, 'transportType' | 'grpcResultMeta'>,
): RequestResult {
  return {
    id: 'r-harness',
    scenarioId: 'n1',
    scenarioName: 'Harness',
    url: 'grpc://localhost:50051',
    method: 'UNARY',
    httpStatus: 200,
    responseTimeMs: 10,
    responseBody: '',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    workflowNodeId: 'n1',
    ...overrides,
  };
}

// ─── 6G: Adapter exports ─────────────────────────────────────────────────────

describe('Phase 6G: grpcWorkflowOutputAdapter exports', () => {
  it('exports grpcStatusLabel, buildGrpcNodeStatusMeta, formatGrpcNodeRunDetail', async () => {
    const adapter = await import('../../features/workflow/utils/grpcWorkflowOutputAdapter');
    expect(typeof adapter.grpcStatusLabel).toBe('function');
    expect(typeof adapter.buildGrpcNodeStatusMeta).toBe('function');
    expect(typeof adapter.formatGrpcNodeRunDetail).toBe('function');
  });

  it('workflowRunErrors re-exports adapter functions', async () => {
    const errors = await import('../../features/workflow/utils/workflowRunErrors');
    expect(typeof errors.grpcStatusLabel).toBe('function');
    expect(typeof errors.buildGrpcNodeStatusMeta).toBe('function');
    expect(typeof errors.formatGrpcNodeRunDetail).toBe('function');
  });
});

// ─── 6G: NodeRunStatus.grpcMeta shape ────────────────────────────────────────

describe('Phase 6G: GrpcNodeStatusMeta type shape', () => {
  it('buildGrpcNodeStatusMeta produces all required fields for a unary success', async () => {
    const { buildGrpcNodeStatusMeta } = await import('../../features/workflow/utils/grpcWorkflowOutputAdapter');
    const meta = buildGrpcNodeStatusMeta(
      {
        nodeId: 'n1',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 45,
        body: { reply: 'hello' },
      },
      {
        service: 'echo.EchoService',
        method: 'Echo',
        target: 'localhost:50051',
        callType: 'unary',
        attempts: 1,
      },
    );

    // Required fields
    expect(meta.service).toBe('echo.EchoService');
    expect(meta.method).toBe('Echo');
    expect(meta.target).toBe('localhost:50051');
    expect(meta.callType).toBe('unary');

    // Diagnostic fields
    expect(meta.grpcStatus).toBe(0);
    expect(meta.grpcStatusMessage).toBe('OK');
    expect(meta.bodyPreview).toBeDefined();
    expect(meta.bodyPreview).toContain('reply');
  });

  it('buildGrpcNodeStatusMeta sets messageCount+streamStopReason for server_streaming', async () => {
    const { buildGrpcNodeStatusMeta } = await import('../../features/workflow/utils/grpcWorkflowOutputAdapter');
    const meta = buildGrpcNodeStatusMeta(
      {
        nodeId: 'n2',
        callType: 'server_streaming',
        status: 'success',
        grpcStatus: 0,
        messages: [{ idx: 0 }, { idx: 1 }],
        streamStopReason: 'max_messages',
      },
      {
        service: 'svc.Svc',
        method: 'Watch',
        target: 'host:1234',
        callType: 'server_streaming',
      },
    );

    expect(meta.messageCount).toBe(2);
    expect(meta.streamStopReason).toBe('max_messages');
  });

  it('buildGrpcNodeStatusMeta carries assertionFailures for failed assert', async () => {
    const { buildGrpcNodeStatusMeta } = await import('../../features/workflow/utils/grpcWorkflowOutputAdapter');
    const meta = buildGrpcNodeStatusMeta(
      {
        nodeId: 'n3',
        callType: 'unary',
        status: 'failed',
        grpcStatus: 0,
        assertionFailures: ['$.msg expected "ok" got "fail"'],
      },
      {
        service: 'svc.Svc',
        method: 'Check',
        target: 'host:1234',
        callType: 'assert',
      },
    );

    expect(meta.callType).toBe('assert');
    expect(meta.assertionFailures).toHaveLength(1);
  });
});

// ─── 6H: Cross-protocol variable chaining ────────────────────────────────────

describe('Phase 6H: cross-protocol variable chaining (gRPC → VariableContext)', () => {
  it('published gRPC unary output is readable as steps.<nodeId>.grpc.body', async () => {
    const { buildGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { publishGrpcWorkflowStepOutput } = await import('../../features/workflow/utils/grpcWorkflowStepOutput');
    const { GrpcWorkflowOutputRegistry } = await import('../../features/workflow/utils/grpcWorkflowOutputRegistry');
    const { GrpcWorkflowStepResultStore } = await import('../../features/workflow/utils/grpcWorkflowStepResultStore');
    const { VariableContext } = await import('../../features/workflow/engine/variableContext');

    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-chain-n1',
        requestId: 'req-chain',
        data: {
          label: 'GetUser',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { id: '42' },
          saveAs: 'getUser',
        },
      },
      {
        resolveTemplate: (v: string) => v,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const ctx = new VariableContext({});
    const store = new GrpcWorkflowStepResultStore();
    const registry = new GrpcWorkflowOutputRegistry();

    const stepResult = {
      nodeId: 'grpc-chain-n1',
      callType: 'unary' as const,
      status: 'success' as const,
      grpcStatus: 0,
      body: { userId: '42', name: 'Alice' },
    };

    publishGrpcWorkflowStepOutput(ctx, snapshot, stepResult, { stepStore: store, outputRegistry: registry });

    // Step-scoped variable
    const stepsBody = ctx.get('steps.grpc-chain-n1.grpc.body');
    expect(stepsBody).toBeDefined();
    const parsed = JSON.parse(stepsBody!);
    expect(parsed.userId).toBe('42');
    expect(parsed.name).toBe('Alice');

    // saveAs-scoped variable
    const saveAsBody = ctx.get('grpc.getUser.body');
    expect(saveAsBody).toBeDefined();
    expect(JSON.parse(saveAsBody!).userId).toBe('42');
  });

  it('downstream template {{steps.<nodeId>.grpc.body}} resolves after publish', async () => {
    const { buildGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { publishGrpcWorkflowStepOutput } = await import('../../features/workflow/utils/grpcWorkflowStepOutput');
    const { GrpcWorkflowOutputRegistry } = await import('../../features/workflow/utils/grpcWorkflowOutputRegistry');
    const { GrpcWorkflowStepResultStore } = await import('../../features/workflow/utils/grpcWorkflowStepResultStore');
    const { VariableContext } = await import('../../features/workflow/engine/variableContext');

    const nodeId = 'grpc-chain-n2';
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId,
        requestId: 'req-chain-2',
        data: {
          label: 'GetUser',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { id: '99' },
        },
      },
      {
        resolveTemplate: (v: string) => v,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const ctx = new VariableContext({});
    publishGrpcWorkflowStepOutput(
      ctx,
      snapshot,
      { nodeId, callType: 'unary', status: 'success', grpcStatus: 0, body: { userId: '99' } },
      { stepStore: new GrpcWorkflowStepResultStore(), outputRegistry: new GrpcWorkflowOutputRegistry() },
    );

    const resolved = ctx.resolve(`{{steps.${nodeId}.grpc.body}}`);
    expect(resolved).not.toContain('{{');
    expect(JSON.parse(resolved).userId).toBe('99');
  });

  it('downstream node can read gRPC result body via saveAs alias', async () => {
    const { buildGrpcWorkflowExecuteSnapshot } = await import('../../features/workflow/utils/grpcWorkflowSnapshotBuilder');
    const { publishGrpcWorkflowStepOutput } = await import('../../features/workflow/utils/grpcWorkflowStepOutput');
    const { GrpcWorkflowOutputRegistry } = await import('../../features/workflow/utils/grpcWorkflowOutputRegistry');
    const { GrpcWorkflowStepResultStore } = await import('../../features/workflow/utils/grpcWorkflowStepResultStore');
    const { VariableContext } = await import('../../features/workflow/engine/variableContext');

    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'upstream',
        requestId: 'req-upstream',
        data: {
          label: 'Upstream',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: {},
          saveAs: 'upstreamCall',
        },
      },
      {
        resolveTemplate: (v: string) => v,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );

    const ctx = new VariableContext({});
    publishGrpcWorkflowStepOutput(
      ctx,
      snapshot,
      { nodeId: 'upstream', callType: 'unary', status: 'success', grpcStatus: 0, body: { token: 'abc123' } },
      { stepStore: new GrpcWorkflowStepResultStore(), outputRegistry: new GrpcWorkflowOutputRegistry() },
    );

    const resolved = ctx.get('grpc.upstreamCall.body');
    expect(resolved).toBeDefined();
    expect(JSON.parse(resolved!).token).toBe('abc123');
    expect(ctx.resolve('{{grpc.upstreamCall.body}}')).toContain('abc123');
  });
});

// ─── 6H: Harness contract shapes ─────────────────────────────────────────────

describe('Phase 6H: RequestResult harness contract shapes', () => {
  it('grpcUnary result satisfies harness GrpcResultMeta contract', () => {
    const result = makeHarnessResult({
      transportType: 'grpcUnary',
      method: 'UNARY',
      grpcResultMeta: {
        service: 'echo.EchoService',
        method: 'Echo',
        target: 'localhost:50051',
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        attempts: 1,
      },
    });
    assertHarnessGrpcResultMeta(result.grpcResultMeta, 'grpcUnary');
    expect(result.grpcResultMeta?.grpcStatus).toBe(0);
  });

  it('grpcServerStream result satisfies harness GrpcResultMeta contract', () => {
    const result = makeHarnessResult({
      transportType: 'grpcServerStream',
      method: 'SERVER_STREAM',
      grpcResultMeta: {
        service: 'events.EventService',
        method: 'Subscribe',
        target: 'localhost:9090',
        grpcStatus: 0,
        messageCount: 5,
        streamStopReason: 'stream_end',
        attempts: 1,
      },
    });
    assertHarnessGrpcResultMeta(result.grpcResultMeta, 'grpcServerStream');
    expect(result.grpcResultMeta?.messageCount).toBe(5);
  });

  it('grpcAssert failure result satisfies harness contract with assertionFailures', () => {
    const result = makeHarnessResult({
      transportType: 'grpcAssert',
      method: 'ASSERT',
      passed: false,
      httpStatus: 0,
      grpcResultMeta: {
        service: '',
        method: 'ASSERT',
        target: 'g1',
        grpcStatus: 0,
        assertionFailures: ['$.msg expected "ok" got "fail"'],
      },
    });
    assertHarnessGrpcResultMeta(result.grpcResultMeta, 'grpcAssert');
    expect(result.grpcResultMeta?.assertionFailures).toHaveLength(1);
  });

  it('grpcAssert pass result has empty assertionFailures array', () => {
    const result = makeHarnessResult({
      transportType: 'grpcAssert',
      method: 'ASSERT',
      grpcResultMeta: {
        service: '',
        method: 'ASSERT',
        target: 'g1',
        grpcStatus: 0,
        assertionFailures: [],
      },
    });
    assertHarnessGrpcResultMeta(result.grpcResultMeta, 'grpcAssert');
    expect(result.grpcResultMeta?.assertionFailures).toHaveLength(0);
  });

  it('harness guard rejects grpcAssert meta missing assertionFailures', () => {
    expect(() => assertHarnessGrpcResultMeta({
      service: '',
      method: 'ASSERT',
      target: 'g1',
    }, 'grpcAssert')).toThrow(/assertionFailures/);
  });

  it('TransportType union includes all three gRPC transport variants', () => {
    // Verify the union accepts all three gRPC types (type-level check via assignment)
    const variants: import('../../shared/types/kafka').TransportType[] = [
      'grpcUnary',
      'grpcServerStream',
      'grpcAssert',
    ];
    expect(variants).toHaveLength(3);
    expect(variants).toContain('grpcUnary');
    expect(variants).toContain('grpcServerStream');
    expect(variants).toContain('grpcAssert');
  });
});
