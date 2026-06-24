import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlAuth, GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { deriveOperationType, extractOperations } from '../utils/monacoGraphqlSetup';
import { disposeTabModels } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import {
  resolveTabRawEndpoint,
  resolveTabLabelEndpoint,
  findProfileById,
  isTabProfileLinked,
  isTabProfileLinkPending,
  isTabAuthOverridden,
} from '../utils/tabConnectionResolution';
import { withAutoTabLabel, isAutoLabelEligible } from '../utils/tabLabelUtils';
import { clampPollingIntervalSeconds } from '../utils/pollingIntervalUtils';
import {
  type GqlStudioTab,
  advanceSeqPastRestoredIds,
  loadActiveTabId,
  loadTabs,
  makeBlankTab,
  makeDemoTab,
  saveTabs,
  SAVE_DEBOUNCE_MS,
  MAX_TABS,
  MAX_USER_TABS,
  countUserTabs,
  computeTabAuthStoredValue,
  graphqlAuthEquals,
} from '../utils/tabPersistence';
import {
  GQL_TABS_RELOAD_EVENT,
  filterTabsForPersistence,
  loadDemoSession,
  pickPersistedActiveTabId,
  purgeOrphanDemoTabs,
  type GqlDemoSession,
} from '../utils/gqlDemoWorkspace';

export interface UseGqlStudioTabsOptions {
  /** Cancel in-flight execution for the tab being closed (Phase 6E). */
  onCancelExecution: (tabId: string) => void;
  /** Returns true when the given tab has a loading execution (Phase 6E). */
  isTabExecuting?: (tabId: string) => boolean;
  /** Called to clear file entries when a tab is closed or switched. */
  onClearFileEntries: () => void;
  /** Called to reset the subscription engine on unmount. */
  onResetSubscription: () => void;
  /** Live monaco ref so tab model disposal does not cause a stale closure. */
  monacoRef: React.MutableRefObject<import('@monaco-editor/react').Monaco | null>;
  /** Page-level default endpoint (raw, before env resolution). Phase 6. */
  pageDefaultEndpoint?: string;
  /** Page-level default endpoint after env resolution — used for auto tab labels. */
  pageDefaultEndpointResolved?: string;
  /** Page-level default TLS skip setting. Phase 6. */
  pageDefaultSkipTlsVerify?: boolean;
  /** Page-level default CA / mTLS PEM fields. */
  pageDefaultTlsCaCert?: string;
  pageDefaultTlsClientCert?: string;
  pageDefaultTlsClientKey?: string;
  /** Page-level default polling enabled. Phase 6F. */
  pageDefaultPollingEnabled?: boolean;
  /** Page-level default polling interval (seconds). Phase 6F. */
  pageDefaultPollingIntervalSeconds?: number;
  /** Page-level default auth. Phase 6H. */
  pageDefaultAuth?: GraphqlAuth | null;
  /** Saved connection profiles for endpoint resolution (Phase 6F). */
  profiles?: ConnectionProfile[];
  /** True after profile catalog has loaded from storage (Phase 6F). */
  profilesReady?: boolean;
  /** Called after a tab is actually removed (not on unsaved-change confirmation prompt). Phase 6 PT-4. */
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
  /** True when connectionId resolves to a saved profile (excludes profiles-loading pending state). */
  hasResolvedProfileLink: boolean;
  hasActiveTabSkipTlsOverride: boolean;
  hasActiveTabTlsCertOverride: boolean;
  hasActiveTabPollingOverride: boolean;
  hasActiveTabAuthOverride: boolean;
  /** True while connectionId is set but profile catalog has not resolved it yet (Phase 6F). */
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
  /** Active Demo Hub lesson id when a demo session is loaded (§11.0 batch/tab isolation). */
  activeDemoLessonId: string | null;
}

/**
 * Encapsulates all tab lifecycle state for GraphqlStudioPage:
 * creation, switching, closing, persistence, and per-tab content callbacks.
 */
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
      // Demo Hub may write demo tabs to storage before React reload applies them.
      // Skip persist until the in-memory tab list includes the session demo tab.
      if (session?.demoTabId && !tabsRef.current.some((t) => t.id === session.demoTabId)) {
        return;
      }
      const filtered = filterTabsForPersistence(tabsRef.current, session);
      const activeId = pickPersistedActiveTabId(filtered, activeTabIdRef.current);
      await saveTabs(filtered, activeId);
    })();
  }, []);

  // ── Restore from storage on mount ──────────────────────────────────────────
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
      const activeExists = tabsToUse.some((t) => t.id === savedActiveId);
      setTabs(tabsToUse);
      setActiveTabId(activeExists ? savedActiveId : tabsToUse[0]!.id);
      onClearFileEntriesRef.current();
      if (filtered.length !== normalized.length) {
        void saveTabs(
          tabsToUse,
          activeExists ? savedActiveId : tabsToUse[0]!.id,
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

  // ── Flush on unmount ────────────────────────────────────────────────────────
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

  // ── Persist on change ───────────────────────────────────────────────────────
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

  // ── Tab CRUD ────────────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    const session = demoSessionRef.current;
    if (session) {
      const budget = Math.max(1, session.tabBudget ?? 1);
      const demoCount = tabs.filter((t) => t.demoLessonId === session.lessonId).length;
      if (demoCount < budget && tabs.length < MAX_TABS) {
        const suffix = demoCount + 1;
        const base = session.displayName ?? `Demo: ${session.lessonId}`;
        const label = budget > 1 && suffix > 1 ? `${base} — ${suffix}` : base;
        const tab = makeDemoTab(session.lessonId, label);
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmingCloseTabId(null);
        return;
      }
    }

    if (countUserTabs(tabs) >= MAX_USER_TABS || tabs.length >= MAX_TABS) return;
    const tab = makeBlankTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingCloseTabId(null);
  }, [tabs]);

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

  // ── Expose a stable ref for keyboard shortcut "close active tab" ────────────
  const closeActiveTabRef = useRef<() => void>(() => {});
  closeActiveTabRef.current = () => {
    const tid = activeTabIdRef.current;
    if (tid) closeTab(tid, { stopPropagation: () => {} } as React.MouseEvent);
  };

  // ── Per-tab content updaters ─────────────────────────────────────────────────
  const updateActiveTab = useCallback(
    (patch: Partial<GqlStudioTab>) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current ? { ...t, ...patch, unsavedChanges: true } : t,
        ),
      );
    },
    [],
  );

  const relabelTab = useCallback(
    (tab: GqlStudioTab): GqlStudioTab => {
      if (!isAutoLabelEligible(tab)) return tab;
      const profile = findProfileById(profiles, tab.connectionId);
      const labelEndpoint = resolveTabLabelEndpoint(
        tab,
        profiles,
        pageDefaultEndpoint,
        pageDefaultEndpointResolved,
      );
      return withAutoTabLabel(tab, profile?.name ?? null, labelEndpoint);
    },
    [profiles, pageDefaultEndpoint, pageDefaultEndpointResolved],
  );

  const clearActiveTabEndpoint = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.endpoint === undefined && t.connectionId === undefined) return t;
        return relabelTab({
          ...t,
          endpoint: undefined,
          connectionId: undefined,
          unsavedChanges: true,
        });
      }),
    );
  }, [relabelTab]);

  const updateActiveTabEndpoint = useCallback((endpoint: string) => {
    const trimmed = endpoint.trim();
    const pageDefault = pageDefaultEndpoint.trim();
    const nextEndpoint = !trimmed || trimmed === pageDefault ? undefined : trimmed;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.endpoint === nextEndpoint && t.connectionId === undefined) return t;
        return relabelTab({
          ...t,
          endpoint: nextEndpoint,
          connectionId: undefined,
          unsavedChanges: true,
        });
      }),
    );
  }, [pageDefaultEndpoint, relabelTab]);

  const applyProfileToActiveTab = useCallback((profile: ConnectionProfile) => {
    const trimmed = profile.endpoint.trim();
    // Always persist profile URL on the tab (even when it matches the page default) so
    // restored tabs resolve correctly before the profile catalog finishes loading.
    const nextEndpoint = trimmed || undefined;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (
          t.connectionId === profile.id
          && t.endpoint === nextEndpoint
          && !isTabAuthOverridden(t)
        ) {
          return t;
        }
        const { auth: _auth, ...base } = t;
        return relabelTab({
          ...base,
          connectionId: profile.id,
          endpoint: nextEndpoint,
          unsavedChanges: true,
        });
      }),
    );
  }, [relabelTab]);

  const clearConnectionIdsForProfile = useCallback((profileId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.connectionId === profileId
          ? { ...t, connectionId: undefined, unsavedChanges: true }
          : t,
      ),
    );
  }, []);

  const clearActiveTabProfileLink = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current || t.connectionId === undefined) return t;
        return relabelTab({ ...t, connectionId: undefined, unsavedChanges: true });
      }),
    );
  }, [relabelTab]);

  // Phase 6F — drop stale profile links and refresh auto labels once profiles load.
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

  // Relabel tabs when page-level default endpoint changes (e.g. tab 1 inheriting page URL).
  useEffect(() => {
    if (!storageHydrated) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        const updated = relabelTab(t);
        if (updated !== t) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [pageDefaultEndpoint, pageDefaultEndpointResolved, storageHydrated, relabelTab]);

  const updateActiveTabSkipTlsVerify = useCallback((skip: boolean) => {
    const nextSkip = skip === pageDefaultSkipTlsVerify ? undefined : skip;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.skipTlsVerify === nextSkip) return t;
        return { ...t, skipTlsVerify: nextSkip, unsavedChanges: true };
      }),
    );
  }, [pageDefaultSkipTlsVerify]);

  const updateActiveTabTlsSettings = useCallback((patch: Partial<GqlTlsSettings>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        let next = t;
        if (patch.skipTlsVerify !== undefined) {
          const nextSkip = patch.skipTlsVerify === pageDefaultSkipTlsVerify ? undefined : patch.skipTlsVerify;
          if (next.skipTlsVerify !== nextSkip) {
            next = { ...next, skipTlsVerify: nextSkip };
          }
        }
        if ('caCert' in patch) {
          const nextCa = patch.caCert || undefined;
          const inherited = nextCa === (pageDefaultTlsCaCert || undefined);
          const tabCa = inherited ? undefined : nextCa;
          if (next.tlsCaCert !== tabCa) {
            next = { ...next, tlsCaCert: tabCa };
          }
        }
        if ('clientCert' in patch) {
          const nextCert = patch.clientCert || undefined;
          const inherited = nextCert === (pageDefaultTlsClientCert || undefined);
          const tabCert = inherited ? undefined : nextCert;
          if (next.tlsClientCert !== tabCert) {
            next = { ...next, tlsClientCert: tabCert };
          }
        }
        if ('clientKey' in patch) {
          const nextKey = patch.clientKey || undefined;
          const inherited = nextKey === (pageDefaultTlsClientKey || undefined);
          const tabKey = inherited ? undefined : nextKey;
          if (next.tlsClientKey !== tabKey) {
            next = { ...next, tlsClientKey: tabKey };
          }
        }
        if (next === t) return t;
        return { ...next, unsavedChanges: true };
      }),
    );
  }, [pageDefaultSkipTlsVerify, pageDefaultTlsCaCert, pageDefaultTlsClientCert, pageDefaultTlsClientKey]);

  const updateActiveTabPolling = useCallback((enabled: boolean, intervalSeconds: number) => {
    const clamped = clampPollingIntervalSeconds(intervalSeconds);
    const nextEnabled = enabled === pageDefaultPollingEnabled ? undefined : enabled;
    const nextInterval = clamped === pageDefaultPollingIntervalSeconds ? undefined : clamped;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.pollingEnabled === nextEnabled && t.pollingIntervalSeconds === nextInterval) return t;
        return {
          ...t,
          pollingEnabled: nextEnabled,
          pollingIntervalSeconds: nextInterval,
          unsavedChanges: true,
        };
      }),
    );
  }, [pageDefaultPollingEnabled, pageDefaultPollingIntervalSeconds]);

  const clearActiveTabPolling = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.pollingEnabled === undefined && t.pollingIntervalSeconds === undefined) return t;
        return {
          ...t,
          pollingEnabled: undefined,
          pollingIntervalSeconds: undefined,
          unsavedChanges: true,
        };
      }),
    );
  }, []);

  const updateActiveTabAuth = useCallback((
    newAuth: GraphqlAuth | null,
    options?: { clearProfileLink?: boolean },
  ) => {
    const nextStored = computeTabAuthStoredValue(newAuth, pageDefaultAuth);
    const shouldClearProfileLink = options?.clearProfileLink && nextStored !== undefined;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;

        let next = t;
        if (shouldClearProfileLink && t.connectionId !== undefined) {
          next = relabelTab({ ...next, connectionId: undefined });
        }

        if (nextStored === undefined) {
          if (next.auth === undefined) {
            return next === t ? next : { ...next, unsavedChanges: true };
          }
          const { auth: _auth, ...rest } = next;
          return { ...rest, unsavedChanges: true };
        }

        if (graphqlAuthEquals(next.auth, nextStored)) {
          return next === t ? next : { ...next, unsavedChanges: true };
        }

        return { ...next, auth: nextStored, unsavedChanges: true };
      }),
    );
  }, [pageDefaultAuth, relabelTab]);

  const clearActiveTabAuth = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.auth === undefined) return t;
        const { auth: _auth, ...rest } = t;
        return { ...rest, unsavedChanges: true };
      }),
    );
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      const operationType = deriveOperationType(value);
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabIdRef.current) return t;
          const nextTab = { ...t, query: value, operationType, unsavedChanges: true };
          return relabelTab(nextTab);
        }),
      );
    },
    [relabelTab],
  );

  const handleVariablesChange = useCallback(
    (value: string) => updateActiveTab({ variables: value }),
    [updateActiveTab],
  );

  const handleHeadersChange = useCallback(
    (headers: GqlStudioTab['headers']) => updateActiveTab({ headers }),
    [updateActiveTab],
  );

  const handleAssertionsChange = useCallback(
    (assertions: GraphqlSubscriptionAssertion[]) => updateActiveTab({ subscriptionAssertions: assertions }),
    [updateActiveTab],
  );

  const handleSubscriptionTransportChange = useCallback(
    (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabIdRef.current ? { ...tab, subscriptionTransport: t } : tab,
        ),
      );
    },
    [],
  );

  // ── Derived tab state ───────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const resolvedTabEndpoint = useMemo(() => {
    if (!activeTab) return pageDefaultEndpoint;
    return resolveTabRawEndpoint(activeTab, profiles, pageDefaultEndpoint);
  }, [activeTab, profiles, pageDefaultEndpoint]);
  const hasActiveTabEndpointOverride = activeTab?.endpoint !== undefined;
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

  const handleSelectOperation = useCallback(
    (name: string) => updateActiveTab({ selectedOperation: name }),
    [updateActiveTab],
  );

  // Sync selectedOperation when query operations change
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
    updateActiveTab,
    updateActiveTabEndpoint,
    clearActiveTabEndpoint,
    updateActiveTabSkipTlsVerify,
    updateActiveTabTlsSettings,
    updateActiveTabPolling,
    clearActiveTabPolling,
    updateActiveTabAuth,
    clearActiveTabAuth,
    resolvedTabEndpoint,
    hasActiveTabEndpointOverride,
    hasActiveTabProfileLink,
    hasResolvedProfileLink,
    hasActiveTabSkipTlsOverride,
    hasActiveTabTlsCertOverride,
    hasActiveTabPollingOverride,
    hasActiveTabAuthOverride,
    hasPendingProfileEndpoint,
    applyProfileToActiveTab,
    clearConnectionIdsForProfile,
    clearActiveTabProfileLink,
    handleSelectOperation,
    handleQueryChange,
    handleVariablesChange,
    handleHeadersChange,
    handleAssertionsChange,
    handleSubscriptionTransportChange,
    activeDemoLessonId,
  };
}
