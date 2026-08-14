/**
 * AM-12 `am-12-variants-sequence` helpers — Response Variants: Rules & Sequence Modes.
 *
 * Quiet corpus is one `POST /cart` answering a single 200. The 404 sibling, its
 * JSONPath condition, Default, and sequence mode are authored in the UI. The
 * listener is started quietly so Apply in the prove step is a hot-swap.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
  type ApiMockDemoPredicateGroup,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  reviewAndRunSimulation,
  selectBeat,
  spotlightBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

/**
 * Same slower holds as AM-10/AM-11, plus Simulate review/run holds from AM-06.
 */
export const AM12_TIMING = {
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

const T = AM12_TIMING;

export const AM12_CORPUS_SAMPLE = 'am-gallery-checkout';
export const AM12_PATH = '/cart';
export const AM12_METHOD = 'POST';
export const AM12_VARIANT_NAME = 'Not found';
export const AM12_JSONPATH = '$.sku';
export const AM12_SKU_MISSING = 'MISSING';
export const AM12_SKU_OK = 'RF-100';
export const AM12_OK_BODY = '{"ok":true,"items":[]}';
export const AM12_ERR_BODY = '{"error":"not_found"}';
export const AM12_MATCH_BODY = `{"sku":"${AM12_SKU_MISSING}"}`;
export const AM12_MISS_BODY = `{"sku":"${AM12_SKU_OK}"}`;
export const AM12_CONTENT_JSON = 'application/json';

export const AM12_NOT_FOUND_CONDITIONS: ApiMockDemoPredicateGroup = {
  id: 'pg-am12-404',
  combinator: 'all',
  children: [{
    id: 'pred-am12-sku',
    source: 'body',
    selector: '',
    operator: 'jsonPath_equals',
    expected: [AM12_JSONPATH, AM12_SKU_MISSING],
  }],
};

async function am12Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am12Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am12Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am12Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout: 8_000 });
}

async function am12Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am12Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am12Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm12Workspace(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm12RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm12StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm12RuntimeViewActive(): boolean {
  return Boolean(
    firstVisibleElement(API_MOCK.RUNTIME_PAGE)
    ?? firstVisibleElement(API_MOCK.DOCK_TAB_STATE)
    ?? firstVisibleElement(API_MOCK.DOCK),
  );
}

export function isAm12ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am12VariantCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.VARIANT_CARD));
}

export function am12VariantCount(): number {
  return am12VariantCards().length;
}

export function am12HasNotFoundVariant(): boolean {
  return am12VariantCards().some(card => {
    const text = card.textContent ?? '';
    return text.includes('404') || text.includes(AM12_VARIANT_NAME);
  });
}

export function am12IsRulesMode(): boolean {
  return firstVisibleElement(API_MOCK.RESPONSE_MODE_RULES)?.getAttribute('aria-pressed') === 'true';
}

export function am12IsSequenceMode(): boolean {
  return firstVisibleElement(API_MOCK.RESPONSE_MODE_SEQUENCE)?.getAttribute('aria-pressed') === 'true';
}

export function am12ConditionPath(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.SELECTION_CONDITION_PATH)?.value?.trim() ?? '';
}

export function am12ConditionValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.SELECTION_CONDITION_VALUE)?.value?.trim() ?? '';
}

export function am12HasJsonPathCondition(): boolean {
  const chip = firstVisibleElement(API_MOCK.SELECTION_CONDITION)?.textContent ?? '';
  if (chip.includes(AM12_JSONPATH) && chip.includes(AM12_SKU_MISSING)) return true;
  return am12ConditionPath() === AM12_JSONPATH && am12ConditionValue() === AM12_SKU_MISSING;
}

export function am12HasDefaultBadge(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.VARIANT_DEFAULT_BADGE));
}

export function isAm12SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function am12SimMethod(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_METHOD)?.getAttribute('data-value') ?? '';
}

export function am12SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am12HasSeqRow(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.DOCK_SEQ_ROW) ?? document.querySelector(API_MOCK.DOCK_SEQ_ROW));
}

export function hasAm12Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm12Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM12_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-12: failed to import ${AM12_CORPUS_SAMPLE}`);
  }
  prepareApiMockStudioChrome();
}

export async function cleanupAm12(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm12StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm12StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function closeAm12Simulate(ctx: DemoActionContext): Promise<void> {
  if (!isAm12SimulateOpen()) return;
  await ctx.click(API_MOCK.SIMULATE_CLOSE);
  await ctx.delay(400);
}

export async function ensureAm12Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm12StudioView(ctx);
  await closeAm12Simulate(ctx);
  if (!hasAm12Workspace()) {
    const imported = await importApiMockGallerySample(AM12_CORPUS_SAMPLE);
    if (!imported) {
      throw new Error(`AM-12: failed to import ${AM12_CORPUS_SAMPLE}`);
    }
    await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
  }
  await ensureAm12RuleOpen(ctx);
  await ensureAm12ResponseTab(ctx);
  await ensureAm12Running(ctx);
}

export async function ensureAm12RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm12StudioView(ctx);
  if (hasAm12RouteEditor()) return;
  const row = firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.FIRST_ROUTE);
  if (!row) return;
  await ctx.click(API_MOCK.ROUTE_ROW);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

export async function ensureAm12ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm12RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_BAR) ?? firstVisibleElement(API_MOCK.ADD_VARIANT)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.waitFor(API_MOCK.RESPONSE_EDITOR, 6_000);
}

export async function ensureAm12SelectionTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm12ResponseTab(ctx);
  if (firstVisibleElement(API_MOCK.SELECTION_PANEL)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_SELECTION)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_SELECTION);
  await ctx.waitFor(API_MOCK.SELECTION_PANEL, 6_000);
}

export async function ensureAm12Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm12StudioView(ctx);
  if (isAm12ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm12NotFoundVariant(ctx: DemoActionContext): Promise<void> {
  await ensureAm12Workspace(ctx);
  if (am12HasNotFoundVariant() && am12VariantCount() >= 2) return;
  patchApiMockActiveRoute({
    addVariant: true,
    variantName: AM12_VARIANT_NAME,
    status: 404,
    body: AM12_ERR_BODY,
    contentType: AM12_CONTENT_JSON,
    isDefault: false,
  });
  await ctx.waitFor(API_MOCK.VARIANT_CARD_LAST, 6_000);
}

export async function ensureAm12Conditions(ctx: DemoActionContext): Promise<void> {
  await ensureAm12NotFoundVariant(ctx);
  await ensureAm12SelectionTab(ctx);
  if (am12HasJsonPathCondition()) return;
  patchApiMockActiveRoute({
    variantIndex: 1,
    variantName: AM12_VARIANT_NAME,
    status: 404,
    body: AM12_ERR_BODY,
    contentType: AM12_CONTENT_JSON,
    variantConditions: AM12_NOT_FOUND_CONDITIONS,
    isDefault: false,
  });
}

export async function ensureAm12Default(ctx: DemoActionContext): Promise<void> {
  await ensureAm12Conditions(ctx);
  patchApiMockActiveRoute({ variantIndex: 0, isDefault: true });
}

export async function ensureAm12Sequence(ctx: DemoActionContext): Promise<void> {
  await ensureAm12Default(ctx);
  await closeAm12Simulate(ctx);
  if (am12IsSequenceMode()) return;
  patchApiMockActiveRoute({ responseMode: 'sequence' });
}

export async function ensureAm12ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm12Sequence(ctx);
  await ensureAm12Running(ctx);
}

/**
 * State lives on the Runtime dock, not the Studio live strip. Stay off Studio
 * once this runs — otherwise Acting rings a tab that is not in the DOM.
 */
async function openAm12RuntimeState(ctx: DemoActionContext, visible: boolean): Promise<void> {
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
    if (visible) await am12Aim(ctx, runtimeSel, T.tabSwitch);
    else await ctx.click(runtimeSel);
    if (!visible) await ctx.delay(200);
  }

  const tab = firstVisibleElement(API_MOCK.DOCK_TAB_STATE);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    if (visible) await am12Aim(ctx, API_MOCK.DOCK_TAB_STATE, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_STATE);
  }
}

export async function ensureAm12StateLive(ctx: DemoActionContext): Promise<void> {
  await ensureAm12ForApply(ctx);
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await ctx.click(API_MOCK.APPLY);
    await ctx.delay(400);
  }
  if (!am12HasSeqRow() && !hasAm12Traffic()) {
    await sendAm12ProveRequest();
    await ctx.delay(400);
  }
  await openAm12RuntimeState(ctx, false);
}

export async function ensureAm12JournalOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm12ForApply(ctx);
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

export async function sendAm12ProveRequest(): Promise<{ status: number; body: string } | null> {
  return sendApiMockRequest({
    path: AM12_PATH,
    method: AM12_METHOD,
    body: AM12_MISS_BODY,
  });
}

async function openAm12Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm12SimulateOpen()) return;
  await am12Aim(ctx, API_MOCK.SIMULATE);
  await am12Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

async function runAm12Simulation(
  ctx: DemoActionContext,
  body: string,
  sampleName: string,
  opts: { saveSample?: boolean } = {},
): Promise<void> {
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am12SimMethod() !== AM12_METHOD && firstVisibleElement(API_MOCK.SIMULATE_METHOD)) {
    await selectBeat(ctx, API_MOCK.SIMULATE_METHOD, AM12_METHOD, { look: T.beforeOpen, hold: T.fieldFilled });
  }
  await am12Fill(ctx, API_MOCK.SIMULATE_PATH, AM12_PATH);
  await am12Fill(ctx, API_MOCK.SIMULATE_BODY, body, T.fieldFilled);
  await reviewAndRunSimulation(ctx, {
    review: T.payoff,
    beforeRun: T.beforeRun,
    sampleName,
    saveSample: opts.saveSample,
  });
  await am12Reveal(ctx, API_MOCK.SIMULATE_RESULT);
}

/** Run resets Results to Decision trace — open Rendered and hold the wire body. */
async function holdAm12RenderedResponse(ctx: DemoActionContext): Promise<void> {
  const tab = firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)
    ?? document.querySelector<HTMLElement>(API_MOCK.SIMULATE_TAB_RENDERED);
  if (tab) {
    await am12Click(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  const statusSel = firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)
    ? API_MOCK.SIMULATE_RENDERED_STATUS
    : API_MOCK.SIMULATE_OUTCOME;
  const body = firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)
    ?? document.querySelector<HTMLElement>(API_MOCK.SIMULATE_RENDERED_BODY);
  if (body) {
    await am12Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  } else {
    await am12Payoff(ctx, statusSel);
  }
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const newest = journalRows()[0];
  if (newest) await ctx.click(`[data-testid="${newest.getAttribute('data-testid')}"]`);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — a rule holds a set of responses, chosen by a mode. */
export async function runAm12ModeBar(ctx: DemoActionContext): Promise<void> {
  await ensureAm12ResponseTab(ctx);
  await am12Look(ctx, API_MOCK.VARIANT_SIDEBAR);
  await am12Payoff(ctx, API_MOCK.VARIANT_CARD_FIRST);
  await am12Break(ctx);
  await am12Look(ctx, API_MOCK.RESPONSE_MODE_BAR);
  await am12Look(ctx, API_MOCK.RESPONSE_MODE_SEQUENCE);
  await am12Look(ctx, API_MOCK.RESPONSE_MODE_WEIGHTED);
  await am12Look(ctx, API_MOCK.RESPONSE_MODE_STATE);
  await am12Payoff(ctx, API_MOCK.RESPONSE_MODE_RULES);
}

function am12NotFoundCard(): HTMLElement | null {
  return am12VariantCards().find(card => {
    const text = card.textContent ?? '';
    return text.includes('404') || text.includes(AM12_VARIANT_NAME);
  }) ?? firstVisibleElement(API_MOCK.VARIANT_CARD_LAST);
}

async function selectAm12NotFoundCard(ctx: DemoActionContext): Promise<void> {
  const card = am12NotFoundCard();
  const testid = card?.getAttribute('data-testid');
  if (!testid) return;
  await am12Click(ctx, `[data-testid="${testid}"]`, 0);
}

/** Step 2 — a 404 sibling for the not-found case. */
export async function runAm12AddVariant(ctx: DemoActionContext): Promise<void> {
  await ensureAm12ResponseTab(ctx);
  if (am12HasNotFoundVariant() && am12VariantCount() >= 2) {
    await am12Payoff(ctx, API_MOCK.VARIANT_CARD_LAST);
    return;
  }
  await am12Aim(ctx, API_MOCK.ADD_VARIANT);
  await am12Reveal(ctx, API_MOCK.VARIANT_CARD_LAST);
  await am12Reveal(ctx, API_MOCK.VARIANT_NAME);
  await am12Fill(ctx, API_MOCK.VARIANT_NAME, AM12_VARIANT_NAME);
  await am12Aim(ctx, API_MOCK.VARIANT_STATUS_QUICK_404);
  patchApiMockActiveRoute({
    variantIndex: 1,
    variantName: AM12_VARIANT_NAME,
    status: 404,
    body: AM12_ERR_BODY,
    contentType: AM12_CONTENT_JSON,
    isDefault: false,
  });
  await am12Reveal(ctx, API_MOCK.PREVIEW_STATUS);
  await am12Payoff(ctx, API_MOCK.VARIANT_CARD_LAST);
}

/** Step 3 — in rules mode a variant wins on its own conditions. */
export async function runAm12Conditions(ctx: DemoActionContext): Promise<void> {
  await ensureAm12NotFoundVariant(ctx);
  await selectAm12NotFoundCard(ctx);
  await am12Aim(ctx, API_MOCK.RESPONSE_TAB_SELECTION, T.tabSwitch);
  await am12Reveal(ctx, API_MOCK.SELECTION_PANEL);
  await am12Reveal(ctx, API_MOCK.SELECTION_CONDITION_PATH);
  await am12Fill(ctx, API_MOCK.SELECTION_CONDITION_PATH, AM12_JSONPATH);
  await am12Fill(ctx, API_MOCK.SELECTION_CONDITION_VALUE, AM12_SKU_MISSING);
  patchApiMockActiveRoute({
    variantIndex: 1,
    variantConditions: AM12_NOT_FOUND_CONDITIONS,
    isDefault: false,
  });
  await am12Reveal(ctx, API_MOCK.SELECTION_CONDITION);
  await am12Payoff(ctx, API_MOCK.SELECTION_CONDITION);
}

/** Step 4 — exactly one enabled default is the fallback. */
export async function runAm12Default(ctx: DemoActionContext): Promise<void> {
  await ensureAm12Conditions(ctx);
  if (firstVisibleElement(API_MOCK.VARIANT_CARD_FIRST)) {
    await am12Click(ctx, API_MOCK.VARIANT_CARD_FIRST, 0);
  }
  await ensureAm12SelectionTab(ctx);
  await am12Aim(ctx, API_MOCK.SELECTION_DEFAULT);
  patchApiMockActiveRoute({ variantIndex: 0, isDefault: true });
  await am12Reveal(ctx, API_MOCK.VARIANT_DEFAULT_BADGE);
  await am12Payoff(ctx, API_MOCK.VARIANT_DEFAULT_BADGE);
  await am12Payoff(ctx, API_MOCK.SELECTION_DEFAULT_NOTE);
}

/** Step 5 — same path, two answers, decided by payload. */
export async function runAm12ProveRules(ctx: DemoActionContext): Promise<void> {
  await openAm12Simulate(ctx);
  await runAm12Simulation(ctx, AM12_MATCH_BODY, `POST ${AM12_PATH} missing`);
  await holdAm12RenderedResponse(ctx);
  await am12Break(ctx);
  await runAm12Simulation(ctx, AM12_MISS_BODY, `POST ${AM12_PATH} in cart`, { saveSample: false });
  await holdAm12RenderedResponse(ctx);
  await closeAm12Simulate(ctx);
}

/** Step 6 — round-robin: the retry/backoff test mode. */
export async function runAm12Sequence(ctx: DemoActionContext): Promise<void> {
  await closeAm12Simulate(ctx);
  await ensureAm12StudioView(ctx);
  await ensureAm12ResponseTab(ctx);
  await am12Aim(ctx, API_MOCK.RESPONSE_MODE_SEQUENCE);
  patchApiMockActiveRoute({ responseMode: 'sequence' });
  await am12Reveal(ctx, API_MOCK.SEQUENCE_ORDER_NOTE);
  await am12Payoff(ctx, API_MOCK.SEQUENCE_ORDER_NOTE);
  await am12Break(ctx);
  await am12Aim(ctx, API_MOCK.RESPONSE_TAB_SELECTION, T.tabSwitch);
  await am12Reveal(ctx, API_MOCK.SEQUENCE_POSITION);
  await am12Payoff(ctx, API_MOCK.SEQUENCE_POSITION);
}

/** Step 7 — the same request, three different responses. */
export async function runAm12ThreeCalls(ctx: DemoActionContext): Promise<void> {
  await ensureAm12StudioView(ctx);
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am12Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am12Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
  await am12Look(ctx, API_MOCK.GENERATION);

  await sendAm12ProveRequest();
  await ctx.delay(T.journalWrite);
  await am12Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  await am12Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  await am12Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  await clickNewestJournalRow(ctx);
  await am12Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am12Break(ctx);

  await sendAm12ProveRequest();
  await ctx.delay(T.journalWrite);
  await clickNewestJournalRow(ctx);
  await am12Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am12Look(ctx, API_MOCK.TX_RESPONSE);
  await am12Break(ctx);

  await sendAm12ProveRequest();
  await ctx.delay(T.journalWrite);
  await clickNewestJournalRow(ctx);
  await am12Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am12Payoff(ctx, API_MOCK.TX_RESPONSE);
}

/** Step 8 — the live cursor is visible, not guesswork. */
export async function runAm12StateTab(ctx: DemoActionContext): Promise<void> {
  await closeAm12Simulate(ctx);
  if (!am12HasSeqRow() && !hasAm12Traffic()) {
    await sendAm12ProveRequest();
    await ctx.delay(T.journalWrite);
  }
  await openAm12RuntimeState(ctx, true);
  if (firstVisibleElement(API_MOCK.DOCK_STATE) || firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    await am12Reveal(ctx, API_MOCK.DOCK_STATE);
  }
  if (firstVisibleElement(API_MOCK.DOCK_SEQ_ROW) ?? document.querySelector(API_MOCK.DOCK_SEQ_ROW)) {
    await am12Payoff(ctx, API_MOCK.DOCK_SEQ_ROW);
  } else if (firstVisibleElement(API_MOCK.DOCK_STATE_LIVE)) {
    await am12Payoff(ctx, API_MOCK.DOCK_STATE_LIVE);
  } else if (firstVisibleElement(API_MOCK.DOCK_STATE)) {
    await am12Payoff(ctx, API_MOCK.DOCK_STATE);
  }
}
