/**
 * @vitest-environment node
 */
import net from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DescriptorLoader } from './descriptorLoader.js';
import { encodeProtoMessage, decodeProtoMessage, clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearDescriptorRootCache } from './descriptorRootCache.js';
import { clearGrpcDescriptorStore } from './descriptorStore.js';
import { GrpcStreamService } from './grpc-stream-service.js';
import * as streamRegistry from './streamRegistry.js';
import { clearGrpcStreamRegistry } from './streamRegistry.js';

async function isGrpcEchoReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: 50051 });
    const finish = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

describe('reflection StreamRequest repeat_count integration', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    clearGrpcStreamRegistry();
  });

  it('encodes repeat_count through reflection-loaded descriptor root', async (ctx) => {
    if (!(await isGrpcEchoReachable())) ctx.skip();

    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromReflection({
      requestId: 'reflect-repeat-test',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      timeoutMs: 5000,
    });

    const body = { message: 'e2e-ss', repeat_count: 3, interval_ms: 0 };
    const encoded = encodeProtoMessage(descriptor, 'echo.StreamRequest', body);
    const decoded = decodeProtoMessage(descriptor, 'echo.StreamRequest', encoded);
    expect(decoded.repeat_count).toBe(3);
  });

  it('server stream emits 3 messages when started with reflection descriptor', async (ctx) => {
    if (!(await isGrpcEchoReachable())) ctx.skip();

    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromReflection({
      requestId: 'reflect-repeat-stream',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      timeoutMs: 5000,
    });

    const captured: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      const emitted = originalEmit(streamId, partial);
      if (emitted) {
        captured.push({ type: emitted.type, data: emitted.data });
      }
      return emitted;
    });

    const service = new GrpcStreamService();
    const start = service.startStream(
      {
        requestId: `req-reflect-repeat-${Date.now()}`,
        callType: 'server_streaming',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'ServerStream',
        body: { message: 'e2e-ss', repeat_count: 3, interval_ms: 0 },
        metadata: {},
        timeoutMs: 30000,
        descriptorKey: descriptor.key,
      },
      'tab-reflect-repeat',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    await vi.waitFor(
      () => {
        expect(captured.filter((event) => event.type === 'grpc-message').length).toBe(3);
      },
      { timeout: 5000 },
    );

    const messages = captured.filter((event) => event.type === 'grpc-message');
    expect(messages[0]?.data?.message).toBe('e2e-ss [1/3]');
    expect(messages[2]?.data?.message).toBe('e2e-ss [3/3]');
  });
});
