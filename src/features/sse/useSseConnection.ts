/**
 * SSE connection hook. Manages fetch-based streaming, SSE parsing,
 * auto-reconnect with Last-Event-ID, and event collection.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveEnvVars } from '../websocket/wsMessageUtils';
import type {
  SseConnectionConfig,
  SseConnectionSnapshot,
  SseConnectionState,
  SseEvent,
  SseStats,
} from './sseTypes';
import { createDefaultSseConfig, createSseEvent } from './sseTypes';
import { createSseParser } from './sseParser';

const DEFAULT_RETRY_MS = 3000;
const MAX_EVENTS = 10000;

export interface UseSseConnectionReturn {
  config: SseConnectionConfig;
  setConfig: (patch: Partial<SseConnectionConfig>) => void;
  connection: SseConnectionSnapshot;
  events: SseEvent[];
  stats: SseStats;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
  toggleBookmark: (id: string) => void;
  bookmarkedIds: ReadonlySet<string>;
}

export function useSseConnection(
  envVarMap?: Record<string, string>,
): UseSseConnectionReturn {
  const [config, setConfigState] = useState<SseConnectionConfig>(createDefaultSseConfig);
  const [connection, setConnection] = useState<SseConnectionSnapshot>({
    state: 'idle',
    lastEventId: '',
    retryMs: DEFAULT_RETRY_MS,
    reconnectAttempt: 0,
  });
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [stats, setStats] = useState<SseStats>({
    eventCount: 0,
    startedAt: null,
    eventTypeCounts: {},
  });
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const stateRef = useRef<SseConnectionState>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const retryMsRef = useRef(DEFAULT_RETRY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastEventIdRef = useRef('');
  const mountedRef = useRef(true);
  const configRef = useRef(config);
  const envVarMapRef = useRef<Record<string, string>>(envVarMap ?? {});

  configRef.current = config;
  envVarMapRef.current = envVarMap ?? {};

  const setConfig = useCallback((patch: Partial<SseConnectionConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateState = useCallback((state: SseConnectionState, error?: string) => {
    if (!mountedRef.current) return;
    stateRef.current = state;
    setConnection({
      state,
      error,
      lastEventId: lastEventIdRef.current,
      retryMs: retryMsRef.current,
      reconnectAttempt: reconnectAttemptRef.current,
    });
  }, []);

  const appendEvent = useCallback((event: SseEvent) => {
    if (!mountedRef.current) return;
    setEvents((prev) => {
      if (prev.length >= MAX_EVENTS) {
        return [...prev.slice(prev.length - MAX_EVENTS + 1), event];
      }
      return [...prev, event];
    });
    setStats((prev) => ({
      eventCount: prev.eventCount + 1,
      startedAt: prev.startedAt,
      eventTypeCounts: {
        ...prev.eventTypeCounts,
        [event.eventType]: (prev.eventTypeCounts[event.eventType] || 0) + 1,
      },
    }));
  }, []);

  const doConnect = useCallback(async () => {
    const cfg = configRef.current;
    const map = envVarMapRef.current;
    const url = resolveEnvVars(cfg.url, map);

    if (!url) {
      updateState('error', 'URL is required');
      return;
    }

    const abort = new AbortController();
    abortRef.current = abort;
    updateState('connecting');

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    for (const h of cfg.headers) {
      if (h.key.trim()) {
        headers[resolveEnvVars(h.key, map)] = resolveEnvVars(h.value, map);
      }
    }
    if (lastEventIdRef.current) {
      headers['Last-Event-ID'] = lastEventIdRef.current;
    }

    try {
      const response = await fetch(url, {
        headers,
        signal: abort.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        updateState('error', `HTTP ${response.status} ${response.statusText}`);
        return;
      }

      if (!response.body) {
        updateState('error', 'Response has no body stream');
        return;
      }

      updateState('connected');
      reconnectAttemptRef.current = 0;

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      const parser = createSseParser({
        onEvent: (parsed) => {
          if (!mountedRef.current || abort.signal.aborted) return;
          lastEventIdRef.current = parsed.lastEventId;
          const event = createSseEvent(
            parsed.eventType,
            parsed.data,
            lastEventIdRef.current,
          );
          appendEvent(event);
        },
        onRetry: (ms) => {
          retryMsRef.current = ms;
        },
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done || abort.signal.aborted) break;
        parser.feed(value);
      }
      parser.flush();

      if (!abort.signal.aborted && mountedRef.current) {
        updateState('disconnected');
        maybeReconnect();
      }
    } catch (err: unknown) {
      if (abort.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Connection failed';
      if (mountedRef.current) {
        updateState('error', message);
        maybeReconnect();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState, appendEvent]);

  const maybeReconnect = useCallback(() => {
    const cfg = configRef.current;
    if (
      !cfg.autoReconnect ||
      reconnectAttemptRef.current >= cfg.maxRetries ||
      !mountedRef.current
    ) {
      return;
    }
    reconnectAttemptRef.current++;
    updateState('disconnected');
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current && stateRef.current !== 'connected') {
        doConnect();
      }
    }, retryMsRef.current);
  }, [doConnect, updateState]);

  const connect = useCallback(() => {
    if (stateRef.current === 'connecting' || stateRef.current === 'connected') return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    retryMsRef.current = DEFAULT_RETRY_MS;
    setStats((prev) => ({ ...prev, startedAt: Date.now() }));
    doConnect();
  }, [doConnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    reconnectAttemptRef.current = 0;
    updateState('disconnected');
  }, [updateState]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setStats((prev) => ({ eventCount: 0, startedAt: prev.startedAt, eventTypeCounts: {} }));
    setBookmarkedIds(new Set());
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  return {
    config,
    setConfig,
    connection,
    events,
    stats,
    connect,
    disconnect,
    clearEvents,
    toggleBookmark,
    bookmarkedIds,
  };
}
