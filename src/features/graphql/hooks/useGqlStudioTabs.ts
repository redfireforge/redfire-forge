import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import { deriveOperationType, deriveTabLabel, extractOperations } from '../utils/monacoGraphqlSetup';
import { disposeTabModels } from '../utils/tabPersistence';
import {
  type GqlStudioTab,
  advanceSeqPastRestoredIds,
  loadActiveTabId,
  loadTabs,
  makeBlankTab,
  saveTabs,
  SAVE_DEBOUNCE_MS,
} from '../utils/tabPersistence';

export interface UseGqlStudioTabsOptions {
  /** Called to cancel an in-flight execution when a tab with an executing request is closed. */
  onCancelExecution: () => void;
  /** Whether execution is currently in progress. */
  executing: boolean;
  /** The Monaco URI of the model currently being executed (used to match the right tab on close). */
  responseModelUriRef: React.MutableRefObject<string>;
  /** Called to clear file entries when a tab is closed or switched. */
  onClearFileEntries: () => void;
  /** Called to reset the subscription engine on unmount. */
  onResetSubscription: () => void;
  /** Live monaco ref so tab model disposal does not cause a stale closure. */
  monacoRef: React.MutableRefObject<import('@monaco-editor/react').Monaco | null>;
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
  updateActiveTab:        (patch: Partial<GqlStudioTab>) => void;
  handleSelectOperation:  (name: string) => void;
  handleQueryChange:      (value: string) => void;
  handleVariablesChange:  (value: string) => void;
  handleHeadersChange:    (headers: GqlStudioTab['headers']) => void;
  handleAssertionsChange: (assertions: GraphqlSubscriptionAssertion[]) => void;
  handleSubscriptionTransportChange: (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => void;
}

/**
 * Encapsulates all tab lifecycle state for GraphqlStudioPage:
 * creation, switching, closing, persistence, and per-tab content callbacks.
 */
export function useGqlStudioTabs({
  onCancelExecution,
  executing,
  responseModelUriRef,
  onClearFileEntries,
  onResetSubscription,
  monacoRef,
}: UseGqlStudioTabsOptions): UseGqlStudioTabsResult {
  const [tabs, setTabs]                               = useState<GqlStudioTab[]>([]);
  const [activeTabId, setActiveTabId]                 = useState('');
  const [confirmingCloseTabId, setConfirmingCloseTabId] = useState<string | null>(null);

  const confirmTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef        = useRef(false);

  const tabsRef         = useRef(tabs);
  const activeTabIdRef  = useRef(activeTabId);
  tabsRef.current       = tabs;
  activeTabIdRef.current = activeTabId;

  const executingRef    = useRef(executing);
  executingRef.current  = executing;

  const cancelForCloseRef       = useRef(onCancelExecution);
  cancelForCloseRef.current     = onCancelExecution;
  const subscriptionResetRef    = useRef(onResetSubscription);
  subscriptionResetRef.current  = onResetSubscription;

  // ── Restore from storage on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const stored = await loadTabs();
      if (stored.length > 0) {
        advanceSeqPastRestoredIds(stored);
        const savedActiveId = await loadActiveTabId();
        const activeExists = stored.some((t) => t.id === savedActiveId);
        setTabs(stored);
        setActiveTabId(activeExists ? savedActiveId : stored[0].id);
      } else {
        const blank = makeBlankTab();
        setTabs([blank]);
        setActiveTabId(blank.id);
      }
      loadedRef.current = true;
    })();
  }, []);

  // ── Flush on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      subscriptionResetRef.current();
      if (loadedRef.current && tabsRef.current.length > 0) {
        saveTabs(tabsRef.current, activeTabIdRef.current);
      }
    };
  }, []);

  // ── Persist on change ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return;
    if (tabs.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTabs(tabs, activeTabId);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tabs, activeTabId]);

  // ── Tab CRUD ────────────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (tabs.length >= 8) return;
    const tab = makeBlankTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingCloseTabId(null);
  }, [tabs.length]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    onClearFileEntries();
    if (confirmingCloseTabId && confirmingCloseTabId !== tabId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingCloseTabId(null);
    }
  }, [confirmingCloseTabId, onClearFileEntries]);

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
      if (closedTab && responseModelUriRef.current === closedTab.modelUri && executingRef.current) {
        cancelForCloseRef.current();
      }

      const mc = monacoRef.current;
      if (mc && closedTab) disposeTabModels(mc as Parameters<typeof disposeTabModels>[0], closedTab);

      if (activeTabIdRef.current === tabId) {
        onClearFileEntries();
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
    [tabs, confirmingCloseTabId, responseModelUriRef, monacoRef, onClearFileEntries],
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

  const handleQueryChange = useCallback(
    (value: string) => {
      const label = deriveTabLabel(value);
      const operationType = deriveOperationType(value);
      updateActiveTab({ query: value, label, operationType });
    },
    [updateActiveTab],
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
    updateActiveTab,
    handleSelectOperation,
    handleQueryChange,
    handleVariablesChange,
    handleHeadersChange,
    handleAssertionsChange,
    handleSubscriptionTransportChange,
  };
}
