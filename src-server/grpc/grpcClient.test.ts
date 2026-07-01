/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { GrpcJsClient } from './grpcClient.js';

describe('GrpcJsClient (Phase 1B)', () => {
  it('reports in-process targets as unreachable without dialing', async () => {
    const client = new GrpcJsClient();
    const result = await client.probeReachability({
      address: 'in-process:test-server',
      timeoutMs: 1_000,
    });

    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toContain('in-process');
  });

  it('rejects in-process targets on unary invoke before dial', async () => {
    const client = new GrpcJsClient();
    const controller = new AbortController();

    await expect(client.invokeUnary({
      address: 'in-process:test-server',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 1_000,
      signal: controller.signal,
      decodeResponse: () => ({}),
    })).rejects.toThrow(/in-process/);
  });

  it('rejects unary invoke when signal is already aborted', async () => {
    const client = new GrpcJsClient();
    const controller = new AbortController();
    controller.abort();

    await expect(client.invokeUnary({
      address: '127.0.0.1:59999',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 1_000,
      signal: controller.signal,
      decodeResponse: () => ({}),
    })).rejects.toThrow(/cancelled before invoke/i);
  });
});
