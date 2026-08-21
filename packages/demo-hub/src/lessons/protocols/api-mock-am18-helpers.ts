/**
 * AM-18 `am-18-journal` helpers — Journal Forensics: Near-Misses, Candidates & Promotion.
 *
 * Quiet corpus is the compact storefront (6 rules), started. Live traffic (including the
 * `/produts/42` typo), closest-match, and every promotion action are authored
 * in the UI. Companion required — Start + live fetch is the proof.
 */
import {
  clearApiMockServerSamples,
  deleteCollectionsByName,
  importApiMockGallerySample,
  patchApiMockServerSettings,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, REQ } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  closeSimulateWorkspace,
  openApiMockFromActivityBar,
  reviewAndRunSimulation,
  revealBeat,
  spotlightBeat,
  spotlightElementBeat,
} from './api-mock-demo-helpers';

export const AM18_TIMING = {
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

/** End steps (copy/export/clear + prove) — keep Acting brisk; earlier steps stay full pace. */
export const AM18_END_TIMING = {
  look: 450,
  hold: 650,
  clearLook: 1800,
  clearHold: 1200,
  break: 500,
  payoff: 850,
  beforeRun: 800,
  simOutcome: 1000,
} as const;

const T = AM18_TIMING;
const TE = AM18_END_TIMING;
const REVEAL_MS = 8_000;

export const AM18_CORPUS_SAMPLE = 'am-gallery-store-lite';
export const AM18_MATCH_LIST = '/products';
export const AM18_MATCH_ITEM = '/products/42';
export const AM18_MISS_PATH = '/produts/42';
export const AM18_FILTER = 'products';
export const AM18_FILTER_MISS = 'zzzz-no-such-path';

async function am18Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a *new* tab or modal trigger — never the step's reading highlight. */
async function am18Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

/** Click without a second ring — reading already spotlighted this control. */
async function am18ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

/** Fill without a second ring — reading already spotlighted this field. */
async function am18FillNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.fill(selector, value);
  await ctx.delay(hold);
}

async function am18SelectNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await ctx.selectOption(selector, value);
  await ctx.delay(hold);
}

async function am18Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am18Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am18Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am18Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function isAm18StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm18RuntimeViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.RUNTIME_PAGE) ?? firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS));
}

export function hasAm18Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm18Library(): boolean {
  if (firstVisibleElement(API_MOCK.ROUTE_ROW)) return true;
  // Runtime unmounts the explorer — a bound server bar means the corpus is loaded.
  return hasAm18Server() && isAm18RuntimeViewActive();
}

export function isAm18ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function hasAm18Traffic(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function isAm18JournalEmpty(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return false;
  return Boolean(
    firstVisibleElement(API_MOCK.JOURNAL_EMPTY)
    ?? firstVisibleElement(API_MOCK.RUNTIME_GUIDE),
  );
}

export function isAm18FilterEmptyState(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FILTER_EMPTY));
}

export function am18FilterValue(): string {
  const el = firstVisibleElement<HTMLInputElement>(API_MOCK.JOURNAL_FILTER);
  return typeof el?.value === 'string' ? el.value : '';
}

export function am18TxOutcome(): string {
  return firstVisibleElement(API_MOCK.TX_OUTCOME)?.textContent?.trim().toLowerCase() ?? '';
}

export function am18PathInputValue(): string {
  const el = firstVisibleElement<HTMLInputElement>(API_MOCK.PATH_INPUT);
  return typeof el?.value === 'string' ? el.value : '';
}

export function hasAm18CreatedRoute(): boolean {
  if (am18PathInputValue().includes(AM18_MISS_PATH)) return true;
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_PATH))
    .some(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
}

export function hasAm18NearMisses(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.TX_NEAR_MISSES));
}

/** Each near-miss row (`List Products`, `Get Product by ID`, …) so the ring can land on one at a time. */
export function am18NearMissItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.TX_NEAR_MISS_ITEM));
}

export function hasAm18Example(): boolean {
  if (am18ExampleSavedFlag) return true;
  return Boolean(firstVisibleElement(API_MOCK.EXAMPLES_GRID) ?? firstVisibleElement(API_MOCK.EXAMPLE_SIMULATE));
}

export function isAm18SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE) ?? firstVisibleElement(API_MOCK.SIMULATE_RESULT));
}

export function isAm18OnRequests(): boolean {
  return Boolean(firstVisibleElement(REQ.SIDEBAR) ?? firstVisibleElement(REQ.NAV_REQUESTS));
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

export function am18RowWithPath(path: string): HTMLElement | undefined {
  return journalRows().find(row => (row.textContent ?? '').includes(path));
}

export function hasAm18MissRow(): boolean {
  return Boolean(am18RowWithPath(AM18_MISS_PATH));
}

function rowSelector(row: HTMLElement | undefined): string | undefined {
  const id = row?.getAttribute('data-testid');
  return id ? `[data-testid="${id}"]` : undefined;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/**
 * Step 6 ("Open in Requests") appends a `Mock journal · …` request into this
 * Requests-side collection, which `wipeApiMockWorkspace` does not touch. Remove
 * it on both boot and cleanup so replays do not accumulate orphaned rows.
 */
const AM18_JOURNAL_COLLECTION = 'API Mock Journal';

export async function prepareAm18Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  deleteCollectionsByName(AM18_JOURNAL_COLLECTION);
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM18_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-18: failed to import ${AM18_CORPUS_SAMPLE}`);
  }
}

/** Module flag — set after TX_SAVE_EXAMPLE succeeds so DOM-blind preActions don't re-save. */
let am18ExampleSavedFlag = false;
export function markAm18ExampleSaved(): void { am18ExampleSavedFlag = true; }
export function resetAm18ExampleSaved(): void { am18ExampleSavedFlag = false; }

export async function cleanupAm18(): Promise<void> {
  am18ExampleSavedFlag = false;
  await wipeApiMockWorkspace();
  deleteCollectionsByName(AM18_JOURNAL_COLLECTION);
}

// ── Quiet primitives ────────────────────────────────────────────────────────

export async function ensureAm18OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm18Server() || firstVisibleElement(API_MOCK.STUDIO) || firstVisibleElement(API_MOCK.RUNTIME_PAGE)) {
    return;
  }
  if (await openApiMockFromActivityBar(ctx)) return;
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

export async function ensureAm18StudioView(ctx: DemoActionContext): Promise<void> {
  await ensureAm18OnApiMock(ctx);
  if (isAm18StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm18Library(ctx: DemoActionContext): Promise<void> {
  if (hasAm18Library()) return;
  prepareApiMockStudioChrome();
  await ensureAm18StudioView(ctx);
  if (hasAm18Library()) return;
  const imported = await importApiMockGallerySample(AM18_CORPUS_SAMPLE);
  if (imported) await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function ensureAm18Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm18OnApiMock(ctx);
  if (isAm18ServerRunning()) return;
  await ensureAm18Library(ctx);
  if (isAm18ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function closeAm18Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm18SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 200 });
}

async function applyIfDirty(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(API_MOCK.APPLY) && !firstVisibleElement(API_MOCK.DIRTY_BADGE)) return;
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE) && visible) {
    await am18Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (!firstVisibleElement(API_MOCK.APPLY)) return;
  if (visible) await am18Aim(ctx, API_MOCK.APPLY, T.lifecycle);
  else await ctx.click(API_MOCK.APPLY);
  await ctx.delay(visible ? T.lifecycle : 400);
}

async function openAm18Journal(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm18OnApiMock(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (isAm18RuntimeViewActive() && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    if (visible) await am18Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS);
    else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
    await ctx.delay(visible ? T.tabSwitch : 200);
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    if (visible) await am18Aim(ctx, API_MOCK.LIVE_TRANSACTIONS);
    else await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
    await ctx.delay(visible ? T.tabSwitch : 200);
    return;
  }
  if (firstVisibleElement(API_MOCK.VIEW_RUNTIME)) {
    if (visible) await am18Aim(ctx, API_MOCK.VIEW_RUNTIME);
    else await ctx.click(API_MOCK.VIEW_RUNTIME);
    await ctx.delay(visible ? T.tabSwitch : 200);
  }
}

async function clickJournalRow(
  ctx: DemoActionContext,
  row: HTMLElement | undefined,
  visible: boolean,
): Promise<void> {
  const selector = rowSelector(row) ?? API_MOCK.JOURNAL_FIRST_ROW;
  if (!firstVisibleElement(selector)) return;
  if (visible) await am18Click(ctx, selector, T.fieldFilled);
  else await ctx.click(selector);
}

async function clickNewestJournalRow(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await clickJournalRow(ctx, journalRows()[0], visible);
}

async function selectMissRow(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am18RowWithPath(AM18_MISS_PATH) ?? journalRows()[0];
  await clickJournalRow(ctx, row, visible);
  if (visible && (firstVisibleElement(API_MOCK.TX_DETAIL) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW))) {
    await am18Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
}

async function sendAm18(path: string): Promise<{ status: number; body: string } | null> {
  return sendApiMockRequest({ path, method: 'GET' });
}

async function quietMatchedTraffic(ctx: DemoActionContext): Promise<void> {
  if (hasAm18Traffic() && journalRows().length >= 2) return;
  await sendAm18(AM18_MATCH_LIST);
  await ctx.delay(200);
  await sendAm18(AM18_MATCH_ITEM);
  await ctx.delay(400);
}

async function quietMiss(ctx: DemoActionContext): Promise<void> {
  if (hasAm18MissRow()) return;
  await sendAm18(AM18_MISS_PATH);
  await ctx.delay(400);
}

function quietClosestMatch(): void {
  patchApiMockServerSettings({ fallbackMode: 'closest_match_debug' });
}

async function clearJournalFilter(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.JOURNAL_FILTER)) return;
  if (!am18FilterValue()) return;
  await ctx.fill(API_MOCK.JOURNAL_FILTER, '');
}

async function returnFromRequests(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!isAm18OnRequests()) return;
  if (visible) {
    if (firstVisibleElement(REQ.SIDEBAR)) await am18Payoff(ctx, REQ.SIDEBAR);
    else if (firstVisibleElement(REQ.NAV_REQUESTS)) await am18Payoff(ctx, REQ.NAV_REQUESTS);
  }
  if (firstVisibleElement(API_MOCK.APP_SUBNAV)) {
    if (visible) await am18Aim(ctx, API_MOCK.APP_SUBNAV);
    else await ctx.click(API_MOCK.APP_SUBNAV);
    await ctx.delay(visible ? T.panelReady : 200);
    return;
  }
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(visible ? T.panelReady : 200);
}

async function openRuntimeSettings(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await openAm18Journal(ctx, visible);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_FALLBACK)) {
    if (!visible) return;
    const panel = firstVisibleElement<HTMLElement>(API_MOCK.RUNTIME_SETTINGS_PANEL);
    const content = panel?.querySelector<HTMLElement>('.am-rt-stg-grid');
    if (content) content.scrollTop = 0;
    return;
  }
  if (!firstVisibleElement(API_MOCK.DOCK_TAB_SETTINGS)) return;
  if (visible) await am18Aim(ctx, API_MOCK.DOCK_TAB_SETTINGS, T.tabSwitch);
  else await ctx.click(API_MOCK.DOCK_TAB_SETTINGS);
  if (visible) await am18Reveal(ctx, API_MOCK.RUNTIME_SETTINGS_PANEL, T.tabSwitch);
  else await ctx.waitFor(API_MOCK.RUNTIME_SETTINGS_PANEL, REVEAL_MS);
  const panel = firstVisibleElement<HTMLElement>(API_MOCK.RUNTIME_SETTINGS_PANEL);
  const content = panel?.querySelector<HTMLElement>('.am-rt-stg-grid');
  if (content) content.scrollTop = 0;
}

async function selectCreatedRoute(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm18StudioView(ctx);
  if (am18PathInputValue().includes(AM18_MISS_PATH)) return;
  const pathEl = Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_PATH))
    .find(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
  const row = pathEl?.closest<HTMLElement>('button.am-route-item');
  const id = row?.getAttribute('data-testid');
  if (id) {
    const selector = `[data-testid="${id}"]`;
    if (visible) await am18Click(ctx, selector);
    else await ctx.click(selector);
  }
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm18ForFilter(ctx: DemoActionContext): Promise<void> {
  await ensureAm18Running(ctx);
  await quietMatchedTraffic(ctx);
  await openAm18Journal(ctx, false);
  await clearJournalFilter(ctx);
}

export async function ensureAm18ForMiss(ctx: DemoActionContext): Promise<void> {
  await ensureAm18ForFilter(ctx);
}

export async function ensureAm18ForClosestMatch(ctx: DemoActionContext): Promise<void> {
  await ensureAm18ForMiss(ctx);
  await quietMiss(ctx);
}

export async function ensureAm18ForCreateRoute(ctx: DemoActionContext): Promise<void> {
  await ensureAm18ForMiss(ctx);
  await quietMiss(ctx);
  quietClosestMatch();
  await applyIfDirty(ctx, false);
  await openAm18Journal(ctx, false);
  await clearJournalFilter(ctx);
  if (!hasAm18MissRow()) await quietMiss(ctx);
  await selectMissRow(ctx, false);
}

export async function ensureAm18ForSaveExample(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await closeAm18Simulate(ctx);
  await ensureAm18ForCreateRoute(ctx);
  if (hasAm18CreatedRoute()) {
    // Route already exists — apply any lingering draft silently (created in a prior step).
    await applyIfDirty(ctx, false);
    return;
  }
  if (firstVisibleElement(API_MOCK.TX_CREATE_ROUTE)) {
    await ctx.click(API_MOCK.TX_CREATE_ROUTE);
    await ctx.delay(200);
  }
  // Apply the newly created draft so "Draft changed" is gone before Acting begins.
  await applyIfDirty(ctx, false);
}

export async function ensureAm18ForShare(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await closeAm18Simulate(ctx);
  await ensureAm18ForSaveExample(ctx);
  if (!hasAm18Example() && firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await ctx.click(API_MOCK.TX_SAVE_EXAMPLE);
    await ctx.delay(200);
  }
  await openAm18Journal(ctx, false);
  if (hasAm18Traffic()) await clickNewestJournalRow(ctx, false);
}

async function openAm18ExamplesTab(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.EXAMPLES_GRID) || firstVisibleElement(API_MOCK.EXAMPLE_SIMULATE)
    || firstVisibleElement(API_MOCK.EXAMPLES_EMPTY)) {
    return;
  }
  if (!firstVisibleElement(API_MOCK.BTAB_EXAMPLES) && !document.querySelector(API_MOCK.BTAB_EXAMPLES)) {
    return;
  }
  await ctx.click(API_MOCK.BTAB_EXAMPLES);
  // Accept either the populated grid or the empty-state placeholder — waiting
  // only for EXAMPLES_GRID timed out (8 s) when the route has no examples yet.
  await Promise.race([
    ctx.waitFor(API_MOCK.EXAMPLES_GRID, 3_000).catch(() => undefined),
    ctx.waitFor(API_MOCK.EXAMPLES_EMPTY, 3_000).catch(() => undefined),
  ]);
}

export async function ensureAm18ForProve(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await closeAm18Simulate(ctx);
  // Clear any server-side simulate samples left from a previous lesson pass.
  // These show a stale FAIL badge even after the route is rebuilt, because
  // server.samples persists in React state until the workspace is wiped.
  clearApiMockServerSamples();
  // Full fast path: route selected, studio visible, examples grid visible.
  if (hasAm18CreatedRoute() && isAm18StudioViewActive() && hasAm18Example()) return;
  // Partial fast path: route exists in the sidebar — no network calls needed.
  // Just select it, ensure the example exists, open the Examples tab.
  if (hasAm18CreatedRoute()) {
    await ensureAm18StudioView(ctx);
    await selectCreatedRoute(ctx, false);
    await applyIfDirty(ctx, false);
    if (!hasAm18Example() && firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
      await ctx.click(API_MOCK.TX_SAVE_EXAMPLE);
      await ctx.delay(200);
      markAm18ExampleSaved();
    }
    await openAm18ExamplesTab(ctx);
    return;
  }
  // Slow path: route missing — need the full setup chain (includes network calls).
  await ensureAm18ForSaveExample(ctx);
  if (!hasAm18Example() && firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await ctx.click(API_MOCK.TX_SAVE_EXAMPLE);
    await ctx.delay(200);
    markAm18ExampleSaved();
  }
  await ensureAm18StudioView(ctx);
  await selectCreatedRoute(ctx, false);
  await openAm18ExamplesTab(ctx);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — open the journal, fetch two matching storefront paths, hold the rows
 * and the outcome chip. Reading already rang Live transactions — click immediately.
 */
export async function runAm18JournalTour(ctx: DemoActionContext): Promise<void> {
  await ensureAm18Library(ctx);
  if (!isAm18ServerRunning() && firstVisibleElement(API_MOCK.START)) {
    await ctx.click(API_MOCK.START);
    await ctx.waitFor(API_MOCK.STOP, 20_000);
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await am18ClickNow(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  }
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS) && !firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR)
    && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && !firstVisibleElement(API_MOCK.RUNTIME_GUIDE)) {
    await am18Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
  }
  await am18Break(ctx);
  await sendAm18(AM18_MATCH_LIST);
  await ctx.delay(T.journalWrite);
  await sendAm18(AM18_MATCH_ITEM);
  await ctx.delay(T.journalWrite);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) || firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await am18Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am18Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
  await clickNewestJournalRow(ctx, true);
  if (firstVisibleElement(API_MOCK.TX_DETAIL) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am18Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am18Payoff(ctx, API_MOCK.TX_OUTCOME);
  }
}

/**
 * Step 2 — filter to products, then a nonsense string for the empty state, then
 * clear. Reading already rang the filter — fill immediately.
 */
export async function runAm18Filter(ctx: DemoActionContext): Promise<void> {
  await openAm18Journal(ctx, true);
  if (!firstVisibleElement(API_MOCK.JOURNAL_FILTER)) return;
  await am18FillNow(ctx, API_MOCK.JOURNAL_FILTER, AM18_FILTER, T.payoff);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am18Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
  await am18Break(ctx);
  await am18FillNow(ctx, API_MOCK.JOURNAL_FILTER, AM18_FILTER_MISS, T.payoff);
  if (firstVisibleElement(API_MOCK.JOURNAL_FILTER_EMPTY) || firstVisibleElement(API_MOCK.JOURNAL_FILTER)) {
    await am18Reveal(ctx, API_MOCK.JOURNAL_FILTER_EMPTY, T.payoff);
  }
  await am18Break(ctx);
  await am18FillNow(ctx, API_MOCK.JOURNAL_FILTER, '', T.payoff);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am18Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
}

/**
 * Step 3 — fetch the typo, open the unmatched row, hold candidates and near-misses.
 * Reading already rang Address — do not re-ring it.
 */
export async function runAm18TheMiss(ctx: DemoActionContext): Promise<number | null> {
  await openAm18Journal(ctx, false);
  const res = await sendAm18(AM18_MISS_PATH);
  await ctx.delay(T.journalWrite);
  const miss = am18RowWithPath(AM18_MISS_PATH) ?? journalRows()[0];
  if (miss) {
    const selector = rowSelector(miss);
    if (selector) await am18Payoff(ctx, selector);
  }
  await selectMissRow(ctx, true);
  if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am18Payoff(ctx, API_MOCK.TX_OUTCOME);
  }
  await am18Break(ctx);
  if (firstVisibleElement(API_MOCK.TX_CANDIDATES)) {
    await am18Payoff(ctx, API_MOCK.TX_CANDIDATES);
  }
  if (firstVisibleElement(API_MOCK.TX_NEAR_MISSES) || firstVisibleElement(API_MOCK.TX_DETAIL)) {
    // Reveal the list, then move the ring onto each near-miss rule in turn so the
    // viewer reads them one at a time instead of scanning the whole panel.
    await am18Reveal(ctx, API_MOCK.TX_NEAR_MISSES, T.panelReady);
    const items = am18NearMissItems();
    for (let i = 0; i < items.length; i++) {
      const isLast = i === items.length - 1;
      await spotlightElementBeat(ctx, items[i], isLast ? T.payoff : T.fieldFilled);
    }
  }
  return res?.status ?? null;
}

/**
 * Step 4 — Runtime Settings unmatched fallback → closest-match, Save, Apply,
 * fetch the typo again, hold the debug body. Reading already rang the select.
 */
export async function runAm18ClosestMatch(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, true);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_FALLBACK)) {
    await am18Aim(ctx, API_MOCK.RUNTIME_SETTINGS_FALLBACK, T.payoff);
    await am18SelectNow(ctx, API_MOCK.RUNTIME_SETTINGS_FALLBACK, 'closest_match_debug', T.payoff);
  }
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
    await am18Aim(ctx, API_MOCK.RUNTIME_SETTINGS_SAVE, T.lifecycle);
  }
  await applyIfDirty(ctx, true);
  await am18Break(ctx);
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await am18Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
  }
  await sendAm18(AM18_MISS_PATH);
  await ctx.delay(T.journalWrite);
  await selectMissRow(ctx, true);
  if (firstVisibleElement(API_MOCK.TX_RESPONSE) || firstVisibleElement(API_MOCK.TX_DETAIL)) {
    await am18Reveal(ctx, API_MOCK.TX_RESPONSE, T.payoff);
    await am18Payoff(ctx, API_MOCK.TX_RESPONSE);
  }
}

/**
 * Ring the **Open in Studio** button (not the whole notice), then click it.
 * `firstVisibleElement` can miss a dock footer control with a 0×0 box — resolve
 * via querySelector so the ring still lands on the button the viewer can see.
 */
async function highlightAm18OpenInStudio(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(API_MOCK.TX_OPEN_CREATED, REVEAL_MS).catch(() => undefined);
  const btn = firstVisibleElement<HTMLElement>(API_MOCK.TX_OPEN_CREATED)
    ?? document.querySelector<HTMLElement>(API_MOCK.TX_OPEN_CREATED);
  if (!btn) return;
  btn.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  await spotlightElementBeat(ctx, btn, T.simOutcome);
  await ctx.click(API_MOCK.TX_OPEN_CREATED);
  if (btn.isConnected && isAm18RuntimeViewActive()) {
    btn.click();
  }
  await ctx.delay(T.payoff);
}

/**
 * Step 5 — Create route from the unmatched row, Open in Studio, hold the
 * seeded path. Highlight both Create route and Open in Studio.
 */
export async function runAm18CreateRoute(ctx: DemoActionContext): Promise<void> {
  await openAm18Journal(ctx, false);
  await selectMissRow(ctx, true);
  // Guard: if the draft already appears in the sidebar route list (step replayed),
  // skip Create route to avoid accumulating duplicate drafts. Check the route-path
  // elements only — not the path input, which shows AM18_MISS_PATH even while the
  // journal is open (selected row pre-fills the detail panel).
  const alreadyInSidebar = Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_PATH))
    .some(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
  if (!alreadyInSidebar
    && (firstVisibleElement(API_MOCK.TX_CREATE_ROUTE) || document.querySelector(API_MOCK.TX_CREATE_ROUTE))) {
    await clickBeat(ctx, API_MOCK.TX_CREATE_ROUTE, { look: 350, hold: 600 });
  }
  await highlightAm18OpenInStudio(ctx);
  // The route editor lives on the Studio view — Open in Studio can race the view
  // switch, so drive it explicitly and re-select the seeded draft. Without this
  // the demo can stall on the Runtime notice and the viewer never sees the editor.
  await ensureAm18StudioView(ctx);
  // Ring the draft chip in the sidebar FIRST so the viewer sees where it landed,
  // then click it to open the editor.
  const draftRow = Array.from(document.querySelectorAll<HTMLElement>('button.am-route-item'))
    .find(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
  if (draftRow) {
    draftRow.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    await spotlightElementBeat(ctx, draftRow, T.payoff);
    await ctx.click(`[data-testid="${draftRow.getAttribute('data-testid')}"]`);
    await ctx.delay(T.panelReady);
  } else {
    await selectCreatedRoute(ctx, false);
  }
  if (firstVisibleElement(API_MOCK.ROUTE_EDITOR) || firstVisibleElement(API_MOCK.VIEW_STUDIO)) {
    await am18Reveal(ctx, API_MOCK.ROUTE_EDITOR, T.fieldFilled);
  }
  if (firstVisibleElement(API_MOCK.PATH_INPUT)) {
    await am18Payoff(ctx, API_MOCK.PATH_INPUT);
  }
  // It landed *disabled* — spotlight the Enabled toggle so the draft reads as a draft.
  if (firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am18Payoff(ctx, API_MOCK.ROUTE_ENABLED);
  }
  // Draft changed badge is showing — ring it then Apply so the companion syncs
  // the disabled draft before the next step.
  await am18Break(ctx);
  await applyIfDirty(ctx, true);
}

/**
 * Step 6 — Save as example → confirm notice → Open in Requests (spotlit) →
 * hold Requests sidebar → return → select draft in sidebar → Examples tab → grid.
 */
export async function runAm18SaveExample(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await openAm18Journal(ctx, true);
  await selectMissRow(ctx, true);

  // Beat 1 — ring Save as example, click it, hold the confirmation notice.
  if (firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await am18Click(ctx, API_MOCK.TX_SAVE_EXAMPLE, T.payoff);
    markAm18ExampleSaved();
  }
  if (firstVisibleElement(API_MOCK.TX_NOTICE) || document.querySelector(API_MOCK.TX_NOTICE)) {
    await am18Reveal(ctx, API_MOCK.TX_NOTICE, T.panelReady);
    await am18Payoff(ctx, API_MOCK.TX_NOTICE);
  }
  await am18Break(ctx);

  // Beat 2 — ring Open in Requests explicitly (querySelector fallback for dock layouts).
  const openReqBtn = firstVisibleElement<HTMLElement>(API_MOCK.TX_OPEN_REQUESTS)
    ?? document.querySelector<HTMLElement>(API_MOCK.TX_OPEN_REQUESTS);
  if (openReqBtn) {
    openReqBtn.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    await spotlightElementBeat(ctx, openReqBtn, T.simOutcome);
    await ctx.click(API_MOCK.TX_OPEN_REQUESTS);
    await ctx.delay(T.panelReady);
  }

  // Beat 3 — spotlight the specific "Mock journal · GET /produts/42" item
  // in the Requests sidebar so the viewer sees exactly where it landed.
  await ctx.delay(T.panelReady);
  const journalReqItem = Array.from(document.querySelectorAll<HTMLElement>(REQ.REQ_ITEM))
    .find(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
  if (journalReqItem) {
    journalReqItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    await spotlightElementBeat(ctx, journalReqItem, T.payoff);
  } else if (firstVisibleElement(REQ.SIDEBAR)) {
    await am18Payoff(ctx, REQ.SIDEBAR);
  }

  // Beat 4 — navigate back and spotlight the draft route chip in the sidebar.
  await returnFromRequests(ctx, true);
  await ensureAm18StudioView(ctx);
  const draftRow = Array.from(document.querySelectorAll<HTMLElement>('button.am-route-item'))
    .find(el => (el.textContent ?? '').includes(AM18_MISS_PATH));
  if (draftRow) {
    draftRow.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    await spotlightElementBeat(ctx, draftRow, T.fieldFilled);
    await ctx.click(`[data-testid="${draftRow.getAttribute('data-testid')}"]`);
    await ctx.delay(T.panelReady);
  } else {
    await selectCreatedRoute(ctx, false);
  }

  // Beat 5 — ring the Examples tab, open it, hold the grid.
  if (firstVisibleElement(API_MOCK.BTAB_EXAMPLES) || document.querySelector(API_MOCK.BTAB_EXAMPLES)) {
    const exTab = firstVisibleElement<HTMLElement>(API_MOCK.BTAB_EXAMPLES)
      ?? document.querySelector<HTMLElement>(API_MOCK.BTAB_EXAMPLES);
    if (exTab) {
      await spotlightElementBeat(ctx, exTab, T.beforeOpen);
      await ctx.click(API_MOCK.BTAB_EXAMPLES);
      await ctx.delay(T.tabSwitch);
    }
  }
  if (firstVisibleElement(API_MOCK.EXAMPLES_GRID) || firstVisibleElement(API_MOCK.EXAMPLES_EMPTY)) {
    await am18Reveal(ctx, API_MOCK.EXAMPLES_GRID, T.panelReady);
    if (firstVisibleElement(API_MOCK.EXAMPLES_GRID)) {
      await am18Payoff(ctx, API_MOCK.EXAMPLES_GRID);
    }
  }
}

/**
 * Step 7 — Copy, Export, Clear. Reading already rang Copy.
 * Compact holds — three beats should not burn half a minute of Acting.
 */
export async function runAm18ShareAndReset(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await applyIfDirty(ctx, true);
  await openAm18Journal(ctx, true);
  if (hasAm18Traffic() && !firstVisibleElement(API_MOCK.TX_COPY)) {
    await clickNewestJournalRow(ctx, true);
  }
  if (firstVisibleElement(API_MOCK.TX_COPY)) {
    await clickBeat(ctx, API_MOCK.TX_COPY, { look: TE.look, hold: TE.hold });
  }
  await ctx.delay(TE.break);
  // Clear — leave the populated journal visible, then ring Clear before resetting it.
  if (firstVisibleElement(API_MOCK.JOURNAL_CLEAR)) {
    await ctx.delay(TE.break);
    await clickBeat(ctx, API_MOCK.JOURNAL_CLEAR, { look: TE.clearLook, hold: TE.clearHold });
  }
  const emptySel = firstVisibleElement(API_MOCK.RUNTIME_GUIDE)
    ? API_MOCK.RUNTIME_GUIDE
    : API_MOCK.JOURNAL_EMPTY;
  if (firstVisibleElement(emptySel) || firstVisibleElement(API_MOCK.JOURNAL_CLEAR)
    || firstVisibleElement(API_MOCK.RUNTIME_GUIDE)) {
    await am18Reveal(ctx, emptySel, T.panelReady);
    if (firstVisibleElement(emptySel)) {
      await am18Payoff(ctx, emptySel);
    }
  }
  await ctx.delay(TE.break);
  if (firstVisibleElement(API_MOCK.JOURNAL_EXPORT)) {
    await clickBeat(ctx, API_MOCK.JOURNAL_EXPORT, { look: TE.look, hold: TE.hold });
  }
}

/**
 * Step 8 — Show the saved example then open Simulate from scratch, save the
 * request as a named sample, run it, and hold the green UNMATCHED verdict.
 *
 * Flow:
 *  Beat 1  — spotlight the Examples grid (example exists from step 6)
 *  Beat 2  — ring the route-header Simulate button, click it (scratch pad,
 *             path pre-filled as /produts/42, NO stale server samples)
 *  Beat 3  — Save as sample (fills the suggested name "GET /produts/42")
 *  Beat 4  — Run simulation → hold UNMATCHED verdict
 */
export async function runAm18ProveExample(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await ensureAm18StudioView(ctx);
  await selectCreatedRoute(ctx, false);
  await openAm18ExamplesTab(ctx);

  // Beat 1 — show the Examples grid so the viewer sees the saved example.
  if (firstVisibleElement(API_MOCK.EXAMPLES_GRID)) {
    await am18Payoff(ctx, API_MOCK.EXAMPLES_GRID);
  }

  // Beat 2 — ring the route-header Simulate button (not the example row's button)
  // so Simulate opens in scratch-pad mode with /produts/42 pre-filled and no
  // stale FAIL entries. The preAction already called clearApiMockServerSamples().
  if (firstVisibleElement(API_MOCK.SIMULATE)) {
    await clickBeat(ctx, API_MOCK.SIMULATE, { look: T.beforeOpen, hold: 0 });
    await am18Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE, T.panelReady);
  }

  // Beat 3 + 4 — Save as sample (creates the named entry the viewer can see),
  // then hold Run, click, show the UNMATCHED (green) verdict.
  if (firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE)) {
    await reviewAndRunSimulation(ctx, {
      // saveSample: true (default) — click "Save as sample", fill "GET /produts/42"
      reviewFields: false,
      digest: false,
      review: T.look,
      beforeRun: T.beforeRun,
    });
  }

  // Payoff — reveal the verdict and hold a ring on it.
  const outcome = firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)
    ? API_MOCK.SIMULATE_OUTCOME
    : API_MOCK.SIMULATE_RESULT;
  if (firstVisibleElement(outcome)) {
    await am18Reveal(ctx, outcome, T.panelReady);
    await am18Payoff(ctx, outcome);
  }
  // Leave the final Rule Simulation result open for inspection.
}
