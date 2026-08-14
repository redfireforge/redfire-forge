/**
 * Test Harness demo adapters — quiet Feature Group seed/cleanup for lessons.
 */
import { getDemoBridgeWindow } from './bridgeWindow';

/** Seed a demo env + microservice so Feature Groups have valid targets. */
export function seedDemoHarnessTarget(): { envId: string; svcId: string } | null {
  return getDemoBridgeWindow().__demoSeedHarnessTarget?.() ?? null;
}

/** Select the env/svc pair the runner resolves URLs against. */
export function selectDemoEnvSvc(envId: string, svcId: string): void {
  getDemoBridgeWindow().__demoSelectEnvSvc?.(envId, svcId);
}

/** Insert or replace a Feature Group by id/name. */
export function seedDemoFeatureGroup(fg: Record<string, unknown>): boolean {
  const fn = getDemoBridgeWindow().__demoSeedFeatureGroup;
  if (!fn) return false;
  fn(fg);
  return true;
}

/** Remove Feature Groups whose name matches. */
export function deleteDemoFeatureGroupsByName(name: string): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(name);
}
