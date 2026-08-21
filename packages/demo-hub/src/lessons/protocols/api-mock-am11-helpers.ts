/**
 * AM-11 `am-11-templating` helpers — Dynamic Responses: templates, faker, and
 * Map body.
 *
 * Quiet corpus is one parameterized `GET /products/:id` answering a static JSON
 * object. Every helper is authored in the editor. The listener is started
 * quietly so Apply in the prove step is a hot-swap (AM-01 already taught Start).
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

/**
 * Same slower holds as AM-10, plus curriculum extras for Monaco completions
 * (2000ms), the faker preview (1500ms), the first broken-expression editor
 * hold (4500ms), and the diagnostic (3200ms).
 */
export const AM11_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  beforeOpen: 1400,
  lifecycle: 1600,
  journalWrite: 1400,
  completions: 2000,
  /** Hold the Browse helpers catalog so the grouped list can be read. */
  helpersCatalog: 2000,
  fakerPreview: 1500,
  /** First paint of `{{faker 'not.a.path'}}` in the editor — read the helper. */
  brokenExpression: 4500,
  templateError: 3200,
} as const;

const T = AM11_TIMING;

export const AM11_CORPUS_SAMPLE = 'am-gallery-templating';
export const AM11_PATH_TEMPLATE = '/products/:id';
export const AM11_PROVE_PATH = '/products/42?sku=RF-100';
export const AM11_STATIC_BODY = '{"id":"static","name":"Widget"}';
export const AM11_TENANT_KEY = 'tenant';
export const AM11_TENANT_VALUE = 'acme';
export const AM11_CONTENT_JSON = 'application/json';

export const AM11_ECHO_BODY = JSON.stringify({
  id: "{{pathParam 'id'}}",
  sku: "{{query 'sku'}}",
  tenant: "{{header 'x-tenant'}}",
  session: "{{cookie 'session'}}",
  itemSku: "{{jsonPath '$.items[0].sku'}}",
}, null, 2);

export const AM11_GENERATED_BODY = JSON.stringify({
  id: '{{uuid}}',
  issuedAt: '{{now}}',
  priority: "{{randomInt '1' '5'}}",
  lane: "{{oneOf 'fast' 'standard' 'bulk'}}",
}, null, 2);

export const AM11_REPEAT_BODY = JSON.stringify({
  pad: "{{repeat '24' 'xy'}}",
}, null, 2);

export const AM11_FAKER_BODY = JSON.stringify({
  firstName: "{{faker 'person.firstName'}}",
  email: "{{faker 'internet.email'}}",
}, null, 2);

export const AM11_VARIABLES_BODY = JSON.stringify({
  id: "{{pathParam 'id'}}",
  tenant: '{{variables.tenant}}',
  uuid: '{{uuid}}',
}, null, 2);

export const AM11_BROKEN_BODY = JSON.stringify({
  id: "{{pathParam 'id'}}",
  oops: "{{faker 'not.a.path'}}",
}, null, 2);

export const AM11_PROVE_HEADERS: Record<string, string> = {
  'x-tenant': 'acme',
  Cookie: 'session=abc',
};

export const AM11_PROVE_BODY = JSON.stringify({ items: [{ sku: 'RF-100' }] });

async function am11Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a tab, dock, or modal trigger before the click. */
async function am11Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am11Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am11Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = 8_000,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

/**
 * Open the Variables inspector without a second 1400ms aim on the live-strip
 * control the reading spotlight already rang. Cap the wait so Acting cannot
 * sit idle for revealBeat's 20s default when Runtime lands on another tab.
 */
async function openAm11VariablesDock(ctx: DemoActionContext): Promise<void> {
  const tab = firstVisibleElement(API_MOCK.DOCK_TAB_VARIABLES);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    await am11Click(ctx, API_MOCK.DOCK_TAB_VARIABLES, T.tabSwitch);
    await am11Reveal(ctx, API_MOCK.DOCK_VARIABLES);
    return;
  }
  if (firstVisibleElement(API_MOCK.DOCK_VARIABLES)) {
    await spotlightBeat(ctx, API_MOCK.DOCK_VARIABLES, T.panelReady);
    return;
  }
  if (!firstVisibleElement(API_MOCK.LIVE_VARIABLES)) return;
  await ctx.click(API_MOCK.LIVE_VARIABLES);
  await ctx.delay(T.tabSwitch);
  const tabAfter = firstVisibleElement(API_MOCK.DOCK_TAB_VARIABLES);
  if (tabAfter && tabAfter.getAttribute('aria-selected') !== 'true') {
    await am11Click(ctx, API_MOCK.DOCK_TAB_VARIABLES, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.DOCK_VARIABLES) || firstVisibleElement(API_MOCK.DOCK_TAB_VARIABLES)) {
    await am11Reveal(ctx, API_MOCK.DOCK_VARIABLES);
  }
}

async function am11Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am11Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am11Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

function patchBody(body: string): boolean {
  return patchApiMockActiveRoute({ body, contentType: AM11_CONTENT_JSON });
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm11Workspace(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm11RouteEditor(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EDITOR));
}

export function isAm11StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm11ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am11PreviewText(): string {
  return firstVisibleElement(API_MOCK.PREVIEW_BODY)?.textContent ?? '';
}

export function am11HasTemplateBadge(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.BODY_TEMPLATE_BADGE));
}

export function am11HasTemplateError(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.TEMPLATE_ERROR));
}

export function am11HasMapper(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.BODY_MAPPER) ?? document.querySelector(API_MOCK.BODY_MAPPER));
}

export function am11HasCompletions(): boolean {
  return Boolean(document.querySelector(API_MOCK.BODY_COMPLETIONS));
}

export function am11HasHelpersBrowse(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.TEMPLATE_HELPERS_BROWSE));
}

export function am11HasHelpersModal(): boolean {
  return Boolean(
    firstVisibleElement(API_MOCK.TEMPLATE_HELPERS_MODAL)
    ?? document.querySelector(API_MOCK.TEMPLATE_HELPERS_MODAL),
  );
}

/** Dismiss Browse helpers so the next spotlight is not behind the catalog. */
export async function closeAm11HelpersIfOpen(ctx: DemoActionContext, visible = false): Promise<void> {
  if (!am11HasHelpersModal()) return;
  const close = firstVisibleElement(API_MOCK.TEMPLATE_HELPERS_CLOSE)
    ?? document.querySelector<HTMLElement>(API_MOCK.TEMPLATE_HELPERS_CLOSE);
  if (!close) return;
  if (visible) {
    await clickBeat(ctx, API_MOCK.TEMPLATE_HELPERS_CLOSE, { look: T.look, hold: 700 });
    return;
  }
  await ctx.click(API_MOCK.TEMPLATE_HELPERS_CLOSE);
  await ctx.delay(200);
}

/** Open Browse helpers, hold the grouped catalog, search uuid, then Close. */
export async function runAm11HelpersCatalog(ctx: DemoActionContext): Promise<void> {
  if (!am11HasHelpersBrowse()) return;
  await am11Aim(ctx, API_MOCK.TEMPLATE_HELPERS_BROWSE);
  await am11Reveal(ctx, API_MOCK.TEMPLATE_HELPERS_MODAL, T.panelReady);
  await spotlightBeat(ctx, API_MOCK.templateHelpersGroup('request'), T.helpersCatalog);
  if (firstVisibleElement(API_MOCK.TEMPLATE_HELPERS_SEARCH)) {
    await am11Fill(ctx, API_MOCK.TEMPLATE_HELPERS_SEARCH, 'uuid');
    await am11Reveal(ctx, API_MOCK.templateHelpersRow('uuid'), T.payoff);
  }
  await closeAm11HelpersIfOpen(ctx, true);
}

export function am11VariableKeys(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      '[data-testid="api-mock-dock-variables"] input[data-testid^="api-mock-var-key-"]',
    ),
  ).map(input => input.value.trim());
}

export function am11HasTenantVariable(): boolean {
  return am11VariableKeys().includes(AM11_TENANT_KEY);
}

export function hasAm11Traffic(): boolean {
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return true;
  const chip = firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)
    ?? document.querySelector<HTMLElement>(API_MOCK.LIVE_TRANSACTIONS);
  const n = Number(chip?.querySelector('.am-count-badge')?.textContent?.trim());
  return Number.isFinite(n) && n > 0;
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    '[data-testid="api-mock-dock"] table tbody tr[data-testid^="api-mock-tx-"]',
  ));
}

// ── Monaco `{{` completions ─────────────────────────────────────────────────

type MonacoDemoEditor = {
  getDomNode?: () => HTMLElement | null;
  focus: () => void;
  getModel: () => { getLineCount: () => number; getLineMaxColumn: (n: number) => number } | null;
  setPosition: (p: { lineNumber: number; column: number }) => void;
  trigger: (source: string, handlerId: string, payload?: unknown) => void;
};

export function triggerAm11TemplateCompletions(): boolean {
  const wrap = document.querySelector<HTMLElement>(API_MOCK.VARIANT_BODY);
  if (!wrap) return false;
  const w = window as unknown as {
    monaco?: { editor: { getEditors: () => MonacoDemoEditor[] } };
  };
  const editors = w.monaco?.editor?.getEditors?.() ?? [];
  const editor = editors.find(e => {
    const node = e.getDomNode?.();
    return node ? wrap.contains(node) : false;
  }) ?? editors[0];
  if (editor) {
    editor.focus();
    const model = editor.getModel();
    if (model) {
      const line = model.getLineCount();
      editor.setPosition({ lineNumber: line, column: model.getLineMaxColumn(line) });
    }
    editor.trigger('keyboard', 'type', { text: '{{' });
    editor.trigger('keyboard', 'editor.action.triggerSuggest');
    return true;
  }
  const textarea = wrap.querySelector<HTMLTextAreaElement>('textarea');
  if (!textarea) return false;
  textarea.focus();
  textarea.value = `${textarea.value}{{`;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm11Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  const imported = await importApiMockGallerySample(AM11_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-11: failed to import ${AM11_CORPUS_SAMPLE}`);
  }
  prepareApiMockStudioChrome();
}

export async function cleanupAm11(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm11StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm11StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function closeAm11MapperIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!am11HasMapper()) return;
  const cancel = firstVisibleElement(API_MOCK.BODY_MAPPER_CANCEL)
    ?? document.querySelector<HTMLElement>(API_MOCK.BODY_MAPPER_CANCEL);
  if (cancel) {
    await ctx.click(API_MOCK.BODY_MAPPER_CANCEL);
    await ctx.delay(400);
  }
}

export async function ensureAm11Workspace(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm11StudioView(ctx);
  await closeAm11MapperIfOpen(ctx);
  await closeAm11HelpersIfOpen(ctx);
  if (!hasAm11Workspace()) {
    const imported = await importApiMockGallerySample(AM11_CORPUS_SAMPLE);
    if (!imported) {
      throw new Error(`AM-11: failed to import ${AM11_CORPUS_SAMPLE}`);
    }
    await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
  }
  await ensureAm11RuleOpen(ctx);
  await ensureAm11ResponseTab(ctx);
  await ensureAm11Running(ctx);
}

export async function ensureAm11RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm11StudioView(ctx);
  if (hasAm11RouteEditor()) return;
  const row = firstVisibleElement(API_MOCK.ROUTE_ROW) ?? firstVisibleElement(API_MOCK.FIRST_ROUTE);
  if (!row) return;
  await ctx.click(API_MOCK.ROUTE_ROW);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 6_000);
}

export async function ensureAm11ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm11RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.VARIANT_BODY)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.waitFor(API_MOCK.RESPONSE_EDITOR, 6_000);
}

export async function ensureAm11Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm11StudioView(ctx);
  if (isAm11ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm11EchoBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11Workspace(ctx);
  if (am11HasTemplateBadge() && am11PreviewText().includes('42')) return;
  patchBody(AM11_ECHO_BODY);
}

export async function ensureAm11GeneratedBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11Workspace(ctx);
  patchBody(AM11_GENERATED_BODY);
}

export async function ensureAm11RepeatBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11Workspace(ctx);
  patchBody(AM11_REPEAT_BODY);
}

export async function ensureAm11FakerBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11Workspace(ctx);
  patchBody(AM11_FAKER_BODY);
}

export async function ensureAm11TenantVariable(ctx: DemoActionContext): Promise<void> {
  await ensureAm11FakerBody(ctx);
  if (am11HasTenantVariable()) {
    await ensureAm11StudioView(ctx);
    await ensureAm11ResponseTab(ctx);
    return;
  }
  if (!firstVisibleElement(API_MOCK.DOCK_VARIABLES)) {
    if (!firstVisibleElement(API_MOCK.LIVE_VARIABLES)) return;
    await ctx.click(API_MOCK.LIVE_VARIABLES);
    await ctx.waitFor(API_MOCK.DOCK_VARIABLES, 8_000);
  }
  if (!firstVisibleElement(API_MOCK.VAR_ADD)) return;
  await ctx.click(API_MOCK.VAR_ADD);
  await ctx.waitFor(API_MOCK.VAR_KEY_LAST, 4_000);
  await ctx.fill(API_MOCK.VAR_KEY_LAST, AM11_TENANT_KEY);
  await ctx.fill(API_MOCK.VAR_VALUE_LAST, AM11_TENANT_VALUE);
  await ensureAm11StudioView(ctx);
  await ensureAm11ResponseTab(ctx);
}

export async function ensureAm11VariablesBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11TenantVariable(ctx);
  patchBody(AM11_VARIABLES_BODY);
}

export async function ensureAm11ForApply(ctx: DemoActionContext): Promise<void> {
  await ensureAm11VariablesBody(ctx);
  await ensureAm11Running(ctx);
}

export async function ensureAm11JournalOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ForApply(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) return;
  if (!firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS) && !firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    return;
  }
  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
  }
  if (!firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW) && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
  }
}

export async function ensureAm11ForMapBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11VariablesBody(ctx);
  await closeAm11MapperIfOpen(ctx);
  await ensureAm11StudioView(ctx);
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_STATIC_BODY);
}

export async function ensureAm11Mapped(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ForMapBody(ctx);
  await closeAm11MapperIfOpen(ctx);
}

export async function sendAm11ProveRequest(): Promise<{ status: number; body: string } | null> {
  return sendApiMockRequest({
    path: AM11_PROVE_PATH,
    method: 'GET',
    headers: AM11_PROVE_HEADERS,
    body: AM11_PROVE_BODY,
  });
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — type `{{`, hold completions, then Browse helpers and Close. */
export async function runAm11Completions(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ResponseTab(ctx);
  await closeAm11HelpersIfOpen(ctx);
  await am11Look(ctx, API_MOCK.VARIANT_BODY);
  await am11Click(ctx, API_MOCK.VARIANT_BODY, 0);
  triggerAm11TemplateCompletions();
  await ctx.delay(400);
  const completions = document.querySelector<HTMLElement>(API_MOCK.BODY_COMPLETIONS);
  if (completions) {
    await spotlightBeat(ctx, API_MOCK.BODY_COMPLETIONS, T.completions);
  } else {
    await spotlightBeat(ctx, API_MOCK.VARIANT_BODY, T.completions);
  }
  await am11Break(ctx);
  // bodyIsTemplate requires a complete {{helper}} expression; patch now so the
  // Browse button renders before runAm11HelpersCatalog checks for it.
  patchBody(AM11_ECHO_BODY);
  await ctx.delay(300);
  await runAm11HelpersCatalog(ctx);
}

/** Step 2 — echo path / query / header / cookie / jsonPath. */
export async function runAm11Echo(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_ECHO_BODY);
  await am11Reveal(ctx, API_MOCK.BODY_TEMPLATE_BADGE);
  await am11Payoff(ctx, API_MOCK.BODY_TEMPLATE_BADGE);
  await am11Break(ctx);
  await am11Look(ctx, API_MOCK.PREVIEW_SAMPLE);
  await am11Payoff(ctx, API_MOCK.PREVIEW_BODY);
}

/** Step 3 — uuid, now, randomInt, oneOf. */
export async function runAm11Generated(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ResponseTab(ctx);
  patchBody(JSON.stringify({ id: '{{uuid}}', issuedAt: '{{now}}' }, null, 2));
  await am11Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await am11Look(ctx, API_MOCK.PREVIEW_BODY);
  await am11Break(ctx);
  patchBody(AM11_GENERATED_BODY);
  await am11Payoff(ctx, API_MOCK.PREVIEW_BODY);
}

/** Step 4 — repeat grows the body. */
export async function runAm11Repeat(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_REPEAT_BODY);
  await am11Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await am11Look(ctx, API_MOCK.PREVIEW_BODY);
  await am11Payoff(ctx, API_MOCK.BODY_SIZE);
}

/** Step 5 — faker names and emails. */
export async function runAm11Faker(ctx: DemoActionContext): Promise<void> {
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_FAKER_BODY);
  await am11Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await spotlightBeat(ctx, API_MOCK.PREVIEW_BODY, T.fakerPreview);
}

/** Step 6 — add a server variable, then resolve it in the body. */
export async function runAm11Variables(ctx: DemoActionContext): Promise<void> {
  await openAm11VariablesDock(ctx);
  if (firstVisibleElement(API_MOCK.VAR_ADD)) {
    await am11Click(ctx, API_MOCK.VAR_ADD, 0);
    await am11Reveal(ctx, API_MOCK.VAR_KEY_LAST);
    await am11Fill(ctx, API_MOCK.VAR_KEY_LAST, AM11_TENANT_KEY);
    await am11Fill(ctx, API_MOCK.VAR_VALUE_LAST, AM11_TENANT_VALUE);
    await am11Payoff(ctx, API_MOCK.VAR_ROW);
  }
  await am11Break(ctx);

  await am11Aim(ctx, API_MOCK.VIEW_STUDIO, T.tabSwitch);
  await ensureAm11StudioView(ctx);
  await ensureAm11ResponseTab(ctx);
  await am11Reveal(ctx, API_MOCK.VARIANT_BODY);
  patchBody(AM11_VARIABLES_BODY);
  await am11Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await am11Payoff(ctx, API_MOCK.PREVIEW_BODY);
}

/** Step 7 — Apply, fetch twice, two different uuids. */
export async function runAm11ProveTwice(ctx: DemoActionContext): Promise<void> {
  await ensureAm11StudioView(ctx);
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am11Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am11Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
  await am11Look(ctx, API_MOCK.GENERATION);

  await sendAm11ProveRequest();
  await ctx.delay(T.journalWrite);
  await am11Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  await am11Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  await am11Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  const first = journalRows()[0];
  if (first) await ctx.click(`[data-testid="${first.getAttribute('data-testid')}"]`);
  await am11Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am11Look(ctx, API_MOCK.TX_RESPONSE);
  await am11Break(ctx);

  await sendAm11ProveRequest();
  await ctx.delay(T.journalWrite);
  const newest = journalRows()[0];
  if (newest) await ctx.click(`[data-testid="${newest.getAttribute('data-testid')}"]`);
  await am11Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  await am11Payoff(ctx, API_MOCK.TX_RESPONSE);
}

/** Step 8 — Map body: Auto-map request helpers onto JSON fields. */
export async function runAm11MapBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm11StudioView(ctx);
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_STATIC_BODY);
  await am11Reveal(ctx, API_MOCK.BODY_MAP);
  await am11Aim(ctx, API_MOCK.BODY_MAP);
  await am11Reveal(ctx, API_MOCK.BODY_MAPPER, T.panelReady);
  if (firstVisibleElement(API_MOCK.BODY_MAPPER_AUTOMAP)
    ?? document.querySelector(API_MOCK.BODY_MAPPER_AUTOMAP)) {
    await am11Aim(ctx, API_MOCK.BODY_MAPPER_AUTOMAP);
    await ctx.delay(T.payoff);
  }
  const apply = firstVisibleElement(API_MOCK.BODY_MAPPER_APPLY)
    ?? document.querySelector<HTMLElement>(API_MOCK.BODY_MAPPER_APPLY);
  if (apply) {
    await am11Aim(ctx, API_MOCK.BODY_MAPPER_APPLY);
  }
  await ctx.delay(T.groupBreak);
  await am11Payoff(ctx, API_MOCK.VARIANT_BODY);
}

/** Step 9 — broken helper reported, then cleared. */
export async function runAm11TemplateError(ctx: DemoActionContext): Promise<void> {
  await closeAm11MapperIfOpen(ctx);
  await ensureAm11StudioView(ctx);
  await ensureAm11ResponseTab(ctx);
  patchBody(AM11_BROKEN_BODY);
  await am11Reveal(ctx, API_MOCK.VARIANT_BODY);
  await spotlightBeat(ctx, API_MOCK.VARIANT_BODY, T.brokenExpression);
  await am11Reveal(ctx, API_MOCK.DIAG_TEMPLATE_ERRORS);
  await spotlightBeat(ctx, API_MOCK.DIAG_TEMPLATE_ERRORS, T.templateError);
  await am11Look(ctx, API_MOCK.PREVIEW_BODY);
  await am11Break(ctx);
  patchBody(AM11_VARIABLES_BODY);
  await am11Reveal(ctx, API_MOCK.PREVIEW_BODY);
  await am11Payoff(ctx, API_MOCK.PREVIEW_BODY);
}
