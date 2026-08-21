import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type WsCloseDetail,
  type WsConnectionDraft,
  type WsConnectionSnapshot,
  type WsFrame,
  type WsTlsConfig,
  createDefaultDraft,
  createDefaultTlsConfig,
  createFrame,
  hasCustomHeaders,
  hasTlsOverrides,
  getCloseCodeLabel,
} from '../../shared/websocket/types';
import { dispatchWsOperation } from '../../shared/websocket/websocketClient';
import {
  listenWsMessage,
  listenWsConnectionClosed,
  type WsMessagePayload,
  type WsConnectionClosedPayload,
} from '../../shared/websocket/websocketNativeTauriTransport';
import { isTauri } from '../../shared/utils/platform';
import { resolveEnvVars, buildResolvedEffectiveUrl, decodeBase64ToBytesStrict } from './wsMessageUtils';
import { parseSubprotocolList, encodeWsMessageData, createSystemConnectFrame, runEarlyProtocolDetection, buildConnectHeadersMap } from './wsConnectionHelpers';
import { resolveAuthForConnect, appendAuthQueryParams, resolveEffectiveAuth, type ResolvedAuth } from './wsAuthResolve';
import type { GlobalAuthProfile } from '../../shared/types';
import { toErrorMessage } from '../../shared/utils/helpers';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import {
  annotateSentFrame,
  buildGqlWsInitAction,
  type SioServerParams,
} from './wsProtocolHelpers';
import { processReceivedMessage } from './wsMessageProcessing';
import { useWebSocketBookmarks } from './useWebSocketBookmarks';
import { useWebSocketUptime } from './useWebSocketUptime';
import { useWebSocketReconnect } from './useWebSocketReconnect';
import { useWebSocketFilters } from './useWebSocketFilters';
import {
  DEFAULT_MAX_MESSAGES,
  PROXY_POLL_INTERVAL_MS,
  formatCloseFrame,
  type WsDirectionFilter,
  type WsSearchMode,
  type WsSizeFilter,
  type WsTimeFilter,
  type WsContentTypeFilter,
  type WsTransportMode,
  type UseWebSocketStudioReturn,
} from './useWebSocketStudioTypes';
import { startWsProxyPolling } from './wsProxyPolling';
import { disconnectWebSocketConnection } from './wsDisconnect';
export type { WsDirectionFilter, WsSearchMode, WsSizeFilter, WsTimeFilter, WsContentTypeFilter, WsTransportMode, UseWebSocketStudioReturn };

export function useWebSocketStudio(
  envVarMap?: Record<string, string>,
  globalAuthProfiles?: GlobalAuthProfile[],
): UseWebSocketStudioReturn {
  const [draft, setDraftState] = useState<WsConnectionDraft>(createDefaultDraft);
  const [connection, setConnection] = useState<WsConnectionSnapshot>({ state: 'disconnected' });
  const [messages, setMessages] = useState<WsFrame[]>([]);
  const [maxMessages, setMaxMessages] = useState(DEFAULT_MAX_MESSAGES);
  const [sentCount, setSentCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [transportMode, setTransportMode] = useState<WsTransportMode>('direct');

  const { uptime, connectedAtRef, startUptimeTimer, resetConnectionTiming } = useWebSocketUptime();
  const [protocolMode, setProtocolMode] = useState<WsProtocolMode>('auto');
  const [detectedProtocol, setDetectedProtocol] = useState<WsProtocolDetectionResult | null>(null);
  const [tlsConfig, setTlsConfigFull] = useState<WsTlsConfig>(createDefaultTlsConfig);
  const [sioServerParams, setSioServerParams] = useState<SioServerParams | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const maxMessagesRef = useRef(maxMessages);
  const messagesRef = useRef(messages);
  const draftRef = useRef(draft);

  const { bookmarkedIds, bookmarkedMessages, toggleBookmark } = useWebSocketBookmarks(messagesRef);

  const {
    searchText, setSearchText,
    searchMode, setSearchMode,
    directionFilter, setDirectionFilter,
    sizeFilter, setSizeFilter,
    timeFilter, setTimeFilter,
    contentTypeFilter, setContentTypeFilter,
    filteredMessages,
  } = useWebSocketFilters(messages, bookmarkedMessages);

  const proxyConnectionIdRef = useRef<string | null>(null);
  const proxyPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proxyCursorRef = useRef(0);
  const mountedRef = useRef(true);
  const manualDisconnectRef = useRef(false);
  const connectFnRef = useRef<() => void>(() => {});

  const {
    autoReconnect, setAutoReconnect,
    reconnectState,
    reconnectIntervalMs, setReconnectIntervalMs,
    maxReconnectAttempts, setMaxReconnectAttempts,
    backoffMultiplier, setBackoffMultiplier,
    cancelReconnect, retryNow,
    scheduleReconnectRef, reconnectingRef, lastReconnectErrorRef,
  } = useWebSocketReconnect(connectFnRef, mountedRef);

  const protocolModeRef = useRef(protocolMode);
  const detectedProtocolRef = useRef(detectedProtocol);
  const messageDetectionDoneRef = useRef(false);
  const tlsConfigRef = useRef(tlsConfig);
  const unlistenMessageRef = useRef<(() => void) | null>(null);
  const unlistenClosedRef = useRef<(() => void) | null>(null);
  const envVarMapRef = useRef<Record<string, string>>(envVarMap ?? {});
  const globalAuthProfilesRef = useRef<GlobalAuthProfile[]>(globalAuthProfiles ?? []);
  const resolvedAuthRef = useRef<ResolvedAuth>({ headers: [], queryParams: [] });

  maxMessagesRef.current = maxMessages;
  messagesRef.current = messages;
  envVarMapRef.current = envVarMap ?? {};
  globalAuthProfilesRef.current = globalAuthProfiles ?? [];
  protocolModeRef.current = protocolMode;
  detectedProtocolRef.current = detectedProtocol;
  tlsConfigRef.current = tlsConfig;

  const updateDetectedProtocol = useCallback((value: WsProtocolDetectionResult | null) => {
    detectedProtocolRef.current = value;
    setDetectedProtocol(value);
  }, []);
  draftRef.current = draft;

  const setDraft = useCallback((patch: Partial<WsConnectionDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setTlsConfig = useCallback((patch: Partial<WsTlsConfig>) => {
    const next = { ...tlsConfigRef.current, ...patch };
    tlsConfigRef.current = next;
    setTlsConfigFull(next);
  }, []);

  const appendMessage = useCallback((frame: WsFrame) => {
    setMessages((prev) => {
      const cap = maxMessagesRef.current;
      const next = [...prev, frame];
      if (next.length > cap) {
        return next.slice(next.length - cap);
      }
      return next;
    });
  }, []);

  const appendMessages = useCallback((frames: WsFrame[]) => {
    setMessages((prev) => {
      const cap = maxMessagesRef.current;
      const next = [...prev, ...frames];
      if (next.length > cap) {
        return next.slice(next.length - cap);
      }
      return next;
    });
  }, []);

  const stopProxyPolling = useCallback(() => {
    if (proxyPollTimerRef.current !== null) {
      clearInterval(proxyPollTimerRef.current);
      proxyPollTimerRef.current = null;
    }
  }, []);

  const failProxyConnection = useCallback(
    (next: Partial<WsConnectionSnapshot>) => {
      stopProxyPolling();
      setConnection((prev) => ({ ...prev, ...next }));
      resetConnectionTiming();
      proxyConnectionIdRef.current = null;
      if (!manualDisconnectRef.current) {
        scheduleReconnectRef.current();
      }
    },
    [stopProxyPolling, resetConnectionTiming, scheduleReconnectRef],
  );

  const stopNativeListeners = useCallback(() => {
    if (unlistenMessageRef.current) {
      unlistenMessageRef.current();
      unlistenMessageRef.current = null;
    }
    if (unlistenClosedRef.current) {
      unlistenClosedRef.current();
      unlistenClosedRef.current = null;
    }
  }, []);

  const startProxyPolling = useCallback((connectionId: string) => {
    stopProxyPolling();
    proxyCursorRef.current = 0;

    proxyPollTimerRef.current = startWsProxyPolling({
      connectionId,
      pollIntervalMs: PROXY_POLL_INTERVAL_MS,
      mountedRef,
      proxyCursorRef,
      protocolModeRef,
      detectedProtocolRef,
      messageDetectionDoneRef,
      appendMessage,
      appendMessages,
      setSentCount,
      setReceivedCount,
      setSioServerParams,
      updateDetectedProtocol,
      failProxyConnection,
    });
  }, [stopProxyPolling, appendMessage, appendMessages, failProxyConnection, updateDetectedProtocol]);

  const startNativeListeners = useCallback(async (connectionId: string) => {
    stopNativeListeners();

    const unlistenMsg = await listenWsMessage((payload: WsMessagePayload) => {
      if (!mountedRef.current) return;
      if (payload.connectionId !== connectionId) return;

      const isBinary = payload.messageType === 'binary';
      const result = processReceivedMessage(
        payload.data, isBinary,
        protocolModeRef.current, detectedProtocolRef.current,
        messageDetectionDoneRef.current,
        (r) => { updateDetectedProtocol(r); },
      );
      messageDetectionDoneRef.current = result.detectionNowDone;

      if (result.autoRespond) {
        appendMessage(result.frame);
        dispatchWsOperation('send', { connectionId, data: result.autoRespond.replyData, type: 'text' }).catch(() => {});
        appendMessage(result.autoRespond.replyFrame);
        setReceivedCount((c) => c + 1);
        setSentCount((c) => c + 1);
        if (result.autoRespond.sioServerParams) setSioServerParams(result.autoRespond.sioServerParams);
        return;
      }

      appendMessage(result.frame);
      setReceivedCount((c) => c + 1);
    });
    unlistenMessageRef.current = unlistenMsg;

    const unlistenClosed = await listenWsConnectionClosed((payload: WsConnectionClosedPayload) => {
      if (!mountedRef.current) return;
      if (payload.connectionId !== connectionId) return;

      stopNativeListeners();
      resetConnectionTiming();
      proxyConnectionIdRef.current = null;

      const code = payload.code ?? 1006;
      const reason = payload.reason;
      const ackMsg = formatCloseFrame('ACK', code, reason);
      appendMessage(createFrame('received', 'close', ackMsg));

      setConnection((prev) => ({
        ...prev,
        state: 'disconnected',
        closedAt: new Date().toISOString(),
        closeCode: code,
        closeReason: reason,
      }));

      if (!manualDisconnectRef.current && code !== 1000) {
        lastReconnectErrorRef.current = `Connection closed — code: ${code} (${getCloseCodeLabel(code)})`;
        scheduleReconnectRef.current();
      }
      manualDisconnectRef.current = false;
    });
    unlistenClosedRef.current = unlistenClosed;
  }, [stopNativeListeners, appendMessage, resetConnectionTiming, updateDetectedProtocol, lastReconnectErrorRef, scheduleReconnectRef]);

  const cleanupRef = useRef(() => {});
  cleanupRef.current = () => {
    if (!reconnectingRef.current) {
      cancelReconnect();
    }

    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'User disconnected');
      }
      wsRef.current = null;
    }

    if (proxyConnectionIdRef.current) {
      const connId = proxyConnectionIdRef.current;
      proxyConnectionIdRef.current = null;
      dispatchWsOperation('disconnect', { connectionId: connId }).catch(() => {});
    }

    stopProxyPolling();
    stopNativeListeners();
    resetConnectionTiming();
  };

  const connectDirect = useCallback(() => {
    const effectiveUrl = appendAuthQueryParams(
      buildResolvedEffectiveUrl(draftRef.current, envVarMapRef.current),
      resolvedAuthRef.current.queryParams,
    );

    setConnection({ state: 'connecting', url: effectiveUrl });
    setTransportMode('direct');
    messageDetectionDoneRef.current = false;
    const connectStart = Date.now();

    const protocols = parseSubprotocolList(draftRef.current.subprotocols);

    const earlyDetect = runEarlyProtocolDetection(protocolModeRef.current, effectiveUrl, protocols);
    if (earlyDetect) {
      updateDetectedProtocol(earlyDetect);
      messageDetectionDoneRef.current = true;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(effectiveUrl, protocols.length > 0 ? protocols : undefined);
    } catch (err) {
      setConnection({ state: 'error', url: effectiveUrl, lastError: toErrorMessage(err) });
      return;
    }

    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      const latencyMs = Date.now() - connectStart;
      connectedAtRef.current = Date.now();
      cancelReconnect();
      const proto = ws.protocol || 'none';
      setConnection({
        state: 'connected',
        url: effectiveUrl,
        connectedAt: new Date().toISOString(),
        protocol: ws.protocol || undefined,
        extensions: ws.extensions || undefined,
        latencyMs,
      });
      startUptimeTimer();

      appendMessage(createSystemConnectFrame(effectiveUrl, proto));

      const effectiveOnOpen = resolveEffectiveProtocol(protocolModeRef.current, detectedProtocolRef.current);
      if (effectiveOnOpen === 'graphql-ws') {
        const init = buildGqlWsInitAction();
        try { ws.send(init.replyData); } catch { /* connection may have closed */ }
        appendMessage(init.replyFrame);
        setSentCount((c) => c + 1);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      const { data, isBinary } = encodeWsMessageData(event.data);
      const result = processReceivedMessage(
        data, isBinary,
        protocolModeRef.current, detectedProtocolRef.current,
        messageDetectionDoneRef.current,
        (r) => { updateDetectedProtocol(r); },
      );
      messageDetectionDoneRef.current = result.detectionNowDone;

      if (result.autoRespond) {
        try { ws.send(result.autoRespond.replyData); } catch { /* connection may have closed */ }
        appendMessage(result.frame);
        appendMessage(result.autoRespond.replyFrame);
        setReceivedCount((c) => c + 1);
        setSentCount((c) => c + 1);
        if (result.autoRespond.sioServerParams) setSioServerParams(result.autoRespond.sioServerParams);
        return;
      }

      appendMessage(result.frame);
      setReceivedCount((c) => c + 1);
    };

    ws.onclose = (event: CloseEvent) => {
      resetConnectionTiming();
      wsRef.current = null;

      const ackMsg = formatCloseFrame('ACK', event.code, event.reason || undefined);
      appendMessage(createFrame('received', 'close', ackMsg));

      setConnection((prev) => ({
        ...prev,
        state: 'disconnected',
        closedAt: new Date().toISOString(),
        closeCode: event.code,
        closeReason: event.reason || undefined,
      }));

      if (!manualDisconnectRef.current && event.code !== 1000) {
        lastReconnectErrorRef.current = `Connection closed — code: ${event.code} (${getCloseCodeLabel(event.code)})`;
        scheduleReconnectRef.current();
      }
      manualDisconnectRef.current = false;
    };

    ws.onerror = () => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSED) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        wsRef.current = null;
        resetConnectionTiming();
        const isWss = effectiveUrl.toLowerCase().startsWith('wss://');
        const errMsg = isWss
          ? 'Connection failed — self-signed or untrusted certificate? Configure TLS settings (Skip Verify or CA cert) to connect via proxy'
          : 'Connection failed — check URL, network, or CORS policy';
        lastReconnectErrorRef.current = errMsg;
        setConnection({
          state: 'error',
          url: effectiveUrl,
          lastError: errMsg,
        });

        if (!manualDisconnectRef.current) {
          scheduleReconnectRef.current();
        }
        manualDisconnectRef.current = false;
      }
    };
  }, [appendMessage, startUptimeTimer, resetConnectionTiming, updateDetectedProtocol, connectedAtRef, cancelReconnect, lastReconnectErrorRef, scheduleReconnectRef]);

  const connectProxy = useCallback(async () => {
    const currentDraft = draftRef.current;
    const evm = envVarMapRef.current;
    const effectiveUrl = appendAuthQueryParams(
      buildResolvedEffectiveUrl(currentDraft, evm),
      resolvedAuthRef.current.queryParams,
    );

    setConnection({ state: 'connecting', url: effectiveUrl });
    setTransportMode(isTauri() ? 'native' : 'proxy');
    messageDetectionDoneRef.current = false;

    const headersMap = buildConnectHeadersMap(
      currentDraft.headers, evm, resolvedAuthRef.current.headers, resolveEnvVars,
    );
    const subprotocols = parseSubprotocolList(currentDraft.subprotocols);

    const tlsPayload = effectiveUrl.toLowerCase().startsWith('wss://') ? tlsConfigRef.current : undefined;

    try {
      const env = await dispatchWsOperation<{
        connectionId: string;
        protocol: string;
        extensions: string;
        latencyMs: number;
      }>('connect', {
        url: effectiveUrl,
        headers: Object.keys(headersMap).length > 0 ? headersMap : undefined,
        subprotocols: subprotocols.length > 0 ? subprotocols : undefined,
        tls: tlsPayload,
      });

      if (!mountedRef.current) return;

      if (env.data) {
        proxyConnectionIdRef.current = env.data.connectionId;
        connectedAtRef.current = Date.now();
        cancelReconnect();

        const earlyDetectProxy = runEarlyProtocolDetection(protocolModeRef.current, effectiveUrl, subprotocols);
        if (earlyDetectProxy) {
          updateDetectedProtocol(earlyDetectProxy);
          messageDetectionDoneRef.current = true;
        }

        setConnection({
          state: 'connected',
          url: effectiveUrl,
          connectedAt: new Date().toISOString(),
          protocol: env.data.protocol || undefined,
          extensions: env.data.extensions || undefined,
          latencyMs: env.data.latencyMs,
        });
        startUptimeTimer();
        if (isTauri()) {
          await startNativeListeners(env.data.connectionId);
        } else {
          startProxyPolling(env.data.connectionId);
        }

        appendMessage(createSystemConnectFrame(effectiveUrl, env.data.protocol));

        const effectiveOnProxy = resolveEffectiveProtocol(protocolModeRef.current, detectedProtocolRef.current);
        if (effectiveOnProxy === 'graphql-ws') {
          const init = buildGqlWsInitAction();
          dispatchWsOperation('send', { connectionId: env.data.connectionId, data: init.replyData, type: 'text' }).catch(() => {});
          appendMessage(init.replyFrame);
          setSentCount((c) => c + 1);
        }
      } else {
        setConnection({ state: 'error', url: effectiveUrl, lastError: 'Server returned no connection data' });
      }
    } catch (err) {
      const message = toErrorMessage(err);
      lastReconnectErrorRef.current = message;
      setConnection({ state: 'error', url: effectiveUrl, lastError: message });
      if (!manualDisconnectRef.current) {
        scheduleReconnectRef.current();
      }
    }
  }, [startUptimeTimer, startProxyPolling, startNativeListeners, appendMessage, updateDetectedProtocol, connectedAtRef, cancelReconnect, lastReconnectErrorRef, scheduleReconnectRef]);

  const connect = useCallback(() => {
    const evm = envVarMapRef.current;
    const effectiveUrlForDisplay = buildResolvedEffectiveUrl(draftRef.current, evm);
    const resolvedEffective = effectiveUrlForDisplay.toLowerCase();
    if (!resolvedEffective || (!resolvedEffective.startsWith('ws://') && !resolvedEffective.startsWith('wss://'))) return;

    manualDisconnectRef.current = false;
    if (!reconnectingRef.current) {
      cancelReconnect();
      updateDetectedProtocol(null);
      setSioServerParams(null);
    }
    cleanupRef.current();

    const route = (resolvedAuth: ResolvedAuth) => {
      resolvedAuthRef.current = resolvedAuth;
      if (isTauri()) {
        connectProxy();
        return;
      }
      const isLocalWss = resolvedEffective.startsWith('wss://') &&
        /^wss:\/\/(localhost|127\.0\.0\.1)([:/?#]|$)/i.test(resolvedEffective);
      const needsProxy = hasCustomHeaders(draftRef.current) ||
        resolvedAuth.headers.length > 0 ||
        isLocalWss ||
        (resolvedEffective.startsWith('wss://') && hasTlsOverrides(tlsConfigRef.current));
      if (needsProxy) {
        connectProxy();
      } else {
        connectDirect();
      }
    };

    const effectiveAuth = resolveEffectiveAuth(draftRef.current.auth, globalAuthProfilesRef.current);
    if (!effectiveAuth) {
      route({ headers: [], queryParams: [] });
      return;
    }

    void (async () => {
      let resolvedAuth: ResolvedAuth;
      try {
        resolvedAuth = await resolveAuthForConnect(
          draftRef.current.auth,
          globalAuthProfilesRef.current,
          evm,
        );
      } catch (err) {
        resolvedAuthRef.current = { headers: [], queryParams: [] };
        setConnection({
          state: 'error',
          url: effectiveUrlForDisplay,
          lastError: `Auth failed: ${toErrorMessage(err)}`,
        });
        return;
      }
      route(resolvedAuth);
    })();
  }, [connectDirect, connectProxy, updateDetectedProtocol, cancelReconnect, reconnectingRef]);

  const disconnect = useCallback((detail?: WsCloseDetail) => {
    disconnectWebSocketConnection({
      detail,
      mountedRef,
      wsRef,
      proxyConnectionIdRef,
      manualDisconnectRef,
      cancelReconnect,
      appendMessage,
      setConnection,
      stopProxyPolling,
      stopNativeListeners,
      resetConnectionTiming,
    });
  }, [stopProxyPolling, stopNativeListeners, resetConnectionTiming, cancelReconnect, appendMessage]);

  const send = useCallback(
    (data: string, format?: 'text' | 'json' | 'binary') => {
      const isBinary = format === 'binary';
      const frameType = isBinary ? 'binary' : 'text';

      if (proxyConnectionIdRef.current) {
        const connId = proxyConnectionIdRef.current;
        dispatchWsOperation('send', {
          connectionId: connId,
          data,
          type: isBinary ? 'binary' : 'text',
        })
          .then(() => {
            if (!mountedRef.current) return;
            const frame = createFrame('sent', frameType, data);
            annotateSentFrame(frame, data, isBinary, protocolModeRef.current, detectedProtocolRef.current);
            appendMessage(frame);
            setSentCount((c) => c + 1);
          })
          .catch(async (err) => {
            if (!mountedRef.current) return;
            const msg = toErrorMessage(err);
            if (msg.includes('WS_NOT_CONNECTED') || msg.includes('not found') || msg.includes('not open')) {
              try {
                const statusEnv = await dispatchWsOperation<{ state: string; lastError?: string }>(
                  'status',
                  { connectionId: connId },
                );
                if (!mountedRef.current) return;
                if (!statusEnv.data || statusEnv.data.state !== 'connected') {
                  failProxyConnection({
                    state: statusEnv.data?.state === 'error' ? 'error' : 'disconnected',
                    lastError: statusEnv.data?.lastError ?? `Send failed: ${msg}`,
                  });
                  return;
                }
              } catch { /* status check also failed — treat as disconnected */ }
              failProxyConnection({ state: 'error', lastError: `Send failed: ${msg}` });
            } else {
              setConnection((prev) => ({
                ...prev,
                lastError: `Send failed: ${msg}`,
              }));
            }
          });
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (isBinary) {
          try {
            wsRef.current.send(decodeBase64ToBytesStrict(data) as Uint8Array<ArrayBuffer>);
          } catch (err) {
            setConnection((prev) => ({
              ...prev,
              lastError: `Binary send failed: ${toErrorMessage(err)}`,
            }));
            return;
          }
        } else {
          wsRef.current.send(data);
        }
        const frame = createFrame('sent', frameType, data);
        annotateSentFrame(frame, data, isBinary, protocolModeRef.current, detectedProtocolRef.current);
        appendMessage(frame);
        setSentCount((c) => c + 1);
      }
    },
    [appendMessage, failProxyConnection],
  );

  const sendPing = useCallback(() => {
    if (!proxyConnectionIdRef.current) return;
    const connId = proxyConnectionIdRef.current;
    dispatchWsOperation('ping', { connectionId: connId })
      .then(() => {
        if (!mountedRef.current) return;
        appendMessage(createFrame('sent', 'ping', ''));
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setConnection((prev) => ({
          ...prev,
          lastError: `Ping failed: ${toErrorMessage(err)}`,
        }));
      });
  }, [appendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSentCount(0);
    setReceivedCount(0);
  }, []);

  connectFnRef.current = connect;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupRef.current();
    };
  }, []);

  const isMaxReached = messages.length >= maxMessages;

  return {
    draft,
    setDraft,
    connection,
    connect,
    disconnect,
    send,
    sendPing,
    messages,
    filteredMessages,
    maxMessages,
    setMaxMessages,
    isMaxReached,
    searchText,
    setSearchText,
    searchMode,
    setSearchMode,
    directionFilter,
    setDirectionFilter,
    sizeFilter,
    setSizeFilter,
    timeFilter,
    setTimeFilter,
    contentTypeFilter,
    setContentTypeFilter,
    clearMessages,
    appendReplayFrame: appendMessage,
    bookmarkedIds,
    bookmarkedMessages,
    toggleBookmark,
    sentCount,
    receivedCount,
    uptime,
    transportMode,
    autoReconnect,
    setAutoReconnect,
    reconnectState,
    cancelReconnect,
    reconnectIntervalMs,
    setReconnectIntervalMs,
    maxReconnectAttempts,
    setMaxReconnectAttempts,
    backoffMultiplier,
    setBackoffMultiplier,
    retryNow,
    protocolMode,
    setProtocolMode,
    detectedProtocol,
    tlsConfig,
    setTlsConfig,
    sioServerParams,
  };
}
