/**
 * API Mock Studio — saved-server library.
 *
 * The workspace holds two layers: `servers` is the durable library of every
 * saved mock server, and `openTabIds` is the (max 8) subset currently open as
 * tabs. Closing a tab only parks the server — deleting is a separate, confirmed
 * action with a 5-second undo. All functions here are pure.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { HARD_CEILINGS } from '@shared/api-mock/defaults';

/** Same ceiling as `API_MOCK_MAX_TABS`; read from defaults to keep this module dependency-free. */
const API_MOCK_MAX_TABS = HARD_CEILINGS.maxOpenTabs;

/** A saved server plus the counts the library list renders. */
export interface ApiMockLibraryEntry {
  server: ApiMockServerDefinitionV1;
  open: boolean;
  ruleCount: number;
  exampleCount: number;
}

/**
 * Normalize persisted open-tab ids: drop unknown/duplicate ids and clamp to the
 * tab ceiling. `undefined` means a pre-library workspace — every server opens.
 */
export function resolveOpenTabIds(
  servers: Array<{ id: string }>,
  openTabIds: string[] | undefined,
  max = API_MOCK_MAX_TABS,
): string[] {
  const known = new Set(servers.map(s => s.id));
  const source = Array.isArray(openTabIds) ? openTabIds : servers.map(s => s.id);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of source) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
    if (next.length >= max) break;
  }
  return next;
}

/** Keep the active tab pointing at an open tab (or the first one). */
export function resolveActiveTabId(openTabIds: string[], activeServerId: string | undefined): string | undefined {
  if (activeServerId && openTabIds.includes(activeServerId)) return activeServerId;
  return openTabIds[0];
}

/** Servers rendered as tabs, in tab-bar order. */
export function selectOpenServers(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
): ApiMockServerDefinitionV1[] {
  const byId = new Map(servers.map(s => [s.id, s]));
  return openTabIds
    .map(id => byId.get(id))
    .filter((s): s is ApiMockServerDefinitionV1 => Boolean(s));
}

/** Saved servers with no open tab, most recently edited first. */
export function selectParkedServers(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
): ApiMockServerDefinitionV1[] {
  const open = new Set(openTabIds);
  return servers
    .filter(s => !open.has(s.id))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

/** Full library listing: open tabs first (tab order), then parked servers. */
export function buildLibraryEntries(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
): ApiMockLibraryEntry[] {
  const toEntry = (server: ApiMockServerDefinitionV1, open: boolean): ApiMockLibraryEntry => ({
    server,
    open,
    ruleCount: server.routes?.length ?? 0,
    exampleCount: server.samples?.length ?? 0,
  });
  return [
    ...selectOpenServers(servers, openTabIds).map(s => toEntry(s, true)),
    ...selectParkedServers(servers, openTabIds).map(s => toEntry(s, false)),
  ];
}

/** Case-insensitive search over name, port, base path, and rule paths. */
export function filterLibraryEntries(entries: ApiMockLibraryEntry[], query: string): ApiMockLibraryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(({ server }) => {
    const haystack = [
      server.name,
      String(server.port),
      server.basePath ?? '',
      ...(server.routes ?? []).map(r => `${r.name ?? ''} ${r.path?.value ?? ''}`),
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

/** "4 rules · 2 examples" — the secondary line in the library list. */
export function describeLibraryEntry(entry: ApiMockLibraryEntry): string {
  const parts = [`${entry.ruleCount} rule${entry.ruleCount === 1 ? '' : 's'}`];
  if (entry.exampleCount > 0) {
    parts.push(`${entry.exampleCount} example${entry.exampleCount === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

/** Relative "last saved" label for a library row. */
export function formatLibraryTimestamp(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return 'Saved';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Saved';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Saved just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Saved ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Saved ${days}d ago`;
  return `Saved ${new Date(then).toLocaleDateString()}`;
}

// ── Tab transitions ──────────────────────────────────────────────────

export interface TabSelectionState {
  openTabIds: string[];
  activeServerId: string | undefined;
}

/** Close tabs without touching the library; activate the nearest survivor. */
export function parkServerTabs(
  openTabIds: string[],
  activeServerId: string | undefined,
  closedIds: string[],
): TabSelectionState {
  const closed = new Set(closedIds);
  if (closed.size === 0) return { openTabIds, activeServerId };
  const activeIndex = openTabIds.indexOf(activeServerId ?? '');
  const next = openTabIds.filter(id => !closed.has(id));
  if (next.length === openTabIds.length) return { openTabIds, activeServerId };
  if (activeServerId && next.includes(activeServerId)) return { openTabIds: next, activeServerId };
  if (next.length === 0) return { openTabIds: next, activeServerId: undefined };
  if (activeIndex < 0) return { openTabIds: next, activeServerId: next[0] };
  return { openTabIds: next, activeServerId: next[Math.min(activeIndex, next.length - 1)] };
}

/** True when another tab cannot be opened without closing one first. */
export function isAtTabLimit(openTabIds: string[], max = API_MOCK_MAX_TABS): boolean {
  return openTabIds.length >= max;
}

/** Open a saved server as a tab; re-selecting an already-open server is a no-op move. */
export function openServerTab(
  openTabIds: string[],
  serverId: string,
  max = API_MOCK_MAX_TABS,
): { openTabIds: string[]; activeServerId: string; atLimit: boolean } {
  if (openTabIds.includes(serverId)) {
    return { openTabIds, activeServerId: serverId, atLimit: false };
  }
  if (isAtTabLimit(openTabIds, max)) {
    return { openTabIds, activeServerId: serverId, atLimit: true };
  }
  return { openTabIds: [...openTabIds, serverId], activeServerId: serverId, atLimit: false };
}

// ── Delete + undo ────────────────────────────────────────────────────

/** Enough state to put deleted servers back exactly where they were. */
export interface DeletedServerSnapshot {
  entries: Array<{
    server: ApiMockServerDefinitionV1;
    /** Index in the library array at delete time. */
    index: number;
    /** Index in the tab bar at delete time, or -1 when the server was parked. */
    tabIndex: number;
  }>;
  activeServerId: string | undefined;
}

export function snapshotDeletedServers(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
  activeServerId: string | undefined,
  deletedIds: string[],
): DeletedServerSnapshot {
  const wanted = new Set(deletedIds);
  const entries = servers
    .map((server, index) => ({ server, index, tabIndex: openTabIds.indexOf(server.id) }))
    .filter(entry => wanted.has(entry.server.id))
    .map(entry => ({ ...entry, server: structuredClone(entry.server) }));
  return { entries, activeServerId };
}

/** Remove servers from the library and from the tab bar. */
export function deleteServersFromLibrary(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
  activeServerId: string | undefined,
  deletedIds: string[],
): { servers: ApiMockServerDefinitionV1[]; openTabIds: string[]; activeServerId: string | undefined } {
  const deleted = new Set(deletedIds);
  if (deleted.size === 0) return { servers, openTabIds, activeServerId };
  const parked = parkServerTabs(openTabIds, activeServerId, deletedIds);
  return {
    servers: servers.filter(s => !deleted.has(s.id)),
    openTabIds: parked.openTabIds,
    activeServerId: parked.activeServerId,
  };
}

/** Undo a delete: splice the servers back into the library and the tab bar. */
export function restoreDeletedServers(
  servers: ApiMockServerDefinitionV1[],
  openTabIds: string[],
  snapshot: DeletedServerSnapshot,
  max = API_MOCK_MAX_TABS,
): { servers: ApiMockServerDefinitionV1[]; openTabIds: string[]; activeServerId: string | undefined } {
  const present = new Set(servers.map(s => s.id));
  const nextServers = [...servers];
  const nextTabs = [...openTabIds];
  for (const entry of snapshot.entries) {
    if (present.has(entry.server.id)) continue;
    nextServers.splice(Math.min(entry.index, nextServers.length), 0, entry.server);
    if (entry.tabIndex >= 0 && nextTabs.length < max) {
      nextTabs.splice(Math.min(entry.tabIndex, nextTabs.length), 0, entry.server.id);
    }
  }
  const restoredActive = snapshot.activeServerId && nextTabs.includes(snapshot.activeServerId)
    ? snapshot.activeServerId
    : nextTabs[0];
  return { servers: nextServers, openTabIds: nextTabs, activeServerId: restoredActive };
}

// ── Copy ─────────────────────────────────────────────────────────────

/** Closing is non-destructive now, so the live announcement must say where the rules went. */
export function formatParkedMessage(names: string[]): string {
  if (names.length === 1) return `${names[0]} closed — still saved in Saved servers.`;
  return `${names.length} mock servers closed — still saved in Saved servers.`;
}

export function formatOpenedFromLibraryMessage(name: string): string {
  return `${name} opened from Saved servers.`;
}

export function formatDeleteServersMessage(
  targets: Array<{ name: string; routes?: unknown[] }>,
): string {
  if (targets.length === 1) {
    const count = targets[0].routes?.length ?? 0;
    return `Delete "${targets[0].name}" and its ${count} rule${count === 1 ? '' : 's'}? This removes it from Saved servers.`;
  }
  return `Delete ${targets.length} mock servers and all of their rules? This removes them from Saved servers.`;
}

export function formatDeletedServersMessage(names: string[]): string {
  return names.length === 1 ? `${names[0]} deleted.` : `${names.length} mock servers deleted.`;
}

export function formatRestoredServersMessage(names: string[]): string {
  return names.length === 1 ? `${names[0]} restored.` : `${names.length} mock servers restored.`;
}

/** Deleting a saved server is destructive — but undoable for 5 seconds. */
export const DELETE_SERVER_CONFIRM_OPTIONS = {
  title: 'Delete mock server',
  confirmLabel: 'Delete',
  finalNote: 'Rules, examples, and settings are removed. You can undo for 5 seconds.',
} as const;
