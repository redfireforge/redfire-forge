/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  idbListRunnerConfigIds,
  idbLoadRunnerConfig,
  idbPruneRunnerConfigs,
  idbSaveRunnerConfig,
  idbMigrateRunnerConfigsFromLocalStorage,
  purgeRunnerConfigLocalStorageKeys,
} from './idbRunnerConfig';

const storeState = vi.hoisted(() => ({
  records: new Map<string, { savedAt: number; payload: string }>(),
  throwOnGet: false,
  throwOnList: false,
  throwOnPrune: false,
  throwOnPut: false,
}));

vi.mock('./idbHelpers', () => ({
  idbAvailable: () => true,
  wrap: (req: { result: unknown }) => Promise.resolve(req.result),
  getObjectStore: vi.fn(async () => ({
    get: (key: string) => {
      if (storeState.throwOnGet) throw new Error('get failed');
      return { result: storeState.records.get(key) };
    },
    put: (record: { savedAt: number; payload: string }, key: string) => {
      if (storeState.throwOnPut) throw new Error('put failed');
      storeState.records.set(key, record);
      return { result: key };
    },
    getAllKeys: () => {
      if (storeState.throwOnList) throw new Error('keys failed');
      return { result: [...storeState.records.keys()] };
    },
    getAll: () => {
      if (storeState.throwOnPrune) throw new Error('getAll failed');
      return { result: [...storeState.records.values()] };
    },
    delete: (key: string) => {
      storeState.records.delete(key);
      return { result: undefined };
    },
  })),
}));

describe('idbRunnerConfig — coverage gaps', () => {
  beforeEach(() => {
    storeState.records.clear();
    storeState.throwOnGet = false;
    storeState.throwOnList = false;
    storeState.throwOnPrune = false;
    storeState.throwOnPut = false;
    localStorage.clear();
  });

  it('idbLoadRunnerConfig returns null on IDB error', async () => {
    storeState.throwOnGet = true;
    expect(await idbLoadRunnerConfig('ctx')).toBeNull();
  });

  it('idbListRunnerConfigIds returns keys and swallows errors', async () => {
    await idbSaveRunnerConfig('a', '{}');
    await idbSaveRunnerConfig('b', '{}');
    const keys = await idbListRunnerConfigIds();
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    storeState.throwOnList = true;
    expect(await idbListRunnerConfigIds()).toEqual([]);
  });

  it('idbPruneRunnerConfigs returns 0 when maxEntries < 1', async () => {
    expect(await idbPruneRunnerConfigs(0)).toBe(0);
  });

  it('idbPruneRunnerConfigs respects alwaysKeep set', async () => {
    storeState.records.set('keep-me', { savedAt: 1, payload: '{}' });
    storeState.records.set('drop-me', { savedAt: 0, payload: '{}' });
    const removed = await idbPruneRunnerConfigs(1, new Set(['keep-me']));
    expect(removed).toBe(1);
    expect(storeState.records.has('keep-me')).toBe(true);
    expect(storeState.records.has('drop-me')).toBe(false);
  });

  it('idbPruneRunnerConfigs swallows errors', async () => {
    storeState.throwOnPrune = true;
    expect(await idbPruneRunnerConfigs(5)).toBe(0);
  });

  it('idbLoadRunnerConfig returns null when IDB unavailable', async () => {
    vi.resetModules();
    vi.doMock('./idbHelpers', () => ({
      idbAvailable: () => false,
      wrap: (req: { result: unknown }) => Promise.resolve(req.result),
      getObjectStore: vi.fn(),
    }));
    const mod = await import('./idbRunnerConfig');
    expect(await mod.idbLoadRunnerConfig('ctx')).toBeNull();
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });

  it('idbSaveRunnerConfig throws when IDB unavailable', async () => {
    vi.resetModules();
    vi.doMock('./idbHelpers', () => ({
      idbAvailable: () => false,
      wrap: (req: { result: unknown }) => Promise.resolve(req.result),
      getObjectStore: vi.fn(),
    }));
    const mod = await import('./idbRunnerConfig');
    await expect(mod.idbSaveRunnerConfig('', '{}')).rejects.toThrow('IndexedDB not available');
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });

  it('idbPruneRunnerConfigs returns 0 when entries fit within max', async () => {
    await idbSaveRunnerConfig('only', '{}');
    expect(await idbPruneRunnerConfigs(5)).toBe(0);
  });

  it('idbPruneRunnerConfigs uses savedAt 0 when row missing', async () => {
    storeState.records.set('old', { savedAt: 0, payload: '{}' });
    storeState.records.set('new', { savedAt: 100, payload: '{}' });
    storeState.records.set('mid', { savedAt: 50, payload: '{}' });
    expect(await idbPruneRunnerConfigs(1)).toBe(2);
  });

  it('idbMigrateRunnerConfigsFromLocalStorage migrates default and scoped keys', async () => {
    localStorage.clear();
    localStorage.setItem('perf-test-runner-config', '{"a":1}');
    localStorage.setItem('perf-test-runner-config:scoped', '{"b":2}');
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(2);
    expect(localStorage.getItem('perf-test-runner-config')).toBeNull();
    expect(localStorage.getItem('perf-test-runner-config:scoped')).toBeNull();
  });

  it('idbMigrateRunnerConfigsFromLocalStorage returns 0 when IDB unavailable', async () => {
    vi.resetModules();
    vi.doMock('./idbHelpers', () => ({
      idbAvailable: () => false,
      wrap: (req: { result: unknown }) => Promise.resolve(req.result),
      getObjectStore: vi.fn(),
    }));
    const mod = await import('./idbRunnerConfig');
    expect(await mod.idbMigrateRunnerConfigsFromLocalStorage()).toBe(0);
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });

  it('purgeRunnerConfigLocalStorageKeys removes keys when no active context', () => {
    localStorage.setItem('perf-test-runner-config', '{}');
    localStorage.setItem('perf-test-runner-config:ctx', '{}');
    const { removed, freedBytes } = purgeRunnerConfigLocalStorageKeys();
    expect(removed).toBe(2);
    expect(freedBytes).toBeGreaterThan(0);
  });

  it('purgeRunnerConfigLocalStorageKeys skips null localStorage keys', () => {
    localStorage.setItem('perf-test-runner-config', '{}');
    Object.defineProperty(localStorage, 'length', { value: 2, configurable: true });
    vi.spyOn(Storage.prototype, 'key').mockImplementation((i) =>
      i === 0 ? null : 'perf-test-runner-config',
    );
    const { removed } = purgeRunnerConfigLocalStorageKeys();
    expect(removed).toBe(1);
    vi.restoreAllMocks();
    Object.defineProperty(localStorage, 'length', { value: localStorage.length, configurable: true });
  });

  it('purgeRunnerConfigLocalStorageKeys keeps active context key', () => {
    localStorage.setItem('perf-test-runner-config:ctx-a', '{}');
    localStorage.setItem('perf-test-runner-config:ctx-b', '{}');
    const { removed } = purgeRunnerConfigLocalStorageKeys('ctx-a');
    expect(removed).toBe(1);
    expect(localStorage.getItem('perf-test-runner-config:ctx-a')).not.toBeNull();
    expect(localStorage.getItem('perf-test-runner-config:ctx-b')).toBeNull();
  });

  it('idbLoadRunnerConfig uses __default__ id for empty contextKey', async () => {
    await idbSaveRunnerConfig('', '{"default":true}');
    expect(await idbLoadRunnerConfig('')).toBe('{"default":true}');
  });

  it('idbMigrateRunnerConfigsFromLocalStorage keeps key when idb save fails', async () => {
    storeState.throwOnPut = true;
    localStorage.setItem('perf-test-runner-config:fail-ctx', '{"x":1}');
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(0);
    expect(localStorage.getItem('perf-test-runner-config:fail-ctx')).not.toBeNull();
  });

  it('idbMigrateRunnerConfigsFromLocalStorage skips null raw values', async () => {
    localStorage.setItem('perf-test-runner-config', '');
    Object.defineProperty(localStorage, 'length', { value: 1, configurable: true });
    const keySpy = vi.spyOn(Storage.prototype, 'key').mockReturnValue('perf-test-runner-config');
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    expect(await idbMigrateRunnerConfigsFromLocalStorage()).toBe(0);
    keySpy.mockRestore();
    getSpy.mockRestore();
    Object.defineProperty(localStorage, 'length', { value: localStorage.length, configurable: true });
  });

  it('purgeRunnerConfigLocalStorageKeys swallows localStorage enumeration errors', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('blocked'); });
    expect(purgeRunnerConfigLocalStorageKeys()).toEqual({ removed: 0, freedBytes: 0 });
    vi.restoreAllMocks();
  });

  it('idbPruneRunnerConfigs returns 0 when IDB unavailable', async () => {
    vi.resetModules();
    vi.doMock('./idbHelpers', () => ({
      idbAvailable: () => false,
      wrap: (req: { result: unknown }) => Promise.resolve(req.result),
      getObjectStore: vi.fn(),
    }));
    const mod = await import('./idbRunnerConfig');
    expect(await mod.idbPruneRunnerConfigs(5)).toBe(0);
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });
});

describe('idbRunnerConfig — idb unavailable', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./idbHelpers', () => ({
      idbAvailable: () => false,
      wrap: (req: { result: unknown }) => Promise.resolve(req.result),
      getObjectStore: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });

  it('idbListRunnerConfigIds returns [] when IDB unavailable', async () => {
    const mod = await import('./idbRunnerConfig');
    expect(await mod.idbListRunnerConfigIds()).toEqual([]);
  });
});

describe('idbRunnerConfig — migrate and prune branches', () => {
  beforeEach(() => {
    storeState.records.clear();
    storeState.throwOnGet = false;
    storeState.throwOnList = false;
    storeState.throwOnPrune = false;
    storeState.throwOnPut = false;
    localStorage.clear();
  });

  it('idbMigrateRunnerConfigsFromLocalStorage skips unrelated localStorage keys', async () => {
    localStorage.setItem('unrelated-key', '{"x":1}');
    localStorage.setItem('perf-test-runner-config', '{"a":1}');
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(1);
    expect(localStorage.getItem('unrelated-key')).not.toBeNull();
  });

  it('idbMigrateRunnerConfigsFromLocalStorage skips null key slots', async () => {
    const keySpy = vi.spyOn(Storage.prototype, 'key').mockImplementation((i) => (i === 0 ? null : 'perf-test-runner-config'));
    localStorage.setItem('perf-test-runner-config', '{"a":1}');
    Object.defineProperty(localStorage, 'length', { value: 2, configurable: true });
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(1);
    keySpy.mockRestore();
    Object.defineProperty(localStorage, 'length', { value: localStorage.length, configurable: true });
  });

  it('idbMigrateRunnerConfigsFromLocalStorage swallows localStorage enumeration errors', async () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('blocked'); });
    expect(await idbMigrateRunnerConfigsFromLocalStorage()).toBe(0);
    vi.restoreAllMocks();
  });

  it('idbMigrateRunnerConfigsFromLocalStorage swallows removeItem errors after migrate', async () => {
    localStorage.setItem('perf-test-runner-config', '{"a":1}');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('quota'); });
    const migrated = await idbMigrateRunnerConfigsFromLocalStorage();
    expect(migrated).toBe(1);
    vi.restoreAllMocks();
  });

  it('idbPruneRunnerConfigs skips alwaysKeep keys until others are removed', async () => {
    storeState.records.set('keep-a', { savedAt: 100, payload: '{}' });
    storeState.records.set('keep-b', { savedAt: 90, payload: '{}' });
    storeState.records.set('drop', { savedAt: 1, payload: '{}' });
    const removed = await idbPruneRunnerConfigs(2, new Set(['keep-a', 'keep-b']));
    expect(removed).toBe(1);
    expect(storeState.records.has('drop')).toBe(false);
    expect(storeState.records.has('keep-a')).toBe(true);
    expect(storeState.records.has('keep-b')).toBe(true);
  });

  it('idbLoadRunnerConfig returns null when row has no payload field', async () => {
    storeState.records.set('ctx', { savedAt: 1 } as { savedAt: number; payload: string });
    expect(await idbLoadRunnerConfig('ctx')).toBeNull();
  });
});
