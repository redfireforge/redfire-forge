/**
 * AM-06 `am-06-body-matching` helpers — subset, strict, JSONPath & JSON Schema.
 *
 * The corpus ships **one** body condition (`json_subset`) as the baseline the lesson
 * reads and then tightens; every other matcher is authored live. Condition ids are
 * minted by the editor (`crypto.randomUUID`), so rows are resolved from the DOM by the
 * operator they carry, while `ensure*` guards replace the whole Match tree through the
 * quiet patch bridge so a replayed step starts from a known state instead of stacking
 * duplicate rows.
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
 * AM-06 holds longer than the shared pack. Body matchers, toolbox JSON, and Simulate
 * traces are dense — and a tab/modal click is easy to miss unless the ring sits on
 * the control *before* it opens.
 */
export const AM06_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  /** One decision-trace leaf. */
  traceRow: 1400,
  /** MATCHED / UNMATCHED after a Simulate run. */
  simOutcome: 1800,
  /** Spotlight on a tab or modal trigger before the click, so the viewer can aim. */
  beforeOpen: 1400,
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2400,
} as const;

const T = AM06_TIMING;

/** Long ring on a tab or modal trigger, then click — viewer sees where we are going. */
async function am06Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am06Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am06Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.look, hold });
}

async function am06Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am06Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am06Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am06Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

async function am06Trace(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  hold: number = T.traceRow,
): Promise<void> {
  await spotlightElementBeat(ctx, el, hold);
}

/** Background corpus: one rule whose only condition reads the request body. */
export const AM06_CORPUS_SAMPLE = 'am-gallery-bodies';

/** The rule everything in this lesson is authored onto. */
export const AM06_RULE_PATH = '/orders';
export const AM06_RULE_METHOD = 'POST';

/** Step 1 — compact one-liner so the Match row shows the whole fragment. */
export const AM06_SUBSET_EXPECTED = '{"customer":{"tier":"gold"}}';

/** Saved-sample names — never just `POST /orders`, or the sidebar lists twins. */
export const AM06_SAMPLE_EXTRAS = `POST ${AM06_RULE_PATH} — extra fields`;
export const AM06_SAMPLE_STRICT = `POST ${AM06_RULE_PATH} — extras vs strict`;
export const AM06_SAMPLE_INVALID = `POST ${AM06_RULE_PATH} — missing id`;
export const AM06_SAMPLE_COMPLETE = `POST ${AM06_RULE_PATH} — complete order`;

/**
 * The payload a real client sends: the gold tier the baseline asks for, plus an id,
 * two line items, and a field no matcher mentions. Doubles as the toolbox sample, so
 * the viewer builds a matcher against the body they will actually send.
 */
export const AM06_RICH_BODY = [
  '{',
  '  "customer": { "id": "C-4421", "tier": "gold" },',
  '  "items": [',
  '    { "sku": "RF-100", "qty": 2 },',
  '    { "sku": "RF-250", "qty": 1 }',
  '  ],',
  '  "note": "gift wrap"',
  '}',
].join('\n');

/**
 * Same order, one field short: `customer.id` is missing. Subset and the JSONPath row
 * still pass, so the only condition that can reject it is the schema contract.
 */
export const AM06_INVALID_BODY = [
  '{',
  '  "customer": { "tier": "gold" },',
  '  "items": [',
  '    { "sku": "RF-100", "qty": 2 }',
  '  ]',
  '}',
].join('\n');

/** Step 3 — the token clicked in the sample body, and what the toolbox derives from it. */
export const AM06_PICK_TOKEN = '"RF-100"';
export const AM06_JSONPATH = '$.items[0].sku';
export const AM06_SKU = 'RF-100';

/** Step 4 — a substring reading accepts the whole SKU family, not one part number. */
export const AM06_SKU_FAMILY = 'RF-';

/** Step 5 — a preset lands first, then the real contract replaces it. */
export const AM06_SCHEMA_PRESET = 'Required id';
export const AM06_SCHEMA = [
  '{',
  '  "type": "object",',
  '  "required": ["customer", "items"],',
  '  "properties": {',
  '    "customer": {',
  '      "type": "object",',
  '      "required": ["id", "tier"],',
  '      "properties": {',
  '        "tier": { "enum": ["gold", "platinum"] }',
  '      }',
  '    },',
  '    "items": { "type": "array", "minItems": 1 }',
  '  }',
  '}',
].join('\n');

/** Root group id the quiet rebuild mints, so guards do not depend on import remapping. */
const AM06_ROOT_GROUP_ID = 'grp-am06-root';

// ── Quiet condition trees ───────────────────────────────────────────────────

const SUBSET_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am06-subset',
  source: 'body',
  selector: '',
  operator: 'json_subset',
  expected: AM06_SUBSET_EXPECTED,
};

const JSONPATH_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am06-jsonpath',
  source: 'body',
  selector: '',
  operator: 'jsonPath_equals',
  expected: [AM06_JSONPATH, AM06_SKU],
};

/** The same row after the match-style toggle: a substring reading of the SKU family. */
const JSONPATH_SUBSET_PREDICATE: ApiMockDemoPredicate = {
  ...JSONPATH_PREDICATE,
  expected: [AM06_JSONPATH, AM06_SKU_FAMILY],
  options: { matchStyle: 'subset' },
};

const SCHEMA_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am06-schema',
  source: 'body',
  selector: '',
  operator: 'jsonSchema',
  expected: AM06_SCHEMA,
};

// ── Row identity ────────────────────────────────────────────────────────────

const CONDITION_TESTID_PREFIX = 'api-mock-condition-';

/** Every Match condition row on screen, in render order. */
export function am06ConditionRows(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    `.am-matcher-row[data-testid^="${CONDITION_TESTID_PREFIX}"]`,
  ));
}

export function am06ConditionIds(root: ParentNode = document): string[] {
  return am06ConditionRows(root)
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(CONDITION_TESTID_PREFIX))
    .map(id => id.slice(CONDITION_TESTID_PREFIX.length));
}

export function am06ConditionCount(): number {
  return am06ConditionIds().length;
}

export function am06ConditionOperator(id: string): string {
  return document.querySelector(API_MOCK.conditionOperator(id))?.getAttribute('data-value') ?? '';
}

/**
 * Body rows carry no key, so the operator is their identity. Every matcher this
 * lesson authors uses a different one, which keeps replayed steps on their own row.
 */
export function am06FindConditionByOperator(operator: string): string | null {
  return am06ConditionIds().find(id => am06ConditionOperator(id) === operator) ?? null;
}

/** Expected JSON of a subset / strict / schema row — those render a textarea. */
export function am06ConditionSchema(id: string): string {
  return document.querySelector<HTMLTextAreaElement>(API_MOCK.conditionSchema(id))?.value ?? '';
}

/** First box of a JSONPath row: the path expression. */
export function am06ConditionExpr(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionExpr(id))?.value ?? '';
}

export function am06ConditionValue(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionValue(id))?.value ?? '';
}

/** `equals` or `contains` — the button label *is* the current reading. */
export function am06MatchStyleLabel(id: string): string {
  return document.querySelector(API_MOCK.conditionMatchStyle(id))?.textContent?.trim() ?? '';
}

/** Root group — the only one carrying the un-suffixed `+ Condition` button. */
export function am06RootGroupId(): string | null {
  const testid = document.querySelector(API_MOCK.ADD_CONDITION)
    ?.closest('.am-matcher-group')?.getAttribute('data-testid') ?? '';
  const prefix = 'api-mock-group-';
  return testid.startsWith(prefix) ? testid.slice(prefix.length) : null;
}

// ── State probes ────────────────────────────────────────────────────────────

/** True when the Studio (authoring) view is mounted — Runtime / Conflicts unmount it. */
export function isAm06StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm06Workspace(): boolean {
  return document.querySelectorAll(API_MOCK.ROUTE_ROW).length > 0;
}

export function hasAm06RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm06ToolboxOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.PATTERN_TOOLBOX));
}

export function isAm06SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

/** The JSONPath the toolbox derived from the sample body. */
export function am06ToolboxJsonPath(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.TOOLBOX_JSONPATH)?.value ?? '';
}

/** What that path *returns* against the pasted sample — read-only in the toolbox. */
export function am06ToolboxResolved(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.TOOLBOX_JSON_RESOLVED)?.value ?? '';
}

export function am06ToolboxExpected(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.TOOLBOX_JSON_EXPECTED)?.value ?? '';
}

/** Simulate's ad-hoc method, read off the picker wrapper. */
export function am06SimMethod(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_METHOD)?.getAttribute('data-value') ?? '';
}

/** MATCHED / UNMATCHED / AMBIGUOUS / FAULT, or '' before the first run. */
export function am06SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

/** Decision-trace predicate rows: Method, Path, then one per condition leaf. */
export function am06TraceRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
}

/**
 * The trace row that mentions `needle`. A passing row shows the operator name; a
 * failing one shows the reason, which also names the operator that rejected the body.
 */
export function am06TraceRowByText(needle: string): HTMLElement | null {
  return am06TraceRows().find(row => (row.textContent ?? '').includes(needle)) ?? null;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: the subset-baseline corpus and a collapsed app sidebar. */
export async function prepareAm06Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM06_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — the lesson never binds a listener. */
export async function cleanupAm06(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Overlay hygiene ─────────────────────────────────────────────────────────

/** Dismiss the toolbox when a previous step (or an early Next) left it open. */
export async function closeAm06Toolbox(ctx: DemoActionContext): Promise<void> {
  if (!isAm06ToolboxOpen()) return;
  await ctx.click(API_MOCK.TOOLBOX_CANCEL);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

/** Dismiss the Simulate workspace so the next step's spotlight lands on the Studio. */
export async function closeAm06Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm06SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, opts);
}

// ── Guards ──────────────────────────────────────────────────────────────────

/** Authoring guards must not fire on Runtime / Conflicts — both unmount the explorer. */
export async function ensureAm06StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm06StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

/** Guard — the corpus is the active workspace, with no overlay in the way. */
export async function ensureAm06Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm06Toolbox(ctx);
  await closeAm06Simulate(ctx);
  await ensureAm06StudioView(ctx);
  if (hasAm06Workspace()) return;
  await importApiMockGallerySample(AM06_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

/** Guard — the order rule is open in the editor, on the Match tab. */
export async function ensureAm06RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm06Workspace(ctx);
  if (!hasAm06RouteEditor()) {
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
async function setAm06Conditions(
  ctx: DemoActionContext,
  children: ApiMockDemoPredicateGroup['children'],
): Promise<void> {
  await ensureAm06RuleOpen(ctx);
  const applied = patchApiMockActiveRoute({
    predicates: { id: AM06_ROOT_GROUP_ID, combinator: 'all', children },
  });
  if (!applied) return;
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/** Guard — the corpus baseline only: one forgiving subset matcher. */
export async function ensureAm06SubsetBaseline(ctx: DemoActionContext): Promise<void> {
  await setAm06Conditions(ctx, [SUBSET_PREDICATE]);
}

/** Guard — baseline plus the JSONPath row, still on its exact reading. */
export async function ensureAm06JsonPathCondition(ctx: DemoActionContext): Promise<void> {
  await setAm06Conditions(ctx, [SUBSET_PREDICATE, JSONPATH_PREDICATE]);
}

/** Guard — the JSONPath row after the match-style toggle (substring, SKU family). */
export async function ensureAm06MatchStyle(ctx: DemoActionContext): Promise<void> {
  await setAm06Conditions(ctx, [SUBSET_PREDICATE, JSONPATH_SUBSET_PREDICATE]);
}

/** Guard for the closing proof — subset, JSONPath, and the schema contract. */
export async function ensureAm06Schema(ctx: DemoActionContext): Promise<void> {
  await setAm06Conditions(ctx, [SUBSET_PREDICATE, JSONPATH_SUBSET_PREDICATE, SCHEMA_PREDICATE]);
}

// ── Authoring primitives ────────────────────────────────────────────────────

/** Hold on the group's leaf tally — the payoff for any step that adds a matcher. */
async function spotlightAm06Count(ctx: DemoActionContext): Promise<void> {
  const root = am06RootGroupId();
  await spotlightBeat(
    ctx,
    root ? API_MOCK.groupCount(root) : API_MOCK.FIRST_CONDITION,
    T.payoff,
  );
}

/**
 * Select a value inside the toolbox's sample body the way a viewer would, so the
 * product derives the JSONPath from the highlight instead of the lesson typing it.
 * The editor reads the selection on `select` / `mouseup`, then resolves the tightest
 * JSON node covering it on the next frame — both events are dispatched because a real
 * drag ends with the mouse, and the ring is placed first so the viewer sees where.
 */
async function pickJsonToken(ctx: DemoActionContext, token: string): Promise<boolean> {
  await spotlightBeat(ctx, API_MOCK.TOOLBOX_JSON_SAMPLE, T.payoff);
  const editor = firstVisibleElement<HTMLTextAreaElement>(API_MOCK.TOOLBOX_JSON_SAMPLE);
  const index = editor?.value.indexOf(token) ?? -1;
  if (!editor || index < 0) return false;
  editor.focus();
  editor.setSelectionRange?.(index, index + token.length);
  editor.dispatchEvent(new Event('select', { bubbles: true }));
  editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await ctx.delay(T.simOutcome);
  return true;
}

/** Open the Pattern Toolbox from the wand beside the request path. */
async function openAm06Toolbox(ctx: DemoActionContext, tab: string): Promise<void> {
  if (!isAm06ToolboxOpen()) {
    await am06Aim(ctx, API_MOCK.PATH_TOOLBOX);
    await am06Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  }
  await am06Aim(ctx, tab, T.tabSwitch);
}

// ── Simulate primitives ─────────────────────────────────────────────────────

/** Open Simulate from the editor header. */
async function openAm06Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm06SimulateOpen()) return;
  await am06Aim(ctx, API_MOCK.SIMULATE);
  await am06Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

/**
 * Shape one ad-hoc request and hold on the verdict. After the path and body are
 * filled the viewer gets a dedicated review pass before **Run simulation**.
 * Simulate opens seeded from the selected rule, so the method is already `POST`
 * — it is only picked when something left it on another verb. A run swaps the
 * form for the results pane, so later runs go back through **Request** first.
 */
async function runAm06Simulation(
  ctx: DemoActionContext,
  body: string,
  sampleName: string,
): Promise<string> {
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am06SimMethod() !== AM06_RULE_METHOD) {
    await am06Select(ctx, API_MOCK.SIMULATE_METHOD, AM06_RULE_METHOD);
  }
  await am06Fill(ctx, API_MOCK.SIMULATE_PATH, AM06_RULE_PATH);
  await am06Fill(ctx, API_MOCK.SIMULATE_BODY, body, T.simOutcome);
  await reviewAndRunSimulation(ctx, {
    review: T.payoff,
    beforeRun: T.beforeRun,
    sampleName,
  });
  await am06Reveal(ctx, API_MOCK.SIMULATE_RESULT);
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  return am06SimOutcome();
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — read the baseline matcher, then prove what `json_subset` actually means:
 * a payload with three fields the matcher never mentions still matches.
 */
export async function runAm06SubsetBaseline(ctx: DemoActionContext): Promise<string> {
  const id = am06FindConditionByOperator('json_subset');
  if (id) {
    await am06Look(ctx, API_MOCK.conditionRow(id));
    await am06Look(ctx, API_MOCK.conditionOperator(id));
    await am06Payoff(ctx, API_MOCK.conditionSchema(id));
  }
  await am06Break(ctx);

  await openAm06Simulate(ctx);
  const outcome = await runAm06Simulation(ctx, AM06_RICH_BODY, AM06_SAMPLE_EXTRAS);
  await am06Trace(ctx, am06TraceRowByText('json_subset'), T.simOutcome);
  await closeAm06Simulate(ctx, { review: true });
  if (id) await am06Payoff(ctx, API_MOCK.conditionSchema(id));
  return outcome;
}

/**
 * Step 2 — the same expected JSON read as deep equality: `json_strict` rejects the
 * payload that just matched, and the trace says which matcher did it. Then back.
 */
export async function runAm06StrictAndBack(ctx: DemoActionContext): Promise<string> {
  const id = am06FindConditionByOperator('json_subset');
  if (!id) return '';
  await am06Select(ctx, API_MOCK.conditionOperator(id), 'json_strict');
  await am06Look(ctx, API_MOCK.conditionSchema(id));
  await am06Break(ctx);

  await openAm06Simulate(ctx);
  const outcome = await runAm06Simulation(ctx, AM06_RICH_BODY, AM06_SAMPLE_STRICT);
  await am06Look(ctx, API_MOCK.SIMULATE_CANDIDATES);
  await am06Trace(ctx, am06TraceRowByText('json_strict'), T.simOutcome);
  await closeAm06Simulate(ctx, { review: true });
  await am06Break(ctx);

  await am06Select(ctx, API_MOCK.conditionOperator(id), 'json_subset');
  await am06Payoff(ctx, API_MOCK.conditionRow(id));
  return outcome;
}

/**
 * Step 3 — the JSON body tab writes the matcher for you: paste a payload, click the
 * value you care about, read what the path resolves to, and choose between "the field
 * exists" and "the field equals this".
 */
export async function runAm06PickFromJson(ctx: DemoActionContext): Promise<void> {
  await openAm06Toolbox(ctx, API_MOCK.TOOLBOX_TAB_JSONPATH);
  await am06Fill(ctx, API_MOCK.TOOLBOX_JSON_SAMPLE, AM06_RICH_BODY, T.payoff);
  await am06Look(ctx, API_MOCK.TOOLBOX_JSON_VALID);

  await pickJsonToken(ctx, AM06_PICK_TOKEN);
  // The caret drives the derivation; type the path only if the pick did not land.
  if (am06ToolboxJsonPath() !== AM06_JSONPATH) {
    await am06Fill(ctx, API_MOCK.TOOLBOX_JSONPATH, AM06_JSONPATH);
  }
  await am06Payoff(ctx, API_MOCK.TOOLBOX_JSONPATH);
  await am06Payoff(ctx, API_MOCK.TOOLBOX_JSON_RESOLVED);
  await am06Break(ctx);

  await am06Fill(ctx, API_MOCK.TOOLBOX_JSON_EXPECTED, '');
  await am06Payoff(ctx, API_MOCK.TOOLBOX_JSON_RESULT);
  await am06Fill(ctx, API_MOCK.TOOLBOX_JSON_EXPECTED, AM06_SKU);
  await am06Payoff(ctx, API_MOCK.TOOLBOX_JSON_RESULT);
  await am06Break(ctx);

  await am06Aim(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await spotlightAm06Count(ctx);
  const id = am06FindConditionByOperator('jsonPath_equals');
  await am06Trace(
    ctx,
    id
      ? firstVisibleElement<HTMLElement>(API_MOCK.conditionRow(id))
      : am06ConditionRows().at(-1),
    T.payoff,
  );
}

/**
 * Step 4 — one button decides how the resolved value is compared. `equals` is exact;
 * `contains` accepts a substring of a scalar, or a partial object for object-valued
 * paths — which is what turns one part number into a whole SKU family.
 */
export async function runAm06MatchStyle(ctx: DemoActionContext): Promise<void> {
  const id = am06FindConditionByOperator('jsonPath_equals');
  if (!id) return;
  await am06Look(ctx, API_MOCK.conditionExpr(id));
  await am06Payoff(ctx, API_MOCK.conditionMatchStyle(id));
  await am06Break(ctx);

  if (am06MatchStyleLabel(id) !== 'contains') {
    await am06Aim(ctx, API_MOCK.conditionMatchStyle(id), T.payoff);
  }
  await am06Fill(ctx, API_MOCK.conditionValue(id), AM06_SKU_FAMILY, T.payoff);
  await am06Payoff(ctx, API_MOCK.conditionRow(id));
}

/**
 * Step 5 — the Schema tab validates *shape* instead of values: the contract-testing
 * matcher. A preset lands first so the viewer sees the format, then the real contract
 * replaces it and arrives as an ordinary condition row.
 */
export async function runAm06JsonSchema(ctx: DemoActionContext): Promise<void> {
  await openAm06Toolbox(ctx, API_MOCK.TOOLBOX_TAB_SCHEMA);
  await am06Look(ctx, API_MOCK.TOOLBOX_SCHEMA_KIND_JSON);
  await am06Aim(ctx, API_MOCK.toolboxSchemaPreset(AM06_SCHEMA_PRESET), T.payoff);
  await am06Look(ctx, API_MOCK.TOOLBOX_SCHEMA_EDITOR);
  await am06Break(ctx);

  await am06Fill(ctx, API_MOCK.TOOLBOX_SCHEMA_EDITOR, AM06_SCHEMA, T.payoff);
  await am06Aim(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await spotlightAm06Count(ctx);

  const id = am06FindConditionByOperator('jsonSchema');
  if (id) {
    await am06Look(ctx, API_MOCK.conditionOperator(id));
    await am06Payoff(ctx, API_MOCK.conditionSchema(id));
    return;
  }
  await am06Trace(ctx, am06ConditionRows().at(-1), T.payoff);
}

/**
 * Step 6 — three body matchers, proven together: a payload that satisfies both JSON
 * matchers but breaks the contract is rejected by the schema alone, and the payload
 * that satisfies all three is rendered.
 */
export async function runAm06ProveSchema(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  await openAm06Simulate(ctx);

  outcomes.push(await runAm06Simulation(ctx, AM06_INVALID_BODY, AM06_SAMPLE_INVALID));
  await am06Look(ctx, API_MOCK.SIMULATE_CANDIDATES);
  for (const row of am06TraceRows()) {
    await am06Trace(ctx, row);
  }
  await am06Trace(ctx, am06TraceRowByText('jsonSchema'), T.simOutcome);
  await am06Break(ctx);

  outcomes.push(await runAm06Simulation(ctx, AM06_RICH_BODY, AM06_SAMPLE_COMPLETE));
  await am06Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  await am06Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  await closeAm06Simulate(ctx, { review: true });
  await am06Payoff(ctx, API_MOCK.ROUTE_EXPLORER);
  return outcomes;
}
