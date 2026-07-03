import { getDemoBridgeWindow } from './bridgeWindow';
import { WFR } from '@shared/selectors/wfr';

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

/** Select a workflow in Workflow Runner by name — keeps runner ID in sync after re-seed. */
export function selectRunnerWorkflowByName(name: string): boolean {
  const win = getDemoBridgeWindow();
  if (win.__wfRunnerApplySelection?.(name)) return true;
  return win.__wfRunnerSelectByName?.(name) ?? false;
}

/** Start a workflow run via the runner bridge (falls back to clicking the Run button). */
export function triggerRunnerWorkflowRun(): boolean {
  const win = getDemoBridgeWindow();
  if (win.__wfRunnerTriggerRun?.()) return true;
  const runBtn = document.querySelector<HTMLElement>(WFR.RUN_BTN)
    ?? Array.from(document.querySelectorAll<HTMLElement>('.config-form .form-actions .btn-primary'))
      .find((el) => el.textContent?.includes('Run Workflow'));
  if (!runBtn) return false;
  runBtn.click();
  return true;
}

function getPollingAttempts(timeoutMs: number, intervalMs: number): number {
  const interval = Math.max(1, intervalMs);
  return Math.max(1, Math.ceil(timeoutMs / interval));
}

/** Poll until Workflow Runner demo bridge is mounted (max ~8s). */
export async function waitForRunnerBridge(
  ctx: DemoSeedDelayContext,
  timeoutMs = 8000,
  intervalMs = 100,
): Promise<boolean> {
  const attempts = getPollingAttempts(timeoutMs, intervalMs);
  for (let i = 0; i < attempts; i++) {
    if (getDemoBridgeWindow().__wfRunnerSelectAndRun) return true;
    await ctx.delay(intervalMs);
  }
  return !!getDemoBridgeWindow().__wfRunnerSelectAndRun;
}

/** Apply batch iterations/concurrency and trace level through the runner bridge when available. */
export function applyRunnerBatchConfig(
  iterations: number,
  concurrency: number,
  traceLevel: 'minimal' | 'standard' | 'full' | 'debug' = 'standard',
): boolean {
  return getDemoBridgeWindow().__wfRunnerApplyBatchConfig?.(iterations, concurrency, traceLevel) ?? false;
}

/** Fit the Results Explorer diagram via the canvas bridge (falls back to clicking Fit view). */
export function fitResultsExplorerDiagram(): boolean {
  return getDemoBridgeWindow().__reExplorerFitView?.() ?? false;
}

/** Poll until the Results Explorer fit-view bridge is mounted (max ~8s). */
export async function waitForResultsExplorerBridge(
  ctx: DemoSeedDelayContext,
  timeoutMs = 8000,
  intervalMs = 100,
): Promise<boolean> {
  const attempts = getPollingAttempts(timeoutMs, intervalMs);
  for (let i = 0; i < attempts; i++) {
    if (getDemoBridgeWindow().__reExplorerFitView) return true;
    await ctx.delay(intervalMs);
  }
  return !!getDemoBridgeWindow().__reExplorerFitView;
}

/** Select a named workflow in Workflow Runner and start the run in one bridge call. */
export function selectAndRunRunnerWorkflow(name: string): boolean {
  const win = getDemoBridgeWindow();
  if (win.__wfRunnerSelectAndRun?.(name)) return true;
  if (!selectRunnerWorkflowByName(name)) return false;
  return triggerRunnerWorkflowRun();
}

/** Poll until the demo workflow bridge is mounted on `window` (max ~8s). */
export async function waitForWorkflowBridge(
  ctx: DemoSeedDelayContext,
  timeoutMs = 8000,
  intervalMs = 100,
): Promise<boolean> {
  const attempts = getPollingAttempts(timeoutMs, intervalMs);
  for (let i = 0; i < attempts; i++) {
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
  const attempts = getPollingAttempts(timeoutMs, intervalMs);
  for (let i = 0; i < attempts; i++) {
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
  const attempts = getPollingAttempts(timeoutMs, intervalMs);
  for (let i = 0; i < attempts; i++) {
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

export function patchWorkflowNodeDataById(
  nodeId: string,
  patch: Record<string, unknown>,
): boolean {
  return getDemoBridgeWindow().__wfPatchNodeDataById?.(nodeId, patch) ?? false;
}

export function patchWorkflowByName(
  name: string,
  patch: Record<string, unknown>,
): boolean {
  return getDemoBridgeWindow().__wfPatchWorkflowByName?.(name, patch) ?? false;
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
  selectRunnerWorkflowByName(name);
  return !!getWorkflowByName(name);
}

export function triggerWorkflowQuickTest(): void {
  getDemoBridgeWindow().__wfQuickTest?.();
}

export function closeWorkflowConfigModal(): void {
  getDemoBridgeWindow().__wfCloseConfigModal?.();
}

export function resetWorkflowRunState(): boolean {
  return getDemoBridgeWindow().__wfResetRunState?.() ?? false;
}

/** Alias retained for workflow-integration lessons. */
export const patchDemoWorkflowNodeDataByType = patchWorkflowNodeDataByType;
