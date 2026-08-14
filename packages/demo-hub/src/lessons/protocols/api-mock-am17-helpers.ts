/**
 * AM-17 `am-17-proxy-record` helpers — Proxy Passthrough & Record-to-Drafts.
 *
 * Quiet corpus is a blank server. Proxy, allowlist, safety fences, record, and
 * unmatched fallback are authored live against a Docker echo on :4017. Companion
 * required — Start + live fetch is the proof.
 */
import {
  ensureBlankApiMockServer,
  patchApiMockServerSettings,
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
  selectBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

export const AM17_TIMING = {
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

const T = AM17_TIMING;
const REVEAL_MS = 8_000;

export const AM17_ECHO_ORIGIN = 'http://localhost:4017';
export const AM17_ECHO_HEALTH = `${AM17_ECHO_ORIGIN}/health`;
export const AM17_ECHO_PATH = '/widgets/42';
export const AM17_DOCKER_COMMAND = 'cd docker/api-mock && docker compose up -d';

async function am17Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a *new* tab or modal trigger — never the step's reading highlight. */
async function am17Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

/** Click without a second ring — reading already spotlighted this control. */
async function am17ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am17Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am17Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.look, hold });
}

async function am17Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am17Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am17Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am17Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function isAm17StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm17Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function isAm17SettingsOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_MODAL));
}

export function isAm17ProxyPanelOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_PANEL_PROXY));
}

export function isAm17SelectionPanelOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_PANEL_SELECTION));
}

export function isAm17ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function isAm17SwitchOn(selector: string): boolean {
  return firstVisibleElement(selector)?.getAttribute('aria-checked') === 'true';
}

export function isAm17ProxyEnabled(): boolean {
  return isAm17SwitchOn(API_MOCK.SETTINGS_PROXY_ENABLED);
}

export function isAm17PrivateBlocked(): boolean {
  return isAm17SwitchOn(API_MOCK.SETTINGS_PROXY_PRIVATE);
}

export function isAm17ForwardAuthOn(): boolean {
  return isAm17SwitchOn(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
}

export function isAm17RecordOn(): boolean {
  return isAm17SwitchOn(API_MOCK.SETTINGS_PROXY_RECORD);
}

export function am17AllowlistValue(): string {
  const el = firstVisibleElement<HTMLTextAreaElement>(API_MOCK.SETTINGS_PROXY_ALLOWLIST);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

export function hasAm17Allowlist(): boolean {
  return am17AllowlistValue().includes(AM17_ECHO_ORIGIN);
}

export function am17DraftRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.DRAFT_ROUTE));
}

export function hasAm17Draft(): boolean {
  return am17DraftRows().length > 0;
}

export function isAm17RouteEnabled(): boolean {
  const title = firstVisibleElement(API_MOCK.ROUTE_ENABLED)?.getAttribute('title') ?? '';
  return title.toLowerCase().includes('disable');
}

export function hasAm17Traffic(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function am17TxOutcome(): string {
  return firstVisibleElement(API_MOCK.TX_OUTCOME)?.textContent?.trim().toLowerCase() ?? '';
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm17Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const blank = await ensureBlankApiMockServer();
  if (!blank) {
    throw new Error('AM-17: failed to create a blank mock server');
  }
}

export async function cleanupAm17(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Quiet primitives ────────────────────────────────────────────────────────

export async function ensureAm17StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm17StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function ensureAm17Server(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm17StudioView(ctx);
  if (hasAm17Server()) return;
  const created = await ensureBlankApiMockServer();
  if (created) {
    await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
    return;
  }
  if (firstVisibleElement(API_MOCK.CREATE_FIRST)) {
    await ctx.click(API_MOCK.CREATE_FIRST);
    await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
  }
}

export async function closeAm17Settings(ctx: DemoActionContext): Promise<void> {
  if (!isAm17SettingsOpen()) return;
  const close = firstVisibleElement(API_MOCK.SETTINGS_CANCEL) ?? firstVisibleElement(API_MOCK.SETTINGS_SAVE);
  if (!close) return;
  await ctx.click(API_MOCK.SETTINGS_CANCEL);
  await ctx.delay(200);
}

async function openAm17Settings(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm17Server(ctx);
  if (isAm17SettingsOpen()) return;
  if (!firstVisibleElement(API_MOCK.SETTINGS)) return;
  if (visible) await am17ClickNow(ctx, API_MOCK.SETTINGS, T.panelReady);
  else await ctx.click(API_MOCK.SETTINGS);
  if (visible) await am17Reveal(ctx, API_MOCK.SETTINGS_MODAL);
  else await ctx.waitFor(API_MOCK.SETTINGS_MODAL, REVEAL_MS);
}

async function openAm17ProxyTab(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await openAm17Settings(ctx, visible);
  if (isAm17ProxyPanelOpen()) {
    if (visible) await am17Look(ctx, API_MOCK.SETTINGS_PANEL_PROXY);
    return;
  }
  if (!firstVisibleElement(API_MOCK.SETTINGS_TAB_PROXY)) return;
  if (visible) await am17Aim(ctx, API_MOCK.SETTINGS_TAB_PROXY, T.tabSwitch);
  else await ctx.click(API_MOCK.SETTINGS_TAB_PROXY);
  if (visible) await am17Reveal(ctx, API_MOCK.SETTINGS_PANEL_PROXY, T.tabSwitch);
  else await ctx.waitFor(API_MOCK.SETTINGS_PANEL_PROXY, REVEAL_MS);
}

async function openAm17SelectionTab(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await openAm17Settings(ctx, visible);
  if (isAm17SelectionPanelOpen()) {
    if (visible) await am17Look(ctx, API_MOCK.SETTINGS_PANEL_SELECTION);
    return;
  }
  if (!firstVisibleElement(API_MOCK.SETTINGS_TAB_SELECTION)) return;
  if (visible) await am17Aim(ctx, API_MOCK.SETTINGS_TAB_SELECTION, T.tabSwitch);
  else await ctx.click(API_MOCK.SETTINGS_TAB_SELECTION);
  if (visible) await am17Reveal(ctx, API_MOCK.SETTINGS_PANEL_SELECTION, T.tabSwitch);
  else await ctx.waitFor(API_MOCK.SETTINGS_PANEL_SELECTION, REVEAL_MS);
}

async function setAm17Switch(
  ctx: DemoActionContext,
  selector: string,
  on: boolean,
): Promise<void> {
  if (!firstVisibleElement(selector)) return;
  if (isAm17SwitchOn(selector) === on) return;
  await ctx.click(selector);
}

function quietPatchProxy(patch: Parameters<typeof patchApiMockServerSettings>[0]): void {
  patchApiMockServerSettings(patch);
}

async function quietArmProxy(ctx: DemoActionContext): Promise<void> {
  await ensureAm17Server(ctx);
  if (isAm17SettingsOpen()) {
    await openAm17ProxyTab(ctx, false);
    await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_ENABLED, true);
    if (!hasAm17Allowlist() && firstVisibleElement(API_MOCK.SETTINGS_PROXY_ALLOWLIST)) {
      await ctx.fill(API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN);
    }
    await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_PRIVATE, false);
    await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_FORWARD_AUTH, true);
    await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_RECORD, true);
    await openAm17SelectionTab(ctx, false);
    if (firstVisibleElement(API_MOCK.SETTINGS_FALLBACK_MODE)) {
      await ctx.selectOption(API_MOCK.SETTINGS_FALLBACK_MODE, 'proxy');
    }
    if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.SETTINGS_SAVE);
      await ctx.delay(200);
    }
    return;
  }
  quietPatchProxy({
    proxyEnabled: true,
    proxyAllowlist: [AM17_ECHO_ORIGIN],
    proxyBlockPrivate: false,
    proxyForwardAuth: true,
    proxyRecordDrafts: true,
    fallbackMode: 'proxy',
  });
}

export async function ensureAm17Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm17Server(ctx);
  await closeAm17Settings(ctx);
  if (isAm17ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const newest = journalRows()[0];
  const id = newest?.getAttribute('data-testid');
  if (id) await ctx.click(`[data-testid="${id}"]`);
}

async function openJournalOutcome(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS) && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS) && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am17Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) || firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await am17Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  }
  await clickNewestJournalRow(ctx);
  if (firstVisibleElement(API_MOCK.TX_DETAIL) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am17Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am17Payoff(ctx, API_MOCK.TX_OUTCOME);
  }
  if (firstVisibleElement(API_MOCK.TX_RESPONSE_STATUS)) {
    await am17Look(ctx, API_MOCK.TX_RESPONSE_STATUS);
  }
}

async function applyIfPresent(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am17Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am17Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
}

async function selectAm17Draft(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am17DraftRows()[0];
  if (!row) return;
  const id = row.getAttribute('data-testid');
  const selector = id ? `[data-testid="${id}"]` : API_MOCK.DRAFT_ROUTE;
  if (visible) await am17ClickNow(ctx, selector, T.fieldFilled);
  else await ctx.click(selector);
}

async function waitForDraft(ctx: DemoActionContext, tries = 16): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (hasAm17Draft()) return true;
    await ctx.delay(250);
  }
  return hasAm17Draft();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm17ForSafety(ctx: DemoActionContext): Promise<void> {
  await ensureAm17Server(ctx);
  await openAm17ProxyTab(ctx, false);
  await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_ENABLED, true);
  if (!hasAm17Allowlist() && firstVisibleElement(API_MOCK.SETTINGS_PROXY_ALLOWLIST)) {
    await ctx.fill(API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN);
  }
}

export async function ensureAm17ForRecord(ctx: DemoActionContext): Promise<void> {
  await ensureAm17ForSafety(ctx);
  await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_PRIVATE, false);
  await setAm17Switch(ctx, API_MOCK.SETTINGS_PROXY_FORWARD_AUTH, true);
}

export async function ensureAm17ForStart(ctx: DemoActionContext): Promise<void> {
  await quietArmProxy(ctx);
  await closeAm17Settings(ctx);
}

export async function ensureAm17ForProxiedCall(ctx: DemoActionContext): Promise<void> {
  await quietArmProxy(ctx);
  await ensureAm17Running(ctx);
}

export async function ensureAm17ForDraft(ctx: DemoActionContext): Promise<void> {
  await ensureAm17ForProxiedCall(ctx);
  await ensureAm17StudioView(ctx);
}

export async function ensureAm17ForTakeOver(ctx: DemoActionContext): Promise<void> {
  await ensureAm17ForDraft(ctx);
  if (hasAm17Draft()) await selectAm17Draft(ctx, false);
}

export async function ensureAm17ForGuards(ctx: DemoActionContext): Promise<void> {
  await quietArmProxy(ctx);
  await closeAm17Settings(ctx);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — Settings → Proxy, enable, default-deny, allowlist the echo origin.
 * Reading already rang Settings — click it immediately, then aim the Proxy tab.
 */
export async function runAm17ProxyOn(ctx: DemoActionContext): Promise<void> {
  await openAm17Settings(ctx, true);
  await openAm17ProxyTab(ctx, true);
  if (!isAm17ProxyEnabled() && firstVisibleElement(API_MOCK.SETTINGS_PROXY_ENABLED)) {
    await am17Click(ctx, API_MOCK.SETTINGS_PROXY_ENABLED);
  } else if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_ENABLED)) {
    await am17Look(ctx, API_MOCK.SETTINGS_PROXY_ENABLED);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_DENY)) {
    await am17Payoff(ctx, API_MOCK.SETTINGS_PROXY_DENY);
  }
  await am17Break(ctx);
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_ALLOWLIST) && !hasAm17Allowlist()) {
    await am17Fill(ctx, API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN, T.payoff);
  } else if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_ALLOWLIST)) {
    await am17Payoff(ctx, API_MOCK.SETTINGS_PROXY_ALLOWLIST);
  }
}

/**
 * Step 2 — hold the private-network fence, turn it off for the local echo,
 * then opt in to forwarding credential headers.
 */
export async function runAm17ProxySafety(ctx: DemoActionContext): Promise<void> {
  await openAm17ProxyTab(ctx, true);
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_PRIVATE) && isAm17PrivateBlocked()) {
    await am17ClickNow(ctx, API_MOCK.SETTINGS_PROXY_PRIVATE);
  } else if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_PRIVATE)) {
    await am17Look(ctx, API_MOCK.SETTINGS_PROXY_PRIVATE);
  }
  await am17Break(ctx);
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH) && !isAm17ForwardAuthOn()) {
    await am17Click(ctx, API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
  } else if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH)) {
    await am17Payoff(ctx, API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
  }
}

/**
 * Step 3 — record drafts (already on by default — hold, don't flip off),
 * unmatched fallback Proxy, Save.
 */
export async function runAm17RecordAndFallback(ctx: DemoActionContext): Promise<void> {
  await openAm17ProxyTab(ctx, true);
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_RECORD) && !isAm17RecordOn()) {
    await am17ClickNow(ctx, API_MOCK.SETTINGS_PROXY_RECORD);
  } else if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_RECORD)) {
    await am17Look(ctx, API_MOCK.SETTINGS_PROXY_RECORD);
  }
  await am17Break(ctx);
  await openAm17SelectionTab(ctx, true);
  if (firstVisibleElement(API_MOCK.SETTINGS_FALLBACK_MODE)) {
    await am17Select(ctx, API_MOCK.SETTINGS_FALLBACK_MODE, 'proxy');
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await am17Aim(ctx, API_MOCK.SETTINGS_SAVE);
  }
}

/** Step 4 — Start. Reading already rang Start — click immediately. */
export async function runAm17Start(ctx: DemoActionContext): Promise<void> {
  await closeAm17Settings(ctx);
  if (!isAm17ServerRunning() && firstVisibleElement(API_MOCK.START)) {
    await am17ClickNow(ctx, API_MOCK.START, 0);
  }
  if (firstVisibleElement(API_MOCK.STOP) || firstVisibleElement(API_MOCK.START)) {
    await am17Reveal(ctx, API_MOCK.STOP, T.lifecycle);
  }
  if (firstVisibleElement(API_MOCK.STATUS_LABEL)) {
    await am17Payoff(ctx, API_MOCK.STATUS_LABEL);
  }
  if (firstVisibleElement(API_MOCK.ADDRESS)) {
    await am17Payoff(ctx, API_MOCK.ADDRESS);
  }
}

/**
 * Step 5 — fetch an unmocked path. Reading already rang Address — do not re-ring it.
 */
export async function runAm17ProxiedCall(ctx: DemoActionContext): Promise<number | null> {
  const res = await sendApiMockRequest({ path: AM17_ECHO_PATH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await openJournalOutcome(ctx);
  return res?.status ?? null;
}

/** Step 6 — the recorded draft appears in Studio with the echo body. */
export async function runAm17DraftAppears(ctx: DemoActionContext): Promise<void> {
  await ensureAm17StudioView(ctx);
  await waitForDraft(ctx);
  if (hasAm17Draft()) {
    await am17Payoff(ctx, API_MOCK.DRAFT_ROUTE);
    await selectAm17Draft(ctx, true);
  }
  if (firstVisibleElement(API_MOCK.VARIANT_BODY)) {
    await am17Payoff(ctx, API_MOCK.VARIANT_BODY);
  }
}

/** Step 7 — enable the draft, Apply, fetch again — matched, no upstream hop. */
export async function runAm17TakeOver(ctx: DemoActionContext): Promise<void> {
  await ensureAm17StudioView(ctx);
  if (hasAm17Draft()) await selectAm17Draft(ctx, true);
  if (!isAm17RouteEnabled() && firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am17ClickNow(ctx, API_MOCK.ROUTE_ENABLED);
  } else if (firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am17Look(ctx, API_MOCK.ROUTE_ENABLED);
  }
  await applyIfPresent(ctx);
  await sendApiMockRequest({ path: AM17_ECHO_PATH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await openJournalOutcome(ctx);
}

/**
 * Step 8 — 508 loop-guard note, then closest-match as the debugging fallback.
 * Reading already rang Settings — click immediately.
 */
export async function runAm17Guards(ctx: DemoActionContext): Promise<void> {
  await openAm17Settings(ctx, true);
  await openAm17ProxyTab(ctx, true);
  if (firstVisibleElement(API_MOCK.SETTINGS_PROXY_LOOP)) {
    await am17Payoff(ctx, API_MOCK.SETTINGS_PROXY_LOOP);
  }
  await am17Break(ctx);
  await openAm17SelectionTab(ctx, true);
  if (firstVisibleElement(API_MOCK.SETTINGS_FALLBACK_MODE)) {
    await am17Select(ctx, API_MOCK.SETTINGS_FALLBACK_MODE, 'closest_match_debug');
  }
}
