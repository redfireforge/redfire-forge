/**
 * API Mock Studio — workspace persistence.
 *
 * Persists mock-server definitions through the platform storage abstraction
 * (`readKey`/`writeKey`, IndexedDB/Tauri) so they survive navigation and reload.
 * Runtime status (running/generation) is never persisted — it is reconciled
 * from the companion at load time.
 */
import type { ApiMockServerDefinitionV1, ApiMockWorkspaceV1 } from '../../shared/api-mock/contracts';
import { safeLoadWorkspace } from '../../shared/api-mock/recoveryDiagnostics';
import { CURRENT_SCHEMA_VERSION } from '../../shared/api-mock/defaults';
import { readKey, writeKey } from '../../shared/utils/storage';

export const API_MOCK_STORAGE_KEY = 'api-mock-workspace-v1';
/** Same-tab notice after Studio writes the workspace. Not a full replace. */
export const API_MOCK_WORKSPACE_PERSISTED_EVENT = 'api-mock:workspace-persisted';
/** Same-tab notice after Studio start/stop. Not a workspace replace. */
export const API_MOCK_RUNTIME_CHANGED_EVENT = 'api-mock:runtime-changed';

export function publishApiMockRuntimeChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(API_MOCK_RUNTIME_CHANGED_EVENT));
}

let workspaceSnapshot: ApiMockPersistedState | null = null;

function snapshotFrom(state: ApiMockPersistedState): ApiMockPersistedState {
  const openTabIds = state.openTabIds ?? state.servers.map(s => s.id);
  return {
    servers: state.servers,
    activeServerId: state.activeServerId,
    openTabIds,
  };
}

/** Keep an in-memory copy and tell Test Runner the library changed. */
export function publishApiMockWorkspace(state: ApiMockPersistedState): void {
  workspaceSnapshot = snapshotFrom(state);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_PERSISTED_EVENT, { detail: workspaceSnapshot }));
}

export interface ApiMockPersistedState {
  /** Every saved server — closing a tab parks its definition here. */
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  /**
   * Ids of servers open as tabs, in tab-bar order. Omit for legacy callers:
   * every server is then treated as open.
   */
  openTabIds?: string[];
}

export async function loadApiMockWorkspace(): Promise<ApiMockPersistedState> {
  // Empty is a real publish (delete-all). Skipping it fell through to stale disk.
  if (workspaceSnapshot) {
    return workspaceSnapshot;
  }
  let raw: string | null;
  try {
    raw = await readKey(API_MOCK_STORAGE_KEY);
  } catch {
    return { servers: [] };
  }
  if (!raw) return { servers: [] };

  // Use the migrated workspace whenever it parsed/migrated, even if validation
  // flagged non-fatal issues — only truly unparseable data drops user work.
  const result = safeLoadWorkspace(raw);
  if (result.workspace) {
    const next = snapshotFrom({
      servers: result.workspace.servers,
      activeServerId: result.workspace.activeServerId,
      openTabIds: result.workspace.openTabIds,
    });
    if (next.servers.length > 0) workspaceSnapshot = next;
    return next;
  }
  return { servers: [] };
}

/** Same-tab snapshot after wipe/import/save — sync so workflow pickers do not flash empty. */
export function peekApiMockWorkspaceSnapshot(): ApiMockPersistedState | null {
  return workspaceSnapshot;
}

/** Test-only: drop the same-session cache so disk fixtures stay authoritative. */
export function resetApiMockWorkspaceSnapshot(): void {
  workspaceSnapshot = null;
}

export async function saveApiMockWorkspace(state: ApiMockPersistedState): Promise<void> {
  const openTabIds = state.openTabIds ?? state.servers.map(s => s.id);
  const workspace: ApiMockWorkspaceV1 = {
    schemaVersion: CURRENT_SCHEMA_VERSION as 1,
    activeServerId: state.activeServerId,
    servers: state.servers,
    // `tabOrder` stays the open-tab order so older builds and the CLI keep working.
    tabOrder: openTabIds,
    openTabIds,
  };
  publishApiMockWorkspace({
    servers: state.servers,
    activeServerId: state.activeServerId,
    openTabIds,
  });
  try {
    await writeKey(API_MOCK_STORAGE_KEY, JSON.stringify(workspace), { notifyOnQuotaExhausted: false });
  } catch {
    // Best effort: a failed write must not break the editing session.
  }
}
