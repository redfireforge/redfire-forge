import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseConnectionProfiles,
  readConnectionProfiles,
  GQL_PROFILES_STORAGE_KEY,
  type ConnectionProfile,
} from './connectionProfileStorage';
import { readKey } from '../../../shared/utils/storage';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
}));

const validProfile: ConnectionProfile = {
  id: 'prof-1',
  name: 'Local',
  endpoint: 'http://localhost:4010/graphql',
  auth: null,
  createdAt: 1_700_000_000_000,
};

describe('connectionProfileStorage', () => {
  beforeEach(() => {
    vi.mocked(readKey).mockReset();
  });

  describe('parseConnectionProfiles', () => {
    it('returns empty array for null, undefined, and empty string', () => {
      expect(parseConnectionProfiles(null)).toEqual([]);
      expect(parseConnectionProfiles(undefined)).toEqual([]);
      expect(parseConnectionProfiles('')).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      expect(parseConnectionProfiles('{not-json')).toEqual([]);
    });

    it('returns empty array when parsed value is not an array', () => {
      expect(parseConnectionProfiles(JSON.stringify({ id: 'x' }))).toEqual([]);
    });

    it('filters out entries missing required string fields', () => {
      const raw = JSON.stringify([
        validProfile,
        null,
        {},
        { id: 1, name: 'bad', endpoint: 'http://x' },
        { id: 'ok', name: 'ok', endpoint: 123 },
      ]);
      expect(parseConnectionProfiles(raw)).toEqual([validProfile]);
    });

    it('keeps profiles with optional auth omitted', () => {
      const minimal = { id: 'a', name: 'A', endpoint: 'http://a/graphql' };
      expect(parseConnectionProfiles(JSON.stringify([minimal]))).toEqual([minimal]);
    });
  });

  describe('readConnectionProfiles', () => {
    it('reads storage key and parses profiles', async () => {
      vi.mocked(readKey).mockResolvedValue(JSON.stringify([validProfile]));
      await expect(readConnectionProfiles()).resolves.toEqual([validProfile]);
      expect(readKey).toHaveBeenCalledWith(GQL_PROFILES_STORAGE_KEY);
    });

    it('returns empty array when readKey throws', async () => {
      vi.mocked(readKey).mockRejectedValue(new Error('storage unavailable'));
      await expect(readConnectionProfiles()).resolves.toEqual([]);
    });
  });
});
