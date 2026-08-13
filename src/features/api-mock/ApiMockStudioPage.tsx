import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiMockConflictFindingV1, ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse, EMPTY_PREDICATE_GROUP } from '../../shared/api-mock/defaults';
import { API_MOCK_WORKSPACE_PANEL_ID, type ApiMockRuntimeStatus } from './components/ApiMockServerTabs';
import { ApiMockStudioTitleBar } from './components/ApiMockStudioTitleBar';
import { ApiMockServerBar } from './components/ApiMockServerBar';
import { ApiMockRouteExplorer } from './components/ApiMockRouteExplorer';
import { ApiMockRouteEditor } from './components/ApiMockRouteEditor';
import { ApiMockDock, type ApiMockDockTab } from './components/ApiMockDock';
import { ApiMockConflictInspector, conflictPeerLabel } from './components/ApiMockConflictInspector';
import { ApiMockWorkspaceNav, type ApiMockMainView } from './components/ApiMockWorkspaceNav';
import { ApiMockLiveStrip } from './components/ApiMockLiveStrip';
import { ApiMockServerSettingsModal } from './components/ApiMockServerSettingsModal';
import { ApiMockSimulateModal } from './components/ApiMockSimulateModal';
import { ApiMockImportReview } from './components/ApiMockImportReview';
import { loadApiMockWorkspace, saveApiMockWorkspace } from './apiMockPersistence';
import { apiMockControlClient } from './apiMockControlClient';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import { exportFilename, exportWorkspace, serializeExport } from '../../shared/api-mock/exportUtils';
import { exportWireMockMappings } from '../../shared/api-mock/wireMockExport';
import { mergeRecordedDraftsIntoRoutes } from '../../shared/api-mock/proxyRecording';
import type { ApiMockExportRequest } from './components/ApiMockWorkspaceNav';
import type { ApiMockRouteFolderV1 } from '../../shared/api-mock/contracts';
import {
  applyRouteDelete,
  applyRouteUpdate,
  buildRuntimeMaps,
  computeHydrationResult,
  deriveSimulateDefaults,
  findSelectedRoute,
  formatImportedRoutesMessage,
  isLiveRuntimeStatus,
  mergeConflictAcknowledgements,
  mergeRuntimeInfo,
  parsePortOwnerServerId,
  pickNextAutoPort,
  removeClosedServer,
  runConflictAnalysis,
} from './apiMockPageHelpers';
import {
  copyTransactionToClipboard,
  dispatchOpenInRequests,
  transactionToOpenInRequestsDetail,
  transactionToRouteDraft,
} from './apiMockJournalActions';
import { useApiMockConsole } from './useApiMockConsole';
import { analyzeConflicts } from '../../shared/api-mock/conflictAnalyzer';
import { useConfirmDialog } from '../../app/hooks/useConfirmDialog';
import AppModalFrame from '../../shared/components/AppModalFrame';
import './api-mock-studio.css';

interface RuntimeInfo {
  status: ApiMockRuntimeStatus;
  generation: number;
  error?: string;
  appliedJson?: string;
}

const ts = () => new Date().toISOString();

function createServer(index: number, port: number): ApiMockServerDefinitionV1 {
  return {
    id: `srv-${crypto.randomUUID().slice(0, 8)}`,
    name: `Mock Server ${index}`,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts(),
    updatedAt: ts(),
  };
}

function createRoute(name: string): ApiMockServerDefinitionV1['routes'][0] {
  const id = `route-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    name,
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/' },
    priority: 10,
    predicates: { ...EMPTY_PREDICATE_GROUP, id: `pg-${id}` },
    responseMode: 'rules',
    responses: [createDefaultResponse(`resp-${id}`)],
    tags: [],
    createdAt: ts(),
    updatedAt: ts(),
  };
}

export function ApiMockStudioPage() {
  const [servers, setServers] = useState<ApiMockServerDefinitionV1[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | undefined>();
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [liveMessage, setLiveMessage] = useState('');
  const [runtime, setRuntime] = useState<Record<string, RuntimeInfo>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateSeed, setSimulateSeed] = useState<{ path: string; method: string } | undefined>();
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

  // Conflict markers are per-server; clear them when the active server changes.
  useEffect(() => { setConflictIds([]); }, [activeServerId]);

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
    const port = pickNextAutoPort(servers);
    const srv = createServer(servers.length + 1, port);
    setServers(prev => [...prev, srv]);
    setActiveServerId(srv.id);
    setSelectedRouteId(undefined);
    setLiveMessage(`${srv.name} created on port ${port}.`);
  }, [servers]);

  const finalizeCloseServer = useCallback((id: string, name: string) => {
    setServers(prev => {
      const next = removeClosedServer(prev, id, activeServerId);
      setActiveServerId(next.activeServerId);
      return next.servers;
    });
    setRuntime(prev => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    if (activeServerId === id) setSelectedRouteId(undefined);
    setLiveMessage(`${name} closed.`);
  }, [activeServerId]);

  const handleCloseServer = useCallback((id: string) => {
    const server = servers.find(s => s.id === id);
    if (!server) return;
    const status = runtime[id]?.status;
    const doClose = async () => {
      // Always best-effort stop so companion releases the port (idempotent if already stopped).
      await apiMockControlClient.stop(id);
      finalizeCloseServer(id, server.name);
    };
    if (isLiveRuntimeStatus(status)) {
      confirm(`Stop and close "${server.name}"?`, () => { void doClose(); });
      return;
    }
    void doClose();
  }, [servers, runtime, confirm, finalizeCloseServer]);

  const handleUpdateServer = useCallback((id: string, patch: Partial<ApiMockServerDefinitionV1>) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, ...patch, updatedAt: ts() } : s));
  }, []);

  const handleCreateRoute = useCallback((folderId?: string) => {
    if (!activeServerId) return;
    const route = {
      ...createRoute(`New Route ${(activeServer?.routes.length ?? 0) + 1}`),
      ...(folderId ? { folderId } : {}),
    };
    const folders = folderId
      ? (activeServer?.folders ?? []).map(f => f.id === folderId ? { ...f, expanded: true } : f)
      : activeServer?.folders;
    handleUpdateServer(activeServerId, {
      routes: [...(activeServer?.routes ?? []), route],
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

  const handleDeleteRoute = useCallback((routeId: string) => {
    applyRouteDelete(activeServerId, activeServer, selectedRouteId, routeId, handleUpdateServer, setSelectedRouteId, setLiveMessage);
  }, [activeServerId, activeServer, selectedRouteId, handleUpdateServer]);

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
    confirm(`Delete route "${route.name}"? This cannot be undone.`, () => handleDeleteRoute(route.id));
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

  const handleSimulateWitness = useCallback((finding: ApiMockConflictFindingV1) => {
    const path = finding.witnessRequest?.rawPath || finding.witnessRequest?.path || '/';
    const method = finding.witnessRequest?.method && finding.witnessRequest.method !== 'ANY'
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

  const handleExport = useCallback((req: ApiMockExportRequest) => {
    const workspace = { schemaVersion: 1 as const, servers, activeServerId, tabOrder: servers.map(s => s.id) };
    const active = servers.find(s => s.id === activeServerId);
    const hint = active?.name ?? activeServerId ?? 'export';

    if (req.format === 'wiremock') {
      const routes = active?.routes ?? [];
      const { mappings, lossReport } = exportWireMockMappings(routes);
      const payload = { mappings, _lossReport: lossReport };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename('routes', 'json', `wiremock-${hint}`).replace(/\.json$/, '-wiremock.json');
      a.click();
      URL.revokeObjectURL(url);
      setLiveMessage(`WireMock export: ${mappings.length} mapping(s), ${lossReport.length} loss note(s).`);
      return;
    }

    const options = req.scope === 'workspace'
      ? { scope: 'workspace' as const, redact: true, format: req.format }
      : req.scope === 'servers'
        ? { scope: 'servers' as const, redact: true, format: req.format, selectedServerIds: activeServerId ? [activeServerId] : [] }
        : { scope: 'routes' as const, redact: true, format: req.format, sourceServerId: activeServerId };
    const payload = exportWorkspace(workspace, options);
    const text = serializeExport(payload, req.format);
    const blob = new Blob([text], { type: req.format === 'yaml' ? 'text/yaml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(req.scope, req.format, hint);
    a.click();
    URL.revokeObjectURL(url);
    setLiveMessage(req.scope === 'workspace' ? 'Workspace exported.' : req.scope === 'servers' ? 'Server exported.' : 'Routes exported.');
  }, [servers, activeServerId]);

  const selectedRoute = findSelectedRoute(activeServer, selectedRouteId);
  const selectedFolderName = selectedRoute?.folderId
    ? activeServer?.folders.find(f => f.id === selectedRoute.folderId)?.name
    : undefined;

  const { statusById, dirtyById } = buildRuntimeMaps(servers, runtime);

  if (servers.length === 0) {
    return (
      <div className="api-mock-root api-mock-empty" data-testid="api-mock-empty">
        <div className="am-empty-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="6" rx="1.5" />
            <rect x="3" y="14" width="18" height="6" rx="1.5" />
            <circle cx="7" cy="7" r="0.6" fill="currentColor" />
            <circle cx="7" cy="17" r="0.6" fill="currentColor" />
          </svg>
        </div>
        <h2>API Mock Studio</h2>
        <p>Stand up a local HTTP mock server with rule-based routes, templated responses, and a live request journal.</p>
        <div className="am-empty-actions">
          <button className="am-btn primary" onClick={handleCreateServer} data-testid="api-mock-create-first">
            Create Mock Server
          </button>
        </div>
      </div>
    );
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
        statusById={statusById}
        dirtyById={dirtyById}
      />
      {activeServer && (
        <>
          <ApiMockWorkspaceNav
            view={mainView}
            onChange={view => {
              setMainView(view);
              if (view === 'conflicts' && conflictFindings.length === 0) void handleAnalyzeConflicts();
            }}
            transactionCount={transactions.length}
            conflictCount={conflictFindings.length || conflictIds.length}
            onImport={source => {
              setImportSource(source ?? 'curl');
              setImportOpen(true);
            }}
            onExport={handleExport}
          />
          <ApiMockServerBar
            server={activeServer}
            onUpdate={patch => handleUpdateServer(activeServer.id, patch)}
            status={runtime[activeServer.id]?.status ?? 'stopped'}
            dirty={dirtyById[activeServer.id]}
            generation={runtime[activeServer.id]?.generation ?? 0}
            error={runtime[activeServer.id]?.error}
            onStart={() => { void handleStart(activeServer); }}
            onStop={() => { void handleStop(activeServer); }}
            onApply={() => { void handleApply(activeServer); }}
            onRestart={() => { void handleRestart(activeServer); }}
            onSettings={() => setSettingsOpen(true)}
            onOpenRoutes={() => { setMainView('studio'); setRoutesDrawerOpen(true); }}
          />
          {mainView === 'studio' && (
            <>
              {routesDrawerOpen && (
                <button
                  type="button"
                  className="am-routes-backdrop"
                  aria-label="Close routes drawer"
                  data-testid="api-mock-routes-backdrop"
                  onClick={() => setRoutesDrawerOpen(false)}
                />
              )}
              <div
                className={`api-mock-workspace${routesDrawerOpen ? ' routes-drawer-open' : ''}`}
                id={API_MOCK_WORKSPACE_PANEL_ID}
                role="tabpanel"
                aria-labelledby={`api-mock-tabhdr-${activeServer.id}`}
              >
                <ApiMockRouteExplorer
                  routes={activeServer.routes}
                  folders={activeServer.folders}
                  selectedRouteId={selectedRouteId}
                  onSelect={(id) => { setSelectedRouteId(id); setRoutesDrawerOpen(false); }}
                  onCreate={handleCreateRoute}
                  onDelete={(id) => {
                    const route = activeServer.routes.find(r => r.id === id);
                    if (route) confirmDeleteRoute(route);
                  }}
                  onToggle={(id, enabled) => handleUpdateRoute(id, { enabled })}
                  onAddFolder={handleAddFolder}
                  onToggleFolder={handleToggleFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onMoveRoute={handleMoveRoute}
                  conflictRouteIds={conflictIds}
                  onAnalyze={() => {
                    setMainView('conflicts');
                    void handleAnalyzeConflicts();
                  }}
                  drawerOpen={routesDrawerOpen}
                  onCloseDrawer={() => setRoutesDrawerOpen(false)}
                />
                <div className="api-mock-editor">
                  {selectedRoute ? (
                    <ApiMockRouteEditor
                      route={selectedRoute}
                      onUpdate={patch => handleUpdateRoute(selectedRoute.id, patch)}
                      hasConflict={conflictIds.includes(selectedRoute.id)}
                      conflictPeer={conflictPeerLabel(conflictFindings, selectedRoute.id, activeServer.routes)}
                      matchCount={transactions.filter(t => t.matchedRouteId === selectedRoute.id).length}
                      sequencePosition={scenarioState?.sequencePositions?.[selectedRoute.id]}
                      onSimulate={() => setSimulateOpen(true)}
                      onReviewConflicts={openConflictInspector}
                      folderName={selectedFolderName}
                      folders={activeServer.folders}
                      samples={activeServer.samples}
                    />
                  ) : (
                    <div className="api-mock-no-selection" data-testid="api-mock-no-route">
                      <h3>No rule selected</h3>
                      <p>
                        {activeServer.routes.length === 0
                          ? 'This mock server has no rules yet. Create one to define how it answers requests.'
                          : 'Pick a rule from the panel on the left to edit its matching, responses, and behavior.'}
                      </p>
                      <button className="am-btn primary" onClick={() => handleCreateRoute()} data-testid="api-mock-no-route-create">
                        + New rule
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <ApiMockLiveStrip
                transactionCount={transactions.length}
                conflictCount={conflictFindings.length || conflictIds.length}
                variableCount={activeServer.variables.length}
                running={runtime[activeServer.id]?.status === 'running'}
                onOpenRuntime={openRuntime}
                onOpenConflicts={openConflictInspector}
              />
            </>
          )}
          {mainView === 'runtime' && (
            <div className="api-mock-runtime-page" data-testid="api-mock-runtime-page">
              <ApiMockDock
                variant="page"
                routes={activeServer.routes}
                conflictCount={conflictFindings.length || conflictIds.length}
                conflictFindings={conflictFindings}
                focusConflictRouteId={selectedRouteId}
                requestedTab={runtimeTabRequest}
                onRequestedTabConsumed={() => setRuntimeTabRequest(undefined)}
                onSelectRoute={id => { setSelectedRouteId(id); setMainView('studio'); }}
                onSimulateWitness={() => setSimulateOpen(true)}
                transactions={transactions}
                running={runtime[activeServer.id]?.status === 'running'}
                variables={activeServer.variables}
                onVariablesChange={variables => handleUpdateServer(activeServer.id, { variables })}
                liveState={scenarioState}
                onResetState={() => { void handleResetState(); }}
                onClearTransactions={() => { void handleClearTransactions(); }}
                consoleLines={consoleLines}
                onClearConsole={clearConsole}
                onOpenConflicts={openConflictInspector}
                onAcknowledgeConflict={handleAcknowledgeConflict}
                onAdjustPriority={handleAdjustPriority}
                onOpenInRequests={handleOpenInRequests}
                onCreateRouteFromTransaction={handleCreateRouteFromTransaction}
                onCopyTransaction={handleCopyTransaction}
                settings={activeServer.settings}
                conflictStats={conflictStats}
                serverAddress={`http://${activeServer.host}:${activeServer.port}${activeServer.basePath || ''}`}
                server={activeServer}
                onServerPatch={patch => handleUpdateServer(activeServer.id, patch)}
              />
            </div>
          )}
          {mainView === 'conflicts' && (
            <div className="api-mock-conflicts-page" data-testid="api-mock-conflicts-page">
              <div className="am-runtime-header">
                <div>
                  <div className="am-page-title">Conflict Inspector</div>
                  <div className="am-page-subtitle">
                    {(conflictFindings.length || conflictIds.length)} finding{(conflictFindings.length || conflictIds.length) === 1 ? '' : 's'}
                    {conflictStats ? ` · ${conflictStats.analyzedRules} rules · ${conflictStats.durationMs} ms` : ''}
                  </div>
                </div>
                <span className="am-spacer" />
                <button type="button" className="am-btn" onClick={() => { void handleAnalyzeConflicts(); }} data-testid="api-mock-conflicts-analyze">
                  Re-analyze
                </button>
              </div>
              <div className="am-conflicts-page-body">
                <ApiMockConflictInspector
                  findings={conflictFindings}
                  routes={activeServer.routes}
                  focusRouteId={selectedRouteId}
                  onSelectRoute={id => { setSelectedRouteId(id); setMainView('studio'); }}
                  onSimulateWitness={handleSimulateWitness}
                  onAcknowledge={handleAcknowledgeConflict}
                  onAdjustPriority={handleAdjustPriority}
                  settings={activeServer.settings}
                  stats={conflictStats}
                  onAnalyze={() => { void handleAnalyzeConflicts(); }}
                  onOpenStudio={() => setMainView('studio')}
                  onApply={() => { void handleApply(activeServer); }}
                  dirty={!!dirtyById[activeServer.id]}
                  serverHost={activeServer.host}
                  serverPort={activeServer.port}
                />
              </div>
            </div>
          )}
        </>
      )}
      {settingsOpen && activeServer && (
        <ApiMockServerSettingsModal
          server={activeServer}
          statusLabel={
            (runtime[activeServer.id]?.status ?? 'stopped') === 'running' ? 'Running'
              : (runtime[activeServer.id]?.status ?? 'stopped') === 'error' ? 'Error'
                : 'Stopped'
          }
          onSave={patch => handleUpdateServer(activeServer.id, patch)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {simulateOpen && activeServer && (
        (() => {
          const defaults = deriveSimulateDefaults(selectedRoute);
          return (
        <ApiMockSimulateModal
          server={activeServer}
          initialPath={simulateSeed?.path ?? defaults.initialPath}
          initialMethod={simulateSeed?.method ?? defaults.initialMethod}
          onClose={() => { setSimulateOpen(false); setSimulateSeed(undefined); }}
        />
          );
        })()
      )}
      {importOpen && activeServer && (
        <AppModalFrame
          title="Import & Promotion"
          onClose={() => setImportOpen(false)}
          dialogClassName="modal am-studio-modal"
          bodyClassName="am-studio-modal-body"
          footerClassName="am-studio-modal-footer"
          showExpandButton={false}
          closeOnOverlayClick={false}
          footer={
            <div className="api-mock-root am-in-modal am-modal-toolbar" style={{ width: '100%' }}>
              <span className="am-faint">Imported rules stay inactive until you enable them.</span>
              <span className="am-spacer" />
              <button className="am-btn" onClick={() => setImportOpen(false)} data-testid="api-mock-import-close">Cancel</button>
            </div>
          }
        >
          <ApiMockImportReview
            key={importSource}
            folders={activeServer.folders}
            initialSource={importSource}
            onImport={handleImportRoutes}
            onCancel={() => setImportOpen(false)}
          />
        </AppModalFrame>
      )}
      {confirmDialogElement}
    </div>
  );
}
