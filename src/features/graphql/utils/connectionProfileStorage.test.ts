/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseConnectionProfiles,
  readConnectionProfiles,
  writeConnectionProfiles,
  removeConnectionProfilesByNames,
  dispatchGqlProfilesReload,
  GQL_PROFILES_STORAGE_KEY,
  GQL_PROFILES_RELOAD_EVENT,
  type ConnectionProfile,
} from './connectionProfileStorage';
import { readKey, writeKey } from '@shared/utils/storage';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

const validProfile: ConnectionProfile = {
  id: 'prof-1',
  name: 'Local',
  endpoint: 'http://localhost:4010/graphql',
  auth: null,
  createdAt: 1_700_000_000_000,
};

const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);

describe('connectionProfileStorage', () => {
  beforeEach(() => {
    vi.mocked(readKey).mockReset();
    vi.mocked(writeKey).mockReset();
    mockWriteKey.mockResolvedValue(undefined);
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

  describe('writeConnectionProfiles', () => {
    it('persists JSON and dispatches reload event', async () => {
      const handler = vi.fn();
      window.addEventListener(GQL_PROFILES_RELOAD_EVENT, handler);
      await writeConnectionProfiles([validProfile]);
      expect(writeKey).toHaveBeenCalledWith(
        GQL_PROFILES_STORAGE_KEY,
        JSON.stringify([validProfile]),
      );
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener(GQL_PROFILES_RELOAD_EVENT, handler);
    });
  });

  describe('removeConnectionProfilesByNames', () => {
    it('removes all profiles matching any provided name', async () => {
      const duplicate1: ConnectionProfile = {
        ...validProfile,
        id: 'prof-2',
        name: 'GQL Auth Demo',
      };
      const duplicate2: ConnectionProfile = {
        ...validProfile,
        id: 'prof-3',
        name: 'GQL Auth Demo',
      };
      const keep: ConnectionProfile = {
        ...validProfile,
        id: 'prof-4',
        name: 'My Custom Profile',
      };
      mockReadKey.mockResolvedValue(JSON.stringify([duplicate1, duplicate2, keep]));

      await expect(
        removeConnectionProfilesByNames(['GQL Auth Demo']),
      ).resolves.toBe(2);

      expect(writeKey).toHaveBeenCalledWith(
        GQL_PROFILES_STORAGE_KEY,
        JSON.stringify([keep]),
      );
    });

    it('returns 0 when no names match', async () => {
      mockReadKey.mockResolvedValue(JSON.stringify([validProfile]));
      await expect(removeConnectionProfilesByNames(['missing'])).resolves.toBe(0);
      expect(writeKey).not.toHaveBeenCalled();
    });

    it('returns 0 without reading storage when names are empty or whitespace', async () => {
      await expect(removeConnectionProfilesByNames(['', '   '])).resolves.toBe(0);
      expect(readKey).not.toHaveBeenCalled();
    });
  });

  describe('dispatchGqlProfilesReload', () => {
    it('fires a custom event on window', () => {
      const handler = vi.fn();
      window.addEventListener(GQL_PROFILES_RELOAD_EVENT, handler);
      dispatchGqlProfilesReload();
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener(GQL_PROFILES_RELOAD_EVENT, handler);
    });

    it('no-ops when window is undefined', () => {
      const savedWindow = globalThis.window;
      // @ts-expect-error — simulate non-browser runtime
      delete globalThis.window;
      expect(() => dispatchGqlProfilesReload()).not.toThrow();
      globalThis.window = savedWindow;
    });
  });
});
