import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type WsCloseDetail,
  type WsConnectionDraft,
  type WsConnectionSnapshot,
  type WsFrame,
  type WsReconnectState,
  type WsTlsConfig,
  createDefaultDraft,
  createDefaultReconnectState,
  createDefaultTlsConfig,
  createFrame,
  hasCustomHeaders,
  hasTlsOverrides,
  buildEffectiveUrl,
  getCloseCodeLabel,
  DEFAULT_BACKOFF_MULTIPLIER,
  type WsBackoffMultiplier,
} from '../../shared/websocket/types';
import { dispatchWsOperation } from '../../shared/websocket/websocketClient';
import {
  listenWsMessage,
  listenWsConnectionClosed,
  type WsMessagePayload,
  type WsConnectionClosedPayload,
} from '../../shared/websocket/websocketNativeTauriTransport';
import { isTauri } from '../../shared/utils/platform';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import { detectProtocol, detectFromMessage, resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import {
  applyFilters,
  checkAutoRespond,
  annotateSentFrame,
  buildGqlWsInitAction,
  type SioServerParams,
} from './wsProtocolHelpers';
import {
  DEFAULT_MAX_MESSAGES,
  PROXY_POLL_INTERVAL_MS,
  DEFAULT_RECONNECT_INTERVAL_MS,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  formatCloseFrame,
  type WsDirectionFilter,
  type WsTransportMode,
  type UseWebSocketStudioReturn,
} from './useWebSocketStudioTypes';

export type { WsDirectionFilter, WsTransportMode, UseWebSocketStudioReturn };

export function useWebSocketStudio(): UseWebSocketStudioReturn {
  const [draft, setDraftState] = useState<WsConnectionDraft>(createDefaultDraft);
  const [connection, setConnection] = useState<WsConnectionSnapshot>({ state: 'disconnected' });
  const [messages, setMessages] = useState<WsFrame[]>([]);
  const [maxMessages, setMaxMessages] = useState(DEFAULT_MAX_MESSAGES);
  const [searchText, setSearchText] = useState('');
  const [directionFilter, setDirectionFilter] = useState<WsDirectionFilter>('all');
  const [sentCount, setSentCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [uptime, setUptime] = useState<number | null>(null);
  const [transportMode, setTransportMode] = useState<WsTransportMode>('direct');
  const [autoReconnect, setAutoReconnect] = useState(false);
  const [reconnectState, setReconnectState] = useState<WsReconnectState>(createDefaultReconnectState);
  const [reconnectIntervalMs, setReconnectIntervalMs] = useState(DEFAULT_RECONNECT_INTERVAL_MS);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(DEFAULT_MAX_RECONNECT_ATTEMPTS);
  const [backoffMultiplier, setBackoffMultiplier] = useState<WsBackoffMultiplier>(DEFAULT_BACKOFF_MULTIPLIER);
  const [protocolMode, setProtocolMode] = useState<WsProtocolMode>('auto');
  const [detectedProtocol, setDetectedProtocol] = useState<WsProtocolDetectionResult | null>(null);
  const [tlsConfig, setTlsConfigFull] = useState<WsTlsConfig>(createDefaultTlsConfig);
  const [sioServerParams, setSioServerParams] = useState<SioServerParams | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const uptimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxMessagesRef = useRef(maxMessages);
  const draftRef = useRef(draft);
  const proxyConnectionIdRef = useRef<string | null>(null);
  const proxyPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proxyCursorRef = useRef(0);
  const mountedRef = useRef(true);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReconnectRef = useRef(autoReconnect);
  const reconnectIntervalMsRef = useRef(reconnectIntervalMs);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);
  const backoffMultiplierRef = useRef(backoffMultiplier);
  const reconnectAttemptRef = useRef(0);
  const reconnectLostAtRef = useRef<number | undefined>(undefined);
  const lastReconnectErrorRef = useRef<string | undefined>(undefined);
  const reconnectingRef = useRef(false);
  const protocolModeRef = useRef(protocolMode);
  const detectedProtocolRef = useRef(detectedProtocol);
  const messageDetectionDoneRef = useRef(false);
  const tlsConfigRef = useRef(tlsConfig);
  const unlistenMessageRef = useRef<(() => void) | null>(null);
  const unlistenClosedRef = useRef<(() => void) | null>(null);

  maxMessagesRef.current = maxMessages;
  protocolModeRef.current = protocolMode;
  detectedProtocolRef.current = detectedProtocol;
  tlsConfigRef.current = tlsConfig;

  const updateDetectedProtocol = useCallback((value: WsProtocolDetectionResult | null) => {
    detectedProtocolRef.current = value;
    setDetectedProtocol(value);
  }, []);
  draftRef.current = draft;
  autoReconnectRef.current = autoReconnect;
  reconnectIntervalMsRef.current = reconnectIntervalMs;
  maxReconnectAttemptsRef.current = maxReconnectAttempts;
  backoffMultiplierRef.current = backoffMultiplier;

  const setDraft = useCallback((patch: Partial<WsConnectionDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setTlsConfig = useCallback((patch: Partial<WsTlsConfig>) => {
    setTlsConfigFull((prev) => ({ ...prev, ...patch }));
  }, []);

  const stopUptimeTimer = useCallback(() => {
    if (uptimeTimerRef.current !== null) {
      clearInterval(uptimeTimerRef.current);
      uptimeTimerRef.current = null;
    }
  }, []);

  /** Stop uptime timer, clear connectedAt ref, and null out uptime state. */
  const resetConnectionTiming = useCallback(() => {
    stopUptimeTimer();
    connectedAtRef.current = null;
    setUptime(null);
  }, [stopUptimeTimer]);

  const startUptimeTimer = useCallback(() => {
    stopUptimeTimer();
    uptimeTimerRef.current = setInterval(() => {
      if (connectedAtRef.current !== null) {
        setUptime(Date.now() - connectedAtRef.current);
      }
    }, 1000);
  }, [stopUptimeTimer]);

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
    if (frames.length === 0) return;
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

    proxyPollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const env = await dispatchWsOperation<{
          messages: Array<{ data: string; type: string; receivedAt: string; size: number }>;
          cursor: number;
        }>('messages', {
          connectionId,
          sinceCursor: proxyCursorRef.current,
        });

        if (!mountedRef.current) return;
        if (env.data && env.data.messages.length > 0) {
          if (protocolModeRef.current === 'auto' && !messageDetectionDoneRef.current) {
            messageDetectionDoneRef.current = true;
            const firstMsg = env.data.messages[0];
            if (firstMsg.type !== 'binary') {
              const msgResult = detectFromMessage(firstMsg.data);
              if (msgResult) {
                updateDetectedProtocol(msgResult);
              }
            }
          }

          const allFrames: WsFrame[] = [];

          for (const m of env.data.messages) {
            const frame = createFrame('received', m.type === 'binary' ? 'binary' : 'text', m.data);

            if (m.type !== 'binary') {
              const autoResp = checkAutoRespond(frame, m.data, protocolModeRef.current, detectedProtocolRef.current);
              if (autoResp) {
                allFrames.push(frame);
                dispatchWsOperation('send', { connectionId, data: autoResp.replyData, type: 'text' }).catch(() => {});
                allFrames.push(autoResp.replyFrame);
                setSentCount((c) => c + 1);
                if (autoResp.sioServerParams) setSioServerParams(autoResp.sioServerParams);
                continue;
              }
            }

            allFrames.push(frame);
          }

          appendMessages(allFrames);
          setReceivedCount((c) => c + env.data!.messages.length);
          proxyCursorRef.current = env.data.cursor;
        }
      } catch {
        if (!mountedRef.current) return;
        try {
          const statusEnv = await dispatchWsOperation<{ state: string; lastError?: string }>(
            'status',
            { connectionId },
          );
          if (!mountedRef.current) return;
          if (statusEnv.data && statusEnv.data.state !== 'connected') {
            const statusData = statusEnv.data;
            stopProxyPolling();
            setConnection((prev) => ({
              ...prev,
              state: statusData.state === 'error' ? 'error' : 'disconnected',
              lastError: statusData.lastError,
            }));
            resetConnectionTiming();
            proxyConnectionIdRef.current = null;
            if (!manualDisconnectRef.current) {
              scheduleReconnectRef.current();
            }
          }
        } catch {
          if (!mountedRef.current) return;
          stopProxyPolling();
          setConnection((prev) => ({ ...prev, state: 'disconnected' }));
          resetConnectionTiming();
          proxyConnectionIdRef.current = null;
          if (!manualDisconnectRef.current) {
            scheduleReconnectRef.current();
          }
        }
      }
    }, PROXY_POLL_INTERVAL_MS);
  }, [stopProxyPolling, appendMessages, resetConnectionTiming, updateDetectedProtocol]);

  const startNativeListeners = useCallback(async (connectionId: string) => {
    stopNativeListeners();

    const unlistenMsg = await listenWsMessage((payload: WsMessagePayload) => {
      if (!mountedRef.current) return;
      if (payload.connectionId !== connectionId) return;

      const frameType = payload.messageType === 'binary' ? 'binary' : 'text';
      const frame = createFrame('received', frameType, payload.data);

      if (protocolModeRef.current === 'auto' && !messageDetectionDoneRef.current) {
        messageDetectionDoneRef.current = true;
        if (frameType !== 'binary') {
          const msgResult = detectFromMessage(payload.data);
          if (msgResult) updateDetectedProtocol(msgResult);
        }
      }

      if (frameType !== 'binary') {
        const autoResp = checkAutoRespond(frame, payload.data, protocolModeRef.current, detectedProtocolRef.current);
        if (autoResp) {
          appendMessage(frame);
          dispatchWsOperation('send', { connectionId, data: autoResp.replyData, type: 'text' }).catch(() => {});
          appendMessage(autoResp.replyFrame);
          setReceivedCount((c) => c + 1);
          setSentCount((c) => c + 1);
          if (autoResp.sioServerParams) setSioServerParams(autoResp.sioServerParams);
          return;
        }
      }

      appendMessage(frame);
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
  }, [stopNativeListeners, appendMessage, resetConnectionTiming, updateDetectedProtocol]);

  const cancelReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    reconnectLostAtRef.current = undefined;
    lastReconnectErrorRef.current = undefined;
    setReconnectState(createDefaultReconnectState(maxReconnectAttemptsRef.current));
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  const cleanupRef = useRef(() => {});
  cleanupRef.current = () => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
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

  // ── Auto-Reconnect Scheduling ───────────────────────────────────────────────

  const scheduleReconnectRef = useRef<() => void>(() => {});

  // ── Direct Transport ────────────────────────────────────────────────────────

  const connectDirect = useCallback(() => {
    const effectiveUrl = buildEffectiveUrl(draftRef.current);
    if (!effectiveUrl) return;

    setConnection({ state: 'connecting', url: effectiveUrl });
    setTransportMode('direct');
    messageDetectionDoneRef.current = false;
    const connectStart = Date.now();

    const protocols = draftRef.current.subprotocols
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (protocolModeRef.current === 'auto') {
      const earlyResult = detectProtocol(effectiveUrl, protocols);
      if (earlyResult.protocol !== 'raw') {
        updateDetectedProtocol(earlyResult);
        messageDetectionDoneRef.current = true;
      }
    }

    let ws: WebSocket;
    try {
      ws = protocols.length > 0 ? new WebSocket(effectiveUrl, protocols) : new WebSocket(effectiveUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConnection({ state: 'error', url: effectiveUrl, lastError: message });
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      const latencyMs = Date.now() - connectStart;
      connectedAtRef.current = Date.now();
      reconnectAttemptRef.current = 0;
      reconnectLostAtRef.current = undefined;
      lastReconnectErrorRef.current = undefined;
      setReconnectState(createDefaultReconnectState(maxReconnectAttemptsRef.current));
      const proto = ws.protocol || 'none';
      setConnection({
        state: 'connected',
        url: effectiveUrl,
        connectedAt: new Date().toISOString(),
        protocol: ws.protocol || undefined,
        extensions: ws.extensions || undefined,
        latencyMs,
      });
      setUptime(0);
      startUptimeTimer();

      const sysProto = proto || 'none';
      const sysFrame = createFrame('received', 'text', `Connected to ${effectiveUrl} (protocol: ${sysProto})`);
      (sysFrame as WsFrame & { isSystem?: boolean }).isSystem = true;
      appendMessage(sysFrame);

      const effectiveOnOpen = resolveEffectiveProtocol(protocolModeRef.current, detectedProtocolRef.current);
      if (effectiveOnOpen === 'graphql-ws') {
        const init = buildGqlWsInitAction();
        try { ws.send(init.replyData); } catch { /* connection may have closed */ }
        appendMessage(init.replyFrame);
        setSentCount((c) => c + 1);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      const frame = createFrame('received', 'text', data);

      if (protocolModeRef.current === 'auto' && !messageDetectionDoneRef.current) {
        messageDetectionDoneRef.current = true;
        const msgResult = detectFromMessage(data);
        if (msgResult) {
          updateDetectedProtocol(msgResult);
        }
      }

      const autoResp = checkAutoRespond(frame, data, protocolModeRef.current, detectedProtocolRef.current);
      if (autoResp) {
        try { ws.send(autoResp.replyData); } catch { /* connection may have closed */ }
        appendMessage(frame);
        appendMessage(autoResp.replyFrame);
        setReceivedCount((c) => c + 1);
        setSentCount((c) => c + 1);
        if (autoResp.sioServerParams) setSioServerParams(autoResp.sioServerParams);
        return;
      }

      appendMessage(frame);
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
        const errMsg = 'Connection failed — check URL, network, or CORS policy';
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
  }, [appendMessage, startUptimeTimer, resetConnectionTiming, updateDetectedProtocol]);

  // ── Proxy Transport ─────────────────────────────────────────────────────────

  const connectProxy = useCallback(async () => {
    const currentDraft = draftRef.current;
    const effectiveUrl = buildEffectiveUrl(currentDraft);
    if (!effectiveUrl) return;

    setConnection({ state: 'connecting', url: effectiveUrl });
    setTransportMode(isTauri() ? 'native' : 'proxy');
    messageDetectionDoneRef.current = false;

    const headersMap: Record<string, string> = {};
    for (const h of currentDraft.headers) {
      if (h.enabled && h.key.trim().length > 0) {
        headersMap[h.key.trim()] = h.value;
      }
    }

    const subprotocols = currentDraft.subprotocols
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

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

      if (env.data) {
        proxyConnectionIdRef.current = env.data.connectionId;
        connectedAtRef.current = Date.now();
        reconnectAttemptRef.current = 0;
        reconnectLostAtRef.current = undefined;
        lastReconnectErrorRef.current = undefined;
        setReconnectState(createDefaultReconnectState(maxReconnectAttemptsRef.current));

        if (protocolModeRef.current === 'auto') {
          const earlyResult = detectProtocol(effectiveUrl, subprotocols);
          if (earlyResult.protocol !== 'raw') {
            updateDetectedProtocol(earlyResult);
            messageDetectionDoneRef.current = true;
          }
        }

        const proto = env.data.protocol || 'none';
        setConnection({
          state: 'connected',
          url: effectiveUrl,
          connectedAt: new Date().toISOString(),
          protocol: env.data.protocol || undefined,
          extensions: env.data.extensions || undefined,
          latencyMs: env.data.latencyMs,
        });
        setUptime(0);
        startUptimeTimer();
        if (isTauri()) {
          await startNativeListeners(env.data.connectionId);
        } else {
          startProxyPolling(env.data.connectionId);
        }

        const proxySysFrame = createFrame('received', 'text', `Connected to ${effectiveUrl} (protocol: ${proto || 'none'})`);
        (proxySysFrame as WsFrame & { isSystem?: boolean }).isSystem = true;
        appendMessage(proxySysFrame);

        const effectiveOnProxy = resolveEffectiveProtocol(protocolModeRef.current, detectedProtocolRef.current);
        if (effectiveOnProxy === 'graphql-ws') {
          const init = buildGqlWsInitAction();
          dispatchWsOperation('send', { connectionId: env.data.connectionId, data: init.replyData, type: 'text' }).catch(() => {});
          appendMessage(init.replyFrame);
          setSentCount((c) => c + 1);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastReconnectErrorRef.current = message;
      setConnection({ state: 'error', url: effectiveUrl, lastError: message });
      if (!manualDisconnectRef.current) {
        scheduleReconnectRef.current();
      }
    }
  }, [startUptimeTimer, startProxyPolling, startNativeListeners, appendMessage, updateDetectedProtocol]);

  // ── Public API ──────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    const url = draftRef.current.url.trim().toLowerCase();
    if (!url || (!url.startsWith('ws://') && !url.startsWith('wss://'))) return;

    manualDisconnectRef.current = false;
    if (!reconnectingRef.current) {
      reconnectAttemptRef.current = 0;
      updateDetectedProtocol(null);
      setSioServerParams(null);
    }
    cleanupRef.current();

    if (isTauri()) {
      connectProxy();
    } else {
      const effectiveUrlForProxy = buildEffectiveUrl(draftRef.current).toLowerCase();
      const needsProxy = hasCustomHeaders(draftRef.current) ||
        (effectiveUrlForProxy.startsWith('wss://') && hasTlsOverrides(tlsConfigRef.current));
      if (needsProxy) {
        connectProxy();
      } else {
        connectDirect();
      }
    }
  }, [connectDirect, connectProxy, updateDetectedProtocol]);

  const disconnect = useCallback((detail?: WsCloseDetail) => {
    manualDisconnectRef.current = true;
    cancelReconnect();

    const code = detail?.code ?? 1000;
    const reason = detail?.reason ?? 'User disconnected';

    if (detail) {
      appendMessage(createFrame('sent', 'close', formatCloseFrame('SENT', code, reason)));
    }

    if (proxyConnectionIdRef.current) {
      setConnection((prev) => ({ ...prev, state: 'closing' }));
      const connId = proxyConnectionIdRef.current;
      proxyConnectionIdRef.current = null;
      stopProxyPolling();
      stopNativeListeners();

      dispatchWsOperation('disconnect', { connectionId: connId, code, reason })
        .then(() => {
          if (!mountedRef.current) return;
          resetConnectionTiming();
          appendMessage(createFrame('received', 'close', formatCloseFrame('ACK', code, reason)));
          setConnection((prev) => ({
            ...prev,
            state: 'disconnected',
            closedAt: new Date().toISOString(),
            closeCode: code,
            closeReason: reason,
          }));
        })
        .catch(() => {
          if (!mountedRef.current) return;
          resetConnectionTiming();
          setConnection((prev) => ({ ...prev, state: 'disconnected' }));
        });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setConnection((prev) => ({ ...prev, state: 'closing' }));
      wsRef.current.close(code, reason);
    } else if (wsRef.current) {
      wsRef.current.close(code, reason);
    }
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
          .catch((err) => {
            if (!mountedRef.current) return;
            const errMsg = err instanceof Error ? err.message : String(err);
            setConnection((prev) => ({
              ...prev,
              lastError: `Send failed: ${errMsg}`,
            }));
          });
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (isBinary) {
          try {
            const binaryStr = atob(data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            wsRef.current.send(bytes);
          } catch {
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
    [appendMessage],
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
        const errMsg = err instanceof Error ? err.message : String(err);
        setConnection((prev) => ({
          ...prev,
          lastError: `Ping failed: ${errMsg}`,
        }));
      });
  }, [appendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSentCount(0);
    setReceivedCount(0);
  }, []);

  // Reconnect scheduling — uses ref to avoid stale closures over connect
  // eslint-disable-next-line react-hooks/immutability -- intentional ref.current reassignment to break circular dependency with connect()
  scheduleReconnectRef.current = () => {
    if (!autoReconnectRef.current || !mountedRef.current) return;

    const attempt = reconnectAttemptRef.current + 1;
    const max = maxReconnectAttemptsRef.current;

    if (attempt > max) {
      setReconnectState({
        active: false,
        attempt: max,
        maxAttempts: max,
        nextRetryAt: null,
        lastError: lastReconnectErrorRef.current,
        lostAt: reconnectLostAtRef.current,
      });
      return;
    }

    if (attempt === 1) {
      reconnectLostAtRef.current = Date.now();
    }

    reconnectAttemptRef.current = attempt;
    const multiplier = backoffMultiplierRef.current;
    const delay = Math.round(reconnectIntervalMsRef.current * Math.pow(multiplier, attempt - 1));
    const nextRetryAt = Date.now() + delay;

    setReconnectState({
      active: true,
      attempt,
      maxAttempts: max,
      nextRetryAt,
      lastError: lastReconnectErrorRef.current,
      lostAt: reconnectLostAtRef.current,
    });

    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      reconnectTimerRef.current = null;
      reconnectingRef.current = true;
      connect();
      reconnectingRef.current = false;
    }, delay);
  };

  const retryNow = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    reconnectLostAtRef.current = undefined;
    manualDisconnectRef.current = false;
    setReconnectState(createDefaultReconnectState(maxReconnectAttemptsRef.current));
    connect();
  }, [connect]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanupRef.current();
    };
  }, []);

  const filteredMessages = useMemo(
    () => applyFilters(messages, searchText, directionFilter),
    [messages, searchText, directionFilter],
  );
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
    directionFilter,
    setDirectionFilter,
    clearMessages,
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
