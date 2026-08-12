/**
 * API Mock Studio — recovery, reconciliation, and runtime-error diagnostics (Phase 12C).
 *
 * Pure helpers that centralize the recovery behavior the plan describes for the
 * companion-crash, stale-UI-state, corrupt-storage, migration-failure, and
 * port-theft drills (Sections 5.13, W2, W21, AMS-009/010). No platform imports.
 */
import type { ApiMockWorkspaceV1, ApiMockDiagnosticV1, ApiMockServerState } from './contracts';
import { migrateWorkspace } from './migration';
import { validateWorkspace } from './validation';

// ── Runtime error classification ────────────────────────────────────

export type RuntimeErrorCode =
  | 'MOCK_PORT_IN_USE'
  | 'MOCK_PORT_OWNED'
  | 'COMPANION_UNAVAILABLE'
  | 'MOCK_VALIDATION_ERROR'
  | 'MOCK_RUNTIME_ERROR';

export interface RuntimeDiagnostic {
  code: RuntimeErrorCode;
  title: string;
  message: string;
  /** Whether the user can recover without losing data. */
  recoverable: boolean;
  /** Whether a plain retry (no user edit) is the expected next step. */
  retry: boolean;
}

/**
 * Map a raw runtime/transport error to a stable, user-facing diagnostic so the
 * UI never surfaces raw stack text and every failure has a recovery path.
 */
export function classifyRuntimeError(error: unknown): RuntimeDiagnostic {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('eaddrinuse') || lower.includes('address already in use')) {
    return {
      code: 'MOCK_PORT_IN_USE',
      title: 'Port already in use',
      message: 'The selected port is already in use by another process. Pick a different port and try again.',
      recoverable: true,
      retry: false,
    };
  }
  if (lower.includes('owned by')) {
    return {
      code: 'MOCK_PORT_OWNED',
      title: 'Port owned by another server',
      message: raw,
      recoverable: true,
      retry: false,
    };
  }
  if (
    lower.includes('econnrefused') || lower.includes('econnreset') ||
    lower.includes('fetch failed') || lower.includes('failed to fetch') ||
    lower.includes('networkerror') || lower.includes('network error') ||
    lower.includes('socket hang up')
  ) {
    return {
      code: 'COMPANION_UNAVAILABLE',
      title: 'Companion unavailable',
      message: 'The companion runtime is not reachable. Start it, then retry.',
      recoverable: true,
      retry: true,
    };
  }
  if (lower.includes('validation')) {
    return {
      code: 'MOCK_VALIDATION_ERROR',
      title: 'Invalid definition',
      message: raw,
      recoverable: true,
      retry: false,
    };
  }
  return {
    code: 'MOCK_RUNTIME_ERROR',
    title: 'Runtime error',
    message: raw || 'An unknown runtime error occurred.',
    recoverable: true,
    retry: true,
  };
}

// ── Runtime-state reconciliation (W21 / AMS-010) ────────────────────

export type ReconciledRuntimeState = ApiMockServerState | 'unknown';

export interface PersistedServerRuntime {
  serverId: string;
  /** Persisted flag — advisory only; never trusted as authoritative truth. */
  persistedRunning?: boolean;
}

export interface LiveServerStatus {
  serverId: string;
  state: 'running' | 'stopped';
  generation?: number;
}

export type ReconcileNotice = 'was_running' | 'companion_unavailable';

export interface ReconciledServer {
  serverId: string;
  state: ReconciledRuntimeState;
  notice?: ReconcileNotice;
  message?: string;
}

export interface ReconcileResult {
  companionAvailable: boolean;
  servers: ReconciledServer[];
}

/**
 * Reconcile persisted runtime hints against the companion's live status.
 * Persisted `running: true` is never trusted: if the companion is unreachable
 * every server becomes `unknown`; if the companion says stopped, a previously
 * "running" server is cleared to stopped with a reconciliation notice.
 */
export function reconcileRuntimeState(
  persisted: PersistedServerRuntime[],
  live: LiveServerStatus[] | null | undefined,
): ReconcileResult {
  if (!Array.isArray(live)) {
    return {
      companionAvailable: false,
      servers: persisted.map(p => ({
        serverId: p.serverId,
        state: 'unknown',
        notice: 'companion_unavailable',
        message: 'Companion unavailable — runtime status cannot be confirmed. You can still edit definitions offline.',
      })),
    };
  }

  const liveMap = new Map(live.map(l => [l.serverId, l]));
  return {
    companionAvailable: true,
    servers: persisted.map(p => {
      const running = liveMap.get(p.serverId)?.state === 'running';
      if (running) return { serverId: p.serverId, state: 'running' };
      if (p.persistedRunning) {
        return {
          serverId: p.serverId,
          state: 'stopped',
          notice: 'was_running',
          message: 'Stopped (was running) — runtime reconciled after reconnect.',
        };
      }
      return { serverId: p.serverId, state: 'stopped' };
    }),
  };
}

// ── Corrupt-storage-safe workspace load ─────────────────────────────

export interface SafeLoadResult {
  ok: boolean;
  workspace?: ApiMockWorkspaceV1;
  diagnostics: ApiMockDiagnosticV1[];
}

function corruptDiagnostic(message: string, remediation?: string): ApiMockDiagnosticV1 {
  return { code: 'AMS-STORAGE-CORRUPT', severity: 'error', path: '/', message, remediation };
}

/**
 * Load a persisted workspace defensively: parse, migrate, and validate without
 * ever throwing. Corrupt JSON, unsupported versions, failed migrations, or
 * structural errors all return `ok: false` with diagnostics so the caller can
 * fall back to a fresh workspace instead of crashing (corrupt-storage drill).
 */
export function safeLoadWorkspace(raw: unknown): SafeLoadResult {
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ok: false, diagnostics: [corruptDiagnostic('Stored workspace is not valid JSON and was ignored.', 'A fresh empty workspace will be used.')] };
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else {
    return { ok: false, diagnostics: [corruptDiagnostic('Stored workspace is missing or malformed and was ignored.', 'A fresh empty workspace will be used.')] };
  }

  let migration;
  try {
    migration = migrateWorkspace(obj);
  } catch (e) {
    return { ok: false, diagnostics: [corruptDiagnostic(`Workspace migration failed: ${(e as Error).message}`)] };
  }
  if (migration.diagnostics.some(d => d.severity === 'error')) {
    return { ok: false, diagnostics: migration.diagnostics };
  }

  let validation: ApiMockDiagnosticV1[];
  try {
    validation = validateWorkspace(migration.workspace);
  } catch (e) {
    return { ok: false, diagnostics: [corruptDiagnostic(`Workspace validation crashed: ${(e as Error).message}`)] };
  }
  if (validation.some(d => d.severity === 'error')) {
    return { ok: false, workspace: migration.workspace, diagnostics: validation };
  }

  return { ok: true, workspace: migration.workspace, diagnostics: [...migration.diagnostics, ...validation] };
}
