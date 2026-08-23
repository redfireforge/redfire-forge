import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SseConnectionTabBar } from './SseConnectionTabBar';
import { SseConnectionTabContent, type SseConnectionTabContentHandle } from './SseConnectionTabContent';
import type { SseConnectionState, SseConnectionTab } from './sseTypes';
import { SSE_MAX_TABS, createDefaultSseTab } from './sseTypes';
import {
  deriveSseTabLabel,
  loadSseTabState,
  migrateLegacySseConfig,
  saveSseTabState,
} from './sseStorage';
import type { GlobalAuthProfile, Microservice } from '@shared/types';
import ConfirmModal from '@shared/components/ConfirmModal';
import '../../styles/sse-studio.css';

interface SseStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

let _sseTabIdCounter = 0;
function nextSseTabId(): string {
  _sseTabIdCounter++;
  return `sse-tab-${_sseTabIdCounter}`;
}
function syncCounterFromTabs(tabs: SseConnectionTab[]): void {
  let max = 0;
  for (const t of tabs) {
    const m = t.id.match(/^sse-tab-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  if (max > _sseTabIdCounter) _sseTabIdCounter = max;
}

export function SseStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
  globalAuthProfiles = [],
}: SseStudioPageProps) {
  const [tabs, setTabs] = useState<SseConnectionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [connectionStates, setConnectionStates] = useState<Record<string, SseConnectionState>>({});
  const [loaded, setLoaded] = useState(false);
  const [confirmCloseTabId, setConfirmCloseTabId] = useState<string | null>(null);

  const tabRefs = useRef<Map<string, SseConnectionTabContentHandle>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // ── Load persisted tabs (or migrate legacy) ────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let state = await loadSseTabState();
      if (!state) {
        state = await migrateLegacySseConfig();
      }
      if (cancelled) return;
      if (state && state.tabs.length > 0) {
        syncCounterFromTabs(state.tabs);
        setTabs(state.tabs);
        setActiveTabId(state.activeTabId);
      } else {
        const firstTab = createDefaultSseTab(nextSseTabId());
        setTabs([firstTab]);
        setActiveTabId(firstTab.id);
      }
      loadedRef.current = true;
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Save tabs (debounced) ──────────────────────────────────────

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSseTabState({ tabs: tabsRef.current, activeTabId: activeTabIdRef.current });
    }, 300);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tabs, activeTabId, loaded, scheduleSave]);

  // Flush on unmount — use loadedRef (not the state variable) because this
  // effect has an empty dependency array and the closure would capture the
  // initial `loaded = false` value from the first render.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (loadedRef.current) {
        saveSseTabState({ tabs: tabsRef.current, activeTabId: activeTabIdRef.current });
      }
    };
  }, []);

  // ── Tab operations ─────────────────────────────────────────────

  const handleAddTab = useCallback(() => {
    const newTab = createDefaultSseTab(nextSseTabId());
    let added = false;
    setTabs((prev) => {
      if (prev.length >= SSE_MAX_TABS) return prev;
      added = true;
      return [...prev, newTab];
    });
    if (added) setActiveTabId(newTab.id);
  }, []);

  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const doCloseTab = useCallback((id: string) => {
    const handle = tabRefs.current.get(id);
    handle?.disconnect();
    tabRefs.current.delete(id);

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fallback = createDefaultSseTab(nextSseTabId());
        setActiveTabId(fallback.id);
        return [fallback];
      }
      // Select an adjacent tab if the closed one was active
      const closedIdx = prev.findIndex((t) => t.id === id);
      setActiveTabId((prevActive) => {
        if (prevActive !== id) return prevActive;
        const nextIdx = Math.min(closedIdx, next.length - 1);
        return next[nextIdx].id;
      });
      return next;
    });

    setConnectionStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setConfirmCloseTabId(null);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    const handle = tabRefs.current.get(id);
    const state = handle?.getConnectionState();
    if (state === 'connected' || state === 'connecting') {
      setConfirmCloseTabId(id);
      return;
    }
    doCloseTab(id);
  }, [doCloseTab]);

  const handleRenameTab = useCallback((id: string, newLabel: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, label: newLabel, labelManual: true } : t)),
    );
  }, []);

  const handleReorderTab = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleDuplicateTab = useCallback((tabId: string) => {
    const src = tabsRef.current.find((t) => t.id === tabId);
    if (!src) return;
    const newTab: SseConnectionTab = {
      ...src,
      id: nextSseTabId(),
      label: src.labelManual ? `${src.label} (copy)` : src.label,
      labelManual: src.labelManual,
      headers: src.headers.map((h) => ({ ...h })),
      auth: src.auth ? { ...src.auth } : undefined,
    };
    let added = false;
    setTabs((prev) => {
      if (prev.length >= SSE_MAX_TABS) return prev;
      added = true;
      return [...prev, newTab];
    });
    if (added) setActiveTabId(newTab.id);
  }, []);

  const handleConfigChange = useCallback((tabId: string, patch: Partial<SseConnectionTab>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== tabId) return t;
        const updated = { ...t, ...patch };
        if ('url' in patch && patch.url !== t.url && !t.labelManual) {
          updated.label = deriveSseTabLabel(patch.url ?? '');
        }
        return updated;
      }),
    );
  }, []);

  const handleConnectionStateChange = useCallback((tabId: string, state: SseConnectionState) => {
    setConnectionStates((prev) => ({ ...prev, [tabId]: state }));
  }, []);

  const setTabRef = useCallback((id: string, el: SseConnectionTabContentHandle | null) => {
    if (el) tabRefs.current.set(id, el);
    else tabRefs.current.delete(id);
  }, []);

  const closeConfirmTab = useMemo(() => {
    if (!confirmCloseTabId) return null;
    return tabs.find((t) => t.id === confirmCloseTabId) ?? null;
  }, [confirmCloseTabId, tabs]);

  if (!loaded) return null;

  return (
    <div className="sse-studio" data-testid="sse-studio">
      <SseConnectionTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        connectionStates={connectionStates}
        onSelect={handleSelectTab}
        onAdd={handleAddTab}
        onClose={handleCloseTab}
        onDuplicate={handleDuplicateTab}
        onRename={handleRenameTab}
        onReorder={handleReorderTab}
      />

      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            display: tab.id === activeTabId ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}
          data-testid={`sse-conn-tab-pane-${tab.id}`}
        >
          <SseConnectionTabContent
            ref={(el) => setTabRef(tab.id, el)}
            tabId={tab.id}
            tab={tab}
            resolvedBaseUrl={resolvedBaseUrl}
            envName={envName}
            svcName={svcName}
            selectedSvc={selectedSvc}
            selectedEnvId={selectedEnvId}
            globalAuthProfiles={globalAuthProfiles}
            onConfigChange={handleConfigChange}
            onConnectionStateChange={handleConnectionStateChange}
          />
        </div>
      ))}

      {closeConfirmTab && (
        <ConfirmModal
          title="Close Active Connection"
          message={<>Tab <strong>{closeConfirmTab.label}</strong> has an active connection. Close and disconnect?</>}
          confirmLabel="Close"
          variant="danger"
          onConfirm={() => doCloseTab(closeConfirmTab.id)}
          onCancel={() => setConfirmCloseTabId(null)}
        />
      )}
    </div>
  );
}
