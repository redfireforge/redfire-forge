/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  createUpdateLinkedProfileAuth,
  createHandleDemoSetGqlQuery,
  createHandleCancel,
  createOnIntrospectComplete,
  createHandleResponseSubTabChange,
  createSyncBatchResultsHandler,
  createHandleSaveToCollection,
  createHandleDismissComplexityWarning,
  buildTabConnectionPageDefaults,
  createTabsExecutionCallbacks,
  wireExecutionRefs,
  createMarkCollectionItemExecuted,
  createSetBottomPanelTab,
  createSetGqlActivityTab,
} from './studioPageCompositionUtils';
import { useGraphqlStudioPageComposition } from './useGraphqlStudioPageComposition';
import type { GraphqlStudioPageBodyProps } from '../components/GraphqlStudioPageBody';

const mockBodyProps = { demoBridges: {}, toolbarSections: {}, tabBar: {}, main: {}, overlays: {} } as unknown as GraphqlStudioPageBodyProps;

const foundationMock = { uiState: {}, connection: { endpoint: 'http://localhost/graphql' } };
const tabsReadyMock = {
  tabs: [{ id: 'tab-1', query: 'query { x }' }],
  activeTab: { id: 'tab-1', query: 'query { x }' },
  activeTabId: 'tab-1',
};
const tabsEmptyMock = { tabs: [], activeTab: null, activeTabId: null };
const executionMock = { handleExecute: vi.fn() };
const interactionMock = { handleRunCollection: vi.fn() };

vi.mock('./useGraphqlStudioPageFoundation', () => ({
  useGraphqlStudioPageFoundation: vi.fn(() => foundationMock),
}));
vi.mock('./useGraphqlStudioPageTabsLayer', () => ({
  useGraphqlStudioPageTabsLayer: vi.fn(() => tabsReadyMock),
}));
vi.mock('./useGraphqlStudioPageExecutionLayer', () => ({
  useGraphqlStudioPageExecutionLayer: vi.fn(() => executionMock),
}));
vi.mock('./useGraphqlStudioPageInteractionLayer', () => ({
  useGraphqlStudioPageInteractionLayer: vi.fn(() => interactionMock),
}));
vi.mock('./buildGraphqlStudioPageBodyProps', () => ({
  buildGraphqlStudioPageBodyProps: vi.fn(() => mockBodyProps),
}));

import { useGraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';
import { useGraphqlStudioPageTabsLayer } from './useGraphqlStudioPageTabsLayer';
import { useGraphqlStudioPageExecutionLayer } from './useGraphqlStudioPageExecutionLayer';
import { useGraphqlStudioPageInteractionLayer } from './useGraphqlStudioPageInteractionLayer';
import { buildGraphqlStudioPageBodyProps } from './buildGraphqlStudioPageBodyProps';

const pageProps = {
  resolvedBaseUrl: 'http://localhost',
  envName: 'dev',
  svcName: 'api',
  selectedSvc: null,
  selectedEnvId: null,
  globalAuthProfiles: [],
};

describe('studioPageCompositionUtils', () => {
  it('createUpdateLinkedProfileAuth patches profile auth', () => {
    const updateProfile = vi.fn();
    const handler = createUpdateLinkedProfileAuth(updateProfile);
    handler('p1', { type: 'bearer', token: 't' });
    expect(updateProfile).toHaveBeenCalledWith('p1', { auth: { type: 'bearer', token: 't' } });
  });

  it('createHandleDemoSetGqlQuery updates editor and tab query', () => {
    const setValue = vi.fn();
    const handleQueryChange = vi.fn();
    const ref = { current: { setValue } };
    createHandleDemoSetGqlQuery(ref, handleQueryChange)('query { demo }');
    expect(setValue).toHaveBeenCalledWith('query { demo }');
    expect(handleQueryChange).toHaveBeenCalledWith('query { demo }');
  });

  it('createHandleCancel clears upload progress and cancels', () => {
    const cancel = vi.fn();
    const setTabUploadProgress = vi.fn();
    createHandleCancel('tab-1', cancel, setTabUploadProgress)();
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-1', null);
    expect(cancel).toHaveBeenCalled();
  });

  it('createOnIntrospectComplete switches right view to schema', () => {
    const setRightView = vi.fn();
    createOnIntrospectComplete(setRightView)();
    expect(setRightView).toHaveBeenCalledWith('schema');
  });

  it('createHandleResponseSubTabChange updates active tab sub tab', () => {
    const updateActiveTab = vi.fn();
    createHandleResponseSubTabChange(updateActiveTab)('headers');
    expect(updateActiveTab).toHaveBeenCalledWith({ responseSubTab: 'headers' });
  });

  it('createSyncBatchResultsHandler delegates to sync util', () => {
    const cacheExecutionResult = vi.fn();
    const applyTabResult = vi.fn();
    const handler = createSyncBatchResultsHandler(cacheExecutionResult, applyTabResult);
    const batchedTabs = [{ id: 't1' }] as Parameters<typeof handler>[0];
    const batchResult = {
      results: [{ response: { httpStatus: 200, data: {}, errors: [] } }],
    } as Parameters<typeof handler>[1];
    handler(batchedTabs, batchResult);
    expect(cacheExecutionResult).toHaveBeenCalledWith('t1', 'success', expect.any(Object));
    expect(applyTabResult).toHaveBeenCalledWith('t1', 'success', expect.any(Object));
  });

  it('createHandleSaveToCollection calls collections.addItem', async () => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const handler = createHandleSaveToCollection({ addItem });
    await handler('col-1', 'folder-1', 'My Query', { query: 'q' } as never);
    expect(addItem).toHaveBeenCalledWith('col-1', 'folder-1', 'My Query', { query: 'q' });
  });

  it('createHandleDismissComplexityWarning clears pending flag', () => {
    const setComplexityWarningPending = vi.fn();
    createHandleDismissComplexityWarning(setComplexityWarningPending)();
    expect(setComplexityWarningPending).toHaveBeenCalledWith(false);
  });

  it('buildTabConnectionPageDefaults returns connection defaults object', () => {
    const defaults = buildTabConnectionPageDefaults(
      'http://x/graphql',
      null,
      true,
      'ca',
      'cert',
      'key',
      false,
      30,
    );
    expect(defaults).toEqual({
      endpoint: 'http://x/graphql',
      auth: null,
      skipTlsVerify: true,
      tlsCaCert: 'ca',
      tlsClientCert: 'cert',
      tlsClientKey: 'key',
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    });
  });

  it('createTabsExecutionCallbacks wires cancel and executing checks', () => {
    const setTabUploadProgress = vi.fn();
    const cancelTabRef = { current: vi.fn() };
    const isTabExecutingRef = { current: vi.fn(() => true) };
    const callbacks = createTabsExecutionCallbacks(setTabUploadProgress, cancelTabRef, isTabExecutingRef);
    callbacks.onCancelExecution('tab-2');
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-2', null);
    expect(cancelTabRef.current).toHaveBeenCalledWith('tab-2');
    expect(callbacks.isTabExecuting('tab-2')).toBe(true);
  });

  it('wireExecutionRefs assigns ref current values', () => {
    const cancelTabRef = { current: vi.fn() };
    const isTabExecutingRef = { current: vi.fn() };
    const executingRef = { current: false };
    const cancelTab = vi.fn();
    const isTabExecuting = vi.fn(() => false);
    wireExecutionRefs(cancelTabRef, isTabExecutingRef, executingRef, cancelTab, isTabExecuting, true);
    expect(cancelTabRef.current).toBe(cancelTab);
    expect(isTabExecutingRef.current).toBe(isTabExecuting);
    expect(executingRef.current).toBe(true);
  });

  it('createMarkCollectionItemExecuted swallows markItemExecuted rejections', async () => {
    const markItemExecuted = vi.fn().mockRejectedValue(new Error('fail'));
    createMarkCollectionItemExecuted(markItemExecuted)('item-1');
    await Promise.resolve();
    expect(markItemExecuted).toHaveBeenCalledWith('item-1');
  });

  it('createSetBottomPanelTab delegates to setBottomTab', () => {
    const setBottomTab = vi.fn();
    createSetBottomPanelTab(setBottomTab)('variables');
    expect(setBottomTab).toHaveBeenCalledWith('variables');
  });

  it('createSetGqlActivityTab delegates to setActivityTab', () => {
    const setActivityTab = vi.fn();
    createSetGqlActivityTab(setActivityTab)('history');
    expect(setActivityTab).toHaveBeenCalledWith('history');
  });
});

describe('useGraphqlStudioPageComposition', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.mocked(useGraphqlStudioPageTabsLayer).mockReturnValue(tabsReadyMock as never);
  });

  it('returns isReady false when tabs are not initialized', () => {
    vi.mocked(useGraphqlStudioPageTabsLayer).mockReturnValue(tabsEmptyMock as never);
    const { result } = renderHook(() => useGraphqlStudioPageComposition(pageProps));
    expect(result.current.isReady).toBe(false);
    expect(result.current.bodyProps).toBeNull();
    expect(buildGraphqlStudioPageBodyProps).not.toHaveBeenCalled();
  });

  it('composes layer hooks and builds body props when ready', () => {
    const { result } = renderHook(() => useGraphqlStudioPageComposition(pageProps));
    expect(useGraphqlStudioPageFoundation).toHaveBeenCalledWith(pageProps);
    expect(useGraphqlStudioPageTabsLayer).toHaveBeenCalledWith(foundationMock, pageProps);
    expect(useGraphqlStudioPageExecutionLayer).toHaveBeenCalledWith(
      foundationMock,
      tabsReadyMock,
      pageProps.globalAuthProfiles,
    );
    expect(useGraphqlStudioPageInteractionLayer).toHaveBeenCalledWith(
      foundationMock,
      tabsReadyMock,
      executionMock,
      pageProps.globalAuthProfiles,
    );
    expect(buildGraphqlStudioPageBodyProps).toHaveBeenCalledWith({
      foundation: foundationMock,
      tabsLayer: tabsReadyMock,
      executionLayer: executionMock,
      interactionLayer: interactionMock,
      globalAuthProfiles: pageProps.globalAuthProfiles,
    });
    expect(result.current.isReady).toBe(true);
    expect(result.current.bodyProps).toBe(mockBodyProps);
  });
});
