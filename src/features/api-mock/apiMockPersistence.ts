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

export interface ApiMockPersistedState {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
}

export async function loadApiMockWorkspace(): Promise<ApiMockPersistedState> {
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
    return { servers: result.workspace.servers, activeServerId: result.workspace.activeServerId };
  }
  return { servers: [] };
}

export async function saveApiMockWorkspace(state: ApiMockPersistedState): Promise<void> {
  const workspace: ApiMockWorkspaceV1 = {
    schemaVersion: CURRENT_SCHEMA_VERSION as 1,
    activeServerId: state.activeServerId,
    servers: state.servers,
    tabOrder: state.servers.map(s => s.id),
  };
  try {
    await writeKey(API_MOCK_STORAGE_KEY, JSON.stringify(workspace), { notifyOnQuotaExhausted: false });
  } catch {
    // Best effort: a failed write must not break the editing session.
  }
}
