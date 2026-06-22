/**
 * @vitest-environment jsdom
 *
 * Phase 6E integration — real GqlTabExecutionLayer instances (no layer mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render, waitFor } from '@testing-library/react';
import type { GqlStudioTab } from '../utils/tabPersistence';

vi.mock('../utils/gqlFetch', () => ({
  gqlFetch: vi.fn(),
  gqlUpload: vi.fn(),
}));

vi.mock('../utils/graphqlClient', () => ({
  hasIncrementalDirective: vi.fn(() => false),
}));

vi.mock('../utils/apqClient', () => ({
  executeWithAPQ: vi.fn(),
}));

vi.mock('../utils/multipartParser', () => ({
  parseMultipartMixed: vi.fn(),
}));

vi.mock('../utils/dedupExecution', () => ({
  buildDedupKey: vi.fn(() => 'dedup-key'),
  getInFlight: vi.fn(() => null),
  registerInFlight: vi.fn(),
  removeInFlight: vi.fn(),
  handleDedupGuard: vi.fn(),
}));

import { gqlFetch } from '../utils/gqlFetch';
import { useGraphqlStudioTabExecution } from './useGraphqlStudioTabExecution';

const ENDPOINT = 'https://api.example.com/graphql';

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

function makeSuccessFetchResult(data: unknown = { hello: 'world' }) {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
    error: undefined,
  };
}

describe('useGraphqlStudioTabExecution — real layers (Phase 6E integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isolates per-tab response state when switching tabs', async () => {
    let resolveTab1!: (value: ReturnType<typeof makeSuccessFetchResult>) => void;
    vi.mocked(gqlFetch).mockImplementation((_endpoint, _method, _headers, body) => {
      const parsed = JSON.parse(body as string) as { query?: string };
      if (parsed.query?.includes('tab1')) {
        return new Promise((resolve) => {
          resolveTab1 = resolve;
        });
      }
      return Promise.resolve(makeSuccessFetchResult({ hello: 'tab2' }));
    });

    const tabs = [
      makeTab('tab-1'),
      { ...makeTab('tab-2'), query: 'query { tab2 }' },
    ];

    const onExecutionCompleted = vi.fn();

    const { result, rerender } = renderHook(
      ({ activeTabId }) =>
        useGraphqlStudioTabExecution({
          tabs,
          activeTabId,
          onExecutionCompleted,
        }),
      { initialProps: { activeTabId: 'tab-1' } },
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    act(() => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { tab1 }',
        variables: '{}',
        headers: {},
      });
    });

    await waitFor(() => {
      expect(result.current.activeState.status).toBe('loading');
    });

    rerender({ activeTabId: 'tab-2' });
    await act(async () => {});

    expect(result.current.activeState.status).toBe('idle');
    expect(result.current.activeState.response).toBeNull();

    act(() => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { tab2 }',
        variables: '{}',
        headers: {},
      });
    });

    await waitFor(() => {
      expect(result.current.activeState.status).toBe('success');
      expect(result.current.activeState.response?.data).toEqual({ hello: 'tab2' });
    });

    rerender({ activeTabId: 'tab-1' });
    await act(async () => {});

    expect(result.current.activeState.status).toBe('loading');
    expect(result.current.activeState.response).toBeNull();

    await act(async () => {
      resolveTab1(makeSuccessFetchResult({ hello: 'tab1' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeState.status).toBe('success');
      expect(result.current.activeState.response?.data).toEqual({ hello: 'tab1' });
    });

    expect(onExecutionCompleted).toHaveBeenCalledWith(
      'tab-1',
      'success',
      expect.objectContaining({ data: { hello: 'tab1' } }),
      null,
    );
    expect(onExecutionCompleted).toHaveBeenCalledWith(
      'tab-2',
      'success',
      expect.objectContaining({ data: { hello: 'tab2' } }),
      null,
    );
  });

  it('updates activeState when switching to a tab with completed APQ metadata (Phase 6D/6E)', async () => {
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessFetchResult({ ping: true }));

    const { executeWithAPQ } = await import('../utils/apqClient');
    vi.mocked(executeWithAPQ)
      .mockResolvedValueOnce({
        response: {
          data: { ping: true },
          latencyMs: 1,
          timestamp: 1,
          httpStatus: 200,
        },
        cacheHit: true,
        hash: 'apq-tab1',
        unsupported: false,
      })
      .mockResolvedValueOnce({
        response: {
          data: { pong: true },
          latencyMs: 1,
          timestamp: 1,
          httpStatus: 200,
        },
        cacheHit: false,
        hash: 'apq-tab2',
        unsupported: false,
      });

    const tabs = [makeTab('tab-1'), makeTab('tab-2')];

    const { result, rerender } = renderHook(
      ({ activeTabId }) =>
        useGraphqlStudioTabExecution({
          tabs,
          activeTabId,
        }),
      { initialProps: { activeTabId: 'tab-1' } },
    );

    render(<>{result.current.executionLayers}</>);
    await act(async () => {});

    act(() => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { ping }',
        variables: '{}',
        headers: {},
        apqEnabled: true,
        connectionId: ENDPOINT,
      });
    });

    await waitFor(() => {
      expect(result.current.activeState.apqInfo?.hash).toBe('apq-tab1');
      expect(result.current.activeState.apqInfo?.cacheHit).toBe(true);
    });

    rerender({ activeTabId: 'tab-2' });
    await act(async () => {});

    expect(result.current.activeState.apqInfo).toBeNull();

    act(() => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { pong }',
        variables: '{}',
        headers: {},
        apqEnabled: true,
        connectionId: ENDPOINT,
      });
    });

    await waitFor(() => {
      expect(result.current.activeState.apqInfo?.hash).toBe('apq-tab2');
      expect(result.current.activeState.apqInfo?.cacheHit).toBe(false);
    });

    rerender({ activeTabId: 'tab-1' });
    await act(async () => {});

    expect(result.current.activeState.apqInfo?.hash).toBe('apq-tab1');
    expect(result.current.activeState.apqInfo?.cacheHit).toBe(true);
  });
});
