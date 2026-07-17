/**
 * Spring Servlet browser-direct unary client — Phase 10D.
 */
import type { GrpcCallRequest, GrpcCallResult } from './contracts';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { encodeGrpcWebDataFrame } from './grpcWebFramingCodec';
import {
  decodeGrpcWebProtoMessage,
  encodeGrpcWebProtoMessage,
  resolveGrpcWebMethodTypes,
  loadProtobufRootFromProtosetBase64,
} from './grpcWebProtoCodec';
import { normalizeGrpcWebUnaryResponse } from './grpcWebTrailerNormalize';
import { buildSpringServletMethodUrls, SpringServletPathResolutionError } from './grpcSpringServletPathResolver';
import {
  assertIncompatibleBrowserTransportContentType,
  buildBrowserTransportGrpcApiError,
  classifyBrowserTransportHttpResponse,
  extractBrowserTransportFailure,
  mapBrowserTransportFetchFailure,
  mapBrowserTransportDecodeFailure,
} from './grpcBrowserTransportErrorMapper';
import {
  SPRING_SERVLET_CONTENT_TYPE,
  SPRING_SERVLET_RESERVED_HEADERS,
  SPRING_SERVLET_TE_TRAILERS,
} from './grpcSpringServletTransportContracts';
import { buildBrowserTransportUserMetadataHeaders } from './grpcBrowserTransportMetadataNorm';

export type SpringServletUnaryFetchFn = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface SpringServletUnaryInvokeInput {
  request: GrpcCallRequest;
  tabId: string;
  protosetBase64: string;
  requestTypeName?: string;
  responseTypeName?: string;
  fetchFn?: SpringServletUnaryFetchFn;
  signal?: AbortSignal;
}

type SpringServletAbortCause = 'cancel' | 'timeout';

interface SpringServletInFlightCall {
  controller: AbortController;
  abortCause?: SpringServletAbortCause;
  clearTimeoutTimer?: () => void;
}

const inFlightCalls = new Map<string, SpringServletInFlightCall>();

function inFlightKey(tabId: string, requestId: string): string {
  return `${tabId}:${requestId}`;
}

function buildSpringServletRequestHeaders(request: GrpcCallRequest): Record<string, string> {
  const { headers } = buildBrowserTransportUserMetadataHeaders(request.metadata, SPRING_SERVLET_RESERVED_HEADERS);
  headers.Accept = SPRING_SERVLET_CONTENT_TYPE;
  headers['Content-Type'] = SPRING_SERVLET_CONTENT_TYPE;
  headers.TE = SPRING_SERVLET_TE_TRAILERS;
  if (request.timeoutMs && request.timeoutMs > 0) {
    headers['grpc-timeout'] = `${request.timeoutMs}m`;
  }
  return headers;
}

function responseBodyToUint8Array(body: ArrayBuffer): Uint8Array {
  return new Uint8Array(body);
}

function mapFetchFailure(error: unknown, abortCause?: SpringServletAbortCause): GrpcApiClientError {
  return mapBrowserTransportFetchFailure('call', error, {
    transportMode: 'spring-servlet',
    abortCause,
  });
}

function isSpringServletPathNotFoundError(error: GrpcApiClientError): boolean {
  const details = extractBrowserTransportFailure(error.toErrorBody());
  return details?.browserTransportFailure === 'protocol_mismatch' && details.httpStatus === 404;
}

interface SpringServletFetchContext {
  headers: Record<string, string>;
  bodyInit: BodyInit;
  signal: AbortSignal;
  fetchFn: SpringServletUnaryFetchFn;
  protosetBase64: string;
  methodTypes: { requestTypeName: string; responseTypeName: string };
  started: number;
}

async function fetchSpringServletUnaryAtUrl(
  url: string,
  ctx: SpringServletFetchContext,
): Promise<GrpcCallResult> {
  const response = await ctx.fetchFn(url, {
    method: 'POST',
    headers: ctx.headers,
    body: ctx.bodyInit,
    signal: ctx.signal,
  });

  if (response.status === 404) {
    throw buildBrowserTransportGrpcApiError('call', 'protocol_mismatch', {
      transportMode: 'spring-servlet',
      httpStatus: 404,
      fallbackMessage: `Spring Servlet HTTP 404 ${response.statusText}`,
    });
  }

  const contentType = response.headers.get('content-type') ?? SPRING_SERVLET_CONTENT_TYPE;
  const incompatibleContentType = assertIncompatibleBrowserTransportContentType(
    contentType,
    'spring-servlet',
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
      transportMode: 'spring-servlet',
    });
    throw buildBrowserTransportGrpcApiError('call', kind, {
      transportMode: 'spring-servlet',
      httpStatus: response.status,
      fallbackMessage: `Spring Servlet HTTP ${response.status} ${response.statusText}`,
    });
  }

  const normalized = normalizeGrpcWebUnaryResponse({
    responseHeaders: response.headers,
    body: rawBody,
    contentType,
  });

  let decodedBody: Record<string, unknown> | undefined;
  const firstPayload = normalized.dataPayloads[0];
  if (firstPayload && firstPayload.length > 0) {
    decodedBody = decodeGrpcWebProtoMessage(
      ctx.protosetBase64,
      ctx.methodTypes.responseTypeName,
      firstPayload,
    );
  }

  const durationMs = Math.round(performance.now() - ctx.started);
  return {
    callType: 'unary',
    status: normalized.status,
    statusMessage: normalized.statusMessage,
    headers: normalized.headers,
    trailers: normalized.trailers,
    body: decodedBody,
    durationMs,
    transportUsed: 'spring-servlet',
    ...(normalized.status !== 0
      ? { errorDetail: normalized.statusMessage }
      : {}),
  };
}

/** Invoke unary call via browser fetch + Spring Servlet path/body conventions. */
export async function invokeGrpcSpringServletUnary(
  input: SpringServletUnaryInvokeInput,
): Promise<GrpcCallResult> {
  const started = performance.now();
  const { request, tabId, protosetBase64 } = input;

  let servletUrls: string[];
  try {
    servletUrls = buildSpringServletMethodUrls(request.target, request.service, request.method);
  } catch (error) {
    if (error instanceof SpringServletPathResolutionError) {
      throw new GrpcApiClientError('call', error.message, {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'validation',
        retryable: false,
      });
    }
    throw error;
  }

  const root = loadProtobufRootFromProtosetBase64(protosetBase64);
  const methodTypes = input.requestTypeName && input.responseTypeName
    ? { requestTypeName: input.requestTypeName, responseTypeName: input.responseTypeName }
    : resolveGrpcWebMethodTypes(root, request.service, request.method);

  const requestBytes = encodeGrpcWebProtoMessage(
    protosetBase64,
    methodTypes.requestTypeName,
    request.body,
  );
  const framedBody = encodeGrpcWebDataFrame(requestBytes);
  const bodyInit = framedBody.buffer.slice(
    framedBody.byteOffset,
    framedBody.byteOffset + framedBody.byteLength,
  ) as BodyInit;

  const headers = buildSpringServletRequestHeaders(request);

  const controller = new AbortController();
  const key = inFlightKey(tabId, request.requestId);
  const inFlight: SpringServletInFlightCall = { controller };
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

  const fetchContext: SpringServletFetchContext = {
    headers,
    bodyInit,
    signal,
    fetchFn,
    protosetBase64,
    methodTypes,
    started,
  };

  try {
    let lastError: GrpcApiClientError | undefined;
    for (let index = 0; index < servletUrls.length; index += 1) {
      const url = servletUrls[index]!;
      const hasMoreCandidates = index < servletUrls.length - 1;
      try {
        return await fetchSpringServletUnaryAtUrl(url, fetchContext);
      } catch (error) {
        if (error instanceof GrpcApiClientError) {
          if (hasMoreCandidates && isSpringServletPathNotFoundError(error)) {
            lastError = error;
            continue;
          }
          throw error;
        }
        throw mapFetchFailure(error, inFlight.abortCause);
      }
    }
    throw lastError ?? new GrpcApiClientError('call', 'Spring Servlet path resolution failed', {
      code: GRPC_ERROR_CODES.UNREACHABLE,
      category: 'unreachable',
      retryable: true,
    });
  } catch (error) {
    if (error instanceof GrpcApiClientError) {
      throw error;
    }
    const decodeFailure = mapBrowserTransportDecodeFailure('spring-servlet', error);
    if (decodeFailure) {
      throw decodeFailure;
    }
    throw mapFetchFailure(error, inFlight.abortCause);
  } finally {
    inFlight.clearTimeoutTimer?.();
    inFlightCalls.delete(key);
  }
}

/** Abort an in-flight Spring Servlet unary fetch for the given tab/request. */
export function cancelGrpcSpringServletUnary(tabId: string, requestId: string): boolean {
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

export function resetGrpcSpringServletUnaryClientForTests(): void {
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
