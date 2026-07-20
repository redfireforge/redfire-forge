import { useState, useCallback, useRef } from 'react';
import type {
  RequestTab,
  RequestCollection,
} from '../../../shared/types';
import { REQUEST_MAX_TABS } from '../../../shared/types/requests';
import { findRequestInCollection } from '../utils/requestTree';
import { autoSaveVersion } from '../utils/requestDefinitionVersioning';

// ─── Helpers ──────────────────────────────────────────────────────

let _tabIdCounter = 0;

function nextTabId(): string {
  return `req-tab-${++_tabIdCounter}`;
}

function syncCounterFromTabs(tabs: RequestTab[]): void {
  for (const t of tabs) {
    const m = t.id.match(/^req-tab-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > _tabIdCounter) _tabIdCounter = n;
    }
  }
}

function defaultTab(
  collectionId: string,
  requestId: string,
  label: string,
): RequestTab {
  return {
    id: nextTabId(),
    collectionId,
    requestId,
    label,
    activeSubTab: 'params',
    responseSubTab: 'preview',
    inputMode: 'builder',
  };
}

function selectNeighborId(tabs: RequestTab[], closingId: string): string | undefined {
  const idx = tabs.findIndex(t => t.id === closingId);
  if (idx < 0 || tabs.length <= 1) return undefined;
  return idx > 0 ? tabs[idx - 1].id : tabs[idx + 1].id;
}

// ─── Hook ─────────────────────────────────────────────────────────

export interface RequestTabsState {
  tabs: RequestTab[];
  activeTabId: string;
}

export type UseRequestTabsReturn = ReturnType<typeof useRequestTabs>;

/**
 * Manages the multi-tab state for the Requests workbench.
 *
 * `getCollections` is a callback that returns the current collections array
 * (avoids stale closures — caller passes `() => dataRef.current.collections`).
 *
 * `patchCollections` is a callback that applies an autoSaveVersion patch to
 * the collections array in the parent `useRequests` state.
 */
export function useRequestTabs(
  getCollections: () => RequestCollection[],
  patchCollections: (colId: string, reqId: string, patch: { definitionVersions: import('../../../shared/types').RequestDefinitionVersion[] }) => void,
) {
  const [state, setState] = useState<RequestTabsState>({
    tabs: [],
    activeTabId: '',
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Auto-save helper ────────────────────────────────────────────

  const autoSaveForRequest = useCallback((colId: string, reqId: string) => {
    const collections = getCollections();
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    const req = findRequestInCollection(col, reqId);
    if (!req) return;
    const newVersions = autoSaveVersion(req);
    if (newVersions) {
      patchCollections(colId, reqId, { definitionVersions: newVersions });
    }
  }, [getCollections, patchCollections]);

  // ── Tab operations ──────────────────────────────────────────────

  const openTab = useCallback((colId: string, reqId: string, label?: string) => {
    const { tabs, activeTabId } = stateRef.current;
    const existing = tabs.find(t => t.collectionId === colId && t.requestId === reqId);

    if (existing) {
      if (existing.id !== activeTabId) {
        const leavingTab = tabs.find(t => t.id === activeTabId);
        if (leavingTab) {
          autoSaveForRequest(leavingTab.collectionId, leavingTab.requestId);
        }
      }
      setState(prev => ({ ...prev, activeTabId: existing.id }));
      return;
    }

    if (tabs.length >= REQUEST_MAX_TABS) return;

    const leavingTab = tabs.find(t => t.id === activeTabId);
    if (leavingTab) {
      autoSaveForRequest(leavingTab.collectionId, leavingTab.requestId);
    }

    const tabLabel = label ?? 'New Request';
    setState(prev => {
      const alreadyOpen = prev.tabs.find(t => t.collectionId === colId && t.requestId === reqId);
      if (alreadyOpen) return { ...prev, activeTabId: alreadyOpen.id };
      if (prev.tabs.length >= REQUEST_MAX_TABS) return prev;
      const tab = defaultTab(colId, reqId, tabLabel);
      return { tabs: [...prev.tabs, tab], activeTabId: tab.id };
    });
  }, [autoSaveForRequest]);

  const closeTab = useCallback((tabId: string) => {
    const { tabs } = stateRef.current;
    if (tabs.length <= 1) return;

    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      autoSaveForRequest(tab.collectionId, tab.requestId);
    }

    setState(prev => {
      if (prev.tabs.length <= 1) return prev;
      const neighborId = selectNeighborId(prev.tabs, tabId);
      const nextTabs = prev.tabs.filter(t => t.id !== tabId);
      const nextActive = prev.activeTabId === tabId ? (neighborId ?? nextTabs[0]?.id ?? '') : prev.activeTabId;
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  }, [autoSaveForRequest]);

  const selectTab = useCallback((tabId: string) => {
    const { tabs, activeTabId } = stateRef.current;
    if (tabId === activeTabId) return;
    const leavingTab = tabs.find(t => t.id === activeTabId);
    if (leavingTab) {
      autoSaveForRequest(leavingTab.collectionId, leavingTab.requestId);
    }
    setState(prev => ({ ...prev, activeTabId: tabId }));
  }, [autoSaveForRequest]);

  const renameTab = useCallback((tabId: string, label: string) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.id === tabId ? { ...t, label, labelManual: true } : t,
      ),
    }));
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      if (fromIndex < 0 || fromIndex >= prev.tabs.length) return prev;
      if (toIndex < 0 || toIndex >= prev.tabs.length) return prev;
      const next = [...prev.tabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, tabs: next };
    });
  }, []);

  const duplicateTab = useCallback((tabId: string) => {
    const { tabs } = stateRef.current;
    if (tabs.length >= REQUEST_MAX_TABS) return;
    const src = tabs.find(t => t.id === tabId);
    if (!src) return;
    const newTab = defaultTab(src.collectionId, src.requestId, `${src.label} (copy)`);
    newTab.activeSubTab = src.activeSubTab;
    newTab.responseSubTab = src.responseSubTab;
    newTab.inputMode = src.inputMode;
    newTab.envId = src.envId;
    newTab.labelManual = true;
    setState(prev => {
      if (prev.tabs.length >= REQUEST_MAX_TABS) return prev;
      return { tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
    });
  }, []);

  const closeOtherTabs = useCallback((keepTabId: string) => {
    setState(prev => {
      const keepTab = prev.tabs.find(t => t.id === keepTabId);
      if (!keepTab) return prev;
      for (const t of prev.tabs) {
        if (t.id !== keepTabId) autoSaveForRequest(t.collectionId, t.requestId);
      }
      return { tabs: [keepTab], activeTabId: keepTab.id };
    });
  }, [autoSaveForRequest]);

  const closeTabsToRight = useCallback((tabId: string) => {
    setState(prev => {
      const idx = prev.tabs.findIndex(t => t.id === tabId);
      if (idx < 0 || idx >= prev.tabs.length - 1) return prev;
      const toClose = prev.tabs.slice(idx + 1);
      for (const t of toClose) autoSaveForRequest(t.collectionId, t.requestId);
      const nextTabs = prev.tabs.slice(0, idx + 1);
      const nextActive = nextTabs.some(t => t.id === prev.activeTabId) ? prev.activeTabId : tabId;
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  }, [autoSaveForRequest]);

  const updateTabUI = useCallback((
    tabId: string,
    patch: Partial<Pick<RequestTab, 'activeSubTab' | 'responseSubTab' | 'inputMode' | 'envId' | 'activeHistoryId'>>,
  ) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.id === tabId ? { ...t, ...patch } : t,
      ),
    }));
  }, []);

  const syncTabLabel = useCallback((reqId: string, name: string) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.requestId === reqId ? { ...t, label: name } : t,
      ),
    }));
  }, []);

  const removeStaleTab = useCallback((reqId: string) => {
    setState(prev => {
      const tabsToRemove = prev.tabs.filter(t => t.requestId === reqId);
      if (tabsToRemove.length === 0) return prev;

      let nextTabs = prev.tabs.filter(t => t.requestId !== reqId);
      if (nextTabs.length === 0) {
        nextTabs = [];
      }
      let nextActive = prev.activeTabId;
      if (tabsToRemove.some(t => t.id === prev.activeTabId)) {
        nextActive = nextTabs[0]?.id ?? '';
      }
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  }, []);

  const removeStaleTabsByCollection = useCallback((colId: string) => {
    setState(prev => {
      const tabsToRemove = prev.tabs.filter(t => t.collectionId === colId);
      if (tabsToRemove.length === 0) return prev;

      const nextTabs = prev.tabs.filter(t => t.collectionId !== colId);
      let nextActive = prev.activeTabId;
      if (tabsToRemove.some(t => t.id === prev.activeTabId)) {
        nextActive = nextTabs[0]?.id ?? '';
      }
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  }, []);

  const updateTabsCollectionId = useCallback((reqIds: Set<string>, newColId: string) => {
    setState(prev => {
      const changed = prev.tabs.some(t => reqIds.has(t.requestId) && t.collectionId !== newColId);
      if (!changed) return prev;
      return {
        ...prev,
        tabs: prev.tabs.map(t =>
          reqIds.has(t.requestId) ? { ...t, collectionId: newColId } : t,
        ),
      };
    });
  }, []);

  const restoreState = useCallback((restored: RequestTabsState) => {
    syncCounterFromTabs(restored.tabs);
    setState(restored);
  }, []);

  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null;

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    activeTab,
    openTab,
    closeTab,
    selectTab,
    renameTab,
    reorderTabs,
    duplicateTab,
    closeOtherTabs,
    closeTabsToRight,
    updateTabUI,
    syncTabLabel,
    removeStaleTab,
    removeStaleTabsByCollection,
    updateTabsCollectionId,
    setState: restoreState,
  };
}
