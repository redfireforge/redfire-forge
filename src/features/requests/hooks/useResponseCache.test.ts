/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { useResponseCache } from './useResponseCache';

function makeResponse(status = 200): HttpResponse {
  return { status, statusText: 'OK', headers: {}, body: 'ok', size: 2 } as unknown as HttpResponse;
}

describe('useResponseCache', () => {
  beforeEach(() => {
    // each test uses a fresh hook instance, cacheRef is per-instance
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    expect(result.current.response).toBeNull();
    expect(result.current.responseTime).toBe(0);
    expect(result.current.sendAllResults).toBeNull();
    expect(result.current.consoleLines).toEqual([]);
    expect(result.current.history).toEqual([]);
  });

  it('sets response, time, sendAll and console lines', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    act(() => {
      result.current.setResponse(makeResponse());
      result.current.setResponseTime(123);
      result.current.setSendAllResults([{ envName: 'dev', response: makeResponse(), time: 5 }]);
      result.current.setConsoleLines([{ type: 'log', text: 'hi' } as never]);
    });
    expect(result.current.response?.status).toBe(200);
    expect(result.current.responseTime).toBe(123);
    expect(result.current.sendAllResults).toHaveLength(1);
    expect(result.current.consoleLines).toHaveLength(1);
  });

  it('pushes, restores and deletes history entries', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    let id = '';
    act(() => {
      id = result.current.pushHistory({
        timestamp: Date.now(), method: 'GET', url: '/a',
        response: makeResponse(201), responseTime: 9, consoleLines: [],
      });
    });
    expect(result.current.history).toHaveLength(1);

    act(() => result.current.setResponse(null));
    act(() => result.current.restoreFromHistory(id));
    expect(result.current.response?.status).toBe(201);

    act(() => result.current.deleteHistoryEntry(id));
    expect(result.current.history).toHaveLength(0);
  });

  it('restoreFromHistory is a no-op for an unknown id', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    act(() => result.current.setResponse(makeResponse(200)));
    act(() => result.current.restoreFromHistory('missing'));
    expect(result.current.response?.status).toBe(200);
  });

  it('caps history at 10 entries', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    act(() => {
      for (let i = 0; i < 12; i++) {
        result.current.pushHistory({
          timestamp: i, method: 'GET', url: `/a${i}`,
          response: makeResponse(), responseTime: i, consoleLines: [],
        });
      }
    });
    expect(result.current.history).toHaveLength(10);
  });

  it('clears history and resets current response', () => {
    const { result } = renderHook(() => useResponseCache('req-1'));
    act(() => {
      result.current.setResponse(makeResponse());
      result.current.pushHistory({ timestamp: 1, method: 'GET', url: '/a', response: makeResponse(), responseTime: 1, consoleLines: [] });
    });
    act(() => result.current.clearHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.response).toBeNull();
  });

  it('syncs from the per-request cache when the request id changes', () => {
    const { result, rerender } = renderHook(({ id }) => useResponseCache(id), {
      initialProps: { id: 'req-1' },
    });
    act(() => result.current.setResponse(makeResponse(200)));
    rerender({ id: 'req-2' });
    expect(result.current.response).toBeNull();
    rerender({ id: 'req-1' });
    expect(result.current.response?.status).toBe(200);
  });
});
