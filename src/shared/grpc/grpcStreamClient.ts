/**
 * gRPC Studio — browser stream transport (Phase 2E).
 */
import {
  GRPC_STREAM_RECONNECT_BACKOFF_MS,
  GRPC_STREAM_RECONNECT_MAX_ATTEMPTS,
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
import { parseGrpcSseStream, parseGrpcStreamEventJson } from './grpcStreamSseParser';

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
    const message = mode === 'grpc-web'
      ? 'gRPC-Web server streaming is not yet available in Studio (Phase 10H). Switch to Express Proxy for server streaming.'
      : mode === 'spring-servlet'
        ? 'Spring Servlet server streaming is not yet available in Studio (Phase 10H). Switch to Express Proxy for server streaming.'
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function isNonRetryableGrpcStreamEventsStatus(status: number): boolean {
  return status === 404 || status === 409;
}

function isTerminalGrpcStreamEvent(event: GrpcStreamEvent): boolean {
  return event.type === 'grpc-end' || event.type === 'grpc-error';
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

function parseGrpcStreamEventFrame(eventName: string, data: string): GrpcStreamEvent | null {
  try {
    const parsed = parseGrpcStreamEventJson(data);
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      return null;
    }
    const event = parsed as GrpcStreamEvent;
    if (event.type !== eventName && eventName !== 'message') {
      // Server sets both SSE event name and JSON type — prefer JSON type.
    }
    return event;
  } catch {
    return null;
  }
}

/**
 * Opens SSE subscription to stream events with reconnect policy (max 3, 1s/2s/4s backoff).
 * Returns dispose function — aborts fetch and stops reconnect loop.
 */
export function openGrpcStreamEventsViaSse(
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
): () => void {
  const abortController = new AbortController();
  if (options.signal) {
    options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  let disposed = false;
  let reconnectAttempt = 0;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    options.onStateChange?.('closed');
  };

  const connectLoop = async () => {
    while (!disposed) {
      const isReconnect = reconnectAttempt > 0;
      options.onStateChange?.(isReconnect ? 'reconnecting' : 'connecting', reconnectAttempt);

      const query = buildGrpcStreamQuery(tabId, {
        lastSequence: options.resolveLastSequence?.() ?? options.lastSequence,
      });
      const url = `/api/grpc/stream/${encodeURIComponent(streamId)}/events?${query}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          let message = `Stream events failed (${response.status})`;
          try {
            const envelope = JSON.parse(errorBody) as GrpcRouteEnvelope<never>;
            if (!envelope.ok) {
              message = envelope.error.message;
            }
          } catch {
            // use default message
          }
          if (isNonRetryableGrpcStreamEventsStatus(response.status)) {
            options.onError?.(message);
            options.onStateChange?.('closed');
            return;
          }
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error('Stream events response has no body');
        }

        reconnectAttempt = 0;
        options.onStateChange?.('connected');

        let sawTerminal = false;
        for await (const frame of parseGrpcSseStream(response.body)) {
          if (disposed) break;
          if (frame.event === 'grpc-heartbeat') {
            continue;
          }
          const event = parseGrpcStreamEventFrame(frame.event, frame.data);
          if (!event) continue;
          if (!shouldDeliverGrpcStreamEventToSubscriber(
            event,
            streamId,
            tabId,
            options.expectedRequestId,
          )) {
            continue;
          }
          options.onEvent(event);
          if (isTerminalGrpcStreamEvent(event)) {
            sawTerminal = true;
            break;
          }
        }

        if (disposed || sawTerminal) {
          return;
        }

        // Stream ended without terminal event — treat as disconnect, try reconnect.
        throw new Error('SSE stream closed unexpectedly');
      } catch (error) {
        if (disposed) return;
        if (error instanceof DOMException && error.name === 'AbortError') {
          options.onStateChange?.('closed');
          return;
        }

        reconnectAttempt += 1;
        if (reconnectAttempt > GRPC_STREAM_RECONNECT_MAX_ATTEMPTS) {
          const message = error instanceof Error ? error.message : String(error);
          options.onError?.(message);
          options.onStateChange?.('closed');
          return;
        }

        const backoff = GRPC_STREAM_RECONNECT_BACKOFF_MS[
          Math.min(reconnectAttempt - 1, GRPC_STREAM_RECONNECT_BACKOFF_MS.length - 1)
        ]!;
        try {
          await sleep(backoff, abortController.signal);
        } catch {
          options.onStateChange?.('closed');
          return;
        }
      }
    }
  };

  void connectLoop();
  return dispose;
}

export function openGrpcStreamEvents(
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
): () => void {
  if (streamEventsOpenerOverride) {
    return streamEventsOpenerOverride(streamId, tabId, options);
  }
  return openGrpcStreamEventsViaSse(streamId, tabId, options);
}

/** Returns true when `sequence` is new relative to `lastSequence` (strictly greater). */
export function shouldAcceptGrpcStreamSequence(sequence: number, lastSequence: number): boolean {
  return sequence > lastSequence;
}
