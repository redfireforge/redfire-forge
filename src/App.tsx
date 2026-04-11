import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, Environment, Microservice } from './types';
import {
  loadFeatureGroups, saveFeatureGroups,
  loadEnvironments, saveEnvironments,
  loadMicroservices, saveMicroservices,
  loadSelectedEnv, saveSelectedEnv,
  loadSelectedService, saveSelectedService,
  getMaxRuns, setMaxRuns, getStorageUsage,
  loadTestRuns,
} from './utils/storage';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import ExportCenter from './components/ExportCenter';
import './App.css';

type Tab = 'scenarios' | 'runner' | 'results';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>(() => loadFeatureGroups());

  const [environments, setEnvironments] = useState<Environment[]>(() => loadEnvironments());
  const [microservices, setMicroservices] = useState<Microservice[]>(() => loadMicroservices());
  const [selectedEnvId, setSelectedEnvId] = useState(() => loadSelectedEnv());
  const [selectedSvcId, setSelectedSvcId] = useState(() => loadSelectedService());

  const [showSettings, setShowSettings] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [editingBaseUrls, setEditingBaseUrls] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<{ svcId: string; envId: string; value: string } | null>(null);
  const [maxRuns, setMaxRunsLocal] = useState(() => getMaxRuns());
  const [storageUsage, setStorageUsage] = useState(() => getStorageUsage());
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('perf-test-theme') as 'dark' | 'light') || 'dark';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<'env' | 'svc'>('env');
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [dragEnvId, setDragEnvId] = useState<string | null>(null);
  const [expandedSidebarNodes, setExpandedSidebarNodes] = useState<Set<string>>(new Set());

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
    localStorage.setItem('perf-test-theme', theme);
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

  useEffect(() => { saveFeatureGroups(featureGroups); }, [featureGroups]);
  useEffect(() => { saveEnvironments(environments); }, [environments]);
  useEffect(() => { saveMicroservices(microservices); }, [microservices]);
  useEffect(() => { saveSelectedEnv(selectedEnvId); }, [selectedEnvId]);
  useEffect(() => { saveSelectedService(selectedSvcId); }, [selectedSvcId]);

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

  return (
    <div className={`app ${sidebarCollapsed ? '' : 'sidebar-visible'}`}>
      <header ref={headerRef} className="app-header">
        <h1>⚡ Performance Test</h1>
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

            <button className="btn btn-sm sidebar-settings-btn" onClick={() => { setStorageUsage(getStorageUsage()); setShowSettings(true); }}>⚙ Settings</button>
        </aside>
      )}

      <div className="app-body">
        <main className={`app-main ${sidebarCollapsed ? '' : 'sidebar-open'}`}>
          {activeTab === 'scenarios' && <ScenarioBuilder featureGroups={filteredFeatureGroups} setFeatureGroups={setFeatureGroups} resolvedBaseUrl={resolvedBaseUrl} selectedSvcId={selectedSvcId} selectedSvcName={selectedSvc?.name} selectedEnvId={selectedEnvId} selectedEnvName={selectedEnv?.name} unassociatedFeatureGroups={unassociatedFeatureGroups} microservices={microservices} environments={environments} />}
          {activeTab === 'runner' && <TestRunner featureGroups={filteredFeatureGroups} onComplete={() => setActiveTab('results')} envName={selectedEnv?.name} svcName={selectedSvc?.name} resolvedBaseUrl={resolvedBaseUrl} />}
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
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(500, parseInt(e.target.value) || 1));
                    setMaxRunsLocal(v);
                    setMaxRuns(v);
                    setStorageUsage(getStorageUsage());
                  }}
                />
                <span className="storage-hint">Oldest runs are auto-deleted when limit is exceeded. Response bodies are truncated to 2 KB each.</span>
              </div>
            </div>

            <div className="settings-divider" />

            {/* Export */}
            <div className="settings-section">
              <h4>Export</h4>
              <p className="settings-section-desc">Export environments, microservices, feature groups, and test runs as JSON.</p>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowSettings(false); setShowExportCenter(true); }}>
                Open Export Center
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportCenter && (
        <ExportCenter
          environments={environments}
          microservices={microservices}
          featureGroups={featureGroups}
          testRuns={loadTestRuns()}
          onClose={() => { setShowExportCenter(false); setShowSettings(true); }}
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
