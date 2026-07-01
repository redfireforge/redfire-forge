/**
 * @vitest-environment node
 *
 * Live integration against docker/grpc echo server (localhost:50051).
 * Skips automatically when the port is unreachable.
 */
import net from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_BIDI_STREAM_START_REQUEST,
  FIXTURE_CLIENT_STREAM_START_REQUEST,
  FIXTURE_DESCRIPTOR,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
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

describe('GrpcStreamService docker integration', () => {
  let dockerUp = false;
  let service: GrpcStreamService;

  beforeEach(async () => {
    dockerUp = await isGrpcEchoReachable();
    clearGrpcStreamRegistry();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    service = new GrpcStreamService();
    vi.restoreAllMocks();
  });

  it('server streaming: start → N grpc-message → grpc-end', async (ctx) => {
    if (!dockerUp) ctx.skip();

    const captured: Array<{ type: string; sequence: number }> = [];
    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      const emitted = originalEmit(streamId, partial);
      if (emitted) {
        captured.push({ type: emitted.type, sequence: emitted.sequence });
      }
      return emitted;
    });

    const start = service.startStream(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: `req-docker-ss-${Date.now()}`,
        body: { message: 'ping', repeat_count: 3, interval_ms: 0 },
      },
      'tab-docker',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    await vi.waitFor(
      () => {
        expect(captured.filter((event) => event.type === 'grpc-message').length).toBe(3);
      },
      { timeout: 5000 },
    );

    await vi.waitFor(
      () => {
        expect(captured.some((event) => event.type === 'grpc-end')).toBe(true);
      },
      { timeout: 5000 },
    );

    const messages = captured.filter((event) => event.type === 'grpc-message');
    expect(messages.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(captured.find((event) => event.type === 'grpc-end')?.sequence).toBe(4);
  });

  it('client streaming: send → end → grpc-end with aggregated body', async (ctx) => {
    if (!dockerUp) ctx.skip();

    const captured: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      const emitted = originalEmit(streamId, partial);
      if (emitted) {
        captured.push({ type: emitted.type, data: emitted.data });
      }
      return emitted;
    });

    const start = service.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: `req-docker-cs-${Date.now()}` },
      'tab-docker',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    expect(service.sendStreamMessage(start.data.streamId, 'tab-docker', {
      body: { message: 'alpha' },
    }).ok).toBe(true);
    expect(service.sendStreamMessage(start.data.streamId, 'tab-docker', {
      body: { message: 'beta' },
    }).ok).toBe(true);
    expect(service.endStream(start.data.streamId, 'tab-docker').ok).toBe(true);

    await vi.waitFor(
      () => {
        expect(captured.some((event) => event.type === 'grpc-end')).toBe(true);
      },
      { timeout: 5000 },
    );

    const endEvent = captured.find((event) => event.type === 'grpc-end');
    expect(endEvent?.data?.message).toBe('alpha,beta');
  });

  it('bidi streaming: send → inbound echo → end → grpc-end', async (ctx) => {
    if (!dockerUp) ctx.skip();

    const captured: Array<{ type: string; direction?: string; data?: Record<string, unknown> }> = [];
    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      const emitted = originalEmit(streamId, partial);
      if (emitted) {
        captured.push({
          type: emitted.type,
          direction: emitted.direction,
          data: emitted.data,
        });
      }
      return emitted;
    });

    const start = service.startStream(
      { ...FIXTURE_BIDI_STREAM_START_REQUEST, requestId: `req-docker-bd-${Date.now()}` },
      'tab-docker',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    expect(service.sendStreamMessage(start.data.streamId, 'tab-docker', {
      body: { message: 'hello' },
    }).ok).toBe(true);

    await vi.waitFor(
      () => {
        expect(captured.some(
          (event) => event.type === 'grpc-message'
            && event.direction === 'inbound'
            && event.data?.message === 'hello',
        )).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(service.endStream(start.data.streamId, 'tab-docker').ok).toBe(true);

    await vi.waitFor(
      () => {
        expect(captured.some((event) => event.type === 'grpc-end')).toBe(true);
      },
      { timeout: 5000 },
    );
  });
});
