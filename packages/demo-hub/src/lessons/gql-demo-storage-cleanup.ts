/**
 * Unified GraphQL demo storage hygiene.
 * Purges lesson artifacts that accumulate across repeated Demo Hub runs:
 * connection profiles, per-env runner configs, and other ephemeral keys.
 */
import {
  cleanupStaleStorageKeys,
  purgeStaleRunnerConfigKeys,
  ensureBrowserLargeDataMigrated,
} from '@shared/utils/storage';
import {
  purgeGqlDemoConnectionProfiles,
  purgeGqlLesson9CollectionArtifacts,
  purgeGqlLesson9DemoHistory,
  purgeGqlDemoGlobalAuthProfiles,
  purgeGqlDemoBatchDetectionFlags,
} from '../adapters';

export interface GqlDemoEphemeralPurgeResult {
  profilesRemoved: number;
  runnerConfigsRemoved: number;
  staleKeysRemoved: number;
  collectionsRemoved: number;
  collectionItemsRemoved: number;
  historyEntriesRemoved: number;
  globalAuthProfilesRemoved: number;
  batchDetectionFlagsRemoved: number;
  freedKB: number;
}

/**
 * Light purge safe to run before any GraphQL lesson starts.
 * Does not remove Environment Manager demo env/svc (lessons may need them).
 */
export async function purgeGqlDemoEphemeralStorage(): Promise<GqlDemoEphemeralPurgeResult> {
  await ensureBrowserLargeDataMigrated();
  const profilesRemoved = await purgeGqlDemoConnectionProfiles();
  const globalAuthProfilesRemoved = await purgeGqlDemoGlobalAuthProfiles();
  const { collectionsRemoved, itemsRemoved } = await purgeGqlLesson9CollectionArtifacts();
  const historyEntriesRemoved = await purgeGqlLesson9DemoHistory();
  const batchDetectionFlagsRemoved = await purgeGqlDemoBatchDetectionFlags();
  const runnerPurge = purgeStaleRunnerConfigKeys();
  const stale = cleanupStaleStorageKeys();
  const freedKB = stale.freedKB + Math.round(runnerPurge.freedBytes / 1024);
  return {
    profilesRemoved,
    runnerConfigsRemoved: runnerPurge.removed,
    staleKeysRemoved: stale.removed,
    collectionsRemoved,
    collectionItemsRemoved: itemsRemoved,
    historyEntriesRemoved,
    globalAuthProfilesRemoved,
    batchDetectionFlagsRemoved,
    freedKB,
  };
}
