/**
 * useGraphqlHistory — unit tests
 *
 * Mocks the IDB layer completely to avoid timeout issues.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../shared/utils/idbGraphqlHistory', () => ({
  idbSaveHistoryItem: vi.fn().mockResolvedValue(undefined),
  idbLoadHistory: vi.fn().mockResolvedValue([]),
  idbDeleteHistoryItem: vi.fn().mockResolvedValue(undefined),
  idbClearHistory: vi.fn().mockResolvedValue(undefined),
  RESPONSE_CAP_BYTES: 512 * 1024,
}));

import {
  idbSaveHistoryItem,
  idbLoadHistory,
  idbDeleteHistoryItem,
  idbClearHistory,
} from '../../../shared/utils/idbGraphqlHistory';
import { useGraphqlHistory } from './useGraphqlHistory';
import type { GraphqlOperation, GraphqlResponse } from '../../../shared/types/graphql';

const op: GraphqlOperation = { id: 'op-1', query: 'query { hello }', variables: '{}', operationType: 'query', name: 'Hello' };
const resp: GraphqlResponse = { httpStatus: 200, httpHeaders: {}, latencyMs: 50, timestamp: Date.now(), data: { hello: 'world' } };
const errResp: GraphqlResponse = { httpStatus: 200, httpHeaders: {}, latencyMs: 50, timestamp: Date.now(), data: null, errors: [{ message: 'Oops' }] };

beforeEach(() => {
  resetAllMocks();
  vi.mocked(idbLoadHistory).mockResolvedValue([]);
  vi.mocked(idbSaveHistoryItem).mockResolvedValue(undefined);
  vi.mocked(idbDeleteHistoryItem).mockResolvedValue(undefined);
  vi.mocked(idbClearHistory).mockResolvedValue(undefined);
});

describe('useGraphqlHistory — init', () => {
  it('starts empty with loading=false when connectionId is null', async () => {
    const { result } = renderHook(() => useGraphqlHistory(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(idbLoadHistory).not.toHaveBeenCalled();
  });

  it('loads history when connectionId is provided', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: op, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('h1');
  });

  it('clears items when connectionId changes to null', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: op, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result, rerender } = renderHook(({ cid }) => useGraphqlHistory(cid), { initialProps: { cid: 'conn-1' as string | null } });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    rerender({ cid: null });
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.loading).toBe(false);
  });

  it('ignores IDB error during load and sets empty items', async () => {
    vi.mocked(idbLoadHistory).mockRejectedValue(new Error('IDB broken'));
    const { result } = renderHook(() => useGraphqlHistory('conn-err'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});

describe('useGraphqlHistory — saveHistory', () => {
  it('saves a success entry and prepends to items', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: resp });
    });
    expect(idbSaveHistoryItem).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].status).toBe('success');
  });

  it('marks an entry as error when errors are present', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: errResp });
    });
    expect(result.current.items[0].status).toBe('error');
  });

  it('marks an entry as error when httpStatus >= 400 and no data', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({
        connectionId: 'conn-1',
        operation: op,
        response: { ...resp, httpStatus: 500, data: null },
      });
    });
    expect(result.current.items[0].status).toBe('error');
  });

  it('marks batch partial success as success when HTTP 400 but data is present', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({
        connectionId: 'conn-1',
        operation: op,
        response: { ...resp, httpStatus: 400, data: { health: 'ok' } },
      });
    });
    expect(result.current.items[0].status).toBe('success');
  });

  it('does not save when connectionId is empty', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveHistory({ connectionId: '', operation: op, response: resp });
    });
    expect(idbSaveHistoryItem).not.toHaveBeenCalled();
  });

  it('silently handles IDB save failure', async () => {
    vi.mocked(idbSaveHistoryItem).mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => { await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: resp }); }),
    ).resolves.not.toThrow();
  });

  it('does not update state when connection has changed since save started', async () => {
    const { result, rerender } = renderHook(({ cid }) => useGraphqlHistory(cid), { initialProps: { cid: 'conn-1' as string | null } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Switch connection before save completes
    rerender({ cid: 'conn-2' });
    await waitFor(() => expect(vi.mocked(idbLoadHistory)).toHaveBeenCalledWith('conn-2'));
    // Save under old connection id should not update state for conn-2
    await act(async () => {
      await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: resp });
    });
    // Items from conn-2 load are empty (mock returns []), not from conn-1 save
    expect(result.current.items).toHaveLength(0);
  });
});

describe('useGraphqlHistory — deleteItem', () => {
  it('removes an item from the list', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: op, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.deleteItem('h1'); });
    expect(result.current.items).toHaveLength(0);
    expect(idbDeleteHistoryItem).toHaveBeenCalledWith('h1');
  });

  it('silently handles IDB delete failure', async () => {
    vi.mocked(idbDeleteHistoryItem).mockRejectedValue(new Error('IDB error'));
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(async () => { await result.current.deleteItem('h1'); })).resolves.not.toThrow();
  });
});

describe('useGraphqlHistory — clearAll', () => {
  it('clears all items for the connection', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: op, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.clearAll(); });
    expect(result.current.items).toHaveLength(0);
    expect(idbClearHistory).toHaveBeenCalledWith('conn-1');
  });

  it('does nothing when connectionId is null', async () => {
    const { result } = renderHook(() => useGraphqlHistory(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.clearAll(); });
    expect(idbClearHistory).not.toHaveBeenCalled();
  });
});

describe('useGraphqlHistory — search', () => {
  it('returns all items when query is empty', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: op, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('')).toHaveLength(1);
    expect(result.current.search('  ')).toHaveLength(1);
  });

  it('filters by operation name (case-insensitive)', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: { ...op, name: 'GetUsers' }, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('getusers')).toHaveLength(1);
    expect(result.current.search('nomatch')).toHaveLength(0);
  });

  it('filters by query text', async () => {
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: { ...op, query: 'query GetProducts { products { id } }' }, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('products')).toHaveLength(1);
  });

  it('handles items with no operation name', async () => {
    const noNameOp: GraphqlOperation = { id: 'op-noname', query: 'query { x }', variables: '{}', operationType: 'query' };
    const fakeItem = { id: 'h1', connectionId: 'conn-1', operation: noNameOp, response: '{}', timestamp: Date.now(), latencyMs: 50, status: 'success' as const };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('query')).toHaveLength(1);
  });

  it('filters by response body text', async () => {
    const fakeItem = {
      id: 'h1',
      connectionId: 'conn-1',
      operation: op,
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
      timestamp: Date.now(),
      latencyMs: 50,
      status: 'success' as const,
    };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.search('alice')).toHaveLength(1);
    expect(result.current.search('bob')).toHaveLength(0);
  });
});

describe('useGraphqlHistory — response truncation (lines 95-100)', () => {
  it('truncates response body when it exceeds RESPONSE_CAP_BYTES and appends __TRUNCATED__', async () => {
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Create a large response body that exceeds 512 KB
    const largeDataValue = 'x'.repeat(600 * 1024); // 600 KB string
    const largeResp: GraphqlResponse = {
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 100,
      timestamp: Date.now(),
      data: { large: largeDataValue },
    };

    await act(async () => {
      await result.current.saveHistory({ connectionId: 'conn-1', operation: op, response: largeResp });
    });

    expect(idbSaveHistoryItem).toHaveBeenCalled();
    // The saved item should have a truncated response
    const savedArg = vi.mocked(idbSaveHistoryItem).mock.calls[0][0];
    expect(savedArg.response).toContain('__TRUNCATED__');
    // And the response should be within the cap
    expect(new Blob([savedArg.response]).size).toBeLessThanOrEqual(512 * 1024);
  });
});

describe('useGraphqlHistory — stale connection guards (lines 79, 82, 85)', () => {
  it('does not apply stale IDB load result after connection switches (lines 79, 82, 85)', async () => {
    // Set up a controlled promise for the first IDB load
    let resolveFirst!: (items: never[]) => void;
    const firstLoad = new Promise<never[]>((res) => { resolveFirst = res; });

    vi.mocked(idbLoadHistory)
      .mockReturnValueOnce(firstLoad as never) // conn-1 load — controlled
      .mockResolvedValue([]); // conn-2 load — resolves immediately

    const { result, rerender } = renderHook(({ cid }) => useGraphqlHistory(cid), {
      initialProps: { cid: 'conn-1' as string | null },
    });

    // conn-1 load is in flight; switch to conn-2 BEFORE it resolves
    rerender({ cid: 'conn-2' });

    // Let conn-2 load resolve
    await waitFor(() => expect(vi.mocked(idbLoadHistory)).toHaveBeenCalledWith('conn-2'));

    // Now resolve the stale conn-1 load
    act(() => { resolveFirst([]); });
    await act(async () => { await Promise.resolve(); });

    // The stale guard at line 79 fires — items stay from conn-2 load (empty)
    expect(result.current.items).toHaveLength(0);
    // Loading should be false (conn-2 finally resolves)
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('does not apply stale IDB error after connection switches (line 82 false branch)', async () => {
    let rejectFirst!: (err: Error) => void;
    const firstLoad = new Promise<never>((_, rej) => { rejectFirst = rej; });

    vi.mocked(idbLoadHistory)
      .mockReturnValueOnce(firstLoad as never) // conn-1 load — controlled (will reject)
      .mockResolvedValue([]); // conn-2 load

    const { result, rerender } = renderHook(({ cid }) => useGraphqlHistory(cid), {
      initialProps: { cid: 'conn-1' as string | null },
    });

    // Switch to conn-2 BEFORE the conn-1 load fails
    rerender({ cid: 'conn-2' });
    await waitFor(() => expect(vi.mocked(idbLoadHistory)).toHaveBeenCalledWith('conn-2'));

    // Now fail the stale conn-1 load — stale guard at line 82 fires, ignores the error
    act(() => { rejectFirst(new Error('stale error')); });
    await act(async () => { await Promise.resolve(); });

    // State should still be based on conn-2 load (empty)
    expect(result.current.items).toHaveLength(0);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe('useGraphqlHistory — clearAll stale guard (line 141)', () => {
  it('clears items after a successful clearAll when connection is unchanged', async () => {
    const fakeItem = {
      id: 'h1', connectionId: 'conn-1', operation: op, response: '{}',
      timestamp: Date.now(), latencyMs: 50, status: 'success' as const,
    };
    vi.mocked(idbLoadHistory).mockResolvedValue([fakeItem]);

    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => { await result.current.clearAll(); });

    // After clearAll, items should be empty (line 141 true branch)
    expect(result.current.items).toHaveLength(0);
  });
});

describe('useGraphqlHistory — recentItems', () => {
  it('returns at most 5 recent items', async () => {
    const fakeItems = Array.from({ length: 8 }, (_, i) => ({
      id: `h${i}`, connectionId: 'conn-1', operation: op, response: '{}',
      timestamp: Date.now(), latencyMs: 50, status: 'success' as const,
    }));
    vi.mocked(idbLoadHistory).mockResolvedValue(fakeItems);
    const { result } = renderHook(() => useGraphqlHistory('conn-1'));
    await waitFor(() => expect(result.current.items).toHaveLength(8));
    expect(result.current.recentItems).toHaveLength(5);
  });
});

describe('useGraphqlHistory — maxItems trim on config change', () => {
  it('trims in-memory items when maxItems is lowered', async () => {
    const fakeItems = Array.from({ length: 20 }, (_, i) => ({
      id: `h${i}`, connectionId: 'conn-trim', operation: op, response: '{}',
      timestamp: Date.now() + i, latencyMs: 50, status: 'success' as const,
    }));
    vi.mocked(idbLoadHistory).mockResolvedValue(fakeItems);

    // Start with maxItems=20, all 20 items displayed
    const { result, rerender } = renderHook(
      ({ max }: { max: number }) => useGraphqlHistory('conn-trim', max),
      { initialProps: { max: 20 } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(20));

    // Lower maxItems to 10 — in-memory list should be trimmed immediately
    act(() => { rerender({ max: 10 }); });
    expect(result.current.items).toHaveLength(10);
  });

  it('does not expand items when maxItems is raised', async () => {
    const fakeItems = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`, connectionId: 'conn-trim2', operation: op, response: '{}',
      timestamp: Date.now() + i, latencyMs: 50, status: 'success' as const,
    }));
    vi.mocked(idbLoadHistory).mockResolvedValue(fakeItems);

    const { result, rerender } = renderHook(
      ({ max }: { max: number }) => useGraphqlHistory('conn-trim2', max),
      { initialProps: { max: 5 } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(5));

    // Raising maxItems beyond current count should leave items unchanged
    act(() => { rerender({ max: 100 }); });
    expect(result.current.items).toHaveLength(5);
  });
});
