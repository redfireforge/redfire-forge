/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { buildGraphqlStudioPageBodyProps } from './buildGraphqlStudioPageBodyProps';

vi.mock('../utils/graphqlStudioPageToolbarProps', () => ({
  buildGraphqlStudioPageToolbarProps: vi.fn(() => ({
    connectionBar: {},
    editorToolbar: {},
    batchToolbar: {},
  })),
}));

const activeTab = {
  id: 'tab-1',
  name: 'Tab 1',
  query: 'query { x }',
  variables: '{}',
  headers: [],
  operationType: 'query' as const,
  modelUri: 'uri-1',
  responseSubTab: 'body' as const,
  subscriptionAssertions: [],
};

function makeLayers(overrides: {
  batchExecuting?: boolean;
  batchedTabIdsSet?: Set<string>;
} = {}) {
  const foundation = {
    uiState: {
      builderMode: 'editor',
      bottomTab: 'response',
      setBottomTab: vi.fn(),
      rightView: 'response',
      setRightView: vi.fn(),
      fileEntries: [],
      setFileEntries: vi.fn(),
      focusAuthPanel: vi.fn(),
    },
    splitPanes: {
      gqlActivitySplitRef: { current: null },
      activityPanelWidth: 280,
      activityDividerProps: {},
      gqlSplitRef: { current: null },
      gqlLeftPaneRef: { current: null },
      editorPaneWidth: 600,
      gqlPaneDividerProps: {},
      bottomPanelDividerProps: {},
      bottomPanelHeight: 200,
    },
    activityTab: 'history',
    setActivityTab: vi.fn(),
    runnerCollectionId: null,
    historyMaxItems: 100,
    handleHistoryMaxItemsChange: vi.fn(),
    connection: {
      endpoint: 'http://localhost:4010/graphql',
      activeEnvironment: null,
      profiles: [],
      profileModalOpen: false,
      setProfileModalOpen: vi.fn(),
      envModalOpen: false,
      setEnvModalOpen: vi.fn(),
      saveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      prevBaseUrlRef: { current: null },
      environments: [],
      createEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      setActiveEnvironment: vi.fn(),
      updateEnvironmentName: vi.fn(),
      updateVariables: vi.fn(),
      importEnvironment: vi.fn(),
      exportEnvironment: vi.fn(),
      upsertEnvironment: vi.fn(),
      deleteEnvironmentByName: vi.fn(),
      removeRecentEndpoint: vi.fn(),
    },
    collections: { trees: [] },
    runner: {},
    subscription: { state: 'idle', messages: [], disconnect: vi.fn() },
    globalEnvMap: {},
    pageDefaultEndpointResolved: 'http://localhost:4010/graphql',
    setSaveToColItem: vi.fn(),
    saveToColItem: null,
    endpointProtocolStatus: 'http',
  };

  const tabsLayer = {
    activeTab,
    activeTabId: 'tab-1',
    tabs: [activeTab],
    operations: [],
    selectedOperation: null,
    resolvedTabEndpoint: 'http://localhost:4010/graphql',
    resolvedTabAuth: null,
    resolvedTabSkipTlsVerify: false,
    resolvedTabTls: { caCert: '', clientCert: '', clientKey: '' },
    resolvedTabPollingEnabled: false,
    resolvedTabPollingIntervalSeconds: 30,
    hasActiveTabEndpointOverride: false,
    hasActiveTabProfileLink: false,
    hasActiveTabPollingOverride: false,
    hasPendingProfileEndpoint: false,
    hasActiveTabAuthOverride: false,
    authBadgePresentation: {},
    connectionHandlers: {
      handleConnectionEndpointChange: vi.fn(),
      handleConnectionSkipTlsChange: vi.fn(),
      handleConnectionTlsChange: vi.fn(),
      handleConnectionPollingChange: vi.fn(),
      handleConnectionAuthChange: vi.fn(),
    },
    clearActiveTabEndpoint: vi.fn(),
    clearActiveTabPolling: vi.fn(),
    clearActiveTabAuth: vi.fn(),
    clearConnectionIdsForProfile: vi.fn(),
    applyProfileToActiveTab: vi.fn(),
    handleDemoSetGqlQuery: vi.fn(),
    handleQueryChange: vi.fn(),
    handleVariablesChange: vi.fn(),
    handleHeadersChange: vi.fn(),
    handleAssertionsChange: vi.fn(),
    handleSelectOperation: vi.fn(),
    handleSubscriptionTransportChange: vi.fn(),
    handleTabClick: vi.fn(),
    closeTab: vi.fn(),
    addTab: vi.fn(),
    renameTab: vi.fn(),
    updateActiveTab: vi.fn(),
    tabSchemaConnectionId: 'http://localhost:4010/graphql',
    storedAuthForPanel: null,
    resolvedAuthPreview: '',
    usesPageDefaultAuth: true,
    linkedProfileName: null,
    defaultAuthProfileId: null,
    editorActions: {
      editorMountRef: { current: null },
      prettifyError: null,
      handlePrettify: vi.fn(),
      insertToast: null,
      handleInsertField: vi.fn(),
    },
  };

  const executionLayer = {
    history: { items: [], recentItems: [], saveHistory: vi.fn(), deleteItem: vi.fn(), clearAll: vi.fn(), search: vi.fn(), loading: false },
    execution: { executionLayers: null, resolveDedupChoice: vi.fn() },
    advancedSettings: {
      advSettings: {},
      advSettingsOpen: false,
      advSettingsBtnRef: { current: null },
      setAdvSettingsOpen: vi.fn(),
      handleAdvSettingsChange: vi.fn(),
      setBatchUnsupportedToast: vi.fn(),
      apqUnsupportedToast: null,
      setApqUnsupportedToast: vi.fn(),
      batchUnsupportedToast: null,
    },
    schemaLayer: {
      mockServer: null,
      schemaInfo: null,
      invalidItemIds: new Set<string>(),
      schemaStatus: 'idle',
      schemaErrorMessage: null,
      handleIntrospect: vi.fn(),
      introspecting: false,
      connectionBarSchemaStatus: 'idle',
      pollErrorMessage: null,
      snapshots: [],
      handleSaveSnapshot: vi.fn(),
      handleDeleteSnapshot: vi.fn(),
      handleClearOlderSnapshots: vi.fn(),
      handleOpenDiff: vi.fn(),
      deprecatedUsages: [],
      schemaDiffToast: null,
      setSchemaDiffToast: vi.fn(),
      diffModal: null,
      setDiffModal: vi.fn(),
      handleAcknowledge: vi.fn(),
      handleUnacknowledge: vi.fn(),
      toastBaselineSnapshotIdRef: { current: null },
    },
    batchLayer: {
      batchExecuting: overrides.batchExecuting ?? false,
      batchedTabIdsSet: overrides.batchedTabIdsSet ?? new Set<string>(),
      batchEndpointMismatch: false,
      batchEndpointReady: true,
      batchProfileLinkPending: false,
      effectiveBatchedTabs: [],
      handleSendBatch: vi.fn(),
      batchResult: null,
      batchResultsOpen: false,
      dismissBatchResults: vi.fn(),
      openBatchResults: vi.fn(),
      complexityGatePending: false,
      pendingExecuteAfterGateRef: { current: null },
      sessionBypassComplexityGateRef: { current: false },
      skipComplexityGateRef: { current: false },
      setComplexityGatePending: vi.fn(),
    },
    batchAdvSettings: {
      batchSettingsProps: {},
      batchSummaryLabel: '',
      handleAdvSettingsSave: vi.fn(),
      handleAdvSettingsCancel: vi.fn(),
    },
    handleExecute: vi.fn(),
    handleCancel: vi.fn(),
    handleResponseSubTabChange: vi.fn(),
    activeTabUploadProgress: null,
    responsePaneState: { response: null, executing: false, execStatus: 'idle' },
    queryValidationErrorCount: 0,
    complexity: { complexityResult: null, complexityWarningPending: false, setComplexityWarningPending: vi.fn() },
    varsError: null,
    assertionResultMap: {},
    activeTabApqInfo: null,
    isDuplicate: false,
    duplicateSourceTabId: null,
  };

  const interactionLayer = {
    handleRunCollection: vi.fn(),
    itemLoaders: {
      handleLoadHistoryItem: vi.fn(),
      handleRunHistoryItem: vi.fn(),
      handleLoadCollectionItem: vi.fn(),
      handleEditInEditor: vi.fn(),
      handleBuilderExecute: vi.fn(),
      handleOpenCollectionItem: vi.fn(),
    },
    subscriptionOrchestration: {
      handleStopSubscription: vi.fn(),
      handleExportSubscription: vi.fn(),
    },
    handleSubscribe: vi.fn(),
    handleDismissComplexityWarning: vi.fn(),
    handleSaveToCollection: vi.fn(),
  };

  return { foundation, tabsLayer, executionLayer, interactionLayer };
}

describe('buildGraphqlStudioPageBodyProps — coverage gaps', () => {
  it('sets batchExecutingOnActiveTab when active tab is in batch set', () => {
    const layers = makeLayers({
      batchExecuting: true,
      batchedTabIdsSet: new Set(['tab-1']),
    });
    const props = buildGraphqlStudioPageBodyProps({
      ...layers,
      globalAuthProfiles: [],
    });
    expect(props.main.batchExecutingOnActiveTab).toBe(true);
  });

  it('leaves batchExecutingOnActiveTab false when tab is not batched', () => {
    const layers = makeLayers({
      batchExecuting: true,
      batchedTabIdsSet: new Set(['other-tab']),
    });
    const props = buildGraphqlStudioPageBodyProps({
      ...layers,
      globalAuthProfiles: [],
    });
    expect(props.main.batchExecutingOnActiveTab).toBe(false);
  });

  it('sets onOpenBatchResults when batchResult is present', () => {
    const layers = makeLayers();
    layers.executionLayer.batchLayer.batchResult = { results: [] } as never;
    layers.executionLayer.batchLayer.openBatchResults = vi.fn();
    const props = buildGraphqlStudioPageBodyProps({
      ...layers,
      globalAuthProfiles: undefined,
    });
    expect(props.main.onOpenBatchResults).toBe(layers.executionLayer.batchLayer.openBatchResults);
  });

  it('omits onOpenBatchResults when batchResult is null', () => {
    const layers = makeLayers();
    layers.executionLayer.batchLayer.batchResult = null;
    const props = buildGraphqlStudioPageBodyProps({
      ...layers,
      globalAuthProfiles: [],
    });
    expect(props.main.onOpenBatchResults).toBeUndefined();
  });

  it('leaves batchExecutingOnActiveTab false when activeTabId is null', () => {
    const layers = makeLayers({
      batchExecuting: true,
      batchedTabIdsSet: new Set(['tab-1']),
    });
    layers.tabsLayer.activeTabId = null as unknown as string;
    const props = buildGraphqlStudioPageBodyProps({
      ...layers,
      globalAuthProfiles: [],
    });
    expect(props.main.batchExecutingOnActiveTab).toBe(false);
  });
});
