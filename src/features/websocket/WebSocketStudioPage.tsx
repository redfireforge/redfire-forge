import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocketProfiles } from '../../app/hooks/useWebSocketProfiles';
import { useWebSocketTemplates } from '../../app/hooks/useWebSocketTemplates';
import { useWebSocketHistory } from '../../app/hooks/useWebSocketHistory';
import {
  WsConnectionTabBar,
  type ConnectionStateHint,
  type WsConnectionTabInfo,
} from './WsConnectionTabBar';
import {
  WsConnectionTabContent,
  type WsConnectionTabContentHandle,
} from './WsConnectionTabContent';
import { buildWsEnvVarMap } from './wsMessageUtils';
import type { WsPersistedTabState, WsViewTab } from '../../shared/websocket/types';
import { loadWsTabState, saveWsTabState } from '../../shared/websocket/websocketStorage';
import '../../styles/websocket-studio.css';

const MAX_TABS = 8;

let nextTabSeq = 1;
function generateTabId(): string {
  return `ws-tab-${nextTabSeq++}`;
}

function advanceSeqPastRestoredIds(tabs: WsConnectionTabInfo[]): void {
  for (const tab of tabs) {
    const match = tab.id.match(/^ws-tab-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= nextTabSeq) nextTabSeq = num + 1;
    }
  }
}

interface WebSocketStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
}

export function WebSocketStudioPage({ resolvedBaseUrl, envName, svcName }: WebSocketStudioPageProps) {
  const [tabs, setTabs] = useState<WsConnectionTabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionStateHint>>({});
  const renamedTabIds = useRef(new Set<string>());
  const tabUrls = useRef<Record<string, string>>({});
  const tabViewTabs = useRef<Record<string, WsViewTab>>({});
  const initialUrlsRef = useRef<Record<string, string>>({});
  const initialViewTabsRef = useRef<Record<string, WsViewTab>>({});
  const [loaded, setLoaded] = useState(false);

  const tabRefs = useRef<Map<string, React.RefObject<WsConnectionTabContentHandle | null>>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const envVarMap = useMemo(
    () => buildWsEnvVarMap(resolvedBaseUrl, envName, svcName),
    [resolvedBaseUrl, envName, svcName],
  );

  const profilesHook = useWebSocketProfiles();
  const templatesHook = useWebSocketTemplates();
  const historyHook = useWebSocketHistory();

  // ── Load persisted tab state on mount ──────────────────────────────

  const createDefaultTab = useCallback(() => {
    const id = generateTabId();
    setTabs([{ id, label: 'New Connection' }]);
    setActiveTabId(id);
    setConnectionStates({ [id]: 'disconnected' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWsTabState().then((state) => {
      if (cancelled) return;
      if (state && state.tabs.length > 0) {
        const restoredTabs: WsConnectionTabInfo[] = state.tabs.map((t) => ({
          id: t.id,
          label: t.label,
          url: t.url,
        }));
        advanceSeqPastRestoredIds(restoredTabs);
        renamedTabIds.current = new Set(state.renamedTabIds);

        const connStates: Record<string, ConnectionStateHint> = {};
        const urls: Record<string, string> = {};
        const views: Record<string, WsViewTab> = {};
        const iUrls: Record<string, string> = {};
        const iViews: Record<string, WsViewTab> = {};
        for (const t of state.tabs) {
          connStates[t.id] = 'disconnected';
          urls[t.id] = t.url;
          views[t.id] = t.viewTab;
          if (t.url) iUrls[t.id] = t.url;
          iViews[t.id] = t.viewTab;
        }
        tabUrls.current = urls;
        tabViewTabs.current = views;
        initialUrlsRef.current = iUrls;
        initialViewTabsRef.current = iViews;

        setTabs(restoredTabs);
        setActiveTabId(state.activeTabId);
        setConnectionStates(connStates);
      } else {
        createDefaultTab();
      }
      setLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      createDefaultTab();
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [createDefaultTab]);

  // ── Debounced save ─────────────────────────────────────────────────

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const state: WsPersistedTabState = {
        tabs: tabsRef.current.map((t) => ({
          id: t.id,
          label: t.label,
          url: tabUrls.current[t.id] ?? '',
          viewTab: tabViewTabs.current[t.id] ?? 'connect',
        })),
        activeTabId: activeTabIdRef.current,
        renamedTabIds: Array.from(renamedTabIds.current),
      };
      saveWsTabState(state);
    }, 300);
  }, []);

  // Clean up save timer on unmount + save immediately
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (!loaded) return;
      const state: WsPersistedTabState = {
        tabs: tabsRef.current.map((t) => ({
          id: t.id,
          label: t.label,
          url: tabUrls.current[t.id] ?? '',
          viewTab: tabViewTabs.current[t.id] ?? 'connect',
        })),
        activeTabId: activeTabIdRef.current,
        renamedTabIds: Array.from(renamedTabIds.current),
      };
      saveWsTabState(state);
    };
  }, [loaded]);

  // ── Tab management ─────────────────────────────────────────────────

  const getTabRef = useCallback((id: string) => {
    let r = tabRefs.current.get(id);
    if (!r) {
      r = { current: null };
      tabRefs.current.set(id, r);
    }
    return r;
  }, []);

  const handleAddTab = useCallback(() => {
    const id = generateTabId();
    setTabs((prev) => [...prev, { id, label: 'New Connection' }]);
    setActiveTabId(id);
    setConnectionStates((prev) => ({ ...prev, [id]: 'disconnected' }));
    debouncedSave();
  }, [debouncedSave]);

  const handleAddTabWithUrl = useCallback(
    (url: string) => {
      const id = generateTabId();
      const label = deriveTabLabel(url) ?? 'New Connection';
      setTabs((prev) => [...prev, { id, label, url }]);
      setActiveTabId(id);
      setConnectionStates((prev) => ({ ...prev, [id]: 'disconnected' }));
      tabUrls.current[id] = url;
      initialUrlsRef.current[id] = url;
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) return;

      const state = connectionStates[id];
      if (state === 'connected' || state === 'connecting') {
        if (!window.confirm('This connection is active. Close and disconnect?')) return;
      }

      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        if (activeTabId === id && filtered.length > 0) {
          const oldIdx = prev.findIndex((t) => t.id === id);
          const newIdx = Math.min(oldIdx, filtered.length - 1);
          setActiveTabId(filtered[newIdx].id);
        }
        return filtered;
      });
      setConnectionStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      tabRefs.current.delete(id);
      renamedTabIds.current.delete(id);
      delete tabUrls.current[id];
      delete tabViewTabs.current[id];
      delete initialUrlsRef.current[id];
      delete initialViewTabsRef.current[id];
      debouncedSave();
    },
    [tabs.length, activeTabId, connectionStates, debouncedSave],
  );

  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
    debouncedSave();
  }, [debouncedSave]);

  const handleRenameTab = useCallback((id: string, newLabel: string) => {
    renamedTabIds.current.add(id);
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, label: newLabel } : t)),
    );
    debouncedSave();
  }, [debouncedSave]);

  const handleReorderTab = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTabs((prev) => {
        if (fromIndex < 0 || fromIndex >= prev.length) return prev;
        if (toIndex < 0 || toIndex >= prev.length) return prev;
        if (fromIndex === toIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      debouncedSave();
    },
    [debouncedSave],
  );

  const addHistoryEntry = historyHook.addEntry;
  const handleConnectionStateChange = useCallback((tabId: string, state: ConnectionStateHint) => {
    setConnectionStates((prev) => ({ ...prev, [tabId]: state }));
    if (state === 'connected') {
      const url = tabUrls.current[tabId];
      if (url) {
        addHistoryEntry(url, 'auto');
      }
    }
  }, [addHistoryEntry]);

  const handleUrlChange = useCallback(
    (tabId: string, url: string) => {
      tabUrls.current[tabId] = url;
      if (!renamedTabIds.current.has(tabId)) {
        const label = deriveTabLabel(url);
        if (label) {
          setTabs((prev) =>
            prev.map((t) => (t.id === tabId ? { ...t, label } : t)),
          );
        }
      }
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleViewTabChange = useCallback(
    (tabId: string, viewTab: WsViewTab) => {
      tabViewTabs.current[tabId] = viewTab;
      debouncedSave();
    },
    [debouncedSave],
  );

  if (!loaded) return null;

  return (
    <div className="ws-studio-page">
      <WsConnectionTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        maxTabs={MAX_TABS}
        connectionStates={connectionStates}
        onSelect={handleSelectTab}
        onAdd={handleAddTab}
        onAddWithUrl={handleAddTabWithUrl}
        onClose={handleCloseTab}
        onRename={handleRenameTab}
        onReorder={handleReorderTab}
        history={historyHook.history}
      />
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}
          data-testid={`conn-tab-pane-${tab.id}`}
        >
          <WsConnectionTabContent
            ref={getTabRef(tab.id)}
            tabId={tab.id}
            envVarMap={envVarMap}
            profilesHook={profilesHook}
            templatesHook={templatesHook}
            onConnectionStateChange={handleConnectionStateChange}
            onUrlChange={handleUrlChange}
            onViewTabChange={handleViewTabChange}
            initialUrl={initialUrlsRef.current[tab.id]}
            initialViewTab={initialViewTabsRef.current[tab.id]}
            history={historyHook.history}
            onClearHistory={historyHook.clearHistory}
          />
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function deriveTabLabel(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 6) return null;
  if (!/^wss?:\/\/.{2,}/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    if (!host || host.length < 2) return null;
    const port = parsed.port;
    return port ? `${host}:${port}` : host;
  } catch {
    const match = trimmed.match(/wss?:\/\/([^/:\s]{2,})(?::(\d+))?/);
    if (match) {
      return match[2] ? `${match[1]}:${match[2]}` : match[1];
    }
    return null;
  }
}
