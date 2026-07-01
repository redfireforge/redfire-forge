/**
 * Phase 9C — workflow interpolation resolver bridge tests.
 */
import { describe, expect, it } from 'vitest';
import { VariableContext } from '../../features/workflow/engine/variableContext';
import { createGrpcWorkflowInterpolationResolver } from './grpcWorkflowInterpolationResolver';

describe('createGrpcWorkflowInterpolationResolver', () => {
  it('resolves flat env tokens with escape-aware grammar', () => {
    const ctx = new VariableContext(undefined, { grpcHost: 'orders:50051' });
    const resolve = createGrpcWorkflowInterpolationResolver(ctx);
    expect(resolve('{{grpcHost}}')).toBe('orders:50051');
    expect(resolve('prefix \\{{literal\\}} {{grpcHost}}')).toBe('prefix {{literal}} orders:50051');
  });

  it('prefers flatEnv over VariableContext for overlapping keys', () => {
    const ctx = new VariableContext(undefined, { grpcHost: 'ctx:50051' });
    const resolve = createGrpcWorkflowInterpolationResolver(ctx, { grpcHost: 'flat:50051' });
    expect(resolve('{{grpcHost}}')).toBe('flat:50051');
  });

  it('falls back to VariableContext.resolve for node-scoped refs', () => {
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes([
      {
        id: 'n1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { scenario: { id: 's1', name: 'Orders', tests: [] } },
      } as never,
    ]);
    ctx.setForNode('n1', 'orderId', '42');
    const resolve = createGrpcWorkflowInterpolationResolver(ctx);
    expect(resolve('{{node:"Orders".orderId}}')).toBe('42');
  });

  it('falls back to VariableContext.resolve for $expressions', () => {
    const ctx = new VariableContext();
    const resolve = createGrpcWorkflowInterpolationResolver(ctx);
    const resolved = resolve('{{$uuid}}');
    expect(resolved).not.toContain('{{$uuid}}');
    expect(resolved.length).toBeGreaterThan(10);
  });
});
