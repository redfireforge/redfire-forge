/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
}));

vi.mock('../utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../utils/saveBatchResultsToHistory', () => ({
  saveBatchResultsToHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/envUtils', () => ({
  findUnresolvedVars: vi.fn(() => []),
  resolveVars: vi.fn((val: string) => val),
}));

import { useGraphqlBatchExecution } from './useGraphqlBatchExecution';
import { saveBatchResultsToHistory } from '../utils/saveBatchResultsToHistory';
import { readKey, writeKey } from '../../../shared/utils/storage';
import type { GqlStudioTab } from '../utils/tabPersistence';

const makeTab = (id: string): GqlStudioTab => ({
  id,
  label: id,
  query: 'query { test }',
  variables: '{}',
  headers: [],
  operationType: 'query',
  modelUri: `inmemory://graphql/${id}`,
  unsavedChanges: false,
});

const baseParams = () => ({
  tabs: [makeTab('t1'), makeTab('t2')] as GqlStudioTab[],
  activeTabId: 't1',
  pageDefaultEndpoint: 'http://localhost/graphql',
  auth: null,
  pageDefaultAuth: null,
  activeEnvironment: null,
  pageDefaultSkipTlsVerify: false,
  advSettingsRef: {
    current: {
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
  },
  setAdvSettings: vi.fn(),
  setBatchUnsupportedToast: vi.fn(),
  setRightView: vi.fn(),
  gqlProxyBase: '',
  profiles: [],
  globalAuthProfiles: [],
  globalEnvMap: {},
});

describe('useGraphqlBatchExecution — coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('handleSetActiveBatchGroup ignores unknown group keys', () => {
    const { result } = renderHook(() => useGraphqlBatchExecution(baseParams()));
    const before = result.current.activeBatchGroupKey;
    act(() => { result.current.handleSetActiveBatchGroup('missing-group'); });
    expect(result.current.activeBatchGroupKey).toBe(before);
  });

  it('handleSetActiveBatchGroup switches to a valid group key when active tab is unset', () => {
    const tabs = [
      { ...makeTab('a1'), endpoint: 'https://a.example.com/graphql' },
      { ...makeTab('a2'), endpoint: 'https://a.example.com/graphql' },
      { ...makeTab('b1'), endpoint: 'https://b.example.com/graphql' },
    ];
    const { result } = renderHook(() =>
      useGraphqlBatchExecution({ ...baseParams(), tabs, activeTabId: null }),
    );
    const groupB = result.current.batchGroups.find((g) => g.tabIds.includes('b1'));
    expect(groupB).toBeDefined();
    act(() => { result.current.handleSetActiveBatchGroup(groupB!.key); });
    expect(result.current.activeBatchGroupKey).toBe(groupB!.key);
  });

  it('handleToggleBatch no-ops for tabs outside active batch group', () => {
    const { result } = renderHook(() => useGraphqlBatchExecution(baseParams()));
    act(() => { result.current.handleToggleBatch('unknown-tab'); });
    expect(result.current.effectiveBatchedTabs).toHaveLength(0);
  });

  it('clears activeBatchGroupKey when batchGroups becomes empty', () => {
    const { result, rerender } = renderHook(
      (props: { tabs: GqlStudioTab[] }) => useGraphqlBatchExecution({ ...baseParams(), tabs: props.tabs }),
      { initialProps: { tabs: [makeTab('t1'), makeTab('t2')] } },
    );
    expect(result.current.activeBatchGroupKey).not.toBeNull();
    rerender({ tabs: [] });
    expect(result.current.activeBatchGroupKey).toBeNull();
  });

  it('does not send batch while batchExecuting is true', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );
    const params = baseParams();
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    act(() => { result.current.handleSendBatch(); });
    expect(result.current.batchExecuting).toBe(true);
    await act(async () => { result.current.handleSendBatch(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('408 timeout uses default 30s label when batchTimeoutMs is invalid', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 408,
      json: async () => ({ results: [] }),
    });
    const params = baseParams();
    params.advSettingsRef.current = {
      ...params.advSettingsRef.current,
      batchTimeoutMs: Number.NaN,
    };
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.batchResult?.results[0].response.errors?.[0].message).toMatch(/30s/);
  });

  it('skips history persistence when historyConnectionId and endpoint are blank', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ data: {} }, { data: {} }] }),
    });
    const saveHistory = vi.fn();
    const params = {
      ...baseParams(),
      pageDefaultEndpoint: '   ',
      saveHistory,
      historyConnectionId: '   ',
    };
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('handleToggleBatch adds and removes tab from effective batch set', () => {
    const { result } = renderHook(() => useGraphqlBatchExecution(baseParams()));
    act(() => { result.current.handleToggleBatch('t1'); });
    expect(result.current.effectiveBatchedTabs.map((t) => t.id)).toContain('t1');
    act(() => { result.current.handleToggleBatch('t1'); });
    expect(result.current.effectiveBatchedTabs.map((t) => t.id)).not.toContain('t1');
  });

  it('handleSendBatch no-ops when fewer than two tabs batched', async () => {
    const { result } = renderHook(() => useGraphqlBatchExecution(baseParams()));
    act(() => { result.current.handleToggleBatch('t1'); });
    await act(async () => { result.current.handleSendBatch(); });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handleSendBatch no-ops when batched tab has blank query', async () => {
    const blankTab = { ...makeTab('t1'), query: '   ' };
    const params = { ...baseParams(), tabs: [blankTab, makeTab('t2')] };
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => { result.current.handleSendBatch(); });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('persists batch unsupported detection to connection storage', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        batchUnsupported: true,
        results: [{ data: {} }, { data: {} }],
      }),
    });
    vi.mocked(readKey).mockResolvedValue(null);
    const params = baseParams();
    const setAdvSettings = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') {
        (updater as (prev: Record<string, unknown>) => Record<string, unknown>)({
          ...params.advSettingsRef.current,
        });
      }
    });
    const setBatchUnsupportedToast = vi.fn();
    const hookParams = { ...params, setAdvSettings, setBatchUnsupportedToast };
    const { result } = renderHook(() => useGraphqlBatchExecution(hookParams));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(setAdvSettings).toHaveBeenCalled();
    expect(setBatchUnsupportedToast).toHaveBeenCalledWith(true);
    expect(writeKey).toHaveBeenCalled();
  });

  it('swallows saveBatchResultsToHistory rejection silently', async () => {
    vi.mocked(saveBatchResultsToHistory).mockRejectedValueOnce(new Error('idb down'));
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ data: {} }, { data: {} }] }),
    });
    const saveHistory = vi.fn();
    const params = {
      ...baseParams(),
      saveHistory,
      historyConnectionId: 'conn-1',
    };
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(saveBatchResultsToHistory).toHaveBeenCalled();
  });

  it('408 timeout attaches partial proxy results when present', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 408,
      json: async () => ({
        batchUnsupported: false,
        results: [{ data: { partial: true } }],
      }),
    });
    const params = baseParams();
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.batchResult?.results[0].response.data).toEqual({ partial: true });
  });

  it('maps non-Error fetch rejection to generic batch failure message', async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('network-down');
    const params = baseParams();
    const { result } = renderHook(() => useGraphqlBatchExecution(params));
    act(() => {
      result.current.handleToggleBatch('t1');
      result.current.handleToggleBatch('t2');
    });
    await act(async () => {
      result.current.handleSendBatch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.batchResult?.results[0].response.errors?.[0].message).toBe('Batch request failed');
  });
});
