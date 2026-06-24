import { getDemoBridgeWindow } from './bridgeWindow';

export function deleteWorkflowByName(name: string): boolean {
  const bridge = getDemoBridgeWindow().__wfDeleteByName;
  if (!bridge) return false;
  bridge(name);
  return true;
}

export function insertWorkflow(workflow: Record<string, unknown>): boolean {
  const bridge = getDemoBridgeWindow().__wfInsertWorkflow;
  if (!bridge) return false;
  bridge(workflow);
  return true;
}

export function getWorkflowByName<T = unknown>(name: string): T | null {
  const wf = getDemoBridgeWindow().__wfGetWorkflowByName?.(name);
  return (wf ?? null) as T | null;
}

export function openWorkflowNodeConfig(nodeId: string): boolean {
  const bridge = getDemoBridgeWindow().__wfOpenNodeConfig;
  if (!bridge) return false;
  bridge(nodeId);
  return true;
}

export function deselectAllWorkflowNodes(): void {
  getDemoBridgeWindow().__wfDeselectAll?.();
}

export function setWorkflowConsoleFloatLayout(): void {
  getDemoBridgeWindow().__wfSetConsoleFloatLayout?.();
}

export function connectWorkflowNodes(
  sourceId: string,
  targetId: string,
  sourceHandle: string | null = null,
  targetHandle: string | null = null,
): boolean {
  const bridge = getDemoBridgeWindow().__wfConnect;
  if (!bridge) return false;
  bridge(sourceId, targetId, sourceHandle, targetHandle);
  return true;
}

export function patchWorkflowNodeDataByType(
  nodeType: string,
  patch: Record<string, unknown>,
): boolean {
  return getDemoBridgeWindow().__wfPatchNodeDataByType?.(nodeType, patch) ?? false;
}

export function addWorkflowNode(type: string): string | undefined {
  return getDemoBridgeWindow().__wfAddNode?.(type);
}

export function addWorkflowNodeWithPreset(
  type: string,
  id: string,
  label: string,
  position: { x: number; y: number },
): boolean {
  const bridge = getDemoBridgeWindow().__wfAddNode as
    | ((t: string, i?: string, l?: string, p?: { x: number; y: number }) => string | void | undefined)
    | undefined;
  if (!bridge) return false;
  bridge(type, id, label, position);
  return true;
}

export type DemoSeedDelayContext = {
  delay: (ms: number) => Promise<void>;
};

/** Delete a named workflow (if present) then insert a fresh copy — common lesson setup pattern. */
export async function seedNamedWorkflow(
  ctx: DemoSeedDelayContext,
  name: string,
  workflow: Record<string, unknown>,
  opts: { deleteDelayMs?: number; insertPreDelayMs?: number; insertDelayMs?: number } = {},
): Promise<void> {
  const { deleteDelayMs = 100, insertPreDelayMs = 0, insertDelayMs = 300 } = opts;
  const canInsert = !!getDemoBridgeWindow().__wfInsertWorkflow;

  if (deleteWorkflowByName(name) && deleteDelayMs > 0) {
    await ctx.delay(deleteDelayMs);
  }
  if (canInsert && insertPreDelayMs > 0) {
    await ctx.delay(insertPreDelayMs);
  }
  if (insertWorkflow(workflow) && insertDelayMs > 0) {
    await ctx.delay(insertDelayMs);
  }
}

export function triggerWorkflowQuickTest(): void {
  getDemoBridgeWindow().__wfQuickTest?.();
}

export function closeWorkflowConfigModal(): void {
  getDemoBridgeWindow().__wfCloseConfigModal?.();
}

/** Alias retained for workflow-integration lessons. */
export const patchDemoWorkflowNodeDataByType = patchWorkflowNodeDataByType;
