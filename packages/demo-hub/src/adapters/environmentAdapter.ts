import type { GlobalAuthProfile } from '@shared/types';
import type { GqlTlsSettings } from '@shared/types/gqlTls';
import {
  ALL_GQL_DEMO_GLOBAL_AUTH_PROFILE_SPECS,
  purgeGqlDemoGlobalAuthProfilesFromStorage,
} from '@graphql/utils/gqlDemoGlobalAuthProfiles';
import { purgeGqlDemoBatchDetectionFlags } from '@graphql/utils/gqlDemoBatchDetectionCleanup';
import { getDemoBridgeWindow } from './bridgeWindow';

export type GqlDemoEnvVar = { key: string; value: string; masked?: boolean };

export function upsertGlobalAuthProfile(profile: GlobalAuthProfile): void {
  getDemoBridgeWindow().__demoUpsertGlobalAuthProfile?.(profile);
}

/** Sync in-memory app state after storage purge (safe no-op when bridge is absent). */
export function purgeGlobalAuthProfilesFromBridge(
  specs: readonly { id: string; name: string }[] = ALL_GQL_DEMO_GLOBAL_AUTH_PROFILE_SPECS,
): void {
  getDemoBridgeWindow().__demoPurgeGlobalAuthProfiles?.(
    specs.map((spec) => spec.name),
    specs.map((spec) => spec.id),
  );
}

/** Remove demo-lesson global auth profiles from storage and live React state. */
export async function purgeGqlDemoGlobalAuthProfiles(): Promise<number> {
  const removed = await purgeGqlDemoGlobalAuthProfilesFromStorage();
  purgeGlobalAuthProfilesFromBridge();
  return removed;
}

export function upsertGqlEnvironment(name: string, envVars: GqlDemoEnvVar[]): boolean {
  const bridge = getDemoBridgeWindow().__demoUpsertGqlEnv;
  if (!bridge) return false;
  bridge(
    name,
    envVars.map((v) => ({ ...v, masked: v.masked !== false })),
  );
  return true;
}

export function applyGqlTlsSettings(patch: Partial<GqlTlsSettings>): boolean {
  const bridge = getDemoBridgeWindow().__demoApplyGqlTlsSettings;
  if (!bridge) return false;
  bridge(patch);
  return true;
}

export function deleteGqlEnvironmentByName(name: string): void {
  getDemoBridgeWindow().__demoDeleteGqlEnvByName?.(name);
}

export function upsertWorkspaceDefaults(patch: Record<string, string>): boolean {
  const bridge = getDemoBridgeWindow().__demoUpsertWorkspaceDefaults;
  if (!bridge) return false;
  bridge(patch);
  return true;
}

export function removeWorkspaceDefaults(keys: string[]): boolean {
  const bridge = getDemoBridgeWindow().__demoRemoveWorkspaceDefaults;
  if (!bridge) return false;
  bridge(keys);
  return true;
}

/**
 * Clear cached "batch unsupported" for the demo server — live Studio state when mounted,
 * plus persisted per-connection detection keys in storage.
 */
export async function resetGqlDemoBatchDetection(): Promise<boolean> {
  const live = getDemoBridgeWindow().__demoResetGqlBatchDetection?.() ?? false;
  await purgeGqlDemoBatchDetectionFlags();
  return live;
}
