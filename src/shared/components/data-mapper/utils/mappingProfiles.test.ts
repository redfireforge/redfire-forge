/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { loadProfiles, saveProfile, deleteProfile, renameProfile, getProfileById, applyProfileDelta, } from './mappingProfiles';
import { Mapping } from '../types';

vi.mock('../../../utils/storage', () => ({
  readKey: vi.fn((key: string) => Promise.resolve(localStorage.getItem(key))),
  writeKey: vi.fn((key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); }),
}));

const CTX = 'test-ctx';

function makeMapping(overrides: Partial<Mapping> = {}): Mapping {
  return { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'x', ...overrides };
}

describe('mappingProfiles', () => {
  let getItemSpy: MockInstance;
  let setItemSpy: MockInstance;

  beforeEach(() => {
    localStorage.clear();
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  it('loadProfiles returns [] when no profiles stored', async () => {
    expect(await loadProfiles(CTX)).toEqual([]);
  });

  it('loadProfiles returns [] for corrupt JSON', async () => {
    localStorage.setItem('dm-profiles-test-ctx', '{bad}');
    expect(await loadProfiles(CTX)).toEqual([]);
  });

  it('saveProfile creates a new profile', async () => {
    const m = [makeMapping()];
    const profile = await saveProfile(CTX, 'My Profile', m);
    expect(profile.name).toBe('My Profile');
    expect(profile.contextId).toBe(CTX);
    expect(profile.mappings).toEqual(m);
    expect(profile.id).toMatch(/^prof-/);
    expect(setItemSpy).toHaveBeenCalled();

    const loaded = await loadProfiles(CTX);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('My Profile');
  });

  it('saveProfile overwrites existing profile with same name', async () => {
    const m1 = [makeMapping({ id: 'm1' })];
    const m2 = [makeMapping({ id: 'm2' })];
    const p1 = await saveProfile(CTX, 'Overwrite', m1);
    const p2 = await saveProfile(CTX, 'Overwrite', m2);
    expect(p2.id).toBe(p1.id);
    expect(p2.mappings).toEqual(m2);

    const loaded = await loadProfiles(CTX);
    expect(loaded).toHaveLength(1);
  });

  it('saveProfile allows different names', async () => {
    await saveProfile(CTX, 'Alpha', [makeMapping()]);
    await saveProfile(CTX, 'Beta', [makeMapping()]);
    expect(await loadProfiles(CTX)).toHaveLength(2);
  });

  it('deleteProfile removes a profile by id', async () => {
    const p = await saveProfile(CTX, 'Doomed', [makeMapping()]);
    expect(await deleteProfile(CTX, p.id)).toBe(true);
    expect(await loadProfiles(CTX)).toHaveLength(0);
  });

  it('deleteProfile returns false for unknown id', async () => {
    expect(await deleteProfile(CTX, 'nonexistent')).toBe(false);
  });

  it('renameProfile changes the name', async () => {
    const p = await saveProfile(CTX, 'Old', [makeMapping()]);
    const renamed = await renameProfile(CTX, p.id, 'New');
    expect(renamed?.name).toBe('New');

    const loaded = await loadProfiles(CTX);
    expect(loaded[0].name).toBe('New');
  });

  it('renameProfile returns null if name collides', async () => {
    await saveProfile(CTX, 'A', [makeMapping()]);
    const pB = await saveProfile(CTX, 'B', [makeMapping()]);
    expect(await renameProfile(CTX, pB.id, 'A')).toBeNull();
  });

  it('renameProfile returns null for unknown profile id', async () => {
    expect(await renameProfile(CTX, 'ghost', 'Whatever')).toBeNull();
  });

  it('getProfileById finds profile', async () => {
    const p = await saveProfile(CTX, 'Find Me', [makeMapping()]);
    expect((await getProfileById(CTX, p.id))?.name).toBe('Find Me');
  });

  it('getProfileById returns undefined for missing id', async () => {
    expect(await getProfileById(CTX, 'nope')).toBeUndefined();
  });

  it('profiles are isolated by contextId', async () => {
    await saveProfile('ctx-a', 'Profile', [makeMapping()]);
    expect(await loadProfiles('ctx-b')).toHaveLength(0);
    expect(await loadProfiles('ctx-a')).toHaveLength(1);
  });

  it('uses storage key prefix correctly', async () => {
    await saveProfile(CTX, 'P', [makeMapping()]);
    expect(getItemSpy).toHaveBeenCalledWith('dm-profiles-test-ctx');
  });
});

describe('applyProfileDelta', () => {
  it('inserts new mappings when target path does not exist', () => {
    const current = [makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'userName' })];
    const profile = [makeMapping({ id: 'p1', sourcePath: 'email', targetPath: 'userEmail' })];
    const result = applyProfileDelta(current, profile, () => 'new-1');
    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.unchangedCount).toBe(0);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings.some((m) => m.id === 'new-1' && m.targetPath === 'userEmail')).toBe(true);
  });

  it('updates existing mapping when target path matches but source/expression differs', () => {
    const current = [makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'userName' })];
    const profile = [makeMapping({ id: 'p1', sourcePath: 'email', targetPath: 'userName', expression: '$lower($.email)' })];
    const result = applyProfileDelta(current, profile, () => 'unused');
    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.unchangedCount).toBe(0);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].id).toBe('m1');
    expect(result.mappings[0].sourcePath).toBe('email');
    expect(result.mappings[0].expression).toBe('$lower($.email)');
  });

  it('counts unchanged mappings when profile already matches current by normalized paths', () => {
    const current = [makeMapping({ id: 'm1', sourcePath: '$.name', sourceId: 's1', targetPath: '$.user.name' })];
    const profile = [makeMapping({ id: 'p1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' })];
    const result = applyProfileDelta(current, profile, () => 'unused');
    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(0);
    expect(result.unchangedCount).toBe(1);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].id).toBe('m1');
  });
});
