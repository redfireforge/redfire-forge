/**
 * AM-19 `am-19-runtime-ops` helpers — Runtime Ops: CORS, Limits, Redaction,
 * Diagnostics & Console.
 *
 * Quiet corpus is the store library, started. CORS, limits, redaction, persist,
 * transforms, and callbacks are authored in the UI. Companion required —
 * Start + live fetch is the proof. No Docker.
 */
import {
  importApiMockGallerySample,
  patchApiMockServerSettings,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import { showSpotlightRing } from '../../demoRipple';
import {
  findScrollableParent,
  markDemoProgrammaticScroll,
  pauseDemoAutoScroll,
} from '../../demoSpotlightUtils';
import {
  clickBeat,
  fillBeat,
  openApiMockFromActivityBar,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

export const AM19_TIMING = {
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

const T = AM19_TIMING;
const REVEAL_MS = 8_000;

export const AM19_CORPUS_SAMPLE = 'am-gallery-store';
export const AM19_CORS_ORIGIN = 'http://localhost:5173';
export const AM19_INBOUND = '2097152';
export const AM19_CONN = '50';
export const AM19_DRAIN = '8000';
export const AM19_REDACT_HEADERS = 'authorization';
export const AM19_REDACT_PATHS = '$.password';
export const AM19_CART_PATH = '/cart/items';
export const AM19_AUTH_VALUE = 'Bearer s3cret-token';
export const AM19_PASSWORD_BODY = '{"password":"hunter2"}';
export const AM19_PRODUCTS = '/products';
export const AM19_CALLBACK_URL = 'https://hooks.example.com/mock-event';
export const AM19_CALLBACK_BODY = '{"event":"mock.matched","path":"{{request.path}}"}';
export const AM19_CALLBACK_RETRIES = '2';
export const AM19_TRANSFORM_HEADER = 'X-Mocked-By';

async function am19Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a *new* tab or modal trigger — never the step's reading highlight. */
async function am19Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

/** Click without a second ring — reading already spotlighted this control. */
async function am19ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am19FillNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.fill(selector, value);
  await ctx.delay(hold);
}

async function am19AimFill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am19Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am19Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am19Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am19Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

/** Pin the editor pane to its bottom so Callbacks stay in view. Never scroll back up. */
async function am19ScrollEditorToBottom(ctx: DemoActionContext): Promise<void> {
  const bodyEl = document.querySelector<HTMLElement>(API_MOCK.CALLBACK_BODY_FIRST);
  const scrollParent = (bodyEl && findScrollableParent(bodyEl))
    ?? document.querySelector<HTMLElement>('.am-editor-body');
  markDemoProgrammaticScroll(1_000);
  if (scrollParent) {
    scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: 'smooth' });
  } else {
    bodyEl?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }
  pauseDemoAutoScroll(12_000);
  await ctx.delay(T.panelReady);
}

/** Fill + ring a field that is already on screen — no scrollIntoView. */
async function am19FillPinned(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await ctx.fill(selector, value);
  await ctx.delay(hold);
  const dispose = showSpotlightRing(el);
  await ctx.delay(hold);
  dispose();
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function isAm19StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm19RuntimeViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.RUNTIME_PAGE) ?? firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS));
}

export function hasAm19Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm19Library(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR) && firstVisibleElement(API_MOCK.ROUTE_ROW));
}

/**
 * The runtime banner shows this when the companion lost the listener — e.g. the
 * dev server restarted mid-session and its in-memory pool is empty. The status
 * badge can still read "Running" (it only re-reconciles on a full page load), so
 * a demo guard that trusts the badge alone would skip recovery and every live
 * `send` / journal / diagnostics call would silently fail against a dead port.
 */
export function isAm19CompanionUnavailable(): boolean {
  const notice = (firstVisibleElement(API_MOCK.LIVE_REGION)?.textContent ?? '').toLowerCase();
  return notice.includes('not reachable')
    || notice.includes('companion unavailable')
    || notice.includes('start it, then retry');
}

export function isAm19ServerRunning(): boolean {
  // A stale "Running" badge over an unreachable companion is not actually live.
  if (isAm19CompanionUnavailable()) return false;
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function isAm19ToggleOn(selector: string): boolean {
  return firstVisibleElement(selector)?.getAttribute('aria-checked') === 'true';
}

export function am19InputValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value : '';
}

export function isAm19CorsOn(): boolean {
  return isAm19ToggleOn(API_MOCK.RUNTIME_SETTINGS_CORS);
}

export function isAm19PersistOn(): boolean {
  return isAm19ToggleOn(API_MOCK.RUNTIME_SETTINGS_PERSIST);
}

export function hasAm19Limits(): boolean {
  return am19InputValue(API_MOCK.RUNTIME_SETTINGS_DRAIN).includes(AM19_DRAIN)
    || am19InputValue(API_MOCK.RUNTIME_SETTINGS_INBOUND).includes(AM19_INBOUND);
}

export function hasAm19RedactionConfig(): boolean {
  return am19InputValue(API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS).includes('$.password');
}

export function hasAm19Traffic(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function am19JournalCount(): number {
  const badge = firstVisibleElement(API_MOCK.LIVE_TX_COUNT);
  const n = parseInt((badge?.textContent ?? '').trim(), 10);
  if (Number.isFinite(n)) return n;
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW)).length;
}

export function hasAm19RedactedDetail(): boolean {
  const req = firstVisibleElement(API_MOCK.TX_REQUEST)?.textContent ?? '';
  return req.includes('[REDACTED]') || req.includes('***');
}

export function hasAm19Diagnostics(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.DIAG_MATCH_P95) ?? firstVisibleElement(API_MOCK.DIAG_OUTCOMES));
}

export function hasAm19ConsoleLines(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.CONSOLE_LINE) ?? firstVisibleElement(API_MOCK.CONSOLE));
}

export function hasAm19Transform(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.TRANSFORM_ROW));
}

export function hasAm19Callback(): boolean {
  return am19InputValue(API_MOCK.CALLBACK_URL_FIRST).includes('http');
}

export function hasAm19TransformHeader(): boolean {
  const res = firstVisibleElement(API_MOCK.TX_RESPONSE)?.textContent ?? '';
  return /x-mocked-by/i.test(res);
}

export function isAm19SettingsOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_MODAL));
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

function rowSelector(row: HTMLElement | undefined): string | undefined {
  const id = row?.getAttribute('data-testid');
  return id ? `[data-testid="${id}"]` : undefined;
}

function productsListRow(): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_PATH))
    .find(el => (el.textContent ?? '').trim() === AM19_PRODUCTS)
    ?.closest<HTMLElement>('button.am-route-item') ?? undefined;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm19Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM19_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-19: failed to import ${AM19_CORPUS_SAMPLE}`);
  }
}

export async function cleanupAm19(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Quiet primitives ────────────────────────────────────────────────────────

export async function ensureAm19OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm19Server() || firstVisibleElement(API_MOCK.STUDIO) || firstVisibleElement(API_MOCK.RUNTIME_PAGE)) {
    return;
  }
  if (await openApiMockFromActivityBar(ctx)) return;
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

export async function ensureAm19StudioView(ctx: DemoActionContext): Promise<void> {
  await ensureAm19OnApiMock(ctx);
  if (isAm19StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm19Library(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm19StudioView(ctx);
  if (hasAm19Library()) return;
  const imported = await importApiMockGallerySample(AM19_CORPUS_SAMPLE);
  if (imported) await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function ensureAm19Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm19Library(ctx);
  if (isAm19ServerRunning()) return;
  // Cold start — the badge reads "Stopped" and Start is available.
  if (firstVisibleElement(API_MOCK.START)) {
    await ctx.click(API_MOCK.START);
    await ctx.waitFor(API_MOCK.STOP, 20_000);
    await settleAm19Running(ctx);
    return;
  }
  // Badge says "Running" but the companion lost the listener (Start is hidden in
  // that state). Restart re-creates the listener on a live port so the following
  // send / journal / diagnostics steps have real traffic to show.
  if (firstVisibleElement(API_MOCK.RESTART)) {
    await ctx.click(API_MOCK.RESTART);
    await settleAm19Running(ctx);
  }
}

/** Poll until the companion confirms the listener is live again (or give up). */
async function settleAm19Running(ctx: DemoActionContext): Promise<void> {
  for (let i = 0; i < 16; i++) {
    if (isAm19ServerRunning()) return;
    await ctx.delay(500);
  }
}

export async function closeAm19SettingsModal(ctx: DemoActionContext): Promise<void> {
  if (!isAm19SettingsOpen()) return;
  if (firstVisibleElement(API_MOCK.SETTINGS_CANCEL)) {
    await ctx.click(API_MOCK.SETTINGS_CANCEL);
    await ctx.delay(200);
    return;
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await ctx.click(API_MOCK.SETTINGS_SAVE);
    await ctx.delay(200);
  }
}

async function applyIfDirty(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(API_MOCK.APPLY) && !firstVisibleElement(API_MOCK.DIRTY_BADGE)) return;
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE) && visible) {
    await am19Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (!firstVisibleElement(API_MOCK.APPLY)) return;
  if (visible) await am19Aim(ctx, API_MOCK.APPLY);
  else await ctx.click(API_MOCK.APPLY);
  await ctx.delay(visible ? T.lifecycle : 400);
}

async function saveRuntimeSettings(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) return;
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_DIRTY) || visible) {
    if (visible) await am19Aim(ctx, API_MOCK.RUNTIME_SETTINGS_SAVE, T.fieldFilled);
    else await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
  }
}

async function openRuntimeSettings(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm19OnApiMock(ctx);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_PANEL)) return;
  if (isAm19RuntimeViewActive() && firstVisibleElement(API_MOCK.DOCK_TAB_SETTINGS)) {
    if (visible) await am19Aim(ctx, API_MOCK.DOCK_TAB_SETTINGS, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_SETTINGS);
    if (visible) await am19Reveal(ctx, API_MOCK.RUNTIME_SETTINGS_PANEL, T.tabSwitch);
    else await ctx.waitFor(API_MOCK.RUNTIME_SETTINGS_PANEL, REVEAL_MS).catch(() => undefined);
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_SETTINGS)) {
    if (visible) await am19Aim(ctx, API_MOCK.LIVE_SETTINGS, T.tabSwitch);
    else await ctx.click(API_MOCK.LIVE_SETTINGS);
    if (visible) await am19Reveal(ctx, API_MOCK.RUNTIME_SETTINGS_PANEL, T.tabSwitch);
    else await ctx.waitFor(API_MOCK.RUNTIME_SETTINGS_PANEL, REVEAL_MS).catch(() => undefined);
    return;
  }
  if (firstVisibleElement(API_MOCK.VIEW_RUNTIME)) {
    if (visible) await am19Aim(ctx, API_MOCK.VIEW_RUNTIME, T.tabSwitch);
    else await ctx.click(API_MOCK.VIEW_RUNTIME);
    if (firstVisibleElement(API_MOCK.DOCK_TAB_SETTINGS)) {
      if (visible) await am19Aim(ctx, API_MOCK.DOCK_TAB_SETTINGS, T.tabSwitch);
      else await ctx.click(API_MOCK.DOCK_TAB_SETTINGS);
    }
  }
}

async function openJournal(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm19OnApiMock(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (isAm19RuntimeViewActive() && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    if (visible) await am19Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    if (visible) await am19Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  }
}

async function clickNewestJournalRow(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = journalRows()[0];
  const selector = rowSelector(row) ?? API_MOCK.JOURNAL_FIRST_ROW;
  if (!firstVisibleElement(selector)) return;
  if (visible) await am19Click(ctx, selector, T.fieldFilled);
  else await ctx.click(selector);
  if (visible && firstVisibleElement(API_MOCK.TX_DETAIL)) {
    await am19Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
}

async function selectProductsList(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm19StudioView(ctx);
  const row = productsListRow();
  const id = row?.getAttribute('data-testid');
  if (!id) return;
  const selector = `[data-testid="${id}"]`;
  if (visible) await am19Click(ctx, selector);
  else await ctx.click(selector);
}

async function openOutbound(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await closeAm19SettingsModal(ctx);
  await ensureAm19StudioView(ctx);
  await selectProductsList(ctx, visible);
  if (firstVisibleElement(API_MOCK.VARIANT_OUTBOUND)) return;
  if (firstVisibleElement(API_MOCK.BTAB_RESPONSE)) {
    if (visible) await am19Aim(ctx, API_MOCK.BTAB_RESPONSE, T.tabSwitch);
    else await ctx.click(API_MOCK.BTAB_RESPONSE);
  }
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_OUTBOUND)) {
    if (visible) await am19Aim(ctx, API_MOCK.RESPONSE_TAB_OUTBOUND, T.tabSwitch);
    else await ctx.click(API_MOCK.RESPONSE_TAB_OUTBOUND);
  }
  if (visible) await am19Reveal(ctx, API_MOCK.VARIANT_OUTBOUND, T.panelReady);
  else await ctx.waitFor(API_MOCK.VARIANT_OUTBOUND, REVEAL_MS).catch(() => undefined);
}

function quietRuntimeOps(kind: 'cors' | 'limits' | 'redaction' | 'persist' | 'callbacks'): void {
  if (kind === 'cors') {
    patchApiMockServerSettings({ corsEnabled: true, corsOrigins: [AM19_CORS_ORIGIN] });
    return;
  }
  if (kind === 'limits') {
    patchApiMockServerSettings({
      maxInboundBodyBytes: Number(AM19_INBOUND),
      maxConcurrentConnections: Number(AM19_CONN),
      gracefulDrainMs: Number(AM19_DRAIN),
    });
    return;
  }
  if (kind === 'redaction') {
    patchApiMockServerSettings({
      redactHeaders: [AM19_REDACT_HEADERS],
      redactJsonPaths: [AM19_REDACT_PATHS],
    });
    return;
  }
  if (kind === 'persist') {
    patchApiMockServerSettings({ persistToDisk: true });
    return;
  }
  patchApiMockServerSettings({ callbackAllowlist: [AM19_CALLBACK_URL] });
}

async function quietCors(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, false);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_CORS)) {
    if (!isAm19CorsOn()) await ctx.click(API_MOCK.RUNTIME_SETTINGS_CORS);
    if (!am19InputValue(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS).includes(AM19_CORS_ORIGIN)) {
      await ctx.fill(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS, AM19_CORS_ORIGIN);
    }
    if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
    }
  } else {
    quietRuntimeOps('cors');
  }
  await applyIfDirty(ctx, false);
}

async function quietLimits(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, false);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_INBOUND)) {
    if (am19InputValue(API_MOCK.RUNTIME_SETTINGS_INBOUND) !== AM19_INBOUND) {
      await ctx.fill(API_MOCK.RUNTIME_SETTINGS_INBOUND, AM19_INBOUND);
    }
    if (am19InputValue(API_MOCK.RUNTIME_SETTINGS_CONN) !== AM19_CONN) {
      await ctx.fill(API_MOCK.RUNTIME_SETTINGS_CONN, AM19_CONN);
    }
    if (am19InputValue(API_MOCK.RUNTIME_SETTINGS_DRAIN) !== AM19_DRAIN) {
      await ctx.fill(API_MOCK.RUNTIME_SETTINGS_DRAIN, AM19_DRAIN);
    }
    if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
    }
  } else {
    quietRuntimeOps('limits');
  }
}

async function quietRedaction(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, false);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS)) {
    await ctx.fill(API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS, AM19_REDACT_HEADERS);
    await ctx.fill(API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS, AM19_REDACT_PATHS);
    if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
    }
  } else {
    quietRuntimeOps('redaction');
  }
  await applyIfDirty(ctx, false);
}

async function quietPersist(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, false);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_PERSIST)) {
    if (!isAm19PersistOn()) await ctx.click(API_MOCK.RUNTIME_SETTINGS_PERSIST);
    if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_SAVE)) {
      await ctx.click(API_MOCK.RUNTIME_SETTINGS_SAVE);
    }
  } else {
    quietRuntimeOps('persist');
  }
  await applyIfDirty(ctx, false);
}

async function quietSecretFetch(ctx: DemoActionContext): Promise<void> {
  if (hasAm19Traffic()) return;
  await sendApiMockRequest({
    path: AM19_CART_PATH,
    method: 'POST',
    headers: { Authorization: AM19_AUTH_VALUE, 'Content-Type': 'application/json' },
    body: AM19_PASSWORD_BODY,
  });
  await ctx.delay(400);
}

/**
 * Seed one plain (non-secret) journal row so the redaction step does not open on
 * an empty journal — CORS preflights are intentionally not journaled, so without
 * this the viewer reads "the new journal row" against nothing. The secret POST
 * fired by the step action is then genuinely the *new* row to contrast against.
 */
async function quietWarmupFetch(ctx: DemoActionContext): Promise<void> {
  if (hasAm19Traffic()) return;
  await sendApiMockRequest({ path: AM19_PRODUCTS, method: 'GET' });
  await ctx.delay(400);
}

async function quietTransform(ctx: DemoActionContext): Promise<void> {
  await openOutbound(ctx, false);
  if (!hasAm19Transform() && firstVisibleElement(API_MOCK.TRANSFORM_ADD)) {
    await ctx.click(API_MOCK.TRANSFORM_ADD);
    await ctx.delay(200);
  }
  if (!hasAm19Callback() && firstVisibleElement(API_MOCK.CALLBACK_ADD)) {
    await ctx.click(API_MOCK.CALLBACK_ADD);
    await ctx.delay(200);
  }
  if (firstVisibleElement(API_MOCK.CALLBACK_URL_FIRST)
    && !am19InputValue(API_MOCK.CALLBACK_URL_FIRST).includes(AM19_CALLBACK_URL)) {
    await ctx.fill(API_MOCK.CALLBACK_URL_FIRST, AM19_CALLBACK_URL);
  }
  quietRuntimeOps('callbacks');
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm19ForLimits(ctx: DemoActionContext): Promise<void> {
  await ensureAm19Running(ctx);
  await quietCors(ctx);
  await openRuntimeSettings(ctx, false);
}

export async function ensureAm19ForRedactionConfig(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForLimits(ctx);
  await quietLimits(ctx);
  await openRuntimeSettings(ctx, false);
}

export async function ensureAm19ForProveRedaction(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForRedactionConfig(ctx);
  await quietRedaction(ctx);
  await openJournal(ctx, false);
  await quietWarmupFetch(ctx);
}

export async function ensureAm19ForPersist(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForProveRedaction(ctx);
  await quietSecretFetch(ctx);
  await openRuntimeSettings(ctx, false);
}

export async function ensureAm19ForConsole(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForPersist(ctx);
  await quietPersist(ctx);
}

export async function ensureAm19ForTransforms(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForConsole(ctx);
  await closeAm19SettingsModal(ctx);
  await openOutbound(ctx, false);
}

export async function ensureAm19ForProveTransform(ctx: DemoActionContext): Promise<void> {
  await ensureAm19ForTransforms(ctx);
  await quietTransform(ctx);
  await closeAm19SettingsModal(ctx);
}

// ── Visible steps ───────────────────────────────────────────────────────────

export async function runAm19Cors(ctx: DemoActionContext): Promise<void> {
  await ensureAm19Running(ctx);
  if (!firstVisibleElement(API_MOCK.LIVE_SETTINGS) && !firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_CORS)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_SETTINGS)) {
    await am19ClickNow(ctx, API_MOCK.LIVE_SETTINGS, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_CORS)) {
    await am19Reveal(ctx, API_MOCK.RUNTIME_SETTINGS_CORS, T.tabSwitch);
  }
  if (!firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_CORS)) return;
  if (!isAm19CorsOn()) {
    await am19Aim(ctx, API_MOCK.RUNTIME_SETTINGS_CORS, T.fieldFilled);
  } else {
    await am19Look(ctx, API_MOCK.RUNTIME_SETTINGS_CORS);
  }
  await am19AimFill(ctx, API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS, AM19_CORS_ORIGIN, T.fieldFilled);
  await saveRuntimeSettings(ctx, true);
  await applyIfDirty(ctx, true);
  await am19Break(ctx);
  await sendApiMockRequest({
    path: AM19_PRODUCTS,
    method: 'OPTIONS',
    headers: {
      Origin: AM19_CORS_ORIGIN,
      'Access-Control-Request-Method': 'GET',
    },
  });
  await ctx.delay(T.journalWrite);
  if (firstVisibleElement(API_MOCK.LIVE_TX_COUNT)) {
    await am19Payoff(ctx, API_MOCK.LIVE_TX_COUNT);
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await am19Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  }
}

export async function runAm19Limits(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, true);
  if (!firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_INBOUND)) return;
  await am19FillNow(ctx, API_MOCK.RUNTIME_SETTINGS_INBOUND, AM19_INBOUND, T.fieldFilled);
  await am19AimFill(ctx, API_MOCK.RUNTIME_SETTINGS_CONN, AM19_CONN, T.fieldFilled);
  await am19AimFill(ctx, API_MOCK.RUNTIME_SETTINGS_DRAIN, AM19_DRAIN, T.payoff);
  await saveRuntimeSettings(ctx, true);
  await applyIfDirty(ctx, true);
}

export async function runAm19RedactionConfig(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, true);
  if (!firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS)) return;
  await am19FillNow(ctx, API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS, AM19_REDACT_HEADERS, T.fieldFilled);
  await am19AimFill(ctx, API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS, AM19_REDACT_PATHS, T.payoff);
  await saveRuntimeSettings(ctx, true);
  await applyIfDirty(ctx, true);
}

export async function runAm19ProveRedaction(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.ADDRESS)) {
    await am19Look(ctx, API_MOCK.ADDRESS);
  }
  await sendApiMockRequest({
    path: AM19_CART_PATH,
    method: 'POST',
    headers: { Authorization: AM19_AUTH_VALUE, 'Content-Type': 'application/json' },
    body: AM19_PASSWORD_BODY,
  });
  await ctx.delay(T.journalWrite);
  await openJournal(ctx, true);
  await clickNewestJournalRow(ctx, true);
  // Confirm detail switched to the POST row with redacted content; retry if needed.
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 20 && !hasAm19RedactedDetail(); i++) {
      await ctx.delay(200);
    }
    if (hasAm19RedactedDetail()) break;
    const row = journalRows()[0];
    const selector = rowSelector(row) ?? API_MOCK.JOURNAL_FIRST_ROW;
    if (firstVisibleElement(selector)) await ctx.click(selector);
  }
  if (firstVisibleElement(API_MOCK.TX_REQUEST)) {
    await am19Payoff(ctx, API_MOCK.TX_REQUEST);
    await am19Break(ctx);
    await am19Payoff(ctx, API_MOCK.TX_REQUEST);
  }
}

export async function runAm19PersistAndDiagnostics(ctx: DemoActionContext): Promise<void> {
  await openRuntimeSettings(ctx, true);
  if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_PERSIST) && !isAm19PersistOn()) {
    await am19ClickNow(ctx, API_MOCK.RUNTIME_SETTINGS_PERSIST, T.fieldFilled);
  } else if (firstVisibleElement(API_MOCK.RUNTIME_SETTINGS_PERSIST)) {
    await am19Look(ctx, API_MOCK.RUNTIME_SETTINGS_PERSIST);
  }
  await saveRuntimeSettings(ctx, true);
  await applyIfDirty(ctx, true);
  await am19Break(ctx);
  if (!firstVisibleElement(API_MOCK.DOCK_TAB_DIAGNOSTICS)) return;
  await am19Aim(ctx, API_MOCK.DOCK_TAB_DIAGNOSTICS, T.tabSwitch);
  await am19Reveal(ctx, API_MOCK.DIAGNOSTICS, T.panelReady);
  if (firstVisibleElement(API_MOCK.DIAG_MATCH_P95)) {
    await am19Payoff(ctx, API_MOCK.DIAG_MATCH_P95);
  }
  if (firstVisibleElement(API_MOCK.DIAG_OUTCOMES)) {
    await am19Payoff(ctx, API_MOCK.DIAG_OUTCOMES);
  }
}

export async function runAm19Console(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.DOCK_TAB_CONSOLE) && !firstVisibleElement(API_MOCK.CONSOLE)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.DOCK_TAB_CONSOLE)) {
    await am19ClickNow(ctx, API_MOCK.DOCK_TAB_CONSOLE, T.tabSwitch);
  }
  // Lifecycle lines only stream in while the console is attached — an idle,
  // already-running server shows nothing. Generate one on demand so the viewer
  // sees real output: commit a pending change if dirty, else Restart the running
  // server (the companion now logs "Restarted …" and the stream stays attached
  // through the transition).
  if (!firstVisibleElement(API_MOCK.CONSOLE_LINE)) {
    if (firstVisibleElement(API_MOCK.APPLY)) {
      await applyIfDirty(ctx, true);
    } else if (firstVisibleElement(API_MOCK.RESTART)) {
      await am19Aim(ctx, API_MOCK.RESTART, T.lifecycle);
    }
    await ctx.delay(T.lifecycle);
  }
  if (firstVisibleElement(API_MOCK.CONSOLE_LINE)) {
    await am19Reveal(ctx, API_MOCK.CONSOLE_LINE, T.payoff);
    await am19Payoff(ctx, API_MOCK.CONSOLE_LINE);
    return;
  }
  if (firstVisibleElement(API_MOCK.CONSOLE)) {
    await am19Payoff(ctx, API_MOCK.CONSOLE);
  }
}

export async function runAm19TransformsAndCallbacks(ctx: DemoActionContext): Promise<void> {
  await closeAm19SettingsModal(ctx);
  await openOutbound(ctx, true);
  if (!firstVisibleElement(API_MOCK.TRANSFORM_ADD)) return;
  if (!hasAm19Transform()) {
    await am19ClickNow(ctx, API_MOCK.TRANSFORM_ADD, T.fieldFilled);
  }
  if (firstVisibleElement(API_MOCK.TRANSFORM_ROW)) {
    await am19Reveal(ctx, API_MOCK.TRANSFORM_ROW, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TRANSFORM_OP_FIRST)) {
    await am19Look(ctx, API_MOCK.TRANSFORM_OP_FIRST);
  }
  await am19Break(ctx);
  if (!hasAm19Callback() && firstVisibleElement(API_MOCK.CALLBACK_ADD)) {
    await am19ClickNow(ctx, API_MOCK.CALLBACK_ADD, T.fieldFilled);
  }
  // One downward pin: editor pane to the bottom so URL → Body are all on screen.
  // Later fills/rings must not call scrollIntoView — that snaps the pane back up.
  await am19ScrollEditorToBottom(ctx);
  await am19FillPinned(ctx, API_MOCK.CALLBACK_URL_FIRST, AM19_CALLBACK_URL);
  await am19FillPinned(ctx, API_MOCK.CALLBACK_RETRIES_FIRST, AM19_CALLBACK_RETRIES);
  await am19FillPinned(ctx, API_MOCK.CALLBACK_BODY_FIRST, AM19_CALLBACK_BODY, T.payoff);
  if (!firstVisibleElement(API_MOCK.SETTINGS)) return;
  await am19ClickNow(ctx, API_MOCK.SETTINGS, T.panelReady);
  if (firstVisibleElement(API_MOCK.SETTINGS_TAB_PROXY)) {
    await am19ClickNow(ctx, API_MOCK.SETTINGS_TAB_PROXY, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_CALLBACK_ALLOWLIST)) {
    await am19FillNow(ctx, API_MOCK.SETTINGS_CALLBACK_ALLOWLIST, AM19_CALLBACK_URL, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await am19ClickNow(ctx, API_MOCK.SETTINGS_SAVE, T.fieldFilled);
  }
  await closeAm19SettingsModal(ctx);
  await ctx.delay(T.panelReady);
}

export async function runAm19ProveTransform(ctx: DemoActionContext): Promise<void> {
  await closeAm19SettingsModal(ctx);
  if (!firstVisibleElement(API_MOCK.APPLY) && !firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    // Still fetch so the journal proof exists on a clean replay.
  } else if (firstVisibleElement(API_MOCK.APPLY)) {
    await am19ClickNow(ctx, API_MOCK.APPLY, T.lifecycle);
  }
  await sendApiMockRequest({ path: AM19_PRODUCTS, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await openJournal(ctx, true);
  await clickNewestJournalRow(ctx, true);
  // Confirm TX_RESPONSE switched to the GET /products row with the injected header;
  // retry the click up to 3 times if the detail did not update in time.
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 20 && !hasAm19TransformHeader(); i++) {
      await ctx.delay(200);
    }
    if (hasAm19TransformHeader()) break;
    const row = journalRows()[0];
    const selector = rowSelector(row) ?? API_MOCK.JOURNAL_FIRST_ROW;
    if (firstVisibleElement(selector)) await ctx.click(selector);
  }
  if (firstVisibleElement(API_MOCK.TX_RESPONSE)) {
    await am19Payoff(ctx, API_MOCK.TX_RESPONSE);
  } else if (firstVisibleElement(API_MOCK.TX_DETAIL)) {
    await am19Payoff(ctx, API_MOCK.TX_DETAIL);
  }
}
