/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';

vi.mock('@monaco-editor/react', () => ({
  useMonaco: () => ({ editor: {} }),
}));

vi.mock('./useGraphqlStudioUIState', () => ({
  useGraphqlStudioUIState: () => ({
    setFileEntries: vi.fn(),
    builderMode: 'editor',
    setBuilderMode: vi.fn(),
    bottomTab: 'response',
    setBottomTab: vi.fn(),
    rightView: 'response',
    setRightView: vi.fn(),
    focusAuthPanel: vi.fn(),
  }),
}));

vi.mock('./useGraphqlStudioSplitPanes', () => ({
  useGraphqlStudioSplitPanes: () => ({
    gqlActivitySplitRef: { current: null },
    activityPanelWidth: 280,
    activityDividerProps: {},
    gqlSplitRef: { current: null },
    gqlLeftPaneRef: { current: null },
    editorPaneWidth: 600,
    gqlPaneDividerProps: {},
    bottomPanelDividerProps: {},
    bottomPanelHeight: 200,
  }),
}));

vi.mock('./useGraphqlHistoryMaxItems', () => ({
  useGraphqlHistoryMaxItems: () => ({
    historyMaxItems: 100,
    handleHistoryMaxItemsChange: vi.fn(),
  }),
}));

vi.mock('./useGraphqlConnectionSettings', () => ({
  useGraphqlConnectionSettings: () => ({
    endpoint: 'http://localhost:4010/graphql',
    auth: null,
    skipTlsVerify: false,
    tlsCaCert: '',
    tlsClientCert: '',
    tlsClientKey: '',
    pollingEnabled: false,
    pollingIntervalSeconds: 30,
    profiles: [],
    profilesReady: true,
    activeEnvironment: null,
    historyConnectionId: 'http://localhost:4010/graphql',
    updateProfile: vi.fn(),
  }),
}));

vi.mock('./useGraphqlStudioEnvMap', () => ({
  useGraphqlStudioEnvMap: () => ({
    globalEnvMap: {},
    endpointProtocolStatus: 'http',
  }),
}));

vi.mock('./useGraphqlCollections', () => ({
  useGraphqlCollections: () => ({ trees: [], markItemExecuted: vi.fn(), addItem: vi.fn() }),
}));

vi.mock('./useGraphqlCollectionRunner', () => ({
  useGraphqlCollectionRunner: () => ({}),
}));

vi.mock('./useGqlTabResponseCache', () => ({
  useGqlTabResponseCache: () => ({
    removeTabFromCache: vi.fn(),
    setTabUploadProgress: vi.fn(),
    responseCache: {},
    cacheExecutionResult: vi.fn(),
    resolvePaneState: vi.fn(() => ({ response: null, executing: false, execStatus: 'idle' })),
  }),
}));

vi.mock('./useGraphqlSubscription', () => ({
  useGraphqlSubscription: () => ({ reset: vi.fn(), state: 'idle', messages: [], disconnect: vi.fn() }),
}));

const pageProps = {
  resolvedBaseUrl: 'http://localhost:4010',
  envName: 'dev',
  svcName: 'api',
  selectedSvc: null,
  selectedEnvId: null,
};

describe('useGraphqlStudioPageFoundation — coverage gaps', () => {
  it('initializes default execution refs and resolved endpoint', () => {
    const { result } = renderHook(() => useGraphqlStudioPageFoundation(pageProps));
    expect(result.current.pageDefaultEndpointResolved).toContain('graphql');
    expect(result.current.cancelTabRef.current('tab-1')).toBeUndefined();
    expect(result.current.isTabExecutingRef.current('tab-1')).toBe(false);
    expect(result.current.executingRef.current).toBe(false);
  });

  it('updates monacoRef when monaco instance changes', () => {
    const { result, rerender } = renderHook(() => useGraphqlStudioPageFoundation(pageProps));
    expect(result.current.monacoRef.current).toEqual({ editor: {} });
    rerender();
    expect(result.current.monacoInstance).toEqual({ editor: {} });
  });
});
