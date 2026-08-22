/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { wipeBridge, restoreBridge, collapse, patchBridge, importBridge, settingsBridge, blankBridge, secretsBridge, listBridge, upsertSamplesBridge } = vi.hoisted(() => ({
  wipeBridge: vi.fn(async () => true),
  restoreBridge: vi.fn(async () => true),
  collapse: vi.fn(),
  patchBridge: vi.fn(() => true),
  importBridge: vi.fn(async () => true),
  settingsBridge: vi.fn(() => true),
  blankBridge: vi.fn(async () => true),
  secretsBridge: vi.fn(async () => true),
  listBridge: vi.fn(async () => [{ id: 'srv-live', name: 'Cart API', port: 4601, active: true }]),
  upsertSamplesBridge: vi.fn(() => true),
}));

vi.mock('./bridgeWindow', () => ({
  getDemoBridgeWindow: () => ({
    __demoWipeApiMockWorkspace: wipeBridge,
    __demoRestoreApiMockUserWorkspace: restoreBridge,
    __demoListApiMockServers: listBridge,
    __demoCollapseAppSidebar: collapse,
    __demoPatchApiMockActiveRoute: patchBridge,
    __demoPatchApiMockServerSettings: settingsBridge,
    __demoImportApiMockGallerySample: importBridge,
    __demoEnsureBlankApiMockServer: blankBridge,
    __demoSeedApiMockExportSecrets: secretsBridge,
    __demoUpsertApiMockServerSamples: upsertSamplesBridge,
  }),
}));

vi.mock('./appShellAdapter', () => ({
  collapseAppSidebar: (...args: unknown[]) => collapse(...args),
}));

describe('apiMockStudioAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wipes, imports gallery, patches route, and prepares chrome', async () => {
    const {
      wipeApiMockWorkspace,
      restoreApiMockUserWorkspace,
      listApiMockStudioServers,
      prepareApiMockStudioChrome,
      patchApiMockActiveRoute,
      importApiMockGallerySample,
      ensureBlankApiMockServer,
      seedApiMockExportSecrets,
    } = await import('./apiMockStudioAdapter');
    await expect(wipeApiMockWorkspace()).resolves.toBe(true);
    expect(wipeBridge).toHaveBeenCalled();
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect(restoreBridge).toHaveBeenCalled();
    await expect(listApiMockStudioServers()).resolves.toEqual([
      { id: 'srv-live', name: 'Cart API', port: 4601, active: true },
    ]);
    expect(listBridge).toHaveBeenCalled();
    await expect(importApiMockGallerySample('am-gallery-health')).resolves.toBe(true);
    expect(importBridge).toHaveBeenCalledWith('am-gallery-health');
    await expect(ensureBlankApiMockServer()).resolves.toBe(true);
    expect(blankBridge).toHaveBeenCalled();
    await expect(seedApiMockExportSecrets()).resolves.toBe(true);
    expect(secretsBridge).toHaveBeenCalled();
    prepareApiMockStudioChrome();
    expect(collapse).toHaveBeenCalled();
    expect(patchApiMockActiveRoute({ body: '{"ok":true}' })).toBe(true);
    expect(patchBridge).toHaveBeenCalledWith({ body: '{"ok":true}' });
    expect(patchApiMockActiveRoute({ priority: 25 })).toBe(true);
    expect(patchBridge).toHaveBeenCalledWith({ priority: 25 });
    expect(patchApiMockActiveRoute({ addRoute: true, path: '/health', method: 'GET' })).toBe(true);
    expect(patchBridge).toHaveBeenCalledWith({ addRoute: true, path: '/health', method: 'GET' });
    expect(patchApiMockActiveRoute({ removeRoute: true, selectPath: '/', selectMethod: 'GET' })).toBe(true);
    expect(patchBridge).toHaveBeenCalledWith({ removeRoute: true, selectPath: '/', selectMethod: 'GET' });
    expect(patchApiMockActiveRoute({
      selectPath: '/orders/{id}',
      selectMethod: 'GET',
      enabled: true,
      pathKind: 'parameterized',
    })).toBe(true);
    expect(patchBridge).toHaveBeenCalledWith({
      selectPath: '/orders/{id}',
      selectMethod: 'GET',
      enabled: true,
      pathKind: 'parameterized',
    });
    const { patchApiMockServerSettings, upsertApiMockServerSamples } = await import('./apiMockStudioAdapter');
    expect(patchApiMockServerSettings({ multipleMatchPolicy: 'reject_multiple' })).toBe(true);
    expect(settingsBridge).toHaveBeenCalledWith({ multipleMatchPolicy: 'reject_multiple' });
    expect(patchApiMockServerSettings({ fallbackMode: 'proxy', proxyEnabled: true })).toBe(true);
    expect(settingsBridge).toHaveBeenCalledWith({ fallbackMode: 'proxy', proxyEnabled: true });
    expect(upsertApiMockServerSamples([{ name: 'POST /orders FLAKY', method: 'POST', path: '/orders' }])).toBe(true);
    expect(upsertSamplesBridge).toHaveBeenCalledWith([
      { name: 'POST /orders FLAKY', method: 'POST', path: '/orders' },
    ]);
  });

  it('returns false when bridges are missing', async () => {
    vi.resetModules();
    vi.doMock('./bridgeWindow', () => ({
      getDemoBridgeWindow: () => ({}),
    }));
    vi.doMock('./appShellAdapter', () => ({
      collapseAppSidebar: vi.fn(),
    }));
    const { wipeApiMockWorkspace, restoreApiMockUserWorkspace, listApiMockStudioServers, patchApiMockActiveRoute, importApiMockGallerySample, patchApiMockServerSettings, ensureBlankApiMockServer, seedApiMockExportSecrets, upsertApiMockServerSamples, isApiMockStudioLesson } = await import('./apiMockStudioAdapter');
    await expect(wipeApiMockWorkspace()).resolves.toBe(false);
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
    await expect(listApiMockStudioServers()).resolves.toEqual([]);
    expect(patchApiMockActiveRoute({ path: '/health' })).toBe(false);
    expect(patchApiMockServerSettings({ equalPriorityPolicy: 'reject' })).toBe(false);
    await expect(importApiMockGallerySample('am-gallery-health')).resolves.toBe(false);
    await expect(ensureBlankApiMockServer()).resolves.toBe(false);
    await expect(seedApiMockExportSecrets()).resolves.toBe(false);
    expect(upsertApiMockServerSamples([{ name: 'x', method: 'GET', path: '/' }])).toBe(false);
    expect(isApiMockStudioLesson({ category: 'api-mock', domainId: 'api-mock', initialTab: 'api-mock-studio' })).toBe(true);
    expect(isApiMockStudioLesson({ category: 'graphql', domainId: 'graphql', initialTab: 'graphql-studio' })).toBe(false);
  });
});
