/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioExecute, resolveLiveGqlQuery } from './useGraphqlStudioExecute';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';

const defaultAdvSettings: AdvancedSettingsValues = {
  apqEnabled: false,
  apqUseGet: false,
  apqUnsupportedDetected: false,
  batchEnabled: false,
  batchTimeoutMs: 30000,
  batchUnsupportedDetected: false,
  dedupEnabled: true,
  complexityBlockEnabled: false,
  complexityBlockThreshold: 1000,
  subscriptionTransport: 'auto',
  sseMode: 'distinct',
  wsEndpointOverride: '',
  historyMaxItems: 100,
  subscriptionBufferSize: 5000,
  maxFileSizeMb: 50,
};

function makeTab(overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id: 'tab-1',
    label: 'MyQuery',
    modelUri: 'model://1',
    query: 'query { hello }',
    variables: '{}',
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    ...overrides,
  };
}

function makeParams(overrides: Partial<Parameters<typeof useGraphqlStudioExecute>[0]> = {}) {
  const execute = vi.fn();
  const setRightView = vi.fn();
  const setTabUploadProgress = vi.fn();
  const setComplexityWarningPending = vi.fn();
  const setComplexityGatePending = vi.fn();
  const pendingExecuteAfterGateRef = { current: null as (() => void) | null };
  const skipComplexityGateRef = { current: false };
  const sessionBypassComplexityGateRef = { current: false };
  const responseModelUriRef = { current: '' };
  const isTabExecutingRef = { current: vi.fn(() => true) };

  return {
    params: {
      activeTab: makeTab(),
      resolvedTabEndpoint: 'https://api.example.com/graphql',
      selectedOperation: 'MyQuery',
      activeTabHeaders: {},
      auth: null,
      activeEnvironment: null,
      globalEnvMap: {},
      skipTlsVerify: false,
      fileEntries: [],
      executing: false,
      isTabExecutingRef,
      complexityResult: null,
      complexityWarningPending: false,
      setComplexityWarningPending,
      complexityGatePending: false,
      setComplexityGatePending,
      pendingExecuteAfterGateRef,
      skipComplexityGateRef,
      sessionBypassComplexityGateRef,
      advSettings: defaultAdvSettings,
      execute,
      pushRecentEndpoint: vi.fn(),
      isDuplicate: false,
      duplicateSourceTabId: null,
      responseModelUriRef,
      setRightView,
      setTabUploadProgress,
      ...overrides,
    },
    execute,
    setRightView,
  };
}

describe('useGraphqlStudioExecute', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('fires execute with request payload (Phase 6E — tab attribution in execution layer)', () => {
    const { params, execute, setRightView } = makeParams();
    const { result } = renderHook(() => useGraphqlStudioExecute(params));

    act(() => { result.current(); });

    expect(setRightView).toHaveBeenCalledWith('response');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'https://api.example.com/graphql',
      connectionId: 'https://api.example.com/graphql',
      query: 'query { hello }',
    }));
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({
      sourceTabId: expect.anything(),
    }));
  });

  it('Phase 6F: does not execute when endpointLinkPending', () => {
    const { params, execute } = makeParams({ endpointLinkPending: true });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));

    act(() => { result.current(); });

    expect(execute).not.toHaveBeenCalled();
  });

  it('does not pass onExecutionCompleted to execute (layer owns completion callback)', () => {
    const { params, execute } = makeParams();
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({
      onExecutionCompleted: expect.any(Function),
    }));
  });

  it('does not execute while duplicate prompt is open on the same tab (Phase 6A)', () => {
    const { params, execute } = makeParams({
      isDuplicate: true,
      duplicateSourceTabId: 'tab-1',
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows execute on another tab while duplicate prompt is open elsewhere (Phase 6A)', () => {
    const { params, execute } = makeParams({
      isDuplicate: true,
      duplicateSourceTabId: 'tab-other',
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).toHaveBeenCalled();
  });

  it('does nothing without endpoint', () => {
    const { params, execute } = makeParams({ resolvedTabEndpoint: '  ' });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing without query text', () => {
    const { params, execute } = makeParams({ activeTab: makeTab({ query: '   ' }) });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing with unresolved environment variables in endpoint', () => {
    const { params, execute } = makeParams({ resolvedTabEndpoint: '{{MISSING}}' });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing with array variables JSON', () => {
    const { params, execute } = makeParams({ activeTab: makeTab({ variables: '[1,2]' }) });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing with invalid variables JSON', () => {
    const { params, execute } = makeParams({ activeTab: makeTab({ variables: 'not-json' }) });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses per-tab skipTlsVerify override when set (Phase 6)', () => {
    const { params, execute } = makeParams({
      activeTab: makeTab({ skipTlsVerify: true }),
      skipTlsVerify: false,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ skipTlsVerify: true }));
  });

  it('shows complexity warning before blocking execute', () => {
    const setComplexityWarningPending = vi.fn();
    const { params, execute } = makeParams({
      complexityResult: {
        score: 900,
        level: 'danger',
        shouldBlock: true,
        threshold: 500,
        fieldBreakdown: [],
      },
      setComplexityWarningPending,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(setComplexityWarningPending).toHaveBeenCalledWith(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it('opens complexity gate modal when score exceeds configured threshold', () => {
    const setComplexityGatePending = vi.fn();
    const pendingExecuteAfterGateRef = { current: null as (() => void) | null };
    const { params, execute } = makeParams({
      complexityResult: {
        score: 1500,
        level: 'danger',
        shouldBlock: false,
        threshold: 500,
        fieldBreakdown: [],
      },
      advSettings: { ...defaultAdvSettings, complexityBlockEnabled: true, complexityBlockThreshold: 1000 },
      setComplexityGatePending,
      pendingExecuteAfterGateRef,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(setComplexityGatePending).toHaveBeenCalledWith(true);
    expect(pendingExecuteAfterGateRef.current).toBeTypeOf('function');
    expect(execute).not.toHaveBeenCalled();
  });

  it('sends multipart request when valid file entries exist', () => {
    const setTabUploadProgress = vi.fn();
    const { params, execute } = makeParams({
      fileEntries: [{
        id: 'f1',
        file: new File(['x'], 'x.txt'),
        varPath: 'file',
        error: null,
      }],
      setTabUploadProgress,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-1', 0);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      formData: expect.any(FormData),
    }));
  });

  it('does nothing when file entries contain errors', () => {
    const { params, execute } = makeParams({
      fileEntries: [{ id: 'f1', file: new File(['x'], 'x.txt'), varPath: 'file', error: 'bad' }],
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing while another execution is in flight', () => {
    const { params, execute } = makeParams({ executing: true });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).not.toHaveBeenCalled();
  });

  it('reports upload progress for multipart requests', () => {
    const setTabUploadProgress = vi.fn();
    const isTabExecutingRef = { current: vi.fn(() => true) };
    const { params, execute } = makeParams({
      isTabExecutingRef,
      fileEntries: [{
        id: 'f1',
        file: new File(['x'], 'x.txt'),
        varPath: 'file',
        error: null,
      }],
      setTabUploadProgress,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    const onProgress = execute.mock.calls[0]?.[0]?.onUploadProgress as (loaded: number, total: number) => void;
    onProgress(50, 100);
    onProgress(0, 100);
    onProgress(25, 0);
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-1', 50);
    expect(isTabExecutingRef.current).toHaveBeenCalledWith('tab-1');
  });

  it('continues upload progress when upload tab executes in background (Phase 6D-6)', () => {
    const setTabUploadProgress = vi.fn();
    const isTabExecutingRef = {
      current: vi.fn((tabId: string) => tabId === 'tab-1'),
    };
    const { params, execute } = makeParams({
      isTabExecutingRef,
      fileEntries: [{
        id: 'f1',
        file: new File(['x'], 'x.txt'),
        varPath: 'file',
        error: null,
      }],
      setTabUploadProgress,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    const onProgress = execute.mock.calls[0]?.[0]?.onUploadProgress as (loaded: number, total: number) => void;
    onProgress(75, 100);
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-1', 75);
  });

  it('skips upload progress update when upload tab is no longer executing', () => {
    const setTabUploadProgress = vi.fn();
    const isTabExecutingRef = { current: vi.fn(() => false) };
    const { params, execute } = makeParams({
      isTabExecutingRef,
      fileEntries: [{
        id: 'f1',
        file: new File(['x'], 'x.txt'),
        varPath: 'file',
        error: null,
      }],
      setTabUploadProgress,
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    setTabUploadProgress.mockClear();
    const onProgress = execute.mock.calls[0]?.[0]?.onUploadProgress as (loaded: number, total: number) => void;
    onProgress(50, 100);
    expect(setTabUploadProgress).not.toHaveBeenCalled();
  });

  it('clears stale upload progress when starting a non-multipart execute', () => {
    const setTabUploadProgress = vi.fn();
    const { params, execute } = makeParams({ setTabUploadProgress });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(setTabUploadProgress).toHaveBeenCalledWith('tab-1', null);
    expect(execute).toHaveBeenCalled();
  });

  it('sends mutation operation type for mutation tabs', () => {
    const { params, execute } = makeParams({
      activeTab: makeTab({ operationType: 'mutation' }),
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operationType: 'mutation' }));
  });

  it('parses variables JSON for multipart uploads', () => {
    const { params, execute } = makeParams({
      activeTab: makeTab({ variables: '{"id":"1"}' }),
      fileEntries: [{
        id: 'f1',
        file: new File(['x'], 'x.txt'),
        varPath: 'file',
        error: null,
      }],
    });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));
    act(() => { result.current(); });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      formData: expect.any(FormData),
      variables: '{"id":"1"}',
    }));
  });

  it('resolveLiveGqlQuery prefers live Monaco model over stale tab state', () => {
    const tab = makeTab({
      modelUri: 'inmemory://graphql/tab-1',
      query: 'query {\n  \n}',
    });
    const editorMountRef = {
      current: {
        getModel: () => ({
          uri: { toString: () => 'inmemory://graphql/tab-1' },
          getValue: () => 'query { health }',
        }),
      },
    } as Parameters<typeof resolveLiveGqlQuery>[1];

    expect(resolveLiveGqlQuery(tab, editorMountRef)).toBe('query { health }');
    expect(resolveLiveGqlQuery(tab)).toBe('query {\n  \n}');
  });

  it('execute sends live Monaco query when tab state is stale', () => {
    const tab = makeTab({
      modelUri: 'inmemory://graphql/tab-1',
      query: 'query {\n  \n}',
    });
    const editorMountRef = {
      current: {
        getModel: () => ({
          uri: { toString: () => 'inmemory://graphql/tab-1' },
          getValue: () => 'query { health }',
        }),
      },
    } as Parameters<typeof useGraphqlStudioExecute>[0]['editorMountRef'];

    const { params, execute } = makeParams({ activeTab: tab, editorMountRef });
    const { result } = renderHook(() => useGraphqlStudioExecute(params));

    act(() => { result.current(); });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      query: 'query { health }',
    }));
  });
});
