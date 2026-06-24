import type { GlobalAuthProfile } from '../../../shared/types';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { getDemoBridgeWindow } from './bridgeWindow';

export type GqlDemoEnvVar = { key: string; value: string; masked?: boolean };

export function upsertGlobalAuthProfile(profile: GlobalAuthProfile): void {
  getDemoBridgeWindow().__demoUpsertGlobalAuthProfile?.(profile);
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
