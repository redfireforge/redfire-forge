/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  idbLoadEnvironments,
  idbLoadMicroservices,
  idbMigrateEnvironments,
  idbMigrateMicroservices,
  idbSaveEnvironments,
  idbSaveMicroservices,
} from './idbEnvironmentsMicroservices';

describe('idbEnvironmentsMicroservices', () => {
  beforeEach(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  it('saves and loads environments', async () => {
    const envs = [{ id: 'e1', name: 'Dev', baseUrl: 'http://localhost' }];
    await idbSaveEnvironments(envs);
    expect(await idbLoadEnvironments()).toEqual(envs);
  });

  it('saves and loads microservices', async () => {
    const svcs = [{ id: 's1', name: 'api', baseUrls: {} }];
    await idbSaveMicroservices(svcs);
    expect(await idbLoadMicroservices()).toEqual(svcs);
  });

  it('migrates environments from localStorage', async () => {
    const envs = [{ id: 'e1', name: 'Dev', baseUrl: 'http://localhost' }];
    localStorage.setItem('perf-test-v3-environments', JSON.stringify(envs));
    expect(await idbMigrateEnvironments('perf-test-v3-environments')).toBe(true);
    expect(localStorage.getItem('perf-test-v3-environments')).toBeNull();
    expect(await idbLoadEnvironments()).toEqual(envs);
  });

  it('migrates microservices from localStorage', async () => {
    const svcs = [{ id: 's1', name: 'api', baseUrls: {} }];
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify(svcs));
    expect(await idbMigrateMicroservices('perf-test-v3-microservices')).toBe(true);
    expect(await idbLoadMicroservices()).toEqual(svcs);
  });

  it('returns false when localStorage key is missing', async () => {
    expect(await idbMigrateEnvironments('missing')).toBe(false);
    expect(await idbMigrateMicroservices('missing')).toBe(false);
  });
});
