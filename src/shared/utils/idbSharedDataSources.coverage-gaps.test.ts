/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  idbLoadSharedDataSources,
  idbMigrateSharedDataSources,
  idbSaveSharedDataSources,
} from './idbSharedDataSources';

describe('idbSharedDataSources — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  it('returns null when store is empty', async () => {
    expect(await idbLoadSharedDataSources()).toBeNull();
  });

  it('saves and loads shared data sources', async () => {
    const sources = [{ id: 'ds1', name: 'Users', columns: [] }];
    await idbSaveSharedDataSources(sources);
    expect(await idbLoadSharedDataSources()).toEqual(sources);
  });

  it('migrates from localStorage', async () => {
    const sources = [{ id: 'ds1', name: 'Users', columns: [] }];
    localStorage.setItem('perf-test-shared-ds', JSON.stringify(sources));
    expect(await idbMigrateSharedDataSources('perf-test-shared-ds')).toBe(true);
    expect(localStorage.getItem('perf-test-shared-ds')).toBeNull();
    expect(await idbLoadSharedDataSources()).toEqual(sources);
  });

  it('returns false for empty array in localStorage', async () => {
    localStorage.setItem('perf-test-shared-ds', JSON.stringify([]));
    expect(await idbMigrateSharedDataSources('perf-test-shared-ds')).toBe(false);
  });

  it('returns false for invalid JSON', async () => {
    localStorage.setItem('perf-test-shared-ds', '{bad');
    expect(await idbMigrateSharedDataSources('perf-test-shared-ds')).toBe(false);
  });

  it('returns null when idbAvailable is false', async () => {
    vi.resetModules();
    vi.doMock('./idbHelpers', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./idbHelpers')>();
      return {
        ...actual,
        idbAvailable: () => false,
      };
    });
    const mod = await import('./idbSharedDataSources');
    expect(await mod.idbLoadSharedDataSources()).toBeNull();
    expect(await mod.idbMigrateSharedDataSources('key')).toBe(false);
    vi.doUnmock('./idbHelpers');
    vi.resetModules();
  });
});
