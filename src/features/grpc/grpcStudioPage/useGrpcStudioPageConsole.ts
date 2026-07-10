import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcConsoleWireEvent } from '../components/GrpcConsoleModal';
import { redactGrpcMetadataForHistory } from '../../../shared/grpc/grpcRedaction';
import { prepareGrpcCallMetadata } from '../../../shared/grpc/grpcCompressionPolicy';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';

export function useGrpcStudioPageConsole(
  studio: UseGrpcStudioReturn,
  consoleOpen: boolean,
) {
  const [consoleEvents, setConsoleEvents] = useState<GrpcConsoleWireEvent[]>([]);
  const consoleEventCounterRef = useRef(0);
  const consoleSeenUnarySendRef = useRef<Record<string, string>>({});
  const consoleSeenUnaryTerminalRef = useRef<Record<string, string>>({});
  const consoleSeenStreamCountRef = useRef<Record<string, number>>({});
  const consoleSeenStreamLifecycleRef = useRef<Record<string, string>>({});
  const previousConsoleOpenRef = useRef(false);

  const appendConsoleEvent = useCallback((event: Omit<GrpcConsoleWireEvent, 'id'>) => {
    const id = `grpc-console-wire-${++consoleEventCounterRef.current}`;
    setConsoleEvents((prev) => {
      const next = [...prev, { ...event, id }];
      return next.length > 2000 ? next.slice(next.length - 2000) : next;
    });
  }, []);

  const activeTab = studio.activeTab;
  const activeLifecycle = activeTab.lifecycle ?? 'idle';
  const activeStreamLifecycle = activeTab.streamLifecycle ?? 'idle';
  const activeStreamMessages = useMemo(
    () => activeTab.streamMessages ?? [],
    [activeTab.streamMessages],
  );

  useEffect(() => {
    const justOpened = consoleOpen && !previousConsoleOpenRef.current;
    previousConsoleOpenRef.current = consoleOpen;
    if (!consoleOpen) return;
    if (!justOpened) return;
    const tabId = activeTab.id;
    consoleSeenUnarySendRef.current[tabId] = activeTab.lastExecuteSnapshot?.requestId ?? '';
    consoleSeenUnaryTerminalRef.current[tabId] = activeTab.lastExecuteSnapshot?.requestId ?? '';
    consoleSeenStreamCountRef.current[tabId] = activeStreamMessages.length;
    consoleSeenStreamLifecycleRef.current[tabId] = activeStreamLifecycle;
  }, [consoleOpen, activeStreamLifecycle, activeStreamMessages.length, activeTab.id, activeTab.lastExecuteSnapshot?.requestId]);

  useEffect(() => {
    if (!consoleOpen) return;
    const tabId = activeTab.id;
    if (consoleSeenUnarySendRef.current[tabId] !== undefined) {
      return;
    }
    consoleSeenUnarySendRef.current[tabId] = activeTab.lastExecuteSnapshot?.requestId ?? '';
    consoleSeenUnaryTerminalRef.current[tabId] = activeTab.lastExecuteSnapshot?.requestId ?? '';
    consoleSeenStreamCountRef.current[tabId] = activeStreamMessages.length;
    consoleSeenStreamLifecycleRef.current[tabId] = activeStreamLifecycle;
  }, [consoleOpen, activeTab.id, activeTab.lastExecuteSnapshot?.requestId, activeStreamMessages.length, activeStreamLifecycle]);

  useEffect(() => {
    if (!consoleOpen) return;
    const tabId = activeTab.id;
    const snapshot = activeTab.lastExecuteSnapshot;
    const requestId = snapshot?.requestId ?? '';

    if (
      requestId
      && activeLifecycle !== 'idle'
      && consoleSeenUnarySendRef.current[tabId] !== requestId
    ) {
      const effectiveMetadata = (() => {
        try {
          return prepareGrpcCallMetadata(snapshot?.metadata, snapshot?.auth, snapshot?.compression) ?? {};
        } catch {
          return snapshot?.metadata ?? {};
        }
      })();

      appendConsoleEvent({
        timestamp: new Date().toISOString(),
        direction: 'send',
        service: snapshot?.service,
        method: snapshot?.method,
        summary: `Unary request ${snapshot?.service ?? ''}/${snapshot?.method ?? ''}`.trim(),
        payload: {
          requestId,
          target: snapshot?.target,
          transportMode: snapshot?.transportMode,
          compression: snapshot?.compression,
          metadata: redactGrpcMetadataForHistory(effectiveMetadata, snapshot?.auth),
          manualMetadata: snapshot?.metadata,
          auth: snapshot?.auth,
          body: snapshot?.body,
          timeoutMs: snapshot?.timeoutMs,
        },
      });
      consoleSeenUnarySendRef.current[tabId] = requestId;
      delete consoleSeenUnaryTerminalRef.current[tabId];
    }

    const terminalLifecycle = activeLifecycle === 'success'
      || activeLifecycle === 'error'
      || activeLifecycle === 'cancelled';
    if (requestId && terminalLifecycle && consoleSeenUnaryTerminalRef.current[tabId] !== requestId) {
      appendConsoleEvent({
        timestamp: new Date().toISOString(),
        direction: activeLifecycle === 'success' ? 'recv' : 'event',
        service: snapshot?.service,
        method: snapshot?.method,
        summary: `Unary ${activeLifecycle}`,
        payload: activeLifecycle === 'success'
          ? {
            status: activeTab.lastResult?.status,
            statusMessage: activeTab.lastResult?.statusMessage,
            headers: activeTab.lastResult?.headers,
            trailers: activeTab.lastResult?.trailers,
            body: activeTab.lastResult?.body,
            durationMs: activeTab.lastResult?.durationMs,
          }
          : {
            requestId,
            error: activeTab.lastError,
          },
      });
      consoleSeenUnaryTerminalRef.current[tabId] = requestId;
    }
  }, [
    activeTab.id,
    activeTab.lastError,
    activeTab.lastExecuteSnapshot,
    activeTab.lastResult,
    activeLifecycle,
    appendConsoleEvent,
    consoleOpen,
  ]);

  useEffect(() => {
    if (!consoleOpen) return;
    const tabId = activeTab.id;
    const seenCount = consoleSeenStreamCountRef.current[tabId] ?? 0;
    if (activeStreamMessages.length > seenCount) {
      const nextEntries = activeStreamMessages.slice(seenCount);
      for (const entry of nextEntries) {
        appendConsoleEvent({
          timestamp: entry.timestamp,
          direction: entry.direction === 'outbound' ? 'send' : 'recv',
          service: activeTab.lastExecuteSnapshot?.service,
          method: activeTab.lastExecuteSnapshot?.method,
          summary: `Stream ${entry.direction === 'outbound' ? 'send' : 'recv'} #${entry.sequence}`,
          payload: entry.data,
        });
      }
    }
    consoleSeenStreamCountRef.current[tabId] = activeStreamMessages.length;
  }, [activeStreamMessages, activeTab.id, activeTab.lastExecuteSnapshot?.method, activeTab.lastExecuteSnapshot?.service, appendConsoleEvent, consoleOpen]);

  useEffect(() => {
    if (!consoleOpen) return;
    const tabId = activeTab.id;
    const previous = consoleSeenStreamLifecycleRef.current[tabId];
    const next = activeStreamLifecycle;
    if (previous !== next && (next === 'ended' || next === 'cancelled' || next === 'error')) {
      appendConsoleEvent({
        timestamp: activeTab.streamEndedAt ?? new Date().toISOString(),
        direction: next === 'ended' ? 'recv' : 'event',
        service: activeTab.lastExecuteSnapshot?.service,
        method: activeTab.lastExecuteSnapshot?.method,
        summary: `Stream ${next}`,
        payload: {
          lifecycle: next,
          error: activeTab.streamError,
          startedAt: activeTab.streamStartedAt,
          endedAt: activeTab.streamEndedAt,
        },
      });
    }
    consoleSeenStreamLifecycleRef.current[tabId] = next;
  }, [
    activeTab.id,
    activeTab.lastExecuteSnapshot?.method,
    activeTab.lastExecuteSnapshot?.service,
    activeTab.streamEndedAt,
    activeTab.streamError,
    activeStreamLifecycle,
    activeTab.streamStartedAt,
    appendConsoleEvent,
    consoleOpen,
  ]);

  const clearConsoleEvents = useCallback(() => {
    setConsoleEvents([]);
  }, []);

  return {
    consoleEvents,
    appendConsoleEvent,
    clearConsoleEvents,
  };
}
