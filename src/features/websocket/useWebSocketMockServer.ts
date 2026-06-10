import { useCallback, useEffect, useRef, useState } from 'react';
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

const POLL_INTERVAL_MS = 2000;

const EMPTY_STATUS: WsMockStatus = {
  running: false,
  port: 9876,
  clientCount: 0,
  clients: [],
};

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
    parsed = await resp.json() as typeof parsed;
  } catch {
    throw new Error(`Server returned ${resp.status} (non-JSON response)`);
  }
  if (!parsed.ok) throw new Error(parsed.error?.message ?? 'Unknown mock server error');
  return parsed.data as T;
}

export function useWebSocketMockServer(active: boolean): UseWebSocketMockServerReturn {
  const [status, setStatus] = useState<WsMockStatus>(EMPTY_STATUS);
  const [logs, setLogs] = useState<WsMockLogEntry[]>([]);
  const [rules, setRulesState] = useState<WsMockRule[]>([]);
  const [config, setConfigState] = useState<MockServerConfig>({ port: 9876, fallback: 'echo' });
  const [starting, setStarting] = useState(false);
  const logCursorRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedRules = await loadMockRules();
      const saved = await loadMockConfig();
      if (cancelled) return;
      setRulesState(savedRules);
      if (saved) {
        setConfigState({ port: saved.port, fallback: saved.fallback as WsMockFallbackMode });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setRules = useCallback((next: WsMockRule[]) => {
    setRulesState(next);
    void saveMockRules(next);
  }, []);

  const setConfig = useCallback((next: MockServerConfig) => {
    setConfigState(next);
    void saveMockConfig(next);
  }, []);

  const pushRulesToServer = useCallback(async (nextRules: WsMockRule[], nextFallback: WsMockFallbackMode) => {
    try {
      await mockFetch<{ count: number }>('POST', '/api/ws/mock/rules', {
        rules: nextRules,
        fallback: nextFallback,
      });
    } catch { /* server may not be running */ }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const s = await mockFetch<WsMockStatus>('GET', '/api/ws/mock/status');
      setStatus(s);
    } catch {
      setStatus((prev) => prev.running ? { ...prev, running: false, error: 'Backend unreachable' } : prev);
    }
  }, []);

  const pollLogs = useCallback(async () => {
    try {
      const resp = await mockFetch<{ entries: WsMockLogEntry[]; cursor: number }>(
        'GET',
        `/api/ws/mock/log?sinceCursor=${logCursorRef.current}`,
      );
      if (resp.entries.length > 0) {
        logCursorRef.current = resp.cursor;
        setLogs((prev) => {
          const combined = [...prev, ...resp.entries];
          return combined.length > 200 ? combined.slice(-200) : combined;
        });
      }
    } catch { /* ignore */ }
  }, []);

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
    pollStatus();
    startPolling();
    return stopPolling;
  }, [active, pollStatus, startPolling, stopPolling]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const s = await mockFetch<WsMockStatus>('POST', '/api/ws/mock/start', {
        port: config.port,
        rules,
        fallback: config.fallback,
      });
      setStatus(s);
      logCursorRef.current = -1;
      setLogs([]);
      pollLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus((prev) => ({ ...prev, running: false, error: msg }));
      throw err;
    } finally {
      setStarting(false);
    }
  }, [config, rules, pollLogs]);

  const stop = useCallback(async () => {
    try {
      const s = await mockFetch<WsMockStatus>('POST', '/api/ws/mock/stop');
      setStatus(s);
    } catch {
      setStatus((prev) => ({ ...prev, running: false, error: 'Failed to stop server — it may already be stopped' }));
    }
  }, []);

  const broadcast = useCallback(async (data: string): Promise<number> => {
    const resp = await mockFetch<{ sent: number }>('POST', '/api/ws/mock/broadcast', { data });
    return resp.sent;
  }, []);

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
