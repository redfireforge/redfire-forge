/**
 * Tabs + per-tab connection resolution, auth presentation, editor actions.
 */
import { useMemo } from 'react';
import { findProfileById } from '../utils/tabConnectionResolution';
import {
  buildActiveTabHeaderMap,
  buildGraphqlSchemaHeaders,
  describeEnvResolvedAuthPreview,
} from '../utils/graphqlStudioEnvUtils';
import { resolveGqlAuthBadgePresentation } from '../utils/authUtils';
import {
  resolveStoredAuthForPanel,
  resolveUsesPageDefaultAuth,
} from '../utils/graphqlStudioPagePanelAuth';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import { resolveVars } from '../utils/envUtils';
import { useGqlStudioTabs } from './useGqlStudioTabs';
import { useGqlActiveTabConnection } from './useGqlActiveTabConnection';
import { useGqlTabConnectionHandlers } from './useGqlTabConnectionHandlers';
import { useGqlStudioEditorActions } from './useGqlStudioEditorActions';
import { useDemoGqlModalLockBridge } from './useDemoGqlModalLockBridge';
import {
  createTabsExecutionCallbacks,
  createUpdateLinkedProfileAuth,
  createHandleDemoSetGqlQuery,
} from './studioPageCompositionUtils';
import type { GraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';
import type { GraphqlStudioPageProps } from '../graphqlStudioPageTypes';

export function useGraphqlStudioPageTabsLayer(
  foundation: GraphqlStudioPageFoundation,
  props: Pick<GraphqlStudioPageProps, 'globalAuthProfiles' | 'selectedSvc' | 'selectedEnvId'>,
) {
  const { globalAuthProfiles, selectedSvc, selectedEnvId } = props;
  const {
    uiState: { setFileEntries },
    connection,
    pageDefaultEndpointResolved,
    responseCacheLayer: { removeTabFromCache, setTabUploadProgress },
    subscription,
    monacoRef,
    cancelTabRef,
    isTabExecutingRef,
    executingRef,
  } = foundation;

  const tabExecutionCallbacks = createTabsExecutionCallbacks(
    setTabUploadProgress,
    cancelTabRef,
    isTabExecutingRef,
  );

  const tabsBundle = useGqlStudioTabs({
    ...tabExecutionCallbacks,
    onClearFileEntries: () => setFileEntries([]),
    onResetSubscription: () => subscription.reset(),
    monacoRef: monacoRef as React.MutableRefObject<import('@monaco-editor/react').Monaco | null>,
    pageDefaultEndpoint: connection.endpoint,
    pageDefaultEndpointResolved,
    pageDefaultSkipTlsVerify: connection.skipTlsVerify,
    pageDefaultTlsCaCert: connection.tlsCaCert,
    pageDefaultTlsClientCert: connection.tlsClientCert,
    pageDefaultTlsClientKey: connection.tlsClientKey,
    pageDefaultPollingEnabled: connection.pollingEnabled,
    pageDefaultPollingIntervalSeconds: connection.pollingIntervalSeconds,
    pageDefaultAuth: connection.auth,
    profiles: connection.profiles,
    profilesReady: connection.profilesReady,
    onTabClosed: removeTabFromCache,
  });

  const activeTabConnection = useGqlActiveTabConnection({
    activeTab: tabsBundle.activeTab,
    profiles: connection.profiles,
    endpoint: connection.endpoint,
    auth: connection.auth,
    skipTlsVerify: connection.skipTlsVerify,
    tlsCaCert: connection.tlsCaCert,
    tlsClientCert: connection.tlsClientCert,
    tlsClientKey: connection.tlsClientKey,
    pollingEnabled: connection.pollingEnabled,
    pollingIntervalSeconds: connection.pollingIntervalSeconds,
  });

  const linkedProfileName = activeTabConnection.activeTabConnection?.profileName ?? null;
  const linkedProfile = findProfileById(connection.profiles, tabsBundle.activeTab?.connectionId);
  const defaultAuthProfileId = selectedSvc?.authProfileIds?.[selectedEnvId ?? ''] ?? null;

  const updateLinkedProfileAuth = useMemo(
    () => createUpdateLinkedProfileAuth(connection.updateProfile),
    [connection.updateProfile],
  );

  const connectionHandlers = useGqlTabConnectionHandlers({
    tabsLength: tabsBundle.tabs.length,
    hasActiveTabEndpointOverride: tabsBundle.hasActiveTabEndpointOverride,
    hasActiveTabProfileLink: tabsBundle.hasActiveTabProfileLink,
    hasActiveTabAuthOverride: tabsBundle.hasActiveTabAuthOverride,
    hasActiveTabConnectionId: Boolean(tabsBundle.activeTab?.connectionId),
    activeConnectionId: tabsBundle.activeTab?.connectionId ?? null,
    hasActiveTabSkipTlsOverride: tabsBundle.hasActiveTabSkipTlsOverride,
    hasActiveTabTlsCertOverride: tabsBundle.hasActiveTabTlsCertOverride,
    hasActiveTabPollingOverride: tabsBundle.hasActiveTabPollingOverride,
    setEndpoint: connection.setEndpoint,
    updateActiveTabEndpoint: tabsBundle.updateActiveTabEndpoint,
    handleSkipTlsVerifyChange: connection.handleSkipTlsVerifyChange,
    handleTlsCertsChange: connection.handleTlsCertsChange,
    updateActiveTabSkipTlsVerify: tabsBundle.updateActiveTabSkipTlsVerify,
    updateActiveTabTlsSettings: tabsBundle.updateActiveTabTlsSettings,
    handlePollingChange: connection.handlePollingChange,
    updateActiveTabPolling: tabsBundle.updateActiveTabPolling,
    handleAuthChange: connection.handleAuthChange,
    updateActiveTabAuth: tabsBundle.updateActiveTabAuth,
    updateLinkedProfileAuth,
    clearActiveTabAuth: tabsBundle.clearActiveTabAuth,
  });

  const usesPageDefaultAuth = resolveUsesPageDefaultAuth(
    tabsBundle.tabs.length,
    tabsBundle.hasActiveTabAuthOverride,
    tabsBundle.hasActiveTabProfileLink,
  );

  const storedAuthForPanel = resolveStoredAuthForPanel(
    usesPageDefaultAuth,
    connection.auth,
    tabsBundle.activeTab?.auth !== undefined,
    tabsBundle.activeTab?.auth,
    linkedProfile?.auth,
  );

  const authBadgePresentation = useMemo(
    () => resolveGqlAuthBadgePresentation({
      resolvedAuth: activeTabConnection.resolvedTabAuth,
      hasTabAuthOverride: tabsBundle.hasActiveTabAuthOverride,
      hasProfileLink: tabsBundle.hasResolvedProfileLink,
      usesPageDefaultAuth,
      linkedProfileName,
      globalAuthProfiles: globalAuthProfiles ?? [],
      tabsLength: tabsBundle.tabs.length,
    }),
    [
      activeTabConnection.resolvedTabAuth,
      tabsBundle.hasActiveTabAuthOverride,
      tabsBundle.hasResolvedProfileLink,
      usesPageDefaultAuth,
      linkedProfileName,
      globalAuthProfiles,
      tabsBundle.tabs.length,
    ],
  );

  const resolvedAuthPreview = useMemo(
    () => describeEnvResolvedAuthPreview(
      activeTabConnection.resolvedTabAuth,
      connection.activeEnvironment,
      foundation.globalEnvMap,
      globalAuthProfiles ?? [],
    ),
    [
      activeTabConnection.resolvedTabAuth,
      connection.activeEnvironment,
      foundation.globalEnvMap,
      globalAuthProfiles,
    ],
  );

  const editorActions = useGqlStudioEditorActions({
    activeQuery: tabsBundle.activeTab?.query ?? '',
    onQueryChange: tabsBundle.handleQueryChange,
  });

  const handleDemoSetGqlQuery = useMemo(
    () => createHandleDemoSetGqlQuery(editorActions.editorMountRef, tabsBundle.handleQueryChange),
    [editorActions.editorMountRef, tabsBundle.handleQueryChange],
  );

  useDemoGqlModalLockBridge({
    envModalOpen: connection.envModalOpen,
    profileModalOpen: connection.profileModalOpen,
    setEnvModalOpen: connection.setEnvModalOpen,
    setProfileModalOpen: connection.setProfileModalOpen,
  });

  const activeTabForHeaders = tabsBundle.tabs.find((t) => t.id === tabsBundle.activeTabId) ?? tabsBundle.tabs[0];
  const activeTabHeaders = useMemo(
    () => buildActiveTabHeaderMap(activeTabForHeaders?.headers),
    [activeTabForHeaders],
  );

  const schemaHeaders = useMemo(
    () => buildGraphqlSchemaHeaders(
      activeTabConnection.resolvedTabAuth,
      activeTabHeaders,
      connection.activeEnvironment,
      foundation.globalEnvMap,
      globalAuthProfiles ?? [],
    ),
    [
      activeTabConnection.resolvedTabAuth,
      activeTabHeaders,
      connection.activeEnvironment,
      foundation.globalEnvMap,
      globalAuthProfiles,
    ],
  );

  const resolvedTabEndpointForSchema = useMemo(
    () => normalizeGraphqlEndpoint(
      resolveVars(tabsBundle.resolvedTabEndpoint, connection.activeEnvironment, foundation.globalEnvMap),
    ),
    [tabsBundle.resolvedTabEndpoint, connection.activeEnvironment, foundation.globalEnvMap],
  );

  const tabSchemaConnectionId = resolvedTabEndpointForSchema || connection.historyConnectionId;

  return {
    ...tabsBundle,
    ...activeTabConnection,
    linkedProfileName,
    linkedProfile,
    defaultAuthProfileId,
    connectionHandlers,
    usesPageDefaultAuth,
    storedAuthForPanel,
    authBadgePresentation,
    resolvedAuthPreview,
    editorActions,
    handleDemoSetGqlQuery,
    activeTabHeaders,
    schemaHeaders,
    resolvedTabEndpointForSchema,
    tabSchemaConnectionId,
    executingRef,
  };
}

export type GraphqlStudioPageTabsLayer = ReturnType<typeof useGraphqlStudioPageTabsLayer>;
