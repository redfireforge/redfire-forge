import { afterEach, describe, expect, it, vi } from 'vitest';

describe('demoLiveGuard — coverage gaps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('syncDemoLiveGuard returns false when response is not ok', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('syncDemoLiveGuard returns false when content-type is not json', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: { get: () => 'text/plain' } }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('syncDemoLiveGuard returns false when fetch throws', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('startDemoLiveGuardHeartbeat cleanup runs when interval unavailable', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const saved = globalThis.setInterval;
    // @ts-expect-error — simulate missing timer API
    globalThis.setInterval = undefined;
    const { startDemoLiveGuardHeartbeat } = await import('./demoLiveGuard');
    const cleanup = startDemoLiveGuardHeartbeat('gql-first-query');
    expect(typeof cleanup).toBe('function');
    cleanup();
    globalThis.setInterval = saved;
  });

  it('isAutomatedDemoBrowser returns false when navigator is undefined', async () => {
    vi.stubGlobal('navigator', undefined);
    const { isAutomatedDemoBrowser } = await import('./demoLiveGuard');
    expect(isAutomatedDemoBrowser()).toBe(false);
  });

  it('isPhase8E2eBrowser returns false when window is undefined', async () => {
    const saved = globalThis.window;
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    const { isPhase8E2eBrowser } = await import('./demoLiveGuard');
    expect(isPhase8E2eBrowser()).toBe(false);
    globalThis.window = saved;
  });

  it('shouldSyncDemoLiveGuard returns false when fetch is unavailable', async () => {
    const savedFetch = globalThis.fetch;
    // @ts-expect-error — simulate missing fetch
    delete globalThis.fetch;
    const { shouldSyncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(shouldSyncDemoLiveGuard()).toBe(false);
    globalThis.fetch = savedFetch;
  });

  it('shouldSyncDemoLiveGuard returns false in test mode and for automated browsers', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { shouldSyncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('shouldSyncDemoLiveGuard returns false in default vitest mode', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { shouldSyncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('shouldRunDemoLiveGuardHeartbeat follows shouldSyncDemoLiveGuard', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { shouldRunDemoLiveGuardHeartbeat, shouldSyncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(shouldRunDemoLiveGuardHeartbeat()).toBe(shouldSyncDemoLiveGuard());
  });

  it('isPhase8E2eBrowser returns true when bypass flag is set', async () => {
    vi.stubGlobal('window', { __PHASE8_E2E_SWEEP__: true });
    const { isPhase8E2eBrowser } = await import('./demoLiveGuard');
    expect(isPhase8E2eBrowser()).toBe(true);
  });

  it('syncDemoLiveGuard returns false when active without lessonId', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true)).toBe(false);
  });

  it('syncDemoLiveGuard no-ops in test mode even with valid lessonId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('startDemoLiveGuardHeartbeat cleanup is safe in test mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { startDemoLiveGuardHeartbeat } = await import('./demoLiveGuard');
    const cleanup = startDemoLiveGuardHeartbeat('gql-first-query');
    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncDemoLiveGuard returns true on successful dev-mode POST', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests, DEMO_LIVE_GUARD_ENDPOINT } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      DEMO_LIVE_GUARD_ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('syncDemoLiveGuard deactivates guard without lessonId', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(false)).toBe(true);
  });

  it('shouldSyncDemoLiveGuard returns true in development mode', async () => {
    const { shouldSyncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(shouldSyncDemoLiveGuard()).toBe(true);
  });

  it('startDemoLiveGuardHeartbeat runs interval and cleanup in development mode', async () => {
    const {
      startDemoLiveGuardHeartbeat,
      setDemoLiveGuardEnvForTests,
      DEMO_LIVE_GUARD_HEARTBEAT_MS,
    } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const cleanup = startDemoLiveGuardHeartbeat('gql-first-query');
    await vi.advanceTimersByTimeAsync(DEMO_LIVE_GUARD_HEARTBEAT_MS + 1);
    cleanup();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it('isAutomatedDemoBrowser returns true when webdriver is set', async () => {
    vi.stubGlobal('navigator', { webdriver: true });
    const { isAutomatedDemoBrowser } = await import('./demoLiveGuard');
    expect(isAutomatedDemoBrowser()).toBe(true);
  });

  it('postDemoLiveGuard returns false when shouldSyncDemoLiveGuard is false', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('shouldSyncDemoLiveGuard returns false in production mode', async () => {
    const { shouldSyncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'production', dev: false });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('shouldSyncDemoLiveGuard returns false when test override cleared in test mode', async () => {
    const { shouldSyncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests(undefined);
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('syncDemoLiveGuard returns false when response ok but body is not json', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
    }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('shouldSyncDemoLiveGuard returns false when dev is false in development mode', async () => {
    const { shouldSyncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: false });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('syncDemoLiveGuard returns false for active sync without lessonId in dev mode', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true)).toBe(false);
  });

  it('syncDemoLiveGuard passes keepalive option through postDemoLiveGuard', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests, DEMO_LIVE_GUARD_ENDPOINT } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    await syncDemoLiveGuard(false);
    expect(fetchMock).toHaveBeenCalledWith(
      DEMO_LIVE_GUARD_ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shouldSyncDemoLiveGuard treats DEV string "true" as enabled via override', async () => {
    const { shouldSyncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(shouldSyncDemoLiveGuard()).toBe(true);
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: false });
    expect(shouldSyncDemoLiveGuard()).toBe(false);
  });

  it('syncDemoLiveGuard returns false when fetch rejects in dev mode', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('syncDemoLiveGuard returns false when response is not ok in dev mode', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });

  it('syncDemoLiveGuard returns false when content-type header is missing in dev mode', async () => {
    const { syncDemoLiveGuard, setDemoLiveGuardEnvForTests } = await import('./demoLiveGuard');
    setDemoLiveGuardEnvForTests({ mode: 'development', dev: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: { get: () => null } }));
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    expect(await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' })).toBe(false);
  });
});
