/**
 * Demo Hub GraphQL lessons save named connection profiles for teaching.
 * Purge them on setup/cleanup so repeated runs do not accumulate duplicates.
 */
import { removeConnectionProfilesByNames } from './connectionProfileStorage';

/** GQL-6 Authentication & Headers */
export const GQL6_DEMO_PROFILE_NAME = 'GQL Auth Demo';

/** GQL-14 Multi-Tab Workspaces */
export const GQL14_STAGING_PROFILE_NAME = 'GQL-14 Staging';
export const GQL14_PRODUCTION_PROFILE_NAME = 'GQL-14 Production';

export const ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES = [
  GQL6_DEMO_PROFILE_NAME,
  GQL14_STAGING_PROFILE_NAME,
  GQL14_PRODUCTION_PROFILE_NAME,
] as const;

/** Remove all demo-lesson connection profiles (or an explicit subset). */
export async function purgeGqlDemoConnectionProfiles(
  names: readonly string[] = ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES,
): Promise<number> {
  return removeConnectionProfilesByNames(names);
}
