/**
 * Guard browser gRPC-Web fetches against native HTTP/2 gRPC ports.
 *
 * Chrome cannot speak native gRPC. A fetch to :50051 (etc.) surfaces as
 * `net::ERR_INVALID_HTTP_RESPONSE` in DevTools even when Studio maps the
 * failure correctly. Fail closed in-process before fetch so the console stays clean
 * while still offering Retry with Express Proxy.
 */
import type { GrpcOperation, GrpcTarget } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { buildBrowserTransportGrpcApiError } from './grpcBrowserTransportErrorMapper';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';

/** Demo/local fixtures that speak native gRPC only (not gRPC-Web / Envoy). */
export const NATIVE_GRPC_ONLY_PORTS = new Set([
  '50051', // Go echo plaintext
  '50052', // Go echo health
  '50443', // Go echo TLS
  '50444', // Go echo mTLS
  '9090', // Spring Boot Netty
]);

export function extractHostPortFromGrpcAddress(address: string): { host: string; port: string } | null {
  const trimmed = address.trim();
  const bracket = /^\[([^\]]+)\]:(\d+)$/.exec(trimmed);
  if (bracket) {
    return { host: bracket[1]!, port: bracket[2]! };
  }
  const plain = /^([^:]+):(\d+)$/.exec(trimmed);
  if (plain) {
    return { host: plain[1]!, port: plain[2]! };
  }
  return null;
}

export function isNativeGrpcOnlyTargetAddress(address: string): boolean {
  const parsed = extractHostPortFromGrpcAddress(address);
  if (!parsed) return false;
  return NATIVE_GRPC_ONLY_PORTS.has(parsed.port);
}

/**
 * When non-null, callers must throw without calling `fetch`.
 * Returns a protocol_mismatch error that still suggests Express Proxy.
 */
export function assertBrowserDirectTargetAllowsFetch(
  op: GrpcOperation,
  transportMode: Extract<GrpcStudioTransportMode, 'grpc-web' | 'spring-servlet'>,
  target: GrpcTarget,
): GrpcApiClientError | undefined {
  const parsed = extractHostPortFromGrpcAddress(target.address);
  if (!parsed || !NATIVE_GRPC_ONLY_PORTS.has(parsed.port)) {
    return undefined;
  }
  return buildBrowserTransportGrpcApiError(op, 'protocol_mismatch', {
    transportMode,
    fallbackMessage:
      `${transportMode === 'grpc-web' ? 'gRPC-Web' : 'Spring Servlet'} cannot speak native gRPC `
      + `on port ${parsed.port}. Use Envoy (:50055) for gRPC-Web, the Spring servlet endpoint, or Express Proxy.`,
  });
}
