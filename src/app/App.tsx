import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { RequestCollection, Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '../shared/types';
import type { CatalogEntry, SavedEndpointValues } from '../features/catalog/types/catalog';
import { buildCatalogExport } from '../features/catalog/utils/catalogExport';
import { useGalleryImport } from './hooks/useGalleryImport';
import { findFolderDeep } from '../features/requests/utils/requestTree';
import ThemeCustomizer from './ThemeCustomizer';
import { isCustomThemeId, findSavedTheme } from './themeCustomizerUtils';
import { loadCatalogEndpointValues, loadPreviewSampleId, savePreviewSampleId } from '../shared/utils/storage';
import { saveFile } from '../shared/utils/fileSaver';
import { mergeById } from '../shared/utils/helpers';

import { useWorkflowImportExport } from './hooks/useWorkflowImportExport';
import { useRerunFailed } from './hooks/useRerunFailed';
import { useTheme } from './hooks/useTheme';
import { useProjects } from '../features/scenarios/hooks/useProjects';
import { useRequests } from '../features/requests/hooks/useRequests';
import { useCatalog } from '../features/catalog/hooks/useCatalog';
import { useSidebarResize } from './hooks/useSidebarResize';
import ScenarioBuilder from '../features/scenarios/ScenarioBuilder';
import TestRunner from '../features/test-runner/TestRunner';
import WorkflowRunner from '../features/test-runner/WorkflowRunner';
import ResultsDashboard from '../features/results/ResultsDashboard';
import Requests from '../features/requests/Requests';
import type { PreviewRequest } from '../features/requests/Requests';
import ApiCatalog from '../features/catalog/ApiCatalog';
import CatalogSidebar from '../features/catalog/components/CatalogSidebar';
import CatalogImportModal from '../features/catalog/components/CatalogImportModal';
import CatalogVersionHistory from '../features/catalog/components/CatalogVersionHistory';
import CatalogEditModal from '../features/catalog/components/CatalogEditModal';
import CatalogSendToRequestsModal from '../features/catalog/components/CatalogSendToRequestsModal';
import type { SendToRequestsPayload } from '../features/catalog/components/CatalogSendToRequestsModal';

import Sidebar from './Sidebar';
import RequestsSidebar from '../features/requests/components/RequestsSidebar';
import SettingsPage from '../features/settings/SettingsModal';
import EnvironmentManager from '../features/environments/EnvironmentManager';
import WorkflowDesigner from '../features/workflow/WorkflowDesigner';
import WorkflowExecutionHistory from '../features/workflow/WorkflowExecutionHistory';
import WebhookDeliveryLogs from '../features/webhooks/WebhookDeliveryLogs';
import WorkflowSidebar from '../features/workflow/components/panels/WorkflowSidebar';
import ServerStatusIndicator from '../features/workflow/components/panels/ServerStatusIndicator';
import { GalleryPage } from '../features/gallery/GalleryPage';
import TrainingTracksView from '../features/training/TrainingTracksView';
import { useWorkflows } from '../features/workflow/hooks/useWorkflows';
import { sampleWorkflowCatalog } from '../data/galleries/workflows';
import { getAutoLayoutNodes } from '../features/workflow/utils/workflowAutoLayout';
import type { Workflow } from '../features/workflow/types/workflow';
import RequestCollectionModal from '../features/requests/components/RequestCollectionModal';
import SubCollectionModal from '../features/requests/components/SubCollectionModal';
import { useToast } from '../shared/hooks/useToast';
import {
  type Tab,
  domainOf,
  isApiTab,
  isWorkflowTab,
  isHarnessTab,
  isGalleryTab,
  isSettingsTab,
  readTabFromUrl,
  writeTabToUrl,
} from './utils/appTabUtils';
import '../styles/index.css';

declare const __APP_VERSION__: string;

export default function App() {
  const {
    loading,
    environments, setEnvironments,
    microservices, setMicroservices,
    featureGroups, setFeatureGroups,
    appGlobalAuthProfiles, setAppGlobalAuthProfiles,
    sharedDataSources, setSharedDataSources,
    selectedEnvId, setSelectedEnvId,
    selectedSvcId, setSelectedSvcId,
    moveScenario, moveTest,
    initialTheme, initialTestRuns,
  } = useProjects();

  const wb = useRequests();
  const catalog = useCatalog();
  const wfHook = useWorkflows();
  const { theme, setTheme, showCustomizer, setShowCustomizer, themePickerOpen, setThemePickerOpen, themePickerRef, reapplyTheme, THEMES, THEME_ICONS } = useTheme();
  const toast = useToast();
  const { handleWorkflowExport, handleWorkflowImport } = useWorkflowImportExport({
    wfHook, setActiveTab: (t) => setActiveTab(t as Tab), showToast: toast.show,
  });

  // ---- App shell state ----
  const [activeTab, setActiveTab] = useState<Tab>(() => readTabFromUrl());
  const [resultsRunTypeFilter, setResultsRunTypeFilter] = useState<'all' | 'test' | 'workflow' | undefined>();
  const [workflowRunnerInitialId, setWorkflowRunnerInitialId] = useState<string | null>(null);

  const { sidebarWidth, sidebarCollapsed, setSidebarCollapsed, handleResizeStart } = useSidebarResize();

  const handleCompleteToResults = (runType?: 'test' | 'workflow') => {
    setResultsRunTypeFilter(runType);
    setActiveTab('results');
  };

  const handleRunInHarness = (workflowId: string) => {
    setWorkflowRunnerInitialId(workflowId);
    setActiveTab('workflow-runner');
  };

  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showWbCollectionModal, setShowWbCollectionModal] = useState(false);
  const [editingWbCollection, setEditingWbCollection] = useState<RequestCollection | null>(null);
  const [editingSubCol, setEditingSubCol] = useState<{ colId: string; folderId: string } | null>(null);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [catalogReimportId, setCatalogReimportId] = useState<string | undefined>();
  const [catalogInitialSpec, setCatalogInitialSpec] = useState<{ yaml: string; name: string } | undefined>();
  const [catalogVersionHistoryId, setCatalogVersionHistoryId] = useState<string | undefined>();
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(() => {
    const savedId = loadPreviewSampleId();
    if (!savedId) return null;
    const entry = sampleWorkflowCatalog.find(e => e.id === savedId);
    if (!entry) return null;
    const sample = entry.factory();
    const laidOut = getAutoLayoutNodes(sample.nodes as unknown as Node[], sample.edges as unknown as Edge[], 'TB');
    return { ...sample, nodes: laidOut as unknown as typeof sample.nodes };
  });
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest | null>(null);
  // Gallery is now a proper tab — no separate modal state needed.
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
       
      setTheme(initialTheme);
       
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

  // ---- Theme ----

  // ---- Fix Gallery Samples microservice baseUrls (migration for pre-0.9.1 data) ----
  const galleryFixApplied = useRef(false);
  useEffect(() => {
    if (loading || galleryFixApplied.current) return;
    galleryFixApplied.current = true;
    const galEnv = environments.find(e => e.name === 'Gallery Samples');
    const galSvc = microservices.find(s => s.name === 'Gallery Samples');
    if (galEnv && galSvc && !(galEnv.id in galSvc.baseUrls)) {
      setMicroservices(prev => prev.map(s =>
        s.id === galSvc.id ? { ...s, baseUrls: { ...s.baseUrls, [galEnv.id]: '' } } : s
      ));
    }
  }, [loading, environments, microservices, setMicroservices]);

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

  const { isRerunning, handleRerunFailed } = useRerunFailed({
    featureGroups, resolvedBaseUrl, globalAuthProfiles: appGlobalAuthProfiles, envFallbackAuth,
    onComplete: () => handleCompleteToResults('test'),
  });

  const gallery = useGalleryImport({
    wb, featureGroups, environments, microservices, previewWorkflow, workflows: wfHook.workflows,
    setActiveTab, setPreviewRequest, setPreviewWorkflow,
    setCatalogInitialSpec, setShowCatalogImport,
    setFeatureGroups, setEnvironments, setMicroservices,
    setSelectedEnvId, setSelectedSvcId,
  });

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

  const handleExportSpec = useCallback(async (entryId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
    if (!raw) return;
    const filename = `${entry.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${entry.versions[0]?.version ?? 'unknown'}.yaml`;
    const blob = new Blob([raw], { type: 'text/yaml' });
    await saveFile(blob, { filename, mimeType: 'text/yaml', description: 'YAML spec' });
  }, [catalog]);

  const handleImportData = useCallback(async (data: {
    environments?: Environment[];
    microservices?: Microservice[];
    featureGroups?: FeatureGroup[];
    globalAuthProfiles?: GlobalAuthProfile[];
  }) => {
    if (data.environments?.length) {
      setEnvironments((prev) => mergeById(prev, data.environments!));
    }
    if (data.microservices?.length) {
      setMicroservices((prev) => mergeById(prev, data.microservices!));
    }
    if (data.featureGroups?.length) {
      setFeatureGroups((prev) => [...prev, ...data.featureGroups!]);
    }
    if (data.globalAuthProfiles?.length) {
      setAppGlobalAuthProfiles((prev) => mergeById(prev, data.globalAuthProfiles!));
    }
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
        <h1>🔥 RedfireForge
          <span style={{ fontSize: '0.4em', fontWeight: 400, opacity: 0.5, marginLeft: '0.6em', verticalAlign: 'middle', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>v{__APP_VERSION__}</span>
        </h1>
        <div className="header-selectors">
          <div className="header-select-group">
            <select value={selectedEnvId} onChange={(e) => setSelectedEnvId(e.target.value)}>
              <option value="">Environment…</option>
              {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            </select>
          </div>
          <div className="header-select-group">
            <select value={selectedSvcId} onChange={(e) => setSelectedSvcId(e.target.value)}>
              <option value="">Service…</option>
              {microservices.map((svc) => <option key={svc.id} value={svc.id}>{svc.name}</option>)}
            </select>
          </div>
          <div className={`theme-picker${themePickerOpen ? ' open' : ''}`} ref={themePickerRef}>
            <button className="theme-toggle" onClick={() => setThemePickerOpen(o => !o)}
              title={`Theme: ${isCustomThemeId(theme) ? (findSavedTheme(theme)?.name ?? 'Custom') : theme}`}>
              {THEME_ICONS[theme] ?? '🎨'}
            </button>
            <div className="theme-dropdown">
              {THEMES.map(g => (
                <div key={g.group}>
                  <div className="theme-dropdown-label">{g.group}</div>
                  {g.items.map(t => (
                    <button key={t.id} className={`theme-option${theme === t.id ? ' active' : ''}`}
                      onClick={() => { setTheme(t.id); setThemePickerOpen(false); }}>
                      <span className="theme-opt-icon">{t.icon}</span>
                      {t.label}
                      <span className="theme-opt-swatch" style={{ background: t.bg }} />
                    </button>
                  ))}
                </div>
              ))}
              <div className="theme-dropdown-divider" />
              {isCustomThemeId(theme) && (
                <div className="theme-active-custom">
                  <span className="theme-opt-icon">🎨</span>
                  {findSavedTheme(theme)?.name ?? 'Custom'}
                  <span className="theme-active-badge">active</span>
                </div>
              )}
              <button className={`theme-customize-btn${isCustomThemeId(theme) ? ' active' : ''}`}
                onClick={() => { setThemePickerOpen(false); setShowCustomizer(true); }}>
                🎨 Customize…
              </button>
            </div>
          </div>
        </div>
      </header>
      {showCustomizer && (
        <ThemeCustomizer
          currentTheme={theme}
          onClose={() => {
            setShowCustomizer(false);
            reapplyTheme();
          }}
          onApply={(id) => setTheme(id)}
        />
      )}

      <div className="app-body">
      {/* ── Activity Bar ── */}
      <nav className="activity-bar">
        <button
          className={`ab-btn ${domainOf(activeTab) === 'api' ? 'active' : ''}`}
          onClick={() => { if (!isApiTab(activeTab)) setActiveTab('requests'); }}
          title="API"
        >
          <span className="ab-icon">🔌</span>
          <span className="ab-label">API</span>
        </button>
        <button
          className={`ab-btn ${domainOf(activeTab) === 'workflow' ? 'active' : ''}`}
          onClick={() => { if (!isWorkflowTab(activeTab)) setActiveTab('workflow'); }}
          title="Workflow"
        >
          <span className="ab-icon">🔧</span>
          <span className="ab-label">Workflow</span>
        </button>
        <button
          className={`ab-btn ${domainOf(activeTab) === 'testing' ? 'active' : ''}`}
          onClick={() => { if (!isHarnessTab(activeTab)) setActiveTab('scenarios'); }}
          title="Harness"
        >
          <span className="ab-icon">🏋</span>
          <span className="ab-label">Harness</span>
        </button>
        <button
          className={`ab-btn ${domainOf(activeTab) === 'gallery' ? 'active' : ''}`}
          onClick={() => { if (!isGalleryTab(activeTab)) setActiveTab('gallery'); }}
          title="Gallery"
        >
          <span className="ab-icon">🏪</span>
          <span className="ab-label">Gallery</span>
        </button>
        <div className="ab-spacer" />
        <button
          className={`ab-btn ${domainOf(activeTab) === 'settings' ? 'active' : ''}`}
          onClick={() => { if (!isSettingsTab(activeTab)) setActiveTab('environments'); }}
          title="Settings"
        >
          <span className="ab-icon">⚙️</span>
          <span className="ab-label">Settings</span>
        </button>
      </nav>

      {/* ── Sidebar (contextual per domain) ── */}
      {!sidebarCollapsed && domainOf(activeTab) !== 'settings' && domainOf(activeTab) !== 'gallery' && (
      <aside className="unified-sidebar" style={{ width: sidebarWidth }}>

        <div className="usb-content">
          {/* API domain: Requests + Catalog toggle */}
          {isApiTab(activeTab) && (
            <>
              <div className="usb-sidebar-toggle-row">
                <button className={`usb-sidebar-toggle ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
                <button className={`usb-sidebar-toggle ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Catalog</button>
              </div>
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
                onExportSpec={handleExportSpec}
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
            </>
          )}
          {isWorkflowTab(activeTab) && (
            <WorkflowSidebar
              workflows={wfHook.workflows}
              selectedId={wfHook.selectedId}
              onSelect={(id) => { wfHook.select(id); setActiveTab('workflow'); }}
              onNew={(name: string) => {
                wfHook.create(name); setActiveTab('workflow');
              }}
              onBrowseTemplates={() => setActiveTab('gallery')}
              onRename={(id, name) => {
                wfHook.update(id, { name });
              }}
              onDelete={(id) => { wfHook.remove(id); }}
              onDuplicate={(id) => { wfHook.duplicate(id); }}
              onExport={handleWorkflowExport}
              onImport={handleWorkflowImport}
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

        <button className="usb-settings-btn" onClick={() => setActiveTab('preferences')}>⚙ Settings</button>
      </aside>
      )}
      {!sidebarCollapsed && domainOf(activeTab) !== 'settings' && domainOf(activeTab) !== 'gallery' && (
        <div className="usb-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <button
        className={`usb-toggle-btn ${sidebarCollapsed || domainOf(activeTab) === 'settings' || domainOf(activeTab) === 'gallery' ? 'collapsed' : ''}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={domainOf(activeTab) === 'settings' || domainOf(activeTab) === 'gallery' ? { display: 'none' } : undefined}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

        <main className="app-main">
          {/* ── Contextual sub-nav ── */}
          {!showCatalogImport && (
          <div className="sub-nav">
            {domainOf(activeTab) === 'api' && (
              <div className="sub-nav-tabs">
                <button className={`sub-nav-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
                <button className={`sub-nav-tab ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Catalog</button>
              </div>
            )}
            {domainOf(activeTab) === 'workflow' && (
              <div className="sub-nav-tabs">
                <button className={`sub-nav-tab ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>Designer</button>
                <button className={`sub-nav-tab ${activeTab === 'workflow-executions' ? 'active' : ''}`} onClick={() => setActiveTab('workflow-executions')}>Executions</button>
                <button className={`sub-nav-tab ${activeTab === 'webhook-deliveries' ? 'active' : ''}`} onClick={() => setActiveTab('webhook-deliveries')}>Webhooks</button>
                <div className="sub-nav-spacer" />
                <ServerStatusIndicator />
              </div>
            )}
            {domainOf(activeTab) === 'testing' && (
              <div className="sub-nav-tabs">
                <button className={`sub-nav-tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>Scenarios</button>
                <button className={`sub-nav-tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>Runner</button>
                <button className={`sub-nav-tab ${activeTab === 'workflow-runner' ? 'active' : ''}`} onClick={() => setActiveTab('workflow-runner')}>Workflow Runner</button>
                <button className={`sub-nav-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button>
              </div>
            )}
            {domainOf(activeTab) === 'gallery' && (
              <div className="sub-nav-tabs">
                <button className={`sub-nav-tab ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}>Samples</button>
                <button className={`sub-nav-tab ${activeTab === 'training' ? 'active' : ''}`} onClick={() => setActiveTab('training')}>Training Tracks</button>
              </div>
            )}
            {domainOf(activeTab) === 'settings' && (
              <div className="sub-nav-tabs">
                <button className={`sub-nav-tab ${activeTab === 'environments' ? 'active' : ''}`} onClick={() => setActiveTab('environments')}>Environments</button>
                <button className={`sub-nav-tab ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>Preferences</button>
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
              onClearPreview={() => { setPreviewWorkflow(null); savePreviewSampleId(null); }}
              onUseAsTemplate={(wf) => {
                const gallerySampleId = sampleWorkflowCatalog.find(e => e.id === wf.id)?.id;
                const copy = { ...structuredClone(wf), id: crypto.randomUUID(), name: wf.name.replace(/^Sample: /, ''), gallerySampleId, createdAt: Date.now(), updatedAt: Date.now() };
                // If this sample has companion workflows (e.g. child sub-workflows), insert them too
                const catalogEntry = sampleWorkflowCatalog.find(e => e.id === wf.id);
                if (catalogEntry?.companionFactories) {
                  for (const cf of catalogEntry.companionFactories) {
                    const companion = cf();
                    // Update sub-workflow references in the copy to point to the companion
                    const companionCopy = { ...structuredClone(companion), id: companion.id, name: companion.name.replace(/^Sample: /, ''), createdAt: Date.now(), updatedAt: Date.now() };
                    wfHook.insert(companionCopy);
                  }
                }
                wfHook.insert(copy);
                setPreviewWorkflow(null);
                savePreviewSampleId(null);
              }}
              onRunInHarness={handleRunInHarness}
            />
          </div>
          {activeTab === 'gallery' && (
            <div className="app-tab-pane gallery-pane">
              <GalleryPage
                importedSamples={gallery.importedSamples}
                onImportRequest={gallery.onImportRequest}
                onTryItRequest={gallery.onTryItRequest}
                onImportCatalog={gallery.onImportCatalog}
                onImportTest={gallery.onImportTest}
                onImportWorkflow={gallery.onImportWorkflow}
                onNavigateTo={gallery.onNavigateTo}
              />
            </div>
          )}
          {activeTab === 'training' && (
            <div className="app-tab-pane training-pane">
              <TrainingTracksView onNavigateToSample={(_sampleId) => setActiveTab('gallery')} />
            </div>
          )}
          {activeTab === 'workflow-runner' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <WorkflowRunner
                workflows={wfHook.workflows}
                onComplete={handleCompleteToResults}
                initialWorkflowId={workflowRunnerInitialId}
                onClearInitialWorkflowId={() => setWorkflowRunnerInitialId(null)}
                resolvedBaseUrl={resolvedBaseUrl}
                onImportSample={(wf) => {
                  const existing = wfHook.workflows.find(w => w.id === wf.id);
                  if (existing) {
                    wfHook.update(wf.id, { nodes: wf.nodes, edges: wf.edges, variables: wf.variables, name: wf.name, description: wf.description });
                  } else {
                    wfHook.insert(wf);
                  }
                  return wf.id;
                }}
              />
            </div>
          )}
          {activeTab === 'workflow-executions' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <WorkflowExecutionHistory />
            </div>
          )}
          {activeTab === 'webhook-deliveries' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <WebhookDeliveryLogs />
            </div>
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

          {activeTab === 'preferences' && (
            <SettingsPage
              appGlobalAuthProfiles={appGlobalAuthProfiles}
              setAppGlobalAuthProfiles={setAppGlobalAuthProfiles}
              environments={environments}
              microservices={microservices}
              featureGroups={featureGroups}
              onImport={handleImportData}
              confirm={confirm}
            />
          )}

          {activeTab === 'scenarios' && (
            <ScenarioBuilder
              featureGroups={filteredFeatureGroups}
              setFeatureGroups={setFeatureGroups}
              sharedDataSources={sharedDataSources}
              setSharedDataSources={setSharedDataSources}
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
              onComplete={handleCompleteToResults}
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              envId={selectedEnvId}
              svcId={selectedSvcId}
              resolvedBaseUrl={resolvedBaseUrl}
              globalAuthProfiles={appGlobalAuthProfiles}
              envFallbackAuth={envFallbackAuth}
              sharedDataSources={sharedDataSources}
            />
          </div>
          {activeTab === 'results' && (
            <ResultsDashboard
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              onRerunFailed={handleRerunFailed}
              isRerunning={isRerunning}
              initialRunTypeFilter={resultsRunTypeFilter}
            />
          )}
          <div className="app-tab-pane" style={{ display: activeTab === 'catalog' ? 'flex' : 'none' }}>
            <ApiCatalog
              catalog={catalog}
              onImport={() => { setCatalogReimportId(undefined); setShowCatalogImport(true); }}
              onReimport={(entryId) => { setCatalogReimportId(entryId); setShowCatalogImport(true); }}
              onVersionHistory={(entryId) => setCatalogVersionHistoryId(entryId)}
              onExportSpec={handleExportSpec}
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
              previewRequest={previewRequest}
              onClearPreview={() => { setPreviewRequest(null); setActiveTab('gallery'); }}
              onImportPreview={() => {
                if (!previewRequest) return;
                const req = previewRequest.request;
                const GALLERY_COL_NAME = 'Gallery Samples';
                const col = wb.collections.find(c => c.name === GALLERY_COL_NAME);
                let colId: string;
                if (col) {
                  colId = col.id;
                } else {
                  colId = wb.addCollection({ name: GALLERY_COL_NAME, mode: 'direct' });
                }
                const reqId = wb.addRequest(colId);
                wb.updateRequest(colId, reqId, {
                  name: req.name,
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  body: req.body,
                  bodyType: req.bodyType,
                  auth: req.auth,
                });
                setPreviewRequest(null);
              }}
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

          {showCatalogImport && (
            <CatalogImportModal
              existingEntries={catalog.entries}
              reimportEntryId={catalogReimportId}
              initialSpec={catalogInitialSpec}
              onImport={(entry, rawSpec) => { catalog.addEntry(entry, rawSpec); setActiveTab('catalog'); }}
              onReimport={(entryId, parsed) => { catalog.addVersionToEntry(entryId, parsed); setActiveTab('catalog'); }}
              onClose={() => { setShowCatalogImport(false); setCatalogReimportId(undefined); setCatalogInitialSpec(undefined); }}
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

        </main>
      </div>

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
