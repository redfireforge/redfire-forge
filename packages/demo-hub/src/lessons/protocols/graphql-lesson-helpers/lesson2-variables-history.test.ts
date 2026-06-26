/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GQL } from '@shared/selectors';
import {
  ensureHistoryCompareMarked,
  ensureHistoryComparePanelOpen,
  ensureHistoryPanelWithEntries,
  isCompareSlotFilled,
  markHistoryCompareEntry,
  resetLesson2VariablesHistoryFlags,
} from './lesson2-variables-history';

vi.mock('./core', () => ({
  ensureExecutedWithBob: vi.fn().mockResolvedValue(undefined),
  areLesson2StudioExecutionsDone: vi.fn(() => false),
  getDemoUserAId: vi.fn(() => ''),
  getDemoUserBId: vi.fn(() => ''),
}));

function makeCtx() {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    delay: vi.fn().mockResolvedValue(undefined),
  };
}

describe('lesson2-variables-history', () => {
  beforeEach(() => {
    resetLesson2VariablesHistoryFlags();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('ensureHistoryPanelWithEntries opens history tab when inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
    `;
    const ctx = makeCtx();
    const core = await import('./core');
    await ensureHistoryPanelWithEntries(ctx);
    expect(core.ensureExecutedWithBob).toHaveBeenCalledWith(ctx, { skipResponseFocus: true });
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_PANEL, 5000);
  });

  it('ensureHistoryPanelWithEntries skips re-execute when history already ready', async () => {
    const core = await import('./core');
    vi.mocked(core.areLesson2StudioExecutionsDone).mockReturnValue(true);
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryPanelWithEntries(ctx);
    vi.mocked(core.ensureExecutedWithBob).mockClear();
    await ensureHistoryPanelWithEntries(ctx);
    expect(core.ensureExecutedWithBob).not.toHaveBeenCalled();
    vi.mocked(core.areLesson2StudioExecutionsDone).mockReturnValue(false);
  });

  it('ensureHistoryPanelWithEntries skips when already ready with entries', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryPanelWithEntries(ctx);
    await ensureHistoryPanelWithEntries(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureHistoryCompareMarked uses demo user id in search when seeded', async () => {
    const core = await import('./core');
    vi.mocked(core.getDemoUserAId).mockReturnValue('usr-alice-id');
    vi.mocked(core.getDemoUserBId).mockReturnValue('usr-bob-id');
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry"><button data-testid="gql-history-compare-mark"></button></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryCompareMarked(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'usr-alice-id');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'usr-bob-id');
    vi.mocked(core.getDemoUserAId).mockReturnValue('');
    vi.mocked(core.getDemoUserBId).mockReturnValue('');
  });

  it('ensureHistoryCompareMarked enables compare mode and marks Alice and Bob', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry"><button data-testid="gql-history-compare-mark"></button></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryCompareMarked(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_TOGGLE);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'Alice');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'Bob');
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED);
  });

  it('markHistoryCompareEntry does not retry when slot filled and no unmarked rows remain', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry" data-compare-slot="B">
        <button data-testid="gql-history-compare-mark">B</button>
      </div>
    `;
    const ctx = makeCtx();
    await markHistoryCompareEntry(ctx, 'Bob', 'B');
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureHistoryCompareMarked skips marking when compare button is already enabled', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <button data-testid="gql-history-compare-btn"></button>
    `;
    const ctx = makeCtx();
    await ensureHistoryCompareMarked(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureHistoryCompareMarked skips marking when slots already filled', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <div data-testid="gql-history-entry" data-compare-slot="A"></div>
      <div data-testid="gql-history-entry" data-compare-slot="B"></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryCompareMarked(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureHistoryComparePanelOpen opens panel when button enabled', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <div data-testid="gql-history-entry" data-compare-slot="A"></div>
      <div data-testid="gql-history-entry" data-compare-slot="B"></div>
      <button data-testid="gql-history-compare-btn"></button>
    `;
    const ctx = makeCtx();
    await ensureHistoryComparePanelOpen(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN_ENABLED, 8000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_PANEL, 5000);
  });

  it('ensureHistoryComparePanelOpen skips when panel already open', async () => {
    document.body.innerHTML = `<div data-testid="gql-history-compare-panel"></div>`;
    const ctx = makeCtx();
    await ensureHistoryComparePanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureHistoryComparePanelOpen skips click when button is missing', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <div data-testid="gql-history-entry" data-compare-slot="A"></div>
      <div data-testid="gql-history-entry" data-compare-slot="B"></div>
    `;
    const ctx = makeCtx();
    await ensureHistoryComparePanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
  });

  it('ensureHistoryComparePanelOpen skips click when button stays disabled after retry', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <div data-testid="gql-history-entry" data-compare-slot="A"></div>
      <button data-testid="gql-history-compare-btn" disabled></button>
    `;
    const ctx = makeCtx();
    await ensureHistoryComparePanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'Bob');
  });

  it('markHistoryCompareEntry skips retry click when slot fills before second attempt', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar">
        <span data-testid="gql-history-compare-slot-a" data-filled="false"></span>
      </div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry"></div>
    `;
    const ctx = makeCtx();
    ctx.delay = vi.fn().mockImplementation(async (ms: number) => {
      if (ms === 300) {
        document.querySelector('[data-testid="gql-history-compare-slot-a"]')?.setAttribute('data-filled', 'true');
      }
    });
    await markHistoryCompareEntry(ctx, 'Alice', 'A');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED);
  });

  it('markHistoryCompareEntry waits for slot stamp without double-clicking unmarked', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry">
        <button data-testid="gql-history-compare-mark">+</button>
      </div>
    `;
    const ctx = makeCtx();
    let unmarkedClicks = 0;
    ctx.click = vi.fn().mockImplementation(async (sel: string) => {
      if (sel === GQL.HISTORY_COMPARE_MARK_UNMARKED) {
        unmarkedClicks += 1;
        document.querySelector('[data-testid="gql-history-entry"]')?.setAttribute('data-compare-slot', 'A');
      }
    });
    await markHistoryCompareEntry(ctx, 'Alice', 'A');
    expect(unmarkedClicks).toBe(1);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_SLOT_A_FILLED, 5000);
  });

  it('markHistoryCompareEntry skips when compare bar shows slot filled before row stamp', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar">
        <span data-testid="gql-history-compare-slot-a" data-filled="true">A: GetUser · Alice</span>
      </div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry">
        <button data-testid="gql-history-compare-mark">+</button>
      </div>
    `;
    const ctx = makeCtx();
    await markHistoryCompareEntry(ctx, 'Alice', 'A');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('markHistoryCompareEntry clicks unmarked row mark when a slot is already filled', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry" data-compare-slot="A">
        <button data-testid="gql-history-compare-mark">A</button>
      </div>
      <div data-testid="gql-history-entry">
        <button data-testid="gql-history-compare-mark">+</button>
      </div>
    `;
    const ctx = makeCtx();
    await markHistoryCompareEntry(ctx, 'Bob', 'B');
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED, 5000);
  });

  it('isCompareSlotFilled returns true when compare bar slot is filled', () => {
    document.body.innerHTML = `
      <span data-testid="gql-history-compare-slot-a" data-filled="true"></span>
    `;
    expect(isCompareSlotFilled('A')).toBe(true);
    expect(isCompareSlotFilled('B')).toBe(false);
  });

  it('markHistoryCompareEntry skips mark click when search has no unmarked rows', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry" data-compare-slot="A">
        <button data-testid="gql-history-compare-mark">A</button>
      </div>
    `;
    const ctx = makeCtx();
    await markHistoryCompareEntry(ctx, 'zzznomatch', 'B');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'zzznomatch');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED);
  });
});
