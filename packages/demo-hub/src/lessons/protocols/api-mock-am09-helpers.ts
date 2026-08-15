/**
 * AM-09 `am-09-conflicts` helpers — Conflict Inspector: four overlap kinds.
 *
 * Quiet corpus is eight path-disjoint rules that analyze into one finding of
 * each kind. Analysis, filters, witness Simulate, Open in Studio, the priority
 * quick-fix, and acknowledge-then-stale are authored live. Gallery import
 * remints route ids, so explorer rows are located by the delete-button name
 * and findings by kind filter (never by minted `conflict-*` ids).
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
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
  reviewAndRunSimulation,
  closeSimulateWorkspace,
  spotlightBeat,
  spotlightElementBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

/**
 * AM-09 holds as long as AM-04…AM-08. Filters, dimension rows, and Simulate
 * AMBIGUOUS are dense — the viewer needs time on each ring before the next beat.
 */
export const AM09_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  traceRow: 1400,
  simOutcome: 1800,
  beforeOpen: 1400,
  reviewForm: 2400,
  beforeRun: 2600,
} as const;

const T = AM09_TIMING;

export const AM09_CORPUS_SAMPLE = 'am-gallery-overlaps';
export const AM09_HEALTH_A = 'Health A';
export const AM09_HEALTH_B = 'Health B';
export const AM09_DAILY = 'Daily report';
export const AM09_HEALTH_PATH = '/health';
export const AM09_PRIORITY_DEFAULT = 10;
export const AM09_PRIORITY_RAISED = 20;
export const AM09_PRIORITY_STALE = 11;

export const AM09_KIND_ALL = 'all';
export const AM09_KIND_DUPLICATE = 'duplicate';
export const AM09_KIND_SHADOWED = 'shadowed';
export const AM09_KIND_DEFINITE = 'definite_overlap';
export const AM09_KIND_POTENTIAL = 'potential_overlap';

async function am09Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a tab or modal trigger before the click. */
async function am09Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am09Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am09Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am09Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am09Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am09Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Rule / view probes ──────────────────────────────────────────────────────

export function am09RuleRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

function rowName(row: HTMLElement): string {
  const label = row.parentElement?.querySelector('[aria-label^="Delete rule "]')
    ?.getAttribute('aria-label') ?? '';
  return label.replace(/^Delete rule /, '');
}

export function am09RuleRow(name: string): HTMLElement | null {
  return am09RuleRows().find(row => rowName(row) === name) ?? null;
}

export function am09RuleSelector(name: string): string | null {
  const testid = am09RuleRow(name)?.getAttribute('data-testid');
  return testid ? `[data-testid="${testid}"]` : null;
}

export function am09OpenRuleName(): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.ROUTE_NAME)?.value ?? '';
}

export function isAm09RuleOpen(name: string): boolean {
  return am09OpenRuleName() === name;
}

export function am09PriorityValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.PRIORITY_INPUT)?.value ?? '';
}

export function isAm09StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm09ConflictsView(): boolean {
  return Boolean(
    firstVisibleElement(API_MOCK.CONFLICTS_PAGE)
    ?? firstVisibleElement(API_MOCK.CONFLICT_INSPECTOR)
    ?? firstVisibleElement(API_MOCK.CONFLICT_GUIDE),
  );
}

export function hasAm09Workspace(): boolean {
  return am09RuleRows().length > 0;
}

export function hasAm09RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm09SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function am09SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am09HasFindings(): boolean {
  return Boolean(
    firstVisibleElement(API_MOCK.FIRST_FINDING)
    || firstVisibleElement(API_MOCK.CONFLICT_SUMMARY)
    || firstVisibleElement(API_MOCK.CONFLICT_FILTER_EMPTY),
  );
}

export function am09FindingCount(): number {
  return document.querySelectorAll(API_MOCK.FIRST_FINDING).length;
}

export function am09FilterActive(kind: string): boolean {
  return firstVisibleElement(API_MOCK.conflictFilter(kind))?.classList.contains('active') ?? false;
}

export function am09FilterCount(kind: string): number {
  const btn = document.querySelector(API_MOCK.conflictFilter(kind));
  const badge = btn?.querySelector('.am-count-badge');
  const n = Number(badge?.textContent ?? '');
  return Number.isFinite(n) ? n : 0;
}

export function am09FingerprintsOpen(): boolean {
  return Boolean(document.querySelector<HTMLDetailsElement>(API_MOCK.CONFLICT_FINGERPRINTS)?.open);
}

export function am09SummaryText(): string {
  return firstVisibleElement(API_MOCK.CONFLICT_SUMMARY)?.textContent?.trim() ?? '';
}

export function am09DimRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.CONFLICT_DIM_ROW));
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm09Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM09_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-09: failed to import ${AM09_CORPUS_SAMPLE}`);
  }
  prepareApiMockStudioChrome();
}

export async function cleanupAm09(): Promise<void> {
  await wipeApiMockWorkspace();
}

export async function closeAm09Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm09SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, opts);
}

export async function ensureAm09StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm09StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm09ConflictsView(ctx: DemoActionContext): Promise<void> {
  await closeAm09Simulate(ctx);
  if (isAm09ConflictsView()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) return;
  await ctx.click(API_MOCK.VIEW_CONFLICTS);
  await ctx.waitFor(API_MOCK.CONFLICTS_PAGE, 10_000);
}

export async function ensureAm09Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm09Simulate(ctx);
  if (hasAm09Workspace() || isAm09ConflictsView()) return;
  await ensureAm09StudioView(ctx);
  if (hasAm09Workspace()) return;
  await importApiMockGallerySample(AM09_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function ensureAm09Analyzed(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Workspace(ctx);
  await closeAm09Simulate(ctx);
  if (am09HasFindings()) {
    await ensureAm09ConflictsView(ctx);
    return;
  }
  if (firstVisibleElement(API_MOCK.ANALYZE)) {
    await ctx.click(API_MOCK.ANALYZE);
  } else {
    await ensureAm09ConflictsView(ctx);
    const analyze = firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)
      ?? firstVisibleElement(API_MOCK.CONFLICT_GUIDE_ANALYZE);
    if (analyze) await ctx.click(
      firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)
        ? API_MOCK.CONFLICTS_ANALYZE
        : API_MOCK.CONFLICT_GUIDE_ANALYZE,
    );
  }
  await ctx.waitFor(API_MOCK.FIRST_FINDING, 10_000);
}

export async function ensureAm09Filter(ctx: DemoActionContext, kind: string): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await ensureAm09ConflictsView(ctx);
  if (am09FilterActive(kind)) return;
  const sel = API_MOCK.conflictFilter(kind);
  if (!firstVisibleElement(sel)) return;
  await ctx.click(sel);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

async function ensureAm09MatchTab(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.CONFLICT_NOTICE) || firstVisibleElement(API_MOCK.PRIORITY_INPUT)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_MATCH)) return;
  await ctx.click(API_MOCK.BTAB_MATCH);
  await ctx.delay(AM_DEMO_TIMING.tabSwitch);
}

export async function openAm09Rule(ctx: DemoActionContext, name: string): Promise<boolean> {
  await ensureAm09Workspace(ctx);
  await ensureAm09StudioView(ctx);
  if (!isAm09RuleOpen(name)) {
    const selector = am09RuleSelector(name);
    if (!selector) return false;
    await ctx.click(selector);
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
    for (let i = 0; i < 12 && !isAm09RuleOpen(name); i++) {
      await ctx.delay(100);
    }
  }
  await ensureAm09MatchTab(ctx);
  return isAm09RuleOpen(name);
}

/** Step 7+ — Daily report is already +10, so definite reclassified to shadowed. */
export async function ensureAm09PriorityRaised(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DEFINITE);
  if (firstVisibleElement(API_MOCK.CONFLICT_FILTER_EMPTY) && am09FilterCount(AM09_KIND_SHADOWED) >= 2) {
    await ensureAm09ConflictsView(ctx);
    return;
  }
  if (!await openAm09Rule(ctx, AM09_DAILY)) return;
  if (am09PriorityValue() !== String(AM09_PRIORITY_RAISED)) {
    patchApiMockActiveRoute({ priority: AM09_PRIORITY_RAISED });
    await ensureAm09ConflictsView(ctx);
    if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
      await ctx.click(API_MOCK.CONFLICTS_ANALYZE);
      await ctx.delay(AM_DEMO_TIMING.panelReady);
    }
    return;
  }
  await ensureAm09ConflictsView(ctx);
}

export async function ensureAm09ForAcknowledge(ctx: DemoActionContext): Promise<void> {
  await ensureAm09PriorityRaised(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DUPLICATE);
}

export async function ensureAm09ForWitness(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DUPLICATE);
}

export async function ensureAm09ForGoto(ctx: DemoActionContext): Promise<void> {
  await ensureAm09ForWitness(ctx);
}

export async function ensureAm09ForFix(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DEFINITE);
}

// ── Live steps ──────────────────────────────────────────────────────────────

async function applyFilter(ctx: DemoActionContext, kind: string): Promise<void> {
  const sel = API_MOCK.conflictFilter(kind);
  if (!firstVisibleElement(sel)) return;
  if (am09FilterActive(kind)) {
    await am09Look(ctx, sel);
    return;
  }
  await am09Aim(ctx, sel);
}

/** Step 1 — static analysis, the Match-tab notice, then Re-analyze. */
export async function runAm09Analyze(ctx: DemoActionContext): Promise<void> {
  await closeAm09Simulate(ctx);
  await ensureAm09Workspace(ctx);
  await ensureAm09StudioView(ctx);

  if (firstVisibleElement(API_MOCK.ANALYZE)) {
    await am09Aim(ctx, API_MOCK.ANALYZE);
    await am09Reveal(ctx, API_MOCK.CONFLICT_INSPECTOR, T.panelReady);
  } else if (firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) {
    await am09Aim(ctx, API_MOCK.VIEW_CONFLICTS);
    await am09Reveal(ctx, API_MOCK.CONFLICTS_PAGE, T.panelReady);
  } else {
    // Empty landing — waitFor on missing Analyze/Conflicts would burn the 45s action budget.
    return;
  }
  await am09Reveal(ctx, API_MOCK.CONFLICT_LIST);
  await am09Look(ctx, API_MOCK.CONFLICT_SUMMARY);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  await am09Break(ctx);

  if (firstVisibleElement(API_MOCK.VIEW_STUDIO)) {
    await am09Aim(ctx, API_MOCK.VIEW_STUDIO);
    await am09Reveal(ctx, API_MOCK.ROUTE_EXPLORER);
    const health = am09RuleSelector(AM09_HEALTH_A);
    if (health) {
      await am09Click(ctx, health, 0);
      await am09Reveal(ctx, API_MOCK.ROUTE_EDITOR);
      await ensureAm09MatchTab(ctx);
      if (firstVisibleElement(API_MOCK.CONFLICT_NOTICE)) {
        await am09Payoff(ctx, API_MOCK.CONFLICT_NOTICE);
      }
    }
  }

  if (!firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) return;
  await am09Aim(ctx, API_MOCK.VIEW_CONFLICTS);
  await am09Reveal(ctx, API_MOCK.CONFLICT_INSPECTOR);
  if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
    await am09Aim(ctx, API_MOCK.CONFLICTS_ANALYZE);
  }
  await am09Reveal(ctx, API_MOCK.CONFLICT_LIST);
  await am09Payoff(ctx, API_MOCK.CONFLICT_SUMMARY);
}

/** Step 2 — identical method / path / predicates, proven by fingerprints. */
export async function runAm09Duplicate(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  await am09Look(ctx, API_MOCK.CONFLICT_DETAIL);
  await openAm09FingerprintsLive(ctx);
}

/** Click the summary (details.click() does not toggle). Belt-set `open` if needed. */
async function openAm09FingerprintsLive(ctx: DemoActionContext): Promise<void> {
  const details = document.querySelector<HTMLDetailsElement>(API_MOCK.CONFLICT_FINGERPRINTS);
  if (!details) return;

  if (!details.open) {
    if (firstVisibleElement(API_MOCK.CONFLICT_FINGERPRINTS_SUMMARY)) {
      await am09Click(ctx, API_MOCK.CONFLICT_FINGERPRINTS_SUMMARY, T.panelReady);
    }
    if (!details.open) details.open = true;
  }

  if (typeof details.scrollIntoView === 'function') {
    details.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  const hashes = firstVisibleElement(API_MOCK.CONFLICT_FINGERPRINT_HASHES);
  if (hashes && typeof hashes.scrollIntoView === 'function') {
    hashes.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_FINGERPRINT_RELATION)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_FINGERPRINT_RELATION);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_FINGERPRINT_LEFT)) {
    await am09Look(ctx, API_MOCK.CONFLICT_FINGERPRINT_LEFT);
    await am09Payoff(ctx, API_MOCK.CONFLICT_FINGERPRINT_RIGHT);
  } else {
    await am09Payoff(
      ctx,
      hashes ? API_MOCK.CONFLICT_FINGERPRINT_HASHES : API_MOCK.CONFLICT_FINGERPRINTS,
    );
  }
}

/** Step 3 — higher-priority superset, with the dimension table. */
export async function runAm09Shadowed(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await applyFilter(ctx, AM09_KIND_SHADOWED);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  await am09Look(ctx, API_MOCK.CONFLICT_DETAIL);
  if (firstVisibleElement(API_MOCK.CONFLICT_DIMENSIONS)) {
    await am09Look(ctx, API_MOCK.CONFLICT_DIMENSIONS);
    for (const row of am09DimRows()) {
      await spotlightElementBeat(ctx, row, T.traceRow);
    }
  }
  await am09Payoff(ctx, API_MOCK.CONFLICT_DETAIL);
}

/** Step 4 — always-collides vs cannot-decide (regex ∩ regex). */
export async function runAm09DefiniteVsPotential(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await applyFilter(ctx, AM09_KIND_DEFINITE);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  await am09Look(ctx, API_MOCK.CONFLICT_DETAIL);
  await am09Break(ctx);

  await applyFilter(ctx, AM09_KIND_POTENTIAL);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Look(ctx, API_MOCK.FIRST_FINDING);
  if (firstVisibleElement(API_MOCK.CONFLICT_DIM_UNKNOWN)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_DIM_UNKNOWN);
  } else {
    await am09Payoff(ctx, API_MOCK.CONFLICT_DIMENSIONS);
  }
}

/** Step 5 — witness request → Simulate → AMBIGUOUS, then close. */
export async function runAm09Witness(ctx: DemoActionContext): Promise<string> {
  await ensureAm09ForWitness(ctx);
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  await am09Reveal(ctx, API_MOCK.CONFLICT_WITNESS);
  await am09Payoff(ctx, API_MOCK.CONFLICT_WITNESS);

  if (!isAm09SimulateOpen() && firstVisibleElement(API_MOCK.CONFLICT_SIMULATE)) {
    await am09Aim(ctx, API_MOCK.CONFLICT_SIMULATE);
  }
  await am09Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  await reviewAndRunSimulation(ctx, {
    review: T.reviewForm,
    beforeRun: T.beforeRun,
    sampleName: `GET ${AM09_HEALTH_PATH} — witness`,
  });
  await ctx.waitFor(API_MOCK.SIMULATE_OUTCOME, 10_000);
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  const outcome = am09SimOutcome();
  await am09Break(ctx);
  await closeAm09Simulate(ctx, { review: true });
  if (firstVisibleElement(API_MOCK.CONFLICT_INSPECTOR)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_INSPECTOR);
  }
  return outcome;
}

/** Step 6 — Open in Studio, hold the rule, return to Conflicts. */
export async function runAm09GotoRule(ctx: DemoActionContext): Promise<void> {
  await ensureAm09ForGoto(ctx);
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  if (!firstVisibleElement(API_MOCK.CONFLICT_GOTO_LEFT)) return;
  await am09Aim(ctx, API_MOCK.CONFLICT_GOTO_LEFT);
  await am09Reveal(ctx, API_MOCK.ROUTE_EDITOR);
  if (firstVisibleElement(API_MOCK.PATH_INPUT)) {
    await am09Payoff(ctx, API_MOCK.PATH_INPUT);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_NOTICE)) {
    await am09Look(ctx, API_MOCK.CONFLICT_NOTICE);
  }
  await am09Break(ctx);
  await am09Aim(ctx, API_MOCK.VIEW_CONFLICTS);
  await am09Reveal(ctx, API_MOCK.CONFLICT_INSPECTOR);
  await am09Payoff(ctx, API_MOCK.CONFLICT_INSPECTOR);
}

/** Step 7 — raise Daily +10; Definite empties because the pair is now Shadowed. */
export async function runAm09FixPriority(ctx: DemoActionContext): Promise<void> {
  await ensureAm09ForFix(ctx);
  await applyFilter(ctx, AM09_KIND_DEFINITE);

  if (!firstVisibleElement(API_MOCK.CONFLICT_FILTER_EMPTY) && firstVisibleElement(API_MOCK.CONFLICT_ADJUST_PRIORITY)) {
    await am09Look(ctx, API_MOCK.FIRST_FINDING);
    await am09Aim(ctx, API_MOCK.CONFLICT_ADJUST_PRIORITY);
    await am09Reveal(ctx, API_MOCK.CONFLICT_PRIO_MENU);
    await am09Payoff(ctx, API_MOCK.CONFLICT_PRIO_LEFT);
    await am09Click(ctx, API_MOCK.CONFLICT_PRIO_LEFT, 0);
    await am09Reveal(ctx, API_MOCK.CONFLICT_FILTER_EMPTY, T.payoff);
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_FILTER_EMPTY)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_FILTER_EMPTY);
  }
  await am09Look(ctx, API_MOCK.conflictFilter(AM09_KIND_DEFINITE));
  await am09Break(ctx);
  await applyFilter(ctx, AM09_KIND_SHADOWED);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Look(ctx, API_MOCK.FIRST_FINDING);
  await am09Payoff(ctx, API_MOCK.CONFLICT_SUMMARY);
}

/** Step 8 — acknowledge the duplicate, edit a fingerprint, Re-analyze → Stale. */
export async function runAm09Acknowledge(ctx: DemoActionContext): Promise<void> {
  await ensureAm09ForAcknowledge(ctx);
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);

  if (firstVisibleElement(API_MOCK.CONFLICT_STALE)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_STALE);
    return;
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_ACKNOWLEDGE)) {
    await am09Aim(ctx, API_MOCK.CONFLICT_ACKNOWLEDGE);
    await am09Reveal(ctx, API_MOCK.CONFLICT_ACK);
    await am09Payoff(ctx, API_MOCK.CONFLICT_ACK);
  } else if (firstVisibleElement(API_MOCK.CONFLICT_ACK)) {
    await am09Look(ctx, API_MOCK.CONFLICT_ACK);
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_STALE)) {
    await am09Payoff(ctx, API_MOCK.CONFLICT_STALE);
    return;
  }

  await am09Break(ctx);
  if (firstVisibleElement(API_MOCK.CONFLICT_GOTO_LEFT)) {
    await am09Aim(ctx, API_MOCK.CONFLICT_GOTO_LEFT);
    await am09Reveal(ctx, API_MOCK.ROUTE_EDITOR);
  } else if (!await openAm09Rule(ctx, AM09_HEALTH_A)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.PRIORITY_INPUT)) {
    await am09Fill(ctx, API_MOCK.PRIORITY_INPUT, String(AM09_PRIORITY_STALE), T.payoff);
    patchApiMockActiveRoute({ priority: AM09_PRIORITY_STALE });
  }
  await am09Aim(ctx, API_MOCK.VIEW_CONFLICTS);
  await am09Reveal(ctx, API_MOCK.CONFLICT_INSPECTOR);
  if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
    await am09Aim(ctx, API_MOCK.CONFLICTS_ANALYZE);
  }
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  await am09Reveal(ctx, API_MOCK.CONFLICT_STALE, T.payoff);
  await am09Payoff(ctx, API_MOCK.CONFLICT_STALE);
}
