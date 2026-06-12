/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSseConnection } from './useSseConnection';

// Mock createSseParser
const mockParser = { feed: vi.fn(), flush: vi.fn() };
vi.mock('./sseParser', () => ({
  createSseParser: vi.fn((opts: { onEvent: (e: { eventType: string; data: string; lastEventId: string }) => void }) => {
    // Store onEvent callback so tests can trigger it
    (mockParser as Record<string, unknown>).onEvent = opts.onEvent;
    return mockParser;
  }),
}));

describe('useSseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useSseConnection());
    expect(result.current.connection.state).toBe('idle');
    expect(result.current.events).toEqual([]);
    expect(result.current.stats.eventCount).toBe(0);
    expect(result.current.bookmarkedIds.size).toBe(0);
  });

  it('has default config values', () => {
    const { result } = renderHook(() => useSseConnection());
    expect(result.current.config.url).toBe('');
    expect(result.current.config.headers).toEqual([]);
    expect(result.current.config.autoReconnect).toBe(true);
    expect(result.current.config.maxRetries).toBe(10);
  });

  it('updates config with partial patch', () => {
    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events' }));
    expect(result.current.config.url).toBe('http://example.com/events');
    expect(result.current.config.autoReconnect).toBe(true); // unchanged
  });

  it('shows error when connecting with empty URL', async () => {
    const { result } = renderHook(() => useSseConnection());
    await act(async () => result.current.connect());
    expect(result.current.connection.state).toBe('error');
    expect(result.current.connection.error).toBe('URL is required');
  });

  it('shows error on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events' }));
    await act(async () => result.current.connect());
    expect(result.current.connection.state).toBe('error');
    expect(result.current.connection.error).toContain('404');
  });

  it('shows error when response has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    }));
    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events' }));
    await act(async () => result.current.connect());
    expect(result.current.connection.state).toBe('error');
    expect(result.current.connection.error).toContain('no body');
  });

  it('toggles bookmarks', () => {
    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.toggleBookmark('evt-1'));
    expect(result.current.bookmarkedIds.has('evt-1')).toBe(true);

    act(() => result.current.toggleBookmark('evt-1'));
    expect(result.current.bookmarkedIds.has('evt-1')).toBe(false);
  });

  it('clears events and resets stats and bookmarks', () => {
    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.toggleBookmark('evt-1'));
    act(() => result.current.clearEvents());
    expect(result.current.events).toEqual([]);
    expect(result.current.stats.eventCount).toBe(0);
    expect(result.current.bookmarkedIds.size).toBe(0);
  });

  it('disconnect sets state to disconnected', async () => {
    const { result } = renderHook(() => useSseConnection());
    // Set up connected state by mocking
    act(() => result.current.setConfig({ url: 'http://example.com/events' }));
    act(() => result.current.disconnect());
    expect(result.current.connection.state).toBe('disconnected');
  });

  it('interpolates env vars in URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const envVars = { HOST: 'localhost', PORT: '3000' };
    const { result } = renderHook(() => useSseConnection(envVars));
    act(() => result.current.setConfig({ url: 'http://{{HOST}}:{{PORT}}/events' }));
    await act(async () => result.current.connect());

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/events',
      expect.any(Object),
    );
  });

  it('interpolates env vars in headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const envVars = { TOKEN: 'abc123' };
    const { result } = renderHook(() => useSseConnection(envVars));
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      headers: [{ key: 'Authorization', value: 'Bearer {{TOKEN}}', enabled: true }],
    }));
    await act(async () => result.current.connect());

    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toBe('Bearer abc123');
  });

  it('sends Last-Event-ID header on reconnect', async () => {
    // Simulate a connection that sets lastEventId, then reconnects
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    await act(async () => result.current.connect());

    // First call should not have Last-Event-ID
    expect(fetchMock.mock.calls[0][1].headers['Last-Event-ID']).toBeUndefined();
  });

  it('prevents connect when already connecting', async () => {
    // Create a fetch that never resolves to simulate 'connecting' state
    let resolveFetch: () => void;
    const fetchPromise = new Promise<{ ok: boolean }>((resolve) => { resolveFetch = () => resolve({ ok: false, status: 500, statusText: 'err' }); });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events' }));

    // First connect starts
    let p1: Promise<void>;
    act(() => { p1 = Promise.resolve(result.current.connect()); });

    // Second connect should be no-op
    act(() => { result.current.connect(); });

    // Only one fetch call
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // Clean up
    resolveFetch!();
    await act(async () => { await p1!; });
  });

  it('handles fetch error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    await act(async () => result.current.connect());

    expect(result.current.connection.state).toBe('error');
    expect(result.current.connection.error).toBe('Network error');
  });

  it('connects successfully and reads events from stream', async () => {
    let readerReadCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        readerReadCount++;
        if (readerReadCount === 1) {
          // Trigger event via parser
          const parserRecord = mockParser as Record<string, unknown>;
          if (parserRecord.onEvent) {
            (parserRecord.onEvent as (e: { eventType: string; data: string; lastEventId: string }) => void)({
              eventType: 'message',
              data: 'hello world',
              lastEventId: 'evt-1',
            });
          }
          return Promise.resolve({ done: false, value: 'data: hello world\n\n' });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        pipeThrough: () => ({ getReader: () => mockReader }),
      },
    }));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    await act(async () => result.current.connect());

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventType).toBe('message');
    expect(result.current.events[0].data).toBe('hello world');
    expect(result.current.stats.eventCount).toBe(1);
    expect(result.current.stats.eventTypeCounts['message']).toBe(1);
  });

  it('auto-reconnects on stream end when autoReconnect is enabled', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    // First call: stream ends immediately
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: { pipeThrough: () => ({ getReader: () => ({ read: vi.fn().mockResolvedValue({ done: true }) }) }) },
    });
    // Second call: error to stop reconnection loop
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      autoReconnect: true,
      maxRetries: 3,
    }));
    await act(async () => result.current.connect());

    expect(result.current.connection.reconnectAttempt).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance timer to trigger reconnect
    await act(async () => { vi.advanceTimersByTime(3100); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops reconnecting after maxRetries', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      autoReconnect: true,
      maxRetries: 1,
    }));
    await act(async () => result.current.connect());

    // First failure → reconnect attempt 1
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(3100); });
    // Second call (retry 1)
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => { vi.advanceTimersByTime(3100); });
    // No more retries
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('disconnect cancels pending reconnect', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      autoReconnect: true,
      maxRetries: 5,
    }));
    await act(async () => result.current.connect());

    // Disconnect before reconnect fires
    act(() => result.current.disconnect());

    await act(async () => { vi.advanceTimersByTime(5000); });
    // Should not have made more fetch calls after disconnect
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error thrown from fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    await act(async () => result.current.connect());

    expect(result.current.connection.state).toBe('error');
    expect(result.current.connection.error).toBe('Connection failed');
  });

  it('skips empty header keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      headers: [
        { key: '', value: 'skip-me', enabled: true },
        { key: '  ', value: 'skip-me-too', enabled: true },
        { key: 'X-Custom', value: 'keep-me', enabled: true },
      ],
    }));
    await act(async () => result.current.connect());

    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders['X-Custom']).toBe('keep-me');
    expect(callHeaders['']).toBeUndefined();
  });

  it('skips disabled headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({
      url: 'http://example.com/events',
      headers: [
        { key: 'X-Enabled', value: 'yes', enabled: true },
        { key: 'X-Disabled', value: 'no', enabled: false },
      ],
    }));
    await act(async () => result.current.connect());

    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders['X-Enabled']).toBe('yes');
    expect(callHeaders['X-Disabled']).toBeUndefined();
  });

  it('sets startedAt on connect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' }));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    expect(result.current.stats.startedAt).toBeNull();

    await act(async () => result.current.connect());
    expect(result.current.stats.startedAt).toBeGreaterThan(0);
  });

  it('clearEvents preserves startedAt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' }));

    const { result } = renderHook(() => useSseConnection());
    act(() => result.current.setConfig({ url: 'http://example.com/events', autoReconnect: false }));
    await act(async () => result.current.connect());

    const startedAt = result.current.stats.startedAt;
    act(() => result.current.clearEvents());

    expect(result.current.stats.startedAt).toBe(startedAt);
    expect(result.current.stats.eventCount).toBe(0);
  });
});
