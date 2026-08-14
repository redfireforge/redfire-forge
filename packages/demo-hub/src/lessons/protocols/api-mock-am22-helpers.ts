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
  importApiMockGallerySample,
  patchWorkflowNodeDataById,
  prepareApiMockStudioChrome,
  triggerWorkflowQuickTest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, WF } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  closeWfSamplePreviewIfOpen,
  collapseWfDemoAppSidebar,
  ensureLessonBlankWorkflow,
  fillWfConfigField,
  fitWfCanvasQuiet,
  holdWfSpotlight,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  revealPaletteBlock,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  waitForWfConfigPanel,
  clickWfConfigControl,
} from '../wf-demo-helpers';

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
  start: { x: 280, y: 180 },
  apply: { x: 280, y: 310 },
  http: { x: 280, y: 440 },
  assert: { x: 280, y: 570 },
  reset: { x: 280, y: 700 },
  stop: { x: 280, y: 830 },
};

export const AM22_ACTION_BLOCKS = [
  WF.PAL_API_MOCK_START,
  WF.PAL_API_MOCK_APPLY,
  WF.PAL_API_MOCK_RESET,
  WF.PAL_API_MOCK_STOP,
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
  const id = am22CanvasNodeId(API_MOCK.CANVAS_START) ?? AM22_NODE.start;
  patchWorkflowNodeDataById(id, {
    serverId: AM22_SERVER_ID,
    isolateRun: true,
    savePortAs: 'mockPort',
    saveBaseUrlAs: 'mockBaseUrl',
  });
}

async function quietHttp(ctx: DemoActionContext): Promise<void> {
  quietAdd('http', AM22_NODE.http, 'HTTP Request', POS.http, WF.NODE_HTTP);
  await ctx.delay(80);
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
}

async function dropFromPalette(
  ctx: DemoActionContext,
  paletteSel: string,
  canvasSel: string,
): Promise<void> {
  await revealPaletteBlock(ctx, paletteSel, { showNav: true });
  if (document.querySelector(canvasSel)) {
    await am22Look(ctx, canvasSel);
    return;
  }
  await am22ClickNow(ctx, paletteSel);
  await am22Reveal(ctx, canvasSel);
  await am22Look(ctx, canvasSel);
}

async function configureMockServer(
  ctx: DemoActionContext,
  canvasSel: string,
  panelSel: string,
  afterSelect?: (ctx: DemoActionContext) => Promise<void>,
): Promise<void> {
  await openWfNodeConfigModal(ctx, { canvasTestId: canvasSel });
  await waitForWfConfigPanel(ctx, panelSel);
  await selectWfConfigOption(ctx, API_MOCK.WF_SERVER, AM22_SERVER_ID);
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
  await am22Look(ctx, fromSel);
  connectWorkflowNodes(from, to);
  await ctx.delay(T.fieldFilled);
}

export async function ensureAm22ForPalette(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
}

export async function ensureAm22ForStart(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
}

export async function ensureAm22ForHttp(ctx: DemoActionContext): Promise<void> {
  await ensureAm22Designer(ctx);
  if (!hasAm22Start()) await quietStart(ctx);
}

export async function ensureAm22ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForHttp(ctx);
  if (!hasAm22Http()) await quietHttp(ctx);
}

export async function ensureAm22ForReset(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForApply(ctx);
  if (!hasAm22Apply()) {
    await quietMockNode(ctx, 'apiMockApply', AM22_NODE.apply, 'Apply Definition', POS.apply, API_MOCK.CANVAS_APPLY);
  }
}

export async function ensureAm22ForAssert(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForReset(ctx);
  if (!hasAm22Reset()) {
    await quietMockNode(ctx, 'apiMockResetState', AM22_NODE.reset, 'Reset Mock State', POS.reset, API_MOCK.CANVAS_RESET);
  }
}

export async function ensureAm22ForStop(ctx: DemoActionContext): Promise<void> {
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

export async function ensureAm22ForWire(ctx: DemoActionContext): Promise<void> {
  await ensureAm22ForStop(ctx);
  if (!hasAm22Stop()) {
    await quietMockNode(ctx, 'apiMockStop', AM22_NODE.stop, 'Stop Mock Server', POS.stop, API_MOCK.CANVAS_STOP, {
      idempotent: true,
    });
  }
  await fitWfCanvasQuiet(ctx);
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
  await fitWfCanvasQuiet(ctx);
}

export async function runAm22DesignerPalette(ctx: DemoActionContext): Promise<void> {
  await collapseWfDemoAppSidebar(ctx);
  await revealPaletteBlock(ctx, WF.PAL_API_MOCK_START, { showNav: true });
  for (const sel of AM22_ACTION_BLOCKS) {
    await revealPaletteBlock(ctx, sel);
    await am22Look(ctx, sel);
  }
  await am22Break(ctx);
  await revealPaletteBlock(ctx, WF.PAL_API_MOCK_ASSERT, { showNav: true });
  await am22Look(ctx, WF.PAL_API_MOCK_ASSERT);
  await am22Break(ctx);
  await revealPaletteBlock(ctx, WF.PAL_API_MOCK_START, { showNav: true });
  await am22Payoff(ctx, firstVisibleElement(WF.PAL_CHIP_APIMOCK) ? WF.PAL_CHIP_APIMOCK : WF.PAL_API_MOCK_START);
}

export async function runAm22StartNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_START, API_MOCK.CANVAS_START);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_START });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_START_CONFIG);
  await selectWfConfigOption(ctx, API_MOCK.WF_SERVER, AM22_SERVER_ID);
  await pauseWfConfigSection(ctx);
  await holdOrEnableIsolate(ctx);
  await am22Look(ctx, API_MOCK.WF_PORT_VARS);
  await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_PORT, T.look);
  await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_BASE_URL, T.payoff);
  await saveAndCloseWfConfigModal(ctx);
  await am22Payoff(ctx, API_MOCK.CANVAS_START);
}

export async function runAm22HttpNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_HTTP, WF.NODE_HTTP);
  await openWfNodeConfigModal(ctx, { canvasTestId: WF.NODE_HTTP, nodeSelector: WF.NODE_HTTP });
  await waitForWfConfigPanel(ctx, WF.CFG_HTTP_URL);
  await selectWfConfigOption(ctx, WF.CFG_HTTP_METHOD, AM22_HTTP_METHOD);
  await fillWfConfigField(ctx, WF.CFG_HTTP_URL, AM22_HTTP_URL);
  await holdWfSpotlight(ctx, WF.CFG_HTTP_URL, T.payoff);
  await saveAndCloseWfConfigModal(ctx);
  await am22Payoff(ctx, WF.NODE_HTTP);
}

export async function runAm22ApplyNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_APPLY, API_MOCK.CANVAS_APPLY);
  await configureMockServer(ctx, API_MOCK.CANVAS_APPLY, API_MOCK.WF_APPLY_CONFIG, async (inner) => {
    await holdWfSpotlight(inner, API_MOCK.WF_APPLY_ISOLATE_HINT, T.payoff);
  });
  await am22Payoff(ctx, API_MOCK.CANVAS_APPLY);
}

export async function runAm22ResetNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_RESET, API_MOCK.CANVAS_RESET);
  await configureMockServer(ctx, API_MOCK.CANVAS_RESET, API_MOCK.WF_RESET_CONFIG, async (inner) => {
    await holdWfSpotlight(inner, API_MOCK.WF_RESET_OPTION, T.payoff);
  });
  await am22Payoff(ctx, API_MOCK.CANVAS_RESET);
}

export async function runAm22AssertNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_ASSERT, API_MOCK.CANVAS_ASSERT);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_ASSERT });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_ASSERT_CONFIG);
  await selectWfConfigOption(ctx, API_MOCK.WF_SERVER, AM22_SERVER_ID);
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
  await am22Payoff(ctx, API_MOCK.CANVAS_ASSERT);
}

export async function runAm22StopNode(ctx: DemoActionContext): Promise<void> {
  await dropFromPalette(ctx, WF.PAL_API_MOCK_STOP, API_MOCK.CANVAS_STOP);
  await configureMockServer(ctx, API_MOCK.CANVAS_STOP, API_MOCK.WF_STOP_CONFIG);
  await am22Payoff(ctx, API_MOCK.CANVAS_STOP);
}

export async function runAm22Wire(ctx: DemoActionContext): Promise<void> {
  await connectPair(ctx, WF.NODE_START, API_MOCK.CANVAS_START);
  await connectPair(ctx, API_MOCK.CANVAS_START, API_MOCK.CANVAS_APPLY);
  await connectPair(ctx, API_MOCK.CANVAS_APPLY, WF.NODE_HTTP);
  await am22Break(ctx);
  await connectPair(ctx, WF.NODE_HTTP, API_MOCK.CANVAS_ASSERT);
  await connectPair(ctx, API_MOCK.CANVAS_ASSERT, API_MOCK.CANVAS_RESET);
  await connectPair(ctx, API_MOCK.CANVAS_RESET, API_MOCK.CANVAS_STOP);
  if (firstVisibleElement(WF.FIT_VIEW_BTN)) {
    await am22Aim(ctx, WF.FIT_VIEW_BTN, T.fieldFilled);
  } else {
    await fitWfCanvasQuiet(ctx);
  }
  await am22Payoff(ctx, API_MOCK.CANVAS_START);
}

export async function runAm22QuickTest(ctx: DemoActionContext): Promise<void> {
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
  quietAdd,
  dropFromPalette,
  holdOrEnableIsolate,
  connectPair,
  dismissWfOnboarding,
};
