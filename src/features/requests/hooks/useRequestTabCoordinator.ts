import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RequestDefinitionVersion, RequestItem } from '../../../shared/types';
import type { UseRequestsReturn } from './useRequests';
import { useRequestTabs } from './useRequestTabs';
import { scheduleSave, flushSave, loadPersistedTabs, migrateFromLegacySelection } from './useRequestTabPersistence';
import { pruneResponseCache, pruneResponseCacheMany } from './useResponseCache';
import { collectAllRequests, collectAllRequestsFromCollection, findFolderDeep, findRequestInCollection } from '../utils/requestTree';

/**
 * Coordinates the tab state hook with persistence, deletion side-effects,
 * and sidebar selection sync.
 *
 * Called once in App.tsx; the returned values are threaded to both
 * `Requests.tsx` (tab bar + editor) and `AppSidebarRegion.tsx` (sidebar).
 */
export function useRequestTabCoordinator(wb: UseRequestsReturn) {
  const dataRef = useRef(wb.data);
  dataRef.current = wb.data;

  const wbRef = useRef(wb);
  wbRef.current = wb;

  const getCollections = useCallback(() => dataRef.current.collections, []);
  const patchCollections = useCallback(
    (colId: string, reqId: string, patch: { definitionVersions: RequestDefinitionVersion[] }) => {
      wbRef.current.updateRequest(colId, reqId, patch);
    },
    [],
  );

  const {
    tabs, activeTabId, activeTab,
    openTab, closeTab, selectTab, renameTab,
    reorderTabs, duplicateTab, closeOtherTabs, closeTabsToRight,
    updateTabUI, syncTabLabel,
    removeStaleTab, removeStaleTabsByCollection, updateTabsCollectionId,
    setState: restoreTabState,
  } = useRequestTabs(getCollections, patchCollections);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // ─── Persistence: restore on mount ─────────────────────────────

  const restoredRef = useRef(false);
  useEffect(() => {
    if (!wb.loaded || restoredRef.current) return;
    restoredRef.current = true;

    void loadPersistedTabs(wb.data.collections).then((loaded) => {
      if (loaded) {
        restoreTabState(loaded);
        return;
      }
      const migrated = migrateFromLegacySelection(
        {
          selectedCollectionId: wb.data.selectedCollectionId,
          selectedRequestId: wb.data.selectedRequestId,
          selectedEnvId: wb.data.selectedEnvId,
        },
        wb.data.collections,
      );
      if (migrated) {
        restoreTabState(migrated);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wb.loaded]);

  // ─── Persistence: save on change (debounced) ───────────────────

  const prevTabSnapshotRef = useRef<string>('');
  useEffect(() => {
    if (tabs.length === 0) return;
    const snapshot = JSON.stringify({ tabs, activeTabId });
    if (snapshot === prevTabSnapshotRef.current) return;
    prevTabSnapshotRef.current = snapshot;
    scheduleSave({ tabs, activeTabId });
  }, [tabs, activeTabId]);

  useEffect(() => {
    const handler = () => {
      if (tabsRef.current.length > 0) {
        flushSave({ tabs: tabsRef.current, activeTabId: activeTabIdRef.current });
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ─── Prune tabs whose collection/request was removed out-of-band ──
  // (e.g. demo bridge / import replace that bypassed removeCollectionWithCleanup)
  useEffect(() => {
    if (!wb.loaded) return;
    const cols = dataRef.current.collections;
    const staleReqIds: string[] = [];
    for (const tab of tabsRef.current) {
      const col = cols.find(c => c.id === tab.collectionId);
      if (!col || !findRequestInCollection(col, tab.requestId)) {
        staleReqIds.push(tab.requestId);
      }
    }
    for (const reqId of staleReqIds) {
      removeStaleTab(reqId);
    }
  }, [wb.loaded, wb.data.collections, removeStaleTab]);

  // ─── Sync sidebar selection with active tab ────────────────────

  useEffect(() => {
    if (!activeTab) return;
    const { collectionId, requestId } = activeTab;
    const col = dataRef.current.collections.find(c => c.id === collectionId);
    if (!col || !findRequestInCollection(col, requestId)) return;
    if (dataRef.current.selectedCollectionId !== collectionId || dataRef.current.selectedRequestId !== requestId) {
      wbRef.current.selectRequest(collectionId, requestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id]);

  // ─── Auto-open tab when a new request is selected without a tab ──
  const prevSelectedReqRef = useRef(wb.data.selectedRequestId);
  useEffect(() => {
    const prev = prevSelectedReqRef.current;
    const { selectedCollectionId, selectedRequestId } = wb.data;
    prevSelectedReqRef.current = selectedRequestId;
    if (!selectedCollectionId || !selectedRequestId) return;
    if (selectedRequestId === prev) return;
    const alreadyOpen = tabsRef.current.some(
      t => t.collectionId === selectedCollectionId && t.requestId === selectedRequestId,
    );
    if (alreadyOpen) return;
    const col = dataRef.current.collections.find(c => c.id === selectedCollectionId);
    if (!col) return;
    const req = findRequestInCollection(col, selectedRequestId);
    if (!req) return;
    openTab(selectedCollectionId, selectedRequestId, req.name || req.url || 'Untitled');
  }, [wb.data.selectedRequestId, wb.data.selectedCollectionId, wb.data, openTab]);

  // ─── Deletion side-effects ─────────────────────────────────────

  const removeRequestWithCleanup = useCallback((colId: string, reqId: string) => {
    wbRef.current.removeRequest(colId, reqId);
    removeStaleTab(reqId);
    pruneResponseCache(reqId);
  }, [removeStaleTab]);

  const removeCollectionWithCleanup = useCallback((colId: string) => {
    const col = dataRef.current.collections.find(c => c.id === colId);
    const reqIds = col ? collectAllRequestsFromCollection(col).map(r => r.id) : [];
    wbRef.current.removeCollection(colId);
    removeStaleTabsByCollection(colId);
    pruneResponseCacheMany(reqIds);
  }, [removeStaleTabsByCollection]);

  const removeFolderWithCleanup = useCallback((colId: string, folderId: string) => {
    const col = dataRef.current.collections.find(c => c.id === colId);
    const folder = col ? findFolderDeep(col.folders ?? [], folderId) : null;
    const isSubCol = folder?.isSubCollection;
    const affectedReqIds = isSubCol && folder ? collectAllRequests(folder).map((r: RequestItem) => r.id) : [];

    wbRef.current.removeFolder(colId, folderId);

    if (isSubCol && affectedReqIds.length > 0) {
      for (const reqId of affectedReqIds) removeStaleTab(reqId);
      pruneResponseCacheMany(affectedReqIds);
    }
  }, [removeStaleTab]);

  // ─── Cross-collection move wrappers ────────────────────────────

  const moveRequestToCollectionWithSync = useCallback((srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => {
    wbRef.current.moveRequestToCollection(srcColId, reqId, destColId, destFolderId);
    if (srcColId !== destColId) {
      updateTabsCollectionId(new Set([reqId]), destColId);
    }
  }, [updateTabsCollectionId]);

  const moveFolderToCollectionWithSync = useCallback((srcColId: string, folderId: string, destColId: string, destParentFolderId: string | null) => {
    if (srcColId !== destColId) {
      const col = dataRef.current.collections.find(c => c.id === srcColId);
      const folder = col ? findFolderDeep(col.folders ?? [], folderId) : null;
      const reqIds = folder ? new Set(collectAllRequests(folder).map((r: RequestItem) => r.id)) : new Set<string>();
      wbRef.current.moveFolderToCollection(srcColId, folderId, destColId, destParentFolderId);
      if (reqIds.size > 0) updateTabsCollectionId(reqIds, destColId);
    } else {
      wbRef.current.moveFolderToCollection(srcColId, folderId, destColId, destParentFolderId);
    }
  }, [updateTabsCollectionId]);

  const mergeCollectionWithSync = useCallback((srcColId: string, destColId: string) => {
    const srcCol = dataRef.current.collections.find(c => c.id === srcColId);
    const reqIds = srcCol ? new Set(collectAllRequestsFromCollection(srcCol).map(r => r.id)) : new Set<string>();
    wbRef.current.moveCollectionAsSubCollection(srcColId, destColId);
    if (reqIds.size > 0) updateTabsCollectionId(reqIds, destColId);
  }, [updateTabsCollectionId]);

  // ─── Tab bar handlers ──────────────────────────────────────────

  const handleTabAdd = useCallback(() => {
    const col = wbRef.current.selectedCollection ?? dataRef.current.collections[0];
    if (!col) return;
    const firstReq = col.requests[0];
    if (firstReq) {
      openTab(col.id, firstReq.id, firstReq.name || firstReq.url || 'Untitled');
    }
  }, [openTab]);

  const handleEnvChange = useCallback((envId: string | undefined) => {
    wbRef.current.setSelectedEnvId(envId);
    const at = activeTabRef.current;
    if (at) {
      updateTabUI(at.id, { envId });
    }
  }, [updateTabUI]);

  // ─── Bidirectional tab ↔ request name sync ─────────────────────

  const handleRenameTab = useCallback((tabId: string, label: string) => {
    renameTab(tabId, label);
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (tab) {
      wbRef.current.updateRequest(tab.collectionId, tab.requestId, { name: label });
    }
  }, [renameTab]);

  // ─── Sidebar: open tab on request click ────────────────────────

  const handleSelectRequest = useCallback((colId: string, reqId: string) => {
    const col = dataRef.current.collections.find(c => c.id === colId);
    if (!col) return;
    const req = findRequestInCollection(col, reqId);
    openTab(colId, reqId, req?.name || req?.url || 'Untitled');
  }, [openTab]);

  const openTabRequestIds = useMemo(
    () => new Set(tabs.map(t => t.requestId)),
    [tabs],
  );

  return {
    tabs,
    activeTabId,
    activeTab,
    selectTab,
    closeTab,
    addTab: handleTabAdd,
    renameTab: handleRenameTab,
    reorderTabs,
    duplicateTab,
    closeOtherTabs,
    closeTabsToRight,
    envChange: handleEnvChange,
    selectRequest: handleSelectRequest,
    openTabRequestIds,
    removeRequest: removeRequestWithCleanup,
    removeCollection: removeCollectionWithCleanup,
    removeFolder: removeFolderWithCleanup,
    moveRequestToCollection: moveRequestToCollectionWithSync,
    moveFolderToCollection: moveFolderToCollectionWithSync,
    mergeCollectionInto: mergeCollectionWithSync,
    removeStaleTab,
    removeStaleTabsByCollection,
    syncTabLabel,
    updateTabUI,
  };
}

export type UseRequestTabCoordinatorReturn = ReturnType<typeof useRequestTabCoordinator>;
