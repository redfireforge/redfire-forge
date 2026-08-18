/**
 * AM-21 `am-21-simulation-suite` helpers — Simulation as a Test Suite.
 *
 * Quiet corpus is eight samples with expectations. Live beats: an ad-hoc run,
 * an expectation edit, FAIL, run-all, seed replay, export, and Attach + Try
 * in Requests. Offline — no companion Start, no Docker.
 */
import {
  importApiMockGallerySample,
  prepareApiMockStudioChrome,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, APP, REQ } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  reviewAndRunSimulation,
  closeSimulateWorkspace,
  spotlightBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

export const AM21_TIMING = {
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
  beforeRun: 2400,
  generate: 2000,
} as const;

/** Last step (Examples) — longer rings so Attach, the contract fields, and Try can be read. */
export const AM21_EXAMPLES_TIMING = {
  look: 1600,
  hold: 1800,
  tabSwitch: 1500,
  payoff: 2400,
  break: 1600,
  beforeOpen: 1800,
} as const;

const T = AM21_TIMING;
const REVEAL_MS = 8_000;

export const AM21_CORPUS_SAMPLE = 'am-gallery-suite';
// Gallery import remaps every sample id (`sample-health` → `sample-<uuid>`), so
// the lesson can never select a corpus sample by its authored id. Sample and
// example NAMES survive the import untouched, so we resolve the live (remapped)
// id from the DOM by name at call time — see `resolveAm21SampleId` /
// `resolveAm21ExampleId` below.
export const AM21_HEALTH_NAME = 'GET /health';
export const AM21_DICE_NAME = 'GET /dice';
export const AM21_ORPHAN_NAME = 'Unassociated GET /health';
export const AM21_ADHOC_PATH = '/health';
export const AM21_WRONG_STATUS = '201';

async function am21Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am21ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am21AimFill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am21Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am21Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am21Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am21Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

export function am21InputValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

export function am21SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am21RenderedBody(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)?.textContent?.trim()
    ?? firstVisibleElement(API_MOCK.SIMULATE_RENDERED)?.textContent?.trim()
    ?? '';
}

/**
 * Simulate sample rows keep their authored name after import even though their
 * ids are remapped. Resolve the live (remapped) id from the sidebar by name.
 */
export function resolveAm21SampleId(name: string): string | undefined {
  const rows = document.querySelectorAll<HTMLElement>('.am-sim-sample');
  for (const row of rows) {
    const label = row.querySelector('.am-sim-sample-name')?.textContent?.trim();
    if (label !== name) continue;
    const id = (row.getAttribute('data-testid') ?? '').replace('api-mock-sim-sample-', '');
    if (id) return id;
  }
  return undefined;
}

/** Example cards keep their name too; the card id is the remapped sample id. */
export function resolveAm21ExampleId(name: string): string | undefined {
  const labels = document.querySelectorAll<HTMLInputElement>('[data-testid^="api-mock-example-name-"]');
  for (const label of labels) {
    if (label.value?.trim() !== name) continue;
    const id = (label.getAttribute('data-testid') ?? '').replace('api-mock-example-name-', '');
    if (id) return id;
  }
  return undefined;
}

export function hasAm21Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR) || firstVisibleElement(API_MOCK.ROUTE_ROW));
}

export function hasAm21SavedSamples(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_SECTION_SAVED));
}

export function isAm21SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function isAm21StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) || firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm21Result(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_OUTCOME) || firstVisibleElement(API_MOCK.SIMULATE_RESULT));
}

export function hasAm21SampleResult(id: string): boolean {
  const row = firstVisibleElement(API_MOCK.simSample(id))
    ?? document.querySelector(API_MOCK.simSample(id));
  return Boolean(row?.querySelector('.am-badge, [data-testid="api-mock-sim-sample-fail"]'));
}

export function hasAm21Fail(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_FAIL_BADGE) || firstVisibleElement(API_MOCK.SIMULATE_ASSERT_FAIL));
}

export function hasAm21Summary(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_SUMMARY));
}

export function hasAm21ExportConfirm(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_EXPORT_CONFIRM));
}

export function hasAm21Examples(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXAMPLES_GRID) || firstVisibleElement(API_MOCK.EXAMPLES_EMPTY));
}

export function hasAm21Attach(): boolean {
  const id = resolveAm21ExampleId(AM21_ORPHAN_NAME);
  return Boolean(id && firstVisibleElement(API_MOCK.exampleAttach(id)));
}

export function hasAm21WrongExpectation(): boolean {
  return am21InputValue(API_MOCK.SIMULATE_ASSERT_STATUS) === AM21_WRONG_STATUS;
}

export function isAm21HealthSelected(): boolean {
  const id = resolveAm21SampleId(AM21_HEALTH_NAME);
  return Boolean(id && firstVisibleElement(API_MOCK.simSample(id))?.classList.contains('active'));
}

export function isAm21DiceSelected(): boolean {
  const id = resolveAm21SampleId(AM21_DICE_NAME);
  return Boolean(id && firstVisibleElement(API_MOCK.simSample(id))?.classList.contains('active'));
}

export async function prepareAm21Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM21_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-21: failed to import ${AM21_CORPUS_SAMPLE}`);
  }
}

export async function cleanupAm21(): Promise<void> {
  await wipeApiMockWorkspace();
}

export async function ensureAm21OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm21Server() || firstVisibleElement(API_MOCK.STUDIO) || isAm21SimulateOpen()) {
    return;
  }
  if (firstVisibleElement(APP.AB_PROTOCOLS)) {
    await ctx.click(APP.AB_PROTOCOLS);
  }
  if (firstVisibleElement(API_MOCK.APP_SUBNAV)) {
    await ctx.click(API_MOCK.APP_SUBNAV);
    await ctx.delay(200);
    return;
  }
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

export async function ensureAm21StudioView(ctx: DemoActionContext): Promise<void> {
  await ensureAm21OnApiMock(ctx);
  if (isAm21StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm21Library(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm21StudioView(ctx);
  if (hasAm21Server()) return;
  const imported = await importApiMockGallerySample(AM21_CORPUS_SAMPLE);
  if (imported) await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function closeAm21Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm21SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 200 });
}

export async function openAm21Simulate(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (isAm21SimulateOpen()) return;
  if (visible) await am21ClickNow(ctx, API_MOCK.SIMULATE, T.panelReady);
  else await ctx.click(API_MOCK.SIMULATE);
  await ctx.waitFor(API_MOCK.SIMULATE_WORKSPACE, REVEAL_MS);
}

async function selectAm21Sample(
  ctx: DemoActionContext,
  id: string,
  visible: boolean,
): Promise<void> {
  if (firstVisibleElement(API_MOCK.simSample(id))?.classList.contains('active')) return;
  const btn = API_MOCK.simSampleBtn(id);
  if (!firstVisibleElement(btn) && !document.querySelector(btn)) return;
  if (visible) await am21Aim(ctx, btn, T.fieldFilled);
  else await ctx.click(btn);
}

async function ensureAm21Result(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (hasAm21Result()) return;
  if (visible) {
    await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  } else {
    await ctx.click(API_MOCK.SIMULATE_RUN);
  }
  await ctx.waitFor(API_MOCK.SIMULATE_OUTCOME, REVEAL_MS);
}

async function selectAm21SampleByName(
  ctx: DemoActionContext,
  name: string,
  visible: boolean,
): Promise<string | undefined> {
  const id = resolveAm21SampleId(name);
  if (id) await selectAm21Sample(ctx, id, visible);
  return id;
}

async function ensureAm21HealthResult(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const id = await selectAm21SampleByName(ctx, AM21_HEALTH_NAME, visible);
  if (id && hasAm21SampleResult(id)) return;
  if (visible) {
    await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  } else {
    await ctx.click(API_MOCK.SIMULATE_RUN);
  }
  await ctx.waitFor(API_MOCK.SIMULATE_OUTCOME, REVEAL_MS);
}

async function showAm21RequestForm(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(API_MOCK.SIMULATE_VIEW_REQUEST)) return;
  if (visible) await am21Aim(ctx, API_MOCK.SIMULATE_VIEW_REQUEST, T.tabSwitch);
  else await ctx.click(API_MOCK.SIMULATE_VIEW_REQUEST);
}

async function openAm21Assertions(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (firstVisibleElement(API_MOCK.SIMULATE_ASSERTIONS)) return;
  if (visible) await am21ClickNow(ctx, API_MOCK.SIMULATE_TAB_ASSERTIONS, T.tabSwitch);
  else await ctx.click(API_MOCK.SIMULATE_TAB_ASSERTIONS);
  await ctx.waitFor(API_MOCK.SIMULATE_ASSERTIONS, REVEAL_MS);
}

export async function ensureAm21WrongExpectation(ctx: DemoActionContext, visible = false): Promise<void> {
  await openAm21Simulate(ctx, visible);
  await ensureAm21HealthResult(ctx, visible);
  await openAm21Assertions(ctx, visible);
  if (hasAm21WrongExpectation()) return;
  if (!firstVisibleElement(API_MOCK.SIMULATE_ASSERT_STATUS)) return;
  if (visible) await am21AimFill(ctx, API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS);
  else await ctx.fill(API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS);
}

export async function ensureAm21ForThreeViews(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await openAm21Simulate(ctx, false);
  if (hasAm21Result()) return;
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am21InputValue(API_MOCK.SIMULATE_PATH) !== AM21_ADHOC_PATH) {
    await ctx.fill(API_MOCK.SIMULATE_PATH, AM21_ADHOC_PATH);
  }
  await ensureAm21Result(ctx, false);
}

export async function ensureAm21ForExpectations(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await openAm21Simulate(ctx, false);
  await ensureAm21HealthResult(ctx, false);
}

export async function ensureAm21ForFailLoudly(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForExpectations(ctx);
  await ensureAm21WrongExpectation(ctx, false);
}

export async function ensureAm21ForRunAll(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForFailLoudly(ctx);
}

export async function ensureAm21ForSeed(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await openAm21Simulate(ctx, false);
  await selectAm21SampleByName(ctx, AM21_DICE_NAME, false);
  await showAm21RequestForm(ctx, false);
}

export async function ensureAm21ForExport(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await openAm21Simulate(ctx, false);
  if (hasAm21Summary() || hasAm21Result()) return;
  await ctx.click(API_MOCK.SIMULATE_RUN_ALL);
  await ctx.waitFor(API_MOCK.SIMULATE_SUMMARY, REVEAL_MS);
}

export async function ensureAm21ForExamples(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await closeAm21Simulate(ctx);
  await ensureAm21StudioView(ctx);
  if (hasAm21Examples()) return;
  if (!firstVisibleElement(API_MOCK.BTAB_EXAMPLES)) return;
  await ctx.click(API_MOCK.BTAB_EXAMPLES);
  await ctx.waitFor(API_MOCK.EXAMPLES_GRID, REVEAL_MS);
}

export async function runAm21SuiteAndScratchpad(ctx: DemoActionContext): Promise<void> {
  await ensureAm21Library(ctx);
  await am21ClickNow(ctx, API_MOCK.SIMULATE, T.panelReady);
  await am21Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
  await am21Look(ctx, API_MOCK.SIMULATE_SECTION_SAVED);
  await am21Look(ctx, API_MOCK.SIMULATE_SECTION_SCRATCH);
  await am21Break(ctx);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am21InputValue(API_MOCK.SIMULATE_PATH) !== AM21_ADHOC_PATH) {
    await am21AimFill(ctx, API_MOCK.SIMULATE_PATH, AM21_ADHOC_PATH);
  } else {
    await am21Look(ctx, API_MOCK.SIMULATE_PATH);
  }
  await reviewAndRunSimulation(ctx, {
    review: T.payoff,
    beforeRun: T.beforeRun,
    sampleName: `GET ${AM21_ADHOC_PATH} — scratch pad`,
  });
  await am21Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  await am21Payoff(ctx, API_MOCK.SIMULATE_OUTCOME);
}

export async function runAm21ThreeViews(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForThreeViews(ctx);
  if (firstVisibleElement(API_MOCK.SIMULATE_VIEW_RESULTS) && !firstVisibleElement(API_MOCK.SIMULATE_TIMELINE_FIRST)) {
    await am21Aim(ctx, API_MOCK.SIMULATE_VIEW_RESULTS, T.tabSwitch);
  }
  await am21Look(ctx, API_MOCK.SIMULATE_TIMELINE_FIRST);
  await am21Break(ctx);
  await am21Aim(ctx, API_MOCK.SIMULATE_TAB_REQUEST, T.tabSwitch);
  await am21Reveal(ctx, API_MOCK.SIMULATE_NORMALIZED, T.payoff);
  await am21Payoff(ctx, API_MOCK.SIMULATE_NORMALIZED);
  await am21Break(ctx);
  await am21Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  await am21Reveal(ctx, API_MOCK.SIMULATE_RENDERED, T.payoff);
  await am21Payoff(ctx, API_MOCK.SIMULATE_RENDERED);
}

export async function runAm21Expectations(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForExpectations(ctx);
  await am21ClickNow(ctx, API_MOCK.SIMULATE_TAB_ASSERTIONS, T.tabSwitch);
  await am21Reveal(ctx, API_MOCK.SIMULATE_ASSERTIONS);
  if (firstVisibleElement(API_MOCK.SIMULATE_ASSERT_HINT)) {
    await am21Look(ctx, API_MOCK.SIMULATE_ASSERT_HINT);
  }
  await am21Look(ctx, API_MOCK.SIMULATE_ASSERT_ROW_STATUS);
  await am21Look(ctx, API_MOCK.SIMULATE_ASSERT_ROW_BODY);
  await am21Break(ctx);
  if (!hasAm21WrongExpectation()) {
    await am21AimFill(ctx, API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS, T.payoff);
  }
  await am21Payoff(ctx, API_MOCK.SIMULATE_ASSERT_STATUS);
}

export async function runAm21FailLoudly(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForFailLoudly(ctx);
  const healthId = resolveAm21SampleId(AM21_HEALTH_NAME);
  if (healthId && !isAm21HealthSelected()) {
    await am21ClickNow(ctx, API_MOCK.simSampleBtn(healthId), T.fieldFilled);
  } else if (healthId) {
    await am21Look(ctx, API_MOCK.simSample(healthId));
  }
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  await am21Reveal(ctx, API_MOCK.SIMULATE_FAIL_BADGE, T.simOutcome);
  await am21Payoff(ctx, API_MOCK.SIMULATE_FAIL_BADGE);
  await am21Break(ctx);
  if (!firstVisibleElement(API_MOCK.SIMULATE_ASSERTIONS)) {
    await am21Aim(ctx, API_MOCK.SIMULATE_TAB_ASSERTIONS, T.tabSwitch);
    await am21Reveal(ctx, API_MOCK.SIMULATE_ASSERTIONS);
  }
  await am21Look(ctx, API_MOCK.SIMULATE_ASSERT_ROW_STATUS);
  await am21Payoff(ctx, API_MOCK.SIMULATE_ASSERT_FAIL);
}

export async function runAm21RunAll(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForRunAll(ctx);
  await am21ClickNow(ctx, API_MOCK.SIMULATE_RUN_ALL, T.fieldFilled);
  await am21Reveal(ctx, API_MOCK.SIMULATE_SUMMARY, T.simOutcome);
  await am21Payoff(ctx, API_MOCK.SIMULATE_SUMMARY);
  await am21Break(ctx);
  if (firstVisibleElement(API_MOCK.SIMULATE_SAMPLE_STATE)) {
    await am21Look(ctx, API_MOCK.SIMULATE_SAMPLE_STATE);
    await am21Payoff(ctx, API_MOCK.SIMULATE_SAMPLE_STATE);
  }
  await am21Payoff(ctx, API_MOCK.SIMULATE_SUMMARY);
}

export async function runAm21Seed(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForSeed(ctx);
  await selectAm21SampleByName(ctx, AM21_DICE_NAME, true);
  await showAm21RequestForm(ctx, true);
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  await am21Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  await am21Payoff(ctx, API_MOCK.SIMULATE_RENDERED);
  const firstBody = am21RenderedBody();
  await am21Break(ctx);
  await showAm21RequestForm(ctx, true);
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  await am21Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  if (firstBody) await am21Look(ctx, API_MOCK.SIMULATE_RENDERED);
  await am21Payoff(ctx, API_MOCK.SIMULATE_OUTCOME);
}

export async function runAm21ExportTrace(ctx: DemoActionContext): Promise<void> {
  await ensureAm21ForExport(ctx);
  await am21ClickNow(ctx, API_MOCK.SIMULATE_EXPORT, T.fieldFilled);
  await am21Reveal(ctx, API_MOCK.SIMULATE_EXPORT_CONFIRM, T.payoff);
  await am21Look(ctx, API_MOCK.SIMULATE_EXPORT_PREVIEW);
  await am21Payoff(ctx, API_MOCK.SIMULATE_EXPORT_CONFIRM);
}

export async function runAm21Examples(ctx: DemoActionContext): Promise<void> {
  const E = AM21_EXAMPLES_TIMING;
  await ensureAm21ForExamples(ctx);
  await am21ClickNow(ctx, API_MOCK.BTAB_EXAMPLES, E.tabSwitch);
  await am21Reveal(ctx, API_MOCK.EXAMPLES_GRID, E.payoff);
  let orphanId = resolveAm21ExampleId(AM21_ORPHAN_NAME);
  if (orphanId && hasAm21Attach()) {
    await clickBeat(ctx, API_MOCK.exampleAttach(orphanId), { look: E.beforeOpen, hold: E.hold });
    await spotlightBeat(ctx, API_MOCK.exampleRow(orphanId), E.payoff);
    if (firstVisibleElement(API_MOCK.exampleStatus(orphanId))) {
      await spotlightBeat(ctx, API_MOCK.exampleStatus(orphanId), E.look);
    }
    if (firstVisibleElement(API_MOCK.exampleBody(orphanId))) {
      await spotlightBeat(ctx, API_MOCK.exampleBody(orphanId), E.look);
    }
  }
  await ctx.delay(E.break);
  const tryBtn = orphanId && firstVisibleElement(API_MOCK.exampleTry(orphanId))
    ? API_MOCK.exampleTry(orphanId)
    : API_MOCK.EXAMPLE_TRY_REQUESTS;
  if (firstVisibleElement(tryBtn)) {
    await clickBeat(ctx, tryBtn, { look: E.beforeOpen, hold: E.hold });
    await am21Reveal(ctx, REQ.URL_INPUT, E.payoff);
    await spotlightBeat(ctx, REQ.URL_INPUT, E.payoff);
  }
  await ensureAm21OnApiMock(ctx);
  await ensureAm21StudioView(ctx);
  if (firstVisibleElement(API_MOCK.CLI_SIMULATE)) {
    await spotlightBeat(ctx, API_MOCK.CLI_SIMULATE, E.look);
    await spotlightBeat(ctx, API_MOCK.CLI_SIMULATE, E.payoff);
  }
  if (!hasAm21Examples() && firstVisibleElement(API_MOCK.BTAB_EXAMPLES)) {
    await clickBeat(ctx, API_MOCK.BTAB_EXAMPLES, { look: E.beforeOpen, hold: E.tabSwitch });
    await am21Reveal(ctx, API_MOCK.EXAMPLES_GRID, E.payoff);
  }
  orphanId = resolveAm21ExampleId(AM21_ORPHAN_NAME) ?? orphanId;
  if (orphanId) await spotlightBeat(ctx, API_MOCK.exampleRow(orphanId), E.payoff);
}
