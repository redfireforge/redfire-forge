/**
 * AM-05 `am-05-request-predicates` helpers — Query, Header, Cookie & Security.
 *
 * The corpus ships one rule with an **empty** Match group; every condition in the
 * lesson is authored live. Condition ids are minted by the editor (`crypto.randomUUID`),
 * so nothing here may hard-code one — rows are resolved from the DOM after they appear,
 * while `ensure*` guards rebuild the whole group through the quiet patch bridge so a
 * replayed step starts from a known tree instead of stacking duplicate rows.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
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
 * AM-05 holds longer than the shared pack. Condition rows, operator changes, and
 * especially Simulate's decision-trace (one ring per leaf) are too dense at the
 * pack defaults — viewers cannot follow which predicate just ticked.
 */
export const AM05_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  /** One decision-trace leaf — the beat Simulate viewers said they could not follow. */
  traceRow: 1400,
  /** MATCHED / UNMATCHED after a Simulate run. */
  simOutcome: 1800,
  /** Filled Simulate path / headers, held so the viewer can read them before Run. */
  reviewForm: 1600,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2400,
} as const;

const T = AM05_TIMING;

async function am05Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am05Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am05Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.look, hold });
}

async function am05Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am05Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am05Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am05Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

async function am05Trace(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  hold: number = T.traceRow,
): Promise<void> {
  await spotlightElementBeat(ctx, el, hold);
}

/** Background corpus: one rule that answers every caller the same way. */
export const AM05_CORPUS_SAMPLE = 'am-gallery-predicates';

/** The rule everything in this lesson is authored onto. */
export const AM05_RULE_PATH = '/reports';

/** Step 1 — the page the paged report list belongs to. */
export const AM05_QUERY_KEY = 'page';
export const AM05_QUERY_VALUE = '2';

/** Step 3 — a tenant header, first as a prefix, then pinned exactly. */
export const AM05_HEADER_KEY = 'x-tenant';
export const AM05_HEADER_PREFIX = 'acme-';
export const AM05_HEADER_VALUE = 'acme-eu';

/** Step 4 — the Security source reads the Authorization scheme for you. */
export const AM05_SECURITY_FACET = 'scheme';
export const AM05_SECURITY_CERT_FACET = 'certSubject';
export const AM05_SECURITY_VALUE = 'Bearer';

/** Step 5 — the header a guard group must reject. */
export const AM05_GUARD_KEY = 'x-debug';

/** Step 6 — a session cookie whose shape is a rule, matched case-insensitively. */
export const AM05_COOKIE_KEY = 'sid';
export const AM05_COOKIE_REGEX = '^S-[0-9]{4}$';
/** Sample rows rewritten in the toolbox: the second one only passes with Ignore case. */
export const AM05_COOKIE_SAMPLES = [
  { value: 'S-2048', shouldMatch: true },
  { value: 's-2048', shouldMatch: true },
  { value: 'admin', shouldMatch: false },
  { value: 'S-20', shouldMatch: false },
] as const;

/** Step 7 — two constraints composed in the Query & headers tab and applied at once. */
export const AM05_VERSION_KEY = 'x-api-version';
export const AM05_VERSION_VALUE = '2024-11';
export const AM05_FORMAT_KEY = 'format';
export const AM05_FORMAT_VALUE = 'json';

/** Simulate probes. Query lives in the path field; cookies ride the Cookie header. */
export const AM05_SIM_QUERY_MATCH = `${AM05_RULE_PATH}?${AM05_QUERY_KEY}=${AM05_QUERY_VALUE}`;
export const AM05_SIM_QUERY_MISS = `${AM05_RULE_PATH}?${AM05_QUERY_KEY}=3`;
export const AM05_SIM_FULL_PATH =
  `${AM05_RULE_PATH}?${AM05_QUERY_KEY}=${AM05_QUERY_VALUE}&${AM05_FORMAT_KEY}=${AM05_FORMAT_VALUE}`;

/** Saved-sample names — query and full-path probes share `/reports`, so purpose is required. */
export const AM05_SAMPLE_QUERY_MATCH = `GET ${AM05_SIM_QUERY_MATCH} — page 2`;
export const AM05_SAMPLE_QUERY_MISS = `GET ${AM05_SIM_QUERY_MISS} — page 3`;
export const AM05_SAMPLE_ALL_MATCH = `GET ${AM05_SIM_FULL_PATH} — no debug`;
export const AM05_SAMPLE_DEBUG = `GET ${AM05_SIM_FULL_PATH} — debug`;
/** Upper-case header name on purpose: names are normalized, values are not. */
export const AM05_SIM_HEADERS = [
  `AUTHORIZATION: ${AM05_SECURITY_VALUE} eyJhbGciOiJIUzI1NiJ9`,
  `X-Tenant: ${AM05_HEADER_VALUE}`,
  `X-Api-Version: ${AM05_VERSION_VALUE}`,
  `Cookie: ${AM05_COOKIE_KEY}=s-2048`,
].join('\n');
/** The same request plus the header the guard group exists to reject. */
export const AM05_SIM_DEBUG_HEADERS = `${AM05_SIM_HEADERS}\nX-Debug: 1`;

/** Root group id the quiet rebuild mints, so guards do not depend on import remapping. */
const AM05_ROOT_GROUP_ID = 'grp-am05-root';
const AM05_GUARD_GROUP_ID = 'grp-am05-guard';

// ── Quiet condition trees ───────────────────────────────────────────────────

const QUERY_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-query',
  source: 'query',
  selector: AM05_QUERY_KEY,
  operator: 'exact',
  expected: AM05_QUERY_VALUE,
};

const HEADER_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-tenant',
  source: 'header',
  selector: AM05_HEADER_KEY,
  operator: 'exact',
  expected: AM05_HEADER_VALUE,
};

const SECURITY_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-scheme',
  source: 'security',
  selector: AM05_SECURITY_FACET,
  operator: 'exact',
  expected: AM05_SECURITY_VALUE,
};

const GUARD_GROUP: ApiMockDemoPredicateGroup = {
  id: AM05_GUARD_GROUP_ID,
  combinator: 'not',
  children: [{
    id: 'pred-am05-debug',
    source: 'header',
    selector: AM05_GUARD_KEY,
    operator: 'present',
  }],
};

const COOKIE_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-cookie',
  source: 'cookie',
  selector: AM05_COOKIE_KEY,
  operator: 'regex',
  expected: AM05_COOKIE_REGEX,
  options: { caseSensitive: false },
};

const VERSION_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-version',
  source: 'header',
  selector: AM05_VERSION_KEY,
  operator: 'exact',
  expected: AM05_VERSION_VALUE,
};

const FORMAT_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am05-format',
  source: 'query',
  selector: AM05_FORMAT_KEY,
  operator: 'exact',
  expected: AM05_FORMAT_VALUE,
};

// ── Row identity ────────────────────────────────────────────────────────────

const CONDITION_TESTID_PREFIX = 'api-mock-condition-';

/** Every Match condition row on screen, in render order (nested groups included). */
export function am05ConditionRows(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    `.am-matcher-row[data-testid^="${CONDITION_TESTID_PREFIX}"]`,
  ));
}

export function am05ConditionIds(root: ParentNode = document): string[] {
  return am05ConditionRows(root)
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(CONDITION_TESTID_PREFIX))
    .map(id => id.slice(CONDITION_TESTID_PREFIX.length));
}

export function am05ConditionCount(): number {
  return am05ConditionIds().length;
}

/** The row `+ Condition` just appended — a new leaf is always the last child. */
export function am05LastConditionId(): string | null {
  return am05ConditionIds().at(-1) ?? null;
}

/** Source of a row, read off the picker wrapper (`query`, `header`, `cookie`, …). */
export function am05ConditionSource(id: string): string {
  return document.querySelector(API_MOCK.conditionSource(id))?.getAttribute('data-value') ?? '';
}

/** Key a row reads: an input value, or the facet dropdown value when source is Security. */
export function am05ConditionKey(id: string): string {
  const el = document.querySelector<HTMLElement>(API_MOCK.conditionSelector(id));
  if (!el) return '';
  if (el instanceof HTMLInputElement) return el.value;
  return el.getAttribute('data-value') ?? '';
}

export function am05ConditionOperator(id: string): string {
  return document.querySelector(API_MOCK.conditionOperator(id))?.getAttribute('data-value') ?? '';
}

export function am05ConditionValue(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionValue(id))?.value ?? '';
}

/** Find an existing row by what it reads, so a replayed step reuses it. */
export function am05FindCondition(source: string, key: string): string | null {
  return am05ConditionIds().find(
    id => am05ConditionSource(id) === source && am05ConditionKey(id) === key,
  ) ?? null;
}

// ── Group identity ──────────────────────────────────────────────────────────

const GROUP_TESTID_PREFIX = 'api-mock-group-';

function groupIdOf(el: Element | null | undefined): string | null {
  const testid = el?.getAttribute('data-testid') ?? '';
  return testid.startsWith(GROUP_TESTID_PREFIX) ? testid.slice(GROUP_TESTID_PREFIX.length) : null;
}

/** Root group — the only one carrying the un-suffixed `+ Condition` button. */
export function am05RootGroupId(): string | null {
  const addBtn = document.querySelector(API_MOCK.ADD_CONDITION);
  return groupIdOf(addBtn?.closest('.am-matcher-group'));
}

/** The nested guard group, once `[ ] Group` has created it. */
export function am05GuardGroupId(): string | null {
  return groupIdOf(document.querySelector(API_MOCK.NESTED_GROUPS));
}

/** Condition rows inside one group block — the guard row is not a root child. */
export function am05GroupConditionIds(groupId: string): string[] {
  const group = document.querySelector<HTMLElement>(API_MOCK.group(groupId));
  return group ? am05ConditionIds(group) : [];
}

// ── State probes ────────────────────────────────────────────────────────────

/** True when the Studio (authoring) view is mounted — Runtime / Conflicts unmount it. */
export function isAm05StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm05Workspace(): boolean {
  return document.querySelectorAll(API_MOCK.ROUTE_ROW).length > 0;
}

export function hasAm05RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm05ToolboxOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.PATTERN_TOOLBOX));
}

export function isAm05SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

/** MATCHED / UNMATCHED / AMBIGUOUS / FAULT, or '' before the first run. */
export function am05SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function isAm05HeadersExpandOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.HEADERS_EXPAND_MODAL));
}

/** Table row whose Name cell equals `name` (case-insensitive). */
export function am05HeadersTableRowByName(name: string): HTMLElement | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid^="api-mock-headers-expand-name-"]');
  for (const input of inputs) {
    if (input.value.trim().toLowerCase() === needle) {
      return input.closest<HTMLElement>('.am-headers-expand-row') ?? input;
    }
  }
  return null;
}

/** Decision-trace predicate rows: Method, Path, then one per condition / group. */
export function am05TraceRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
}

/**
 * The trace row that mentions `needle`. None-of misses name the key they read
 * (`"x-debug" was absent — as required`); a failed None-of group says why it rejected.
 */
export function am05TraceRowByText(needle: string): HTMLElement | null {
  return am05TraceRows().find(row => (row.textContent ?? '').includes(needle)) ?? null;
}

/** Ids of the toolbox's live sample rows, in render order (`s1`…`s4` by default). */
export function am05SampleRowIds(): string[] {
  const prefix = 'api-mock-toolbox-sample-row-';
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.TOOLBOX_SAMPLE_ROWS))
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(prefix))
    .map(id => id.slice(prefix.length));
}

/** Pending constraint rows in the Query & headers tab (the tab opens with one). */
export function am05ConstraintIds(): string[] {
  const prefix = 'api-mock-toolbox-constraint-';
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.TOOLBOX_CONSTRAINT_ROWS))
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(prefix))
    .map(id => id.slice(prefix.length));
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: the unconditioned corpus and a collapsed app sidebar. */
export async function prepareAm05Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM05_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — the lesson never binds a listener. */
export async function cleanupAm05(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Overlay hygiene ─────────────────────────────────────────────────────────

/** Dismiss the toolbox when a previous step (or an early Next) left it open. */
export async function closeAm05Toolbox(ctx: DemoActionContext): Promise<void> {
  if (!isAm05ToolboxOpen()) return;
  await ctx.click(API_MOCK.TOOLBOX_CANCEL);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

/** Dismiss the Headers expand popup left open by an early Next. */
export async function closeAm05HeadersExpand(
  ctx: DemoActionContext,
  visible = false,
): Promise<void> {
  if (!isAm05HeadersExpandOpen()) return;
  if (visible) {
    await am05Click(ctx, API_MOCK.HEADERS_EXPAND_CLOSE, T.fieldFilled);
    return;
  }
  firstVisibleElement<HTMLButtonElement>(API_MOCK.HEADERS_EXPAND_CLOSE)?.click();
}

/** Dismiss the Simulate workspace so the next step's spotlight lands on the Studio. */
export async function closeAm05Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  await closeAm05HeadersExpand(ctx);
  if (!isAm05SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, opts);
}

// ── Guards ──────────────────────────────────────────────────────────────────

/** Authoring guards must not fire on Runtime / Conflicts — both unmount the explorer. */
export async function ensureAm05StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm05StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

/** Guard — the corpus is the active workspace, with no overlay in the way. */
export async function ensureAm05Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm05Toolbox(ctx);
  await closeAm05Simulate(ctx);
  await ensureAm05StudioView(ctx);
  if (hasAm05Workspace()) return;
  await importApiMockGallerySample(AM05_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

/** Guard — the report rule is open in the editor, on the Match tab. */
export async function ensureAm05RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm05Workspace(ctx);
  if (!hasAm05RouteEditor()) {
    await ctx.click(API_MOCK.ROUTE_ROW);
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
  }
  if (!firstVisibleElement(API_MOCK.ADD_CONDITION)) {
    await ctx.click(API_MOCK.BTAB_MATCH);
    await ctx.delay(AM_DEMO_TIMING.tabSwitch);
  }
}

/**
 * Put the whole Match group back the way a step starts from. Rebuilding beats
 * patching row by row: the viewer authors rows with generated ids, so replaying a
 * step can only be made idempotent by replacing the tree outright.
 */
async function setAm05Conditions(
  ctx: DemoActionContext,
  children: ApiMockDemoPredicateGroup['children'],
): Promise<void> {
  await ensureAm05RuleOpen(ctx);
  const applied = patchApiMockActiveRoute({
    predicates: { id: AM05_ROOT_GROUP_ID, combinator: 'all', children },
  });
  if (!applied) return;
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/** Guard for the opening step — no conditions at all. */
export async function ensureAm05Unconditioned(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, []);
}

/** Guard — the query condition exists before it is proven or built on. */
export async function ensureAm05QueryCondition(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, [QUERY_PREDICATE]);
}

/** Guard — query + tenant header. */
export async function ensureAm05HeaderCondition(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, [QUERY_PREDICATE, HEADER_PREDICATE]);
}

/** Guard — query + header + the Security scheme check. */
export async function ensureAm05SecurityCondition(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, [QUERY_PREDICATE, HEADER_PREDICATE, SECURITY_PREDICATE]);
}

/** Guard — everything above plus the None-of guard group. */
export async function ensureAm05GuardGroup(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, [QUERY_PREDICATE, HEADER_PREDICATE, SECURITY_PREDICATE, GUARD_GROUP]);
}

/** Guard — everything above plus the cookie regex. */
export async function ensureAm05CookieCondition(ctx: DemoActionContext): Promise<void> {
  await setAm05Conditions(ctx, [
    QUERY_PREDICATE, HEADER_PREDICATE, SECURITY_PREDICATE, GUARD_GROUP, COOKIE_PREDICATE,
  ]);
}

/** Guard for the closing proof — the full request shape, constraints included. */
export async function ensureAm05FullShape(ctx: DemoActionContext): Promise<void> {
  await closeAm05HeadersExpand(ctx);
  await setAm05Conditions(ctx, [
    QUERY_PREDICATE, HEADER_PREDICATE, SECURITY_PREDICATE, GUARD_GROUP, COOKIE_PREDICATE,
    VERSION_PREDICATE, FORMAT_PREDICATE,
  ]);
}

// ── Authoring primitives ────────────────────────────────────────────────────

/**
 * Add a condition row, or reuse the one already reading `key`. Replaying a step must
 * not leave a second row behind, and a fresh row always lands last.
 */
async function addOrReuseCondition(
  ctx: DemoActionContext,
  source: string,
  key: string,
): Promise<string | null> {
  const existing = am05FindCondition(source, key);
  if (existing) {
    await am05Look(ctx, API_MOCK.conditionRow(existing));
    return existing;
  }
  const before = am05ConditionIds();
  await am05Click(ctx, API_MOCK.ADD_CONDITION, T.panelReady);
  // The row is a React render away; give it one more beat before reading its id.
  if (am05ConditionCount() === before.length) await ctx.delay(T.panelReady);
  // Only a genuinely new id may be edited — otherwise the step would overwrite a row
  // the viewer authored earlier.
  return am05ConditionIds().find(id => !before.includes(id)) ?? null;
}

/** Hold on the group's leaf tally — the payoff for any step that adds conditions. */
async function spotlightAm05Count(ctx: DemoActionContext): Promise<void> {
  const root = am05RootGroupId();
  await spotlightBeat(
    ctx,
    root ? API_MOCK.groupCount(root) : API_MOCK.FIRST_CONDITION,
    T.payoff,
  );
}

// ── Simulate primitives ─────────────────────────────────────────────────────

/** Open Simulate from the editor header. */
async function openAm05Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm05SimulateOpen()) return;
  await am05Click(ctx, API_MOCK.SIMULATE, 0);
  await am05Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

/**
 * Open the Headers popup on **Table**, search for the guard key, and hold on
 * whether that row is present — then close so **Save as sample** / **Run** are free.
 * Holds stay short so the step still has budget for Save and Run after both probes.
 */
export async function reviewAm05HeadersTable(
  ctx: DemoActionContext,
  opts?: { expectGuard?: boolean },
): Promise<void> {
  const expand = firstVisibleElement(API_MOCK.SIMULATE_HEADERS_EXPAND);
  if (!expand && !isAm05HeadersExpandOpen()) return;
  if (expand) {
    await clickBeat(ctx, API_MOCK.SIMULATE_HEADERS_EXPAND, { look: 400, hold: 500 });
  }
  await revealBeat(ctx, API_MOCK.HEADERS_EXPAND_MODAL, { timeout: 4_000, hold: 400 });

  const tableBtn = firstVisibleElement(API_MOCK.HEADERS_EXPAND_VIEW_TABLE);
  if (tableBtn && tableBtn.getAttribute('aria-pressed') !== 'true') {
    await clickBeat(ctx, API_MOCK.HEADERS_EXPAND_VIEW_TABLE, { look: 300, hold: 400 });
  }
  await revealBeat(ctx, API_MOCK.HEADERS_EXPAND_TABLE, { timeout: 4_000, hold: 0 });

  if (firstVisibleElement(API_MOCK.HEADERS_EXPAND_SEARCH)) {
    await fillBeat(ctx, API_MOCK.HEADERS_EXPAND_SEARCH, AM05_GUARD_KEY, { look: 350, hold: 550 });
  }
  const row = am05HeadersTableRowByName(AM05_GUARD_KEY);
  if (opts?.expectGuard && row) {
    await spotlightElementBeat(ctx, row, 900);
  } else {
    await spotlightBeat(
      ctx,
      firstVisibleElement(API_MOCK.HEADERS_EXPAND_COUNT)
        ? API_MOCK.HEADERS_EXPAND_COUNT
        : API_MOCK.HEADERS_EXPAND_TABLE,
      900,
    );
  }
  if (firstVisibleElement(API_MOCK.HEADERS_EXPAND_CLOSE)) {
    await clickBeat(ctx, API_MOCK.HEADERS_EXPAND_CLOSE, { look: 300, hold: 400 });
  } else {
    await closeAm05HeadersExpand(ctx);
  }
}

/**
 * Shape one ad-hoc request, **Save as sample**, hold the saved configuration, then
 * **Run simulation**. A run swaps the form for the results pane, so later runs go
 * back through **Request** first.
 */
async function runAm05Simulation(
  ctx: DemoActionContext,
  path: string,
  headers?: string,
  opts?: {
    sampleName?: string;
    compact?: boolean;
    reviewHeadersTable?: boolean;
    expectGuard?: boolean;
  },
): Promise<string> {
  const compact = Boolean(opts?.compact);
  await closeAm05HeadersExpand(ctx);
  await ensureAdHocSimulateForm(ctx, compact ? T.fieldFilled : T.tabSwitch);
  await am05Fill(ctx, API_MOCK.SIMULATE_PATH, path);
  if (headers != null) {
    await am05Fill(ctx, API_MOCK.SIMULATE_HEADERS, headers, compact ? 400 : T.simOutcome);
  }
  if (opts?.reviewHeadersTable) {
    await reviewAm05HeadersTable(ctx, { expectGuard: opts.expectGuard });
    await closeAm05HeadersExpand(ctx);
    await ensureAdHocSimulateForm(ctx, 400);
  }
  await reviewAndRunSimulation(ctx, {
    review: compact ? T.look : T.reviewForm,
    beforeRun: opts?.reviewHeadersTable ? 1_000 : compact ? T.look : T.beforeRun,
    sampleName: opts?.sampleName ?? `GET ${path}`,
    saveSample: true,
    reviewFields: opts?.reviewHeadersTable ? false : undefined,
    reviewHeaders: opts?.reviewHeadersTable ? false : undefined,
    digest: false,
  });
  await revealBeat(ctx, API_MOCK.SIMULATE_RESULT, {
    timeout: 4_000,
    hold: compact ? T.fieldFilled : T.panelReady,
  });
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, compact ? T.payoff : T.simOutcome);
  return am05SimOutcome();
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — read the "matches everything" state, then add the first condition and
 * point it at a query parameter.
 */
export async function runAm05FirstCondition(ctx: DemoActionContext): Promise<void> {
  await am05Payoff(ctx, API_MOCK.CONDITIONS_EMPTY);
  await am05Break(ctx);

  const id = await addOrReuseCondition(ctx, 'query', AM05_QUERY_KEY);
  if (!id) return;
  await am05Payoff(ctx, API_MOCK.conditionRow(id));
  await am05Select(ctx, API_MOCK.conditionSource(id), 'query');
  await am05Break(ctx);

  await am05Fill(ctx, API_MOCK.conditionSelector(id), AM05_QUERY_KEY);
  await am05Fill(ctx, API_MOCK.conditionValue(id), AM05_QUERY_VALUE, T.payoff);
  await spotlightAm05Count(ctx);
}

/**
 * Step 2 — prove the condition both ways: the page it was written for matches, the
 * next page does not, and the trace names the predicate that rejected it.
 */
export async function runAm05ProveQuery(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  await openAm05Simulate(ctx);

  outcomes.push(await runAm05Simulation(ctx, AM05_SIM_QUERY_MATCH, undefined, {
    sampleName: AM05_SAMPLE_QUERY_MATCH,
  }));
  await am05Trace(ctx, am05TraceRowByText('query'), T.simOutcome);
  await am05Break(ctx);

  outcomes.push(await runAm05Simulation(ctx, AM05_SIM_QUERY_MISS, undefined, {
    sampleName: AM05_SAMPLE_QUERY_MISS,
  }));
  await am05Look(ctx, API_MOCK.SIMULATE_CANDIDATES);
  await am05Trace(ctx, am05TraceRowByText(AM05_QUERY_KEY), T.simOutcome);
  await closeAm05Simulate(ctx, { review: true });
  await spotlightAm05Count(ctx);
  return outcomes;
}

/**
 * Step 3 — a header condition, and the operator vocabulary: prefix anchors at the
 * start, then the same row is pinned to one exact tenant.
 */
export async function runAm05HeaderOperators(ctx: DemoActionContext): Promise<void> {
  const id = await addOrReuseCondition(ctx, 'header', AM05_HEADER_KEY);
  if (!id) return;
  await am05Look(ctx, API_MOCK.conditionSource(id));
  await am05Fill(ctx, API_MOCK.conditionSelector(id), AM05_HEADER_KEY);
  await am05Break(ctx);

  await am05Select(ctx, API_MOCK.conditionOperator(id), 'prefix');
  await am05Fill(ctx, API_MOCK.conditionValue(id), AM05_HEADER_PREFIX, T.payoff);
  await am05Break(ctx);

  await am05Select(ctx, API_MOCK.conditionOperator(id), 'exact');
  await am05Fill(ctx, API_MOCK.conditionValue(id), AM05_HEADER_VALUE, T.payoff);
  await am05Payoff(ctx, API_MOCK.conditionRow(id));
}

/**
 * Step 4 — the Security source: one condition that reads the Authorization scheme
 * (or a token claim, or the client certificate) without parsing a header yourself.
 */
export async function runAm05SecuritySource(ctx: DemoActionContext): Promise<void> {
  const id = await addOrReuseCondition(ctx, 'security', AM05_SECURITY_FACET);
  if (!id) return;
  await am05Select(ctx, API_MOCK.conditionSource(id), 'security');
  await am05Reveal(ctx, API_MOCK.conditionSelector(id), T.fieldFilled);
  await am05Break(ctx);

  await am05Select(ctx, API_MOCK.conditionSelector(id), AM05_SECURITY_CERT_FACET);
  await am05Look(ctx, API_MOCK.conditionValue(id));
  await am05Select(ctx, API_MOCK.conditionSelector(id), AM05_SECURITY_FACET);
  await am05Break(ctx);

  await am05Fill(ctx, API_MOCK.conditionValue(id), AM05_SECURITY_VALUE, T.payoff);
  await am05Payoff(ctx, API_MOCK.conditionRow(id));
}

/**
 * Step 5 — a nested **None of** group: the product's way to say "reject when this is
 * true", with a presence check that needs no value at all.
 */
export async function runAm05GuardGroup(ctx: DemoActionContext): Promise<void> {
  let gid = am05GuardGroupId();
  if (!gid) {
    await am05Click(ctx, API_MOCK.ADD_GROUP, T.panelReady);
    await am05Reveal(ctx, API_MOCK.NESTED_GROUPS, T.fieldFilled);
    gid = am05GuardGroupId();
  }
  if (!gid) return;
  await am05Payoff(ctx, API_MOCK.groupEmpty(gid));
  await am05Select(ctx, API_MOCK.groupCombinator(gid), 'not');
  await am05Break(ctx);

  let id = am05GroupConditionIds(gid).at(-1) ?? null;
  if (!id) {
    await am05Click(ctx, API_MOCK.groupAddCondition(gid), T.panelReady);
    if (am05GroupConditionIds(gid).length === 0) await ctx.delay(T.panelReady);
    id = am05GroupConditionIds(gid).at(-1) ?? null;
  }
  if (!id) return;
  await am05Fill(ctx, API_MOCK.conditionSelector(id), AM05_GUARD_KEY);
  await am05Select(ctx, API_MOCK.conditionOperator(id), 'present');
  await am05Payoff(ctx, API_MOCK.conditionValue(id));
  await am05Payoff(ctx, API_MOCK.group(gid));
}

/**
 * Step 6 — a cookie condition whose value is a *shape*, tested in the toolbox before
 * it is applied, with Ignore case turning one failing sample green.
 */
export async function runAm05CookieRegex(ctx: DemoActionContext): Promise<void> {
  const id = await addOrReuseCondition(ctx, 'cookie', AM05_COOKIE_KEY);
  if (!id) return;
  await am05Select(ctx, API_MOCK.conditionSource(id), 'cookie');
  await am05Fill(ctx, API_MOCK.conditionSelector(id), AM05_COOKIE_KEY);
  await am05Select(ctx, API_MOCK.conditionOperator(id), 'regex');
  await am05Reveal(ctx, API_MOCK.conditionToolbox(id), T.fieldFilled);
  await am05Break(ctx);

  await am05Click(ctx, API_MOCK.conditionToolbox(id), 0);
  await am05Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  await am05Fill(ctx, API_MOCK.TOOLBOX_REGEX, AM05_COOKIE_REGEX);
  await am05Look(ctx, API_MOCK.TOOLBOX_SAFETY);

  const sampleIds = am05SampleRowIds();
  for (const [index, sample] of AM05_COOKIE_SAMPLES.entries()) {
    const sampleId = sampleIds[index];
    if (!sampleId) continue;
    const input = firstVisibleElement<HTMLInputElement>(API_MOCK.toolboxSampleValue(sampleId));
    if (input && input.value !== sample.value) {
      await am05Fill(ctx, API_MOCK.toolboxSampleValue(sampleId), sample.value);
    }
    const expectBtn = firstVisibleElement(API_MOCK.toolboxSampleExpect(sampleId));
    const expectsMatch = (expectBtn?.textContent ?? '').includes('Expect match');
    if (expectBtn && expectsMatch !== sample.shouldMatch) {
      await am05Click(ctx, API_MOCK.toolboxSampleExpect(sampleId), 0);
    }
  }
  const caseSampleId = sampleIds[1];
  if (caseSampleId) {
    await am05Payoff(ctx, API_MOCK.toolboxSampleRow(caseSampleId));
  }
  await am05Look(ctx, API_MOCK.TOOLBOX_FLAG_CS);
  await am05Click(ctx, API_MOCK.TOOLBOX_FLAG_CI);
  if (caseSampleId) {
    await am05Payoff(ctx, API_MOCK.toolboxSampleRow(caseSampleId));
  }
  await am05Click(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await am05Payoff(ctx, API_MOCK.conditionValue(id));
}

/**
 * Step 7 — the Query & headers tab composes a whole request shape and applies it as
 * conditions in one go, instead of adding rows one at a time.
 */
export async function runAm05ConstraintsBulk(ctx: DemoActionContext): Promise<void> {
  await am05Click(ctx, API_MOCK.PATH_TOOLBOX, 0);
  await am05Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  await am05Click(ctx, API_MOCK.TOOLBOX_TAB_CONSTRAINTS, T.tabSwitch);

  const firstId = am05ConstraintIds()[0];
  if (firstId) {
    await am05Look(ctx, API_MOCK.toolboxConstraintSource(firstId));
    await am05Fill(ctx, API_MOCK.toolboxConstraintName(firstId), AM05_VERSION_KEY);
    await am05Fill(ctx, API_MOCK.toolboxConstraintValue(firstId), AM05_VERSION_VALUE, T.payoff);
  }
  await am05Break(ctx);

  await am05Click(ctx, API_MOCK.TOOLBOX_ADD_CONSTRAINT, T.panelReady);
  const secondId = am05ConstraintIds()[1];
  if (secondId) {
    await am05Select(ctx, API_MOCK.toolboxConstraintSource(secondId), 'query');
    await am05Fill(ctx, API_MOCK.toolboxConstraintName(secondId), AM05_FORMAT_KEY);
    await am05Fill(ctx, API_MOCK.toolboxConstraintValue(secondId), AM05_FORMAT_VALUE, T.payoff);
  }
  await am05Break(ctx);

  await am05Click(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await spotlightAm05Count(ctx);
  // `LAST_CONDITION` matches per group, so the appended row is read off the row list.
  await am05Trace(ctx, am05ConditionRows().at(-1), T.payoff);
}

/**
 * Step 8 — one fully shaped request ticks every predicate, then the same request plus
 * the debug header is rejected by the guard group.
 */
export async function runAm05ProveAll(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  await openAm05Simulate(ctx);

  // Two table tours plus Save → Run must finish inside the 45s Acting cap.
  // Skip the first-run Decision-trace walk; the finale is Save as sample → Run.
  outcomes.push(await runAm05Simulation(ctx, AM05_SIM_FULL_PATH, AM05_SIM_HEADERS, {
    sampleName: AM05_SAMPLE_ALL_MATCH,
    compact: true,
    reviewHeadersTable: true,
    expectGuard: false,
  }));
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, 800);

  outcomes.push(await runAm05Simulation(ctx, AM05_SIM_FULL_PATH, AM05_SIM_DEBUG_HEADERS, {
    sampleName: AM05_SAMPLE_DEBUG,
    compact: true,
    reviewHeadersTable: true,
    expectGuard: true,
  }));
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.payoff);
  await closeAm05Simulate(ctx);
  await am05Payoff(ctx, API_MOCK.ROUTE_EXPLORER);
  return outcomes;
}
