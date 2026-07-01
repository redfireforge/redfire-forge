import { describe, expect, it } from 'vitest';
import { VariableContext } from '../engine/variableContext';
import { publishGrpcWorkflowStepOutput } from './grpcWorkflowStepOutput';
import { GrpcWorkflowOutputRegistry } from './grpcWorkflowOutputRegistry';
import { GrpcWorkflowStepResultStore } from './grpcWorkflowStepResultStore';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

function makeSnapshot(overrides: Partial<GrpcWorkflowExecuteSnapshot> = {}): GrpcWorkflowExecuteSnapshot {
  return {
    nodeId: 'n-grpc',
    label: 'Echo',
    onError: 'fail',
    execute: {
      tabId: 'workflow:n-grpc',
      requestId: 'req-1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      descriptorKey: 'fixture',
      service: 'echo.Echo',
      method: 'Unary',
      callType: 'unary',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    },
    ...overrides,
  };
}

describe('publishGrpcWorkflowStepOutput', () => {
  const registry = new GrpcWorkflowOutputRegistry();
  const stepStore = new GrpcWorkflowStepResultStore();
  const options = { outputRegistry: registry, stepStore };

  it('publishes unary body, node-scoped keys, and compatibility aliases', () => {
    const ctx = new VariableContext({});
    ctx.registerWorkflowNodes([]);

    publishGrpcWorkflowStepOutput(ctx, makeSnapshot(), {
      nodeId: 'n-grpc',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      body: { message: 'hello' },
      durationMs: 12,
      trailers: { 'x-test': '1' },
    }, options);

    expect(ctx.get('grpc.response.status')).toBe('0');
    expect(JSON.parse(ctx.get('grpc.response.body')!)).toEqual({ message: 'hello' });
    expect(ctx.getFromNode('n-grpc', 'grpc.status')).toBe('0');
    expect(JSON.parse(ctx.getFromNode('n-grpc', 'grpc.body')!)).toEqual({ message: 'hello' });
    expect(JSON.parse(ctx.get('steps.n-grpc.grpc.body')!)).toEqual({ message: 'hello' });
    expect(ctx.get('steps.n-grpc.grpc.durationMs')).toBe('12');
    expect(stepStore.resolveSource('n-grpc')?.body).toEqual({ message: 'hello' });
  });

  it('publishes stream messages and grpc.stream compatibility key', () => {
    const ctx = new VariableContext({});
    ctx.registerWorkflowNodes([]);

    const messages = [{ n: 1 }, { n: 2 }];
    publishGrpcWorkflowStepOutput(ctx, makeSnapshot(), {
      nodeId: 'n-grpc',
      callType: 'server_streaming',
      status: 'success',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      messages,
    }, options);

    expect(JSON.parse(ctx.get('grpc.stream')!)).toEqual(messages);
    expect(JSON.parse(ctx.getFromNode('n-grpc', 'grpc.messages')!)).toEqual(messages);
    expect(JSON.parse(ctx.get('steps.n-grpc.grpc.messages')!)).toEqual(messages);
  });

  it('publishes saveAs aliases when configured', () => {
    const ctx = new VariableContext({});
    ctx.registerWorkflowNodes([]);

    publishGrpcWorkflowStepOutput(ctx, makeSnapshot({ saveAs: 'echo' }), {
      nodeId: 'n-grpc',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      body: { message: 'alias' },
    }, options);

    expect(ctx.get('grpc.echo.status')).toBe('0');
    expect(JSON.parse(ctx.get('grpc.echo.body')!)).toEqual({ message: 'alias' });
  });

  it('does not publish variables for failed steps', () => {
    const ctx = new VariableContext({});
    ctx.registerWorkflowNodes([]);

    publishGrpcWorkflowStepOutput(ctx, makeSnapshot(), {
      nodeId: 'n-grpc',
      callType: 'unary',
      status: 'failed',
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
    } satisfies GrpcWorkflowStepResult, options);

    expect(ctx.get('grpc.response.status')).toBeUndefined();
    expect(stepStore.resolveSource('n-grpc')?.grpcStatus).toBe(3);
  });

  it('requires output registry to publish successful call outputs', () => {
    const ctx = new VariableContext({});
    expect(() => publishGrpcWorkflowStepOutput(ctx, makeSnapshot(), {
      nodeId: 'n-grpc',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { message: 'hello' },
    }, { stepStore: new GrpcWorkflowStepResultStore() })).toThrow(/GrpcWorkflowOutputRegistry is required/);
  });
});
