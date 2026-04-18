import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isTauri } from './utils/platform';
import type { Project, TestRun, WorkbenchCollection, WorkbenchRequest, KeyValue } from './types';
import type { CatalogEntry, CatalogEndpoint } from './types/catalog';
import { resolveBaseUrl } from './utils/catalogCurlGenerator';
import { generateStubJson } from './utils/schemaStubGenerator';
import { findFolderDeep } from './utils/workbenchTree';
import { loadTestRuns, saveTheme } from './utils/storage';
import { createEmptyProject } from './utils/helpers';
import { useProjects } from './hooks/useProjects';
import { useWorkbench } from './hooks/useWorkbench';
import { useCatalog } from './hooks/useCatalog';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import Workbench from './pages/Workbench';
import ApiCatalog from './pages/ApiCatalog';
import CatalogSidebar from './components/catalog/CatalogSidebar';
import CatalogImportModal from './components/catalog/CatalogImportModal';
import CatalogVersionHistory from './components/catalog/CatalogVersionHistory';
import ExportCenter from './components/ExportCenter';
import ImportCenter from './components/ImportCenter';
import Sidebar from './components/Sidebar';
import WorkbenchSidebar from './components/workbench/WorkbenchSidebar';
import SettingsModal from './components/SettingsModal';
import WorkbenchCollectionModal from './components/workbench/WorkbenchCollectionModal';
import WorkbenchEnvManager from './components/workbench/WorkbenchEnvManager';
import SubCollectionModal from './components/workbench/SubCollectionModal';
import './styles/index.css';

type Tab = 'workbench' | 'catalog' | 'scenarios' | 'runner' | 'results';

declare const __APP_VERSION__: string;

export default function App() {
  const {
    loading, projects, setProjects, selectedProjectId, setSelectedProjectId,
    selectedProject, appGlobalAuthProfiles, setAppGlobalAuthProfiles,
    environments, microservices, globalAuthProfiles, featureGroups,
    selectedEnvId, selectedSvcId,
    setFeatureGroups, setSelectedEnvId, setSelectedSvcId, modifyProject,
    moveFeatureGroup, moveScenario, moveTest,
    initialTheme, initialTestRuns,
  } = useProjects();

  const wb = useWorkbench();
  const catalog = useCatalog();

  // ---- App shell state ----
  const [activeTab, setActiveTab] = useState<Tab>('workbench');
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
  const [editingWbCollection, setEditingWbCollection] = useState<import('./types').WorkbenchCollection | null>(null);
  const [showWbEnvManager, setShowWbEnvManager] = useState(false);
  const [editingSubCol, setEditingSubCol] = useState<{ colId: string; folderId: string } | null>(null);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [catalogReimportId, setCatalogReimportId] = useState<string | undefined>();
  const [catalogVersionHistoryId, setCatalogVersionHistoryId] = useState<string | undefined>();

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


  const addProject = (name: string, desc?: string) => {
    const project = createEmptyProject(name, desc);
    setProjects((prev) => [...prev, project]);
    setSelectedProjectId(project.id);
  };

  const removeProject = (id: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedProjectId === id) {
        const newSel = next.length > 0 ? next[0].id : '';
        setTimeout(() => setSelectedProjectId(newSel), 0);
      }
      return next;
    });
  };

  const updateProjectMeta = (id: string, updates: { name?: string; description?: string }) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  };

  const handleWbNewCollection = useCallback(() => {
    setEditingWbCollection(null); setShowWbCollectionModal(true);
  }, []);
  const handleWbEditCollection = useCallback((col: import('./types').WorkbenchCollection) => {
    setEditingWbCollection(col); setShowWbCollectionModal(true);
  }, []);
  const handleWbSaveCollection = useCallback((col: Omit<import('./types').WorkbenchCollection, 'id' | 'requests'> & { id?: string }) => {
    if (col.id) {
      wb.updateCollection(col.id, { name: col.name, mode: col.mode, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    } else {
      wb.addCollection({ name: col.name, mode: col.mode, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    }
    setShowWbCollectionModal(false); setEditingWbCollection(null);
  }, [wb]);
  const handleWbNewRequest = useCallback((colId: string, folderId?: string) => {
    wb.addRequest(colId, folderId);
    if (activeTab !== 'workbench') setActiveTab('workbench');
  }, [wb, activeTab]);
  const handleEditSubCollection = useCallback((colId: string, folderId: string) => {
    setEditingSubCol({ colId, folderId });
  }, []);

  const handleSendToWorkbench = useCallback((entry: CatalogEntry) => {
    const baseUrl = resolveBaseUrl(entry.hostConfig, entry.servers);
    const allEps: CatalogEndpoint[] = [...entry.endpoints];
    const walk = (folders: CatalogEntry['folders']) => {
      for (const f of folders) { allEps.push(...f.endpoints); walk(f.folders); }
    };
    walk(entry.folders);

    const requests: WorkbenchRequest[] = allEps.map(ep => {
      const headers: KeyValue[] = ep.parameters
        .filter(p => p.in === 'header')
        .map(p => ({ key: p.name, value: p.example ? String(p.example) : '' }));

      const queryParams = ep.parameters
        .filter(p => p.in === 'query')
        .map(p => ({ key: p.name, value: p.example ? String(p.example) : '', enabled: true }));

      let pathUrl = ep.path;
      for (const p of ep.parameters.filter(pp => pp.in === 'path')) {
        pathUrl = pathUrl.replace(`{${p.name}}`, p.example ? String(p.example) : `{${p.name}}`);
      }

      const jsonCT = ep.requestBody?.contentTypes.find(ct => ct.mediaType.includes('json'));
      const body = jsonCT?.schema ? generateStubJson(jsonCT.schema) : '';

      return {
        id: uuidv4(),
        name: ep.summary || `${ep.method} ${ep.path}`,
        method: ep.method,
        url: `${baseUrl}${pathUrl}`,
        headers,
        body,
        bodyType: body ? 'json' as const : undefined,
        auth: { type: 'none' as const },
        savedQueryParams: queryParams,
      };
    });

    const col: WorkbenchCollection = {
      id: uuidv4(),
      name: `${entry.name} (from Catalog)`,
      mode: 'direct',
      requests,
      folders: [],
    };

    wb.importCollection(col);
    setActiveTab('workbench');
  }, [wb]);

  const handleImportProject = useCallback(async (imported: Project) => {
    setProjects((prev) => {
      const existing = prev.find((p) => p.id === imported.id);
      if (existing) return prev.map((p) => p.id === imported.id ? imported : p);
      return [...prev, imported];
    });
    setSelectedProjectId(imported.id);
    setShowImportCenter(false);
    setShowSettings(true);
  }, [setProjects, setSelectedProjectId]);

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
        {/* ── Top bar: section switcher ── */}
        <div className="usb-top-bar">
          <button className={`usb-top-tab ${activeTab === 'workbench' ? 'active' : ''}`}
            onClick={() => setActiveTab('workbench')}>Workbench</button>
          <button className={`usb-top-tab ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}>Catalog</button>
          <button className={`usb-top-tab ${activeTab !== 'workbench' && activeTab !== 'catalog' ? 'active' : ''}`}
            onClick={() => { if (activeTab === 'workbench' || activeTab === 'catalog') setActiveTab('scenarios'); }}>Projects</button>
        </div>

        {/* ── Content area ── */}
        <div className="usb-content">
          {activeTab === 'catalog' ? (
            catalog.loaded && (
              <CatalogSidebar
                entries={catalog.entries}
                selectedEntryId={catalog.selectedEntryId}
                onSelectEntry={(id) => { catalog.selectEntry(id); setActiveTab('catalog'); }}
                onImport={() => { setCatalogReimportId(undefined); setShowCatalogImport(true); }}
                onReimport={(entryId) => { setCatalogReimportId(entryId); setShowCatalogImport(true); }}
                onDeleteEntry={catalog.removeEntry}
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
              />
            )
          ) : activeTab === 'workbench' ? (
            wb.loaded && (
              <WorkbenchSidebar
                collections={wb.collections}
                selectedCollectionId={wb.selectedCollection?.id}
                selectedRequestId={wb.selectedRequest?.id}
                onSelectCollection={(colId) => { wb.selectCollection(colId); setActiveTab('workbench'); }}
                onSelectRequest={(colId, reqId) => { wb.selectRequest(colId, reqId); setActiveTab('workbench'); }}
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
                onManageEnvs={() => setShowWbEnvManager(true)}
                countAllRequests={wb.countAllRequests}
                onImportCollection={wb.importCollection}
                onImportFolder={wb.importFolder}
              />
            )
          ) : (
            <>
              <Sidebar
                projects={projects}
                selectedProjectId={selectedProjectId}
                environments={environments}
                microservices={microservices}
                featureGroups={featureGroups}
                selectedEnvId={selectedEnvId}
                selectedSvcId={selectedSvcId}
                onProjectSwitch={setSelectedProjectId}
                onEnvSelect={setSelectedEnvId}
                onSvcSelect={setSelectedSvcId}
                onOpenSettings={() => setShowSettings(true)}
              />
            </>
          )}
        </div>

        {/* ── Shared Settings button ── */}
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
          {activeTab !== 'workbench' && activeTab !== 'catalog' && (
            <div className="main-top-nav">
              <button className={`main-nav-tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>Feature Groups</button>
              <button className={`main-nav-tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>Test Runner</button>
              <button className={`main-nav-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button>
            </div>
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
              projectAuthProfiles={globalAuthProfiles}
              projects={projects}
              currentProjectId={selectedProjectId}
              onMoveFeatureGroup={moveFeatureGroup}
              onMoveScenario={moveScenario}
              onMoveTest={moveTest}
            />
          )}
          {activeTab === 'runner' && (
            <TestRunner
              featureGroups={filteredFeatureGroups}
              onComplete={() => setActiveTab('results')}
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              projectName={selectedProject?.name}
              projectId={selectedProject?.id}
              envId={selectedEnvId}
              svcId={selectedSvcId}
              resolvedBaseUrl={resolvedBaseUrl}
              globalAuthProfiles={[...appGlobalAuthProfiles, ...globalAuthProfiles]}
            />
          )}
          {activeTab === 'results' && (
            <ResultsDashboard
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              projectName={selectedProject?.name}
            />
          )}
          {activeTab === 'catalog' && (
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
              onSendToWorkbench={handleSendToWorkbench}
            />
          )}
          {activeTab === 'workbench' && (
            <Workbench
              wb={wb}
              appGlobalAuthProfiles={appGlobalAuthProfiles}
            />
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          projects={projects}
          setProjects={setProjects}
          selectedProjectId={selectedProjectId}
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          setAppGlobalAuthProfiles={setAppGlobalAuthProfiles}
          modifyProject={modifyProject}
          onClose={() => setShowSettings(false)}
          onProjectSwitch={setSelectedProjectId}
          onAddProject={addProject}
          onRemoveProject={removeProject}
          onUpdateProjectMeta={updateProjectMeta}
          onOpenExport={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowExportCenter(true); }}
          onOpenImport={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowImportCenter(true); }}
          confirm={confirm}
        />
      )}

      {showExportCenter && selectedProject && (
        <ExportCenter
          project={selectedProject}
          projects={projects}
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          testRuns={testRunsCache}
          onClose={() => { setShowExportCenter(false); setShowSettings(true); }}
        />
      )}

      {showImportCenter && (
        <ImportCenter
          projects={projects}
          appGlobalAuthProfiles={appGlobalAuthProfiles}
          onImport={handleImportProject}
          onImportGlobalAuth={(profiles) => setAppGlobalAuthProfiles((prev) => [...prev, ...profiles])}
          onClose={() => { setShowImportCenter(false); setShowSettings(true); }}
        />
      )}

      {showWbCollectionModal && (
        <WorkbenchCollectionModal
          collection={editingWbCollection}
          collections={wb.collections}
          environments={wb.environments}
          projects={projects}
          globalAuthProfiles={appGlobalAuthProfiles}
          onSave={handleWbSaveCollection}
          onAddEnv={wb.addEnv}
          onClose={() => { setShowWbCollectionModal(false); setEditingWbCollection(null); }}
        />
      )}

      {showWbEnvManager && (
        <WorkbenchEnvManager
          environments={wb.environments}
          projects={projects}
          onAdd={wb.addEnv}
          onRemove={wb.removeEnv}
          onImport={wb.importEnvsFromProject}
          onClose={() => setShowWbEnvManager(false)}
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
