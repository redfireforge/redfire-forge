/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { useGraphqlStudioTabExecution } from './useGraphqlStudioTabExecution';
import type { GqlStudioTab } from '../utils/tabPersistence';

const layerMounts: Array<{ tabId: string; resolvedAuth: unknown; authSentSource: unknown }> = [];
const handleFns = {
  execute: vi.fn(),
  cancel: vi.fn(),
  resolveDedupChoice: vi.fn(),
};

vi.mock('../components/GqlTabExecutionLayer', () => ({
  GqlTabExecutionLayer: ({
    tabId,
    resolvedAuth,
    authSentSource,
    onRegister,
    onUnregister: _onUnregister,
    onStateChange,
  }: {
    tabId: string;
    resolvedAuth?: unknown;
    authSentSource?: unknown;
    onRegister: (id: string, handle: unknown) => void;
    onUnregister: (id: string) => void;
    onStateChange?: (id: string) => void;
  }) => {
    layerMounts.push({ tabId, resolvedAuth, authSentSource });
    onRegister(tabId, {
      execute: handleFns.execute,
      cancel: handleFns.cancel,
      resolveDedupChoice: handleFns.resolveDedupChoice,
      getState: () => ({
        status: tabId === 'tab-1' ? 'loading' : 'idle',
        response: null,
        apqInfo: null,
        isDuplicate: false,
        duplicateSourceTabId: null,
      }),
    });
    onStateChange?.(tabId);
    return null;
  },
}));

function makeTab(id: string): GqlStudioTab {
  return {
    id,
    label: id,
    modelUri: `model://${id}`,
    query: 'query { hello }',
    variables: '{}',
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
  };
}

describe('useGraphqlStudioTabExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    layerMounts.length = 0;
  });

  it('reads active tab state from registered handle', async () => {
    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs: [makeTab('tab-1'), makeTab('tab-2')],
        activeTabId: 'tab-1',
      }),
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    expect(result.current.activeState.status).toBe('loading');
    expect(result.current.isTabExecuting('tab-1')).toBe(true);
    expect(result.current.isTabExecuting('tab-2')).toBe(false);
  });

  it('returns idle state when active tab has no handle yet', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs: [makeTab('tab-1')],
        activeTabId: 'missing',
      }),
    );

    expect(result.current.activeState.status).toBe('idle');
  });

  it('Phase 6F Slice 3: passes per-tab resolvedAuth to execution layers', async () => {
    const profiles = [
      {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example.com/graphql',
        auth: { type: 'bearer' as const, token: 'staging' },
        createdAt: 1,
      },
      {
        id: 'prof-prod',
        name: 'Prod',
        endpoint: 'https://prod.example.com/graphql',
        auth: { type: 'bearer' as const, token: 'prod' },
        createdAt: 1,
      },
    ];
    const tabs = [
      { ...makeTab('tab-1'), connectionId: 'prof-staging', endpoint: 'https://staging.example.com/graphql' },
      { ...makeTab('tab-2'), connectionId: 'prof-prod', endpoint: 'https://prod.example.com/graphql' },
    ];

    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs,
        activeTabId: 'tab-1',
        profiles,
        pageDefaults: {
          endpoint: 'https://default.example.com/graphql',
          auth: { type: 'bearer', token: 'page' },
          skipTlsVerify: false,
          pollingEnabled: false,
          pollingIntervalSeconds: 30,
        },
      }),
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    expect(layerMounts).toEqual([
      { tabId: 'tab-1', resolvedAuth: { type: 'bearer', token: 'staging' }, authSentSource: 'profile' },
      { tabId: 'tab-2', resolvedAuth: { type: 'bearer', token: 'prod' }, authSentSource: 'profile' },
    ]);
  });

  it('Phase 6F: passes authSentSource tab/profile/page to execution layers', async () => {
    const profiles = [{
      id: 'prof-1',
      name: 'Linked',
      endpoint: 'https://api.example.com/graphql',
      auth: { type: 'bearer' as const, token: 'from-profile' },
      createdAt: 1,
    }];
    const tabs = [
      { ...makeTab('tab-override'), auth: null },
      { ...makeTab('tab-linked'), connectionId: 'prof-1', endpoint: 'https://api.example.com/graphql' },
      makeTab('tab-page'),
    ];

    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs,
        activeTabId: 'tab-override',
        profiles,
        pageDefaults: {
          endpoint: 'https://default.example.com/graphql',
          auth: { type: 'bearer', token: 'page-default' },
          skipTlsVerify: false,
          pollingEnabled: false,
          pollingIntervalSeconds: 30,
        },
      }),
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    expect(layerMounts.find((m) => m.tabId === 'tab-override')?.authSentSource).toBe('tab');
    expect(layerMounts.find((m) => m.tabId === 'tab-linked')?.authSentSource).toBe('profile');
    expect(layerMounts.find((m) => m.tabId === 'tab-page')?.authSentSource).toBe('page');
  });

  it('Phase 6H: passes tab explicit null auth to execution layer (not page default)', async () => {
    const tabs = [
      { ...makeTab('tab-1'), auth: null },
      { ...makeTab('tab-2'), connectionId: 'prof-prod', endpoint: 'https://prod.example.com/graphql' },
    ];
    const profiles = [{
      id: 'prof-prod',
      name: 'Prod',
      endpoint: 'https://prod.example.com/graphql',
      auth: { type: 'bearer' as const, token: 'prod' },
      createdAt: 1,
    }];

    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs,
        activeTabId: 'tab-1',
        profiles,
        pageDefaults: {
          endpoint: 'https://default.example.com/graphql',
          auth: { type: 'bearer', token: 'page-should-not-be-used' },
          skipTlsVerify: false,
          pollingEnabled: false,
          pollingIntervalSeconds: 30,
        },
      }),
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    expect(layerMounts.find((m) => m.tabId === 'tab-1')?.resolvedAuth).toBeNull();
    expect(layerMounts.find((m) => m.tabId === 'tab-2')?.resolvedAuth).toEqual({
      type: 'bearer',
      token: 'prod',
    });
  });

  it('falls back to pageDefaults when resolved maps lack the tab entry', async () => {
    const originalHas = Map.prototype.has;
    const hasSpy = vi.spyOn(Map.prototype, 'has').mockImplementation(function (this: Map<unknown, unknown>, key) {
      if (key === 'tab-fallback') return false;
      return originalHas.call(this, key);
    });

    const tabs = [makeTab('tab-fallback')];
    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs,
        activeTabId: 'tab-fallback',
        pageDefaults: {
          endpoint: 'https://default.example.com/graphql',
          auth: { type: 'bearer', token: 'page-fallback' },
          skipTlsVerify: false,
          pollingEnabled: false,
          pollingIntervalSeconds: 30,
        },
      }),
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    expect(layerMounts[0]).toEqual({
      tabId: 'tab-fallback',
      resolvedAuth: { type: 'bearer', token: 'page-fallback' },
      authSentSource: 'page',
    });
    hasSpy.mockRestore();
  });

  it('forwards execute, cancel, cancelTab, and resolveDedupChoice to active handle', async () => {
    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs: [makeTab('tab-1')],
        activeTabId: 'tab-1',
      }),
    );
    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    const params = { query: 'q', variables: '{}', endpoint: 'http://x', headers: [] };
    result.current.execute(params as never);
    result.current.cancel();
    result.current.cancelTab('tab-1');
    result.current.resolveDedupChoice('run-anyway' as never);

    expect(handleFns.execute).toHaveBeenCalledWith(params);
    expect(handleFns.cancel).toHaveBeenCalled();
    expect(handleFns.resolveDedupChoice).toHaveBeenCalledWith('run-anyway');
  });

  it('execute/cancel are no-ops when handle is missing', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioTabExecution({
        tabs: [makeTab('tab-1')],
        activeTabId: 'missing',
      }),
    );
    expect(() => {
      result.current.execute({} as never);
      result.current.cancel();
      result.current.cancelTab('missing');
      result.current.resolveDedupChoice('skip' as never);
    }).not.toThrow();
  });
});
