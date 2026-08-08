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

/** Clear the active tab's auth override via React bridge — no Auth panel open/close. */
export function clearActiveTabAuthQuiet(): boolean {
  return getDemoBridgeWindow().__demoClearActiveTabAuth?.() ?? false;
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
 * Ensure a Settings environment exists (by name). Creates one if absent.
 * Returns the env ID, or empty string if the bridge is unavailable.
 */
export function ensureSettingsEnvironment(name: string): string {
  return getDemoBridgeWindow().__demoEnsureSettingsEnv?.(name) ?? '';
}

/** Remove a Settings environment by name (demo cleanup). */
export function removeSettingsEnvironment(name: string): void {
  getDemoBridgeWindow().__demoRemoveSettingsEnv?.(name);
}

/**
 * Ensure a Settings microservice exists (by name). Creates one if absent.
 * Optionally merges `baseUrls` (envId → URL) into the existing record.
 * Returns the svc ID, or empty string if the bridge is unavailable.
 */
export function ensureSettingsMicroservice(name: string, baseUrls?: Record<string, string>): string {
  return getDemoBridgeWindow().__demoEnsureSettingsSvc?.(name, baseUrls) ?? '';
}

/** Remove a Settings microservice by name (demo cleanup). */
export function removeSettingsMicroservice(name: string): void {
  getDemoBridgeWindow().__demoRemoveSettingsSvc?.(name);
}

/**
 * Quietly clear protocol tabs, protocol endpoints, and global vars on a named
 * Settings microservice. Prefer this over DOM × clicks during lesson setup —
 * the remove control is `display:none` until the tab wrap is hovered/active.
 */
export function resetSettingsMicroserviceProtocols(
  name: string,
  options?: { clearProtocols?: boolean; clearGlobalVars?: boolean },
): boolean {
  return getDemoBridgeWindow().__demoResetSettingsSvcProtocols?.(name, options) ?? false;
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
