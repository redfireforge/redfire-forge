/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

const { isTauriMock, readKeyMock, writeKeyMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  readKeyMock: vi.fn(async (): Promise<string | null> => null),
  writeKeyMock: vi.fn(async () => {}),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: (key: string) => readKeyMock(key),
  writeKey: (key: string, value: string) => writeKeyMock(key, value),
}));

import {
  readGqlStudioEnvironments,
  writeGqlStudioEnvironments,
  GQL_ENVS_STORAGE_KEY,
} from './gqlStudioEnvironmentStorage';
import type { GraphqlEnvironment } from '@shared/types/graphql';

function makeEnv(overrides: Partial<GraphqlEnvironment> = {}): GraphqlEnvironment {
  return {
    id: 'env-1',
    name: 'Demo Env',
    variables: [],
    isActive: true,
    ...overrides,
  };
}

describe('gqlStudioEnvironmentStorage — web IDB path', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    readKeyMock.mockReset();
    writeKeyMock.mockReset();
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  it('readGqlStudioEnvironments loads from IDB after migration', async () => {
    const envs = [makeEnv()];
    localStorage.setItem(GQL_ENVS_STORAGE_KEY, JSON.stringify(envs));
    await expect(readGqlStudioEnvironments()).resolves.toEqual(envs);
    expect(readKeyMock).not.toHaveBeenCalled();
  });

  it('readGqlStudioEnvironments filters invalid entries', async () => {
    localStorage.setItem(
      GQL_ENVS_STORAGE_KEY,
      JSON.stringify([makeEnv(), { id: 1 }, null, 'bad']),
    );
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv()]);
  });

  it('writeGqlStudioEnvironments persists to IDB on web', async () => {
    await writeGqlStudioEnvironments([makeEnv()]);
    expect(writeKeyMock).not.toHaveBeenCalled();
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv()]);
  });

  it('writeGqlStudioEnvironments falls back to writeKey when IDB save throws', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbSaveStudioEnvironments').mockRejectedValueOnce(new Error('quota'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeGqlStudioEnvironments([makeEnv()]);
    expect(writeKeyMock).toHaveBeenCalledWith(GQL_ENVS_STORAGE_KEY, JSON.stringify([makeEnv()]));
    errSpy.mockRestore();
    vi.mocked(idbMod.idbSaveStudioEnvironments).mockRestore();
  });

  it('readGqlStudioEnvironments falls back to readKey when IDB unavailable', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockResolvedValue(JSON.stringify([makeEnv({ name: 'Tauri' })]));
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv({ name: 'Tauri' })]);
  });

  it('purgeGqlStudioEnvironmentsByName removes matches and promotes active env', async () => {
    const { purgeGqlStudioEnvironmentsByName } = await import('./gqlStudioEnvironmentStorage');
    const envs = [
      makeEnv({ id: 'e1', name: 'Demo', isActive: true }),
      makeEnv({ id: 'e2', name: 'Demo', isActive: false }),
      makeEnv({ id: 'e3', name: 'Keep', isActive: false }),
    ];
    await writeGqlStudioEnvironments(envs);
    const handler = vi.fn();
    window.addEventListener('gql-environments-reload', handler);
    await expect(purgeGqlStudioEnvironmentsByName('Demo')).resolves.toBe(true);
    const remaining = await readGqlStudioEnvironments();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.name).toBe('Keep');
    expect(remaining[0]?.isActive).toBe(true);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('gql-environments-reload', handler);
  });

  it('purgeGqlStudioEnvironmentsByName returns false when no matches', async () => {
    const { purgeGqlStudioEnvironmentsByName } = await import('./gqlStudioEnvironmentStorage');
    await writeGqlStudioEnvironments([makeEnv({ name: 'Only' })]);
    await expect(purgeGqlStudioEnvironmentsByName('Missing')).resolves.toBe(false);
  });

  it('readGqlStudioEnvironments falls back to readKey when IDB has no data', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbLoadStudioEnvironments').mockResolvedValue(null);
    vi.spyOn(idbMod, 'idbMigrateStudioEnvironmentsFromLocalStorage').mockResolvedValue(false);
    readKeyMock.mockResolvedValue(JSON.stringify([makeEnv({ name: 'Fallback' })]));
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv({ name: 'Fallback' })]);
    vi.restoreAllMocks();
  });

  it('readGqlStudioEnvironments returns empty when migration succeeds but IDB stays empty', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbLoadStudioEnvironments').mockResolvedValue(null);
    vi.spyOn(idbMod, 'idbMigrateStudioEnvironmentsFromLocalStorage').mockResolvedValue(true);
    readKeyMock.mockResolvedValue(null);
    await expect(readGqlStudioEnvironments()).resolves.toEqual([]);
    vi.restoreAllMocks();
  });

  it('loadEnvironmentsFromIdb swallows IDB errors and falls back to readKey', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbLoadStudioEnvironments').mockRejectedValue(new Error('idb down'));
    readKeyMock.mockResolvedValue(JSON.stringify([makeEnv({ name: 'Recovery' })]));
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv({ name: 'Recovery' })]);
    vi.restoreAllMocks();
  });
});
