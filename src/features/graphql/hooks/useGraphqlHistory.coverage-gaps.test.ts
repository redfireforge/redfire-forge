/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../shared/utils/idbGraphqlHistory', () => ({
  idbSaveHistoryItem: vi.fn().mockResolvedValue(undefined),
  idbLoadHistory: vi.fn().mockResolvedValue([]),
  idbDeleteHistoryItem: vi.fn().mockResolvedValue(undefined),
  idbClearHistory: vi.fn().mockResolvedValue(undefined),
  RESPONSE_CAP_BYTES: 512,
}));

import {
  idbSaveHistoryItem,
  idbLoadHistory,
  idbDeleteHistoryItem,
  idbClearHistory,
} from '../../../shared/utils/idbGraphqlHistory';
import { useGraphqlHistory } from './useGraphqlHistory';
import { GQL_HISTORY_RELOAD_EVENT } from '../utils/gqlDemoCollectionsCleanup';
import type { GraphqlOperation, GraphqlResponse } from '../../../shared/types/graphql';

const op: GraphqlOperation = {
  id: 'op-1',
  query: 'query { hello }',
  variables: '{}',
  operationType: 'query',
  name: 'Hello',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(idbLoadHistory).mockResolvedValue([]);
});

describe('useGraphqlHistory — coverage gaps', () => {
  it('truncates oversized response before save', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const huge: GraphqlResponse = {
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 1,
      timestamp: Date.now(),
      data: { blob: 'x'.repeat(2000) },
    };
    await act(async () => {
      await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: huge });
    });
    expect(idbSaveHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({ response: expect.stringContaining('__TRUNCATED__') }),
      expect.any(Number),
    );
  });

  it('ignores saveHistory when connectionId param is empty', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({
        connectionId: '',
        operation: op,
        response: { httpStatus: 200, httpHeaders: {}, latencyMs: 1, timestamp: 1, data: null },
      });
    });
    expect(idbSaveHistoryItem).not.toHaveBeenCalled();
  });

  it('swallows IDB save errors', async () => {
    vi.mocked(idbSaveHistoryItem).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({
        connectionId: 'conn-1',
        operation: op,
        response: { httpStatus: 200, httpHeaders: {}, latencyMs: 1, timestamp: 1, data: {} },
      });
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('swallows deleteItem IDB errors', async () => {
    vi.mocked(idbDeleteHistoryItem).mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteItem('missing');
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('reloads on GQL_HISTORY_RELOAD_EVENT', async () => {
    const item = {
      id: 'h1',
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    };
    vi.mocked(idbLoadHistory).mockResolvedValueOnce([]).mockResolvedValueOnce([item]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it('clearAll no-ops when connectionId is null', async () => {
    const { result } = renderHook(() => useGraphqlHistory(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.clearAll();
    });
    expect(idbClearHistory).not.toHaveBeenCalled();
  });

  it('clamps maxItems to 10–500 range', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1', 9999));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const items = Array.from({ length: 600 }, (_, i) => ({
      id: `h${i}`,
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: i,
      latencyMs: 1,
      status: 'success' as const,
    }));
    vi.mocked(idbLoadHistory).mockResolvedValue(items);
    const { result: r2 } = renderHook(() => useGraphqlHistory('conn-2', 9999));
    await waitFor(() => expect(r2.current.items.length).toBeLessThanOrEqual(500));
    expect(result.current.items.length).toBeLessThanOrEqual(500);
  });

  it('reload handler clears items when connectionId is null', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{
      id: 'h1',
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    }]);
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useGraphqlHistory(id), {
      initialProps: { id: 'conn-1' as string | null },
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    rerender({ id: null });
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
      await Promise.resolve();
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('initial load swallows IDB errors and clears items', async () => {
    vi.mocked(idbLoadHistory).mockRejectedValueOnce(new Error('idb down'));
    const { result } = renderHook(() => useGraphqlHistory('conn-init-err'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(0);
  });

  it('reload handler swallows IDB load errors', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useGraphqlHistory('conn-err'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(idbLoadHistory).mockRejectedValueOnce(new Error('reload fail'));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
      await Promise.resolve();
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('clearAll clears items when connection matches', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{
      id: 'h-clear',
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    }]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.clearAll(); });
    expect(result.current.items).toHaveLength(0);
    expect(idbClearHistory).toHaveBeenCalledWith('conn-1');
  });

  it('reload handler ignores stale connection results on success', async () => {
    const connBItem = {
      id: 'h-b',
      connectionId: 'conn-b',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    };
    let resolveStaleReload: ((items: unknown[]) => void) | undefined;
    let pendingReload = false;
    vi.mocked(idbLoadHistory).mockImplementation((conn) => {
      if (conn === 'conn-a' && pendingReload) {
        return new Promise((resolve) => { resolveStaleReload = resolve; });
      }
      if (conn === 'conn-b') return Promise.resolve([connBItem]);
      return Promise.resolve([]);
    });
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useGraphqlHistory(id), {
      initialProps: { id: 'conn-a' as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    pendingReload = true;
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
    });
    rerender({ id: 'conn-b' });
    await waitFor(() => expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true));
    await act(async () => {
      resolveStaleReload?.([{
        id: 'stale',
        connectionId: 'conn-a',
        operation: op,
        response: '{}',
        timestamp: 2,
        latencyMs: 1,
        status: 'success' as const,
      }]);
      await Promise.resolve();
    });
    expect(result.current.items.some((i) => i.id === 'stale')).toBe(false);
    expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true);
  });

  it('reload handler ignores stale connection results on error', async () => {
    const connBItem = {
      id: 'h-b',
      connectionId: 'conn-b',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    };
    let rejectStaleReload: ((err: Error) => void) | undefined;
    let pendingReload = false;
    vi.mocked(idbLoadHistory).mockImplementation((conn) => {
      if (conn === 'conn-a' && pendingReload) {
        return new Promise((_, reject) => { rejectStaleReload = reject; });
      }
      if (conn === 'conn-b') return Promise.resolve([connBItem]);
      return Promise.resolve([]);
    });
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useGraphqlHistory(id), {
      initialProps: { id: 'conn-a' as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    pendingReload = true;
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
    });
    rerender({ id: 'conn-b' });
    await waitFor(() => expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true));
    await act(async () => {
      rejectStaleReload?.(new Error('reload fail'));
      await Promise.resolve();
    });
    expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true);
  });

  it('saveHistory prepends item to in-memory list for active connection', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({
        connectionId: 'conn-1',
        operation: op,
        response: { httpStatus: 200, httpHeaders: {}, latencyMs: 1, timestamp: 1, data: { ok: true } },
      });
    });
    expect(result.current.items).toHaveLength(1);
  });

  it('saveHistory skips in-memory update when connection changed before save completes', async () => {
    let resolveSave: (() => void) | undefined;
    vi.mocked(idbSaveHistoryItem).mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; }),
    );
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useGraphqlHistory(id), {
      initialProps: { id: 'conn-a' as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      void result.current.saveHistory({
        connectionId: 'conn-a',
        operation: op,
        response: { httpStatus: 200, httpHeaders: {}, latencyMs: 1, timestamp: 1, data: {} },
      });
      rerender({ id: 'conn-b' });
    });
    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('clearAll keeps items when connection changes before IDB finishes', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{
      id: 'h-b',
      connectionId: 'conn-b',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    }]);
    let finishClear: (() => void) | undefined;
    vi.mocked(idbClearHistory).mockImplementation(
      () => new Promise<void>((resolve) => { finishClear = resolve; }),
    );
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useGraphqlHistory(id), {
      initialProps: { id: 'conn-a' as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { void result.current.clearAll(); });
    rerender({ id: 'conn-b' });
    await waitFor(() => expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true));
    await act(async () => {
      finishClear?.();
      await Promise.resolve();
    });
    expect(result.current.items.some((i) => i.id === 'h-b')).toBe(true);
  });

  it('search filters loaded items', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{
      id: 'h-search',
      connectionId: 'conn-1',
      operation: { ...op, name: 'FindMe' },
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    }]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('findme')).toHaveLength(1);
    expect(result.current.recentItems).toHaveLength(1);
  });

  it('trims in-memory items when maxItems is lowered', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: `h${i}`,
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: i,
      latencyMs: 1,
      status: 'success' as const,
    }));
    vi.mocked(idbLoadHistory).mockResolvedValue(items);
    const { result, rerender } = renderHook(
      ({ max }) => useGraphqlHistory('conn-1', max),
      { initialProps: { max: 100 } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(15));
    rerender({ max: 10 });
    await waitFor(() => expect(result.current.items.length).toBeLessThanOrEqual(10));
  });

  it('deleteItem removes item from state on success', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{
      id: 'h-del',
      connectionId: 'conn-1',
      operation: op,
      response: '{}',
      timestamp: 1,
      latencyMs: 1,
      status: 'success' as const,
    }]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.deleteItem('h-del'); });
    expect(result.current.items).toHaveLength(0);
    expect(idbDeleteHistoryItem).toHaveBeenCalledWith('h-del');
  });
});
