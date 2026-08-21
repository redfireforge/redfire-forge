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
  deleteCollectionsByName,
} from '../../adapters';
import { API_MOCK, REQ } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  openApiMockFromActivityBar,
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
  deleteCollectionsByName('API Mock Journal');
  await wipeApiMockWorkspace();
}

export async function ensureAm21OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm21Server() || firstVisibleElement(API_MOCK.STUDIO) || isAm21SimulateOpen()) {
    return;
  }
  if (await openApiMockFromActivityBar(ctx)) return;
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

  // Beat 1 — close Simulate, go to Studio, select the /dice route, open Response tab.
  // Shows the viewer *why* the roll is pinned: a weighted route with two variants.
  await closeAm21Simulate(ctx);
  await ensureAm21StudioView(ctx);
  const diceRouteSel = API_MOCK.routeNamed('Dice');
  if (firstVisibleElement(diceRouteSel) ?? document.querySelector(diceRouteSel)) {
    await am21Aim(ctx, diceRouteSel, T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.BTAB_RESPONSE) ?? document.querySelector(API_MOCK.BTAB_RESPONSE)) {
    await am21ClickNow(ctx, API_MOCK.BTAB_RESPONSE, T.tabSwitch);
  }
  // Image 1 — Weighted mode: Heads (Default) + Tails variant list
  if (firstVisibleElement(API_MOCK.VARIANT_SIDEBAR)) {
    await am21Payoff(ctx, API_MOCK.VARIANT_SIDEBAR);
  }

  // Beat 2 — click the Tails variant → switch to Selection tab → spotlight Weight 50.
  // This is Image 2: shows the probability weight that makes Tails a 50 % flip.
  if (firstVisibleElement(API_MOCK.VARIANT_CARD_LAST)) {
    await am21Aim(ctx, API_MOCK.VARIANT_CARD_LAST, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_SELECTION) ?? document.querySelector(API_MOCK.RESPONSE_TAB_SELECTION)) {
    await am21ClickNow(ctx, API_MOCK.RESPONSE_TAB_SELECTION, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.VARIANT_WEIGHT)) {
    await am21Payoff(ctx, API_MOCK.VARIANT_WEIGHT);
  }
  await am21Break(ctx);

  // Beat 3 onwards — open Simulate visibly, run dice twice to prove same seed.
  await openAm21Simulate(ctx, true);
  await selectAm21SampleByName(ctx, AM21_DICE_NAME, true);
  await showAm21RequestForm(ctx, true);

  // Run 1 — click Run, switch to Rendered response tab, spotlight the body.
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  await am21Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED) ?? document.querySelector(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am21ClickNow(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  await am21Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  const firstBody = am21RenderedBody();
  await am21Break(ctx);

  // Run 2 — same sample, same seed → same body; viewer sees matching dice face.
  await showAm21RequestForm(ctx, true);
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.beforeRun, hold: 0 });
  await am21Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED) ?? document.querySelector(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am21ClickNow(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  if (firstBody) await am21Look(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
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
  // Use standard T timings (not E) — E values (1600–2400 ms each) make this
  // dense step exceed the 45 s action timeout.
  await ensureAm21ForExamples(ctx);

  // Beat 1 — ring Examples tab → open → hold on grid.
  await clickBeat(ctx, API_MOCK.BTAB_EXAMPLES, { look: T.beforeOpen, hold: T.tabSwitch });
  await am21Reveal(ctx, API_MOCK.EXAMPLES_GRID, T.payoff);

  // Beat 2 — ring the orphan row ("Unassociated" chip) → ring + click Attach.
  let orphanId = resolveAm21ExampleId(AM21_ORPHAN_NAME);
  if (orphanId) {
    await spotlightBeat(ctx, API_MOCK.exampleRow(orphanId), T.look);
    if (hasAm21Attach()) {
      await clickBeat(ctx, API_MOCK.exampleAttach(orphanId), { look: T.beforeOpen, hold: T.panelReady });
      await ctx.delay(T.tabSwitch);
    }
    // Beat 3 — ring attached row, then one field to show the assertion snapshot.
    if (firstVisibleElement(API_MOCK.exampleRow(orphanId))) {
      await spotlightBeat(ctx, API_MOCK.exampleRow(orphanId), T.look);
    }
    if (firstVisibleElement(API_MOCK.exampleStatus(orphanId))) {
      await spotlightBeat(ctx, API_MOCK.exampleStatus(orphanId), T.look);
    }
  }
  await ctx.delay(T.groupBreak);

  // Beat 4 — ring Start → click → wait for Running (8 s max).
  const alreadyRunning = (firstVisibleElement(API_MOCK.STATUS_LABEL)?.textContent ?? '').toLowerCase().includes('running');
  if (!alreadyRunning && (firstVisibleElement(API_MOCK.START) ?? document.querySelector(API_MOCK.START))) {
    await spotlightBeat(ctx, API_MOCK.START, T.look);
    await clickBeat(ctx, API_MOCK.START, { look: T.beforeOpen, hold: 0 });
    await ctx.waitFor(API_MOCK.STOP, 8_000).catch(() => undefined);
    await ctx.delay(T.tabSwitch);
  }

  // Beat 5 — ring Try in Requests → click → hold on URL input.
  const tryBtn = orphanId && firstVisibleElement(API_MOCK.exampleTry(orphanId))
    ? API_MOCK.exampleTry(orphanId)
    : API_MOCK.EXAMPLE_TRY_REQUESTS;
  if (firstVisibleElement(tryBtn)) {
    await spotlightBeat(ctx, tryBtn, T.look);
    await clickBeat(ctx, tryBtn, { look: T.beforeOpen, hold: T.panelReady });
    await am21Reveal(ctx, REQ.URL_INPUT, T.tabSwitch);
    await spotlightBeat(ctx, REQ.URL_INPUT, T.payoff);
  }

  // Beat 6 — ring Send → click → ring status badge → ring response body.
  if (firstVisibleElement(REQ.SEND_BTN)) {
    await clickBeat(ctx, REQ.SEND_BTN, { look: T.beforeOpen, hold: 0 });
    await ctx.waitFor(REQ.STATUS_PILL, 6_000).catch(() => undefined);
    await ctx.delay(T.tabSwitch);
    if (firstVisibleElement(REQ.STATUS_PILL)) await spotlightBeat(ctx, REQ.STATUS_PILL, T.look);
    if (firstVisibleElement(REQ.JSON_PREVIEW)) await spotlightBeat(ctx, REQ.JSON_PREVIEW, T.payoff);
  }

  // Beat 7 — return to Studio → ring + click Stop.
  await ensureAm21OnApiMock(ctx);
  await ensureAm21StudioView(ctx);
  if (firstVisibleElement(API_MOCK.STOP) ?? document.querySelector(API_MOCK.STOP)) {
    await spotlightBeat(ctx, API_MOCK.STOP, T.look);
    await clickBeat(ctx, API_MOCK.STOP, { look: T.beforeOpen, hold: T.tabSwitch });
  }

  // Beat 8 — payoff: Examples tab → ring attached example row.
  if (firstVisibleElement(API_MOCK.CLI_SIMULATE)) {
    await spotlightBeat(ctx, API_MOCK.CLI_SIMULATE, T.payoff);
  }
  if (!hasAm21Examples() && firstVisibleElement(API_MOCK.BTAB_EXAMPLES)) {
    await clickBeat(ctx, API_MOCK.BTAB_EXAMPLES, { look: T.beforeOpen, hold: T.tabSwitch });
    await am21Reveal(ctx, API_MOCK.EXAMPLES_GRID, T.payoff);
  }
  orphanId = resolveAm21ExampleId(AM21_ORPHAN_NAME) ?? orphanId;
  if (orphanId) await spotlightBeat(ctx, API_MOCK.exampleRow(orphanId), T.payoff);
}
