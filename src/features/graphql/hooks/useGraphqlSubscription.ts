/**
 * useGraphqlSubscription — React hook for managing live GraphQL subscriptions.
 *
 * Phase 2.0 Sprint 2: implements the subscription state machine, message buffer,
 * rolling stats, pause/resume, and export for `GraphqlSubscriptionLog.tsx`.
 *
 * State machine:
 *   idle → connecting → active ─┐
 *              ↑                 │
 *        reconnecting ←──────────┘ (on unexpected close, while retries remain)
 *              │
 *            error (max retries exceeded or permanent close code)
 *            closed (user-initiated stop or server COMPLETE frame)
 *
 * Usage:
 *   const sub = useGraphqlSubscription();
 *   sub.subscribe({ query, variables, operationName, endpoint, headers, auth });
 *   // ...
 *   sub.disconnect();
 */

import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { selectTransport } from '../utils/graphqlClient';
import type { GraphqlAuth, GraphqlError, GraphqlSubscriptionMessage, SubscriptionState, SubscriptionStats } from '../../../shared/types/graphql';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SubscribeParams {
  query: string;
  variables: Record<string, unknown>;
  operationName: string | undefined;
  endpoint: string;
  headers: Record<string, string>;
  auth?: GraphqlAuth | null;
  skipTlsVerify?: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  bufferSize?: number;
}

export interface UseGraphqlSubscriptionResult {
  /** Current state of the subscription lifecycle. */
  state: SubscriptionState;
  /** All messages received (up to `bufferSize` — oldest evicted when full). */
  messages: GraphqlSubscriptionMessage[];
  /** Rolling statistics updated on each message. */
  stats: SubscriptionStats;
  /** Unix ms when subscribe() was last called — used for live duration display. */
  connectedSince: number;
  /** True when the log is paused — new messages are buffered but not shown. */
  isPaused: boolean;
  /** Number of messages buffered while paused (shown as badge). */
  pausedBufferCount: number;
  /** Error message for the `error` state. */
  errorMessage: string | null;
  /** Reconnect attempt number (1-based, shown while reconnecting). */
  reconnectAttempt: number;
  /** Id of the active session (changes on each subscribe() call). */
  sessionId: string | null;
  /** Transport used for the current session. */
  transport: 'graphql-transport-ws' | 'graphql-ws' | 'sse' | null;

  // ── Actions ──
  subscribe(params: SubscribeParams): void;
  disconnect(): void;
  pause(): void;
  resume(): void;
  clear(): void;
  reset(): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BUFFER_SIZE = 5_000;
const MSGS_PER_SEC_WINDOW_MS = 5_000;

const EMPTY_STATS: SubscriptionStats = {
  totalMessages: 0,
  errorCount: 0,
  avgLatencyMs: 0,
  msgsPerSec: 0,
  connectedDurationMs: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlSubscription(): UseGraphqlSubscriptionResult {
  const [state, setState] = useState<SubscriptionState>('idle');
  const [messages, setMessages] = useState<GraphqlSubscriptionMessage[]>([]);
  const [stats, setStats] = useState<SubscriptionStats>(EMPTY_STATS);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedBufferCount, setPausedBufferCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transport, setTransport] = useState<'graphql-transport-ws' | 'graphql-ws' | 'sse' | null>(null);
  const [connectedSince, setConnectedSince] = useState(0);

  // ── Internal refs (stable across renders, no re-render on change) ──────────
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef<number>(0);
  const bufferSizeRef = useRef(DEFAULT_BUFFER_SIZE);
  const isPausedRef = useRef(false);
  const pauseBufferRef = useRef<GraphqlSubscriptionMessage[]>([]);
  const recentTimestampsRef = useRef<number[]>([]);
  const indexRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const statsRef = useRef<SubscriptionStats>({ ...EMPTY_STATS });
  // AbortController for the current subscription
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const computeRollingMsgsPerSec = (nowMs: number): number => {
    const cutoff = nowMs - MSGS_PER_SEC_WINDOW_MS;
    recentTimestampsRef.current = recentTimestampsRef.current.filter((t) => t > cutoff);
    recentTimestampsRef.current.push(nowMs);
    return recentTimestampsRef.current.length / (MSGS_PER_SEC_WINDOW_MS / 1000);
  };

  // Append a message to the visible list (evict oldest if buffer full)
  const appendMessage = useCallback((msg: GraphqlSubscriptionMessage) => {
    const maxSize = bufferSizeRef.current;
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > maxSize ? next.slice(next.length - maxSize) : next;
    });
  }, []);

  // ── Core subscribe() action ───────────────────────────────────────────────

  const subscribe = useCallback((params: SubscribeParams) => {
    // Clean up any existing subscription
    unsubscribeRef.current?.();
    abortControllerRef.current?.abort();

    const newSessionId = uuidv4();
    const newAbort = new AbortController();
    abortControllerRef.current = newAbort;
    sessionIdRef.current = newSessionId;
    bufferSizeRef.current = params.bufferSize ?? DEFAULT_BUFFER_SIZE;
    startedAtRef.current = Date.now();
    indexRef.current = 0;
    recentTimestampsRef.current = [];
    pauseBufferRef.current = [];
    statsRef.current = { ...EMPTY_STATS };
    isPausedRef.current = false;

    // Determine transport label — must reflect the ACTUAL transport chosen,
    // not just the user preference. 'auto' may select SSE via the /stream heuristic.
    const resolvedPref = params.subscriptionTransport ?? 'auto';
    const isStreamUrl = resolvedPref === 'auto' &&
      (params.endpoint?.toLowerCase().endsWith('/stream') ||
       params.endpoint?.toLowerCase().includes('/stream?'));
    const transportLabel = (
      resolvedPref === 'graphql-ws' ? 'graphql-ws' :
      resolvedPref === 'sse' || isStreamUrl ? 'sse' :
      'graphql-transport-ws'
    ) as 'graphql-transport-ws' | 'graphql-ws' | 'sse';

    // Reset UI
    setState('connecting');
    setMessages([]);
    setStats({ ...EMPTY_STATS });
    setIsPaused(false);
    setPausedBufferCount(0);
    setErrorMessage(null);
    setReconnectAttempt(0);
    setSessionId(newSessionId);
    setTransport(transportLabel);
    setConnectedSince(startedAtRef.current);

    const selector = {
      auth: params.auth,
      skipTlsVerify: params.skipTlsVerify,
      tlsCaCert: params.tlsCaCert,
      tlsClientCert: params.tlsClientCert,
      tlsClientKey: params.tlsClientKey,
      endpoint: params.endpoint,
      subscriptionTransport: params.subscriptionTransport,
    };

    const transport = selectTransport(
      selector,
      'subscription',
      (wsState, attempt) => {
        if (wsState === 'connecting') {
          setState('connecting');
        } else if (wsState === 'connected') {
          // WS acknowledged but subscription not yet active — keep 'connecting'
          // (first `next` frame moves us to 'active' in onMessage below)
        } else if (wsState === 'reconnecting') {
          setState('reconnecting');
          setReconnectAttempt(attempt ?? 1);
        } else if (wsState === 'error') {
          // Will be surfaced via onError callback below
        } else if (wsState === 'closed') {
          // Will be surfaced via onComplete callback below (if clean)
        }
      },
    );

    const unsub = transport.subscribe(
      params.query,
      params.variables,
      params.operationName,
      {
        endpoint: params.endpoint,
        headers: params.headers,
        skipTlsVerify: params.skipTlsVerify,
        tlsCaCert: params.tlsCaCert,
        tlsClientCert: params.tlsClientCert,
        tlsClientKey: params.tlsClientKey,
        signal: newAbort.signal,
      },
      {
        onMessage(data) {
          if (sessionIdRef.current !== newSessionId) return;
          const nowMs = Date.now();
          indexRef.current += 1;
          const hasErrors =
            data !== null &&
            typeof data === 'object' &&
            Array.isArray((data as Record<string, unknown>).errors) &&
            ((data as Record<string, unknown>).errors as unknown[]).length > 0;

          const msg: GraphqlSubscriptionMessage = {
            id: uuidv4(),
            sessionId: sessionIdRef.current!,
            index: indexRef.current,
            direction: 'in',
            timestampMs: nowMs,
            offsetMs: nowMs - startedAtRef.current,
            // SSE transport passes the full ExecutionResult ({ data, errors? }) while WS
            // passes just result.data. Detect SSE wrapping via 'data' key presence rather
            // than ?? so that data:null (partial-error frames) is preserved as null
            // instead of falling back to the full result object.
            data: data !== null && typeof data === 'object' && 'data' in (data as Record<string, unknown>)
              ? (data as Record<string, unknown>).data
              : data,
            errors: hasErrors
              ? ((data as Record<string, unknown>).errors as GraphqlError[])
              : undefined,
            transport: transportLabel,
          };

          // Update rolling stats
          const s = statsRef.current;
          s.totalMessages = indexRef.current;
          s.errorCount += hasErrors ? 1 : 0;
          s.msgsPerSec = computeRollingMsgsPerSec(nowMs);
          s.connectedDurationMs = nowMs - startedAtRef.current;
          setStats({ ...s });

          // Transition to 'active' on first message
          setState('active');

          // Buffer while paused
          if (isPausedRef.current) {
            pauseBufferRef.current.push(msg);
            setPausedBufferCount((n) => n + 1);
          } else {
            appendMessage(msg);
          }
        },

        onError(msg) {
          if (sessionIdRef.current !== newSessionId) return;
          setErrorMessage(msg);
          setState('error');
          unsubscribeRef.current = null;
        },

        onComplete() {
          if (sessionIdRef.current !== newSessionId) return;
          setState('closed');
          unsubscribeRef.current = null;
        },
      },
    );

    unsubscribeRef.current = unsub;
  }, [appendMessage]);

  // ── disconnect() ──────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    unsubscribeRef.current?.();
    abortControllerRef.current?.abort();
    unsubscribeRef.current = null;
    abortControllerRef.current = null;
    setState((prev) => (prev === 'idle' ? 'idle' : 'closed'));
  }, []);

  // ── pause() / resume() ───────────────────────────────────────────────────

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setPausedBufferCount(0);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    const buffered = pauseBufferRef.current;
    if (buffered.length > 0) {
      pauseBufferRef.current = [];
      setPausedBufferCount(0);
      const maxSize = bufferSizeRef.current;
      setMessages((prev) => {
        const combined = [...prev, ...buffered];
        return combined.length > maxSize ? combined.slice(combined.length - maxSize) : combined;
      });
    } else {
      setPausedBufferCount(0);
    }
  }, []);

  // ── clear() ───────────────────────────────────────────────────────────────

  const clear = useCallback(() => {
    setMessages([]);
    pauseBufferRef.current = [];
    setPausedBufferCount(0);
    indexRef.current = 0;
    recentTimestampsRef.current = [];
    statsRef.current = { ...EMPTY_STATS };
    setStats({ ...EMPTY_STATS });
  }, []);

  // ── reset() — returns to idle (drops all state) ───────────────────────────

  const reset = useCallback(() => {
    unsubscribeRef.current?.();
    abortControllerRef.current?.abort();
    unsubscribeRef.current = null;
    abortControllerRef.current = null;
    setState('idle');
    setMessages([]);
    setStats({ ...EMPTY_STATS });
    setIsPaused(false);
    setPausedBufferCount(0);
    setErrorMessage(null);
    setReconnectAttempt(0);
    setSessionId(null);
    setTransport(null);
    setConnectedSince(0);
    isPausedRef.current = false;
    pauseBufferRef.current = [];
    recentTimestampsRef.current = [];
    indexRef.current = 0;
  }, []);

  return {
    state,
    messages,
    stats,
    connectedSince,
    isPaused,
    pausedBufferCount,
    errorMessage,
    reconnectAttempt,
    sessionId,
    transport,
    subscribe,
    disconnect,
    pause,
    resume,
    clear,
    reset,
  };
}
