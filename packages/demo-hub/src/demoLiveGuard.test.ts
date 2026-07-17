import { afterEach, describe, expect, it, vi } from 'vitest';

describe('syncDemoLiveGuard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('no-ops in test mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const {
      isAutomatedDemoBrowser,
      shouldRunDemoLiveGuardHeartbeat,
      shouldSyncDemoLiveGuard,
      syncDemoLiveGuard,
    } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(shouldSyncDemoLiveGuard()).toBe(false);
    expect(shouldRunDemoLiveGuardHeartbeat()).toBe(false);
    expect(isAutomatedDemoBrowser()).toBe(false);
  });

  it('no-ops when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    await expect(syncDemoLiveGuard(true)).resolves.toBe(false);
  });

  it('no-ops under Playwright / WebDriver automation', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: true });
    const { isAutomatedDemoBrowser, syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(isAutomatedDemoBrowser()).toBe(true);
    await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-ops when Phase 8 E2E bypass flag is set', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', { __PHASE8_E2E_SWEEP__: true });
    const { isPhase8E2eBrowser, syncDemoLiveGuard, PHASE8_E2E_GUARD_BYPASS_KEY } = await import('./demoLiveGuard');
    expect(PHASE8_E2E_GUARD_BYPASS_KEY).toBe('__PHASE8_E2E_SWEEP__');
    expect(isPhase8E2eBrowser()).toBe(true);
    await syncDemoLiveGuard(true, { lessonId: 'gql-first-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false for active guard sync without lessonId', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('window', {});
    const { syncDemoLiveGuard } = await import('./demoLiveGuard');
    expect(await syncDemoLiveGuard(true)).toBe(false);
    expect(await syncDemoLiveGuard(true, { lessonId: '   ' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
