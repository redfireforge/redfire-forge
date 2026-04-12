import { useState, useEffect, useRef, useCallback } from 'react';
import { isTauri } from './utils/platform';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, GlobalAuthProfile, AuthConfig, AuthType, TestRun, Project } from './types';
import { acquireOAuth2Token } from './engine/executor';
import {
  loadProjects, saveProjects,
  loadSelectedProject, saveSelectedProject,
  loadGlobalAuthProfiles, saveGlobalAuthProfiles,
  migrateLegacyData,
  getMaxRuns, setMaxRuns, getStorageUsage,
  loadTestRuns,
  saveTheme, loadTheme,
} from './utils/storage';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import ExportCenter from './components/ExportCenter';
import ImportCenter from './components/ImportCenter';
import './App.css';

type Tab = 'scenarios' | 'runner' | 'results';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createEmptyProject(name: string, description?: string): Project {
  return {
    id: uuidv4(),
    name,
    description,
    createdAt: Date.now(),
    environments: [],
    microservices: [],
    globalAuthProfiles: [],
    featureGroups: [],
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [appGlobalAuthProfiles, setAppGlobalAuthProfiles] = useState<GlobalAuthProfile[]>([]);

  const [testRunsCache, setTestRunsCache] = useState<TestRun[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'projects' | 'globalAuth' | 'exportImport' | 'storage'>('projects');
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showImportCenter, setShowImportCenter] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [editingBaseUrls, setEditingBaseUrls] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<{ svcId: string; envId: string; value: string } | null>(null);
  const [maxRuns, setMaxRunsLocal] = useState(50);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [editingGlobalAuth, setEditingGlobalAuth] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newGlobalProfileName, setNewGlobalProfileName] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<'env' | 'svc'>('env');
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [expandedSidebarNodes, setExpandedSidebarNodes] = useState<Set<string>>(new Set());

  // ---- Derived project-scoped state ----
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const environments = selectedProject?.environments ?? [];
  const microservices = selectedProject?.microservices ?? [];
  const globalAuthProfiles = selectedProject?.globalAuthProfiles ?? [];
  const featureGroups = selectedProject?.featureGroups ?? [];
  const selectedEnvId = selectedProject?.selectedEnvId ?? '';
  const selectedSvcId = selectedProject?.selectedSvcId ?? '';

  // ---- Project-scoped setter wrappers ----
  const updateCurrentProject = useCallback((updater: (p: Project) => Partial<Project>) => {
    setProjects((prev) => prev.map((p) =>
      p.id === selectedProjectId ? { ...p, ...updater(p) } : p
    ));
  }, [selectedProjectId]);

  const setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>> = useCallback((action) => {
    updateCurrentProject((p) => ({
      featureGroups: typeof action === 'function' ? action(p.featureGroups) : action,
    }));
  }, [updateCurrentProject]);

  const setSelectedEnvId = useCallback((envId: string) => {
    updateCurrentProject(() => ({ selectedEnvId: envId }));
  }, [updateCurrentProject]);

  const setSelectedSvcId = useCallback((svcId: string) => {
    updateCurrentProject(() => ({ selectedSvcId: svcId }));
  }, [updateCurrentProject]);

  // ---- Init: load persisted data + migrate legacy ----
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      const [prjs, prjId, globalAuth, maxR, usage, savedTheme, runs] = await Promise.all([
        loadProjects(),
        loadSelectedProject(),
        loadGlobalAuthProfiles(),
        getMaxRuns(),
        getStorageUsage(),
        loadTheme(),
        loadTestRuns(),
      ]);

      let finalProjects = prjs;
      let finalSelectedId = prjId;

      // Migrate legacy flat data into a project
      if (finalProjects.length === 0) {
        const migrated = await migrateLegacyData();
        if (migrated) {
          finalProjects = [migrated];
          finalSelectedId = migrated.id;
          await saveProjects(finalProjects);
          await saveSelectedProject(finalSelectedId);
        }
      }

      // Auto-create a default project if none exist
      if (finalProjects.length === 0) {
        const def = createEmptyProject('Default Project');
        finalProjects = [def];
        finalSelectedId = def.id;
        await saveProjects(finalProjects);
        await saveSelectedProject(finalSelectedId);
      }

      // Ensure selected project exists
      if (!finalProjects.some((p) => p.id === finalSelectedId)) {
        finalSelectedId = finalProjects[0].id;
      }

      setProjects(finalProjects);
      setSelectedProjectId(finalSelectedId);
      setAppGlobalAuthProfiles(globalAuth);
      setMaxRunsLocal(maxR);
      setStorageUsage(usage);
      setTheme(savedTheme as 'dark' | 'light');
      setTestRunsCache(runs);
      document.documentElement.setAttribute('data-theme', savedTheme);
      setLoading(false);
    })();
  }, []);

  // ---- Persistence ----
  useEffect(() => { if (!loading) void saveProjects(projects); }, [projects, loading]);
  useEffect(() => { if (!loading) void saveSelectedProject(selectedProjectId); }, [selectedProjectId, loading]);
  useEffect(() => { if (!loading) void saveGlobalAuthProfiles(appGlobalAuthProfiles); }, [appGlobalAuthProfiles, loading]);

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

  // ---- Sidebar helpers ----
  const toggleExpanded = (id: string) => {
    setExpandedSidebarNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const expandAllSidebar = () => {
    if (sidebarView === 'env') {
      setExpandedSidebarNodes(new Set(environments.map((e) => e.id)));
    } else {
      setExpandedSidebarNodes(new Set(microservices.map((s) => s.id)));
    }
  };
  const collapseAllSidebar = () => setExpandedSidebarNodes(new Set());
  const allExpanded = sidebarView === 'env'
    ? environments.length > 0 && environments.every((e) => expandedSidebarNodes.has(e.id))
    : microservices.length > 0 && microservices.every((s) => expandedSidebarNodes.has(s.id));

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

  const confirm = (message: string, onConfirm: () => void) => setConfirmAction({ message, onConfirm });

  // ---- Project CRUD ----
  const addProject = () => {
    if (!newProjectName.trim()) return;
    const project = createEmptyProject(newProjectName.trim(), newProjectDesc.trim() || undefined);
    setProjects((prev) => [...prev, project]);
    setSelectedProjectId(project.id);
    setNewProjectName('');
    setNewProjectDesc('');
  };
  const removeProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    const fgCount = project?.featureGroups.length ?? 0;
    const detail = fgCount > 0 ? ` It contains ${fgCount} feature group(s) that will be deleted.` : '';
    confirm(`Delete project "${project?.name}"?${detail}`, () => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (selectedProjectId === id) {
          const newSel = next.length > 0 ? next[0].id : '';
          // Defer to avoid nested state update
          setTimeout(() => setSelectedProjectId(newSel), 0);
        }
        return next;
      });
    });
  };
  const updateProjectMeta = (id: string, updates: { name?: string; description?: string }) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  };
  const modifyProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((prev) => prev.map((p) => p.id === projectId ? fn(p) : p));
  }, []);

  const handleProjectSwitch = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    setExpandedSidebarNodes(new Set());
  };

  // ---- Global Auth Profile verification ----
  const [authVerifying, setAuthVerifying] = useState(false);
  const [authVerifyResult, setAuthVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const verifyProfileAuth = useCallback(async (auth: AuthConfig) => {
    setAuthVerifying(true);
    setAuthVerifyResult(null);
    try {
      if (auth.type === 'oauth2') {
        const token = await acquireOAuth2Token(auth);
        setAuthVerifyResult({ ok: true, msg: `Token acquired (${token.substring(0, 20)}…)` });
      } else if (auth.type === 'basic' || auth.type === 'digest') {
        setAuthVerifyResult({ ok: !!(auth.username && auth.password), msg: auth.username && auth.password ? 'Credentials configured' : 'Missing username or password' });
      } else if (auth.type === 'bearer') {
        setAuthVerifyResult({ ok: !!auth.token, msg: auth.token ? 'Token configured' : 'Missing token' });
      } else if (auth.type === 'apikey') {
        setAuthVerifyResult({ ok: !!(auth.apiKeyName && auth.apiKeyValue), msg: auth.apiKeyName && auth.apiKeyValue ? 'API Key configured' : 'Missing key name or value' });
      }
    } catch (err: unknown) {
      setAuthVerifyResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setAuthVerifying(false);
    }
  }, []);

  // ---- Move handlers (cross-project) ----
  const moveFeatureGroup = useCallback((fgId: string, sourceProjectId: string, targetProjectId: string) => {
    if (sourceProjectId === targetProjectId) return;
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const tgtProject = prev.find((p) => p.id === targetProjectId);
      const fg = srcProject?.featureGroups.find((f) => f.id === fgId);
      if (!fg || !srcProject || !tgtProject) return prev;

      // Collect referenced entities that need to follow the FG
      const envToCopy = fg.environmentId && !tgtProject.environments.some((e) => e.id === fg.environmentId)
        ? srcProject.environments.find((e) => e.id === fg.environmentId)
        : undefined;
      const svcToCopy = fg.microserviceId && !tgtProject.microservices.some((s) => s.id === fg.microserviceId)
        ? srcProject.microservices.find((s) => s.id === fg.microserviceId)
        : undefined;
      const isAppGlobalAuth = fg.globalAuthProfileId && appGlobalAuthProfiles.some((a) => a.id === fg.globalAuthProfileId);
      const authToCopy = fg.globalAuthProfileId && !isAppGlobalAuth && !tgtProject.globalAuthProfiles.some((a) => a.id === fg.globalAuthProfileId)
        ? srcProject.globalAuthProfiles.find((a) => a.id === fg.globalAuthProfileId)
        : undefined;

      // If copying a microservice, also copy any environments it references that are missing
      const extraEnvs: typeof srcProject.environments = [];
      if (svcToCopy) {
        for (const envId of Object.keys(svcToCopy.baseUrls)) {
          const alreadyExists = tgtProject.environments.some((e) => e.id === envId) || envToCopy?.id === envId;
          if (!alreadyExists) {
            const env = srcProject.environments.find((e) => e.id === envId);
            if (env) extraEnvs.push(env);
          }
        }
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return { ...p, featureGroups: p.featureGroups.filter((f) => f.id !== fgId) };
        }
        if (p.id === targetProjectId) {
          const newEnvs = [...p.environments, ...(envToCopy ? [envToCopy] : []), ...extraEnvs];
          const newSvcs = svcToCopy ? [...p.microservices, svcToCopy] : p.microservices;
          const newAuth = authToCopy ? [...p.globalAuthProfiles, authToCopy] : p.globalAuthProfiles;
          return {
            ...p,
            environments: newEnvs,
            microservices: newSvcs,
            globalAuthProfiles: newAuth,
            featureGroups: [...p.featureGroups, fg],
          };
        }
        return p;
      });
    });
  }, []);

  const moveScenario = useCallback((scenarioId: string, sourceFgId: string, sourceProjectId: string, targetFgId: string, targetProjectId: string) => {
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const srcFg = srcProject?.featureGroups.find((f) => f.id === sourceFgId);
      const scenario = srcFg?.scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return prev;

      if (sourceProjectId === targetProjectId) {
        return prev.map((p) => {
          if (p.id !== sourceProjectId) return p;
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) => {
              if (fg.id === sourceFgId) {
                return { ...fg, scenarios: fg.scenarios.filter((s) => s.id !== scenarioId) };
              }
              if (fg.id === targetFgId) {
                return { ...fg, scenarios: [...fg.scenarios, scenario] };
              }
              return fg;
            }),
          };
        });
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) =>
              fg.id === sourceFgId ? { ...fg, scenarios: fg.scenarios.filter((s) => s.id !== scenarioId) } : fg
            ),
          };
        }
        if (p.id === targetProjectId) {
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) =>
              fg.id === targetFgId ? { ...fg, scenarios: [...fg.scenarios, scenario] } : fg
            ),
          };
        }
        return p;
      });
    });
  }, []);

  const moveTest = useCallback((testId: string, sourceScenarioId: string, sourceFgId: string, sourceProjectId: string, targetScenarioId: string, targetFgId: string, targetProjectId: string) => {
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const srcFg = srcProject?.featureGroups.find((f) => f.id === sourceFgId);
      const srcScenario = srcFg?.scenarios.find((s) => s.id === sourceScenarioId);
      const test = srcScenario?.tests.find((t) => t.id === testId);
      if (!test || !srcFg) return prev;

      type Scenarios = typeof srcFg.scenarios;
      const removeFromScenario = (scenarios: Scenarios) =>
        scenarios.map((sc) =>
          sc.id === sourceScenarioId ? { ...sc, tests: sc.tests.filter((t) => t.id !== testId) } : sc
        );

      const addToScenario = (scenarios: Scenarios) =>
        scenarios.map((sc) =>
          sc.id === targetScenarioId ? { ...sc, tests: [...sc.tests, test] } : sc
        );

      if (sourceProjectId === targetProjectId) {
        return prev.map((p) => {
          if (p.id !== sourceProjectId) return p;
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) => {
              if (sourceFgId === targetFgId && fg.id === sourceFgId) {
                let scenarios = removeFromScenario(fg.scenarios);
                scenarios = addToScenario(scenarios);
                return { ...fg, scenarios };
              }
              if (fg.id === sourceFgId) {
                return { ...fg, scenarios: removeFromScenario(fg.scenarios) };
              }
              if (fg.id === targetFgId) {
                return { ...fg, scenarios: addToScenario(fg.scenarios) };
              }
              return fg;
            }),
          };
        });
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) =>
              fg.id === sourceFgId ? { ...fg, scenarios: removeFromScenario(fg.scenarios) } : fg
            ),
          };
        }
        if (p.id === targetProjectId) {
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) =>
              fg.id === targetFgId ? { ...fg, scenarios: addToScenario(fg.scenarios) } : fg
            ),
          };
        }
        return p;
      });
    });
  }, []);

  // ---- Import handler ----
  const handleImportProject = useCallback(async (imported: Project) => {
    setProjects((prev) => {
      const existing = prev.find((p) => p.id === imported.id);
      if (existing) {
        return prev.map((p) => p.id === imported.id ? imported : p);
      }
      return [...prev, imported];
    });
    setSelectedProjectId(imported.id);
    setShowImportCenter(false);
    setShowSettings(true);
    setStorageUsage(await getStorageUsage());
  }, []);

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
        <h1>🔥 RedfireForge {!isTauri() && <span style={{ fontSize: '0.65em', fontWeight: 400, opacity: 0.75, marginLeft: '0.5em' }}>API Performance Studio</span>}
          <span style={{ fontSize: '0.4em', fontWeight: 400, opacity: 0.5, marginLeft: '0.6em', verticalAlign: 'middle', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>v{__APP_VERSION__}</span>
        </h1>
        <nav className="tab-nav">
          <button className={`tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>
            Feature Groups
          </button>
          <button className={`tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>
            Test Runner
          </button>
          <button className={`tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            Results
          </button>
        </nav>

        <div className="header-selectors">
          <button
            className="btn btn-sm settings-btn"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '◀' : '▶'}
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
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
        <aside className="config-sidebar">
          <button className="sidebar-close-btn" onClick={() => setSidebarCollapsed(true)} title="Hide sidebar">×</button>

            {/* ── Projects section ── */}
            <div className="sidebar-section-label">Projects</div>
            <div className="sidebar-project-list">
              {projects.map((prj) => {
                const isActive = prj.id === selectedProjectId;
                return (
                  <div
                    key={prj.id}
                    className={`sidebar-project-item ${isActive ? 'active' : ''}`}
                    onClick={() => { if (!isActive) handleProjectSwitch(prj.id); }}
                  >
                    <span className="sidebar-project-icon">{isActive ? '▾' : '▸'}</span>
                    <span className="sidebar-project-name">{prj.name}</span>
                    <span className="sidebar-project-meta">{prj.featureGroups.length}</span>
                  </div>
                );
              })}
            </div>

            <div className="sidebar-divider" />

            {/* ── Env / Svc toggle for the active project ── */}
            <div className="sidebar-toggle">
              <button className={`sidebar-toggle-btn ${sidebarView === 'env' ? 'active' : ''}`} onClick={() => { setSidebarView('env'); setExpandedSidebarNodes(new Set()); }}>Environments</button>
              <button className={`sidebar-toggle-btn ${sidebarView === 'svc' ? 'active' : ''}`} onClick={() => { setSidebarView('svc'); setExpandedSidebarNodes(new Set()); }}>Microservices</button>
            </div>
            <div className="sidebar-expand-all">
              <button className="btn btn-xs" onClick={allExpanded ? collapseAllSidebar : expandAllSidebar}>
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            {sidebarView === 'env' && (
              <div className="sidebar-list">
                {environments.length === 0 && <div className="empty-hint">No environments. Open Settings to add.</div>}
                {environments.map((env) => {
                  const svcsInEnv = microservices.filter((s) => env.id in s.baseUrls);
                  const isExpanded = expandedSidebarNodes.has(env.id);
                  const envHasFeatures = featureGroups.some((fg) => fg.environmentId === env.id);
                  return (
                    <div key={env.id} className="sidebar-tree-node">
                      <div className={`sidebar-item ${selectedEnvId === env.id ? 'selected' : ''} ${envHasFeatures ? 'has-features' : 'no-features'}`}>
                        <span className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); toggleExpanded(env.id); }}>▸</span>
                        <span className="sidebar-item-name" onClick={() => {
                          if (selectedEnvId === env.id) { setSelectedEnvId(''); setSelectedSvcId(''); }
                          else { setSelectedEnvId(env.id); setSelectedSvcId(''); }
                          if (!isExpanded) toggleExpanded(env.id);
                        }}>{env.name}</span>
                        <span className="sidebar-item-count">{svcsInEnv.length}</span>
                      </div>
                      {isExpanded && (
                        <div className="sidebar-children">
                          {svcsInEnv.length === 0
                            ? <div className="empty-hint">No microservices deployed here.</div>
                            : svcsInEnv.map((svc) => {
                              const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                              return (
                                <div key={svc.id} className={`sidebar-child ${selectedEnvId === env.id && selectedSvcId === svc.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                                  onClick={() => { setSelectedEnvId(env.id); setSelectedSvcId(svc.id); }}>
                                  {svc.name}
                                </div>
                              );
                            })
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sidebarView === 'svc' && (
              <div className="sidebar-list">
                {microservices.length === 0 && <div className="empty-hint">No microservices. Open Settings to add.</div>}
                {microservices.map((svc) => {
                  const envsForSvc = environments.filter((e) => e.id in svc.baseUrls);
                  const isExpanded = expandedSidebarNodes.has(svc.id);
                  const svcHasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id);
                  return (
                    <div key={svc.id} className="sidebar-tree-node">
                      <div className={`sidebar-item ${selectedSvcId === svc.id ? 'selected' : ''} ${svcHasFeatures ? 'has-features' : 'no-features'}`}>
                        <span className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); toggleExpanded(svc.id); }}>▸</span>
                        <span className="sidebar-item-name" onClick={() => {
                          if (selectedSvcId === svc.id) { setSelectedSvcId(''); setSelectedEnvId(''); }
                          else { setSelectedSvcId(svc.id); setSelectedEnvId(''); }
                          if (!isExpanded) toggleExpanded(svc.id);
                        }}>{svc.name}</span>
                        <span className="sidebar-item-count">{envsForSvc.length}</span>
                      </div>
                      {isExpanded && (
                        <div className="sidebar-children">
                          {envsForSvc.length === 0
                            ? <div className="empty-hint">Not deployed to any environment.</div>
                            : envsForSvc.map((env) => {
                              const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                              return (
                                <div key={env.id} className={`sidebar-child ${selectedSvcId === svc.id && selectedEnvId === env.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                                  onClick={() => { setSelectedSvcId(svc.id); setSelectedEnvId(env.id); }}>
                                  {env.name}
                                </div>
                              );
                            })
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button className="btn btn-sm sidebar-settings-btn" onClick={async () => { setStorageUsage(await getStorageUsage()); setShowSettings(true); }}>⚙ Settings</button>
        </aside>
      )}

      <div className="app-body">
        <main className={`app-main ${sidebarCollapsed ? '' : 'sidebar-open'}`}>
          {activeTab === 'scenarios' && <ScenarioBuilder featureGroups={filteredFeatureGroups} setFeatureGroups={setFeatureGroups} resolvedBaseUrl={resolvedBaseUrl} selectedSvcId={selectedSvcId} selectedSvcName={selectedSvc?.name} selectedEnvId={selectedEnvId} selectedEnvName={selectedEnv?.name} unassociatedFeatureGroups={unassociatedFeatureGroups} microservices={microservices} environments={environments} globalAuthProfiles={appGlobalAuthProfiles} projectAuthProfiles={globalAuthProfiles} projects={projects} currentProjectId={selectedProjectId} onMoveFeatureGroup={moveFeatureGroup} onMoveScenario={moveScenario} onMoveTest={moveTest} />}
          {activeTab === 'runner' && <TestRunner featureGroups={filteredFeatureGroups} onComplete={() => setActiveTab('results')} envName={selectedEnv?.name} svcName={selectedSvc?.name} projectName={selectedProject?.name} resolvedBaseUrl={resolvedBaseUrl} globalAuthProfiles={[...appGlobalAuthProfiles, ...globalAuthProfiles]} />}
          {activeTab === 'results' && <ResultsDashboard envName={selectedEnv?.name} svcName={selectedSvc?.name} projectName={selectedProject?.name} />}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal settings-modal-split" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Settings</h3>
              <button className="btn btn-sm" onClick={() => setShowSettings(false)}>Close</button>
            </div>
            <div className="settings-split">
              <nav className="settings-nav">
                <button className={`settings-nav-item ${settingsTab === 'projects' ? 'active' : ''}`} onClick={() => setSettingsTab('projects')}>Projects</button>
                <button className={`settings-nav-item ${settingsTab === 'globalAuth' ? 'active' : ''}`} onClick={() => setSettingsTab('globalAuth')}>Global Auth Profiles</button>
                <button className={`settings-nav-item ${settingsTab === 'exportImport' ? 'active' : ''}`} onClick={() => setSettingsTab('exportImport')}>Export & Import</button>
                <button className={`settings-nav-item ${settingsTab === 'storage' ? 'active' : ''}`} onClick={() => setSettingsTab('storage')}>Storage</button>
              </nav>
              <div className="settings-content">

            {settingsTab === 'projects' && (
            <div className="settings-section">
              <h4>Projects</h4>
              <p className="settings-section-desc">
                Each project has its own environments, microservices, auth profiles, and feature groups.
              </p>
              <div className="settings-add-row">
                <input
                  placeholder="Project name (e.g. Payment Gateway, User Auth)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addProject(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={addProject} disabled={!newProjectName.trim()}>Add</button>
              </div>
              <div className="settings-list">
                {projects.map((prj) => {
                  const isEditing = editingProjectId === prj.id;
                  const isCurrent = prj.id === selectedProjectId;
                  const pEnvs = prj.environments;
                  const pSvcs = prj.microservices;
                  const pAuth = prj.globalAuthProfiles;
                  return (
                    <div key={prj.id} className={`settings-svc-card ${isEditing ? 'expanded' : ''} ${isCurrent ? 'settings-card-active' : ''}`}>
                      <div className="settings-svc-header">
                        <span className="settings-svc-name">{prj.name} {isCurrent && <span style={{ fontSize: '0.7em', opacity: 0.6 }}>(active)</span>}</span>
                        <span className="settings-svc-count">{pEnvs.length} envs · {pSvcs.length} svcs · {prj.featureGroups.length} features</span>
                        <button className="btn btn-sm" onClick={() => setEditingProjectId(isEditing ? null : prj.id)}>
                          {isEditing ? 'Collapse' : 'Edit'}
                        </button>
                        {!isCurrent && <button className="btn btn-sm btn-primary" onClick={() => handleProjectSwitch(prj.id)}>Switch</button>}
                        <button className="btn btn-sm btn-danger" onClick={() => removeProject(prj.id)} disabled={projects.length <= 1}>Delete</button>
                      </div>
                      {isEditing && (
                        <div className="settings-project-body">
                          {/* Name & Description */}
                          <div className="settings-project-meta">
                            <div className="form-row">
                              <label>Name</label>
                              <input value={prj.name} onChange={(e) => updateProjectMeta(prj.id, { name: e.target.value })} />
                            </div>
                            <div className="form-row">
                              <label>Description</label>
                              <input value={prj.description || ''} onChange={(e) => updateProjectMeta(prj.id, { description: e.target.value || undefined })} placeholder="Optional description" />
                            </div>
                          </div>

                          {/* Environments for this project */}
                          <div className="settings-project-subsection">
                            <h5>Environments</h5>
                            <div className="settings-add-row">
                              <input placeholder="e.g. t01, p01, staging" value={editingProjectId === prj.id ? newEnvName : ''} onChange={(e) => setNewEnvName(e.target.value)} onKeyDown={(e) => {
                                if (e.key === 'Enter' && newEnvName.trim()) {
                                  modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, { id: uuidv4(), name: newEnvName.trim() }] }));
                                  setNewEnvName('');
                                }
                              }} />
                              <button className="btn btn-primary btn-xs" onClick={() => {
                                if (!newEnvName.trim()) return;
                                modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, { id: uuidv4(), name: newEnvName.trim() }] }));
                                setNewEnvName('');
                              }} disabled={!newEnvName.trim()}>Add</button>
                            </div>
                            {projects.length > 1 && (() => {
                              const otherProjects = projects.filter((op) => op.id !== prj.id && op.environments.length > 0);
                              if (otherProjects.length === 0) return null;
                              return (
                                <div className="settings-transfer-row">
                                  <select id={`xfer-env-src-${prj.id}`} defaultValue="">
                                    <option value="" disabled>Select project...</option>
                                    {otherProjects.map((op) => <option key={op.id} value={op.id}>{op.name} ({op.environments.length} envs)</option>)}
                                  </select>
                                  <button className="btn btn-xs" title="Duplicate environments into this project" onClick={() => {
                                    const sel = (document.getElementById(`xfer-env-src-${prj.id}`) as HTMLSelectElement)?.value;
                                    const src = projects.find((p) => p.id === sel);
                                    if (!src) return;
                                    const existingIds = new Set(prj.environments.map((e) => e.id));
                                    const toCopy = src.environments.filter((e) => !existingIds.has(e.id));
                                    if (toCopy.length === 0) { alert('All environments already exist.'); return; }
                                    modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, ...toCopy] }));
                                  }}>Copy</button>
                                  <button className="btn btn-xs" title="Move environments from the selected project (removes them from source)" onClick={() => {
                                    const sel = (document.getElementById(`xfer-env-src-${prj.id}`) as HTMLSelectElement)?.value;
                                    const src = projects.find((p) => p.id === sel);
                                    if (!src) return;
                                    const existingIds = new Set(prj.environments.map((e) => e.id));
                                    const toMove = src.environments.filter((e) => !existingIds.has(e.id));
                                    if (toMove.length === 0) { alert('All environments already exist.'); return; }
                                    const moveIds = new Set(toMove.map((e) => e.id));
                                    confirm(`Move ${toMove.length} environment(s) from "${src.name}" to "${prj.name}"? They will be removed from "${src.name}".`, () => {
                                      setProjects((prev) => prev.map((p) => {
                                        if (p.id === prj.id) return { ...p, environments: [...p.environments, ...toMove] };
                                        if (p.id === src.id) return { ...p, environments: p.environments.filter((e) => !moveIds.has(e.id)) };
                                        return p;
                                      }));
                                    });
                                  }}>Move</button>
                                </div>
                              );
                            })()}
                            {pEnvs.length === 0 && <div className="empty-hint">No environments defined.</div>}
                            <div className="settings-env-chips">
                              {pEnvs.map((env) => (
                                <div key={env.id} className="settings-chip">
                                  <span>{env.name}</span>
                                  <button className="settings-chip-delete" onClick={() => {
                                    confirm(`Delete environment "${env.name}" from "${prj.name}"?`, () => {
                                      modifyProject(prj.id, (p) => ({
                                        ...p,
                                        environments: p.environments.filter((e) => e.id !== env.id),
                                        microservices: p.microservices.map((s) => { const { [env.id]: _, ...rest } = s.baseUrls; return { ...s, baseUrls: rest }; }),
                                      }));
                                    });
                                  }} title="Delete">×</button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Microservices for this project */}
                          <div className="settings-project-subsection">
                            <h5>Microservices</h5>
                            <div className="settings-add-row">
                              <input placeholder="e.g. sales-product-autoassign" value={editingProjectId === prj.id ? newSvcName : ''} onChange={(e) => setNewSvcName(e.target.value)} onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSvcName.trim()) {
                                  modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }] }));
                                  setNewSvcName('');
                                }
                              }} />
                              <button className="btn btn-primary btn-xs" onClick={() => {
                                if (!newSvcName.trim()) return;
                                modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }] }));
                                setNewSvcName('');
                              }} disabled={!newSvcName.trim()}>Add</button>
                            </div>
                            {projects.length > 1 && (() => {
                              const otherProjects = projects.filter((op) => op.id !== prj.id && op.microservices.length > 0);
                              if (otherProjects.length === 0) return null;
                              return (
                                <div className="settings-transfer-row">
                                  <select id={`xfer-svc-src-${prj.id}`} defaultValue="">
                                    <option value="" disabled>Select project...</option>
                                    {otherProjects.map((op) => <option key={op.id} value={op.id}>{op.name} ({op.microservices.length} svcs)</option>)}
                                  </select>
                                  <button className="btn btn-xs" title="Duplicate microservices into this project" onClick={() => {
                                    const sel = (document.getElementById(`xfer-svc-src-${prj.id}`) as HTMLSelectElement)?.value;
                                    const src = projects.find((p) => p.id === sel);
                                    if (!src) return;
                                    const existingIds = new Set(prj.microservices.map((s) => s.id));
                                    const toCopy = src.microservices.filter((s) => !existingIds.has(s.id));
                                    if (toCopy.length === 0) { alert('All microservices already exist.'); return; }
                                    modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, ...toCopy] }));
                                  }}>Copy</button>
                                  <button className="btn btn-xs" title="Move microservices from the selected project (removes them from source)" onClick={() => {
                                    const sel = (document.getElementById(`xfer-svc-src-${prj.id}`) as HTMLSelectElement)?.value;
                                    const src = projects.find((p) => p.id === sel);
                                    if (!src) return;
                                    const existingIds = new Set(prj.microservices.map((s) => s.id));
                                    const toMove = src.microservices.filter((s) => !existingIds.has(s.id));
                                    if (toMove.length === 0) { alert('All microservices already exist.'); return; }
                                    const moveIds = new Set(toMove.map((s) => s.id));
                                    confirm(`Move ${toMove.length} microservice(s) from "${src.name}" to "${prj.name}"? They will be removed from "${src.name}".`, () => {
                                      setProjects((prev) => prev.map((p) => {
                                        if (p.id === prj.id) return { ...p, microservices: [...p.microservices, ...toMove] };
                                        if (p.id === src.id) return { ...p, microservices: p.microservices.filter((s) => !moveIds.has(s.id)) };
                                        return p;
                                      }));
                                    });
                                  }}>Move</button>
                                </div>
                              );
                            })()}
                            {pSvcs.length === 0 && <div className="empty-hint">No microservices defined.</div>}
                            <div className="settings-svc-list">
                              {pSvcs.map((svc) => {
                                const isSvcExpanded = editingBaseUrls === svc.id;
                                const deployedCount = pEnvs.filter((env) => env.id in svc.baseUrls).length;
                                return (
                                  <div key={svc.id} className={`settings-svc-card ${isSvcExpanded ? 'expanded' : ''}`}>
                                    <div className="settings-svc-header">
                                      <span className="settings-svc-name">{svc.name}</span>
                                      <span className="settings-svc-count">{deployedCount}/{pEnvs.length} envs</span>
                                      <button className="btn btn-xs" onClick={() => setEditingBaseUrls(isSvcExpanded ? null : svc.id)}>{isSvcExpanded ? 'Collapse' : 'Configure'}</button>
                                      <button className="btn btn-xs btn-danger" onClick={() => {
                                        confirm(`Delete microservice "${svc.name}" from "${prj.name}"?`, () => {
                                          modifyProject(prj.id, (p) => ({
                                            ...p,
                                            microservices: p.microservices.filter((s) => s.id !== svc.id),
                                            featureGroups: p.featureGroups.filter((fg) => fg.microserviceId !== svc.id),
                                          }));
                                        });
                                      }}>Delete</button>
                                    </div>
                                    {isSvcExpanded && (
                                      <div className="settings-svc-envs">
                                        {pEnvs.length === 0 && <div className="empty-hint">Add environments first.</div>}
                                        {pEnvs.map((env) => {
                                          const deployed = env.id in svc.baseUrls;
                                          const isEditingThis = editingUrl?.svcId === svc.id && editingUrl?.envId === env.id;
                                          const currentUrl = svc.baseUrls[env.id] ?? '';
                                          return (
                                            <div key={env.id} className={`settings-env-row ${deployed ? 'deployed' : ''}`}>
                                              <label className="settings-env-check">
                                                <input type="checkbox" checked={deployed} onChange={() => {
                                                  modifyProject(prj.id, (p) => ({
                                                    ...p,
                                                    microservices: p.microservices.map((s) => {
                                                      if (s.id !== svc.id) return s;
                                                      const next = { ...s.baseUrls };
                                                      if (env.id in next) delete next[env.id]; else next[env.id] = '';
                                                      return { ...s, baseUrls: next };
                                                    }),
                                                  }));
                                                }} />
                                                <span className="settings-env-name">{env.name}</span>
                                              </label>
                                              {deployed && (
                                                isEditingThis ? (
                                                  <div className="settings-url-edit">
                                                    <input className="settings-env-url" autoFocus value={editingUrl.value}
                                                      onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          modifyProject(prj.id, (p) => ({
                                                            ...p,
                                                            microservices: p.microservices.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s),
                                                          }));
                                                          setEditingUrl(null);
                                                        }
                                                        if (e.key === 'Escape') setEditingUrl(null);
                                                      }}
                                                      placeholder={`https://${svc.name}.${env.name}.example.com`} />
                                                    <button className="btn btn-primary btn-xs" onClick={() => {
                                                      modifyProject(prj.id, (p) => ({
                                                        ...p,
                                                        microservices: p.microservices.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s),
                                                      }));
                                                      setEditingUrl(null);
                                                    }}>Save</button>
                                                    <button className="btn btn-xs" onClick={() => setEditingUrl(null)}>Cancel</button>
                                                  </div>
                                                ) : (
                                                  <div className="settings-url-display">
                                                    {currentUrl ? <code className="settings-url-value">{currentUrl}</code> : <span className="settings-url-placeholder">No URL configured</span>}
                                                    <button className="btn btn-xs" onClick={() => setEditingUrl({ svcId: svc.id, envId: env.id, value: currentUrl })}>Edit</button>
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Auth Profiles for this project */}
                          <div className="settings-project-subsection">
                            <h5>Auth Profiles</h5>
                            <div className="settings-add-row">
                              <input placeholder="Profile name (e.g. dev-oauth2)" value={editingProjectId === prj.id ? newProfileName : ''} onChange={(e) => setNewProfileName(e.target.value)} onKeyDown={(e) => {
                                if (e.key === 'Enter' && newProfileName.trim()) {
                                  const id = uuidv4();
                                  modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, { id, name: newProfileName.trim(), auth: { type: 'none' } }] }));
                                  setNewProfileName('');
                                  setEditingGlobalAuth(id);
                                }
                              }} />
                              <button className="btn btn-primary btn-xs" onClick={() => {
                                if (!newProfileName.trim()) return;
                                const id = uuidv4();
                                modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, { id, name: newProfileName.trim(), auth: { type: 'none' } }] }));
                                setNewProfileName('');
                                setEditingGlobalAuth(id);
                              }} disabled={!newProfileName.trim()}>Add</button>
                            </div>
                            
                            {pAuth.length === 0 && <div className="empty-hint">No auth profiles yet.</div>}
                            {pAuth.map((profile) => {
                              const isAuthEditing = editingGlobalAuth === profile.id;
                              const pa = profile.auth;
                              return (
                                <div key={profile.id} className="global-auth-profile-card">
                                  <div className="global-auth-profile-header">
                                    <input className="global-auth-profile-name" value={profile.name} onChange={(e) => {
                                      modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, name: e.target.value } : a) }));
                                    }} />
                                    <span className={`auth-badge auth-badge-${pa.type === 'none' ? 'none' : 'configured'}`}>{pa.type === 'none' ? 'No Auth' : pa.type.toUpperCase()}</span>
                                    <button className="btn btn-xs" onClick={() => { setEditingGlobalAuth(isAuthEditing ? null : profile.id); setAuthVerifyResult(null); setShowSecret(false); }}>{isAuthEditing ? 'Collapse' : 'Configure'}</button>
                                    <select className="auth-xfer-select" defaultValue="" onChange={(e) => {
                                      const val = e.target.value; e.target.value = '';
                                      if (!val) return;
                                      const [action, destType, destId] = val.split(':');
                                      const addToTarget = () => {
                                        if (destType === 'global') {
                                          if (appGlobalAuthProfiles.some((a) => a.id === profile.id)) { alert('Already exists in Global.'); return false; }
                                          setAppGlobalAuthProfiles((prev) => [...prev, profile]);
                                        } else {
                                          const tgt = projects.find((p) => p.id === destId);
                                          if (tgt?.globalAuthProfiles.some((a) => a.id === profile.id)) { alert(`Already exists in "${tgt.name}".`); return false; }
                                          modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                                        }
                                        return true;
                                      };
                                      if (action === 'copy') { addToTarget(); }
                                      else if (action === 'move') {
                                        const destName = destType === 'global' ? 'Global' : projects.find((p) => p.id === destId)?.name ?? '';
                                        confirm(`Move "${profile.name}" to "${destName}"?`, () => {
                                          if (addToTarget()) modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.filter((a) => a.id !== profile.id) }));
                                        });
                                      }
                                    }}>
                                      <option value="">Copy/Move...</option>
                                      <optgroup label="Copy to">
                                        <option value={`copy:global:`}>Global</option>
                                        {projects.filter((op) => op.id !== prj.id).map((op) => <option key={op.id} value={`copy:project:${op.id}`}>{op.name}</option>)}
                                      </optgroup>
                                      <optgroup label="Move to">
                                        <option value={`move:global:`}>Global</option>
                                        {projects.filter((op) => op.id !== prj.id).map((op) => <option key={op.id} value={`move:project:${op.id}`}>{op.name}</option>)}
                                      </optgroup>
                                    </select>
                                    <button className="btn btn-xs btn-danger" onClick={() => {
                                      confirm(`Delete auth profile "${profile.name}"?`, () => {
                                        modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.filter((a) => a.id !== profile.id) }));
                                        if (editingGlobalAuth === profile.id) setEditingGlobalAuth(null);
                                      });
                                    }}>Delete</button>
                                  </div>
                                  {isAuthEditing && (
                                    <div className="global-auth-profile-body">
                                      <div className="auth-type-select">
                                        <label>Type</label>
                                        <select value={pa.type} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, type: e.target.value as AuthType } } : a) }))}>
                                          <option value="none">No Auth</option>
                                          <option value="basic">Basic Auth</option>
                                          <option value="bearer">Bearer Token</option>
                                          <option value="apikey">API Key</option>
                                          <option value="digest">Digest Auth</option>
                                          <option value="oauth2">OAuth2 Client Credentials</option>
                                        </select>
                                      </div>
                                      {pa.type === 'basic' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a) }))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                                      {pa.type === 'bearer' && (<div className="form-row two-col"><div><label>Token</label><input value={pa.token || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, token: e.target.value } } : a) }))} placeholder="eyJhbGciOi..." /></div><div><label>Prefix</label><input value={pa.prefix ?? 'Bearer'} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, prefix: e.target.value } } : a) }))} placeholder="Bearer" /></div></div>)}
                                      {pa.type === 'apikey' && (<><div className="form-row two-col"><div><label>Key Name</label><input value={pa.apiKeyName || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyName: e.target.value } } : a) }))} placeholder="X-API-Key" /></div><div><label>Key Value</label><input value={pa.apiKeyValue || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyValue: e.target.value } } : a) }))} placeholder="your-api-key" /></div></div><div className="form-row"><label>Add to</label><div className="radio-group"><label className="radio-label"><input type="radio" checked={pa.apiKeyIn !== 'query'} onChange={() => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'header' } } : a) }))} />Header</label><label className="radio-label"><input type="radio" checked={pa.apiKeyIn === 'query'} onChange={() => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'query' } } : a) }))} />Query Parameter</label></div></div></>)}
                                      {pa.type === 'digest' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a) }))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                                      {pa.type === 'oauth2' && (<><div className="form-row"><label>Token URL</label><input value={pa.tokenUrl || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, tokenUrl: e.target.value } } : a) }))} placeholder="https://auth.example.com/oauth/token" /></div><div className="form-row two-col"><div><label>Client ID</label><input value={pa.clientId || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientId: e.target.value } } : a) }))} /></div><div><label>Client Secret</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.clientSecret || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientSecret: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div></>)}
                                      {pa.type !== 'none' && (
                                        <div className="auth-verify-section">
                                          <button className="btn btn-sm btn-verify" onClick={() => verifyProfileAuth(pa)} disabled={authVerifying}>{authVerifying ? 'Verifying...' : 'Verify Auth'}</button>
                                          {authVerifyResult && (<div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}><span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>{authVerifyResult.msg}</div>)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ fontSize: '0.8em', opacity: 0.5, marginTop: 8, textAlign: 'right' }}>
                            Created: {new Date(prj.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {settingsTab === 'globalAuth' && (
            <div className="settings-section">
              <h4>Global Auth Profiles</h4>
              <p className="settings-section-desc">
                Shared across all projects. Feature Groups can choose between these and project-level profiles.
              </p>
              <div className="settings-add-row">
                <input placeholder="Profile name (e.g. shared-oauth2, company-bearer)" value={newGlobalProfileName} onChange={(e) => setNewGlobalProfileName(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGlobalProfileName.trim()) {
                    const id = uuidv4();
                    setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                    setNewGlobalProfileName('');
                    setEditingGlobalAuth(id);
                  }
                }} />
                <button className="btn btn-primary btn-sm" onClick={() => {
                  if (!newGlobalProfileName.trim()) return;
                  const id = uuidv4();
                  setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                  setNewGlobalProfileName('');
                  setEditingGlobalAuth(id);
                }} disabled={!newGlobalProfileName.trim()}>Add</button>
              </div>
              
              {appGlobalAuthProfiles.length === 0 && <div className="empty-hint">No global auth profiles yet.</div>}
              {appGlobalAuthProfiles.map((profile) => {
                const isAuthEditing = editingGlobalAuth === profile.id;
                const pa = profile.auth;
                return (
                  <div key={profile.id} className="global-auth-profile-card">
                    <div className="global-auth-profile-header">
                      <input className="global-auth-profile-name" value={profile.name} onChange={(e) => {
                        setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, name: e.target.value } : a));
                      }} />
                      <span className={`auth-badge auth-badge-${pa.type === 'none' ? 'none' : 'configured'}`}>{pa.type === 'none' ? 'No Auth' : pa.type.toUpperCase()}</span>
                      <button className="btn btn-sm" onClick={() => { setEditingGlobalAuth(isAuthEditing ? null : profile.id); setAuthVerifyResult(null); setShowSecret(false); }}>{isAuthEditing ? 'Collapse' : 'Configure'}</button>
                      {projects.length > 0 && (
                        <select className="auth-xfer-select" defaultValue="" onChange={(e) => {
                          const val = e.target.value; e.target.value = '';
                          if (!val) return;
                          const [action, destId] = val.split(':');
                          const tgt = projects.find((p) => p.id === destId);
                          if (!tgt) return;
                          if (tgt.globalAuthProfiles.some((a) => a.id === profile.id)) { alert(`Already exists in "${tgt.name}".`); return; }
                          if (action === 'copy') {
                            modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                          } else if (action === 'move') {
                            confirm(`Move "${profile.name}" to "${tgt.name}"?`, () => {
                              modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                              setAppGlobalAuthProfiles((prev) => prev.filter((a) => a.id !== profile.id));
                            });
                          }
                        }}>
                          <option value="">Copy/Move...</option>
                          <optgroup label="Copy to">
                            {projects.map((p) => <option key={p.id} value={`copy:${p.id}`}>{p.name}</option>)}
                          </optgroup>
                          <optgroup label="Move to">
                            {projects.map((p) => <option key={p.id} value={`move:${p.id}`}>{p.name}</option>)}
                          </optgroup>
                        </select>
                      )}
                      <button className="btn btn-sm btn-danger-outline" onClick={() => {
                        confirm(`Delete global auth profile "${profile.name}"?`, () => {
                          setAppGlobalAuthProfiles((prev) => prev.filter((a) => a.id !== profile.id));
                          if (editingGlobalAuth === profile.id) setEditingGlobalAuth(null);
                        });
                      }}>Delete</button>
                    </div>
                    {isAuthEditing && (
                      <div className="global-auth-profile-body">
                        <div className="auth-type-select">
                          <label>Type</label>
                          <select value={pa.type} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, type: e.target.value as AuthType } } : a))}>
                            <option value="none">No Auth</option>
                            <option value="basic">Basic Auth</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="apikey">API Key</option>
                            <option value="digest">Digest Auth</option>
                            <option value="oauth2">OAuth2 Client Credentials</option>
                          </select>
                        </div>
                        {pa.type === 'basic' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                        {pa.type === 'bearer' && (<div className="form-row two-col"><div><label>Token</label><input value={pa.token || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, token: e.target.value } } : a))} placeholder="eyJhbGciOi..." /></div><div><label>Prefix</label><input value={pa.prefix ?? 'Bearer'} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, prefix: e.target.value } } : a))} placeholder="Bearer" /></div></div>)}
                        {pa.type === 'apikey' && (<><div className="form-row two-col"><div><label>Key Name</label><input value={pa.apiKeyName || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyName: e.target.value } } : a))} placeholder="X-API-Key" /></div><div><label>Key Value</label><input value={pa.apiKeyValue || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyValue: e.target.value } } : a))} placeholder="your-api-key" /></div></div><div className="form-row"><label>Add to</label><div className="radio-group"><label className="radio-label"><input type="radio" checked={pa.apiKeyIn !== 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'header' } } : a))} />Header</label><label className="radio-label"><input type="radio" checked={pa.apiKeyIn === 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'query' } } : a))} />Query Parameter</label></div></div></>)}
                        {pa.type === 'digest' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                        {pa.type === 'oauth2' && (<><div className="form-row"><label>Token URL</label><input value={pa.tokenUrl || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, tokenUrl: e.target.value } } : a))} placeholder="https://auth.example.com/oauth/token" /></div><div className="form-row two-col"><div><label>Client ID</label><input value={pa.clientId || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientId: e.target.value } } : a))} /></div><div><label>Client Secret</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.clientSecret || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientSecret: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div></>)}
                        {pa.type !== 'none' && (
                          <div className="auth-verify-section">
                            <button className="btn btn-sm btn-verify" onClick={() => verifyProfileAuth(pa)} disabled={authVerifying}>{authVerifying ? 'Verifying...' : 'Verify Auth'}</button>
                            {authVerifyResult && (<div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}><span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>{authVerifyResult.msg}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {settingsTab === 'storage' && (
            <div className="settings-section">
              <h4>Storage</h4>
              <div className="storage-stats">
                <div className="storage-stat storage-stat-toggle" onClick={() => setStorageExpanded(!storageExpanded)}>
                  <span className={`storage-expand-icon ${storageExpanded ? 'expanded' : ''}`}>▸</span>
                  <span className="storage-stat-label">Total usage</span>
                  <span className="storage-stat-value">{formatBytes(storageUsage.usedBytes)}</span>
                  <span className="storage-stat-hint">/ ~5 MB limit</span>
                  <div className="storage-bar"><div className="storage-bar-fill" style={{ width: `${Math.min(100, (storageUsage.usedBytes / (5 * 1024 * 1024)) * 100)}%` }} /></div>
                </div>
                {storageExpanded && Object.entries(storageUsage.entries).sort(([, a], [, b]) => b - a).map(([key, bytes]) => (
                  <div key={key} className="storage-stat storage-stat-detail">
                    <span className="storage-stat-label">{key.replace('perf-test-', '')}</span>
                    <span className="storage-stat-value">{formatBytes(bytes)}</span>
                    <div className="storage-bar storage-bar-sm"><div className="storage-bar-fill" style={{ width: `${Math.min(100, (bytes / storageUsage.usedBytes) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="storage-max-runs">
                <label>Max stored runs</label>
                <input type="number" min={1} max={500} value={maxRuns} onChange={async (e) => {
                  const v = Math.max(1, Math.min(500, parseInt(e.target.value) || 1));
                  setMaxRunsLocal(v);
                  await setMaxRuns(v);
                  setStorageUsage(await getStorageUsage());
                }} />
                <span className="storage-hint">Oldest runs are auto-deleted when limit is exceeded. Response bodies are truncated to 2 KB each.</span>
              </div>
            </div>
            )}

            {settingsTab === 'exportImport' && (
            <div className="settings-section">
              <h4>Export & Import</h4>
              <p className="settings-section-desc">Export a project (with all its environments, microservices, auth profiles, and feature groups) or import one from a JSON file.</p>
              <div className="settings-export-import-row">
                <button className="btn btn-primary btn-sm" onClick={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowExportCenter(true); }}>Export Project</button>
                <button className="btn btn-sm" onClick={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowImportCenter(true); }}>Import Project</button>
              </div>
            </div>
            )}

              </div>{/* end settings-content */}
            </div>{/* end settings-split */}
          </div>
        </div>
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
