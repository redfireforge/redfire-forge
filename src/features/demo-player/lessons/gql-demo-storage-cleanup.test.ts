/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../graphql/utils/gqlDemoConnectionProfiles', () => ({
  purgeGqlDemoConnectionProfiles: vi.fn(async () => 2),
}));

vi.mock('../../../shared/utils/storage', () => ({
  purgeStaleRunnerConfigKeys: vi.fn(() => ({ removed: 3, freedBytes: 4096 })),
  cleanupStaleStorageKeys: vi.fn(() => ({ removed: 5, freedKB: 12 })),
}));

import { purgeGqlDemoConnectionProfiles } from '../../graphql/utils/gqlDemoConnectionProfiles';
import { purgeStaleRunnerConfigKeys, cleanupStaleStorageKeys } from '../../../shared/utils/storage';
import { purgeGqlDemoEphemeralStorage } from './gql-demo-storage-cleanup';

describe('purgeGqlDemoEphemeralStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('purges profiles, runner configs, and stale keys', async () => {
    const result = await purgeGqlDemoEphemeralStorage();
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalled();
    expect(purgeStaleRunnerConfigKeys).toHaveBeenCalled();
    expect(cleanupStaleStorageKeys).toHaveBeenCalled();
    expect(result).toEqual({
      profilesRemoved: 2,
      runnerConfigsRemoved: 3,
      staleKeysRemoved: 5,
      freedKB: 16,
    });
  });
});
