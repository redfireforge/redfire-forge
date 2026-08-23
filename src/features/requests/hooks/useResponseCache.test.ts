/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { HttpResponse } from '@shared/utils/httpClient';
import {
  useResponseCache,
  pruneResponseCache,
  pruneResponseCacheMany,
  _resetResponseCache,
  _getResponseCacheSize,
} from './useResponseCache';

function makeResponse(status = 200): HttpResponse {
  return { status, statusText: 'OK', headers: {}, body: 'ok', size: 2 } as unknown as HttpResponse;
}

describe('useResponseCache', () => {
  beforeEach(() => {
    _resetResponseCache();
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

  // ── Module singleton behavior ────────────────────────────────

  describe('module singleton', () => {
    it('persists data across hook unmount/remount', () => {
      const { result, unmount } = renderHook(() => useResponseCache('req-persist'));
      act(() => result.current.setResponse(makeResponse(201)));
      act(() => result.current.setResponseTime(42));
      unmount();

      const { result: result2 } = renderHook(() => useResponseCache('req-persist'));
      expect(result2.current.response?.status).toBe(201);
      expect(result2.current.responseTime).toBe(42);
    });

    it('keeps separate caches for different request ids', () => {
      const { result: h1 } = renderHook(() => useResponseCache('req-a'));
      const { result: h2 } = renderHook(() => useResponseCache('req-b'));

      act(() => h1.current.setResponse(makeResponse(200)));
      act(() => h2.current.setResponse(makeResponse(404)));

      expect(h1.current.response?.status).toBe(200);
      expect(h2.current.response?.status).toBe(404);
      expect(_getResponseCacheSize()).toBe(2);
    });
  });

  // ── Pruning ──────────────────────────────────────────────────

  describe('pruneResponseCache', () => {
    it('removes a single request from the singleton', () => {
      const { result, unmount } = renderHook(() => useResponseCache('req-prune'));
      act(() => result.current.setResponse(makeResponse(200)));
      expect(_getResponseCacheSize()).toBe(1);
      unmount();

      pruneResponseCache('req-prune');
      expect(_getResponseCacheSize()).toBe(0);

      const { result: result2 } = renderHook(() => useResponseCache('req-prune'));
      expect(result2.current.response).toBeNull();
    });

    it('is a no-op for an unknown request id', () => {
      pruneResponseCache('nonexistent');
      expect(_getResponseCacheSize()).toBe(0);
    });
  });

  describe('pruneResponseCacheMany', () => {
    it('removes multiple requests at once', () => {
      const { result: h1 } = renderHook(() => useResponseCache('r1'));
      const { result: h2 } = renderHook(() => useResponseCache('r2'));
      const { result: h3 } = renderHook(() => useResponseCache('r3'));

      act(() => {
        h1.current.setResponse(makeResponse(200));
        h2.current.setResponse(makeResponse(201));
        h3.current.setResponse(makeResponse(202));
      });
      expect(_getResponseCacheSize()).toBe(3);

      pruneResponseCacheMany(['r1', 'r3']);
      expect(_getResponseCacheSize()).toBe(1);

      const { result: check } = renderHook(() => useResponseCache('r2'));
      expect(check.current.response?.status).toBe(201);
    });

    it('handles empty iterable gracefully', () => {
      pruneResponseCacheMany([]);
      expect(_getResponseCacheSize()).toBe(0);
    });
  });

  describe('_resetResponseCache', () => {
    it('clears the entire singleton', () => {
      const { result } = renderHook(() => useResponseCache('req-reset'));
      act(() => result.current.setResponse(makeResponse()));
      expect(_getResponseCacheSize()).toBe(1);

      _resetResponseCache();
      expect(_getResponseCacheSize()).toBe(0);
    });
  });
});
