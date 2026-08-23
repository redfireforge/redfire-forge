/**
 * AM-09 `am-09-conflicts` helpers — Conflict Inspector: four overlap kinds.
 *
 * Quiet corpus is eight path-disjoint rules that analyze into one finding of
 * each kind. Analysis, filters, Duplicate and Shadowed two-probe Simulate, Open in Studio, the priority
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

type Am09WitnessPace = {
  look: number;
  hold: number;
  payoff: number;
  beforeOpen: number;
  beforeRun: number;
  groupBreak: number;
};

/**
 * Two-run witness finales. After **Run simulation** the verdict, the Decision-trace
 * cards, and the Rendered response all paint at once — so each of those beats gets a
 * real hold the viewer can read, not a flash. Budget ~34s of Acting for two probes,
 * leaving headroom for live ripple under the 45s cap.
 */
const AM09_WITNESS: Am09WitnessPace = {
  look: 500,
  hold: 650,
  payoff: 1400,
  beforeOpen: 850,
  beforeRun: 1800,
  groupBreak: 800,
};

/**
 * Step 6 (Shadowed) — same two-probe shape, but longer post-run holds so the
 * viewer can read MATCHED / winner / Conditions / Rendered before the next Run.
 * Sized to stay comfortably under the 45s Acting cap with compact open/run.
 */
const AM09_SHADOWED_WITNESS: Am09WitnessPace = {
  look: 650,
  hold: 800,
  payoff: 1700,
  beforeOpen: 800,
  beforeRun: 1400,
  groupBreak: 900,
};

export const AM09_CORPUS_SAMPLE = 'am-gallery-overlaps';
export const AM09_HEALTH_A = 'Health A';
export const AM09_HEALTH_B = 'Health B';
export const AM09_ORDERS_CATCHALL = 'Orders catch-all';
export const AM09_ORDERS_TENANT = 'Orders tenant';
export const AM09_DAILY = 'Daily report';
export const AM09_REPORTS_GLOB = 'Reports glob';
export const AM09_SEARCH_PREFIX = 'Search prefix';
export const AM09_SEARCH_REGION = 'Search region';
export const AM09_HEALTH_PATH = '/health';
export const AM09_ORDERS_PATH = '/orders';
export const AM09_TENANT_HEADER = 'x-tenant: acme';
export const AM09_TENANT_HEADER_MISS = '';
export const AM09_ORDERS_MISS_SAMPLE = `GET ${AM09_ORDERS_PATH} — no tenant`;
export const AM09_ORDERS_HIT_SAMPLE = `GET ${AM09_ORDERS_PATH} — tenant header`;
export const AM09_DAILY_PATH = '/reports/daily';
export const AM09_GLOB_PATH = '/reports/*';
export const AM09_NON_DAILY_PATH = '/reports/non-daily';
export const AM09_DAILY_SAMPLE = `GET ${AM09_DAILY_PATH} — definite witness`;
export const AM09_NON_DAILY_SAMPLE = `GET ${AM09_NON_DAILY_PATH} — glob only`;
export const AM09_SEARCH_PATH = '/search';
export const AM09_CLIENT_HEADER_HIT = 'x-client: acme-west';
export const AM09_CLIENT_HEADER_MISS = '';
export const AM09_SEARCH_HIT_SAMPLE = `GET ${AM09_SEARCH_PATH} — both regexes`;
export const AM09_SEARCH_MISS_SAMPLE = `GET ${AM09_SEARCH_PATH} — no header`;
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

/** Ring each Match-dimension row — never the whole dimensions table. */
async function holdAm09DimRows(ctx: DemoActionContext): Promise<void> {
  for (const row of am09DimRows()) {
    await spotlightElementBeat(ctx, row, T.look);
  }
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
  const named = API_MOCK.routeNamed(name);
  if (document.querySelector(named)) return named;
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

/** Quiet: findings exist, Studio is showing `firstName` so the reading highlight lands on that row. */
export async function ensureAm09ReadyForPair(ctx: DemoActionContext, firstName: string): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await openAm09Rule(ctx, firstName);
}

async function goAm09StudioLive(ctx: DemoActionContext): Promise<void> {
  if (isAm09StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await am09Aim(ctx, API_MOCK.VIEW_STUDIO);
  await am09Reveal(ctx, API_MOCK.ROUTE_EXPLORER, T.panelReady);
}

async function goAm09ConflictsLive(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.CONFLICT_INSPECTOR) && !isAm09StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) return;
  await am09Aim(ctx, API_MOCK.VIEW_CONFLICTS);
  await am09Reveal(ctx, API_MOCK.CONFLICT_INSPECTOR, T.panelReady);
}

/** Open one explorer rule and hold the fields that explain the collision. */
async function showAm09RuleLive(
  ctx: DemoActionContext,
  name: string,
  holds: string[],
): Promise<void> {
  const selector = am09RuleSelector(name);
  if (!selector) return;
  if (!isAm09RuleOpen(name)) {
    await am09Aim(ctx, selector);
    await am09Reveal(ctx, API_MOCK.ROUTE_EDITOR);
  } else {
    await am09Look(ctx, selector);
  }
  await ensureAm09MatchTab(ctx);
  for (const hold of holds) {
    if (firstVisibleElement(hold)) await am09Payoff(ctx, hold);
  }
}

/**
 * Studio first (the two rules), then Conflicts + kind filter.
 * That is the lesson beat: see why they collide, then see the name the inspector gives it.
 */
async function showPairThenKind(
  ctx: DemoActionContext,
  left: string,
  right: string,
  leftHolds: string[],
  rightHolds: string[],
  kind: string,
): Promise<void> {
  await closeAm09Simulate(ctx);
  await ensureAm09Workspace(ctx);
  await goAm09StudioLive(ctx);
  await showAm09RuleLive(ctx, left, leftHolds);
  await am09Break(ctx);
  await showAm09RuleLive(ctx, right, rightHolds);
  await am09Break(ctx);
  await goAm09ConflictsLive(ctx);
  if (!am09HasFindings()) {
    const analyze = firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)
      ?? firstVisibleElement(API_MOCK.ANALYZE)
      ?? firstVisibleElement(API_MOCK.CONFLICT_GUIDE_ANALYZE);
    if (analyze) {
      const sel = firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)
        ? API_MOCK.CONFLICTS_ANALYZE
        : firstVisibleElement(API_MOCK.ANALYZE)
          ? API_MOCK.ANALYZE
          : API_MOCK.CONFLICT_GUIDE_ANALYZE;
      await am09Aim(ctx, sel);
      await am09Reveal(ctx, API_MOCK.CONFLICT_LIST);
    }
  }
  await applyFilter(ctx, kind);
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
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DUPLICATE);
}

export async function ensureAm09ForWitness(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DUPLICATE);
}

export async function ensureAm09ForShadowedWitness(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_SHADOWED);
}

export async function ensureAm09ForDefiniteWitness(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_DEFINITE);
}

export async function ensureAm09ForPotentialWitness(ctx: DemoActionContext): Promise<void> {
  await ensureAm09Analyzed(ctx);
  await closeAm09Simulate(ctx);
  await ensureAm09Filter(ctx, AM09_KIND_POTENTIAL);
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
    await am09Payoff(ctx, sel);
    return;
  }
  await am09Aim(ctx, sel, T.panelReady);
  await am09Payoff(ctx, sel);
}

/** Walk the four findings in list order — that is the lesson map. */
async function tourLessonKinds(ctx: DemoActionContext): Promise<void> {
  for (const kind of [AM09_KIND_DUPLICATE, AM09_KIND_SHADOWED, AM09_KIND_DEFINITE, AM09_KIND_POTENTIAL]) {
    const row = API_MOCK.findingByKind(kind);
    if (firstVisibleElement(row)) await am09Look(ctx, row);
  }
}

/** Finding row + Open-in-Studio chips. Dimension rows one at a time — never the whole compare/detail. */
async function readFinding(
  ctx: DemoActionContext,
  opts: { dimensions?: boolean; payoff?: string } = {},
): Promise<void> {
  await am09Reveal(ctx, API_MOCK.FIRST_FINDING);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  if (firstVisibleElement(API_MOCK.CONFLICT_GOTO_LEFT)) {
    await am09Look(ctx, API_MOCK.CONFLICT_GOTO_LEFT);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_GOTO_RIGHT)) {
    await am09Look(ctx, API_MOCK.CONFLICT_GOTO_RIGHT);
  }
  if (opts.dimensions) {
    await holdAm09DimRows(ctx);
  }
  if (opts.payoff && firstVisibleElement(opts.payoff)) {
    await am09Payoff(ctx, opts.payoff);
  }
}

/** Step 1 — Analyze, then the four-kind map. No Studio detour. */
export async function runAm09Analyze(ctx: DemoActionContext): Promise<void> {
  await closeAm09Simulate(ctx);
  await ensureAm09Workspace(ctx);

  if (!(am09HasFindings() && isAm09ConflictsView())) {
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
  }
  await am09Reveal(ctx, API_MOCK.CONFLICT_LIST);
  await am09Payoff(ctx, API_MOCK.CONFLICT_SUMMARY);
  await tourLessonKinds(ctx);
  await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
}

/** Step 2 — Studio Health A vs Health B, then Conflicts names it Duplicate. */
export async function runAm09Duplicate(ctx: DemoActionContext): Promise<void> {
  await showPairThenKind(
    ctx,
    AM09_HEALTH_A,
    AM09_HEALTH_B,
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT, API_MOCK.CONDITIONS_EMPTY],
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT],
    AM09_KIND_DUPLICATE,
  );
  await readFinding(ctx);
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
    await am09Look(ctx, API_MOCK.CONFLICT_FINGERPRINT_RELATION);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_FINGERPRINT_LEFT)) {
    await am09Look(ctx, API_MOCK.CONFLICT_FINGERPRINT_LEFT);
    await am09Payoff(ctx, API_MOCK.CONFLICT_FINGERPRINT_RIGHT);
  }
}

/** Step 5 — Studio catch-all vs tenant, then Conflicts names it Shadowed. */
export async function runAm09Shadowed(ctx: DemoActionContext): Promise<void> {
  await showPairThenKind(
    ctx,
    AM09_ORDERS_CATCHALL,
    AM09_ORDERS_TENANT,
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT, API_MOCK.CONDITIONS_EMPTY],
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT, API_MOCK.FIRST_CONDITION],
    AM09_KIND_SHADOWED,
  );
  await readFinding(ctx, { dimensions: true });
}

/** Step 7 — Studio exact vs glob, then Conflicts names it Definite. */
export async function runAm09Definite(ctx: DemoActionContext): Promise<void> {
  await showPairThenKind(
    ctx,
    AM09_DAILY,
    AM09_REPORTS_GLOB,
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT],
    [API_MOCK.PATH_INPUT, API_MOCK.PRIORITY_INPUT],
    AM09_KIND_DEFINITE,
  );
  await readFinding(ctx, { dimensions: true });
}

/** Step 9 — Studio two regexes, then Conflicts names it Potential. */
export async function runAm09Potential(ctx: DemoActionContext): Promise<void> {
  await showPairThenKind(
    ctx,
    AM09_SEARCH_PREFIX,
    AM09_SEARCH_REGION,
    [API_MOCK.PATH_INPUT, API_MOCK.FIRST_CONDITION],
    [API_MOCK.PATH_INPUT, API_MOCK.FIRST_CONDITION],
    AM09_KIND_POTENTIAL,
  );
  await readFinding(ctx, { dimensions: true, payoff: API_MOCK.CONFLICT_DIM_UNKNOWN });
}

/** Stale HMR / old lesson module: Definite then Potential. Prefer the split runners. */
export async function runAm09DefiniteVsPotential(ctx: DemoActionContext): Promise<void> {
  await runAm09Definite(ctx);
  await runAm09Potential(ctx);
}

function am09CandidateSelectors(pathNeedle: string): string[] {
  const escaped = pathNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .filter(node => re.test(node.textContent ?? ''))
    .map(node => {
      const id = node.getAttribute('data-testid');
      return id ? `[data-testid="${id}"]` : '';
    })
    .filter(Boolean);
}

export function am09ConditionsFailedCandidate(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .find(node => (node.textContent ?? '').includes('Conditions failed')) ?? null;
}

export function am09FailedPredicateRow(needle?: string): HTMLElement | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_FAIL));
  if (needle) {
    return rows.find(row => (row.textContent ?? '').includes(needle)) ?? rows[0] ?? null;
  }
  return rows[0] ?? null;
}

/** /orders that matched but is not Winner — the shadowed tenant rule. */
export function am09MatchedLoserCandidate(pathNeedle: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .find((node) => {
      const text = node.textContent ?? '';
      if (!text.includes(pathNeedle)) return false;
      if (text.includes('Winner')) return false;
      if (/Path failed|Method failed|Conditions failed/.test(text)) return false;
      return true;
    }) ?? null;
}

export function am09PassedPredicateRow(
  needle: string,
  root?: HTMLElement | null,
): HTMLElement | null {
  const rows = root
    ? Array.from(root.querySelectorAll<HTMLElement>('.am-predicate'))
    : Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
  return rows
    .find((row) => {
      if (row.classList.contains('am-predicate--fail')) return false;
      const text = row.textContent ?? '';
      return text.includes(needle) && /passed|exact/i.test(text);
    }) ?? null;
}

/** A candidate that matched this path (not Path/Method/Conditions failed). */
export function am09MatchingCandidate(pathNeedle: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .find((node) => {
      const text = node.textContent ?? '';
      if (!text.includes(pathNeedle)) return false;
      if (/Path failed|Method failed|Conditions failed/.test(text)) return false;
      return true;
    }) ?? null;
}

export function am09PathFailedCandidate(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .find(node => (node.textContent ?? '').includes('Path failed')) ?? null;
}

export function am09PathPredicateRow(
  pathNeedle: string,
  root?: HTMLElement | null,
): HTMLElement | null {
  const rows = root
    ? Array.from(root.querySelectorAll<HTMLElement>('.am-predicate'))
    : Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
  return rows.find((row) => {
    const text = row.textContent ?? '';
    return /path/i.test(text) && text.includes(pathNeedle);
  }) ?? null;
}

/** Conditions-failed card, then the red header/path row the viewer must read. */
async function holdAm09FailedCondition(
  ctx: DemoActionContext,
  opts: { needle?: string; cardHold: number; rowHold: number },
): Promise<void> {
  if (
    !document.querySelector(API_MOCK.SIMULATE_CANDIDATES)
    && firstVisibleElement(API_MOCK.SIMULATE_TAB_TRACE)
  ) {
    await clickBeat(ctx, API_MOCK.SIMULATE_TAB_TRACE, { look: 400, hold: 0 });
  }
  const card = am09ConditionsFailedCandidate();
  if (card) {
    card.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, card, opts.cardHold);
  }
  const row = am09FailedPredicateRow(opts.needle);
  if (row) {
    row.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, row, opts.rowHold);
  }
}

/** Matched-but-lost card, then the green header row the viewer must read. */
async function holdAm09MatchedLoser(
  ctx: DemoActionContext,
  opts: { pathNeedle: string; needle?: string; cardHold: number; rowHold: number },
): Promise<void> {
  if (
    !document.querySelector(API_MOCK.SIMULATE_CANDIDATES)
    && firstVisibleElement(API_MOCK.SIMULATE_TAB_TRACE)
  ) {
    await clickBeat(ctx, API_MOCK.SIMULATE_TAB_TRACE, { look: 400, hold: 0 });
  }
  const card = am09MatchedLoserCandidate(opts.pathNeedle);
  if (card) {
    card.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, card, opts.cardHold);
  }
  const row = am09PassedPredicateRow(opts.needle ?? opts.pathNeedle, card);
  if (row) {
    row.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, row, opts.rowHold);
  }
}

/** Matching Decision-trace card, then the Path row the viewer must read. */
async function holdAm09MatchingCard(
  ctx: DemoActionContext,
  opts: { pathNeedle: string; cardHold: number; rowHold: number },
): Promise<void> {
  if (
    !document.querySelector(API_MOCK.SIMULATE_CANDIDATES)
    && firstVisibleElement(API_MOCK.SIMULATE_TAB_TRACE)
  ) {
    await clickBeat(ctx, API_MOCK.SIMULATE_TAB_TRACE, { look: 400, hold: 0 });
  }
  const card = am09MatchingCandidate(opts.pathNeedle);
  if (card) {
    card.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, card, opts.cardHold);
  }
  const row = am09PathPredicateRow(opts.pathNeedle, card);
  if (row) {
    row.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, row, opts.rowHold);
  }
}

/** Path-failed card, then the red Path row the viewer must read. */
async function holdAm09PathFailed(
  ctx: DemoActionContext,
  opts: { pathNeedle: string; cardHold: number; rowHold: number },
): Promise<void> {
  if (
    !document.querySelector(API_MOCK.SIMULATE_CANDIDATES)
    && firstVisibleElement(API_MOCK.SIMULATE_TAB_TRACE)
  ) {
    await clickBeat(ctx, API_MOCK.SIMULATE_TAB_TRACE, { look: 400, hold: 0 });
  }
  const card = am09PathFailedCandidate();
  if (card) {
    card.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, card, opts.cardHold);
  }
  const row = am09PathPredicateRow(opts.pathNeedle, card)
    ?? am09FailedPredicateRow(opts.pathNeedle);
  if (row) {
    row.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await spotlightElementBeat(ctx, row, opts.rowHold);
  }
}

/** Ring each matching Decision-trace card. Scrolls into view — /search sits below the path-failed rows. */
async function holdAm09Candidates(
  ctx: DemoActionContext,
  pathNeedles: string[],
  holdMs: number,
): Promise<void> {
  if (
    !document.querySelector(API_MOCK.SIMULATE_CANDIDATES)
    && firstVisibleElement(API_MOCK.SIMULATE_TAB_TRACE)
  ) {
    await clickBeat(ctx, API_MOCK.SIMULATE_TAB_TRACE, { look: 400, hold: 0 });
  }
  const seen = new Set<string>();
  for (const needle of pathNeedles) {
    for (const sel of am09CandidateSelectors(needle)) {
      if (seen.has(sel)) continue;
      seen.add(sel);
      const node = document.querySelector<HTMLElement>(sel);
      if (node) {
        // Scroll the card's last row into view so the full card clears the panel bottom.
        (node.lastElementChild as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        await spotlightElementBeat(ctx, node, holdMs);
      }
    }
  }
}

async function openAm09FindingSimulate(
  ctx: DemoActionContext,
  kind: string,
  opts: { compact?: boolean; pace?: Am09WitnessPace } = {},
): Promise<void> {
  const pace = opts.pace ?? AM09_WITNESS;
  if (opts.compact) {
    await ensureAm09Filter(ctx, kind);
    if (!isAm09SimulateOpen() && firstVisibleElement(API_MOCK.CONFLICT_SIMULATE)) {
      await clickBeat(ctx, API_MOCK.CONFLICT_SIMULATE, { look: pace.beforeOpen, hold: 0 });
    }
    await revealBeat(ctx, API_MOCK.SIMULATE_WORKSPACE, { timeout: 4_000, hold: pace.hold });
    await ensureAdHocSimulateForm(ctx, pace.hold);
    return;
  }

  await applyFilter(ctx, kind);
  if (firstVisibleElement(API_MOCK.CONFLICT_SIMULATE)) {
    await am09Look(ctx, API_MOCK.CONFLICT_SIMULATE);
  }

  if (!isAm09SimulateOpen() && firstVisibleElement(API_MOCK.CONFLICT_SIMULATE)) {
    await am09Aim(ctx, API_MOCK.CONFLICT_SIMULATE);
  }
  await am09Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
}

/**
 * Switch Results to Rendered response and wait for the pane to mount. Run resets the
 * tab to Decision trace, and under E2E pacing a single click's synchronous follow-up
 * check races React's commit — so wait for the pane, and click once more if the first
 * click did not land.
 */
async function openAm09RenderedTab(ctx: DemoActionContext): Promise<void> {
  const rendered = () => firstVisibleElement(API_MOCK.SIMULATE_RENDERED)
    ?? document.querySelector(API_MOCK.SIMULATE_RENDERED);
  const tabPresent = () => firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)
    ?? document.querySelector<HTMLElement>(API_MOCK.SIMULATE_TAB_RENDERED);
  if (rendered() || !tabPresent()) return;
  await clickBeat(ctx, API_MOCK.SIMULATE_TAB_RENDERED, { look: AM09_WITNESS.look, hold: 0 });
  await ctx.waitFor(API_MOCK.SIMULATE_RENDERED, 2_000);
  if (!rendered() && tabPresent()) {
    await ctx.click(API_MOCK.SIMULATE_TAB_RENDERED);
    await ctx.waitFor(API_MOCK.SIMULATE_RENDERED, 2_000);
  }
}

async function holdAm09SimulateResult(
  ctx: DemoActionContext,
  opts: {
    pathNeedles: string[];
    holdWinner?: boolean;
    candidateHold?: number;
    compact?: boolean;
    pace?: Am09WitnessPace;
    holdRenderedBody?: boolean;
    holdCandidates?: boolean;
    holdFailedCondition?: boolean;
    failedPredicateNeedle?: string;
    holdMatchedLoser?: boolean;
    matchedPredicateNeedle?: string;
    holdMatchingCard?: string;
    holdPathFailed?: string;
  },
): Promise<string> {
  const pace = opts.pace ?? AM09_WITNESS;
  if (opts.compact) {
    await ctx.waitFor(API_MOCK.SIMULATE_OUTCOME, 4_000);
    await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, pace.payoff);
    if (opts.holdWinner) {
      const winnerBadge = firstVisibleElement(API_MOCK.SIMULATE_WINNER);
      if (winnerBadge) {
        const card = winnerBadge.closest<HTMLElement>('.am-candidate');
        (card?.lastElementChild as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        await spotlightElementBeat(ctx, card ?? winnerBadge, pace.hold);
      }
    }
    if (opts.holdFailedCondition) {
      await holdAm09FailedCondition(ctx, {
        needle: opts.failedPredicateNeedle,
        cardHold: pace.payoff,
        rowHold: pace.hold,
      });
    }
    if (opts.holdMatchedLoser) {
      await holdAm09MatchedLoser(ctx, {
        pathNeedle: opts.pathNeedles[0] ?? '',
        needle: opts.matchedPredicateNeedle,
        cardHold: pace.payoff,
        rowHold: pace.hold,
      });
    }
    if (opts.holdMatchingCard) {
      await holdAm09MatchingCard(ctx, {
        pathNeedle: opts.holdMatchingCard,
        cardHold: pace.payoff,
        rowHold: pace.hold,
      });
    }
    if (opts.holdPathFailed) {
      await holdAm09PathFailed(ctx, {
        pathNeedle: opts.holdPathFailed,
        cardHold: pace.payoff,
        rowHold: pace.hold,
      });
    }
    if (opts.holdCandidates) {
      await holdAm09Candidates(ctx, opts.pathNeedles, opts.candidateHold ?? pace.payoff);
    }
    if (opts.holdRenderedBody) {
      await openAm09RenderedTab(ctx);
      if (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)
        || document.querySelector(API_MOCK.SIMULATE_RENDERED_STATUS)) {
        await spotlightBeat(ctx, API_MOCK.SIMULATE_RENDERED_STATUS, pace.hold);
      }
      if (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)
        || document.querySelector(API_MOCK.SIMULATE_RENDERED_BODY)) {
        await revealBeat(ctx, API_MOCK.SIMULATE_RENDERED_BODY, {
          timeout: 4_000,
          hold: pace.hold,
        });
        await spotlightBeat(ctx, API_MOCK.SIMULATE_RENDERED_BODY, pace.payoff);
      } else if (!firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)) {
        await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, pace.payoff);
      }
    } else if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)
      && !firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)
      && !firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)) {
      await clickBeat(ctx, API_MOCK.SIMULATE_TAB_RENDERED, { look: pace.look, hold: 0 });
      if (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)) {
        await spotlightBeat(ctx, API_MOCK.SIMULATE_RENDERED_STATUS, pace.hold);
      }
    } else {
      if (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)) {
        await spotlightBeat(ctx, API_MOCK.SIMULATE_RENDERED_STATUS, pace.hold);
      }
      if (!firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)) {
        const fallback = firstVisibleElement(API_MOCK.SIMULATE_RENDERED_BODY)
          ? API_MOCK.SIMULATE_RENDERED_BODY
          : API_MOCK.SIMULATE_OUTCOME;
        await spotlightBeat(ctx, fallback, pace.payoff);
      }
    }
    return am09SimOutcome();
  }

  await ctx.waitFor(API_MOCK.SIMULATE_OUTCOME, 10_000);
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  const outcome = am09SimOutcome();

  for (const needle of opts.pathNeedles) {
    for (const sel of am09CandidateSelectors(needle)) {
      if (firstVisibleElement(sel)) {
        await spotlightBeat(ctx, sel, opts.candidateHold ?? T.payoff);
      }
    }
  }
  if (opts.holdWinner) {
    const winnerBadge = firstVisibleElement(API_MOCK.SIMULATE_WINNER);
    if (winnerBadge) {
      const card = winnerBadge.closest<HTMLElement>('.am-candidate');
      (card?.lastElementChild as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      await spotlightElementBeat(ctx, card ?? winnerBadge, T.payoff);
    }
  }

  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am09Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)) {
    await am09Look(ctx, API_MOCK.SIMULATE_RENDERED_STATUS);
  }
  await am09Reveal(ctx, API_MOCK.SIMULATE_RENDERED_BODY, T.payoff);
  await am09Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  return outcome;
}

async function runAm09SimulateProbe(
  ctx: DemoActionContext,
  opts: {
    pathNeedles: string[];
    sampleName: string;
    headers?: string;
    path?: string;
    holdWinner?: boolean;
    candidateHold?: number;
    saveSample?: boolean;
    compact?: boolean;
    pace?: Am09WitnessPace;
    holdRenderedBody?: boolean;
    reviewHeaders?: boolean;
    reviewPath?: boolean;
    holdCandidates?: boolean;
    holdFailedCondition?: boolean;
    failedPredicateNeedle?: string;
    holdMatchedLoser?: boolean;
    matchedPredicateNeedle?: string;
    holdMatchingCard?: string;
    holdPathFailed?: string;
  },
): Promise<string> {
  const pace = opts.pace ?? AM09_WITNESS;
  const look = opts.compact ? pace.look : T.look;
  const hold = opts.compact ? pace.hold : T.fieldFilled;
  if (opts.path && firstVisibleElement(API_MOCK.SIMULATE_PATH)) {
    await fillBeat(ctx, API_MOCK.SIMULATE_PATH, opts.path, { look, hold });
  }
  if (opts.headers !== undefined && firstVisibleElement(API_MOCK.SIMULATE_HEADERS)) {
    await fillBeat(ctx, API_MOCK.SIMULATE_HEADERS, opts.headers, { look, hold });
  }

  const reviewRequest = opts.reviewPath || opts.reviewHeaders;
  await reviewAndRunSimulation(ctx, {
    reviewFields: false,
    digest: false,
    saveSample: opts.saveSample,
    beforeRun: opts.compact ? pace.beforeRun : T.beforeOpen,
    sampleName: opts.sampleName,
    afterReview: reviewRequest
      ? async () => {
        if (opts.reviewPath && firstVisibleElement(API_MOCK.SIMULATE_PATH)) {
          await spotlightBeat(ctx, API_MOCK.SIMULATE_PATH, pace.payoff);
        }
        if (opts.reviewHeaders && firstVisibleElement(API_MOCK.SIMULATE_HEADERS)) {
          await spotlightBeat(ctx, API_MOCK.SIMULATE_HEADERS, pace.payoff);
        }
      }
      : undefined,
  });
  return holdAm09SimulateResult(ctx, {
    pathNeedles: opts.pathNeedles,
    holdWinner: opts.holdWinner,
    candidateHold: opts.candidateHold,
    compact: opts.compact,
    pace,
    holdRenderedBody: opts.holdRenderedBody,
    holdCandidates: opts.holdCandidates,
    holdFailedCondition: opts.holdFailedCondition,
    failedPredicateNeedle: opts.failedPredicateNeedle,
    holdMatchedLoser: opts.holdMatchedLoser,
    matchedPredicateNeedle: opts.matchedPredicateNeedle,
    holdMatchingCard: opts.holdMatchingCard,
    holdPathFailed: opts.holdPathFailed,
  });
}

async function finishAm09Simulate(
  ctx: DemoActionContext,
  opts: { compact?: boolean } = {},
): Promise<void> {
  await closeAm09Simulate(ctx, opts.compact ? {} : { review: true });
  if (!opts.compact && firstVisibleElement(API_MOCK.FIRST_FINDING)) {
    await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  }
}

async function runAm09FindingSimulate(
  ctx: DemoActionContext,
  opts: {
    kind: string;
    pathNeedle: string;
    sampleName: string;
    headers?: string;
    holdWinner?: boolean;
    compact?: boolean;
    holdRenderedBody?: boolean;
  },
): Promise<string> {
  await openAm09FindingSimulate(ctx, opts.kind, { compact: opts.compact });
  const outcome = await runAm09SimulateProbe(ctx, {
    pathNeedles: [opts.pathNeedle],
    sampleName: opts.sampleName,
    headers: opts.headers,
    holdWinner: opts.holdWinner,
    compact: opts.compact,
    holdRenderedBody: opts.holdRenderedBody,
  });
  await finishAm09Simulate(ctx, { compact: opts.compact });
  return outcome;
}

/** Step 3 — Duplicate witness → both GET /health → Rendered 409, then close. */
export async function runAm09Witness(ctx: DemoActionContext): Promise<string> {
  await ensureAm09ForWitness(ctx);
  return runAm09FindingSimulate(ctx, {
    kind: AM09_KIND_DUPLICATE,
    pathNeedle: AM09_HEALTH_PATH,
    sampleName: `GET ${AM09_HEALTH_PATH} — witness`,
    compact: true,
    holdRenderedBody: true,
  });
}

/** Step 6 — Shadowed: no tenant header (catch-all only); then x-tenant: acme (both match, catch-all still wins). */
export async function runAm09ShadowedWitness(
  ctx: DemoActionContext,
): Promise<{ miss: string; hit: string }> {
  const pace = AM09_SHADOWED_WITNESS;
  await ensureAm09ForShadowedWitness(ctx);
  await openAm09FindingSimulate(ctx, AM09_KIND_SHADOWED, { compact: true, pace });

  const miss = await runAm09SimulateProbe(ctx, {
    pathNeedles: [AM09_ORDERS_PATH],
    sampleName: AM09_ORDERS_MISS_SAMPLE,
    headers: AM09_TENANT_HEADER_MISS,
    holdWinner: true,
    compact: true,
    pace,
    holdFailedCondition: true,
    failedPredicateNeedle: 'x-tenant',
    holdRenderedBody: true,
  });

  await ctx.delay(pace.groupBreak);
  await ensureAdHocSimulateForm(ctx, pace.hold);

  const hit = await runAm09SimulateProbe(ctx, {
    pathNeedles: [AM09_ORDERS_PATH],
    sampleName: AM09_ORDERS_HIT_SAMPLE,
    headers: AM09_TENANT_HEADER,
    holdWinner: true,
    compact: true,
    pace,
    holdMatchedLoser: true,
    matchedPredicateNeedle: 'x-tenant',
    holdRenderedBody: true,
  });

  await finishAm09Simulate(ctx, { compact: true });
  return { miss, hit };
}

/** Step 8 — Definite: /reports/daily collides (409); /reports/non-daily is glob-only (200). */
export async function runAm09DefiniteWitness(
  ctx: DemoActionContext,
): Promise<{ daily: string; globOnly: string }> {
  const pace = AM09_WITNESS;
  await ensureAm09ForDefiniteWitness(ctx);
  await openAm09FindingSimulate(ctx, AM09_KIND_DEFINITE, { compact: true, pace });

  const daily = await runAm09SimulateProbe(ctx, {
    path: AM09_DAILY_PATH,
    pathNeedles: [AM09_DAILY_PATH, AM09_GLOB_PATH],
    sampleName: AM09_DAILY_SAMPLE,
    compact: true,
    pace,
    holdMatchingCard: AM09_DAILY_PATH,
    holdRenderedBody: true,
  });

  await ctx.delay(pace.groupBreak);
  await ensureAdHocSimulateForm(ctx, pace.hold);

  const globOnly = await runAm09SimulateProbe(ctx, {
    path: AM09_NON_DAILY_PATH,
    pathNeedles: [AM09_DAILY_PATH, AM09_GLOB_PATH],
    sampleName: AM09_NON_DAILY_SAMPLE,
    holdWinner: true,
    compact: true,
    pace,
    holdPathFailed: AM09_DAILY_PATH,
    holdRenderedBody: true,
  });

  await finishAm09Simulate(ctx, { compact: true });
  return { daily, globOnly };
}

/** Step 10 — Potential: x-client matches both regexes (409); no header is unmatched (404). */
export async function runAm09PotentialWitness(
  ctx: DemoActionContext,
): Promise<{ hit: string; miss: string }> {
  const pace = AM09_WITNESS;
  await ensureAm09ForPotentialWitness(ctx);
  await openAm09FindingSimulate(ctx, AM09_KIND_POTENTIAL, { compact: true, pace });

  const hit = await runAm09SimulateProbe(ctx, {
    pathNeedles: [AM09_SEARCH_PATH],
    sampleName: AM09_SEARCH_HIT_SAMPLE,
    headers: AM09_CLIENT_HEADER_HIT,
    compact: true,
    pace,
    holdCandidates: true,
    holdRenderedBody: true,
  });

  await ctx.delay(pace.groupBreak);
  await ensureAdHocSimulateForm(ctx, pace.hold);

  const miss = await runAm09SimulateProbe(ctx, {
    pathNeedles: [AM09_SEARCH_PATH],
    path: AM09_SEARCH_PATH,
    sampleName: AM09_SEARCH_MISS_SAMPLE,
    headers: AM09_CLIENT_HEADER_MISS,
    compact: true,
    pace,
    holdFailedCondition: true,
    failedPredicateNeedle: 'x-client',
    holdRenderedBody: true,
  });

  await finishAm09Simulate(ctx, { compact: true });
  return { hit, miss };
}

/** Step 4 — Open in Studio, hold the rule, return to Conflicts. */
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
  if (firstVisibleElement(API_MOCK.FIRST_FINDING)) {
    await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  }
}

/** Step 11 — raise Daily +10; Definite empties because the pair is now Shadowed. */
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

/** Step 12 — acknowledge the Duplicate /health pair, edit a fingerprint, Re-analyze → Stale. */
export async function runAm09Acknowledge(ctx: DemoActionContext): Promise<void> {
  await ensureAm09ForAcknowledge(ctx);
  await applyFilter(ctx, AM09_KIND_DUPLICATE);
  if (firstVisibleElement(API_MOCK.FIRST_FINDING)) {
    await am09Payoff(ctx, API_MOCK.FIRST_FINDING);
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_STALE)) {
    await spotlightBeat(ctx, API_MOCK.CONFLICT_STALE, T.payoff);
    return;
  }

  await openAm09FingerprintsLive(ctx);

  if (firstVisibleElement(API_MOCK.CONFLICT_ACKNOWLEDGE)) {
    await clickBeat(ctx, API_MOCK.CONFLICT_ACKNOWLEDGE, { look: T.look, hold: 0 });
    await revealBeat(ctx, API_MOCK.CONFLICT_ACK, { timeout: 4_000, hold: T.payoff });
  } else if (firstVisibleElement(API_MOCK.CONFLICT_ACK)) {
    await spotlightBeat(ctx, API_MOCK.CONFLICT_ACK, T.look);
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_STALE)) {
    await spotlightBeat(ctx, API_MOCK.CONFLICT_STALE, T.payoff);
    return;
  }

  if (firstVisibleElement(API_MOCK.CONFLICT_GOTO_LEFT)) {
    await clickBeat(ctx, API_MOCK.CONFLICT_GOTO_LEFT, { look: T.look, hold: 0 });
    await revealBeat(ctx, API_MOCK.ROUTE_EDITOR, { timeout: 4_000, hold: AM_DEMO_TIMING.panelReady });
  } else if (!await openAm09Rule(ctx, AM09_HEALTH_A)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.PRIORITY_INPUT)) {
    await fillBeat(ctx, API_MOCK.PRIORITY_INPUT, String(AM09_PRIORITY_STALE), {
      look: T.look,
      hold: T.payoff,
    });
    patchApiMockActiveRoute({ priority: AM09_PRIORITY_STALE });
  }
  await clickBeat(ctx, API_MOCK.VIEW_CONFLICTS, { look: T.look, hold: 0 });
  await revealBeat(ctx, API_MOCK.CONFLICT_INSPECTOR, { timeout: 4_000, hold: AM_DEMO_TIMING.panelReady });
  if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
    await clickBeat(ctx, API_MOCK.CONFLICTS_ANALYZE, { look: T.beforeOpen, hold: 0 });
  }
  // After the priority bump (10 → 11), the health pair reclassifies from
  // Duplicate to Shadowed (priorities now differ). Switch to All so that
  // filtered[0] auto-selects the stale Shadowed finding and the banner renders.
  await ensureAm09Filter(ctx, AM09_KIND_ALL);
  await revealBeat(ctx, API_MOCK.CONFLICT_STALE, { timeout: 4_000, hold: T.payoff });
}
