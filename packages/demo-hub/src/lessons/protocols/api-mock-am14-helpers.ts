/**
 * AM-14 `am-14-timing-faults` helpers — When Payments Hang: Latency, Eligibility & Connection Faults.
 *
 * Quiet corpus is `POST /payments` with a plain 200. Delay, jitter, match limits,
 * expiry, probability, and every fault kind are authored in the UI. A retired
 * sibling is seeded quietly so max-matches has somewhere to fall through.
 * The listener is started quietly so Apply is a hot-swap.
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
 * Same slower holds as AM-10…AM-13, plus Simulate review/run holds from AM-06.
 */
export const AM14_TIMING = {
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

const T = AM14_TIMING;

export const AM14_CORPUS_SAMPLE = 'am-gallery-payment';
export const AM14_PATH = '/payments';
export const AM14_METHOD = 'POST';
export const AM14_VARIANT_PAID = 'Paid';
export const AM14_VARIANT_FALLBACK = 'Fallback';
export const AM14_PAID_BODY = '{"ok":true,"id":"pay-1001"}';
export const AM14_FALLBACK_BODY = '{"ok":false,"reason":"retired"}';
export const AM14_CONTENT_JSON = 'application/json';
export const AM14_DELAY = '800';
export const AM14_JITTER = '200';
export const AM14_MAX_MATCHES = '1';
export const AM14_PROBABILITY = '0.5';
/** Abort a timeout-fault fetch so the lesson does not wait the 1h safety cap. */
export const AM14_FETCH_TIMEOUT_MS = 2500;
/**
 * Server-side hold so the journal still writes if `/__proxy` keeps the socket
 * after the browser abort. Must be longer than {@link AM14_FETCH_TIMEOUT_MS}.
 */
export const AM14_TIMEOUT_HOLD_MS = 3200;
const AM14_FAULT_ROW_TRIES = 40;
const AM14_FAULT_ROW_POLL_MS = 200;
const AM14_APPLY_TRIES = 10;
const AM14_APPLY_POLL_MS = 50;

export const AM14_DELAY_BEHAVIOR = {
  delayMs: 800,
  jitterMs: 200,
};

export const AM14_MAX_MATCHES_BEHAVIOR = {
  ...AM14_DELAY_BEHAVIOR,
  maxMatches: 1,
};

/** Fault proves must not fall through to the retired 503 sibling. */
export const AM14_CLEAR_ELIGIBILITY = {
  maxMatches: null,
  expiresAt: null,
  probability: null,
} as const;

/** Timeout hang: drop leftover delay/jitter so journal Duration ≈ Hold for (ms). */
export const AM14_TIMEOUT_BEHAVIOR = {
  fault: 'timeout' as const,
  longRunningMs: AM14_TIMEOUT_HOLD_MS,
  delayMs: 0,
  jitterMs: 0,
  ...AM14_CLEAR_ELIGIBILITY,
};

async function am14Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am14Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am14Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am14Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am14Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am14Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am14Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm14Workspace(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm14RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm14StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm14ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am14VariantCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.VARIANT_CARD));
}

export function am14VariantCount(): number {
  return am14VariantCards().length;
}

export function am14HasSibling(): boolean {
  return am14VariantCount() >= 2;
}

export function isAm14SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function am14SimMethod(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_METHOD)?.getAttribute('data-value') ?? '';
}

export function am14DelayValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_DELAY)?.value?.trim() ?? '';
}

export function am14JitterValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_JITTER)?.value?.trim() ?? '';
}

export function am14HasDelayAndJitter(): boolean {
  return am14DelayValue() === AM14_DELAY && am14JitterValue() === AM14_JITTER;
}

export function am14MaxMatchesValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_MAX_MATCHES)?.value?.trim() ?? '';
}

export function am14HasMaxMatches(): boolean {
  return am14MaxMatchesValue() === AM14_MAX_MATCHES;
}

export function am14HasExpiry(): boolean {
  const display = firstVisibleElement(API_MOCK.EXPIRES_DISPLAY)?.textContent ?? '';
  return Boolean(display.trim()) && !/not set/i.test(display);
}

export function am14ProbabilityValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_PROBABILITY)?.value?.trim() ?? '';
}

export function am14HasEligibility(): boolean {
  return am14HasExpiry() && am14ProbabilityValue() === AM14_PROBABILITY;
}

export function am14FaultSelected(id: string): boolean {
  return firstVisibleElement(API_MOCK.fault(id))?.classList.contains('selected') === true;
}

export function am14HasTimeoutFault(): boolean {
  return am14FaultSelected('timeout');
}

export function am14HasResetFault(): boolean {
  return am14FaultSelected('reset');
}

export function am14HasDribbleFault(): boolean {
  return am14FaultSelected('dribble') && Boolean(firstVisibleElement(API_MOCK.CHUNK_SCHEDULE));
}

export function hasAm14Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

function journalRowStatus(row: HTMLElement): string {
  return (row.querySelector('.am-tx-status')?.textContent ?? row.textContent ?? '').trim().toLowerCase();
}

/** Timeout / reset faults journal as outcome `fault` with status 0 — never a 503. */
function isAm14FaultJournalRow(row: HTMLElement): boolean {
  const text = (row.textContent ?? '').toLowerCase();
  if (text.includes('503') || text.includes('retired')) return false;
  const status = journalRowStatus(row);
  return status === '0' || status === 'fault' || /\bfault\b/.test(text);
}

function am14FaultJournalRow(): HTMLElement | undefined {
  return journalRows().find(isAm14FaultJournalRow);
}

async function waitForAm14FaultJournalRow(ctx: DemoActionContext): Promise<HTMLElement | undefined> {
  for (let i = 0; i < AM14_FAULT_ROW_TRIES; i++) {
    const row = am14FaultJournalRow();
    if (row) return row;
    await ctx.delay(AM14_FAULT_ROW_POLL_MS);
  }
  return am14FaultJournalRow();
}

function seedFallbackVariant(): void {
  patchApiMockActiveRoute({
    addVariant: true,
    variantName: AM14_VARIANT_FALLBACK,
    status: 503,
    body: AM14_FALLBACK_BODY,
    contentType: AM14_CONTENT_JSON,
    isDefault: false,
  });
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm14Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM14_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-14: failed to import ${AM14_CORPUS_SAMPLE}`);
  }
  prepareApiMockStudioChrome();
}

export async function cleanupAm14(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm14StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm14StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function closeAm14Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm14SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 400 });
}

export async function ensureAm14Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm14StudioView(ctx);
  await closeAm14Simulate(ctx);
  if (!hasAm14Workspace()) {
    const imported = await importApiMockGallerySample(AM14_CORPUS_SAMPLE);
    if (!imported) {
      throw new Error(`AM-14: failed to import ${AM14_CORPUS_SAMPLE}`);
    }
    await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
  }
  await ensureAm14RuleOpen(ctx);
  await ensureAm14ResponseTab(ctx);
  await ensureAm14Running(ctx);
}

export async function ensureAm14RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm14StudioView(ctx);
  if (hasAm14RouteEditor()) return;
  const row = firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.FIRST_ROUTE);
  if (!row) return;
  await ctx.click(API_MOCK.ROUTE_ROW);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

export async function ensureAm14ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm14RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_BAR) ?? firstVisibleElement(API_MOCK.ADD_VARIANT)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.waitFor(API_MOCK.RESPONSE_EDITOR, 6_000);
}

export async function ensureAm14TimingTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ResponseTab(ctx);
  if (firstVisibleElement(API_MOCK.TIMING_PANEL)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_TIMING)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_TIMING);
  await ctx.waitFor(API_MOCK.TIMING_PANEL, 6_000);
}

export async function ensureAm14FaultsTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ResponseTab(ctx);
  if (firstVisibleElement(API_MOCK.FAULTS_PANEL)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_FAULTS)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_FAULTS);
  await ctx.waitFor(API_MOCK.FAULTS_PANEL, 6_000);
}

export async function ensureAm14Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm14StudioView(ctx);
  if (isAm14ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm14Sibling(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ResponseTab(ctx);
  if (am14HasSibling()) return;
  seedFallbackVariant();
  await ctx.waitFor(API_MOCK.VARIANT_CARD_LAST, 6_000);
}

export async function ensureAm14Delay(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Workspace(ctx);
  await ensureAm14TimingTab(ctx);
  if (am14HasDelayAndJitter()) return;
  patchApiMockActiveRoute({ variantIndex: 0, behavior: AM14_DELAY_BEHAVIOR });
}

export async function ensureAm14MaxMatches(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Delay(ctx);
  await ensureAm14Sibling(ctx);
  await ensureAm14TimingTab(ctx);
  if (am14HasMaxMatches()) return;
  patchApiMockActiveRoute({ variantIndex: 0, behavior: AM14_MAX_MATCHES_BEHAVIOR });
}

export async function ensureAm14Eligibility(ctx: DemoActionContext): Promise<void> {
  await ensureAm14MaxMatches(ctx);
  await closeAm14Simulate(ctx);
  await ensureAm14TimingTab(ctx);
  if (am14HasEligibility()) return;
  patchApiMockActiveRoute({
    variantIndex: 0,
    behavior: {
      ...AM14_MAX_MATCHES_BEHAVIOR,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      probability: 0.5,
    },
  });
}

export async function ensureAm14ForPreview(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Delay(ctx);
  await closeAm14Simulate(ctx);
}

export async function ensureAm14ForMaxMatches(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Delay(ctx);
  await ensureAm14Sibling(ctx);
  await closeAm14Simulate(ctx);
  await resetAm14Runtime(ctx);
}

export async function ensureAm14ForFaults(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Eligibility(ctx);
  await closeAm14Simulate(ctx);
  await ensureAm14FaultsTab(ctx);
}

export async function ensureAm14ForTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ForFaults(ctx);
  // Live faults must not coin-flip, fall through to 503, or add leftover delay to Duration.
  patchApiMockActiveRoute({ variantIndex: 0, behavior: { delayMs: 0, jitterMs: 0, ...AM14_CLEAR_ELIGIBILITY } });
  await resetAm14Runtime(ctx);
}

export async function ensureAm14ForReset(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ForTimeout(ctx);
  if (!am14HasTimeoutFault()) {
    patchApiMockActiveRoute({ variantIndex: 0, behavior: { fault: 'timeout' } });
  }
  await resetAm14Runtime(ctx);
}

export async function ensureAm14ForDribble(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ForReset(ctx);
  if (!am14HasResetFault()) {
    patchApiMockActiveRoute({ variantIndex: 0, behavior: { fault: 'reset' } });
  }
  await closeAm14Simulate(ctx);
}

async function resetAm14Runtime(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.STATE_RESET) && !firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    const runtimeSel = firstVisibleElement(API_MOCK.VIEW_RUNTIME)
      ? API_MOCK.VIEW_RUNTIME
      : firstVisibleElement(API_MOCK.OPEN_RUNTIME)
        ? API_MOCK.OPEN_RUNTIME
        : null;
    if (runtimeSel) {
      await ctx.click(runtimeSel);
      await ctx.delay(200);
    }
  }
  if (!firstVisibleElement(API_MOCK.STATE_RESET) && firstVisibleElement(API_MOCK.DOCK_TAB_STATE)) {
    await ctx.click(API_MOCK.DOCK_TAB_STATE);
    await ctx.waitFor(API_MOCK.STATE_RESET, 4_000);
  }
  if (firstVisibleElement(API_MOCK.STATE_RESET)) {
    await ctx.click(API_MOCK.STATE_RESET);
    await ctx.delay(300);
  }
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
  }
}

async function selectAm14Card(ctx: DemoActionContext, which: 'first' | 'last'): Promise<void> {
  const selector = which === 'first' ? API_MOCK.VARIANT_CARD_FIRST : API_MOCK.VARIANT_CARD_LAST;
  if (!firstVisibleElement(selector)) return;
  await am14Click(ctx, selector, 0);
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const newest = journalRows()[0];
  if (newest) await ctx.click(`[data-testid="${newest.getAttribute('data-testid')}"]`);
}

async function clickJournalRow(ctx: DemoActionContext, row: HTMLElement): Promise<void> {
  const id = row.getAttribute('data-testid');
  if (id) await ctx.click(`[data-testid="${id}"]`);
}

async function openAm14RuntimeTransactions(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS) && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    const runtimeSel = firstVisibleElement(API_MOCK.VIEW_RUNTIME)
      ? API_MOCK.VIEW_RUNTIME
      : firstVisibleElement(API_MOCK.OPEN_RUNTIME)
        ? API_MOCK.OPEN_RUNTIME
        : null;
    if (runtimeSel) {
      await ctx.click(runtimeSel);
      await ctx.delay(200);
    }
  }
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
  }
}

export async function sendAm14ProveRequest(timeoutMs?: number): Promise<void> {
  await sendApiMockRequest({
    path: AM14_PATH,
    method: AM14_METHOD,
    ...(timeoutMs != null ? { timeoutMs } : {}),
  });
}

async function applyIfDirty(ctx: DemoActionContext): Promise<void> {
  for (let i = 0; i < AM14_APPLY_TRIES && !firstVisibleElement(API_MOCK.APPLY); i++) {
    await ctx.delay(AM14_APPLY_POLL_MS);
  }
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am14Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am14Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
}

async function openJournalDetail(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await am14Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
    await am14Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  } else {
    await openAm14RuntimeTransactions(ctx);
  }
  await am14Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  await clickNewestJournalRow(ctx);
  await am14Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
}

/** Timeout / reset prove — wait for a fault row; never select the old 503. */
async function openFaultJournalDetail(ctx: DemoActionContext): Promise<boolean> {
  await openAm14RuntimeTransactions(ctx);
  const row = await waitForAm14FaultJournalRow(ctx);
  if (!row) return false;
  await clickJournalRow(ctx, row);
  await am14Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  return true;
}

async function openAm14Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm14SimulateOpen()) return;
  await am14Aim(ctx, API_MOCK.SIMULATE);
  await am14Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

async function runAm14Simulation(ctx: DemoActionContext, sampleName: string): Promise<void> {
  await openAm14Simulate(ctx);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am14SimMethod() !== AM14_METHOD && firstVisibleElement(API_MOCK.SIMULATE_METHOD)) {
    await selectBeat(ctx, API_MOCK.SIMULATE_METHOD, AM14_METHOD, { look: T.beforeOpen, hold: T.fieldFilled });
  }
  await am14Fill(ctx, API_MOCK.SIMULATE_PATH, AM14_PATH);
  await reviewAndRunSimulation(ctx, {
    review: T.payoff,
    beforeRun: T.beforeRun,
    sampleName,
  });
  await am14Reveal(ctx, API_MOCK.SIMULATE_RESULT, T.simOutcome);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — resilience testing needs slow, not just 500. */
export async function runAm14DelayAndJitter(ctx: DemoActionContext): Promise<void> {
  await ensureAm14ResponseTab(ctx);
  await selectAm14Card(ctx, 'first');
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_TIMING)) {
    await am14Aim(ctx, API_MOCK.RESPONSE_TAB_TIMING, T.tabSwitch);
  }
  await am14Reveal(ctx, API_MOCK.TIMING_PANEL);
  await am14Fill(ctx, API_MOCK.VARIANT_DELAY, AM14_DELAY);
  await am14Fill(ctx, API_MOCK.VARIANT_JITTER, AM14_JITTER);
  patchApiMockActiveRoute({ variantIndex: 0, behavior: AM14_DELAY_BEHAVIOR });
  await am14Payoff(ctx, API_MOCK.TIMING_SPREAD);
}

/** Step 2 — Simulate previews latency without waiting; live traffic pays it. */
export async function runAm14PreviewThenProve(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Delay(ctx);
  await runAm14Simulation(ctx, `POST ${AM14_PATH} — delay`);
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am14Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  const delayBadge = firstVisibleElement(API_MOCK.SIMULATE_VIRTUAL_DELAY)
    ? API_MOCK.SIMULATE_VIRTUAL_DELAY
    : API_MOCK.SIMULATE_TIMELINE_DELAY;
  await am14Payoff(ctx, delayBadge);
  await am14Break(ctx);
  await closeAm14Simulate(ctx, { review: true });

  await applyIfDirty(ctx);
  await sendAm14ProveRequest();
  await ctx.delay(T.journalWrite);
  await openJournalDetail(ctx);
  const detailDuration = firstVisibleElement(API_MOCK.TX_DETAIL_DURATION)
    ? API_MOCK.TX_DETAIL_DURATION
    : API_MOCK.TX_DETAIL;
  await am14Payoff(ctx, detailDuration);
  if (firstVisibleElement(API_MOCK.TX_DURATION)) {
    await am14Payoff(ctx, API_MOCK.TX_DURATION);
  }
}

/** Step 3 — retire a variant after N hits. */
export async function runAm14MaxMatches(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Delay(ctx);
  await ensureAm14Sibling(ctx);
  await selectAm14Card(ctx, 'first');
  await ensureAm14TimingTab(ctx);
  await am14Fill(ctx, API_MOCK.VARIANT_MAX_MATCHES, AM14_MAX_MATCHES);
  patchApiMockActiveRoute({ variantIndex: 0, behavior: AM14_MAX_MATCHES_BEHAVIOR });
  await am14Payoff(ctx, API_MOCK.VARIANT_MAX_MATCHES);
  await am14Break(ctx);

  await applyIfDirty(ctx);
  await resetAm14Runtime(ctx);

  await sendAm14ProveRequest();
  await ctx.delay(T.journalWrite);
  await openJournalDetail(ctx);
  const firstOutcome = firstVisibleElement(API_MOCK.TX_RESPONSE) ? API_MOCK.TX_RESPONSE : API_MOCK.TX_DETAIL;
  await am14Look(ctx, API_MOCK.VARIANT_CARD_FIRST);
  await am14Payoff(ctx, firstOutcome);
  await am14Break(ctx);

  await sendAm14ProveRequest();
  await ctx.delay(T.journalWrite);
  await clickNewestJournalRow(ctx);
  await am14Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  const secondOutcome = firstVisibleElement(API_MOCK.TX_RESPONSE) ? API_MOCK.TX_RESPONSE : API_MOCK.TX_DETAIL;
  await am14Look(ctx, API_MOCK.VARIANT_CARD_LAST);
  await am14Payoff(ctx, secondOutcome);
}

/** Step 4 — time-boxed and deliberately flaky. */
export async function runAm14ExpiresAndProbability(ctx: DemoActionContext): Promise<void> {
  await ensureAm14MaxMatches(ctx);
  await selectAm14Card(ctx, 'first');
  await ensureAm14TimingTab(ctx);
  if (firstVisibleElement(API_MOCK.EXPIRES_QUICK_1H)) {
    await am14Aim(ctx, API_MOCK.EXPIRES_QUICK_1H);
  }
  const expires = firstVisibleElement(API_MOCK.EXPIRES_DISPLAY)
    ? API_MOCK.EXPIRES_DISPLAY
    : API_MOCK.VARIANT_EXPIRES_AT;
  await am14Payoff(ctx, expires);
  await am14Break(ctx);
  await am14Fill(ctx, API_MOCK.VARIANT_PROBABILITY, AM14_PROBABILITY);
  patchApiMockActiveRoute({
    variantIndex: 0,
    behavior: {
      ...AM14_MAX_MATCHES_BEHAVIOR,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      probability: 0.5,
    },
  });
  await am14Payoff(ctx, API_MOCK.ELIGIBILITY_SUMMARY);
}

/** Step 5 — faults live below HTTP. */
export async function runAm14FaultsPanel(ctx: DemoActionContext): Promise<void> {
  await ensureAm14Eligibility(ctx);
  await closeAm14Simulate(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_FAULTS)) {
    await am14Aim(ctx, API_MOCK.RESPONSE_TAB_FAULTS, T.tabSwitch);
  }
  await am14Reveal(ctx, API_MOCK.FAULTS_PANEL);
  await am14Look(ctx, API_MOCK.FAULT_TIMEOUT);
  await am14Look(ctx, API_MOCK.FAULT_RESET);
  await am14Look(ctx, API_MOCK.FAULT_CLOSE);
  await am14Look(ctx, API_MOCK.FAULT_MALFORMED);
  await am14Look(ctx, API_MOCK.FAULT_DRIBBLE);
  await am14Payoff(ctx, API_MOCK.FAULTS_PANEL);
}

/** Step 6 — hold the socket, never answer. */
export async function runAm14Timeout(ctx: DemoActionContext): Promise<void> {
  await ensureAm14FaultsTab(ctx);
  await selectAm14Card(ctx, 'first');
  await am14Aim(ctx, API_MOCK.FAULT_TIMEOUT);
  patchApiMockActiveRoute({
    variantIndex: 0,
    behavior: AM14_TIMEOUT_BEHAVIOR,
  });
  await am14Payoff(ctx, API_MOCK.FAULT_TIMEOUT);
  if (firstVisibleElement(API_MOCK.FAULT_TIMEOUT_HOLD)) {
    await am14Payoff(ctx, API_MOCK.FAULT_TIMEOUT_HOLD);
  }
  await am14Break(ctx);

  await applyIfDirty(ctx);
  await resetAm14Runtime(ctx);
  await sendAm14ProveRequest(AM14_FETCH_TIMEOUT_MS);
  const opened = await openFaultJournalDetail(ctx);
  if (!opened) return;
  const outcome = firstVisibleElement(API_MOCK.TX_OUTCOME) ? API_MOCK.TX_OUTCOME : API_MOCK.TX_DETAIL;
  await am14Payoff(ctx, outcome);
  const detailDuration = firstVisibleElement(API_MOCK.TX_DETAIL_DURATION)
    ? API_MOCK.TX_DETAIL_DURATION
    : API_MOCK.TX_DETAIL;
  await am14Payoff(ctx, detailDuration);
  if (firstVisibleElement(API_MOCK.TX_DURATION)) {
    await am14Payoff(ctx, API_MOCK.TX_DURATION);
  }
}

/** Step 7 — TCP-level failures the client's retry logic must survive. */
export async function runAm14ResetCloseMalformed(ctx: DemoActionContext): Promise<void> {
  await ensureAm14FaultsTab(ctx);
  await am14Aim(ctx, API_MOCK.FAULT_RESET);
  patchApiMockActiveRoute({
    variantIndex: 0,
    behavior: { fault: 'reset', delayMs: 0, jitterMs: 0, ...AM14_CLEAR_ELIGIBILITY },
  });
  await am14Payoff(ctx, API_MOCK.FAULT_RESET);
  await am14Break(ctx);

  await applyIfDirty(ctx);
  await resetAm14Runtime(ctx);
  await sendAm14ProveRequest();
  const opened = await openFaultJournalDetail(ctx);
  if (!opened) {
    await am14Look(ctx, API_MOCK.FAULT_CLOSE);
    await am14Look(ctx, API_MOCK.FAULT_MALFORMED);
    return;
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am14Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
  const outcome = firstVisibleElement(API_MOCK.TX_OUTCOME) ? API_MOCK.TX_OUTCOME : API_MOCK.TX_DETAIL;
  await am14Payoff(ctx, outcome);
  const detailDuration = firstVisibleElement(API_MOCK.TX_DETAIL_DURATION)
    ? API_MOCK.TX_DETAIL_DURATION
    : API_MOCK.TX_DETAIL;
  await am14Payoff(ctx, detailDuration);
  if (firstVisibleElement(API_MOCK.TX_DURATION)) {
    await am14Payoff(ctx, API_MOCK.TX_DURATION);
  }
  await am14Break(ctx);
  // Empty / close + Malformed — the other two wire-break cards beside Reset.
  await am14Look(ctx, API_MOCK.FAULT_CLOSE);
  await am14Look(ctx, API_MOCK.FAULT_MALFORMED);
}

/** Step 8 — drip the body in scheduled chunks, then read the timeline. */
export async function runAm14DribbleAndTimeline(ctx: DemoActionContext): Promise<void> {
  await ensureAm14FaultsTab(ctx);
  await am14Aim(ctx, API_MOCK.FAULT_DRIBBLE);
  patchApiMockActiveRoute({ variantIndex: 0, behavior: { fault: 'dribble', ...AM14_CLEAR_ELIGIBILITY } });
  await am14Reveal(ctx, API_MOCK.CHUNK_SCHEDULE);
  if (firstVisibleElement(API_MOCK.CHUNK_ADD)) {
    await am14Aim(ctx, API_MOCK.CHUNK_ADD);
    await am14Aim(ctx, API_MOCK.CHUNK_ADD);
  }
  await am14Payoff(ctx, API_MOCK.CHUNK_SCHEDULE);
  await am14Break(ctx);

  await runAm14Simulation(ctx, `POST ${AM14_PATH} — dribble`);
  // Rendered response — On the wire vs Intended body is the lesson payoff.
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am14Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  await am14Reveal(ctx, API_MOCK.SIMULATE_RENDERED, T.simOutcome);
  if (firstVisibleElement(API_MOCK.SIMULATE_DRIBBLE_NOTICE)) {
    await am14Look(ctx, API_MOCK.SIMULATE_DRIBBLE_NOTICE);
  }
  const wire = firstVisibleElement(API_MOCK.SIMULATE_WIRE_SECTION)
    ? API_MOCK.SIMULATE_WIRE_SECTION
    : (firstVisibleElement(API_MOCK.SIMULATE_WIRE_BODY)
      ? API_MOCK.SIMULATE_WIRE_BODY
      : API_MOCK.SIMULATE_RENDERED);
  await am14Payoff(ctx, wire);
  await am14Break(ctx);
  const intended = firstVisibleElement(API_MOCK.SIMULATE_INTENDED_SECTION)
    ? API_MOCK.SIMULATE_INTENDED_SECTION
    : (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)
      ? API_MOCK.SIMULATE_RENDERED_BODY
      : API_MOCK.SIMULATE_RENDERED);
  await am14Payoff(ctx, intended);
  await am14Break(ctx);
  const timeline = firstVisibleElement(API_MOCK.SIMULATE_FAULT_TIMELINE)
    ? API_MOCK.SIMULATE_FAULT_TIMELINE
    : (firstVisibleElement(API_MOCK.SIMULATE_TIMELINE_FAULT)
      ? API_MOCK.SIMULATE_TIMELINE_FAULT
      : API_MOCK.SIMULATE_RESULT);
  await am14Payoff(ctx, timeline);
  // Leave Simulate open on Rendered — last-step payoff is wire vs intended.
}
