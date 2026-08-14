/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { wipeBridge, collapse, patchBridge, importBridge, settingsBridge, blankBridge, secretsBridge } = vi.hoisted(() => ({
  wipeBridge: vi.fn(async () => true),
  collapse: vi.fn(),
  patchBridge: vi.fn(() => true),
  importBridge: vi.fn(async () => true),
  settingsBridge: vi.fn(() => true),
  blankBridge: vi.fn(async () => true),
  secretsBridge: vi.fn(async () => true),
}));

vi.mock('./bridgeWindow', () => ({
  getDemoBridgeWindow: () => ({
    __demoWipeApiMockWorkspace: wipeBridge,
    __demoCollapseAppSidebar: collapse,
    __demoPatchApiMockActiveRoute: patchBridge,
    __demoPatchApiMockServerSettings: settingsBridge,
    __demoImportApiMockGallerySample: importBridge,
    __demoEnsureBlankApiMockServer: blankBridge,
    __demoSeedApiMockExportSecrets: secretsBridge,
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
      prepareApiMockStudioChrome,
      patchApiMockActiveRoute,
      importApiMockGallerySample,
      ensureBlankApiMockServer,
      seedApiMockExportSecrets,
    } = await import('./apiMockStudioAdapter');
    await expect(wipeApiMockWorkspace()).resolves.toBe(true);
    expect(wipeBridge).toHaveBeenCalled();
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
    const { patchApiMockServerSettings } = await import('./apiMockStudioAdapter');
    expect(patchApiMockServerSettings({ multipleMatchPolicy: 'reject_multiple' })).toBe(true);
    expect(settingsBridge).toHaveBeenCalledWith({ multipleMatchPolicy: 'reject_multiple' });
    expect(patchApiMockServerSettings({ fallbackMode: 'proxy', proxyEnabled: true })).toBe(true);
    expect(settingsBridge).toHaveBeenCalledWith({ fallbackMode: 'proxy', proxyEnabled: true });
  });

  it('returns false when bridges are missing', async () => {
    vi.resetModules();
    vi.doMock('./bridgeWindow', () => ({
      getDemoBridgeWindow: () => ({}),
    }));
    vi.doMock('./appShellAdapter', () => ({
      collapseAppSidebar: vi.fn(),
    }));
    const { wipeApiMockWorkspace, patchApiMockActiveRoute, importApiMockGallerySample, patchApiMockServerSettings, ensureBlankApiMockServer, seedApiMockExportSecrets } = await import('./apiMockStudioAdapter');
    await expect(wipeApiMockWorkspace()).resolves.toBe(false);
    expect(patchApiMockActiveRoute({ path: '/health' })).toBe(false);
    expect(patchApiMockServerSettings({ equalPriorityPolicy: 'reject' })).toBe(false);
    await expect(importApiMockGallerySample('am-gallery-health')).resolves.toBe(false);
    await expect(ensureBlankApiMockServer()).resolves.toBe(false);
    await expect(seedApiMockExportSecrets()).resolves.toBe(false);
  });
});
