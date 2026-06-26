/** Lesson 2 (Variables) — History search, compare mark, and compare panel guards. */
import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  areLesson2StudioExecutionsDone,
  ensureExecutedWithBob,
  getDemoUserAId,
  getDemoUserBId,
} from './core';

let _lesson2HistoryReady = false;

export function resetLesson2VariablesHistoryFlags(): void {
  _lesson2HistoryReady = false;
}

/** Slot filled when either the list row or compare bar reflects React state. */
export function isCompareSlotFilled(slot: 'A' | 'B'): boolean {
  const rowSel = slot === 'A' ? GQL.HISTORY_ENTRY_SLOT_A : GQL.HISTORY_ENTRY_SLOT_B;
  const barSel = slot === 'A' ? GQL.HISTORY_COMPARE_SLOT_A_FILLED : GQL.HISTORY_COMPARE_SLOT_B_FILLED;
  return !!(document.querySelector(rowSel) || document.querySelector(barSel));
}

/** Open History panel with at least one entry (Lesson 2 — history steps guard). */
export async function ensureHistoryPanelWithEntries(ctx: DemoActionContext): Promise<void> {
  const historyActive = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)?.classList.contains('gql-activity-tab--active');

  // Fast path: studio runs are done and history was already verified — do not touch Response.
  if (_lesson2HistoryReady && areLesson2StudioExecutionsDone()) {
    if (!historyActive) {
      await ctx.click(GQL.ACTIVITY_HISTORY);
      await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
      await ctx.delay(400);
    }
    if (document.querySelector(GQL.HISTORY_ENTRY)) return;
  }

  // Ensure Alice/Bob runs exist in History without refocusing the Response pane (left sidebar stays in focus).
  await ensureExecutedWithBob(ctx, { skipResponseFocus: true });

  if (!historyActive) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
    await ctx.delay(400);
  }
  if (_lesson2HistoryReady && document.querySelector(GQL.HISTORY_ENTRY)) return;
  await ctx.waitFor(GQL.HISTORY_ENTRY, 8000);
  _lesson2HistoryReady = true;
}

/** Enable History compare mode (Lesson 2 — compare-mark step guard). */
export async function ensureHistoryCompareModeOn(ctx: DemoActionContext): Promise<void> {
  await ensureHistoryPanelWithEntries(ctx);
  const active = document.querySelector<HTMLElement>(GQL.HISTORY_COMPARE_TOGGLE)?.classList.contains('gql-history-compare-toggle--active');
  if (!active) {
    await ctx.click(GQL.HISTORY_COMPARE_TOGGLE);
    await ctx.waitFor(GQL.HISTORY_COMPARE_BAR, 5000);
    await ctx.delay(400);
  }
}

/** Click the + mark on the first unmarked row — never targets an already-marked row. */
async function clickFirstUnmarkedCompareMark(ctx: DemoActionContext, slot: 'A' | 'B'): Promise<void> {
  await ctx.waitFor(GQL.HISTORY_COMPARE_MARK, 5000);
  const clickUnmarked = async (): Promise<boolean> => {
    if (!document.querySelector(GQL.HISTORY_COMPARE_MARK_UNMARKED)) return false;
    await ctx.waitFor(GQL.HISTORY_COMPARE_MARK_UNMARKED, 5000);
    await ctx.click(GQL.HISTORY_COMPARE_MARK_UNMARKED);
    return true;
  };
  if (await clickUnmarked()) return;
  // Compare marks may render one frame late — brief pause, then one more try.
  await ctx.delay(300);
  if (isCompareSlotFilled(slot)) return;
  await clickUnmarked();
}

async function waitForCompareSlotStamped(ctx: DemoActionContext, slot: 'A' | 'B'): Promise<void> {
  if (isCompareSlotFilled(slot)) return;
  const rowSel = slot === 'A' ? GQL.HISTORY_ENTRY_SLOT_A : GQL.HISTORY_ENTRY_SLOT_B;
  const barSel = slot === 'A' ? GQL.HISTORY_COMPARE_SLOT_A_FILLED : GQL.HISTORY_COMPARE_SLOT_B_FILLED;
  await ctx.waitFor(rowSel, 5000);
  if (!isCompareSlotFilled(slot)) {
    await ctx.waitFor(barSel, 5000);
  }
}

/** Search History and mark the first matching unmarked row for slot A or B (Lesson 2 demo action). */
export async function markHistoryCompareEntry(
  ctx: DemoActionContext,
  term: string,
  slot: 'A' | 'B',
): Promise<void> {
  if (isCompareSlotFilled(slot)) return;

  await ensureHistoryCompareModeOn(ctx);
  await ctx.fill(GQL.HISTORY_SEARCH, term);
  await ctx.delay(600);
  // Wait for a filtered unmarked row — not any stale entry from the prior search.
  await ctx.waitFor(GQL.HISTORY_COMPARE_MARK_UNMARKED, 5000);
  if (!document.querySelector(GQL.HISTORY_COMPARE_MARK_UNMARKED)) return;
  await clickFirstUnmarkedCompareMark(ctx, slot);
  // Wait for React to stamp slot — row attr and/or compare bar label.
  await waitForCompareSlotStamped(ctx, slot);
  await ctx.delay(400);
}

/** Search term that uniquely targets a GetUser run in History (variables JSON id). */
function compareSearchTermForSlot(slot: 'A' | 'B'): string {
  const id = slot === 'A' ? getDemoUserAId() : getDemoUserBId();
  return id || (slot === 'A' ? 'Alice' : 'Bob');
}

/** Mark Alice (A) and Bob (B) GetUser runs in History compare mode (Lesson 2 guard). */
export async function ensureHistoryCompareMarked(ctx: DemoActionContext): Promise<void> {
  await ensureHistoryCompareModeOn(ctx);
  if (document.querySelector(GQL.HISTORY_COMPARE_BTN_ENABLED)) return;
  if (!isCompareSlotFilled('A')) {
    await markHistoryCompareEntry(ctx, compareSearchTermForSlot('A'), 'A');
  }
  if (!isCompareSlotFilled('B')) {
    await markHistoryCompareEntry(ctx, compareSearchTermForSlot('B'), 'B');
  }
}

/** Open the History compare panel with Alice vs Bob (Lesson 2 guard). */
export async function ensureHistoryComparePanelOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.HISTORY_COMPARE_PANEL)) return;
  await ensureHistoryCompareMarked(ctx);
  await ctx.waitFor(GQL.HISTORY_COMPARE_BTN_ENABLED, 8000);
  if (!document.querySelector(GQL.HISTORY_COMPARE_BTN_ENABLED)) {
    await ensureHistoryCompareMarked(ctx);
    await ctx.waitFor(GQL.HISTORY_COMPARE_BTN_ENABLED, 5000);
  }
  const btn = document.querySelector<HTMLButtonElement>(GQL.HISTORY_COMPARE_BTN);
  if (!btn || btn.disabled) return;
  await ctx.click(GQL.HISTORY_COMPARE_BTN);
  await ctx.waitFor(GQL.HISTORY_COMPARE_PANEL, 5000);
  await ctx.delay(600);
}
