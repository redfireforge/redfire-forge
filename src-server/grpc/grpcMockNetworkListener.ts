/**
 * Phase 11M — dialable gRPC mock listener using @grpc/grpc-js + embedded rule snapshot.
 */
import { grpc } from './grpcJsLoader.js';
import net from 'node:net';
import type { GrpcCallType, GrpcDescriptor, GrpcMethodInfo } from '../../src/shared/grpc/contracts.js';
import type { GrpcMockRuntimeManager } from '../../src/shared/grpc/grpcMockRuntimeCore.js';
import type {
  GrpcMockListenerLogEntry,
  GrpcMockListenerLogEvent,
  GrpcMockListenerStatus,
} from '../../src/shared/grpc/grpcMockListenerContracts.js';
import {
  GRPC_MOCK_LISTENER_PORT_MAX,
  GRPC_MOCK_LISTENER_PORT_MIN,
} from '../../src/shared/grpc/grpcMockListenerContracts.js';
import { decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';

const MAX_LOG_ENTRIES = 200;
const LISTEN_HOST = '127.0.0.1';

export interface GrpcMockNetworkListenerStartConfig {
  tabId: string;
  connectionId: string;
  descriptor: GrpcDescriptor;
  port?: number;
}

function metadataToRecord(metadata: grpc.Metadata): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata.getMap())) {
    result[key] = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  }
  return result;
}

function grpcStatusCodeFromRule(statusCode: number | undefined): grpc.status {
  if (statusCode == null || statusCode === 0) {
    return grpc.status.OK;
  }
  if (statusCode in grpc.status) {
    return statusCode as grpc.status;
  }
  return grpc.status.UNKNOWN;
}

function grpcServiceError(
  statusCode: number | undefined,
  details: string,
): grpc.ServiceError {
  return {
    name: 'ServiceError',
    message: details,
    code: grpcStatusCodeFromRule(statusCode),
    details,
    metadata: new grpc.Metadata(),
  };
}

function buildMethodDefinition(
  serviceFullName: string,
  method: GrpcMethodInfo,
): grpc.MethodDefinition<Buffer, Buffer> {
  const requestStream = method.callType === 'client_streaming' || method.callType === 'bidi_streaming';
  const responseStream = method.callType === 'server_streaming' || method.callType === 'bidi_streaming';
  return {
    path: `/${serviceFullName}/${method.name}`,
    requestStream,
    responseStream,
    requestSerialize: (value: Buffer) => value,
    requestDeserialize: (bytes: Buffer) => bytes,
    responseSerialize: (value: Buffer) => value,
    responseDeserialize: (bytes: Buffer) => bytes,
  };
}

function buildServiceDefinition(
  descriptor: GrpcDescriptor,
  serviceFullName: string,
  methods: GrpcMethodInfo[],
): grpc.ServiceDefinition {
  const definition: grpc.ServiceDefinition = {};
  for (const method of methods) {
    definition[method.name] = buildMethodDefinition(serviceFullName, method);
  }
  return definition;
}

export async function tryAllocateGrpcMockListenerPort(
  reserved: ReadonlySet<number>,
  preferred?: number,
): Promise<number> {
  const candidates: number[] = [];
  if (preferred != null && preferred >= GRPC_MOCK_LISTENER_PORT_MIN && preferred <= GRPC_MOCK_LISTENER_PORT_MAX) {
    candidates.push(preferred);
  }
  for (let port = GRPC_MOCK_LISTENER_PORT_MIN; port <= GRPC_MOCK_LISTENER_PORT_MAX; port += 1) {
    if (port === preferred) continue;
    candidates.push(port);
  }

  for (const port of candidates) {
    if (reserved.has(port)) continue;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available gRPC mock listener port in range ${GRPC_MOCK_LISTENER_PORT_MIN}–${GRPC_MOCK_LISTENER_PORT_MAX}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, LISTEN_HOST);
  });
}

export class GrpcMockNetworkListener {
  private readonly tabId: string;
  private readonly manager: GrpcMockRuntimeManager;
  private descriptor: GrpcDescriptor | undefined;
  private connectionId: string | undefined;
  private grpcServer: grpc.Server | undefined;
  private port: number | undefined;
  private logBuffer: GrpcMockListenerLogEntry[] = [];
  private logCursor = 0;
  private lastError: string | undefined;
  private startedAt: string | undefined;

  constructor(tabId: string, manager: GrpcMockRuntimeManager) {
    this.tabId = tabId;
    this.manager = manager;
  }

  private pushLog(
    event: GrpcMockListenerLogEvent,
    fields: Partial<Omit<GrpcMockListenerLogEntry, 'id' | 'ts' | 'event'>> = {},
  ): void {
    this.logBuffer.push({
      id: this.logCursor,
      ts: new Date().toISOString(),
      event,
      ...fields,
    });
    this.logCursor += 1;
    if (this.logBuffer.length > MAX_LOG_ENTRIES) {
      this.logBuffer = this.logBuffer.slice(-MAX_LOG_ENTRIES);
    }
  }

  getLogs(since = -1): GrpcMockListenerLogEntry[] {
    return this.logBuffer.filter((entry) => entry.id > since);
  }

  getStatus(): GrpcMockListenerStatus {
    const state = this.manager.getState();
    const running = state.operation.status === 'running' && this.grpcServer != null && this.port != null;
    return {
      running,
      tabId: this.tabId,
      listenTarget: running && this.port != null ? `${LISTEN_HOST}:${this.port}` : undefined,
      port: this.port,
      generation: state.committed?.generation ?? 0,
      connectionId: this.connectionId,
      descriptorKey: this.descriptor?.key,
      inFlightCount: state.inFlightCount,
      lastError: this.lastError,
      startedAt: this.startedAt,
    };
  }

  async start(config: GrpcMockNetworkListenerStartConfig): Promise<GrpcMockListenerStatus> {
    if (this.grpcServer != null) {
      return this.getStatus();
    }

    this.descriptor = config.descriptor;
    this.connectionId = config.connectionId;
    this.lastError = undefined;
    this.logBuffer = [];
    this.logCursor = 0;

    const implementation = this.buildServiceImplementations(config.descriptor);

    const explicitPort = config.port;
    const reserved = new Set<number>();
    let port = explicitPort ?? await tryAllocateGrpcMockListenerPort(reserved);
    let server: grpc.Server | undefined;
    for (;;) {
      const candidate = new grpc.Server();
      for (const service of config.descriptor.services) {
        const serviceDef = buildServiceDefinition(config.descriptor, service.fullName, service.methods);
        candidate.addService(serviceDef, implementation[service.fullName] ?? {});
      }

      try {
        await new Promise<void>((resolve, reject) => {
          candidate.bindAsync(
            `${LISTEN_HOST}:${port}`,
            grpc.ServerCredentials.createInsecure(),
            (error, boundPort) => {
              if (error) {
                reject(error);
                return;
              }
              this.port = boundPort ?? port;
              resolve();
            },
          );
        });
        server = candidate;
        break;
      } catch (error) {
        candidate.forceShutdown();
        if (explicitPort != null || !/EADDRINUSE|address already in use/i.test(String(error))) {
          throw error;
        }
        reserved.add(port);
        port = await tryAllocateGrpcMockListenerPort(reserved);
      }
    }

    this.grpcServer = server;
    this.startedAt = new Date().toISOString();
    this.pushLog('listener-start', {
      detail: `Listening on ${LISTEN_HOST}:${this.port}`,
      generation: this.manager.getState().committed?.generation,
    });
    return this.getStatus();
  }

  async stop(): Promise<GrpcMockListenerStatus> {
    if (this.grpcServer != null) {
      const server = this.grpcServer;
      this.grpcServer = undefined;
      this.port = undefined;
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        server.tryShutdown(() => finish());
        setTimeout(() => {
          server.forceShutdown();
          finish();
        }, 3000);
      });
    } else {
      this.port = undefined;
    }
    this.pushLog('listener-stop');
    return this.getStatus();
  }

  private buildServiceImplementations(
    descriptor: GrpcDescriptor,
  ): Record<string, Record<string, grpc.UntypedHandleCall>> {
    const byService: Record<string, Record<string, grpc.UntypedHandleCall>> = {};

    for (const service of descriptor.services) {
      const handlers: Record<string, grpc.UntypedHandleCall> = {};
      for (const method of service.methods) {
        handlers[method.name] = this.createMethodHandler(descriptor, service.fullName, method);
      }
      byService[service.fullName] = handlers;
    }
    return byService;
  }

  private createMethodHandler(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
  ): grpc.UntypedHandleCall {
    switch (method.callType) {
      case 'server_streaming':
        return this.createServerStreamHandler(descriptor, serviceFullName, method);
      case 'client_streaming':
        return this.createClientStreamHandler(descriptor, serviceFullName, method);
      case 'bidi_streaming':
        return this.createBidiStreamHandler(descriptor, serviceFullName, method);
      default:
        return this.createUnaryHandler(descriptor, serviceFullName, method);
    }
  }

  private createUnaryHandler(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
  ): grpc.UntypedHandleCall {
    return (stream, respond) => {
      void this.handleUnaryCall(
        descriptor,
        serviceFullName,
        method,
        stream as grpc.ServerWritableStream<Buffer, Buffer>,
        respond as grpc.sendUnaryData<Buffer>,
      );
    };
  }

  private async handleUnaryCall(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
    stream: grpc.ServerWritableStream<Buffer, Buffer>,
    respond: grpc.sendUnaryData<Buffer>,
  ): Promise<void> {
    try {
      const requestBody = decodeProtoMessage(descriptor, method.requestTypeName, stream.request);
      const result = await this.manager.executeUnaryCall({
        service: serviceFullName,
        method: method.name,
        callType: 'unary',
        metadata: metadataToRecord(stream.metadata),
        requestBody,
      });
      const statusCode = result.evaluation.response.statusCode ?? 0;
      const message = result.evaluation.response.message ?? '';
      this.pushLog('rpc-unary', {
        service: serviceFullName,
        method: method.name,
        ruleName: result.evaluation.ruleName,
        statusCode,
        generation: result.generation,
      });

      if (statusCode !== 0 && result.evaluation.response.body === undefined) {
        respond(grpcServiceError(statusCode, message));
        return;
      }

      const body = result.evaluation.response.body ?? {};
      const encoded = encodeProtoMessage(descriptor, method.responseTypeName, body as Record<string, unknown>);
      respond(null, encoded);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.lastError = detail;
      this.pushLog('error', { service: serviceFullName, method: method.name, detail });
      respond(grpcServiceError(grpc.status.INTERNAL, detail));
    }
  }

  private createServerStreamHandler(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
  ): grpc.UntypedHandleCall {
    return (stream) => {
      void this.handleServerStreamCall(
        descriptor,
        serviceFullName,
        method,
        stream as grpc.ServerWritableStream<Buffer, Buffer>,
      );
    };
  }

  private async handleServerStreamCall(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
    stream: grpc.ServerWritableStream<Buffer, Buffer>,
  ): Promise<void> {
    try {
      const requestBody = decodeProtoMessage(descriptor, method.requestTypeName, stream.request);
      const plan = this.manager.planStreamCall({
        service: serviceFullName,
        method: method.name,
        callType: 'server_streaming',
        metadata: metadataToRecord(stream.metadata),
        requestBody,
      });
      const statusCode = plan.evaluation.response.statusCode ?? 0;
      this.pushLog('rpc-server-stream', {
        service: serviceFullName,
        method: method.name,
        ruleName: plan.evaluation.ruleName,
        statusCode,
        generation: plan.generation,
        detail: `${plan.messages.length} message(s)`,
      });

      if (statusCode !== 0 && plan.messages.length === 0) {
        stream.destroy(grpcServiceError(statusCode, plan.evaluation.response.message ?? ''));
        return;
      }

      for (const msg of plan.messages) {
        if (msg.delayBeforeMs > 0) {
          await new Promise((resolve) => { setTimeout(resolve, msg.delayBeforeMs); });
        }
        const encoded = encodeProtoMessage(
          descriptor,
          method.responseTypeName,
          msg.body as Record<string, unknown>,
        );
        stream.write(encoded);
      }
      stream.end();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.lastError = detail;
      this.pushLog('error', { service: serviceFullName, method: method.name, detail });
      stream.destroy(grpcServiceError(grpc.status.INTERNAL, detail));
    }
  }

  private createClientStreamHandler(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
  ): grpc.UntypedHandleCall {
    return (stream, respond) => {
      void this.handleClientStreamCall(
        descriptor,
        serviceFullName,
        method,
        stream as grpc.ServerDuplexStream<Buffer, Buffer>,
        respond as grpc.sendUnaryData<Buffer>,
      );
    };
  }

  private async handleClientStreamCall(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
    stream: grpc.ServerDuplexStream<Buffer, Buffer>,
    respond: grpc.sendUnaryData<Buffer>,
  ): Promise<void> {
    const parts: unknown[] = [];
    try {
      for await (const chunk of stream) {
        const decoded = decodeProtoMessage(descriptor, method.requestTypeName, chunk);
        parts.push(decoded);
      }
      const requestBody = parts.length <= 1
        ? (parts[0] ?? {})
        : { messages: parts };
      const result = await this.manager.executeUnaryCall({
        service: serviceFullName,
        method: method.name,
        callType: 'client_streaming' as GrpcCallType,
        metadata: metadataToRecord(stream.metadata),
        requestBody,
      });
      const statusCode = result.evaluation.response.statusCode ?? 0;
      this.pushLog('rpc-client-stream', {
        service: serviceFullName,
        method: method.name,
        ruleName: result.evaluation.ruleName,
        statusCode,
        generation: result.generation,
      });
      if (statusCode !== 0 && result.evaluation.response.body === undefined) {
        respond(grpcServiceError(statusCode, result.evaluation.response.message ?? ''));
        return;
      }
      const encoded = encodeProtoMessage(
        descriptor,
        method.responseTypeName,
        (result.evaluation.response.body ?? {}) as Record<string, unknown>,
      );
      respond(null, encoded);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.lastError = detail;
      this.pushLog('error', { service: serviceFullName, method: method.name, detail });
      respond(grpcServiceError(grpc.status.INTERNAL, detail));
    }
  }

  private createBidiStreamHandler(
    descriptor: GrpcDescriptor,
    serviceFullName: string,
    method: GrpcMethodInfo,
  ): grpc.UntypedHandleCall {
    return (stream) => {
      const bidiStream = stream as grpc.ServerDuplexStream<Buffer, Buffer>;
      let closed = false;
      let processing = Promise.resolve();

      const fail = (error: unknown) => {
        if (closed) return;
        closed = true;
        const detail = error instanceof Error ? error.message : String(error);
        this.lastError = detail;
        this.pushLog('error', { service: serviceFullName, method: method.name, detail });
        bidiStream.destroy(grpcServiceError(grpc.status.INTERNAL, detail));
      };

      bidiStream.on('data', (chunk: Buffer) => {
        processing = processing.then(async () => {
          if (closed) return;
          const requestBody = decodeProtoMessage(descriptor, method.requestTypeName, chunk);
          const result = await this.manager.executeUnaryCall({
            service: serviceFullName,
            method: method.name,
            callType: 'bidi_streaming',
            metadata: metadataToRecord(bidiStream.metadata),
            requestBody,
          });
          const statusCode = result.evaluation.response.statusCode ?? 0;
          this.pushLog('rpc-bidi-stream', {
            service: serviceFullName,
            method: method.name,
            ruleName: result.evaluation.ruleName,
            statusCode,
            generation: result.generation,
          });
          if (statusCode !== 0 && result.evaluation.response.body === undefined) {
            closed = true;
            bidiStream.destroy(grpcServiceError(statusCode, result.evaluation.response.message ?? ''));
            return;
          }
          const encoded = encodeProtoMessage(
            descriptor,
            method.responseTypeName,
            (result.evaluation.response.body ?? {}) as Record<string, unknown>,
          );
          bidiStream.write(encoded);
        }).catch(fail);
      });

      bidiStream.on('end', () => {
        void processing.then(() => {
          if (closed) return;
          closed = true;
          bidiStream.end();
        }).catch(fail);
      });

      bidiStream.on('error', (error) => {
        fail(error);
      });
    };
  }
}

/** @internal Exported for coverage tests only. */
export function grpcMockGrpcStatusCodeFromRuleForTests(statusCode: number | undefined): grpc.status {
  return grpcStatusCodeFromRule(statusCode);
}

/** @internal Exported for coverage tests only. */
export function grpcMockServiceErrorForTests(
  statusCode: number | undefined,
  details: string,
): grpc.ServiceError {
  return grpcServiceError(statusCode, details);
}

/** @internal Exported for coverage tests only. */
export function grpcMockBuildMethodDefinitionForTests(
  serviceFullName: string,
  method: GrpcMethodInfo,
): grpc.MethodDefinition<Buffer, Buffer> {
  return buildMethodDefinition(serviceFullName, method);
}
