import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppLayoutSync } from './hooks/useAppLayoutSync';
import { useGalleryMigration } from './hooks/useGalleryMigration';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useGalleryImport } from './hooks/useGalleryImport';
import { useWorkbenchActions } from './hooks/useWorkbenchActions';
import ThemeCustomizer from './ThemeCustomizer';
import { useWorkflowImportExport } from './hooks/useWorkflowImportExport';
import { useDerivedViewState } from './hooks/useDerivedViewState';
import { useHarnessPromotion } from './hooks/useHarnessPromotion';
import { useCatalogExport } from './hooks/useCatalogExport';
import { useCatalogState } from './hooks/useCatalogState';
import { usePreferencesImport } from './hooks/usePreferencesImport';
import { useGalleryWorkflowPreviewState } from './hooks/useGalleryWorkflowPreviewState';
import { useDemoShortcuts } from './hooks/useDemoShortcuts';
import { useDemoWorkflowBridge } from './hooks/useDemoWorkflowBridge';
import AppWorkbenchModals from './components/AppWorkbenchModals';
import AppHeader from './components/AppHeader';
import AppActivityBar from './components/AppActivityBar';
import AppSubNav from './components/AppSubNav';
import RustTestPanelOverlay from './components/RustTestPanelOverlay';
import { useRerunFailed } from './hooks/useRerunFailed';
import { useTheme } from './hooks/useTheme';
import { useProjects } from '../features/scenarios/hooks/useProjects';
import { useRequests } from '../features/requests/hooks/useRequests';
import { useCatalog } from '../features/catalog/hooks/useCatalog';
import { useSidebarResize } from './hooks/useSidebarResize';
import ScenarioBuilder from '../features/scenarios/ScenarioBuilder';
import TestRunner from '../features/test-runner/TestRunner';
import ParameterizedRunner from '../features/test-runner/ParameterizedRunner';
import WorkflowRunner from '../features/test-runner/WorkflowRunner';
import ResultsDashboard from '../features/results/ResultsDashboard';
import Requests from '../features/requests/Requests';
import type { PreviewRequest } from '../features/requests/Requests';
import ApiCatalog from '../features/catalog/ApiCatalog';
import CatalogSidebar from '../features/catalog/components/CatalogSidebar';
import Sidebar from './Sidebar';
import RequestsSidebar from '../features/requests/components/RequestsSidebar';
import SettingsPage from '../features/settings/SettingsModal';
import KafkaSettingsPage from '../features/kafka/KafkaSettingsPage';
import { KafkaMessageStudioPage } from '../features/kafka/KafkaMessageStudioPage';
import { WebSocketStudioPage } from '../features/websocket/WebSocketStudioPage';
import { SseStudioPage } from '../features/sse/SseStudioPage';
import { GraphqlStudioPage } from '../features/graphql/GraphqlStudioPage';
import EnvironmentManager from '../features/environments/EnvironmentManager';
import WorkflowDesigner from '../features/workflow/WorkflowDesigner';
import WorkflowExecutionHistory from '../features/workflow/WorkflowExecutionHistory';
import WebhookDeliveryLogs from '../features/webhooks/WebhookDeliveryLogs';
import WorkflowSidebar from '../features/workflow/components/panels/WorkflowSidebar';
import FolderPickerModal from '../features/workflow/components/modals/FolderPickerModal';
import { GalleryPage } from '../features/gallery/GalleryPage';
import { sampleWorkflowCatalog } from '../data/galleries/workflows';
import TrainingTracksView from '../features/training/TrainingTracksView';
import { useWorkflows } from '../features/workflow/hooks/useWorkflows';
import { useWorkflowFolders } from '../features/workflow/hooks/useWorkflowFolders';
import RequestCollectionModal from '../features/requests/components/RequestCollectionModal';
import SubCollectionModal from '../features/requests/components/SubCollectionModal';
import { useToast } from '../shared/hooks/useToast';
import {
  type Tab,
  domainOf,
  isApiTab,
  isWorkflowTab,
  isHarnessTab,
  readTabFromUrl,
  writeTabToUrl,
} from './utils/appTabUtils';
import { onStorageFull, cleanupStaleStorageKeys } from '../shared/utils/storage';
import { useKafkaState } from './hooks/useKafkaState';
import '../styles/index.css';
import '../styles/demo-player.css';
import '../styles/demo-hub.css';
import DemoHub from '../features/demo-player/DemoHub';
import { useDemoHub } from '../features/demo-player/useDemoHub';
import LiveDemo from '../features/demo-player/LiveDemo';
import { RustExecutorTestPanel } from './rustExecutorDevPanel';

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

  const [sidebarView, setSidebarView] = useState<'env' | 'svc'>('env');

  const wb = useRequests();
  const catalog = useCatalog();
  const wfHook = useWorkflows();
  const {
    previewWorkflow,
    setPreviewWorkflow,
    pendingTemplateImport,
    setPendingTemplateImport,
    handleTemplatePickFolder,
    handleUseWorkflowAsTemplate,
    clearPreviewWorkflow,
  } = useGalleryWorkflowPreviewState(wfHook);
  const wfFolders = useWorkflowFolders();
  const { theme, setTheme, showCustomizer, setShowCustomizer, themePickerOpen, setThemePickerOpen, themePickerRef, reapplyTheme, THEMES, THEME_ICONS } = useTheme();
  const toast = useToast();
  const kafkaState = useKafkaState();
  const { handleWorkflowExport, handleWorkflowImport, handleExportFolder } = useWorkflowImportExport({
    wfHook, folders: wfFolders.folders, setActiveTab: (t) => setActiveTab(t as Tab), showToast: toast.show,
  });
  // ---- App shell state ----
  const [activeTab, setActiveTab] = useState<Tab>(() => readTabFromUrl());
  const { handleImportData } = usePreferencesImport({
    setEnvironments,
    setMicroservices,
    setFeatureGroups,
    setAppGlobalAuthProfiles,
    setActiveTab,
  });
  const [resultsRunTypeFilter, setResultsRunTypeFilter] = useState<'all' | 'test' | 'workflow' | undefined>();
  const [workflowRunnerInitialId, setWorkflowRunnerInitialId] = useState<string | null>(null);
  const [workflowRunnerInitialVariables, setWorkflowRunnerInitialVariables] = useState<Record<string, string> | null>(null);
  const [lastWorkflowOutput, setLastWorkflowOutput] = useState<Record<string, string> | null>(null);

  const { sidebarWidth, sidebarCollapsed, setSidebarCollapsed, handleResizeStart } = useSidebarResize();
  const navigateToTab = useCallback((t: string) => setActiveTab(t as Tab), [setActiveTab]);
  const demoHub = useDemoHub({ navigateToTab });

  // When any sidebar nav item is clicked while a live demo is active, exit the
  // demo overlay first so it doesn't linger on top of the newly selected tab.
  const handleSetActiveTab = useCallback((tab: Tab) => {
    if (demoHub.state.view === 'live') {
      void demoHub.exitLiveDemo().then(() => setActiveTab(tab));
    } else {
      setActiveTab(tab);
    }
  }, [demoHub, setActiveTab]);

  useDemoShortcuts(demoHub, activeTab, setActiveTab);
  useDemoWorkflowBridge(wfHook.workflows, wfHook.remove, wfHook.insert);

  const handleCompleteToResults = (runType?: 'test' | 'workflow') => {
    setResultsRunTypeFilter(runType);
    setActiveTab('results');
  };

  const handleNavigateToKafkaSettings = useCallback(() => {
    setActiveTab('kafka-settings');
  }, []);

  const handleUseAsWorkflowInput = useCallback((
    payload: string,
    meta: { topic: string; partition: number; offset: string },
  ) => {
    setWorkflowRunnerInitialVariables({
      kafka_message: payload,
      kafka_topic: meta.topic,
      kafka_partition: String(meta.partition),
      kafka_offset: meta.offset,
    });
    setActiveTab('workflow-runner');
  }, []);

  const handleRunInHarness = (workflowId: string) => {
    setWorkflowRunnerInitialId(workflowId);
    setActiveTab('workflow-runner');
  };

  const { confirm, confirmDialogElement } = useConfirmDialog();
  const wbActions = useWorkbenchActions({ wb, activeTab, setActiveTab: (t) => setActiveTab(t as Tab) });
  const {
    showWbCollectionModal, setShowWbCollectionModal,
    editingWbCollection, setEditingWbCollection,
    editingSubCol, setEditingSubCol,
    newColMode, setNewColMode, setNewColGroupId, subColForEdit,
    handleWbNewCollection, handleWbEditCollection, handleWbSaveCollection,
    handleWbNewRequest, handleEditSubCollection,
  } = wbActions;
  const {
    showSendToHarness,
    setShowSendToHarness,
    batchHarnessTarget,
    setBatchHarnessTarget,
    catalogHarnessEndpoint,
    setCatalogHarnessEndpoint,
    pendingEditTest,
    setPendingEditTest,
    handleSendToHarnessConfirm,
    handleBatchSendToHarnessConfirm,
    harnessPromotionContext,
    catalogHarnessPromotionCtx,
  } = useHarnessPromotion({
    wb,
    featureGroups,
    setFeatureGroups,
    selectedEnvId,
    selectedSvcId,
    setSelectedEnvId,
    setSelectedSvcId,
    appGlobalAuthProfiles,
    microservices,
    environments,
    toast,
    setActiveTab,
  });
  const {
    sendToReqEntry,
    setSendToReqEntry,
    sendToReqEpValues,
    sendToReqSingleEndpoint,
    setSendToReqSingleEndpoint,
    inlineExportEpValues,
    handleSendToRequests,
    handleExportSingleEndpoint,
    handleSendToReqConfirm,
    handleInlineExportConfirm,
  } = useCatalogExport({ wb, catalog, setActiveTab });
  const {
    showCatalogImport,
    setShowCatalogImport,
    catalogReimportId,
    setCatalogReimportId,
    catalogInitialSpec,
    setCatalogInitialSpec,
    catalogVersionHistoryId,
    setCatalogVersionHistoryId,
    catalogEditId,
    setCatalogEditId,
    handleExportSpec,
  } = useCatalogState(catalog);
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest | null>(null);
  // ---- Sync theme from loaded data ----
  useEffect(() => {
    if (!loading) {
      setTheme(initialTheme);
    }
  }, [loading, initialTheme, initialTestRuns, setTheme]);

  // ---- Warn when localStorage is full ----
  useEffect(() => {
    return onStorageFull((key) => {
      toast.show('error', 'Storage Full',
        `Cannot save ${key}. Browser storage is full. Go to Settings → Storage to free up space.`);
    });
  }, [toast]);

  // ---- Auto-cleanup stale keys on first load ----
  useEffect(() => {
    cleanupStaleStorageKeys();
  }, []);

  const [galleryInitialDomain, setGalleryInitialDomain] = useState<import('../data/galleries/types').GalleryDomain | undefined>(undefined);

  // Keep ?tab= in sync so refresh restores Workflow / Catalog / Harness / etc.
  useEffect(() => {
    writeTabToUrl(activeTab);
    if (activeTab !== 'gallery') setGalleryInitialDomain(undefined);
  }, [activeTab, setGalleryInitialDomain]);

  // ---- Layout CSS var sync (--header-h and --sidebar-w) ----
  const headerRef = useAppLayoutSync({ sidebarWidth, sidebarCollapsed });

  // ---- Fix Gallery Samples microservice baseUrls (migration for pre-0.9.1 data) ----
  useGalleryMigration({ loading, environments, microservices, setMicroservices });

  // ---- Derived view state ----

  const {
    selectedEnv, selectedSvc, resolvedBaseUrl, isAdditionalEnv,
    envFallbackAuth, filteredFeatureGroups, unassociatedFeatureGroups,
  } = useDerivedViewState({
    environments, microservices, featureGroups,
    globalAuthProfiles: appGlobalAuthProfiles, selectedEnvId, selectedSvcId,
  });

  const harnessRequestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        for (const t of sc.tests) {
          if (t.sourceRequestId) ids.add(t.sourceRequestId);
        }
      }
    }
    return ids;
  }, [featureGroups]);

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

  const handleLoadWorkflowTemplate = useCallback((gallerySampleId: string) => {
    const entry = sampleWorkflowCatalog.find(e => e.id === gallerySampleId);
    if (entry) {
      gallery.onImportWorkflow(entry);
    }
  }, [gallery]);

  const handleBrowseGallery = useCallback(() => {
    setGalleryInitialDomain('workflows');
    setActiveTab('gallery');
  }, [setActiveTab]);

  const handleImportPreview = useCallback(() => {
    if (!previewRequest) return;
    const req = previewRequest.request;
    const GALLERY_COL_NAME = 'Gallery Samples';
    const col = wb.collections.find(c => c.name === GALLERY_COL_NAME);
    const colId = col ? col.id : wb.addCollection({ name: GALLERY_COL_NAME, mode: 'direct' });
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
  }, [previewRequest, wb]);

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
      <AppHeader
        headerRef={headerRef}
        activeTab={activeTab}
        environments={environments}
        microservices={microservices}
        selectedEnvId={selectedEnvId}
        setSelectedEnvId={setSelectedEnvId}
        selectedSvcId={selectedSvcId}
        setSelectedSvcId={setSelectedSvcId}
        theme={theme}
        setTheme={setTheme}
        themePickerOpen={themePickerOpen}
        setThemePickerOpen={setThemePickerOpen}
        themePickerRef={themePickerRef}
        THEMES={THEMES}
        THEME_ICONS={THEME_ICONS}
        setShowCustomizer={setShowCustomizer}
        kafkaConnection={kafkaState.connection}
        kafkaClusterName={kafkaState.selectedCluster?.name ?? null}
        kafkaHasClusters={kafkaState.clusters.length > 0}
        onNavigateToKafkaSettings={handleNavigateToKafkaSettings}
      />
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
      <AppActivityBar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      {/* ── Sidebar (contextual per domain) ── */}
      {!sidebarCollapsed && domainOf(activeTab) !== 'settings' && domainOf(activeTab) !== 'gallery' && domainOf(activeTab) !== 'protocols' && domainOf(activeTab) !== 'demo' && (
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
                onSendCollectionToHarness={(colId) => setBatchHarnessTarget({ colId })}
                onSendFolderToHarness={(colId, folderId) => setBatchHarnessTarget({ colId, folderId })}
                harnessRequestIds={harnessRequestIds}
              />
            )}
          </div>
            </>
          )}
          {isWorkflowTab(activeTab) && (
            <WorkflowSidebar
              workflows={wfHook.workflows}
              selectedId={wfHook.selectedId}
              folders={wfFolders.folders}
              foldersLoaded={wfFolders.loaded}
              onSelect={(id) => { wfHook.select(id); setActiveTab('workflow'); }}
              onNew={(name: string) => {
                wfHook.create(name); setActiveTab('workflow');
              }}
              onBrowseTemplates={() => { setGalleryInitialDomain('workflows'); setActiveTab('gallery'); }}
              onRename={(id, name) => {
                wfHook.update(id, { name });
              }}
              onDelete={(id) => { wfHook.remove(id); }}
              onDuplicate={(id) => { wfHook.duplicate(id); }}
              onExport={handleWorkflowExport}
              onExportFolder={handleExportFolder}
              onImport={handleWorkflowImport}
              onToggleFolderCollapse={wfFolders.toggleCollapse}
              onSetFolderCollapsed={wfFolders.setCollapsed}
              onCreateFolder={wfFolders.create}
              onRenameFolder={wfFolders.rename}
              onDeleteFolder={(id) => wfFolders.remove(id, wfFolders.folders)}
              onMoveWorkflowToFolder={(wfId, folderId, order) => {
                wfHook.reorder(wfId, folderId, order);
              }}
              onMoveWorkflowsToFolder={(wfIds, folderId, startOrder) => {
                wfIds.forEach((id, i) => {
                  wfHook.reorder(id, folderId, startOrder + i);
                });
              }}
              onMoveFolder={wfFolders.move}
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
              sidebarView={sidebarView}
              onSidebarViewChange={setSidebarView}
            />
          )}
        </div>

        <button className="usb-settings-btn" onClick={() => setActiveTab('preferences')}>⚙ Settings</button>
      </aside>
      )}
      {!sidebarCollapsed && domainOf(activeTab) !== 'settings' && domainOf(activeTab) !== 'gallery' && domainOf(activeTab) !== 'protocols' && domainOf(activeTab) !== 'demo' && (
        <div className="usb-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <button
        className={`usb-toggle-btn ${sidebarCollapsed || domainOf(activeTab) === 'settings' || domainOf(activeTab) === 'gallery' || domainOf(activeTab) === 'protocols' || domainOf(activeTab) === 'demo' ? 'collapsed' : ''}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={domainOf(activeTab) === 'settings' || domainOf(activeTab) === 'gallery' || domainOf(activeTab) === 'protocols' || domainOf(activeTab) === 'demo' ? { display: 'none' } : undefined}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

        <main className="app-main">
          {/* ── Contextual sub-nav ── */}
          {!showCatalogImport && <AppSubNav activeTab={activeTab} setActiveTab={setActiveTab} />}
          {/* Keep mounted when hidden so canvas state (per-step initial variables, etc.) survives tab switches; still persisted via Save + storage on refresh. */}
          <div hidden={activeTab !== 'workflow'} className="workflow-designer-mount">
            <WorkflowDesigner
              collections={wb.collections}
              catalogEntries={catalog.entries}
              wfHook={wfHook}
              folders={wfFolders.folders}
              environments={environments}
              microservices={microservices}
              globalAuthProfiles={appGlobalAuthProfiles}
              selectedEnvId={selectedEnvId}
              selectedSvcId={selectedSvcId}
              onEnvSelect={setSelectedEnvId}
              onSvcSelect={setSelectedSvcId}
              resolvedBaseUrl={resolvedBaseUrl}
              previewWorkflow={previewWorkflow}
              onClearPreview={clearPreviewWorkflow}
              onUseAsTemplate={handleUseWorkflowAsTemplate}
              onRunInHarness={handleRunInHarness}
              onLoadTemplate={handleLoadWorkflowTemplate}
              onBrowseGallery={handleBrowseGallery}
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
                initialDomain={galleryInitialDomain}
              />
            </div>
          )}
          {activeTab === 'demo-hub' && (
            <div className="app-tab-pane demo-hub-pane">
              <DemoHub hub={demoHub} />
            </div>
          )}
          {activeTab === 'training' && (
            <div className="app-tab-pane training-pane">
              <TrainingTracksView onNavigateToSample={(_sampleId) => { setGalleryInitialDomain(undefined); setActiveTab('gallery'); }} />
            </div>
          )}
          {activeTab === 'workflow-runner' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <WorkflowRunner
                workflows={wfHook.workflows}
                folders={wfFolders.folders}
                onComplete={handleCompleteToResults}
                initialWorkflowId={workflowRunnerInitialId}
                onClearInitialWorkflowId={() => setWorkflowRunnerInitialId(null)}
                initialWorkflowVariables={workflowRunnerInitialVariables}
                onClearInitialWorkflowVariables={() => setWorkflowRunnerInitialVariables(null)}
                onWorkflowOutputAvailable={setLastWorkflowOutput}
                resolvedBaseUrl={resolvedBaseUrl}
                microservices={microservices}
                globalAuthProfiles={appGlobalAuthProfiles}
                selectedEnvId={selectedEnvId}
                onImportSample={(wf) => {
                  const existing = wfHook.workflows.find(w => w.id === wf.id);
                  if (existing) {
                    wfHook.update(wf.id, { nodes: wf.nodes, edges: wf.edges, variables: wf.variables, name: wf.name, description: wf.description });
                  } else {
                    wfHook.insert(wf);
                  }
                  return wf.id;
                }}
                onUpdateWorkflow={(id, patch) => wfHook.update(id, patch)}
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
              featureGroups={featureGroups}
              selectedEnvId={selectedEnvId}
              selectedSvcId={selectedSvcId}
              setSelectedEnvId={setSelectedEnvId}
              setSelectedSvcId={setSelectedSvcId}
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

          {activeTab === 'kafka-settings' && (
            <KafkaSettingsPage kafkaState={kafkaState} />
          )}

          {activeTab === 'kafka-message-studio' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <KafkaMessageStudioPage
                kafkaState={kafkaState}
                onNavigateToKafkaSettings={handleNavigateToKafkaSettings}
                onUseAsWorkflowInput={handleUseAsWorkflowInput}
                lastWorkflowOutput={lastWorkflowOutput}
              />
            </div>
          )}

          {activeTab === 'websocket-studio' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <WebSocketStudioPage
                resolvedBaseUrl={resolvedBaseUrl}
                envName={selectedEnv?.name}
                svcName={selectedSvc?.name}
                selectedSvc={selectedSvc}
                selectedEnvId={selectedEnvId}
                globalAuthProfiles={appGlobalAuthProfiles}
              />
            </div>
          )}

          {activeTab === 'sse-studio' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <SseStudioPage
                resolvedBaseUrl={resolvedBaseUrl}
                envName={selectedEnv?.name}
                svcName={selectedSvc?.name}
                selectedSvc={selectedSvc}
                selectedEnvId={selectedEnvId}
                globalAuthProfiles={appGlobalAuthProfiles}
              />
            </div>
          )}

          {activeTab === 'graphql-studio' && (
            <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
              <GraphqlStudioPage
                resolvedBaseUrl={resolvedBaseUrl}
                envName={selectedEnv?.name}
                svcName={selectedSvc?.name}
                selectedSvc={selectedSvc}
                selectedEnvId={selectedEnvId}
                globalAuthProfiles={appGlobalAuthProfiles}
              />
            </div>
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
              isAdditionalEnv={isAdditionalEnv}
              unassociatedFeatureGroups={unassociatedFeatureGroups}
              microservices={microservices}
              environments={environments}
              globalAuthProfiles={appGlobalAuthProfiles}
              onMoveScenario={moveScenario}
              onMoveTest={moveTest}
              pendingEditTest={pendingEditTest}
              onPendingEditConsumed={() => setPendingEditTest(undefined)}
              onLocateRequest={(requestId) => {
                for (const col of wb.collections) {
                  const found = col.requests.find(r => r.id === requestId)
                    || col.folders?.flatMap(f => f.requests).find(r => r.id === requestId);
                  if (found) {
                    wb.selectRequest(col.id, found.id);
                    setActiveTab('requests');
                    return;
                  }
                }
                toast.show('warning', 'Source request not found', 'The originating request may have been deleted');
              }}
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
              isAdditionalEnv={isAdditionalEnv}
              resolvedBaseUrl={resolvedBaseUrl}
              globalAuthProfiles={appGlobalAuthProfiles}
              envFallbackAuth={envFallbackAuth}
              sharedDataSources={sharedDataSources}
            />
          </div>
          {/* Keep ParameterizedRunner mounted so in-flight tests survive tab switches */}
          <div hidden={activeTab !== 'param-runner'}>
            <ParameterizedRunner
              featureGroups={filteredFeatureGroups}
              onComplete={handleCompleteToResults}
              envName={selectedEnv?.name}
              svcName={selectedSvc?.name}
              envId={selectedEnvId}
              svcId={selectedSvcId}
              isAdditionalEnv={isAdditionalEnv}
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
              onExportSingleEndpoint={handleExportSingleEndpoint}
              onEditEntry={(entryId) => setCatalogEditId(entryId)}
              globalAuthProfiles={appGlobalAuthProfiles}
              appEnvironments={environments}
              appMicroservices={microservices}
              collections={wb.collections}
              onNavigateToRequest={(colId, reqId) => { wb.selectRequest(colId, reqId); setActiveTab('requests'); }}
              savedEpValues={inlineExportEpValues}
              onExportConfirm={handleInlineExportConfirm}
              onSendEndpointToHarness={(entry, endpoint, fromTryItOut) => {
                setCatalogHarnessEndpoint({ entry, endpoint, fromTryItOut });
                setShowSendToHarness(true);
              }}
            />
          </div>
          <div className="app-tab-pane" style={{ display: activeTab === 'requests' ? 'flex' : 'none' }}>
            <Requests
              wb={wb}
              appGlobalAuthProfiles={appGlobalAuthProfiles}
              appMicroservices={microservices}
              appEnvironments={environments}
              previewRequest={previewRequest}
              onClearPreview={() => { setPreviewRequest(null); setGalleryInitialDomain(undefined); setActiveTab('gallery'); }}
              onSendToHarness={() => setShowSendToHarness(true)}
              harnessRequestIds={harnessRequestIds}
              onImportPreview={handleImportPreview}
            />
          </div>
          <AppWorkbenchModals
            catalog={catalog}
            wb={wb}
            environments={environments}
            microservices={microservices}
            featureGroups={featureGroups}
            sendToReqEntry={sendToReqEntry}
            setSendToReqEntry={setSendToReqEntry}
            sendToReqEpValues={sendToReqEpValues}
            sendToReqSingleEndpoint={sendToReqSingleEndpoint}
            setSendToReqSingleEndpoint={setSendToReqSingleEndpoint}
            handleSendToReqConfirm={handleSendToReqConfirm}
            showSendToHarness={showSendToHarness}
            setShowSendToHarness={setShowSendToHarness}
            catalogHarnessEndpoint={catalogHarnessEndpoint}
            setCatalogHarnessEndpoint={setCatalogHarnessEndpoint}
            catalogHarnessPromotionCtx={catalogHarnessPromotionCtx}
            handleSendToHarnessConfirm={handleSendToHarnessConfirm}
            harnessPromotionContext={harnessPromotionContext}
            batchHarnessTarget={batchHarnessTarget}
            setBatchHarnessTarget={setBatchHarnessTarget}
            handleBatchSendToHarnessConfirm={handleBatchSendToHarnessConfirm}
            showCatalogImport={showCatalogImport}
            catalogReimportId={catalogReimportId}
            catalogInitialSpec={catalogInitialSpec}
            setShowCatalogImport={setShowCatalogImport}
            setCatalogReimportId={setCatalogReimportId}
            setCatalogInitialSpec={setCatalogInitialSpec}
            setActiveTab={setActiveTab}
            catalogVersionHistoryId={catalogVersionHistoryId}
            setCatalogVersionHistoryId={setCatalogVersionHistoryId}
            catalogEditId={catalogEditId}
            setCatalogEditId={setCatalogEditId}
          />
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

      {confirmDialogElement}

      <FolderPickerModal
        open={pendingTemplateImport !== null}
        folders={wfFolders.folders}
        title="Save Template To..."
        onCancel={() => setPendingTemplateImport(null)}
        onPick={handleTemplatePickFolder}
      />

      {RustExecutorTestPanel && <RustTestPanelOverlay Panel={RustExecutorTestPanel} />}

      {/* Live Demo overlay — renders on top of whatever tab the lesson navigated to */}
      {demoHub.state.view === 'live' && demoHub.state.selectedLesson && (
        <LiveDemo
          lesson={demoHub.state.selectedLesson}
          stepIndex={demoHub.state.stepIndex}
          isPlaying={demoHub.state.isPlaying}
          stepPhase={demoHub.stepPhase}
          onNext={demoHub.nextStep}
          onTogglePlay={demoHub.toggleAutoPlay}
          onSkipReading={demoHub.skipReading}
          onRestart={demoHub.restartDemo}
          onExit={() => { void demoHub.exitLiveDemo().then(() => setActiveTab('demo-hub')); }}
          onComplete={() => {
            demoHub.confirmLessonComplete();
            void demoHub.exitLiveDemo().then(() => setActiveTab('demo-hub'));
          }}
        />
      )}

    </div>
  );
}
