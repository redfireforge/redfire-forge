/**
 * Coverage gaps — grpcWorkflowOutputRegistry.ts
 */
import { describe, expect, it } from 'vitest';
import { VariableContext } from '../engine/variableContext';
import { GrpcWorkflowOutputRegistry } from './grpcWorkflowOutputRegistry';
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

describe('grpcWorkflowOutputRegistry coverage gaps', () => {
  it('registerSaveAsAlias ignores blank aliases and getAliasOwner trims input', () => {
    const registry = new GrpcWorkflowOutputRegistry();
    registry.registerSaveAsAlias('  ', 'node-a');
    registry.registerSaveAsAlias('echo', 'node-a');
    expect(registry.getAliasOwner(' echo ')).toBe('node-a');
  });

  it('publishCallNodeOutput writes duration, trailers, messages, and saveAs aliases', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();

    registry.publishCallNodeOutput(ctx, snapshot('stream-node', 'orders'), {
      nodeId: 'stream-node',
      callType: 'server_streaming',
      status: 'success',
      grpcStatus: 0,
      durationMs: 42,
      body: { ok: true },
      messages: [{ seq: 1 }],
      trailers: { 'x-trace': 'abc' },
    });

    expect(ctx.get('steps.stream-node.grpc.durationMs')).toBe('42');
    expect(JSON.parse(ctx.get('steps.stream-node.grpc.messages')!)).toEqual([{ seq: 1 }]);
    expect(JSON.parse(ctx.get('grpc.stream')!)).toEqual([{ seq: 1 }]);
    expect(JSON.parse(ctx.get('steps.stream-node.grpc.trailers')!)).toEqual({ 'x-trace': 'abc' });
    expect(ctx.get('grpc.orders.status')).toBe('0');
    expect(ctx.get('grpc.orders.durationMs')).toBe('42');
    expect(JSON.parse(ctx.get('grpc.orders.messages')!)).toEqual([{ seq: 1 }]);
    expect(JSON.parse(ctx.get('grpc.orders.trailers')!)).toEqual({ 'x-trace': 'abc' });
  });

  it('publishCallNodeOutput writes saveAs alias without optional duration', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();

    registry.publishCallNodeOutput(ctx, snapshot('alias-node', 'echoAlias'), {
      nodeId: 'alias-node',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { ok: true },
    });

    expect(ctx.get('grpc.echoAlias.durationMs')).toBeUndefined();
    expect(JSON.parse(ctx.get('grpc.echoAlias.body')!)).toEqual({ ok: true });
  });

  it('publishCallNodeOutput skips optional fields when undefined', () => {
    const ctx = new VariableContext({});
    const registry = new GrpcWorkflowOutputRegistry();

    registry.publishCallNodeOutput(ctx, snapshot('minimal'), {
      nodeId: 'minimal',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
    });

    expect(ctx.get('steps.minimal.grpc.durationMs')).toBeUndefined();
    expect(ctx.get('steps.minimal.grpc.body')).toBeUndefined();
    expect(ctx.get('grpc.response.body')).toBeUndefined();
  });
});
