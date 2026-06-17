/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocketMockServer } from './useWebSocketMockServer';
import type { WsMockRule, WsMockStatus, WsMockLogEntry } from '../../shared/websocket/types';

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadMockRules: vi.fn(),
  saveMockRules: vi.fn(),
  loadMockConfig: vi.fn(),
  saveMockConfig: vi.fn(),
}));

import { loadMockRules, saveMockRules, loadMockConfig, saveMockConfig } from '../../shared/websocket/websocketStorage';

const mockedLoadMockRules = vi.mocked(loadMockRules);
const mockedSaveMockRules = vi.mocked(saveMockRules);
const mockedLoadMockConfig = vi.mocked(loadMockConfig);
const mockedSaveMockConfig = vi.mocked(saveMockConfig);

function makeMockRule(overrides: Partial<WsMockRule> = {}): WsMockRule {
  return {
    id: 'r1',
    name: 'Echo rule',
    enabled: true,
    match: { type: 'any', pattern: '' },
    response: { type: 'echo' },
    ...overrides,
  };
}

function makeStatus(overrides: Partial<WsMockStatus> = {}): WsMockStatus {
  return { running: false, port: 9876, clientCount: 0, clients: [], ...overrides };
}

function mockFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    status: 200,
    json: () => Promise.resolve({ ok, data, error: ok ? undefined : { message: String(data) } }),
  } as Response);
}

function mockFetchFailure(message: string) {
  return Promise.resolve({
    status: 200,
    json: () => Promise.resolve({ ok: false, error: { message } }),
  } as Response);
}

function mockFetchNetworkError() {
  return Promise.reject(new Error('Network error'));
}

describe('useWebSocketMockServer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockedLoadMockRules.mockResolvedValue([]);
    mockedLoadMockConfig.mockResolvedValue(null);
    mockedSaveMockRules.mockResolvedValue(undefined);
    mockedSaveMockConfig.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── Initial state ──────────────────────────────────────────────────
  it('initializes with default state', () => {
    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    expect(result.current.status.running).toBe(false);
    expect(result.current.logs).toEqual([]);
    expect(result.current.rules).toEqual([]);
    expect(result.current.config).toEqual({ port: 9876, fallback: 'echo' });
    expect(result.current.starting).toBe(false);
  });

  it('loads saved rules and config on mount', async () => {
    const savedRules = [makeMockRule()];
    mockedLoadMockRules.mockResolvedValue(savedRules);
    mockedLoadMockConfig.mockResolvedValue({ port: 1234, fallback: 'ignore' });

    const { result } = renderHook(() => useWebSocketMockServer(9876, false));

    // Flush the async init effect
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.rules).toEqual(savedRules);
    expect(result.current.config).toEqual({ port: 1234, fallback: 'ignore' });
  });

  // ── setRules ───────────────────────────────────────────────────────
  it('setRules updates rules and saves to storage', async () => {
    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    const newRules = [makeMockRule({ id: 'r2', name: 'New' })];
    act(() => { result.current.setRules(newRules); });

    expect(result.current.rules).toEqual(newRules);
    expect(mockedSaveMockRules).toHaveBeenCalledWith(9876, newRules);
  });

  // ── setConfig ──────────────────────────────────────────────────────
  it('setConfig updates config and saves to storage', async () => {
    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    const newConfig = { port: 5555, fallback: 'close' as const };
    act(() => { result.current.setConfig(newConfig); });

    expect(result.current.config).toEqual(newConfig);
    expect(mockedSaveMockConfig).toHaveBeenCalledWith(9876, newConfig);
  });

  // ── start ──────────────────────────────────────────────────────────
  describe('start', () => {
    it('calls POST /api/ws/mock/start and updates status', async () => {
      const runningStatus = makeStatus({ running: true, port: 9876 });
      const fetchMock = vi.fn()
        // init polling calls (status + log)
        .mockImplementation((url: string) => {
          if (typeof url === 'string' && url.includes('/start')) {
            return mockFetchResponse(runningStatus);
          }
          if (typeof url === 'string' && url.includes('/status')) {
            return mockFetchResponse(runningStatus);
          }
          if (typeof url === 'string' && url.includes('/log')) {
            return mockFetchResponse({ entries: [], cursor: 0 });
          }
          return mockFetchResponse({});
        });
      vi.stubGlobal('fetch', fetchMock);

      const { result } = renderHook(() => useWebSocketMockServer(9876, false));
      await act(async () => { await vi.runAllTimersAsync(); });

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.status.running).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ws/mock/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sets error status on start failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/start')) {
          return mockFetchFailure('Port in use');
        }
        return mockFetchResponse({});
      }));

      const { result } = renderHook(() => useWebSocketMockServer(9876, false));
      await act(async () => { await vi.runAllTimersAsync(); });

      let caught: Error | null = null;
      await act(async () => {
        try {
          await result.current.start();
        } catch (err) {
          caught = err as Error;
        }
      });

      expect(caught).not.toBeNull();
      expect(caught!.message).toBe('Port in use');
      expect(result.current.status.running).toBe(false);
      expect(result.current.status.error).toBe('Port in use');
    });
  });

  // ── stop ───────────────────────────────────────────────────────────
  describe('stop', () => {
    it('calls POST /api/ws/mock/stop and updates status', async () => {
      const stoppedStatus = makeStatus({ running: false });
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/stop')) {
          return mockFetchResponse(stoppedStatus);
        }
        return mockFetchResponse({});
      }));

      const { result } = renderHook(() => useWebSocketMockServer(9876, false));
      await act(async () => { await vi.runAllTimersAsync(); });

      await act(async () => {
        await result.current.stop();
      });

      expect(result.current.status.running).toBe(false);
    });

    it('sets error when stop fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/stop')) {
          return mockFetchFailure('Failed');
        }
        return mockFetchResponse({});
      }));

      const { result } = renderHook(() => useWebSocketMockServer(9876, false));
      await act(async () => { await vi.runAllTimersAsync(); });

      await act(async () => {
        await result.current.stop();
      });

      expect(result.current.status.running).toBe(false);
      expect(result.current.status.error).toContain('stop');
    });
  });

  // ── broadcast ──────────────────────────────────────────────────────
  it('broadcast calls POST /api/ws/mock/broadcast and returns sent count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/broadcast')) {
        return mockFetchResponse({ sent: 3 });
      }
      return mockFetchResponse({});
    }));

    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    let count: number = 0;
    await act(async () => {
      count = await result.current.broadcast('hello');
    });

    expect(count).toBe(3);
  });

  // ── clearLogs ──────────────────────────────────────────────────────
  it('clearLogs empties the logs array', async () => {
    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.clearLogs(); });
    expect(result.current.logs).toEqual([]);
  });

  // ── pushRulesToServer ──────────────────────────────────────────────
  it('pushRulesToServer sends rules to server', async () => {
    const fetchMock = vi.fn().mockImplementation(() => mockFetchResponse({ count: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    const rules = [makeMockRule()];
    await act(async () => {
      await result.current.pushRulesToServer(rules, 'echo');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ws/mock/rules',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('pushRulesToServer silently catches errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { result } = renderHook(() => useWebSocketMockServer(9876, false));
    await act(async () => { await vi.runAllTimersAsync(); });

    // Should not throw
    await act(async () => {
      await result.current.pushRulesToServer([], 'echo');
    });
  });

  // ── Polling ────────────────────────────────────────────────────────
  describe('polling', () => {
    it('starts polling when active=true', async () => {
      vi.useRealTimers(); // polling uses setInterval with async callbacks
      const statusResp = makeStatus({ running: true, clientCount: 2 });
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/status')) {
          return mockFetchResponse(statusResp);
        }
        if (typeof url === 'string' && url.includes('/log')) {
          return mockFetchResponse({ entries: [], cursor: 0 });
        }
        return mockFetchResponse({});
      });
      vi.stubGlobal('fetch', fetchMock);

      const { result } = renderHook(() => useWebSocketMockServer(9876, true));

      // Initial poll fires immediately on mount
      await waitFor(() => {
        expect(result.current.status.running).toBe(true);
      });
    });

    it('stops polling when active changes to false', async () => {
      vi.useRealTimers();
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/status')) {
          return mockFetchResponse(makeStatus());
        }
        if (typeof url === 'string' && url.includes('/log')) {
          return mockFetchResponse({ entries: [], cursor: 0 });
        }
        return mockFetchResponse({});
      });
      vi.stubGlobal('fetch', fetchMock);

      const { result: _result, rerender } = renderHook(
        ({ active }) => useWebSocketMockServer(9876, active),
        { initialProps: { active: true } },
      );

      // Wait for initial poll
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const callCountBefore = fetchMock.mock.calls.length;
      rerender({ active: false });

      // Wait a bit, verify no more calls
      await new Promise((r) => setTimeout(r, 100));
      const callCountAfter = fetchMock.mock.calls.length;
      expect(callCountAfter - callCountBefore).toBeLessThanOrEqual(1);
    });

    it('sets error status when backend is unreachable during status poll', async () => {
      vi.useRealTimers();
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/status')) {
          callCount++;
          if (callCount === 1) {
            return mockFetchResponse(makeStatus({ running: true }));
          }
          return mockFetchNetworkError();
        }
        if (typeof url === 'string' && url.includes('/log')) {
          return mockFetchResponse({ entries: [], cursor: 0 });
        }
        return mockFetchResponse({});
      });
      vi.stubGlobal('fetch', fetchMock);

      const { result } = renderHook(() => useWebSocketMockServer(9876, true));

      // First poll: running=true
      await waitFor(() => {
        expect(result.current.status.running).toBe(true);
      });

      // Wait for next poll to trigger error
      await waitFor(() => {
        expect(result.current.status.error).toBe('Backend unreachable');
      }, { timeout: 5000 });
    });

    it('appends log entries from polling', async () => {
      vi.useRealTimers();
      const logEntries: WsMockLogEntry[] = [
        { id: 1, ts: new Date().toISOString(), event: 'server-start' },
        { id: 2, ts: new Date().toISOString(), event: 'client-connect', clientId: 'c1' },
      ];
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/status')) {
          return mockFetchResponse(makeStatus({ running: true }));
        }
        if (typeof url === 'string' && url.includes('/log')) {
          return mockFetchResponse({ entries: logEntries, cursor: 2 });
        }
        return mockFetchResponse({});
      });
      vi.stubGlobal('fetch', fetchMock);

      const { result } = renderHook(() => useWebSocketMockServer(9876, true));

      await waitFor(() => {
        expect(result.current.logs.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 5000 });
    });
  });
});
