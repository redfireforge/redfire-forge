/**
 * gRPC native → Express fallback helpers — Phase 7F.
 */
import { GRPC_ERROR_CODES, type GrpcErrorBody } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import { GrpcNativeTauriStreamTransportError } from './grpcNativeTauriStreamTransport';
import type { GrpcTransportMode } from './grpcTransportTabRouting';

const streamTransportBindingByTab = new Map<string, GrpcTransportMode>();

export function bindGrpcStreamTransportForTab(tabId: string, mode: GrpcTransportMode): void {
  streamTransportBindingByTab.set(tabId, mode);
}

export function clearGrpcStreamTransportBinding(tabId: string): void {
  streamTransportBindingByTab.delete(tabId);
}

export function getGrpcStreamTransportBinding(tabId: string): GrpcTransportMode | undefined {
  return streamTransportBindingByTab.get(tabId);
}

export function hasGrpcStreamTransportBinding(tabId: string): boolean {
  return streamTransportBindingByTab.has(tabId);
}

export function resetGrpcStreamTransportBindingsForTests(): void {
  streamTransportBindingByTab.clear();
}

export function isGrpcNativePreflightFailure(error: unknown): boolean {
  if (error instanceof GrpcNativeTauriTransportError || error instanceof GrpcNativeTauriStreamTransportError) {
    return true;
  }
  if (error instanceof GrpcApiClientError) {
    if (error.details && typeof error.details === 'object' && 'grpcStatus' in (error.details as object)) {
      return false;
    }
    if (error.code === GRPC_ERROR_CODES.CANCELLED || error.code === GRPC_ERROR_CODES.REQUEST_NOT_FOUND) {
      return false;
    }
    if (error.code === GRPC_ERROR_CODES.CALL_FAILED) {
      return !(error.details && typeof error.details === 'object' && 'grpcStatus' in (error.details as object));
    }
    return error.category === 'unreachable'
      || error.code === GRPC_ERROR_CODES.INVALID_DESCRIPTOR
      || error.code === GRPC_ERROR_CODES.INVALID_REQUEST
      || error.code === GRPC_ERROR_CODES.UNREACHABLE
      || error.code === GRPC_ERROR_CODES.INVALID_TARGET;
  }
  return false;
}

export type GrpcExpressFallbackDetails = {
  expressFallbackOffered?: boolean;
  fallbackReason?: string;
  transportAttempted?: GrpcTransportMode;
};

export function isGrpcExpressFallbackOffered(error?: GrpcErrorBody): boolean {
  const details = error?.details;
  if (!details || typeof details !== 'object') {
    return false;
  }
  return (details as GrpcExpressFallbackDetails).expressFallbackOffered === true;
}

export function withGrpcExpressFallbackOffer(
  error: GrpcErrorBody,
  fallbackReason: string,
  transportAttempted: GrpcTransportMode = 'tauri',
): GrpcErrorBody {
  const prior = (error.details && typeof error.details === 'object')
    ? error.details as Record<string, unknown>
    : {};
  return {
    ...error,
    retryable: true,
    details: {
      ...prior,
      expressFallbackOffered: true,
      fallbackReason,
      transportAttempted,
    },
  };
}

export function grpcApiErrorToExpressFallbackBody(error: GrpcApiClientError): GrpcErrorBody {
  const body = error.toErrorBody();
  if (!isGrpcNativePreflightFailure(error)) {
    return body;
  }
  return withGrpcExpressFallbackOffer(body, body.message);
}
