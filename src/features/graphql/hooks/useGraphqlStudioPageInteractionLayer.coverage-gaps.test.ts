/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGraphqlStudioPageInteractionLayer } from './useGraphqlStudioPageInteractionLayer';

const handleRunCollection = vi.fn();
const handleSubscribeInner = vi.fn();
const handleStopSubscription = vi.fn();
const handleExportSubscription = vi.fn();
const handleExecute = vi.fn();

vi.mock('./useGraphqlCollectionRun', () => ({
  useGraphqlCollectionRun: vi.fn(() => ({ handleRunCollection })),
}));

vi.mock('./useGqlItemLoaders', () => ({
  useGqlItemLoaders: vi.fn(() => ({
    handleLoadHistoryItem: vi.fn(),
    handleRunHistoryItem: vi.fn(),
    handleLoadCollectionItem: vi.fn(),
    handleEditInEditor: vi.fn(),
    handleBuilderExecute: vi.fn(),
    handleOpenCollectionItem: vi.fn(),
  })),
}));

vi.mock('./useSubscriptionOrchestration', () => ({
  useSubscriptionOrchestration: vi.fn(() => ({
    handleSubscribe: handleSubscribeInner,
    handleStopSubscription,
    handleExportSubscription,
  })),
}));

vi.mock('./useGraphqlStudioSubscriptionGuard', () => ({
  useGraphqlStudioSubscriptionGuard: vi.fn(({ onSubscribe }) => ({
    handleSubscribe: onSubscribe,
  })),
}));

vi.mock('./useGraphqlStudioShortcutsBridge', () => ({
  useGraphqlStudioShortcutsBridge: vi.fn(),
}));

const foundation = {
  uiState: {
    setBottomTab: vi.fn(),
    setBuilderMode: vi.fn(),
    setRightView: vi.fn(),
  },
  connection: {
    activeEnvironment: null,
    updateVariables: vi.fn(),
    profileModalOpen: false,
    envModalOpen: false,
  },
  collections: {
    trees: [],
    markItemExecuted: vi.fn(),
    addItem: vi.fn(),
  },
  runner: {},
  subscription: { state: 'idle', disconnect: vi.fn() },
  setActivityTab: vi.fn(),
  setRunnerCollectionId: vi.fn(),
  globalEnvMap: {},
};

const tabsLayer = {
  resolvedTabEndpoint: 'http://localhost:4010/graphql',
  resolvedTabSkipTlsVerify: false,
  resolvedTabTls: { caCert: '', clientCert: '', clientKey: '' },
  activeTabHeaders: {},
  resolvedTabAuth: null,
  hasPendingProfileEndpoint: false,
  activeTabId: 'tab-1',
  activeTab: { id: 'tab-1', operationType: 'query' as const },
  selectedOperation: null,
  editorActions: { editorMountRef: { current: null } },
  handleQueryChange: vi.fn(),
  handleVariablesChange: vi.fn(),
  addTab: vi.fn(),
  closeActiveTabRef: { current: vi.fn() },
};

const executionLayer = {
  handleExecute,
  handleCancel: vi.fn(),
  complexity: { setComplexityWarningPending: vi.fn() },
  schemaLayer: { handleIntrospect: vi.fn(), introspecting: false },
  execStatus: 'idle' as const,
};

describe('useGraphqlStudioPageInteractionLayer — coverage gaps', () => {
  it('wires collection run, item loaders, and subscription handlers', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioPageInteractionLayer(
        foundation as never,
        tabsLayer as never,
        executionLayer as never,
        [],
      ),
    );
    expect(result.current.handleRunCollection).toBe(handleRunCollection);
    expect(result.current.handleSubscribe).toBe(handleSubscribeInner);
    expect(result.current.subscriptionOrchestration.handleStopSubscription).toBe(handleStopSubscription);
    expect(result.current.handleDismissComplexityWarning).toBeDefined();
    expect(result.current.handleSaveToCollection).toBeDefined();
  });

  it('accepts undefined global auth profiles', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioPageInteractionLayer(
        foundation as never,
        tabsLayer as never,
        executionLayer as never,
        undefined,
      ),
    );
    expect(result.current.itemLoaders.handleLoadHistoryItem).toBeDefined();
  });
});
