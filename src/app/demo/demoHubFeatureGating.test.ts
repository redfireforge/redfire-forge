import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('demo hub feature gating', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'false');
    // @ts-expect-error - mock window
    global.window = {
      location: { search: '' },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.window = originalWindow;
    vi.resetModules();
  });

  it('DEMO_HUB_ENABLED is false when env flag is false', async () => {
    const { DEMO_HUB_ENABLED } = await import('../../config/features');
    expect(DEMO_HUB_ENABLED).toBe(false);
  });

  it('readTabFromUrl ignores demo-hub when disabled', async () => {
    global.window.location.search = '?tab=demo-hub';
    const { readTabFromUrl } = await import('../utils/appTabUtils');
    expect(readTabFromUrl()).toBe('requests');
  });

  it('isDemoTab returns false when disabled', async () => {
    const { isDemoTab } = await import('../utils/appTabUtils');
    expect(isDemoTab('demo-hub')).toBe(false);
  });

  it('domainOf maps demo-hub to settings when demo is disabled', async () => {
    const { domainOf } = await import('../utils/appTabUtils');
    expect(domainOf('demo-hub')).toBe('settings');
  });

  it('writeTabToUrl drops demo-hub query when disabled', async () => {
    const replaceStateMock = vi.fn();
    // @ts-expect-error - mock window
    global.window = {
      location: {
        href: 'http://localhost:5173/?tab=demo-hub',
        pathname: '/',
        search: '?tab=demo-hub',
        hash: '',
      },
      history: { state: null, replaceState: replaceStateMock },
    };
    const { writeTabToUrl } = await import('../utils/appTabUtils');
    writeTabToUrl('demo-hub');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '/');
  });
});

describe('demo hub feature gating (enabled)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('isDemoTab returns true for demo-hub when enabled', async () => {
    const { isDemoTab } = await import('../utils/appTabUtils');
    expect(isDemoTab('demo-hub')).toBe(true);
  });

  it('domainOf returns demo for demo-hub when enabled', async () => {
    const { domainOf } = await import('../utils/appTabUtils');
    expect(domainOf('demo-hub')).toBe('demo');
  });
});
