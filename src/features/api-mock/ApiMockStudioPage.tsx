import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiMockConflictFindingV1, ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse, EMPTY_PREDICATE_GROUP } from '../../shared/api-mock/defaults';
import { API_MOCK_WORKSPACE_PANEL_ID, type ApiMockRuntimeStatus } from './components/ApiMockServerTabs';
import { ApiMockStudioTitleBar } from './components/ApiMockStudioTitleBar';
import { ApiMockServerBar } from './components/ApiMockServerBar';
import { ApiMockRouteExplorer } from './components/ApiMockRouteExplorer';
import { ApiMockRouteEditor } from './components/ApiMockRouteEditor';
import { ApiMockDock } from './components/ApiMockDock';
import { conflictPeerLabel } from './components/ApiMockConflictInspector';
import { ApiMockServerSettingsModal } from './components/ApiMockServerSettingsModal';
import { ApiMockSimulateModal } from './components/ApiMockSimulateModal';
import { ApiMockImportReview } from './components/ApiMockImportReview';
import { loadApiMockWorkspace, saveApiMockWorkspace } from './apiMockPersistence';
import { apiMockControlClient } from './apiMockControlClient';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import { exportWorkspace } from '../../shared/api-mock/exportUtils';
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
  mergeRuntimeInfo,
  parsePortOwnerServerId,
  pickNextAutoPort,
  removeClosedServer,
  runConflictAnalysis,
} from './apiMockPageHelpers';
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
  const [importOpen, setImportOpen] = useState(false);
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [conflictFindings, setConflictFindings] = useState<ApiMockConflictFindingV1[]>([]);
  const [dockTabRequest, setDockTabRequest] = useState<'conflicts' | undefined>();
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

  // Poll the running server's transaction journal for the live dock view.
  const activeStatus = runtime[activeServerId ?? '']?.status;
  useEffect(() => {
    setTransactions([]);
    setScenarioState(null);
    if (!activeServerId || activeStatus !== 'running') return;
    let cancelled = false;
    const poll = async () => {
      const [txRes, stRes] = await Promise.all([
        apiMockControlClient.transactions(activeServerId),
        apiMockControlClient.state(activeServerId),
      ]);
      if (cancelled) return;
      if (txRes.ok) setTransactions([...txRes.data.transactions].reverse());
      if (stRes.ok) setScenarioState(stRes.data);
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

  const handleCreateRoute = useCallback(() => {
    if (!activeServerId) return;
    const route = createRoute(`New Route ${(activeServer?.routes.length ?? 0) + 1}`);
    handleUpdateServer(activeServerId, { routes: [...(activeServer?.routes ?? []), route] });
    setSelectedRouteId(route.id);
    setLiveMessage(`${route.name} added.`);
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

  const handleImportRoutes = useCallback((routes: ApiMockServerDefinitionV1['routes']) => {
    if (!activeServerId || !activeServer || routes.length === 0) return;
    handleUpdateServer(activeServerId, { routes: [...activeServer.routes, ...routes] });
    setSelectedRouteId(routes[0].id);
    setImportOpen(false);
    setLiveMessage(formatImportedRoutesMessage(routes.length));
  }, [activeServerId, activeServer, handleUpdateServer]);

  const handleAnalyzeConflicts = useCallback(async () => {
    await runConflictAnalysis(
      activeServer,
      analyzeConflicts,
      setConflictIds,
      setLiveMessage,
      findings => setConflictFindings(findings as ApiMockConflictFindingV1[]),
    );
  }, [activeServer]);

  const openConflictInspector = useCallback(() => {
    setDockTabRequest('conflicts');
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

  const handleExport = useCallback(() => {
    const payload = exportWorkspace(
      { schemaVersion: 1, servers, activeServerId, tabOrder: servers.map(s => s.id) },
      { scope: 'workspace', redact: true },
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-mock-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLiveMessage('Workspace exported.');
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
        onImportCurl={() => setImportOpen(true)}
        onExport={handleExport}
      />
      {activeServer && (
        <>
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
          />
          <div
            className="api-mock-workspace"
            id={API_MOCK_WORKSPACE_PANEL_ID}
            role="tabpanel"
            aria-labelledby={`api-mock-tabhdr-${activeServer.id}`}
          >
            <ApiMockRouteExplorer
              routes={activeServer.routes}
              folders={activeServer.folders}
              selectedRouteId={selectedRouteId}
              onSelect={setSelectedRouteId}
              onCreate={handleCreateRoute}
              onDelete={handleDeleteRoute}
              onToggle={(id, enabled) => handleUpdateRoute(id, { enabled })}
              onAddFolder={handleAddFolder}
              onToggleFolder={handleToggleFolder}
              conflictRouteIds={conflictIds}
              onAnalyze={() => { void handleAnalyzeConflicts(); }}
            />
            <div className="api-mock-editor">
              {selectedRoute ? (
                <ApiMockRouteEditor
                  route={selectedRoute}
                  onUpdate={patch => handleUpdateRoute(selectedRoute.id, patch)}
                  hasConflict={conflictIds.includes(selectedRoute.id)}
                  conflictPeer={conflictPeerLabel(conflictFindings, selectedRoute.id, activeServer.routes)}
                  matchCount={transactions.filter(t => t.matchedRouteId === selectedRoute.id).length}
                  onSimulate={() => setSimulateOpen(true)}
                  onDelete={() => confirmDeleteRoute(selectedRoute)}
                  onReviewConflicts={openConflictInspector}
                  folderName={selectedFolderName}
                  samples={activeServer.samples}
                />
              ) : (
                <div className="api-mock-no-selection" data-testid="api-mock-no-route">
                  Select a route or create one to begin editing.
                </div>
              )}
            </div>
          </div>
          <ApiMockDock
            routes={activeServer.routes}
            conflictCount={conflictFindings.length || conflictIds.length}
            conflictFindings={conflictFindings}
            focusConflictRouteId={selectedRouteId}
            requestedTab={dockTabRequest}
            onRequestedTabConsumed={() => setDockTabRequest(undefined)}
            onSelectRoute={setSelectedRouteId}
            onSimulateWitness={() => setSimulateOpen(true)}
            transactions={transactions}
            running={runtime[activeServer.id]?.status === 'running'}
            variables={activeServer.variables}
            liveState={scenarioState}
            onResetState={() => { void handleResetState(); }}
            onClearTransactions={() => { void handleClearTransactions(); }}
            consoleLines={consoleLines}
            onClearConsole={clearConsole}
            onOpenConflicts={() => { void handleAnalyzeConflicts(); }}
          />
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
          const { initialPath, initialMethod } = deriveSimulateDefaults(selectedRoute);
          return (
        <ApiMockSimulateModal
          server={activeServer}
          initialPath={initialPath}
          initialMethod={initialMethod}
          onClose={() => setSimulateOpen(false)}
        />
          );
        })()
      )}
      {importOpen && activeServer && (
        <AppModalFrame title="Import & Promotion" onClose={() => setImportOpen(false)}>
          <div style={{ width: 'min(860px, 82vw)', height: 'min(560px, 72vh)', display: 'flex' }}>
            <ApiMockImportReview onImport={handleImportRoutes} onCancel={() => setImportOpen(false)} />
          </div>
        </AppModalFrame>
      )}
      {confirmDialogElement}
    </div>
  );
}
