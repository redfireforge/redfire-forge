/**
 * Phase 6D — bounded server-stream message collector for workflow nodes.
 */
import type {
  GrpcStreamEvent,
  GrpcStreamStartRequest,
} from '../../../shared/grpc/contracts';
import type { GrpcStudioTransportMode } from '../../../shared/grpc/grpcWebTransportContracts';
import { parseGrpcSseStream, parseGrpcStreamEventJson } from '../../../shared/grpc/grpcStreamSseParser';
import {
  cancelGrpcStream,
  openGrpcStreamEvents,
  startGrpcStream,
} from '../../../shared/grpc/grpcStreamClient';
import type { GrpcServerStreamCollectConfig } from '../types/workflow/node-grpc';
import { evaluateGrpcStreamUntilExpression } from './grpcWorkflowUntilExpression';

export type GrpcWorkflowStreamStopReason =
  | 'max_messages'
  | 'until_expression'
  | 'max_duration'
  | 'stream_end'
  | 'stream_error'
  | 'cancelled'
  | 'transport_error';

export interface GrpcWorkflowStreamCollectionResult {
  messages: Record<string, unknown>[];
  durationMs: number;
  grpcStatus: number;
  grpcStatusMessage: string;
  trailers: Record<string, string>;
  stopReason: GrpcWorkflowStreamStopReason;
  errorDetail?: string;
}

export interface GrpcWorkflowStreamCollectorDeps {
  startStream?: typeof startGrpcStream;
  cancelStream?: typeof cancelGrpcStream;
  openStreamEvents?: typeof openGrpcStreamEvents;
  /** @deprecated Test seam only — production uses `openStreamEvents` (native + SSE via grpcStreamClient). */
  fetchEvents?: (
    url: string,
    init: RequestInit,
  ) => Promise<Response>;
}

function parseStreamEventFrame(_eventName: string, data: string): GrpcStreamEvent | null {
  try {
    const parsed = parseGrpcStreamEventJson(data);
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      return null;
    }
    return parsed as GrpcStreamEvent;
  } catch {
    return null;
  }
}

function buildEventsUrl(streamId: string, tabId: string): string {
  const params = new URLSearchParams();
  params.set('tabId', tabId);
  params.set('lastSequence', '0');
  return `/api/grpc/stream/${encodeURIComponent(streamId)}/events?${params.toString()}`;
}

function shouldStopOnStreamEvent(
  event: GrpcStreamEvent,
  collect: GrpcServerStreamCollectConfig,
  messages: Record<string, unknown>[],
  state: {
    stopReason?: GrpcWorkflowStreamStopReason;
    grpcStatus: number;
    grpcStatusMessage: string;
    trailers: Record<string, string>;
    errorDetail?: string;
  },
): boolean {
  if (event.type === 'grpc-message' && event.data) {
    messages.push(event.data);
    if (
      collect.untilExpression
      && evaluateGrpcStreamUntilExpression(collect.untilExpression, event.data)
    ) {
      state.stopReason = 'until_expression';
      return true;
    }
    if (collect.maxMessages && messages.length >= collect.maxMessages) {
      state.stopReason = 'max_messages';
      return true;
    }
    return false;
  }

  if (event.type === 'grpc-end') {
    state.stopReason = 'stream_end';
    state.grpcStatus = event.status ?? 0;
    state.grpcStatusMessage = event.statusMessage ?? 'OK';
    state.trailers = event.trailers ?? {};
    return true;
  }

  if (event.type === 'grpc-error') {
    state.stopReason = 'stream_error';
    state.grpcStatus = event.status ?? 13;
    state.grpcStatusMessage = event.statusMessage ?? 'Stream error';
    state.trailers = event.trailers ?? {};
    state.errorDetail = event.statusMessage ?? 'Stream error';
    return true;
  }

  return false;
}

async function collectEventsViaOpenStream(
  streamId: string,
  tabId: string,
  requestId: string | undefined,
  collect: GrpcServerStreamCollectConfig,
  controller: AbortController,
  abortReason: () => 'cancelled' | 'max_duration' | undefined,
  openStreamEvents: typeof openGrpcStreamEvents,
  messages: Record<string, unknown>[],
  state: {
    stopReason?: GrpcWorkflowStreamStopReason;
    grpcStatus: number;
    grpcStatusMessage: string;
    trailers: Record<string, string>;
    errorDetail?: string;
  },
  startedAt: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const streamCleanup = { dispose: undefined as (() => void) | undefined };

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      controller.signal.removeEventListener('abort', onAbort);
      streamCleanup.dispose?.();
      handler();
    };

    const onAbort = () => {
      state.stopReason = state.stopReason ?? abortReason() ?? 'cancelled';
      finish(() => resolve());
    };

    if (controller.signal.aborted) {
      onAbort();
      return;
    }

    controller.signal.addEventListener('abort', onAbort, { once: true });

    streamCleanup.dispose = openStreamEvents(streamId, tabId, {
      expectedRequestId: requestId,
      signal: controller.signal,
      onEvent: (event) => {
        if (controller.signal.aborted) {
          state.stopReason = state.stopReason ?? abortReason() ?? 'cancelled';
          finish(() => resolve());
          return;
        }
        if (collect.maxDurationMs && collect.maxDurationMs > 0) {
          const elapsed = performance.now() - startedAt;
          if (elapsed >= collect.maxDurationMs) {
            state.stopReason = 'max_duration';
            finish(() => resolve());
            return;
          }
        }
        if (shouldStopOnStreamEvent(event, collect, messages, state)) {
          finish(() => resolve());
        }
      },
      onError: (message) => {
        finish(() => reject(new Error(message)));
      },
      onStateChange: (streamState) => {
        if (streamState === 'closed') {
          finish(() => resolve());
        }
      },
    });
  });
}

async function collectEventsViaSseFetch(
  streamId: string,
  tabId: string,
  collect: GrpcServerStreamCollectConfig,
  controller: AbortController,
  abortReason: () => 'cancelled' | 'max_duration' | undefined,
  fetchEvents: NonNullable<GrpcWorkflowStreamCollectorDeps['fetchEvents']>,
  messages: Record<string, unknown>[],
  state: {
    stopReason?: GrpcWorkflowStreamStopReason;
    grpcStatus: number;
    grpcStatusMessage: string;
    trailers: Record<string, string>;
    errorDetail?: string;
  },
  startedAt: number,
): Promise<void> {
  const response = await fetchEvents(buildEventsUrl(streamId, tabId), {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream events failed (${response.status})`);
  }

  for await (const frame of parseGrpcSseStream(response.body, { abortSignal: controller.signal })) {
    if (controller.signal.aborted) {
      state.stopReason = state.stopReason ?? abortReason() ?? 'cancelled';
      break;
    }
    if (collect.maxDurationMs && collect.maxDurationMs > 0) {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= collect.maxDurationMs) {
        state.stopReason = 'max_duration';
        break;
      }
    }
    if (frame.event === 'grpc-heartbeat') continue;

    const event = parseStreamEventFrame(frame.event, frame.data);
    if (!event) continue;

    if (shouldStopOnStreamEvent(event, collect, messages, state)) {
      break;
    }
  }
}

/** Collect inbound server-stream messages until a stop condition or terminal event. */
export async function collectGrpcWorkflowServerStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  collect: GrpcServerStreamCollectConfig,
  options?: {
    abortSignal?: AbortSignal;
    deps?: GrpcWorkflowStreamCollectorDeps;
    /** Phase 10B/11O — frozen snapshot transport overrides tab registry. */
    transportMode?: GrpcStudioTransportMode;
  },
): Promise<GrpcWorkflowStreamCollectionResult> {
  const startStream = options?.deps?.startStream ?? startGrpcStream;
  const cancelStream = options?.deps?.cancelStream ?? cancelGrpcStream;
  const openStreamEvents = options?.deps?.openStreamEvents ?? openGrpcStreamEvents;
  const fetchEvents = options?.deps?.fetchEvents;
  const transportMode = options?.transportMode;

  const startedAt = performance.now();
  const messages: Record<string, unknown>[] = [];
  let stopReason: GrpcWorkflowStreamStopReason | undefined;
  let grpcStatus = 13;
  let grpcStatusMessage = 'Internal';
  let trailers: Record<string, string> = {};
  let errorDetail: string | undefined;
  let streamId: string | undefined;
  const eventState = {
    stopReason: undefined as GrpcWorkflowStreamStopReason | undefined,
    grpcStatus: 13,
    grpcStatusMessage: 'Internal',
    trailers: {} as Record<string, string>,
    errorDetail: undefined as string | undefined,
  };

  const controller = new AbortController();
  let abortReason: 'cancelled' | 'max_duration' | undefined;
  let durationTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDurationTimer = (): void => {
    if (durationTimer !== undefined) {
      clearTimeout(durationTimer);
      durationTimer = undefined;
    }
  };

  if (options?.abortSignal) {
    if (options.abortSignal.aborted) {
      controller.abort();
    } else {
      options.abortSignal.addEventListener('abort', () => {
        abortReason = 'cancelled';
        controller.abort();
      }, { once: true });
    }
  }

  if (collect.maxDurationMs && collect.maxDurationMs > 0) {
    durationTimer = setTimeout(() => {
      abortReason = 'max_duration';
      eventState.stopReason = 'max_duration';
      controller.abort();
    }, collect.maxDurationMs);
  }

  if (controller.signal.aborted) {
    clearDurationTimer();
    return {
      messages: [],
      durationMs: 0,
      grpcStatus: 13,
      grpcStatusMessage: 'Cancelled',
      trailers: {},
      stopReason: 'cancelled',
    };
  }

  try {
    const startEnvelope = await startStream(request, tabId, { transportMode });
    streamId = startEnvelope.data.streamId;
    const resolveAbortReason = () => abortReason;

    if (fetchEvents) {
      await collectEventsViaSseFetch(
        streamId,
        tabId,
        collect,
        controller,
        resolveAbortReason,
        fetchEvents,
        messages,
        eventState,
        startedAt,
      );
    } else {
      await collectEventsViaOpenStream(
        streamId,
        tabId,
        startEnvelope.data.requestId,
        collect,
        controller,
        resolveAbortReason,
        openStreamEvents,
        messages,
        eventState,
        startedAt,
      );
    }

    stopReason = eventState.stopReason;
    grpcStatus = eventState.grpcStatus;
    grpcStatusMessage = eventState.grpcStatusMessage;
    trailers = eventState.trailers;
    errorDetail = eventState.errorDetail;

    if (!stopReason) {
      if (controller.signal.aborted) {
        stopReason = abortReason ?? 'cancelled';
      } else {
        stopReason = 'stream_end';
        grpcStatus = 0;
        grpcStatusMessage = 'OK';
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      stopReason = stopReason ?? abortReason ?? 'cancelled';
    } else {
      stopReason = 'transport_error';
      errorDetail = error instanceof Error ? error.message : String(error);
    }
  } finally {
    clearDurationTimer();
    if (streamId) {
      await cancelStream(streamId, tabId).catch(() => undefined);
    }
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const resolvedStopReason = stopReason ?? 'transport_error';
  const successStop = resolvedStopReason === 'max_messages'
    || resolvedStopReason === 'until_expression'
    || resolvedStopReason === 'max_duration'
    || resolvedStopReason === 'stream_end';

  if (successStop && resolvedStopReason !== 'stream_end') {
    grpcStatus = 0;
    grpcStatusMessage = 'OK';
  }

  return {
    messages,
    durationMs,
    grpcStatus,
    grpcStatusMessage,
    trailers,
    stopReason: resolvedStopReason,
    errorDetail,
  };
}
