import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, Environment, Microservice, GlobalAuthProfile, AuthConfig, AuthType, TestRun } from './types';
import { acquireOAuth2Token } from './engine/executor';
import {
  loadFeatureGroups, saveFeatureGroups,
  loadEnvironments, saveEnvironments,
  loadMicroservices, saveMicroservices,
  loadSelectedEnv, saveSelectedEnv,
  loadSelectedService, saveSelectedService,
  getMaxRuns, setMaxRuns, getStorageUsage,
  loadTestRuns, saveTestRunsBulk,
  loadGlobalAuthProfiles, saveGlobalAuthProfiles,
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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>([]);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [microservices, setMicroservices] = useState<Microservice[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [selectedSvcId, setSelectedSvcId] = useState('');

  const [testRunsCache, setTestRunsCache] = useState<TestRun[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showImportCenter, setShowImportCenter] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [editingBaseUrls, setEditingBaseUrls] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<{ svcId: string; envId: string; value: string } | null>(null);
  const [maxRuns, setMaxRunsLocal] = useState(50);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [globalAuthProfiles, setGlobalAuthProfiles] = useState<GlobalAuthProfile[]>([]);
  const [editingGlobalAuth, setEditingGlobalAuth] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<'env' | 'svc'>('env');
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [dragEnvId, setDragEnvId] = useState<string | null>(null);
  const [expandedSidebarNodes, setExpandedSidebarNodes] = useState<Set<string>>(new Set());

  // Load all persisted data on mount
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      const [fgs, envs, svcs, envId, svcId, maxR, usage, profiles, savedTheme, runs] = await Promise.all([
        loadFeatureGroups(),
        loadEnvironments(),
        loadMicroservices(),
        loadSelectedEnv(),
        loadSelectedService(),
        getMaxRuns(),
        getStorageUsage(),
        loadGlobalAuthProfiles(),
        loadTheme(),
        loadTestRuns(),
      ]);
      setFeatureGroups(fgs);
      setEnvironments(envs);
      setMicroservices(svcs);
      setSelectedEnvId(envId);
      setSelectedSvcId(svcId);
      setMaxRunsLocal(maxR);
      setStorageUsage(usage);
      setGlobalAuthProfiles(profiles);
      setTheme(savedTheme as 'dark' | 'light');
      setTestRunsCache(runs);
      document.documentElement.setAttribute('data-theme', savedTheme);
      setLoading(false);
    })();
  }, []);

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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

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

  useEffect(() => { if (!loading) void saveFeatureGroups(featureGroups); }, [featureGroups, loading]);
  useEffect(() => { if (!loading) void saveEnvironments(environments); }, [environments, loading]);
  useEffect(() => { if (!loading) void saveMicroservices(microservices); }, [microservices, loading]);
  useEffect(() => { if (!loading) void saveGlobalAuthProfiles(globalAuthProfiles); }, [globalAuthProfiles, loading]);
  useEffect(() => { if (!loading) void saveSelectedEnv(selectedEnvId); }, [selectedEnvId, loading]);
  useEffect(() => { if (!loading) void saveSelectedService(selectedSvcId); }, [selectedSvcId, loading]);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);
  const selectedSvc = microservices.find((s) => s.id === selectedSvcId);
  const resolvedBaseUrl = selectedEnv && selectedSvc ? (selectedSvc.baseUrls[selectedEnv.id] ?? '') : '';
  const filteredFeatureGroups = (selectedSvcId && selectedEnvId)
    ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && fg.environmentId === selectedEnvId)
    : selectedSvcId
      ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId)
      : [];
  // FGs that have microserviceId but no environmentId — show them under their microservice so user can assign an env
  const needsEnvAssignment = selectedSvcId
    ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && !fg.environmentId)
    : [];
  // FGs missing both — truly unassociated
  const fullyUnassociated = featureGroups.filter((fg) => !fg.microserviceId);
  const unassociatedFeatureGroups = [...needsEnvAssignment, ...fullyUnassociated];

  const confirm = (message: string, onConfirm: () => void) => setConfirmAction({ message, onConfirm });

  // Environment CRUD
  const addEnv = () => {
    if (!newEnvName.trim()) return;
    setEnvironments((prev) => [...prev, { id: uuidv4(), name: newEnvName.trim() }]);
    setNewEnvName('');
  };
  const doRemoveEnv = (id: string) => {
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    setMicroservices((prev) => prev.map((s) => {
      const { [id]: _, ...rest } = s.baseUrls;
      return { ...s, baseUrls: rest };
    }));
    if (selectedEnvId === id) setSelectedEnvId('');
  };
  const removeEnv = (id: string) => {
    const env = environments.find((e) => e.id === id);
    const affectedSvcs = microservices.filter((s) => id in s.baseUrls);
    const detail = affectedSvcs.length > 0
      ? `This will also remove it from ${affectedSvcs.length} microservice(s).`
      : '';
    confirm(`Delete environment "${env?.name}"? ${detail}`, () => doRemoveEnv(id));
  };
  const dropEnvOn = (targetId: string) => {
    if (!dragEnvId || dragEnvId === targetId) return;
    setEnvironments((prev) => {
      const fromIdx = prev.findIndex((e) => e.id === dragEnvId);
      const toIdx = prev.findIndex((e) => e.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  // Microservice CRUD
  const addSvc = () => {
    if (!newSvcName.trim()) return;
    setMicroservices((prev) => [...prev, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }]);
    setNewSvcName('');
  };
  const doRemoveSvc = (id: string) => {
    setMicroservices((prev) => prev.filter((s) => s.id !== id));
    setFeatureGroups((prev) => prev.filter((fg) => fg.microserviceId !== id));
    if (selectedSvcId === id) setSelectedSvcId('');
  };
  const removeSvc = (id: string) => {
    const svc = microservices.find((s) => s.id === id);
    const envCount = Object.keys(svc?.baseUrls ?? {}).length;
    const fgCount = featureGroups.filter((fg) => fg.microserviceId === id).length;
    const details: string[] = [];
    if (envCount > 0) details.push(`deployed to ${envCount} environment(s)`);
    if (fgCount > 0) details.push(`${fgCount} feature group(s) will be deleted`);
    const detail = details.length > 0 ? details.join(', ') + '.' : '';
    confirm(`Delete microservice "${svc?.name}"? ${detail}`, () => doRemoveSvc(id));
  };
  const toggleSvcEnv = (svcId: string, envId: string) => {
    const svc = microservices.find((s) => s.id === svcId);
    const env = environments.find((e) => e.id === envId);
    const isRemoving = svc && envId in svc.baseUrls;
    const doToggle = () => {
      setMicroservices((prev) => prev.map((s) => {
        if (s.id !== svcId) return s;
        const next = { ...s.baseUrls };
        if (envId in next) delete next[envId];
        else next[envId] = '';
        return { ...s, baseUrls: next };
      }));
    };
    if (isRemoving && svc?.baseUrls[envId]) {
      confirm(`Remove "${svc?.name}" from "${env?.name}"? The base URL will be lost.`, doToggle);
    } else {
      doToggle();
    }
  };
  const updateBaseUrl = (svcId: string, envId: string, url: string) => {
    setMicroservices((prev) => prev.map((s) =>
      s.id === svcId ? { ...s, baseUrls: { ...s.baseUrls, [envId]: url } } : s
    ));
  };

  // Global Auth Profile CRUD
  const [authVerifying, setAuthVerifying] = useState(false);
  const [authVerifyResult, setAuthVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const addGlobalAuthProfile = () => {
    if (!newProfileName.trim()) return;
    const profile: GlobalAuthProfile = {
      id: uuidv4(),
      name: newProfileName.trim(),
      auth: { type: 'none' },
    };
    setGlobalAuthProfiles((prev) => [...prev, profile]);
    setNewProfileName('');
    setEditingGlobalAuth(profile.id);
  };
  const removeGlobalAuthProfile = (id: string) => {
    const profile = globalAuthProfiles.find((p) => p.id === id);
    const linkedFGs = featureGroups.filter((fg) => fg.globalAuthProfileId === id);
    const detail = linkedFGs.length > 0 ? ` ${linkedFGs.length} feature group(s) reference this profile and will fall back to their own auth.` : '';
    confirm(`Delete auth profile "${profile?.name}"?${detail}`, () => {
      setGlobalAuthProfiles((prev) => prev.filter((p) => p.id !== id));
      if (editingGlobalAuth === id) setEditingGlobalAuth(null);
    });
  };
  const updateGlobalAuthProfile = (id: string, updates: Partial<GlobalAuthProfile>) => {
    setGlobalAuthProfiles((prev) => prev.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    ));
  };
  const updateProfileAuth = (id: string, auth: AuthConfig) => {
    updateGlobalAuthProfile(id, { auth });
  };
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

  type ItemAction = 'add' | 'skip' | 'overwrite' | 'keepBoth';
  const handleImport = useCallback(async (data: {
    environments?: { item: Environment; action: ItemAction }[];
    microservices?: { item: Microservice; action: ItemAction }[];
    globalAuthProfiles?: { item: GlobalAuthProfile; action: ItemAction }[];
    featureGroups?: { item: FeatureGroup; action: ItemAction }[];
    testRuns?: { item: TestRun; action: ItemAction }[];
  }) => {
    const applyItems = <T extends { id: string }>(
      entries: { item: T; action: ItemAction }[] | undefined,
      existing: T[],
      getName: (item: T) => string,
    ): T[] => {
      if (!entries?.length) return existing;
      const existingById = new Map(existing.map((e) => [e.id, e]));
      const existingByName = new Map(existing.map((e) => [getName(e).toLowerCase(), e]));
      const result = [...existing];

      for (const { item, action } of entries) {
        if (action === 'skip') continue;
        const byId = existingById.get(item.id);
        const byName = !byId ? existingByName.get(getName(item).toLowerCase()) : undefined;

        if (action === 'add' && !byId && !byName) {
          result.push(item);
        } else if (action === 'overwrite') {
          if (byId) {
            const idx = result.findIndex((e) => e.id === item.id);
            if (idx !== -1) result[idx] = item;
          } else if (byName) {
            const idx = result.findIndex((e) => e.id === byName.id);
            if (idx !== -1) result[idx] = { ...item, id: byName.id };
          }
        } else if (action === 'keepBoth') {
          const clone = { ...item, id: uuidv4() } as T;
          if ('scenarios' in clone && Array.isArray((clone as Record<string, unknown>).scenarios)) {
            const fg = clone as unknown as FeatureGroup;
            fg.scenarios = fg.scenarios.map((sc) => ({
              ...sc,
              id: uuidv4(),
              tests: sc.tests.map((t) => ({ ...t, id: uuidv4() })),
            }));
          }
          result.push(clone);
        }
      }
      return result;
    };

    if (data.environments) {
      setEnvironments(applyItems(data.environments, environments, (e) => e.name));
    }
    if (data.microservices) {
      setMicroservices(applyItems(data.microservices, microservices, (s) => s.name));
    }
    if (data.globalAuthProfiles) {
      setGlobalAuthProfiles(applyItems(data.globalAuthProfiles, globalAuthProfiles, (p) => p.name));
    }
    if (data.featureGroups) {
      setFeatureGroups((prev) => applyItems(data.featureGroups, prev, (fg) => fg.name));
    }
    if (data.testRuns) {
      const existingRuns = await loadTestRuns();
      const merged = applyItems(data.testRuns, existingRuns, (r) => r.id);
      merged.sort((a, b) => b.timestamp - a.timestamp);
      await saveTestRunsBulk(merged);
    }

    setShowImportCenter(false);
    setShowSettings(true);
    setStorageUsage(await getStorageUsage());
  }, [environments, microservices, globalAuthProfiles, featureGroups]);

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
        <h1>🔥 RedfireForge</h1>
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
          <div className="header-select-group">
            <label>Environment</label>
            <select value={selectedEnvId} onChange={(e) => setSelectedEnvId(e.target.value)}>
              <option value="">— Select —</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
          <div className="header-select-group">
            <label>Microservice</label>
            <select value={selectedSvcId} onChange={(e) => setSelectedSvcId(e.target.value)}>
              <option value="">— Select —</option>
              {microservices.map((svc) => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
          </div>
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
            {/* Toggle buttons */}
            <div className="sidebar-toggle">
              <button className={`sidebar-toggle-btn ${sidebarView === 'env' ? 'active' : ''}`} onClick={() => { setSidebarView('env'); setExpandedSidebarNodes(new Set()); }}>Environments</button>
              <button className={`sidebar-toggle-btn ${sidebarView === 'svc' ? 'active' : ''}`} onClick={() => { setSidebarView('svc'); setExpandedSidebarNodes(new Set()); }}>Microservices</button>
            </div>
            <div className="sidebar-expand-all">
              <button className="btn btn-xs" onClick={allExpanded ? collapseAllSidebar : expandAllSidebar}>
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            {/* Browse by Environment */}
            {sidebarView === 'env' && (
              <div className="sidebar-list">
                {environments.length === 0 && <div className="empty-hint">No environments. Open Settings to add.</div>}
                {environments.map((env) => {
                  const svcsInEnv = microservices.filter((s) => env.id in s.baseUrls);
                  const isExpanded = expandedSidebarNodes.has(env.id);
                  const envHasFeatures = featureGroups.some((fg) => fg.environmentId === env.id);
                  return (
                    <div key={env.id} className="sidebar-tree-node">
                      <div
                        className={`sidebar-item ${selectedEnvId === env.id ? 'selected' : ''} ${envHasFeatures ? 'has-features' : 'no-features'}`}
                      >
                        <span
                          className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(env.id); }}
                        >▸</span>
                        <span
                          className="sidebar-item-name"
                          onClick={() => {
                            if (selectedEnvId === env.id) { setSelectedEnvId(''); setSelectedSvcId(''); }
                            else { setSelectedEnvId(env.id); setSelectedSvcId(''); }
                            if (!isExpanded) toggleExpanded(env.id);
                          }}
                        >{env.name}</span>
                        <span className="sidebar-item-count">{svcsInEnv.length}</span>
                      </div>
                      {isExpanded && (
                        <div className="sidebar-children">
                          {svcsInEnv.length === 0
                            ? <div className="empty-hint">No microservices deployed here.</div>
                            : svcsInEnv.map((svc) => {
                              const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                              return (
                                <div
                                  key={svc.id}
                                  className={`sidebar-child ${selectedEnvId === env.id && selectedSvcId === svc.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                                  onClick={() => {
                                    setSelectedEnvId(env.id);
                                    setSelectedSvcId(svc.id);
                                  }}
                                >
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

            {/* Browse by Microservice */}
            {sidebarView === 'svc' && (
              <div className="sidebar-list">
                {microservices.length === 0 && <div className="empty-hint">No microservices. Open Settings to add.</div>}
                {microservices.map((svc) => {
                  const envsForSvc = environments.filter((e) => e.id in svc.baseUrls);
                  const isExpanded = expandedSidebarNodes.has(svc.id);
                  const svcHasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id);
                  return (
                    <div key={svc.id} className="sidebar-tree-node">
                      <div
                        className={`sidebar-item ${selectedSvcId === svc.id ? 'selected' : ''} ${svcHasFeatures ? 'has-features' : 'no-features'}`}
                      >
                        <span
                          className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(svc.id); }}
                        >▸</span>
                        <span
                          className="sidebar-item-name"
                          onClick={() => {
                            if (selectedSvcId === svc.id) { setSelectedSvcId(''); setSelectedEnvId(''); }
                            else { setSelectedSvcId(svc.id); setSelectedEnvId(''); }
                            if (!isExpanded) toggleExpanded(svc.id);
                          }}
                        >{svc.name}</span>
                        <span className="sidebar-item-count">{envsForSvc.length}</span>
                      </div>
                      {isExpanded && (
                        <div className="sidebar-children">
                          {envsForSvc.length === 0
                            ? <div className="empty-hint">Not deployed to any environment.</div>
                            : envsForSvc.map((env) => {
                              const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                              return (
                              <div
                                key={env.id}
                                className={`sidebar-child ${selectedSvcId === svc.id && selectedEnvId === env.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                                onClick={() => {
                                  setSelectedSvcId(svc.id);
                                  setSelectedEnvId(env.id);
                                }}
                              >
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
          {activeTab === 'scenarios' && <ScenarioBuilder featureGroups={filteredFeatureGroups} setFeatureGroups={setFeatureGroups} resolvedBaseUrl={resolvedBaseUrl} selectedSvcId={selectedSvcId} selectedSvcName={selectedSvc?.name} selectedEnvId={selectedEnvId} selectedEnvName={selectedEnv?.name} unassociatedFeatureGroups={unassociatedFeatureGroups} microservices={microservices} environments={environments} globalAuthProfiles={globalAuthProfiles} />}
          {activeTab === 'runner' && <TestRunner featureGroups={filteredFeatureGroups} onComplete={() => setActiveTab('results')} envName={selectedEnv?.name} svcName={selectedSvc?.name} resolvedBaseUrl={resolvedBaseUrl} globalAuthProfiles={globalAuthProfiles} />}
          {activeTab === 'results' && <ResultsDashboard envName={selectedEnv?.name} svcName={selectedSvc?.name} />}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Settings</h3>
              <button className="btn btn-sm" onClick={() => setShowSettings(false)}>Close</button>
            </div>

            {/* Environments */}
            <div className="settings-section">
              <h4>Environments</h4>
              <div className="settings-add-row">
                <input
                  placeholder="e.g. t01, p01, staging"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addEnv(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={addEnv} disabled={!newEnvName.trim()}>Add</button>
              </div>
              {environments.length === 0 && <div className="empty-hint">No environments defined.</div>}
              <div className="settings-env-chips">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={`settings-chip ${dragEnvId === env.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragEnvId(env.id)}
                    onDragEnd={() => setDragEnvId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropEnvOn(env.id)}
                  >
                    <span className="chip-grip">⠿</span>
                    <span>{env.name}</span>
                    <button className="settings-chip-delete" onClick={() => removeEnv(env.id)} title="Delete">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-divider" />

            {/* Microservices */}
            <div className="settings-section">
              <h4>Microservices</h4>
              <div className="settings-add-row">
                <input
                  placeholder="e.g. sales-product-autoassign"
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSvc(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={addSvc} disabled={!newSvcName.trim()}>Add</button>
              </div>
              {microservices.length === 0 && <div className="empty-hint">No microservices defined.</div>}
              <div className="settings-svc-list">
                {microservices.map((svc) => {
                  const isExpanded = editingBaseUrls === svc.id;
                  const deployedCount = environments.filter((env) => env.id in svc.baseUrls).length;
                  return (
                    <div key={svc.id} className={`settings-svc-card ${isExpanded ? 'expanded' : ''}`}>
                      <div className="settings-svc-header">
                        <span className="settings-svc-name">{svc.name}</span>
                        <span className="settings-svc-count">{deployedCount}/{environments.length} envs</span>
                        <button className="btn btn-sm" onClick={() => setEditingBaseUrls(isExpanded ? null : svc.id)}>
                          {isExpanded ? 'Collapse' : 'Configure'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => removeSvc(svc.id)}>Delete</button>
                      </div>
                      {isExpanded && (
                        <div className="settings-svc-envs">
                          {environments.length === 0 && <div className="empty-hint">Add environments first.</div>}
                          {environments.map((env) => {
                            const deployed = env.id in svc.baseUrls;
                            const isEditingThis = editingUrl?.svcId === svc.id && editingUrl?.envId === env.id;
                            const currentUrl = svc.baseUrls[env.id] ?? '';
                            return (
                              <div key={env.id} className={`settings-env-row ${deployed ? 'deployed' : ''}`}>
                                <label className="settings-env-check">
                                  <input
                                    type="checkbox"
                                    checked={deployed}
                                    onChange={() => toggleSvcEnv(svc.id, env.id)}
                                  />
                                  <span className="settings-env-name">{env.name}</span>
                                </label>
                                {deployed && (
                                  isEditingThis ? (
                                    <div className="settings-url-edit">
                                      <input
                                        className="settings-env-url"
                                        autoFocus
                                        value={editingUrl.value}
                                        onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') { updateBaseUrl(svc.id, env.id, editingUrl.value); setEditingUrl(null); }
                                          if (e.key === 'Escape') setEditingUrl(null);
                                        }}
                                        placeholder={`https://${svc.name}.${env.name}.example.com`}
                                      />
                                      <button className="btn btn-primary btn-xs" onClick={() => { updateBaseUrl(svc.id, env.id, editingUrl.value); setEditingUrl(null); }}>Save</button>
                                      <button className="btn btn-xs" onClick={() => setEditingUrl(null)}>Cancel</button>
                                    </div>
                                  ) : (
                                    <div className="settings-url-display">
                                      {currentUrl
                                        ? <code className="settings-url-value">{currentUrl}</code>
                                        : <span className="settings-url-placeholder">No URL configured</span>
                                      }
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

            <div className="settings-divider" />

            {/* Global Auth Profiles */}
            <div className="settings-section">
              <h4>Global Auth Profiles</h4>
              <p className="settings-section-desc">
                Reusable authentication configurations (e.g. dev, QA, prod). Feature Groups can inherit from these profiles.
              </p>
              <div className="settings-add-row">
                <input
                  placeholder="Profile name (e.g. dev-oauth2, qa-bearer)"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGlobalAuthProfile()}
                />
                <button className="btn btn-sm btn-primary" onClick={addGlobalAuthProfile}>+ Add Profile</button>
              </div>
              <div className="settings-list">
                {globalAuthProfiles.map((profile) => {
                  const isEditing = editingGlobalAuth === profile.id;
                  const pa = profile.auth;
                  return (
                    <div key={profile.id} className="global-auth-profile-card">
                      <div className="global-auth-profile-header">
                        <input
                          className="global-auth-profile-name"
                          value={profile.name}
                          onChange={(e) => updateGlobalAuthProfile(profile.id, { name: e.target.value })}
                        />
                        <span className={`auth-badge auth-badge-${pa.type === 'none' ? 'none' : 'configured'}`}>
                          {pa.type === 'none' ? 'No Auth' : pa.type.toUpperCase()}
                        </span>
                        <button className="btn btn-sm" onClick={() => { setEditingGlobalAuth(isEditing ? null : profile.id); setAuthVerifyResult(null); setShowSecret(false); }}>
                          {isEditing ? 'Collapse' : 'Configure'}
                        </button>
                        <button className="btn btn-sm btn-danger-outline" onClick={() => removeGlobalAuthProfile(profile.id)}>Delete</button>
                      </div>
                      {isEditing && (
                        <div className="global-auth-profile-body">
                          <div className="auth-type-select">
                            <label>Type</label>
                            <select value={pa.type} onChange={(e) => updateProfileAuth(profile.id, { ...pa, type: e.target.value as AuthType })}>
                              <option value="none">No Auth</option>
                              <option value="basic">Basic Auth</option>
                              <option value="bearer">Bearer Token</option>
                              <option value="apikey">API Key</option>
                              <option value="digest">Digest Auth</option>
                              <option value="oauth2">OAuth2 Client Credentials</option>
                            </select>
                          </div>
                          {pa.type === 'basic' && (
                            <div className="form-row two-col">
                              <div>
                                <label>Username</label>
                                <input value={pa.username || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, username: e.target.value })} />
                              </div>
                              <div>
                                <label>Password</label>
                                <div className="secret-input-wrap">
                                  <input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, password: e.target.value })} />
                                  <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                                </div>
                              </div>
                            </div>
                          )}
                          {pa.type === 'bearer' && (
                            <div className="form-row two-col">
                              <div>
                                <label>Token</label>
                                <input value={pa.token || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, token: e.target.value })} placeholder="eyJhbGciOi..." />
                              </div>
                              <div>
                                <label>Prefix</label>
                                <input value={pa.prefix ?? 'Bearer'} onChange={(e) => updateProfileAuth(profile.id, { ...pa, prefix: e.target.value })} placeholder="Bearer" />
                              </div>
                            </div>
                          )}
                          {pa.type === 'apikey' && (
                            <>
                              <div className="form-row two-col">
                                <div>
                                  <label>Key Name</label>
                                  <input value={pa.apiKeyName || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, apiKeyName: e.target.value })} placeholder="X-API-Key" />
                                </div>
                                <div>
                                  <label>Key Value</label>
                                  <input value={pa.apiKeyValue || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, apiKeyValue: e.target.value })} placeholder="your-api-key" />
                                </div>
                              </div>
                              <div className="form-row">
                                <label>Add to</label>
                                <div className="radio-group">
                                  <label className="radio-label">
                                    <input type="radio" checked={pa.apiKeyIn !== 'query'} onChange={() => updateProfileAuth(profile.id, { ...pa, apiKeyIn: 'header' })} />
                                    Header
                                  </label>
                                  <label className="radio-label">
                                    <input type="radio" checked={pa.apiKeyIn === 'query'} onChange={() => updateProfileAuth(profile.id, { ...pa, apiKeyIn: 'query' })} />
                                    Query Parameter
                                  </label>
                                </div>
                              </div>
                            </>
                          )}
                          {pa.type === 'digest' && (
                            <div className="form-row two-col">
                              <div>
                                <label>Username</label>
                                <input value={pa.username || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, username: e.target.value })} />
                              </div>
                              <div>
                                <label>Password</label>
                                <div className="secret-input-wrap">
                                  <input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, password: e.target.value })} />
                                  <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                                </div>
                              </div>
                            </div>
                          )}
                          {pa.type === 'oauth2' && (
                            <>
                              <div className="form-row">
                                <label>Token URL</label>
                                <input value={pa.tokenUrl || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
                              </div>
                              <div className="form-row two-col">
                                <div>
                                  <label>Client ID</label>
                                  <input value={pa.clientId || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, clientId: e.target.value })} />
                                </div>
                                <div>
                                  <label>Client Secret</label>
                                  <div className="secret-input-wrap">
                                    <input type={showSecret ? 'text' : 'password'} value={pa.clientSecret || ''} onChange={(e) => updateProfileAuth(profile.id, { ...pa, clientSecret: e.target.value })} />
                                    <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          {pa.type !== 'none' && (
                            <div className="auth-verify-section">
                              <button
                                className="btn btn-sm btn-verify"
                                onClick={() => verifyProfileAuth(pa)}
                                disabled={authVerifying}
                              >
                                {authVerifying ? 'Verifying...' : 'Verify Auth'}
                              </button>
                              {authVerifyResult && (
                                <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
                                  <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                                  {authVerifyResult.msg}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {globalAuthProfiles.length === 0 && (
                  <p className="settings-empty-hint">No global auth profiles yet. Add one to share auth configurations across feature groups.</p>
                )}
              </div>
            </div>

            <div className="settings-divider" />

            {/* Storage */}
            <div className="settings-section">
              <h4>Storage</h4>
              <div className="storage-stats">
                <div className="storage-stat storage-stat-toggle" onClick={() => setStorageExpanded(!storageExpanded)}>
                  <span className={`storage-expand-icon ${storageExpanded ? 'expanded' : ''}`}>▸</span>
                  <span className="storage-stat-label">Total usage</span>
                  <span className="storage-stat-value">{formatBytes(storageUsage.usedBytes)}</span>
                  <span className="storage-stat-hint">/ ~5 MB limit</span>
                  <div className="storage-bar">
                    <div className="storage-bar-fill" style={{ width: `${Math.min(100, (storageUsage.usedBytes / (5 * 1024 * 1024)) * 100)}%` }} />
                  </div>
                </div>
                {storageExpanded && Object.entries(storageUsage.entries)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, bytes]) => (
                    <div key={key} className="storage-stat storage-stat-detail">
                      <span className="storage-stat-label">{key.replace('perf-test-', '')}</span>
                      <span className="storage-stat-value">{formatBytes(bytes)}</span>
                      <div className="storage-bar storage-bar-sm">
                        <div className="storage-bar-fill" style={{ width: `${Math.min(100, (bytes / storageUsage.usedBytes) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="storage-max-runs">
                <label>Max stored runs</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxRuns}
                  onChange={async (e) => {
                    const v = Math.max(1, Math.min(500, parseInt(e.target.value) || 1));
                    setMaxRunsLocal(v);
                    await setMaxRuns(v);
                    setStorageUsage(await getStorageUsage());
                  }}
                />
                <span className="storage-hint">Oldest runs are auto-deleted when limit is exceeded. Response bodies are truncated to 2 KB each.</span>
              </div>
            </div>

            <div className="settings-divider" />

            {/* Export & Import */}
            <div className="settings-section">
              <h4>Export & Import</h4>
              <p className="settings-section-desc">Export or import environments, microservices, global auth profiles, feature groups, and test runs as JSON.</p>
              <div className="settings-export-import-row">
                <button className="btn btn-primary btn-sm" onClick={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowExportCenter(true); }}>
                  Export Data
                </button>
                <button className="btn btn-sm" onClick={async () => { setTestRunsCache(await loadTestRuns()); setShowSettings(false); setShowImportCenter(true); }}>
                  Import Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportCenter && (
        <ExportCenter
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          testRuns={testRunsCache}
          globalAuthProfiles={globalAuthProfiles}
          onClose={() => { setShowExportCenter(false); setShowSettings(true); }}
        />
      )}

      {showImportCenter && (
        <ImportCenter
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          testRuns={testRunsCache}
          globalAuthProfiles={globalAuthProfiles}
          onImport={handleImport}
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
