/**
 * gRPC Studio — browser stream transport (Phase 2E).
 */
import {
  GRPC_ERROR_CODES,
  type GrpcRouteEnvelope,
  type GrpcStreamCancelResult,
  type GrpcStreamEndResult,
  type GrpcStreamEvent,
  type GrpcStreamSendRequest,
  type GrpcStreamStartRequest,
  type GrpcStreamStartResponse,
  type GrpcSuccessEnvelope,
} from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import {
  assertGrpcTransportDispatchReady,
  resolveGrpcBrowserTransportAdapterForTab,
} from './grpcBrowserTransportRouter';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import { resolveGrpcTransportForTab } from './grpcTransportTabRouting';
import {
  buildGrpcStreamQuery,
  expressGrpcProxyDispatchJson,
  resolveGrpcExpressStreamJsonTransport,
  setGrpcExpressStreamJsonTransportOverride,
} from './grpcExpressProxyJsonTransport';
import { openGrpcStreamEventsViaSse } from './grpcStreamSseEvents';
// Re-export the imported binding (single module reference) so HMR has one fewer
// re-export edge to keep in sync than `export { ... } from './grpcStreamSseEvents'`.
export { openGrpcStreamEventsViaSse };
import {
  assertIncompatibleBrowserTransportContentType,
  buildBrowserTransportGrpcApiError,
  classifyBrowserTransportHttpResponse,
  mapBrowserTransportDecodeFailure,
  mapBrowserTransportFetchFailure,
} from './grpcBrowserTransportErrorMapper';
import { assertBrowserDirectTargetAllowsFetch } from './grpcWebNativeTargetGuard';
import {
  decodeGrpcWebProtoMessage,
  encodeGrpcWebProtoMessage,
  loadProtobufRootFromProtosetBase64,
  resolveGrpcWebMethodTypes,
} from './grpcWebProtoCodec';
import {
  encodeGrpcWebDataFrame,
  encodeGrpcWebRequestBody,
} from './grpcWebFramingCodec';
import {
  normalizeGrpcWebUnaryResponse,
} from './grpcWebTrailerNormalize';
import {
  buildBrowserTransportUserMetadataHeaders,
} from './grpcBrowserTransportMetadataNorm';
import {
  GRPC_WEB_CONTENT_TYPES,
  GRPC_WEB_RESERVED_HEADERS,
} from './grpcWebTransportContracts';
import {
  buildSpringServletMethodUrls,
} from './grpcSpringServletPathResolver';
import {
  SPRING_SERVLET_CONTENT_TYPE,
  SPRING_SERVLET_RESERVED_HEADERS,
  SPRING_SERVLET_TE_TRAILERS,
} from './grpcSpringServletTransportContracts';
import { prepareGrpcTauriDescriptorPayload } from './grpcTauriDescriptorBridge';

export type GrpcStreamEventsState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed';

export interface GrpcStreamEventsCallbacks {
  onEvent: (event: GrpcStreamEvent) => void;
  onStateChange?: (state: GrpcStreamEventsState, attempt?: number) => void;
  onError?: (message: string) => void;
}

export interface OpenGrpcStreamEventsOptions extends GrpcStreamEventsCallbacks {
  lastSequence?: number;
  /** When set, native adapter rejects events whose requestId does not match. */
  expectedRequestId?: string;
  /** Called on each connect/reconnect to read the latest dedupe cursor. */
  resolveLastSequence?: () => number;
  signal?: AbortSignal;
}

type GrpcStreamTransport = (
  path: string,
  init: RequestInit,
) => Promise<GrpcRouteEnvelope<unknown>>;

export type GrpcStreamEventsOpener = (
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
) => () => void;

let streamEventsOpenerOverride: GrpcStreamEventsOpener | null = null;

type BrowserDirectStreamMode = Extract<GrpcStudioTransportMode, 'grpc-web' | 'spring-servlet'>;

type BrowserDirectAbortCause = 'cancel' | 'timeout';

interface BrowserDirectStreamSession {
  streamId: string;
  requestId: string;
  tabId: string;
  mode: BrowserDirectStreamMode;
  lastSequence: number;
  cursorAtTerminal: number;
  events: GrpcStreamEvent[];
  listeners: Set<(event: GrpcStreamEvent) => void>;
  controller: AbortController;
  clearTimeoutTimer?: () => void;
  abortCause?: BrowserDirectAbortCause;
  terminal: boolean;
}

const browserDirectStreamSessions = new Map<string, BrowserDirectStreamSession>();

export function setGrpcStreamTransport(transport: GrpcStreamTransport | null): void {
  setGrpcExpressStreamJsonTransportOverride(
    transport ? (path, init, _op) => transport(path, init) : null,
  );
}

export function setGrpcStreamEventsOpener(opener: GrpcStreamEventsOpener | null): void {
  streamEventsOpenerOverride = opener;
}

async function dispatchJson<T>(
  op: import('./contracts').GrpcOperation,
  path: string,
  init: RequestInit,
): Promise<GrpcSuccessEnvelope<T>> {
  return expressGrpcProxyDispatchJson<T>(
    op,
    path,
    init,
    resolveGrpcExpressStreamJsonTransport(),
  );
}

/** Express proxy stream transport (fetch JSON envelopes) — Phase 7F bypass for express tabs on desktop. */
export { expressGrpcProxyJsonFetch as expressGrpcStreamTransport } from './grpcExpressProxyJsonTransport';

export type GrpcStreamStartOptions = {
  /** Phase 10B — frozen snapshot transport mode overrides live tab registry. */
  transportMode?: GrpcStudioTransportMode;
};

export async function startGrpcStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  options?: GrpcStreamStartOptions,
): Promise<GrpcSuccessEnvelope<GrpcStreamStartResponse>> {
  const mode = options?.transportMode ?? resolveGrpcTransportForTab(tabId);
  assertGrpcTransportDispatchReady(mode);
  const adapter = resolveGrpcBrowserTransportAdapterForTab(tabId, options?.transportMode);
  if (!adapter.startStream) {
    // Phase 10H boundary: browser-direct streaming remains constrained to server_streaming only.
    if ((mode === 'grpc-web' || mode === 'spring-servlet') && request.callType === 'server_streaming') {
      return startBrowserDirectServerStream(request, tabId, mode);
    }
    const message = mode === 'grpc-web' || mode === 'spring-servlet'
      ? `${mode} does not support ${request.callType} stream start. Only server_streaming is available in browser-direct mode. Switch to Express Proxy for this call type.`
      : `Transport ${mode} does not support stream start`;
    throw new GrpcApiClientError('stream_start', message, {
      code: 'GRPC_INVALID_REQUEST',
      retryable: false,
      category: 'validation',
      details: {
        suggestExpressProxy: true,
        transportMode: mode,
      },
    });
  }
  return adapter.startStream(request, tabId);
}

export async function sendGrpcStreamMessage(
  streamId: string,
  tabId: string,
  request: GrpcStreamSendRequest,
): Promise<GrpcSuccessEnvelope<{ streamId: string; tabId: string; sequence: number }>> {
  const directSession = browserDirectStreamSessions.get(streamId);
  if (directSession && directSession.tabId === tabId) {
    throw new GrpcApiClientError(
      'stream_send',
      `Browser-direct ${directSession.mode} server streaming does not accept client stream messages. Switch to Express Proxy for client/bidi streaming.`,
      {
        code: 'GRPC_INVALID_REQUEST',
        category: 'validation',
        retryable: false,
      },
    );
  }
  const query = buildGrpcStreamQuery(tabId);
  return dispatchJson(
    'stream_send',
    `/api/grpc/stream/${encodeURIComponent(streamId)}/send?${query}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export async function endGrpcStream(
  streamId: string,
  tabId: string,
): Promise<GrpcSuccessEnvelope<GrpcStreamEndResult>> {
  const directSession = browserDirectStreamSessions.get(streamId);
  if (directSession && directSession.tabId === tabId) {
    throw new GrpcApiClientError(
      'stream_end',
      `Browser-direct ${directSession.mode} server streaming does not support client half-close. Switch to Express Proxy for client/bidi streaming.`,
      {
        code: 'GRPC_INVALID_REQUEST',
        category: 'validation',
        retryable: false,
      },
    );
  }
  const query = buildGrpcStreamQuery(tabId);
  return dispatchJson(
    'stream_end',
    `/api/grpc/stream/${encodeURIComponent(streamId)}/end?${query}`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
    },
  );
}

export async function cancelGrpcStream(
  streamId: string,
  tabId: string,
): Promise<GrpcSuccessEnvelope<GrpcStreamCancelResult>> {
  const directSession = browserDirectStreamSessions.get(streamId);
  if (directSession && directSession.tabId === tabId) {
    directSession.abortCause = 'cancel';
    directSession.clearTimeoutTimer?.();
    directSession.controller.abort();
    if (!directSession.terminal) {
      emitBrowserDirectStreamEvent(directSession, {
        type: 'grpc-error',
        status: 1,
        statusMessage: 'Cancelled',
      });
    }
    return {
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId,
        requestId: directSession.requestId,
        tabId,
        cancelled: true,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: directSession.requestId,
      },
    };
  }
  const query = buildGrpcStreamQuery(tabId);
  return dispatchJson(
    'stream_cancel',
    `/api/grpc/stream/${encodeURIComponent(streamId)}?${query}`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
  );
}

/** Phase 7E — reject cross-tab/stream/request bleed on SSE delivery. */
function shouldDeliverGrpcStreamEventToSubscriber(
  event: GrpcStreamEvent,
  streamId: string,
  tabId: string,
  expectedRequestId?: string,
): boolean {
  if (event.tabId !== tabId || event.streamId !== streamId) {
    return false;
  }
  if (expectedRequestId && event.requestId !== expectedRequestId) {
    return false;
  }
  return true;
}

export function openGrpcStreamEvents(
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
): () => void {
  const localOpen = openBrowserDirectStreamEvents(streamId, tabId, options);
  if (localOpen) {
    return localOpen;
  }
  if (streamEventsOpenerOverride) {
    return streamEventsOpenerOverride(streamId, tabId, options);
  }
  return openGrpcStreamEventsViaSse(streamId, tabId, options);
}

/** Returns true when `sequence` is new relative to `lastSequence` (strictly greater). */
export function shouldAcceptGrpcStreamSequence(sequence: number, lastSequence: number): boolean {
  return sequence > lastSequence;
}

function streamEventTimestamp(): string {
  return new Date().toISOString();
}

function createBrowserDirectStreamSession(
  request: GrpcStreamStartRequest,
  tabId: string,
  mode: BrowserDirectStreamMode,
): BrowserDirectStreamSession {
  const streamId = globalThis.crypto?.randomUUID?.() ?? `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const session: BrowserDirectStreamSession = {
    streamId,
    requestId: request.requestId,
    tabId,
    mode,
    lastSequence: 0,
    cursorAtTerminal: 0,
    events: [],
    listeners: new Set(),
    controller: new AbortController(),
    terminal: false,
  };
  browserDirectStreamSessions.set(streamId, session);
  return session;
}

function emitBrowserDirectStreamEvent(
  session: BrowserDirectStreamSession,
  input: Omit<GrpcStreamEvent, 'streamId' | 'requestId' | 'tabId' | 'sequence' | 'timestamp'>,
): void {
  if (session.terminal) return;
  session.lastSequence += 1;
  const event: GrpcStreamEvent = {
    ...input,
    streamId: session.streamId,
    requestId: session.requestId,
    tabId: session.tabId,
    sequence: session.lastSequence,
    timestamp: streamEventTimestamp(),
  };
  session.events.push(event);
  for (const listener of session.listeners) {
    listener(event);
  }
  if (event.type === 'grpc-end' || event.type === 'grpc-error') {
    session.terminal = true;
    session.cursorAtTerminal = session.lastSequence;
    queueMicrotask(() => {
      if (browserDirectStreamSessions.get(session.streamId) !== session) return;
      if (session.cursorAtTerminal !== session.lastSequence) return;
      browserDirectStreamSessions.delete(session.streamId);
    });
  }
}

async function startBrowserDirectServerStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  mode: BrowserDirectStreamMode,
): Promise<GrpcSuccessEnvelope<GrpcStreamStartResponse>> {
  const session = createBrowserDirectStreamSession(request, tabId, mode);
  void executeBrowserDirectServerStream(session, request).catch((error) => {
    if (session.terminal) return;
    if (error instanceof GrpcApiClientError) {
      emitBrowserDirectStreamEvent(session, {
        type: 'grpc-error',
        status: 2,
        statusMessage: error.message,
      });
      return;
    }
    const decodeFailure = mapBrowserTransportDecodeFailure(mode, error);
    const grpcError = decodeFailure ?? mapBrowserTransportFetchFailure('stream_start', error, {
      transportMode: mode,
      abortCause: session.abortCause,
    });
    emitBrowserDirectStreamEvent(session, {
      type: 'grpc-error',
      status: 2,
      statusMessage: grpcError.message,
    });
  });

  return {
    ok: true,
    op: 'stream_start',
    data: {
      streamId: session.streamId,
      requestId: request.requestId,
      tabId,
    },
    meta: {
      timestamp: streamEventTimestamp(),
      requestId: request.requestId,
    },
  };
}

function buildGrpcWebStreamHeaders(request: GrpcStreamStartRequest, contentType: string): Record<string, string> {
  const { headers } = buildBrowserTransportUserMetadataHeaders(request.metadata, GRPC_WEB_RESERVED_HEADERS);
  headers.Accept = `${GRPC_WEB_CONTENT_TYPES.BINARY}, ${GRPC_WEB_CONTENT_TYPES.TEXT}`;
  headers['Content-Type'] = contentType;
  headers['X-Grpc-Web'] = '1';
  if (request.timeoutMs && request.timeoutMs > 0) {
    headers['grpc-timeout'] = `${request.timeoutMs}m`;
  }
  return headers;
}

function buildSpringServletStreamHeaders(request: GrpcStreamStartRequest): Record<string, string> {
  const { headers } = buildBrowserTransportUserMetadataHeaders(request.metadata, SPRING_SERVLET_RESERVED_HEADERS);
  headers.Accept = SPRING_SERVLET_CONTENT_TYPE;
  headers['Content-Type'] = SPRING_SERVLET_CONTENT_TYPE;
  headers.TE = SPRING_SERVLET_TE_TRAILERS;
  if (request.timeoutMs && request.timeoutMs > 0) {
    headers['grpc-timeout'] = `${request.timeoutMs}m`;
  }
  return headers;
}

function scheduleBrowserDirectStreamTimeout(
  session: BrowserDirectStreamSession,
  timeoutMs?: number,
): void {
  if (!timeoutMs || timeoutMs <= 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  timer = setTimeout(() => {
    session.abortCause = 'timeout';
    session.controller.abort();
  }, timeoutMs);
  session.clearTimeoutTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
  };
}

async function executeBrowserDirectServerStream(
  session: BrowserDirectStreamSession,
  request: GrpcStreamStartRequest,
): Promise<void> {
  try {
    const descriptorPayload = await prepareGrpcTauriDescriptorPayload({
      descriptorKey: request.descriptorKey.trim(),
      requestId: request.requestId,
    });
    const protosetBase64 = descriptorPayload.protosetBase64;
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    const methodTypes = resolveGrpcWebMethodTypes(root, request.service, request.method);
    const requestBytes = encodeGrpcWebProtoMessage(
      protosetBase64,
      methodTypes.requestTypeName,
      request.body,
    );

    let response: Response;
    if (session.mode === 'grpc-web') {
      const blocked = assertBrowserDirectTargetAllowsFetch('stream_start', 'grpc-web', request.target);
      if (blocked) {
        throw blocked;
      }
      const encodedBody = encodeGrpcWebRequestBody(requestBytes, GRPC_WEB_CONTENT_TYPES.BINARY);
      const headers = buildGrpcWebStreamHeaders(request, encodedBody.contentType);
      scheduleBrowserDirectStreamTimeout(session, request.timeoutMs);
      response = await fetch(buildGrpcWebMethodUrl(request.target, request.service, request.method), {
        method: 'POST',
        headers,
        body: encodedBody.body,
        signal: session.controller.signal,
      });
    } else {
      const framedBody = encodeGrpcWebDataFrame(requestBytes);
      const body = framedBody.buffer.slice(
        framedBody.byteOffset,
        framedBody.byteOffset + framedBody.byteLength,
      ) as BodyInit;
      const headers = buildSpringServletStreamHeaders(request);
      const urls = buildSpringServletMethodUrls(request.target, request.service, request.method);
      scheduleBrowserDirectStreamTimeout(session, request.timeoutMs);
      response = await fetchSpringServletStreamWithFallback(urls, {
        method: 'POST',
        headers,
        body,
        signal: session.controller.signal,
      });
    }

    const contentType = response.headers.get('content-type')
      ?? (session.mode === 'grpc-web' ? GRPC_WEB_CONTENT_TYPES.BINARY : SPRING_SERVLET_CONTENT_TYPE);
    const incompatibleContentType = assertIncompatibleBrowserTransportContentType(
      contentType,
      session.mode,
      response.status,
    );
    if (incompatibleContentType) {
      throw incompatibleContentType;
    }

    const rawBuffer = await response.arrayBuffer();
    const rawBody = new Uint8Array(rawBuffer);

    if (!response.ok && rawBody.length === 0) {
      const kind = classifyBrowserTransportHttpResponse({
        httpStatus: response.status,
        contentType,
        bodyLength: 0,
        transportMode: session.mode,
      });
      throw buildBrowserTransportGrpcApiError('stream_start', kind, {
        transportMode: session.mode,
        httpStatus: response.status,
        fallbackMessage: `${session.mode} HTTP ${response.status} ${response.statusText}`,
      });
    }

    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: response.headers,
      body: rawBody,
      contentType,
    });

    for (const payload of normalized.dataPayloads) {
      const decoded = decodeGrpcWebProtoMessage(
        protosetBase64,
        methodTypes.responseTypeName,
        payload,
      );
      emitBrowserDirectStreamEvent(session, {
        type: 'grpc-message',
        direction: 'inbound',
        data: decoded,
      });
    }

    const terminalBase = {
      status: normalized.status,
      statusMessage: normalized.statusMessage,
      headers: normalized.headers,
      trailers: normalized.trailers,
    };
    if (normalized.status === 0) {
      emitBrowserDirectStreamEvent(session, {
        type: 'grpc-end',
        ...terminalBase,
      });
    } else {
      emitBrowserDirectStreamEvent(session, {
        type: 'grpc-error',
        ...terminalBase,
      });
    }
  } finally {
    session.clearTimeoutTimer?.();
  }
}

function buildGrpcWebMethodUrl(
  target: GrpcStreamStartRequest['target'],
  service: string,
  method: string,
): string {
  const scheme = target.tlsMode === 'disabled' ? 'http' : 'https';
  const servicePath = service.startsWith('/') ? service : `/${service}`;
  return `${scheme}://${target.address}${servicePath}/${method}`;
}

function isSpringServletPathNotFoundError(error: GrpcApiClientError): boolean {
  const details = error.toErrorBody().details;
  if (!details || typeof details !== 'object') {
    return false;
  }
  const maybe = details as { httpStatus?: unknown; browserTransportFailure?: unknown };
  return maybe.browserTransportFailure === 'protocol_mismatch' && maybe.httpStatus === 404;
}

async function fetchSpringServletStreamWithFallback(
  urls: string[],
  init: RequestInit,
): Promise<Response> {
  let lastError: GrpcApiClientError | undefined;
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]!;
    const hasMore = index < urls.length - 1;
    try {
      const response = await fetch(url, init);
      if (response.status === 404) {
        throw buildBrowserTransportGrpcApiError('stream_start', 'protocol_mismatch', {
          transportMode: 'spring-servlet',
          httpStatus: 404,
          fallbackMessage: `Spring Servlet HTTP 404 ${response.statusText}`,
        });
      }
      return response;
    } catch (error) {
      if (error instanceof GrpcApiClientError) {
        if (hasMore && isSpringServletPathNotFoundError(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
      throw error;
    }
  }
  throw lastError ?? new GrpcApiClientError('stream_start', 'Spring Servlet path resolution failed', {
    code: GRPC_ERROR_CODES.UNREACHABLE,
    category: 'unreachable',
    retryable: true,
  });
}

function openBrowserDirectStreamEvents(
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
): (() => void) | null {
  const session = browserDirectStreamSessions.get(streamId);
  if (!session || session.tabId !== tabId) {
    return null;
  }

  let disposed = false;
  let cursor = options.resolveLastSequence?.() ?? options.lastSequence ?? 0;

  const deliver = (event: GrpcStreamEvent) => {
    if (disposed) return;
    if (!shouldDeliverGrpcStreamEventToSubscriber(event, streamId, tabId, options.expectedRequestId)) {
      return;
    }
    if (!shouldAcceptGrpcStreamSequence(event.sequence, cursor)) {
      return;
    }
    cursor = event.sequence;
    options.onEvent(event);
  };

  options.onStateChange?.('connecting');
  for (const event of session.events) {
    deliver(event);
  }
  if (session.terminal) {
    options.onStateChange?.('closed');
    return () => undefined;
  }

  session.listeners.add(deliver);
  options.onStateChange?.('connected');

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    session.listeners.delete(deliver);
    options.onStateChange?.('closed');
  };

  if (options.signal?.aborted) {
    dispose();
    return dispose;
  }
  options.signal?.addEventListener('abort', () => dispose(), { once: true });
  return dispose;
}

export function resetBrowserDirectGrpcStreamsForTests(): void {
  for (const session of browserDirectStreamSessions.values()) {
    session.clearTimeoutTimer?.();
    session.controller.abort();
  }
  browserDirectStreamSessions.clear();
}
