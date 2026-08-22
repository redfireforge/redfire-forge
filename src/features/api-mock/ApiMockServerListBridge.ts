/**
 * Module-level singleton that bridges ApiMockStudioPage (which owns all server
 * state) with AppSidebarRegion (a sibling component, not a descendant).
 *
 * ApiMockStudioPage calls setApiMockServerList() whenever its derived server
 * list changes.  The left sidebar reads via useApiMockServerList(), which
 * subscribes to re-render on every change.
 */

import { useEffect, useReducer } from 'react';
import type { ApiMockRuntimeStatus } from './components/ApiMockServerTabs';

export interface ApiMockServerListEntry {
  id: string;
  name: string;
  port: number;
  /** True if the server has an open tab; false if it is parked. */
  isOpen: boolean;
  /** True if this is the currently active/selected server. */
  isActive: boolean;
  status: ApiMockRuntimeStatus;
  ruleCount: number;
  /** Sidebar folder/group this server belongs to. */
  serverFolder?: string;
}

export interface ApiMockServerListState {
  entries: ApiMockServerListEntry[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  /** Reorder the master server list by moving `fromId` to `toId`'s slot. */
  onReorder: (fromId: string, toId: string) => void;
  /** Delete a server (confirms internally). */
  onDelete: (id: string) => void;
  /** Rename a server inline. */
  onRename: (id: string, name: string) => void;
  /** Move a server to a folder (undefined = ungrouped). */
  onMoveToFolder: (id: string, folder: string | undefined) => void;
}

let _state: ApiMockServerListState | null = null;
const _listeners = new Set<() => void>();

/** Called by ApiMockStudioPage to push the latest server list. */
export function setApiMockServerList(state: ApiMockServerListState | null): void {
  _state = state;
  _listeners.forEach(fn => fn());
}

/**
 * Hook for consumers (the left sidebar) that reactively read the server list.
 * Triggers a re-render whenever setApiMockServerList() is called.
 */
export function useApiMockServerList(): ApiMockServerListState | null {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    _listeners.add(tick);
    return () => { _listeners.delete(tick); };
  }, []);
  return _state;
}
