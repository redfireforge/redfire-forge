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
import { purgeGqlDemoConnectionProfiles } from '../adapters';

export interface GqlDemoEphemeralPurgeResult {
  profilesRemoved: number;
  runnerConfigsRemoved: number;
  staleKeysRemoved: number;
  freedKB: number;
}

/**
 * Light purge safe to run before any GraphQL lesson starts.
 * Does not remove Environment Manager demo env/svc (lessons may need them).
 */
export async function purgeGqlDemoEphemeralStorage(): Promise<GqlDemoEphemeralPurgeResult> {
  await ensureBrowserLargeDataMigrated();
  const profilesRemoved = await purgeGqlDemoConnectionProfiles();
  const runnerPurge = purgeStaleRunnerConfigKeys();
  const stale = cleanupStaleStorageKeys();
  const freedKB = stale.freedKB + Math.round(runnerPurge.freedBytes / 1024);
  return {
    profilesRemoved,
    runnerConfigsRemoved: runnerPurge.removed,
    staleKeysRemoved: stale.removed,
    freedKB,
  };
}
