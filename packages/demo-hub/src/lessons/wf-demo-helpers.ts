/** Shared Workflow Designer demo helpers (console panel, config modal, app sidebar, etc.). */
import type { DemoActionContext } from '../types';
import { purgeAllSpotlightRings, showSpotlightRing } from '../demoRipple';
import {
  collapseAppSidebar,
  deselectAllWorkflowNodes,
  expandAppSidebar,
  getSelectedWorkflowName,
  getWorkflowByName,
  openWorkflowNodeConfig,
  resetWorkflowRunState,
  seedNamedWorkflow,
  selectWorkflowByName,
  setWorkflowConsoleFloatLayout,
} from '../adapters';
import { firstVisibleElement } from '../utils/domVisibility';
import { WF } from '@shared/selectors';
import { type PanelMode, savePanelMode } from '@shared/utils/panelMode';
import { fillControlledInput } from './setup-helpers';

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

/**
 * Faster config pacing for dense multi-field tours (gRPC workflow lessons).
 * Still readable at 1× — cuts stacked modalOpen + afterFill + sectionBreak dead air.
 */
export const WF_CONFIG_DEMO_TIMING_BRISK = {
  modalOpen: 900,
  panelReady: 500,
  tabSwitch: 800,
  afterClick: 450,
  afterFill: 400,
  afterSelect: 400,
  beforeSave: 550,
  afterSave: 550,
  modalClose: 450,
  sectionBreak: 500,
  afterSubFormOpen: 700,
} as const satisfies Record<keyof typeof WF_CONFIG_DEMO_TIMING, number>;

/**
 * Guided pacing — brisk modal chrome, longer field holds so steady spotlights
 * read as highlights (not flashes). Prefer for GraphQL Workflow Integration.
 */
export const WF_CONFIG_DEMO_TIMING_GUIDED = {
  modalOpen: 1100,
  panelReady: 700,
  tabSwitch: 900,
  afterClick: 550,
  afterFill: 850,
  afterSelect: 850,
  beforeSave: 900,
  afterSave: 800,
  modalClose: 550,
  sectionBreak: 800,
  afterSubFormOpen: 850,
} as const satisfies Record<keyof typeof WF_CONFIG_DEMO_TIMING, number>;

export type WfConfigDemoTimingKey = keyof typeof WF_CONFIG_DEMO_TIMING;
export type WfConfigDemoTimingTable = Record<WfConfigDemoTimingKey, number>;

/**
 * Outcome of {@link ensureLessonWorkflowShown}:
 *  - `ready`    — this lesson's workflow is already on the canvas; caller may just fit.
 *  - `selected` — the workflow existed in the store and was switched to (foreign one was showing).
 *  - `missing`  — the workflow doesn't exist yet; caller must seed / create it.
 */
export type LessonWorkflowState = 'ready' | 'selected' | 'missing';

/**
 * Guarantee the DISPLAYED workflow is this lesson's — switching away from any
 * stale workflow left over from a previous lesson.
 *
 * Every workflow lesson previously guarded canvas steps with just
 * `if (document.querySelector(WF.CANVAS)) return;`, which is satisfied by *any*
 * workflow. Moving between two different workflow lessons therefore left the
 * prior lesson's graph on screen and the new lesson piled its nodes onto it.
 *
 * This helper compares the live selected-workflow name (via the demo bridge) to
 * the lesson's expected name and, when they differ, re-selects the correct one
 * (or reports `missing` so the caller can seed/create it). It never re-selects
 * when the lesson's own workflow is already shown, so in-progress live edits are
 * preserved across steps within a lesson.
 */
/** True when Designer shows this lesson's workflow (bridge name and/or toolbar label). */
export function isLessonWorkflowDisplayed(wfName: string): boolean {
  if (getSelectedWorkflowName() === wfName) return true;
  const toolbar = firstVisibleElement(WF.TOOLBAR_SELECT)
    ?? document.querySelector<HTMLElement>(WF.TOOLBAR_SELECT);
  const label = toolbar?.querySelector('.wft-dropdown-text')?.textContent?.trim()
    ?? toolbar?.textContent?.replace(/[▲▼]/g, '').trim();
  return label === wfName;
}

/** Poll until the lesson workflow is the one on the canvas. */
export async function waitForLessonWorkflowSelected(
  ctx: DemoActionContext,
  wfName: string,
  timeoutMs = 8000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isLessonWorkflowDisplayed(wfName)) return true;
    if (getWorkflowByName(wfName) && getSelectedWorkflowName() !== wfName) {
      selectWorkflowByName(wfName);
    }
    await ctx.delay(100);
  }
  return isLessonWorkflowDisplayed(wfName);
}

/** Minimal Start-only workflow matching `useWorkflows().create`. */
export function buildBlankLessonWorkflow(name: string): Record<string, unknown> {
  const startId = `start-${Date.now()}`;
  const now = Date.now();
  return {
    id: `wf-demo-${now}`,
    name,
    schemaVersion: 6,
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start', inputVariables: {} },
      },
    ],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureLessonWorkflowShown(
  ctx: DemoActionContext,
  wfName: string,
): Promise<LessonWorkflowState> {
  const canvasShown = !!document.querySelector(WF.CANVAS);

  // Our workflow is already up → leave the live canvas untouched.
  if (canvasShown && isLessonWorkflowDisplayed(wfName)) return 'ready';

  // A different workflow is displayed (or nothing is). Switch to ours if it exists.
  if (getWorkflowByName(wfName)) {
    selectWorkflowByName(wfName);
    await waitForLessonWorkflowSelected(ctx, wfName, 1500);
    return isLessonWorkflowDisplayed(wfName) ? 'selected' : 'missing';
  }
  return 'missing';
}

/**
 * Wait until a selector is ready for demo interaction.
 * Prefers a non-zero bounding box; if the node is mounted but layout is still
 * 0×0 (common in jsdom), accept mount after a short settle so expands aren't stuck.
 */
export async function waitForVisibleSelector(
  ctx: DemoActionContext,
  selector: string,
  timeout = 5000,
): Promise<boolean> {
  const start = Date.now();
  let mountedAt: number | null = null;
  while (Date.now() - start < timeout) {
    if (firstVisibleElement(selector)) return true;
    if (document.querySelector(selector)) {
      if (mountedAt == null) mountedAt = Date.now();
      // Real browsers usually get a non-zero box quickly after mount; jsdom never does.
      if (Date.now() - mountedAt >= 300) return true;
    }
    await ctx.delay(100);
  }
  return !!document.querySelector(selector) || !!firstVisibleElement(selector);
}

/**
 * Create a blank workflow via the sidebar **+ New → Blank Workflow** dialog.
 * Waits for the + New control to be *visible* after expanding the sidebar
 * (collapsed sidebars unmount the control; `ctx.click` is a silent no-op).
 *
 * Returns true only when this lesson's workflow is the one displayed — never
 * treats an already-open foreign canvas (e.g. SLA pipeline) as success.
 */
export async function createBlankWorkflowFromSidebar(
  ctx: DemoActionContext,
  wfName: string,
): Promise<boolean> {
  await expandWfDemoAppSidebar(ctx);
  if (!(await waitForVisibleSelector(ctx, WF.SIDEBAR_NEW_BTN, 2500))) {
    console.warn('[DemoHub] + New not visible — cannot create', wfName);
    return false;
  }
  await ctx.delay(150);
  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.waitFor('.wf-new-dropdown', 2500);
  if (!document.querySelector('.wf-new-dropdown')) {
    console.warn('[DemoHub] New-workflow dropdown did not open');
    return false;
  }
  await ctx.delay(200);
  await ctx.click(WF.NEW_BLANK_ITEM);
  if (!(await waitForVisibleSelector(ctx, WF.CREATE_INPUT, 2500))) {
    // Dropdown click can miss; retry once.
    await ctx.click(WF.SIDEBAR_NEW_BTN);
    await ctx.waitFor('.wf-new-dropdown', 1500);
    await ctx.click(WF.NEW_BLANK_ITEM);
    if (!(await waitForVisibleSelector(ctx, WF.CREATE_INPUT, 2000))) {
      console.warn('[DemoHub] Create-workflow dialog did not open');
      return false;
    }
  }
  await ctx.delay(200);
  await ctx.fill(WF.CREATE_INPUT, wfName);
  // Create reads the uncontrolled input via ref — belt-and-suspenders fill.
  const input = (firstVisibleElement<HTMLInputElement>(WF.CREATE_INPUT)
    ?? document.querySelector<HTMLInputElement>(WF.CREATE_INPUT));
  if (input && input.value.trim() !== wfName) {
    fillControlledInput(input, wfName);
  }
  if (!input || input.value.trim() !== wfName) {
    console.warn('[DemoHub] Create input was not filled with', wfName);
    return false;
  }
  await ctx.delay(150);
  await ctx.click(WF.CREATE_OK);
  // Do NOT treat any existing canvas as success — require this workflow by name.
  const created = await waitForLessonWorkflowSelected(ctx, wfName, 4000);
  await ctx.delay(250);
  await collapseWfDemoAppSidebar(ctx);
  if (!created) {
    console.warn('[DemoHub] Sidebar create did not select', wfName);
  }
  return created;
}

/**
 * Guarantee this lesson's blank workflow is on the canvas — select it if it
 * already exists, otherwise seed via the bridge (quiet / Preparing path).
 *
 * Does **not** walk the sidebar + New UI — that belongs in the visible create
 * step action. Sidebar create timeouts made Preparing hang for many seconds.
 *
 * Replaces the unsafe `if (document.querySelector(WF.CANVAS)) return` pattern,
 * which treated *any* open workflow as success.
 */
export async function ensureLessonBlankWorkflow(
  ctx: DemoActionContext,
  wfName: string,
  options?: { dismissOnboarding?: (ctx: DemoActionContext) => Promise<void> },
): Promise<void> {
  if ((await ensureLessonWorkflowShown(ctx, wfName)) !== 'missing') return;
  ctx.navigateToTab('workflow');
  await ctx.delay(100);
  if (options?.dismissOnboarding) await options.dismissOnboarding(ctx);

  const seeded = await seedNamedWorkflow(ctx, wfName, buildBlankLessonWorkflow(wfName), {
    deleteDelayMs: 50,
    insertDelayMs: 120,
    bridgeTimeoutMs: 2000,
    storeTimeoutMs: 1500,
    selectAfterSeed: true,
  });
  if (seeded) {
    await waitForLessonWorkflowSelected(ctx, wfName, 1500);
  }
  await collapseWfDemoAppSidebar(ctx);
}

let activeWfConfigTiming: WfConfigDemoTimingTable = WF_CONFIG_DEMO_TIMING;

/** Scope config-modal pacing for a lesson (call from setup; reset in cleanup). */
export function setWfConfigDemoTiming(timing: WfConfigDemoTimingTable | null): void {
  activeWfConfigTiming = timing ?? WF_CONFIG_DEMO_TIMING;
}

export function getWfConfigDemoTiming(): WfConfigDemoTimingTable {
  return activeWfConfigTiming;
}

export async function pauseWfConfigDemo(
  ctx: DemoActionContext,
  key: WfConfigDemoTimingKey,
): Promise<void> {
  await ctx.delay(activeWfConfigTiming[key]);
}

/** Extra pause between logical sections inside one config modal (tab groups, field clusters). */
export async function pauseWfConfigSection(ctx: DemoActionContext): Promise<void> {
  await pauseWfConfigDemo(ctx, 'sectionBreak');
}

function wfConfigScrollSettleMs(): number {
  return activeWfConfigTiming.panelReady <= WF_CONFIG_DEMO_TIMING_BRISK.panelReady ? 250 : 450;
}

/** Place a steady field ring (replaces any prior imperative ring — no pulse flash). */
function steadyWfConfigFieldRing(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  purgeAllSpotlightRings();
  showSpotlightRing(el, { steady: true });
}

function wfConfigFieldLookMs(): number {
  return Math.max(450, Math.round(activeWfConfigTiming.afterFill * 0.55));
}

function wfNodeIdFromCanvasTestId(testIdSelector: string): string | null {
  const inner = document.querySelector(testIdSelector);
  const rfNode = inner?.closest('.react-flow__node');
  return rfNode?.getAttribute('data-id') ?? null;
}

function resolveWfCanvasNodeElement(
  target: { canvasTestId?: string; nodeSelector?: string; nodeId?: string },
  nodeId: string | null,
): HTMLElement | null {
  if (target.canvasTestId) {
    const inner = document.querySelector<HTMLElement>(target.canvasTestId);
    if (inner) return (inner.closest('.react-flow__node') as HTMLElement | null) ?? inner;
  }
  if (target.nodeSelector) {
    const el = document.querySelector<HTMLElement>(target.nodeSelector);
    if (el) return (el.closest('.react-flow__node') as HTMLElement | null) ?? el;
  }
  if (nodeId) {
    return document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
  }
  return null;
}

/**
 * Spotlight the canvas node before opening its config so viewers know which
 * block is being configured (especially important on dense canvases).
 */
async function spotlightWfCanvasNodeBeforeConfig(
  ctx: DemoActionContext,
  node: HTMLElement | null,
): Promise<void> {
  if (!node) return;
  node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  purgeAllSpotlightRings();
  const removeRing = showSpotlightRing(node, { steady: true });
  // Long enough to read the node label before the modal covers the canvas.
  const holdMs = Math.max(1_100, Math.round(activeWfConfigTiming.modalOpen * 0.55));
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
  }
}

/** Open a node config modal and pause so the viewer can orient to the panel. */
export async function openWfNodeConfigModal(
  ctx: DemoActionContext,
  target: {
    canvasTestId?: string;
    nodeSelector?: string;
    nodeId?: string;
    /** Skip the pre-open canvas ring when Reading already highlighted the node. */
    skipCanvasSpotlight?: boolean;
  },
): Promise<void> {
  let nodeId = target.nodeId ?? null;
  if (!nodeId && target.canvasTestId) {
    nodeId = wfNodeIdFromCanvasTestId(target.canvasTestId);
  }
  if (!nodeId && target.nodeSelector) {
    const el = document.querySelector(target.nodeSelector);
    nodeId = el?.getAttribute('data-id') ?? el?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
  }

  const canvasNode = resolveWfCanvasNodeElement(target, nodeId);
  if (!target.skipCanvasSpotlight) {
    await spotlightWfCanvasNodeBeforeConfig(ctx, canvasNode);
  }

  if (nodeId && openWorkflowNodeConfig(nodeId)) {
    // opened via demo bridge
  } else {
    deselectAllWorkflowNodes();
    const node = canvasNode
      ?? (target.canvasTestId
        ? document.querySelector<HTMLElement>(target.canvasTestId)
        : target.nodeSelector
          ? document.querySelector<HTMLElement>(target.nodeSelector)
          : null)
      ?? (nodeId ? document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`) : null);
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }

  // Wait for the panel to mount first — a blind modalOpen delay felt like
  // "Acting" with no UI change when the bridge/open was still in flight.
  try {
    await ctx.waitFor(WF.NODE_CONFIG, 5_000);
  } catch {
    // Keep going; waitForWfConfigPanel / field waits catch real failures.
  }
  await pauseWfConfigDemo(ctx, 'modalOpen');
}

/** Scroll viewport inside an open workflow config modal (`.wf-config-modal-scroll`). */
function findWfConfigScrollViewport(from?: HTMLElement | null): HTMLElement | null {
  if (from) {
    const nested = from.closest<HTMLElement>('.wf-config-modal-scroll')
      ?? from.closest<HTMLElement>('.wf-modal-scroll-viewport');
    if (nested) return nested;
  }
  return document.querySelector<HTMLElement>('.wf-config-modal-scroll')
    ?? document.querySelector<HTMLElement>('.wf-modal-scroll-viewport');
}

/**
 * Reset the config modal body to the top so Schema / connection fields are visible
 * when the panel first opens (prevents starting mid-scroll with the header clipped).
 */
export async function scrollWfConfigModalToTop(ctx: DemoActionContext): Promise<void> {
  const scrollParent = findWfConfigScrollViewport();
  if (!scrollParent) return;
  scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
  await ctx.delay(wfConfigScrollSettleMs());
}

/**
 * Scroll a field/section into the config modal viewport before interacting so
 * viewers can follow each configuration beat (top fields + lower body/metadata).
 *
 * Scrolls the field row (label + control) when present, and pins it just below
 * the modal chrome with a top pad — center-aligning tall textareas was clipping
 * labels and the top of the spotlight ring under the header.
 */
export async function scrollWfConfigFieldIntoView(
  ctx: DemoActionContext,
  selectorOrEl: string | HTMLElement,
): Promise<void> {
  const el = typeof selectorOrEl === 'string'
    ? document.querySelector<HTMLElement>(selectorOrEl)
    : selectorOrEl;
  if (!el) return;

  // Prefer the labeled row so "Request Body" / "Save As" headings stay visible.
  const scrollTarget = el.closest<HTMLElement>('.wf-config-field, .wf-config-field--row') ?? el;
  const scrollParent = findWfConfigScrollViewport(scrollTarget);
  if (scrollParent && scrollParent.contains(scrollTarget)) {
    const elRect = scrollTarget.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const topPad = 72;
    const offsetTop = elRect.top - parentRect.top + scrollParent.scrollTop;
    // Start-align with pad — keeps the field top + spotlight ring fully in view.
    const targetScroll = offsetTop - topPad;
    const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
    scrollParent.scrollTo({
      top: Math.max(0, Math.min(targetScroll, maxScroll)),
      behavior: 'smooth',
    });
    await ctx.delay(wfConfigScrollSettleMs());
    return;
  }

  scrollTarget.scrollIntoView?.({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  await ctx.delay(wfConfigScrollSettleMs());
}

/** Wait for a config panel root, then pause so fields render before interaction. */
export async function waitForWfConfigPanel(
  ctx: DemoActionContext,
  panelSelector: string,
  timeout = 8000,
): Promise<void> {
  await ctx.waitFor(panelSelector, timeout);
  await pauseWfConfigDemo(ctx, 'panelReady');
  // Always start at the top — prior steps / layout can leave the body mid-scroll.
  await scrollWfConfigModalToTop(ctx);
}

export async function fillWfConfigField(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  opts?: { spotlight?: boolean },
): Promise<void> {
  await ctx.waitFor(selector, 8000);
  await scrollWfConfigFieldIntoView(ctx, selector);
  // Steady spotlight (not outline flash) — leave ring through afterFill so the
  // viewer can read the value; the next fill/select replaces it.
  // Skip for tall code editors — a ring on empty textarea reads as "background".
  if (opts?.spotlight !== false) {
    steadyWfConfigFieldRing(selector);
    await ctx.delay(wfConfigFieldLookMs());
  }
  const el = document.querySelector<HTMLElement>(selector);
  // Quiet fill (no click ripple) — a ripple centered in a large textarea looks
  // like a blue blob inside the highlight box.
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    fillControlledInput(el, value);
  } else {
    await ctx.fill(selector, value);
  }
  await pauseWfConfigDemo(ctx, 'afterFill');
}

export async function selectWfConfigOption(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  opts?: { spotlight?: boolean },
): Promise<void> {
  await ctx.waitFor(selector, 8000);
  await scrollWfConfigFieldIntoView(ctx, selector);
  if (opts?.spotlight !== false) {
    steadyWfConfigFieldRing(selector);
    await ctx.delay(wfConfigFieldLookMs());
  }
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
  await scrollWfConfigFieldIntoView(ctx, addBtnSelector);
  steadyWfConfigFieldRing(addBtnSelector);
  await ctx.delay(wfConfigFieldLookMs());
  await ctx.click(addBtnSelector);
  await ctx.waitFor(rowSelector, timeout);
  await scrollWfConfigFieldIntoView(ctx, rowSelector);
  steadyWfConfigFieldRing(rowSelector);
  await pauseWfConfigDemo(ctx, 'afterSubFormOpen');
}

/**
 * Hold a steady spotlight on a selector (config field, canvas node, console…).
 * Prefer this over outline flashes for outcome / reading beats inside actions.
 */
export async function holdWfSpotlight(
  ctx: DemoActionContext,
  selector: string,
  holdMs?: number,
): Promise<void> {
  const ms = holdMs ?? Math.max(700, activeWfConfigTiming.afterFill);
  try {
    await ctx.waitFor(selector, 5000);
  } catch {
    await ctx.delay(ms);
    return;
  }
  steadyWfConfigFieldRing(selector);
  try {
    await ctx.delay(ms);
  } finally {
    // Clear so reading-phase DemoSpotlight is not suppressed by a leftover ring.
    purgeAllSpotlightRings();
  }
}

export async function clickWfConfigControl(
  ctx: DemoActionContext,
  selector: string,
): Promise<void> {
  await scrollWfConfigFieldIntoView(ctx, selector);
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

/**
 * Clear Quick Test run badges, console logs, exec summary strip, and close the console panel.
 * Call from demo setup/cleanup so exiting a lesson does not leave stale run UI.
 */
export function resetWorkflowRunStateQuiet(): boolean {
  if (resetWorkflowRunState()) return true;

  document.querySelector<HTMLElement>(WF.RESET_RUN_BTN)?.click();
  const clearBtn = document.querySelector<HTMLButtonElement>(WF.CONSOLE_CLEAR_BTN);
  if (clearBtn && !clearBtn.disabled) clearBtn.click();
  document.querySelector<HTMLElement>('.wf-exec-strip-close')?.click();
  return false;
}

export async function cleanupWorkflowDemoRunUi(ctx: DemoActionContext): Promise<void> {
  resetWorkflowRunStateQuiet();
  await dismissWorkflowExecSummary(ctx);
  await closeWfConsoleIfOpen(ctx);
  await ctx.delay(200);
}

/** Hide the app-level Workflows list sidebar so the canvas has maximum space. */
export async function collapseWfDemoAppSidebar(ctx: DemoActionContext): Promise<void> {
  collapseAppSidebar();
  await ctx.delay(400);
}

/** Reset palette to Blocks tab — prevents stale CATALOG/REQUESTS from a prior session. */
export function resetWfPaletteToBlocks(): void {
  const blocksTab = document.querySelector<HTMLElement>(WF.PAL_TAB_BLOCKS);
  if (blocksTab && !blocksTab.classList.contains('active')) blocksTab.click();
}

/**
 * Block-type → palette category + optional subGroup mapping.
 * Mirrors `ALL_BLOCKS` in WorkflowPalette.tsx so the helper can
 * navigate the accordion (or any future layout) to reveal a block.
 */
const PALETTE_BLOCK_MAP: Record<string, { category: string; subGroup?: string }> = {
  start:               { category: 'triggers' },
  webhook:             { category: 'triggers' },
  schedule:            { category: 'triggers' },
  kafkaTrigger:        { category: 'triggers' },
  wsTrigger:           { category: 'triggers' },
  http:                { category: 'actions', subGroup: 'http' },
  delay:               { category: 'actions', subGroup: 'http' },
  correlationWait:     { category: 'actions', subGroup: 'http' },
  kafkaProduce:        { category: 'actions', subGroup: 'kafka' },
  kafkaConsume:        { category: 'actions', subGroup: 'kafka' },
  kafkaWait:           { category: 'actions', subGroup: 'kafka' },
  wsConnect:           { category: 'actions', subGroup: 'websocket' },
  wsSend:              { category: 'actions', subGroup: 'websocket' },
  wsReceive:           { category: 'actions', subGroup: 'websocket' },
  graphqlQuery:        { category: 'actions', subGroup: 'graphql' },
  graphqlMutation:     { category: 'actions', subGroup: 'graphql' },
  graphqlSubscription: { category: 'actions', subGroup: 'graphql' },
  graphqlIntrospect:   { category: 'actions', subGroup: 'graphql' },
  grpcUnary:           { category: 'actions', subGroup: 'grpc' },
  grpcServerStream:    { category: 'actions', subGroup: 'grpc' },
  condition:           { category: 'logic' },
  switch:              { category: 'logic' },
  loop:                { category: 'logic' },
  waitForCondition:    { category: 'logic' },
  graphqlAssert:       { category: 'logic' },
  grpcAssert:          { category: 'logic' },
  setVariable:         { category: 'data' },
  aggregate:           { category: 'data' },
  logDebug:            { category: 'data' },
  script:              { category: 'data' },
  errorHandler:        { category: 'flow' },
  subWorkflow:         { category: 'flow' },
  fork:                { category: 'flow' },
  join:                { category: 'flow' },
  end:                 { category: 'flow' },
};

/**
 * Ensure a palette block is visible in the DOM and scrolled into view.
 *
 * Works with the rail layout: clicks the correct category rail button,
 * then waits for React to render the blocks for that category.
 * For Actions blocks with a subGroup, the "All" chip is used by default
 * (all protocol blocks are visible when "All" is selected).
 *
 * @param ctx      Demo action context (for delays)
 * @param selector The `WF.PAL_*` CSS selector (e.g. `WF.PAL_HTTP`)
 * @param options  `quiet` suppresses delays (for preAction guards)
 * @returns The block element, or null if it could not be revealed
 */
export async function revealPaletteBlock(
  ctx: DemoActionContext,
  selector: string,
  options?: { quiet?: boolean; showNav?: boolean; spotlightChip?: boolean },
): Promise<HTMLElement | null> {
  resetWfPaletteToBlocks();

  const clearBtn = document.querySelector<HTMLElement>('.wf-palette-search-clear');
  if (clearBtn) clearBtn.click();

  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) {
    existing.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    if (!options?.quiet) await ctx.delay(300);
    return existing;
  }

  const blockType = selector.replace('.wf-palette-block-', '');
  const mapping = PALETTE_BLOCK_MAP[blockType];
  if (!mapping) return null;

  if (options?.showNav) {
    // Visually navigate: click the rail category with ripple, then click the chip.
    const railSel = `[data-testid="wf-palette-rail-${mapping.category}"]`;
    const railBtn = document.querySelector<HTMLElement>(railSel);
    if (railBtn && !railBtn.classList.contains('active')) {
      // Spotlight the rail button so the viewer sees it before clicking.
      if (options?.spotlightChip) {
        const dispose = showSpotlightRing(railBtn);
        await ctx.delay(900);
        dispose();
      }
      await ctx.click(railSel);
      await ctx.delay(300);
    }
    if (mapping.subGroup) {
      const chipSel = `[data-testid="wf-palette-chip-${mapping.subGroup}"]`;
      const chip = document.querySelector<HTMLElement>(chipSel);
      if (chip && !chip.classList.contains('active')) {
        // Spotlight the chip badge so the viewer sees it before clicking.
        if (options?.spotlightChip) {
          const dispose = showSpotlightRing(chip);
          await ctx.delay(900);
          dispose();
        }
        await ctx.click(chipSel);
        await ctx.delay(300);
      }
    }
  } else {
    selectPaletteRailCategory(mapping.category);
    if (!options?.quiet) await ctx.delay(200);
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      if (!options?.quiet) await ctx.delay(300);
      return el;
    }
    await ctx.delay(100);
  }

  return null;
}

/** Click the rail button for a category (data-rail attribute). */
function selectPaletteRailCategory(categoryId: string): void {
  const btn = document.querySelector<HTMLElement>(
    `.wf-palette-rail-btn[data-rail="${categoryId}"]`,
  );
  if (btn && !btn.classList.contains('active')) btn.click();
}

/** Show the Workflows sidebar (+ New, pick workflow) — only for create/select beats. */
export async function expandWfDemoAppSidebar(ctx: DemoActionContext): Promise<void> {
  expandAppSidebar();
  // Sidebar unmounts when collapsed — wait until + New is visible, not merely in the DOM.
  if (await waitForVisibleSelector(ctx, WF.SIDEBAR_NEW_BTN, 3000)) {
    await ctx.delay(150);
    return;
  }
  await ctx.delay(400);
}

/** Select a saved workflow in the app sidebar, then collapse for canvas space. */
export async function selectWorkflowFromAppSidebar(
  ctx: DemoActionContext,
  workflowName: string,
): Promise<boolean> {
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
  if (target?.classList.contains('active') && getWorkflowByName(workflowName)) {
    return true;
  }

  await expandWfDemoAppSidebar(ctx);
  nameEl = findExactSidebarItem();
  const activeTarget = nameEl?.closest<HTMLElement>('.wf-sidebar-item, [data-testid="wf-sidebar-item"], .wf-workflow-item');
  if (activeTarget) {
    activeTarget.click();
    await ctx.delay(700);
  } else {
    selectWorkflowByName(workflowName);
    await ctx.delay(400);
  }
  await collapseWfDemoAppSidebar(ctx);
  return !!activeTarget || !!getWorkflowByName(workflowName);
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
  if (document.querySelector(WF.CONSOLE)) {
    setWfConsolePanelMode('floating');
    applyWfDemoConsoleFloatLayout();
    return;
  }
  setWfConsolePanelMode('floating');
  const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
  if (badge) {
    badge.click();
    await ctx.delay(600);
  }
  if (document.querySelector(WF.CONSOLE)) {
    setWfConsolePanelMode('floating');
    applyWfDemoConsoleFloatLayout();
    await ctx.delay(400);
  }
}

export type WfDebugDemoPacing = {
  /** Delay after navigate, before clicking Debug (default 400). */
  afterNavMs?: number;
  /** Delay after clicking Debug so the bar can render (default 1200). */
  afterClickMs?: number;
  /** Hold before each Step click so viewers see the pause (default 900). */
  beforeStepMs?: number;
  /** Hold after each Step click for the node outcome (default 1200). */
  afterStepMs?: number;
  /** waitFor timeout for the next Step button (default 20000). */
  stepWaitMs?: number;
};

/** Start a step-through Debug run (toolbar Debug button). */
export async function startWfDebugRun(
  ctx: DemoActionContext,
  pacing: WfDebugDemoPacing = {},
): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(pacing.afterNavMs ?? 400);
  await ctx.click(WF.DEBUG_BTN);
  await ctx.delay(pacing.afterClickMs ?? 1200);
}

/**
 * Click each per-node **Step** button as Debug mode pauses the workflow.
 * Returns how many Step clicks were performed.
 */
export async function clickWfDebugStepButtons(
  ctx: DemoActionContext,
  maxSteps = 12,
  pacing: WfDebugDemoPacing = {},
): Promise<number> {
  const beforeStepMs = pacing.beforeStepMs ?? 900;
  const afterStepMs = pacing.afterStepMs ?? 1200;
  const stepWaitMs = pacing.stepWaitMs ?? 20_000;
  let clicked = 0;
  for (let i = 0; i < maxSteps; i++) {
    try {
      await ctx.waitFor(WF.DEBUG_STEP_BTN, stepWaitMs);
    } catch {
      break;
    }
    if (!document.querySelector(WF.DEBUG_STEP_BTN)) break;
    await ctx.delay(beforeStepMs);
    await ctx.click(WF.DEBUG_STEP_BTN);
    clicked++;
    await ctx.delay(afterStepMs);
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
