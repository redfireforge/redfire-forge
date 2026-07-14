/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../utils/connectionProfileStorage', () => ({
  readConnectionProfiles: vi.fn().mockResolvedValue([]),
  writeConnectionProfiles: vi.fn().mockResolvedValue(undefined),
  GQL_PROFILES_RELOAD_EVENT: 'gql-profiles-reload',
}));

vi.mock('../utils/tabPersistence', () => ({
  graphqlAuthEquals: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

import { readConnectionProfiles, writeConnectionProfiles, GQL_PROFILES_RELOAD_EVENT } from '../utils/connectionProfileStorage';
import { useGraphqlConnectionProfiles } from './useGraphqlConnectionProfiles';

const profile = {
  id: 'p1',
  name: 'Local',
  endpoint: 'http://localhost/graphql',
  auth: null,
  createdAt: 1,
};

beforeEach(() => {
  resetAllMocks();
  vi.mocked(readConnectionProfiles).mockResolvedValue([profile]);
});

describe('useGraphqlConnectionProfiles — coverage gaps', () => {
  it('updateProfile no-ops when id missing', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profilesReady).toBe(true));
    act(() => {
      result.current.updateProfile('missing', { endpoint: 'http://x' });
    });
    expect(writeConnectionProfiles).not.toHaveBeenCalled();
  });

  it('updateProfile no-ops when endpoint and auth unchanged', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
    act(() => {
      result.current.updateProfile('p1', { endpoint: profile.endpoint, auth: null });
    });
    expect(writeConnectionProfiles).not.toHaveBeenCalled();
  });

  it('updateProfile persists endpoint patch', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
    act(() => {
      result.current.updateProfile('p1', { endpoint: 'http://new/graphql' });
    });
    expect(result.current.profiles[0]?.endpoint).toBe('http://new/graphql');
    expect(writeConnectionProfiles).toHaveBeenCalled();
  });

  it('reloads profiles on GQL_PROFILES_RELOAD_EVENT', async () => {
    vi.mocked(readConnectionProfiles)
      .mockResolvedValueOnce([profile])
      .mockResolvedValueOnce([{ ...profile, name: 'Reloaded' }]);
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profilesReady).toBe(true));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GQL_PROFILES_RELOAD_EVENT));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.profiles[0]?.name).toBe('Reloaded'));
  });

  it('saveProfile uses Untitled Profile for blank name', async () => {
    const { result } = renderHook(() => useGraphqlConnectionProfiles());
    await waitFor(() => expect(result.current.profilesReady).toBe(true));
    act(() => {
      result.current.saveProfile('   ', 'http://x', null);
    });
    expect(result.current.profiles.some((p) => p.name === 'Untitled Profile')).toBe(true);
  });
});
