/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { createGrpcMockRuntimeManager } from '../../src/shared/grpc/grpcMockRuntimeCore.js';
import {
  GRPC_MOCK_LISTENER_PORT_MAX,
  GRPC_MOCK_LISTENER_PORT_MIN,
} from '../../src/shared/grpc/grpcMockListenerContracts.js';
import { encodeProtoMessage } from './dynamicProtoCodec.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';

const grpcMocks = vi.hoisted(() => {
  const capturedImplementations: Array<Record<string, Record<string, (...args: unknown[]) => void>>> = [];
  let bindError: Error | null = null;
  let boundPort = 50061;
  let tryShutdownCallback: (() => void) | null = null;

  return {
    capturedImplementations,
    bindError: {
      get: () => bindError,
      set: (value: Error | null) => { bindError = value; },
    },
    boundPort: {
      get: () => boundPort,
      set: (value: number) => { boundPort = value; },
    },
    tryShutdownCallback: {
      get: () => tryShutdownCallback,
      set: (value: (() => void) | null) => { tryShutdownCallback = value; },
    },
    reset() {
      capturedImplementations.length = 0;
      bindError = null;
      boundPort = 50061;
      tryShutdownCallback = null;
    },
  };
});

vi.mock('./grpcJsLoader.js', () => ({
  grpc: {
    status: {
      OK: 0,
      CANCELLED: 1,
      UNKNOWN: 2,
      INVALID_ARGUMENT: 3,
      INTERNAL: 13,
      UNAVAILABLE: 14,
      0: 'OK',
      1: 'CANCELLED',
      2: 'UNKNOWN',
      3: 'INVALID_ARGUMENT',
      13: 'INTERNAL',
      14: 'UNAVAILABLE',
    },
    Metadata: vi.fn(function Metadata(this: { map: Record<string, unknown> }) {
      this.map = {};
      this.getMap = () => this.map;
    }),
    ServerCredentials: {
      createInsecure: vi.fn(() => ({})),
    },
    Server: vi.fn(function MockServer(this: {
      addService: ReturnType<typeof vi.fn>;
      bindAsync: ReturnType<typeof vi.fn>;
      tryShutdown: ReturnType<typeof vi.fn>;
      forceShutdown: ReturnType<typeof vi.fn>;
    }) {
      this.addService = vi.fn((_def, impl) => {
        grpcMocks.capturedImplementations.push(impl);
      });
      this.bindAsync = vi.fn((_addr, _creds, cb: (error: Error | null, port?: number) => void) => {
        queueMicrotask(() => {
          const error = grpcMocks.bindError.get();
          if (error) {
            cb(error);
            return;
          }
          cb(null, grpcMocks.boundPort.get());
        });
      });
      this.tryShutdown = vi.fn((cb: () => void) => {
        grpcMocks.tryShutdownCallback.set(cb);
        if (grpcMocks.tryShutdownCallback.get) {
          queueMicrotask(() => grpcMocks.tryShutdownCallback.get?.());
        }
      });
      this.forceShutdown = vi.fn();
    }),
  },
}));

import {
  GrpcMockNetworkListener,
  grpcMockGrpcStatusCodeFromRuleForTests,
  tryAllocateGrpcMockListenerPort,
} from './grpcMockNetworkListener.js';

const ECHO_RULE_SET = {
  rules: [{
    id: 'echo',
    name: 'Echo',
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals' as const, method: 'Echo' },
    response: { statusCode: 0, body: { message: 'ok' } },
  }],
};

const SERVER_STREAM_RULE = {
  rules: [{
    id: 'stream',
    name: 'Server stream',
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals' as const, method: 'ServerStream' },
    response: {
      statusCode: 0,
      messages: [{ message: 'one' }, { message: 'two' }],
      interMessageDelayMs: 1,
    },
  }],
};

const CLIENT_STREAM_RULE = {
  rules: [{
    id: 'client',
    name: 'Client stream',
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals' as const, method: 'ClientStream' },
    response: { statusCode: 0, body: { message: 'aggregated' } },
  }],
};

const BIDI_RULE = {
  rules: [{
    id: 'bidi',
    name: 'Bidi',
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals' as const, method: 'BidiStream' },
    response: { statusCode: 0, body: { message: 'bidi-ack' } },
  }],
};

function latestImplementation(): Record<string, (...args: unknown[]) => void> {
  const impl = grpcMocks.capturedImplementations.at(-1);
  if (!impl) {
    throw new Error('Expected service implementation');
  }
  return impl;
}

function requestBuffer(body: Record<string, unknown> = { message: 'hello' }): Buffer {
  return encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.EchoRequest', body);
}

function makeUnaryStream(request: Buffer, metadata: Record<string, string | Buffer> = {}) {
  return {
    request,
    metadata: { getMap: () => metadata },
  };
}

function makeServerWritableStream(request: Buffer) {
  const stream = new EventEmitter() as EventEmitter & {
    request: Buffer;
    metadata: { getMap: () => Record<string, string> };
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  stream.request = request;
  stream.metadata = { getMap: () => ({}) };
  stream.write = vi.fn();
  stream.end = vi.fn();
  stream.destroy = vi.fn();
  return stream;
}

async function startListener(
  manager = createGrpcMockRuntimeManager(),
  ruleSet = ECHO_RULE_SET,
): Promise<{ listener: GrpcMockNetworkListener; manager: ReturnType<typeof createGrpcMockRuntimeManager> }> {
  manager.start({ connectionId: 'conn-1', ruleSet });
  const listener = new GrpcMockNetworkListener('tab-1', manager);
  await listener.start({
    tabId: 'tab-1',
    connectionId: 'conn-1',
    descriptor: FIXTURE_DESCRIPTOR,
    port: 50061,
  });
  return { listener, manager };
}

describe('grpcMockNetworkListener coverage gaps', () => {
  beforeEach(() => {
    grpcMocks.reset();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tryAllocateGrpcMockListenerPort prefers in-range port and skips reserved ports', async () => {
    vi.spyOn(net, 'createServer').mockImplementation(() => {
      const probe = new EventEmitter() as net.Server & { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
      probe.listen = vi.fn((_port: number, _host: string, cb?: () => void) => {
        queueMicrotask(() => probe.emit('listening'));
        cb?.();
      });
      probe.close = vi.fn((cb?: () => void) => cb?.());
      return probe;
    });

    const port = await tryAllocateGrpcMockListenerPort(new Set([50061]), 50062);
    expect(port).toBe(50062);
  });

  it('tryAllocateGrpcMockListenerPort treats busy ports as unavailable', async () => {
    vi.spyOn(net, 'createServer').mockImplementation(() => {
      const probe = new EventEmitter() as net.Server & { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
      probe.listen = vi.fn(() => queueMicrotask(() => probe.emit('error', new Error('EADDRINUSE'))));
      probe.close = vi.fn((cb?: () => void) => cb?.());
      return probe;
    });

    await expect(tryAllocateGrpcMockListenerPort(new Set()))
      .rejects.toThrow(new RegExp(`${GRPC_MOCK_LISTENER_PORT_MIN}.*${GRPC_MOCK_LISTENER_PORT_MAX}`));
  });

  it('tryAllocateGrpcMockListenerPort ignores out-of-range preferred ports', async () => {
    vi.spyOn(net, 'createServer').mockImplementation(() => {
      const probe = new EventEmitter() as net.Server & { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
      probe.listen = vi.fn(() => queueMicrotask(() => probe.emit('listening')));
      probe.close = vi.fn((cb?: () => void) => cb?.());
      return probe;
    });

    const port = await tryAllocateGrpcMockListenerPort(new Set(), GRPC_MOCK_LISTENER_PORT_MAX + 999);
    expect(port).toBeGreaterThanOrEqual(GRPC_MOCK_LISTENER_PORT_MIN);
  });

  it('returns existing status when start is called twice', async () => {
    const { listener } = await startListener();
    const second = await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });
    expect(second.running).toBe(true);
    expect(grpcMocks.capturedImplementations).toHaveLength(1);
    await listener.stop();
  });

  it('rejects bindAsync failures during start', async () => {
    grpcMocks.bindError.set(new Error('bind failed'));
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: ECHO_RULE_SET });
    const listener = new GrpcMockNetworkListener('tab-1', manager);

    await expect(listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    })).rejects.toThrow(/bind failed/i);
  });

  it('forceShutdowns when tryShutdown does not finish within timeout', async () => {
    vi.useFakeTimers();
    grpcMocks.tryShutdownCallback.set(null);
    const { listener } = await startListener();
    const { grpc } = await import('./grpcJsLoader.js');
    const serverInstance = vi.mocked(grpc.Server).mock.results.at(-1)?.value as {
      forceShutdown: ReturnType<typeof vi.fn>;
    };

    const stopPromise = listener.stop();
    vi.advanceTimersByTime(3000);
    await stopPromise;

    expect(serverInstance.forceShutdown).toHaveBeenCalled();
  });

  it('handles unary grpc errors without response body', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'fail',
          name: 'Fail',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { statusCode: 14, message: 'unavailable' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ code: 14, details: 'unavailable' });
    await listener.stop();
  });

  it('handles unary success with Buffer metadata and unknown status codes', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'custom',
          name: 'Custom status',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { statusCode: 9999, message: 'weird', body: { message: 'still ok' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(
      makeUnaryStream(requestBuffer(), { 'x-bin': Buffer.from('trace') }),
      respond,
    );
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });

  it('records unary handler failures as INTERNAL errors', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: ECHO_RULE_SET });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    vi.spyOn(manager, 'executeUnaryCall').mockRejectedValueOnce('plain failure');
    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ code: 13 });
    expect(listener.getStatus().lastError).toBe('plain failure');
    await listener.stop();
  });

  it('streams server responses with delays and handles stream errors', async () => {
    const { listener } = await startListener(createGrpcMockRuntimeManager(), SERVER_STREAM_RULE);
    const stream = makeServerWritableStream(
      encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.StreamRequest', { message: 'go', repeat_count: 2 }),
    );
    latestImplementation().ServerStream(stream);
    await vi.waitFor(() => expect(stream.end).toHaveBeenCalled());
    expect(stream.write).toHaveBeenCalledTimes(2);
    await listener.stop();
  });

  it('destroys server streams on non-zero status without messages', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'stream-fail',
          name: 'Stream fail',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'ServerStream' },
          response: { statusCode: 3, message: 'bad stream' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const stream = makeServerWritableStream(
      encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.StreamRequest', { message: 'go' }),
    );
    latestImplementation().ServerStream(stream);
    await vi.waitFor(() => expect(stream.destroy).toHaveBeenCalled());
    await listener.stop();
  });

  it('aggregates client stream chunks into messages array', async () => {
    const { listener } = await startListener(createGrpcMockRuntimeManager(), CLIENT_STREAM_RULE);
    async function* chunks() {
      yield requestBuffer({ message: 'one' });
      yield requestBuffer({ message: 'two' });
    }
    const stream = Object.assign(new EventEmitter(), {
      metadata: { getMap: () => ({}) },
      [Symbol.asyncIterator]: () => chunks()[Symbol.asyncIterator](),
    });
    const respond = vi.fn();
    latestImplementation().ClientStream(stream, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });

  it('handles client stream grpc errors and handler failures', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'client-fail',
          name: 'Client fail',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'ClientStream' },
          response: { statusCode: 14, message: 'client unavailable' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    async function* emptyChunks() {
      // no chunks
    }
    const stream = Object.assign(new EventEmitter(), {
      metadata: { getMap: () => ({}) },
      [Symbol.asyncIterator]: () => emptyChunks()[Symbol.asyncIterator](),
    });
    const respond = vi.fn();
    latestImplementation().ClientStream(stream, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ code: 14 });

    vi.spyOn(manager, 'executeUnaryCall').mockRejectedValueOnce(new Error('client boom'));
    const failingStream = Object.assign(new EventEmitter(), {
      metadata: { getMap: () => ({}) },
      [Symbol.asyncIterator]: () => emptyChunks()[Symbol.asyncIterator](),
    });
    const failingRespond = vi.fn();
    latestImplementation().ClientStream(failingStream, failingRespond);
    await vi.waitFor(() => expect(failingRespond).toHaveBeenCalled());
    await listener.stop();
  });

  it('handles bidi stream data, end, error, and status failures', async () => {
    const { listener } = await startListener(createGrpcMockRuntimeManager(), BIDI_RULE);
    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();

    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'chunk' }));
    bidi.emit('end');
    await vi.waitFor(() => expect(bidi.write).toHaveBeenCalled());
    expect(bidi.end).toHaveBeenCalled();

    const errorBidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      destroy: ReturnType<typeof vi.fn>;
    };
    errorBidi.metadata = { getMap: () => ({}) };
    errorBidi.destroy = vi.fn();
    latestImplementation().BidiStream(errorBidi);
    errorBidi.emit('error', new Error('bidi transport'));
    await vi.waitFor(() => expect(errorBidi.destroy).toHaveBeenCalled());

    await listener.stop();
  });

  it('truncates log buffer and filters getLogs by cursor', async () => {
    const { listener } = await startListener();
    for (let i = 0; i < 205; i += 1) {
      const respond = vi.fn();
      latestImplementation().Echo(makeUnaryStream(requestBuffer({ message: `msg-${i}` })), respond);
    }
    await vi.waitFor(() => expect(listener.getLogs().length).toBeLessThanOrEqual(200));
    const logs = listener.getLogs(100);
    expect(logs.every((entry) => entry.id > 100)).toBe(true);
    await listener.stop();
  });

  it('reports stopped status when manager is not running', async () => {
    const manager = createGrpcMockRuntimeManager();
    const listener = new GrpcMockNetworkListener('tab-stopped', manager);
    const status = listener.getStatus();
    expect(status.running).toBe(false);
    expect(status.listenTarget).toBeUndefined();
    await listener.stop();
  });

  it('allocates a port when start config omits port', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: ECHO_RULE_SET });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    const status = await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
    });
    expect(status.port).toBeGreaterThanOrEqual(GRPC_MOCK_LISTENER_PORT_MIN);
    expect(status.port).toBeLessThanOrEqual(GRPC_MOCK_LISTENER_PORT_MAX);
    await listener.stop();
  });

  it('exposes identity serialize and deserialize hooks on registered methods', async () => {
    const { listener } = await startListener();
    const { grpc } = await import('./grpcJsLoader.js');
    const serverInstance = vi.mocked(grpc.Server).mock.results.at(-1)?.value as {
      addService: ReturnType<typeof vi.fn>;
    };
    const serviceDef = serverInstance.addService.mock.calls[0]?.[0] as Record<string, {
      requestSerialize: (value: Buffer) => Buffer;
      responseSerialize: (value: Buffer) => Buffer;
    }>;
    const sample = Buffer.from('grpc');
    expect(serviceDef.Echo.requestSerialize(sample)).toBe(sample);
    expect(serviceDef.Echo.responseSerialize(sample)).toBe(sample);
    await listener.stop();
  });

  it('records server stream planning failures as INTERNAL stream errors', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: SERVER_STREAM_RULE });
    vi.spyOn(manager, 'planStreamCall').mockImplementation(() => {
      throw new Error('plan failed');
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const stream = makeServerWritableStream(
      encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.StreamRequest', { message: 'go' }),
    );
    latestImplementation().ServerStream(stream);
    await vi.waitFor(() => expect(stream.destroy).toHaveBeenCalled());
    expect(listener.getStatus().lastError).toBe('plan failed');
    await listener.stop();
  });

  it('destroys bidi streams on grpc errors without response bodies', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'bidi-fail',
          name: 'Bidi fail',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'BidiStream' },
          response: { statusCode: 14, message: 'bidi unavailable' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'chunk' }));
    await vi.waitFor(() => expect(bidi.destroy).toHaveBeenCalled());
    await listener.stop();
  });

  it('aggregates multiple client stream chunks into a messages array', async () => {
    const manager = createGrpcMockRuntimeManager();
    const executeUnaryCall = vi.spyOn(manager, 'executeUnaryCall');
    const { listener } = await startListener(manager, CLIENT_STREAM_RULE);
    async function* chunks() {
      yield requestBuffer({ message: 'one' });
      yield requestBuffer({ message: 'two' });
      yield requestBuffer({ message: 'three' });
    }
    const stream = Object.assign(new EventEmitter(), {
      metadata: { getMap: () => ({}) },
      [Symbol.asyncIterator]: () => chunks()[Symbol.asyncIterator](),
    });
    const respond = vi.fn();
    latestImplementation().ClientStream(stream, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(executeUnaryCall.mock.calls[0]?.[0]?.requestBody).toMatchObject({
      messages: expect.any(Array),
    });
    await listener.stop();
  });

  it('skips reserved ports while scanning for an open listener port', async () => {
    vi.spyOn(net, 'createServer').mockImplementation(() => {
      const probe = new EventEmitter() as net.Server & { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
      probe.listen = vi.fn((_port: number, _host: string, cb?: () => void) => {
        queueMicrotask(() => {
          probe.emit('listening');
          cb?.();
        });
      });
      probe.close = vi.fn((cb?: () => void) => cb?.());
      return probe;
    });

    const port = await tryAllocateGrpcMockListenerPort(new Set([50061, 50062]));
    expect(port).toBeGreaterThan(50062);
  });

  it('invokes deserialize hooks registered on service methods', async () => {
    const { listener } = await startListener();
    const { grpc } = await import('./grpcJsLoader.js');
    const serverInstance = vi.mocked(grpc.Server).mock.results.at(-1)?.value as {
      addService: ReturnType<typeof vi.fn>;
    };
    const echoMethod = serverInstance.addService.mock.calls[0]?.[0]?.Echo as {
      requestDeserialize: (bytes: Buffer) => Buffer;
      responseDeserialize: (bytes: Buffer) => Buffer;
    };
    const sample = Buffer.from('payload');
    expect(echoMethod.requestDeserialize(sample)).toBe(sample);
    expect(echoMethod.responseDeserialize(sample)).toBe(sample);
    await listener.stop();
  });

  it('returns grpc OK for null status codes on unary success', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'null-status',
          name: 'Null status',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { statusCode: 0, body: { message: 'ok' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
    await listener.stop();
  });

  it('maps unknown grpc status codes on unary grpc errors', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'weird',
          name: 'Weird',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { statusCode: 9999, message: 'weird', body: { message: 'still ok' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });

  it('maps grpc status codes from mock rules', async () => {
    const { grpc } = await import('./grpcJsLoader.js');
    expect(grpcMockGrpcStatusCodeFromRuleForTests(undefined)).toBe(grpc.status.OK);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(0)).toBe(grpc.status.OK);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(14)).toBe(grpc.status.UNAVAILABLE);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(9999)).toBe(grpc.status.UNKNOWN);
  });

  it('returns grpc OK when mock rule omits statusCode', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'no-status',
          name: 'No status',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { body: { message: 'ok' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });

  it('maps unknown grpc status codes on unary errors without response bodies', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'weird-error',
          name: 'Weird error',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'Echo' },
          response: { statusCode: 9999, message: 'weird failure' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const respond = vi.fn();
    latestImplementation().Echo(makeUnaryStream(requestBuffer()), respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ code: 2, details: 'weird failure' });
    await listener.stop();
  });

  it('ignores duplicate stop settlement callbacks', async () => {
    const { listener } = await startListener();
    const { grpc } = await import('./grpcJsLoader.js');
    const serverInstance = vi.mocked(grpc.Server).mock.results.at(-1)?.value as {
      tryShutdown: ReturnType<typeof vi.fn>;
    };
    serverInstance.tryShutdown.mockImplementation((cb: () => void) => {
      cb();
      cb();
    });

    await listener.stop();
  });

  it('uses requested port when bindAsync omits boundPort', async () => {
    const { grpc } = await import('./grpcJsLoader.js');
    vi.mocked(grpc.Server).mockImplementationOnce(function MockServer(this: {
      addService: ReturnType<typeof vi.fn>;
      bindAsync: ReturnType<typeof vi.fn>;
      tryShutdown: ReturnType<typeof vi.fn>;
      forceShutdown: ReturnType<typeof vi.fn>;
    }) {
      this.addService = vi.fn((_def, impl) => {
        grpcMocks.capturedImplementations.push(impl);
      });
      this.bindAsync = vi.fn((_addr, _creds, cb: (error: Error | null, port?: number) => void) => {
        queueMicrotask(() => cb(null));
      });
      this.tryShutdown = vi.fn((cb: () => void) => queueMicrotask(() => cb()));
      this.forceShutdown = vi.fn();
    });

    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: ECHO_RULE_SET });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    const status = await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50077,
    });
    expect(status.port).toBe(50077);
    await listener.stop();
  });

  it('ignores duplicate bidi shutdown work after the stream closes', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'bidi-close',
          name: 'Bidi close',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'BidiStream' },
          response: { statusCode: 14, message: 'closed' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'chunk' }));
    bidi.emit('end');
    bidi.emit('error', new Error('late error'));
    await vi.waitFor(() => expect(bidi.destroy).toHaveBeenCalled());
    await listener.stop();
  });

  it('ignores additional bidi chunks after grpc error closes the stream', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'bidi-fail',
          name: 'Bidi fail',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'BidiStream' },
          response: { statusCode: 14, message: 'bidi unavailable' },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'first' }));
    await vi.waitFor(() => expect(bidi.destroy).toHaveBeenCalled());
    bidi.emit('data', requestBuffer({ message: 'second' }));
    bidi.emit('end');
    await listener.stop();
  });

  it('writes bidi responses when mock rule omits statusCode', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'bidi-no-status',
          name: 'Bidi no status',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'BidiStream' },
          response: { body: { message: 'ack-without-status' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'chunk' }));
    bidi.emit('end');
    await vi.waitFor(() => expect(bidi.write).toHaveBeenCalled());
    expect(bidi.end).toHaveBeenCalled();
    await listener.stop();
  });

  it('handles string failures while processing bidi chunks', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: BIDI_RULE });
    vi.spyOn(manager, 'executeUnaryCall').mockRejectedValueOnce('plain failure');
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.write = vi.fn();
    bidi.end = vi.fn();
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('data', requestBuffer({ message: 'chunk' }));
    await vi.waitFor(() => expect(bidi.destroy).toHaveBeenCalled());
    expect(listener.getStatus().lastError).toBe('plain failure');
    await listener.stop();
  });

  it('ignores duplicate bidi error callbacks after the stream closes', async () => {
    const { listener } = await startListener(createGrpcMockRuntimeManager(), BIDI_RULE);
    const bidi = new EventEmitter() as EventEmitter & {
      metadata: { getMap: () => Record<string, string> };
      destroy: ReturnType<typeof vi.fn>;
    };
    bidi.metadata = { getMap: () => ({}) };
    bidi.destroy = vi.fn();
    latestImplementation().BidiStream(bidi);
    bidi.emit('error', new Error('first'));
    bidi.emit('error', new Error('second'));
    await vi.waitFor(() => expect(bidi.destroy).toHaveBeenCalledTimes(1));
    await listener.stop();
  });

  it('stringifies plain string metadata values for unary calls', async () => {
    const { listener } = await startListener();
    const respond = vi.fn();
    latestImplementation().Echo(
      makeUnaryStream(requestBuffer(), { 'x-text': 'plain-text' }),
      respond,
    );
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });

  it('returns client stream responses when mock rule omits statusCode', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: {
        rules: [{
          id: 'client-no-status',
          name: 'Client no status',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals' as const, method: 'ClientStream' },
          response: { body: { message: 'client-ok' } },
        }],
      },
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptor: FIXTURE_DESCRIPTOR,
      port: 50061,
    });

    async function* chunks() {
      yield requestBuffer({ message: 'one' });
    }
    const stream = Object.assign(new EventEmitter(), {
      metadata: { getMap: () => ({}) },
      [Symbol.asyncIterator]: () => chunks()[Symbol.asyncIterator](),
    });
    const respond = vi.fn();
    latestImplementation().ClientStream(stream, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer)));
    await listener.stop();
  });
});
