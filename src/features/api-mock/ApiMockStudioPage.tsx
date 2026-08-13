import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiMockConflictFindingV1, ApiMockServerDefinitionV1, ApiMockSimulationSampleV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { ApiMockStudioTitleBar } from './components/ApiMockStudioTitleBar';
import { type ApiMockDockTab } from './components/ApiMockDock';
import { type ApiMockMainView } from './components/ApiMockWorkspaceNav';
import { ApiMockStudioEmptyState } from './components/ApiMockStudioEmptyState';
import { ApiMockStudioModals } from './components/ApiMockStudioModals';
import { ApiMockStudioActiveSection } from './components/ApiMockStudioActiveSection';
import { loadApiMockWorkspace, saveApiMockWorkspace } from './apiMockPersistence';
import { apiMockControlClient } from './apiMockControlClient';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import { mergeRecordedDraftsIntoRoutes } from '../../shared/api-mock/proxyRecording';
import type { ApiMockExportRequest } from './components/ApiMockWorkspaceNav';
import type { ApiMockRouteFolderV1 } from '../../shared/api-mock/contracts';
import {
  applyRouteUpdate,
  buildRuntimeMaps,
  computeHydrationResult,
  duplicateServerDefinition,
  findSelectedRoute,
  formatImportedRoutesMessage,
  formatStopAndCloseMessage,
  formatTabLimitMessage,
  TAB_LIMIT_CONFIRM_OPTIONS,
  isLiveRuntimeStatus,
  mergeConflictAcknowledgements,
  mergeRuntimeInfo,
  parsePortOwnerServerId,
  pickNextAutoPort,
  API_MOCK_MAX_TABS,
  removeClosedServers,
  reorderServers,
  runConflictAnalysis,
} from './apiMockPageHelpers';
import { useApiMockRouteUndo } from './useApiMockRouteUndo';
import { createRoute, createServer, nowIso, type RuntimeInfo } from './apiMockStudioFactory';
import { handleApiMockExport } from './apiMockExportActions';
import {
  capturedRequestPath,
  copyTransactionToClipboard,
  dispatchOpenInRequests,
  sampleToOpenInRequestsDetail,
  transactionToOpenInRequestsDetail,
  transactionToRouteDraft,
  transactionToSample,
} from './apiMockJournalActions';
import { useApiMockConsole } from './useApiMockConsole';
import { analyzeConflicts } from '../../shared/api-mock/conflictAnalyzer';
import { useConfirmDialog } from '../../app/hooks/useConfirmDialog';
import './api-mock-studio.css';
const ts = nowIso;

export function ApiMockStudioPage() {
  const [servers, setServers] = useState<ApiMockServerDefinitionV1[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | undefined>();
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [liveMessage, setLiveMessage] = useState('');
  const [runtime, setRuntime] = useState<Record<string, RuntimeInfo>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateSeed, setSimulateSeed] = useState<{ path: string; method: string; sampleId?: string } | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har'>('curl');
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [conflictFindings, setConflictFindings] = useState<ApiMockConflictFindingV1[]>([]);
  const [conflictStats, setConflictStats] = useState<{ analyzedRules: number; durationMs: number } | undefined>();
  const [mainView, setMainView] = useState<ApiMockMainView>('studio');
  const [runtimeTabRequest, setRuntimeTabRequest] = useState<ApiMockDockTab | undefined>();
  const [routesDrawerOpen, setRoutesDrawerOpen] = useState(false);
  const [transactions, setTransactions] = useState<ApiMockTransactionV1[]>([]);
  const [scenarioState, setScenarioState] = useState<ScenarioStateSnapshot | null>(null);
  const { confirm, confirmDialogElement } = useConfirmDialog();
  const { lines: consoleLines, clear: clearConsole } = useApiMockConsole(servers.length > 0);

  // Persistence: hydrate from storage on mount, then autosave definitions.
  const hydratedRef = useRef(false);
  const latestRef = useRef<{ servers: ApiMockServerDefinitionV1[]; activeServerId?: string }>({ servers: [], activeServerId: undefined });
  latestRef.current = { servers, activeServerId };

  useEffect(() => {
    let cancelled = false;
    void loadApiMockWorkspace().then(state => {
      const hydrated = computeHydrationResult(cancelled, state);
      if (hydrated.shouldApply) {
        setServers(hydrated.servers);
        setActiveServerId(hydrated.activeServerId);
      }
      hydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => { void saveApiMockWorkspace(latestRef.current); }, 300);
    return () => window.clearTimeout(timer);
  }, [servers, activeServerId]);

  // Flush the latest state on unmount so navigating away never drops a pending save.
  useEffect(() => () => {
    if (hydratedRef.current) void saveApiMockWorkspace(latestRef.current);
  }, []);

  // Conflict markers and Simulate seed are per-server; drop them when the tab changes.
  useEffect(() => {
    setConflictIds([]);
    setSimulateOpen(false);
    setSimulateSeed(undefined);
  }, [activeServerId]);

  // Never leave the editor blank when the active server has rules (e.g. after
  // hydration or switching tabs) — select the first rule instead.
  const activeServerForSelection = servers.find(s => s.id === activeServerId);
  useEffect(() => {
    if (!activeServerForSelection) return;
    if (selectedRouteId && activeServerForSelection.routes.some(r => r.id === selectedRouteId)) return;
    setSelectedRouteId(activeServerForSelection.routes[0]?.id);
  }, [activeServerForSelection, selectedRouteId]);

  // Poll the running server's transaction journal for the live dock view.
  const activeStatus = runtime[activeServerId ?? '']?.status;
  useEffect(() => {
    setTransactions([]);
    setScenarioState(null);
  }, [activeServerId]);
  useEffect(() => {
    if (!activeServerId || activeStatus !== 'running') return;
    let cancelled = false;
    const poll = async () => {
      const [txRes, stRes, draftRes] = await Promise.all([
        apiMockControlClient.transactions(activeServerId),
        apiMockControlClient.state(activeServerId),
        apiMockControlClient.recordedDrafts(activeServerId),
      ]);
      if (cancelled) return;
      if (txRes.ok) setTransactions([...txRes.data.transactions].reverse());
      if (stRes.ok) setScenarioState(stRes.data);
      if (draftRes.ok && draftRes.data.drafts.length > 0) {
        const drafts = draftRes.data.drafts;
        const current = latestRef.current.servers.find(s => s.id === activeServerId);
        if (current) {
          const merged = mergeRecordedDraftsIntoRoutes(current.routes, drafts);
          if (merged.added > 0) {
            setServers(prev => prev.map(s => (
              s.id === activeServerId
                ? { ...s, routes: merged.routes, updatedAt: new Date().toISOString() }
                : s
            )));
            setLiveMessage(`Recorded ${merged.added} proxied exchange(s) as inactive draft routes.`);
          }
        }
        void apiMockControlClient.ackRecordedDrafts(activeServerId, drafts.map(d => d.id));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeServerId, activeStatus]);

  const handleClearTransactions = useCallback(async () => {
    /* c8 ignore next */
    if (!activeServerId) return;
    await apiMockControlClient.clearTransactions(activeServerId);
    setTransactions([]);
  }, [activeServerId]);

  const handleResetState = useCallback(async () => {
    if (!activeServerId) return;
    await apiMockControlClient.resetState(activeServerId);
    const res = await apiMockControlClient.state(activeServerId);
    setScenarioState(res.ok ? res.data : { states: {}, counters: {} });
  }, [activeServerId]);

  const activeServer = servers.find(s => s.id === activeServerId);

  const handleCreateServer = useCallback(() => {
    if (servers.length >= API_MOCK_MAX_TABS) {
      confirm(formatTabLimitMessage(), () => {}, undefined, TAB_LIMIT_CONFIRM_OPTIONS);
      return;
    }
    let port: number;
    try {
      port = pickNextAutoPort(servers);
    } catch {
      confirm(formatTabLimitMessage(), () => {}, undefined, TAB_LIMIT_CONFIRM_OPTIONS);
      return;
    }
    const srv = createServer(servers.length + 1, port);
    setServers(prev => [...prev, srv]);
    setActiveServerId(srv.id);
    setSelectedRouteId(undefined);
    setLiveMessage(`${srv.name} created on port ${port}.`);
  }, [servers, confirm]);

  const finalizeCloseServers = useCallback((targets: Array<{ id: string; name: string }>) => {
    const ids = targets.map(t => t.id);
    /* c8 ignore next */
    const closingActive = ids.includes(latestRef.current.activeServerId ?? '');
    setServers(prev => {
      const next = removeClosedServers(prev, ids, latestRef.current.activeServerId);
      setActiveServerId(next.activeServerId);
      return next.servers;
    });
    setRuntime(prev => {
      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    if (closingActive) setSelectedRouteId(undefined);
    setLiveMessage(targets.length === 1 ? `${targets[0].name} closed.` : `${targets.length} mock servers closed.`);
  }, []);

  const handleCloseServers = useCallback((ids: string[]) => {
    const unique = [...new Set(ids)];
    const targets = unique
      .map(id => servers.find(s => s.id === id))
      .filter((s): s is ApiMockServerDefinitionV1 => Boolean(s));
    if (targets.length === 0) return;
    const run = async () => {
      for (const server of targets) {
        await apiMockControlClient.stop(server.id);
      }
      finalizeCloseServers(targets);
    };
    if (targets.some(s => isLiveRuntimeStatus(runtime[s.id]?.status))) {
      confirm(formatStopAndCloseMessage(targets.map(s => s.name)), () => { void run(); });
      return;
    }
    void run();
  }, [servers, runtime, confirm, finalizeCloseServers]);

  const handleCloseServer = useCallback((id: string) => {
    handleCloseServers([id]);
  }, [handleCloseServers]);

  const handleUpdateServer = useCallback((id: string, patch: Partial<ApiMockServerDefinitionV1>) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, ...patch, updatedAt: ts() } : s));
  }, []);

  const handleRenameServer = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    handleUpdateServer(id, { name: trimmed });
    setLiveMessage(`Renamed to ${trimmed}.`);
  }, [handleUpdateServer]);

  const handleDuplicateServer = useCallback((id: string) => {
    if (servers.length >= API_MOCK_MAX_TABS) {
      confirm(formatTabLimitMessage(), () => {}, undefined, TAB_LIMIT_CONFIRM_OPTIONS);
      return;
    }
    const source = servers.find(s => s.id === id);
    if (!source) return;
    let port: number;
    try {
      port = pickNextAutoPort(servers);
    } catch {
      confirm(formatTabLimitMessage(), () => {}, undefined, TAB_LIMIT_CONFIRM_OPTIONS);
      return;
    }
    const copy = duplicateServerDefinition(source, port);
    setServers(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const next = [...prev];
      const insertIndex = Math.max(0, idx) + 1;
      next.splice(insertIndex, 0, copy);
      return next;
    });
    setActiveServerId(copy.id);
    setSelectedRouteId(undefined);
    setLiveMessage(`${copy.name} duplicated on port ${port}.`);
  }, [servers, confirm]);

  const handleReorderServers = useCallback((fromIndex: number, toIndex: number) => {
    setServers(prev => reorderServers(prev, fromIndex, toIndex));
  }, []);

  const handleUpdateSample = useCallback((sample: ApiMockSimulationSampleV1) => {
    if (!activeServerId) return;
    setServers(prev => prev.map(s => (
      s.id === activeServerId
        ? { ...s, samples: (s.samples ?? []).map(x => x.id === sample.id ? sample : x), updatedAt: ts() }
        : s
    )));
  }, [activeServerId]);

  const handleDeleteSample = useCallback((sampleId: string) => {
    if (!activeServerId) return;
    setServers(prev => prev.map(s => (
      s.id === activeServerId
        ? { ...s, samples: (s.samples ?? []).filter(x => x.id !== sampleId), updatedAt: ts() }
        : s
    )));
    setLiveMessage('Example deleted.');
  }, [activeServerId]);

  const handleSetSimulateOpen = useCallback((open: boolean) => {
    if (open) setSimulateSeed(undefined);
    setSimulateOpen(open);
  }, []);

  const handleSimulateSample = useCallback((sample: ApiMockSimulationSampleV1) => {
    const method = sample.request.method && sample.request.method !== 'ANY' ? sample.request.method : 'GET';
    setSimulateSeed({
      path: capturedRequestPath(sample.request),
      method,
      sampleId: sample.id,
    });
    setSimulateOpen(true);
  }, []);

  const handleTrySampleInRequests = useCallback((sample: ApiMockSimulationSampleV1) => {
    if (!activeServer) return;
    dispatchOpenInRequests(sampleToOpenInRequestsDetail(sample, {
      host: activeServer.host,
      port: activeServer.port,
      tls: Boolean(activeServer.settings.tls?.enabled),
    }));
    setLiveMessage('Opened example in Requests.');
  }, [activeServer]);

  const handleSaveSampleFromTransaction = useCallback((tx: ApiMockTransactionV1) => {
    if (!activeServerId) return;
    const sample = transactionToSample(tx, { routeId: tx.matchedRouteId });
    setServers(prev => prev.map(s => (
      s.id === activeServerId
        ? { ...s, samples: [...(s.samples ?? []), sample], updatedAt: ts() }
        : s
    )));
    setLiveMessage(sample.routeId
      ? `Saved example “${sample.name}” on the matched rule.`
      : `Saved example “${sample.name}” (unassociated — pick a rule to attach it).`);
  }, [activeServerId]);

  const handleCreateRoute = useCallback((folderId?: string) => {
    if (!activeServerId || !activeServer) return;
    const currentRoutes = activeServer.routes ?? [];
    const currentFolders = activeServer.folders ?? [];
    const route = {
      ...createRoute(`New Route ${currentRoutes.length + 1}`),
      ...(folderId ? { folderId } : {}),
    };
    const folders = folderId
      ? currentFolders.map(f => f.id === folderId ? { ...f, expanded: true } : f)
      : currentFolders;
    handleUpdateServer(activeServerId, {
      routes: [...currentRoutes, route],
      ...(folders ? { folders } : {}),
    });
    setSelectedRouteId(route.id);
    setLiveMessage(folderId ? `${route.name} added to folder.` : `${route.name} added.`);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleMoveRoute = useCallback((routeId: string, folderId: string | undefined) => {
    if (!activeServerId || !activeServer) return;
    const folders = folderId
      ? activeServer.folders.map(f => f.id === folderId ? { ...f, expanded: true } : f)
      : activeServer.folders;
    handleUpdateServer(activeServerId, {
      folders,
      routes: activeServer.routes.map(r => (
        r.id === routeId
          ? { ...r, folderId, updatedAt: ts() }
          : r
      )),
    });
    const folderName = folderId
      ? activeServer.folders.find(f => f.id === folderId)?.name ?? 'folder'
      : 'Ungrouped';
    setLiveMessage(`Moved rule to ${folderName}.`);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const { handleDeleteRoute, undoToast } = useApiMockRouteUndo({
    servers,
    activeServerId,
    activeServer,
    selectedRouteId,
    handleUpdateServer,
    setSelectedRouteId,
    setLiveMessage,
    setActiveServerId,
  });

  const handleUpdateRoute = useCallback((routeId: string, patch: Partial<ApiMockServerDefinitionV1['routes'][0]>) => {
    applyRouteUpdate(activeServerId, activeServer, routeId, patch, handleUpdateServer);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const patchRuntime = useCallback((id: string, patch: Partial<RuntimeInfo>) => {
    setRuntime(prev => mergeRuntimeInfo(prev, id, patch));
  }, []);

  const handleStart = useCallback(async (server: ApiMockServerDefinitionV1) => {
    patchRuntime(server.id, { status: 'starting', error: undefined });
    let res = await apiMockControlClient.start(server);
    // If a closed tab left an orphan listener on this port, stop it and retry once.
    if (!res.ok && res.error.code === 'MOCK_PORT_OWNED') {
      const ownerId = parsePortOwnerServerId(res.error.message);
      if (ownerId && ownerId !== server.id && !servers.some(s => s.id === ownerId)) {
        await apiMockControlClient.stop(ownerId);
        res = await apiMockControlClient.start(server);
      }
    }
    if (res.ok) {
      patchRuntime(server.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(server) });
      setLiveMessage(`Server started on port ${res.data.port}.`);
    } else {
      patchRuntime(server.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
      setLiveMessage(`${res.error.title}. ${res.error.message}`);
    }
  }, [patchRuntime, servers]);

  const handleStop = useCallback(async (server: ApiMockServerDefinitionV1) => {
    patchRuntime(server.id, { status: 'draining' });
    const res = await apiMockControlClient.stop(server.id);
    if (res.ok) {
      patchRuntime(server.id, { status: 'stopped', error: undefined });
      setLiveMessage('Server stopped.');
    } else {
      patchRuntime(server.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [patchRuntime]);

  const handleApply = useCallback(async (server: ApiMockServerDefinitionV1) => {
    patchRuntime(server.id, { status: 'applying' });
    const res = await apiMockControlClient.commit(server);
    if (res.ok) {
      patchRuntime(server.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(server) });
      setLiveMessage(`Applied generation ${res.data.generation}.`);
    } else {
      // A rejected draft leaves the previous generation running untouched.
      patchRuntime(server.id, { status: 'running', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [patchRuntime]);

  const handleRestart = useCallback(async (server: ApiMockServerDefinitionV1) => {
    patchRuntime(server.id, { status: 'starting' });
    const res = await apiMockControlClient.restart(server);
    if (res.ok) {
      patchRuntime(server.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(server) });
    } else {
      patchRuntime(server.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [patchRuntime]);

  const confirmDeleteRoute = useCallback((route: ApiMockServerDefinitionV1['routes'][0]) => {
    confirm(`Delete route "${route.name}"? Samples associated with this route will become unassociated. You can Undo for a few seconds.`, () => handleDeleteRoute(route.id), undefined, { finalNote: '', confirmLabel: 'Delete' });
  }, [confirm, handleDeleteRoute]);

  const handleImportRoutes = useCallback((
    routes: ApiMockServerDefinitionV1['routes'],
    options: { mode: 'merge' | 'replace' | 'copy'; newFolderName?: string } = { mode: 'merge' },
  ) => {
    if (!activeServerId || !activeServer || routes.length === 0) return;
    let nextFolders = activeServer.folders;
    let assignFolderId: string | undefined;
    if (options.newFolderName) {
      const newFolder: ApiMockRouteFolderV1 = {
        id: `fld-${crypto.randomUUID().slice(0, 8)}`,
        name: options.newFolderName,
        expanded: true,
        sortOrder: activeServer.folders.length,
      };
      nextFolders = [...activeServer.folders, newFolder];
      assignFolderId = newFolder.id;
    }
    let prepared = options.mode === 'copy'
      ? routes.map(r => ({
        ...r,
        id: `rte-${crypto.randomUUID().slice(0, 8)}`,
        name: `${r.name} (copy)`,
        responses: r.responses.map(resp => ({ ...resp, id: `rsp-${crypto.randomUUID().slice(0, 8)}` })),
      }))
      : routes;
    if (assignFolderId) {
      prepared = prepared.map(r => ({ ...r, folderId: assignFolderId }));
    }
    const nextRoutes = options.mode === 'replace'
      ? prepared
      : [...activeServer.routes, ...prepared];
    handleUpdateServer(activeServerId, { routes: nextRoutes, folders: nextFolders });
    setSelectedRouteId(prepared[0].id);
    setImportOpen(false);
    setLiveMessage(formatImportedRoutesMessage(prepared.length));
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleAnalyzeConflicts = useCallback(async () => {
    await runConflictAnalysis(
      activeServer,
      analyzeConflicts,
      setConflictIds,
      setLiveMessage,
      findings => setConflictFindings(prev => mergeConflictAcknowledgements(prev, findings as ApiMockConflictFindingV1[])),
      setConflictStats,
    );
  }, [activeServer]);

  const handleAcknowledgeConflict = useCallback((finding: ApiMockConflictFindingV1) => {
    const at = ts();
    setConflictFindings(prev => prev.map(f => (
      f.id === finding.id
        ? { ...f, acknowledgedAt: at, acknowledgementStale: false }
        : f
    )));
    setLiveMessage(finding.acknowledgementStale ? 'Stale conflict re-acknowledged.' : 'Conflict acknowledged.');
  }, []);

  const handleSimulateWitness = useCallback((finding?: ApiMockConflictFindingV1) => {
    const path = finding?.witnessRequest ? capturedRequestPath(finding.witnessRequest) : '/';
    const method = finding?.witnessRequest?.method && finding.witnessRequest.method !== 'ANY'
      ? finding.witnessRequest.method
      : 'GET';
    setSimulateSeed({ path, method });
    setSimulateOpen(true);
  }, []);

  const handleAdjustPriority = useCallback((routeId: string, delta: number) => {
    if (!activeServerId || !activeServer) return;
    const routes = activeServer.routes.map(r => (
      r.id === routeId ? { ...r, priority: r.priority + delta, updatedAt: ts() } : r
    ));
    handleUpdateServer(activeServerId, { routes });
    setLiveMessage(`Priority adjusted for ${routeId}.`);
    void runConflictAnalysis(
      { ...activeServer, routes },
      analyzeConflicts,
      setConflictIds,
      setLiveMessage,
      findings => setConflictFindings(prev => mergeConflictAcknowledgements(prev, findings as ApiMockConflictFindingV1[])),
      setConflictStats,
    );
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleOpenInRequests = useCallback((tx: ApiMockTransactionV1) => {
    if (!activeServer) return;
    dispatchOpenInRequests(transactionToOpenInRequestsDetail(tx, {
      host: activeServer.host,
      port: activeServer.port,
      tls: Boolean(activeServer.settings.tls?.enabled),
    }));
    setLiveMessage('Opened captured request in Requests.');
  }, [activeServer]);

  const handleCreateRouteFromTransaction = useCallback((tx: ApiMockTransactionV1) => {
    if (!activeServerId || !activeServer) return;
    const route = transactionToRouteDraft(tx);
    handleUpdateServer(activeServerId, { routes: [...activeServer.routes, route] });
    setSelectedRouteId(route.id);
    setLiveMessage(`Draft route created from journal: ${route.name}.`);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleCopyTransaction = useCallback((tx: ApiMockTransactionV1) => {
    void copyTransactionToClipboard(tx).then(ok => {
      setLiveMessage(ok ? 'Transaction copied to clipboard.' : 'Could not copy transaction.');
    });
  }, []);

  const openRuntime = useCallback((tab: ApiMockDockTab = 'transactions') => {
    setMainView('runtime');
    setRuntimeTabRequest(tab);
  }, []);

  const openConflictInspector = useCallback(() => {
    setMainView('conflicts');
    if (conflictFindings.length === 0) void handleAnalyzeConflicts();
  }, [conflictFindings.length, handleAnalyzeConflicts]);

  const handleAddFolder = useCallback(() => {
    if (!activeServerId || !activeServer) return;
    const folder: ApiMockRouteFolderV1 = {
      id: `fld-${crypto.randomUUID().slice(0, 8)}`,
      name: `Folder ${activeServer.folders.length + 1}`,
      expanded: true,
      sortOrder: activeServer.folders.length,
    };
    handleUpdateServer(activeServerId, { folders: [...activeServer.folders, folder] });
    setLiveMessage(`${folder.name} added.`);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleToggleFolder = useCallback((folderId: string) => {
    if (!activeServerId || !activeServer) return;
    handleUpdateServer(activeServerId, {
      folders: activeServer.folders.map(f => f.id === folderId ? { ...f, expanded: !f.expanded } : f),
    });
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleRenameFolder = useCallback((folderId: string, name: string) => {
    if (!activeServerId || !activeServer) return;
    handleUpdateServer(activeServerId, {
      folders: activeServer.folders.map(f => f.id === folderId ? { ...f, name } : f),
    });
    setLiveMessage(`Folder renamed to ${name}.`);
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    if (!activeServerId || !activeServer) return;
    const folder = activeServer.folders.find(f => f.id === folderId);
    if (!folder) return;
    // Deleting a folder never deletes its rules; they fall back to Ungrouped.
    confirm(`Delete folder "${folder.name}"? Rules inside it move to Ungrouped.`, () => {
      handleUpdateServer(activeServerId, {
        folders: activeServer.folders.filter(f => f.id !== folderId),
        routes: activeServer.routes.map(r => r.folderId === folderId ? { ...r, folderId: undefined, updatedAt: ts() } : r),
      });
      setLiveMessage(`${folder.name} deleted.`);
    });
  }, [activeServerId, activeServer, handleUpdateServer, confirm]);

  const handleExport = useCallback(async (req: ApiMockExportRequest) => {
    await handleApiMockExport({
      request: req,
      servers,
      activeServerId,
      transactions,
      setLiveMessage,
    });
  }, [servers, activeServerId, transactions]);

  const selectedRoute = findSelectedRoute(activeServer, selectedRouteId);
  const selectedFolderName = selectedRoute?.folderId
    ? activeServer?.folders.find(f => f.id === selectedRoute.folderId)?.name
    : undefined;

  const { statusById, dirtyById } = buildRuntimeMaps(servers, runtime);
  /* c8 ignore next */
  const modalRuntimeStatus = runtime[activeServer?.id ?? '']?.status ?? 'stopped';

  if (servers.length === 0) {
    return <ApiMockStudioEmptyState onCreateServer={handleCreateServer} />;
  }

  return (
    <div className="api-mock-root api-mock-studio" data-testid="api-mock-studio">
      <div className="am-sr-only" role="status" aria-live="polite" data-testid="api-mock-live-region">{liveMessage}</div>
      <ApiMockStudioTitleBar
        servers={servers}
        activeServerId={activeServerId}
        onSelect={setActiveServerId}
        onCreate={handleCreateServer}
        onClose={handleCloseServer}
        onCloseMany={handleCloseServers}
        onRename={handleRenameServer}
        onDuplicate={handleDuplicateServer}
        onReorder={handleReorderServers}
        statusById={statusById}
        dirtyById={dirtyById}
      />
      {activeServer && (
        <ApiMockStudioActiveSection
          activeServer={activeServer}
          mainView={mainView}
          setMainView={setMainView}
          transactions={transactions}
          conflictFindings={conflictFindings}
          conflictIds={conflictIds}
          conflictStats={conflictStats}
          runtimeTabRequest={runtimeTabRequest}
          onRuntimeTabConsumed={() => setRuntimeTabRequest(undefined)}
          runtimeRunning={runtime[activeServer.id]?.status === 'running'}
          dirty={!!dirtyById[activeServer.id]}
          scenarioState={scenarioState}
          consoleLines={consoleLines}
          selectedRouteId={selectedRouteId}
          setSelectedRouteId={setSelectedRouteId}
          selectedRoute={selectedRoute}
          selectedFolderName={selectedFolderName}
          routesDrawerOpen={routesDrawerOpen}
          setRoutesDrawerOpen={setRoutesDrawerOpen}
          onImportOpen={(source) => {
            setImportSource(source ?? 'curl');
            setImportOpen(true);
          }}
          onExport={handleExport}
          onAnalyzeConflicts={() => { void handleAnalyzeConflicts(); }}
          onStart={() => { void handleStart(activeServer); }}
          onStop={() => { void handleStop(activeServer); }}
          onApply={() => { void handleApply(activeServer); }}
          onRestart={() => { void handleRestart(activeServer); }}
          onSettings={() => setSettingsOpen(true)}
          onCreateRoute={handleCreateRoute}
          onConfirmDeleteRoute={confirmDeleteRoute}
          onUpdateRoute={handleUpdateRoute}
          onAddFolder={handleAddFolder}
          onToggleFolder={handleToggleFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveRoute={handleMoveRoute}
          onSetSimulateOpen={handleSetSimulateOpen}
          onSimulateSample={handleSimulateSample}
          onOpenConflictInspector={openConflictInspector}
          onOpenRuntime={openRuntime}
          onResetState={() => { void handleResetState(); }}
          onClearTransactions={() => { void handleClearTransactions(); }}
          onClearConsole={clearConsole}
          onAcknowledgeConflict={handleAcknowledgeConflict}
          onAdjustPriority={handleAdjustPriority}
          onOpenInRequests={handleOpenInRequests}
          onCreateRouteFromTransaction={handleCreateRouteFromTransaction}
          onSaveSampleFromTransaction={handleSaveSampleFromTransaction}
          onCopyTransaction={handleCopyTransaction}
          onUpdateSample={handleUpdateSample}
          onDeleteSample={handleDeleteSample}
          onTrySampleInRequests={handleTrySampleInRequests}
          onSimulateWitness={handleSimulateWitness}
          onUpdateServer={patch => handleUpdateServer(activeServer.id, patch)}
          status={runtime[activeServer.id]?.status ?? 'stopped'}
          generation={runtime[activeServer.id]?.generation ?? 0}
          error={runtime[activeServer.id]?.error}
        />
      )}
      <ApiMockStudioModals
        activeServer={activeServer}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
          runtimeStatus={modalRuntimeStatus}
        onUpdateServer={(patch) => {
          if (activeServer) handleUpdateServer(activeServer.id, patch);
        }}
        simulateOpen={simulateOpen}
        setSimulateOpen={setSimulateOpen}
        selectedRoute={selectedRoute}
        simulateSeed={simulateSeed}
        setSimulateSeed={setSimulateSeed}
        importOpen={importOpen}
        setImportOpen={setImportOpen}
        importSource={importSource}
        onImportRoutes={handleImportRoutes}
        folders={activeServer?.folders ?? []}
      />
      {undoToast}
      {confirmDialogElement}
    </div>
  );
}
