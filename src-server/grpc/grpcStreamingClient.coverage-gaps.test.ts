/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClose = vi.fn();
const mockCalls: EventEmitter[] = [];

vi.mock('./grpcJsLoader.js', () => ({
  grpc: {
    credentials: {
      createInsecure: vi.fn(() => ({})),
    },
    status: { OK: 0, UNKNOWN: 2 },
    Metadata: vi.fn(function Metadata(this: { map: Record<string, string> }) {
      this.map = {};
      this.set = (key: string, value: string) => {
        this.map[key] = value;
      };
      this.getMap = () => this.map;
    }),
    Client: vi.fn(function MockGrpcClient(this: unknown) {
      Object.assign(this as object, {
        makeServerStreamRequest: vi.fn((_path: string, ser: (value: Buffer) => Buffer, des: (value: Buffer) => Buffer, buf: Buffer, _meta: unknown, _opts: unknown) => {
          ser(buf);
          const call = new EventEmitter() as EventEmitter & { cancel: ReturnType<typeof vi.fn> };
          call.cancel = vi.fn();
          mockCalls.push(call);
          queueMicrotask(() => {
            call.emit('metadata', { getMap: () => ({ 'x-bin': Buffer.from('meta') }) });
            call.emit('data', des(Buffer.from('payload')));
            call.emit('status', { code: 0, metadata: { getMap: () => ({}) } });
            call.emit('end');
          });
          return call;
        }),
        makeClientStreamRequest: vi.fn((_path: string, ser: (value: Buffer) => Buffer, des: (value: Buffer) => Buffer, _meta: unknown, _opts: unknown, callback: (error: Error | null, response: Buffer) => void) => {
          const call = new EventEmitter() as EventEmitter & {
            write: ReturnType<typeof vi.fn>;
            end: ReturnType<typeof vi.fn>;
            cancel: ReturnType<typeof vi.fn>;
          };
          call.write = vi.fn((chunk: Buffer) => ser(chunk));
          call.end = vi.fn(() => {
            queueMicrotask(() => callback(null, des(Buffer.from('response'))));
          });
          call.cancel = vi.fn();
          mockCalls.push(call);
          queueMicrotask(() => {
            call.emit('metadata', { getMap: () => ({}) });
            call.emit('status', { code: 0, metadata: { getMap: () => ({}) } });
          });
          return call;
        }),
        makeBidiStreamRequest: vi.fn((_path: string, ser: (value: Buffer) => Buffer, des: (value: Buffer) => Buffer) => {
          const call = new EventEmitter() as EventEmitter & {
            write: ReturnType<typeof vi.fn>;
            end: ReturnType<typeof vi.fn>;
            cancel: ReturnType<typeof vi.fn>;
          };
          call.write = vi.fn((chunk: Buffer) => ser(chunk));
          call.end = vi.fn();
          call.cancel = vi.fn();
          mockCalls.push(call);
          queueMicrotask(() => {
            call.emit('metadata', { getMap: () => ({}) });
            call.emit('data', des(Buffer.from('chunk')));
            call.emit('status', { code: 0, metadata: { getMap: () => ({}) } });
            call.emit('end');
          });
          return call;
        }),
        close: mockClose,
      });
    }),
  },
}));

import { GrpcJsStreamingClient, GrpcJsStreamingClientAdapter } from './grpcStreamingClient.js';

describe('GrpcJsStreamingClient mocked coverage gaps', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockClose.mockClear();
  });

  const callbacks = {
    onInboundMessage: vi.fn(),
    onTerminal: vi.fn(),
    onError: vi.fn(),
  };

  const baseParams = {
    address: '127.0.0.1:50051',
    service: 'echo.EchoService',
    method: 'Stream',
    requestBuffer: Buffer.from([]),
    metadata: { trace: '1' },
    timeoutMs: 1_000,
    decodeResponse: () => ({ message: 'ok' }),
  };

  it('handles server, client, and bidi streaming call shapes', async () => {
    const client = new GrpcJsStreamingClient();

    client.startStream({ ...baseParams, callType: 'server_streaming' }, callbacks);
    client.startStream({ ...baseParams, callType: 'client_streaming' }, callbacks);
    const bidi = client.startStream({ ...baseParams, callType: 'bidi_streaming' }, callbacks);

    bidi.write(Buffer.from('out'));
    bidi.endWrites();
    bidi.cancel();

    await vi.waitFor(() => {
      expect(callbacks.onInboundMessage).toHaveBeenCalled();
      expect(callbacks.onTerminal).toHaveBeenCalled();
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('routes decode failures through onError', async () => {
    const client = new GrpcJsStreamingClient();
    const onError = vi.fn();
    client.startStream(
      {
        ...baseParams,
        callType: 'server_streaming',
        decodeResponse: () => {
          throw new Error('decode failed');
        },
      },
      { ...callbacks, onError },
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('decode failed', undefined);
    });
  });

  it('rejects invalid and in-process targets before opening a stream', () => {
    const client = new GrpcJsStreamingClient();
    expect(() => client.startStream({ ...baseParams, address: 'not-valid', callType: 'server_streaming' }, callbacks))
      .toThrow(/host:port/i);
    expect(() => client.startStream({ ...baseParams, address: 'in-process:demo', callType: 'server_streaming' }, callbacks))
      .toThrow(/in-process/i);
  });

  it('blocks writes on server-streaming handles', () => {
    const client = new GrpcJsStreamingClient();
    const handle = client.startStream({ ...baseParams, callType: 'server_streaming' }, callbacks);
    expect(() => handle.write(Buffer.from('x'))).toThrow(/Cannot write to a server-streaming/i);
    expect(() => handle.endWrites()).toThrow(/Cannot end writes on a server-streaming/i);
  });

  it('routes client-streaming terminal success through onTerminal', async () => {
    const client = new GrpcJsStreamingClient();
    const onTerminal = vi.fn();
    client.startStream(
      { ...baseParams, callType: 'client_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError: vi.fn() },
    );
    const clientCall = mockCalls.at(-1) as EventEmitter & { end: () => void };
    clientCall.end?.();
    await vi.waitFor(() => {
      expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ body: { message: 'ok' } }));
    });
  });

  it('routes client-streaming callback errors and decode failures', async () => {
    const client = new GrpcJsStreamingClient();
    const onError = vi.fn();
    const onTerminal = vi.fn();

    client.startStream(
      { ...baseParams, callType: 'client_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError },
    );
    const clientCall = mockCalls.at(-1) as EventEmitter & {
      end: (callback?: () => void) => void;
    };
    clientCall.emit('error', Object.assign(new Error('stream failed'), { code: 14, details: 'UNAVAILABLE' }));

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('UNAVAILABLE', 14);
    });

    onError.mockClear();
    client.startStream(
      {
        ...baseParams,
        callType: 'client_streaming',
        decodeResponse: () => {
          throw new Error('terminal decode failed');
        },
      },
      { onInboundMessage: vi.fn(), onTerminal, onError },
    );
    const failingCall = mockCalls.at(-1) as EventEmitter & {
      end: (callback?: () => void) => void;
    };
    failingCall.end?.();
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('terminal decode failed', undefined);
    });
  });

  it('routes bidi decode failures through onError', async () => {
    const client = new GrpcJsStreamingClient();
    const onError = vi.fn();
    client.startStream(
      {
        ...baseParams,
        callType: 'bidi_streaming',
        decodeResponse: () => {
          throw new Error('bidi decode failed');
        },
      },
      { ...callbacks, onError },
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('bidi decode failed', undefined);
    });
  });

  it('routes bidi terminal end events through onTerminal', async () => {
    const client = new GrpcJsStreamingClient();
    const onTerminal = vi.fn();
    client.startStream(
      { ...baseParams, callType: 'bidi_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError: vi.fn() },
    );

    await vi.waitFor(() => {
      expect(onTerminal).toHaveBeenCalled();
    });
  });

  it('ignores bidi cancelled error after client half-close and resolves terminal success', async () => {
    const client = new GrpcJsStreamingClient();
    const onTerminal = vi.fn();
    const onError = vi.fn();
    const handle = client.startStream(
      { ...baseParams, callType: 'bidi_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError },
    );

    const bidiCall = mockCalls.at(-1) as EventEmitter & {
      emit: (event: string, ...args: unknown[]) => boolean;
    };

    handle.endWrites();
    bidiCall.emit('status', { code: 1, metadata: { getMap: () => ({}) } });
    bidiCall.emit('error', Object.assign(new Error('Call cancelled'), { code: 1, details: 'Call cancelled' }));
    bidiCall.emit('end');

    await vi.waitFor(() => {
      expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 0, statusMessage: 'OK' }));
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('delegates through GrpcJsStreamingClientAdapter', () => {
    const adapter = new GrpcJsStreamingClientAdapter();
    const handle = adapter.startStream({ ...baseParams, callType: 'server_streaming' }, callbacks);
    expect(handle.callType).toBe('server_streaming');
  });

  it('routes non-Error decode failures through onError', async () => {
    const client = new GrpcJsStreamingClient();
    const onError = vi.fn();
    client.startStream(
      {
        ...baseParams,
        callType: 'server_streaming',
        decodeResponse: () => {
          throw 'string decode failure';
        },
      },
      { ...callbacks, onError },
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('string decode failure', undefined);
    });
  });

  it('ignores duplicate terminal events after the stream settles', async () => {
    const client = new GrpcJsStreamingClient();
    const onTerminal = vi.fn();
    client.startStream(
      { ...baseParams, callType: 'server_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError: vi.fn() },
    );
    const serverCall = mockCalls.at(-1)!;
    await vi.waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
    serverCall.emit('end');
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('falls back to OK when a terminal status code is unknown', async () => {
    const client = new GrpcJsStreamingClient();
    const onTerminal = vi.fn();

    client.startStream(
      { ...baseParams, callType: 'server_streaming' },
      { onInboundMessage: vi.fn(), onTerminal, onError: vi.fn() },
    );

    const serverCall = mockCalls.at(-1) as EventEmitter & { emit: (event: string, ...args: unknown[]) => boolean };
    serverCall.emit('status', { code: 999, metadata: { getMap: () => ({}) } });
    serverCall.emit('end');

    await vi.waitFor(() => {
      expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 999, statusMessage: 'OK' }));
    });
  });
});
