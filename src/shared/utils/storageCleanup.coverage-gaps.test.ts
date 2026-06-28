/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cleanupStaleStorageKeys,
  ensureBrowserLargeDataMigrated,
  migrateAppFlatDataFromLocalStorage,
  purgeStaleRunnerConfigKeys,
  reclaimLocalStorageQuotaForWrite,
  trimWorkflowRunCacheStorage,
} from './storageCleanup';
import {
  FLAT_ENVS_KEY,
  FLAT_FGS_KEY,
  FLAT_SVCS_KEY,
  FLAT_SEL_ENV_KEY,
  FLAT_SEL_SVC_KEY,
  GLOBAL_AUTH_KEY,
  REQUESTS_KEY,
  RUNNER_CONFIG_KEY,
} from './storageKeys';

const {
  isTauriMock,
  idbLoadEnvironmentsMock,
  idbLoadMicroservicesMock,
  idbLoadFeatureGroupsMock,
  idbLoadGlobalAuthProfilesMock,
  idbMigrateEnvironmentsMock,
  idbMigrateMicroservicesMock,
  idbMigrateFeatureGroupsMock,
  idbMigrateGlobalAuthProfilesMock,
  idbMigrateRequestsMock,
  idbMigrateProjectsMock,
  migrateWorkflowKeysMock,
  migrateCatalogKeysMock,
  migrateGraphqlStudioMock,
  purgeGraphqlStudioMock,
  idbMigrateRunnerConfigsMock,
  purgeRunnerConfigLocalStorageKeysMock,
} = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  idbLoadEnvironmentsMock: vi.fn(async () => [{ id: 'e1', name: 'Dev', baseUrl: 'http://x' }]),
  idbLoadMicroservicesMock: vi.fn(async () => [{ id: 's1', name: 'api', baseUrls: {} }]),
  idbLoadFeatureGroupsMock: vi.fn(async () => []),
  idbLoadGlobalAuthProfilesMock: vi.fn(async () => []),
  idbMigrateEnvironmentsMock: vi.fn(async () => true),
  idbMigrateMicroservicesMock: vi.fn(async () => true),
  idbMigrateFeatureGroupsMock: vi.fn(async () => true),
  idbMigrateGlobalAuthProfilesMock: vi.fn(async () => true),
  idbMigrateRequestsMock: vi.fn(async () => false),
  idbMigrateProjectsMock: vi.fn(async () => false),
  migrateWorkflowKeysMock: vi.fn(async () => {}),
  migrateCatalogKeysMock: vi.fn(async () => {}),
  migrateGraphqlStudioMock: vi.fn(async () => ({
    tabs: false,
    auth: false,
    environments: false,
    profiles: false,
    schemaEntries: 0,
  })),
  purgeGraphqlStudioMock: vi.fn(async () => 0),
  idbMigrateRunnerConfigsMock: vi.fn(async () => 0),
  purgeRunnerConfigLocalStorageKeysMock: vi.fn(() => ({ removed: 0, freedBytes: 0 })),
}));

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./storageWorkflows', () => ({
  migrateWorkflowKeysToIdb: migrateWorkflowKeysMock,
}));

vi.mock('./storageCatalog', () => ({
  migrateCatalogKeysToIdb: migrateCatalogKeysMock,
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

vi.mock('./idbGraphqlStudio', () => ({
  migrateGraphqlStudioFromLocalStorage: migrateGraphqlStudioMock,
  purgeGraphqlStudioLocalStorageDuplicates: purgeGraphqlStudioMock,
}));

vi.mock('./idbRunnerConfig', () => ({
  idbMigrateRunnerConfigsFromLocalStorage: idbMigrateRunnerConfigsMock,
  purgeRunnerConfigLocalStorageKeys: purgeRunnerConfigLocalStorageKeysMock,
}));

vi.mock('./idbRequests', () => ({
  idbMigrateRequests: idbMigrateRequestsMock,
}));

vi.mock('./idbProjects', () => ({
  idbMigrateProjects: idbMigrateProjectsMock,
}));

describe('trimWorkflowRunCacheStorage — coverage gaps', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
  });

  it('returns zeros on Tauri', () => {
    isTauriMock.mockReturnValue(true);
    expect(trimWorkflowRunCacheStorage()).toEqual({ removed: 0, freedBytes: 0 });
  });

  it('trims excess workflow run cache entries and console lines', () => {
    const entries: Array<[string, { lastRunTime: number; consoleLines: string[] }]> = [];
    for (let i = 0; i < 10; i++) {
      entries.push([`wf-${i}`, {
        lastRunTime: i,
        consoleLines: Array.from({ length: 300 }, (_, j) => `line-${j}`),
      }]);
    }
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    const result = trimWorkflowRunCacheStorage(3);
    expect(result.removed).toBe(7);
    const kept = JSON.parse(localStorage.getItem('rfg-workflow-run-cache') ?? '[]') as typeof entries;
    expect(kept).toHaveLength(3);
    expect(kept[0][1].consoleLines.length).toBeLessThanOrEqual(200);
  });

  it('returns early when cache is already within limits', () => {
    const entries: Array<[string, { lastRunTime: number; consoleLines: string[] }]> = [
      ['wf-1', { lastRunTime: 1, consoleLines: ['a'] }],
    ];
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    expect(trimWorkflowRunCacheStorage()).toEqual({ removed: 0, freedBytes: 0 });
  });

  it('returns zero for non-array cache payload', () => {
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify('not-an-array'));
    expect(trimWorkflowRunCacheStorage()).toEqual({ removed: 0, freedBytes: 0 });
  });

  it('preserves non-array consoleLines entries unchanged', () => {
    const entries: Array<[string, { lastRunTime: number; consoleLines?: unknown }]> = [
      ['wf-1', { lastRunTime: 1, consoleLines: undefined }],
      ['wf-0', { lastRunTime: 0 }],
    ];
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    trimWorkflowRunCacheStorage(1);
    const kept = JSON.parse(localStorage.getItem('rfg-workflow-run-cache') ?? '[]') as typeof entries;
    expect(kept).toHaveLength(1);
    expect(kept[0][0]).toBe('wf-1');
  });

  it('trims long consoleLines even when entry count stays within max', () => {
    const entries: Array<[string, { lastRunTime: number; consoleLines: string[] }]> = [
      ['wf-1', { lastRunTime: 5, consoleLines: Array.from({ length: 250 }, (_, i) => `line-${i}`) }],
    ];
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    const result = trimWorkflowRunCacheStorage(6);
    expect(result.removed).toBe(0);
    const kept = JSON.parse(localStorage.getItem('rfg-workflow-run-cache') ?? '[]') as typeof entries;
    expect(kept[0][1].consoleLines.length).toBeLessThanOrEqual(200);
  });

  it('sorts equal lastRunTime entries deterministically when trimming count', () => {
    const entries: Array<[string, { lastRunTime: number; consoleLines: string[] }]> = [
      ['wf-a', { lastRunTime: 5, consoleLines: ['a'] }],
      ['wf-b', { lastRunTime: 5, consoleLines: ['b'] }],
      ['wf-c', { lastRunTime: 5, consoleLines: ['c'] }],
    ];
    localStorage.setItem('rfg-workflow-run-cache', JSON.stringify(entries));
    trimWorkflowRunCacheStorage(2);
    const kept = JSON.parse(localStorage.getItem('rfg-workflow-run-cache') ?? '[]') as typeof entries;
    expect(kept).toHaveLength(2);
  });

  it('removes corrupt cache blob on parse failure', () => {
    localStorage.setItem('rfg-workflow-run-cache', '{bad');
    expect(trimWorkflowRunCacheStorage()).toEqual({ removed: 1, freedBytes: 0 });
    expect(localStorage.getItem('rfg-workflow-run-cache')).toBeNull();
  });

  it('returns zero when corrupt cache cannot be removed', () => {
    localStorage.setItem('rfg-workflow-run-cache', '{bad');
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === 'rfg-workflow-run-cache') throw new Error('blocked');
      return removeItem.call(this, key);
    };
    expect(trimWorkflowRunCacheStorage()).toEqual({ removed: 0, freedBytes: 0 });
    Storage.prototype.removeItem = removeItem;
  });
});

describe('purgeStaleRunnerConfigKeys — coverage gaps', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
  });

  it('returns zeros on Tauri', () => {
    isTauriMock.mockReturnValue(true);
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:stale`, '{}');
    expect(purgeStaleRunnerConfigKeys()).toEqual({ removed: 0, freedBytes: 0 });
  });

  it('keeps activeContextKey when provided', () => {
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:ctx-active`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:ctx-stale`, '{}');
    const { removed } = purgeStaleRunnerConfigKeys('ctx-active');
    expect(removed).toBe(1);
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:ctx-active`)).not.toBeNull();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:ctx-stale`)).toBeNull();
  });

  it('keeps env-only runner config keys when svc is missing', () => {
    localStorage.setItem(FLAT_SEL_ENV_KEY, '"env-a"');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env-a`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env-a:param`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:stale`, '{}');
    const { removed } = purgeStaleRunnerConfigKeys();
    expect(removed).toBe(1);
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:env-a`)).not.toBeNull();
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:stale`)).toBeNull();
  });

  it('purgeStaleRunnerConfigKeys keeps env:svc keys when both are selected', () => {
    localStorage.setItem(FLAT_SEL_ENV_KEY, '"env-a"');
    localStorage.setItem(FLAT_SEL_SVC_KEY, '"svc-a"');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env-a:svc-a`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:env-a:svc-a:param`, '{}');
    localStorage.setItem(`${RUNNER_CONFIG_KEY}:orphan`, '{}');
    const { removed } = purgeStaleRunnerConfigKeys();
    expect(removed).toBe(1);
    expect(localStorage.getItem(`${RUNNER_CONFIG_KEY}:env-a:svc-a`)).not.toBeNull();
  });

  it('purgeStaleRunnerConfigKeys ignores localStorage read errors', () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === FLAT_SEL_ENV_KEY) throw new Error('blocked');
      return getItem.call(this, key);
    };
    expect(purgeStaleRunnerConfigKeys().removed).toBe(0);
    Storage.prototype.getItem = getItem;
  });
});

describe('cleanupStaleStorageKeys — coverage gaps', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('returns zeros on Tauri', () => {
    isTauriMock.mockReturnValue(true);
    localStorage.setItem('perf-test-last-progress:x', '1');
    expect(cleanupStaleStorageKeys()).toEqual({ removed: 0, freedKB: 0 });
  });

  it('triggers large-key IDB migration for remaining flat keys', async () => {
    localStorage.setItem(FLAT_ENVS_KEY, '[]');
    localStorage.setItem(REQUESTS_KEY, '[]');
    cleanupStaleStorageKeys();
    await vi.waitFor(() => expect(idbMigrateEnvironmentsMock).toHaveBeenCalled());
    expect(idbMigrateRequestsMock).toHaveBeenCalled();
    expect(migrateWorkflowKeysMock).toHaveBeenCalled();
    expect(migrateCatalogKeysMock).toHaveBeenCalled();
  });

  it('removes ephemeral prefixes and logs cleanup summary', () => {
    localStorage.setItem('perf-test-last-progress:x', '1');
    localStorage.setItem('replayLayout:wf', '{}');
    localStorage.setItem('dm-patterns:ctx', '[]');
    const { removed, freedKB } = cleanupStaleStorageKeys();
    expect(removed).toBeGreaterThanOrEqual(3);
    expect(freedKB).toBeGreaterThanOrEqual(0);
    expect(localStorage.getItem('perf-test-last-progress:x')).toBeNull();
  });
});

describe('ensureBrowserLargeDataMigrated — coverage gaps', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
  });

  it('no-ops on Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    await ensureBrowserLargeDataMigrated();
    expect(migrateGraphqlStudioMock).not.toHaveBeenCalled();
  });

  it('runs migration chain on web', async () => {
    localStorage.setItem(FLAT_ENVS_KEY, '[]');
    await ensureBrowserLargeDataMigrated();
    expect(idbMigrateRunnerConfigsMock).toHaveBeenCalled();
    expect(migrateGraphqlStudioMock).toHaveBeenCalled();
    expect(purgeGraphqlStudioMock).toHaveBeenCalled();
  });
});

describe('migrateAppFlatDataFromLocalStorage — coverage gaps', () => {
  it('returns migration flags from IDB helpers', async () => {
    const result = await migrateAppFlatDataFromLocalStorage();
    expect(result).toEqual({
      environments: true,
      microservices: true,
      featureGroups: true,
      globalAuthProfiles: true,
    });
  });
});

describe('reclaimLocalStorageQuotaForWrite', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('returns 0 on Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    expect(await reclaimLocalStorageQuotaForWrite()).toBe(0);
  });

  it('removes flat keys when IDB migration shrinks localStorage', async () => {
    localStorage.setItem(FLAT_ENVS_KEY, JSON.stringify([{ id: 'e1', name: 'Dev', baseUrl: 'http://x' }]));
    localStorage.setItem(FLAT_SVCS_KEY, JSON.stringify([{ id: 's1', name: 'api', baseUrls: {} }]));
    localStorage.setItem(FLAT_FGS_KEY, '[]');
    localStorage.setItem(GLOBAL_AUTH_KEY, '[]');
    localStorage.setItem('perf-test-last-progress:x', 'ephemeral');

    const freed = await reclaimLocalStorageQuotaForWrite();
    expect(freed).toBeGreaterThanOrEqual(0);
    expect(localStorage.getItem(FLAT_ENVS_KEY)).toBeNull();
    expect(localStorage.getItem(FLAT_SVCS_KEY)).toBeNull();
    expect(localStorage.getItem('perf-test-last-progress:x')).toBeNull();
  });

  it('force-removes flat keys when localStorage length shrinks after purge', async () => {
    localStorage.setItem(FLAT_ENVS_KEY, JSON.stringify([{ id: 'e1', name: 'Dev', baseUrl: 'http://x' }]));
    localStorage.setItem(FLAT_SVCS_KEY, '[]');
    localStorage.setItem(FLAT_FGS_KEY, '[]');
    localStorage.setItem(GLOBAL_AUTH_KEY, '[]');
    localStorage.setItem(FLAT_SEL_ENV_KEY, '"env"');
    localStorage.setItem(FLAT_SEL_SVC_KEY, '"svc"');
    idbLoadEnvironmentsMock.mockResolvedValueOnce([{ id: 'e1', name: 'Dev', baseUrl: 'http://x' }]);
    purgeGraphqlStudioMock.mockResolvedValueOnce(2);
    await reclaimLocalStorageQuotaForWrite();
    expect(localStorage.getItem(FLAT_FGS_KEY)).toBeNull();
    expect(localStorage.getItem(GLOBAL_AUTH_KEY)).toBeNull();
  });

  it('reclaim scans remaining flat keys after partial purge', async () => {
    localStorage.setItem(FLAT_FGS_KEY, '[]');
    localStorage.setItem(GLOBAL_AUTH_KEY, '[]');
    localStorage.setItem('keep-me', '1');
    idbLoadFeatureGroupsMock.mockResolvedValueOnce([]);
    idbLoadGlobalAuthProfilesMock.mockResolvedValueOnce([]);
    await reclaimLocalStorageQuotaForWrite();
    expect(localStorage.getItem(FLAT_FGS_KEY)).toBeNull();
    expect(localStorage.getItem(GLOBAL_AUTH_KEY)).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('1');
  });

  it('reclaim removes leftover flat keys after other keys shrink localStorage', async () => {
    localStorage.setItem(FLAT_ENVS_KEY, JSON.stringify([{ id: 'e1', name: 'Dev', baseUrl: 'http://x' }]));
    localStorage.setItem('perf-test-last-progress:shrink', '1');
    idbLoadEnvironmentsMock.mockResolvedValueOnce(null);
    idbLoadMicroservicesMock.mockResolvedValueOnce([{ id: 's1', name: 'api', baseUrls: {} }]);
    await reclaimLocalStorageQuotaForWrite();
    expect(localStorage.getItem(FLAT_ENVS_KEY)).toBeNull();
    expect(localStorage.getItem('perf-test-last-progress:shrink')).toBeNull();
  });

  it('reclaim skips flat keys when IDB load returns null', async () => {
    localStorage.setItem(FLAT_FGS_KEY, '[]');
    idbLoadFeatureGroupsMock.mockResolvedValueOnce(null);
    await reclaimLocalStorageQuotaForWrite();
    expect(localStorage.getItem(FLAT_FGS_KEY)).toBe('[]');
  });

  it('reclaim ignores IDB load errors when purging flat keys', async () => {
    localStorage.setItem(GLOBAL_AUTH_KEY, '[]');
    idbLoadGlobalAuthProfilesMock.mockRejectedValueOnce(new Error('idb down'));
    await expect(reclaimLocalStorageQuotaForWrite()).resolves.toBeGreaterThanOrEqual(0);
  });
});
