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
  readConnectionProfiles,
  writeConnectionProfiles,
  GQL_PROFILES_STORAGE_KEY,
  type ConnectionProfile,
} from './connectionProfileStorage';

const validProfile: ConnectionProfile = {
  id: 'prof-1',
  name: 'Local',
  endpoint: 'http://localhost:4010/graphql',
  auth: null,
  createdAt: 1,
};

describe('connectionProfileStorage — web IDB path', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    readKeyMock.mockReset();
    writeKeyMock.mockReset();
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  it('readConnectionProfiles loads from IDB after migration', async () => {
    localStorage.setItem(GQL_PROFILES_STORAGE_KEY, JSON.stringify([validProfile]));
    await expect(readConnectionProfiles()).resolves.toEqual([validProfile]);
    expect(readKeyMock).not.toHaveBeenCalled();
  });

  it('writeConnectionProfiles persists to IDB on web', async () => {
    const handler = vi.fn();
    window.addEventListener('gql-profiles-reload', handler);
    await writeConnectionProfiles([validProfile]);
    expect(writeKeyMock).not.toHaveBeenCalled();
    await expect(readConnectionProfiles()).resolves.toEqual([validProfile]);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('gql-profiles-reload', handler);
  });

  it('writeConnectionProfiles falls back to writeKey when IDB save throws', async () => {
    vi.spyOn(await import('../../../shared/utils/idbGraphqlStudio'), 'idbSaveConnectionProfiles')
      .mockRejectedValueOnce(new Error('quota'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn();
    window.addEventListener('gql-profiles-reload', handler);
    await writeConnectionProfiles([validProfile]);
    expect(writeKeyMock).toHaveBeenCalledWith(
      GQL_PROFILES_STORAGE_KEY,
      JSON.stringify([validProfile]),
    );
    expect(handler).toHaveBeenCalled();
    errSpy.mockRestore();
    window.removeEventListener('gql-profiles-reload', handler);
  });

  it('loadProfilesFromIdb returns null on IDB error and falls back to readKey', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockResolvedValue(JSON.stringify([validProfile]));
    await expect(readConnectionProfiles()).resolves.toEqual([validProfile]);
  });

  it('readConnectionProfiles returns empty array on parse error', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockResolvedValue('{bad');
    await expect(readConnectionProfiles()).resolves.toEqual([]);
  });

  it('readConnectionProfiles falls back to readKey when IDB has no data', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbLoadConnectionProfiles').mockResolvedValue(null);
    vi.spyOn(idbMod, 'idbMigrateConnectionProfilesFromLocalStorage').mockResolvedValue(false);
    readKeyMock.mockResolvedValue(JSON.stringify([validProfile]));
    await expect(readConnectionProfiles()).resolves.toEqual([validProfile]);
    vi.restoreAllMocks();
  });

  it('readConnectionProfiles returns empty when migration succeeds but IDB stays empty', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbLoadConnectionProfiles').mockResolvedValue(null);
    vi.spyOn(idbMod, 'idbMigrateConnectionProfilesFromLocalStorage').mockResolvedValue(true);
    readKeyMock.mockResolvedValue(null);
    await expect(readConnectionProfiles()).resolves.toEqual([]);
    vi.restoreAllMocks();
  });

  it('removeConnectionProfilesByNames returns 0 for empty name list', async () => {
    const { removeConnectionProfilesByNames } = await import('./connectionProfileStorage');
    await writeConnectionProfiles([validProfile]);
    await expect(removeConnectionProfilesByNames([])).resolves.toBe(0);
    await expect(removeConnectionProfilesByNames(['   '])).resolves.toBe(0);
  });

  it('removeConnectionProfilesByNames removes matching profiles', async () => {
    const { removeConnectionProfilesByNames } = await import('./connectionProfileStorage');
    await writeConnectionProfiles([
      validProfile,
      { ...validProfile, id: 'prof-2', name: 'Remote' },
    ]);
    await expect(removeConnectionProfilesByNames(['Local'])).resolves.toBe(1);
    await expect(readConnectionProfiles()).resolves.toEqual([
      { ...validProfile, id: 'prof-2', name: 'Remote' },
    ]);
  });
});
