/**
 * Native Tauri invoke adapter for API Mock listener control (Phase 10D).
 * Dynamic import so the module is safe in the web/Vite bundle.
 */
import type { ApiMockLocalDiagnosticsV1, ApiMockServerDefinitionV1, ApiMockTransactionV1 } from './contracts';
import { HARD_CEILINGS } from './defaults';
import { classifyRuntimeError, type RuntimeDiagnostic, type RuntimeErrorCode } from './recoveryDiagnostics';

export type NativeControlResult<T> = { ok: true; data: T } | { ok: false; error: RuntimeDiagnostic };

interface ControlStatus {
  serverId: string;
  port: number;
  state: 'running' | 'stopped';
  generation: number;
}

interface JournalPage {
  transactions: ApiMockTransactionV1[];
  cursor: number;
  total: number;
  capped: boolean;
}

interface ScenarioStateSnapshot {
  states: Record<string, string>;
  counters: Record<string, number>;
  sequencePositions?: Record<string, number>;
}

const KNOWN_CODES: RuntimeErrorCode[] = [
  'MOCK_PORT_IN_USE', 'MOCK_PORT_OWNED', 'COMPANION_UNAVAILABLE', 'MOCK_VALIDATION_ERROR', 'MOCK_RUNTIME_ERROR',
];

const TITLES: Record<RuntimeErrorCode, string> = {
  MOCK_PORT_IN_USE: 'Port already in use',
  MOCK_PORT_OWNED: 'Port owned by another server',
  COMPANION_UNAVAILABLE: 'Companion unavailable',
  MOCK_VALIDATION_ERROR: 'Invalid definition',
  MOCK_RUNTIME_ERROR: 'Runtime error',
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message?: string } };

export type NativeInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeOverride: NativeInvoke | undefined;

/** Test hook — inject a fake invoke without loading @tauri-apps/api. */
export function setNativeInvokeForTests(fn: NativeInvoke | undefined): void {
  invokeOverride = fn;
}

async function getInvoke(): Promise<NativeInvoke> {
  if (invokeOverride) return invokeOverride;
  const mod = await import('@tauri-apps/api/core');
  return mod.invoke as NativeInvoke;
}

function fromEnvelope<T>(body: Envelope<T> | null, fallback: string): NativeControlResult<T> {
  if (!body) {
    return { ok: false, error: classifyRuntimeError(new Error(fallback)) };
  }
  if (body.ok === false) {
    const message = body.error?.message ?? fallback;
    const code = body.error?.code;
    if (code && (KNOWN_CODES as string[]).includes(code)) {
      const c = code as RuntimeErrorCode;
      return {
        ok: false,
        error: { code: c, title: TITLES[c], message, recoverable: true, retry: c === 'COMPANION_UNAVAILABLE' },
      };
    }
    return { ok: false, error: classifyRuntimeError(new Error(message)) };
  }
  return { ok: true, data: body.data };
}

async function invokeEnvelope<T>(cmd: string, args: Record<string, unknown>): Promise<NativeControlResult<T>> {
  try {
    const invoke = await getInvoke();
    const body = await invoke<Envelope<T>>(cmd, args);
    return fromEnvelope(body, `Native command ${cmd} failed`);
  } catch (e) {
    const diagnostic: RuntimeDiagnostic = classifyRuntimeError(e);
    return { ok: false, error: diagnostic };
  }
}

export const nativeTauriControl = {
  start: (def: ApiMockServerDefinitionV1) =>
    invokeEnvelope<ControlStatus>('api_mock_listener_start', { definition: def }),
  stop: (serverId: string) =>
    invokeEnvelope<ControlStatus>('api_mock_listener_stop', { serverId }),
  restart: (def: ApiMockServerDefinitionV1) =>
    invokeEnvelope<ControlStatus>('api_mock_listener_restart', { definition: def }),
  commit: (def: ApiMockServerDefinitionV1) =>
    invokeEnvelope<ControlStatus>('api_mock_listener_commit', { serverId: def.id, definition: def }),
  status: (serverId: string) =>
    invokeEnvelope<ControlStatus>('api_mock_listener_status', { serverId }),
  transactions: (serverId: string, limit = HARD_CEILINGS.maxJournalEntries) =>
    invokeEnvelope<JournalPage>('api_mock_listener_transactions_query', { serverId, limit }),
  clearTransactions: (serverId: string) =>
    invokeEnvelope<{ cleared: boolean }>('api_mock_listener_transactions_clear', { serverId }),
  state: (serverId: string) =>
    invokeEnvelope<ScenarioStateSnapshot>('api_mock_listener_state', { serverId }),
  resetState: (serverId: string) =>
    invokeEnvelope<{ reset: boolean }>('api_mock_listener_reset_state', { serverId }),
  diagnostics: (serverId: string) =>
    invokeEnvelope<ApiMockLocalDiagnosticsV1>('api_mock_listener_diagnostics', { serverId }),
};
