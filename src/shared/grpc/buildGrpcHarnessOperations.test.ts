import { describe, expect, it, vi } from 'vitest';

vi.mock('./buildGrpcNodeOperations', () => ({
  buildGrpcNodeOperations: () => ({
    invokeUnary: vi.fn(),
    collectServerStream: vi.fn(),
  }),
}));

describe('buildGrpcHarnessOperations (Phase 8C)', () => {
  it('exposes unary + harness stream operations', async () => {
    const { buildGrpcHarnessOperations } = await import('./buildGrpcHarnessOperations');
    const ops = buildGrpcHarnessOperations();
    expect(typeof ops.invokeUnary).toBe('function');
    expect(typeof ops.collectHarnessServerStream).toBe('function');
    expect(typeof ops.executeClientStream).toBe('function');
    expect(typeof ops.executeBidiStream).toBe('function');
  });
});
