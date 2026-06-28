/**
 * Execution pipeline — tab execution, batch, schema, validation, response pane.
 */
import { useMemo } from 'react';
import { GQL_STUDIO_PROXY_BASE } from '../graphqlStudioPageConstants';
import { useGraphqlHistory } from './useGraphqlHistory';
import { useGqlExecutionCompletedHandler } from './useGqlExecutionCompletedHandler';
import { useGraphqlStudioTabExecution } from './useGraphqlStudioTabExecution';
import { useGraphqlAdvancedSettings } from './useGraphqlAdvancedSettings';
import { useGraphqlBatchExecution } from './useGraphqlBatchExecution';
import { useGraphqlStudioSchemaLayer } from './useGraphqlStudioSchemaLayer';
import { useMonacoExecutionMarkers } from './useMonacoExecutionMarkers';
import { useQueryValidation } from './useQueryValidation';
import { useGraphqlStudioQueryComplexity } from './useGraphqlStudioQueryComplexity';
import { useGqlVariablesValidation } from './useGqlVariablesValidation';
import { useGraphqlStudioBatchAdvSettings } from './useGraphqlStudioBatchAdvSettings';
import { useGraphqlStudioExecute } from './useGraphqlStudioExecute';
import { resolveActiveTabUploadProgress } from './useGqlTabResponseCache';
import { resolveStudioResponsePaneState } from '../utils/graphqlStudioPageResponsePane';
import { buildAssertionResultMap } from '../utils/subscriptionAssertions';
import {
  buildTabConnectionPageDefaults,
  createHandleCancel,
  createOnIntrospectComplete,
  createHandleResponseSubTabChange,
  createSyncBatchResultsHandler,
  wireExecutionRefs,
} from './studioPageCompositionUtils';
import type { GraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';
import type { GraphqlStudioPageTabsLayer } from './useGraphqlStudioPageTabsLayer';
import type { GraphqlStudioPageProps } from '../graphqlStudioPageTypes';

export function useGraphqlStudioPageExecutionLayer(
  foundation: GraphqlStudioPageFoundation,
  tabsLayer: GraphqlStudioPageTabsLayer,
  globalAuthProfiles: GraphqlStudioPageProps['globalAuthProfiles'],
) {
  const { connection, responseCacheLayer, subscription, monacoInstance, responseModelUriRef, cancelTabRef, isTabExecutingRef, executingRef, uiState, collections, historyMaxItems } = foundation;
  const { setRightView } = uiState;

  const tabConnectionPageDefaults = useMemo(
    () => buildTabConnectionPageDefaults(
      connection.endpoint,
      connection.auth,
      connection.skipTlsVerify,
      connection.tlsCaCert,
      connection.tlsClientCert,
      connection.tlsClientKey,
      connection.pollingEnabled,
      connection.pollingIntervalSeconds,
    ),
    [
      connection.endpoint,
      connection.auth,
      connection.skipTlsVerify,
      connection.tlsCaCert,
      connection.tlsClientCert,
      connection.tlsClientKey,
      connection.pollingEnabled,
      connection.pollingIntervalSeconds,
    ],
  );

  const history = useGraphqlHistory(tabsLayer.tabSchemaConnectionId, historyMaxItems);

  const handleExecutionCompleted = useGqlExecutionCompletedHandler({
    cacheExecutionResult: responseCacheLayer.cacheExecutionResult,
    tabs: tabsLayer.tabs,
    pageEndpoint: connection.endpoint,
    profiles: connection.profiles,
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    saveHistory: history.saveHistory,
  });

  const execution = useGraphqlStudioTabExecution({
    tabs: tabsLayer.tabs,
    activeTabId: tabsLayer.activeTabId,
    profiles: connection.profiles,
    pageDefaults: tabConnectionPageDefaults,
    globalAuthProfiles: globalAuthProfiles ?? [],
    onExecutionCompleted: handleExecutionCompleted,
  });

  wireExecutionRefs(
    cancelTabRef,
    isTabExecutingRef,
    executingRef,
    execution.cancelTab,
    execution.isTabExecuting,
    execution.activeState.status === 'loading',
  );

  const {
    status: execStatus,
    response,
    apqInfo: activeTabApqInfo,
    isDuplicate,
    duplicateSourceTabId,
  } = execution.activeState;
  const executing = execStatus === 'loading';

  const activeTabUploadProgress = useMemo(
    () => resolveActiveTabUploadProgress(tabsLayer.activeTabId, responseCacheLayer.responseCache),
    [tabsLayer.activeTabId, responseCacheLayer.responseCache],
  );

  const handleCancel = useMemo(
    () => createHandleCancel(tabsLayer.activeTabId, execution.cancel, responseCacheLayer.setTabUploadProgress),
    [tabsLayer.activeTabId, execution.cancel, responseCacheLayer.setTabUploadProgress],
  );

  const advancedSettings = useGraphqlAdvancedSettings(tabsLayer.tabSchemaConnectionId, activeTabApqInfo);

  const onIntrospectComplete = useMemo(() => createOnIntrospectComplete(setRightView), [setRightView]);

  const handleResponseSubTabChange = useMemo(
    () => createHandleResponseSubTabChange(tabsLayer.updateActiveTab),
    [tabsLayer.updateActiveTab],
  );

  const schemaLayer = useGraphqlStudioSchemaLayer({
    tabSchemaConnectionId: tabsLayer.tabSchemaConnectionId,
    resolvedTabEndpointForSchema: tabsLayer.resolvedTabEndpointForSchema,
    schemaHeaders: tabsLayer.schemaHeaders,
    resolvedTabPollingIntervalMs: tabsLayer.resolvedTabPollingIntervalMs,
    resolvedTabSkipTlsVerify: tabsLayer.resolvedTabSkipTlsVerify,
    resolvedTabTls: tabsLayer.resolvedTabTls,
    hasPendingProfileEndpoint: tabsLayer.hasPendingProfileEndpoint,
    hasActiveTabEndpointOverride: tabsLayer.hasActiveTabEndpointOverride,
    pageDefaultEndpointResolved: foundation.pageDefaultEndpointResolved,
    historyConnectionId: connection.historyConnectionId,
    collectionTrees: collections.trees,
    onIntrospectComplete,
  });

  const syncBatchResultsToResponsePane = useMemo(
    () => createSyncBatchResultsHandler(responseCacheLayer.cacheExecutionResult, execution.applyTabResult),
    [responseCacheLayer.cacheExecutionResult, execution.applyTabResult],
  );

  const batchLayer = useGraphqlBatchExecution({
    tabs: tabsLayer.tabs,
    activeTabId: tabsLayer.activeTabId,
    activeDemoLessonId: tabsLayer.activeDemoLessonId,
    pageDefaultEndpoint: connection.endpoint,
    profiles: connection.profiles,
    pageDefaultAuth: connection.auth,
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    pageDefaultSkipTlsVerify: connection.skipTlsVerify,
    pageDefaultTlsCaCert: connection.tlsCaCert,
    pageDefaultTlsClientCert: connection.tlsClientCert,
    pageDefaultTlsClientKey: connection.tlsClientKey,
    globalAuthProfiles: globalAuthProfiles ?? [],
    advSettingsRef: advancedSettings.advSettingsRef,
    setAdvSettings: advancedSettings.setAdvSettings,
    setBatchUnsupportedToast: advancedSettings.setBatchUnsupportedToast,
    setRightView,
    gqlProxyBase: GQL_STUDIO_PROXY_BASE,
    historyConnectionId: tabsLayer.tabSchemaConnectionId,
    saveHistory: history.saveHistory,
    syncBatchResultsToResponsePane,
  });

  const responsePaneState = useMemo(() => {
    const base = responseCacheLayer.resolvePaneState(tabsLayer.activeTabId ?? '', execStatus, response);
    return resolveStudioResponsePaneState(
      base,
      batchLayer.batchExecuting,
      tabsLayer.activeTabId,
      batchLayer.batchedTabIdsSet,
    );
  }, [
    responseCacheLayer,
    tabsLayer.activeTabId,
    execStatus,
    response,
    batchLayer.batchExecuting,
    batchLayer.batchedTabIdsSet,
  ]);

  useMonacoExecutionMarkers(responsePaneState.response, monacoInstance, responseModelUriRef);

  const queryValidationErrorCount = useQueryValidation(
    tabsLayer.activeTab?.query ?? '',
    tabsLayer.activeTab?.modelUri ?? '',
    schemaLayer.rawIntrospection,
    schemaLayer.schemaStatus === 'loaded',
  );

  const complexity = useGraphqlStudioQueryComplexity(
    schemaLayer.schemaStatus,
    schemaLayer.schemaInfo,
    tabsLayer.activeTab?.query ?? '',
    tabsLayer.activeTab?.selectedOperation ?? undefined,
  );

  const varsError = useGqlVariablesValidation(tabsLayer.activeTab?.variables ?? '', tabsLayer.activeTabId);

  const assertionResultMap = useMemo(
    () => buildAssertionResultMap(subscription.messages, tabsLayer.activeTab?.subscriptionAssertions ?? []),
    [subscription.messages, tabsLayer.activeTab?.subscriptionAssertions],
  );

  const batchAdvSettings = useGraphqlStudioBatchAdvSettings({
    advSettingsOpen: advancedSettings.advSettingsOpen,
    advSettings: advancedSettings.advSettings,
    handleAdvSettingsChange: advancedSettings.handleAdvSettingsChange,
    setAdvSettingsOpen: advancedSettings.setAdvSettingsOpen,
    batchTabOverrides: batchLayer.batchTabOverrides,
    activeBatchGroupKey: batchLayer.activeBatchGroupKey,
    setBatchTabOverrides: batchLayer.setBatchTabOverrides,
    handleSetActiveBatchGroup: batchLayer.handleSetActiveBatchGroup,
    batchGroups: batchLayer.batchGroups,
    batchedTabIdsSet: batchLayer.batchedTabIdsSet,
    handleToggleBatch: batchLayer.handleToggleBatch,
    tabs: tabsLayer.tabs,
    profiles: connection.profiles,
    endpoint: connection.endpoint,
    pageDefaultEndpointResolved: foundation.pageDefaultEndpointResolved,
    activeDemoLessonId: tabsLayer.activeDemoLessonId,
    activeBatchGroup: batchLayer.activeBatchGroup,
    effectiveBatchedTabs: batchLayer.effectiveBatchedTabs,
  });

  const handleExecute = useGraphqlStudioExecute({
    activeTab: tabsLayer.activeTab,
    resolvedTabEndpoint: tabsLayer.resolvedTabEndpoint,
    selectedOperation: tabsLayer.selectedOperation,
    activeTabHeaders: tabsLayer.activeTabHeaders,
    auth: tabsLayer.resolvedTabAuth,
    globalAuthProfiles: globalAuthProfiles ?? [],
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    skipTlsVerify: tabsLayer.resolvedTabSkipTlsVerify,
    resolvedTabTls: tabsLayer.resolvedTabTls,
    fileEntries: uiState.fileEntries,
    executing,
    isTabExecutingRef,
    complexityResult: complexity.complexityResult,
    complexityWarningPending: complexity.complexityWarningPending,
    setComplexityWarningPending: complexity.setComplexityWarningPending,
    complexityGatePending: batchLayer.complexityGatePending,
    setComplexityGatePending: batchLayer.setComplexityGatePending,
    pendingExecuteAfterGateRef: batchLayer.pendingExecuteAfterGateRef,
    skipComplexityGateRef: batchLayer.skipComplexityGateRef,
    sessionBypassComplexityGateRef: batchLayer.sessionBypassComplexityGateRef,
    advSettings: advancedSettings.advSettings,
    execute: execution.execute,
    pushRecentEndpoint: connection.pushRecentEndpoint,
    isDuplicate,
    duplicateSourceTabId,
    responseModelUriRef,
    setRightView,
    setTabUploadProgress: responseCacheLayer.setTabUploadProgress,
    endpointLinkPending: tabsLayer.hasPendingProfileEndpoint,
    editorMountRef: tabsLayer.editorActions.editorMountRef,
  });

  return {
    history,
    execution,
    advancedSettings,
    schemaLayer,
    batchLayer,
    batchAdvSettings,
    handleExecute,
    handleCancel,
    handleResponseSubTabChange,
    activeTabUploadProgress,
    responsePaneState,
    queryValidationErrorCount,
    complexity,
    varsError,
    assertionResultMap,
    execStatus,
    executing,
    activeTabApqInfo,
    isDuplicate,
    duplicateSourceTabId,
  };
}

export type GraphqlStudioPageExecutionLayer = ReturnType<typeof useGraphqlStudioPageExecutionLayer>;
