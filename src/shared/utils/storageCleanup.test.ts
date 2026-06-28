/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanupStaleStorageKeys, purgeStaleRunnerConfigKeys, ensureBrowserLargeDataMigrated, trimWorkflowRunCacheStorage } from './storageCleanup';
import {
  FLAT_SEL_ENV_KEY,
  FLAT_SEL_SVC_KEY,
  RUNNER_CONFIG_KEY,
  FLAT_SVCS_KEY,
  GLOBAL_AUTH_KEY,
} from './storageKeys';

const { isTauriMock, migrateWorkflowKeysToIdbMock, migrateCatalogKeysToIdbMock, idbMigrateRequestsMock, idbMigrateProjectsMock, idbMigrateEnvironmentsMock, idbMigrateMicroservicesMock, idbMigrateFeatureGroupsMock, idbMigrateGlobalAuthProfilesMock, idbLoadEnvironmentsMock, idbLoadMicroservicesMock, idbLoadFeatureGroupsMock, idbLoadGlobalAuthProfilesMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  migrateWorkflowKeysToIdbMock: vi.fn(async () => {}),
  migrateCatalogKeysToIdbMock: vi.fn(async () => {}),
  idbMigrateRequestsMock: vi.fn(async () => true),
  idbMigrateProjectsMock: vi.fn(async () => true),
  idbMigrateEnvironmentsMock: vi.fn(async () => true),
  idbMigrateMicroservicesMock: vi.fn(async () => true),
  idbMigrateFeatureGroupsMock: vi.fn(async () => true),
  idbMigrateGlobalAuthProfilesMock: vi.fn(async () => true),
  idbLoadEnvironmentsMock: vi.fn(async () => []),
  idbLoadMicroservicesMock: vi.fn(async () => []),
  idbLoadFeatureGroupsMock: vi.fn(async () => []),
  idbLoadGlobalAuthProfilesMock: vi.fn(async () => []),
}));

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./storageWorkflows', () => ({
  migrateWorkflowKeysToIdb: migrateWorkflowKeysToIdbMock,
}));

vi.mock('./storageCatalog', () => ({
  migrateCatalogKeysToIdb: migrateCatalogKeysToIdbMock,
}));

vi.mock('./idbRequests', () => ({
  idbMigrateRequests: idbMigrateRequestsMock,
}));

vi.mock('./idbProjects', () => ({
  idbMigrateProjects: idbMigrateProjectsMock,
}));

vi.mock('./idbEnvironmentsMicroservices', () => ({
  idbMigrateEnvironments: idbMigrateEnvironmentsMock,
  idbMigrateMicroservices: idbMigrateMicroservicesMock,
  idbLoadEnvironments: idbLoadEnvironmentsMock,
  idbLoadMicroservices: idbLoadMicroservicesMock,
}));

vi.mock('./idbFeatureGroups', () => ({
  idbMigrateFeatureGroups: idbMigrateFeatureGroupsMock,
  idbLoadFeatureGroups: idbLoadFeatureGroupsMock,
}));

vi.mock('./idbGlobalAuthProfiles', () => ({
  idbMigrateGlobalAuthProfiles: idbMigrateGlobalAuthProfilesMock,
  idbLoadGlobalAuthProfiles: idbLoadGlobalAuthProfilesMock,
}));

vi.mock('./idbRunnerConfig', () => ({
  idbMigrateRunnerConfigsFromLocalStorage: vi.fn(async () => 0),
  purgeRunnerConfigLocalStorageKeys: vi.fn(() => ({ removed: 0, freedBytes: 0 })),
}));

vi.mock('./idbGraphqlStudio', () => ({
  migrateGraphqlStudioFromLocalStorage: vi.fn(async () => {}),
  purgeGraphqlStudioLocalStorageDuplicates: vi.fn(async () => {}),
}));

describe('purgeStaleRunnerConfigKeys', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
  });

  it('returns zero on Tauri', () => {
    isTauriMock.mockReturnValue(true);
    expect(purgeStaleRunnerConfigKeys()).toEqual({ removed: 0, freedBytes: 0 });
  });

  it('keeps global and workflow runner keys', () => {
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:stale`, '{}');
    localStorage.setItem(RUNNER_CONFIG_KEY, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:_workflow_runner`, '{}');
    const { removed } = purgeStaleRunnerConfigKeys();
    expect(removed).toBe(1);
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:stale`)).toBeNull();
    expect(localStorage.getItem(RUNNER_CONFIG_KEY)).not.toBeNull();
  });

  it('keeps active context key when provided', () => {
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:ctx-a`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:ctx-b`, '{}');
    purgeStaleRunnerConfigKeys('ctx-a');
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:ctx-a`)).not.toBeNull();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:ctx-b`)).toBeNull();
  });

  it('keeps env:svc keys from selection', () => {
    localStorage.setItem(FLAT_SEL_ENV_KEY, 'env1');
    localStorage.setItem(FLAT_SEL_SVC_KEY, 'svc1');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env1:svc1`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env1:svc1:param`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:other`, '{}');
    purgeStaleRunnerConfigKeys();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:env1:svc1`)).not.toBeNull();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:other`)).toBeNull();
  });

  it('keeps env-only keys when svc missing', () => {
    localStorage.setItem(FLAT_SEL_ENV_KEY, 'env1');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env1`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env1:param`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:stale`, '{}');
    purgeStaleRunnerConfigKeys();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:env1`)).not.toBeNull();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:stale`)).toBeNull();
  });
});

describe('cleanupStaleStorageKeys', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('returns zero on Tauri', () => {
    isTauriMock.mockReturnValue(true);
    expect(cleanupStaleStorageKeys()).toEqual({ removed: 0, freedKB: 0 });
  });

  it('removes ephemeral prefixes', () => {
    localStorage.setItem('perf-test-last-progress:abc', 'x');
    localStorage.setItem('dm-patterns:abc', 'y');
    const { removed } = cleanupStaleStorageKeys();
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem('perf-test-last-progress:abc')).toBeNull();
  });

  it('logs when keys are removed', () => {
    localStorage.setItem('replayLayout:wf1', '{}');
    cleanupStaleStorageKeys();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[Storage] Cleanup:'));
  });

  it('handles null localStorage keys during ephemeral sweep', () => {
    const keySpy = vi.spyOn(Storage.prototype, 'key').mockImplementation((index) => {
      if (index === 0) return 'perf-test-last-progress:x';
      if (index === 1) return null;
      return null;
    });
    localStorage.setItem('perf-test-last-progress:x', 'data');
    const { removed } = cleanupStaleStorageKeys();
    expect(removed).toBeGreaterThanOrEqual(1);
    keySpy.mockRestore();
  });

  it('trims oversized workflow run cache blob', () => {
    const entries = Array.from({ length: 10 }, (_, i) => [
      `wf-${i}`,
      { lastRunTime: i, consoleLines: Array.from({ length: 600 }, () => ({ text: 'x' })) },
    ]);
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    const { removed } = trimWorkflowRunCacheStorage(6);
    expect(removed).toBe(4);
    const kept = JSON.parse(localStorage.getItem('rfg-workflow-run-cache') ?? '[]') as unknown[];
    expect(kept).toHaveLength(6);
  });

  it('counts zero bytes when ephemeral key disappears before removal', () => {
    localStorage.setItem('dm-patterns:ghost', 'payload');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'dm-patterns:ghost') return null;
      return Storage.prototype.getItem.call(localStorage, key);
    });
    const { removed } = cleanupStaleStorageKeys();
    expect(removed).toBeGreaterThanOrEqual(1);
    getItemSpy.mockRestore();
  });

  it('treats missing localStorage values as zero bytes when purging runner keys', () => {
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:orphan`, 'payload');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === `${RUNNER_CONFIG_KEY}:orphan`) return null;
      return Storage.prototype.getItem.call(localStorage, key);
    });
    const { freedBytes, removed } = purgeStaleRunnerConfigKeys();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(freedBytes).toBe(0);
    getItemSpy.mockRestore();
  });

  it('ignores env/svc lookup errors when purging runner keys', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === FLAT_SEL_ENV_KEY) throw new Error('blocked');
      return null;
    });
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:stale`, '{}');
    expect(() => purgeStaleRunnerConfigKeys()).not.toThrow();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:stale`)).toBeNull();
    getItemSpy.mockRestore();
  });

  it('triggers IDB migration for requests, projects, envs, svcs, and feature groups on cleanup', async () => {
    migrateWorkflowKeysToIdbMock.mockClear();
    migrateCatalogKeysToIdbMock.mockClear();
    idbMigrateRequestsMock.mockClear();
    idbMigrateProjectsMock.mockClear();
    idbMigrateEnvironmentsMock.mockClear();
    idbMigrateMicroservicesMock.mockClear();
    idbMigrateFeatureGroupsMock.mockClear();
    localStorage.setItem('perf-test-requests', '[]');
    localStorage.setItem('perf-test-projects', '[]');
    localStorage.setItem('perf-test-v3-environments', '[]');
    localStorage.setItem('perf-test-v3-microservices', '[]');
    localStorage.setItem('perf-test-v3-feature-groups', '[]');
    localStorage.setItem(GLOBAL_AUTH_KEY, '[]');
    cleanupStaleStorageKeys();
    await vi.waitFor(() => {
      expect(migrateWorkflowKeysToIdbMock).toHaveBeenCalled();
      expect(idbMigrateRequestsMock).toHaveBeenCalled();
      expect(idbMigrateProjectsMock).toHaveBeenCalled();
      expect(idbMigrateEnvironmentsMock).toHaveBeenCalled();
      expect(idbMigrateMicroservicesMock).toHaveBeenCalled();
      expect(idbMigrateFeatureGroupsMock).toHaveBeenCalled();
      expect(idbMigrateGlobalAuthProfilesMock).toHaveBeenCalled();
      expect(migrateCatalogKeysToIdbMock).toHaveBeenCalled();
    });
  });

  it('ignores IDB migration errors for individual keys', async () => {
    idbMigrateRequestsMock.mockRejectedValueOnce(new Error('idb fail'));
    localStorage.setItem('perf-test-requests', '[]');
    cleanupStaleStorageKeys();
    await vi.waitFor(() => {
      expect(idbMigrateRequestsMock).toHaveBeenCalled();
    });
    expect(() => cleanupStaleStorageKeys()).not.toThrow();
  });

  it('swallows top-level IDB migration promise rejection', async () => {
    migrateWorkflowKeysToIdbMock.mockRejectedValueOnce(new Error('workflow migrate fail'));
    cleanupStaleStorageKeys();
    await vi.waitFor(() => {
      expect(migrateWorkflowKeysToIdbMock).toHaveBeenCalled();
    });
  });
});

describe('ensureBrowserLargeDataMigrated', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('migrates flat keys and removes localStorage copies when IDB has data', async () => {
    localStorage.setItem(FLAT_SVCS_KEY, JSON.stringify([{ id: 's1', name: 'api', baseUrls: {} }]));
    idbLoadMicroservicesMock.mockResolvedValue([{ id: 's1', name: 'api', baseUrls: {} }]);

    await ensureBrowserLargeDataMigrated();

    expect(idbMigrateMicroservicesMock).toHaveBeenCalled();
    expect(localStorage.getItem(FLAT_SVCS_KEY)).toBeNull();
  });

  it('no-ops on Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    localStorage.setItem(FLAT_SVCS_KEY, '[]');
    await ensureBrowserLargeDataMigrated();
    expect(idbMigrateMicroservicesMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(FLAT_SVCS_KEY)).not.toBeNull();
  });
});
