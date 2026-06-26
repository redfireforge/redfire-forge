/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../adapters', () => ({
  purgeGqlDemoConnectionProfiles: vi.fn(async () => 2),
  purgeGqlDemoGlobalAuthProfiles: vi.fn(async () => 1),
  purgeGqlLesson9CollectionArtifacts: vi.fn(async () => ({ collectionsRemoved: 1, itemsRemoved: 4 })),
  purgeGqlLesson9DemoHistory: vi.fn(async () => 3),
}));

vi.mock('@shared/utils/storage', () => ({
  ensureBrowserLargeDataMigrated: vi.fn(async () => undefined),
  purgeStaleRunnerConfigKeys: vi.fn(() => ({ removed: 3, freedBytes: 4096 })),
  cleanupStaleStorageKeys: vi.fn(() => ({ removed: 5, freedKB: 12 })),
}));

import { purgeGqlDemoConnectionProfiles, purgeGqlDemoGlobalAuthProfiles, purgeGqlLesson9CollectionArtifacts, purgeGqlLesson9DemoHistory } from '../adapters';
import { purgeStaleRunnerConfigKeys, cleanupStaleStorageKeys, ensureBrowserLargeDataMigrated } from '@shared/utils/storage';
import { purgeGqlDemoEphemeralStorage } from './gql-demo-storage-cleanup';

describe('purgeGqlDemoEphemeralStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('purges profiles, runner configs, and stale keys', async () => {
    const result = await purgeGqlDemoEphemeralStorage();
    expect(ensureBrowserLargeDataMigrated).toHaveBeenCalled();
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalled();
    expect(purgeGqlDemoGlobalAuthProfiles).toHaveBeenCalled();
    expect(purgeGqlLesson9CollectionArtifacts).toHaveBeenCalled();
    expect(purgeGqlLesson9DemoHistory).toHaveBeenCalled();
    expect(purgeStaleRunnerConfigKeys).toHaveBeenCalled();
    expect(cleanupStaleStorageKeys).toHaveBeenCalled();
    expect(result).toEqual({
      profilesRemoved: 2,
      runnerConfigsRemoved: 3,
      staleKeysRemoved: 5,
      collectionsRemoved: 1,
      collectionItemsRemoved: 4,
      historyEntriesRemoved: 3,
      globalAuthProfilesRemoved: 1,
      freedKB: 16,
    });
  });
});
