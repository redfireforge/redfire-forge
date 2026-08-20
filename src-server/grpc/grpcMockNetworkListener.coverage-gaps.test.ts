/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockServer = EventEmitter & {
  once: (event: string, handler: (...args: unknown[]) => void) => MockServer;
  close: (callback: () => void) => void;
  listen: (port: number, host: string) => void;
};

const mockCreateServer = vi.fn();
const mockBindAsync = vi.fn();
const mockAddService = vi.fn();
const mockTryShutdown = vi.fn();
const mockForceShutdown = vi.fn();
const mockServerCtor = vi.fn(function MockGrpcServer(this: Record<string, unknown>) {
  this.addService = mockAddService;
  this.bindAsync = mockBindAsync;
  this.tryShutdown = mockTryShutdown;
  this.forceShutdown = mockForceShutdown;
});
const mockMetadataGetMap = vi.fn(() => ({}));
const mockDecodeProtoMessage = vi.fn((_descriptor, _typeName, value) => value);
const mockEncodeProtoMessage = vi.fn((_descriptor, _typeName, value) => Buffer.from(JSON.stringify(value)));

vi.mock('./grpcJsLoader.js', () => ({
  grpc: {
    status: { 0: 'OK', 2: 'UNKNOWN', 13: 'INTERNAL', OK: 0, UNKNOWN: 2, INTERNAL: 13 },
    Metadata: vi.fn(function Metadata(this: { getMap: () => Record<string, string> }) {
      this.getMap = mockMetadataGetMap as () => Record<string, string>;
    }),
    ServerCredentials: { createInsecure: vi.fn(() => ({})) },
    Server: mockServerCtor,
  },
}));

vi.mock('node:net', () => ({
  default: {
    createServer: (...args: unknown[]) => mockCreateServer(...args),
  },
}));

vi.mock('./dynamicProtoCodec.js', () => ({
  decodeProtoMessage: (...args: unknown[]) => mockDecodeProtoMessage(...args),
  encodeProtoMessage: (...args: unknown[]) => mockEncodeProtoMessage(...args),
}));

const loadModule = async () => import('./grpcMockNetworkListener.js');

function makeDescriptor() {
  return {
    key: 'descriptor-1',
    services: [
      {
        fullName: 'demo.EchoService',
        methods: [
          { name: 'Unary', callType: 'unary', requestTypeName: 'demo.Request', responseTypeName: 'demo.Response' },
          { name: 'ServerStream', callType: 'server_streaming', requestTypeName: 'demo.Request', responseTypeName: 'demo.Response' },
          { name: 'ClientStream', callType: 'client_streaming', requestTypeName: 'demo.Request', responseTypeName: 'demo.Response' },
          { name: 'Bidi', callType: 'bidi_streaming', requestTypeName: 'demo.Request', responseTypeName: 'demo.Response' },
        ],
      },
    ],
  } as never;
}

function makeDescriptorWithBareService() {
  return {
    key: 'descriptor-2',
    services: [
      {
        fullName: 'demo.EmptyService',
        methods: [],
      },
    ],
  } as never;
}

function makeManager(overrides: Record<string, unknown> = {}) {
  return {
    getState: vi.fn(() => ({ operation: { status: 'running' }, committed: { generation: 7 }, inFlightCount: 2 })),
    executeUnaryCall: vi.fn(async () => ({
      evaluation: { ruleName: 'rule-1', response: { statusCode: 0, message: 'ok', body: { ok: true } } },
      generation: 7,
    })),
    planStreamCall: vi.fn(() => ({
      evaluation: { ruleName: 'rule-stream', response: { statusCode: 0, message: 'ok' } },
      generation: 7,
      messages: [{ delayBeforeMs: 0, body: { ok: true } }],
    })),
    ...overrides,
  } as never;
}

function makeUnaryStream(request: Buffer = Buffer.from('req')) {
  return {
    request,
    metadata: { getMap: () => ({ auth: 'x' }) },
  } as never;
}

function makeServerWritableStream(request: Buffer = Buffer.from('req')) {
  return {
    request,
    metadata: { getMap: () => ({ auth: 'x' }) },
    write: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
  } as never;
}

function makeClientStream(chunks: Buffer[]) {
  return {
    metadata: { getMap: () => ({ auth: 'x' }) },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as never;
}

function makeBidiStream() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    metadata: { getMap: () => ({ auth: 'x' }) },
    write: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    emitData: (chunk: Buffer) => handlers.data?.(chunk),
    emitEnd: () => handlers.end?.(),
    emitError: (error: Error) => handlers.error?.(error),
  } as never;
}

async function flushMicrotasks(times = 3): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => {
  mockCreateServer.mockReset();
  mockBindAsync.mockReset();
  mockAddService.mockReset();
  mockTryShutdown.mockReset();
  mockForceShutdown.mockReset();
  mockServerCtor.mockClear();
  mockMetadataGetMap.mockReset();
  mockMetadataGetMap.mockReturnValue({});
  mockDecodeProtoMessage.mockReset();
  mockDecodeProtoMessage.mockImplementation((_descriptor, _typeName, value) => value);
  mockEncodeProtoMessage.mockReset();
  mockEncodeProtoMessage.mockImplementation((_descriptor, _typeName, value) => Buffer.from(JSON.stringify(value)));
});

describe('grpcMockNetworkListener helper coverage', () => {
  it('maps out-of-range status codes to UNKNOWN', async () => {
    const { grpcMockGrpcStatusCodeFromRuleForTests, grpcMockServiceErrorForTests } = await loadModule();

    expect(grpcMockGrpcStatusCodeFromRuleForTests(undefined)).toBe(0);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(0)).toBe(0);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(2)).toBe(2);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(13)).toBe(13);
    expect(grpcMockGrpcStatusCodeFromRuleForTests(999)).toBe(2);

    const serviceError = grpcMockServiceErrorForTests(7, 'denied');
    expect(serviceError).toMatchObject({ name: 'ServiceError', message: 'denied', details: 'denied', code: 2 });
    expect(serviceError.metadata).toBeTruthy();
  });

  it('metadataToRecord stringifies buffers and strings through unary execution metadata', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50060));
    const manager = makeManager();
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50060 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown, respond: unknown) => void>;
    const respond = vi.fn();
    const stream = {
      request: Buffer.from('hello'),
      metadata: { getMap: () => ({ token: Buffer.from('abc'), flag: 'on' }) },
    } as never;

    impl.Unary(stream, respond);
    await Promise.resolve();
    expect(manager.executeUnaryCall).toHaveBeenCalledWith(expect.objectContaining({ metadata: { token: 'abc', flag: 'on' } }));
  });

  it('buildMethodDefinition derives all streaming flag combinations through start registration', async () => {
    const { GrpcMockNetworkListener, grpcMockBuildMethodDefinitionForTests } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50059));
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50059 });

    const serviceDef = mockAddService.mock.calls[0][0] as Record<string, { requestStream: boolean; responseStream: boolean; path: string }>;
    expect(serviceDef.Unary.requestStream).toBe(false);
    expect(serviceDef.Unary.responseStream).toBe(false);
    expect(serviceDef.ServerStream.requestStream).toBe(false);
    expect(serviceDef.ServerStream.responseStream).toBe(true);
    expect(serviceDef.ClientStream.requestStream).toBe(true);
    expect(serviceDef.ClientStream.responseStream).toBe(false);
    expect(serviceDef.Bidi.requestStream).toBe(true);
    expect(serviceDef.Bidi.responseStream).toBe(true);
    expect(serviceDef.Unary.path).toBe('/demo.EchoService/Unary');

    const rawMethodDef = mockAddService.mock.calls[0][0].Unary as {
      requestSerialize: (value: Buffer) => Buffer;
      requestDeserialize: (value: Buffer) => Buffer;
      responseSerialize: (value: Buffer) => Buffer;
      responseDeserialize: (value: Buffer) => Buffer;
    };
    const probe = Buffer.from('probe');
    expect(rawMethodDef.requestSerialize(probe)).toBe(probe);
    expect(rawMethodDef.requestDeserialize(probe)).toBe(probe);
    expect(rawMethodDef.responseSerialize(probe)).toBe(probe);
    expect(rawMethodDef.responseDeserialize(probe)).toBe(probe);

    const direct = grpcMockBuildMethodDefinitionForTests('demo.Test', {
      name: 'Unary',
      callType: 'unary',
      requestTypeName: 'demo.Request',
      responseTypeName: 'demo.Response',
    } as never);
    expect(direct.requestSerialize(probe)).toBe(probe);
    expect(direct.requestDeserialize(probe)).toBe(probe);
    expect(direct.responseSerialize(probe)).toBe(probe);
    expect(direct.responseDeserialize(probe)).toBe(probe);

    const bidiDirect = grpcMockBuildMethodDefinitionForTests('demo.Test', {
      name: 'Bidi',
      callType: 'bidi_streaming',
      requestTypeName: 'demo.Request',
      responseTypeName: 'demo.Response',
    } as never);
    expect(bidiDirect.requestStream).toBe(true);
    expect(bidiDirect.responseStream).toBe(true);
  });

  it('returns the first available non-reserved port', async () => {
    const { tryAllocateGrpcMockListenerPort } = await loadModule();
    const servers: MockServer[] = [];

    mockCreateServer.mockImplementation(() => {
      const server = new EventEmitter() as MockServer;
      server.once = function once(event: string, handler: (...args: unknown[]) => void) {
        EventEmitter.prototype.once.call(this, event, handler);
        return this;
      };
      server.close = (callback: () => void) => callback();
      server.listen = (port: number, host: string) => {
        if (port === 50061) {
          queueMicrotask(() => server.emit('error', new Error('in use')));
        } else {
          queueMicrotask(() => server.emit('listening'));
        }
        void host;
      };
      servers.push(server);
      return server;
    });

    await expect(tryAllocateGrpcMockListenerPort(new Set(), 50061)).resolves.toBe(50062);
    expect(servers).toHaveLength(2);
  });

  it('throws when every scanned port is unavailable', async () => {
    const { tryAllocateGrpcMockListenerPort } = await loadModule();

    mockCreateServer.mockImplementation(() => {
      const server = new EventEmitter() as MockServer;
      server.once = function once(event: string, handler: (...args: unknown[]) => void) {
        EventEmitter.prototype.once.call(this, event, handler);
        return this;
      };
      server.close = (callback: () => void) => callback();
      server.listen = () => {
        queueMicrotask(() => server.emit('error', new Error('in use')));
      };
      return server;
    });

    await expect(tryAllocateGrpcMockListenerPort(new Set())).rejects.toThrow(/No available gRPC mock listener port/i);
  });

  it('starts the listener, reports running status, and returns existing status on duplicate start', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50077));
    const manager = makeManager();
    const listener = new GrpcMockNetworkListener('tab-1', manager);

    const status = await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50077 });
    expect(status.running).toBe(true);
    expect(status.port).toBe(50077);
    expect(status.connectionId).toBe('conn-1');
    expect(status.descriptorKey).toBe('descriptor-1');
    expect(mockAddService).toHaveBeenCalled();
    const addedImpl = mockAddService.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(addedImpl).sort()).toEqual(['Bidi', 'ClientStream', 'ServerStream', 'Unary']);
    expect(listener.getLogs()).toHaveLength(1);

    const second = await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50078 });
    expect(second.port).toBe(50077);
  });

  it('getStatus reports not running when operation is not running or port/server is absent', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    const manager = makeManager({ getState: vi.fn(() => ({ operation: { status: 'idle' }, committed: undefined, inFlightCount: 0 })) });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    const before = listener.getStatus();
    expect(before.running).toBe(false);
    expect(before.listenTarget).toBeUndefined();
    expect(before.generation).toBe(0);
  });

  it('uses requested port when bindAsync returns undefined bound port and surfaces bind errors', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementationOnce((_addr, _creds, cb) => cb(null, undefined));
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    const status = await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50090 });
    expect(status.port).toBe(50090);

    mockBindAsync.mockImplementationOnce((_addr, _creds, cb) => cb(new Error('bind failed')));
    const failing = new GrpcMockNetworkListener('tab-2', makeManager());
    await expect(failing.start({ tabId: 'tab-2', connectionId: 'conn-2', descriptor: makeDescriptor(), port: 50091 })).rejects.toThrow('bind failed');
  });

  it('reallocates an automatic port after an EADDRINUSE bind race', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockCreateServer.mockImplementation(() => {
      const server = new EventEmitter() as MockServer;
      server.once = function once(event: string, handler: (...args: unknown[]) => void) {
        EventEmitter.prototype.once.call(this, event, handler);
        return this;
      };
      server.close = (callback: () => void) => callback();
      server.listen = () => { queueMicrotask(() => server.emit('listening')); };
      return server;
    });
    mockBindAsync
      .mockImplementationOnce((_addr, _creds, cb) => cb(new Error('listen EADDRINUSE: address already in use')))
      .mockImplementationOnce((_addr, _creds, cb) => cb(null, 50062));

    const listener = new GrpcMockNetworkListener('tab-race', makeManager());
    const status = await listener.start({ tabId: 'tab-race', connectionId: 'conn-race', descriptor: makeDescriptor() });

    expect(status.port).toBe(50062);
    expect(mockBindAsync).toHaveBeenCalledTimes(2);
    expect(mockForceShutdown).toHaveBeenCalledTimes(1);
  });

  it('allocates a port when start is called without an explicit port', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockCreateServer.mockImplementationOnce(() => {
      const server = new EventEmitter() as MockServer;
      server.once = function once(event: string, handler: (...args: unknown[]) => void) {
        EventEmitter.prototype.once.call(this, event, handler);
        return this;
      };
      server.close = (callback: () => void) => callback();
      server.listen = () => { queueMicrotask(() => server.emit('listening')); };
      return server;
    });
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50095));
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    const status = await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor() });
    expect(status.port).toBe(50095);
  });

  it('start registers an empty implementation object when a service has no handlers mapped', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50058));
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptorWithBareService(), port: 50058 });
    expect(mockAddService.mock.calls[0][1]).toEqual({});
  });

  it('stops running server and falls back to forceShutdown timer path', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    vi.useFakeTimers();
    try {
      mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50079));
      mockTryShutdown.mockImplementation(() => {
        // intentionally never invokes callback
      });
      const manager = makeManager();
      const listener = new GrpcMockNetworkListener('tab-1', manager);
      await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50079 });

      const stopPromise = listener.stop();
      await vi.advanceTimersByTimeAsync(3001);
      const status = await stopPromise;
      expect(mockForceShutdown).toHaveBeenCalled();
      expect(status.running).toBe(false);
      expect(listener.getLogs().at(-1)?.event).toBe('listener-stop');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop clears port even when server was never started', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    const status = await listener.stop();
    expect(status.running).toBe(false);
    expect(status.port).toBeUndefined();
  });

  it('trims log buffer and filters getLogs by cursor', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    for (let index = 0; index < 205; index += 1) {
      (listener as never as { pushLog: (event: string, fields?: Record<string, unknown>) => void }).pushLog('listener-stop', { detail: String(index) });
    }
    const logs = listener.getLogs();
    expect(logs).toHaveLength(200);
    expect(logs[0].detail).toBe('5');
    expect(listener.getLogs(logs.at(-2)?.id ?? -1)).toHaveLength(1);
  });

  it('unary handler responds with encoded body and logs success', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50080));
    const manager = makeManager();
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50080 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown, respond: unknown) => void>;
    const respond = vi.fn();

    impl.Unary(makeUnaryStream(Buffer.from('hello')), respond);
    await Promise.resolve();

    expect(manager.executeUnaryCall).toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer));
    expect(listener.getLogs().some((entry) => entry.event === 'rpc-unary')).toBe(true);
  });

  it('unary handler returns service error for status with no body and catches thrown errors', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50081));
    const manager = makeManager({
      executeUnaryCall: vi.fn(async () => ({
        evaluation: { ruleName: 'rule-1', response: { statusCode: 7, message: 'denied', body: undefined } },
        generation: 8,
      })),
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50081 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown, respond: unknown) => void>;
    const respond = vi.fn();

    impl.Unary(makeUnaryStream(Buffer.from('hello')), respond);
    await Promise.resolve();
    expect(respond.mock.calls[0][0]).toMatchObject({ details: 'denied' });

    manager.executeUnaryCall = vi.fn(async () => { throw new Error('boom'); });
    impl.Unary(makeUnaryStream(Buffer.from('hello')), respond);
    await Promise.resolve();
    expect(listener.getStatus().lastError).toBe('boom');
  });

  it('unary handler returns encoded empty object when status is non-zero but body exists', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50092));
    const manager = makeManager({
      executeUnaryCall: vi.fn(async () => ({
        evaluation: { ruleName: 'rule-1', response: { statusCode: 9, message: 'warn', body: { ok: false } } },
        generation: 10,
      })),
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50092 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown, respond: unknown) => void>;
    const respond = vi.fn();

    impl.Unary(makeUnaryStream(Buffer.from('hello')), respond);
    await Promise.resolve();
    expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer));
    expect(listener.getLogs().some((entry) => entry.statusCode === 9)).toBe(true);

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-1', response: { statusCode: undefined, message: undefined, body: undefined } },
      generation: 10,
    }));
    impl.Unary(makeUnaryStream(Buffer.from('hello')), respond);
    await Promise.resolve();
    expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer));
  });

  it('server streaming writes all messages, supports delayed messages, and destroys on error status or thrown error', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    vi.useFakeTimers();
    try {
      mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50082));
      const manager = makeManager({
        planStreamCall: vi.fn(() => ({
          evaluation: { ruleName: 'rule-stream', response: { statusCode: 0, message: 'ok' } },
          generation: 9,
          messages: [{ delayBeforeMs: 10, body: { one: 1 } }, { delayBeforeMs: 0, body: { two: 2 } }],
        })),
      });
      const listener = new GrpcMockNetworkListener('tab-1', manager);
      await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50082 });
      const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
      const stream = makeServerWritableStream(Buffer.from('hello'));

      impl.ServerStream(stream);
      await vi.advanceTimersByTimeAsync(20);
      expect(stream.write).toHaveBeenCalledTimes(2);
      expect(stream.end).toHaveBeenCalled();

      manager.planStreamCall = vi.fn(() => ({
        evaluation: { ruleName: 'rule-stream', response: { statusCode: 3, message: 'bad' } },
        generation: 9,
        messages: [],
      }));
      impl.ServerStream(stream);
      await Promise.resolve();
      expect(stream.destroy).toHaveBeenCalled();

      manager.planStreamCall = vi.fn(() => { throw new Error('stream fail'); });
      impl.ServerStream(stream);
      await Promise.resolve();
      expect(listener.getStatus().lastError).toBe('stream fail');
    } finally {
      vi.useRealTimers();
    }
  });

  it('server streaming still ends when status is non-zero but messages are present', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50093));
    const manager = makeManager({
      planStreamCall: vi.fn(() => ({
        evaluation: { ruleName: 'rule-stream', response: { statusCode: 4, message: 'warn' } },
        generation: 11,
        messages: [{ delayBeforeMs: 0, body: { ok: true } }],
      })),
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50093 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
    const stream = makeServerWritableStream(Buffer.from('hello'));
    impl.ServerStream(stream);
    await Promise.resolve();
    expect(stream.write).toHaveBeenCalledTimes(1);
    expect(stream.end).toHaveBeenCalled();
    expect(listener.getLogs().some((entry) => entry.statusCode === 4)).toBe(true);

    manager.planStreamCall = vi.fn(() => ({
      evaluation: { ruleName: 'rule-stream', response: { statusCode: undefined, message: undefined } },
      generation: 11,
      messages: [{ delayBeforeMs: 0, body: { again: true } }],
    }));
    impl.ServerStream(stream);
    await Promise.resolve();
    expect(stream.write).toHaveBeenCalled();
  });

  it('client streaming aggregates parts, handles single message body, and reports errors', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50083));
    const manager = makeManager();
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    const descriptor = makeDescriptor();
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor, port: 50083 });
    const respond = vi.fn();
    const method = descriptor.services[0].methods[2];

    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([Buffer.from('one'), Buffer.from('two')]),
      respond,
    );
    expect(manager.executeUnaryCall).toHaveBeenCalledWith(expect.objectContaining({ requestBody: { messages: [Buffer.from('one'), Buffer.from('two')] } }));

    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([Buffer.from('solo')]),
      respond,
    );
    expect(manager.executeUnaryCall).toHaveBeenLastCalledWith(expect.objectContaining({ requestBody: Buffer.from('solo') }));

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-client', response: { statusCode: 5, message: 'warn', body: { accepted: true } } },
      generation: 12,
    }));
    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([]),
      respond,
    );
    expect(manager.executeUnaryCall).toHaveBeenLastCalledWith(expect.objectContaining({ requestBody: {} }));

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-client', response: { statusCode: 3, message: 'bad', body: undefined } },
      generation: 13,
    }));
    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([Buffer.from('solo')]),
      respond,
    );
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ details: 'bad' }));
    expect(listener.getLogs().some((entry) => entry.event === 'rpc-client-stream' && entry.statusCode === 3)).toBe(true);

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-client', response: { statusCode: undefined, message: undefined, body: undefined } },
      generation: 13,
    }));
    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([Buffer.from('solo')]),
      respond,
    );
    expect(respond).toHaveBeenCalledWith(null, expect.any(Buffer));

    manager.executeUnaryCall = vi.fn(async () => { throw new Error('client stream fail'); });
    await (listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }).handleClientStreamCall(
      descriptor,
      'demo.EchoService',
      method,
      makeClientStream([Buffer.from('solo')]),
      respond,
    );
    expect(listener.getStatus().lastError).toBe('client stream fail');
  });

  it('createClientStreamHandler wrapper delegates to handleClientStreamCall', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    const listener = new GrpcMockNetworkListener('tab-1', makeManager());
    const descriptor = makeDescriptor();
    const method = descriptor.services[0].methods[2];
    const delegate = vi.spyOn(listener as never as { handleClientStreamCall: (...args: unknown[]) => Promise<void> }, 'handleClientStreamCall').mockResolvedValue(undefined);
    const handler = (listener as never as { createClientStreamHandler: (...args: unknown[]) => (stream: unknown, respond: unknown) => void }).createClientStreamHandler(
      descriptor,
      'demo.EchoService',
      method,
    );
    const respond = vi.fn();
    handler(makeClientStream([Buffer.from('x')]), respond);
    await flushMicrotasks();
    expect(delegate).toHaveBeenCalled();
  });

  it('bidi streaming writes responses, emits grpc errors for status-only failures, ends cleanly, and handles stream errors', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50084));
    const manager = makeManager();
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50084 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
    const stream = makeBidiStream();

    impl.Bidi(stream);
    stream.emitData(Buffer.from('hello'));
  await flushMicrotasks();
    expect(stream.write).toHaveBeenCalled();

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-bidi', response: { statusCode: 7, message: 'denied', body: undefined } },
      generation: 9,
    }));
    stream.emitData(Buffer.from('fail'));
    await flushMicrotasks();
    expect(stream.destroy).toHaveBeenCalled();

    const endStream = makeBidiStream();
    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-bidi', response: { statusCode: 0, message: 'ok', body: { ok: true } } },
      generation: 9,
    }));
    impl.Bidi(endStream);
    endStream.emitEnd();
    await flushMicrotasks();
    expect(endStream.end).toHaveBeenCalled();

    const errorStream = makeBidiStream();
    impl.Bidi(errorStream);
    errorStream.emitError(new Error('socket broke'));
    await flushMicrotasks();
    expect(listener.getStatus().lastError).toBe('socket broke');
  });

  it('bidi streaming ignores failures after closure and keeps writing when non-zero status includes a body', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50094));
    const manager = makeManager({
      executeUnaryCall: vi.fn(async () => ({
        evaluation: { ruleName: 'rule-bidi', response: { statusCode: 6, message: 'warn', body: { ok: true } } },
        generation: 13,
      })),
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50094 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
    const stream = makeBidiStream();

    impl.Bidi(stream);
    stream.emitData(Buffer.from('hello'));
    await flushMicrotasks();
    expect(stream.write).toHaveBeenCalled();

    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-bidi', response: { statusCode: undefined, message: undefined, body: undefined } },
      generation: 13,
    }));
    const stream2 = makeBidiStream();
    impl.Bidi(stream2);
    stream2.emitData(Buffer.from('again'));
    await flushMicrotasks();
    expect(stream2.write).toHaveBeenCalled();

    stream.emitEnd();
    await flushMicrotasks();
    const destroyCount = stream.destroy.mock.calls.length;
    stream.emitError(new Error('late error'));
    await flushMicrotasks();
    expect(stream.destroy.mock.calls.length).toBe(destroyCount);
  });

  it('bidi streaming catches rejected executeUnaryCall promises through fail()', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50095));
    const manager = makeManager({ executeUnaryCall: vi.fn(async () => { throw new Error('bidi rejected'); }) });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor: makeDescriptor(), port: 50095 });
    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
    const stream = makeBidiStream();
    impl.Bidi(stream);
    stream.emitData(Buffer.from('hello'));
    await flushMicrotasks();
    expect(stream.destroy).toHaveBeenCalled();
    expect(listener.getStatus().lastError).toBe('bidi rejected');

    const closedFirst = makeBidiStream();
    impl.Bidi(closedFirst);
    closedFirst.emitError(new Error('close first'));
    await flushMicrotasks();
    closedFirst.emitData(Buffer.from('late'));
    await flushMicrotasks();
    expect(closedFirst.write).not.toHaveBeenCalled();
  });

  it('bidi end after error does not call end again and unary/server/client wrappers are constructible', async () => {
    const { GrpcMockNetworkListener } = await loadModule();
    mockBindAsync.mockImplementation((_addr, _creds, cb) => cb(null, 50096));
    const manager = makeManager({
      executeUnaryCall: vi.fn(async () => ({
        evaluation: { ruleName: 'rule-bidi', response: { statusCode: 7, message: 'denied', body: undefined } },
        generation: 14,
      })),
    });
    const listener = new GrpcMockNetworkListener('tab-1', manager);
    const descriptor = makeDescriptor();
    await listener.start({ tabId: 'tab-1', connectionId: 'conn-1', descriptor, port: 50096 });

    const unaryWrapper = (listener as never as { createUnaryHandler: (...args: unknown[]) => unknown }).createUnaryHandler(descriptor, 'demo.EchoService', descriptor.services[0].methods[0]);
    const serverWrapper = (listener as never as { createServerStreamHandler: (...args: unknown[]) => unknown }).createServerStreamHandler(descriptor, 'demo.EchoService', descriptor.services[0].methods[1]);
    const clientWrapper = (listener as never as { createClientStreamHandler: (...args: unknown[]) => unknown }).createClientStreamHandler(descriptor, 'demo.EchoService', descriptor.services[0].methods[2]);
    expect(unaryWrapper).toBeTypeOf('function');
    expect(serverWrapper).toBeTypeOf('function');
    expect(clientWrapper).toBeTypeOf('function');

    const impl = mockAddService.mock.calls[0][1] as Record<string, (stream: unknown) => void>;
    const stream = makeBidiStream();
    impl.Bidi(stream);
    stream.emitData(Buffer.from('hello'));
    await flushMicrotasks();
    const endCallsBefore = stream.end.mock.calls.length;
    stream.emitEnd();
    await flushMicrotasks();
    expect(stream.end.mock.calls.length).toBe(endCallsBefore);

    const cleanStream = makeBidiStream();
    manager.executeUnaryCall = vi.fn(async () => ({
      evaluation: { ruleName: 'rule-bidi', response: { statusCode: 0, message: 'ok', body: { ok: true } } },
      generation: 14,
    }));
    impl.Bidi(cleanStream);
    cleanStream.emitData(Buffer.from('hello'));
    await flushMicrotasks();
    cleanStream.emitEnd();
    await flushMicrotasks();
    expect(cleanStream.end).toHaveBeenCalledTimes(1);
  });
});