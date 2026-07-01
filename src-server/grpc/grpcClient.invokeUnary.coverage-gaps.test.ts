/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(() => Promise.resolve({ address: '127.0.0.1', family: 4 })),
  },
}));

const grpcMocks = vi.hoisted(() => {
  const mockClose = vi.fn();
  const pendingUnaryCallbacks: Array<(error: Error | null, response?: Buffer) => void> = [];
  const pendingUnaryCalls: Array<EventEmitter & { cancel: ReturnType<typeof vi.fn> }> = [];
  let autoUnaryResponse: { error?: Error; buffer?: Buffer } | null = null;

  return {
    mockClose,
    pendingUnaryCallbacks,
    pendingUnaryCalls,
    get autoUnaryResponse() {
      return autoUnaryResponse;
    },
    set autoUnaryResponse(value: { error?: Error; buffer?: Buffer } | null) {
      autoUnaryResponse = value;
    },
    reset() {
      mockClose.mockReset();
      pendingUnaryCallbacks.length = 0;
      pendingUnaryCalls.length = 0;
      autoUnaryResponse = null;
    },
  };
});

vi.mock('@grpc/grpc-js', () => ({
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
      makeUnaryRequest: vi.fn((
        _path: string,
        ser: (value: Buffer) => Buffer,
        des: (value: Buffer) => Buffer,
        buf: Buffer,
        _meta: unknown,
        _opts: unknown,
        callback: (error: Error | null, response?: Buffer) => void,
      ) => {
        ser(buf);
        grpcMocks.pendingUnaryCallbacks.push(callback);
        const call = new EventEmitter() as EventEmitter & { cancel: ReturnType<typeof vi.fn> };
        call.cancel = vi.fn();
        grpcMocks.pendingUnaryCalls.push(call);
        if (grpcMocks.autoUnaryResponse) {
          const response = grpcMocks.autoUnaryResponse;
          grpcMocks.autoUnaryResponse = null;
          queueMicrotask(() => {
            if (response.error) {
              callback(response.error);
              return;
            }
            callback(null, des(response.buffer));
          });
        }
        return call;
      }),
      close: grpcMocks.mockClose,
    });
  }),
}));

import { GrpcJsClient } from './grpcClient.js';

function latestUnaryCallback(): (error: Error | null, response?: Buffer) => void {
  const callback = grpcMocks.pendingUnaryCallbacks.at(-1);
  if (!callback) {
    throw new Error('Expected makeUnaryRequest callback');
  }
  return callback;
}

function latestUnaryCall(): EventEmitter & { cancel: ReturnType<typeof vi.fn> } {
  const call = grpcMocks.pendingUnaryCalls.at(-1);
  if (!call) {
    throw new Error('Expected makeUnaryRequest call');
  }
  return call;
}

async function waitForUnarySetup(): Promise<void> {
  await vi.waitFor(() => {
    expect(grpcMocks.pendingUnaryCallbacks.length).toBeGreaterThan(0);
    expect(grpcMocks.pendingUnaryCalls.length).toBeGreaterThan(0);
  });
}

describe('GrpcJsClient invokeUnary mocked coverage gaps', () => {
  beforeEach(() => {
    grpcMocks.reset();
  });

  it('resolves successful unary responses with metadata', async () => {
    const client = new GrpcJsClient();
    const controller = new AbortController();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from('req'),
      metadata: { 'x-token': 'abc' },
      timeoutMs: 5_000,
      signal: controller.signal,
      decodeResponse: (buffer) => ({ message: buffer.toString('utf8') }),
    });

    await waitForUnarySetup();
    const call = latestUnaryCall();
    call.emit('metadata', { getMap: () => ({ 'content-type': 'application/grpc' }) });
    call.emit('status', { metadata: { getMap: () => ({ 'grpc-message': 'OK' }) } });
    latestUnaryCallback()(null, Buffer.from('hello'));

    const result = await invokePromise;
    expect(result.body).toEqual({ message: 'hello' });
    expect(result.headers['content-type']).toBe('application/grpc');
    expect(grpcMocks.mockClose).toHaveBeenCalled();
  });

  it('converts Buffer metadata values to utf8 strings', async () => {
    const client = new GrpcJsClient();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: { trace: 'abc' },
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      decodeResponse: () => ({}),
    });

    await waitForUnarySetup();
    const call = latestUnaryCall();
    call.emit('metadata', { getMap: () => ({ 'x-bin': Buffer.from('header-bytes') }) });
    call.emit('status', { metadata: { getMap: () => ({ 'trail-bin': Buffer.from('trail-bytes') }) } });
    latestUnaryCallback()(null, Buffer.from('ok'));

    const result = await invokePromise;
    expect(result.headers['x-bin']).toBe('header-bytes');
    expect(result.trailers['trail-bin']).toBe('trail-bytes');
  });

  it('rejects grpc service errors from unary callbacks', async () => {
    const client = new GrpcJsClient();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      decodeResponse: () => ({}),
    });
    await waitForUnarySetup();
    latestUnaryCallback()(Object.assign(new Error('INTERNAL'), { code: 13, details: 'boom' }));
    await expect(invokePromise).rejects.toMatchObject({ grpcStatus: 13, grpcDetails: 'boom' });
  });

  it('attaches grpc metadata to rejected service errors', async () => {
    const client = new GrpcJsClient();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      decodeResponse: () => ({}),
    });
    await waitForUnarySetup();
    const metadata = { getMap: () => ({ 'error-bin': Buffer.from('meta') }) };
    latestUnaryCallback()(Object.assign(new Error('INTERNAL'), {
      code: 13,
      details: 'boom',
      metadata,
    }));
    await expect(invokePromise).rejects.toMatchObject({ grpcMetadata: metadata });
  });

  it('rejects decode failures after a successful unary response buffer', async () => {
    grpcMocks.autoUnaryResponse = { buffer: Buffer.from('x') };
    const client = new GrpcJsClient();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      decodeResponse: () => {
        throw new Error('bad payload');
      },
    });
    await expect(invokePromise).rejects.toThrow(/bad payload/);
  });

  it('rejects in-process targets and aborted signals', async () => {
    const client = new GrpcJsClient();
    const aborted = new AbortController();
    aborted.abort();

    await expect(client.invokeUnary({
      address: 'in-process:demo',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 100,
      signal: aborted.signal,
      decodeResponse: () => ({}),
    })).rejects.toThrow(/in-process targets/i);

    await expect(client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 100,
      signal: aborted.signal,
      decodeResponse: () => ({}),
    })).rejects.toThrow(/cancelled before invoke/i);
  });

  it('rejects when abort fires during unary callback', async () => {
    const client = new GrpcJsClient();
    const controller = new AbortController();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 5_000,
      signal: controller.signal,
      decodeResponse: () => ({}),
    });

    await waitForUnarySetup();
    controller.abort();
    latestUnaryCallback()(null, Buffer.from('late'));
    await expect(invokePromise).rejects.toThrow(/cancelled/i);
    expect(latestUnaryCall().cancel).toHaveBeenCalled();
  });

  it('rejects non-Error decode failures with string message', async () => {
    grpcMocks.autoUnaryResponse = { buffer: Buffer.from('x') };
    const client = new GrpcJsClient();
    const invokePromise = client.invokeUnary({
      address: '127.0.0.1:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer: Buffer.from([]),
      metadata: {},
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      decodeResponse: () => {
        throw 'bad-string';
      },
    });
    await expect(invokePromise).rejects.toThrow('bad-string');
  });
});
