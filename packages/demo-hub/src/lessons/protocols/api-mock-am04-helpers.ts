/**
 * AM-04 `am-04-path-matching` helpers — Path Matching & the Pattern Toolbox.
 *
 * The corpus ships a single literal rule; parameterized, glob and regex matchers are
 * all authored live on top of it, so nothing here may hard-code a rule id — rows are
 * resolved by the path they render. Steps are multi-beat (see `api-mock-demo-helpers`)
 * and every stateful step has an `ensure*` guard so rapid **Next** still leaves the
 * next step a real matcher to work on.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  wipeApiMockWorkspace,
  type ApiMockDemoPathKind,
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
  spotlightBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

/**
 * AM-04 holds longer than the shared pack. Kind badges, toolbox verdicts, and
 * Simulate MATCHED/UNMATCHED are dense — a first-time viewer needs time on each ring.
 */
export const AM04_TIMING = {
  /** Spotlight hold while the viewer reads a control before it is used. */
  look: 900,
  /** A filled path / sample / regex the viewer must read. */
  fieldFilled: 850,
  /** Toolbox or Simulate tab switch. */
  tabSwitch: 1100,
  /** Toolbox / Simulate / editor painted after an open click. */
  panelReady: 1000,
  /** Kind badge, MATCHED/UNMATCHED, extraction, Apply landing. */
  payoff: 1600,
  /** Breath between clusters inside one multi-beat step. */
  groupBreak: 1200,
  /** Filled Simulate path, held so the viewer can read it before Run. */
  reviewForm: 2200,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2200,
} as const;

const T = AM04_TIMING;

async function am04Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am04Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am04Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am04Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am04Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am04Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

/** Background corpus: one hard-coded rule, the way a recording leaves it. */
export const AM04_CORPUS_SAMPLE = 'am-gallery-paths';

/** The literal the corpus ships — matches exactly one product and nothing else. */
export const AM04_LITERAL_PATH = '/products/42';
/** Parameterized rewrite authored in step 1. */
export const AM04_PARAM_PATH = '/products/:id';
/** Anchored path regex applied from the pattern library in step 6. */
export const AM04_REGEX_PATH = '^/products/[0-9]+$';

/** Order lookup authored live — an id shape the product recognizes as dynamic. */
export const AM04_ORDER_RULE_NAME = 'Get Order';
export const AM04_ORDER_LITERAL_PATH = '/orders/A-1098';
export const AM04_ORDER_TEMPLATE_PATH = '/orders/:orderId';
/** A different order id, so the Test path proves capture rather than equality. */
export const AM04_ORDER_TEST_PATH = '/orders/B-2001';

/** Asset catch-all authored live — the glob beat. */
export const AM04_ASSET_RULE_NAME = 'Static assets';
export const AM04_ASSET_GLOB_PATH = '/assets/**';
/** Single `*` stops at one segment — used to fail on purpose before `**` is restored. */
export const AM04_ASSET_NARROW_PATTERN = '/assets/*.png';
export const AM04_ASSET_TEST_PATH = '/assets/img/logo.png';

/** Path presets toured in step 3 (labels double as their testids). */
export const AM04_PRESET_SINGLE = '/users/:id';
export const AM04_PRESET_NESTED = 'nested params';
export const AM04_PRESET_GLOB = '/api/** (any depth)';

/** Pattern library entry picked in step 6, plus the search that surfaces it. */
export const AM04_LIBRARY_QUERY = 'numeric';
export const AM04_LIBRARY_ENTRY = 'Numeric ID';
/**
 * The library ships an id-shaped fragment (`^[0-9]+$`), so its live samples are bare
 * ids. Once the pattern is anchored to a whole path they have to become paths too —
 * that rewrite is the point of the beat, not a workaround.
 */
export const AM04_LIBRARY_SAMPLE_PATHS = ['/products/42', '/products/100234'] as const;

/** Simulate probes: a different id, a non-numeric id, and the original literal. */
export const AM04_SIM_PARAM_PATH = '/products/7';
export const AM04_SIM_LOOSE_PATH = '/products/abc';
export const AM04_SIM_LITERAL_PATH = '/products/42';

/** Every path form the products rule passes through — used to find its row again. */
const PRODUCT_PATHS: string[] = [AM04_LITERAL_PATH, AM04_PARAM_PATH, AM04_REGEX_PATH];

// ── Row identity ────────────────────────────────────────────────────────────

/** Every rule row currently rendered in the explorer. */
export function am04Rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

export function am04RowCount(): number {
  return am04Rows().length;
}

/** The path a row renders — `/products/:id`, not the rule name. */
export function am04RowPath(row: HTMLElement): string {
  return row.querySelector('.am-route-path')?.textContent?.trim() ?? '';
}

export function am04Row(path: string): HTMLElement | null {
  return am04Rows().find(r => am04RowPath(r) === path) ?? null;
}

/** The products rule, whatever matcher form it currently wears. */
export function am04ProductRow(): HTMLElement | null {
  return am04Rows().find(r => PRODUCT_PATHS.includes(am04RowPath(r))) ?? null;
}

export function am04RowId(row: HTMLElement): string | null {
  const testid = row.getAttribute('data-testid') ?? '';
  const prefix = 'api-mock-route-';
  return testid.startsWith(prefix) ? testid.slice(prefix.length) : null;
}

/** Selector for a row by rendered path, or null when it is not in the tree. */
export function am04RowSelector(path: string): string | null {
  const row = am04Row(path);
  const id = row ? am04RowId(row) : null;
  return id ? API_MOCK.route(id) : null;
}

/** Selector for the products rule's row. */
export function am04ProductRowSelector(): string | null {
  const row = am04ProductRow();
  const id = row ? am04RowId(row) : null;
  return id ? API_MOCK.route(id) : null;
}

/** Trace-candidate selector for the products rule, so "Winner" / "Path failed" is spotlightable. */
export function am04ProductCandidateSelector(): string {
  const row = am04ProductRow();
  const id = row ? am04RowId(row) : null;
  return id ? API_MOCK.simCandidate(id) : API_MOCK.SIMULATE_CANDIDATES;
}

// ── State probes ────────────────────────────────────────────────────────────

/** True when the Studio (authoring) view is mounted — Runtime / Conflicts unmount it. */
export function isAm04StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

/** True when the imported corpus (or anything authored on top of it) is on screen. */
export function hasAm04Workspace(): boolean {
  return am04RowCount() > 0;
}

export function hasAm04RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

/** The path currently in the Match row of the editor. */
export function am04PathValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.PATH_INPUT)?.value ?? '';
}

/** The kind badge next to it — `exact` / `parameterized` / `glob` / `regex`. */
export function am04PathKind(): string {
  return firstVisibleElement(API_MOCK.PATH_KIND)?.textContent?.trim() ?? '';
}

export function isAm04ToolboxOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.PATTERN_TOOLBOX));
}

export function isAm04SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

/** MATCHED / UNMATCHED / AMBIGUOUS / FAULT, or '' before the first run. */
export function am04SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

/**
 * Ids of the toolbox's live sample rows, in render order. A library pick replaces the
 * defaults (`s1`…`s4`) with pass/fail rows (`p0`, `p1`, `f0`, `f1`), so the ids can
 * only be read off the DOM.
 */
export function am04SampleRowIds(): string[] {
  const prefix = 'api-mock-toolbox-sample-row-';
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.TOOLBOX_SAMPLE_ROWS))
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(prefix))
    .map(id => id.slice(prefix.length));
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: the one-literal corpus and a collapsed app sidebar. */
export async function prepareAm04Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM04_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — the lesson never binds a listener, so just clear the workspace. */
export async function cleanupAm04(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Overlay hygiene ─────────────────────────────────────────────────────────

/** Dismiss the toolbox when a previous step (or an early Next) left it open. */
export async function closeAm04Toolbox(ctx: DemoActionContext): Promise<void> {
  if (!isAm04ToolboxOpen()) return;
  await ctx.click(API_MOCK.TOOLBOX_CANCEL);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

/** Dismiss the Simulate workspace so the next step's spotlight lands on the Studio. */
export async function closeAm04Simulate(ctx: DemoActionContext): Promise<void> {
  if (!isAm04SimulateOpen()) return;
  await ctx.click(API_MOCK.SIMULATE_CLOSE);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

// ── Guards ──────────────────────────────────────────────────────────────────

/** Authoring guards must not fire on Runtime / Conflicts — both unmount the explorer. */
export async function ensureAm04StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm04StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

/** Guard — the corpus must be the active workspace, with no overlay in the way. */
export async function ensureAm04Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm04Toolbox(ctx);
  await closeAm04Simulate(ctx);
  await ensureAm04StudioView(ctx);
  if (hasAm04Workspace()) return;
  await importApiMockGallerySample(AM04_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

/** Guard — the products rule is open in the editor (so patches target it). */
export async function ensureAm04ProductRuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm04Workspace(ctx);
  if (hasAm04RouteEditor() && PRODUCT_PATHS.includes(am04PathValue())) return;
  const selector = am04ProductRowSelector();
  if (!selector) return;
  await ctx.click(selector);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

/** Quietly force the products matcher into a known shape. */
async function setAm04ProductMatcher(
  ctx: DemoActionContext,
  path: string,
  pathKind: ApiMockDemoPathKind,
): Promise<void> {
  await ensureAm04ProductRuleOpen(ctx);
  if (am04PathValue() === path) return;
  if (!patchApiMockActiveRoute({ path, pathKind })) {
    await ctx.fill(API_MOCK.PATH_INPUT, path);
  }
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/** Guard for the opening step — back to the literal the recording produced. */
export async function ensureAm04LiteralPath(ctx: DemoActionContext): Promise<void> {
  await setAm04ProductMatcher(ctx, AM04_LITERAL_PATH, 'exact');
}

/** Guard — the parameterized rewrite must exist before it can be proven or refined. */
export async function ensureAm04ParamPath(ctx: DemoActionContext): Promise<void> {
  await setAm04ProductMatcher(ctx, AM04_PARAM_PATH, 'parameterized');
}

/** Guard — the anchored regex must be live before the closing proof. */
export async function ensureAm04RegexPath(ctx: DemoActionContext): Promise<void> {
  await setAm04ProductMatcher(ctx, AM04_REGEX_PATH, 'regex');
}

/** Author a rule live: add, name, and point its Match at `path`. */
async function addAm04Rule(
  ctx: DemoActionContext,
  name: string,
  path: string,
  opts: { visible?: boolean } = {},
): Promise<void> {
  const visible = opts.visible ?? true;
  if (visible) {
    await am04Click(ctx, API_MOCK.ADD_ROUTE, 0);
    await am04Reveal(ctx, API_MOCK.ROUTE_EDITOR);
    await am04Fill(ctx, API_MOCK.ROUTE_NAME, name);
    await am04Fill(ctx, API_MOCK.PATH_INPUT, path);
    return;
  }
  await ctx.click(API_MOCK.ADD_ROUTE);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
  await ctx.fill(API_MOCK.ROUTE_NAME, name);
  await ctx.fill(API_MOCK.PATH_INPUT, path);
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/**
 * Open the rule this step authors, adding it only when it is missing. Replaying a step
 * (Restart, or Back then Next) must not leave a second copy behind, so an existing rule
 * is reopened and reset to the literal the step starts from.
 */
async function openOrAddAm04Rule(
  ctx: DemoActionContext,
  name: string,
  startPath: string,
  knownPaths: string[],
): Promise<void> {
  const existing = knownPaths.map(p => am04RowSelector(p)).find(Boolean);
  if (!existing) {
    await addAm04Rule(ctx, name, startPath);
    return;
  }
  await am04Click(ctx, existing, 0);
  await am04Reveal(ctx, API_MOCK.ROUTE_EDITOR);
  await am04Fill(ctx, API_MOCK.PATH_INPUT, startPath);
}

/** Guard — the order lookup exists (either literal or already generalized). */
export async function ensureAm04OrderRule(ctx: DemoActionContext): Promise<void> {
  await ensureAm04ParamPath(ctx);
  if (am04Row(AM04_ORDER_TEMPLATE_PATH) || am04Row(AM04_ORDER_LITERAL_PATH)) return;
  await addAm04Rule(ctx, AM04_ORDER_RULE_NAME, AM04_ORDER_TEMPLATE_PATH, { visible: false });
}

/** Guard — the asset catch-all exists before later steps read the rule list. */
export async function ensureAm04AssetRule(ctx: DemoActionContext): Promise<void> {
  await ensureAm04OrderRule(ctx);
  if (am04Row(AM04_ASSET_GLOB_PATH)) return;
  await addAm04Rule(ctx, AM04_ASSET_RULE_NAME, AM04_ASSET_GLOB_PATH, { visible: false });
}

/** Guard for the regex step — all three rules exist and the products rule is open. */
export async function ensureAm04RegexReady(ctx: DemoActionContext): Promise<void> {
  await ensureAm04AssetRule(ctx);
  await ensureAm04ProductRuleOpen(ctx);
}

/** Guard for the closing step — full rule set, products rule regex, editor open. */
export async function ensureAm04ProofReady(ctx: DemoActionContext): Promise<void> {
  await ensureAm04AssetRule(ctx);
  await ensureAm04RegexPath(ctx);
}

// ── Simulate primitives ─────────────────────────────────────────────────────

/** Open Simulate from the editor header. */
async function openAm04Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm04SimulateOpen()) return;
  await am04Click(ctx, API_MOCK.SIMULATE, 0);
  await am04Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

/**
 * Run one ad-hoc path and hold on the verdict. After the path is filled the viewer
 * gets a dedicated review pass before **Run simulation**. A run swaps the request
 * form for the results pane, so later runs go back through **Request** first —
 * filling the hidden mirror field would change state the viewer never sees.
 */
async function runAm04Simulation(ctx: DemoActionContext, path: string): Promise<string> {
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  await am04Fill(ctx, API_MOCK.SIMULATE_PATH, path);
  await reviewAndRunSimulation(ctx, { review: T.reviewForm, beforeRun: T.beforeRun, sampleName: `GET ${path}` });
  await am04Reveal(ctx, API_MOCK.SIMULATE_RESULT);
  await am04Payoff(ctx, API_MOCK.SIMULATE_OUTCOME);
  return am04SimOutcome();
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — read the literal the recording left behind, then rewrite it as a template
 * and watch the kind badge re-infer itself.
 */
export async function runAm04ExactToParam(ctx: DemoActionContext): Promise<void> {
  await am04Payoff(ctx, API_MOCK.PATH_INPUT);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
  await am04Break(ctx);

  await am04Fill(ctx, API_MOCK.PATH_INPUT, AM04_PARAM_PATH);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
  await am04Look(ctx, API_MOCK.PRIORITY_INPUT);
}

/**
 * Step 2 — prove the template in Simulate: a different id matches, the segments are
 * in the normalized request, and a non-numeric id matches too. That last verdict is
 * the reason the lesson keeps going.
 */
export async function runAm04ProveParam(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  await openAm04Simulate(ctx);

  outcomes.push(await runAm04Simulation(ctx, AM04_SIM_PARAM_PATH));
  await am04Payoff(ctx, am04ProductCandidateSelector());
  await am04Click(ctx, API_MOCK.SIMULATE_TAB_REQUEST, T.tabSwitch);
  await am04Payoff(ctx, API_MOCK.SIMULATE_NORMALIZED);
  await am04Break(ctx);

  outcomes.push(await runAm04Simulation(ctx, AM04_SIM_LOOSE_PATH));
  await am04Payoff(ctx, am04ProductCandidateSelector());
  await closeAm04Simulate(ctx);
  await am04Look(ctx, API_MOCK.PATH_INPUT);
  return outcomes;
}

/**
 * Step 3 — tour the toolbox as a workbench: presets compose, the Test path judges,
 * Extraction shows the captures, and Cancel proves the rule is untouched until Apply.
 */
export async function runAm04ToolboxTour(ctx: DemoActionContext): Promise<void> {
  await am04Click(ctx, API_MOCK.PATH_TOOLBOX, 0);
  await am04Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);

  await am04Click(ctx, API_MOCK.toolboxPreset(AM04_PRESET_SINGLE));
  await am04Look(ctx, API_MOCK.TOOLBOX_PATTERN);
  await am04Look(ctx, API_MOCK.TOOLBOX_SAMPLE);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.toolboxPreset(AM04_PRESET_NESTED));
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_EXTRACTION);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.toolboxPreset(AM04_PRESET_GLOB));
  await am04Look(ctx, API_MOCK.TOOLBOX_KIND);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.TOOLBOX_CANCEL, T.panelReady);
  await am04Payoff(ctx, API_MOCK.PATH_INPUT);
}

/**
 * Step 4 — a second literal, generalized the way the product suggests: the dynamic
 * segment is detected, the template is composed, tested against a *different* id, and
 * only then applied.
 */
export async function runAm04Generalize(ctx: DemoActionContext): Promise<void> {
  await openOrAddAm04Rule(ctx, AM04_ORDER_RULE_NAME, AM04_ORDER_LITERAL_PATH, [
    AM04_ORDER_TEMPLATE_PATH,
    AM04_ORDER_LITERAL_PATH,
  ]);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.PATH_TOOLBOX, 0);
  await am04Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_SEGMENTS);
  await am04Click(ctx, API_MOCK.toolboxSegment(1));
  await am04Look(ctx, API_MOCK.TOOLBOX_KIND);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_SUGGESTED);
  await am04Break(ctx);

  await am04Fill(ctx, API_MOCK.TOOLBOX_PATTERN, AM04_ORDER_TEMPLATE_PATH);
  await am04Fill(ctx, API_MOCK.TOOLBOX_SAMPLE, AM04_ORDER_TEST_PATH);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_EXTRACTION);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await am04Payoff(ctx, API_MOCK.PATH_INPUT);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
}

/**
 * Step 5 — the glob rule, and the difference one star makes: `*` stays inside a
 * segment, `**` walks the whole subtree.
 */
export async function runAm04Glob(ctx: DemoActionContext): Promise<void> {
  await openOrAddAm04Rule(ctx, AM04_ASSET_RULE_NAME, AM04_ASSET_GLOB_PATH, [AM04_ASSET_GLOB_PATH]);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.PATH_TOOLBOX, 0);
  await am04Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  await am04Fill(ctx, API_MOCK.TOOLBOX_SAMPLE, AM04_ASSET_TEST_PATH);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Break(ctx);

  await am04Fill(ctx, API_MOCK.TOOLBOX_PATTERN, AM04_ASSET_NARROW_PATTERN);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Break(ctx);

  await am04Fill(ctx, API_MOCK.TOOLBOX_PATTERN, AM04_ASSET_GLOB_PATH);
  await am04Payoff(ctx, API_MOCK.TOOLBOX_RESULT);
  await am04Click(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
}

/**
 * Step 6 — back on the products rule: take a tested fragment off the library shelf,
 * anchor it to the whole path, re-point the live samples at real paths, and apply.
 */
export async function runAm04RegexLibrary(ctx: DemoActionContext): Promise<void> {
  const productRow = am04ProductRowSelector();
  if (productRow) {
    await am04Click(ctx, productRow, 0);
    await am04Reveal(ctx, API_MOCK.ROUTE_EDITOR);
  }
  await am04Click(ctx, API_MOCK.PATH_TOOLBOX, 0);
  await am04Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  await am04Click(ctx, API_MOCK.TOOLBOX_TAB_REGEX, T.tabSwitch);

  await am04Fill(ctx, API_MOCK.TOOLBOX_LIBRARY_SEARCH, AM04_LIBRARY_QUERY);
  await am04Click(ctx, API_MOCK.toolboxLib(AM04_LIBRARY_ENTRY));
  await am04Payoff(ctx, API_MOCK.TOOLBOX_REGEX);
  await am04Look(ctx, API_MOCK.TOOLBOX_SAFETY);
  const sampleIds = am04SampleRowIds();
  for (const id of sampleIds) {
    await am04Look(ctx, API_MOCK.toolboxSampleRow(id));
  }
  await am04Break(ctx);

  await am04Fill(ctx, API_MOCK.TOOLBOX_REGEX, AM04_REGEX_PATH);
  for (const [index, path] of AM04_LIBRARY_SAMPLE_PATHS.entries()) {
    const id = sampleIds[index];
    if (!id) continue;
    await am04Fill(ctx, API_MOCK.toolboxSampleValue(id), path);
  }
  await am04Payoff(ctx, API_MOCK.TOOLBOX_SAFETY);
  await am04Break(ctx);

  await am04Click(ctx, API_MOCK.TOOLBOX_FLAG_CI);
  await am04Click(ctx, API_MOCK.TOOLBOX_FLAG_CS);
  await am04Click(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await am04Payoff(ctx, API_MOCK.PATH_INPUT);
  await am04Payoff(ctx, API_MOCK.PATH_KIND);
}

/**
 * Step 7 — the same two probes as before, against the tightened matcher: the
 * non-numeric id is now rejected, the real one still gets its body.
 */
export async function runAm04ProveRegex(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  await openAm04Simulate(ctx);

  outcomes.push(await runAm04Simulation(ctx, AM04_SIM_LOOSE_PATH));
  await am04Payoff(ctx, am04ProductCandidateSelector());
  await am04Break(ctx);

  outcomes.push(await runAm04Simulation(ctx, AM04_SIM_LITERAL_PATH));
  await am04Payoff(ctx, am04ProductCandidateSelector());
  await am04Click(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  await am04Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  await closeAm04Simulate(ctx);
  await am04Payoff(ctx, API_MOCK.ROUTE_EXPLORER);
  return outcomes;
}
