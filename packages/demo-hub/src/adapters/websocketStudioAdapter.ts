/**
 * WebSocket Studio demo adapters — quiet workspace helpers + workflow re-exports.
 */
import { getDemoBridgeWindow } from './bridgeWindow';

export {
  connectWorkflowNodes,
  deleteWorkflowByName,
  deselectAllWorkflowNodes,
  insertWorkflow,
  openWorkflowNodeConfig,
} from './workflowDesignerAdapter';

/** Clear Saved connection profiles without switching to Saved mode (no UI flash). */
export async function clearWsProfilesQuiet(): Promise<void> {
  await getDemoBridgeWindow().__demoClearWsProfiles?.();
}

/** Clear message templates without opening the Templates modal (no UI flash). */
export async function clearWsTemplatesQuiet(): Promise<void> {
  await getDemoBridgeWindow().__demoClearWsTemplates?.();
}

/**
 * Quietly seed the WebSocket connection tab bar with named tabs.
 * Avoids visible + Add / F2 rename tours while Live demo is on screen.
 */
export function seedWsConnectionTabsQuiet(labels: string[]): boolean {
  return getDemoBridgeWindow().__demoSeedWsConnectionTabs?.(labels) ?? false;
}

/**
 * Quiet Secure WebSocket (wss:// TLS) lesson setup.
 * Resets TLS/auth/headers/URL and lands on Client → Connect → Events
 * without flashing the TLS bar or opening the TLS modal.
 */
export function prepareWsTlsLessonQuiet(): boolean {
  return getDemoBridgeWindow().__demoPrepareWsTlsLesson?.() ?? false;
}

export type WsTlsConfigPatch = {
  rejectUnauthorized?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
};

/**
 * Atomically apply WebSocket TLS settings on the active tab (bridge).
 * Prefer this over modal textarea fills when the next beat is Connect —
 * avoids controlled-input races that leave PEMs empty / transport on Direct.
 */
export function applyWsTlsConfig(patch: WsTlsConfigPatch): boolean {
  const bridge = getDemoBridgeWindow().__demoApplyWsTlsConfig;
  if (!bridge) return false;
  bridge(patch);
  return true;
}
