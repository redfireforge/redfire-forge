/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import * as platform from '../../../shared/utils/platform';
import * as storage from '../../../shared/utils/storage';
import {
  deleteGrpcLoadTestProfile,
  getGrpcLoadTestProfileById,
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(platform.isTauri).mockReturnValue(false);
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

  it('normalizes invalid optional request-rate/template fields from legacy rows', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [
        {
          id: 'legacy-normalized',
          name: 'Legacy Normalized',
          updatedAt: '2026-07-01T00:00:00.000Z',
          config: {
            concurrency: 1,
            totalCalls: 1,
            methodOverrideService: 123,
            methodOverrideMethod: true,
            requestRateRps: 'bad-value',
            requestTemplateJson: 42,
          },
        },
      ],
    }));

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.config.methodOverrideService).toBeUndefined();
    expect(profiles[0]?.config.methodOverrideMethod).toBeUndefined();
    expect(profiles[0]?.config.requestRateRps).toBeUndefined();
    expect(profiles[0]?.config.requestTemplateJson).toBeUndefined();
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

  it('returns profile by id and undefined for blank id', async () => {
    const saved = await saveGrpcLoadTestProfile({
      name: 'Lookup',
      config: { concurrency: 2, totalCalls: 10 },
    });
    expect(await getGrpcLoadTestProfileById(saved.id)).toMatchObject({ name: 'Lookup' });
    expect(await getGrpcLoadTestProfileById('')).toBeUndefined();
    expect(await getGrpcLoadTestProfileById('   ')).toBeUndefined();
    expect(await getGrpcLoadTestProfileById('missing-id')).toBeUndefined();
  });

  it('rejects duplicate name when saving a new profile', async () => {
    await saveGrpcLoadTestProfile({ name: 'Alpha', config: { concurrency: 1, totalCalls: 1 } });
    await expect(saveGrpcLoadTestProfile({
      name: 'alpha',
      config: { concurrency: 2, totalCalls: 2 },
    })).rejects.toThrow(/already exists/i);
  });

  it('deletes a profile by id', async () => {
    const saved = await saveGrpcLoadTestProfile({
      name: 'Disposable',
      config: { concurrency: 1, totalCalls: 1 },
    });
    await deleteGrpcLoadTestProfile(saved.id);
    expect(await listGrpcLoadTestProfiles()).toEqual([]);
    expect(await getGrpcLoadTestProfileById(saved.id)).toBeUndefined();
  });

  it('loads profiles directly from IDB when store is already populated', async () => {
    const saved = await saveGrpcLoadTestProfile({
      name: 'Persisted',
      config: { concurrency: 3, totalCalls: 30 },
    });
    const readSpy = vi.spyOn(storage, 'readKey');

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe(saved.id);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('returns empty store when loadStore throws during IDB open', async () => {
    const idbOpen = await import('../../../shared/utils/idbOpen');
    vi.spyOn(idbOpen, 'openDB').mockRejectedValue(new Error('idb open failed'));
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toEqual([]);
  });

  it('rejects save when config fails validation', async () => {
    await expect(saveGrpcLoadTestProfile({
      name: 'Invalid config',
      config: { concurrency: 0, totalCalls: 1 },
    })).rejects.toThrow(/concurrency must be a positive integer/i);
  });

  it('strips negative integer requestRateRps from legacy profile rows', async () => {
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [{
        id: 'legacy-negative-rate',
        name: 'Negative rate',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: {
          concurrency: 1,
          totalCalls: 1,
          requestRateRps: -5,
        },
      }],
    }));

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.config.requestRateRps).toBeUndefined();
  });

  it('propagates Tauri save errors from writeKey', async () => {
    vi.mocked(platform.isTauri).mockReturnValue(true);
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [],
    }));
    vi.spyOn(storage, 'writeKey').mockRejectedValue(new Error('disk full'));

    await expect(saveGrpcLoadTestProfile({
      name: 'Desktop fail',
      config: { concurrency: 1, totalCalls: 1 },
    })).rejects.toThrow(/disk full/i);
  });

  it('ignores legacy key cleanup failures after IDB migration', async () => {
    const legacyStore = {
      schemaVersion: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      profiles: [{
        id: 'legacy-cleanup',
        name: 'Legacy cleanup',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: { concurrency: 2, totalCalls: 5 },
      }],
    };
    vi.spyOn(storage, 'readKey').mockResolvedValue(JSON.stringify(legacyStore));
    vi.spyOn(storage, 'removeKey').mockRejectedValue(new Error('cleanup failed'));

    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe('Legacy cleanup');
  });
});
