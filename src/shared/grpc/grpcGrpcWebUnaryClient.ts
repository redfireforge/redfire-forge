/**
 * gRPC-Web browser-direct unary client — Phase 10C.
 */
import type { GrpcCallRequest, GrpcCallResult, GrpcTarget } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { encodeGrpcWebRequestBody } from './grpcWebFramingCodec';
import {
  decodeGrpcWebProtoMessage,
  encodeGrpcWebProtoMessage,
  resolveGrpcWebMethodTypes,
  loadProtobufRootFromProtosetBase64,
} from './grpcWebProtoCodec';
import { normalizeGrpcWebUnaryResponse } from './grpcWebTrailerNormalize';
import { GRPC_WEB_CONTENT_TYPES, GRPC_WEB_RESERVED_HEADERS } from './grpcWebTransportContracts';
import {
  assertIncompatibleBrowserTransportContentType,
  buildBrowserTransportGrpcApiError,
  classifyBrowserTransportHttpResponse,
  mapBrowserTransportFetchFailure,
  mapBrowserTransportDecodeFailure,
} from './grpcBrowserTransportErrorMapper';
import { buildBrowserTransportUserMetadataHeaders } from './grpcBrowserTransportMetadataNorm';
import { assertBrowserDirectTargetAllowsFetch } from './grpcWebNativeTargetGuard';

export type GrpcWebUnaryFetchFn = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface GrpcWebUnaryInvokeInput {
  request: GrpcCallRequest;
  tabId: string;
  protosetBase64: string;
  requestTypeName?: string;
  responseTypeName?: string;
  fetchFn?: GrpcWebUnaryFetchFn;
  signal?: AbortSignal;
}

type GrpcWebAbortCause = 'cancel' | 'timeout';

interface GrpcWebInFlightCall {
  controller: AbortController;
  abortCause?: GrpcWebAbortCause;
  clearTimeoutTimer?: () => void;
}

const inFlightCalls = new Map<string, GrpcWebInFlightCall>();

function inFlightKey(tabId: string, requestId: string): string {
  return `${tabId}:${requestId}`;
}

export function buildGrpcWebMethodUrl(target: GrpcTarget, service: string, method: string): string {
  const scheme = target.tlsMode === 'disabled' ? 'http' : 'https';
  const servicePath = service.startsWith('/') ? service : `/${service}`;
  return `${scheme}://${target.address}${servicePath}/${method}`;
}

function buildGrpcWebRequestHeaders(
  request: GrpcCallRequest,
  contentType: string,
): Record<string, string> {
  const { headers } = buildBrowserTransportUserMetadataHeaders(request.metadata, GRPC_WEB_RESERVED_HEADERS);
  headers.Accept = `${GRPC_WEB_CONTENT_TYPES.BINARY}, ${GRPC_WEB_CONTENT_TYPES.TEXT}`;
  headers['Content-Type'] = contentType;
  headers['X-Grpc-Web'] = '1';
  if (request.timeoutMs && request.timeoutMs > 0) {
    headers['grpc-timeout'] = `${request.timeoutMs}m`;
  }
  return headers;
}

function responseBodyToUint8Array(body: ArrayBuffer): Uint8Array {
  return new Uint8Array(body);
}

function mapFetchFailure(error: unknown, abortCause?: GrpcWebAbortCause): GrpcApiClientError {
  return mapBrowserTransportFetchFailure('call', error, {
    transportMode: 'grpc-web',
    abortCause,
  });
}

/** Invoke unary call via browser fetch + grpc-web framing. */
export async function invokeGrpcWebUnary(
  input: GrpcWebUnaryInvokeInput,
): Promise<GrpcCallResult> {
  const started = performance.now();
  const { request, tabId, protosetBase64 } = input;
  const root = loadProtobufRootFromProtosetBase64(protosetBase64);
  const methodTypes = input.requestTypeName && input.responseTypeName
    ? { requestTypeName: input.requestTypeName, responseTypeName: input.responseTypeName }
    : resolveGrpcWebMethodTypes(root, request.service, request.method);

  const serializeStarted = performance.now();
  const requestBytes = encodeGrpcWebProtoMessage(
    protosetBase64,
    methodTypes.requestTypeName,
    request.body,
  );
  const encodedBody = encodeGrpcWebRequestBody(requestBytes, GRPC_WEB_CONTENT_TYPES.BINARY);
  const protoSerializationMs = Math.round(performance.now() - serializeStarted);
  const url = buildGrpcWebMethodUrl(request.target, request.service, request.method);
  const headers = buildGrpcWebRequestHeaders(request, encodedBody.contentType);

  // Real browser fetch against native gRPC (:50051 etc.) → ERR_INVALID_HTTP_RESPONSE.
  // Injected fetchFn (unit tests / custom transports) skips the guard.
  if (!input.fetchFn) {
    const blocked = assertBrowserDirectTargetAllowsFetch('call', 'grpc-web', request.target);
    if (blocked) {
      throw blocked;
    }
  }

  const controller = new AbortController();
  const key = inFlightKey(tabId, request.requestId);
  const inFlight: GrpcWebInFlightCall = { controller };
  inFlightCalls.set(key, inFlight);

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  if (request.timeoutMs && request.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      inFlight.abortCause = 'timeout';
      controller.abort();
    }, request.timeoutMs);
    inFlight.clearTimeoutTimer = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
    };
  }

  const signal = input.signal
    ? mergeAbortSignals(input.signal, controller.signal)
    : controller.signal;

  const fetchFn = input.fetchFn ?? globalThis.fetch.bind(globalThis);

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers,
      body: encodedBody.body,
      signal,
    });

    const contentType = response.headers.get('content-type') ?? encodedBody.contentType;
    const incompatibleContentType = assertIncompatibleBrowserTransportContentType(
      contentType,
      'grpc-web',
      response.status,
    );
    if (incompatibleContentType) {
      throw incompatibleContentType;
    }
    const rawBuffer = await response.arrayBuffer();
    const rawBody = responseBodyToUint8Array(rawBuffer);

    if (!response.ok && rawBody.length === 0) {
      const kind = classifyBrowserTransportHttpResponse({
        httpStatus: response.status,
        contentType,
        bodyLength: 0,
        transportMode: 'grpc-web',
      });
      throw buildBrowserTransportGrpcApiError('call', kind, {
        transportMode: 'grpc-web',
        httpStatus: response.status,
        fallbackMessage: `gRPC-Web HTTP ${response.status} ${response.statusText}`,
      });
    }

    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: response.headers,
      body: rawBody,
      contentType,
    });

    let decodedBody: Record<string, unknown> | undefined;
    let responseDeserializationMs = 0;
    const firstPayload = normalized.dataPayloads[0];
    if (firstPayload && firstPayload.length > 0) {
      const decodeStarted = performance.now();
      decodedBody = decodeGrpcWebProtoMessage(
        protosetBase64,
        methodTypes.responseTypeName,
        firstPayload,
      );
      responseDeserializationMs = Math.round(performance.now() - decodeStarted);
    }

    const durationMs = Math.round(performance.now() - started);
    const serverProcessingMs = Math.max(0, durationMs - protoSerializationMs - responseDeserializationMs);
    return {
      callType: 'unary',
      status: normalized.status,
      statusMessage: normalized.statusMessage,
      headers: normalized.headers,
      trailers: normalized.trailers,
      body: decodedBody,
      durationMs,
      transportUsed: 'grpc-web',
      timingBreakdown: {
        protoSerializationMs,
        serverProcessingMs,
        responseDeserializationMs,
      },
      ...(normalized.status !== 0
        ? { errorDetail: normalized.statusMessage }
        : {}),
    };
  } catch (error) {
    if (error instanceof GrpcApiClientError) {
      throw error;
    }
    const decodeFailure = mapBrowserTransportDecodeFailure('grpc-web', error);
    if (decodeFailure) {
      throw decodeFailure;
    }
    throw mapFetchFailure(error, inFlight.abortCause);
  } finally {
    inFlight.clearTimeoutTimer?.();
    inFlightCalls.delete(key);
  }
}

/** Abort an in-flight grpc-web unary fetch for the given tab/request. */
export function cancelGrpcWebUnary(tabId: string, requestId: string): boolean {
  const key = inFlightKey(tabId, requestId);
  const inFlight = inFlightCalls.get(key);
  if (!inFlight) {
    return false;
  }
  inFlight.abortCause = 'cancel';
  inFlight.clearTimeoutTimer?.();
  inFlight.controller.abort();
  inFlightCalls.delete(key);
  return true;
}

export function resetGrpcWebUnaryClientForTests(): void {
  for (const inFlight of inFlightCalls.values()) {
    inFlight.clearTimeoutTimer?.();
    inFlight.controller.abort();
  }
  inFlightCalls.clear();
}

function mergeAbortSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
  if (primary.aborted || secondary.aborted) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  primary.addEventListener('abort', abort, { once: true });
  secondary.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
