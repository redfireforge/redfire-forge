/**
 * AM-08 `am-08-selection-policy` helpers — boolean groups, priority, and selection policy.
 *
 * Two GET /catalog rules ship in the corpus at equal priority. Regional already requires
 * `X-Api-Version`; Default matches everything. Nested OR tenants, a None-of guard,
 * priority, and the two multiple-match policies are authored live. Rule ids are reminted
 * on gallery import, so rows are located by the delete-button name; nested group ids are
 * minted by the editor, so they are read off the DOM. `ensure*` guards replace the Match
 * tree (and, where needed, priority / selection settings) through the quiet patch bridge.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  patchApiMockServerSettings,
  prepareApiMockStudioChrome,
  wipeApiMockWorkspace,
  type ApiMockDemoPredicate,
  type ApiMockDemoPredicateGroup,
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
  selectBeat,
  spotlightBeat,
  spotlightElementBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

/**
 * AM-08 holds longer than the shared pack. Nested groups, Selection settings, and
 * Simulate traces are dense — and after a form is filled the viewer needs time on
 * the values *before* **Run simulation**.
 */
export const AM08_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  traceRow: 1400,
  simOutcome: 1800,
  /** Spotlight on a tab or modal trigger before the click. */
  beforeOpen: 1400,
  /** Filled Simulate path / headers, held so the viewer can read them before Run. */
  reviewForm: 2200,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2600,
} as const;

const T = AM08_TIMING;

async function am08Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a tab or modal trigger, then click — viewer sees where we are going. */
async function am08Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am08Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am08Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.look, hold });
}

async function am08Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout: 8_000 });
}

async function am08Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am08Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am08Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

async function am08Trace(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  hold: number = T.traceRow,
): Promise<void> {
  await spotlightElementBeat(ctx, el, hold);
}

/** Background corpus: two overlapping GET /catalog rules at equal priority. */
export const AM08_CORPUS_SAMPLE = 'am-gallery-selection';

export const AM08_PATH = '/catalog';
export const AM08_REGIONAL_NAME = 'Regional catalog';
export const AM08_DEFAULT_NAME = 'Default catalog';

export const AM08_VERSION_KEY = 'x-api-version';
export const AM08_VERSION_VALUE = '2024-11';
export const AM08_TENANT_KEY = 'x-tenant';
export const AM08_TENANT_EU = 'acme-eu';
export const AM08_TENANT_US = 'acme-us';
export const AM08_DEBUG_KEY = 'x-debug';

export const AM08_PRIORITY_DEFAULT = 10;
export const AM08_PRIORITY_RAISED = 20;

/** The request that satisfies Regional's authored logic *and* still matches Default. */
export const AM08_SIM_HEADERS = [
  `X-Api-Version: ${AM08_VERSION_VALUE}`,
  `X-Tenant: ${AM08_TENANT_EU}`,
].join('\n');

/** Live-edited 409 body — placeholders stay so Simulate can fill them. */
export const AM08_AMBIGUITY_BODY =
  '{"error":"catalog_ambiguous","requestId":"{{requestId}}","competingRules":{{competingRuleCount}}}';

/** Distinct from earlier `GET /catalog` saves so this run is not a leftover 200. */
export const AM08_LOGIC_SAMPLE = `GET ${AM08_PATH} — equal priority`;
export const AM08_PRIORITY_SAMPLE = `GET ${AM08_PATH} — highest priority`;
export const AM08_REJECT_SAMPLE = `GET ${AM08_PATH} — two matches`;
export const AM08_SPECIFICITY_SAMPLE = `GET ${AM08_PATH} — specificity`;

const AM08_ROOT_GROUP_ID = 'grp-am08-root';
const AM08_ANY_GROUP_ID = 'grp-am08-any';
const AM08_NOT_GROUP_ID = 'grp-am08-not';

const VERSION_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am08-version',
  source: 'header',
  selector: AM08_VERSION_KEY,
  operator: 'exact',
  expected: AM08_VERSION_VALUE,
};

const TENANT_EU_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am08-tenant-eu',
  source: 'header',
  selector: AM08_TENANT_KEY,
  operator: 'exact',
  expected: AM08_TENANT_EU,
};

const TENANT_US_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am08-tenant-us',
  source: 'header',
  selector: AM08_TENANT_KEY,
  operator: 'exact',
  expected: AM08_TENANT_US,
};

const DEBUG_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am08-debug',
  source: 'header',
  selector: AM08_DEBUG_KEY,
  operator: 'present',
};

const ANY_GROUP_EMPTY: ApiMockDemoPredicateGroup = {
  id: AM08_ANY_GROUP_ID,
  combinator: 'any',
  children: [],
};

const ANY_GROUP: ApiMockDemoPredicateGroup = {
  id: AM08_ANY_GROUP_ID,
  combinator: 'any',
  children: [TENANT_EU_PREDICATE, TENANT_US_PREDICATE],
};

const NOT_GROUP: ApiMockDemoPredicateGroup = {
  id: AM08_NOT_GROUP_ID,
  combinator: 'not',
  children: [DEBUG_PREDICATE],
};

const VERSION_ONLY: ApiMockDemoPredicateGroup['children'] = [VERSION_PREDICATE];
const NESTED_ANY_EMPTY: ApiMockDemoPredicateGroup['children'] = [VERSION_PREDICATE, ANY_GROUP_EMPTY];
const WITH_TENANTS: ApiMockDemoPredicateGroup['children'] = [VERSION_PREDICATE, ANY_GROUP];
const FULL_LOGIC: ApiMockDemoPredicateGroup['children'] = [VERSION_PREDICATE, ANY_GROUP, NOT_GROUP];

// ── Rule identity ───────────────────────────────────────────────────────────

export function am08RuleRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

function rowName(row: HTMLElement): string {
  const label = row.parentElement?.querySelector('[aria-label^="Delete rule "]')
    ?.getAttribute('aria-label') ?? '';
  return label.replace(/^Delete rule /, '');
}

/** The explorer row for a named corpus rule — ids are reminted, names are not. */
export function am08RuleRow(name: string): HTMLElement | null {
  return am08RuleRows().find(row => rowName(row) === name) ?? null;
}

export function am08RuleSelector(name: string): string | null {
  const testid = am08RuleRow(name)?.getAttribute('data-testid');
  return testid ? `[data-testid="${testid}"]` : null;
}

/** The editor's hidden name field — not layout-visible, so read it directly. */
export function am08OpenRuleName(): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.ROUTE_NAME)?.value ?? '';
}

export function isAm08RuleOpen(name: string): boolean {
  return am08OpenRuleName() === name;
}

export function am08PriorityValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.PRIORITY_INPUT)?.value ?? '';
}

// ── Group / condition identity ──────────────────────────────────────────────

const CONDITION_TESTID_PREFIX = 'api-mock-condition-';
const GROUP_TESTID_PREFIX = 'api-mock-group-';

export function am08ConditionRows(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    `.am-matcher-row[data-testid^="${CONDITION_TESTID_PREFIX}"]`,
  ));
}

export function am08ConditionIds(root: ParentNode = document): string[] {
  return am08ConditionRows(root)
    .map(row => String(row.dataset.testid).slice(CONDITION_TESTID_PREFIX.length));
}

export function am08ConditionCount(): number {
  return am08ConditionIds().length;
}

export function am08ConditionKey(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionSelector(id))?.value ?? '';
}

export function am08ConditionValue(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionValue(id))?.value ?? '';
}

export function am08ConditionOperator(id: string): string {
  return document.querySelector(API_MOCK.conditionOperator(id))?.getAttribute('data-value') ?? '';
}

export function am08RootGroupId(): string | null {
  const testid = document.querySelector(API_MOCK.ADD_CONDITION)
    ?.closest('.am-matcher-group')?.getAttribute('data-testid') ?? '';
  return testid.startsWith(GROUP_TESTID_PREFIX) ? testid.slice(GROUP_TESTID_PREFIX.length) : null;
}

export function am08NestedGroupIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.NESTED_GROUPS))
    .map(el => {
      const testid = el.getAttribute('data-testid') ?? '';
      return testid.startsWith(GROUP_TESTID_PREFIX) ? testid.slice(GROUP_TESTID_PREFIX.length) : '';
    })
    .filter(Boolean);
}

export function am08GroupCombinator(groupId: string): string {
  return document.querySelector(API_MOCK.groupCombinator(groupId))?.getAttribute('data-value') ?? '';
}

/** Direct leaf ids of one group — nested groups' rows are not included. */
export function am08GroupConditionIds(groupId: string): string[] {
  const group = document.querySelector<HTMLElement>(API_MOCK.group(groupId));
  if (!group) return [];
  return Array.from(group.children)
    .filter(child => child.classList.contains('am-matcher-leaf'))
    .flatMap(leaf => am08ConditionIds(leaf));
}

// ── State probes ────────────────────────────────────────────────────────────

export function isAm08StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm08Workspace(): boolean {
  return am08RuleRows().length > 0;
}

export function hasAm08RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm08SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function isAm08SettingsOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_MODAL));
}

export function am08SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am08TraceRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
}

export function am08TraceRowByText(needle: string): HTMLElement | null {
  return am08TraceRows().find(row => (row.textContent ?? '').includes(needle)) ?? null;
}

export function am08CandidateByName(name: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_CANDIDATES))
    .find(el => (el.textContent ?? '').includes(name)) ?? null;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm08Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM08_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

export async function cleanupAm08(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Overlay hygiene ─────────────────────────────────────────────────────────

export async function closeAm08Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm08SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, opts);
}

export async function closeAm08Settings(ctx: DemoActionContext): Promise<void> {
  if (!isAm08SettingsOpen()) return;
  await ctx.click(API_MOCK.SETTINGS_CANCEL);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

export async function ensureAm08StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm08StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm08Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm08Simulate(ctx);
  await closeAm08Settings(ctx);
  await ensureAm08StudioView(ctx);
  if (hasAm08Workspace()) return;
  await importApiMockGallerySample(AM08_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

async function ensureAm08MatchTab(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.ADD_CONDITION) || firstVisibleElement(API_MOCK.ADD_GROUP)) return;
  await ctx.click(API_MOCK.BTAB_MATCH);
  await ctx.delay(AM_DEMO_TIMING.tabSwitch);
}

export async function openAm08Rule(ctx: DemoActionContext, name: string): Promise<boolean> {
  await ensureAm08Workspace(ctx);
  if (!isAm08RuleOpen(name)) {
    const selector = am08RuleSelector(name);
    if (!selector) return false;
    await ctx.click(selector);
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
    for (let i = 0; i < 12 && !isAm08RuleOpen(name); i++) {
      await ctx.delay(100);
    }
  }
  await ensureAm08MatchTab(ctx);
  return isAm08RuleOpen(name);
}

async function focusAm08Rule(ctx: DemoActionContext, name: string): Promise<boolean> {
  const selector = am08RuleSelector(name);
  if (!selector) return false;
  if (isAm08RuleOpen(name)) {
    await am08Look(ctx, selector);
  } else {
    await am08Click(ctx, selector, 0);
    await am08Reveal(ctx, API_MOCK.ROUTE_EDITOR);
    for (let i = 0; i < 12 && !isAm08RuleOpen(name); i++) {
      await ctx.delay(100);
    }
  }
  await ensureAm08MatchTab(ctx);
  return isAm08RuleOpen(name);
}

async function setAm08Regional(
  ctx: DemoActionContext,
  children: ApiMockDemoPredicateGroup['children'],
  priority: number,
): Promise<void> {
  if (!await openAm08Rule(ctx, AM08_REGIONAL_NAME)) return;
  const applied = patchApiMockActiveRoute({
    predicates: { id: AM08_ROOT_GROUP_ID, combinator: 'all', children },
    priority,
  });
  if (!applied) return;
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

function patchDefaultSelection(): void {
  patchApiMockServerSettings({
    multipleMatchPolicy: 'highest_priority',
    equalPriorityPolicy: 'reject',
  });
}

/** Guard for the opening step — Regional still has only the version condition. */
export async function ensureAm08VersionOnly(ctx: DemoActionContext): Promise<void> {
  await setAm08Regional(ctx, VERSION_ONLY, AM08_PRIORITY_DEFAULT);
  patchDefaultSelection();
}

/** Guard — nested Any-of group exists and is empty, ready for the tenant rows. */
export async function ensureAm08NestedAnyEmpty(ctx: DemoActionContext): Promise<void> {
  await setAm08Regional(ctx, NESTED_ANY_EMPTY, AM08_PRIORITY_DEFAULT);
  patchDefaultSelection();
}

/** Guard — version AND (eu OR us), no None-of yet. */
export async function ensureAm08Tenants(ctx: DemoActionContext): Promise<void> {
  await setAm08Regional(ctx, WITH_TENANTS, AM08_PRIORITY_DEFAULT);
  patchDefaultSelection();
}

/** Guard — the full boolean tree at the corpus priority. */
export async function ensureAm08FullLogic(ctx: DemoActionContext): Promise<void> {
  await setAm08Regional(ctx, FULL_LOGIC, AM08_PRIORITY_DEFAULT);
  patchDefaultSelection();
}

/** Guard — full tree, Regional raised to 20, quiet policy still highest-priority. */
export async function ensureAm08PriorityRaised(ctx: DemoActionContext): Promise<void> {
  await closeAm08Simulate(ctx);
  await closeAm08Settings(ctx);
  await setAm08Regional(ctx, FULL_LOGIC, AM08_PRIORITY_RAISED);
  patchDefaultSelection();
}

/**
 * Guard for the specificity step — equal priority again, quiet policy still
 * `highest_priority` + `reject`, so the live beat is switching the tie-break.
 */
export async function ensureAm08ForSpecificity(ctx: DemoActionContext): Promise<void> {
  await setAm08Regional(ctx, FULL_LOGIC, AM08_PRIORITY_DEFAULT);
  patchApiMockServerSettings({
    multipleMatchPolicy: 'highest_priority',
    equalPriorityPolicy: 'reject',
  });
}

// ── Authoring primitives ────────────────────────────────────────────────────

async function addNestedGroup(ctx: DemoActionContext): Promise<string | null> {
  const before = am08NestedGroupIds();
  await am08Click(ctx, API_MOCK.ADD_GROUP, T.panelReady);
  if (am08NestedGroupIds().length === before.length) await ctx.delay(T.panelReady);
  return am08NestedGroupIds().find(id => !before.includes(id)) ?? am08NestedGroupIds().at(-1) ?? null;
}

async function addOrReuseGroupCondition(
  ctx: DemoActionContext,
  groupId: string,
  key: string,
  expected?: string,
): Promise<string | null> {
  const existing = am08GroupConditionIds(groupId).find(id => {
    if (am08ConditionKey(id) !== key) return false;
    return expected == null || am08ConditionValue(id) === expected;
  });
  if (existing) {
    await am08Look(ctx, API_MOCK.conditionRow(existing));
    return existing;
  }
  const before = am08GroupConditionIds(groupId);
  await am08Click(ctx, API_MOCK.groupAddCondition(groupId), T.panelReady);
  if (am08GroupConditionIds(groupId).length === before.length) await ctx.delay(T.panelReady);
  return am08GroupConditionIds(groupId).find(id => !before.includes(id)) ?? null;
}

// ── Simulate / settings primitives ──────────────────────────────────────────

async function openAm08Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm08SimulateOpen()) return;
  await am08Aim(ctx, API_MOCK.SIMULATE);
  await am08Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

/**
 * Shape the overlapping catalog request and hold on the verdict. After path and
 * headers are filled the viewer gets a dedicated review pass before **Run simulation**.
 */
async function runAm08Simulation(
  ctx: DemoActionContext,
  opts?: { sampleName?: string; saveSample?: boolean; skipReview?: boolean },
): Promise<string> {
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  await am08Fill(ctx, API_MOCK.SIMULATE_PATH, AM08_PATH);
  await am08Fill(
    ctx,
    API_MOCK.SIMULATE_HEADERS,
    AM08_SIM_HEADERS,
    opts?.skipReview ? T.fieldFilled : T.simOutcome,
  );
  await reviewAndRunSimulation(ctx, {
    review: opts?.skipReview ? T.look : T.reviewForm,
    beforeRun: opts?.skipReview ? T.look : T.beforeRun,
    sampleName: opts?.sampleName ?? AM08_LOGIC_SAMPLE,
    digest: opts?.skipReview ? false : undefined,
    saveSample: opts?.saveSample,
  });
  await am08Reveal(ctx, API_MOCK.SIMULATE_RESULT);
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, opts?.skipReview ? T.look : T.simOutcome);
  return am08SimOutcome();
}

async function openAm08SelectionSettings(ctx: DemoActionContext): Promise<void> {
  if (!isAm08SettingsOpen()) {
    await am08Aim(ctx, API_MOCK.SETTINGS);
    await am08Reveal(ctx, API_MOCK.SETTINGS_MODAL);
  }
  await am08Aim(ctx, API_MOCK.SETTINGS_TAB_SELECTION, T.tabSwitch);
  await am08Reveal(ctx, API_MOCK.SETTINGS_PANEL_SELECTION);
}

async function saveAm08Settings(ctx: DemoActionContext): Promise<void> {
  await am08Aim(ctx, API_MOCK.SETTINGS_SAVE);
  await ctx.delay(T.panelReady);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — All of vs Any of. The UI cannot wrap existing rows, so the nested
 * group is where Any of is taught; the root stays All of (the AND).
 */
export async function runAm08AllVsAny(ctx: DemoActionContext): Promise<void> {
  if (!await focusAm08Rule(ctx, AM08_REGIONAL_NAME)) return;
  const root = am08RootGroupId();
  if (root) {
    await am08Payoff(ctx, API_MOCK.groupCombinator(root));
    await am08Look(ctx, API_MOCK.FIRST_CONDITION);
  }
  await am08Break(ctx);

  let gid: string | null = am08NestedGroupIds()[0] ?? null;
  if (!gid) gid = await addNestedGroup(ctx);
  if (!gid) return;
  await am08Reveal(ctx, API_MOCK.group(gid), T.fieldFilled);
  await am08Look(ctx, API_MOCK.groupCombinator(gid));
  await am08Select(ctx, API_MOCK.groupCombinator(gid), 'any');
  await am08Payoff(ctx, API_MOCK.groupEmpty(gid));
}

/**
 * Step 2 — `version AND (eu OR us)`: two tenant exacts inside the nested Any-of.
 */
export async function runAm08NestedGroup(ctx: DemoActionContext): Promise<void> {
  const gid = am08NestedGroupIds()[0];
  if (!gid) return;
  await am08Look(ctx, API_MOCK.group(gid));

  const eu = await addOrReuseGroupCondition(ctx, gid, AM08_TENANT_KEY, AM08_TENANT_EU);
  if (!eu) return;
  await am08Fill(ctx, API_MOCK.conditionSelector(eu), AM08_TENANT_KEY);
  await am08Fill(ctx, API_MOCK.conditionValue(eu), AM08_TENANT_EU, T.payoff);
  await am08Break(ctx);

  const us = await addOrReuseGroupCondition(ctx, gid, AM08_TENANT_KEY, AM08_TENANT_US);
  if (!us) return;
  await am08Fill(ctx, API_MOCK.conditionSelector(us), AM08_TENANT_KEY);
  await am08Fill(ctx, API_MOCK.conditionValue(us), AM08_TENANT_US, T.payoff);
  await am08Payoff(ctx, API_MOCK.group(gid));
}

/**
 * Step 3 — a sibling None-of group holding `X-Debug` present, plus the fail-closed note.
 */
export async function runAm08NotGroup(ctx: DemoActionContext): Promise<void> {
  let gid: string | null = am08NestedGroupIds()[1] ?? null;
  if (!gid) gid = await addNestedGroup(ctx);
  if (!gid) return;
  await am08Look(ctx, API_MOCK.group(gid));
  await am08Select(ctx, API_MOCK.groupCombinator(gid), 'not');
  await am08Payoff(ctx, API_MOCK.groupFailClosed(gid));
  await am08Break(ctx);

  const id = await addOrReuseGroupCondition(ctx, gid, AM08_DEBUG_KEY);
  if (!id) return;
  await am08Fill(ctx, API_MOCK.conditionSelector(id), AM08_DEBUG_KEY);
  await am08Select(ctx, API_MOCK.conditionOperator(id), 'present');
  await am08Look(ctx, API_MOCK.conditionValue(id));
  await am08Payoff(ctx, API_MOCK.group(gid));
}

/**
 * Step 4 — the same request matches Regional's logic *and* Default, so the quiet
 * equal-priority policy refuses to guess (AMBIGUOUS).
 */
export async function runAm08ProveLogic(ctx: DemoActionContext): Promise<string> {
  await openAm08Simulate(ctx);
  const outcome = await runAm08Simulation(ctx, { sampleName: AM08_LOGIC_SAMPLE });
  await am08Aim(ctx, API_MOCK.SIMULATE_TAB_TRACE, T.tabSwitch);
  await am08Trace(ctx, am08CandidateByName(AM08_REGIONAL_NAME), T.look);
  await am08Trace(ctx, am08TraceRowByText(AM08_TENANT_EU), T.payoff);
  await am08Trace(ctx, am08TraceRowByText(AM08_TENANT_US), T.look);
  await am08Break(ctx);
  await am08Trace(ctx, am08CandidateByName(AM08_DEFAULT_NAME), T.payoff);
  await closeAm08Simulate(ctx, { review: true });
  return outcome;
}

/**
 * Step 5 — raise Regional to 20, then tour the Selection settings without changing them.
 */
export async function runAm08Priority(ctx: DemoActionContext): Promise<void> {
  await am08Fill(ctx, API_MOCK.PRIORITY_INPUT, String(AM08_PRIORITY_RAISED), T.payoff);
  await am08Payoff(ctx, API_MOCK.PRIORITY_INPUT);
  await am08Break(ctx);
  await openAm08SelectionSettings(ctx);
  await am08Payoff(ctx, API_MOCK.SETTINGS_MULTIPLE_MATCH);
  await am08Payoff(ctx, API_MOCK.SETTINGS_EQUAL_POLICY);
  await saveAm08Settings(ctx);
}

/**
 * Step 6 — highest-priority picks Regional (20) and Default is a matching loser.
 */
export async function runAm08HighestPriority(ctx: DemoActionContext): Promise<string> {
  await openAm08Simulate(ctx);
  const outcome = await runAm08Simulation(ctx, { sampleName: AM08_PRIORITY_SAMPLE });
  await am08Payoff(ctx, API_MOCK.SIMULATE_WINNER);
  await am08Trace(ctx, am08CandidateByName(AM08_REGIONAL_NAME), T.look);
  await am08Trace(ctx, am08CandidateByName(AM08_DEFAULT_NAME), T.payoff);
  await closeAm08Simulate(ctx, { review: true });
  return outcome;
}

function applyAm08RejectMultiplePolicy(): void {
  patchApiMockServerSettings({
    multipleMatchPolicy: 'reject_multiple',
    ambiguityBody: AM08_AMBIGUITY_BODY,
  });
}

/**
 * Step 7 — reject-multiple fires *before* priority, so 20 does not save you. Shape
 * the 409 body, then prove it in Simulate.
 */
export async function runAm08RejectMultiple(ctx: DemoActionContext): Promise<string> {
  await closeAm08Simulate(ctx);
  await openAm08SelectionSettings(ctx);
  await am08Select(ctx, API_MOCK.SETTINGS_MULTIPLE_MATCH, 'reject_multiple');
  await spotlightBeat(ctx, API_MOCK.SETTINGS_AMBIGUITY_STATUS, AM_DEMO_TIMING.look);
  await fillBeat(ctx, API_MOCK.SETTINGS_AMBIGUITY_BODY, AM08_AMBIGUITY_BODY, {
    look: AM_DEMO_TIMING.look,
    hold: T.fieldFilled,
  });
  await saveAm08Settings(ctx);
  // Belt: UI Save can persist the previous policy if the select did not commit.
  applyAm08RejectMultiplePolicy();

  await openAm08Simulate(ctx);
  // Compact Simulate so Acting still has time to open **Rendered response**.
  let outcome = await runAm08Simulation(ctx, {
    sampleName: AM08_REJECT_SAMPLE,
    skipReview: true,
  });
  if (!/AMBIGUOUS/i.test(outcome)) {
    applyAm08RejectMultiplePolicy();
    await clickBeat(ctx, API_MOCK.SIMULATE_RUN, { look: T.look, hold: 0 });
    await am08Reveal(ctx, API_MOCK.SIMULATE_RESULT);
    outcome = am08SimOutcome();
  }
  await clickBeat(ctx, API_MOCK.SIMULATE_TAB_RENDERED, {
    look: T.look,
    hold: AM_DEMO_TIMING.tabSwitch,
  });
  await revealBeat(ctx, API_MOCK.SIMULATE_RENDERED_BODY, {
    timeout: 4_000,
    hold: AM_DEMO_TIMING.panelReady,
  });
  await spotlightBeat(ctx, API_MOCK.SIMULATE_RENDERED_BODY, T.payoff);
  await closeAm08Simulate(ctx);
  return outcome;
}

/**
 * Step 8 — equal priority again; specificity scores the matchers and Regional wins.
 */
export async function runAm08Specificity(ctx: DemoActionContext): Promise<string> {
  await openAm08SelectionSettings(ctx);
  await am08Select(ctx, API_MOCK.SETTINGS_EQUAL_POLICY, 'specificity_then_id');
  await am08Payoff(ctx, API_MOCK.SETTINGS_EQUAL_POLICY);
  await saveAm08Settings(ctx);

  await openAm08Simulate(ctx);
  const outcome = await runAm08Simulation(ctx, {
    sampleName: AM08_SPECIFICITY_SAMPLE,
    skipReview: true,
  });
  await am08Look(ctx, API_MOCK.SIMULATE_WINNER);
  await am08Payoff(ctx, API_MOCK.SIMULATE_SPECIFICITY);
  await am08Payoff(ctx, API_MOCK.SIMULATE_TIMELINE_POLICY);
  await closeAm08Simulate(ctx);
  return outcome;
}
