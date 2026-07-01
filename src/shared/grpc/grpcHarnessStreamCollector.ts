/**
 * Phase 8C — harness streaming executors (server / client / bidi).
 */
import type { GrpcStreamEvent, GrpcStreamStartRequest } from './contracts';
import type { GrpcHarnessCollectConfig } from '../types/grpc-harness';
import type { GrpcHarnessCallOutcome, GrpcHarnessStreamStopReason } from '../types/grpc-harness-snapshot';
import {
  collectGrpcWorkflowServerStream,
  type GrpcWorkflowStreamCollectionResult,
  type GrpcWorkflowStreamStopReason,
} from '../../features/workflow/utils/grpcWorkflowStreamCollector';
import {
  cancelGrpcStream,
  endGrpcStream,
  openGrpcStreamEvents,
  sendGrpcStreamMessage,
  startGrpcStream,
} from './grpcStreamClient';

export type { GrpcHarnessStreamStopReason };

export interface GrpcHarnessStreamCollectorDeps {
  startStream?: typeof startGrpcStream;
  sendStreamMessage?: typeof sendGrpcStreamMessage;
  endStream?: typeof endGrpcStream;
  cancelStream?: typeof cancelGrpcStream;
  openStreamEvents?: typeof openGrpcStreamEvents;
  collectServerStream?: typeof collectGrpcWorkflowServerStream;
}

function isHarnessStreamSuccess(
  grpcStatus: number,
  stopReason: GrpcHarnessStreamStopReason,
): boolean {
  if (stopReason === 'stream_error' || stopReason === 'transport_error' || stopReason === 'cancelled') {
    return false;
  }
  if (stopReason === 'stream_end') {
    return grpcStatus === 0;
  }
  return true;
}

function toHarnessStopReason(reason: GrpcWorkflowStreamStopReason): GrpcHarnessStreamStopReason {
  if (reason === 'until_expression') {
    return 'stream_end';
  }
  return reason;
}

function serverStreamOutcome(
  collection: GrpcWorkflowStreamCollectionResult,
  attempts: number,
): GrpcHarnessCallOutcome {
  const stopReason = toHarnessStopReason(collection.stopReason);
  const passed = isHarnessStreamSuccess(collection.grpcStatus, stopReason);
  return {
    callType: 'server_streaming',
    passed,
    grpcStatus: collection.grpcStatus,
    grpcStatusMessage: collection.grpcStatusMessage,
    durationMs: collection.durationMs,
    messages: collection.messages,
    trailers: collection.trailers,
    streamStopReason: stopReason,
    attempts,
    errorDetail: passed ? undefined : (collection.errorDetail ?? collection.grpcStatusMessage),
    errorCategory: passed ? undefined : (stopReason === 'transport_error' ? 'network' : 'internal'),
  };
}

/** Bounded server-stream collection for harness scenarios (no untilExpression). */
export async function collectGrpcHarnessServerStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  collect: GrpcHarnessCollectConfig,
  options?: {
    abortSignal?: AbortSignal;
    deps?: GrpcHarnessStreamCollectorDeps;
  },
): Promise<GrpcHarnessCallOutcome> {
  const collectServerStream = options?.deps?.collectServerStream ?? collectGrpcWorkflowServerStream;
  const collection = await collectServerStream(request, tabId, collect, {
    abortSignal: options?.abortSignal,
    deps: options?.deps?.startStream ? {
      startStream: options.deps.startStream,
      cancelStream: options.deps.cancelStream,
      openStreamEvents: options.deps.openStreamEvents,
    } : undefined,
  });
  return serverStreamOutcome(collection, 1);
}

interface OutboundStreamState {
  stopReason?: GrpcHarnessStreamStopReason;
  grpcStatus: number;
  grpcStatusMessage: string;
  trailers: Record<string, string>;
  errorDetail?: string;
  inboundMessages: Record<string, unknown>[];
  terminalBody?: Record<string, unknown>;
}

function applyStreamEvent(
  event: GrpcStreamEvent,
  state: OutboundStreamState,
  collect?: GrpcHarnessCollectConfig,
): boolean {
  if (event.type === 'grpc-message' && event.data) {
    if (event.direction === 'inbound' || event.direction === undefined) {
      state.inboundMessages.push(event.data);
      if (collect?.maxMessages && state.inboundMessages.length >= collect.maxMessages) {
        state.stopReason = 'max_messages';
        return true;
      }
    }
    return false;
  }

  if (event.type === 'grpc-end') {
    state.stopReason = 'stream_end';
    state.grpcStatus = event.status ?? 0;
    state.grpcStatusMessage = event.statusMessage ?? 'OK';
    state.trailers = event.trailers ?? {};
    if (event.data && typeof event.data === 'object') {
      state.terminalBody = event.data;
    }
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

function outboundStreamOutcome(
  callType: 'client_streaming' | 'bidi_streaming',
  state: OutboundStreamState,
  startedAt: number,
  attempts: number,
): GrpcHarnessCallOutcome {
  const durationMs = Math.round(performance.now() - startedAt);
  const stopReason = state.stopReason ?? 'transport_error';
  const passed = isHarnessStreamSuccess(state.grpcStatus, stopReason);
  return {
    callType,
    passed,
    grpcStatus: state.grpcStatus,
    grpcStatusMessage: state.grpcStatusMessage,
    durationMs,
    body: state.terminalBody,
    messages: state.inboundMessages.length > 0 ? state.inboundMessages : undefined,
    trailers: state.trailers,
    streamStopReason: stopReason,
    attempts,
    errorDetail: passed ? undefined : (state.errorDetail ?? state.grpcStatusMessage),
    errorCategory: passed ? undefined : (stopReason === 'transport_error' ? 'network' : 'internal'),
  };
}

async function executeHarnessOutboundStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  callType: 'client_streaming' | 'bidi_streaming',
  sendMessages: Record<string, unknown>[],
  collect: GrpcHarnessCollectConfig | undefined,
  options?: {
    abortSignal?: AbortSignal;
    deps?: GrpcHarnessStreamCollectorDeps;
  },
): Promise<GrpcHarnessCallOutcome> {
  const startStream = options?.deps?.startStream ?? startGrpcStream;
  const sendStreamMessage = options?.deps?.sendStreamMessage ?? sendGrpcStreamMessage;
  const endStreamFn = options?.deps?.endStream ?? endGrpcStream;
  const cancelStream = options?.deps?.cancelStream ?? cancelGrpcStream;
  const openStreamEventsFn = options?.deps?.openStreamEvents ?? openGrpcStreamEvents;

  const startedAt = performance.now();
  const state: OutboundStreamState = {
    grpcStatus: 13,
    grpcStatusMessage: 'Internal',
    trailers: {},
    inboundMessages: [],
  };
  let streamId: string | undefined;
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
      abortReason = 'cancelled';
    } else {
      options.abortSignal.addEventListener('abort', () => {
        abortReason = 'cancelled';
        controller.abort();
      }, { once: true });
    }
  }

  if (collect?.maxDurationMs && collect.maxDurationMs > 0) {
    durationTimer = setTimeout(() => {
      abortReason = 'max_duration';
      state.stopReason = 'max_duration';
      controller.abort();
    }, collect.maxDurationMs);
  }

  if (controller.signal.aborted) {
    clearDurationTimer();
    state.stopReason = abortReason ?? 'cancelled';
    return outboundStreamOutcome(callType, state, startedAt, 1);
  }

  try {
    const startEnvelope = await startStream(request, tabId);
    streamId = startEnvelope.data.streamId;

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
        state.stopReason = state.stopReason ?? abortReason ?? 'cancelled';
        finish(() => resolve());
      };

      if (controller.signal.aborted) {
        onAbort();
        return;
      }

      controller.signal.addEventListener('abort', onAbort, { once: true });

      streamCleanup.dispose = openStreamEventsFn(streamId!, tabId, {
        expectedRequestId: startEnvelope.data.requestId,
        signal: controller.signal,
        onEvent: (event) => {
          if (controller.signal.aborted) {
            state.stopReason = state.stopReason ?? abortReason ?? 'cancelled';
            finish(() => resolve());
            return;
          }
          if (applyStreamEvent(event, state, collect)) {
            if (state.stopReason === 'max_messages' || state.stopReason === 'max_duration') {
              controller.abort();
            }
            finish(() => resolve());
          }
        },
        onError: (message) => {
          state.stopReason = 'transport_error';
          state.errorDetail = message;
          finish(() => reject(new Error(message)));
        },
        onStateChange: (streamState) => {
          if (streamState === 'closed') {
            finish(() => resolve());
          }
        },
      });

      void (async () => {
        try {
          for (const message of sendMessages) {
            if (controller.signal.aborted) break;
            await sendStreamMessage(streamId!, tabId, { body: structuredClone(message) });
          }
          if (!controller.signal.aborted && state.stopReason !== 'max_messages' && state.stopReason !== 'max_duration') {
            await endStreamFn(streamId!, tabId);
          }
        } catch (error) {
          state.stopReason = 'transport_error';
          state.errorDetail = error instanceof Error ? error.message : String(error);
          finish(() => reject(error instanceof Error ? error : new Error(String(error))));
        }
      })();
    });

    if (!state.stopReason) {
      if (controller.signal.aborted) {
        state.stopReason = abortReason ?? 'cancelled';
      } else {
        state.stopReason = 'stream_end';
        state.grpcStatus = 0;
        state.grpcStatusMessage = 'OK';
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      state.stopReason = state.stopReason ?? abortReason ?? 'cancelled';
    } else if (!state.stopReason) {
      state.stopReason = 'transport_error';
      state.errorDetail = error instanceof Error ? error.message : String(error);
    }
  } finally {
    clearDurationTimer();
    if (streamId) {
      await cancelStream(streamId, tabId).catch(() => undefined);
    }
  }

  if (state.stopReason === 'max_messages' || state.stopReason === 'max_duration') {
    state.grpcStatus = 0;
    state.grpcStatusMessage = 'OK';
  }

  return outboundStreamOutcome(callType, state, startedAt, 1);
}

/** Client-streaming harness flow: send fixture messages → EOF → terminal response. */
export async function executeGrpcHarnessClientStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  sendMessages: Record<string, unknown>[],
  options?: {
    abortSignal?: AbortSignal;
    deps?: GrpcHarnessStreamCollectorDeps;
  },
): Promise<GrpcHarnessCallOutcome> {
  return executeHarnessOutboundStream(
    request,
    tabId,
    'client_streaming',
    sendMessages,
    undefined,
    options,
  );
}

/** Bidi-streaming harness flow: send fixture messages → collect inbound with bounds. */
export async function executeGrpcHarnessBidiStream(
  request: GrpcStreamStartRequest,
  tabId: string,
  sendMessages: Record<string, unknown>[],
  collect: GrpcHarnessCollectConfig,
  options?: {
    abortSignal?: AbortSignal;
    deps?: GrpcHarnessStreamCollectorDeps;
  },
): Promise<GrpcHarnessCallOutcome> {
  return executeHarnessOutboundStream(
    request,
    tabId,
    'bidi_streaming',
    sendMessages,
    collect,
    options,
  );
}
