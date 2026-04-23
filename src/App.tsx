import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isTauri } from './utils/platform';
import type { TestRun, RequestCollection, Environment, Microservice, FeatureGroup, GlobalAuthProfile } from './types';
import type { CatalogEntry, SavedEndpointValues } from './types/catalog';
import { buildCatalogExport } from './utils/catalogExport';
import { findFolderDeep } from './utils/requestTree';
import { loadTestRuns, saveTheme, loadCatalogEndpointValues } from './utils/storage';
import { useProjects } from './hooks/useProjects';
import { useRequests } from './hooks/useRequests';
import { useCatalog } from './hooks/useCatalog';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import Requests from './pages/Requests';
import ApiCatalog from './pages/ApiCatalog';
import CatalogSidebar from './components/catalog/CatalogSidebar';
import CatalogImportModal from './components/catalog/CatalogImportModal';
import CatalogVersionHistory from './components/catalog/CatalogVersionHistory';
import CatalogEditModal from './components/catalog/CatalogEditModal';
import CatalogSendToRequestsModal from './components/catalog/CatalogSendToRequestsModal';
import type { SendToRequestsPayload } from './components/catalog/CatalogSendToRequestsModal';
import ExportCenter from './components/ExportCenter';
import ImportCenter from './components/ImportCenter';
import Sidebar from './components/Sidebar';
import RequestsSidebar from './components/requests/RequestsSidebar';
import SettingsModal from './components/SettingsModal';
import EnvironmentManager from './pages/EnvironmentManager';
import WorkflowDesigner from './pages/WorkflowDesigner';
import WorkflowExecutionHistory from './pages/WorkflowExecutionHistory';
import WebhookDeliveryLogs from './pages/WebhookDeliveryLogs';
import WorkflowSidebar from './components/workflow/WorkflowSidebar';
import ServerStatusIndicator from './components/workflow/ServerStatusIndicator';
// WorkflowRequestsSettingsModal removed — replaced by WorkflowServiceRegistryModal in WorkflowDesigner
import { useWorkflows } from './hooks/useWorkflows';
import type { SampleWorkflowEntry } from './data/sampleWorkflows';
import type { Workflow } from './types/workflow';
import RequestCollectionModal from './components/requests/RequestCollectionModal';
import SubCollectionModal from './components/requests/SubCollectionModal';
import './styles/index.css';

type Tab = 'environments' | 'requests' | 'catalog' | 'workflow' | 'workflow-executions' | 'webhook-deliveries' | 'scenarios' | 'runner' | 'results';

const HARNESS_TABS = new Set<Tab>(['scenarios', 'runner', 'results']);
const isHarnessTab = (t: Tab) => HARNESS_TABS.has(t);
const WORKFLOW_TABS = new Set<Tab>(['workflow', 'workflow-executions', 'webhook-deliveries']);
const isWorkflowTab = (t: Tab) => WORKFLOW_TABS.has(t);

const ALL_TABS = new Set<Tab>(['environments', 'requests', 'catalog', 'workflow', 'workflow-executions', 'webhook-deliveries', 'scenarios', 'runner', 'results']);
const TAB_QUERY = 'tab';
const DEFAULT_TAB: Tab = 'requests';

/** Read active tab from ?tab= so refresh keeps Environments / Workflow / Harness / etc. */
function readTabFromUrl(): Tab {
  try {
    const q = new URLSearchParams(window.location.search).get(TAB_QUERY);
    if (q && ALL_TABS.has(q as Tab)) return q as Tab;
  } catch {
    /* ignore */
  }
  return DEFAULT_TAB;
}

function writeTabToUrl(tab: Tab): void {
  try {
    const url = new URL(window.location.href);
    if (tab === DEFAULT_TAB) {
      url.searchParams.delete(TAB_QUERY);
    } else {
      url.searchParams.set(TAB_QUERY, tab);
    }
    const serialized = url.pathname + (url.search ? url.search : '') + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (serialized !== current) {
      window.history.replaceState(window.history.state, '', serialized);
    }
  } catch {
    /* ignore */
  }
}

declare const __APP_VERSION__: string;

export default function App() {
  const {
    loading,
    environments, setEnvironments,
    microservices, setMicroservices,
    featureGroups, setFeatureGroups,
    appGlobalAuthProfiles, setAppGlobalAuthProfiles,
    selectedEnvId, setSelectedEnvId,
    selectedSvcId, setSelectedSvcId,
    moveScenario, moveTest,
    initialTheme, initialTestRuns,
  } = useProjects();

  const wb = useRequests();
  const catalog = useCatalog();
  const wfHook = useWorkflows();

  // ---- App shell state ----
  const [activeTab, setActiveTab] = useState<Tab>(() => readTabFromUrl());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizingRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showImportCenter, setShowImportCenter] = useState(false);
  const [testRunsCache, setTestRunsCache] = useState<TestRun[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showWbCollectionModal, setShowWbCollectionModal] = useState(false);
  const [editingWbCollection, setEditingWbCollection] = useState<RequestCollection | null>(null);
  const [editingSubCol, setEditingSubCol] = useState<{ colId: string; folderId: string } | null>(null);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [catalogReimportId, setCatalogReimportId] = useState<string | undefined>();
  const [catalogVersionHistoryId, setCatalogVersionHistoryId] = useState<string | undefined>();
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);
  const [catalogEditId, setCatalogEditId] = useState<string | undefined>();
  const [sendToReqEntry, setSendToReqEntry] = useState<CatalogEntry | undefined>();
  const [sendToReqEpValues, setSendToReqEpValues] = useState<Record<string, SavedEndpointValues>>({});

  useEffect(() => {
    if (sendToReqEntry) {
      loadCatalogEndpointValues(sendToReqEntry.id).then(setSendToReqEpValues);
    } else {
      setSendToReqEpValues({});
    }
  }, [sendToReqEntry]);

  const subColForEdit = useMemo(() => {
    if (!editingSubCol) return null;
    const col = wb.collections.find(c => c.id === editingSubCol.colId);
    const folder = col ? findFolderDeep(col.folders ?? [], editingSubCol.folderId) : null;
    return col && folder ? { col, folder } : null;
  }, [editingSubCol, wb.collections]);

  // ---- Sync theme from loaded data ----
  useEffect(() => {
    if (!loading) {
      setTheme(initialTheme as 'dark' | 'light');
      setTestRunsCache(initialTestRuns);
    }
  }, [loading, initialTheme, initialTestRuns]);

  // Keep ?tab= in sync so refresh restores Workflow / Catalog / Harness / etc.
  useEffect(() => {
    writeTabToUrl(activeTab);
  }, [activeTab]);

  // ---- Header height sync ----
  const headerRef = useRef<HTMLElement>(null);
  const syncHeaderHeight = useCallback(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty('--header-h', `${headerRef.current.offsetHeight}px`);
    }
  }, []);
  useEffect(() => {
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    return () => window.removeEventListener('resize', syncHeaderHeight);
  }, [syncHeaderHeight]);

  // ---- Sidebar resize ----
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.min(600, Math.max(180, startW + ev.clientX - startX));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ---- Theme ----
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // ---- Derived view state ----
  const selectedEnv = environments.find((e) => e.id === selectedEnvId);
  const selectedSvc = microservices.find((s) => s.id === selectedSvcId);
  const resolvedBaseUrl = selectedEnv && selectedSvc ? (selectedSvc.baseUrls[selectedEnv.id] ?? '') : '';

  const envAuthProfileId = selectedSvc?.authProfileIds?.[selectedEnvId];
  const envFallbackAuth = envAuthProfileId
    ? appGlobalAuthProfiles.find((p) => p.id === envAuthProfileId)?.auth
    : undefined;

  const filteredFeatureGroups = (selectedSvcId && selectedEnvId)
    ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && fg.environmentId === selectedEnvId)
    : selectedSvcId
      ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId)
      : [];

  const svcIds = new Set(microservices.map((s) => s.id));
  const envIds = new Set(environments.map((e) => e.id));
  const needsEnvAssignment = selectedSvcId
    ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && !fg.environmentId)
    : [];
  const fullyUnassociated = featureGroups.filter((fg) => !fg.microserviceId);
  const orphanedFGs = featureGroups.filter((fg) =>
    (fg.microserviceId && !svcIds.has(fg.microserviceId)) ||
    (fg.environmentId && !envIds.has(fg.environmentId))
  );
  const seenIds = new Set([...needsEnvAssignment, ...fullyUnassociated].map((fg) => fg.id));
  const unassociatedFeatureGroups = [
    ...needsEnvAssignment,
    ...fullyUnassociated,
    ...orphanedFGs.filter((fg) => !seenIds.has(fg.id)),
  ];

  // ---- Helpers ----
  const confirm = (message: string, onConfirm: () => void) => setConfirmAction({ message, onConfirm });

  const [newColGroupId, setNewColGroupId] = useState<string | undefined>();
  const [newColMode, setNewColMode] = useState<'direct' | 'multi-env' | undefined>();
  const handleWbNewCollection = useCallback((mode?: 'direct' | 'multi-env', groupId?: string) => {
    setNewColMode(mode); setNewColGroupId(groupId);
    setEditingWbCollection(null); setShowWbCollectionModal(true);
  }, []);
  const handleWbEditCollection = useCallback((col: RequestCollection) => {
    setEditingWbCollection(col); setShowWbCollectionModal(true);
  }, []);
  const handleWbSaveCollection = useCallback((col: Omit<RequestCollection, 'id' | 'requests'> & { id?: string }) => {
    if (col.id) {
      wb.updateCollection(col.id, { name: col.name, mode: col.mode, microserviceId: col.microserviceId, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    } else {
      wb.addCollection({ name: col.name, mode: col.mode, groupId: newColGroupId, microserviceId: col.microserviceId, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    }
    setShowWbCollectionModal(false); setEditingWbCollection(null); setNewColGroupId(undefined); setNewColMode(undefined);
  }, [wb, newColGroupId]);
  const handleWbNewRequest = useCallback((colId: string, folderId?: string) => {
    wb.addRequest(colId, folderId);
    if (activeTab !== 'requests') setActiveTab('requests');
  }, [wb, activeTab]);
  const handleEditSubCollection = useCallback((colId: string, folderId: string) => {
    setEditingSubCol({ colId, folderId });
  }, []);

  const handleSendToRequests = useCallback((entry: CatalogEntry) => {
    setSendToReqEntry(entry);
  }, []);

  const handleSendToReqConfirm = useCallback((payload: SendToRequestsPayload) => {
    if (sendToReqEntry) {
      catalog.updateEntry(sendToReqEntry.id, { customEndpointNames: payload.customNames });
    }

    let groupId: string | undefined;
    if (payload.newGroupName) {
      groupId = wb.addGroup(payload.newGroupName);
    } else if (payload.targetGroupId) {
      groupId = payload.targetGroupId;
    }

    const currentVersion = sendToReqEntry?.versions.find(v => v.id === sendToReqEntry.currentVersionId);
    const existingWbEnvNames = new Map(wb.environments.map(e => [e.name, e.id]));

    const { collection, newEnvironments } = buildCatalogExport(payload, {
      servers: sendToReqEntry?.servers ?? [],
      microserviceId: sendToReqEntry?.microserviceId,
      versionLabel: currentVersion?.version,
      existingWbEnvNames,
      groupId,
      catalogEntryName: sendToReqEntry?.name,
    });

    if (newEnvironments.length > 0) wb.addEnvironments(newEnvironments);
    wb.importCollection(collection);
    setSendToReqEntry(undefined);
    setActiveTab('requests');
  }, [wb, sendToReqEntry, catalog]);

  const handleImportData = useCallback(async (data: {
    environments?: Environment[];
    microservices?: Microservice[];
    featureGroups?: FeatureGroup[];
    globalAuthProfiles?: GlobalAuthProfile[];
  }) => {
    if (data.environments?.length) {
      setEnvironments((prev) => {
        const ids = new Set(prev.map(e => e.id));
        return [...prev, ...data.environments!.filter(e => !ids.has(e.id))];
      });
    }
    if (data.microservices?.length) {
      setMicroservices((prev) => {
        const ids = new Set(prev.map(s => s.id));
        return [...prev, ...data.microservices!.filter(s => !ids.has(s.id))];
      });
    }
    if (data.featureGroups?.length) {
      setFeatureGroups((prev) => [...prev, ...data.featureGroups!]);
    }
    if (data.globalAuthProfiles?.length) {
      setAppGlobalAuthProfiles((prev) => {
        const ids = new Set(prev.map(a => a.id));
        return [...prev, ...data.globalAuthProfiles!.filter(a => !ids.has(a.id))];
      });
    }
    setShowImportCenter(false);
    setActiveTab('environments');
  }, [setEnvironments, setMicroservices, setFeatureGroups, setAppGlobalAuthProfiles]);

  // ---- Loading screen ----
  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', opacity: 0.7 }}>
          <h2>RedfireForge</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${sidebarCollapsed ? '' : 'sidebar-visible'}`}>
      <header ref={headerRef} className="app-header">
        <h1>🔥 RedfireForge {!isTauri() && <span style={{ fontSize: '0.65em', fontWeight: 400, opacity: 0.75, marginLeft: '0.5em' }}>Redfire Performance Workbench</span>}
          <span style={{ fontSize: '0.4em', fontWeight: 400, opacity: 0.5, marginLeft: '0.6em', verticalAlign: 'middle', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>v{__APP_VERSION__}</span>
        </h1>
        <div className="header-selectors">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="app-body">
      {!sidebarCollapsed && (
      <aside className="unified-sidebar" style={{ width: sidebarWidth }}>
        <nav className="usb-nav-rail">
          <button className={`usb-nav-btn ${activeTab === 'environments' ? 'active' : ''}`}
            onClick={() => setActiveTab('environments')}>Environments</button>
          <button className={`usb-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}>Requests</button>
          <button className={`usb-nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}>Catalog</button>
          <button className={`usb-nav-btn ${isWorkflowTab(activeTab) ? 'active' : ''}`}
            onClick={() => setActiveTab('workflow')}>Workflow</button>
          <button className={`usb-nav-btn ${isHarnessTab(activeTab) ? 'active' : ''}`}
            onClick={() => { if (!isHarnessTab(activeTab)) setActiveTab('scenarios'); }}>Harness</button>
        </nav>

        <div className="usb-content">
          <div style={{ display: activeTab === 'catalog' ? 'contents' : 'none' }}>
            {catalog.loaded && (
              <CatalogSidebar
                entries={catalog.entries}
                selectedEntryId={catalog.selectedEntryId}
                onSelectEntry={(id) => { catalog.selectEntry(id); setActiveTab('catalog'); }}
                onImport={() => { setCatalogReimportId(undefined); setShowCatalogImport(true); }}
                onReimport={(entryId) => { setCatalogReimportId(entryId); setShowCatalogImport(true); }}
                onDeleteEntry={catalog.removeEntry}
                onVersionHistory={(entryId) => setCatalogVersionHistoryId(entryId)}
                onEdit={(entryId) => setCatalogEditId(entryId)}
                onExportSpec={async (entryId) => {
                  const entry = catalog.entries.find(e => e.id === entryId);
                  if (!entry) return;
                  const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
                  if (!raw) return;
                  const blob = new Blob([raw], { type: 'text/yaml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${entry.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${entry.versions[0]?.version ?? 'unknown'}.yaml`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'requests' ? 'contents' : 'none' }}>
            {wb.loaded && (
              <RequestsSidebar
                collections={wb.collections}
                selectedCollectionId={wb.selectedCollection?.id}
                selectedRequestId={wb.selectedRequest?.id}
                onSelectCollection={(colId) => { wb.selectCollection(colId); setActiveTab('requests'); }}
                onSelectRequest={(colId, reqId) => { wb.selectRequest(colId, reqId); setActiveTab('requests'); }}
                onNewCollection={handleWbNewCollection}
                onEditCollection={handleWbEditCollection}
                onDeleteCollection={wb.removeCollection}
                onDuplicateCollection={wb.duplicateCollection}
                onNewRequest={handleWbNewRequest}
                onDeleteRequest={wb.removeRequest}
                onDuplicateRequest={wb.duplicateRequest}
                onAddFolder={wb.addFolder}
                onAddSubCollection={wb.addSubCollection}
                onEditSubCollection={handleEditSubCollection}
                onRenameFolder={wb.renameFolder}
                onDeleteFolder={wb.removeFolder}
                onDuplicateFolder={wb.duplicateFolder}
                onMoveFolder={wb.moveFolder}
                onMoveFolderTo={wb.moveFolderTo}
                onMoveRequest={wb.moveRequest}
                onMoveRequestToCollection={wb.moveRequestToCollection}
                onMoveFolderToCollection={wb.moveFolderToCollection}
                onMergeCollectionInto={wb.moveCollectionAsSubCollection}
                countAllRequests={wb.countAllRequests}
                onImportCollection={wb.importCollection}
                onImportFolder={wb.importFolder}
                onAddGroup={wb.addGroup}
                onRenameGroup={wb.renameGroup}
                onDeleteGroup={wb.deleteGroup}
                onMoveToGroup={wb.moveToGroup}
                onDuplicateGroup={wb.duplicateGroup}
              />
            )}
          </div>
          {isWorkflowTab(activeTab) && (
            <WorkflowSidebar
              workflows={wfHook.workflows}
              selectedId={wfHook.selectedId}
              onSelect={(id) => { wfHook.select(id); setActiveTab('workflow'); }}
              onNew={() => {
                const name = prompt('Workflow name:');
                if (name?.trim()) { wfHook.create(name.trim()); setActiveTab('workflow'); }
              }}
              onRename={(id) => {
                const target = wfHook.workflows.find((w) => w.id === id);
                if (!target) return;
                const name = prompt('Rename workflow:', target.name);
                if (!name?.trim()) return;
                wfHook.update(id, { name: name.trim() });
              }}
              onDelete={(id) => { wfHook.remove(id); }}
              onDuplicate={(id) => { wfHook.duplicate(id); }}
              onLoadSample={(entry: SampleWorkflowEntry) => {
                const sample = entry.factory();
                setPreviewWorkflow(sample);
              }}
            />
          )}
          {isHarnessTab(activeTab) && (
            <Sidebar
              environments={environments}
              microservices={microservices}
              featureGroups={featureGroups}
              selectedEnvId={selectedEnvId}
              selectedSvcId={selectedSvcId}
              onEnvSelect={setSelectedEnvId}
              onSvcSelect={setSelectedSvcId}
            />
          )}
        </div>

        <button className="usb-settings-btn" onClick={() => setShowSettings(true)}>⚙ Settings</button>
      </aside>
      )}
      {!sidebarCollapsed && (
        <div className="usb-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <button
        className={`usb-toggle-btn ${sidebarCollapsed ? 'collapsed' : ''}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

        <main className="app-main">
          {(isHarnessTab(activeTab) || isWorkflowTab(activeTab)) && (
            <div className="main-top-nav">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <button className={`main-nav-tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>Feature Groups</button>
                <button className={`main-nav-tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>Test Runner</button>
                <button className={`main-nav-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button>
                <button
                  type="button"
                  className={`main-nav-tab ${activeTab === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActiveTab('workflow')}
                  title="Visual workflow designer (separate from feature groups)"
                >
                  Workflow
                </button>
                <button
                  type="button"
                  className={`main-nav-tab ${activeTab === 'workflow-executions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('workflow-executions')}
                  title="View webhook and schedule execution history"
                >
                  📊 Execution History
                </button>
                <button
                  type="button"
                  className={`main-nav-tab ${activeTab === 'webhook-deliveries' ? 'active' : ''}`}
                  onClick={() => setActiveTab('webhook-deliveries')}
                  title="View raw webhook delivery logs"
                >
                  🪝 Webhook Logs
                </button>
              </div>
              {isWorkflowTab(activeTab) && (
                <div style={{ marginLeft: 'auto', paddingRight: '12px' }}>
                  <ServerStatusIndicator />
                </div>
              )}
            </div>
          )}
          {/* Keep mounted when hidden so canvas state (per-step initial variables, etc.) survives tab switches; still persisted via Save + storage on refresh. */}
          <div hidden={activeTab !== 'workflow'} className="workflow-designer-mount">
            <WorkflowDesigner
              collections={wb.collections}
              catalogEntries={catalog.entries}
              wfHook={wfHook}
              environments={environments}
              microservices={microservices}
              globalAuthProfiles={appGlobalAuthProfiles}
              selectedEnvId={selectedEnvId}
              selectedSvcId={selectedSvcId}
              onEnvSelect={setSelectedEnvId}
              onSvcSelect={setSelectedSvcId}
              resolvedBaseUrl={resolvedBaseUrl}
              previewWorkflow={previewWorkflow}
              onClearPreview={() => setPreviewWorkflow(null)}
              onUseAsTemplate={(wf) => {
                const copy = { ...structuredClone(wf), id: crypto.randomUUID(), name: wf.name.replace(/^Sample: /, ''), createdAt: Date.now(), updatedAt: Date.now() };
                wfHook.insert(copy);
                setPreviewWorkflow(null);
              }}
            />
          </div>
          {activeTab === 'workflow-executions' && (
            <WorkflowExecutionHistory />
          )}
          {activeTab === 'webhook-deliveries' && (
            <WebhookDeliveryLogs />
          )}
          {activeTab === 'environments' && (
            <EnvironmentManager
              environments={environments}
              setEnvironments={setEnvironments}
              microservices={microservices}
              setMicroservices={setMicroservices}
              appGlobalAuthProfiles={appGlobalAuthProfiles}
              confirm={confirm}
            />
          )}

          {activeTab === 'scenarios' && (
            <ScenarioBuilder
              featureGroups={filteredFeatureGroups}
              setFeatureGroups={setFeatureGroups}
              resolvedBaseUrl={resolvedBaseUrl}
              selectedSvcId={selectedSvcId}
              selectedSvcName={selectedSvc?.name}
              selectedEnvId={selectedEnvId}
              selectedEnvName={selectedEnv?.name}
              unassociatedFeatureGroups={unassociatedFeatureGroups}
              microservices={microservices}
              environments={environments}
              globalAuthProfiles={appGlobalAuthProfiles}
              onMoveScenario={moveScenario}
              onMoveTest={moveTest}
            />
          )}
          {/* Keep TestRunner mounted so in-flight tests survive tab switches */}
          <div hidden={activeTab !== 'runner'}>
            <TestRunner
              featureGroups={filteredFeatureGroups}
              onComplete={() => setActiveTab('results')}
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              envId={selectedEnvId}
              svcId={selectedSvcId}
              resolvedBaseUrl={resolvedBaseUrl}
              globalAuthProfiles={appGlobalAuthProfiles}
              envFallbackAuth={envFallbackAuth}
            />
          </div>
          {activeTab === 'results' && (
            <ResultsDashboard
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
            />
          )}
          <div className="app-tab-pane" style={{ display: activeTab === 'catalog' ? 'flex' : 'none' }}>
            <ApiCatalog
              catalog={catalog}
              onImport={() => { setCatalogReimportId(undefined); setShowCatalogImport(true); }}
              onReimport={(entryId) => { setCatalogReimportId(entryId); setShowCatalogImport(true); }}
              onVersionHistory={(entryId) => setCatalogVersionHistoryId(entryId)}
              onExportSpec={async (entryId) => {
                const entry = catalog.entries.find(e => e.id === entryId);
                if (!entry) return;
                const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
                if (!raw) return;
                const blob = new Blob([raw], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${entry.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${entry.versions[0]?.version ?? 'unknown'}.yaml`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              onSendToRequests={handleSendToRequests}
              onEditEntry={(entryId) => setCatalogEditId(entryId)}
              globalAuthProfiles={appGlobalAuthProfiles}
              appEnvironments={environments}
              appMicroservices={microservices}
            />
          </div>
          <div className="app-tab-pane" style={{ display: activeTab === 'requests' ? 'flex' : 'none' }}>
            <Requests
              wb={wb}
              appGlobalAuthProfiles={appGlobalAuthProfiles}
              appMicroservices={microservices}
              appEnvironments={environments}
            />
          </div>
          {sendToReqEntry && (
            <CatalogSendToRequestsModal
              entry={sendToReqEntry}
              appEnvironments={environments}
              appMicroservices={microservices}
              savedEpValues={sendToReqEpValues}
              collections={wb.collections}
              onSend={handleSendToReqConfirm}
              onClose={() => setSendToReqEntry(undefined)}
            />
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          setAppGlobalAuthProfiles={setAppGlobalAuthProfiles}
          onClose={() => setShowSettings(false)}
          onOpenExport={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowExportCenter(true); }}
          onOpenImport={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowImportCenter(true); }}
          confirm={confirm}
        />
      )}

      {showExportCenter && (
        <ExportCenter
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          testRuns={testRunsCache}
          onClose={() => { setShowExportCenter(false); setShowSettings(true); }}
        />
      )}

      {showImportCenter && (
        <ImportCenter
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          onImport={handleImportData}
          onClose={() => { setShowImportCenter(false); setShowSettings(true); }}
        />
      )}

      {showWbCollectionModal && (
        <RequestCollectionModal
          collection={editingWbCollection}
          collections={wb.collections}
          environments={wb.environments}
          appEnvironments={environments}
          appMicroservices={microservices}
          globalAuthProfiles={appGlobalAuthProfiles}
          defaultMode={newColMode}
          onSave={handleWbSaveCollection}
          onAddEnv={wb.addEnv}
          onClose={() => { setShowWbCollectionModal(false); setEditingWbCollection(null); setNewColGroupId(undefined); setNewColMode(undefined); }}
        />
      )}

      {editingSubCol && subColForEdit && (
        <SubCollectionModal
          subCollection={subColForEdit.folder}
          parentCollection={subColForEdit.col}
          environments={wb.environments}
          globalAuthProfiles={appGlobalAuthProfiles}
          onSave={(patch) => wb.updateSubCollection(editingSubCol.colId, editingSubCol.folderId, patch)}
          onClose={() => setEditingSubCol(null)}
        />
      )}

      {showCatalogImport && (
        <CatalogImportModal
          existingEntries={catalog.entries}
          reimportEntryId={catalogReimportId}
          onImport={(entry, rawSpec) => { catalog.addEntry(entry, rawSpec); setActiveTab('catalog'); }}
          onReimport={(entryId, parsed) => { catalog.addVersionToEntry(entryId, parsed); setActiveTab('catalog'); }}
          onClose={() => { setShowCatalogImport(false); setCatalogReimportId(undefined); }}
        />
      )}

      {catalogVersionHistoryId && (() => {
        const vhEntry = catalog.entries.find(e => e.id === catalogVersionHistoryId);
        if (!vhEntry) return null;
        return (
          <CatalogVersionHistory
            entry={vhEntry}
            onClose={() => setCatalogVersionHistoryId(undefined)}
            onSwitchVersion={(versionId) => catalog.switchVersion(catalogVersionHistoryId, versionId)}
            onReimport={() => { setCatalogReimportId(catalogVersionHistoryId); setShowCatalogImport(true); }}
            loadRawSpec={catalog.loadRawSpec}
          />
        );
      })()}

      {catalogEditId && (() => {
        const editEntry = catalog.entries.find(e => e.id === catalogEditId);
        if (!editEntry) return null;
        return (
          <CatalogEditModal
            entry={editEntry}
            microservices={microservices}
            environments={environments}
            onSave={(patch) => catalog.updateEntry(catalogEditId, patch)}
            onClose={() => setCatalogEditId(undefined)}
          />
        );
      })()}

      {confirmAction && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <div className="confirm-icon">&#9888;</div>
            <p className="confirm-title">Are you sure?</p>
            <p className="confirm-message">{confirmAction.message}</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
