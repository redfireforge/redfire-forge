/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import * as platform from '../../../shared/utils/platform';
import * as storage from '../../../shared/utils/storage';
import {
  deleteGrpcLoadTestProfile,
  listGrpcLoadTestProfiles,
  renameGrpcLoadTestProfile,
  resetGrpcLoadTestProfilesPersistQueueForTests,
  saveGrpcLoadTestProfile,
} from './grpcLoadTestProfileRepository';

describe('grpcLoadTestProfileRepository coverage gaps', () => {
  beforeEach(async () => {
    resetGrpcLoadTestProfilesPersistQueueForTests();
    vi.mocked(platform.isTauri).mockReturnValue(false);
    const profiles = await listGrpcLoadTestProfiles();
    for (const profile of profiles) {
      await deleteGrpcLoadTestProfile(profile.id);
    }
  });

  it('updates an existing profile when save includes id', async () => {
    const saved = await saveGrpcLoadTestProfile({
      name: 'Original',
      config: { concurrency: 2, totalCalls: 10 },
    });
    const updated = await saveGrpcLoadTestProfile({
      id: saved.id,
      name: 'Original',
      config: { concurrency: 4, totalCalls: 20 },
    });
    expect(updated.id).toBe(saved.id);
    expect(updated.config.concurrency).toBe(4);
    expect(await listGrpcLoadTestProfiles()).toHaveLength(1);
  });

  it('serializes concurrent saves through persist queue without dropping profiles', async () => {
    await Promise.all([
      saveGrpcLoadTestProfile({ name: 'Concurrent A', config: { concurrency: 1, totalCalls: 5 } }),
      saveGrpcLoadTestProfile({ name: 'Concurrent B', config: { concurrency: 2, totalCalls: 10 } }),
    ]);

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles.map((profile) => profile.name)).toEqual(['Concurrent A', 'Concurrent B']);
  });

  it('rejects rename when profile is missing', async () => {
    await expect(renameGrpcLoadTestProfile('missing-id', 'New')).rejects.toThrow(/not found/i);
  });

  it('rejects rename to duplicate name', async () => {
    await saveGrpcLoadTestProfile({ name: 'Alpha', config: { concurrency: 1, totalCalls: 1 } });
    const beta = await saveGrpcLoadTestProfile({ name: 'Beta', config: { concurrency: 2, totalCalls: 2 } });
    await expect(renameGrpcLoadTestProfile(beta.id, 'alpha')).rejects.toThrow(/already exists/i);
  });

  it('rejects rename to blank name after trimming', async () => {
    const saved = await saveGrpcLoadTestProfile({ name: 'Needs Name', config: { concurrency: 1, totalCalls: 1 } });
    await expect(renameGrpcLoadTestProfile(saved.id, '   ')).rejects.toThrow(/name is required/i);
  });

  it('rejects empty profile name on save', async () => {
    await expect(saveGrpcLoadTestProfile({
      name: '   ',
      config: { concurrency: 1, totalCalls: 1 },
    })).rejects.toThrow(/name is required/i);
  });

  it('migrates legacy Tauri storage into IDB when IDB is empty', async () => {
    const legacyStore = {
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [{
        id: 'legacy-1',
        name: 'Legacy',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: { concurrency: 2, totalCalls: 5 },
      }],
    };
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify(legacyStore));
    const removeSpy = vi.spyOn(storage, 'removeKey').mockResolvedValue(undefined);

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe('Legacy');
    expect(removeSpy).toHaveBeenCalled();
  });

  it('persists through Tauri storage when isTauri is true', async () => {
    vi.mocked(platform.isTauri).mockReturnValue(true);
    const writeSpy = vi.spyOn(storage, 'writeKey').mockResolvedValue(undefined);
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [],
    }));

    await saveGrpcLoadTestProfile({ name: 'Desktop', config: { concurrency: 1, totalCalls: 3 } });

    expect(writeSpy).toHaveBeenCalled();
  });

  it('skips invalid profile rows during normalizeStore', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [
        null,
        { id: 'bad', name: 'Bad', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 0, totalCalls: 1 } },
        { id: 'good', name: 'Good', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 1, totalCalls: 1 } },
      ],
    }));

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe('Good');
  });

  it('returns empty store when loadStore fails', async () => {
    vi.spyOn(storage, 'readKey').mockRejectedValue(new Error('read failed'));
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toEqual([]);
  });

  it('deletes orphaned IDB profile rows on save', async () => {
    const first = await saveGrpcLoadTestProfile({ name: 'Keep', config: { concurrency: 1, totalCalls: 1 } });
    await saveGrpcLoadTestProfile({ name: 'Drop', config: { concurrency: 2, totalCalls: 2 } });
    await deleteGrpcLoadTestProfile(
      (await listGrpcLoadTestProfiles()).find((profile) => profile.name === 'Drop')!.id,
    );
    const remaining = await listGrpcLoadTestProfiles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(first.id);
  });

  it('returns empty list when legacy storage JSON is invalid', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValue('{not-json');
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toEqual([]);
  });

  it('normalizes non-object and non-array legacy stores to empty profiles', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValueOnce('null');
    expect(await listGrpcLoadTestProfiles()).toEqual([]);

    vi.spyOn(storage, 'readKey').mockResolvedValueOnce(JSON.stringify({ schemaVersion: 1, profiles: 'not-array' }));
    expect(await listGrpcLoadTestProfiles()).toEqual([]);
  });

  it('skips profile rows with invalid id, name, updatedAt, or config shape', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: 123,
      profiles: [
        { id: 1, name: 'Bad', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 1, totalCalls: 1 } },
        { id: 'bad-config', name: 'BadConfig', updatedAt: '2026-07-01T00:00:00.000Z', config: null },
        { id: 'ok', name: 'Ok', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 1, totalCalls: 1 } },
      ],
    }));
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe('ok');
  });

  it('throws when saving to IDB while IndexedDB is unavailable', async () => {
    const idbHelpers = await import('../../../shared/utils/idbHelpers');
    vi.spyOn(idbHelpers, 'idbAvailable').mockReturnValue(false);
    await expect(saveGrpcLoadTestProfile({
      name: 'No IDB',
      config: { concurrency: 1, totalCalls: 1 },
    })).rejects.toThrow(/IndexedDB not available/i);
  });
});
