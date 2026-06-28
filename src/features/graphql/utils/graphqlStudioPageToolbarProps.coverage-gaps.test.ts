/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { buildGraphqlStudioPageToolbarProps } from './graphqlStudioPageToolbarProps';
import type { GqlStudioTab } from './tabPersistence';

const activeTab: GqlStudioTab = {
  id: 'tab-1',
  label: 'Q',
  modelUri: 'inmemory://graphql/tab-1',
  query: 'query { hello }',
  variables: '{}',
  headers: [],
  operationType: undefined,
  unsavedChanges: false,
  subscriptionTransport: undefined,
};

const baseInput = {
  tab: {
    activeTab,
    activeTabId: 'tab-1',
    tabs: [activeTab],
    operations: ['Hello'],
    selectedOperation: null as string | null,
    varsError: null,
    queryValidationErrorCount: 0,
    fileEntries: [{ error: null }],
  },
  connection: {
    resolvedTabEndpoint: 'http://localhost/graphql',
    resolvedTabAuth: null,
    resolvedTabSkipTlsVerify: false,
    resolvedTabTls: {},
    resolvedTabPollingEnabled: false,
    resolvedTabPollingIntervalSeconds: 30,
    hasActiveTabEndpointOverride: false,
    hasActiveTabProfileLink: false,
    hasActiveTabPollingOverride: false,
    hasPendingProfileEndpoint: false,
    endpoint: 'http://localhost/graphql',
    pageDefaultEndpointResolved: 'http://localhost/graphql',
    recentEndpoints: [],
    profiles: [],
    activeEnvironment: null,
    globalEnvMap: {},
    endpointProtocolStatus: undefined,
    pollErrorMessage: null,
    globalAuthProfiles: undefined as never,
    authBadgePresentation: { label: 'None', tone: 'muted' as const },
  },
  execution: {
    handleExecute: vi.fn(),
    handleCancel: vi.fn(),
    isActiveTabExecuting: false,
    handleSubscribe: vi.fn(),
    handleStopSubscription: vi.fn(),
    handleSelectOperation: vi.fn(),
    handleSubscriptionTransportChange: vi.fn(),
    subscriptionState: 'idle' as const,
    complexityResult: null,
    activeTabApqInfo: undefined,
  },
  schema: {
    connectionBarSchemaStatus: 'none' as const,
    schemaInfo: null,
    introspecting: false,
    handleIntrospect: vi.fn(),
  },
  connectionHandlers: {
    handleConnectionEndpointChange: vi.fn(),
    clearActiveTabEndpoint: vi.fn(),
    handleConnectionSkipTlsChange: vi.fn(),
    handleConnectionTlsChange: vi.fn(),
    handleConnectionPollingChange: vi.fn(),
    clearActiveTabPolling: vi.fn(),
    removeRecentEndpoint: vi.fn(),
    focusAuthPanel: vi.fn(),
  },
  batch: {
    advSettings: {
      apqEnabled: false,
      apqUseGet: false,
      apqUnsupportedDetected: false,
      batchEnabled: true,
      batchTimeoutMs: 30000,
      batchUnsupportedDetected: false,
      dedupEnabled: true,
      complexityBlockEnabled: false,
      complexityBlockThreshold: 1000,
    },
    advSettingsOpen: false,
    advSettingsBtnRef: { current: null },
    setAdvSettingsOpen: vi.fn(),
    batchSettingsProps: { batchedTabIds: new Set(['tab-1']), onToggleTab: vi.fn() },
    batchSummaryLabel: '1 tab',
    batchExecuting: false,
    batchEndpointMismatch: false,
    batchEndpointReady: true,
    batchProfileLinkPending: false,
    effectiveBatchedTabs: [activeTab],
    handleSendBatch: vi.fn(),
    handleAdvSettingsSave: vi.fn(),
    handleAdvSettingsCancel: vi.fn(),
  },
  dialogs: {
    complexityGatePending: false,
    complexityResult: null,
    pendingExecuteAfterGateRef: { current: null },
    sessionBypassComplexityGateRef: { current: false },
    skipComplexityGateRef: { current: false },
    setComplexityGatePending: vi.fn(),
    setComplexityWarningPending: vi.fn(),
    isDuplicate: false,
    duplicateSourceTabId: null,
    resolveDedupChoice: vi.fn(),
  },
  modals: {
    profileModalOpen: false,
    setProfileModalOpen: vi.fn(),
    envModalOpen: false,
    setEnvModalOpen: vi.fn(),
    saveProfile: vi.fn(),
    deleteProfile: vi.fn(),
    clearConnectionIdsForProfile: vi.fn(),
    applyProfileToActiveTab: vi.fn(),
    prevBaseUrlRef: { current: null },
    createEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    setActiveEnvironment: vi.fn(),
    updateEnvironmentName: vi.fn(),
    updateVariables: vi.fn(),
    importEnvironment: vi.fn(),
    exportEnvironment: vi.fn(),
    environments: [],
  },
};

describe('buildGraphqlStudioPageToolbarProps — coverage gaps', () => {
  it('defaults optional tab and connection fields', () => {
    const sections = buildGraphqlStudioPageToolbarProps(baseInput);
    expect(sections.connectionBar.selectedOperation).toBeUndefined();
    expect(sections.connectionBar.subscriptionTransport).toBe('auto');
    expect(sections.connectionBar.activeOperationType).toBeNull();
    expect(sections.connectionBar.globalAuthProfiles).toBeUndefined();
    expect(sections.advancedSettings.batchSettings).toBeNull();
  });

  it('includes batch settings when advanced settings panel is open', () => {
    const sections = buildGraphqlStudioPageToolbarProps({
      ...baseInput,
      tab: {
        ...baseInput.tab,
        selectedOperation: 'Hello',
        fileEntries: [{ error: 'bad' }],
        varsError: 'invalid json',
      },
      connection: {
        ...baseInput.connection,
        globalAuthProfiles: [{ id: 'g1', name: 'Global', type: 'bearer', token: 't' } as never],
        activeEnvironment: { id: 'e1', name: 'Dev', variables: [] },
      },
      batch: {
        ...baseInput.batch,
        advSettingsOpen: true,
      },
      execution: {
        ...baseInput.execution,
        activeTabApqInfo: { cacheHit: true, hash: 'abc', unsupported: true },
      },
    });
    expect(sections.connectionBar.varsInvalid).toBe(true);
    expect(sections.connectionBar.fileErrors).toBe(true);
    expect(sections.connectionBar.selectedOperation).toBe('Hello');
    expect(sections.connectionBar.activeEnvName).toBe('Dev');
    expect(sections.connectionBar.apqCacheHit).toBe(true);
    expect(sections.advancedSettings.batchSettings).not.toBeNull();
    expect(sections.dialogs.connectionModals.onDeleteProfile).toBeTypeOf('function');
    sections.dialogs.connectionModals.onDeleteProfile('p1');
    expect(baseInput.modals.deleteProfile).toHaveBeenCalledWith('p1');
    expect(baseInput.modals.clearConnectionIdsForProfile).toHaveBeenCalledWith('p1');
  });
});
