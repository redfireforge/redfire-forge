import * as grpc from '@grpc/grpc-js';
import dns from 'node:dns/promises';
import net from 'node:net';
import type { GrpcCallTimingBreakdown, GrpcTlsConfig, GrpcTlsMode } from '../../src/shared/grpc/contracts.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import { buildGrpcChannelCredentials } from './grpcChannelCredentials.js';

export interface GrpcReachabilityParams {
  address: string;
  timeoutMs: number;
}

export interface GrpcReachabilityResult {
  reachable: boolean;
  latencyMs?: number;
  errorMessage?: string;
}

export interface GrpcUnaryInvokeParams {
  address: string;
  service: string;
  method: string;
  requestBuffer: Buffer;
  metadata: Record<string, string>;
  timeoutMs: number;
  signal: AbortSignal;
  decodeResponse: (buffer: Buffer) => Record<string, unknown>;
  tlsMode?: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export interface GrpcUnaryInvokeResult {
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body: Record<string, unknown>;
  timingBreakdown?: GrpcCallTimingBreakdown;
}

export interface GrpcClientPort {
  probeReachability(params: GrpcReachabilityParams): Promise<GrpcReachabilityResult>;
  invokeUnary(params: GrpcUnaryInvokeParams): Promise<GrpcUnaryInvokeResult>;
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

function parseHostPort(address: string): { host: string; port: number } | null {
  const check = validateResolvedGrpcTargetAddress(address);
  if (!check.valid || check.kind !== 'host_port') return null;
  const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(check.normalized);
  if (!match) return null;
  return {
    host: match[1] ?? match[2],
    port: Number(match[3]),
  };
}

export class GrpcJsClient implements GrpcClientPort {
  async probeReachability(params: GrpcReachabilityParams): Promise<GrpcReachabilityResult> {
    const check = validateResolvedGrpcTargetAddress(params.address);
    if (!check.valid) {
      return { reachable: false, errorMessage: check.reason };
    }
    if (check.kind === 'in_process') {
      return {
        reachable: false,
        errorMessage: 'in-process targets are not dialable from the Node server (Phase 1B)',
      };
    }

    const hostPort = parseHostPort(check.normalized);
    if (!hostPort) {
      return { reachable: false, errorMessage: 'Invalid host:port address' };
    }

    const started = Date.now();
    return new Promise((resolve) => {
      const socket = net.connect({ host: hostPort.host, port: hostPort.port });
      let settled = false;

      const finish = (result: GrpcReachabilityResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish({
          reachable: false,
          errorMessage: `Timed out after ${params.timeoutMs}ms`,
        });
      }, params.timeoutMs);
      timer.unref?.();

      socket.once('connect', () => {
        clearTimeout(timer);
        finish({
          reachable: true,
          latencyMs: Date.now() - started,
        });
      });

      socket.once('error', (error) => {
        clearTimeout(timer);
        finish({
          reachable: false,
          errorMessage: error.message,
        });
      });
    });
  }

  async invokeUnary(params: GrpcUnaryInvokeParams): Promise<GrpcUnaryInvokeResult> {
    const check = validateResolvedGrpcTargetAddress(params.address);
    if (!check.valid) {
      throw new Error(check.reason);
    }
    if (check.kind === 'in_process') {
      throw new Error('in-process targets are not dialable from the Node server (Phase 1B)');
    }

    const timingBreakdown: GrpcCallTimingBreakdown = {};
    const hostPort = parseHostPort(check.normalized);
    if (hostPort) {
      const dnsStarted = Date.now();
      try {
        await dns.lookup(hostPort.host);
      } catch {
        // DNS failure surfaces as RPC error — still record lookup time.
      }
      timingBreakdown.dnsLookupMs = Date.now() - dnsStarted;
    }

    const credentials = buildGrpcChannelCredentials({
      tlsMode: params.tlsMode,
      tlsConfig: params.tlsConfig,
    });
    const channelStarted = Date.now();
    const client = new grpc.Client(check.normalized, credentials);
    const path = `/${params.service}/${params.method}`;
    const metadata = recordToMetadata(params.metadata);
    const deadline = Date.now() + params.timeoutMs;

    return new Promise((resolve, reject) => {
      let settled = false;
      const callState = { call: undefined as grpc.ClientUnaryCall | undefined };
      let firstMetadataAt: number | undefined;
      let responseAt: number | undefined;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        params.signal.removeEventListener('abort', onAbort);
        client.close();
        fn();
      };

      const onAbort = () => {
        callState.call?.cancel();
        finish(() => reject(new Error('Call cancelled')));
      };

      const attachTiming = (result: GrpcUnaryInvokeResult): GrpcUnaryInvokeResult => {
        if (firstMetadataAt !== undefined) {
          const connectWindow = Math.max(0, firstMetadataAt - channelStarted);
          timingBreakdown.tcpConnectTlsMs = Math.round(connectWindow * 0.65);
          timingBreakdown.http2HandshakeMs = Math.max(0, connectWindow - (timingBreakdown.tcpConnectTlsMs ?? 0));
        }
        if (responseAt !== undefined && firstMetadataAt !== undefined) {
          timingBreakdown.serverProcessingMs = Math.max(0, responseAt - firstMetadataAt);
        }
        return {
          ...result,
          timingBreakdown,
        };
      };

      if (params.signal.aborted) {
        finish(() => reject(new Error('Call cancelled before invoke')));
        return;
      }

      let responseHeaders: Record<string, string> = {};
      let responseTrailers: Record<string, string> = {};

      callState.call = client.makeUnaryRequest(
        path,
        (value: Buffer) => value,
        (value: Buffer) => value,
        params.requestBuffer,
        metadata,
        { deadline },
        (error, response) => {
          if (params.signal.aborted) {
            finish(() => reject(new Error('Call cancelled')));
            return;
          }

          if (error) {
            const serviceError = error as grpc.ServiceError;
            finish(() => reject(Object.assign(error, {
              grpcStatus: serviceError.code ?? grpc.status.UNKNOWN,
              grpcDetails: serviceError.details ?? error.message,
              grpcMetadata: serviceError.metadata,
            })));
            return;
          }

          try {
            responseAt = Date.now();
            const decodeStarted = Date.now();
            const body = params.decodeResponse(response as Buffer);
            timingBreakdown.responseDeserializationMs = Date.now() - decodeStarted;
            finish(() => resolve(attachTiming({
              status: 0,
              statusMessage: 'OK',
              headers: responseHeaders,
              trailers: responseTrailers,
              body,
            })));
          } catch (decodeError) {
            finish(() => reject(
              decodeError instanceof Error ? decodeError : new Error(String(decodeError)),
            ));
          }
        },
      );

      callState.call.on('metadata', (incoming: grpc.Metadata) => {
        if (firstMetadataAt === undefined) {
          firstMetadataAt = Date.now();
        }
        responseHeaders = metadataToRecord(incoming);
      });

      callState.call.on('status', (status: grpc.StatusObject) => {
        responseTrailers = metadataToRecord(status.metadata);
      });

      params.signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export const grpcJsClient = new GrpcJsClient();
