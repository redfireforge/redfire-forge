import { useState, useEffect, useRef, useCallback } from 'react';
import { isTauri } from './utils/platform';
import type { Project, TestRun } from './types';
import { loadTestRuns, saveTheme } from './utils/storage';
import { createEmptyProject } from './utils/helpers';
import { useProjects } from './hooks/useProjects';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import ExportCenter from './components/ExportCenter';
import ImportCenter from './components/ImportCenter';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import './styles/index.css';

type Tab = 'scenarios' | 'runner' | 'results';

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

  // ---- App shell state ----
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showImportCenter, setShowImportCenter] = useState(false);
  const [testRunsCache, setTestRunsCache] = useState<TestRun[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

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

  const handleProjectSwitch = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
  };

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
        <nav className="tab-nav">
          <button className={`tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>Feature Groups</button>
          <button className={`tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>Test Runner</button>
          <button className={`tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button>
        </nav>
        <div className="header-selectors">
          <button className="btn btn-sm settings-btn" onClick={() => setSidebarCollapsed((c) => !c)} title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
            {sidebarCollapsed ? '◀' : '▶'}
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <button
        className="sidebar-float-toggle"
        style={{ left: sidebarCollapsed ? 0 : 300 }}
        onClick={() => setSidebarCollapsed((c) => !c)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

      {!sidebarCollapsed && (
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          selectedEnvId={selectedEnvId}
          selectedSvcId={selectedSvcId}
          onProjectSwitch={handleProjectSwitch}
          onEnvSelect={setSelectedEnvId}
          onSvcSelect={setSelectedSvcId}
          onClose={() => setSidebarCollapsed(true)}
          onOpenSettings={async () => { setShowSettings(true); }}
        />
      )}

      <div className="app-body">
        <main className={`app-main ${sidebarCollapsed ? '' : 'sidebar-open'}`}>
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
          onProjectSwitch={handleProjectSwitch}
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
