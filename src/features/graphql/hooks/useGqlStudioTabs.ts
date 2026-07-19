import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlAuth, GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { extractOperations } from '../utils/monacoGraphqlSetup';
import { disposeTabModels } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import {
  resolveTabRawEndpoint,
  findProfileById,
  isTabProfileLinked,
  isTabProfileLinkPending,
  isTabAuthOverridden,
} from '../utils/tabConnectionResolution';
import { withAutoTabLabel } from '../utils/tabLabelUtils';
import {
  type GqlStudioTab,
  advanceSeqPastRestoredIds,
  isDemoTab,
  loadActiveTabId,
  loadTabs,
  makeBlankTab,
  makeDemoTab,
  saveTabs,
  SAVE_DEBOUNCE_MS,
  MAX_TABS,
  MAX_USER_TABS,
  countUserTabs,
} from '../utils/tabPersistence';
import {
  GQL_TABS_RELOAD_EVENT,
  filterTabsForPersistence,
  loadDemoSession,
  pickPersistedActiveTabId,
  purgeOrphanDemoTabs,
  type GqlDemoSession,
} from '../utils/gqlDemoWorkspace';
import { resolveTabLabelEndpoint } from '../utils/tabConnectionResolution';
import { useGqlTabFieldUpdaters } from './useGqlTabFieldUpdaters';
import type { GqlTabFieldPageDefaults } from './useGqlTabFieldUpdaters';

export interface UseGqlStudioTabsOptions {
  onCancelExecution: (tabId: string) => void;
  isTabExecuting?: (tabId: string) => boolean;
  onClearFileEntries: () => void;
  onResetSubscription: () => void;
  monacoRef: React.MutableRefObject<import('@monaco-editor/react').Monaco | null>;
  pageDefaultEndpoint?: string;
  pageDefaultEndpointResolved?: string;
  pageDefaultSkipTlsVerify?: boolean;
  pageDefaultTlsCaCert?: string;
  pageDefaultTlsClientCert?: string;
  pageDefaultTlsClientKey?: string;
  pageDefaultPollingEnabled?: boolean;
  pageDefaultPollingIntervalSeconds?: number;
  pageDefaultAuth?: GraphqlAuth | null;
  profiles?: ConnectionProfile[];
  profilesReady?: boolean;
  onTabClosed?: (tabId: string) => void;
}

export interface UseGqlStudioTabsResult {
  tabs:                   GqlStudioTab[];
  activeTabId:            string;
  activeTab:              GqlStudioTab | undefined;
  operations:             string[];
  selectedOperation:      string | undefined;
  confirmingCloseTabId:   string | null;
  activeTabIdRef:         React.MutableRefObject<string>;
  closeActiveTabRef:      React.MutableRefObject<() => void>;
  executingRef:           React.MutableRefObject<boolean>;
  addTab:                 () => void;
  handleTabClick:         (tabId: string) => void;
  closeTab:               (tabId: string, e: React.MouseEvent) => void;
  renameTab:              (tabId: string, label: string) => void;
  reorderTabs:            (fromIndex: number, toIndex: number) => void;
  duplicateTab:           (tabId: string) => void;
  closeOtherTabs:         (keepTabId: string) => void;
  closeTabsToRight:       (tabId: string) => void;
  updateActiveTab:        (patch: Partial<GqlStudioTab>) => void;
  updateActiveTabEndpoint: (endpoint: string) => void;
  clearActiveTabEndpoint: () => void;
  updateActiveTabSkipTlsVerify: (skip: boolean) => void;
  updateActiveTabTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
  updateActiveTabPolling: (enabled: boolean, intervalSeconds: number) => void;
  clearActiveTabPolling: () => void;
  updateActiveTabAuth: (auth: GraphqlAuth | null, options?: { clearProfileLink?: boolean }) => void;
  clearActiveTabAuth: () => void;
  resolvedTabEndpoint:    string;
  hasActiveTabEndpointOverride: boolean;
  hasActiveTabProfileLink: boolean;
  hasResolvedProfileLink: boolean;
  hasActiveTabSkipTlsOverride: boolean;
  hasActiveTabTlsCertOverride: boolean;
  hasActiveTabPollingOverride: boolean;
  hasActiveTabAuthOverride: boolean;
  hasPendingProfileEndpoint: boolean;
  applyProfileToActiveTab: (profile: ConnectionProfile) => void;
  clearConnectionIdsForProfile: (profileId: string) => void;
  clearActiveTabProfileLink: () => void;
  handleSelectOperation:  (name: string) => void;
  handleQueryChange:      (value: string) => void;
  handleVariablesChange:  (value: string) => void;
  handleHeadersChange:    (headers: GqlStudioTab['headers']) => void;
  handleAssertionsChange: (assertions: GraphqlSubscriptionAssertion[]) => void;
  handleSubscriptionTransportChange: (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => void;
  activeDemoLessonId: string | null;
}
export function useGqlStudioTabs({
  onCancelExecution,
  isTabExecuting,
  onClearFileEntries,
  onResetSubscription,
  monacoRef,
  pageDefaultEndpoint = '',
  pageDefaultEndpointResolved,
  pageDefaultSkipTlsVerify = false,
  pageDefaultTlsCaCert,
  pageDefaultTlsClientCert,
  pageDefaultTlsClientKey,
  pageDefaultPollingEnabled = false,
  pageDefaultPollingIntervalSeconds = 30,
  pageDefaultAuth = null,
  profiles = [],
  profilesReady = false,
  onTabClosed,
}: UseGqlStudioTabsOptions): UseGqlStudioTabsResult {
  const [tabs, setTabs]                               = useState<GqlStudioTab[]>([]);
  const [activeTabId, setActiveTabId]                 = useState('');
  const [confirmingCloseTabId, setConfirmingCloseTabId] = useState<string | null>(null);
  const [storageHydrated, setStorageHydrated]         = useState(false);
  const [activeDemoLessonId, setActiveDemoLessonId] = useState<string | null>(null);

  const confirmTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef        = useRef(false);

  const tabsRef         = useRef(tabs);
  const activeTabIdRef  = useRef(activeTabId);
  tabsRef.current       = tabs;
  activeTabIdRef.current = activeTabId;

  /** Synced by GraphqlStudioPage from the active tab execution handle (Phase 6E). */
  const executingRef    = useRef(false);

  const cancelForCloseRef       = useRef(onCancelExecution);
  cancelForCloseRef.current     = onCancelExecution;
  const subscriptionResetRef    = useRef(onResetSubscription);
  subscriptionResetRef.current  = onResetSubscription;
  const onTabClosedRef          = useRef(onTabClosed);
  onTabClosedRef.current        = onTabClosed;
  const onClearFileEntriesRef   = useRef(onClearFileEntries);
  onClearFileEntriesRef.current = onClearFileEntries;
  const demoSessionRef          = useRef<GqlDemoSession | null>(null);

  // ─── Field updaters (extracted hook) ───────────────────────────
  const pageDefaults: GqlTabFieldPageDefaults = useMemo(() => ({
    endpoint: pageDefaultEndpoint,
    endpointResolved: pageDefaultEndpointResolved,
    skipTlsVerify: pageDefaultSkipTlsVerify,
    tlsCaCert: pageDefaultTlsCaCert,
    tlsClientCert: pageDefaultTlsClientCert,
    tlsClientKey: pageDefaultTlsClientKey,
    pollingEnabled: pageDefaultPollingEnabled,
    pollingIntervalSeconds: pageDefaultPollingIntervalSeconds,
    auth: pageDefaultAuth,
  }), [
    pageDefaultEndpoint, pageDefaultEndpointResolved, pageDefaultSkipTlsVerify,
    pageDefaultTlsCaCert, pageDefaultTlsClientCert, pageDefaultTlsClientKey,
    pageDefaultPollingEnabled, pageDefaultPollingIntervalSeconds, pageDefaultAuth,
  ]);

  const fieldUpdaters = useGqlTabFieldUpdaters({
    setTabs,
    activeTabIdRef,
    pageDefaults,
    profiles,
    tabCount: tabs.length,
  });

  // ─── Persistence ───────────────────────────────────────────────

  const refreshDemoSession = useCallback(async () => {
    const session = await loadDemoSession();
    demoSessionRef.current = session;
    setActiveDemoLessonId(session?.lessonId ?? null);
  }, []);

  const persistTabsToStorage = useCallback(() => {
    void (async () => {
      const session = await loadDemoSession();
      demoSessionRef.current = session;
      setActiveDemoLessonId(session?.lessonId ?? null);
      if (session?.demoTabId && !tabsRef.current.some((t) => t.id === session.demoTabId)) {
        return;
      }
      const filtered = filterTabsForPersistence(tabsRef.current, session);
      const activeId = pickPersistedActiveTabId(filtered, activeTabIdRef.current);
      await saveTabs(filtered, activeId);
    })();
  }, []);

  const reloadFromStorage = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await purgeOrphanDemoTabs();
    await refreshDemoSession();
    const stored = await loadTabs();
    const session = demoSessionRef.current;
    const normalized = stored.length > 0
      ? stored.map((t) => withAutoTabLabel(t, null))
      : [];
    const filtered = filterTabsForPersistence(normalized, session);
    if (stored.length > 0) {
      advanceSeqPastRestoredIds(filtered.length > 0 ? filtered : normalized);
      const savedActiveId = await loadActiveTabId();
      const tabsToUse = filtered.length > 0 ? filtered : [makeBlankTab()];
      const inMemoryActive = activeTabIdRef.current;
      const inMemoryValid = Boolean(
        inMemoryActive && tabsToUse.some((t) => t.id === inMemoryActive),
      );
      const savedValid = tabsToUse.some((t) => t.id === savedActiveId);
      const nextActive = inMemoryValid
        ? inMemoryActive
        : savedValid
          ? savedActiveId
          : tabsToUse[0]!.id;
      setTabs(tabsToUse);
      setActiveTabId(nextActive);
      onClearFileEntriesRef.current();
      if (filtered.length !== normalized.length) {
        void saveTabs(
          tabsToUse,
          nextActive,
        );
      }
    } else {
      const blank = makeBlankTab();
      setTabs([blank]);
      setActiveTabId(blank.id);
    }
  }, [refreshDemoSession]);

  useEffect(() => {
    void (async () => {
      await reloadFromStorage();
      loadedRef.current = true;
      setStorageHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydrate
  }, []);

  useEffect(() => {
    const handler = () => { void reloadFromStorage(); };
    window.addEventListener(GQL_TABS_RELOAD_EVENT, handler);
    return () => window.removeEventListener(GQL_TABS_RELOAD_EVENT, handler);
  }, [reloadFromStorage]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      subscriptionResetRef.current();
      if (loadedRef.current && tabsRef.current.length > 0) {
        persistTabsToStorage();
      }
    };
  }, [persistTabsToStorage]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (tabs.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistTabsToStorage();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tabs, activeTabId, persistTabsToStorage]);

  const persistTabsNow = useCallback(async (nextTabs: GqlStudioTab[], nextActiveId: string) => {
    const session = await loadDemoSession();
    demoSessionRef.current = session;
    setActiveDemoLessonId(session?.lessonId ?? null);
    if (session?.demoTabId && !nextTabs.some((t) => t.id === session.demoTabId)) {
      return;
    }
    const filtered = filterTabsForPersistence(nextTabs, session);
    const activeId = pickPersistedActiveTabId(filtered, nextActiveId);
    await saveTabs(filtered, activeId);
  }, []);

  // ─── Tab lifecycle ─────────────────────────────────────────────

  const addTab = useCallback(() => {
    const session = demoSessionRef.current;
    let tab: GqlStudioTab;
    let nextTabs: GqlStudioTab[];

    if (session) {
      const budget = Math.max(1, session.tabBudget ?? 1);
      const demoCount = tabs.filter((t) => t.demoLessonId === session.lessonId).length;
      if (demoCount < budget && tabs.length < MAX_TABS) {
        const suffix = demoCount + 1;
        const base = session.displayName ?? `Demo: ${session.lessonId}`;
        const label = budget > 1 && suffix > 1 ? `${base} — ${suffix}` : base;
        tab = makeDemoTab(session.lessonId, label);
        nextTabs = [...tabs, tab];
      } else {
        if (countUserTabs(tabs) >= MAX_USER_TABS || tabs.length >= MAX_TABS) return;
        tab = makeBlankTab();
        nextTabs = [...tabs, tab];
      }
    } else {
      if (countUserTabs(tabs) >= MAX_USER_TABS || tabs.length >= MAX_TABS) return;
      tab = makeBlankTab();
      nextTabs = [...tabs, tab];
    }

    activeTabIdRef.current = tab.id;
    onClearFileEntriesRef.current();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingCloseTabId(null);
    setTabs(nextTabs);
    setActiveTabId(tab.id);

    if (loadedRef.current) {
      void persistTabsNow(nextTabs, tab.id);
    }
  }, [tabs, persistTabsNow]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    onClearFileEntries();
    if (confirmingCloseTabId && confirmingCloseTabId !== tabId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingCloseTabId(null);
    }
  }, [confirmingCloseTabId, onClearFileEntries]);

  const renameTab = useCallback((tabId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, label: trimmed, labelManual: true, unsavedChanges: true } : t,
      ),
    );
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const duplicateTab = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab || isDemoTab(tab)) return;
    if (countUserTabs(tabsRef.current) >= MAX_USER_TABS || tabsRef.current.length >= MAX_TABS) return;
    const newTab = makeBlankTab();
    const clone: GqlStudioTab = {
      ...newTab,
      label: `${tab.label} (copy)`,
      labelManual: true,
      query: tab.query,
      variables: tab.variables,
      headers: tab.headers ? [...tab.headers] : [],
      operationType: tab.operationType,
      selectedOperation: tab.selectedOperation,
      endpoint: tab.endpoint,
      connectionId: tab.connectionId,
      auth: tab.auth ? { ...tab.auth } : undefined,
      skipTlsVerify: tab.skipTlsVerify,
      tlsCaCert: tab.tlsCaCert,
      tlsClientCert: tab.tlsClientCert,
      tlsClientKey: tab.tlsClientKey,
      pollingEnabled: tab.pollingEnabled,
      pollingIntervalSeconds: tab.pollingIntervalSeconds,
      subscriptionTransport: tab.subscriptionTransport,
      subscriptionAssertions: tab.subscriptionAssertions
        ? tab.subscriptionAssertions.map((a) => ({ ...a }))
        : undefined,
      unsavedChanges: true,
    };
    let added = false;
    setTabs((prev) => {
      if (countUserTabs(prev) >= MAX_USER_TABS || prev.length >= MAX_TABS) return prev;
      added = true;
      return [...prev, clone];
    });
    if (!added) return;
    setActiveTabId(clone.id);
    onClearFileEntriesRef.current();
  }, []);

  const closeOtherTabs = useCallback((keepTabId: string) => {
    setTabs((prev) => {
      const toClose = prev.filter((t) => t.id !== keepTabId && !isDemoTab(t));
      if (toClose.length === 0) return prev;
      for (const t of toClose) {
        if (isTabExecuting?.(t.id)) cancelForCloseRef.current(t.id);
        const mc = monacoRef.current;
        if (mc) disposeTabModels(mc as Parameters<typeof disposeTabModels>[0], t);
        onTabClosedRef.current?.(t.id);
      }
      const next = prev.filter((t) => t.id === keepTabId || isDemoTab(t));
      if (!next.some((t) => t.id === activeTabIdRef.current)) {
        setActiveTabId(keepTabId);
      }
      return next;
    });
  }, [isTabExecuting, monacoRef]);

  const closeTabsToRight = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const toClose = prev.slice(idx + 1).filter((t) => !isDemoTab(t));
      if (toClose.length === 0) return prev;
      for (const t of toClose) {
        if (isTabExecuting?.(t.id)) cancelForCloseRef.current(t.id);
        const mc = monacoRef.current;
        if (mc) disposeTabModels(mc as Parameters<typeof disposeTabModels>[0], t);
        onTabClosedRef.current?.(t.id);
      }
      const toCloseIds = new Set(toClose.map((t) => t.id));
      const next = prev.filter((t) => !toCloseIds.has(t.id));
      if (!next.some((t) => t.id === activeTabIdRef.current)) {
        setActiveTabId(tabId);
      }
      return next;
    });
  }, [isTabExecuting, monacoRef]);

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.unsavedChanges && tabs.length > 1 && confirmingCloseTabId !== tabId) {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmingCloseTabId(tabId);
        confirmTimerRef.current = setTimeout(() => setConfirmingCloseTabId(null), 2500);
        return;
      }

      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingCloseTabId(null);

      const closedTab = tabs.find((t) => t.id === tabId);
      if (isTabExecuting?.(tabId)) {
        cancelForCloseRef.current(tabId);
      }

      const mc = monacoRef.current;
      if (mc && closedTab) disposeTabModels(mc as Parameters<typeof disposeTabModels>[0], closedTab);

      if (activeTabIdRef.current === tabId) {
        onClearFileEntries();
      }

      const willRemoveTab = tabs.length > 1;
      if (willRemoveTab) {
        onTabClosedRef.current?.(tabId);
      }

      setTabs((prev) => {
        if (prev.length === 1) return prev;
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabIdRef.current === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [tabs, confirmingCloseTabId, isTabExecuting, monacoRef, onClearFileEntries],
  );

  const closeActiveTabRef = useRef<() => void>(() => {});
  closeActiveTabRef.current = () => {
    const tid = activeTabIdRef.current;
    if (tid) closeTab(tid, { stopPropagation: () => {} } as React.MouseEvent);
  };

  // ─── Profile / label sync effects ─────────────────────────────

  useEffect(() => {
    if (!storageHydrated || !profilesReady) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        let tab = t;
        if (t.connectionId && !findProfileById(profiles, t.connectionId)) {
          tab = { ...tab, connectionId: undefined };
          changed = true;
        }
        const profile = findProfileById(profiles, tab.connectionId);
        const relabeled = withAutoTabLabel(
          tab,
          profile?.name ?? null,
          resolveTabLabelEndpoint(tab, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved),
        );
        if (relabeled !== tab) {
          tab = relabeled;
          changed = true;
        }
        return tab;
      });
      return changed ? next : prev;
    });
  }, [profiles, profilesReady, storageHydrated, pageDefaultEndpoint, pageDefaultEndpointResolved]);

  useEffect(() => {
    if (!storageHydrated) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        const updated = fieldUpdaters.relabelTab(t);
        if (updated !== t) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [pageDefaultEndpoint, pageDefaultEndpointResolved, storageHydrated, fieldUpdaters.relabelTab]);

  // ─── Derived state ─────────────────────────────────────────────

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const resolvedTabEndpoint = useMemo(() => {
    if (!activeTab) return pageDefaultEndpoint;
    return resolveTabRawEndpoint(activeTab, profiles, pageDefaultEndpoint);
  }, [activeTab, profiles, pageDefaultEndpoint]);
  const hasActiveTabEndpointOverride =
    activeTab?.endpoint !== undefined && activeTab.endpoint.trim() !== '';
  const hasResolvedProfileLink = activeTab
    ? isTabProfileLinked(activeTab, profiles)
    : false;
  const hasActiveTabProfileLink = activeTab
    ? Boolean(activeTab.connectionId)
      && (
        !profilesReady
        || isTabProfileLinked(activeTab, profiles)
        || isTabProfileLinkPending(activeTab, profiles)
      )
    : false;
  const hasActiveTabSkipTlsOverride = activeTab?.skipTlsVerify !== undefined;
  const hasActiveTabTlsCertOverride = activeTab
    ? activeTab.tlsCaCert !== undefined
      || activeTab.tlsClientCert !== undefined
      || activeTab.tlsClientKey !== undefined
    : false;
  const hasActiveTabPollingOverride = activeTab
    ? activeTab.pollingEnabled !== undefined || activeTab.pollingIntervalSeconds !== undefined
    : false;
  const hasActiveTabAuthOverride = activeTab ? isTabAuthOverridden(activeTab) : false;
  const hasPendingProfileEndpoint = activeTab
    ? (Boolean(activeTab.connectionId) && !profilesReady)
      || isTabProfileLinkPending(activeTab, profiles)
    : false;
  const operations = activeTab ? extractOperations(activeTab.query).map((o) => o.name) : [];

  const selectedOperation: string | undefined =
    operations.length > 1
      ? (operations.includes(activeTab?.selectedOperation ?? '') ? activeTab?.selectedOperation : operations[0])
      : undefined;

  const prevTabQueryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!activeTab || activeTab.query === prevTabQueryRef.current) return;
    prevTabQueryRef.current = activeTab.query;
    if (operations.length > 1) {
      if (!operations.includes(activeTab.selectedOperation ?? '')) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabIdRef.current ? { ...t, selectedOperation: operations[0] } : t,
          ),
        );
      }
    } else if (activeTab.selectedOperation !== undefined) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current ? { ...t, selectedOperation: undefined } : t,
        ),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.query]);

  return {
    tabs,
    activeTabId,
    activeTab,
    operations,
    selectedOperation,
    confirmingCloseTabId,
    activeTabIdRef,
    closeActiveTabRef,
    executingRef,
    addTab,
    handleTabClick,
    closeTab,
    renameTab,
    reorderTabs,
    duplicateTab,
    closeOtherTabs,
    closeTabsToRight,
    ...fieldUpdaters,
    resolvedTabEndpoint,
    hasActiveTabEndpointOverride,
    hasActiveTabProfileLink,
    hasResolvedProfileLink,
    hasActiveTabSkipTlsOverride,
    hasActiveTabTlsCertOverride,
    hasActiveTabPollingOverride,
    hasActiveTabAuthOverride,
    hasPendingProfileEndpoint,
    activeDemoLessonId,
  };
}
