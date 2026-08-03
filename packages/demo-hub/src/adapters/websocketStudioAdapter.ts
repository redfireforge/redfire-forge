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
