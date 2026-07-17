/**
 * User interactions — collection run, item loaders, subscription, shortcuts.
 */
import { useRef, useMemo } from 'react';
import { useGraphqlCollectionRun } from './useGraphqlCollectionRun';
import { useGqlItemLoaders } from './useGqlItemLoaders';
import { useSubscriptionOrchestration } from './useSubscriptionOrchestration';
import { useGraphqlStudioSubscriptionGuard } from './useGraphqlStudioSubscriptionGuard';
import { useGraphqlStudioShortcutsBridge } from './useGraphqlStudioShortcutsBridge';
import { createHandleDismissComplexityWarning, createHandleSaveToCollection, createMarkCollectionItemExecuted, createSetBottomPanelTab, createSetGqlActivityTab } from './studioPageCompositionUtils';
import type { GraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';
import type { GraphqlStudioPageTabsLayer } from './useGraphqlStudioPageTabsLayer';
import type { GraphqlStudioPageExecutionLayer } from './useGraphqlStudioPageExecutionLayer';
import type { GraphqlStudioPageProps } from '../graphqlStudioPageTypes';

export function useGraphqlStudioPageInteractionLayer(
  foundation: GraphqlStudioPageFoundation,
  tabsLayer: GraphqlStudioPageTabsLayer,
  executionLayer: GraphqlStudioPageExecutionLayer,
  globalAuthProfiles: GraphqlStudioPageProps['globalAuthProfiles'],
) {
  const { uiState, connection, collections, runner, subscription, setActivityTab, setRunnerCollectionId } = {
    ...foundation,
    setActivityTab: foundation.setActivityTab,
    setRunnerCollectionId: foundation.setRunnerCollectionId,
  };

  const handleExecuteRef = useRef(executionLayer.handleExecute);
  handleExecuteRef.current = executionLayer.handleExecute;

  const { handleRunCollection } = useGraphqlCollectionRun({
    collectionTrees: collections.trees,
    endpoint: tabsLayer.resolvedTabEndpoint,
    skipTlsVerify: tabsLayer.resolvedTabSkipTlsVerify,
    tls: tabsLayer.resolvedTabTls,
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    activeTabHeaders: tabsLayer.activeTabHeaders,
    auth: tabsLayer.resolvedTabAuth,
    globalAuthProfiles: globalAuthProfiles ?? [],
    runner,
    updateVariables: connection.updateVariables,
    onSetRunnerCollectionId: setRunnerCollectionId,
    onSetBottomTab: createSetBottomPanelTab(uiState.setBottomTab),
    onItemExecuted: createMarkCollectionItemExecuted((id) => collections.markItemExecuted(id)),
    endpointLinkPending: tabsLayer.hasPendingProfileEndpoint,
  });

  const itemLoaders = useGqlItemLoaders({
    editorMountRef: tabsLayer.editorActions.editorMountRef,
    onQueryChange: tabsLayer.handleQueryChange,
    onVariablesChange: tabsLayer.handleVariablesChange,
    onSetActivityTab: createSetGqlActivityTab(setActivityTab),
    onSetBuilderMode: uiState.setBuilderMode,
    handleExecuteRef,
    collectionTrees: collections.trees,
  });

  const subscriptionOrchestration = useSubscriptionOrchestration({
    activeTab: tabsLayer.activeTab,
    endpoint: tabsLayer.resolvedTabEndpoint,
    auth: tabsLayer.resolvedTabAuth,
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    activeTabHeaders: tabsLayer.activeTabHeaders,
    selectedOperation: tabsLayer.selectedOperation,
    skipTlsVerify: tabsLayer.resolvedTabSkipTlsVerify,
    tlsCaCert: tabsLayer.resolvedTabTls.caCert,
    tlsClientCert: tabsLayer.resolvedTabTls.clientCert,
    tlsClientKey: tabsLayer.resolvedTabTls.clientKey,
    subscription,
    endpointLinkPending: tabsLayer.hasPendingProfileEndpoint,
    globalAuthProfiles: globalAuthProfiles ?? [],
  });

  const { handleSubscribe } = useGraphqlStudioSubscriptionGuard({
    activeTabId: tabsLayer.activeTabId,
    activeTab: tabsLayer.activeTab,
    subscription,
    onSubscribe: subscriptionOrchestration.handleSubscribe,
    setRightView: uiState.setRightView,
  });

  useGraphqlStudioShortcutsBridge({
    handleExecute: executionLayer.handleExecute,
    handleSubscribe,
    handleStopSubscription: subscriptionOrchestration.handleStopSubscription,
    handleIntrospect: executionLayer.schemaLayer.handleIntrospect,
    introspecting: executionLayer.schemaLayer.introspecting,
    handleCancel: executionLayer.handleCancel,
    addTab: tabsLayer.addTab,
    closeActiveTab: tabsLayer.closeActiveTabRef.current,
    subscriptionState: subscription.state,
    subscriptionDisconnect: subscription.disconnect,
    activeTabOperationType: tabsLayer.activeTab?.operationType,
    execStatus: executionLayer.execStatus,
    endpoint: tabsLayer.resolvedTabEndpoint,
    activeEnvironment: connection.activeEnvironment,
    globalEnvMap: foundation.globalEnvMap,
    profileModalOpen: connection.profileModalOpen,
    envModalOpen: connection.envModalOpen,
    endpointLinkPending: tabsLayer.hasPendingProfileEndpoint,
  });

  const handleDismissComplexityWarning = useMemo(
    () => createHandleDismissComplexityWarning(executionLayer.complexity.setComplexityWarningPending),
    [executionLayer.complexity.setComplexityWarningPending],
  );

  const handleSaveToCollection = useMemo(
    () => createHandleSaveToCollection(collections),
    [collections],
  );

  return {
    handleRunCollection,
    itemLoaders,
    subscriptionOrchestration,
    handleSubscribe,
    handleDismissComplexityWarning,
    handleSaveToCollection,
  };
}

export type GraphqlStudioPageInteractionLayer = ReturnType<typeof useGraphqlStudioPageInteractionLayer>;
