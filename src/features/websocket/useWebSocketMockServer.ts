import { useCallback, useEffect, useRef, useState } from 'react';
import { toErrorMessage } from '../../shared/utils/helpers';
import type {
  WsMockRule,
  WsMockFallbackMode,
  WsMockLogEntry,
  WsMockStatus,
} from '../../shared/websocket/types';
import { loadMockRules, saveMockRules, loadMockConfig, saveMockConfig } from '../../shared/websocket/websocketStorage';

export interface MockServerConfig {
  port: number;
  fallback: WsMockFallbackMode;
}

export interface UseWebSocketMockServerReturn {
  status: WsMockStatus;
  logs: WsMockLogEntry[];
  rules: WsMockRule[];
  config: MockServerConfig;
  starting: boolean;
  setRules: (rules: WsMockRule[]) => void;
  setConfig: (config: MockServerConfig) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  broadcast: (data: string) => Promise<number>;
  clearLogs: () => void;
  pushRulesToServer: (rules: WsMockRule[], fallback: WsMockFallbackMode) => Promise<void>;
}

const POLL_INTERVAL_MS = 500;

function emptyStatus(port: number): WsMockStatus {
  return { running: false, port, clientCount: 0, clients: [] };
}

async function mockFetch<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (method !== 'GET' && body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const resp = await fetch(path, init);
  let parsed: { ok: boolean; data?: T; error?: { message: string } };

  try {
    if (typeof resp.json === 'function') {
      parsed = await resp.json() as typeof parsed;
    } else if (typeof resp.text === 'function') {
      const rawBody = await resp.text();
      parsed = JSON.parse(rawBody) as typeof parsed;
    } else {
      throw new Error('No JSON body parser available');
    }
  } catch {
    if (resp.status === 502) {
      throw new Error(
        'Backend API is unreachable (HTTP 502). Start the local API server on port 3001 and retry.',
      );
    }
    throw new Error(`Server returned ${resp.status} (non-JSON response)`);
  }
  if (!parsed.ok) throw new Error(parsed.error?.message ?? 'Unknown mock server error');
  return parsed.data as T;
}

/**
 * Manages one mock server instance scoped to `port`.
 * Each WebSocket tab calls this with its own assigned port so servers are isolated.
 * `active` controls whether status/log polling runs (only poll when Mock Server tab is visible).
 */
export function useWebSocketMockServer(port: number, active: boolean): UseWebSocketMockServerReturn {
  const [status, setStatus] = useState<WsMockStatus>(() => emptyStatus(port));
  const [logs, setLogs] = useState<WsMockLogEntry[]>([]);
  const [rules, setRulesState] = useState<WsMockRule[]>([]);
  const [config, setConfigState] = useState<MockServerConfig>({ port, fallback: 'echo' });
  const [starting, setStarting] = useState(false);
  const logCursorRef = useRef(-1);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollLogsInFlightRef = useRef(false);

  // Sync config.port whenever the port prop changes (e.g. user edits port while server is stopped).
  // The async load below may override this if there is a saved config for the new port.
  useEffect(() => {
    setConfigState((prev) => ({ ...prev, port }));
    setStatus(emptyStatus(port));
    setLogs([]);
    logCursorRef.current = -1;
  }, [port]);

  // Load persisted rules + config for this port on mount or port change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedRules = await loadMockRules(port);
      const saved = await loadMockConfig(port);
      if (cancelled) return;
      setRulesState(savedRules);
      if (saved) {
        setConfigState({ port: saved.port, fallback: saved.fallback as WsMockFallbackMode });
      }
    })();
    return () => { cancelled = true; };
  }, [port]);

  const setRules = useCallback((next: WsMockRule[]) => {
    setRulesState(next);
    void saveMockRules(port, next);
  }, [port]);

  const setConfig = useCallback((next: MockServerConfig) => {
    setConfigState(next);
    void saveMockConfig(port, next);
  }, [port]);

  const pushRulesToServer = useCallback(async (nextRules: WsMockRule[], nextFallback: WsMockFallbackMode) => {
    try {
      await mockFetch<{ count: number }>('POST', '/api/ws/mock/rules', {
        port,
        rules: nextRules,
        fallback: nextFallback,
      });
    } catch { /* server may not be running */ }
  }, [port]);

  const pollStatus = useCallback(async () => {
    try {
      const s = await mockFetch<WsMockStatus>('GET', `/api/ws/mock/status?port=${port}`);
      setStatus(s);
    } catch {
      setStatus((prev) => prev.running ? { ...prev, running: false, error: 'Backend unreachable' } : prev);
    }
  }, [port]);

  const pollLogs = useCallback(async () => {
    // Prevent overlapping concurrent polls — avoids duplicate entries.
    if (pollLogsInFlightRef.current) return;
    pollLogsInFlightRef.current = true;
    try {
      const resp = await mockFetch<{ entries: WsMockLogEntry[]; cursor: number }>(
        'GET',
        `/api/ws/mock/log?port=${port}&sinceCursor=${logCursorRef.current}`,
      );
      if (resp.entries.length > 0) {
        logCursorRef.current = resp.cursor;
        setLogs((prev) => {
          const combined = [...prev, ...resp.entries];
          return combined.length > 200 ? combined.slice(-200) : combined;
        });
      }
    } catch { /* ignore */ }
    finally {
      pollLogsInFlightRef.current = false;
    }
  }, [port]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      pollStatus();
      pollLogs();
    }, POLL_INTERVAL_MS);
  }, [pollStatus, pollLogs]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopPolling();
      return;
    }
    // Immediately fetch both status AND logs so the UI reflects current server state
    // without waiting for the first interval tick (≤ POLL_INTERVAL_MS delay).
    pollStatus();
    pollLogs();
    startPolling();
    return stopPolling;
  }, [active, pollStatus, pollLogs, startPolling, stopPolling]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const s = await mockFetch<WsMockStatus>('POST', '/api/ws/mock/start', {
        port,
        rules,
        fallback: config.fallback,
      });
      setStatus(s);
      logCursorRef.current = -1;
      setLogs([]);
      pollLogs();
    } catch (err) {
      setStatus((prev) => ({ ...prev, running: false, error: toErrorMessage(err) }));
      throw err;
    } finally {
      setStarting(false);
    }
  }, [port, config.fallback, rules, pollLogs]);

  const stop = useCallback(async () => {
    try {
      const s = await mockFetch<WsMockStatus>('POST', '/api/ws/mock/stop', { port });
      setStatus(s);
    } catch {
      setStatus((prev) => ({ ...prev, running: false, error: 'Failed to stop server — it may already be stopped' }));
    }
  }, [port]);

  const broadcast = useCallback(async (data: string): Promise<number> => {
    const resp = await mockFetch<{ sent: number }>('POST', '/api/ws/mock/broadcast', { port, data });
    return resp.sent;
  }, [port]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    status,
    logs,
    rules,
    config,
    starting,
    setRules,
    setConfig,
    start,
    stop,
    broadcast,
    clearLogs,
    pushRulesToServer,
  };
}
