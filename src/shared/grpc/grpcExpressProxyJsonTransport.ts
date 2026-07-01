/**
 * Express proxy JSON envelope transport — shared by stream client and Phase 10B adapters.
 */
import type { GrpcOperation, GrpcRouteEnvelope, GrpcSuccessEnvelope } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';

export async function expressGrpcProxyJsonFetch(
  path: string,
  init: RequestInit,
  op: GrpcOperation = 'stream_start',
): Promise<GrpcRouteEnvelope<unknown>> {
  const response = await fetch(path, init);
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new GrpcApiClientError(op, `gRPC ${op} transport returned non-JSON response (HTTP ${response.status})`, {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }
  return parsed as GrpcRouteEnvelope<unknown>;
}

function throwIfNotOk<T>(
  op: GrpcOperation,
  envelope: GrpcRouteEnvelope<T>,
): asserts envelope is GrpcSuccessEnvelope<T> {
  if (!envelope.ok) {
    const code = envelope.error.code?.trim() || 'GRPC_CLIENT_ERROR';
    const message = envelope.error.message?.trim() || `gRPC ${op} failed (${code})`;
    throw new GrpcApiClientError(op, message, {
      code,
      retryable: envelope.error.retryable ?? false,
      category: envelope.error.category,
      details: envelope.error.details,
    });
  }
}

export async function expressGrpcProxyDispatchJson<T>(
  op: GrpcOperation,
  path: string,
  init: RequestInit,
  transport: (path: string, init: RequestInit, op: GrpcOperation) => Promise<GrpcRouteEnvelope<unknown>> = expressGrpcProxyJsonFetch,
): Promise<GrpcSuccessEnvelope<T>> {
  const raw = await transport(path, init, op);
  const envelope = raw as GrpcRouteEnvelope<T>;
  if (envelope.op !== op) {
    throw new GrpcApiClientError(op, `gRPC ${op} returned mismatched operation (${envelope.op})`, {
      code: 'GRPC_MISMATCHED_ENVELOPE',
      retryable: false,
    });
  }
  throwIfNotOk(op, envelope);
  return envelope as GrpcSuccessEnvelope<T>;
}

export function buildGrpcStreamQuery(
  tabId: string,
  extra?: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  params.set('tabId', tabId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
  }
  return params.toString();
}

type GrpcStreamJsonTransport = (
  path: string,
  init: RequestInit,
  op: GrpcOperation,
) => Promise<GrpcRouteEnvelope<unknown>>;

let streamJsonTransportOverride: GrpcStreamJsonTransport | null = null;

/** Phase 7F — native stream transport override (Tauri) for JSON stream_start envelope. */
export function setGrpcExpressStreamJsonTransportOverride(
  transport: GrpcStreamJsonTransport | null,
): void {
  streamJsonTransportOverride = transport;
}

export function resolveGrpcExpressStreamJsonTransport(): GrpcStreamJsonTransport {
  return streamJsonTransportOverride ?? expressGrpcProxyJsonFetch;
}
