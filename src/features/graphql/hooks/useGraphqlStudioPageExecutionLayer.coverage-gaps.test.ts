/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGraphqlStudioPageExecutionLayer } from './useGraphqlStudioPageExecutionLayer';
import { useGraphqlBatchExecution } from './useGraphqlBatchExecution';

const saveHistory = vi.fn();
const execute = vi.fn();
const cancel = vi.fn();
const cancelTab = vi.fn();
const isTabExecuting = vi.fn(() => false);
const resolveDedupChoice = vi.fn();
const applyTabResult = vi.fn();
const handleIntrospect = vi.fn();
const setComplexityWarningPending = vi.fn();
const setComplexityGatePending = vi.fn();

vi.mock('./useGraphqlHistory', () => ({
  useGraphqlHistory: vi.fn(() => ({
    items: [],
    recentItems: [],
    saveHistory,
    deleteItem: vi.fn(),
    clearAll: vi.fn(),
    search: vi.fn(() => []),
    loading: false,
  })),
}));

vi.mock('./useGqlExecutionCompletedHandler', () => ({
  useGqlExecutionCompletedHandler: vi.fn(() => vi.fn()),
}));

vi.mock('./useGraphqlStudioTabExecution', () => ({
  useGraphqlStudioTabExecution: vi.fn(() => ({
    activeState: {
      status: 'idle',
      response: null,
      apqInfo: null,
      isDuplicate: false,
      duplicateSourceTabId: null,
    },
    cancelTab,
    isTabExecuting,
    cancel,
    execute,
    applyTabResult,
    resolveDedupChoice,
    executionLayers: null,
  })),
}));

vi.mock('./useGraphqlAdvancedSettings', () => ({
  useGraphqlAdvancedSettings: vi.fn(() => ({
    advSettings: {},
    advSettingsRef: { current: {} },
    setAdvSettings: vi.fn(),
    advSettingsOpen: false,
    advSettingsBtnRef: { current: null },
    setAdvSettingsOpen: vi.fn(),
    handleAdvSettingsChange: vi.fn(),
    setBatchUnsupportedToast: vi.fn(),
    apqUnsupportedToast: null,
    setApqUnsupportedToast: vi.fn(),
    batchUnsupportedToast: null,
  })),
}));

vi.mock('./useGraphqlBatchExecution', () => ({
  useGraphqlBatchExecution: vi.fn(() => ({
    batchExecuting: false,
    batchedTabIdsSet: new Set<string>(),
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
    setComplexityGatePending,
    batchTabOverrides: {},
    activeBatchGroupKey: null,
    setBatchTabOverrides: vi.fn(),
    handleSetActiveBatchGroup: vi.fn(),
    batchGroups: [],
    handleToggleBatch: vi.fn(),
    activeBatchGroup: null,
  })),
}));

vi.mock('./useGraphqlStudioSchemaLayer', () => ({
  useGraphqlStudioSchemaLayer: vi.fn(() => ({
    mockServer: null,
    schemaInfo: null,
    invalidItemIds: new Set<string>(),
    schemaStatus: 'idle',
    schemaErrorMessage: null,
    handleIntrospect,
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
    rawIntrospection: null,
  })),
}));

vi.mock('./useMonacoExecutionMarkers', () => ({
  useMonacoExecutionMarkers: vi.fn(),
}));

vi.mock('./useQueryValidation', () => ({
  useQueryValidation: vi.fn(() => 0),
}));

vi.mock('./useGraphqlStudioQueryComplexity', () => ({
  useGraphqlStudioQueryComplexity: vi.fn(() => ({
    complexityResult: null,
    complexityWarningPending: false,
    setComplexityWarningPending,
  })),
}));

vi.mock('./useGqlVariablesValidation', () => ({
  useGqlVariablesValidation: vi.fn(() => null),
}));

vi.mock('./useGraphqlStudioBatchAdvSettings', () => ({
  useGraphqlStudioBatchAdvSettings: vi.fn(() => ({
    batchSettingsProps: {},
    batchSummaryLabel: '',
    handleAdvSettingsSave: vi.fn(),
    handleAdvSettingsCancel: vi.fn(),
  })),
}));

vi.mock('./useGraphqlStudioExecute', () => ({
  useGraphqlStudioExecute: vi.fn(() => vi.fn()),
}));

const foundation = {
  connection: {
    endpoint: 'http://localhost:4010/graphql',
    auth: null,
    skipTlsVerify: false,
    tlsCaCert: '',
    tlsClientCert: '',
    tlsClientKey: '',
    pollingEnabled: false,
    pollingIntervalSeconds: 30,
    historyConnectionId: 'http://localhost:4010/graphql',
    pushRecentEndpoint: vi.fn(),
  },
  responseCacheLayer: {
    cacheExecutionResult: vi.fn(),
    setTabUploadProgress: vi.fn(),
    responseCache: new Map<string, unknown>(),
    resolvePaneState: vi.fn(() => ({ response: null, executing: false, execStatus: 'idle' as const })),
  },
  subscription: { messages: [], state: 'idle', disconnect: vi.fn() },
  monacoInstance: null,
  responseModelUriRef: { current: '' },
  cancelTabRef: { current: vi.fn() },
  isTabExecutingRef: { current: vi.fn(() => false) },
  executingRef: { current: false },
  uiState: { setRightView: vi.fn(), fileEntries: [] },
  collections: { trees: [] },
  historyMaxItems: 100,
  globalEnvMap: {},
  pageDefaultEndpointResolved: 'http://localhost:4010/graphql',
};

const tabsLayer = {
  tabs: [{
    id: 'tab-1',
    query: 'query { x }',
    variables: '{}',
    modelUri: 'uri-1',
    subscriptionAssertions: [],
  }],
  activeTabId: 'tab-1',
  activeTab: {
    id: 'tab-1',
    query: 'query { x }',
    variables: '{}',
    modelUri: 'uri-1',
    subscriptionAssertions: [],
  },
  activeDemoLessonId: null,
  resolvedTabEndpoint: 'http://localhost:4010/graphql',
  resolvedTabAuth: null,
  resolvedTabSkipTlsVerify: false,
  resolvedTabTls: { caCert: '', clientCert: '', clientKey: '' },
  resolvedTabPollingIntervalMs: 30_000,
  hasPendingProfileEndpoint: false,
  hasActiveTabEndpointOverride: false,
  tabSchemaConnectionId: 'http://localhost:4010/graphql',
  resolvedTabEndpointForSchema: 'http://localhost:4010/graphql',
  schemaHeaders: {},
  updateActiveTab: vi.fn(),
  selectedOperation: null,
  activeTabHeaders: {},
  editorActions: { editorMountRef: { current: null } },
};

describe('useGraphqlStudioPageExecutionLayer — coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('wires execution refs and exposes response pane state', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioPageExecutionLayer(foundation as never, tabsLayer as never, []),
    );
    expect(result.current.history.saveHistory).toBe(saveHistory);
    expect(result.current.executing).toBe(false);
    expect(result.current.responsePaneState.execStatus).toBe('idle');
    expect(result.current.handleExecute).toBeDefined();
    expect(result.current.handleCancel).toBeDefined();
    expect(foundation.executingRef.current).toBe(false);
    expect(foundation.cancelTabRef.current).toBe(cancelTab);
  });

  it('marks response pane executing when batch is active on tab', () => {
    vi.mocked(useGraphqlBatchExecution).mockReturnValueOnce({
      batchExecuting: true,
      batchedTabIdsSet: new Set(['tab-1']),
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
      setComplexityGatePending,
      batchTabOverrides: {},
      activeBatchGroupKey: null,
      setBatchTabOverrides: vi.fn(),
      handleSetActiveBatchGroup: vi.fn(),
      batchGroups: [],
      handleToggleBatch: vi.fn(),
      activeBatchGroup: null,
    });
    const { result } = renderHook(() =>
      useGraphqlStudioPageExecutionLayer(foundation as never, tabsLayer as never, undefined),
    );
    expect(result.current.responsePaneState.executing).toBe(true);
  });

  it('uses safe fallbacks when active tab is unavailable', () => {
    const sparseTabsLayer = {
      ...tabsLayer,
      activeTabId: null,
      activeTab: undefined,
      selectedOperation: undefined,
    };

    const { result } = renderHook(() =>
      useGraphqlStudioPageExecutionLayer(foundation as never, sparseTabsLayer as never, undefined),
    );

    expect(result.current.queryValidationErrorCount).toBe(0);
    expect(result.current.varsError).toBeNull();
    expect(result.current.assertionResultMap).toBeInstanceOf(Map);
  });
});
