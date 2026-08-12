/**
 * API Mock Studio — companion control-plane client.
 * Talks to the /api/mock/* routes on the companion (proxied to :3001).
 * Failures return a classified RuntimeDiagnostic so the UI can show a clear,
 * recoverable message instead of a raw error.
 */
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { classifyRuntimeError, type RuntimeDiagnostic, type RuntimeErrorCode } from '../../shared/api-mock/recoveryDiagnostics';

export interface ControlStatus {
  serverId: string;
  port: number;
  state: 'running' | 'stopped';
  generation: number;
}

export interface JournalPage {
  transactions: ApiMockTransactionV1[];
  cursor: number;
  total: number;
  capped: boolean;
}

export interface ScenarioStateSnapshot {
  states: Record<string, string>;
  counters: Record<string, number>;
}

export type ControlResult<T> = { ok: true; data: T } | { ok: false; error: RuntimeDiagnostic };

const KNOWN_CODES: RuntimeErrorCode[] = ['MOCK_PORT_IN_USE', 'MOCK_PORT_OWNED', 'COMPANION_UNAVAILABLE', 'MOCK_VALIDATION_ERROR', 'MOCK_RUNTIME_ERROR'];

const TITLES: Record<RuntimeErrorCode, string> = {
  MOCK_PORT_IN_USE: 'Port already in use',
  MOCK_PORT_OWNED: 'Port owned by another server',
  COMPANION_UNAVAILABLE: 'Companion unavailable',
  MOCK_VALIDATION_ERROR: 'Invalid definition',
  MOCK_RUNTIME_ERROR: 'Runtime error',
};

function fromServerError(code: string | undefined, message: string): RuntimeDiagnostic {
  // The Vite dev proxy answers with this code (HTTP 200) when :3001 is down.
  if (code === 'BACKEND_UNREACHABLE') {
    return {
      code: 'COMPANION_UNAVAILABLE',
      title: TITLES.COMPANION_UNAVAILABLE,
      message: 'The companion runtime is not reachable. Start it with `npm run server:dev`, then retry.',
      recoverable: true,
      retry: true,
    };
  }
  if (code && (KNOWN_CODES as string[]).includes(code)) {
    const c = code as RuntimeErrorCode;
    return { code: c, title: TITLES[c], message, recoverable: true, retry: c === 'COMPANION_UNAVAILABLE' };
  }
  return classifyRuntimeError(new Error(message));
}

async function call<T>(path: string, init?: RequestInit): Promise<ControlResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    // Transport failure (companion down / network) — the /api proxy refused.
    return { ok: false, error: classifyRuntimeError(e) };
  }

  const body = await res.json().catch(() => null) as { ok?: boolean; data?: T; error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body || body.ok === false) {
    const message = body?.error?.message ?? (res.status === 502 || res.status === 503
      ? 'The companion runtime is not reachable. Start it with `npm run server:dev`, then retry.'
      : `Request failed (${res.status}).`);
    const code = body?.error?.code ?? (res.status >= 502 ? 'COMPANION_UNAVAILABLE' : undefined);
    return { ok: false, error: fromServerError(code, message) };
  }
  return { ok: true, data: body.data as T };
}

export const apiMockControlClient = {
  start: (def: ApiMockServerDefinitionV1) =>
    call<ControlStatus>('/api/mock/servers/start', { method: 'POST', body: JSON.stringify(def) }),
  stop: (serverId: string) =>
    call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(serverId)}/stop`, { method: 'POST' }),
  restart: (def: ApiMockServerDefinitionV1) =>
    call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(def.id)}/restart`, { method: 'POST', body: JSON.stringify(def) }),
  commit: (def: ApiMockServerDefinitionV1) =>
    call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(def.id)}/definition`, { method: 'PUT', body: JSON.stringify(def) }),
  status: (serverId: string) =>
    call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(serverId)}/status`, { method: 'GET' }),
  transactions: (serverId: string, limit = 100) =>
    call<JournalPage>(`/api/mock/servers/${encodeURIComponent(serverId)}/transactions?limit=${limit}`, { method: 'GET' }),
  clearTransactions: (serverId: string) =>
    call<{ cleared: boolean }>(`/api/mock/servers/${encodeURIComponent(serverId)}/transactions`, { method: 'DELETE' }),
  state: (serverId: string) =>
    call<ScenarioStateSnapshot>(`/api/mock/servers/${encodeURIComponent(serverId)}/state`, { method: 'GET' }),
  resetState: (serverId: string) =>
    call<{ reset: boolean }>(`/api/mock/servers/${encodeURIComponent(serverId)}/state/reset`, { method: 'POST' }),
};
