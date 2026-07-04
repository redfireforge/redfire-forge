/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

describe('grpcJsLoader', () => {
  afterEach(async () => {
    vi.resetModules();
    vi.doUnmock('node:module');
    const mod = await import('./grpcJsLoader.js');
    mod.resetGrpcJsLoaderCacheForTests();
  });

  it('throws a helpful error when @grpc/grpc-js cannot be loaded', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => {
        throw new Error('MODULE_NOT_FOUND');
      },
    }));
    const { grpc } = await import('./grpcJsLoader.js');
    expect(() => grpc.credentials).toThrow(/@grpc\/grpc-js is required/);
    expect(() => grpc.status).toThrow(/MODULE_NOT_FOUND/);
  });

  it('proxies @grpc/grpc-js exports', async () => {
    const { grpc } = await import('./grpcJsLoader.js');
    expect(grpc.credentials).toBeDefined();
    expect(typeof grpc.credentials.createInsecure).toBe('function');
  });

  it('uses String(error) when loader throws a non-Error value', async () => {
    vi.resetModules();
    vi.doMock('node:module', () => ({
      createRequire: () => () => {
        throw 'MISSING_NON_ERROR';
      },
    }));
    const { grpc } = await import('./grpcJsLoader.js');
    expect(() => grpc.credentials).toThrow(/MISSING_NON_ERROR/);
  });

  it('reuses cached grpc module after first successful load', async () => {
    vi.resetModules();
    const requireSpy = vi.fn(() => ({ credentials: { createInsecure: vi.fn() }, status: { OK: 0 } }));
    vi.doMock('node:module', () => ({
      createRequire: () => requireSpy,
    }));

    const { grpc } = await import('./grpcJsLoader.js');
    expect(grpc.credentials).toBeDefined();
    expect((grpc.status as { OK: number }).OK).toBe(0);
    expect(requireSpy).toHaveBeenCalledTimes(1);
  });
});
