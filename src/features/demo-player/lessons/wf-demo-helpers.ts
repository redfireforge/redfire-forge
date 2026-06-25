/** Shared Workflow Designer demo helpers (console panel, config modal, app sidebar, etc.). */
import type { DemoActionContext } from '../types';
import {
  collapseAppSidebar,
  deselectAllWorkflowNodes,
  expandAppSidebar,
  getWorkflowByName,
  openWorkflowNodeConfig,
  selectWorkflowByName,
  setWorkflowConsoleFloatLayout,
} from '../adapters';
import { WF } from '../../../shared/selectors';
import { type PanelMode, savePanelMode } from '../../../shared/utils/panelMode';

/** localStorage key — must match WorkflowConsolePanel CONSOLE_MODE_KEY. */
export const WF_CONSOLE_MODE_STORAGE_KEY = 'wf-console-default-mode';

/**
 * Pacing for workflow node config modals — slower than canvas/palette actions so
 * viewers can read tabs, labels, and filled values before the demo advances.
 *
 * Use `sectionBreak` between logical groups (e.g. Operation tab done → Output tab).
 * Use `afterSubFormOpen` after + Add reveals a new row or sub-editor.
 */
export const WF_CONFIG_DEMO_TIMING = {
  modalOpen: 2000,
  panelReady: 1200,
  tabSwitch: 1500,
  afterClick: 1000,
  afterFill: 1100,
  afterSelect: 1100,
  beforeSave: 1400,
  afterSave: 1400,
  modalClose: 1000,
  /** Pause between tabs/sections so multi-part config is digestible. */
  sectionBreak: 1600,
  /** After + Add opens a binding/assertion/extraction row. */
  afterSubFormOpen: 1300,
} as const;

export type WfConfigDemoTimingKey = keyof typeof WF_CONFIG_DEMO_TIMING;

export async function pauseWfConfigDemo(
  ctx: DemoActionContext,
  key: WfConfigDemoTimingKey,
): Promise<void> {
  await ctx.delay(WF_CONFIG_DEMO_TIMING[key]);
}

/** Extra pause between logical sections inside one config modal (tab groups, field clusters). */
export async function pauseWfConfigSection(ctx: DemoActionContext): Promise<void> {
  await pauseWfConfigDemo(ctx, 'sectionBreak');
}

function wfNodeIdFromCanvasTestId(testIdSelector: string): string | null {
  const inner = document.querySelector(testIdSelector);
  const rfNode = inner?.closest('.react-flow__node');
  return rfNode?.getAttribute('data-id') ?? null;
}

/** Open a node config modal and pause so the viewer can orient to the panel. */
export async function openWfNodeConfigModal(
  ctx: DemoActionContext,
  target: { canvasTestId?: string; nodeSelector?: string; nodeId?: string },
): Promise<void> {
  let nodeId = target.nodeId ?? null;
  if (!nodeId && target.canvasTestId) {
    nodeId = wfNodeIdFromCanvasTestId(target.canvasTestId);
  }
  if (!nodeId && target.nodeSelector) {
    const el = document.querySelector(target.nodeSelector);
    nodeId = el?.getAttribute('data-id') ?? el?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
  }

  if (nodeId && openWorkflowNodeConfig(nodeId)) {
    // opened via demo bridge
  } else {
    deselectAllWorkflowNodes();
    const node =
      (target.canvasTestId
        ? document.querySelector<HTMLElement>(target.canvasTestId)
        : target.nodeSelector
          ? document.querySelector<HTMLElement>(target.nodeSelector)
          : null) ??
      (nodeId ? document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`) : null);
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }

  await pauseWfConfigDemo(ctx, 'modalOpen');
}

/** Wait for a config panel root, then pause so fields render before interaction. */
export async function waitForWfConfigPanel(
  ctx: DemoActionContext,
  panelSelector: string,
  timeout = 8000,
): Promise<void> {
  await ctx.waitFor(panelSelector, timeout);
  await pauseWfConfigDemo(ctx, 'panelReady');
}

export async function fillWfConfigField(
  ctx: DemoActionContext,
  selector: string,
  value: string,
): Promise<void> {
  await ctx.waitFor(selector, 8000);
  await ctx.fill(selector, value);
  await pauseWfConfigDemo(ctx, 'afterFill');
}

export async function selectWfConfigOption(
  ctx: DemoActionContext,
  selector: string,
  value: string,
): Promise<void> {
  await ctx.waitFor(selector, 8000);
  await ctx.selectOption(selector, value);
  await pauseWfConfigDemo(ctx, 'afterSelect');
}

/** Click + Add, wait for the new row/editor, then pause so the viewer sees it. */
export async function clickWfConfigAddRow(
  ctx: DemoActionContext,
  addBtnSelector: string,
  rowSelector: string,
  timeout = 8000,
): Promise<void> {
  await ctx.click(addBtnSelector);
  await ctx.waitFor(rowSelector, timeout);
  await pauseWfConfigDemo(ctx, 'afterSubFormOpen');
}

export async function clickWfConfigControl(
  ctx: DemoActionContext,
  selector: string,
): Promise<void> {
  await ctx.click(selector);
  await pauseWfConfigDemo(ctx, 'afterClick');
}

/** Dismiss stale Quick Test summary banner from a prior workflow run. */
export async function dismissWorkflowExecSummary(ctx: DemoActionContext): Promise<void> {
  const closeBtn = document.querySelector<HTMLElement>('.wf-exec-strip-close');
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(300);
  }
}

/** Hide the app-level Workflows list sidebar so the canvas has maximum space. */
export async function collapseWfDemoAppSidebar(ctx: DemoActionContext): Promise<void> {
  collapseAppSidebar();
  await ctx.delay(400);
}

/** Show the Workflows sidebar (+ New, pick workflow) — only for create/select beats. */
export async function expandWfDemoAppSidebar(ctx: DemoActionContext): Promise<void> {
  expandAppSidebar();
  await ctx.delay(400);
}

/** Select a saved workflow in the app sidebar, then collapse for canvas space. */
export async function selectWorkflowFromAppSidebar(
  ctx: DemoActionContext,
  workflowName: string,
): Promise<boolean> {
  await expandWfDemoAppSidebar(ctx);
  const findExactSidebarItem = () =>
    Array.from(document.querySelectorAll<HTMLElement>('.wf-sidebar-item-name')).find(
      (el) => el.textContent?.trim() === workflowName,
    );

  let nameEl = findExactSidebarItem();
  for (let attempt = 0; !nameEl && attempt < 8; attempt++) {
    await ctx.delay(150);
    nameEl = findExactSidebarItem();
  }

  const target = nameEl?.closest<HTMLElement>('.wf-sidebar-item, [data-testid="wf-sidebar-item"], .wf-workflow-item');
  if (target) {
    target.click();
    await ctx.delay(700);
  } else {
    selectWorkflowByName(workflowName);
    await ctx.delay(400);
  }
  await collapseWfDemoAppSidebar(ctx);
  return !!target || !!getWorkflowByName(workflowName);
}

/** Force console panel mode (docked bottom / floating / maximized). */
export function setWfConsolePanelMode(mode: PanelMode): void {
  savePanelMode(WF_CONSOLE_MODE_STORAGE_KEY, mode);
  const select = document.querySelector<HTMLSelectElement>('.wf-console-mode-select');
  if (select && select.value !== mode) {
    select.value = mode;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/** Close the Workflow Designer console panel when open (toggle badge). */
export async function closeWfConsoleIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.CONSOLE)) return;
  const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
  if (badge) {
    badge.click();
    await ctx.delay(700);
  }
}

/** Apply demo floating layout (left of canvas) when the console panel bridge is mounted. */
export function applyWfDemoConsoleFloatLayout(): void {
  setWorkflowConsoleFloatLayout();
}

/**
 * Open the Workflow Console in floating mode on the left of the canvas.
 * Demos use floating so the workflow nodes stay visible beside the log panel.
 */
export async function openWfConsoleIfClosed(ctx: DemoActionContext): Promise<void> {
  setWfConsolePanelMode('floating');
  if (!document.querySelector(WF.CONSOLE)) {
    const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
    if (badge) {
      badge.click();
      await ctx.delay(600);
    }
  }
  if (document.querySelector(WF.CONSOLE)) {
    setWfConsolePanelMode('floating');
    applyWfDemoConsoleFloatLayout();
  }
  await ctx.delay(400);
}

/** Start a step-through Debug run (toolbar Debug button). */
export async function startWfDebugRun(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await ctx.click(WF.DEBUG_BTN);
  await ctx.delay(1200);
}

/**
 * Click each per-node **Step** button as Debug mode pauses the workflow.
 * Returns how many Step clicks were performed.
 */
export async function clickWfDebugStepButtons(ctx: DemoActionContext, maxSteps = 12): Promise<number> {
  let clicked = 0;
  for (let i = 0; i < maxSteps; i++) {
    try {
      await ctx.waitFor(WF.DEBUG_STEP_BTN, 20000);
    } catch {
      break;
    }
    if (!document.querySelector(WF.DEBUG_STEP_BTN)) break;
    await ctx.delay(900);
    await ctx.click(WF.DEBUG_STEP_BTN);
    clicked++;
    await ctx.delay(1200);
  }
  return clicked;
}

/** True when a config sub-tab with the given label is already active. */
export function isWfConfigTabActive(panelSelector: string, tabLabel: string): boolean {
  const panel = document.querySelector(panelSelector);
  if (!panel) return false;
  const tab = Array.from(
    panel.querySelectorAll<HTMLElement>('.wf-config-tab, .gql-wf-subtab'),
  ).find((b) => b.textContent?.trim().startsWith(tabLabel));
  return tab?.classList.contains('active') ?? false;
}

/**
 * Open a node config modal only when it is not already showing the expected panel.
 * Avoids close/reopen flicker when preAction opened the modal for reading and action continues on the same step.
 */
export async function ensureWfNodeConfigModalOpen(
  ctx: DemoActionContext,
  target: { canvasTestId?: string; nodeSelector?: string; nodeId?: string; panelSelector: string },
): Promise<void> {
  const modalOpen = !!document.querySelector(WF.NODE_CONFIG);
  const panelReady = !!document.querySelector(target.panelSelector);
  if (modalOpen && panelReady) {
    await pauseWfConfigDemo(ctx, 'panelReady');
    return;
  }
  if (modalOpen) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await openWfNodeConfigModal(ctx, target);
  await waitForWfConfigPanel(ctx, target.panelSelector);
}

/** Switch a config panel tab — supports legacy `.wf-config-tab` and GraphQL `.gql-wf-subtab`. */
export async function clickWfConfigTab(
  ctx: DemoActionContext,
  panelSelector: string,
  tabLabel: string,
): Promise<void> {
  const panel = document.querySelector(panelSelector);
  if (!panel) return;
  const tab = Array.from(
    panel.querySelectorAll<HTMLElement>('.wf-config-tab, .gql-wf-subtab'),
  ).find((b) => b.textContent?.trim().startsWith(tabLabel));
  if (!tab) return;
  if (tab.classList.contains('active')) {
    await pauseWfConfigDemo(ctx, 'tabSwitch');
    return;
  }
  tab.click();
  await pauseWfConfigDemo(ctx, 'tabSwitch');
}

/** Save when valid; returns whether save was attempted. Does not close when Save is disabled. */
export async function saveWfConfigModal(ctx: DemoActionContext): Promise<boolean> {
  const saveBtn = document.querySelector<HTMLButtonElement>(WF.CFG_SAVE);
  if (saveBtn?.disabled) return false;
  await pauseWfConfigDemo(ctx, 'beforeSave');
  await ctx.click(WF.CFG_SAVE);
  await pauseWfConfigDemo(ctx, 'afterSave');
  return true;
}

/** Close the node config modal when still open (quiet — no ripple). */
export async function closeWfConfigModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.NODE_CONFIG)) return;
  const close = document.querySelector<HTMLElement>(WF.CFG_CLOSE);
  if (close) {
    close.click();
    await pauseWfConfigDemo(ctx, 'modalClose');
  }
}

/** Save when enabled, then ensure the config modal is dismissed. Skips close when Save stayed disabled. */
export async function saveAndCloseWfConfigModal(ctx: DemoActionContext): Promise<boolean> {
  const saved = await saveWfConfigModal(ctx);
  if (!saved) return false;
  if (document.querySelector(WF.NODE_CONFIG)) {
    await closeWfConfigModalIfOpen(ctx);
  }
  return true;
}
