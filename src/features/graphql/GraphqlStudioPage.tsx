/**
 * GraphqlStudioPage — GraphQL Studio main page (tabs, execution, schema, collections).
 * Orchestration hooks live under hooks/; layout pieces under components/GraphqlStudioPage*.
 */
import { useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { GQL_STUDIO_PROXY_BASE } from './graphqlStudioPageConstants';
import type { GraphqlHistoryItem } from '../../shared/types/graphql';
import { GraphqlConnectionBar } from './components/GraphqlConnectionBar';
import { GqlTabBar } from './components/GqlTabBar';
import { GraphqlAdvancedSettings } from './components/GraphqlAdvancedSettings';
import { GraphqlStudioActivityBar } from './components/GraphqlStudioActivityBar';
import { GraphqlStudioPageDialogs } from './components/GraphqlStudioPageDialogs';
import { GraphqlStudioPageOverlays } from './components/GraphqlStudioPageOverlays';
import { GraphqlStudioLeftActivityPanel } from './components/GraphqlStudioLeftActivityPanel';
import { GraphqlStudioSplitWorkspace } from './components/GraphqlStudioSplitWorkspace';
import { loadPersistedActivityTab } from './utils/gqlActivityBarUtils';
import { useGraphqlStudioTabExecution } from './hooks/useGraphqlStudioTabExecution';
import { useQueryValidation } from './hooks/useQueryValidation';
import { useGraphqlStudioSchemaLayer } from './hooks/useGraphqlStudioSchemaLayer';
import { useGraphqlSubscription } from './hooks/useGraphqlSubscription';
import { useSubscriptionOrchestration } from './hooks/useSubscriptionOrchestration';
import { useGqlStudioTabs } from './hooks/useGqlStudioTabs';
import { useGqlStudioEditorActions } from './hooks/useGqlStudioEditorActions';
import { useGraphqlHistory } from './hooks/useGraphqlHistory';
import { useGraphqlCollections } from './hooks/useGraphqlCollections';
import { useGraphqlCollectionRunner } from './hooks/useGraphqlCollectionRunner';
import { useGraphqlConnectionSettings } from './hooks/useGraphqlConnectionSettings';
import { useGqlItemLoaders } from './hooks/useGqlItemLoaders';
import { DEMO_HUB_ENABLED } from '../../config/features';
import { useGraphqlStudioShortcutsBridge } from './hooks/useGraphqlStudioShortcutsBridge';
import { useGraphqlStudioSplitPanes } from './hooks/useGraphqlStudioSplitPanes';
import { useGraphqlCollectionRun } from './hooks/useGraphqlCollectionRun';
import { useGraphqlStudioEnvMap } from './hooks/useGraphqlStudioEnvMap';

import { useDemoGqlModalLockBridge } from './hooks/useDemoGqlModalLockBridge';

const LazyDemoGqlStudioBridges = DEMO_HUB_ENABLED
  ? lazy(() => import('./DemoGqlStudioBridges'))
  : null;
import { useGraphqlHistoryMaxItems } from './hooks/useGraphqlHistoryMaxItems';
import { useMonacoExecutionMarkers } from './hooks/useMonacoExecutionMarkers';
import { resolveVars } from './utils/envUtils';
import { normalizeGraphqlEndpoint } from './utils/graphqlEndpointUtils';
import { useGqlActiveTabConnection } from './hooks/useGqlActiveTabConnection';
import {
  buildActiveTabHeaderMap,
  buildGraphqlSchemaHeaders,
  describeEnvResolvedAuthPreview,
} from './utils/graphqlStudioEnvUtils';
import { useGraphqlStudioQueryComplexity } from './hooks/useGraphqlStudioQueryComplexity';
import { buildAssertionResultMap } from './utils/subscriptionAssertions';
import { useGraphqlAdvancedSettings } from './hooks/useGraphqlAdvancedSettings';
import { useGraphqlBatchExecution } from './hooks/useGraphqlBatchExecution';
import { useGqlTabResponseCache, resolveActiveTabUploadProgress } from './hooks/useGqlTabResponseCache';
import { useGqlTabConnectionHandlers } from './hooks/useGqlTabConnectionHandlers';
import { resolveGqlAuthBadgePresentation } from './utils/authUtils';
import { useGqlExecutionCompletedHandler } from './hooks/useGqlExecutionCompletedHandler';
import { useGraphqlStudioExecute } from './hooks/useGraphqlStudioExecute';
import { useGqlVariablesValidation } from './hooks/useGqlVariablesValidation';
import { buildVarsModelUri } from './utils/monacoGraphqlSetup';
import '../../styles/graphql-studio.css';
import '../../styles/graphql-tls-panel.css';
import '../../styles/graphql-collections.css';
import { useGraphqlStudioBatchAdvSettings } from './hooks/useGraphqlStudioBatchAdvSettings';
import type { BottomPanelTabExtended, GraphqlStudioPageProps } from './graphqlStudioPageTypes';
import './utils/gqlModalLockHost';
import { useGraphqlStudioSubscriptionGuard } from './hooks/useGraphqlStudioSubscriptionGuard';
import { useGraphqlStudioUIState } from './hooks/useGraphqlStudioUIState';


export function GraphqlStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
  globalAuthProfiles = [],
}: GraphqlStudioPageProps) {
  const { bottomTab, setBottomTab, rightView, setRightView, fileEntries, setFileEntries, builderMode, setBuilderMode, focusAuthPanel } = useGraphqlStudioUIState();

  const {
    gqlSplitRef,
    gqlActivitySplitRef,
    gqlLeftPaneRef,
    editorPaneWidth,
    gqlPaneDividerProps,
    activityPanelWidth,
    activityDividerProps,
    bottomPanelHeight,
    bottomPanelDividerProps,
  } = useGraphqlStudioSplitPanes();

  const [activityTab, setActivityTab] = useState(() => loadPersistedActivityTab());
  const [runnerCollectionId, setRunnerCollectionId] = useState<string | null>(null);
  const [saveToColItem, setSaveToColItem] = useState<GraphqlHistoryItem | null>(null);
  const { historyMaxItems, handleHistoryMaxItemsChange } = useGraphqlHistoryMaxItems();

  const {
    endpoint, setEndpoint, historyConnectionId, prevBaseUrlRef,
    skipTlsVerify, handleSkipTlsVerifyChange,
    tlsCaCert, tlsClientCert, tlsClientKey, handleTlsCertsChange,
    pollingEnabled, pollingIntervalSeconds, handlePollingChange,
    auth, handleAuthChange,
    recentEndpoints, pushRecentEndpoint, removeRecentEndpoint,
    profiles, saveProfile, deleteProfile, profileModalOpen, setProfileModalOpen,
    profilesReady,
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
    upsertEnvironment, deleteEnvironmentByName,
    envModalOpen, setEnvModalOpen,
  } = useGraphqlConnectionSettings(resolvedBaseUrl);

  const { globalEnvMap, endpointProtocolStatus } = useGraphqlStudioEnvMap({
    selectedSvc,
    selectedEnvId,
    resolvedBaseUrl,
    envName,
    svcName,
  });

  const pageDefaultEndpointResolved = useMemo(
    () => normalizeGraphqlEndpoint(resolveVars(endpoint, activeEnvironment, globalEnvMap)),
    [endpoint, activeEnvironment, globalEnvMap],
  );

  const collections = useGraphqlCollections();
  const runner      = useGraphqlCollectionRunner();

  const { cacheExecutionResult, removeTabFromCache, responseCache, setTabUploadProgress } = useGqlTabResponseCache();

  const subscription = useGraphqlSubscription();

  const monacoInstance = useMonaco();
  const monacoRef      = useRef(monacoInstance);
  monacoRef.current    = monacoInstance;
  const responseModelUriRef = useRef<string>('');

  const cancelTabRef = useRef<(tabId: string) => void>(() => {});
  const isTabExecutingRef = useRef<(tabId: string) => boolean>(() => false);

  const {
    tabs, activeTabId, activeTab, operations, selectedOperation,
    confirmingCloseTabId, closeActiveTabRef, executingRef,
    addTab, handleTabClick, closeTab, renameTab,
    resolvedTabEndpoint, hasActiveTabEndpointOverride, hasActiveTabProfileLink,
    hasResolvedProfileLink,
    updateActiveTabEndpoint, clearActiveTabEndpoint,
    applyProfileToActiveTab, clearConnectionIdsForProfile,
    updateActiveTabSkipTlsVerify, hasActiveTabSkipTlsOverride,
    hasActiveTabTlsCertOverride,
    updateActiveTabTlsSettings,
    updateActiveTabPolling, clearActiveTabPolling, hasActiveTabPollingOverride, hasPendingProfileEndpoint,
    updateActiveTabAuth, clearActiveTabAuth, hasActiveTabAuthOverride,
    handleSelectOperation, handleQueryChange, handleVariablesChange,
    handleHeadersChange, handleAssertionsChange, handleSubscriptionTransportChange,
    activeDemoLessonId,
  } = useGqlStudioTabs({
    onCancelExecution: (tabId) => {
      setTabUploadProgress(tabId, null);
      cancelTabRef.current(tabId);
    },
    isTabExecuting: (tabId) => isTabExecutingRef.current(tabId),
    onClearFileEntries: () => setFileEntries([]),
    onResetSubscription: () => subscription.reset(),
    monacoRef: monacoRef as React.MutableRefObject<import('@monaco-editor/react').Monaco | null>,
    pageDefaultEndpoint: endpoint,
    pageDefaultEndpointResolved,
    pageDefaultSkipTlsVerify: skipTlsVerify,
    pageDefaultTlsCaCert: tlsCaCert,
    pageDefaultTlsClientCert: tlsClientCert,
    pageDefaultTlsClientKey: tlsClientKey,
    pageDefaultPollingEnabled: pollingEnabled,
    pageDefaultPollingIntervalSeconds: pollingIntervalSeconds,
    pageDefaultAuth: auth,
    profiles,
    profilesReady,
    onTabClosed: removeTabFromCache,
  });

  const {
    resolvedTabAuth,
    resolvedTabSkipTlsVerify,
    resolvedTabTls,
    resolvedTabPollingEnabled,
    resolvedTabPollingIntervalSeconds,
    resolvedTabPollingIntervalMs,
    activeTabConnection,
  } = useGqlActiveTabConnection({
    activeTab,
    profiles,
    endpoint,
    auth,
    skipTlsVerify,
    tlsCaCert,
    tlsClientCert,
    tlsClientKey,
    pollingEnabled,
    pollingIntervalSeconds,
  });

  const linkedProfileName = activeTabConnection?.profileName ?? null;
  const defaultAuthProfileId = selectedSvc?.authProfileIds?.[selectedEnvId ?? ''] ?? null;

  const {
    handleConnectionEndpointChange,
    handleConnectionSkipTlsChange,
    handleConnectionTlsChange,
    handleConnectionPollingChange,
    handleConnectionAuthChange,
  } = useGqlTabConnectionHandlers({
    tabsLength: tabs.length,
    hasActiveTabEndpointOverride,
    hasActiveTabProfileLink,
    hasActiveTabAuthOverride,
    hasActiveTabConnectionId: Boolean(activeTab?.connectionId),
    hasActiveTabSkipTlsOverride,
    hasActiveTabTlsCertOverride,
    hasActiveTabPollingOverride,
    setEndpoint,
    updateActiveTabEndpoint,
    handleSkipTlsVerifyChange,
    handleTlsCertsChange,
    updateActiveTabSkipTlsVerify,
    updateActiveTabTlsSettings,
    handlePollingChange,
    updateActiveTabPolling,
    handleAuthChange,
    updateActiveTabAuth,
  });

  const usesPageDefaultAuth =
    tabs.length === 1 && !hasActiveTabAuthOverride && !hasActiveTabProfileLink;

  const storedAuthForPanel = usesPageDefaultAuth ? auth : activeTab?.auth;

  const authBadgePresentation = useMemo(
    () => resolveGqlAuthBadgePresentation({
      resolvedAuth: resolvedTabAuth,
      hasTabAuthOverride: hasActiveTabAuthOverride,
      hasProfileLink: hasResolvedProfileLink,
      usesPageDefaultAuth,
      linkedProfileName,
      globalAuthProfiles,
      tabsLength: tabs.length,
    }),
    [
      resolvedTabAuth,
      hasActiveTabAuthOverride,
      hasResolvedProfileLink,
      usesPageDefaultAuth,
      linkedProfileName,
      globalAuthProfiles,
      tabs.length,
    ],
  );

  const resolvedAuthPreview = useMemo(
    () => describeEnvResolvedAuthPreview(resolvedTabAuth, activeEnvironment, globalEnvMap, globalAuthProfiles),
    [resolvedTabAuth, activeEnvironment, globalEnvMap, globalAuthProfiles],
  );

  const {
    editorMountRef, prettifyError, insertToast, handlePrettify, handleInsertField,
  } = useGqlStudioEditorActions({ activeQuery: activeTab?.query ?? '', onQueryChange: handleQueryChange });

  const handleDemoSetGqlQuery = useCallback((query: string) => {
    editorMountRef.current?.setValue(query);
    handleQueryChange(query);
  }, [handleQueryChange, editorMountRef]);

  useDemoGqlModalLockBridge({
    envModalOpen,
    profileModalOpen,
    setEnvModalOpen,
    setProfileModalOpen,
  });

  const activeTabForHeaders = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeTabHeaders = useMemo(
    () => buildActiveTabHeaderMap(activeTabForHeaders?.headers),
    [activeTabForHeaders],
  );

  const schemaHeaders = useMemo(
    () => buildGraphqlSchemaHeaders(resolvedTabAuth, activeTabHeaders, activeEnvironment, globalEnvMap, globalAuthProfiles),
    [resolvedTabAuth, activeTabHeaders, activeEnvironment, globalEnvMap, globalAuthProfiles],
  );

  const resolvedTabEndpointForSchema = useMemo(
    () => normalizeGraphqlEndpoint(resolveVars(resolvedTabEndpoint, activeEnvironment, globalEnvMap)),
    [resolvedTabEndpoint, activeEnvironment, globalEnvMap],
  );

  const tabSchemaConnectionId = resolvedTabEndpointForSchema || historyConnectionId;

  const tabConnectionPageDefaults = useMemo(
    () => ({
      endpoint,
      auth,
      skipTlsVerify,
      tlsCaCert,
      tlsClientCert,
      tlsClientKey,
      pollingEnabled,
      pollingIntervalSeconds,
    }),
    [endpoint, auth, skipTlsVerify, tlsCaCert, tlsClientCert, tlsClientKey, pollingEnabled, pollingIntervalSeconds],
  );

  const history = useGraphqlHistory(tabSchemaConnectionId, historyMaxItems);

  const handleExecutionCompleted = useGqlExecutionCompletedHandler({
    cacheExecutionResult,
    tabs,
    pageEndpoint: endpoint,
    profiles,
    activeEnvironment,
    globalEnvMap,
    saveHistory: history.saveHistory,
  });

  const {
    activeState,
    execute,
    cancel,
    cancelTab,
    resolveDedupChoice,
    isTabExecuting,
    executionLayers,
  } = useGraphqlStudioTabExecution({
    tabs,
    activeTabId,
    profiles,
    pageDefaults: tabConnectionPageDefaults,
    globalAuthProfiles,
    onExecutionCompleted: handleExecutionCompleted,
  });

  cancelTabRef.current = cancelTab;
  isTabExecutingRef.current = isTabExecuting;
  executingRef.current = activeState.status === 'loading';

  const {
    status: execStatus,
    response,
    apqInfo: activeTabApqInfo,
    isDuplicate,
    duplicateSourceTabId,
  } = activeState;
  const executing = execStatus === 'loading';
  const isActiveTabExecuting = executing;

  const activeTabUploadProgress = useMemo(
    () => resolveActiveTabUploadProgress(activeTabId, responseCache),
    [activeTabId, responseCache],
  );

  const handleCancel = useCallback(() => {
    setTabUploadProgress(activeTabId, null);
    cancel();
  }, [activeTabId, cancel, setTabUploadProgress]);

  const {
    advSettingsOpen, setAdvSettingsOpen, advSettingsBtnRef,
    advSettings, advSettingsRef, setAdvSettings,
    apqUnsupportedToast, setApqUnsupportedToast, batchUnsupportedToast, setBatchUnsupportedToast,
    handleAdvSettingsChange,
  } = useGraphqlAdvancedSettings(tabSchemaConnectionId, activeTabApqInfo);

  const onIntrospectComplete = useCallback(() => setRightView('schema'), [setRightView]);

  const {
    schemaStatus,
    schemaInfo,
    rawIntrospection,
    schemaErrorMessage,
    introspecting,
    handleIntrospect,
    pollErrorMessage,
    mockServer,
    invalidItemIds,
    snapshots,
    deprecatedUsages,
    diffModal,
    setDiffModal,
    schemaDiffToast,
    setSchemaDiffToast,
    toastBaselineSnapshotIdRef,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearOlderSnapshots,
    handleOpenDiff,
    handleAcknowledge,
    handleUnacknowledge,
    connectionBarSchemaStatus,
  } = useGraphqlStudioSchemaLayer({
    tabSchemaConnectionId,
    resolvedTabEndpointForSchema,
    schemaHeaders,
    resolvedTabPollingIntervalMs,
    resolvedTabSkipTlsVerify,
    resolvedTabTls,
    hasPendingProfileEndpoint,
    hasActiveTabEndpointOverride,
    pageDefaultEndpointResolved,
    historyConnectionId,
    collectionTrees: collections.trees,
    onIntrospectComplete,
  });

  useMonacoExecutionMarkers(response, monacoInstance, responseModelUriRef);
  const queryValidationErrorCount = useQueryValidation(
    activeTab?.query ?? '',
    activeTab?.modelUri ?? '',
    rawIntrospection,
    schemaStatus === 'loaded',
  );

  const { complexityResult, complexityWarningPending, setComplexityWarningPending } =
    useGraphqlStudioQueryComplexity(
      schemaStatus,
      schemaInfo,
      activeTab?.query ?? '',
      activeTab?.selectedOperation ?? undefined,
    );

  const varsError = useGqlVariablesValidation(activeTab?.variables ?? '', activeTabId);

  const assertionResultMap = useMemo(
    () => buildAssertionResultMap(subscription.messages, activeTab?.subscriptionAssertions ?? []),
    [subscription.messages, activeTab?.subscriptionAssertions],
  );

  const {
    batchResult, setBatchResult, batchExecuting,
    complexityGatePending, setComplexityGatePending,
    pendingExecuteAfterGateRef, skipComplexityGateRef, sessionBypassComplexityGateRef,
    effectiveBatchedTabs, batchedTabIdsSet, batchTabOverrides,
    batchGroups, activeBatchGroupKey, activeBatchGroup, handleSetActiveBatchGroup,
    handleToggleBatch, handleSendBatch, setBatchTabOverrides,
    batchEndpointMismatch, batchEndpointReady, batchProfileLinkPending,
  } = useGraphqlBatchExecution({
    tabs,
    activeTabId,
    activeDemoLessonId,
    pageDefaultEndpoint: endpoint, profiles, pageDefaultAuth: auth, activeEnvironment, globalEnvMap,
    pageDefaultSkipTlsVerify: skipTlsVerify,
    pageDefaultTlsCaCert: tlsCaCert,
    pageDefaultTlsClientCert: tlsClientCert,
    pageDefaultTlsClientKey: tlsClientKey,
    globalAuthProfiles,
    advSettingsRef, setAdvSettings, setBatchUnsupportedToast,
    setRightView, gqlProxyBase: GQL_STUDIO_PROXY_BASE,
    historyConnectionId: tabSchemaConnectionId,
    saveHistory: history.saveHistory,
  });

  const {
    handleAdvSettingsSave,
    handleAdvSettingsCancel,
    batchSummaryLabel,
    batchSettingsProps,
  } = useGraphqlStudioBatchAdvSettings({
    advSettingsOpen,
    advSettings,
    handleAdvSettingsChange,
    setAdvSettingsOpen,
    batchTabOverrides,
    activeBatchGroupKey,
    setBatchTabOverrides,
    handleSetActiveBatchGroup,
    batchGroups,
    batchedTabIdsSet,
    handleToggleBatch,
    tabs,
    profiles,
    endpoint,
    pageDefaultEndpointResolved,
    activeDemoLessonId,
    activeBatchGroup,
    effectiveBatchedTabs,
  });

  const handleExecute = useGraphqlStudioExecute({
    activeTab,
    resolvedTabEndpoint,
    selectedOperation,
    activeTabHeaders,
    auth: resolvedTabAuth,
    globalAuthProfiles,
    activeEnvironment,
    globalEnvMap,
    skipTlsVerify: resolvedTabSkipTlsVerify,
    resolvedTabTls,
    fileEntries,
    executing,
    isTabExecutingRef,
    complexityResult,
    complexityWarningPending,
    setComplexityWarningPending,
    complexityGatePending,
    setComplexityGatePending,
    pendingExecuteAfterGateRef,
    skipComplexityGateRef,
    sessionBypassComplexityGateRef,
    advSettings,
    execute,
    pushRecentEndpoint,
    isDuplicate,
    duplicateSourceTabId,
    responseModelUriRef,
    setRightView,
    setTabUploadProgress,
    endpointLinkPending: hasPendingProfileEndpoint,
    editorMountRef,
  });

  const { handleRunCollection } = useGraphqlCollectionRun({
    collectionTrees: collections.trees,
    endpoint: resolvedTabEndpoint,
    skipTlsVerify: resolvedTabSkipTlsVerify,
    tls: resolvedTabTls,
    activeEnvironment, globalEnvMap, activeTabHeaders, auth: resolvedTabAuth, globalAuthProfiles, runner, updateVariables,
    onSetRunnerCollectionId: setRunnerCollectionId,
    onSetBottomTab: (tab) => setBottomTab(tab as BottomPanelTabExtended),
    onItemExecuted: (id) => collections.markItemExecuted(id).catch(() => {}),
    endpointLinkPending: hasPendingProfileEndpoint,
  });

  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;

  const {
    handleLoadCollectionItem,
    handleOpenCollectionItem,
    handleLoadHistoryItem,
    handleRunHistoryItem,
    handleEditInEditor,
    handleBuilderExecute,
  } = useGqlItemLoaders({
    editorMountRef,
    onQueryChange: handleQueryChange,
    onVariablesChange: handleVariablesChange,
    onSetActivityTab: (tab) => setActivityTab(tab as Parameters<typeof setActivityTab>[0]),
    onSetBuilderMode: setBuilderMode,
    handleExecuteRef,
    collectionTrees: collections.trees,
  });

  const { handleSubscribe: _handleSubscribe, handleStopSubscription, handleExportSubscription } = useSubscriptionOrchestration({
    activeTab, endpoint: resolvedTabEndpoint, auth: resolvedTabAuth, activeEnvironment, globalEnvMap, activeTabHeaders,
    selectedOperation, skipTlsVerify: resolvedTabSkipTlsVerify,
    tlsCaCert: resolvedTabTls.caCert,
    tlsClientCert: resolvedTabTls.clientCert,
    tlsClientKey: resolvedTabTls.clientKey,
    subscription,
    endpointLinkPending: hasPendingProfileEndpoint,
    globalAuthProfiles,
  });

  const { handleSubscribe } = useGraphqlStudioSubscriptionGuard({
    activeTabId,
    activeTab,
    subscription,
    onSubscribe: _handleSubscribe,
    setRightView,
  });

  useGraphqlStudioShortcutsBridge({
    handleExecute, handleSubscribe, handleStopSubscription, handleIntrospect, introspecting,
    handleCancel, addTab, closeActiveTab: closeActiveTabRef.current,
    subscriptionState: subscription.state, subscriptionDisconnect: subscription.disconnect,
    activeTabOperationType: activeTab?.operationType, execStatus, endpoint: resolvedTabEndpoint,
    activeEnvironment, globalEnvMap, profileModalOpen, envModalOpen,
    endpointLinkPending: hasPendingProfileEndpoint,
  });

  if (tabs.length === 0 || !activeTab) return null;

  const varsModelPath = buildVarsModelUri(activeTab.id);

  return (
    <div className="gql-studio" data-testid="gql-studio-page">
      {LazyDemoGqlStudioBridges && (
        <Suspense fallback={null}>
          <LazyDemoGqlStudioBridges
            upsertEnvironment={upsertEnvironment}
            deleteEnvironmentByName={deleteEnvironmentByName}
            applyTlsSettings={handleConnectionTlsChange}
            setGqlQuery={handleDemoSetGqlQuery}
            setRightView={setRightView}
          />
        </Suspense>
      )}
      {executionLayers}
      <GraphqlConnectionBar
        endpoint={resolvedTabEndpoint}
        onEndpointChange={handleConnectionEndpointChange}
        hasEndpointOverride={hasActiveTabEndpointOverride || hasActiveTabProfileLink}
        onClearEndpoint={clearActiveTabEndpoint}
        onExecute={handleExecute}
        onCancel={handleCancel}
        executing={isActiveTabExecuting}
        introspecting={introspecting}
        onIntrospect={handleIntrospect}
        schemaStatus={connectionBarSchemaStatus}
        typesCount={schemaInfo?.types?.length}
        schemaPolling={resolvedTabPollingEnabled}
        operations={operations}
        selectedOperation={selectedOperation}
        onSelectOperation={handleSelectOperation}
        varsInvalid={varsError !== null}
        queryEmpty={!activeTab?.query.trim()}
        fileErrors={fileEntries.some((e) => e.error !== null)}
        queryValidationErrors={queryValidationErrorCount}
        auth={resolvedTabAuth}
        onFocusAuthPanel={focusAuthPanel}
        authBadgePresentation={authBadgePresentation}
        globalAuthProfiles={globalAuthProfiles}
        recentEndpoints={recentEndpoints}
        onRemoveRecentEndpoint={removeRecentEndpoint}
        activeEnvName={activeEnvironment?.name ?? null}
        activeEnvironment={activeEnvironment}
        globalEnvMap={globalEnvMap}
        endpointProtocolStatus={endpointProtocolStatus}
        onEnvBadgeClick={() => setEnvModalOpen(true)}
        profiles={profiles}
        onProfileBadgeClick={() => setProfileModalOpen(true)}
        skipTlsVerify={resolvedTabSkipTlsVerify}
        onSkipTlsVerifyChange={handleConnectionSkipTlsChange}
        tlsCaCert={resolvedTabTls.caCert}
        tlsClientCert={resolvedTabTls.clientCert}
        tlsClientKey={resolvedTabTls.clientKey}
        onTlsSettingsChange={handleConnectionTlsChange}
        pollingEnabled={resolvedTabPollingEnabled}
        pollingIntervalSeconds={resolvedTabPollingIntervalSeconds}
        onPollingChange={handleConnectionPollingChange}
        hasPollingOverride={hasActiveTabPollingOverride}
        onClearPolling={clearActiveTabPolling}
        endpointLinkPending={hasPendingProfileEndpoint}
        pollErrorMessage={pollErrorMessage}
        activeOperationType={activeTab?.operationType ?? null}
        subscriptionState={subscription.state}
        onSubscribe={handleSubscribe}
        onStop={handleStopSubscription}
        subscriptionTransport={activeTab?.subscriptionTransport ?? 'auto'}
        onSubscriptionTransportChange={handleSubscriptionTransportChange}
        complexityScore={complexityResult?.score}
        complexityLevel={complexityResult?.level}
        advancedSettingsOpen={advSettingsOpen}
        onAdvancedSettingsClick={() => setAdvSettingsOpen((v) => !v)}
        advSettingsBtnRef={advSettingsBtnRef}
        batchEnabled={advSettings.batchEnabled}
        batchedTabCount={effectiveBatchedTabs.length}
        batchSummaryLabel={batchSummaryLabel}
        batchExecuting={batchExecuting}
        batchEndpointMismatch={batchEndpointMismatch}
        batchEndpointReady={batchEndpointReady}
        batchProfileLinkPending={batchProfileLinkPending}
        onSendBatch={handleSendBatch}
        apqCacheHit={activeTabApqInfo?.cacheHit}
        apqHash={activeTabApqInfo?.hash}
        apqUnsupported={activeTabApqInfo?.unsupported}
      />

      <GraphqlAdvancedSettings
        values={advSettings}
        onSave={handleAdvSettingsSave}
        onClose={handleAdvSettingsCancel}
        anchorRef={advSettingsBtnRef}
        open={advSettingsOpen}
        batchSettings={advSettingsOpen ? batchSettingsProps : null}
      />

      <GraphqlStudioPageDialogs
        complexityGatePending={complexityGatePending}
        complexityResult={complexityResult}
        advSettings={advSettings}
        pendingExecuteAfterGateRef={pendingExecuteAfterGateRef}
        sessionBypassComplexityGateRef={sessionBypassComplexityGateRef}
        skipComplexityGateRef={skipComplexityGateRef}
        setComplexityGatePending={setComplexityGatePending}
        setComplexityWarningPending={setComplexityWarningPending}
        isDuplicate={isDuplicate}
        duplicateSourceTabId={duplicateSourceTabId}
        activeTabId={activeTabId}
        resolveDedupChoice={resolveDedupChoice}
        connectionModals={{
          profileModalOpen,
          onProfileModalClose: () => setProfileModalOpen(false),
          profiles,
          activeConnectionId: activeTab?.connectionId ?? null,
          endpoint: resolvedTabEndpoint,
          auth: resolvedTabAuth,
          globalAuthProfiles,
          onSaveProfile: (name) => saveProfile(name, resolvedTabEndpoint, resolvedTabAuth),
          onDeleteProfile: (id) => {
            deleteProfile(id);
            clearConnectionIdsForProfile(id);
          },
          onApplyProfileToActiveTab: applyProfileToActiveTab,
          prevBaseUrlRef,
          envModalOpen,
          onEnvModalClose: () => setEnvModalOpen(false),
          environments,
          activeEnvironmentId: activeEnvironment?.id ?? null,
          onCreateEnvironment: createEnvironment,
          onDeleteEnvironment: deleteEnvironment,
          onSetActiveEnvironment: setActiveEnvironment,
          onRenameEnvironment: updateEnvironmentName,
          onUpdateVariables: updateVariables,
          onImportEnvironment: importEnvironment,
          onExportEnvironment: exportEnvironment,
        }}
      />

      <GqlTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        confirmingCloseTabId={confirmingCloseTabId}
        pageDefaultEndpoint={endpoint}
        pageDefaultEndpointResolved={pageDefaultEndpointResolved}
        globalAuthProfiles={globalAuthProfiles}
        onTabClick={handleTabClick}
        onTabClose={closeTab}
        onAddTab={addTab}
        onRenameTab={renameTab}
        profiles={profiles}
        batchEnabled={advSettings.batchEnabled}
        batchIncludedTabIds={batchedTabIdsSet}
      />

      <div className={`gql-main${builderMode ? ' gql-main--builder' : ''} gql-main--with-activity`} data-testid="gql-main">
        <GraphqlStudioActivityBar activeTab={activityTab} onTabChange={setActivityTab} />

        <div className="gql-main-body" ref={gqlActivitySplitRef} data-testid="gql-main-body">
          <GraphqlStudioLeftActivityPanel
            activityTab={activityTab}
            activityPanelWidth={activityPanelWidth}
            history={history}
            historyMaxItems={historyMaxItems}
            onHistoryMaxItemsChange={handleHistoryMaxItemsChange}
            tabSchemaConnectionId={tabSchemaConnectionId}
            handleLoadHistoryItem={handleLoadHistoryItem}
            handleRunHistoryItem={handleRunHistoryItem}
            setSaveToColItem={setSaveToColItem}
            mockServer={mockServer}
            schemaInfo={schemaInfo}
            collections={collections}
            invalidItemIds={invalidItemIds}
            handleRunCollection={handleRunCollection}
            handleLoadCollectionItem={handleLoadCollectionItem}
            saveToColItem={saveToColItem}
            activeTab={activeTab}
            activeEnvironment={activeEnvironment}
          />

          {activityTab && (
            <div
              className="gql-activity-pane-divider"
              {...activityDividerProps}
              data-testid="gql-activity-pane-divider"
            />
          )}

          <GraphqlStudioSplitWorkspace
            gqlSplitRef={gqlSplitRef}
            gqlLeftPaneRef={gqlLeftPaneRef}
            editorPaneWidth={editorPaneWidth}
            gqlPaneDividerProps={gqlPaneDividerProps}
            bottomPanelDividerProps={bottomPanelDividerProps}
            bottomPanelHeight={bottomPanelHeight}
            builderMode={builderMode}
            onSetBuilderMode={setBuilderMode}
            schemaInfo={schemaInfo}
            onEditInEditor={handleEditInEditor}
            onBuilderExecute={handleBuilderExecute}
            activeTab={activeTab}
            onQueryChange={handleQueryChange}
            editorMountRef={editorMountRef}
            prettifyError={prettifyError}
            onPrettify={handlePrettify}
            insertToast={insertToast}
            complexityWarningPending={complexityWarningPending}
            complexityResult={complexityResult}
            onExecute={handleExecute}
            onDismissComplexityWarning={() => setComplexityWarningPending(false)}
            onAssertionsChange={handleAssertionsChange}
            bottomTab={bottomTab}
            onSetBottomTab={setBottomTab}
            runnerCollectionId={runnerCollectionId}
            runner={runner}
            collections={collections}
            varsModelPath={varsModelPath}
            varsError={varsError}
            onVariablesChange={handleVariablesChange}
            onHeadersChange={handleHeadersChange}
            activeEnvironment={activeEnvironment}
            globalEnvMap={globalEnvMap}
            fileEntries={fileEntries}
            onFileEntriesChange={setFileEntries}
            activeTabUploadProgress={activeTabUploadProgress}
            storedAuthForPanel={storedAuthForPanel}
            resolvedAuthPreview={resolvedAuthPreview}
            usesPageDefaultAuth={usesPageDefaultAuth}
            hasActiveTabAuthOverride={hasActiveTabAuthOverride}
            onAuthChange={handleConnectionAuthChange}
            onResetAuthToInherit={clearActiveTabAuth}
            linkedProfileName={linkedProfileName}
            globalAuthProfiles={globalAuthProfiles}
            defaultAuthProfileId={defaultAuthProfileId}
            rightView={rightView}
            onRightViewChange={setRightView}
            response={response}
            isActiveTabExecuting={isActiveTabExecuting}
            execStatus={execStatus}
            schemaStatus={schemaStatus}
            schemaErrorMessage={schemaErrorMessage}
            onIntrospect={handleIntrospect}
            introspecting={introspecting}
            onInsertField={handleInsertField}
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onClearOlderSnapshots={handleClearOlderSnapshots}
            onOpenDiff={handleOpenDiff}
            deprecatedUsages={deprecatedUsages}
            onOpenCollectionItem={handleOpenCollectionItem}
            subscription={subscription}
            selectedOperation={selectedOperation}
            assertionResultMap={assertionResultMap}
            onExportSubscription={handleExportSubscription}
            onStopSubscription={handleStopSubscription}
            onResubscribeSubscription={handleSubscribe}
          />
        </div>
      </div>

      <GraphqlStudioPageOverlays
        batchResult={batchResult}
        setBatchResult={setBatchResult}
        schemaDiffToast={schemaDiffToast}
        snapshots={snapshots}
        toastBaselineSnapshotIdRef={toastBaselineSnapshotIdRef}
        schemaInfo={schemaInfo}
        handleOpenDiff={handleOpenDiff}
        setRightView={setRightView}
        setSchemaDiffToast={setSchemaDiffToast}
        apqUnsupportedToast={apqUnsupportedToast}
        setApqUnsupportedToast={setApqUnsupportedToast}
        batchUnsupportedToast={batchUnsupportedToast}
        setBatchUnsupportedToast={setBatchUnsupportedToast}
        diffModal={diffModal}
        setDiffModal={setDiffModal}
        invalidItemIds={invalidItemIds}
        handleAcknowledge={handleAcknowledge}
        handleUnacknowledge={handleUnacknowledge}
        saveToColItem={saveToColItem}
        setSaveToColItem={setSaveToColItem}
        collectionTrees={collections.trees}
        onSaveToCollection={(collectionId, folderId, name, operation) =>
          collections.addItem(collectionId, folderId, name, operation)
        }
        setActivityTab={setActivityTab}
      />
    </div>
  );
}
