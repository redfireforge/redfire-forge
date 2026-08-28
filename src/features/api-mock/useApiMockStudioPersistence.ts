import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import { reconcileRuntimeState } from '@shared/api-mock/recoveryDiagnostics';
import { isTauri } from '@shared/utils/platform';
import type { ApiMockMainView } from './components/ApiMockWorkspaceNav';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from './apiMockGalleryImport';
import { apiMockControlClient } from './apiMockControlClient';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import { isApiMockDemoPersistenceActive, loadApiMockWorkspace, publishApiMockWorkspace, saveApiMockWorkspace } from './apiMockPersistence';
import { computeHydrationResult } from './apiMockPageHelpers';
import { resolveOpenTabIds } from './apiMockServerLibrary';
import type { RuntimeInfo } from './apiMockStudioFactory';

export type ApiMockWorkspaceSnapshot = {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  openTabIds: string[];
};

export function useApiMockStudioPersistence(opts: {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  openTabIds: string[];
  setServers: Dispatch<SetStateAction<ApiMockServerDefinitionV1[]>>;
  setActiveServerId: Dispatch<SetStateAction<string | undefined>>;
  setOpenTabIds: Dispatch<SetStateAction<string[]>>;
  setRuntime: Dispatch<SetStateAction<Record<string, RuntimeInfo>>>;
  setTransactions: Dispatch<SetStateAction<ApiMockTransactionV1[]>>;
  setScenarioState: Dispatch<SetStateAction<ScenarioStateSnapshot | null>>;
  setMainView: Dispatch<SetStateAction<ApiMockMainView>>;
  setLiveMessage: Dispatch<SetStateAction<string>>;
  /** Wipe/import replaces the library — drop export/import/simulate chrome that is not on disk. */
  onWorkspaceReplaced?: () => void;
}): { latestRef: MutableRefObject<ApiMockWorkspaceSnapshot>; isHydrated: boolean } {
  const {
    servers, activeServerId, openTabIds,     setServers, setActiveServerId, setOpenTabIds,
    setRuntime, setTransactions, setScenarioState, setMainView, setLiveMessage,
    onWorkspaceReplaced,
  } = opts;

  const hydratedRef = useRef(false);
  const hydrateGenRef = useRef(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestRef = useRef<ApiMockWorkspaceSnapshot>({ servers: [], activeServerId: undefined, openTabIds: [] });
  const autosaveTimerRef = useRef<number | undefined>(undefined);
  latestRef.current = { servers, activeServerId, openTabIds };

  useEffect(() => {
    let cancelled = false;
    const startedGen = hydrateGenRef.current;
    const isStale = () => cancelled || hydrateGenRef.current !== startedGen;
    void loadApiMockWorkspace().then(async state => {
      if (isStale()) return;
      const hydrated = computeHydrationResult(cancelled, state);
      if (hydrated.shouldApply) {
        setServers(hydrated.servers);
        setOpenTabIds(hydrated.openTabIds);
        setActiveServerId(hydrated.activeServerId);
        // AMS-010 / W21 — reconcile live companion/native status (never trust disk for running).
        let live: Array<{ serverId: string; state: 'running' | 'stopped'; generation?: number }> | null;
        if (isTauri()) {
          live = await Promise.all(hydrated.servers.map(async (s) => {
            const st = await apiMockControlClient.status(s.id);
            return st.ok
              ? { serverId: s.id, state: st.data.state, generation: st.data.generation }
              : { serverId: s.id, state: 'stopped' as const };
          }));
        } else {
          const listRes = await apiMockControlClient.list();
          if (isStale()) return;
          live = listRes.ok
            ? listRes.data.map(s => ({ serverId: s.serverId, state: s.state, generation: s.generation }))
            : null;
        }
        if (isStale()) return;
        const reconciled = reconcileRuntimeState(
          hydrated.servers.map(s => ({ serverId: s.id, persistedRunning: false })),
          live,
        );
        const genById = new Map((live ?? []).map(s => [s.serverId, s.generation ?? 0]));
        setRuntime(prev => {
          const next = { ...prev };
          for (const row of reconciled.servers) {
            if (row.state === 'running') {
              next[row.serverId] = {
                status: 'running',
                generation: genById.get(row.serverId) ?? prev[row.serverId]?.generation ?? 0,
                error: undefined,
                appliedJson: prev[row.serverId]?.appliedJson,
              };
            } else if (row.state === 'stopped') {
              next[row.serverId] = {
                status: 'stopped',
                generation: prev[row.serverId]?.generation ?? 0,
                error: undefined,
                appliedJson: prev[row.serverId]?.appliedJson,
              };
            }
          }
          return next;
        });
        // An unreachable companion attaches its notice to every server, and hydration
        // only applies with at least one, so this covers both the "was running" and
        // the companion-down cases.
        const notice = reconciled.servers.find(s => s.message)?.message;
        if (notice) setLiveMessage(notice);
      }
      hydratedRef.current = true;
      setIsHydrated(true);
    });
    const onWorkspaceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ servers: ApiMockServerDefinitionV1[]; activeServerId?: string; openTabIds?: string[] }>).detail;
      if (!detail?.servers) return;
      // Invalidate in-flight mount hydration so a stale list() cannot mark
      // wiped servers running and spam /transactions 404s during a lesson.
      hydrateGenRef.current += 1;
      // Cancel a pending autosave that could overwrite the imported workspace.
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = undefined;
      }
      const nextTabs = resolveOpenTabIds(detail.servers, detail.openTabIds);
      latestRef.current = { servers: detail.servers, activeServerId: detail.activeServerId, openTabIds: nextTabs };
      setServers(detail.servers);
      setOpenTabIds(nextTabs);
      setActiveServerId(detail.activeServerId);
      setRuntime({});
      setTransactions([]);
      setScenarioState(null);
      setMainView('studio');
      setLiveMessage(detail.servers.length > 0 ? 'Gallery mock server imported.' : '');
      onWorkspaceReplaced?.();
      hydratedRef.current = true;
      setIsHydrated(true);
    };
    window.addEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onWorkspaceChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onWorkspaceChanged);
    };
    // `setOpenTabIds` is a stable setState, so this still runs once on mount.
  }, [setOpenTabIds, setServers, setActiveServerId, setRuntime, setTransactions, setScenarioState, setMainView, setLiveMessage, onWorkspaceReplaced]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    // Tell Test Runner immediately — disk write stays debounced.
    publishApiMockWorkspace(latestRef.current);
    const persistAs = isApiMockDemoPersistenceActive() ? 'demo' : 'user';
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = undefined;
      void saveApiMockWorkspace(latestRef.current, { persistAs });
    }, 300);
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = undefined;
      }
    };
  }, [servers, activeServerId, openTabIds]);

  // Flush the latest state on unmount so navigating away never drops a pending save.
  useEffect(() => () => {
    if (hydratedRef.current) {
      const persistAs = isApiMockDemoPersistenceActive() ? 'demo' : 'user';
      void saveApiMockWorkspace(latestRef.current, { persistAs });
    }
  }, []);

  return { latestRef, isHydrated };
}
