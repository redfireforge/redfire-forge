/**
 * Shared beat helpers for the API Mock demo curriculum (AM-01 … AM-24).
 *
 * Steps in this pack are **multi-beat**: one step performs several related actions
 * and moves the spotlight between them with a hold on each, instead of splitting
 * every click into its own step. `spotlightBeat` is the mechanism — it reuses the
 * step-level spotlight visual so the viewer reads it as "the ring moved here".
 */
import { listApiMockStudioServers } from '../../adapters';
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
  reviewForm: 2400,
  /** Quiet digest after the field tour — look at the whole request before Run. */
  digestRequest: 2000,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2400,
  /** Hold the verdict / results before **Close**. */
  beforeClose: 2400,
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

/**
 * Click **Pretty format** after a JSON paste so the viewer can read the payload.
 * No-ops when the control is missing (cURL / Catalog / Requests have no paste JSON).
 */
export async function prettyFormatImportPaste(
  ctx: DemoActionContext,
  opts: { look?: number; hold?: number } = {},
): Promise<void> {
  if (!firstVisibleElement(API_MOCK.IMPORT_PRETTY)) return;
  const hold = opts.hold ?? AM_DEMO_TIMING.payoff;
  await clickBeat(ctx, API_MOCK.IMPORT_PRETTY, {
    look: opts.look ?? AM_DEMO_TIMING.look,
    hold,
  });
  await spotlightBeat(ctx, API_MOCK.IMPORT_PASTE, hold);
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
  /** Skip **Save as sample** (retry, or the request is already a saved sample). */
  saveSample?: boolean;
  /** Skip the path / headers / body hold when a dedicated review already ran. */
  reviewFields?: boolean;
  /** Skip the compact Headers textarea hold (the Table popup already showed them). */
  reviewHeaders?: boolean;
  /** Skip the whole-request digest pause (compact / retry paths). */
  digest?: boolean;
  /** Extra beats after Save / field review, immediately before **Run simulation**. */
  afterReview?: (ctx: DemoActionContext) => Promise<void>;
};

/** Run swaps the form for Results. Click Request before filling the next probe. */
const ADHOC_FORM_REVEAL_MS = 4_000;

export async function ensureAdHocSimulateForm(
  ctx: DemoActionContext,
  hold: number = AM_DEMO_TIMING.tabSwitch,
): Promise<void> {
  if (firstVisibleElement(API_MOCK.SIMULATE_VIEW_REQUEST)) {
    await clickBeat(ctx, API_MOCK.SIMULATE_VIEW_REQUEST, { hold });
  }
  const adhoc = firstVisibleElement(API_MOCK.SIMULATE_SAMPLE_ADHOC);
  const onAdhoc = Boolean(adhoc?.classList.contains('active'));
  if (adhoc && !onAdhoc) {
    await clickBeat(ctx, API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN, { hold: 0 });
    if (!firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE)) {
      await revealBeat(ctx, API_MOCK.SIMULATE_SAVE_SAMPLE, {
        timeout: ADHOC_FORM_REVEAL_MS,
        hold: AM_DEMO_TIMING.panelReady,
      });
    }
  }
  // A selected saved sample still shows the request form (read-only) without Save.
  if (!firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE) && firstVisibleElement(API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN)) {
    await clickBeat(ctx, API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN, { hold: 0 });
    if (!firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE)) {
      await revealBeat(ctx, API_MOCK.SIMULATE_SAVE_SAMPLE, {
        timeout: ADHOC_FORM_REVEAL_MS,
        hold: AM_DEMO_TIMING.panelReady,
      });
    }
  }
}

/**
 * Run parks on Results; Save as sample switches back to Request and unmounts the
 * verdict. Lessons that wait for `SIMULATE_RESULT` must land here or Acting sits
 * on a 20s reveal that never comes.
 */
export async function ensureSimulateResultsPane(
  ctx: DemoActionContext,
  hold: number = AM_DEMO_TIMING.tabSwitch,
): Promise<void> {
  if (firstVisibleElement(API_MOCK.SIMULATE_RESULT)) return;
  if (!firstVisibleElement(API_MOCK.SIMULATE_VIEW_RESULTS)) return;
  await clickBeat(ctx, API_MOCK.SIMULATE_VIEW_RESULTS, { hold });
}

function defaultSimulateSampleName(): string {
  const methodEl = firstVisibleElement(API_MOCK.SIMULATE_METHOD);
  const method = methodEl?.getAttribute('data-value')?.trim()
    || methodEl?.textContent?.trim()
    || 'GET';
  return `${method} ${simulateFieldValue(API_MOCK.SIMULATE_PATH) || '/'}`;
}

/**
 * After the Simulate form is filled: **Save as sample** with a name, hold so the
 * viewer can read the saved request, then hold on **Run simulation** before the click.
 */
export async function reviewAndRunSimulation(
  ctx: DemoActionContext,
  timing: AmSimulateReviewTiming = {},
): Promise<void> {
  const review = timing.review ?? AM_DEMO_TIMING.reviewForm;
  const beforeRun = timing.beforeRun ?? AM_DEMO_TIMING.beforeRun;
  const sampleName = timing.sampleName ?? defaultSimulateSampleName();

  if (timing.saveSample !== false) {
    if (!firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE) && firstVisibleElement(API_MOCK.SIMULATE_VIEW_REQUEST)) {
      await clickBeat(ctx, API_MOCK.SIMULATE_VIEW_REQUEST, { hold: AM_DEMO_TIMING.panelReady });
    }
    if (!firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE) && firstVisibleElement(API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN)) {
      await clickBeat(ctx, API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN, { hold: 0 });
    }
    if (firstVisibleElement(API_MOCK.SIMULATE_SAVE_SAMPLE)) {
      await clickBeat(ctx, API_MOCK.SIMULATE_SAVE_SAMPLE, {
        look: AM_DEMO_TIMING.look,
        hold: AM_DEMO_TIMING.fieldFilled,
      });
      await ctx.waitFor(API_MOCK.SIMULATE_SAMPLE_NAME, 4_000);
      await fillBeat(ctx, API_MOCK.SIMULATE_SAMPLE_NAME, sampleName, {
        look: AM_DEMO_TIMING.look,
        hold: AM_DEMO_TIMING.fieldFilled,
      });
    }
  }

  if (timing.reviewFields !== false) {
    await spotlightBeat(ctx, API_MOCK.SIMULATE_PATH, review);
    if (timing.reviewHeaders !== false && simulateFieldValue(API_MOCK.SIMULATE_HEADERS)) {
      await spotlightBeat(ctx, API_MOCK.SIMULATE_HEADERS, review);
    }
    if (simulateFieldValue(API_MOCK.SIMULATE_BODY)) {
      await spotlightBeat(ctx, API_MOCK.SIMULATE_BODY, review);
    }
    if (timing.saveSample !== false && firstVisibleElement(API_MOCK.SIMULATE_SECTION_SAVED)) {
      await spotlightBeat(ctx, API_MOCK.SIMULATE_SECTION_SAVED, Math.min(review, 800));
    }
  }

  if (timing.reviewFields !== false && timing.digest !== false) {
    await ctx.delay(AM_DEMO_TIMING.digestRequest);
  }

  if (timing.afterReview) {
    await timing.afterReview(ctx);
  }

  await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: beforeRun, hold: 0 });
  await ensureSimulateResultsPane(ctx);
}

/**
 * Close Rule Simulation. Pass `review: true` after a run so the viewer can read
 * the verdict before the workspace disappears. Guards / preAction stay quiet.
 */
export async function closeSimulateWorkspace(
  ctx: DemoActionContext,
  opts: { review?: boolean; afterClose?: number } = {},
): Promise<void> {
  if (!firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE)) return;
  if (opts.review) {
    if (firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)) {
      await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, AM_DEMO_TIMING.beforeClose);
    } else if (firstVisibleElement(API_MOCK.SIMULATE_RESULT)) {
      await spotlightBeat(ctx, API_MOCK.SIMULATE_RESULT, AM_DEMO_TIMING.beforeClose);
    } else {
      await ctx.delay(AM_DEMO_TIMING.beforeClose);
    }
  }
  if (!firstVisibleElement(API_MOCK.SIMULATE_CLOSE)) return;
  await ctx.click(API_MOCK.SIMULATE_CLOSE);
  await ctx.delay(opts.afterClose ?? AM_DEMO_TIMING.panelReady);
}

/**
 * Gallery import remaps template ids (`srv-gallery-*` / `srv-blank` → `srv-<uuid>`).
 * Prefer the live name, then the template id if it still exists, then active / first.
 */
export async function resolveApiMockStudioServerId(opts?: {
  name?: string;
  templateId?: string;
}): Promise<string | null> {
  const rows = await listApiMockStudioServers();
  if (rows.length === 0) return null;
  if (opts?.name) {
    const want = opts.name.toLowerCase();
    const byName = rows.find(s => s.name.toLowerCase() === want);
    if (byName) return byName.id;
  }
  if (opts?.templateId) {
    const byId = rows.find(s => s.id === opts.templateId);
    if (byId) return byId.id;
  }
  return rows.find(s => s.active)?.id ?? rows[0]?.id ?? null;
}

export async function waitForApiMockStudioServerId(
  ctx: DemoActionContext,
  opts?: { name?: string; templateId?: string; timeout?: number },
): Promise<string> {
  const timeout = opts?.timeout ?? 8_000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const id = await resolveApiMockStudioServerId(opts);
    if (id) return id;
    await ctx.delay(150);
  }
  return (await resolveApiMockStudioServerId(opts)) ?? opts?.templateId ?? '';
}

/** Reset the workflow picker to “Select server…” so the next pick is visible. */
export function clearApiMockWfServerPicker(): boolean {
  const el = firstVisibleElement(API_MOCK.WF_SERVER);
  if (!el) return false;
  const wrap = el.classList.contains('cs-wrapper') ? el : el.closest('.cs-wrapper');
  if (!wrap) return false;
  if (!(wrap.getAttribute('data-value') ?? '')) return false;
  wrap.dispatchEvent(new CustomEvent('custom-select:set-value', { detail: { value: '' } }));
  return true;
}

/** True when the workflow picker has loaded Studio options (or already shows `serverId`). */
export async function waitForApiMockWfServerReady(
  ctx: DemoActionContext,
  serverId: string,
  timeout = 8_000,
): Promise<boolean> {
  const host = firstVisibleElement(API_MOCK.WF_SERVER_HOST);
  if (!host) return true;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = Number(firstVisibleElement(API_MOCK.WF_SERVER_HOST)?.getAttribute('data-count') ?? 0);
    const value = firstVisibleElement(API_MOCK.WF_SERVER)?.getAttribute('data-value') ?? '';
    if (count > 0 || (serverId && value === serverId)) return true;
    await ctx.delay(100);
  }
  return false;
}
