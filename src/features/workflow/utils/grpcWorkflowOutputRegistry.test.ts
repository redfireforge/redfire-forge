import { describe, expect, it } from 'vitest';
import { VariableContext } from '@workflow/engine/variableContext';
import {
  GrpcWorkflowOutputNamespaceError,
  GrpcWorkflowOutputRegistry,
} from './grpcWorkflowOutputRegistry';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';

function snapshot(nodeId: string, saveAs?: string): GrpcWorkflowExecuteSnapshot {
  return {
    nodeId,
    label: nodeId,
    onError: 'fail',
    saveAs,
    execute: {
      tabId: `workflow:${nodeId}`,
      requestId: 'req-1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      descriptorKey: 'dk',
      service: 'echo.Echo',
      method: 'Unary',
      callType: 'unary',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    },
  };
}

describe('GrpcWorkflowOutputRegistry', () => {
  it('publishes isolated steps namespaces for multiple nodes', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();

    registry.publishCallNodeOutput(ctx, snapshot('node-a'), {
      nodeId: 'node-a',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { a: 1 },
    });
    registry.publishCallNodeOutput(ctx, snapshot('node-b'), {
      nodeId: 'node-b',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { b: 2 },
    });

    expect(JSON.parse(ctx.get('steps.node-a.grpc.body')!)).toEqual({ a: 1 });
    expect(JSON.parse(ctx.get('steps.node-b.grpc.body')!)).toEqual({ b: 2 });
    expect(JSON.parse(ctx.get('grpc.response.body')!)).toEqual({ b: 2 });
  });

  it('rejects duplicate saveAs alias at runtime', () => {
    const registry = new GrpcWorkflowOutputRegistry();
    registry.registerSaveAsAlias('echo', 'node-a');
    expect(() => registry.registerSaveAsAlias('echo', 'node-b')).toThrow(GrpcWorkflowOutputNamespaceError);
  });

  it('does not update compatibility aliases for failed results', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();
    registry.publishCallNodeOutput(ctx, snapshot('ok'), {
      nodeId: 'ok',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { ok: true },
    });
    expect(ctx.get('grpc.response.status')).toBe('0');
    registry.publishCallNodeOutput(ctx, snapshot('fail'), {
      nodeId: 'fail',
      callType: 'unary',
      status: 'failed',
      grpcStatus: 3,
    });
    expect(JSON.parse(ctx.get('grpc.response.body')!)).toEqual({ ok: true });
    expect(ctx.get('grpc.response.status')).toBe('0');
  });

  it('publishes load-test and schema-diff summary refs (Phase 11N)', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();
    registry.publishLoadTestSummary(ctx, 'lt-node', 'loadAlias', {
      nodeId: 'lt-node',
      status: 'success',
      runId: 'run-1',
      totalCalls: 2,
      succeeded: 2,
      failed: 0,
    });
    registry.publishSchemaDiffSummary(ctx, 'sd-node', 'diffAlias', {
      nodeId: 'sd-node',
      status: 'success',
      breaking: 0,
      warning: 1,
      info: 0,
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
    });
    expect(JSON.parse(ctx.get('steps.lt-node.grpc.loadTestSummary')!).runId).toBe('run-1');
    expect(JSON.parse(ctx.get('grpc.loadAlias.loadTestSummary')!).totalCalls).toBe(2);
    expect(JSON.parse(ctx.get('grpc.diffAlias.schemaDiffSummary')!).breaking).toBe(0);
  });
});
