/**
 * Phase 9 — SSE console OBSERVER.
 *
 * Like `useWebSocketConsole`, this records `WsConsoleEntry`s by diffing the SSE
 * connection snapshot. SSE handshakes use the REAL request headers we set
 * (`Accept`, `Cache-Control`, `Last-Event-ID`, auth), so they are fully accurate.
 */

import { useEffect, useRef } from 'react';
import type {
  SseConnectionConfig,
  SseConnectionSnapshot,
  SseConnectionState,
} from './sseTypes';
import type { GlobalAuthProfile } from '../../shared/types';
import { describeResolvedAuth } from '../websocket/wsAuthResolve';
import { useConsoleBuffer, type UseConsoleBufferReturn } from '../websocket/useConsoleBuffer';
import { SSE_CONSOLE_SETTINGS_KEY } from '../websocket/wsConsoleStorage';
import { resolveEnvVars } from '../websocket/wsMessageUtils';
import {
  buildSseClosedEntry,
  buildSseConnectingEntry,
  buildSseErrorEntry,
  buildSseHandshakeEntry,
  buildSseReconnectEntry,
} from '../websocket/wsConsoleEntries';

export interface UseSseConsoleParams {
  connection: SseConnectionSnapshot;
  config: SseConnectionConfig;
  authProfiles: GlobalAuthProfile[];
  envVarMap?: Record<string, string>;
}

export function useSseConsole(params: UseSseConsoleParams): UseConsoleBufferReturn {
  const { connection, config, authProfiles, envVarMap } = params;
  const buffer = useConsoleBuffer(SSE_CONSOLE_SETTINGS_KEY);
  const { append } = buffer;

  const configRef = useRef(config);
  configRef.current = config;
  const profilesRef = useRef(authProfiles);
  profilesRef.current = authProfiles;
  const envVarMapRef = useRef<Record<string, string>>(envVarMap ?? {});
  envVarMapRef.current = envVarMap ?? {};

  const resolveUrlForConsole = (url: string): string => {
    const resolved = resolveEnvVars(url, envVarMapRef.current);
    return resolved || url;
  };

  // ── Connection lifecycle + handshake ───────────────────────────────
  const prevStateRef = useRef<SseConnectionState | null>(null);
  useEffect(() => {
    const state = connection.state;
    const prev = prevStateRef.current;
    if (prev === null) {
      prevStateRef.current = state;
      return;
    }
    if (state !== prev) {
      switch (state) {
        case 'connecting':
          append(buildSseConnectingEntry(resolveUrlForConsole(configRef.current.url)));
          break;
        case 'connected': {
          const cfg = configRef.current;
          append(
            buildSseHandshakeEntry({
              url: resolveUrlForConsole(cfg.url),
              authSummary: describeResolvedAuth(cfg.auth, profilesRef.current),
              lastEventId: connection.lastEventId || undefined,
              extraHeaders: (cfg.headers ?? [])
                .filter((h) => h.enabled && h.key.trim())
                .map((h) => ({ key: h.key, value: h.value })),
            }),
          );
          break;
        }
        case 'disconnected':
          append(buildSseClosedEntry());
          break;
        case 'error':
          append(buildSseErrorEntry(connection.error));
          break;
        // 'idle' is the initial/reset state — no entry.
      }
      prevStateRef.current = state;
    }
  }, [connection, append]);

  // ── Reconnect attempts ─────────────────────────────────────────────
  const prevAttemptRef = useRef<number | null>(null);
  useEffect(() => {
    const attempt = connection.reconnectAttempt;
    if (prevAttemptRef.current === null) {
      prevAttemptRef.current = attempt;
      return;
    }
    if (attempt >= 1 && attempt !== prevAttemptRef.current) {
      append(buildSseReconnectEntry({ attempt, retryMs: connection.retryMs }));
    }
    prevAttemptRef.current = attempt;
  }, [connection.reconnectAttempt, connection.retryMs, append]);

  return buffer;
}
