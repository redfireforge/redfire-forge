/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as targetValidation from '../../src/shared/grpc/targetValidation.js';
import { GrpcJsClient } from './grpcClient.js';

describe('GrpcJsClient coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unreachable for invalid targets during probe', async () => {
    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: 'not-a-target', timeoutMs: 100 });
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toMatch(/host:port/i);
  });

  it('reports successful TCP connect during probe', async () => {
    const socket = new EventEmitter() as net.Socket & { destroy: ReturnType<typeof vi.fn> };
    socket.destroy = vi.fn();
    vi.spyOn(net, 'connect').mockImplementation(() => {
      queueMicrotask(() => socket.emit('connect'));
      return socket;
    });

    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: '127.0.0.1:9', timeoutMs: 5_000 });
    expect(result.reachable).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('reports socket errors during probe', async () => {
    const socket = new EventEmitter() as net.Socket & { destroy: ReturnType<typeof vi.fn> };
    socket.destroy = vi.fn();
    vi.spyOn(net, 'connect').mockImplementation(() => {
      queueMicrotask(() => socket.emit('error', new Error('ECONNREFUSED')));
      return socket;
    });

    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: '127.0.0.1:9', timeoutMs: 5_000 });
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toContain('ECONNREFUSED');
  });

  it('times out probe when connect never completes', async () => {
    const socket = new EventEmitter() as net.Socket & { destroy: ReturnType<typeof vi.fn> };
    socket.destroy = vi.fn();
    vi.spyOn(net, 'connect').mockImplementation(() => socket);

    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: '127.0.0.1:9', timeoutMs: 20 });
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toMatch(/Timed out/i);
  });

  it('rejects unary invoke for invalid targets', async () => {
    const client = new GrpcJsClient();
    const controller = new AbortController();
    await expect(client.invokeUnary({
      address: 'bad-target',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 100,
      signal: controller.signal,
      decodeResponse: () => ({}),
    })).rejects.toThrow(/host:port/i);
  });

  it('reports in-process targets as unreachable during probe', async () => {
    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: 'in-process:demo', timeoutMs: 100 });
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toMatch(/in-process/i);
  });

  it('reports invalid host:port normalization as unreachable', async () => {
    vi.spyOn(targetValidation, 'validateResolvedGrpcTargetAddress')
      .mockReturnValue({ valid: true, kind: 'host_port', normalized: 'not-a-valid-host-port' });
    const client = new GrpcJsClient();
    const result = await client.probeReachability({ address: '127.0.0.1:50051', timeoutMs: 100 });
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toBe('Invalid host:port address');
  });
});
