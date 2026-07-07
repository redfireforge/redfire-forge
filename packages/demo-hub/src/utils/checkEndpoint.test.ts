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

  it('uses localhost for WS health fallback before trying IPv4 loopback', async () => {
    const spy = mockFetch(true);
    const promise = checkEndpoint('ws://localhost:3100/socket.io/?EIO=4');
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
    expect(spy).toHaveBeenCalledWith('http://localhost:3100/health', expect.any(Object));
  });

  it('falls back to 127.0.0.1 when localhost probe fails', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('localhost unreachable'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const promise = checkEndpoint('http://localhost:3001/health');
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
    expect(spy).toHaveBeenNthCalledWith(1, 'http://localhost:3001/health', expect.any(Object));
    expect(spy).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:3001/health', expect.any(Object));
  });

  it('uses Express Spring health proxy for actuator checks when available', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const promise = checkEndpoint('http://localhost:8080/actuator/health');
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
    expect(spy).toHaveBeenCalledWith('http://localhost:3001/health/spring', expect.any(Object));
  });

  it('settle guard prevents double-resolve when both timeout and open fire', async () => {
    mockFetchReject();

    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) {
        // Fire onopen at 50ms AND the timeout at 100ms — settle must only resolve once
        setTimeout(() => this.onopen?.(), 50);
      }
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/', 100);
    // Advance past both the onopen timer (50ms) and the settle timer (100ms)
    await vi.advanceTimersByTimeAsync(300);
    // Should resolve true (from onopen) — settle guard prevents second resolve from timeout
    expect(await promise).toBe(true);
    vi.unstubAllGlobals();
  });

  it('settle guard fires when onopen and onerror both fire in same tick (line 32 true branch)', async () => {
    mockFetchReject();

    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) {
        // Fire both callbacks in the same tick — second settle call must hit the guard
        setTimeout(() => {
          this.onopen?.();   // settle(true) — settled = true
          this.onerror?.();  // settle(false) — if (settled) return; (line 32 true branch)
        }, 50);
      }
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/', 3000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toBe(true); // resolves from onopen
    vi.unstubAllGlobals();
  });

  it('ignores ws.close() throwing (defensive catch branch)', async () => {
    mockFetchReject();

    class FakeWS {
      onopen:  (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_url: string) { setTimeout(() => this.onerror?.(), 50); }
      close() { throw new Error('already closed'); }
    }
    vi.stubGlobal('WebSocket', FakeWS);

    const promise = checkEndpoint('ws://localhost:3100/', 3000);
    await vi.advanceTimersByTimeAsync(200);
    // ws.close() throws but the error is swallowed — should still resolve false
    expect(await promise).toBe(false);
    vi.unstubAllGlobals();
  });
});
