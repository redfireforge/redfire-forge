/**
 * AM-10 `am-10-response-content` helpers — Response Content: status, headers,
 * cookies, and body kinds.
 *
 * Quiet corpus is one `GET /orders` answering plain `200 {}`. Status, reason
 * phrase, Format, headers, cookies, HTML/binary kinds, Apply, and the live proof
 * are authored in the UI. Gallery import remints ids, so rows are located by
 * stable testids (never minted header/cookie ids).
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
  selectBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

/**
 * AM-10 holds as long as AM-04…AM-09. Status chips, Format, header rows, and the
 * live Apply/journal proof are dense — the viewer needs time on each ring.
 */
export const AM10_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  beforeOpen: 1400,
  lifecycle: 1600,
  journalWrite: 1400,
} as const;

const T = AM10_TIMING;

export const AM10_CORPUS_SAMPLE = 'am-gallery-response';
export const AM10_PATH = '/orders';
export const AM10_REASON = 'Resource created';
export const AM10_MINIFIED = '{"id":"ord-1001","status":"created"}';
export const AM10_FORMATTED = JSON.stringify(JSON.parse(AM10_MINIFIED), null, 2);
export const AM10_HTML = '<h1>Order created</h1>';
export const AM10_BINARY = 'AAECAwQ=';
export const AM10_HEADER_TRACE_KEY = 'x-request-id';
export const AM10_HEADER_TRACE_VALUE = 'req-1001';
export const AM10_HEADER_CACHE_KEY = 'cache-control';
export const AM10_HEADER_CACHE_VALUE = 'no-store';
export const AM10_COOKIE_NAME = 'sid';
export const AM10_COOKIE_VALUE = 'sess-42';
export const AM10_CONTENT_JSON = 'application/json';
export const AM10_CONTENT_HTML = 'text/html';
export const AM10_CONTENT_BINARY = 'application/octet-stream';

async function am10Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a tab or modal trigger before the click. */
async function am10Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am10Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am10Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am10Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am10Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am10Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am10Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm10Workspace(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm10RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm10StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm10ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am10StatusValue(): string {
  const input = firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_STATUS);
  return input?.value?.trim() ?? '';
}

export function am10ReasonValue(): string {
  const input = firstVisibleElement<HTMLInputElement>(API_MOCK.VARIANT_STATUS_REASON);
  return input?.value?.trim() ?? '';
}

export function am10ContentTypeValue(): string {
  const el = firstVisibleElement(API_MOCK.VARIANT_CONTENT_TYPE_SELECT);
  return el?.getAttribute('data-value')?.trim() ?? '';
}

export function am10PreviewText(): string {
  return firstVisibleElement(API_MOCK.PREVIEW_BODY)?.textContent ?? '';
}

export function am10HeaderRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.HEADER_ROW));
}

export function am10HeaderKeys(): string[] {
  return am10HeaderRows().map(row => {
    const input = row.querySelector<HTMLInputElement>('[data-testid="api-mock-header-key"]');
    return input?.value.trim() ?? '';
  });
}

export function am10CookieName(): string {
  const input = firstVisibleElement<HTMLInputElement>(API_MOCK.COOKIE_NAME);
  return input?.value?.trim() ?? '';
}

export function am10HasCookie(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.COOKIE_ROW));
}

export function am10TabSelected(selector: string): boolean {
  return firstVisibleElement(selector)?.getAttribute('aria-selected') === 'true';
}

export function am10HasFormattedBody(): boolean {
  const preview = am10PreviewText();
  return preview.includes('ord-1001') && preview.includes('\n');
}

export function am10HasBinaryHint(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.BODY_BINARY_HINT));
}

export function hasAm10Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

/** Studio polls the journal every 1.5s — wait so Runtime never opens empty. */
const AM10_TRAFFIC_POLL_MS = 150;
const AM10_TRAFFIC_TRIES = 24;

export async function waitForAm10Traffic(ctx: DemoActionContext): Promise<boolean> {
  for (let i = 0; i < AM10_TRAFFIC_TRIES; i++) {
    if (hasAm10Traffic()) return true;
    await ctx.delay(AM10_TRAFFIC_POLL_MS);
  }
  return hasAm10Traffic();
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm10Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM10_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-10: failed to import ${AM10_CORPUS_SAMPLE}`);
  }
  prepareApiMockStudioChrome();
}

export async function cleanupAm10(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm10StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm10StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function ensureAm10Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm10StudioView(ctx);
  if (!hasAm10Workspace()) {
    const imported = await importApiMockGallerySample(AM10_CORPUS_SAMPLE);
    if (!imported) {
      throw new Error(`AM-10: failed to import ${AM10_CORPUS_SAMPLE}`);
    }
    await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
  }
  await ensureAm10RuleOpen(ctx);
  await ensureAm10ResponseTab(ctx);
  await ensureAm10Running(ctx);
}

export async function ensureAm10RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm10StudioView(ctx);
  if (hasAm10RouteEditor()) return;
  const row = firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.FIRST_ROUTE);
  if (!row) return;
  await ctx.click(API_MOCK.ROUTE_ROW);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

export async function ensureAm10ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm10RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.VARIANT_STATUS)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.waitFor(API_MOCK.RESPONSE_EDITOR, 6_000);
}

export async function ensureAm10ContentTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm10ResponseTab(ctx);
  if (am10TabSelected(API_MOCK.RESPONSE_TAB_CONTENT)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_CONTENT)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_CONTENT);
  await ctx.waitFor(API_MOCK.VARIANT_STATUS, 6_000);
}

export async function ensureAm10HeadersTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm10ResponseTab(ctx);
  if (am10TabSelected(API_MOCK.RESPONSE_TAB_HEADERS)) return;
  if (!firstVisibleElement(API_MOCK.RESPONSE_TAB_HEADERS)) return;
  await ctx.click(API_MOCK.RESPONSE_TAB_HEADERS);
  await ctx.waitFor(API_MOCK.ADD_HEADER, 6_000);
}

/** Guard — listener already bound on the corpus so later Apply is a hot-swap. */
export async function ensureAm10Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm10StudioView(ctx);
  if (isAm10ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm10StatusLine(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Workspace(ctx);
  await ensureAm10ContentTab(ctx);
  if (am10StatusValue() !== '201') {
    await ctx.click(API_MOCK.VARIANT_STATUS_QUICK_201);
  }
  if (am10ReasonValue() !== AM10_REASON) {
    await ctx.fill(API_MOCK.VARIANT_STATUS_REASON, AM10_REASON);
  }
  if (am10ContentTypeValue() !== AM10_CONTENT_JSON) {
    await ctx.selectOption(API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_JSON);
  }
}

export async function ensureAm10Formatted(ctx: DemoActionContext): Promise<void> {
  await ensureAm10StatusLine(ctx);
  if (am10HasFormattedBody()) return;
  patchApiMockActiveRoute({
    body: AM10_FORMATTED,
    contentType: AM10_CONTENT_JSON,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
}

async function quietAddHeader(
  ctx: DemoActionContext,
  key: string,
  value: string,
): Promise<void> {
  if (am10HeaderKeys().includes(key)) return;
  await ctx.click(API_MOCK.ADD_HEADER);
  await ctx.waitFor(API_MOCK.HEADER_KEY_LAST);
  await ctx.fill(API_MOCK.HEADER_KEY_LAST, key);
  await ctx.fill(API_MOCK.HEADER_VALUE_LAST, value);
}

export async function ensureAm10Headers(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Formatted(ctx);
  await ensureAm10HeadersTab(ctx);
  await quietAddHeader(ctx, AM10_HEADER_TRACE_KEY, AM10_HEADER_TRACE_VALUE);
  await quietAddHeader(ctx, AM10_HEADER_CACHE_KEY, AM10_HEADER_CACHE_VALUE);
}

export async function ensureAm10Cookie(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Headers(ctx);
  await ensureAm10HeadersTab(ctx);
  if (!am10HasCookie()) {
    await ctx.click(API_MOCK.ADD_COOKIE);
    await ctx.waitFor(API_MOCK.COOKIE_NAME);
  }
  if (am10CookieName() !== AM10_COOKIE_NAME) {
    await ctx.fill(API_MOCK.COOKIE_NAME, AM10_COOKIE_NAME);
  }
  const value = firstVisibleElement<HTMLInputElement>(API_MOCK.COOKIE_VALUE);
  if (value && value.value !== AM10_COOKIE_VALUE) {
    await ctx.fill(API_MOCK.COOKIE_VALUE, AM10_COOKIE_VALUE);
  }
}

export async function ensureAm10Contract(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Cookie(ctx);
  await ensureAm10ContentTab(ctx);
  patchApiMockActiveRoute({
    body: AM10_FORMATTED,
    contentType: AM10_CONTENT_JSON,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
}

export async function ensureAm10ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Contract(ctx);
  await ensureAm10Running(ctx);
}

export async function ensureAm10Traffic(ctx: DemoActionContext): Promise<void> {
  await ensureAm10ForApply(ctx);
  if (hasAm10Traffic()) return;
  await sendApiMockRequest({ path: AM10_PATH, method: 'GET' });
  await waitForAm10Traffic(ctx);
}

export async function ensureAm10JournalOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm10Traffic(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;
  if (!hasAm10Traffic()) await waitForAm10Traffic(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;
  if (!firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) return;
  await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  await ctx.waitFor(API_MOCK.JOURNAL_FIRST_ROW, 20_000);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — Content tab: 201 chip, custom reason phrase, JSON Content-Type. */
export async function runAm10StatusLine(ctx: DemoActionContext): Promise<void> {
  await am10Aim(ctx, API_MOCK.RESPONSE_TAB_CONTENT, T.tabSwitch);
  await am10Reveal(ctx, API_MOCK.VARIANT_STATUS, T.panelReady);
  await am10Click(ctx, API_MOCK.VARIANT_STATUS_QUICK_201);
  await am10Look(ctx, API_MOCK.VARIANT_STATUS);
  await am10Break(ctx);

  await am10Fill(ctx, API_MOCK.VARIANT_STATUS_REASON, AM10_REASON);
  await am10Look(ctx, API_MOCK.VARIANT_STATUS_REASON);
  await am10Break(ctx);

  await am10Select(ctx, API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_JSON);
  await am10Payoff(ctx, API_MOCK.PREVIEW_STATUS);
}

/** Step 2 — paste minified JSON, Format, read the size badge. */
export async function runAm10FormatJson(ctx: DemoActionContext): Promise<void> {
  await ensureAm10ContentTab(ctx);
  patchApiMockActiveRoute({
    body: AM10_MINIFIED,
    contentType: AM10_CONTENT_JSON,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
  await am10Reveal(ctx, API_MOCK.VARIANT_BODY);
  await am10Look(ctx, API_MOCK.VARIANT_BODY);
  await am10Break(ctx);

  await am10Aim(ctx, API_MOCK.BODY_FORMAT);
  await am10Payoff(ctx, API_MOCK.VARIANT_BODY);
  await am10Payoff(ctx, API_MOCK.BODY_SIZE);
}

/** Step 3 — two response headers. */
export async function runAm10Headers(ctx: DemoActionContext): Promise<void> {
  await am10Aim(ctx, API_MOCK.RESPONSE_TAB_HEADERS, T.tabSwitch);
  await am10Reveal(ctx, API_MOCK.ADD_HEADER);
  await am10Click(ctx, API_MOCK.ADD_HEADER, 0);
  await am10Reveal(ctx, API_MOCK.HEADER_KEY_LAST);
  await am10Fill(ctx, API_MOCK.HEADER_KEY_LAST, AM10_HEADER_TRACE_KEY);
  await am10Fill(ctx, API_MOCK.HEADER_VALUE_LAST, AM10_HEADER_TRACE_VALUE);
  await am10Look(ctx, API_MOCK.HEADER_ROW);
  await am10Break(ctx);

  await am10Click(ctx, API_MOCK.ADD_HEADER, 0);
  await am10Reveal(ctx, API_MOCK.HEADER_KEY_LAST);
  await am10Fill(ctx, API_MOCK.HEADER_KEY_LAST, AM10_HEADER_CACHE_KEY);
  await am10Fill(ctx, API_MOCK.HEADER_VALUE_LAST, AM10_HEADER_CACHE_VALUE);
  await am10Payoff(ctx, API_MOCK.HEADER_LIST);
}

/** Step 4 — cookie builder; HttpOnly is already ticked. */
export async function runAm10Cookies(ctx: DemoActionContext): Promise<void> {
  await ensureAm10HeadersTab(ctx);
  await am10Aim(ctx, API_MOCK.ADD_COOKIE);
  await am10Reveal(ctx, API_MOCK.COOKIE_NAME);
  await am10Fill(ctx, API_MOCK.COOKIE_NAME, AM10_COOKIE_NAME);
  await am10Fill(ctx, API_MOCK.COOKIE_VALUE, AM10_COOKIE_VALUE);
  await am10Payoff(ctx, API_MOCK.COOKIE_HTTPONLY);
  await am10Look(ctx, API_MOCK.COOKIE_ROW);
}

/** Step 5 — read the rendered preview before a client does. */
export async function runAm10Preview(ctx: DemoActionContext): Promise<void> {
  await am10Look(ctx, API_MOCK.PREVIEW_STATUS);
  await am10Look(ctx, API_MOCK.PREVIEW_HEADERS);
  await am10Look(ctx, API_MOCK.PREVIEW_COOKIES);
  await am10Look(ctx, API_MOCK.PREVIEW_BODY);
  await am10Payoff(ctx, API_MOCK.RESPONSE_PREVIEW);
}

/** Step 6 — HTML then binary, then restore the JSON order body. */
export async function runAm10OtherBodyKinds(ctx: DemoActionContext): Promise<void> {
  await am10Aim(ctx, API_MOCK.RESPONSE_TAB_CONTENT, T.tabSwitch);
  await am10Select(ctx, API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_HTML);
  patchApiMockActiveRoute({
    body: AM10_HTML,
    contentType: AM10_CONTENT_HTML,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
  await am10Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await am10Payoff(ctx, API_MOCK.PREVIEW_BODY);
  await am10Break(ctx);

  await am10Select(ctx, API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_BINARY);
  patchApiMockActiveRoute({
    body: AM10_BINARY,
    contentType: AM10_CONTENT_BINARY,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
  await am10Reveal(ctx, API_MOCK.BODY_BINARY_HINT);
  await am10Payoff(ctx, API_MOCK.BODY_BINARY_HINT);
  await am10Break(ctx);

  await am10Select(ctx, API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_JSON);
  patchApiMockActiveRoute({
    body: AM10_FORMATTED,
    contentType: AM10_CONTENT_JSON,
    status: 201,
    reasonPhrase: AM10_REASON,
  });
  await am10Payoff(ctx, API_MOCK.PREVIEW_BODY);
}

/** Step 7 — Apply hot-swaps the running listener. */
export async function runAm10Apply(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am10Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am10Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
  await am10Payoff(ctx, API_MOCK.GENERATION);
  await am10Look(ctx, API_MOCK.STATUS_LABEL);
}

/** Step 8 — real GET /orders, then the journaled response. */
export async function runAm10Prove(ctx: DemoActionContext): Promise<number | null> {
  await am10Look(ctx, API_MOCK.ADDRESS);
  const res = await sendApiMockRequest({ path: AM10_PATH, method: 'GET' });
  await waitForAm10Traffic(ctx);
  await am10Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am10Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  }
  await am10Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  await am10Click(ctx, API_MOCK.JOURNAL_FIRST_ROW, 0);
  await am10Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am10Look(ctx, API_MOCK.TX_RESPONSE);
  await am10Break(ctx);
  await am10Payoff(ctx, API_MOCK.TX_RESPONSE);
  return res?.status ?? null;
}