/**
 * AM-18 `am-18-journal` helpers — Journal Forensics: Near-Misses, Candidates & Promotion.
 *
 * Quiet corpus is the store library, started. Live traffic (including the
 * `/produts/42` typo), closest-match, and every promotion action are authored
 * in the UI. Companion required — Start + live fetch is the proof.
 */
import {
  importApiMockGallerySample,
  patchApiMockServerSettings,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, APP, REQ } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  revealBeat,
  spotlightBeat,
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
  beforeRun: 2000,
} as const;

const T = AM18_TIMING;
const REVEAL_MS = 8_000;

export const AM18_CORPUS_SAMPLE = 'am-gallery-store';
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

export function hasAm18Example(): boolean {
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

export async function prepareAm18Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM18_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-18: failed to import ${AM18_CORPUS_SAMPLE}`);
  }
}

export async function cleanupAm18(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Quiet primitives ────────────────────────────────────────────────────────

export async function ensureAm18OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm18Server() || firstVisibleElement(API_MOCK.STUDIO) || firstVisibleElement(API_MOCK.RUNTIME_PAGE)) {
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

export async function closeAm18Simulate(ctx: DemoActionContext): Promise<void> {
  if (!isAm18SimulateOpen()) return;
  if (!firstVisibleElement(API_MOCK.SIMULATE_CLOSE)) return;
  await ctx.click(API_MOCK.SIMULATE_CLOSE);
  await ctx.delay(200);
}

async function applyIfDirty(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(API_MOCK.APPLY) && !firstVisibleElement(API_MOCK.DIRTY_BADGE)) return;
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE) && visible) {
    await am18Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (!firstVisibleElement(API_MOCK.APPLY)) return;
  if (visible) await am18Aim(ctx, API_MOCK.APPLY);
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
  if (firstVisibleElement(APP.AB_PROTOCOLS)) {
    if (visible) await am18Aim(ctx, APP.AB_PROTOCOLS);
    else await ctx.click(APP.AB_PROTOCOLS);
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
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_FALLBACK)) return;
  if (!firstVisibleElement(API_MOCK.DOCK_TAB_SETTINGS)) return;
  if (visible) await am18Aim(ctx, API_MOCK.DOCK_TAB_SETTINGS, T.tabSwitch);
  else await ctx.click(API_MOCK.DOCK_TAB_SETTINGS);
  if (visible) await am18Reveal(ctx, API_MOCK.RUNTIME_SETTINGS_PANEL, T.tabSwitch);
  else await ctx.waitFor(API_MOCK.RUNTIME_SETTINGS_PANEL, REVEAL_MS);
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
  await openRuntimeSettings(ctx, false);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_FALLBACK)) {
    await ctx.selectOption(API_MOCK.RUNTIME_SETTINGS_FALLBACK, 'closest_match_debug');
    if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
    }
  } else {
    quietClosestMatch();
  }
  await applyIfDirty(ctx, false);
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
  if (hasAm18CreatedRoute()) return;
  if (firstVisibleElement(API_MOCK.TX_CREATE_ROUTE)) {
    await ctx.click(API_MOCK.TX_CREATE_ROUTE);
    await ctx.delay(200);
  }
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
  if (firstVisibleElement(API_MOCK.EXAMPLES_GRID) || firstVisibleElement(API_MOCK.EXAMPLE_SIMULATE)) {
    return;
  }
  if (!firstVisibleElement(API_MOCK.BTAB_EXAMPLES) && !document.querySelector(API_MOCK.BTAB_EXAMPLES)) {
    return;
  }
  await ctx.click(API_MOCK.BTAB_EXAMPLES);
  await ctx.waitFor(API_MOCK.EXAMPLES_GRID, REVEAL_MS);
}

export async function ensureAm18ForProve(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await closeAm18Simulate(ctx);
  await ensureAm18ForSaveExample(ctx);
  if (!hasAm18Example() && firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await ctx.click(API_MOCK.TX_SAVE_EXAMPLE);
    await ctx.delay(200);
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
    await am18Reveal(ctx, API_MOCK.TX_NEAR_MISSES, T.payoff);
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
    await am18SelectNow(ctx, API_MOCK.RUNTIME_SETTINGS_FALLBACK, 'closest_match_debug');
  }
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
    await am18Aim(ctx, API_MOCK.RUNTIME_SETTINGS_SAVE);
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
  }
}

/**
 * Step 5 — Create route from the unmatched row, Open in Studio, hold the
 * seeded path. Reading already rang Create route.
 */
export async function runAm18CreateRoute(ctx: DemoActionContext): Promise<void> {
  await openAm18Journal(ctx, false);
  await selectMissRow(ctx, true);
  if (firstVisibleElement(API_MOCK.TX_CREATE_ROUTE)) {
    await am18ClickNow(ctx, API_MOCK.TX_CREATE_ROUTE);
  }
  if (firstVisibleElement(API_MOCK.TX_NOTICE) || firstVisibleElement(API_MOCK.TX_CREATE_ROUTE)) {
    await am18Reveal(ctx, API_MOCK.TX_NOTICE, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TX_OPEN_CREATED)) {
    await am18Aim(ctx, API_MOCK.TX_OPEN_CREATED);
  }
  if (firstVisibleElement(API_MOCK.ROUTE_EDITOR) || firstVisibleElement(API_MOCK.TX_OPEN_CREATED)
    || firstVisibleElement(API_MOCK.VIEW_STUDIO)) {
    await am18Reveal(ctx, API_MOCK.ROUTE_EDITOR, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.PATH_INPUT)) {
    await am18Payoff(ctx, API_MOCK.PATH_INPUT);
  }
}

/**
 * Step 6 — Save as example, Open in Requests, hold the handoff, come back,
 * hold the Examples grid. Reading already rang Save as example.
 */
export async function runAm18SaveExample(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await openAm18Journal(ctx, true);
  await selectMissRow(ctx, true);
  if (firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await am18ClickNow(ctx, API_MOCK.TX_SAVE_EXAMPLE);
  }
  if (firstVisibleElement(API_MOCK.TX_NOTICE) || firstVisibleElement(API_MOCK.TX_SAVE_EXAMPLE)) {
    await am18Reveal(ctx, API_MOCK.TX_NOTICE, T.payoff);
  }
  await am18Break(ctx);
  if (firstVisibleElement(API_MOCK.TX_OPEN_REQUESTS)) {
    await am18Aim(ctx, API_MOCK.TX_OPEN_REQUESTS);
  }
  if (firstVisibleElement(REQ.SIDEBAR) || firstVisibleElement(REQ.NAV_REQUESTS)
    || firstVisibleElement(API_MOCK.TX_OPEN_REQUESTS)) {
    await am18Reveal(ctx, REQ.SIDEBAR, T.payoff);
  }
  await returnFromRequests(ctx, true);
  await ensureAm18StudioView(ctx);
  await selectCreatedRoute(ctx, true);
  if (firstVisibleElement(API_MOCK.BTAB_EXAMPLES)) {
    await am18Aim(ctx, API_MOCK.BTAB_EXAMPLES, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.EXAMPLES_GRID) || firstVisibleElement(API_MOCK.EXAMPLES_EMPTY)
    || firstVisibleElement(API_MOCK.BTAB_EXAMPLES)) {
    await am18Reveal(ctx, API_MOCK.EXAMPLES_GRID, T.payoff);
  }
}

/**
 * Step 7 — Copy, Export, Clear. Reading already rang Copy.
 */
export async function runAm18ShareAndReset(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await openAm18Journal(ctx, true);
  if (hasAm18Traffic() && !firstVisibleElement(API_MOCK.TX_COPY)) {
    await clickNewestJournalRow(ctx, true);
  }
  if (firstVisibleElement(API_MOCK.TX_COPY)) {
    await am18ClickNow(ctx, API_MOCK.TX_COPY);
    await am18Payoff(ctx, API_MOCK.TX_COPY);
  }
  await am18Break(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_EXPORT)) {
    await am18Aim(ctx, API_MOCK.JOURNAL_EXPORT);
    await am18Payoff(ctx, API_MOCK.JOURNAL_EXPORT);
  }
  await am18Break(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_CLEAR)) {
    await am18Aim(ctx, API_MOCK.JOURNAL_CLEAR);
  }
  const emptySel = firstVisibleElement(API_MOCK.RUNTIME_GUIDE)
    ? API_MOCK.RUNTIME_GUIDE
    : API_MOCK.JOURNAL_EMPTY;
  if (firstVisibleElement(emptySel) || firstVisibleElement(API_MOCK.JOURNAL_CLEAR)
    || firstVisibleElement(API_MOCK.RUNTIME_GUIDE)) {
    await am18Reveal(ctx, emptySel, T.payoff);
  }
}

/**
 * Step 8 — Simulate the saved row, hold the passing result.
 * Examples is already open from preAction; reading rang Simulate.
 */
export async function runAm18ProveExample(ctx: DemoActionContext): Promise<void> {
  await returnFromRequests(ctx, false);
  await ensureAm18StudioView(ctx);
  await selectCreatedRoute(ctx, false);
  await openAm18ExamplesTab(ctx);
  if (firstVisibleElement(API_MOCK.EXAMPLE_SIMULATE)) {
    await am18ClickNow(ctx, API_MOCK.EXAMPLE_SIMULATE);
  }
  const outcome = firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)
    ? API_MOCK.SIMULATE_OUTCOME
    : API_MOCK.SIMULATE_RESULT;
  if (firstVisibleElement(outcome) || firstVisibleElement(API_MOCK.EXAMPLE_SIMULATE)
    || firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE)) {
    await am18Reveal(ctx, outcome, T.simOutcome);
  }
}
