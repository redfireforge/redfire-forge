/**
 * API Mock Studio — workspace persistence.
 *
 * Persists mock-server definitions through the platform storage abstraction
 * (`readKey`/`writeKey`, IndexedDB/Tauri) so they survive navigation and reload.
 * Runtime status (running/generation) is never persisted — it is reconciled
 * from the companion at load time.
 */
import type { ApiMockServerDefinitionV1, ApiMockWorkspaceV1 } from '@shared/api-mock/contracts';
import { safeLoadWorkspace } from '@shared/api-mock/recoveryDiagnostics';
import { CURRENT_SCHEMA_VERSION } from '@shared/api-mock/defaults';
import { readKey, removeKey, writeKey } from '@shared/utils/storage';
import { isApiMockDemoLessonServer } from './apiMockDemoServers';

export const API_MOCK_STORAGE_KEY = 'api-mock-workspace-v1';
/** User library captured before a Demo Hub lesson wipes Studio. */
export const API_MOCK_USER_STASH_KEY = 'api-mock-workspace-v1-demo-stash';
/** Lesson-only workspace. Never overwrite `API_MOCK_STORAGE_KEY` while a demo is live. */
export const API_MOCK_DEMO_SESSION_KEY = 'api-mock-workspace-v1-demo-session';

type ApiMockPersistMode = 'user' | 'demo';
let persistMode: ApiMockPersistMode = 'user';
const demoImportedServerIds = new Set<string>();
const demoUserLibraryIds = new Set<string>();

export function isApiMockDemoPersistenceActive(): boolean {
  return persistMode === 'demo';
}

/** Gallery / blank servers the lesson imported — dropped on Exit, not user-created mocks. */
export function rememberApiMockDemoImportedServer(id: string): void {
  demoImportedServerIds.add(id);
}

export function clearApiMockDemoImportedServers(): void {
  demoImportedServerIds.clear();
}

function captureDemoUserLibraryIds(state: { servers: Array<{ id: string }> } | null): void {
  demoUserLibraryIds.clear();
  for (const server of state?.servers ?? []) demoUserLibraryIds.add(server.id);
}

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
  const key = persistMode === 'demo' ? API_MOCK_DEMO_SESSION_KEY : API_MOCK_STORAGE_KEY;
  let raw: string | null;
  try {
    raw = await readKey(key);
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
  persistMode = 'user';
  demoImportedServerIds.clear();
  demoUserLibraryIds.clear();
}

function parsePersistedState(raw: string): ApiMockPersistedState | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.servers)) {
      return snapshotFrom({
        servers: parsed.servers as ApiMockPersistedState['servers'],
        activeServerId: parsed.activeServerId as string | undefined,
        openTabIds: parsed.openTabIds as string[] | undefined,
      });
    }
    if ('servers' in parsed) return null;
  } catch {
    return null;
  }
  const fromWorkspace = safeLoadWorkspace(raw);
  if (fromWorkspace.workspace) {
    return snapshotFrom({
      servers: fromWorkspace.workspace.servers,
      activeServerId: fromWorkspace.workspace.activeServerId,
      openTabIds: fromWorkspace.workspace.openTabIds,
    });
  }
  return null;
}

function hasStashRaw(raw: string | null): boolean {
  return raw != null && raw !== '';
}

async function readPersistedStateFromKey(key: string): Promise<ApiMockPersistedState | null> {
  const raw = await readKey(key);
  if (!hasStashRaw(raw) || !raw) return null;
  return parsePersistedState(raw);
}

/**
 * Seed the live demo workspace once. Never overlay the frozen stash on top of
 * a library the user already edited (deletes must survive Restart).
 *
 * Priority: in-memory snapshot → demo session on disk → pre-demo stash.
 */
async function seedLiveDemoWorkspace(): Promise<void> {
  if (workspaceSnapshot != null) return;
  const session = await readPersistedStateFromKey(API_MOCK_DEMO_SESSION_KEY);
  if (session) {
    workspaceSnapshot = snapshotFrom(session);
    return;
  }
  const stashed = await readPersistedStateFromKey(API_MOCK_USER_STASH_KEY);
  if (stashed) workspaceSnapshot = snapshotFrom(stashed);
}

/** Keep the stashed user library in sync with live edits (create, rename, folder, delete). */
async function syncStashWithLiveLibrary(live: ApiMockPersistedState): Promise<void> {
  const stashed = await readPersistedStateFromKey(API_MOCK_USER_STASH_KEY);
  if (!stashed) return;
  const next = stripDemoImportedServers(live);
  if (JSON.stringify(snapshotFrom(stashed)) === JSON.stringify(next)) return;
  try {
    await writeKey(API_MOCK_USER_STASH_KEY, JSON.stringify(next), { notifyOnQuotaExhausted: false });
  } catch {
    /* best effort */
  }
}

/** Drop lesson gallery/blank imports and tour `Demo Mock Server` artifacts. Keep the user's library. */
function stripDemoImportedServers(live: ApiMockPersistedState): ApiMockPersistedState {
  const servers = live.servers.filter(s => !isApiMockDemoLessonServer(
    s,
    demoImportedServerIds,
    demoUserLibraryIds,
  ));
  const ids = new Set(servers.map(s => s.id));
  const openTabIds = (live.openTabIds ?? live.servers.map(s => s.id)).filter(id => ids.has(id));
  const activeServerId = live.activeServerId && ids.has(live.activeServerId)
    ? live.activeServerId
    : undefined;
  return snapshotFrom({ servers, openTabIds, activeServerId });
}

/** Restart / prepare: park tabs after removing Demo lesson servers. */
export function dropApiMockDemoLessonServers(live: ApiMockPersistedState): ApiMockPersistedState {
  return stripDemoImportedServers(live);
}

/**
 * Freeze the user library on its own storage key and divert lesson writes
 * to a demo session key. Safe to call more than once in the same lesson.
 */
export async function beginApiMockDemoPersistence(): Promise<boolean> {
  try {
    if (persistMode !== 'demo') {
      clearApiMockDemoImportedServers();
      const existing = await readKey(API_MOCK_USER_STASH_KEY);
      if (!hasStashRaw(existing)) {
        const fromDisk = await readPersistedStateFromKey(API_MOCK_STORAGE_KEY);
        const fromMemory = workspaceSnapshot && workspaceSnapshot.servers.length > 0
          ? snapshotFrom(workspaceSnapshot)
          : null;
        const toStash = (fromDisk && fromDisk.servers.length > 0)
          ? fromDisk
          : (fromMemory ?? fromDisk ?? { servers: [] as ApiMockServerDefinitionV1[] });
        const frozen = snapshotFrom(toStash);
        await writeKey(API_MOCK_USER_STASH_KEY, JSON.stringify(frozen), {
          notifyOnQuotaExhausted: false,
        });
        captureDemoUserLibraryIds(frozen);
      } else {
        captureDemoUserLibraryIds(await readPersistedStateFromKey(API_MOCK_USER_STASH_KEY));
      }
      persistMode = 'demo';
    }
    await seedLiveDemoWorkspace();
    return true;
  } catch {
    return false;
  }
}

/** After reload, keep writing the lesson session key when a stash is still on disk. */
export async function resumeApiMockDemoPersistenceIfNeeded(): Promise<boolean> {
  try {
    if (persistMode !== 'demo') {
      const existing = await readKey(API_MOCK_USER_STASH_KEY);
      if (!hasStashRaw(existing)) return false;
      persistMode = 'demo';
      captureDemoUserLibraryIds(await readPersistedStateFromKey(API_MOCK_USER_STASH_KEY));
    }
    await seedLiveDemoWorkspace();
    return persistMode === 'demo';
  } catch {
    return false;
  }
}

/** @deprecated Use `beginApiMockDemoPersistence` — kept so existing lesson wipe paths stay a one-liner. */
export async function stashApiMockUserWorkspaceIfNeeded(): Promise<boolean> {
  return beginApiMockDemoPersistence();
}

/** Put the pre-demo library back and drop the lesson session. No-op when nothing was captured. */
export async function restoreApiMockUserWorkspace(): Promise<boolean> {
  try {
    const live = workspaceSnapshot;
    const fromSession = await readPersistedStateFromKey(API_MOCK_DEMO_SESSION_KEY);
    persistMode = 'user';
    const fromStash = await readPersistedStateFromKey(API_MOCK_USER_STASH_KEY);
    workspaceSnapshot = null;
    const fromDisk = await readPersistedStateFromKey(API_MOCK_STORAGE_KEY);
    const liveLibrary = live ?? fromSession;
    let restored: ApiMockPersistedState | null;
    if (live != null) {
      restored = stripDemoImportedServers(live);
    } else if (liveLibrary) {
      restored = stripDemoImportedServers(liveLibrary);
    } else {
      restored = (fromStash && fromStash.servers.length > 0)
        ? fromStash
        : (fromDisk && fromDisk.servers.length > 0)
          ? fromDisk
          : (fromStash ?? fromDisk);
    }
    await removeKey(API_MOCK_USER_STASH_KEY);
    await removeKey(API_MOCK_DEMO_SESSION_KEY);
    clearApiMockDemoImportedServers();
    demoUserLibraryIds.clear();
    if (!restored) return false;
    await saveApiMockWorkspace(restored);
    return true;
  } catch {
    persistMode = 'user';
    demoUserLibraryIds.clear();
    return false;
  }
}

export async function saveApiMockWorkspace(
  state: ApiMockPersistedState,
  opts?: { persistAs?: ApiMockPersistMode },
): Promise<void> {
  const mode = opts?.persistAs ?? persistMode;
  const openTabIds = state.openTabIds ?? state.servers.map(s => s.id);
  const workspace: ApiMockWorkspaceV1 = {
    schemaVersion: CURRENT_SCHEMA_VERSION as 1,
    activeServerId: state.activeServerId,
    servers: state.servers,
    // `tabOrder` stays the open-tab order so older builds and the CLI keep working.
    tabOrder: openTabIds,
    openTabIds,
  };
  // A timer started during the lesson must not replace the restored user snapshot.
  if (mode === 'demo' && persistMode === 'user') {
    try {
      await writeKey(API_MOCK_DEMO_SESSION_KEY, JSON.stringify(workspace), { notifyOnQuotaExhausted: false });
      await syncStashWithLiveLibrary({ servers: state.servers, activeServerId: state.activeServerId, openTabIds });
    } catch {
      // Best effort: a failed write must not break the editing session.
    }
    return;
  }
  publishApiMockWorkspace({
    servers: state.servers,
    activeServerId: state.activeServerId,
    openTabIds,
  });
  try {
    const key = mode === 'demo' ? API_MOCK_DEMO_SESSION_KEY : API_MOCK_STORAGE_KEY;
    await writeKey(key, JSON.stringify(workspace), { notifyOnQuotaExhausted: false });
    if (mode === 'demo') {
      await syncStashWithLiveLibrary({ servers: state.servers, activeServerId: state.activeServerId, openTabIds });
    }
  } catch {
    // Best effort: a failed write must not break the editing session.
  }
}
