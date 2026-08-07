import { grpc } from './grpcJsLoader.js';
import type { GrpcStreamingCallType, GrpcTlsConfig, GrpcTlsMode } from '../../src/shared/grpc/contracts.js';
import {
  preferIpv4LoopbackDialAddress,
  validateResolvedGrpcTargetAddress,
} from '../../src/shared/grpc/targetValidation.js';
import { buildGrpcChannelCredentials } from './grpcChannelCredentials.js';

export interface GrpcStreamTerminalResult {
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface GrpcStreamStartParams {
  address: string;
  service: string;
  method: string;
  callType: GrpcStreamingCallType;
  requestBuffer: Buffer;
  metadata: Record<string, string>;
  timeoutMs: number;
  decodeResponse: (buffer: Buffer) => Record<string, unknown>;
  tlsMode?: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export interface GrpcActiveStreamHandle {
  callType: GrpcStreamingCallType;
  write(buffer: Buffer): void;
  endWrites(): void;
  cancel(): void;
}

export interface GrpcStreamCallbacks {
  onInboundMessage: (body: Record<string, unknown>, headers: Record<string, string>) => void;
  onTerminal: (result: GrpcStreamTerminalResult) => void;
  onError: (message: string, status?: number) => void;
}

function metadataToRecord(metadata: grpc.Metadata): Record<string, string> {
  const result: Record<string, string> = {};
  // getMap() returns { key: MetadataValue } — a single string|Buffer per key, NOT an array.
  for (const [key, value] of Object.entries(metadata.getMap())) {
    result[key] = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  }
  return result;
}

function recordToMetadata(metadata: Record<string, string>): grpc.Metadata {
  const grpcMetadata = new grpc.Metadata();
  for (const [key, value] of Object.entries(metadata)) {
    grpcMetadata.set(key, value);
  }
  return grpcMetadata;
}

function isGrpcCancelledStatus(status: number | undefined): boolean {
  return status === grpc.status.CANCELLED || status === 1;
}

type GrpcJsStreamCall =
  | grpc.ClientReadableStream<Buffer>
  | grpc.ClientWritableStream<Buffer>
  | grpc.ClientDuplexStream<Buffer, Buffer>;

export class GrpcJsStreamingClient {
  startStream(
    params: GrpcStreamStartParams,
    callbacks: GrpcStreamCallbacks,
  ): GrpcActiveStreamHandle {
    const check = validateResolvedGrpcTargetAddress(params.address);
    if (!check.valid) {
      throw new Error(check.reason);
    }
    if (check.kind === 'in_process') {
      throw new Error('in-process targets are not dialable from the Node server (Phase 1B)');
    }

    const credentials = buildGrpcChannelCredentials({
      tlsMode: params.tlsMode,
      tlsConfig: params.tlsConfig,
    });
    const client = new grpc.Client(preferIpv4LoopbackDialAddress(check.normalized), credentials);
    const path = `/${params.service}/${params.method}`;
    const metadata = recordToMetadata(params.metadata);
    const deadline = Date.now() + params.timeoutMs;
    const options = { deadline };

    let settled = false;
    let responseHeaders: Record<string, string> = {};
    let responseTrailers: Record<string, string> = {};
    let grpcStatusCode = 0;
    let clientStreamResponse: Record<string, unknown> | undefined;
    let clientWritesEnded = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      client.close();
      fn();
    };

    const handleTerminal = (result: GrpcStreamTerminalResult) => {
      finish(() => callbacks.onTerminal(result));
    };

    const handleError = (error: grpc.ServiceError | Error) => {
      const serviceError = error as grpc.ServiceError;
      const status = typeof serviceError.code === 'number' ? serviceError.code : undefined;
      if (params.callType === 'bidi_streaming' && clientWritesEnded && isGrpcCancelledStatus(status)) {
        return;
      }
      finish(() => callbacks.onError(
        serviceError.details ?? error.message,
        status,
      ));
    };

    const wireCommonHandlers = (call: GrpcJsStreamCall) => {
      call.on('metadata', (incoming: grpc.Metadata) => {
        responseHeaders = metadataToRecord(incoming);
      });

      call.on('status', (status: grpc.StatusObject) => {
        responseTrailers = metadataToRecord(status.metadata);
        grpcStatusCode = status.code;
      });

      call.on('error', (error: grpc.ServiceError) => {
        handleError(error);
      });
    };

    let call: GrpcJsStreamCall;

    if (params.callType === 'server_streaming') {
      const serverCall = client.makeServerStreamRequest(
        path,
        (value: Buffer) => value,
        (value: Buffer) => value,
        params.requestBuffer,
        metadata,
        options,
      );
      call = serverCall;
      wireCommonHandlers(serverCall);

      serverCall.on('data', (chunk: Buffer) => {
        try {
          callbacks.onInboundMessage(
            params.decodeResponse(chunk),
            responseHeaders,
          );
        } catch (decodeError) {
          handleError(decodeError instanceof Error ? decodeError : new Error(String(decodeError)));
        }
      });

      serverCall.on('end', () => {
        handleTerminal({
          status: grpcStatusCode,
          statusMessage: grpc.status[grpcStatusCode as grpc.status] ?? 'OK',
          headers: responseHeaders,
          trailers: responseTrailers,
        });
      });
    } else if (params.callType === 'client_streaming') {
      const clientCall = client.makeClientStreamRequest(
        path,
        (value: Buffer) => value,
        (value: Buffer) => value,
        metadata,
        options,
        (error, response) => {
          if (error) {
            handleError(error);
            return;
          }
          try {
            clientStreamResponse = params.decodeResponse(response as Buffer);
            handleTerminal({
              status: grpcStatusCode,
              statusMessage: grpc.status[grpcStatusCode as grpc.status] ?? 'OK',
              headers: responseHeaders,
              trailers: responseTrailers,
              body: clientStreamResponse,
            });
          } catch (decodeError) {
            handleError(decodeError instanceof Error ? decodeError : new Error(String(decodeError)));
          }
        },
      );
      call = clientCall;
      wireCommonHandlers(clientCall);

      // Client-streaming terminal response is delivered via the response callback only.
      // The `end` event can fire before the callback body is decoded.
    } else {
      const bidiCall = client.makeBidiStreamRequest(
        path,
        (value: Buffer) => value,
        (value: Buffer) => value,
        metadata,
        options,
      );
      call = bidiCall;
      wireCommonHandlers(bidiCall);

      bidiCall.on('data', (chunk: Buffer) => {
        try {
          callbacks.onInboundMessage(
            params.decodeResponse(chunk),
            responseHeaders,
          );
        } catch (decodeError) {
          handleError(decodeError instanceof Error ? decodeError : new Error(String(decodeError)));
        }
      });

      bidiCall.on('end', () => {
        const terminalStatus = params.callType === 'bidi_streaming'
          && clientWritesEnded
          && isGrpcCancelledStatus(grpcStatusCode)
          ? 0
          : grpcStatusCode;
        handleTerminal({
          status: terminalStatus,
          statusMessage: grpc.status[terminalStatus as grpc.status] ?? 'OK',
          headers: responseHeaders,
          trailers: responseTrailers,
        });
      });
    }

    return {
      callType: params.callType,
      write(buffer: Buffer) {
        if (params.callType === 'server_streaming') {
          throw new Error('Cannot write to a server-streaming RPC');
        }
        (call as grpc.ClientWritableStream<Buffer>).write(buffer);
      },
      endWrites() {
        if (params.callType === 'server_streaming') {
          throw new Error('Cannot end writes on a server-streaming RPC');
        }
        clientWritesEnded = true;
        (call as grpc.ClientWritableStream<Buffer>).end();
      },
      cancel() {
        call.cancel();
      },
    };
  }
}

export interface GrpcStreamingClientFactory {
  startStream(
    params: GrpcStreamStartParams,
    callbacks: GrpcStreamCallbacks,
  ): GrpcActiveStreamHandle;
}

export class GrpcJsStreamingClientAdapter implements GrpcStreamingClientFactory {
  private readonly inner = new GrpcJsStreamingClient();

  startStream(
    params: GrpcStreamStartParams,
    callbacks: GrpcStreamCallbacks,
  ): GrpcActiveStreamHandle {
    return this.inner.startStream(params, callbacks);
  }
}

export const grpcJsStreamingClient = new GrpcJsStreamingClientAdapter();
