import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  type GrpcCallResult,
  type GrpcErrorBody,
  type GrpcStreamEvent,
} from '@shared/grpc/contracts';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import {
  cancelGrpcStream,
  endGrpcStream,
  openGrpcStreamEvents,
  sendGrpcStreamMessage,
  startGrpcStream,
} from '@shared/grpc/grpcStreamClient';
import { resolveGrpcStudioStreamMessageBodyForSend } from '@shared/grpc/grpcStudioExecuteInterpolation';
import {
  bindGrpcStreamTransportForTab,
  clearGrpcStreamTransportBinding,
  grpcApiErrorToExpressFallbackBody,
  isGrpcNativePreflightFailure,
  withGrpcExpressFallbackOffer,
} from '@shared/grpc/grpcTransportFallback';
import {
  grpcApiErrorToBrowserExpressFallbackBody,
  isBrowserDirectTransportMode,
} from '@shared/grpc/grpcBrowserTransportErrorMapper';
import { isGrpcStreamLifecycleTerminal } from '@shared/grpc/streamLifecycle';
import { assertGrpcTransportDispatchReady } from '@shared/grpc/grpcBrowserTransportRouter';
import type { GrpcStudioTransportMode } from '@shared/grpc/grpcWebTransportContracts';
import {
  clearedGrpcStreamSessionPatch,
  resolveGrpcStudioTabTransportMode,
  snapshotToStreamStartRequest,
  type GrpcExecuteOverrides,
  type GrpcStudioTabState,
  type GrpcTabExecuteSnapshot,
} from '../grpcStudioTypes';
import {
  appendGrpcStreamLogEntry,
  grpcStreamEventToLogEntry,
} from '../utils/grpcStreamLogUtils';
import {
  appendGrpcStreamPendingBody,
  removeGrpcStreamPendingBodyAtIndex,
} from '../utils/grpcStreamPendingQueue';
import { captureGrpcCallHistoryFromOutcome, captureGrpcCallHistoryFromStreamTerminal } from '../utils/grpcStudioCallHistoryCapture';
import type { GrpcCallAbortNotifier, GrpcStudioSessionState } from './grpcStudioSessionHelpers';
import {
  abortTabPendingUnaryCall,
  tabHasPendingUnaryCall,
} from './grpcStudioSessionHelpers';
import {
  bumpStreamGeneration,
  canCancelStreamCall,
  detachStreamEventsForTab,
  isStreamNotFoundSseError,
  streamTerminalLifecycleFromGrpcEnd,
  buildStreamEventErrorBody,
  buildStreamValidationErrorBody,
  streamErrorFromCaught,
  tabAwaitingStreamEvents,
  tabHasActiveStream,
} from './grpcStreamSessionHelpers';

function releaseStreamTransportBinding(tabId: string): void {
  clearGrpcStreamTransportBinding(tabId);
}

function resolveStreamStartError(
  error: unknown,
  tab: GrpcStudioTabState | undefined,
  snapshotTransportMode?: GrpcStudioTransportMode,
): GrpcErrorBody {
  const transportMode = snapshotTransportMode
    ?? (tab ? resolveGrpcStudioTabTransportMode(tab) : undefined);
  if (
    tab
    && transportMode === 'tauri'
    && isGrpcNativePreflightFailure(error)
  ) {
    if (error instanceof GrpcApiClientError) {
      return grpcApiErrorToExpressFallbackBody(error);
    }
    const message = error instanceof Error ? error.message : 'Stream start failed';
    return withGrpcExpressFallbackOffer(
      buildStreamEventErrorBody(message),
      message,
    );
  }
  if (error instanceof GrpcApiClientError && transportMode && isBrowserDirectTransportMode(transportMode)) {
    return grpcApiErrorToBrowserExpressFallbackBody(error, transportMode);
  }
  return streamErrorFromCaught(error, 'Stream start failed');
}

export interface UseGrpcStreamSessionOptions {
  sessionRef: MutableRefObject<GrpcStudioSessionState>;
  streamGenerationRef: MutableRefObject<Record<string, number>>;
  streamDisposeRef: MutableRefObject<Record<string, () => void>>;
  callGenerationRef: MutableRefObject<Record<string, number>>;
  inFlightCallRef: MutableRefObject<Record<string, string>>;
  commitSession: (state: GrpcStudioSessionState) => GrpcStudioSessionState;
  setSession: Dispatch<SetStateAction<GrpcStudioSessionState>>;
  updateTab: (tabId: string, patch: Partial<GrpcStudioTabState>) => void;
  prepareExecuteSnapshot: (
    tabId: string,
    requestId: string,
    overrides?: GrpcExecuteOverrides,
  ) => GrpcTabExecuteSnapshot;
  onCancelInFlight?: GrpcCallAbortNotifier;
}

export function useGrpcStreamSession(options: UseGrpcStreamSessionOptions) {
  const {
    sessionRef,
    streamGenerationRef,
    streamDisposeRef,
    callGenerationRef,
    inFlightCallRef,
    commitSession,
    setSession,
    updateTab,
    prepareExecuteSnapshot,
    onCancelInFlight,
  } = options;

  const sendAllPendingInFlightRef = useRef<Set<string>>(new Set());

  const captureStreamHistory = useCallback((
    tabId: string,
    overrides?: { error?: GrpcErrorBody; result?: GrpcCallResult },
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab?.lastExecuteSnapshot) return;
    captureGrpcCallHistoryFromStreamTerminal({
      lastExecuteSnapshot: tab.lastExecuteSnapshot,
      streamError: tab.streamError,
      target: tab.target,
      streamStartedAt: tab.streamStartedAt,
      streamEndedAt: tab.streamEndedAt ?? new Date().toISOString(),
    }, overrides);
  }, [sessionRef]);

  const applyStreamEvent = useCallback((
    tabId: string,
    event: GrpcStreamEvent,
    isStale: () => boolean,
  ) => {
    if (isStale()) return;

    if (event.tabId !== tabId) {
      return;
    }

    const currentTab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (
      currentTab?.activeStreamId
      && event.streamId
      && event.streamId !== currentTab.activeStreamId
    ) {
      return;
    }
    if (
      currentTab?.streamRequestId
      && event.requestId
      && event.requestId !== currentTab.streamRequestId
    ) {
      return;
    }
    if (
      currentTab
      && (event.type === 'grpc-end' || event.type === 'grpc-error')
      && isGrpcStreamLifecycleTerminal(currentTab.streamLifecycle)
    ) {
      return;
    }

    if (event.type === 'grpc-message') {
      const entry = grpcStreamEventToLogEntry(event);
      if (!entry) return;
      // Early guard via sessionRef — consistent with grpc-end/grpc-error handling above.
      if (currentTab?.streamLifecycle != null && isGrpcStreamLifecycleTerminal(currentTab.streamLifecycle)) return;
      setSession((prev) => {
        const tab = prev.tabs.find((entry) => entry.id === tabId);
        if (!tab || isGrpcStreamLifecycleTerminal(tab.streamLifecycle)) return prev;
        const appended = appendGrpcStreamLogEntry(tab.streamMessages, entry, tab.lastSequence);
        if (!appended) return prev;
        return commitSession({
          ...prev,
          tabs: prev.tabs.map((entry) => {
            if (entry.id !== tabId) return entry;
            return {
              ...entry,
              streamMessages: appended.messages,
              lastSequence: appended.lastSequence,
            };
          }),
        });
      });
      return;
    }

    if (event.type === 'grpc-end') {
      detachStreamEventsForTab(streamDisposeRef, tabId);
      releaseStreamTransportBinding(tabId);
      bumpStreamGeneration(streamGenerationRef, tabId);
      const terminalLifecycle = streamTerminalLifecycleFromGrpcEnd(event.status);
      const streamError: GrpcErrorBody | undefined = terminalLifecycle === 'error'
        ? buildStreamEventErrorBody(
            event.statusMessage ?? `Stream ended with status ${event.status ?? 'unknown'}`,
            event.status,
          )
        : undefined;
      const terminalSnapshot = currentTab?.lastExecuteSnapshot;
      setSession((prev) => {
        const tab = prev.tabs.find((entry) => entry.id === tabId);
        if (!tab || isGrpcStreamLifecycleTerminal(tab.streamLifecycle)) {
          return prev;
        }
        let messages = tab.streamMessages;
        let lastSequence = tab.lastSequence;
        if (event.data) {
          const terminalEntry = {
            sequence: event.sequence,
            timestamp: event.timestamp,
            direction: 'inbound' as const,
            data: event.data,
          };
          const appended = appendGrpcStreamLogEntry(messages, terminalEntry, lastSequence);
          if (appended) {
            messages = appended.messages;
            lastSequence = appended.lastSequence;
          }
        }
        return commitSession({
          ...prev,
          tabs: prev.tabs.map((entry) => {
            if (entry.id !== tabId) return entry;
            return {
              ...entry,
              streamLifecycle: terminalLifecycle,
              streamEndedAt: new Date().toISOString(),
              activeStreamId: undefined,
              streamMessages: messages,
              lastSequence,
              streamError: terminalLifecycle === 'error' ? streamError : undefined,
            };
          }),
        });
      });
      if (terminalSnapshot) {
        const endedAt = new Date().toISOString();
        const startedAt = currentTab?.streamStartedAt;
        const streamDurationMs = startedAt
          ? Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime())
          : 0;
        captureGrpcCallHistoryFromStreamTerminal(
          {
            lastExecuteSnapshot: terminalSnapshot,
            streamStartedAt: startedAt,
            streamEndedAt: endedAt,
          },
          {
            error: streamError,
            result: typeof event.status === 'number' && event.status === 0
              ? {
                  callType: terminalSnapshot.callType,
                  status: 0,
                  statusMessage: event.statusMessage ?? 'OK',
                  headers: {},
                  trailers: {},
                  durationMs: streamDurationMs,
                }
              : undefined,
          },
        );
      }
      return;
    }

    if (event.type === 'grpc-error') {
      detachStreamEventsForTab(streamDisposeRef, tabId);
      releaseStreamTransportBinding(tabId);
      bumpStreamGeneration(streamGenerationRef, tabId);
      const terminalLifecycle = event.status === 1 ? 'cancelled' : 'error';
      const streamError = terminalLifecycle === 'error'
        ? buildStreamEventErrorBody(
            event.statusMessage ?? 'Stream error',
            event.status,
          )
        : undefined;
      const errorSnapshot = currentTab?.lastExecuteSnapshot;
      setSession((prev) => {
        const tab = prev.tabs.find((entry) => entry.id === tabId);
        if (!tab || isGrpcStreamLifecycleTerminal(tab.streamLifecycle)) {
          return prev;
        }
        return commitSession({
          ...prev,
          tabs: prev.tabs.map((entry) => {
            if (entry.id !== tabId) return entry;
            return {
              ...entry,
              streamLifecycle: terminalLifecycle,
              streamEndedAt: new Date().toISOString(),
              streamError,
              activeStreamId: undefined,
            };
          }),
        });
      });
      if (errorSnapshot && terminalLifecycle === 'error' && streamError) {
        const endedAt = new Date().toISOString();
        captureGrpcCallHistoryFromStreamTerminal(
          {
            lastExecuteSnapshot: errorSnapshot,
            streamStartedAt: currentTab?.streamStartedAt,
            streamEndedAt: endedAt,
          },
          { error: streamError },
        );
      }
    }
  }, [commitSession, sessionRef, setSession, streamDisposeRef, streamGenerationRef]);

  const attachStreamEventsForTab = useCallback((tabId: string) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !tabAwaitingStreamEvents(tab)) {
      return;
    }
    if (streamDisposeRef.current[tabId]) {
      return;
    }

    const generation = streamGenerationRef.current[tabId] ?? 0;
    const isStale = () => (streamGenerationRef.current[tabId] ?? 0) !== generation;
    const streamId = tab.activeStreamId!;

    const dispose = openGrpcStreamEvents(streamId, tabId, {
      lastSequence: tab.lastSequence,
      expectedRequestId: tab.streamRequestId,
      resolveLastSequence: () => {
        const current = sessionRef.current.tabs.find((entry) => entry.id === tabId);
        return current?.lastSequence ?? 0;
      },
      onEvent: (event) => applyStreamEvent(tabId, event, isStale),
      onError: (message) => {
        if (isStale()) return;
        detachStreamEventsForTab(streamDisposeRef, tabId);
        releaseStreamTransportBinding(tabId);
        const current = sessionRef.current.tabs.find((entry) => entry.id === tabId);
        if (current?.streamLifecycle === 'ending') {
          bumpStreamGeneration(streamGenerationRef, tabId);
          if (isStreamNotFoundSseError(message)) {
            updateTab(tabId, {
              streamLifecycle: 'ended',
              streamEndedAt: new Date().toISOString(),
              activeStreamId: undefined,
              streamError: undefined,
            });
            captureStreamHistory(tabId);
          } else {
            const streamError = buildStreamEventErrorBody(message);
            updateTab(tabId, {
              streamLifecycle: 'error',
              streamEndedAt: new Date().toISOString(),
              streamError,
              activeStreamId: undefined,
            });
            captureStreamHistory(tabId, { error: streamError });
          }
          return;
        }
        if (current?.streamLifecycle && isGrpcStreamLifecycleTerminal(current.streamLifecycle)) {
          return;
        }
        bumpStreamGeneration(streamGenerationRef, tabId);
        const streamError = buildStreamEventErrorBody(message);
        setSession((prev) => {
          const tab = prev.tabs.find((entry) => entry.id === tabId);
          if (!tab || isGrpcStreamLifecycleTerminal(tab.streamLifecycle)) {
            return prev;
          }
          return commitSession({
            ...prev,
            tabs: prev.tabs.map((entry) => {
              if (entry.id !== tabId) return entry;
              return {
                ...entry,
                streamLifecycle: 'error',
                streamEndedAt: new Date().toISOString(),
                streamError,
                activeStreamId: undefined,
              };
            }),
          });
        });
        captureStreamHistory(tabId, { error: streamError });
      },
    });
    streamDisposeRef.current[tabId] = dispose;
  }, [applyStreamEvent, captureStreamHistory, commitSession, sessionRef, setSession, streamDisposeRef, streamGenerationRef, updateTab]);

  const startStreamCall = useCallback(async (
    tabId: string,
    overrides?: GrpcExecuteOverrides,
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || tabHasActiveStream(tab)) {
      return;
    }

    if (tabHasPendingUnaryCall(tab, tabId, inFlightCallRef)) {
      callGenerationRef.current[tabId] = (callGenerationRef.current[tabId] ?? 0) + 1;
      abortTabPendingUnaryCall(tabId, tab, inFlightCallRef, onCancelInFlight);
    }

    detachStreamEventsForTab(streamDisposeRef, tabId);
    bumpStreamGeneration(streamGenerationRef, tabId);
    const generation = streamGenerationRef.current[tabId]!;
    const isStale = () => (streamGenerationRef.current[tabId] ?? 0) !== generation;
    const preservedPendingBodies = tab.streamPendingBodies.map((body) => structuredClone(body));

    updateTab(tabId, {
      ...clearedGrpcStreamSessionPatch(),
      streamPendingBodies: preservedPendingBodies,
      streamLifecycle: 'starting',
    });

    const requestId = globalThis.crypto?.randomUUID?.() ?? `req-stream-${Date.now()}`;
    let snapshot: GrpcTabExecuteSnapshot;
    try {
      snapshot = prepareExecuteSnapshot(tabId, requestId, overrides);
    } catch (error) {
      if (isStale()) return;
      const message = error instanceof Error ? error.message : 'Cannot start stream';
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamError: buildStreamValidationErrorBody(message),
      });
      return;
    }

    if (snapshot.callType === 'unary') {
      if (isStale()) return;
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamError: buildStreamValidationErrorBody(
          'Start Stream is not available for unary methods',
        ),
      });
      return;
    }

    try {
      assertGrpcTransportDispatchReady(snapshot.transportMode ?? resolveGrpcStudioTabTransportMode(tab));
    } catch (error) {
      if (isStale()) return;
      const message = error instanceof Error ? error.message : 'Transport dispatch is not available';
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamError: buildStreamValidationErrorBody(message),
      });
      return;
    }

    try {
      const request = snapshotToStreamStartRequest(snapshot);
      const envelope = await startGrpcStream(request, tabId, {
        transportMode: snapshot.transportMode,
      });
      if (isStale()) {
        void cancelGrpcStream(envelope.data.streamId, tabId).catch(() => undefined);
        return;
      }

      bindGrpcStreamTransportForTab(
        tabId,
        snapshot.transportMode ?? resolveGrpcStudioTabTransportMode(tab),
      );

      updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: envelope.data.streamId,
        streamRequestId: envelope.data.requestId,
        streamStartedAt: new Date().toISOString(),
        lastExecuteSnapshot: snapshot,
      });

      attachStreamEventsForTab(tabId);
    } catch (error) {
      if (isStale()) return;
      const tabForError = sessionRef.current.tabs.find((entry) => entry.id === tabId);
      const streamError = resolveStreamStartError(error, tabForError, snapshot.transportMode);
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamError,
        activeStreamId: undefined,
      });
      captureGrpcCallHistoryFromOutcome({
        snapshot,
        error: streamError,
        templateContext: tabForError ? {
          rawTarget: tabForError.target,
          filterTarget: snapshot.target.address,
        } : undefined,
      });
    }
  }, [
    attachStreamEventsForTab,
    callGenerationRef,
    inFlightCallRef,
    onCancelInFlight,
    prepareExecuteSnapshot,
    sessionRef,
    streamDisposeRef,
    streamGenerationRef,
    updateTab,
  ]);

  const cancelStreamCall = useCallback(async (tabId: string) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !canCancelStreamCall(tab)) {
      return;
    }

    const streamId = tab.activeStreamId;

    // Mark cancelled before tearing down SSE so late connection-drop errors cannot win.
    updateTab(tabId, {
      streamLifecycle: 'cancelled',
      streamEndedAt: new Date().toISOString(),
      activeStreamId: undefined,
      streamError: undefined,
    });
    bumpStreamGeneration(streamGenerationRef, tabId);
    detachStreamEventsForTab(streamDisposeRef, tabId);

    if (streamId) {
      try {
        await cancelGrpcStream(streamId, tabId);
      } catch {
        // Tab already marked cancelled locally.
      }
    }
    releaseStreamTransportBinding(tabId);
    captureStreamHistory(tabId);
  }, [captureStreamHistory, sessionRef, streamDisposeRef, streamGenerationRef, updateTab]);

  const sendResolvedStreamMessage = useCallback(async (
    tabId: string,
    streamId: string,
    rawBody: Record<string, unknown>,
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    let resolvedBody: Record<string, unknown>;
    try {
      resolvedBody = resolveGrpcStudioStreamMessageBodyForSend(
        rawBody,
        tab?.lastExecuteSnapshot?.interpolationEnv,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send stream message failed';
      const streamError = buildStreamValidationErrorBody(message);
      try {
        await cancelGrpcStream(streamId, tabId);
      } catch {
        // Best-effort cancel after validation failure.
      }
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamEndedAt: new Date().toISOString(),
        streamError,
        activeStreamId: undefined,
      });
      bumpStreamGeneration(streamGenerationRef, tabId);
      detachStreamEventsForTab(streamDisposeRef, tabId);
      releaseStreamTransportBinding(tabId);
      captureStreamHistory(tabId, { error: streamError });
      return;
    }
    try {
      await sendGrpcStreamMessage(streamId, tabId, { body: structuredClone(resolvedBody) });
    } catch (error) {
      try {
        await cancelGrpcStream(streamId, tabId);
      } catch {
        // Best-effort cancel after send failure.
      }
      const streamError = streamErrorFromCaught(error, 'Send stream message failed');
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamEndedAt: new Date().toISOString(),
        streamError,
        activeStreamId: undefined,
      });
      bumpStreamGeneration(streamGenerationRef, tabId);
      detachStreamEventsForTab(streamDisposeRef, tabId);
      releaseStreamTransportBinding(tabId);
      captureStreamHistory(tabId, { error: streamError });
    }
  }, [captureStreamHistory, sessionRef, streamDisposeRef, streamGenerationRef, updateTab]);

  const sendStreamMessageCall = useCallback(async (
    tabId: string,
    overrides?: GrpcExecuteOverrides,
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab?.activeStreamId || tab.streamLifecycle !== 'streaming') {
      return;
    }
    await sendResolvedStreamMessage(tabId, tab.activeStreamId, overrides?.body ?? tab.body);
  }, [sendResolvedStreamMessage, sessionRef]);

  const enqueueStreamMessage = useCallback((
    tabId: string,
    body: Record<string, unknown>,
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    updateTab(tabId, {
      streamPendingBodies: appendGrpcStreamPendingBody(tab.streamPendingBodies, body),
    });
  }, [sessionRef, updateTab]);

  const removePendingStreamMessage = useCallback((
    tabId: string,
    index: number,
  ) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    updateTab(tabId, {
      streamPendingBodies: removeGrpcStreamPendingBodyAtIndex(tab.streamPendingBodies, index),
    });
  }, [sessionRef, updateTab]);

  const sendAllPendingStreamMessages = useCallback(async (tabId: string) => {
    if (sendAllPendingInFlightRef.current.has(tabId)) {
      return;
    }
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab?.activeStreamId || tab.streamLifecycle !== 'streaming') {
      return;
    }
    let pending = [...tab.streamPendingBodies];
    if (pending.length === 0) return;

    sendAllPendingInFlightRef.current.add(tabId);
    const streamId = tab.activeStreamId;
    try {
      while (pending.length > 0) {
        const body = pending[0]!;
        await sendResolvedStreamMessage(tabId, streamId, body);
        const latest = sessionRef.current.tabs.find((entry) => entry.id === tabId);
        if (!latest?.activeStreamId || latest.streamLifecycle !== 'streaming') {
          updateTab(tabId, { streamPendingBodies: pending });
          return;
        }
        pending = pending.slice(1);
        updateTab(tabId, { streamPendingBodies: pending });
      }
    } finally {
      sendAllPendingInFlightRef.current.delete(tabId);
    }
  }, [sendResolvedStreamMessage, sessionRef, updateTab]);

  const endStreamCall = useCallback(async (tabId: string) => {
    const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab?.activeStreamId || tab.streamLifecycle !== 'streaming') {
      return;
    }

    const streamId = tab.activeStreamId;
    updateTab(tabId, { streamLifecycle: 'ending' });

    try {
      await endGrpcStream(streamId, tabId);
    } catch (error) {
      try {
        await cancelGrpcStream(streamId, tabId);
      } catch {
        // Best-effort cancel after end failure.
      }
      const streamError = streamErrorFromCaught(error, 'End stream failed');
      updateTab(tabId, {
        streamLifecycle: 'error',
        streamEndedAt: new Date().toISOString(),
        streamError,
        activeStreamId: undefined,
      });
      bumpStreamGeneration(streamGenerationRef, tabId);
      detachStreamEventsForTab(streamDisposeRef, tabId);
      releaseStreamTransportBinding(tabId);
      captureStreamHistory(tabId, { error: streamError });
    }
  }, [captureStreamHistory, sessionRef, streamDisposeRef, streamGenerationRef, updateTab]);

  const clearStreamLog = useCallback((tabId: string) => {
    updateTab(tabId, {
      streamMessages: [],
    });
  }, [updateTab]);

  return {
    applyStreamEvent,
    attachStreamEventsForTab,
    startStreamCall,
    cancelStreamCall,
    sendStreamMessageCall,
    enqueueStreamMessage,
    removePendingStreamMessage,
    sendAllPendingStreamMessages,
    endStreamCall,
    clearStreamLog,
  };
}

export { tabAwaitingStreamEvents };
