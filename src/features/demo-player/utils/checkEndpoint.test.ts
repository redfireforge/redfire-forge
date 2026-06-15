/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkEndpoint } from './checkEndpoint';

// ─── Helpers ────────────────────────────────────────────────────

function mockFetch(ok: boolean) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(null, { status: ok ? 200 : 503 }),
  );
}

function mockFetchReject() {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
}

// ─── Tests ──────────────────────────────────────────────────────

describe('checkEndpoint', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('returns true when HTTP health check succeeds', async () => {
    mockFetch(true);
    const promise = checkEndpoint('ws://localhost:3100/socket.io/?EIO=4');
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
  });

  it('falls back to WS probe when HTTP health fails, returns true on WS open', async () => {
    mockFetchReject();

    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) { setTimeout(() => this.onopen?.(), 50); }
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/socket.io/?EIO=4', 3000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false when both HTTP and WS fail', async () => {
    mockFetchReject();
    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) { setTimeout(() => this.onerror?.(), 50); }
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/', 3000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toBe(false);
    vi.unstubAllGlobals();
  });

  it('returns false when WS times out', async () => {
    mockFetchReject();
    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) { /* never fires */ }
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/', 500);
    await vi.advanceTimersByTimeAsync(600);
    expect(await promise).toBe(false);
    vi.unstubAllGlobals();
  });

  it('accepts http:// URL and uses HTTP path directly', async () => {
    const spy = mockFetch(true);
    const promise = checkEndpoint('http://localhost:4100/health');
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
    expect(spy).toHaveBeenCalledWith('http://localhost:4100/health', expect.any(Object));
  });
});
