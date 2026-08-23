/**
 * API Mock Studio — companion control-plane client.
 * Talks to the /api/mock/* routes on the companion (proxied to :3001).
 * Failures return a classified RuntimeDiagnostic so the UI can show a clear,
 * recoverable message instead of a raw error.
 */
import type { ApiMockLocalDiagnosticsV1, ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import { HARD_CEILINGS } from '@shared/api-mock/defaults';
import type { ApiMockRecordedDraftV1 } from '@shared/api-mock/proxyRecording';
import { classifyRuntimeError, type RuntimeDiagnostic, type RuntimeErrorCode } from '@shared/api-mock/recoveryDiagnostics';
import { apiMockControlBase } from '@shared/api-mock/controlBase';
import { isTauri } from '@shared/utils/platform';
import { nativeTauriControl } from '@shared/api-mock/nativeTauriControl';
import { pickNextAutoPort, resolveNextAutoPort } from './apiMockPageHelpers';

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
  /** Next sequence index per route id (live listener). */
  sequencePositions?: Record<string, number>;
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
  // Companion 404s when the listener was wiped/stopped — do not keep retrying.
  if (code === 'NOT_RUNNING' || code === 'NOT_FOUND') {
    return {
      code: 'MOCK_RUNTIME_ERROR',
      title: 'Not running',
      message,
      recoverable: true,
      retry: false,
    };
  }
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

/** Vite's /api proxy waits up to 60s when :3001 hangs. Demo wipe/import cannot. */
const CONTROL_FETCH_TIMEOUT_MS = 2_500;

function companionUnavailable(): RuntimeDiagnostic {
  return {
    code: 'COMPANION_UNAVAILABLE',
    title: TITLES.COMPANION_UNAVAILABLE,
    message: 'The companion runtime is not reachable. Start it with `npm run server:dev`, then retry.',
    recoverable: true,
    retry: true,
  };
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 0): Promise<ControlResult<T>> {
  let res: Response;
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    res = await fetch(`${apiMockControlBase()}${path}`, {
      ...init,
      signal: controller?.signal ?? init?.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if (controller?.signal.aborted) return { ok: false, error: companionUnavailable() };
    // Transport failure (companion down / network) — the /api proxy refused.
    return { ok: false, error: classifyRuntimeError(e) };
  } finally {
    if (timer) clearTimeout(timer);
  }

  const body = await res.json().catch(() => null) as { ok?: boolean; data?: T; error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body || body.ok === false) {
    const message = body?.error?.message ?? (res.status === 502 || res.status === 503
      ? 'The companion runtime is not reachable. Start it with `npm run server:dev`, then retry.'
      : `Request failed (${res.status}).`);
    const code = body?.error?.code
      ?? (res.status >= 502 ? 'COMPANION_UNAVAILABLE' : res.status === 404 ? 'NOT_FOUND' : undefined);
    return { ok: false, error: fromServerError(code, message) };
  }
  return { ok: true, data: body.data as T };
}

export const apiMockControlClient = {
  start: (def: ApiMockServerDefinitionV1) =>
    isTauri()
      ? nativeTauriControl.start(def)
      : call<ControlStatus>('/api/mock/servers/start', { method: 'POST', body: JSON.stringify(def) }),
  stop: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.stop(serverId)
      : call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(serverId)}/stop`, { method: 'POST' }),
  restart: (def: ApiMockServerDefinitionV1) =>
    isTauri()
      ? nativeTauriControl.restart(def)
      : call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(def.id)}/restart`, { method: 'POST', body: JSON.stringify(def) }),
  commit: (def: ApiMockServerDefinitionV1) =>
    isTauri()
      ? nativeTauriControl.commit(def)
      : call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(def.id)}/definition`, { method: 'PUT', body: JSON.stringify(def) }),
  status: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.status(serverId)
      : call<ControlStatus>(`/api/mock/servers/${encodeURIComponent(serverId)}/status`, { method: 'GET' }),
  /** Live pool inventory — used for refresh reconciliation (AMS-010 / W21). */
  list: () =>
    isTauri()
      ? Promise.resolve({ ok: true as const, data: [] as ControlStatus[] })
      : call<ControlStatus[]>('/api/mock/servers', { method: 'GET' }, CONTROL_FETCH_TIMEOUT_MS),
  transactions: (serverId: string, limit = HARD_CEILINGS.maxJournalEntries) =>
    isTauri()
      ? nativeTauriControl.transactions(serverId, limit)
      : call<JournalPage>(`/api/mock/servers/${encodeURIComponent(serverId)}/transactions?limit=${limit}`, { method: 'GET' }, CONTROL_FETCH_TIMEOUT_MS),
  clearTransactions: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.clearTransactions(serverId)
      : call<{ cleared: boolean }>(`/api/mock/servers/${encodeURIComponent(serverId)}/transactions`, { method: 'DELETE' }),
  state: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.state(serverId)
      : call<ScenarioStateSnapshot>(`/api/mock/servers/${encodeURIComponent(serverId)}/state`, { method: 'GET' }, CONTROL_FETCH_TIMEOUT_MS),
  resetState: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.resetState(serverId)
      : call<{ reset: boolean }>(`/api/mock/servers/${encodeURIComponent(serverId)}/state/reset`, { method: 'POST' }),
  generateSelfSignedTls: (hosts: string[]) =>
    call<{ certPem: string; keyPem: string }>(
      '/api/mock/tls/self-signed',
      { method: 'POST', body: JSON.stringify({ hosts }) },
    ),
  generateClientCredentials: (commonName: string) =>
    call<{ caCertPem: string; clientCertPem: string; clientKeyPem: string; commonName: string }>(
      '/api/mock/tls/client-credentials',
      { method: 'POST', body: JSON.stringify({ commonName }) },
    ),
  recordedDrafts: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.recordedDrafts(serverId)
      : call<{ drafts: ApiMockRecordedDraftV1[]; total: number }>(
        `/api/mock/servers/${encodeURIComponent(serverId)}/recorded-drafts`,
        { method: 'GET' },
        CONTROL_FETCH_TIMEOUT_MS,
      ),
  diagnostics: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.diagnostics(serverId)
      : call<ApiMockLocalDiagnosticsV1>(
        `/api/mock/servers/${encodeURIComponent(serverId)}/diagnostics`,
        { method: 'GET' },
      ),
  ackRecordedDrafts: (serverId: string, ids: string[]) =>
    isTauri()
      ? nativeTauriControl.ackRecordedDrafts(serverId, ids)
      : call<{ removed: number }>(
        `/api/mock/servers/${encodeURIComponent(serverId)}/recorded-drafts/ack`,
        { method: 'POST', body: JSON.stringify({ ids }) },
      ),
  clearRecordedDrafts: (serverId: string) =>
    isTauri()
      ? nativeTauriControl.clearRecordedDrafts(serverId)
      : call<{ cleared: boolean }>(
        `/api/mock/servers/${encodeURIComponent(serverId)}/recorded-drafts`,
        { method: 'DELETE' },
      ),
  /** Probe whether a single port can bind on this machine. */
  probePort: (port: number) =>
    isTauri()
      ? nativeTauriControl.probePort(port)
      : call<{ port: number; available: boolean }>(
        '/api/mock/ports/probe',
        { method: 'POST', body: JSON.stringify({ port }) },
      ),
  /**
   * Next free auto-port (4600–4699), skipping tab excludes and OS-bound ports.
   * Falls back to a local scan via probePort when the dedicated next endpoint fails.
   */
  nextAutoPort: async (exclude: number[] = []): Promise<ControlResult<{ port: number }>> => {
    if (isTauri()) return nativeTauriControl.nextAutoPort(exclude);
    const direct = await call<{ port: number }>(
      '/api/mock/ports/next',
      { method: 'POST', body: JSON.stringify({ exclude }) },
      CONTROL_FETCH_TIMEOUT_MS,
    );
    if (direct.ok) return direct;
    if (direct.error.code === 'COMPANION_UNAVAILABLE') {
      return { ok: true, data: { port: pickNextAutoPort(exclude.map(p => ({ port: p }))) } };
    }
    // Older companions without /ports/next — walk with /ports/probe.
    try {
      const port = await resolveNextAutoPort(
        exclude.map(p => ({ port: p })),
        {
          isAvailable: async candidate => {
            const probe = await call<{ port: number; available: boolean }>(
              '/api/mock/ports/probe',
              { method: 'POST', body: JSON.stringify({ port: candidate }) },
            );
            return probe.ok ? probe.data.available : true;
          },
        },
      );
      return { ok: true, data: { port } };
    } catch (e) {
      return { ok: false, error: classifyRuntimeError(e) };
    }
  },
};
