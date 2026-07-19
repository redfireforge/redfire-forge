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
import { buildEnvVarMap } from '../../shared/utils/envVarUtils';
import { getRowStatus } from '../environments/utils/protocolEndpointUtils';
import type { GlobalAuthProfile, Microservice } from '../../shared/types';
import type {
  WsConnectionDraft,
  WsPersistedTabState,
  WsProtocolMode,
  WsViewTab,
  WsStudioLocation,
} from '../../shared/websocket/types';
import {
  mapViewTabToStudioLocation,
  deriveViewTabFromStudio,
} from '../../shared/websocket/types';
import { loadWsTabState, saveWsTabState } from '../../shared/websocket/websocketStorage';
import ConfirmModal from '../../shared/components/ConfirmModal';
import '../../styles/websocket-studio.css';
import '../../styles/mock-server-shared.css';

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
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

export function WebSocketStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
  globalAuthProfiles = [],
}: WebSocketStudioPageProps) {
  const [tabs, setTabs] = useState<WsConnectionTabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionStateHint>>({});
  const renamedTabIds = useRef(new Set<string>());
  const tabUrls = useRef<Record<string, string>>({});
  const tabViewTabs = useRef<Record<string, WsViewTab>>({});
  const initialUrlsRef = useRef<Record<string, string>>({});
  const initialProtocolsRef = useRef<Record<string, WsProtocolMode>>({});
  const initialDraftsRef = useRef<Record<string, Partial<WsConnectionDraft>>>({});
  const [loaded, setLoaded] = useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);

  // ── Redesigned studio shell (now the only production layout) ──────────
  const [studioLoc, setStudioLoc] = useState<Record<string, WsStudioLocation>>({});
  const studioLocRef = useRef(studioLoc);
  studioLocRef.current = studioLoc;

  const tabRefs = useRef<Map<string, React.RefObject<WsConnectionTabContentHandle | null>>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const envVarMap = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return buildEnvVarMap(selectedSvc, selectedEnvId, 'websocket', envName);
    }
    return buildWsEnvVarMap(resolvedBaseUrl, envName, svcName);
  }, [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName]);

  const endpointProtocolStatus = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return getRowStatus(selectedSvc, 'websocket', selectedEnvId);
    }
    return undefined;
  }, [selectedSvc, selectedEnvId]);

  const profilesHook = useWebSocketProfiles();
  const templatesHook = useWebSocketTemplates();
  const historyHook = useWebSocketHistory();

  // Per-tab mock server port assignment.
  // Each tab gets a unique port (9876, 9877, …) so their mock servers are isolated.
  const mockPorts = useRef<Record<string, number>>({});

  /** Returns the set of ports currently assigned to any tab. */
  const usedPorts = useCallback(() => new Set(Object.values(mockPorts.current)), []);

  /** Finds the lowest port >= 9876 not already assigned to a tab. */
  const assignNextPort = useCallback((): number => {
    const used = usedPorts();
    let p = 9876;
    while (used.has(p)) p++;
    return p;
  }, [usedPorts]);

  // ── Load persisted tab state on mount ──────────────────────────────

  const createDefaultTab = useCallback(() => {
    const id = generateTabId();
    mockPorts.current[id] = assignNextPort();
    setTabs([{ id, label: 'New Connection' }]);
    setActiveTabId(id);
    setConnectionStates({ [id]: 'disconnected' });
  }, [assignNextPort]);

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
        const iDrafts: Record<string, Partial<WsConnectionDraft>> = {};
        const locs: Record<string, WsStudioLocation> = {};
        // Assign mock ports sequentially, restoring any that were persisted.
        const assignedPorts = new Set<number>();
        for (const t of state.tabs) {
          connStates[t.id] = 'disconnected';
          urls[t.id] = t.url;
          views[t.id] = t.viewTab;
          if (t.url) iUrls[t.id] = t.url;
          iDrafts[t.id] = {
            subprotocols: t.subprotocols ?? '',
            headers: t.headers ?? [],
            queryParams: t.queryParams ?? [],
            auth: t.auth,
          };
          // loadWsTabState normalizes these, but fall back defensively.
          const derived = mapViewTabToStudioLocation(t.viewTab);
          locs[t.id] = {
            mode: t.mode ?? derived.mode,
            leftTab: t.leftTab ?? derived.leftTab,
            rightTab: t.rightTab ?? derived.rightTab,
          };
          // Restore persisted mockPort or assign a fresh one.
          if (t.mockPort && !assignedPorts.has(t.mockPort)) {
            mockPorts.current[t.id] = t.mockPort;
            assignedPorts.add(t.mockPort);
          } else {
            let p = 9876;
            while (assignedPorts.has(p)) p++;
            mockPorts.current[t.id] = p;
            assignedPorts.add(p);
          }
        }
        tabUrls.current = urls;
        tabViewTabs.current = views;
        initialUrlsRef.current = iUrls;
        initialDraftsRef.current = iDrafts;

        setTabs(restoredTabs);
        setActiveTabId(state.activeTabId);
        setConnectionStates(connStates);
        setStudioLoc(locs);
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

  // Phase 8: read the live draft fields (subprotocols/headers/queryParams/auth)
  // for whole-draft persistence. Prefer the mounted tab's current draft via its
  // imperative handle; fall back to the persisted seed for tabs that are not
  // mounted (or before they have applied their initial draft).
  const readTabDraftFields = useCallback(
    (id: string): Pick<WsConnectionDraft, 'subprotocols' | 'headers' | 'queryParams' | 'auth'> => {
      const handle = tabRefs.current.get(id)?.current;
      const draft = handle?.getDraft();
      if (draft) {
        return {
          subprotocols: draft.subprotocols,
          headers: draft.headers,
          queryParams: draft.queryParams,
          auth: draft.auth,
        };
      }
      const seed = initialDraftsRef.current[id];
      return {
        subprotocols: seed?.subprotocols ?? '',
        headers: seed?.headers ?? [],
        queryParams: seed?.queryParams ?? [],
        auth: seed?.auth,
      };
    },
    [],
  );
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const buildPersistState = useCallback((): WsPersistedTabState => {
    return {
      tabs: tabsRef.current.map((t) => {
        const loc = studioLocRef.current[t.id];
        // The studio location is the source of truth and the legacy `viewTab`
        // is kept consistent via the inverse mapping. When no location exists
        // yet (e.g. before load), `viewTab` leads and the new fields are
        // derived from it for back-compat.
        let viewTab: WsViewTab;
        let mode = loc?.mode;
        let leftTab = loc?.leftTab;
        let rightTab = loc?.rightTab;
        if (loc) {
          viewTab = deriveViewTabFromStudio(loc.mode, loc.leftTab);
        } else {
          viewTab = tabViewTabs.current[t.id] ?? 'connect';
          const derived = mapViewTabToStudioLocation(viewTab);
          mode = mode ?? derived.mode;
          leftTab = leftTab ?? derived.leftTab;
          rightTab = rightTab ?? derived.rightTab;
        }
        return {
          id: t.id,
          label: t.label,
          url: tabUrls.current[t.id] ?? '',
          viewTab,
          mode,
          leftTab,
          rightTab,
          mockPort: mockPorts.current[t.id],
          ...readTabDraftFields(t.id),
        };
      }),
      activeTabId: activeTabIdRef.current,
      renamedTabIds: Array.from(renamedTabIds.current),
    };
  }, [readTabDraftFields]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveWsTabState(buildPersistState());
    }, 300);
  }, [buildPersistState]);

  // Clean up save timer on unmount + save immediately
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (!loaded) return;
      saveWsTabState(buildPersistState());
    };
  }, [loaded, buildPersistState]);

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
    setTabs((prev) => {
      if (prev.length >= MAX_TABS) return prev;
      mockPorts.current[id] = assignNextPort();
      setActiveTabId(id);
      setConnectionStates((current) => ({ ...current, [id]: 'disconnected' }));
      debouncedSave();
      return [...prev, { id, label: 'New Connection' }];
    });
  }, [debouncedSave, assignNextPort]);

  const handleAddTabWithUrl = useCallback(
    (url: string, protocol?: WsProtocolMode) => {
      const id = generateTabId();
      const label = deriveTabLabel(url) ?? 'New Connection';
      setTabs((prev) => {
        if (prev.length >= MAX_TABS) return prev;
        mockPorts.current[id] = assignNextPort();
        setActiveTabId(id);
        setConnectionStates((current) => ({ ...current, [id]: 'disconnected' }));
        tabUrls.current[id] = url;
        initialUrlsRef.current[id] = url;
        if (protocol) initialProtocolsRef.current[id] = protocol;
        debouncedSave();
        return [...prev, { id, label, url }];
      });
    },
    [debouncedSave, assignNextPort],
  );

  const doCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((t) => t.id !== id);
        if (activeTabId === id && filtered.length > 0) {
          const oldIdx = prev.findIndex((t) => t.id === id);
          const newIdx = Math.min(oldIdx, filtered.length - 1);
          setActiveTabId(filtered[newIdx].id);
        }
        setConnectionStates((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        tabRefs.current.delete(id);
        renamedTabIds.current.delete(id);
        delete tabUrls.current[id];
        delete tabViewTabs.current[id];
        delete initialUrlsRef.current[id];
        delete initialProtocolsRef.current[id];
        delete initialDraftsRef.current[id];
        const closedPort = mockPorts.current[id];
        if (closedPort !== undefined) {
          delete mockPorts.current[id];
          void fetch('/api/ws/mock/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: closedPort }),
          }).catch(() => { /* ignore if server wasn't running */ });
        }
        setStudioLoc((current) => {
          if (!(id in current)) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
        debouncedSave();
        return filtered;
      });
    },
    [activeTabId, debouncedSave],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) return;

      const state = connectionStates[id];
      if (state === 'connected' || state === 'connecting') {
        setPendingCloseTabId(id);
        return;
      }

      doCloseTab(id);
    },
    [tabs.length, connectionStates, doCloseTab],
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

  const handleDuplicateTab = useCallback(
    (tabId: string) => {
      const srcTab = tabs.find((t) => t.id === tabId);
      if (!srcTab) return;
      if (tabs.length >= MAX_TABS) return;
      const newId = generateTabId();
      const isRenamed = renamedTabIds.current.has(tabId);
      const newLabel = isRenamed ? `${srcTab.label} (copy)` : srcTab.label;
      const newTab: WsConnectionTabInfo = { id: newId, label: newLabel, url: srcTab.url };
      setTabs((prev) => {
        if (prev.length >= MAX_TABS) return prev;
        if (isRenamed) renamedTabIds.current.add(newId);
        mockPorts.current[newId] = assignNextPort();
        const srcUrl = tabUrls.current[tabId] ?? srcTab.url ?? '';
        tabUrls.current[newId] = srcUrl;
        initialUrlsRef.current[newId] = srcUrl;
        const srcProtocol = initialProtocolsRef.current[tabId];
        if (srcProtocol) initialProtocolsRef.current[newId] = srcProtocol;
        const srcDraft = initialDraftsRef.current[tabId];
        if (srcDraft) {
          initialDraftsRef.current[newId] = {
            ...srcDraft,
            headers: srcDraft.headers ? [...srcDraft.headers] : undefined,
            queryParams: srcDraft.queryParams ? [...srcDraft.queryParams] : undefined,
            auth: srcDraft.auth ? { ...srcDraft.auth } : undefined,
          };
        }
        const srcLoc = studioLocRef.current[tabId];
        if (srcLoc) {
          setStudioLoc((current) => ({ ...current, [newId]: { ...srcLoc } }));
        }
        setActiveTabId(newId);
        setConnectionStates((current) => ({ ...current, [newId]: 'disconnected' }));
        debouncedSave();
        return [...prev, newTab];
      });
    },
    [tabs, debouncedSave, assignNextPort],
  );

  const addHistoryEntry = historyHook.addEntry;
  const handleConnectionStateChange = useCallback((tabId: string, state: ConnectionStateHint, protocolMode?: WsProtocolMode) => {
    setConnectionStates((prev) => ({ ...prev, [tabId]: state }));
    if (state === 'connected') {
      const url = tabUrls.current[tabId];
      if (url) {
        addHistoryEntry(url, protocolMode ?? 'auto');
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

  // Phase 8: a tab's draft (subprotocols/headers/queryParams/auth) changed —
  // debounce-save so the whole draft is persisted (read via the tab refs).
  const handleDraftChange = useCallback(() => {
    debouncedSave();
  }, [debouncedSave]);

  const handleMockPortChange = useCallback(
    (tabId: string, newPort: number) => {
      // Reject if the port is already assigned to a different tab.
      const currentPort = mockPorts.current[tabId];
      const otherPorts = new Set(
        Object.entries(mockPorts.current)
          .filter(([id]) => id !== tabId)
          .map(([, p]) => p),
      );
      if (otherPorts.has(newPort)) return; // port conflict — silently ignore
      mockPorts.current[tabId] = newPort;
      // If the old port had a running server, it's now orphaned on the old port.
      // We do NOT auto-stop it — the user may want it still running.
      // The tab close handler will stop newPort when the tab is eventually closed.
      if (currentPort !== undefined && currentPort !== newPort) {
        // Clean up the old port assignment so it can be reused by future tabs.
        // The server itself keeps running until the user stops it or closes the tab.
      }
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleModeChange = useCallback(
    (tabId: string, mode: WsStudioLocation['mode']) => {
      setStudioLoc((prev) => {
        const cur = prev[tabId] ?? mapViewTabToStudioLocation('connect');
        return { ...prev, [tabId]: { ...cur, mode } };
      });
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleLeftTabChange = useCallback(
    (tabId: string, leftTab: WsStudioLocation['leftTab']) => {
      setStudioLoc((prev) => {
        const cur = prev[tabId] ?? mapViewTabToStudioLocation('connect');
        return { ...prev, [tabId]: { ...cur, leftTab } };
      });
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleRightTabChange = useCallback(
    (tabId: string, rightTab: WsStudioLocation['rightTab']) => {
      setStudioLoc((prev) => {
        const cur = prev[tabId] ?? mapViewTabToStudioLocation('connect');
        return { ...prev, [tabId]: { ...cur, rightTab } };
      });
      debouncedSave();
    },
    [debouncedSave],
  );

  if (!loaded) return null;

  return (
    <div className="ws-studio-page" data-testid="ws-studio">
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
        onDuplicate={handleDuplicateTab}
        history={historyHook.history}
        onClearHistory={historyHook.clearHistory}
      />
      {tabs.map((tab) => {
        const loc = studioLoc[tab.id] ?? mapViewTabToStudioLocation('connect');
        return (
          <div
            key={tab.id}
            style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}
            data-testid={`conn-tab-pane-${tab.id}`}
          >
            <WsConnectionTabContent
              ref={getTabRef(tab.id)}
              tabId={tab.id}
              envVarMap={envVarMap}
              endpointProtocolStatus={endpointProtocolStatus}
              globalAuthProfiles={globalAuthProfiles}
              profilesHook={profilesHook}
              templatesHook={templatesHook}
              mockPort={mockPorts.current[tab.id] ?? 9876}
              onMockPortChange={handleMockPortChange}
              onConnectionStateChange={handleConnectionStateChange}
              onUrlChange={handleUrlChange}
              onDraftChange={handleDraftChange}
              initialUrl={initialUrlsRef.current[tab.id]}
              initialProtocol={initialProtocolsRef.current[tab.id]}
              initialDraft={initialDraftsRef.current[tab.id]}
              controlledLeftTab={loc.leftTab}
              controlledMode={loc.mode}
              controlledRightTab={loc.rightTab}
              onModeChange={(m) => handleModeChange(tab.id, m)}
              onLeftTabChange={(lt) => handleLeftTabChange(tab.id, lt)}
              onRightTabChange={(rt) => handleRightTabChange(tab.id, rt)}
              history={historyHook.history}
              onClearHistory={historyHook.clearHistory}
            />
          </div>
        );
      })}
      {pendingCloseTabId != null && (
        <ConfirmModal
          title="Close Active Connection"
          message="This connection is active. Close and disconnect?"
          confirmLabel="Close"
          variant="danger"
          onConfirm={() => {
            const id = pendingCloseTabId;
            setPendingCloseTabId(null);
            doCloseTab(id);
          }}
          onCancel={() => setPendingCloseTabId(null)}
        />
      )}
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
