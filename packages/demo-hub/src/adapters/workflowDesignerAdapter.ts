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

export function selectWorkflowByName(name: string): boolean {
  return getDemoBridgeWindow().__wfSelectByName?.(name) ?? false;
}

/** Poll until the demo workflow bridge is mounted on `window` (max ~8s). */
export async function waitForWorkflowBridge(
  ctx: DemoSeedDelayContext,
  timeoutMs = 8000,
  intervalMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getDemoBridgeWindow().__wfInsertWorkflow) return true;
    await ctx.delay(intervalMs);
  }
  return !!getDemoBridgeWindow().__wfInsertWorkflow;
}

async function waitForWorkflowInStore(
  ctx: DemoSeedDelayContext,
  name: string,
  timeoutMs = 3000,
  intervalMs = 50,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getWorkflowByName(name)) return true;
    await ctx.delay(intervalMs);
  }
  return !!getWorkflowByName(name);
}

/** Wait until persisted workflows have finished hydrating from storage. */
export async function waitForWorkflowsLoaded(
  ctx: DemoSeedDelayContext,
  timeoutMs = 10000,
  intervalMs = 50,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getDemoBridgeWindow().__wfWorkflowsLoaded) return true;
    await ctx.delay(intervalMs);
  }
  return !!getDemoBridgeWindow().__wfWorkflowsLoaded;
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

export function removeWorkflowEdge(sourceId: string, targetId: string): boolean {
  const bridge = getDemoBridgeWindow().__wfRemoveEdge;
  if (!bridge) return false;
  bridge(sourceId, targetId);
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
  opts: {
    deleteDelayMs?: number;
    insertPreDelayMs?: number;
    insertDelayMs?: number;
    bridgeTimeoutMs?: number;
    storeTimeoutMs?: number;
  } = {},
): Promise<boolean> {
  const {
    deleteDelayMs = 100,
    insertPreDelayMs = 0,
    insertDelayMs = 300,
    bridgeTimeoutMs = 8000,
    storeTimeoutMs = 3000,
  } = opts;

  if (!(await waitForWorkflowBridge(ctx, bridgeTimeoutMs))) {
    console.warn('[DemoHub] Workflow bridge unavailable — cannot seed', name);
    return false;
  }
  if (!(await waitForWorkflowsLoaded(ctx))) {
    console.warn('[DemoHub] Workflows not loaded from storage — cannot seed', name);
    return false;
  }

  if (deleteWorkflowByName(name) && deleteDelayMs > 0) {
    await ctx.delay(deleteDelayMs);
  }
  if (insertPreDelayMs > 0) {
    await ctx.delay(insertPreDelayMs);
  }
  if (!insertWorkflow(workflow)) {
    console.warn('[DemoHub] Workflow insert failed for', name);
    return false;
  }
  if (insertDelayMs > 0) {
    await ctx.delay(insertDelayMs);
  }
  await waitForWorkflowInStore(ctx, name, storeTimeoutMs);
  selectWorkflowByName(name);
  return !!getWorkflowByName(name);
}

export function triggerWorkflowQuickTest(): void {
  getDemoBridgeWindow().__wfQuickTest?.();
}

export function closeWorkflowConfigModal(): void {
  getDemoBridgeWindow().__wfCloseConfigModal?.();
}

/** Alias retained for workflow-integration lessons. */
export const patchDemoWorkflowNodeDataByType = patchWorkflowNodeDataByType;
