/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGraphqlStudioPageTabsLayer } from './useGraphqlStudioPageTabsLayer';
import { useGqlStudioTabs } from './useGqlStudioTabs';
import { useGqlActiveTabConnection } from './useGqlActiveTabConnection';

const activeTab = {
  id: 'tab-1',
  name: 'Tab 1',
  query: 'query { x }',
  variables: '{}',
  headers: [{ key: 'X-Test', value: '1', enabled: true }],
  operationType: 'query' as const,
  modelUri: 'uri-1',
  responseSubTab: 'body' as const,
  subscriptionAssertions: [],
  connectionId: 'profile-1',
};

const tabsBundle = {
  activeTab,
  activeTabId: 'tab-1',
  tabs: [activeTab],
  operations: [],
  selectedOperation: null,
  resolvedTabEndpoint: 'http://localhost:4010/graphql',
  hasActiveTabEndpointOverride: false,
  hasActiveTabProfileLink: true,
  hasActiveTabAuthOverride: false,
  hasActiveTabSkipTlsOverride: false,
  hasActiveTabTlsCertOverride: false,
  hasActiveTabPollingOverride: false,
  hasPendingProfileEndpoint: false,
  hasResolvedProfileLink: true,
  confirmingCloseTabId: null,
  activeDemoLessonId: null,
  updateActiveTabEndpoint: vi.fn(),
  updateActiveTabSkipTlsVerify: vi.fn(),
  updateActiveTabTlsSettings: vi.fn(),
  updateActiveTabPolling: vi.fn(),
  updateActiveTabAuth: vi.fn(),
  clearActiveTabEndpoint: vi.fn(),
  clearActiveTabPolling: vi.fn(),
  clearActiveTabAuth: vi.fn(),
  clearConnectionIdsForProfile: vi.fn(),
  applyProfileToActiveTab: vi.fn(),
  handleQueryChange: vi.fn(),
  handleVariablesChange: vi.fn(),
  handleHeadersChange: vi.fn(),
  handleAssertionsChange: vi.fn(),
  handleSelectOperation: vi.fn(),
  handleSubscriptionTransportChange: vi.fn(),
  handleTabClick: vi.fn(),
  closeTab: vi.fn(),
  closeActiveTabRef: { current: vi.fn() },
  addTab: vi.fn(),
  renameTab: vi.fn(),
  updateActiveTab: vi.fn(),
};

vi.mock('./useGqlStudioTabs', () => ({
  useGqlStudioTabs: vi.fn(() => tabsBundle),
}));

vi.mock('./useGqlActiveTabConnection', () => ({
  useGqlActiveTabConnection: vi.fn(() => ({
    activeTabConnection: { profileName: 'Local' },
    resolvedTabAuth: { type: 'none' },
    resolvedTabSkipTlsVerify: false,
    resolvedTabTls: { caCert: '', clientCert: '', clientKey: '' },
    resolvedTabPollingEnabled: false,
    resolvedTabPollingIntervalSeconds: 30,
    resolvedTabPollingIntervalMs: 30_000,
  })),
}));

vi.mock('./useGqlTabConnectionHandlers', () => ({
  useGqlTabConnectionHandlers: vi.fn(() => ({
    handleConnectionEndpointChange: vi.fn(),
    handleConnectionSkipTlsChange: vi.fn(),
    handleConnectionTlsChange: vi.fn(),
    handleConnectionPollingChange: vi.fn(),
    handleConnectionAuthChange: vi.fn(),
  })),
}));

vi.mock('./useGqlStudioEditorActions', () => ({
  useGqlStudioEditorActions: vi.fn(() => ({
    editorMountRef: { current: null },
    prettifyError: null,
    handlePrettify: vi.fn(),
    insertToast: null,
    handleInsertField: vi.fn(),
  })),
}));

vi.mock('./useDemoGqlModalLockBridge', () => ({
  useDemoGqlModalLockBridge: vi.fn(),
}));

const foundation = {
  uiState: { setFileEntries: vi.fn() },
  connection: {
    endpoint: 'http://localhost:4010/graphql',
    skipTlsVerify: false,
    tlsCaCert: '',
    tlsClientCert: '',
    tlsClientKey: '',
    pollingEnabled: false,
    pollingIntervalSeconds: 30,
    auth: null,
    profiles: [{ id: 'profile-1', name: 'Local', endpoint: 'http://x', createdAt: 1, auth: { type: 'none' } }],
    profilesReady: true,
    activeEnvironment: null,
    historyConnectionId: 'http://localhost:4010/graphql',
    updateProfile: vi.fn(),
    envModalOpen: false,
    profileModalOpen: false,
    setEnvModalOpen: vi.fn(),
    setProfileModalOpen: vi.fn(),
  },
  pageDefaultEndpointResolved: 'http://localhost:4010/graphql',
  responseCacheLayer: { removeTabFromCache: vi.fn(), setTabUploadProgress: vi.fn() },
  subscription: { reset: vi.fn() },
  monacoRef: { current: null },
  cancelTabRef: { current: vi.fn() },
  isTabExecutingRef: { current: vi.fn(() => false) },
  executingRef: { current: false },
  globalEnvMap: {},
};

const pageProps = {
  globalAuthProfiles: [{ id: 'gap-1', name: 'Global', type: 'none' as const }],
  selectedSvc: { authProfileIds: { 'env-1': 'gap-1' } },
  selectedEnvId: 'env-1',
};

describe('useGraphqlStudioPageTabsLayer — coverage gaps', () => {
  it('composes tab connection, auth presentation, and schema headers', () => {
    const { result } = renderHook(() => useGraphqlStudioPageTabsLayer(foundation as never, pageProps));
    expect(result.current.activeTabId).toBe('tab-1');
    expect(result.current.linkedProfileName).toBe('Local');
    expect(result.current.defaultAuthProfileId).toBe('gap-1');
    expect(result.current.tabSchemaConnectionId).toContain('4010');
    expect(result.current.schemaHeaders).toBeDefined();
    expect(result.current.authBadgePresentation).toBeDefined();
    expect(result.current.executingRef).toBe(foundation.executingRef);
  });

  it('handles missing global auth profiles and selected service', () => {
    const { result } = renderHook(() => useGraphqlStudioPageTabsLayer(foundation as never, {
      globalAuthProfiles: undefined,
      selectedSvc: null,
      selectedEnvId: null,
    }));
    expect(result.current.defaultAuthProfileId).toBeNull();
    expect(result.current.resolvedAuthPreview).toBeDefined();
  });

  it('invokes tab wiring callbacks and uses history fallback endpoint', () => {
    vi.mocked(useGqlStudioTabs).mockReturnValueOnce({
      ...tabsBundle,
      activeTab: undefined,
      activeTabId: 'missing-tab',
      resolvedTabEndpoint: '',
      hasResolvedProfileLink: false,
    });
    vi.mocked(useGqlActiveTabConnection).mockReturnValueOnce({
      activeTabConnection: null,
      resolvedTabAuth: null,
      resolvedTabSkipTlsVerify: false,
      resolvedTabTls: { caCert: '', clientCert: '', clientKey: '' },
      resolvedTabPollingEnabled: false,
      resolvedTabPollingIntervalSeconds: 30,
      resolvedTabPollingIntervalMs: 30_000,
    });

    const localFoundation = {
      ...foundation,
      connection: {
        ...foundation.connection,
        historyConnectionId: 'history://fallback/graphql',
      },
    };

    const { result } = renderHook(() => useGraphqlStudioPageTabsLayer(localFoundation as never, {
      globalAuthProfiles: undefined,
      selectedSvc: undefined,
      selectedEnvId: undefined,
    }));

    const firstCall = vi.mocked(useGqlStudioTabs).mock.calls[0]?.[0] as {
      onClearFileEntries: () => void;
      onResetSubscription: () => void;
    };
    firstCall.onClearFileEntries();
    firstCall.onResetSubscription();

    expect(localFoundation.uiState.setFileEntries).toHaveBeenCalledWith([]);
    expect(localFoundation.subscription.reset).toHaveBeenCalledTimes(1);
    expect(result.current.linkedProfileName).toBeNull();
    expect(result.current.defaultAuthProfileId).toBeNull();
    expect(result.current.tabSchemaConnectionId).toBe('history://fallback/graphql');
  });
});
