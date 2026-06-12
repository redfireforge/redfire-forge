/**
 * Phase 9 — WebSocket console OBSERVER.
 *
 * There is no event bus on `useWebSocketStudio`; it exposes React state only.
 * This hook records `WsConsoleEntry`s by diffing successive snapshot values in
 * effects (previous values held in refs to avoid duplicate entries). It never
 * mutates the studio hook.
 */

import { useEffect, useRef } from 'react';
import type {
  WsConnectionDraft,
  WsConnectionSnapshot,
  WsConnectionState,
  WsReconnectState,
} from '../../shared/websocket/types';
import type { WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import type { GlobalAuthProfile } from '../../shared/types';
import { describeResolvedAuth } from './wsAuthResolve';
import { useConsoleBuffer, type UseConsoleBufferReturn } from './useConsoleBuffer';
import { WS_CONSOLE_SETTINGS_KEY } from './wsConsoleStorage';
import {
  buildClosedEntry,
  buildClosingEntry,
  buildConnectingEntry,
  buildControlEntry,
  buildErrorEntry,
  buildEstablishedEntry,
  buildHandshakeEntry,
  buildProtocolEntry,
  buildReconnectEntry,
} from './wsConsoleEntries';

export interface UseWebSocketConsoleParams {
  connection: WsConnectionSnapshot;
  reconnectState: WsReconnectState;
  detectedProtocol: WsProtocolDetectionResult | null;
  draft: WsConnectionDraft;
  authProfiles: GlobalAuthProfile[];
}

export function useWebSocketConsole(params: UseWebSocketConsoleParams): UseConsoleBufferReturn {
  const { connection, reconnectState, detectedProtocol, draft, authProfiles } = params;
  const buffer = useConsoleBuffer(WS_CONSOLE_SETTINGS_KEY);
  const { append } = buffer;

  // Latest draft/profiles read via refs so the connection effect always sees
  // current values without re-subscribing on every keystroke.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const profilesRef = useRef(authProfiles);
  profilesRef.current = authProfiles;

  // ── Connection lifecycle + handshake + control frames ──────────────
  const prevStateRef = useRef<WsConnectionState | null>(null);
  const prevLatencyRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const state = connection.state;
    const prev = prevStateRef.current;

    // First observation: seed refs without emitting (avoid a phantom entry).
    if (prev === null) {
      prevStateRef.current = state;
      prevLatencyRef.current = connection.latencyMs;
      return;
    }

    if (state !== prev) {
      switch (state) {
        case 'connecting':
          append(buildConnectingEntry(connection.url ?? draftRef.current.url));
          break;
        case 'connected': {
          const authSummary = describeResolvedAuth(draftRef.current.auth, profilesRef.current);
          append(
            buildHandshakeEntry({
              url: connection.url ?? draftRef.current.url,
              subprotocols: draftRef.current.subprotocols,
              authSummary,
              protocol: connection.protocol,
              extensions: connection.extensions,
              latencyMs: connection.latencyMs,
            }),
          );
          append(
            buildEstablishedEntry({
              protocol: connection.protocol,
              latencyMs: connection.latencyMs,
            }),
          );
          break;
        }
        case 'closing':
          append(buildClosingEntry());
          break;
        case 'disconnected':
          append(
            buildClosedEntry({
              closeCode: connection.closeCode,
              closeReason: connection.closeReason,
            }),
          );
          break;
        case 'error':
          append(buildErrorEntry(connection.lastError));
          break;
      }
      prevStateRef.current = state;
      prevLatencyRef.current = connection.latencyMs;
      return;
    }

    // Same state: best-effort control-frame entry when latency updates while
    // connected (the studio sets latency once at handshake, so this is rare).
    if (
      state === 'connected' &&
      typeof connection.latencyMs === 'number' &&
      connection.latencyMs !== prevLatencyRef.current
    ) {
      append(buildControlEntry(connection.latencyMs));
      prevLatencyRef.current = connection.latencyMs;
    }
  }, [connection, append]);

  // ── Reconnect attempts ─────────────────────────────────────────────
  const prevAttemptRef = useRef<number | null>(null);
  useEffect(() => {
    const attempt = reconnectState.attempt;
    if (prevAttemptRef.current === null) {
      prevAttemptRef.current = attempt;
      return;
    }
    // Emit on each new attempt. Use `!==` (not `>`) so we still record the
    // first attempt of a fresh cycle after the counter resets to 0 on a
    // successful reconnect (e.g. prev=3 → 0 → 1).
    if (reconnectState.active && attempt >= 1 && attempt !== prevAttemptRef.current) {
      append(
        buildReconnectEntry({
          attempt,
          maxAttempts: reconnectState.maxAttempts,
        }),
      );
    }
    prevAttemptRef.current = attempt;
  }, [reconnectState.active, reconnectState.attempt, reconnectState.maxAttempts, append]);

  // ── Protocol detection ─────────────────────────────────────────────
  const prevProtocolRef = useRef<string | null>(null);
  const protocolSeededRef = useRef(false);
  useEffect(() => {
    const proto = detectedProtocol?.protocol ?? null;
    // Seed on first observation (no emit) so a protocol already detected when
    // the hook mounts mid-connection does not produce an orphan entry — matches
    // the lifecycle/reconnect effects above.
    if (!protocolSeededRef.current) {
      protocolSeededRef.current = true;
      prevProtocolRef.current = proto;
      return;
    }
    if (proto && proto !== prevProtocolRef.current) {
      append(
        buildProtocolEntry({
          protocol: detectedProtocol!.protocol,
          confidence: detectedProtocol!.confidence,
          reason: detectedProtocol!.reason,
        }),
      );
    }
    prevProtocolRef.current = proto;
  }, [detectedProtocol, append]);

  return buffer;
}
