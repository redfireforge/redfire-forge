/**
 * AM-25 `am-25-har-roundtrip` helpers — HAR Round-Trip Comparison.
 *
 * Scenario: import a HAR, enable the routes, replay the same requests against
 * the mock, then compare status + body in the Compare HAR modal and export
 * the bulk comparison report.
 *
 * Reuses the AM-15 HAR fixture (AM15_HAR) — 2 entries, both accepted.
 * The round-trip replay sends both requests so Journal rows appear for Compare.
 */
import {
  ensureBlankApiMockServer,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';
import { AM15_HAR, AM15_TIMING } from './api-mock-am15-helpers';

const T = AM15_TIMING;

// ── Constants ────────────────────────────────────────────────────────────────

/** Paths in the fixture HAR — the same ones sent during the round-trip replay. */
export const AM25_PATH_SESSION = '/session';
export const AM25_PATH_PROFILE = '/session/me';

// ── Internal helpers ─────────────────────────────────────────────────────────

async function am25Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am25Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am25Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am25Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

/** Quiet click — no spotlight ring (reading already highlighted the control). */
async function am25ClickQuiet(ctx: DemoActionContext, selector: string, hold: number = T.fieldFilled): Promise<void> {
  if (firstVisibleElement(selector)) {
    await ctx.click(selector);
    await ctx.delay(hold);
  }
}

async function am25Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probe helpers ─────────────────────────────────────────────────────────────

/** True when at least one HAR-sourced draft route row is visible. */
export function hasAm25HarDraft(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.DRAFT_ROUTE));
}

/** True when the Journal has at least one transaction row. */
export function hasAm25JournalRow(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

/** True when the HAR compare modal is visible. */
export function isAm25CompareModalOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.HAR_COMPARE_MODAL));
}

// ── Server / workspace prep ───────────────────────────────────────────────────

/** Ensure a blank mock server exists and the Studio view is ready. */
async function ensureAm25Server(): Promise<void> {
  await ensureBlankApiMockServer();
  prepareApiMockStudioChrome();
}

/** Start the mock server if it is not already running. */
async function ensureAm25Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm25Server();
  if (firstVisibleElement(API_MOCK.STOP)) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

// ── HAR import (quiet, no animation) ─────────────────────────────────────────

/** Open the import panel at the HAR source tab. */
async function openAm25Import(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.IMPORT_REVIEW)) {
    if (firstVisibleElement(API_MOCK.IMPORT_MENU)) {
      await ctx.click(API_MOCK.IMPORT_MENU);
      await ctx.waitFor(API_MOCK.IMPORT_REVIEW, 10_000).catch(() => undefined);
    }
  }
  if (firstVisibleElement(API_MOCK.importSource('har'))) {
    await ctx.click(API_MOCK.importSource('har'));
  }
}

/** Paste the HAR fixture and click Parse — then Confirm — so routes land as drafts. */
async function quietHarImportAndConfirm(ctx: DemoActionContext): Promise<void> {
  await openAm25Import(ctx);
  if (firstVisibleElement(API_MOCK.IMPORT_PASTE)) {
    await ctx.fill(API_MOCK.IMPORT_PASTE, AM15_HAR);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.HAR_PREVIEW_LIST, 5_000).catch(() => undefined);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await ctx.click(API_MOCK.IMPORT_CONFIRM);
    await ctx.waitFor(API_MOCK.DRAFT_ROUTE, 10_000).catch(() => undefined);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_REVIEW)) {
    const close = firstVisibleElement(API_MOCK.IMPORT_CLOSE) ?? firstVisibleElement(API_MOCK.IMPORT_CANCEL);
    if (close) {
      await ctx.click(close === firstVisibleElement(API_MOCK.IMPORT_CLOSE) ? API_MOCK.IMPORT_CLOSE : API_MOCK.IMPORT_CANCEL);
      await ctx.delay(T.tabSwitch);
    }
  }
}

/** Enable all draft routes in sequence and apply changes. */
async function enableAllDraftsAndApply(ctx: DemoActionContext): Promise<void> {
  // Loop until no more draft routes remain (guard at 10 to avoid infinite loops).
  for (let i = 0; i < 10; i++) {
    if (!firstVisibleElement(API_MOCK.DRAFT_ROUTE)) break;
    await ctx.click(API_MOCK.DRAFT_ROUTE);
    // Wait for the route editor to open and expose the enable toggle.
    await ctx.waitFor(API_MOCK.ROUTE_ENABLED, 5_000).catch(() => undefined);
    if (firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
      await ctx.click(API_MOCK.ROUTE_ENABLED);
    }
    await ctx.delay(200);
    if (firstVisibleElement(API_MOCK.APPLY)) {
      await ctx.click(API_MOCK.APPLY);
      // Wait for the Apply to settle (enabled count updates) before the next iteration.
      await ctx.waitFor(API_MOCK.ROUTES_ENABLED, 3_000).catch(() => undefined);
      await ctx.delay(200);
    }
  }
}

/** Send both fixture requests so Journal rows appear, then open the Journal tab. */
async function replayAndOpenJournal(ctx: DemoActionContext): Promise<void> {
  await sendApiMockRequest({ path: AM25_PATH_SESSION, method: 'GET' });
  await sendApiMockRequest({ path: AM25_PATH_PROFILE, method: 'GET' });
  await openAm25RuntimeTransactions(ctx, false);
  for (let i = 0; i < 18 && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW); i++) {
    await ctx.delay(200);
  }
}

/** Open Runtime → Transactions so journal rows are visible in the dock. */
async function openAm25RuntimeTransactions(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;

  if (!firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    const runtimeSel = firstVisibleElement(API_MOCK.VIEW_RUNTIME)
      ? API_MOCK.VIEW_RUNTIME
      : firstVisibleElement(API_MOCK.OPEN_RUNTIME)
        ? API_MOCK.OPEN_RUNTIME
        : null;
    if (runtimeSel) {
      if (visible) await am25Click(ctx, runtimeSel, T.tabSwitch);
      else await ctx.click(runtimeSel);
      if (!visible) await ctx.delay(200);
    }
  }

  const txTab = firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS);
  if (txTab && txTab.getAttribute('aria-selected') !== 'true') {
    if (visible) await am25Click(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
  }

  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    if (visible) await am25Click(ctx, API_MOCK.LIVE_TRANSACTIONS, T.fieldFilled);
    else await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  }
}

// ── Workspace lifecycle ───────────────────────────────────────────────────────

export async function prepareAm25Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
}

export async function cleanupAm25(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Ensure helpers (preAction) ────────────────────────────────────────────────

export async function ensureAm25ForImport(ctx: DemoActionContext): Promise<void> {
  await ensureAm25Server();
  // Close the import panel if it is already open so the action can open it
  // visibly from scratch (clicking the Import button is the first beat).
  if (firstVisibleElement(API_MOCK.IMPORT_REVIEW)) {
    const close = firstVisibleElement(API_MOCK.IMPORT_CLOSE) ?? firstVisibleElement(API_MOCK.IMPORT_CANCEL);
    if (close) {
      await ctx.click(close === firstVisibleElement(API_MOCK.IMPORT_CLOSE) ? API_MOCK.IMPORT_CLOSE : API_MOCK.IMPORT_CANCEL);
      await ctx.waitFor(API_MOCK.IMPORT_MENU, 5_000).catch(() => undefined);
    }
  }
}

export async function ensureAm25ForEnable(ctx: DemoActionContext): Promise<void> {
  await ensureAm25Server();
  if (!hasAm25HarDraft()) {
    await quietHarImportAndConfirm(ctx);
  }
}

export async function ensureAm25ForReplay(ctx: DemoActionContext): Promise<void> {
  await ensureAm25Running(ctx);
  if (!hasAm25HarDraft()) {
    await quietHarImportAndConfirm(ctx);
  }
  await enableAllDraftsAndApply(ctx);
  await openAm25RuntimeTransactions(ctx, false);
}

export async function ensureAm25ForCompare(ctx: DemoActionContext): Promise<void> {
  await ensureAm25Running(ctx);
  if (!hasAm25HarDraft()) {
    await quietHarImportAndConfirm(ctx);
  }
  await enableAllDraftsAndApply(ctx);
  if (!hasAm25JournalRow()) {
    await replayAndOpenJournal(ctx);
  } else {
    await openAm25RuntimeTransactions(ctx, false);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && !firstVisibleElement(API_MOCK.TX_COMPARE_HAR)) {
    await ctx.click(API_MOCK.JOURNAL_FIRST_ROW);
    await ctx.delay(300);
  }
}

export async function ensureAm25ForModal(ctx: DemoActionContext): Promise<void> {
  await ensureAm25ForCompare(ctx);
  // Click first Journal row to open the detail panel, then click Compare HAR
  if (!isAm25CompareModalOpen()) {
    if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
      await ctx.click(API_MOCK.JOURNAL_FIRST_ROW);
      await ctx.delay(400);
    }
    if (firstVisibleElement(API_MOCK.TX_COMPARE_HAR)) {
      await ctx.click(API_MOCK.TX_COMPARE_HAR);
      await ctx.waitFor(API_MOCK.HAR_COMPARE_MODAL, 3_000).catch(() => undefined);
    }
  }
}

export async function ensureAm25ForReport(ctx: DemoActionContext): Promise<void> {
  await ensureAm25ForCompare(ctx);
  // Close any open compare modal so the Journal toolbar is visible
  if (isAm25CompareModalOpen() && firstVisibleElement(API_MOCK.HAR_COMPARE_CLOSE)) {
    await ctx.click(API_MOCK.HAR_COMPARE_CLOSE);
    await ctx.delay(300);
  }
}

// ── Run helpers (action) ──────────────────────────────────────────────────────

/**
 * Demo action for `import` step:
 * open Import → switch to HAR → paste fixture → highlight the preview.
 */
export async function runAm25Import(ctx: DemoActionContext): Promise<void> {
  // Spotlight the Import button, then click it to open the panel.
  await am25Look(ctx, API_MOCK.IMPORT_MENU);
  await am25Click(ctx, API_MOCK.IMPORT_MENU, T.panelReady);
  // Wait for the import panel to mount, then select the HAR source tab.
  await ctx.waitFor(API_MOCK.IMPORT_REVIEW, 10_000).catch(() => undefined);
  if (firstVisibleElement(API_MOCK.importSource('har'))) {
    await am25Look(ctx, API_MOCK.importSource('har'));
    await am25Click(ctx, API_MOCK.importSource('har'), T.panelReady);
  }
  // Paste and parse the fixture HAR.
  if (firstVisibleElement(API_MOCK.IMPORT_PASTE)) {
    await ctx.fill(API_MOCK.IMPORT_PASTE, AM15_HAR);
    await am25Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
    await ctx.waitFor(API_MOCK.HAR_PREVIEW_LIST, 8_000).catch(() => undefined);
  }
  await am25Payoff(ctx, API_MOCK.HAR_PREVIEW_LIST);
}

/**
 * Demo action for `enable` step:
 * confirm import → spotlight draft routes → enable + apply.
 */
export async function runAm25Enable(ctx: DemoActionContext): Promise<void> {
  // Confirm if preview is still open
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await am25Click(ctx, API_MOCK.IMPORT_CONFIRM, T.payoff);
    await ctx.waitFor(API_MOCK.DRAFT_ROUTE, 10_000).catch(() => undefined);
  }
  // Close import panel
  if (firstVisibleElement(API_MOCK.IMPORT_REVIEW)) {
    const closeBtn = firstVisibleElement(API_MOCK.IMPORT_CLOSE);
    if (closeBtn) {
      await ctx.click(API_MOCK.IMPORT_CLOSE);
      await ctx.delay(T.tabSwitch);
    }
  }
  await am25Reveal(ctx, API_MOCK.DRAFT_ROUTE, T.payoff);
  await am25Look(ctx, API_MOCK.DRAFT_ROUTE);
  await ctx.click(API_MOCK.DRAFT_ROUTE);
  await ctx.delay(300);
  if (firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am25Click(ctx, API_MOCK.ROUTE_ENABLED, T.payoff);
  }
  const apply = firstVisibleElement(API_MOCK.APPLY);
  if (apply) {
    await am25Click(ctx, API_MOCK.APPLY, T.payoff);
  }
  await am25Payoff(ctx, API_MOCK.ROUTES_ENABLED);
}

/**
 * Demo action for `replay` step:
 * quietly replay fixture traffic, then hold on the first Journal row (no tab-switch rings).
 */
export async function runAm25Replay(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.START)) {
    await am25ClickQuiet(ctx, API_MOCK.START, T.payoff);
    await ctx.waitFor(API_MOCK.STOP, 20_000).catch(() => undefined);
    await am25Break(ctx);
  }

  await openAm25RuntimeTransactions(ctx, false);

  await sendApiMockRequest({ path: AM25_PATH_SESSION, method: 'GET' });
  await sendApiMockRequest({ path: AM25_PATH_PROFILE, method: 'GET' });

  for (let i = 0; i < 18 && !firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW); i++) {
    await ctx.delay(200);
  }

  await am25ClickQuiet(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
}

/**
 * Demo action for `compare` step:
 * open Compare HAR when needed — one quiet click, no stacked spotlight rings.
 */
export async function runAm25Compare(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.TX_COMPARE_HAR) && firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am25ClickQuiet(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.fieldFilled);
  }
  await ctx.waitFor(API_MOCK.TX_COMPARE_HAR, 3_000).catch(() => undefined);
  await am25ClickQuiet(ctx, API_MOCK.TX_COMPARE_HAR, T.payoff);
  await ctx.waitFor(API_MOCK.HAR_COMPARE_MODAL, 5_000).catch(() => undefined);
}

/**
 * Demo action for `modal` step:
 * spotlight status badge → body diff rows → summary.
 */
export async function runAm25Modal(ctx: DemoActionContext): Promise<void> {
  await am25Reveal(ctx, API_MOCK.HAR_COMPARE_STATUS_BADGE, T.payoff);
  await am25Look(ctx, API_MOCK.HAR_COMPARE_STATUS_BADGE);
  await am25Break(ctx);

  const bodyRows = firstVisibleElement(API_MOCK.HAR_COMPARE_BODY_ROWS);
  if (bodyRows) {
    await am25Reveal(ctx, API_MOCK.HAR_COMPARE_BODY_ROWS, T.payoff);
    await am25Look(ctx, API_MOCK.HAR_COMPARE_BODY_ROWS);
    await am25Break(ctx);
  }

  const summary = firstVisibleElement(API_MOCK.HAR_COMPARE_SUMMARY);
  if (summary) {
    await am25Look(ctx, API_MOCK.HAR_COMPARE_SUMMARY);
    await am25Break(ctx);
  }

  // Close the modal
  if (firstVisibleElement(API_MOCK.HAR_COMPARE_CLOSE)) {
    await am25Click(ctx, API_MOCK.HAR_COMPARE_CLOSE, T.look);
  }
  await am25Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
}

/**
 * Demo action for `report` step:
 * spotlight the Compare report button in the Journal toolbar, then click it to
 * trigger the JSON download.
 */
export async function runAm25Report(ctx: DemoActionContext): Promise<void> {
  await am25Reveal(ctx, API_MOCK.JOURNAL_COMPARE_REPORT, T.payoff);
  await am25Look(ctx, API_MOCK.JOURNAL_COMPARE_REPORT);
  await am25Break(ctx);
  // Click the button to download the comparison report.
  if (firstVisibleElement(API_MOCK.JOURNAL_COMPARE_REPORT)) {
    await am25Click(ctx, API_MOCK.JOURNAL_COMPARE_REPORT, T.payoff);
  }
  await am25Payoff(ctx, API_MOCK.JOURNAL_COMPARE_REPORT);
}
