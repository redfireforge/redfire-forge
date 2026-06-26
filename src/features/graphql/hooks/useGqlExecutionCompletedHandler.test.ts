/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGqlExecutionCompletedHandler } from './useGqlExecutionCompletedHandler';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { GraphqlResponse } from '../../../shared/types/graphql';

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

function makeResponse(): GraphqlResponse {
  return { data: { hello: 'world' }, latencyMs: 10, timestamp: Date.now(), httpStatus: 200 };
}

describe('useGqlExecutionCompletedHandler', () => {
  const cacheExecutionResult = vi.fn();
  const saveHistory = vi.fn().mockResolvedValue(undefined);

  function makeHandlerParams(
    overrides: Partial<Parameters<typeof useGqlExecutionCompletedHandler>[0]> = {},
  ) {
    return {
      cacheExecutionResult,
      tabs: [makeTab()],
      pageEndpoint: 'https://api.example.com/graphql',
      profiles: [],
      activeEnvironment: null,
      globalEnvMap: {},
      saveHistory,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches result and saves history with resolved tab endpoint (Phase 6)', () => {
    const tabs = [makeTab({ endpoint: 'https://staging.example.com/graphql' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(cacheExecutionResult).toHaveBeenCalledWith('tab-1', 'success', response, null);
    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'https://staging.example.com/graphql',
    }));
  });

  it('caches apqInfo on execution complete (Phase 6D)', () => {
    const response = makeResponse();
    const apqInfo = { hash: 'abc123', cacheHit: true, unsupported: false, connectionId: 'conn-1' };
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams()));

    act(() => {
      result.current('tab-1', 'success', response, apqInfo);
    });

    expect(cacheExecutionResult).toHaveBeenCalledWith('tab-1', 'success', response, apqInfo);
  });

  it('falls back to page endpoint when tab has no override', () => {
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams()));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'https://api.example.com/graphql',
    }));
  });

  it('Phase 6F: saves history with profile-resolved endpoint when tab is profile-linked', () => {
    const profiles = [{
      id: 'prof-staging',
      name: 'Staging',
      endpoint: 'https://staging.example.com/graphql',
      auth: null,
      createdAt: 1,
    }];
    const tabs = [makeTab({ connectionId: 'prof-staging' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs, profiles })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'https://staging.example.com/graphql',
    }));
  });

  it('caches error completion without saving history when response is null', () => {
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams()));

    act(() => {
      result.current('tab-1', 'error', null, null);
    });

    expect(cacheExecutionResult).toHaveBeenCalledWith('tab-1', 'error', null, null);
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('omits operation name for anonymous queries even when the tab has a label', () => {
    const tabs = [makeTab({ label: 'NamedQuery', selectedOperation: undefined, query: 'query { hello }' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ name: undefined }),
    }));
  });

  it('derives operation name from a named query when selectedOperation is absent', () => {
    const tabs = [makeTab({
      label: 'TabLabel',
      selectedOperation: undefined,
      query: 'query GetUsers { users { id } }',
    })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ name: 'GetUsers' }),
    }));
  });

  it('omits operation name for Untitled tabs without selectedOperation', () => {
    const tabs = [makeTab({ label: 'Untitled', selectedOperation: undefined })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ name: undefined }),
    }));
  });

  it('prefers selectedOperation over tab label for history name', () => {
    const tabs = [makeTab({
      label: 'TabLabel',
      selectedOperation: 'GetUsers',
      query: 'query GetUsers { users { id } }',
    })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ name: 'GetUsers' }),
    }));
  });

  it('persists mutation operation type in history entry', () => {
    const tabs = [makeTab({ operationType: 'mutation' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ operationType: 'mutation' }),
    }));
  });

  it('skips cache and history when tab is no longer in tabs list', () => {
    const tabs = [makeTab({ id: 'tab-1' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs })));

    act(() => {
      result.current('tab-gone', 'success', response, null);
    });

    expect(cacheExecutionResult).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('skips history save when resolved endpoint is empty', () => {
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({
      pageEndpoint: '   ',
    })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(cacheExecutionResult).toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('swallows saveHistory rejection without throwing', async () => {
    const rejectingSave = vi.fn().mockRejectedValue(new Error('idb fail'));
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({
      saveHistory: rejectingSave,
    })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });
    await Promise.resolve();
    expect(rejectingSave).toHaveBeenCalled();
  });

  it('ignores non-terminal status values', () => {
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams()));

    act(() => {
      result.current('tab-1', 'loading', response, null);
    });

    expect(cacheExecutionResult).toHaveBeenCalledWith('tab-1', 'loading', response, null);
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('normalizes loopback localhost to 127.0.0.1 for history connectionId', () => {
    const tabs = [makeTab({ endpoint: '{{graphqlUrl}}' })];
    const response = makeResponse();
    const { result } = renderHook(() => useGqlExecutionCompletedHandler(makeHandlerParams({
      tabs,
      pageEndpoint: '{{graphqlUrl}}',
      globalEnvMap: { graphqlUrl: 'http://localhost:4010/graphql' },
    })));

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'http://127.0.0.1:4010/graphql',
    }));
  });

  it('uses latest tab content from ref when callback identity is stable (Phase 6E)', () => {
    const tabs = [makeTab({ query: 'query { old }' })];
    const response = makeResponse();
    const { result, rerender } = renderHook(
      ({ t }) => useGqlExecutionCompletedHandler(makeHandlerParams({ tabs: t })),
      { initialProps: { t: tabs } },
    );
    const stableHandler = result.current;

    rerender({ t: [makeTab({ query: 'query { updated }' })] });
    expect(result.current).toBe(stableHandler);

    act(() => {
      result.current('tab-1', 'success', response, null);
    });

    expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
      operation: expect.objectContaining({ query: 'query { updated }' }),
    }));
  });
});
