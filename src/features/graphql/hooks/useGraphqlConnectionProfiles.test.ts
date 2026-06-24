/**
 * @vitest-environment jsdom
 *
 * useGraphqlConnectionProfiles — unit tests.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

vi.mock('../utils/connectionProfileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/connectionProfileStorage')>();
  return {
    ...actual,
    readConnectionProfiles: vi.fn(actual.readConnectionProfiles),
  };
});

import { readKey, writeKey } from '../../../shared/utils/storage';
import {
  readConnectionProfiles,
  parseConnectionProfiles,
  GQL_PROFILES_RELOAD_EVENT,
} from '../utils/connectionProfileStorage';
import { useGraphqlConnectionProfiles } from './useGraphqlConnectionProfiles';
import type { ConnectionProfile } from './useGraphqlConnectionProfiles';

const mockReadConnectionProfiles = vi.mocked(readConnectionProfiles);

const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'p-1',
    name: 'Prod API',
    endpoint: 'https://api.example.com/graphql',
    auth: null,
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockReadKey.mockResolvedValue(null);
  mockWriteKey.mockResolvedValue(undefined);
  mockReadConnectionProfiles.mockImplementation(async () => {
    const raw = await mockReadKey('gql_profiles_v1');
    return parseConnectionProfiles(raw);
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGraphqlConnectionProfiles — initialization', () => {
  it('starts with an empty profiles list', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});
    expect(result.current.profiles).toEqual([]);
  });

  it('loads profiles from storage on mount', async () => {
    const stored = [makeProfile()];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
    expect(result.current.profiles[0].name).toBe('Prod API');
  });

  it('ignores non-array stored value', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify({ not: 'array' }));
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});
    expect(result.current.profiles).toEqual([]);
  });

  it('ignores corrupt JSON in storage', async () => {
    mockReadKey.mockResolvedValue('not-json{{{');
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});
    expect(result.current.profiles).toEqual([]);
  });

  it('filters out profiles with missing required fields', async () => {
    const invalid = [
      { id: 1, name: 'Bad', endpoint: 'x' },         // id is not string
      { id: 'ok', name: 42, endpoint: 'x' },          // name is not string
      { id: 'ok', name: 'Good', endpoint: 'x' },      // valid
    ];
    mockReadKey.mockResolvedValue(JSON.stringify(invalid));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
    expect(result.current.profiles[0].name).toBe('Good');
  });

  it('handles storage error gracefully', async () => {
    mockReadKey.mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});
    expect(result.current.profiles).toEqual([]);
  });

  it('handles readConnectionProfiles rejection on mount', async () => {
    mockReadConnectionProfiles.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});
    expect(result.current.profiles).toEqual([]);
  });
});

describe('useGraphqlConnectionProfiles — saveProfile', () => {
  it('adds a new profile and returns it', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    let saved!: ConnectionProfile;
    act(() => {
      saved = result.current.saveProfile('My API', 'https://api.example.com/graphql', null);
    });

    expect(result.current.profiles).toHaveLength(1);
    expect(saved.name).toBe('My API');
    expect(saved.endpoint).toBe('https://api.example.com/graphql');
    expect(saved.auth).toBeNull();
    expect(saved.id).toMatch(/^gql-profile-/);
    expect(saved.createdAt).toBeGreaterThan(0);
  });

  it('trims whitespace from name', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => { result.current.saveProfile('  Spaces  ', 'https://x.com', null); });

    expect(result.current.profiles[0].name).toBe('Spaces');
  });

  it('falls back to "Untitled Profile" when name is empty', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => { result.current.saveProfile('', 'https://x.com', null); });

    expect(result.current.profiles[0].name).toBe('Untitled Profile');
  });

  it('falls back to "Untitled Profile" when name is whitespace-only', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => { result.current.saveProfile('   ', 'https://x.com', null); });

    expect(result.current.profiles[0].name).toBe('Untitled Profile');
  });

  it('persists after save', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => { result.current.saveProfile('API', 'https://x.com', null); });

    expect(mockWriteKey).toHaveBeenCalledWith('gql_profiles_v1', expect.any(String));
  });

  it('handles writeKey failure silently on save', async () => {
    mockWriteKey.mockRejectedValue(new Error('quota exceeded'));
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => { result.current.saveProfile('API', 'https://x.com', null); });

    expect(result.current.profiles).toHaveLength(1);
  });

  it('accumulates multiple saved profiles', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    act(() => {
      result.current.saveProfile('Alpha', 'https://a.com', null);
      result.current.saveProfile('Beta', 'https://b.com', null);
    });

    expect(result.current.profiles).toHaveLength(2);
  });

  it('saves auth config when provided', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await act(async () => {});

    const auth = { type: 'bearer' as const, token: 'secret' };
    let saved!: ConnectionProfile;
    act(() => {
      saved = result.current.saveProfile('Secured', 'https://secure.com', auth);
    });

    expect(saved.auth).toEqual(auth);
  });
});

describe('useGraphqlConnectionProfiles — renameProfile', () => {
  it('renames an existing profile', async () => {
    const stored = [makeProfile({ id: 'p-1', name: 'Old Name' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.renameProfile('p-1', 'New Name'); });

    expect(result.current.profiles[0].name).toBe('New Name');
  });

  it('keeps existing name if new name is empty', async () => {
    const stored = [makeProfile({ id: 'p-1', name: 'Existing' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.renameProfile('p-1', ''); });

    expect(result.current.profiles[0].name).toBe('Existing');
  });

  it('trims whitespace from new name', async () => {
    const stored = [makeProfile({ id: 'p-1', name: 'Old' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.renameProfile('p-1', '  Trimmed  '); });

    expect(result.current.profiles[0].name).toBe('Trimmed');
  });

  it('does not mutate other profiles', async () => {
    const stored = [
      makeProfile({ id: 'p-1', name: 'Alpha' }),
      makeProfile({ id: 'p-2', name: 'Beta' }),
    ];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(2));

    act(() => { result.current.renameProfile('p-1', 'AlphaRenamed'); });

    expect(result.current.profiles[0].name).toBe('AlphaRenamed');
    expect(result.current.profiles[1].name).toBe('Beta');
  });

  it('persists after rename', async () => {
    const stored = [makeProfile({ id: 'p-1', name: 'Old' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.renameProfile('p-1', 'New'); });

    expect(mockWriteKey).toHaveBeenCalledWith('gql_profiles_v1', expect.any(String));
  });
});

describe('useGraphqlConnectionProfiles — deleteProfile', () => {
  it('removes the specified profile', async () => {
    const stored = [
      makeProfile({ id: 'p-1', name: 'Alpha' }),
      makeProfile({ id: 'p-2', name: 'Beta' }),
    ];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(2));

    act(() => { result.current.deleteProfile('p-1'); });

    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].id).toBe('p-2');
  });

  it('is a no-op for unknown id', async () => {
    const stored = [makeProfile({ id: 'p-1' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.deleteProfile('does-not-exist'); });

    expect(result.current.profiles).toHaveLength(1);
  });

  it('persists after delete', async () => {
    const stored = [makeProfile({ id: 'p-1' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.deleteProfile('p-1'); });

    expect(mockWriteKey).toHaveBeenCalledWith('gql_profiles_v1', expect.any(String));
  });

  it('results in empty list after deleting the last profile', async () => {
    const stored = [makeProfile({ id: 'p-1' })];
    mockReadKey.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    act(() => { result.current.deleteProfile('p-1'); });

    expect(result.current.profiles).toHaveLength(0);
  });
});

describe('useGraphqlConnectionProfiles — reload event', () => {
  it('reloads profiles when GQL_PROFILES_RELOAD_EVENT fires', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify([makeProfile()]));

    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    mockReadKey.mockResolvedValue(JSON.stringify([
      makeProfile(),
      makeProfile({ id: 'p-2', name: 'Staging' }),
    ]));

    act(() => {
      window.dispatchEvent(new CustomEvent(GQL_PROFILES_RELOAD_EVENT));
    });

    await waitFor(() => expect(result.current.profiles).toHaveLength(2));
  });
});
