import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import AppWorkbenchModals from './components/AppWorkbenchModals';
import AppHeader from './components/AppHeader';
import AppActivityBar from './components/AppActivityBar';
import AppSubNav from './components/AppSubNav';
import AppSidebarRegion from './components/AppSidebarRegion';
import AppShellOverlays from './components/AppShellOverlays';
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
import { GalleryPage } from '../features/gallery/GalleryPage';
import { sampleWorkflowCatalog } from '../data/galleries/workflows';
import TrainingTracksView from '../features/training/TrainingTracksView';
import { useWorkflows } from '../features/workflow/hooks/useWorkflows';
import { useWorkflowFolders } from '../features/workflow/hooks/useWorkflowFolders';
import { useToast } from '../shared/hooks/useToast';
import {
  type Tab,
  isProtocolsTab,
  readTabFromUrl,
  writeTabToUrl,
  setLastProtocolsTab,
  LAST_PROTOCOLS_TAB_STORAGE_KEY,
} from './utils/appTabUtils';
import { onStorageFull, cleanupStaleStorageKeys, readKey, writeKey } from '../shared/utils/storage';
import { useKafkaState } from './hooks/useKafkaState';
import '../styles/index.css';
import { DEMO_HUB_ENABLED } from '../config/features';
import { demoHubRuntimeRef, DEMO_HUB_MOUNT_ID } from './demo/demoHubRuntimeRef';
import { shouldExitLiveDemoForTabChange } from './demo/liveDemoTabGuard';
import { DemoShellHost } from './demo/DemoShellHost';
import { useDemoWorkflowBridge } from './hooks/useDemoWorkflowBridge';
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
  useDemoWorkflowBridge(
    wfHook.workflows,
    wfHook.remove,
    DEMO_HUB_ENABLED ? wfHook.insert : undefined,
    DEMO_HUB_ENABLED ? wfHook.select : undefined,
    DEMO_HUB_ENABLED ? wfHook.loaded : false,
  );
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

  // When sidebar / sub-nav navigates during live mode, exit only if leaving the
  // lesson's tab scope. Same-tab clicks (e.g. workflow sidebar re-select) must
  // not tear down the overlay — that was killing GQL-18 setup.
  const handleSetActiveTab = useCallback((tab: Tab) => {
    const hub = demoHubRuntimeRef.current;
    const inLive = DEMO_HUB_ENABLED && hub.state.view === 'live';
    const suppressed = hub.suppressLiveTabExitRef?.current === true;
    const shouldExit = inLive
      && !suppressed
      && shouldExitLiveDemoForTabChange(tab, activeTab, hub.state.selectedLesson);

    if (shouldExit) {
      const leave = window.confirm(
        'Leave the live demo? Navigating away will end the current demo session.',
      );
      if (!leave) return;
      void hub.exitLiveDemo().then(() => setActiveTab(tab));
    } else {
      setActiveTab(tab);
    }
  }, [setActiveTab, activeTab]);

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

  // ---- Warn when localStorage is full (debounced — parallel saves fire once) ----
  const lastStorageFullToastRef = useRef(0);
  useEffect(() => {
    return onStorageFull((key) => {
      const now = Date.now();
      if (now - lastStorageFullToastRef.current < 8_000) return;
      lastStorageFullToastRef.current = now;
      toast.show('error', 'Storage Full',
        `Cannot save ${key}. Browser storage is full. Go to Settings → Storage to free up space.`);
    });
  }, [toast]);

  // ---- Auto-cleanup stale keys on first load ----
  useEffect(() => {
    cleanupStaleStorageKeys();
    if (DEMO_HUB_ENABLED) {
      void import('@redfireforge/demo-hub/demoLiveSession').then(({ hasRestorableDemoLiveSession }) => {
        if (hasRestorableDemoLiveSession()) return;
        return import('@redfireforge/demo-hub/lessons/gql-demo-storage-cleanup')
          .then((m) => m.purgeGqlDemoEphemeralStorage())
          .catch(() => { /* best effort */ });
      }).catch(() => { /* best effort */ });
    }
  }, []);

  useEffect(() => {
    if (!DEMO_HUB_ENABLED && activeTab === 'demo-hub') {
      setActiveTab('requests');
    }
  }, [activeTab, setActiveTab]);

  // Restore last Protocols sub-tab (GraphQL, Kafka, etc.) from storage.
  useEffect(() => {
    void readKey(LAST_PROTOCOLS_TAB_STORAGE_KEY).then((saved) => {
      if (saved && isProtocolsTab(saved as Tab)) {
        setLastProtocolsTab(saved as Tab);
      }
    });
  }, []);

  const [galleryInitialDomain, setGalleryInitialDomain] = useState<import('../data/galleries/types').GalleryDomain | undefined>(undefined);

  // Keep ?tab= in sync so refresh restores Workflow / Catalog / Harness / etc.
  useEffect(() => {
    writeTabToUrl(activeTab);
    if (activeTab !== 'gallery') setGalleryInitialDomain(undefined);
    if (isProtocolsTab(activeTab)) {
      setLastProtocolsTab(activeTab);
      void writeKey(LAST_PROTOCOLS_TAB_STORAGE_KEY, activeTab).catch(() => { /* silent */ });
    }
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
    <>
      {DEMO_HUB_ENABLED && (
        <DemoShellHost
          navigateToTab={navigateToTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setSidebarCollapsed={setSidebarCollapsed}
          setAppGlobalAuthProfiles={setAppGlobalAuthProfiles}
          selectedEnvId={selectedEnvId}
          selectedSvcId={selectedSvcId}
          setEnvironments={setEnvironments}
          setMicroservices={setMicroservices}
          setSelectedEnvId={setSelectedEnvId}
          setSelectedSvcId={setSelectedSvcId}
        />
      )}
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

      <AppSidebarRegion
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        handleResizeStart={handleResizeStart}
        catalog={catalog}
        wb={wb}
        wfHook={wfHook}
        wfFolders={wfFolders}
        environments={environments}
        microservices={microservices}
        featureGroups={featureGroups}
        selectedEnvId={selectedEnvId}
        selectedSvcId={selectedSvcId}
        setSelectedEnvId={setSelectedEnvId}
        setSelectedSvcId={setSelectedSvcId}
        sidebarView={sidebarView}
        setSidebarView={setSidebarView}
        harnessRequestIds={harnessRequestIds}
        setGalleryInitialDomain={setGalleryInitialDomain}
        setCatalogReimportId={setCatalogReimportId}
        setShowCatalogImport={setShowCatalogImport}
        setCatalogVersionHistoryId={setCatalogVersionHistoryId}
        setCatalogEditId={setCatalogEditId}
        setBatchHarnessTarget={setBatchHarnessTarget}
        handleExportSpec={handleExportSpec}
        handleWorkflowExport={handleWorkflowExport}
        handleExportFolder={handleExportFolder}
        handleWorkflowImport={handleWorkflowImport}
        handleWbNewCollection={handleWbNewCollection}
        handleWbEditCollection={handleWbEditCollection}
        handleWbNewRequest={handleWbNewRequest}
        handleEditSubCollection={handleEditSubCollection}
      />

        <main className="app-main">
          {/* ── Contextual sub-nav ── */}
          {!showCatalogImport && <AppSubNav activeTab={activeTab} setActiveTab={handleSetActiveTab} />}
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
          {DEMO_HUB_ENABLED && activeTab === 'demo-hub' && (
            <div id={DEMO_HUB_MOUNT_ID} className="app-tab-pane demo-hub-pane" />
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

      <AppShellOverlays
        showWbCollectionModal={showWbCollectionModal}
        setShowWbCollectionModal={setShowWbCollectionModal}
        editingWbCollection={editingWbCollection}
        setEditingWbCollection={setEditingWbCollection}
        newColMode={newColMode}
        setNewColGroupId={setNewColGroupId}
        setNewColMode={setNewColMode}
        wb={wb}
        environments={environments}
        microservices={microservices}
        appGlobalAuthProfiles={appGlobalAuthProfiles}
        handleWbSaveCollection={handleWbSaveCollection}
        editingSubCol={editingSubCol}
        setEditingSubCol={setEditingSubCol}
        subColForEdit={subColForEdit}
        confirmDialogElement={confirmDialogElement}
        pendingTemplateImport={pendingTemplateImport}
        setPendingTemplateImport={setPendingTemplateImport}
        wfFolders={wfFolders}
        handleTemplatePickFolder={handleTemplatePickFolder}
        RustExecutorTestPanel={RustExecutorTestPanel}
      />

    </div>
    </>
  );
}
