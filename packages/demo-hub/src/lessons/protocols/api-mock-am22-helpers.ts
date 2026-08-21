/**
 * AM-22 `am-22-workflow` helpers — Workflow Orchestration:
 * Start → Apply → Reset → Assert → Stop.
 *
 * Quiet corpus is the checkout mock plus an empty named workflow. Live beats
 * drop, configure, and wire every node. Companion required — Quick Test starts
 * an isolated listener. No Docker.
 */
import {
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  deleteWorkflowByName,
  deselectAllWorkflowNodes,
  fitWorkflowCanvasView,
  importApiMockGallerySample,
  patchWorkflowNodeDataById,
  prepareApiMockStudioChrome,
  removeWorkflowEdge,
  triggerWorkflowQuickTest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, WF } from '@shared/selectors';
import { purgeAllSpotlightRings } from '../../demoRipple';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  clearApiMockWfServerPicker,
  fillBeat,
  revealBeat,
  resolveApiMockStudioServerId,
  spotlightBeat,
  waitForApiMockStudioServerId,
  waitForApiMockWfServerReady,
} from './api-mock-demo-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  closeWfSamplePreviewIfOpen,
  openWfConsoleIfClosed,
  collapseWfDemoAppSidebar,
  ensureLessonBlankWorkflow,
  fillWfConfigField,
  fitWfCanvasQuiet,
  holdWfSpotlight,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  waitForWfConfigPanel,
  clickWfConfigControl,
} from '../wf-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

export const AM22_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  beforeOpen: 1400,
  lifecycle: 1600,
  journalWrite: 1400,
  simOutcome: 1800,
  beforeRun: 2000,
  generate: 2000,
} as const;

const T = AM22_TIMING;
const REVEAL_MS = 8_000;

export const AM22_CORPUS_SAMPLE = 'am-gallery-checkout';
export const AM22_WF_NAME = 'Checkout mock run';
export const AM22_SERVER_ID = 'srv-gallery-checkout';
export const AM22_SERVER_NAME = 'Cart API';
export const AM22_HTTP_URL = '{{mockBaseUrl}}/cart';
export const AM22_HTTP_METHOD = 'POST';
export const AM22_ASSERT_MIN = '1';
export const AM22_ASSERT_STATUS = '200';
export const AM22_ASSERT_BODY = 'ok';
export const AM22_ASSERT_RECENCY = '10000';
export const AM22_ISOLATED_SERVER = '{{mockServerId}}';

export const AM22_NODE = {
  start: 'am22-start',
  apply: 'am22-apply',
  http: 'am22-http',
  assert: 'am22-assert',
  reset: 'am22-reset',
  stop: 'am22-stop',
} as const;

const POS = {
  start: { x: 280, y: 140 },
  apply: { x: 280, y: 250 },
  http: { x: 280, y: 360 },
  assert: { x: 280, y: 470 },
  reset: { x: 280, y: 580 },
  stop: { x: 280, y: 690 },
};

/** Tall Start→Stop chain — zoom out past 100% and leave room for the guide card. */
export const AM22_FIT = {
  padding: { top: 0.16, right: 0.38, bottom: 0.24, left: 0.1 },
  maxZoom: 0.68,
  minZoom: 0.32,
  duration: 320,
} as const;

/** Execution order. Drops link to the nearest existing neighbor on this chain. */
const AM22_CHAIN = [
  WF.NODE_START,
  API_MOCK.CANVAS_START,
  API_MOCK.CANVAS_APPLY,
  WF.NODE_HTTP,
  API_MOCK.CANVAS_ASSERT,
  API_MOCK.CANVAS_RESET,
  API_MOCK.CANVAS_STOP,
] as const;

export const AM22_ACTION_BLOCKS = [
  WF.PAL_API_MOCK_START,
  WF.PAL_API_MOCK_APPLY,
  WF.PAL_API_MOCK_RESET,
  WF.PAL_API_MOCK_STOP,
] as const;

export const AM22_PALETTE_SEARCH = 'Mock';

const AM22_PALETTE_BLOCKS = [
  ...AM22_ACTION_BLOCKS,
  WF.PAL_API_MOCK_ASSERT,
] as const;

async function am22Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am22ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am22FillNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: 0, hold });
}

async function am22Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am22Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am22Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

function clearAm22CanvasChrome(): void {
  purgeAllSpotlightRings();
  deselectAllWorkflowNodes();
}

async function am22Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

export function am22InputValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

export function am22PassSelector(canvasSel: string): string {
  return `${canvasSel}.wf-node-pass`;
}

export function am22CanvasNodeId(selector: string): string | null {
  const el = document.querySelector(selector);
  return el?.closest('.react-flow__node')?.getAttribute('data-id')
    ?? el?.getAttribute('data-id')
    ?? null;
}

export function isAm22DesignerActive(): boolean {
  return Boolean(firstVisibleElement(WF.DESIGNER) || firstVisibleElement(WF.CANVAS));
}

export function isAm22ConfigOpen(): boolean {
  return Boolean(firstVisibleElement(WF.NODE_CONFIG));
}

export function isAm22IsolateOn(): boolean {
  const el = firstVisibleElement(API_MOCK.WF_ISOLATE);
  return el?.getAttribute('aria-checked') !== 'false';
}

export function hasAm22PaletteGroup(): boolean {
  return AM22_ACTION_BLOCKS.every(sel => Boolean(document.querySelector(sel)))
    && Boolean(document.querySelector(WF.PAL_API_MOCK_ASSERT));
}

export function hasAm22Start(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_START));
}

export function hasAm22Apply(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_APPLY));
}

export function hasAm22Http(): boolean {
  return Boolean(document.querySelector(WF.NODE_HTTP));
}

export function hasAm22Reset(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_RESET));
}

export function hasAm22Assert(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_ASSERT));
}

export function hasAm22Stop(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_STOP));
}

export function hasAm22Wired(): boolean {
  return document.querySelectorAll('.react-flow__edge').length >= 5;
}

export function hasAm22Pass(selector: string = API_MOCK.CANVAS_ASSERT): boolean {
  return Boolean(document.querySelector(am22PassSelector(selector)));
}

export function hasAm22AllGreen(): boolean {
  return [
    API_MOCK.CANVAS_START,
    API_MOCK.CANVAS_APPLY,
    WF.NODE_HTTP,
    API_MOCK.CANVAS_ASSERT,
    API_MOCK.CANVAS_RESET,
    API_MOCK.CANVAS_STOP,
  ].every(sel => hasAm22Pass(sel));
}

async function dismissWfOnboarding(ctx: DemoActionContext): Promise<void> {
  const skip = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (!skip) return;
  skip.click();
  await ctx.delay(300);
}

export async function prepareAm22Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM22_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-22: failed to import ${AM22_CORPUS_SAMPLE}`);
  }
}

export async function cleanupAm22(): Promise<void> {
  deleteWorkflowByName(AM22_WF_NAME);
  await wipeApiMockWorkspace();
}

export async function ensureAm22OnDesigner(ctx: DemoActionContext): Promise<void> {
  if (isAm22DesignerActive()) return;
  ctx.navigateToTab('workflow');
  await ctx.delay(200);
}

export async function ensureAm22Designer(ctx: DemoActionContext): Promise<void> {
  await ensureAm22OnDesigner(ctx);
  await closeWfSamplePreviewIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await closeWfConsoleIfOpen(ctx);
  await ensureLessonBlankWorkflow(ctx, AM22_WF_NAME, { dismissOnboarding: dismissWfOnboarding });
  await collapseWfDemoAppSidebar(ctx);
  await revealPaletteBlock(ctx, WF.PAL_API_MOCK_START, { quiet: true });
}

function bindIsolatedServer(nodeId: string | null): void {
  if (!nodeId) return;
  patchWorkflowNodeDataById(nodeId, { serverId: AM22_ISOLATED_SERVER });
}

export async function resolveAm22StudioServerId(): Promise<string | null> {
  return resolveApiMockStudioServerId({ name: AM22_SERVER_NAME, templateId: AM22_SERVER_ID });
}

async function waitForAm22StudioServerId(
  ctx: DemoActionContext,
  timeout = 8_000,
): Promise<string> {
  return waitForApiMockStudioServerId(ctx, {
    name: AM22_SERVER_NAME,
    templateId: AM22_SERVER_ID,
    timeout,
  }) || AM22_SERVER_ID;
}

async function selectAm22StudioServer(ctx: DemoActionContext): Promise<string> {
  const serverId = await waitForAm22StudioServerId(ctx);
  await waitForApiMockWfServerReady(ctx, serverId);
  if (clearApiMockWfServerPicker()) await ctx.delay(T.fieldFilled);
  await selectWfConfigOption(ctx, API_MOCK.WF_SERVER, serverId);
  const el = firstVisibleElement(API_MOCK.WF_SERVER);
  if (el && el.getAttribute('data-value') !== serverId) {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      await ctx.selectOption(API_MOCK.WF_SERVER, serverId);
      if ((firstVisibleElement(API_MOCK.WF_SERVER)?.getAttribute('data-value') ?? '') === serverId) {
        break;
      }
      await ctx.delay(150);
    }
  }
  await holdWfSpotlight(ctx, API_MOCK.WF_SERVER, T.payoff);
  return serverId;
}

async function persistAm22Start(serverId?: string): Promise<void> {
  const id = am22CanvasNodeId(API_MOCK.CANVAS_START) ?? AM22_NODE.start;
  const resolved = serverId ?? (await resolveAm22StudioServerId()) ?? AM22_SERVER_ID;
  patchWorkflowNodeDataById(id, {
    serverId: resolved,
    isolateRun: true,
    savePortAs: 'mockPort',
    saveBaseUrlAs: 'mockBaseUrl',
  });
}

function persistAm22Http(): void {
  const id = am22CanvasNodeId(WF.NODE_HTTP) ?? AM22_NODE.http;
  patchWorkflowNodeDataById(id, {
    scenario: {
      id: 'am22-cart',
      name: 'POST cart',
      url: AM22_HTTP_URL,
      method: AM22_HTTP_METHOD,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{}',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    },
  });
}

function quietAdd(
  type: string,
  id: string,
  label: string,
  position: { x: number; y: number },
  canvasSel: string,
): void {
  if (document.querySelector(canvasSel)) return;
  addWorkflowNodeWithPreset(type, id, label, position);
}

async function quietStart(ctx: DemoActionContext): Promise<void> {
  quietAdd('apiMockStart', AM22_NODE.start, 'Start Mock Server', POS.start, API_MOCK.CANVAS_START);
  await ctx.delay(80);
  await persistAm22Start();
  await linkIntoChain(ctx, API_MOCK.CANVAS_START, false);
}

async function fitAm22Canvas(
  ctx: DemoActionContext,
  opts?: { visible?: boolean },
): Promise<void> {
  const visible = opts?.visible !== false;
  if (visible && firstVisibleElement(WF.FIT_VIEW_BTN)) {
    await am22Aim(ctx, WF.FIT_VIEW_BTN, T.fieldFilled);
  }
  if (fitWorkflowCanvasView({
    ...AM22_FIT,
    duration: visible ? AM22_FIT.duration : 0,
  })) return;
  await fitWfCanvasQuiet(ctx);
}

async function quietHttp(ctx: DemoActionContext): Promise<void> {
  quietAdd('http', AM22_NODE.http, 'HTTP Request', POS.http, WF.NODE_HTTP);
  await ctx.delay(80);
  persistAm22Http();
  await linkIntoChain(ctx, WF.NODE_HTTP, false);
}

async function quietMockNode(
  ctx: DemoActionContext,
  type: string,
  id: string,
  label: string,
  position: { x: number; y: number },
  canvasSel: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  quietAdd(type, id, label, position, canvasSel);
  await ctx.delay(80);
  const nodeId = am22CanvasNodeId(canvasSel) ?? id;
  patchWorkflowNodeDataById(nodeId, { serverId: AM22_ISOLATED_SERVER, ...extra });
  await linkIntoChain(ctx, canvasSel, false);
}

async function dropFromPalette(
  ctx: DemoActionContext,
  paletteSel: string,
  canvasSel: string,
): Promise<void> {
  await revealPaletteBlock(ctx, paletteSel, { showNav: true });
  if (document.querySelector(canvasSel)) {
    clearAm22CanvasChrome();
    return;
  }
  await am22ClickNow(ctx, paletteSel);
  await am22Reveal(ctx, canvasSel);
  clearAm22CanvasChrome();
}

async function configureMockServer(
  ctx: DemoActionContext,
  canvasSel: string,
  panelSel: string,
  afterSelect?: (ctx: DemoActionContext) => Promise<void>,
): Promise<void> {
  await openWfNodeConfigModal(ctx, { canvasTestId: canvasSel, skipCanvasSpotlight: true });
  await waitForWfConfigPanel(ctx, panelSel);
  await selectAm22StudioServer(ctx);
  if (afterSelect) await afterSelect(ctx);
  await saveAndCloseWfConfigModal(ctx);
  bindIsolatedServer(am22CanvasNodeId(canvasSel));
}

async function holdOrEnableIsolate(ctx: DemoActionContext): Promise<void> {
  if (isAm22IsolateOn()) {
    await holdWfSpotlight(ctx, API_MOCK.WF_ISOLATE, T.look);
    return;
  }
  await clickWfConfigControl(ctx, API_MOCK.WF_ISOLATE);
}

async function connectPair(
  ctx: DemoActionContext,
  fromSel: string,
  toSel: string,
): Promise<void> {
  const from = am22CanvasNodeId(fromSel);
  const to = am22CanvasNodeId(toSel);
  if (!from || !to) return;
  connectWorkflowNodes(from, to);
  await ctx.delay(T.fieldFilled);
  clearAm22CanvasChrome();
}

function nearestChainNeighbor(addedSel: string, dir: -1 | 1): string | null {
  const idx = AM22_CHAIN.indexOf(addedSel as typeof AM22_CHAIN[number]);
  if (idx < 0) return null;
  for (let i = idx + dir; i >= 0 && i < AM22_CHAIN.length; i += dir) {
    if (am22CanvasNodeId(AM22_CHAIN[i])) return AM22_CHAIN[i];
  }
  return null;
}

function unlinkPair(fromSel: string, toSel: string): void {
  const from = am22CanvasNodeId(fromSel);
  const to = am22CanvasNodeId(toSel);
  if (from && to) removeWorkflowEdge(from, to);
}

async function linkIntoChain(
  ctx: DemoActionContext,
  addedSel: string,
  visible: boolean,
): Promise<void> {
  const upstream = nearestChainNeighbor(addedSel, -1);
  const downstream = nearestChainNeighbor(addedSel, 1);
  if (upstream && downstream) unlinkPair(upstream, downstream);
  if (visible) {
    if (upstream) await connectPair(ctx, upstream, addedSel);
    if (downstream) await connectPair(ctx, addedSel, downstream);
    await fitAm22Canvas(ctx);
    return;
  }
  const added = am22CanvasNodeId(addedSel);
  if (upstream && added) {
    const from = am22CanvasNodeId(upstream);
    if (from) connectWorkflowNodes(from, added);
  }
  if (added && downstream) {
    const to = am22CanvasNodeId(downstream);
    if (to) connectWorkflowNodes(added, to);
  }
}

async function searchAm22Palette(
  ctx: DemoActionContext,
  opts?: { visible?: boolean },
): Promise<void> {
  resetWfPaletteToBlocks();
  await ctx.waitFor(WF.PAL_SEARCH, 5000);
  const input = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
  const already = input?.value === AM22_PALETTE_SEARCH;
  if (opts?.visible !== false && !already) {
    await holdWfSpotlight(ctx, WF.PAL_SEARCH, T.look);
  }
  if (!already) {
    if (input) fillControlledInput(input, AM22_PALETTE_SEARCH);
    else await ctx.fill(WF.PAL_SEARCH, AM22_PALETTE_SEARCH);
    if (opts?.visible !== false) await ctx.delay(T.fieldFilled);
  }
  if (opts?.visible !== false) {
    await holdWfSpotlight(ctx, WF.PAL_SEARCH, T.payoff);
  }
}

export async function ensureAm22ForPalette(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
  await searchAm22Palette(ctx, { visible: false });
}

export async function ensureAm22ForStart(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
}

export async function ensureAm22ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
  if (!hasAm22Start()) await quietStart(ctx);
}

export async function ensureAm22ForHttp(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForApply(ctx);
  if (!hasAm22Apply()) {
    await quietMockNode(ctx, 'apiMockApply', AM22_NODE.apply, 'Apply Definition', POS.apply, API_MOCK.CANVAS_APPLY);
  }
}

export async function ensureAm22ForAssert(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForHttp(ctx);
  if (!hasAm22Http()) await quietHttp(ctx);
}

export async function ensureAm22ForReset(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForAssert(ctx);
  if (!hasAm22Assert()) {
    await quietMockNode(
      ctx,
      'apiMockAssertCalls',
      AM22_NODE.assert,
      'Assert Mock Calls',
      POS.assert,
      API_MOCK.CANVAS_ASSERT,
      {
        expectedMinCount: 1,
        expectedStatus: 200,
        expectedBodyContains: AM22_ASSERT_BODY,
        expectedLastCallWithinMs: 10_000,
      },
    );
  }
}

export async function ensureAm22ForStop(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForReset(ctx);
  if (!hasAm22Reset()) {
    await quietMockNode(ctx, 'apiMockResetState', AM22_NODE.reset, 'Reset Mock State', POS.reset, API_MOCK.CANVAS_RESET);
  }
}

export async function ensureAm22ForWire(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForStop(ctx);
  if (!hasAm22Stop()) {
    await quietMockNode(ctx, 'apiMockStop', AM22_NODE.stop, 'Stop Mock Server', POS.stop, API_MOCK.CANVAS_STOP, {
      idempotent: true,
    });
  }
  await fitAm22Canvas(ctx, { visible: false });
}

export async function ensureAm22ForQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForWire(ctx);
  if (!hasAm22Wired()) {
    const chain: Array<[string, string]> = [
      [WF.NODE_START, API_MOCK.CANVAS_START],
      [API_MOCK.CANVAS_START, API_MOCK.CANVAS_APPLY],
      [API_MOCK.CANVAS_APPLY, WF.NODE_HTTP],
      [WF.NODE_HTTP, API_MOCK.CANVAS_ASSERT],
      [API_MOCK.CANVAS_ASSERT, API_MOCK.CANVAS_RESET],
      [API_MOCK.CANVAS_RESET, API_MOCK.CANVAS_STOP],
    ];
    for (const [from, to] of chain) {
      const a = am22CanvasNodeId(from);
      const b = am22CanvasNodeId(to);
      if (a && b) connectWorkflowNodes(a, b);
    }
  }
  await cleanupWorkflowDemoRunUi(ctx);
  await fitAm22Canvas(ctx, { visible: false });
  await openWfConsoleIfClosed(ctx);
}

export async function runAm22DesignerPalette(ctx: DemoActionContext): Promise<void> {
  await collapseWfDemoAppSidebar(ctx);
  await searchAm22Palette(ctx);
  await ctx.waitFor(WF.PAL_API_MOCK_START, 5000);
  await am22Break(ctx);
  for (const sel of AM22_PALETTE_BLOCKS) {
    await ctx.waitFor(sel, 5000);
    await am22Look(ctx, sel);
  }
  await am22Payoff(ctx, WF.PAL_SEARCH);
}

export async function runAm22StartNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_START, API_MOCK.CANVAS_START);
  await linkIntoChain(ctx, API_MOCK.CANVAS_START, true);
  await am22Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_START, skipCanvasSpotlight: true });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_START_CONFIG);
  await ctx.delay(T.panelReady);
  const serverId = await selectAm22StudioServer(ctx);
  await pauseWfConfigSection(ctx);
  await holdOrEnableIsolate(ctx);
  await am22Look(ctx, API_MOCK.WF_PORT_VARS);
  await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_PORT, T.look);
  await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_BASE_URL, T.payoff);
  await saveAndCloseWfConfigModal(ctx);
  await persistAm22Start(serverId);
  clearAm22CanvasChrome();
}

export async function runAm22HttpNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_HTTP, WF.NODE_HTTP);
  await linkIntoChain(ctx, WF.NODE_HTTP, true);
  await am22Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: WF.NODE_HTTP, nodeSelector: WF.NODE_HTTP, skipCanvasSpotlight: true });
  await waitForWfConfigPanel(ctx, WF.CFG_HTTP_URL);
  await selectWfConfigOption(ctx, WF.CFG_HTTP_METHOD, AM22_HTTP_METHOD);
  await fillWfConfigField(ctx, WF.CFG_HTTP_URL, AM22_HTTP_URL);
  await holdWfSpotlight(ctx, WF.CFG_HTTP_URL, T.payoff);
  await saveAndCloseWfConfigModal(ctx);
  persistAm22Http();
  clearAm22CanvasChrome();
}

export async function runAm22ApplyNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_APPLY, API_MOCK.CANVAS_APPLY);
  await linkIntoChain(ctx, API_MOCK.CANVAS_APPLY, true);
  await am22Break(ctx);
  await configureMockServer(ctx, API_MOCK.CANVAS_APPLY, API_MOCK.WF_APPLY_CONFIG, async (inner) => {
    await holdWfSpotlight(inner, API_MOCK.WF_APPLY_ISOLATE_HINT, T.payoff);
  });
  clearAm22CanvasChrome();
}

export async function runAm22ResetNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_RESET, API_MOCK.CANVAS_RESET);
  await linkIntoChain(ctx, API_MOCK.CANVAS_RESET, true);
  await am22Break(ctx);
  await configureMockServer(ctx, API_MOCK.CANVAS_RESET, API_MOCK.WF_RESET_CONFIG, async (inner) => {
    await holdWfSpotlight(inner, API_MOCK.WF_RESET_OPTION, T.payoff);
  });
  clearAm22CanvasChrome();
}

export async function runAm22AssertNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_ASSERT, API_MOCK.CANVAS_ASSERT);
  await linkIntoChain(ctx, API_MOCK.CANVAS_ASSERT, true);
  await am22Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_ASSERT, skipCanvasSpotlight: true });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_ASSERT_CONFIG);
  await selectAm22StudioServer(ctx);
  await pauseWfConfigSection(ctx);
  if (am22InputValue(API_MOCK.WF_ASSERT_MIN) !== AM22_ASSERT_MIN) {
    await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_MIN, AM22_ASSERT_MIN);
  } else {
    await holdWfSpotlight(ctx, API_MOCK.WF_ASSERT_MIN, T.look);
  }
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_STATUS, AM22_ASSERT_STATUS);
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_BODY, AM22_ASSERT_BODY);
  await holdWfSpotlight(ctx, API_MOCK.WF_ASSERT_HEADER, T.look);
  await holdWfSpotlight(ctx, API_MOCK.WF_ASSERT_HEADER_VALUE, T.look);
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_RECENCY, AM22_ASSERT_RECENCY);
  await saveAndCloseWfConfigModal(ctx);
  bindIsolatedServer(am22CanvasNodeId(API_MOCK.CANVAS_ASSERT));
  clearAm22CanvasChrome();
}

export async function runAm22StopNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_STOP, API_MOCK.CANVAS_STOP);
  await linkIntoChain(ctx, API_MOCK.CANVAS_STOP, true);
  await am22Break(ctx);
  await configureMockServer(ctx, API_MOCK.CANVAS_STOP, API_MOCK.WF_STOP_CONFIG);
  clearAm22CanvasChrome();
}

export async function runAm22Wire(ctx: DemoActionContext): Promise<void> {
  await connectPair(ctx, WF.NODE_START, API_MOCK.CANVAS_START);
  await connectPair(ctx, API_MOCK.CANVAS_START, API_MOCK.CANVAS_APPLY);
  await connectPair(ctx, API_MOCK.CANVAS_APPLY, WF.NODE_HTTP);
  await am22Break(ctx);
  await connectPair(ctx, WF.NODE_HTTP, API_MOCK.CANVAS_ASSERT);
  await connectPair(ctx, API_MOCK.CANVAS_ASSERT, API_MOCK.CANVAS_RESET);
  await connectPair(ctx, API_MOCK.CANVAS_RESET, API_MOCK.CANVAS_STOP);
  await fitAm22Canvas(ctx);
  clearAm22CanvasChrome();
}

export async function runAm22QuickTest(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WF.CONSOLE_BADGE) && !document.querySelector(WF.CONSOLE)) {
    await am22ClickNow(ctx, WF.CONSOLE_BADGE, T.panelReady);
  }
  await openWfConsoleIfClosed(ctx);
  await am22Look(ctx, WF.CONSOLE);
  if (firstVisibleElement(WF.QUICK_TEST)) {
    await am22ClickNow(ctx, WF.QUICK_TEST, T.fieldFilled);
  } else {
    triggerWorkflowQuickTest();
    await ctx.delay(T.fieldFilled);
  }
  await am22Reveal(ctx, am22PassSelector(API_MOCK.CANVAS_START), T.simOutcome);
  await am22Look(ctx, am22PassSelector(API_MOCK.CANVAS_APPLY));
  await am22Look(ctx, am22PassSelector(WF.NODE_HTTP));
  await am22Look(ctx, am22PassSelector(API_MOCK.CANVAS_ASSERT));
  await am22Look(ctx, am22PassSelector(API_MOCK.CANVAS_RESET));
  await am22Look(ctx, am22PassSelector(API_MOCK.CANVAS_STOP));
  await am22Payoff(ctx, am22PassSelector(API_MOCK.CANVAS_ASSERT));
}

/** @internal exported for helper tests */
export const am22TestHooks = {
  am22Aim,
  am22ClickNow,
  am22FillNow,
  bindIsolatedServer,
  persistAm22Start,
  persistAm22Http,
  fitAm22Canvas,
  resolveAm22StudioServerId,
  selectAm22StudioServer,
  waitForAm22StudioServerId,
  quietAdd,
  dropFromPalette,
  holdOrEnableIsolate,
  connectPair,
  linkIntoChain,
  dismissWfOnboarding,
};
