/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  idbLoadRunnerConfig,
  idbSaveRunnerConfig,
  idbMigrateRunnerConfigsFromLocalStorage,
  purgeRunnerConfigLocalStorageKeys,
  idbPruneRunnerConfigs,
  MAX_RUNNER_CONFIG_ENTRIES,
} from './idbRunnerConfig';

const storeState = vi.hoisted(() => ({
  records: new Map<string, { savedAt: number; payload: string }>(),
}));

vi.mock('./idbHelpers', () => ({
  idbAvailable: () => true,
  wrap: (req: { result: unknown }) => Promise.resolve(req.result),
  getObjectStore: vi.fn(async () => ({
    get: (key: string) => ({ result: storeState.records.get(key) }),
    put: (record: { savedAt: number; payload: string }, key: string) => {
      storeState.records.set(key, record);
      return { result: key };
    },
    getAllKeys: () => ({ result: [...storeState.records.keys()] }),
    getAll: () => ({ result: [...storeState.records.values()] }),
    delete: (key: string) => {
      storeState.records.delete(key);
      return { result: undefined };
    },
  })),
}));

describe('idbRunnerConfig', () => {
  beforeEach(() => {
    storeState.records.clear();
    localStorage.clear();
  });

  it('saves and loads by context key', async () => {
    await idbSaveRunnerConfig('env:svc', '{"iterations":3}');
    expect(await idbLoadRunnerConfig('env:svc')).toBe('{"iterations":3}');
  });

  it('migrates legacy localStorage keys and removes them', async () => {
    localStorage.setItem('perf-test-runner-config:71567ca0-env', '{"concurrency":2}');
    localStorage.setItem('perf-test-runner-config:_workflow_runner', '{"iterations":1}');
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(2);
    expect(localStorage.getItem('perf-test-runner-config:71567ca0-env')).toBeNull();
    expect(await idbLoadRunnerConfig('71567ca0-env')).toBe('{"concurrency":2}');
  });

  it('purgeRunnerConfigLocalStorageKeys removes all legacy runner keys', () => {
    localStorage.setItem('perf-test-runner-config:a', '{}');
    localStorage.setItem('perf-test-runner-config:b', '{}');
    const { removed } = purgeRunnerConfigLocalStorageKeys();
    expect(removed).toBe(2);
  });

  it('prunes oldest entries beyond MAX_RUNNER_CONFIG_ENTRIES', async () => {
    for (let i = 0; i < MAX_RUNNER_CONFIG_ENTRIES + 4; i++) {
      storeState.records.set(`k${i}`, { savedAt: i, payload: `{}` });
    }
    const removed = await idbPruneRunnerConfigs(MAX_RUNNER_CONFIG_ENTRIES);
    expect(removed).toBe(4);
    expect(storeState.records.size).toBe(MAX_RUNNER_CONFIG_ENTRIES);
  });
});
