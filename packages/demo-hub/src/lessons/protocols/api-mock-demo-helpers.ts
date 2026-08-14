/**
 * Shared beat helpers for the API Mock demo curriculum (AM-01 … AM-24).
 *
 * Steps in this pack are **multi-beat**: one step performs several related actions
 * and moves the spotlight between them with a hold on each, instead of splitting
 * every click into its own step. `spotlightBeat` is the mechanism — it reuses the
 * step-level spotlight visual so the viewer reads it as "the ring moved here".
 */
import { showSpotlightRing } from '../../demoRipple';
import { firstVisibleElement } from '../../utils/domVisibility';
import { API_MOCK } from '@shared/selectors';
import type { DemoActionContext } from '../../types';

/**
 * Paced holds for API Mock beats. Studio lifecycle (bind/drain) and journal writes
 * are slower than pure UI switches, so those get their own budgets.
 */
export const AM_DEMO_TIMING = {
  /** Workspace view switch (Studio / Runtime / Conflicts). */
  viewSwitch: 550,
  /** Panel or editor painted after a create/open click. */
  panelReady: 500,
  /** Body tab / dock tab switch. */
  tabSwitch: 500,
  /** A field the viewer must read after it was filled. */
  fieldFilled: 350,
  /** Spotlight hold while the viewer looks at a control before it is used. */
  look: 400,
  /** The outcome a step is teaching (badge, preview, detail pane). */
  payoff: 750,
  /** Listener bind / drain round-trip. */
  lifecycle: 1100,
  /** Journal write after real traffic. */
  journalWrite: 900,
  /** Breather between logical groups inside one multi-beat step. */
  groupBreak: 500,
  /** Filled Simulate fields, held so the viewer can read them before Run. */
  reviewForm: 2000,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2000,
} as const;

/**
 * Move the spotlight to `selector` and hold it so the viewer can read that control,
 * then clear the ring. Falls back to a plain pause when the element is not mounted,
 * so a beat never throws mid-step.
 */
export async function spotlightBeat(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number = AM_DEMO_TIMING.look,
): Promise<boolean> {
  return spotlightElementBeat(ctx, firstVisibleElement<HTMLElement>(selector), holdMs);
}

/**
 * Same beat for an element the DOM only hands over by search. Decision-trace predicate
 * rows carry no testid, so the row that failed can only be found by reading text — the
 * viewer still needs the ring on that one row rather than the whole candidate card.
 */
export async function spotlightElementBeat(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  holdMs: number = AM_DEMO_TIMING.look,
): Promise<boolean> {
  if (!el) {
    await ctx.delay(holdMs);
    return false;
  }
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const dispose = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
  return true;
}

/** Spotlight a control, click it, then hold on the result. */
export async function clickBeat(
  ctx: DemoActionContext,
  selector: string,
  opts: { look?: number; hold?: number } = {},
): Promise<void> {
  await spotlightBeat(ctx, selector, opts.look ?? AM_DEMO_TIMING.look);
  await ctx.click(selector);
  await ctx.delay(opts.hold ?? AM_DEMO_TIMING.fieldFilled);
}

/** Fill a field with a spotlight beforehand and a read pause after. */
export async function fillBeat(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  opts: { look?: number; hold?: number } = {},
): Promise<void> {
  await spotlightBeat(ctx, selector, opts.look ?? AM_DEMO_TIMING.look);
  await ctx.fill(selector, value);
  await ctx.delay(opts.hold ?? AM_DEMO_TIMING.fieldFilled);
}

/**
 * Pick a dropdown value with a spotlight beforehand and a read pause after.
 *
 * Studio pickers are `CustomSelect`, and the player's `selectOption` already opens the
 * menu and holds it so the viewer reads the whole option list before one is clicked —
 * which is the point when a step is teaching *what the choices are*.
 */
export async function selectBeat(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  opts: { look?: number; hold?: number } = {},
): Promise<void> {
  await spotlightBeat(ctx, selector, opts.look ?? AM_DEMO_TIMING.look);
  await ctx.selectOption(selector, value);
  await ctx.delay(opts.hold ?? AM_DEMO_TIMING.fieldFilled);
}

/** Wait for UI React just rendered, then hold so the viewer sees it appear. */
export async function revealBeat(
  ctx: DemoActionContext,
  selector: string,
  opts: { timeout?: number; hold?: number } = {},
): Promise<void> {
  await ctx.waitFor(selector, opts.timeout ?? 20_000);
  await ctx.delay(opts.hold ?? AM_DEMO_TIMING.panelReady);
}

function simulateFieldValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

export type AmSimulateReviewTiming = {
  /** Hold on each filled request field. */
  review?: number;
  /** Hold on **Run simulation** before the click. */
  beforeRun?: number;
  /** Name written after **Save as sample**. Defaults to `METHOD path`. */
  sampleName?: string;
  /** Skip **Save as sample** (a later run in the same step already saved one). */
  saveSample?: boolean;
};

export async function ensureAdHocSimulateForm(
  ctx: DemoActionContext,
  hold: number = AM_DEMO_TIMING.tabSwitch,
): Promise<void> {
  if (firstVisibleElement(API_MOCK.SIMULATE_VIEW_REQUEST)) {
    await clickBeat(ctx, API_MOCK.SIMULATE_VIEW_REQUEST, { hold });
  }
  const adhoc = firstVisibleElement(API_MOCK.SIMULATE_SAMPLE_ADHOC);
  if (adhoc && !adhoc.classList.contains('active')) {
    await clickBeat(ctx, API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN, { hold: 0 });
    await revealBeat(ctx, API_MOCK.SIMULATE_SAVE_SAMPLE, { hold: AM_DEMO_TIMING.panelReady });
  }
}

function defaultSimulateSampleName(): string {
  const methodEl = firstVisibleElement(API_MOCK.SIMULATE_METHOD);
  const method = methodEl?.getAttribute('data-value')?.trim()
    || methodEl?.textContent?.trim()
    || 'GET';
  return `${method} ${simulateFieldValue(API_MOCK.SIMULATE_PATH) || '/'}`;
}

/**
 * After the Simulate form is filled, walk the request the viewer must read,
 * save it so it can be reopened from the sidebar, name it, then hold on
 * **Run simulation** before clicking it.
 */
export async function reviewAndRunSimulation(
  ctx: DemoActionContext,
  timing: AmSimulateReviewTiming = {},
): Promise<void> {
  const review = timing.review ?? AM_DEMO_TIMING.reviewForm;
  const beforeRun = timing.beforeRun ?? AM_DEMO_TIMING.beforeRun;
  const sampleName = timing.sampleName ?? defaultSimulateSampleName();

  const glance = firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE)
    ? Math.min(review, 800)
    : review;

  await spotlightBeat(ctx, API_MOCK.SIMULATE_PATH, glance);
  if (simulateFieldValue(API_MOCK.SIMULATE_HEADERS)) {
    await spotlightBeat(ctx, API_MOCK.SIMULATE_HEADERS, glance);
  }
  if (simulateFieldValue(API_MOCK.SIMULATE_BODY)) {
    await spotlightBeat(ctx, API_MOCK.SIMULATE_BODY, glance);
  }

  if (timing.saveSample !== false && firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE)) {
    await clickBeat(ctx, API_MOCK.SIMULATE_SAVE_SAMPLE, {
      look: Math.min(review, 700),
      hold: AM_DEMO_TIMING.fieldFilled,
    });
    await ctx.waitFor(API_MOCK.SIMULATE_SAMPLE_NAME, 8_000);
    await fillBeat(ctx, API_MOCK.SIMULATE_SAMPLE_NAME, sampleName, {
      look: AM_DEMO_TIMING.look,
      hold: AM_DEMO_TIMING.fieldFilled,
    });
    await spotlightBeat(ctx, API_MOCK.SIMULATE_SECTION_SAVED, Math.min(review, 800));
  }

  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: beforeRun, hold: 0 });
}
