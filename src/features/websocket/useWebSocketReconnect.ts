/**
 * Extracted reconnect-scheduling logic for useWebSocketStudio.
 * Manages auto-reconnect state, backoff timing, cancel, and retry-now.
 */
import { useCallback, useRef, useState } from 'react';
import {
  type WsReconnectState,
  type WsBackoffMultiplier,
  createDefaultReconnectState,
  DEFAULT_BACKOFF_MULTIPLIER,
} from '../../shared/websocket/types';
import {
  DEFAULT_RECONNECT_INTERVAL_MS,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
} from './useWebSocketStudioTypes';

export interface UseWebSocketReconnectReturn {
  autoReconnect: boolean;
  setAutoReconnect: (enabled: boolean) => void;
  reconnectState: WsReconnectState;
  reconnectIntervalMs: number;
  setReconnectIntervalMs: (ms: number) => void;
  maxReconnectAttempts: number;
  setMaxReconnectAttempts: (n: number) => void;
  backoffMultiplier: WsBackoffMultiplier;
  setBackoffMultiplier: (v: WsBackoffMultiplier) => void;
  cancelReconnect: () => void;
  retryNow: () => void;

  /** Ref-stable schedule function — call after an unexpected disconnect */
  scheduleReconnectRef: React.MutableRefObject<() => void>;
  /** True while the connect() triggered by reconnect is in progress */
  reconnectingRef: React.MutableRefObject<boolean>;
  /** Stores the last error string for reconnect display */
  lastReconnectErrorRef: React.MutableRefObject<string | undefined>;
  /** Ref kept in sync with maxReconnectAttempts for closure stability */
  maxReconnectAttemptsRef: React.MutableRefObject<number>;
}

export function useWebSocketReconnect(
  connectFnRef: React.MutableRefObject<() => void>,
  mountedRef: React.MutableRefObject<boolean>,
): UseWebSocketReconnectReturn {
  const [autoReconnect, setAutoReconnect] = useState(false);
  const [reconnectState, setReconnectState] = useState<WsReconnectState>(createDefaultReconnectState);
  const [reconnectIntervalMs, setReconnectIntervalMs] = useState(DEFAULT_RECONNECT_INTERVAL_MS);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(DEFAULT_MAX_RECONNECT_ATTEMPTS);
  const [backoffMultiplier, setBackoffMultiplier] = useState<WsBackoffMultiplier>(DEFAULT_BACKOFF_MULTIPLIER);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReconnectRef = useRef(autoReconnect);
  const reconnectIntervalMsRef = useRef(reconnectIntervalMs);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);
  const backoffMultiplierRef = useRef(backoffMultiplier);
  const reconnectAttemptRef = useRef(0);
  const reconnectLostAtRef = useRef<number | undefined>(undefined);
  const lastReconnectErrorRef = useRef<string | undefined>(undefined);
  const reconnectingRef = useRef(false);

  // Keep refs in sync
  autoReconnectRef.current = autoReconnect;
  reconnectIntervalMsRef.current = reconnectIntervalMs;
  maxReconnectAttemptsRef.current = maxReconnectAttempts;
  backoffMultiplierRef.current = backoffMultiplier;

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

  const scheduleReconnectRef = useRef<() => void>(() => {});

  scheduleReconnectRef.current = () => {
    if (!autoReconnectRef.current || !mountedRef.current) return;
    if (reconnectTimerRef.current !== null) return;
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
      connectFnRef.current();
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
    setReconnectState(createDefaultReconnectState(maxReconnectAttemptsRef.current));
    connectFnRef.current();
  }, [connectFnRef]);

  return {
    autoReconnect,
    setAutoReconnect,
    reconnectState,
    reconnectIntervalMs,
    setReconnectIntervalMs,
    maxReconnectAttempts,
    setMaxReconnectAttempts,
    backoffMultiplier,
    setBackoffMultiplier,
    cancelReconnect,
    retryNow,
    scheduleReconnectRef,
    reconnectingRef,
    lastReconnectErrorRef,
    maxReconnectAttemptsRef,
  };
}
