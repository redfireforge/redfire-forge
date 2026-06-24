import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES,
  GQL6_DEMO_PROFILE_NAME,
  GQL14_STAGING_PROFILE_NAME,
  purgeGqlDemoConnectionProfiles,
} from './gqlDemoConnectionProfiles';
import { removeConnectionProfilesByNames } from './connectionProfileStorage';

vi.mock('./connectionProfileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./connectionProfileStorage')>();
  return {
    ...actual,
    removeConnectionProfilesByNames: vi.fn().mockResolvedValue(0),
  };
});

const mockRemove = vi.mocked(removeConnectionProfilesByNames);

describe('gqlDemoConnectionProfiles', () => {
  beforeEach(() => {
    mockRemove.mockClear();
  });

  it('exports all demo lesson profile names', () => {
    expect(ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES).toContain(GQL6_DEMO_PROFILE_NAME);
    expect(ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES).toContain(GQL14_STAGING_PROFILE_NAME);
  });

  it('purgeGqlDemoConnectionProfiles delegates to storage helper with defaults', async () => {
    mockRemove.mockResolvedValue(3);
    await expect(purgeGqlDemoConnectionProfiles()).resolves.toBe(3);
    expect(mockRemove).toHaveBeenCalledWith(ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES);
  });

  it('purgeGqlDemoConnectionProfiles accepts an explicit name subset', async () => {
    mockRemove.mockResolvedValue(1);
    await expect(purgeGqlDemoConnectionProfiles([GQL6_DEMO_PROFILE_NAME])).resolves.toBe(1);
    expect(mockRemove).toHaveBeenCalledWith([GQL6_DEMO_PROFILE_NAME]);
  });
});
