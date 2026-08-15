/**
 * AM-07 `am-07-payload-formats` helpers — forms, multipart, XML & binary matching.
 *
 * Four bare rules ship in the corpus (a token form, an upload, a SOAP order, a firmware
 * blob) and every matcher is authored live. Rule ids are re-minted on gallery import, so
 * rows are located by their method + path text; condition ids are minted by the editor,
 * so rows are located by the operator they carry. `ensure*` guards replace the whole
 * Match tree through the quiet patch bridge, which is what makes a replayed step start
 * from a known state instead of stacking duplicate rows.
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
 * AM-07 holds longer than the shared pack. Form / multipart / XML payloads are easy
 * to miss, tab and modal clicks need an aim ring first, and Simulate must pause on
 * the filled request so the viewer can read Content-Type + body before Run.
 */
export const AM07_TIMING = {
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
  /** Ring on **Run simulation** before the click. */
  beforeRun: 2400,
} as const;

const T = AM07_TIMING;

async function am07Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a tab or modal trigger, then click — viewer sees where we are going. */
async function am07Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am07Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am07Select(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.look, hold });
}

async function am07Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am07Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am07Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am07Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

async function am07Trace(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  hold: number = T.traceRow,
): Promise<void> {
  await spotlightElementBeat(ctx, el, hold);
}

/** Background corpus: four non-JSON endpoints that currently match on nothing. */
export const AM07_CORPUS_SAMPLE = 'am-gallery-formats';

/** A rule in the corpus, addressed the way the explorer renders it. */
export interface Am07RuleRef {
  method: string;
  path: string;
}

export const AM07_FORM_RULE: Am07RuleRef = { method: 'POST', path: '/oauth/token' };
export const AM07_UPLOAD_RULE: Am07RuleRef = { method: 'POST', path: '/uploads' };
export const AM07_XML_RULE: Am07RuleRef = { method: 'POST', path: '/soap/orders' };
export const AM07_BINARY_RULE: Am07RuleRef = { method: 'PUT', path: '/firmware' };

export const AM07_FORM_SAMPLE = 'Issue Token (form)';
export const AM07_FORM_VARIANT_SAMPLE = 'Issue Token (regional)';
export const AM07_UPLOAD_SAMPLE = 'Upload Document (multipart)';
export const AM07_XML_SAMPLE = 'Submit Order (SOAP)';
export const AM07_XML_INVALID_SAMPLE = 'Submit Order (truncated)';
export const AM07_BINARY_SAMPLE = 'Publish Firmware (binary)';
export const AM07_BINARY_ALTERED_SAMPLE = 'Publish Firmware (altered)';

// ── Payloads ────────────────────────────────────────────────────────────────

/** Steps 1–2 — an OAuth token request, the classic urlencoded form body. */
export const AM07_FORM_CONTENT_TYPE = 'Content-Type: application/x-www-form-urlencoded';
export const AM07_FORM_BODY = 'grant_type=password&username=ada.lovelace&client_id=web-2.1.4';
/** Same form from a different deployment — the exact matcher rejects this one. */
export const AM07_FORM_BODY_VARIANT = 'grant_type=password&username=ada.lovelace.eu&client_id=web-3.0.0';
export const AM07_FORM_FIELD = 'username';
export const AM07_FORM_VALUE = 'ada.lovelace';
export const AM07_FORM_PATTERN = '^ada\\.';

/** Steps 3–4 — a two-part upload: one text part, one file part. */
export const AM07_MULTIPART_BOUNDARY = 'AM07Boundary';
export const AM07_MULTIPART_CONTENT_TYPE =
  `Content-Type: multipart/form-data; boundary=${AM07_MULTIPART_BOUNDARY}`;
export const AM07_MULTIPART_FIELD = 'title';
export const AM07_MULTIPART_FIELD_VALUE = 'Q3 revenue report';
export const AM07_MULTIPART_FILE_PART = 'document';
export const AM07_MULTIPART_FILENAME = 'report.pdf';
export const AM07_MULTIPART_BODY = [
  `--${AM07_MULTIPART_BOUNDARY}`,
  `Content-Disposition: form-data; name="${AM07_MULTIPART_FIELD}"`,
  '',
  AM07_MULTIPART_FIELD_VALUE,
  `--${AM07_MULTIPART_BOUNDARY}`,
  `Content-Disposition: form-data; name="${AM07_MULTIPART_FILE_PART}"; filename="${AM07_MULTIPART_FILENAME}"`,
  'Content-Type: application/pdf',
  '',
  '%PDF-1.7 (bytes elided)',
  `--${AM07_MULTIPART_BOUNDARY}--`,
].join('\n');

/** Steps 5–6 — a namespaced SOAP envelope, which is why the XPath uses `local-name()`. */
export const AM07_XML_CONTENT_TYPE = 'Content-Type: application/xml';
export const AM07_XML_BODY = [
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
  '  <soap:Body>',
  '    <SubmitOrder xmlns="urn:intake:orders">',
  '      <orderId>A-1098</orderId>',
  '      <customer>C-4421</customer>',
  '      <total>1240.00</total>',
  '    </SubmitOrder>',
  '  </soap:Body>',
  '</soap:Envelope>',
].join('\n');
/** The same envelope with `<customer>` dropped — only the element list can reject it. */
export const AM07_XML_BODY_INVALID = AM07_XML_BODY
  .split('\n')
  .filter(line => !line.includes('<customer>'))
  .join('\n');

export const AM07_XPATH_PRESET = 'Local name';
export const AM07_XPATH = "//*[local-name()='orderId']/text()";
export const AM07_ORDER_ID = 'A-1098';
export const AM07_SCHEMA_PRESET = 'XML names';
export const AM07_XML_ELEMENTS = 'Envelope, SubmitOrder, orderId, customer';

/** Step 7 — a firmware blob, pinned first by bytes and then by digest. */
export const AM07_BINARY_CONTENT_TYPE = 'Content-Type: application/octet-stream';
export const AM07_BINARY_BODY = 'RFW1|firmware|v2.4.0';
export const AM07_BINARY_BODY_ALTERED = 'RFW1|firmware|v2.4.1';
/** `sha256(AM07_BINARY_BODY)` — the digest a build pipeline publishes beside the artifact. */
export const AM07_BINARY_SHA256 =
  'd5a4c05a0eeeea787fce65ebe5c6d1d7bcfe5fbfd419a14125a46b74ff0b7d6d';

/** Root group id the quiet rebuild mints, so guards do not depend on import remapping. */
const AM07_ROOT_GROUP_ID = 'grp-am07-root';

// ── Quiet condition trees ───────────────────────────────────────────────────

const FORM_EXACT_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am07-form-exact',
  source: 'body',
  selector: '',
  operator: 'form_field_exact',
  expected: [AM07_FORM_FIELD, AM07_FORM_VALUE],
};

const MULTIPART_FIELD_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am07-mp-field',
  source: 'body',
  selector: '',
  operator: 'multipart_field',
  expected: [AM07_MULTIPART_FIELD, AM07_MULTIPART_FIELD_VALUE],
};

const MULTIPART_FILE_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am07-mp-file',
  source: 'body',
  selector: '',
  operator: 'multipart_file',
  expected: [AM07_MULTIPART_FILE_PART, AM07_MULTIPART_FILENAME],
};

const XPATH_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am07-xpath',
  source: 'body',
  selector: '',
  operator: 'xpath_equals',
  expected: [AM07_XPATH, AM07_ORDER_ID],
};

// ── Rule identity ───────────────────────────────────────────────────────────

/** Every explorer rule row, in render order. */
export function am07RuleRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

function rowMethod(row: HTMLElement): string {
  return row.querySelector('.am-method')?.textContent?.trim() ?? '';
}

function rowPath(row: HTMLElement): string {
  return row.querySelector('.am-route-path')?.textContent?.trim() ?? '';
}

/** The row for a corpus rule — ids are re-minted on import, method + path are not. */
export function am07RuleRow(ref: Am07RuleRef): HTMLElement | null {
  return am07RuleRows().find(row => rowMethod(row) === ref.method && rowPath(row) === ref.path)
    ?? null;
}

/** A clickable selector for that row, derived from the id the import actually minted. */
export function am07RuleSelector(ref: Am07RuleRef): string | null {
  const testid = am07RuleRow(ref)?.getAttribute('data-testid');
  return testid ? `[data-testid="${testid}"]` : null;
}

/** Which rule the editor currently has open, read off the path field. */
export function am07OpenRulePath(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.PATH_INPUT)?.value ?? '';
}

export function isAm07RuleOpen(ref: Am07RuleRef): boolean {
  return am07OpenRulePath() === ref.path;
}

// ── Condition identity ──────────────────────────────────────────────────────

const CONDITION_TESTID_PREFIX = 'api-mock-condition-';

export function am07ConditionRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    `.am-matcher-row[data-testid^="${CONDITION_TESTID_PREFIX}"]`,
  ));
}

export function am07ConditionIds(): string[] {
  // The selector guarantees the prefix, so the slice needs no guard.
  return am07ConditionRows()
    .map(row => String(row.dataset.testid).slice(CONDITION_TESTID_PREFIX.length));
}

export function am07ConditionCount(): number {
  return am07ConditionIds().length;
}

export function am07ConditionOperator(id: string): string {
  return document.querySelector(API_MOCK.conditionOperator(id))?.getAttribute('data-value') ?? '';
}

/**
 * Body rows carry no key, so the operator is their identity. Every matcher this lesson
 * authors uses a different one, which keeps a replayed step on its own row.
 */
export function am07FindConditionByOperator(operator: string): string | null {
  return am07ConditionIds().find(id => am07ConditionOperator(id) === operator) ?? null;
}

/** First box of a two-part matcher: the field name, or the XPath expression. */
export function am07ConditionExpr(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionExpr(id))?.value ?? '';
}

export function am07ConditionValue(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionValue(id))?.value ?? '';
}

/** Root group — the only one carrying the un-suffixed `+ Condition` button. */
export function am07RootGroupId(): string | null {
  const testid = document.querySelector(API_MOCK.ADD_CONDITION)
    ?.closest('.am-matcher-group')?.getAttribute('data-testid') ?? '';
  const prefix = 'api-mock-group-';
  return testid.startsWith(prefix) ? testid.slice(prefix.length) : null;
}

// ── State probes ────────────────────────────────────────────────────────────

/** True when the Studio (authoring) view is mounted — Runtime / Conflicts unmount it. */
export function isAm07StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm07Workspace(): boolean {
  return am07RuleRows().length > 0;
}

export function hasAm07RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm07ToolboxOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.PATTERN_TOOLBOX));
}

export function isAm07SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function isAm07TextExpandOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.TEXT_EXPAND_MODAL));
}

/** The expression the XPath tab is composing. */
export function am07ToolboxXPath(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.TOOLBOX_XPATH_EXPR)?.value ?? '';
}

/** What that expression selects from the pasted sample — read-only in the toolbox. */
export function am07ToolboxXPathResolved(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.TOOLBOX_XPATH_RESOLVED)?.value ?? '';
}

export function am07ToolboxSchemaText(): string {
  return firstVisibleElement<HTMLTextAreaElement>(API_MOCK.TOOLBOX_SCHEMA_EDITOR)?.value ?? '';
}

export function am07SimMethod(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_METHOD)?.getAttribute('data-value') ?? '';
}

/** MATCHED / UNMATCHED / AMBIGUOUS / FAULT, or '' before the first run. */
export function am07SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

/** Decision-trace predicate rows: Method, Path, then one per condition leaf. */
export function am07TraceRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.SIMULATE_PREDICATE_ROWS));
}

/**
 * The trace row that mentions `needle`. A passing row prints the operator name; a
 * failing one prints the reason, which also names the operator that rejected the body.
 */
export function am07TraceRowByText(needle: string): HTMLElement | null {
  return am07TraceRows().find(row => (row.textContent ?? '').includes(needle)) ?? null;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: the four bare non-JSON rules and a collapsed app sidebar. */
export async function prepareAm07Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM07_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — the lesson never binds a listener. */
export async function cleanupAm07(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Overlay hygiene ─────────────────────────────────────────────────────────

/** Dismiss the toolbox when a previous step (or an early Next) left it open. */
export async function closeAm07Toolbox(ctx: DemoActionContext): Promise<void> {
  if (!isAm07ToolboxOpen()) return;
  await ctx.click(API_MOCK.TOOLBOX_CANCEL);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

/** Dismiss the Request body popup so Save / Run are not sitting behind it. */
export async function closeAm07TextExpand(ctx: DemoActionContext, visible = false): Promise<void> {
  if (!isAm07TextExpandOpen()) return;
  if (visible) {
    await clickBeat(ctx, API_MOCK.TEXT_EXPAND_CLOSE, { look: 300, hold: 400 });
    return;
  }
  firstVisibleElement<HTMLButtonElement>(API_MOCK.TEXT_EXPAND_CLOSE)?.click();
}

/** Dismiss the Simulate workspace so the next step's spotlight lands on the Studio. */
export async function closeAm07Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  await closeAm07TextExpand(ctx);
  if (!isAm07SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, opts);
}

// ── Guards ──────────────────────────────────────────────────────────────────

/** Authoring guards must not fire on Runtime / Conflicts — both unmount the explorer. */
export async function ensureAm07StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm07StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

/** Guard — the corpus is the active workspace, with no overlay in the way. */
export async function ensureAm07Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await closeAm07Toolbox(ctx);
  await closeAm07Simulate(ctx);
  await ensureAm07StudioView(ctx);
  if (hasAm07Workspace()) return;
  await importApiMockGallerySample(AM07_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

/** Show the Match tab when the editor is parked on another body tab. */
async function ensureAm07MatchTab(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.ADD_CONDITION)) return;
  await ctx.click(API_MOCK.BTAB_MATCH);
  await ctx.delay(AM_DEMO_TIMING.tabSwitch);
}

/**
 * Open one corpus rule quietly. The patch bridge writes to whichever rule the Studio
 * has selected, so a guard must land the selection *and* wait for the editor to repaint
 * before it patches — otherwise the conditions go onto the previous rule.
 */
export async function openAm07Rule(ctx: DemoActionContext, ref: Am07RuleRef): Promise<boolean> {
  await ensureAm07Workspace(ctx);
  if (!isAm07RuleOpen(ref)) {
    const selector = am07RuleSelector(ref);
    if (!selector) return false;
    await ctx.click(selector);
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
    for (let i = 0; i < 12 && !isAm07RuleOpen(ref); i++) {
      await ctx.delay(100);
    }
  }
  await ensureAm07MatchTab(ctx);
  return isAm07RuleOpen(ref);
}

/**
 * Put one rule's whole Match group back the way a step starts from. Rebuilding beats
 * patching row by row: the viewer authors rows with generated ids, so replaying a step
 * can only be made idempotent by replacing the tree outright.
 */
async function setAm07Conditions(
  ctx: DemoActionContext,
  ref: Am07RuleRef,
  children: ApiMockDemoPredicateGroup['children'],
): Promise<void> {
  if (!await openAm07Rule(ctx, ref)) return;
  const applied = patchApiMockActiveRoute({
    predicates: { id: AM07_ROOT_GROUP_ID, combinator: 'all', children },
  });
  if (!applied) return;
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/**
 * Guard for the two authoring steps that open a rule themselves. They must *not*
 * pre-select it — the visible beat is the switch between rules — so the guard only
 * clears overlays and leaves the selection alone.
 */
export async function ensureAm07Corpus(ctx: DemoActionContext): Promise<void> {
  await ensureAm07Workspace(ctx);
  if (hasAm07RouteEditor()) await ensureAm07MatchTab(ctx);
}

/** Guard — the token rule carries the exact form matcher the proof step re-reads. */
export async function ensureAm07FormExact(ctx: DemoActionContext): Promise<void> {
  await setAm07Conditions(ctx, AM07_FORM_RULE, [FORM_EXACT_PREDICATE]);
}

/** Guard — the upload rule carries both multipart matchers. */
export async function ensureAm07MultipartConditions(ctx: DemoActionContext): Promise<void> {
  await setAm07Conditions(ctx, AM07_UPLOAD_RULE, [
    MULTIPART_FIELD_PREDICATE,
    MULTIPART_FILE_PREDICATE,
  ]);
}

/**
 * Guard for the XPath step. Applying from the toolbox always *appends* a row, so a
 * replay has to start from an empty group — which means selecting the SOAP rule. The
 * viewer is then handed back to the upload rule, so the step can still show the switch
 * between rules as a real click.
 */
export async function ensureAm07XmlBare(ctx: DemoActionContext): Promise<void> {
  await setAm07Conditions(ctx, AM07_XML_RULE, []);
  await openAm07Rule(ctx, AM07_UPLOAD_RULE);
}

/** Guard — the SOAP rule carries the XPath matcher the schema step stacks onto. */
export async function ensureAm07XPathCondition(ctx: DemoActionContext): Promise<void> {
  await setAm07Conditions(ctx, AM07_XML_RULE, [XPATH_PREDICATE]);
}

// ── Authoring primitives ────────────────────────────────────────────────────

/** Hold on the group's leaf tally — the payoff for any step that adds a matcher. */
async function spotlightAm07Count(ctx: DemoActionContext): Promise<void> {
  const root = am07RootGroupId();
  await spotlightBeat(
    ctx,
    root ? API_MOCK.groupCount(root) : API_MOCK.FIRST_CONDITION,
    T.payoff,
  );
}

/**
 * Bring one corpus rule on screen as a *visible* beat. Clicking a row that is already
 * open would risk reading as a double-click (which toggles the rule off), so an
 * already-open rule is spotlighted instead.
 */
async function focusAm07Rule(ctx: DemoActionContext, ref: Am07RuleRef): Promise<boolean> {
  const selector = am07RuleSelector(ref);
  if (!selector) return false;
  if (isAm07RuleOpen(ref)) {
    await am07Payoff(ctx, selector);
  } else {
    await am07Aim(ctx, selector);
    await am07Reveal(ctx, API_MOCK.ROUTE_EDITOR);
    for (let i = 0; i < 12 && !isAm07RuleOpen(ref); i++) {
      await ctx.delay(100);
    }
  }
  await ensureAm07MatchTab(ctx);
  return isAm07RuleOpen(ref);
}

/**
 * Add a body condition and put it on `operator`, or hand back the row that already
 * carries that operator so a replayed step edits instead of duplicating.
 */
async function addAm07BodyCondition(
  ctx: DemoActionContext,
  operator: string,
): Promise<string | null> {
  const existing = am07FindConditionByOperator(operator);
  if (existing) return existing;
  const before = new Set(am07ConditionIds());
  await am07Click(ctx, API_MOCK.ADD_CONDITION, T.panelReady);
  let id: string | undefined;
  for (let i = 0; i < 12; i++) {
    id = am07ConditionIds().find(candidate => !before.has(candidate));
    if (id) break;
    await ctx.delay(100);
  }
  if (!id) return null;
  await am07Select(ctx, API_MOCK.conditionSource(id), 'body');
  await am07Select(ctx, API_MOCK.conditionOperator(id), operator);
  return id;
}

/** Open the Pattern Toolbox from the wand beside the request path, on one tab. */
async function openAm07Toolbox(ctx: DemoActionContext, tab: string): Promise<void> {
  if (!isAm07ToolboxOpen()) {
    await am07Aim(ctx, API_MOCK.PATH_TOOLBOX);
    await am07Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  }
  await am07Aim(ctx, tab, T.tabSwitch);
}

// ── Simulate primitives ─────────────────────────────────────────────────────

async function openAm07Simulate(ctx: DemoActionContext): Promise<void> {
  if (isAm07SimulateOpen()) return;
  await am07Aim(ctx, API_MOCK.SIMULATE);
  await am07Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
}

/**
 * Shape one ad-hoc request and hold on the verdict. Every payload here needs its own
 * `Content-Type`, because that header is what tells the form, multipart, XML and binary
 * matchers how to read the body. A run swaps the form for the results pane, so later
 * runs go back through **Request** first. After the fields are filled the viewer gets
 * a dedicated review pass before **Run simulation**.
 */
/**
 * After the multipart body is pasted: open **Request body**, search the text part
 * (`title`) then the file part (`report.pdf` on `document`), and hold each match.
 */
export async function reviewAm07MultipartBody(ctx: DemoActionContext): Promise<void> {
  const expand = firstVisibleElement(API_MOCK.SIMULATE_BODY_EXPAND);
  if (!expand && !isAm07TextExpandOpen()) return;
  if (expand) {
    await clickBeat(ctx, API_MOCK.SIMULATE_BODY_EXPAND, { look: 500, hold: 500 });
  }
  await revealBeat(ctx, API_MOCK.TEXT_EXPAND_MODAL, { timeout: 4_000, hold: 700 });

  if (firstVisibleElement(API_MOCK.TEXT_EXPAND_SEARCH)) {
    await fillBeat(ctx, API_MOCK.TEXT_EXPAND_SEARCH, AM07_MULTIPART_FIELD, { look: 400, hold: 550 });
  }
  if (firstVisibleElement(API_MOCK.TEXT_EXPAND_NEXT)) {
    await clickBeat(ctx, API_MOCK.TEXT_EXPAND_NEXT, { look: 200, hold: 0 });
  }
  await spotlightBeat(ctx, API_MOCK.TEXT_EXPAND_EDITOR, T.payoff);

  if (firstVisibleElement(API_MOCK.TEXT_EXPAND_SEARCH)) {
    await fillBeat(ctx, API_MOCK.TEXT_EXPAND_SEARCH, AM07_MULTIPART_FILENAME, { look: 400, hold: 550 });
  }
  if (firstVisibleElement(API_MOCK.TEXT_EXPAND_NEXT)) {
    await clickBeat(ctx, API_MOCK.TEXT_EXPAND_NEXT, { look: 200, hold: 0 });
  }
  await spotlightBeat(ctx, API_MOCK.TEXT_EXPAND_EDITOR, T.simOutcome);

  if (firstVisibleElement(API_MOCK.TEXT_EXPAND_CLOSE)) {
    await clickBeat(ctx, API_MOCK.TEXT_EXPAND_CLOSE, { look: 300, hold: 500 });
  } else {
    await closeAm07TextExpand(ctx);
  }
}

async function runAm07Simulation(
  ctx: DemoActionContext,
  req: {
    method: string;
    path: string;
    headers: string;
    body: string;
    sampleName: string;
    reviewMultipartBody?: boolean;
  },
): Promise<string> {
  await closeAm07TextExpand(ctx);
  await ensureAdHocSimulateForm(ctx, T.tabSwitch);
  if (am07SimMethod() !== req.method) {
    await am07Select(ctx, API_MOCK.SIMULATE_METHOD, req.method);
  }
  await am07Fill(ctx, API_MOCK.SIMULATE_PATH, req.path);
  await am07Fill(ctx, API_MOCK.SIMULATE_HEADERS, req.headers, T.payoff);
  await am07Fill(ctx, API_MOCK.SIMULATE_BODY, req.body, T.simOutcome);
  if (req.reviewMultipartBody) {
    await reviewAm07MultipartBody(ctx);
    await closeAm07TextExpand(ctx);
    await ensureAdHocSimulateForm(ctx, 400);
  }
  await reviewAndRunSimulation(ctx, {
    review: T.payoff,
    beforeRun: req.reviewMultipartBody ? 1_200 : T.beforeRun,
    sampleName: req.sampleName,
    reviewFields: req.reviewMultipartBody ? false : undefined,
    digest: req.reviewMultipartBody ? false : undefined,
  });
  await am07Reveal(ctx, API_MOCK.SIMULATE_RESULT);
  await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  return am07SimOutcome();
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/**
 * Step 1 — tour the four non-JSON endpoints, open the token rule, and author the first
 * form matcher: body source, the empty key box, then the field-and-value pair.
 */
export async function runAm07FormMatching(ctx: DemoActionContext): Promise<string | null> {
  for (const ref of [AM07_FORM_RULE, AM07_UPLOAD_RULE, AM07_XML_RULE, AM07_BINARY_RULE]) {
    await am07Trace(ctx, am07RuleRow(ref), T.look);
  }
  await am07Break(ctx);

  if (!await focusAm07Rule(ctx, AM07_FORM_RULE)) return null;
  await am07Look(ctx, API_MOCK.PATH_INPUT);
  await am07Payoff(ctx, API_MOCK.CONDITIONS_EMPTY);
  await am07Break(ctx);

  const id = await addAm07BodyCondition(ctx, 'form_field_exact');
  if (!id) return null;
  await am07Payoff(ctx, API_MOCK.conditionSelector(id));
  await am07Reveal(ctx, API_MOCK.conditionExpr(id), T.look);
  await am07Fill(ctx, API_MOCK.conditionExpr(id), AM07_FORM_FIELD);
  await am07Fill(ctx, API_MOCK.conditionValue(id), AM07_FORM_VALUE, T.payoff);
  await am07Payoff(ctx, API_MOCK.conditionRow(id));
  return id;
}

/**
 * Step 2 — prove the exact matcher against a real urlencoded body, then widen it to a
 * pattern and match a username the exact reading would have rejected.
 */
export async function runAm07ProveForm(ctx: DemoActionContext): Promise<string[]> {
  const outcomes: string[] = [];
  const id = am07FindConditionByOperator('form_field_exact');
  await openAm07Simulate(ctx);
  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_FORM_RULE.method,
    path: AM07_FORM_RULE.path,
    headers: AM07_FORM_CONTENT_TYPE,
    body: AM07_FORM_BODY,
    sampleName: AM07_FORM_SAMPLE,
  }));
  await am07Trace(ctx, am07TraceRowByText('form_field_exact'), T.simOutcome);
  await closeAm07Simulate(ctx, { review: true });
  await am07Break(ctx);

  if (!id) return outcomes;
  await am07Select(ctx, API_MOCK.conditionOperator(id), 'form_field_regex');
  await am07Fill(ctx, API_MOCK.conditionValue(id), AM07_FORM_PATTERN, T.payoff);
  await am07Break(ctx);

  await openAm07Simulate(ctx);
  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_FORM_RULE.method,
    path: AM07_FORM_RULE.path,
    headers: AM07_FORM_CONTENT_TYPE,
    body: AM07_FORM_BODY_VARIANT,
    sampleName: AM07_FORM_VARIANT_SAMPLE,
  }));
  await am07Trace(ctx, am07TraceRowByText('form_field_regex'), T.simOutcome);
  await closeAm07Simulate(ctx, { review: true });
  await am07Payoff(ctx, API_MOCK.conditionRow(id));
  return outcomes;
}

/**
 * Step 3 — switch to the upload rule and author the two multipart matchers: a text part
 * matched on its value, and a file part matched on its filename.
 */
export async function runAm07MultipartFields(ctx: DemoActionContext): Promise<void> {
  if (!await focusAm07Rule(ctx, AM07_UPLOAD_RULE)) return;
  await am07Look(ctx, API_MOCK.CONDITIONS_EMPTY);
  await am07Break(ctx);

  const fieldId = await addAm07BodyCondition(ctx, 'multipart_field');
  if (fieldId) {
    await am07Fill(ctx, API_MOCK.conditionExpr(fieldId), AM07_MULTIPART_FIELD);
    await am07Fill(ctx, API_MOCK.conditionValue(fieldId), AM07_MULTIPART_FIELD_VALUE, T.payoff);
  }
  await am07Break(ctx);

  const fileId = await addAm07BodyCondition(ctx, 'multipart_file');
  if (fileId) {
    await am07Fill(ctx, API_MOCK.conditionExpr(fileId), AM07_MULTIPART_FILE_PART);
    await am07Fill(ctx, API_MOCK.conditionValue(fileId), AM07_MULTIPART_FILENAME, T.payoff);
  }
  await spotlightAm07Count(ctx);
}

/**
 * Step 4 — one real multipart body, matched offline. The Normalized view is the payoff:
 * the boundary in the `Content-Type` is what let the matchers split the payload at all.
 */
export async function runAm07ProveMultipart(ctx: DemoActionContext): Promise<string> {
  await openAm07Simulate(ctx);
  const outcome = await runAm07Simulation(ctx, {
    method: AM07_UPLOAD_RULE.method,
    path: AM07_UPLOAD_RULE.path,
    headers: AM07_MULTIPART_CONTENT_TYPE,
    body: AM07_MULTIPART_BODY,
    sampleName: AM07_UPLOAD_SAMPLE,
    reviewMultipartBody: true,
  });
  await am07Trace(ctx, am07TraceRowByText('multipart_field'));
  await am07Trace(ctx, am07TraceRowByText('multipart_file'), T.simOutcome);
  await am07Break(ctx);

  await am07Aim(ctx, API_MOCK.SIMULATE_TAB_REQUEST, T.tabSwitch);
  await am07Payoff(ctx, API_MOCK.SIMULATE_NORMALIZED);
  await am07Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  await am07Payoff(ctx, API_MOCK.SIMULATE_RENDERED_BODY);
  await closeAm07Simulate(ctx, { review: true });
  return outcome;
}

/**
 * Step 5 — switch to the SOAP rule and let the XPath tab compose the matcher: a preset
 * for the namespace-safe syntax, the real envelope as the sample, and a live read of
 * what the expression selects before anything is applied.
 */
export async function runAm07XPath(ctx: DemoActionContext): Promise<void> {
  if (!await focusAm07Rule(ctx, AM07_XML_RULE)) return;
  await am07Look(ctx, API_MOCK.CONDITIONS_EMPTY);
  await am07Break(ctx);

  await openAm07Toolbox(ctx, API_MOCK.TOOLBOX_TAB_XPATH);
  await am07Aim(ctx, API_MOCK.toolboxXPathPreset(AM07_XPATH_PRESET), T.payoff);
  await am07Fill(ctx, API_MOCK.TOOLBOX_XPATH_SAMPLE, AM07_XML_BODY, T.payoff);
  await am07Fill(ctx, API_MOCK.TOOLBOX_XPATH_EXPR, AM07_XPATH);
  await am07Payoff(ctx, API_MOCK.TOOLBOX_XPATH_RESOLVED);
  await am07Break(ctx);

  await am07Fill(ctx, API_MOCK.TOOLBOX_XPATH_VALUE, AM07_ORDER_ID);
  await am07Payoff(ctx, API_MOCK.TOOLBOX_XPATH_RESULT);
  await am07Aim(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  await spotlightAm07Count(ctx);

  const id = am07FindConditionByOperator('xpath_equals');
  await am07Trace(
    ctx,
    id
      ? firstVisibleElement<HTMLElement>(API_MOCK.conditionRow(id))
      : am07ConditionRows().at(-1),
    T.payoff,
  );
}

/**
 * Step 6 — an element list instead of an XSD, then both verdicts: the full envelope
 * matches, and the one missing `<customer>` is rejected by the schema row alone.
 */
export async function runAm07XmlSchema(ctx: DemoActionContext): Promise<string[]> {
  await openAm07Toolbox(ctx, API_MOCK.TOOLBOX_TAB_SCHEMA);
  await am07Aim(ctx, API_MOCK.toolboxSchemaPreset(AM07_SCHEMA_PRESET), T.payoff);
  await am07Look(ctx, API_MOCK.TOOLBOX_SCHEMA_KIND_XML);
  await am07Fill(ctx, API_MOCK.TOOLBOX_SCHEMA_EDITOR, AM07_XML_ELEMENTS, T.payoff);
  await am07Aim(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  const schemaId = am07FindConditionByOperator('xmlSchema');
  if (schemaId) {
    await am07Payoff(ctx, API_MOCK.conditionRow(schemaId));
  }
  await am07Break(ctx);

  const outcomes: string[] = [];
  await openAm07Simulate(ctx);
  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_XML_RULE.method,
    path: AM07_XML_RULE.path,
    headers: AM07_XML_CONTENT_TYPE,
    body: AM07_XML_BODY,
    sampleName: AM07_XML_SAMPLE,
  }));
  await am07Break(ctx);

  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_XML_RULE.method,
    path: AM07_XML_RULE.path,
    headers: AM07_XML_CONTENT_TYPE,
    body: AM07_XML_BODY_INVALID,
    sampleName: AM07_XML_INVALID_SAMPLE,
  }));
  await am07Trace(ctx, am07TraceRowByText('xpath_equals'));
  await am07Trace(ctx, am07TraceRowByText('xmlSchema'), T.simOutcome);
  await closeAm07Simulate(ctx, { review: true });
  return outcomes;
}

/**
 * Step 7 — the firmware rule: pin the upload by its bytes, swap that for the digest a
 * build pipeline publishes, then prove that one changed character rejects it.
 */
export async function runAm07Binary(ctx: DemoActionContext): Promise<string[]> {
  if (!await focusAm07Rule(ctx, AM07_BINARY_RULE)) return [];
  const id = await addAm07BodyCondition(ctx, 'binary_exact');
  if (!id) return [];
  await am07Fill(ctx, API_MOCK.conditionValue(id), AM07_BINARY_BODY, T.payoff);
  await am07Break(ctx);

  await am07Select(ctx, API_MOCK.conditionOperator(id), 'binary_sha256');
  await am07Fill(ctx, API_MOCK.conditionValue(id), '');
  await am07Payoff(ctx, API_MOCK.conditionValue(id));
  await am07Fill(ctx, API_MOCK.conditionValue(id), AM07_BINARY_SHA256, T.payoff);
  await am07Break(ctx);

  const outcomes: string[] = [];
  await openAm07Simulate(ctx);
  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_BINARY_RULE.method,
    path: AM07_BINARY_RULE.path,
    headers: AM07_BINARY_CONTENT_TYPE,
    body: AM07_BINARY_BODY,
    sampleName: AM07_BINARY_SAMPLE,
  }));
  await am07Break(ctx);

  outcomes.push(await runAm07Simulation(ctx, {
    method: AM07_BINARY_RULE.method,
    path: AM07_BINARY_RULE.path,
    headers: AM07_BINARY_CONTENT_TYPE,
    body: AM07_BINARY_BODY_ALTERED,
    sampleName: AM07_BINARY_ALTERED_SAMPLE,
  }));
  await am07Trace(ctx, am07TraceRowByText('binary_sha256'), T.simOutcome);
  await closeAm07Simulate(ctx, { review: true });
  await am07Payoff(ctx, API_MOCK.ROUTE_EXPLORER);
  return outcomes;
}
