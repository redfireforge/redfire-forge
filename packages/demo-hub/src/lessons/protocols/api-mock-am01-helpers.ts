/**
 * AM-01 `am-01-studio-tour` helpers — Studio Tour & Your First Mock.
 *
 * Steps are multi-beat: each exported `runAm01*` function performs a group of related
 * actions, moving the spotlight between them (`spotlightBeat`) with paced holds.
 * Every stateful step has an `ensure*` guard so rapid **Next** still leaves the next
 * step something real to spotlight.
 */
import {
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  AM_DEMO_TIMING,
  clickBeat,
  fillBeat,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

/** Response body the lesson ships from `GET /health`. */
export const AM01_HEALTH_BODY = JSON.stringify({ ok: true, service: 'checkout', version: '1.4.2' }, null, 2);

// ── State probes ────────────────────────────────────────────────────────────

/** True when the Studio has at least one server (server bar is mounted). */
export function hasAm01Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

/** True when a rule is open in the route editor. */
export function hasAm01RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

/** True when the Studio (authoring) view is visible — Runtime/Conflicts unmount it. */
export function isAm01StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

/** True when the active server reports Running in the server bar. */
export function isAm01ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: park open tabs (keep saved servers) + collapsed app sidebar so step 1 opens on a clean Studio canvas. */
export async function prepareAm01Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — free the port, leave no orphan listener. */
export async function cleanupAm01(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

/**
 * Authoring guards must not fire on the Runtime / Conflicts pages — those views
 * unmount the explorer and editor, so a blind click would hit nothing.
 */
export async function ensureAm01StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm01StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

/** Guard — a server must exist for every step after the create beat. */
export async function ensureAm01Server(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm01StudioView(ctx);
  if (hasAm01Server()) return;
  await ctx.click(API_MOCK.CREATE_FIRST);
  await ctx.waitFor(API_MOCK.SERVER_BAR);
}

/** Guard — a rule must be open in the editor, matching `/health`. */
export async function ensureAm01Rule(ctx: DemoActionContext): Promise<void> {
  await ensureAm01Server(ctx);
  if (!hasAm01RouteEditor()) {
    await ctx.click(API_MOCK.ADD_ROUTE);
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR);
  }
  const input = firstVisibleElement<HTMLInputElement>(API_MOCK.PATH_INPUT);
  if (input?.value === '/health') return;
  if (!patchApiMockActiveRoute({ path: '/health' })) {
    await ctx.fill(API_MOCK.PATH_INPUT, '/health');
  }
}

/** Guard — the rule must answer 200 + JSON before Start / traffic steps. */
export async function ensureAm01Response(ctx: DemoActionContext): Promise<void> {
  await ensureAm01Rule(ctx);
  if (!firstVisibleElement(API_MOCK.VARIANT_BODY)) {
    await ctx.click(API_MOCK.BTAB_RESPONSE);
    await ctx.waitFor(API_MOCK.VARIANT_BODY);
  }
  patchApiMockActiveRoute({ body: AM01_HEALTH_BODY });
}

/** Guard — listener must be bound for traffic / journal steps. */
export async function ensureAm01Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm01Response(ctx);
  if (isAm01ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

/** True when at least one journaled request already exists (Studio strip or Runtime table). */
export function hasAm01Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

/** Guard — journal steps need at least one transaction on the server. */
export async function ensureAm01Traffic(ctx: DemoActionContext): Promise<void> {
  await ensureAm01Running(ctx);
  if (hasAm01Traffic()) return;
  await sendApiMockRequest({ path: '/health', method: 'GET' });
}

/** Guard — Runtime journal must be the visible surface with a row to open. */
export async function ensureAm01JournalOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm01Traffic(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;
  await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  await ctx.waitFor(API_MOCK.JOURNAL_FIRST_ROW, 20_000);
}

/**
 * Guard for the closing step — back on Studio (so Stop is mounted and spotlightable
 * during the reading pause) with the listener still bound.
 */
export async function ensureAm01Stoppable(ctx: DemoActionContext): Promise<void> {
  await ensureAm01StudioView(ctx);
  await ensureAm01Running(ctx);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — tour Runtime and Conflicts, land back on Studio. */
export async function runAm01WorkspaceTour(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.VIEW_RUNTIME, { look: 0, hold: AM_DEMO_TIMING.viewSwitch });
  await clickBeat(ctx, API_MOCK.VIEW_CONFLICTS, { look: 0, hold: AM_DEMO_TIMING.viewSwitch });
  await clickBeat(ctx, API_MOCK.VIEW_STUDIO, { look: 0, hold: AM_DEMO_TIMING.viewSwitch });
  await spotlightBeat(ctx, API_MOCK.CREATE_FIRST, AM_DEMO_TIMING.payoff);
}

/** Step 2 — create the server, then read and copy its listen address. */
export async function runAm01CreateServer(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.CREATE_FIRST, { hold: 0 });
  await revealBeat(ctx, API_MOCK.SERVER_BAR);
  await spotlightBeat(ctx, API_MOCK.ADDRESS, AM_DEMO_TIMING.payoff);
  await clickBeat(ctx, API_MOCK.COPY_ADDRESS, { hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.STATUS_LABEL, AM_DEMO_TIMING.look);
}

/** Step 3 — add a rule, then aim its match at `GET /health` (Exact kind inferred). */
export async function runAm01AuthorMatch(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.ADD_ROUTE, { hold: 0 });
  await revealBeat(ctx, API_MOCK.ROUTE_EDITOR);
  await spotlightBeat(ctx, API_MOCK.METHOD_SELECT, AM_DEMO_TIMING.look);
  await fillBeat(ctx, API_MOCK.PATH_INPUT, '/health', { hold: AM_DEMO_TIMING.fieldFilled });
  await spotlightBeat(ctx, API_MOCK.PATH_KIND, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.PRIORITY_INPUT, AM_DEMO_TIMING.look);
}

/** Step 4 — Response tab: 200 from a quick chip, JSON body, size badge, preview. */
export async function runAm01AuthorResponse(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.BTAB_RESPONSE, { hold: 0 });
  await revealBeat(ctx, API_MOCK.VARIANT_BODY, { hold: AM_DEMO_TIMING.tabSwitch });
  await clickBeat(ctx, API_MOCK.VARIANT_STATUS_QUICK_200, { hold: AM_DEMO_TIMING.fieldFilled });
  await spotlightBeat(ctx, API_MOCK.VARIANT_STATUS, AM_DEMO_TIMING.look);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  patchApiMockActiveRoute({ body: AM01_HEALTH_BODY });
  await revealBeat(ctx, API_MOCK.BODY_SIZE, { hold: AM_DEMO_TIMING.fieldFilled });
  await spotlightBeat(ctx, API_MOCK.VARIANT_BODY, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.BODY_SIZE, AM_DEMO_TIMING.look);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await spotlightBeat(ctx, API_MOCK.RESPONSE_PREVIEW, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.PREVIEW_HEADERS, AM_DEMO_TIMING.look);
}

/** Step 5 — Start the listener: status flips to Running, generation 1 is committed. */
export async function runAm01Start(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.START, { hold: 0 });
  await revealBeat(ctx, API_MOCK.STOP, { hold: AM_DEMO_TIMING.lifecycle });
  await spotlightBeat(ctx, API_MOCK.STATUS_LABEL, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.GENERATION, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.ADDRESS, AM_DEMO_TIMING.look);
}

/**
 * Step 6 — send real traffic, watch the Live strip count it, then open the journal.
 * Returns the real HTTP status so the caller can assert the mock answered.
 */
export async function runAm01SendTraffic(ctx: DemoActionContext): Promise<number | null> {
  await spotlightBeat(ctx, API_MOCK.ADDRESS, AM_DEMO_TIMING.look);
  const res = await sendApiMockRequest({ path: '/health', method: 'GET' });
  await ctx.delay(AM_DEMO_TIMING.journalWrite);
  await spotlightBeat(ctx, API_MOCK.LIVE_TRANSACTIONS, AM_DEMO_TIMING.payoff);
  await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  await revealBeat(ctx, API_MOCK.JOURNAL_FIRST_ROW, { hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.JOURNAL_FIRST_ROW, AM_DEMO_TIMING.payoff);
  return res?.status ?? null;
}

/** Step 7 — open the transaction detail, then copy the equivalent cURL. */
export async function runAm01Inspect(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.JOURNAL_FIRST_ROW, { hold: 0 });
  await revealBeat(ctx, API_MOCK.TX_DETAIL, { hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.TX_DETAIL, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);
  if (await spotlightBeat(ctx, API_MOCK.RUNTIME_SAMPLE_CURL, AM_DEMO_TIMING.look)) {
    await clickBeat(ctx, API_MOCK.RUNTIME_COPY_CURL, { hold: AM_DEMO_TIMING.payoff });
  }
}

/** Step 8 — back on Studio, Stop drains the listener and frees the port. */
export async function runAm01Stop(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.STOP, { hold: 0 });
  await revealBeat(ctx, API_MOCK.START, { hold: AM_DEMO_TIMING.lifecycle });
  await spotlightBeat(ctx, API_MOCK.STATUS_LABEL, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.FIRST_ROUTE, AM_DEMO_TIMING.payoff);
}
