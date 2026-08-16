/**
 * AM-13 `am-13-stateful` helpers — Stateful Mocks: A Cart That Remembers.
 *
 * Quiet corpus is `POST /cart` with two bodies and no state wiring. Mode, transitions,
 * counters, weights, seed, and the sensitive variable are authored in the UI. The
 * listener is started quietly so Apply in the first-call step is a hot-swap.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  reviewAndRunSimulation,
  closeSimulateWorkspace,
  selectBeat,
  spotlightBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

/**
 * Same slower holds as AM-10…AM-12, plus Simulate review/run holds from AM-06.
 */
export const AM13_TIMING = {
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
} as const;

const T = AM13_TIMING;

/** Two Simulate runs — leave ~10s for live ripple + CustomSelect under the 45s Acting cap. */
const AM13_WEIGHTED = {
  look: 400,
  hold: 500,
  weightHold: 750,
  payoff: 1100,
  beforeOpen: 700,
  beforeRun: 1600,
  groupBreak: 500,
} as const;

export const AM13_CORPUS_SAMPLE = 'am-gallery-checkout';
export const AM13_PATH = '/cart';
export const AM13_METHOD = 'POST';
export const AM13_VARIANT_2_NAME = 'Has items';
export const AM13_EMPTY = 'EMPTY';
export const AM13_HAS_ITEMS = 'HAS_ITEMS';
export const AM13_CHECKED_OUT = 'CHECKED_OUT';
export const AM13_COUNTER_KEY = 'items';
export const AM13_EMPTY_BODY = '{"ok":true,"items":[]}';
export const AM13_HAS_ITEMS_BODY = '{"ok":true,"items":[{"sku":"RF-100"}]}';
export const AM13_CONTENT_JSON = 'application/json';
export const AM13_WEIGHT_A = '90';
export const AM13_WEIGHT_B = '10';
export const AM13_VAR_KEY = 'tenant';
export const AM13_VAR_VALUE = 'acme';

export const AM13_EMPTY_TRANSITION = {
  currentState: AM13_EMPTY,
  targetState: AM13_HAS_ITEMS,
  counterUpdates: [{ key: AM13_COUNTER_KEY, delta: 1 }],
};

export const AM13_HAS_ITEMS_TRANSITION = {
  currentState: AM13_HAS_ITEMS,
  targetState: AM13_CHECKED_OUT,
};

async function am13Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am13Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am13Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am13Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout: 8_000 });
}

async function am13Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am13Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am13Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm13Workspace(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm13RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm13StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm13ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am13VariantCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.VARIANT_CARD));
}

export function am13VariantCount(): number {
  return am13VariantCards().length;
}

export function am13HasTwoVariants(): boolean {
  return am13VariantCount() >= 2;
}

export function isAm13StateMode(): boolean {
  return firstVisibleElement(API_MOCK.RESPONSE_MODE_STATE)?.getAttribute('aria-pressed') === 'true';
}

export function isAm13WeightedMode(): boolean {
  return firstVisibleElement(API_MOCK.RESPONSE_MODE_WEIGHTED)?.getAttribute('aria-pressed') === 'true';
}

export function am13RequiredState(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_REQUIRED_STATE)?.value?.trim() ?? '';
}

export function am13NextState(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_NEXT_STATE)?.value?.trim() ?? '';
}

export function am13HasCounter(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.COUNTER_ROW) ?? document.querySelector(API_MOCK.COUNTER_ROW));
}

export function am13HasEmptyTransition(): boolean {
  return am13RequiredState() === AM13_EMPTY && am13NextState() === AM13_HAS_ITEMS && am13HasCounter();
}

export function isAm13SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function am13SimMethod(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_METHOD)?.getAttribute('data-value') ?? '';
}

export function am13SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am13HasLiveState(): boolean {
  const live = firstVisibleElement(API_MOCK.DOCK_STATE_LIVE)
    ?? document.querySelector<HTMLElement>(API_MOCK.DOCK_STATE_LIVE);
  const text = live?.textContent ?? '';
  return /HAS_ITEMS|items/i.test(text);
}

export function hasAm13Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

export function am13HasTenantVariable(): boolean {
  const rows = document.querySelectorAll<HTMLElement>(API_MOCK.VAR_ROW);
  return Array.from(rows).some(row => (row.textContent ?? '').includes(AM13_VAR_KEY)
    || row.querySelector<HTMLInputElement>('input')?.value === AM13_VAR_KEY);
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

function seedSecondVariant(): void {
  patchApiMockActiveRoute({
    addVariant: true,
    variantName: AM13_VARIANT_2_NAME,
    body: AM13_HAS_ITEMS_BODY,
    contentType: AM13_CONTENT_JSON,
    isDefault: false,
  });
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm13Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM13_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-13: failed to import ${AM13_CORPUS_SAMPLE}`);
  }
  seedSecondVariant();
  prepareApiMockStudioChrome();
}

export async function cleanupAm13(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm13StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm13StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function closeAm13Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm13SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 400 });
}

export async function ensureAm13Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm13StudioView(ctx);
  await closeAm13Simulate(ctx);
  if (!hasAm13Workspace()) {
    const imported = await importApiMockGallerySample(AM13_CORPUS_SAMPLE);
    if (!imported) {
      throw new Error(`AM-13: failed to import ${AM13_CORPUS_SAMPLE}`);
    }
    await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
  }
  await ensureAm13RuleOpen(ctx);
  await ensureAm13ResponseTab(ctx);
  await ensureAm13TwoVariants(ctx);
  await ensureAm13Running(ctx);
}

export async function ensureAm13RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm13StudioView(ctx);
  if (hasAm13RouteEditor()) return;
  const row = firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.FIRST_ROUTE);
  if (!row) return;
  await ctx.click(API_MOCK.ROUTE_ROW);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

export async function ensureAm13ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm13RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_BAR) ?? firstVisibleElement(API_MOCK.ADD_VARIANT)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.waitFor(API_MOCK.RESPONSE_EDITOR, 6_000);
}

export async function ensureAm13SelectionTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm13ResponseTab(ctx);
  if (firstVisibleElement(API_MOCK.SELECTION_PANEL)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_SELECTION)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_SELECTION);
  await ctx.waitFor(API_MOCK.SELECTION_PANEL, 6_000);
}

export async function ensureAm13Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm13StudioView(ctx);
  if (isAm13ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm13TwoVariants(ctx: DemoActionContext): Promise<void> {
  await ensureAm13ResponseTab(ctx);
  if (am13HasTwoVariants()) return;
  seedSecondVariant();
  await ctx.waitFor(API_MOCK.VARIANT_CARD_LAST, 6_000);
}

export async function ensureAm13StateMode(ctx: DemoActionContext): Promise<void> {
  await ensureAm13Workspace(ctx);
  if (isAm13StateMode()) return;
  patchApiMockActiveRoute({ responseMode: 'state' });
}

export async function ensureAm13Transition(ctx: DemoActionContext): Promise<void> {
  await ensureAm13StateMode(ctx);
  await ensureAm13SelectionTab(ctx);
  if (am13HasEmptyTransition()) return;
  patchApiMockActiveRoute({
    variantIndex: 0,
    transition: AM13_EMPTY_TRANSITION,
  });
}

export async function ensureAm13SecondVariant(ctx: DemoActionContext): Promise<void> {
  await ensureAm13Transition(ctx);
  patchApiMockActiveRoute({
    variantIndex: 1,
    variantName: AM13_VARIANT_2_NAME,
    body: AM13_HAS_ITEMS_BODY,
    contentType: AM13_CONTENT_JSON,
    isDefault: false,
    transition: AM13_HAS_ITEMS_TRANSITION,
  });
}

export async function ensureAm13ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm13SecondVariant(ctx);
  await ensureAm13Running(ctx);
}

export async function sendAm13ProveRequest(): Promise<{ status: number; body: string } | null> {
  return sendApiMockRequest({
    path: AM13_PATH,
    method: AM13_METHOD,
    body: '{}',
  });
}

export async function ensureAm13FirstCall(ctx: DemoActionContext): Promise<void> {
  await ensureAm13ForApply(ctx);
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await ctx.click(API_MOCK.APPLY);
    await ctx.delay(400);
  }
  if (!hasAm13Traffic()) {
    await sendAm13ProveRequest();
    await ctx.delay(400);
  }
}

/**
 * State lives on the Runtime dock, not the Studio live strip. Stay off Studio
 * once this runs — otherwise Acting rings a tab that is not in the DOM.
 */
async function openAm13RuntimeState(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const stateOpen = firstVisibleElement(API_MOCK.DOCK_STATE)
    && firstVisibleElement(API_MOCK.DOCK_TAB_STATE)?.getAttribute('aria-selected') === 'true';
  if (stateOpen) return;

  if (!firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    const runtimeSel = firstVisibleElement(API_MOCK.VIEW_RUNTIME)
      ? API_MOCK.VIEW_RUNTIME
      : firstVisibleElement(API_MOCK.OPEN_RUNTIME)
        ? API_MOCK.OPEN_RUNTIME
        : null;
    if (!runtimeSel) return;
    if (visible) await am13Aim(ctx, runtimeSel, T.tabSwitch);
    else await ctx.click(runtimeSel);
    if (!visible) await ctx.delay(200);
  }

  const tab = firstVisibleElement(API_MOCK.DOCK_TAB_STATE);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    if (visible) await am13Aim(ctx, API_MOCK.DOCK_TAB_STATE, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_STATE);
  }
}

export async function ensureAm13StateLive(ctx: DemoActionContext): Promise<void> {
  await ensureAm13FirstCall(ctx);
  await openAm13RuntimeState(ctx, false);
}

export async function ensureAm13ForWeighted(ctx: DemoActionContext): Promise<void> {
  await ensureAm13FirstCall(ctx);
  await closeAm13Simulate(ctx);
}

export async function ensureAm13Weighted(ctx: DemoActionContext): Promise<void> {
  await ensureAm13Workspace(ctx);
  await closeAm13Simulate(ctx);
  if (isAm13WeightedMode()) return;
  patchApiMockActiveRoute({ responseMode: 'weighted' });
  patchApiMockActiveRoute({ variantIndex: 0, weight: 90 });
  patchApiMockActiveRoute({ variantIndex: 1, weight: 10 });
}

export async function ensureAm13JournalOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm13ForApply(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;
  if (!firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS) && !firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    return;
  }
  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  }
  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
  }
}

async function openAm13Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm13SimulateOpen()) return;
  await am13Aim(ctx, API_MOCK.SIMULATE);
  await am13Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const newest = journalRows()[0];
  if (newest) await ctx.click(`[data-testid="${newest.getAttribute('data-testid')}"]`);
}

async function selectAm13Card(ctx: DemoActionContext, which: 'first' | 'last'): Promise<void> {
  const selector = which === 'first' ? API_MOCK.VARIANT_CARD_FIRST : API_MOCK.VARIANT_CARD_LAST;
  if (!firstVisibleElement(selector)) return;
  await am13Click(ctx, selector, 0);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — two static cards, then State so the mock can remember. */
export async function runAm13WhyState(ctx: DemoActionContext): Promise<void> {
  await ensureAm13ResponseTab(ctx);
  await am13Look(ctx, API_MOCK.VARIANT_CARD_FIRST);
  await am13Payoff(ctx, API_MOCK.VARIANT_CARD_LAST);
  await am13Break(ctx);
  await am13Aim(ctx, API_MOCK.RESPONSE_MODE_STATE);
  patchApiMockActiveRoute({ responseMode: 'state' });
  await ensureAm13SelectionTab(ctx);
  await am13Reveal(ctx, API_MOCK.VARIANT_REQUIRED_STATE);
  await am13Payoff(ctx, API_MOCK.VARIANT_NEXT_STATE);
}

/** Step 2 — EMPTY → HAS_ITEMS plus items += 1. */
export async function runAm13Transition(ctx: DemoActionContext): Promise<void> {
  await ensureAm13StateMode(ctx);
  await selectAm13Card(ctx, 'first');
  await ensureAm13SelectionTab(ctx);
  await am13Reveal(ctx, API_MOCK.VARIANT_REQUIRED_STATE);
  await am13Fill(ctx, API_MOCK.VARIANT_REQUIRED_STATE, AM13_EMPTY);
  await am13Fill(ctx, API_MOCK.VARIANT_NEXT_STATE, AM13_HAS_ITEMS);
  await am13Break(ctx);
  if (!am13HasCounter() && firstVisibleElement(API_MOCK.COUNTER_ADD)) {
    await am13Aim(ctx, API_MOCK.COUNTER_ADD);
    await am13Reveal(ctx, API_MOCK.COUNTER_ROW);
  }
  if (firstVisibleElement(API_MOCK.COUNTER_KEY)) {
    await am13Fill(ctx, API_MOCK.COUNTER_KEY, AM13_COUNTER_KEY);
  }
  patchApiMockActiveRoute({
    variantIndex: 0,
    transition: AM13_EMPTY_TRANSITION,
  });
  await am13Payoff(ctx, API_MOCK.COUNTER_ROW);
}

/** Step 3 — Has items may speak only after the first hop. */
export async function runAm13SecondVariant(ctx: DemoActionContext): Promise<void> {
  await ensureAm13Transition(ctx);
  await selectAm13Card(ctx, 'last');
  await ensureAm13SelectionTab(ctx);
  await am13Fill(ctx, API_MOCK.VARIANT_REQUIRED_STATE, AM13_HAS_ITEMS);
  await am13Fill(ctx, API_MOCK.VARIANT_NEXT_STATE, AM13_CHECKED_OUT);
  patchApiMockActiveRoute({
    variantIndex: 1,
    variantName: AM13_VARIANT_2_NAME,
    body: AM13_HAS_ITEMS_BODY,
    contentType: AM13_CONTENT_JSON,
    isDefault: false,
    transition: AM13_HAS_ITEMS_TRANSITION,
  });
  await am13Break(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_CONTENT)) {
    await am13Aim(ctx, API_MOCK.RESPONSE_TAB_CONTENT, T.tabSwitch);
  }
  const bodySel = firstVisibleElement(API_MOCK.PREVIEW_BODY)
    ? API_MOCK.PREVIEW_BODY
    : API_MOCK.VARIANT_BODY;
  await am13Reveal(ctx, bodySel);
  await am13Payoff(ctx, bodySel);
}

/** Step 4 — Apply, then one live POST /cart (empty cart). */
export async function runAm13FirstCall(ctx: DemoActionContext): Promise<void> {
  await ensureAm13StudioView(ctx);
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am13Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am13Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
  await am13Look(ctx, API_MOCK.GENERATION);

  await sendAm13ProveRequest();
  await ctx.delay(T.journalWrite);
  await am13Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  await am13Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  await am13Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  await clickNewestJournalRow(ctx);
  await am13Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  if (firstVisibleElement(API_MOCK.TX_RESPONSE)) {
    await am13Payoff(ctx, API_MOCK.TX_RESPONSE);
  }
}

/** Step 5 — State tab live, then the second POST (SKU). */
export async function runAm13StateLive(ctx: DemoActionContext): Promise<void> {
  await closeAm13Simulate(ctx);
  if (!hasAm13Traffic()) {
    await sendAm13ProveRequest();
    await ctx.delay(T.journalWrite);
  }
  await openAm13RuntimeState(ctx, true);
  if (firstVisibleElement(API_MOCK.DOCK_STATE) || firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    await am13Reveal(ctx, API_MOCK.DOCK_STATE);
  }
  if (firstVisibleElement(API_MOCK.DOCK_STATE_LIVE) ?? document.querySelector(API_MOCK.DOCK_STATE_LIVE)) {
    await am13Payoff(ctx, API_MOCK.DOCK_STATE_LIVE);
  }
  await am13Break(ctx);

  await sendAm13ProveRequest();
  await ctx.delay(T.journalWrite);
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)
    && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)?.getAttribute('aria-selected') !== 'true') {
    await am13Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
  }
  await clickNewestJournalRow(ctx);
  if (firstVisibleElement(API_MOCK.TX_DETAIL) || document.querySelector(API_MOCK.TX_DETAIL)) {
    await am13Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TX_RESPONSE)) {
    await am13Payoff(ctx, API_MOCK.TX_RESPONSE);
  } else if (firstVisibleElement(API_MOCK.TX_DETAIL)) {
    await am13Payoff(ctx, API_MOCK.TX_DETAIL);
  }
}

/** Step 6 — rewind between tests without restarting. */
export async function runAm13ResetAndBatch(ctx: DemoActionContext): Promise<void> {
  await closeAm13Simulate(ctx);
  await openAm13RuntimeState(ctx, true);
  if (firstVisibleElement(API_MOCK.DOCK_STATE) || firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    await am13Reveal(ctx, API_MOCK.DOCK_STATE);
  }
  if (firstVisibleElement(API_MOCK.STATE_RESET)) {
    await am13Aim(ctx, API_MOCK.STATE_RESET);
  }
  if (firstVisibleElement(API_MOCK.DOCK_STATE_LIVE) ?? document.querySelector(API_MOCK.DOCK_STATE_LIVE)) {
    await am13Payoff(ctx, API_MOCK.DOCK_STATE_LIVE);
  }
  await am13Break(ctx);

  await ensureAm13StudioView(ctx);
  await openAm13Simulate(ctx);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am13SimMethod() !== AM13_METHOD && firstVisibleElement(API_MOCK.SIMULATE_METHOD)) {
    await selectBeat(ctx, API_MOCK.SIMULATE_METHOD, AM13_METHOD, { look: T.beforeOpen, hold: T.fieldFilled });
  }
  await am13Fill(ctx, API_MOCK.SIMULATE_PATH, AM13_PATH);
  await clickBeat(ctx, API_MOCK.SIMULATE_RUN_ALL, { look: T.beforeRun, hold: 0 });
  await am13Reveal(ctx, API_MOCK.SIMULATE_SAMPLE_STATE, T.simOutcome);
  await am13Payoff(ctx, API_MOCK.SIMULATE_SAMPLE_STATE);
  await closeAm13Simulate(ctx, { review: true });
}

async function holdAm13SimulateVerdict(ctx: DemoActionContext): Promise<void> {
  await revealBeat(ctx, API_MOCK.SIMULATE_RESULT, { timeout: 4_000, hold: AM13_WEIGHTED.hold });
  const statusSel = firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)
    ? API_MOCK.SIMULATE_RENDERED_STATUS
    : firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)
      ? API_MOCK.SIMULATE_OUTCOME
      : API_MOCK.SIMULATE_RESULT;
  await spotlightBeat(ctx, statusSel, AM13_WEIGHTED.payoff);
}

async function runAm13WeightedSimulation(
  ctx: DemoActionContext,
  sampleName: string,
  opts: { saveSample?: boolean } = {},
): Promise<void> {
  await ensureAdHocSimulateForm(ctx, AM13_WEIGHTED.hold);
  await reviewAndRunSimulation(ctx, {
    review: AM13_WEIGHTED.look,
    beforeRun: AM13_WEIGHTED.beforeRun,
    sampleName,
    saveSample: opts.saveSample,
    reviewFields: false,
    digest: false,
  });
  await holdAm13SimulateVerdict(ctx);
}

/** Step 7 — Weighted 90/10, two identical Simulate runs. */
export async function runAm13WeightedAndSeed(ctx: DemoActionContext): Promise<void> {
  await closeAm13Simulate(ctx);
  await ensureAm13StudioView(ctx);
  await ensureAm13ResponseTab(ctx);
  await clickBeat(ctx, API_MOCK.RESPONSE_MODE_WEIGHTED, { look: AM13_WEIGHTED.beforeOpen, hold: 0 });
  patchApiMockActiveRoute({ responseMode: 'weighted' });
  await ensureAm13SelectionTab(ctx);
  await selectAm13Card(ctx, 'first');
  await revealBeat(ctx, API_MOCK.VARIANT_WEIGHT, { timeout: 4_000, hold: AM13_WEIGHTED.hold });
  await fillBeat(ctx, API_MOCK.VARIANT_WEIGHT, AM13_WEIGHT_A, {
    look: AM13_WEIGHTED.look,
    hold: AM13_WEIGHTED.weightHold,
  });
  patchApiMockActiveRoute({ variantIndex: 0, weight: 90 });
  await ctx.delay(AM13_WEIGHTED.groupBreak);
  await selectAm13Card(ctx, 'last');
  await fillBeat(ctx, API_MOCK.VARIANT_WEIGHT, AM13_WEIGHT_B, {
    look: AM13_WEIGHTED.look,
    hold: AM13_WEIGHTED.weightHold,
  });
  patchApiMockActiveRoute({ variantIndex: 1, weight: 10 });
  await spotlightBeat(ctx, API_MOCK.VARIANT_WEIGHT, AM13_WEIGHTED.payoff);

  if (!isAm13SimulateOpen()) {
    await clickBeat(ctx, API_MOCK.SIMULATE, { look: AM13_WEIGHTED.beforeOpen, hold: 0 });
    await revealBeat(ctx, API_MOCK.SIMULATE_WORKSPACE, { timeout: 4_000, hold: AM13_WEIGHTED.hold });
  }
  if (am13SimMethod() !== AM13_METHOD && firstVisibleElement(API_MOCK.SIMULATE_METHOD)) {
    await selectBeat(ctx, API_MOCK.SIMULATE_METHOD, AM13_METHOD, {
      look: AM13_WEIGHTED.look,
      hold: AM13_WEIGHTED.hold,
    });
  }
  await fillBeat(ctx, API_MOCK.SIMULATE_PATH, AM13_PATH, {
    look: AM13_WEIGHTED.look,
    hold: AM13_WEIGHTED.hold,
  });
  await runAm13WeightedSimulation(ctx, `POST ${AM13_PATH} — seed-a`);
  await ctx.delay(AM13_WEIGHTED.groupBreak);
  await runAm13WeightedSimulation(ctx, `POST ${AM13_PATH} — seed-b`, { saveSample: false });
  await closeAm13Simulate(ctx);
}

/** Step 8 — tenant=acme, then Sensitive. */
export async function runAm13Variables(ctx: DemoActionContext): Promise<void> {
  await closeAm13Simulate(ctx);
  await ensureAm13StudioView(ctx);
  if (firstVisibleElement(API_MOCK.LIVE_VARIABLES)) {
    await am13Aim(ctx, API_MOCK.LIVE_VARIABLES, 0);
  }
  await am13Reveal(ctx, API_MOCK.DOCK_VARIABLES);
  if (firstVisibleElement(API_MOCK.DOCK_TAB_VARIABLES)
    && firstVisibleElement(API_MOCK.DOCK_TAB_VARIABLES)?.getAttribute('aria-selected') !== 'true') {
    await am13Aim(ctx, API_MOCK.DOCK_TAB_VARIABLES, T.tabSwitch);
  }
  if (am13HasTenantVariable()) {
    await am13Payoff(ctx, API_MOCK.VAR_ROW);
    return;
  }
  await am13Aim(ctx, API_MOCK.VAR_ADD);
  await am13Reveal(ctx, API_MOCK.VAR_KEY_LAST);
  await am13Fill(ctx, API_MOCK.VAR_KEY_LAST, AM13_VAR_KEY);
  await am13Fill(ctx, API_MOCK.VAR_VALUE_LAST, AM13_VAR_VALUE);
  if (firstVisibleElement(API_MOCK.VAR_SENSITIVE_LAST)) {
    await am13Aim(ctx, API_MOCK.VAR_SENSITIVE_LAST);
  }
  await am13Payoff(ctx, API_MOCK.VAR_VALUE_LAST);
}
