/**
 * Demo Hub GraphQL lessons seed named global auth profiles for teaching.
 * Purge them on setup/cleanup so repeated runs do not accumulate duplicates.
 */
import type { GlobalAuthProfile } from '@shared/types';
import { loadGlobalAuthProfiles, saveGlobalAuthProfiles } from '@shared/utils/storage';

/** GQL-6 Authentication & Headers — inherit-from-profile catalog entry */
export const GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID = 'lesson6-gql-profile';
export const GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME = 'Lesson 6 Bearer';

export const ALL_GQL_DEMO_GLOBAL_AUTH_PROFILE_SPECS = [
  { id: GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID, name: GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME },
] as const;

function matchesDemoGlobalAuthProfile(
  profile: GlobalAuthProfile,
  specs: readonly { id: string; name: string }[],
): boolean {
  return specs.some((spec) => profile.id === spec.id || profile.name === spec.name);
}

/** Remove demo-lesson global auth profiles from persisted storage. */
export async function purgeGqlDemoGlobalAuthProfilesFromStorage(
  specs: readonly { id: string; name: string }[] = ALL_GQL_DEMO_GLOBAL_AUTH_PROFILE_SPECS,
): Promise<number> {
  const profiles = await loadGlobalAuthProfiles();
  const next = profiles.filter((p) => !matchesDemoGlobalAuthProfile(p, specs));
  const removed = profiles.length - next.length;
  if (removed > 0) {
    await saveGlobalAuthProfiles(next);
  }
  return removed;
}
