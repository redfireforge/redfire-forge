/**
 * AM-24 `am-24-capstone` helpers — Ship a Contract Mock.
 *
 * Quiet corpus is none: a blank server and an empty named workflow. Every
 * beat is authored live from an OpenAPI paste through Simulate, journal,
 * export, and a Quick Test. Companion required. No Docker.
 */
import {
  addWorkflowNodeWithPreset,
  clearApiMockServerSamples,
  connectWorkflowNodes,
  deleteWorkflowByName,
  removeWorkflowEdge,
  ensureBlankApiMockServer,
  patchApiMockActiveRoute,
  patchWorkflowNodeDataById,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  triggerWorkflowQuickTest,
  upsertApiMockServerSamples,
  wipeApiMockWorkspace,
  type ApiMockDemoPredicate,
  type ApiMockDemoPredicateGroup,
} from '../../adapters';
import { API_MOCK, WF } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  clearApiMockWfServerPicker,
  fillBeat,
  openApiMockFromActivityBar,
  prettyFormatImportPaste,
  revealBeat,
  resolveApiMockStudioServerId,
  reviewAndRunSimulation,
  closeSimulateWorkspace,
  spotlightBeat,
  ensureAdHocSimulateForm,
  waitForApiMockStudioServerId,
  waitForApiMockWfServerReady,
} from './api-mock-demo-helpers';
import {
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  closeWfSamplePreviewIfOpen,
  collapseWfDemoAppSidebar,
  ensureLessonBlankWorkflow,
  fillWfConfigField,
  fitWfCanvasQuiet,
  holdWfSpotlight,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  revealPaletteBlock,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  waitForWfConfigPanel,
  clickWfConfigControl,
} from '../wf-demo-helpers';

/** Ship authors two exports + four Workflow config modals — over the 45s default. */
export const AM24_SHIP_ACTION_TIMEOUT_MS = 240_000;
/** Suite may need to author + save a sample before running all — over the 45s default. */
export const AM24_SUITE_ACTION_TIMEOUT_MS = 90_000;

export const AM24_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  beforeOpen: 1400,
  lifecycle: 1600,
  journalWrite: 1400,
  simOutcome: 1800,
  beforeRun: 2400,
  generate: 2000,
  /** Hold the Import review so the viewer can read folder, routes, and loss. */
  reviewModal: 2400,
} as const;

const T = AM24_TIMING;
const REVEAL_MS = 8_000;

export const AM24_SERVER_ID = 'srv-blank';
export const AM24_SERVER_NAME = 'Import sandbox';
export const AM24_WF_NAME = 'Ship contract mock';
export const AM24_ORDERS_PATH = '/orders';
export const AM24_HEALTH_PATH = '/health';
export const AM24_ITEM_PATH = '/orders/:id';
export const AM24_ITEM_OPENAPI_PATH = '/orders/{id}';
export const AM24_HIT_PATH = '/orders/42';
export const AM24_MISS_PATH = '/ordrs/42';
export const AM24_SKU = 'WIDGET';
export const AM24_SKU_MISSING = 'MISSING';
export const AM24_JSONPATH = '$.sku';
export const AM24_PRIORITY = '20';
export const AM24_DELAY = '200';
export const AM24_PROBABILITY = '1';
export const AM24_VARIANT_NAME = 'Not found';
export const AM24_SKU_FLAKY = 'FLAKY';
export const AM24_FLAKY_VARIANT_NAME = 'Degraded';
export const AM24_FLAKY_STATUS = '503';
export const AM24_FAULT_PROBABILITY = '0';
export const AM24_CONTENT_JSON = 'application/json';
export const AM24_HTTP_URL = '{{mockBaseUrl}}/orders';
export const AM24_HTTP_METHOD = 'POST';
export const AM24_ASSERT_MIN = '1';
export const AM24_ASSERT_STATUS = '201';
export const AM24_ASSERT_BODY = 'sku';
export const AM24_ASSERT_RECENCY = '10000';
export const AM24_ISOLATED_SERVER = '{{mockServerId}}';
export const AM24_SAMPLE_NAME = 'POST /orders WIDGET';
export const AM24_SAMPLE_NAME_MISSING = 'POST /orders - MISSING';
export const AM24_SAMPLE_NAME_FLAKY = 'POST /orders FLAKY';

export const AM24_OPENAPI = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Orders API', version: '1.0.0' },
  paths: {
    '/orders': {
      post: {
        operationId: 'createOrder',
        summary: 'Create an order',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { sku: { type: 'string' }, qty: { type: 'integer' } },
              },
            },
          },
        },
        responses: { '201': { description: 'created' } },
      },
    },
    '/orders/{id}': {
      get: {
        operationId: 'getOrder',
        summary: 'Get an order',
        responses: { '200': { description: 'ok' } },
      },
    },
  },
});

export const AM24_MATCH_BODY = JSON.stringify({ sku: AM24_SKU, qty: 1 });
export const AM24_MISS_BODY = JSON.stringify({ sku: AM24_SKU_MISSING, qty: 1 });
export const AM24_FLAKY_REQ_BODY = JSON.stringify({ sku: AM24_SKU_FLAKY, qty: 1 });
export const AM24_FAKER_BODY = JSON.stringify({
  id: '{{uuid}}',
  sku: "{{jsonPath '$.sku'}}",
  buyer: "{{faker 'person.firstName'}}",
  email: "{{faker 'internet.email'}}",
}, null, 2);
export const AM24_ERR_BODY = JSON.stringify({ error: 'not_found', sku: AM24_SKU_MISSING });
export const AM24_FLAKY_BODY = JSON.stringify({ error: 'unavailable', sku: AM24_SKU_FLAKY });

export const AM24_NODE = {
  start: 'am24-start',
  http: 'am24-http',
  assert: 'am24-assert',
  stop: 'am24-stop',
} as const;

const POS = {
  start: { x: 280, y: 180 },
  http: { x: 280, y: 330 },
  assert: { x: 280, y: 480 },
  stop: { x: 280, y: 630 },
};

const AM24_CHAIN = [
  WF.NODE_START,
  API_MOCK.CANVAS_START,
  WF.NODE_HTTP,
  API_MOCK.CANVAS_ASSERT,
  API_MOCK.CANVAS_STOP,
] as const;

const JSONPATH_PREDICATE: ApiMockDemoPredicate = {
  id: 'pred-am24-sku',
  source: 'body',
  selector: '',
  operator: 'jsonPath_equals',
  expected: [AM24_JSONPATH, AM24_SKU],
};

const ROOT_GROUP: ApiMockDemoPredicateGroup = {
  id: 'pg-am24-root',
  combinator: 'all',
  children: [JSONPATH_PREDICATE],
};

// Route predicate used from step 4 onwards — no body condition so all SKUs
// (WIDGET, MISSING, FLAKY) can reach the route and be differentiated by
// variant-level conditions (NOT_FOUND_CONDITIONS, DEGRADED_CONDITIONS).
// Step 2 demonstrates the WIDGET predicate, then this clears it so the
// variant conditions actually work.
const OPEN_GROUP: ApiMockDemoPredicateGroup = {
  id: 'pg-am24-root',
  combinator: 'all',
  children: [],
};

const NOT_FOUND_CONDITIONS: ApiMockDemoPredicateGroup = {
  id: 'pg-am24-404',
  combinator: 'all',
  children: [{
    id: 'pred-am24-missing',
    source: 'body',
    selector: '',
    operator: 'jsonPath_equals',
    expected: [AM24_JSONPATH, AM24_SKU_MISSING],
  }],
};

const DEGRADED_CONDITIONS: ApiMockDemoPredicateGroup = {
  id: 'pg-am24-503',
  combinator: 'all',
  children: [{
    id: 'pred-am24-flaky',
    source: 'body',
    selector: '',
    operator: 'jsonPath_equals',
    expected: [AM24_JSONPATH, AM24_SKU_FLAKY],
  }],
};

function patchAm24Orders(
  patch: Parameters<typeof patchApiMockActiveRoute>[0],
): boolean {
  return patchApiMockActiveRoute({
    selectMethod: 'POST',
    selectPath: AM24_ORDERS_PATH,
    ...patch,
  });
}

function patchAm24Health(
  patch: Parameters<typeof patchApiMockActiveRoute>[0],
): boolean {
  return patchApiMockActiveRoute({
    selectMethod: 'GET',
    selectPath: AM24_HEALTH_PATH,
    ...patch,
  });
}

function am24HealthRows(): HTMLElement[] {
  return am24RouteRows().filter(row => rowPath(row) === AM24_HEALTH_PATH && rowMethod(row) === 'GET');
}

function am24StrayRootRows(): HTMLElement[] {
  return am24RouteRows().filter(row => rowPath(row) === '/' && rowMethod(row) === 'GET');
}

async function am24Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am24ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am24FillNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: 0, hold });
}

async function am24AimFill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am24Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am24Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am24Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am24Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

function inputValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

/** Resolve a live simulate sample's remapped id from its visible name in the sidebar. */
function resolveAm24SampleId(name: string): string | undefined {
  const rows = document.querySelectorAll<HTMLElement>('.am-sim-sample');
  for (const row of rows) {
    const label = row.querySelector('.am-sim-sample-name')?.textContent?.trim();
    if (label !== name) continue;
    const id = (row.getAttribute('data-testid') ?? '').replace('api-mock-sim-sample-', '');
    if (id) return id;
  }
  return undefined;
}

function checkboxChecked(selector: string): boolean {
  const el = firstVisibleElement<HTMLInputElement>(selector);
  return Boolean(el?.checked);
}

export function hasAm24Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function isAm24StudioActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm24RuntimeViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.RUNTIME_PAGE) ?? firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS));
}

export function isAm24ImportOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.IMPORT_REVIEW));
}

export function isAm24SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function isAm24ExportConfirmOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_CONFIRM));
}

export function isAm24ExportMenuOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_MENU));
}

export function isAm24DesignerActive(): boolean {
  return Boolean(firstVisibleElement(WF.DESIGNER) || firstVisibleElement(WF.CANVAS));
}

export function am24DraftRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.DRAFT_ROUTE));
}

export function am24DraftCount(): number {
  return am24DraftRows().length;
}

export function hasAm24Draft(): boolean {
  return am24DraftCount() >= 1;
}

export function am24RouteRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

function rowPath(row: HTMLElement): string {
  return row.querySelector('.am-route-path')?.textContent?.trim() ?? '';
}

function rowMethod(row: HTMLElement): string {
  return row.querySelector('.am-method')?.textContent?.trim().toUpperCase() ?? '';
}

function isDraftRow(row: HTMLElement): boolean {
  return row.classList.contains('disabled');
}

export function am24FindRoute(path: string, method?: string, enabled?: boolean): HTMLElement | undefined {
  return am24RouteRows().find(row => {
    if (rowPath(row) !== path) return false;
    if (method && rowMethod(row) !== method) return false;
    if (enabled === true && isDraftRow(row)) return false;
    if (enabled === false && !isDraftRow(row)) return false;
    return true;
  });
}

export function hasAm24EnabledOrders(): boolean {
  return Boolean(am24FindRoute(AM24_ORDERS_PATH, 'POST', true));
}

export function isAm24RouteEnabled(): boolean {
  const title = firstVisibleElement(API_MOCK.ROUTE_ENABLED)?.getAttribute('title') ?? '';
  return title.toLowerCase().includes('disable');
}

export function hasAm24JsonPath(): boolean {
  return Array.from(document.querySelectorAll('[data-testid^="api-mock-condition-"]'))
    .some(row => (row.getAttribute('data-testid') ?? '').includes('pred-am24')
      || (row.textContent ?? '').includes(AM24_JSONPATH)
      || (row.textContent ?? '').includes('jsonPath'));
}

export function hasAm24FakerBody(): boolean {
  const preview = firstVisibleElement(API_MOCK.PREVIEW_BODY)?.textContent ?? '';
  const editor = firstVisibleElement(API_MOCK.VARIANT_BODY)?.textContent ?? '';
  return preview.includes('faker') || editor.includes('faker') || preview.includes('buyer');
}

export function am24VariantCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.VARIANT_CARD));
}

export function hasAm24NotFoundVariant(): boolean {
  return am24VariantCards().some(card => {
    const text = card.textContent ?? '';
    return text.includes('404') || text.includes(AM24_VARIANT_NAME);
  });
}

export function hasAm24DegradedVariant(): boolean {
  return am24VariantCards().some(card => {
    const text = card.textContent ?? '';
    return text.includes(AM24_FLAKY_STATUS) || text.includes(AM24_FLAKY_VARIANT_NAME);
  });
}

export function hasAm24Delay(): boolean {
  return inputValue(API_MOCK.VARIANT_DELAY) === AM24_DELAY;
}

export function hasAm24Finding(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.FIRST_FINDING));
}

export function hasAm24ConflictsClean(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.CONFLICT_FILTER_EMPTY))
    || (Boolean(firstVisibleElement(API_MOCK.CONFLICT_SUMMARY)) && !hasAm24Finding());
}

export function hasAm24Sample(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_SECTION_SAVED));
}

function hasAm24NamedSample(name: string): boolean {
  return Boolean(resolveAm24SampleId(name));
}

function hasAm24ContractSamples(): boolean {
  return hasAm24NamedSample(AM24_SAMPLE_NAME)
    && hasAm24NamedSample(AM24_SAMPLE_NAME_MISSING)
    && hasAm24NamedSample(AM24_SAMPLE_NAME_FLAKY);
}

function am24ContractSampleDrafts() {
  return [
    {
      name: AM24_SAMPLE_NAME,
      method: 'POST',
      path: AM24_ORDERS_PATH,
      body: AM24_MATCH_BODY,
      contentType: AM24_CONTENT_JSON,
      expected: { outcome: 'matched' as const, status: 201 },
    },
    {
      name: AM24_SAMPLE_NAME_MISSING,
      method: 'POST',
      path: AM24_ORDERS_PATH,
      body: AM24_MISS_BODY,
      contentType: AM24_CONTENT_JSON,
      expected: { outcome: 'matched' as const, status: 404, bodyContains: 'not_found' },
    },
    {
      name: AM24_SAMPLE_NAME_FLAKY,
      method: 'POST',
      path: AM24_ORDERS_PATH,
      body: AM24_FLAKY_REQ_BODY,
      contentType: AM24_CONTENT_JSON,
      expected: { outcome: 'matched' as const, status: 503, bodyContains: 'unavailable' },
    },
  ];
}

function upsertAm24ContractSamples(): boolean {
  return upsertApiMockServerSamples(am24ContractSampleDrafts());
}

export function hasAm24Summary(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_SUMMARY));
}

export function am24ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function hasAm24JournalRow(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function hasAm24Start(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_START));
}

export function hasAm24Http(): boolean {
  return Boolean(document.querySelector(WF.NODE_HTTP));
}

export function hasAm24Assert(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_ASSERT));
}

export function hasAm24Stop(): boolean {
  return Boolean(document.querySelector(API_MOCK.CANVAS_STOP));
}

export function am24PassSelector(canvasSel: string): string {
  return `${canvasSel}.wf-node-pass`;
}

export function hasAm24Pass(selector: string = API_MOCK.CANVAS_ASSERT): boolean {
  return Boolean(document.querySelector(am24PassSelector(selector)));
}

export function am24CanvasNodeId(selector: string): string | null {
  const el = document.querySelector(selector);
  return el?.closest('.react-flow__node')?.getAttribute('data-id')
    ?? el?.getAttribute('data-id')
    ?? null;
}

function isAm24IsolateOn(): boolean {
  const el = firstVisibleElement(API_MOCK.WF_ISOLATE);
  return el?.getAttribute('aria-checked') !== 'false';
}

async function dismissWfOnboarding(ctx: DemoActionContext): Promise<void> {
  const skip = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (!skip) return;
  skip.click();
  await ctx.delay(300);
}

/** Close leftover Import / Export / Simulate chrome — wipe does not unmount those modals. */
export function dismissAm24Overlays(): void {
  document.querySelector<HTMLElement>(API_MOCK.EXPORT_CLOSE)?.click();
  document.querySelector<HTMLElement>(API_MOCK.IMPORT_CLOSE)?.click();
  document.querySelector<HTMLElement>(API_MOCK.IMPORT_CANCEL)?.click();
  document.querySelector<HTMLElement>(API_MOCK.SIMULATE_CLOSE)?.click();
}

export async function prepareAm24Workspace(): Promise<void> {
  dismissAm24Overlays();
  clearApiMockServerSamples();
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const blank = await ensureBlankApiMockServer();
  if (!blank) {
    throw new Error('AM-24: failed to create a blank mock server');
  }
}

export async function cleanupAm24(): Promise<void> {
  dismissAm24Overlays();
  clearApiMockServerSamples();
  deleteWorkflowByName(AM24_WF_NAME);
  await wipeApiMockWorkspace();
}

/** Step 1 reading guard — do not wipe or recreate. That empty→sandbox hop was the boot flash. */
export async function ensureAm24ForImport(_ctx: DemoActionContext): Promise<void> {
  dismissAm24Overlays();
  prepareApiMockStudioChrome();
  if (hasAm24Server()) return;
  await ensureBlankApiMockServer();
}

export async function ensureAm24OnStudio(ctx: DemoActionContext): Promise<void> {
  if (isAm24StudioActive()) return;
  if (await openApiMockFromActivityBar(ctx)) return;
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

export async function ensureAm24StudioView(ctx: DemoActionContext): Promise<void> {
  await ensureAm24OnStudio(ctx);
  if (isAm24StudioActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, REVEAL_MS).catch(() => undefined);
}

export async function ensureAm24OnDesigner(ctx: DemoActionContext): Promise<void> {
  if (isAm24DesignerActive()) return;
  ctx.navigateToTab('workflow');
  await ctx.delay(200);
}

export async function closeAm24Import(ctx: DemoActionContext): Promise<void> {
  if (!isAm24ImportOpen()) return;
  const close = firstVisibleElement(API_MOCK.IMPORT_CLOSE) ?? firstVisibleElement(API_MOCK.IMPORT_CANCEL);
  if (!close) return;
  await ctx.click(API_MOCK.IMPORT_CLOSE);
  await ctx.delay(400);
}

export async function closeAm24Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm24SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 400 });
}

async function closeAm24Export(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!isAm24ExportConfirmOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT_CLOSE)) return;
  if (visible) await am24ClickNow(ctx, API_MOCK.EXPORT_CLOSE, T.panelReady);
  else await ctx.click(API_MOCK.EXPORT_CLOSE);
  await ctx.delay(visible ? 700 : 200);
}

async function clickRouteRow(
  ctx: DemoActionContext,
  row: HTMLElement | undefined,
  visible: boolean,
): Promise<void> {
  const testid = row?.getAttribute('data-testid');
  if (!testid) return;
  const selector = `[data-testid="${testid}"]`;
  if (visible) await am24ClickNow(ctx, selector, 0);
  else await ctx.click(selector);
}

async function selectHealthRoute(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am24FindRoute(AM24_HEALTH_PATH, 'GET', true)
    ?? am24FindRoute(AM24_HEALTH_PATH, 'GET')
    ?? am24FindRoute(AM24_HEALTH_PATH);
  await clickRouteRow(ctx, row, visible);
  if (row && !firstVisibleElement(API_MOCK.ROUTE_EDITOR)) {
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, REVEAL_MS).catch(() => undefined);
  }
}

async function selectOrdersRoute(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am24FindRoute(AM24_ORDERS_PATH, 'POST', true)
    ?? am24FindRoute(AM24_ORDERS_PATH, 'POST')
    ?? am24FindRoute(AM24_ORDERS_PATH);
  await clickRouteRow(ctx, row, visible);
  await waitUntilOrdersRouteActive(ctx);
  if (!firstVisibleElement(API_MOCK.ROUTE_EDITOR)) {
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, REVEAL_MS).catch(() => undefined);
  }
}

function am24FindGetItemRoute(enabled?: boolean): HTMLElement | undefined {
  return am24FindRoute(AM24_ITEM_OPENAPI_PATH, 'GET', enabled)
    ?? am24FindRoute(AM24_ITEM_PATH, 'GET', enabled);
}

async function selectGetItemRoute(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am24FindGetItemRoute(true)
    ?? am24FindGetItemRoute(false)
    ?? am24FindGetItemRoute();
  await clickRouteRow(ctx, row, visible);
  if (row && !firstVisibleElement(API_MOCK.ROUTE_EDITOR)) {
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, REVEAL_MS).catch(() => undefined);
  }
}

/** Enable GET /orders/{id} the same way a user does: the list Draft/On chip
 *  (or the editor Enable toggle). `{id}` matching is the engine; this only
 *  flips `enabled` so the listener is allowed to answer. */
async function enableGetOrderIdFromUi(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm24StudioView(ctx);
  if (!am24FindGetItemRoute(true)) {
    await selectGetItemRoute(ctx, visible);
    const chip = firstVisibleElement(API_MOCK.ROUTE_LIST_ENABLE);
    if (chip && chip.getAttribute('aria-pressed') !== 'true') {
      if (visible) await am24Aim(ctx, API_MOCK.ROUTE_LIST_ENABLE, T.payoff);
      else await ctx.click(API_MOCK.ROUTE_LIST_ENABLE);
      await ctx.delay(200);
    } else if (!isAm24RouteEnabled() && firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
      if (visible) await am24Aim(ctx, API_MOCK.ROUTE_ENABLED, T.payoff);
      else await ctx.click(API_MOCK.ROUTE_ENABLED);
      await ctx.delay(200);
    }
  }
  // Reconstruct Enable for Rapid Next / missing explorer (same field the chip writes).
  for (const path of [AM24_ITEM_OPENAPI_PATH, AM24_ITEM_PATH]) {
    patchApiMockActiveRoute({
      selectPath: path,
      selectMethod: 'GET',
      enabled: true,
    });
  }
  await ctx.delay(200);
  await applyIfDirty(ctx);
}

/** Rapid-Next reconstruction of Enable on GET /orders/{id}. */
async function quietEnableGetOrderId(ctx: DemoActionContext): Promise<void> {
  await enableGetOrderIdFromUi(ctx, false);
}

async function waitUntilOrdersRouteActive(ctx: DemoActionContext): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const current = am24FindRoute(AM24_ORDERS_PATH, 'POST', true)
      ?? am24FindRoute(AM24_ORDERS_PATH, 'POST')
      ?? am24FindRoute(AM24_ORDERS_PATH);
    if (current?.classList.contains('active')) return;
    await ctx.delay(50);
  }
}

async function ensureAm24RuleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  const ordersRow = am24FindRoute(AM24_ORDERS_PATH, 'POST', true)
    ?? am24FindRoute(AM24_ORDERS_PATH, 'POST')
    ?? am24FindRoute(AM24_ORDERS_PATH);
  // Return early only when POST /orders is the rule in the editor. After Conflicts,
  // a health route may be selected; patching then would write 404/timeout onto the
  // wrong rule and leave orders as the OpenAPI 200 default.
  if (ordersRow?.classList.contains('active') && firstVisibleElement(API_MOCK.ROUTE_EDITOR)) return;
  await selectOrdersRoute(ctx, false);
}

async function ensureAm24MatchTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm24RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.ADD_CONDITION) || firstVisibleElement(API_MOCK.PATH_TOOLBOX)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_MATCH)) return;
  await ctx.click(API_MOCK.BTAB_MATCH);
  await ctx.delay(200);
}

async function ensureAm24ResponseTab(ctx: DemoActionContext): Promise<void> {
  await ensureAm24RuleOpen(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_BAR) ?? firstVisibleElement(API_MOCK.ADD_VARIANT)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_RESPONSE)) return;
  await ctx.click(API_MOCK.BTAB_RESPONSE);
  await ctx.delay(200);
}

export async function ensureAm24Server(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm24StudioView(ctx);
  if (hasAm24Server()) return;
  const created = await ensureBlankApiMockServer();
  if (created) {
    await ctx.waitFor(API_MOCK.SERVER_BAR, REVEAL_MS).catch(() => undefined);
  }
}

async function openAm24Import(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm24Server(ctx);
  if (isAm24ImportOpen()) return;
  if (!firstVisibleElement(API_MOCK.IMPORT_MENU)) return;
  if (visible) {
    await am24ClickNow(ctx, API_MOCK.IMPORT_MENU, T.fieldFilled);
    await am24Reveal(ctx, API_MOCK.IMPORT_REVIEW);
  } else {
    await ctx.click(API_MOCK.IMPORT_MENU);
    await ctx.waitFor(API_MOCK.IMPORT_REVIEW, REVEAL_MS).catch(() => undefined);
  }
}

async function selectOpenApiSource(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await openAm24Import(ctx, visible);
  const selector = API_MOCK.importSource('openapi');
  if (!firstVisibleElement(selector)) return;
  if (firstVisibleElement(selector)?.classList.contains('active')) return;
  if (visible) await am24Aim(ctx, selector);
  else await ctx.click(selector);
  await ctx.delay(visible ? T.panelReady : 200);
}

async function quietParseOpenApi(ctx: DemoActionContext): Promise<void> {
  await selectOpenApiSource(ctx, false);
  if (firstVisibleElement(API_MOCK.IMPORT_PASTE)) {
    await ctx.fill(API_MOCK.IMPORT_PASTE, AM24_OPENAPI);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_ROUTE_LIST, REVEAL_MS).catch(() => undefined);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_GENERALIZE) && !checkboxChecked(API_MOCK.IMPORT_GENERALIZE)) {
    await ctx.click(API_MOCK.IMPORT_GENERALIZE);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await ctx.click(API_MOCK.IMPORT_CONFIRM);
    await ctx.delay(500);
  }
  await closeAm24Import(ctx);
}

async function quietEnableOrders(ctx: DemoActionContext): Promise<void> {
  await closeAm24Import(ctx);
  await selectOrdersRoute(ctx, false);
  if (!isAm24RouteEnabled() && firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await ctx.click(API_MOCK.ROUTE_ENABLED);
    await ctx.delay(200);
  }
}

async function applyIfDirty(ctx: DemoActionContext): Promise<void> {
  // Apply only exists while the listener is running *and* the draft differs.
  // Wait for the button after a quiet patch so we don't fire traffic against
  // the pre-patch snapshot.
  if (am24ServerRunning()) {
    await ctx.waitFor(API_MOCK.APPLY, T.lifecycle).catch(() => undefined);
  }
  if (!firstVisibleElement(API_MOCK.APPLY)) return;
  await ctx.click(API_MOCK.APPLY);
  await ctx.delay(T.lifecycle);
}

async function quietJsonPath(ctx: DemoActionContext): Promise<void> {
  await ensureAm24RuleOpen(ctx);
  patchAm24Orders({ predicates: ROOT_GROUP });
}

async function quietFakerBody(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ResponseTab(ctx);
  patchAm24Orders({
    body: AM24_FAKER_BODY,
    contentType: AM24_CONTENT_JSON,
    status: 201,
  });
}

function applyAm24NotFoundCondition(): void {
  patchAm24Orders({
    variantIndex: 1,
    variantConditions: NOT_FOUND_CONDITIONS,
    isDefault: false,
  });
}

async function quietNotFoundVariant(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ResponseTab(ctx);
  if (!(hasAm24NotFoundVariant() && am24VariantCards().length >= 2)) {
    patchAm24Orders({ addVariant: true });
    patchAm24Orders({
      variantIndex: 1,
      variantName: AM24_VARIANT_NAME,
      status: 404,
      body: AM24_ERR_BODY,
      contentType: AM24_CONTENT_JSON,
      isDefault: false,
      variantConditions: NOT_FOUND_CONDITIONS,
    });
  } else {
    applyAm24NotFoundCondition();
  }
  patchAm24Orders({ variantIndex: 0, isDefault: true, responseMode: 'rules' });
  // Clear the route-level body predicate (set in step 2 to demonstrate $.sku == WIDGET).
  // From step 4 onwards, variant conditions (MISSING/FLAKY) do the differentiation.
  // Keeping the route predicate would block those SKUs before variant conditions are evaluated.
  patchAm24Orders({ predicates: OPEN_GROUP });
}

function applyAm24DegradedCondition(): void {
  patchAm24Orders({
    variantIndex: 2,
    variantConditions: DEGRADED_CONDITIONS,
    isDefault: false,
  });
}

async function quietDegradedVariant(ctx: DemoActionContext): Promise<void> {
  await quietNotFoundVariant(ctx);
  if (!(hasAm24DegradedVariant() && am24VariantCards().length >= 3)) {
    patchAm24Orders({ addVariant: true });
    patchAm24Orders({
      variantIndex: 2,
      variantName: AM24_FLAKY_VARIANT_NAME,
      status: Number(AM24_FLAKY_STATUS),
      body: AM24_FLAKY_BODY,
      contentType: AM24_CONTENT_JSON,
      isDefault: false,
      variantConditions: DEGRADED_CONDITIONS,
    });
  } else {
    applyAm24DegradedCondition();
  }
  patchAm24Orders({ variantIndex: 0, isDefault: true, responseMode: 'rules' });
}

async function quietDelayAndFault(ctx: DemoActionContext): Promise<void> {
  await quietDegradedVariant(ctx);
  // Happy path (201): a latency, never a transport fault.
  patchAm24Orders({
    variantIndex: 0,
    behavior: { delayMs: Number(AM24_DELAY), probability: 1 },
  });
  // The 404 (variant 1) stays a clean contract response — no fault.
  // The degraded branch (variant 2) returns a clean 503 — no transport fault.
  // To simulate hangs, the viewer can later add a timeout fault manually.
  patchAm24Orders({
    variantIndex: 2,
    behavior: { delayMs: 0, jitterMs: 0, probability: 1 },
  });
}

async function quietRemoveStrayRootRoutes(): Promise<void> {
  const stray = am24StrayRootRows().length;
  for (let i = 0; i < stray; i++) {
    patchApiMockActiveRoute({
      removeRoute: true,
      selectPath: '/',
      selectMethod: 'GET',
    });
  }
}

async function quietOverlap(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  await quietRemoveStrayRootRoutes();
  // Read counts from DOM once before any patches — DOM is accurate at this point.
  const haveHealth = am24HealthRows().length;
  // Remove excess (> 2) then add shortfall (< 2).
  for (let i = haveHealth; i > 2; i--) {
    patchApiMockActiveRoute({
      removeRoute: true,
      selectPath: AM24_HEALTH_PATH,
      selectMethod: 'GET',
    });
  }
  for (let i = haveHealth; i < 2; i++) {
    patchApiMockActiveRoute({
      addRoute: true,
      path: AM24_HEALTH_PATH,
      method: 'GET',
      selectMethod: 'GET',
    });
  }
}

async function quietAnalyze(ctx: DemoActionContext): Promise<void> {
  await closeAm24Simulate(ctx);
  await ensureAm24StudioView(ctx);
  if (hasAm24Finding() || hasAm24ConflictsClean()) return;
  if (firstVisibleElement(API_MOCK.ANALYZE)) {
    await ctx.click(API_MOCK.ANALYZE);
    await ctx.delay(400);
  } else if (firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) {
    await ctx.click(API_MOCK.VIEW_CONFLICTS);
    await ctx.delay(400);
  }
  if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
    await ctx.click(API_MOCK.CONFLICTS_ANALYZE);
    await ctx.delay(400);
  }
}

async function quietFixPriority(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  await selectHealthRoute(ctx, false);
  if (firstVisibleElement(API_MOCK.PRIORITY_INPUT) && inputValue(API_MOCK.PRIORITY_INPUT) !== AM24_PRIORITY) {
    await ctx.fill(API_MOCK.PRIORITY_INPUT, AM24_PRIORITY);
  }
  patchAm24Health({ priority: Number(AM24_PRIORITY) });
}

async function openAm24Simulate(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm24StudioView(ctx);
  if (isAm24SimulateOpen()) return;
  if (!firstVisibleElement(API_MOCK.SIMULATE)) return;
  if (visible) {
    await am24Aim(ctx, API_MOCK.SIMULATE);
    await am24Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
  } else {
    await ctx.click(API_MOCK.SIMULATE);
    await ctx.waitFor(API_MOCK.SIMULATE_WORKSPACE, REVEAL_MS).catch(() => undefined);
  }
}

async function runOrdersSimulation(
  ctx: DemoActionContext,
  body: string,
  name: string,
  opts: {
    saveSample?: boolean;
    formHold?: number;
    fieldHold?: number;
    reviewHold?: number;
    beforeRunHold?: number;
  } = {},
): Promise<void> {
  const formHold = opts.formHold ?? T.tabSwitch;
  const fieldHold = opts.fieldHold ?? T.simOutcome;
  const reviewHold = opts.reviewHold ?? T.payoff;
  const beforeRunHold = opts.beforeRunHold ?? T.beforeRun;
  await ensureAdHocSimulateForm(ctx, formHold);
  if (firstVisibleElement(API_MOCK.SIMULATE_METHOD)) {
    await ctx.selectOption(API_MOCK.SIMULATE_METHOD, 'POST').catch(() => undefined);
  }
  if (inputValue(API_MOCK.SIMULATE_PATH) !== AM24_ORDERS_PATH && firstVisibleElement(API_MOCK.SIMULATE_PATH)) {
    await am24AimFill(ctx, API_MOCK.SIMULATE_PATH, AM24_ORDERS_PATH, fieldHold);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_BODY)) {
    await am24AimFill(ctx, API_MOCK.SIMULATE_BODY, body, fieldHold);
  }
  await reviewAndRunSimulation(ctx, {
    review: reviewHold,
    beforeRun: beforeRunHold,
    sampleName: name,
    saveSample: opts.saveSample,
  });
  await am24Reveal(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
}

async function quietSample(ctx: DemoActionContext): Promise<void> {
  upsertAm24ContractSamples();
  await openAm24Simulate(ctx, false);
  if (hasAm24ContractSamples() || hasAm24Summary()) return;
  if (!hasAm24NamedSample(AM24_SAMPLE_NAME)) {
    await runOrdersSimulation(ctx, AM24_MATCH_BODY, AM24_SAMPLE_NAME);
  }
  if (!hasAm24NamedSample(AM24_SAMPLE_NAME_MISSING)) {
    await runOrdersSimulation(ctx, AM24_MISS_BODY, AM24_SAMPLE_NAME_MISSING);
  }
  if (!hasAm24NamedSample(AM24_SAMPLE_NAME_FLAKY)) {
    await runOrdersSimulation(ctx, AM24_FLAKY_REQ_BODY, AM24_SAMPLE_NAME_FLAKY);
  }
}

async function ensureAm24Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  if (am24ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, REVEAL_MS).catch(() => undefined);
}

async function openAm24Journal(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (isAm24RuntimeViewActive() && firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    if (visible) await am24Aim(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
    await ctx.delay(visible ? T.tabSwitch : 200);
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    if (visible) await am24Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.LIVE_TRANSACTIONS);
    await ctx.delay(visible ? T.tabSwitch : 200);
    return;
  }
  if (firstVisibleElement(API_MOCK.VIEW_RUNTIME)) {
    if (visible) await am24Aim(ctx, API_MOCK.VIEW_RUNTIME);
    else await ctx.click(API_MOCK.VIEW_RUNTIME);
    await ctx.delay(visible ? T.tabSwitch : 200);
  }
}

async function quietJournal(ctx: DemoActionContext): Promise<void> {
  if (hasAm24JournalRow()) return;
  await ensureAm24Running(ctx);
  await sendApiMockRequest({
    path: AM24_ORDERS_PATH,
    method: 'POST',
    headers: { 'Content-Type': AM24_CONTENT_JSON },
    body: AM24_MATCH_BODY,
  });
  await ctx.delay(400);
}

function quietAdd(
  type: string,
  id: string,
  label: string,
  position: { x: number; y: number },
  canvasSel: string,
): void {
  if (document.querySelector(canvasSel)) return;
  addWorkflowNodeWithPreset(type, id, label, position);
}

async function selectAm24StudioServer(ctx: DemoActionContext): Promise<string> {
  const serverId = await waitForApiMockStudioServerId(ctx, {
    name: AM24_SERVER_NAME,
    templateId: AM24_SERVER_ID,
  }) || AM24_SERVER_ID;
  await waitForApiMockWfServerReady(ctx, serverId);
  if (clearApiMockWfServerPicker()) await ctx.delay(T.fieldFilled);
  await selectWfConfigOption(ctx, API_MOCK.WF_SERVER, serverId);
  await holdWfSpotlight(ctx, API_MOCK.WF_SERVER, T.payoff);
  return serverId;
}

async function persistAm24Start(serverId?: string): Promise<void> {
  const id = am24CanvasNodeId(API_MOCK.CANVAS_START) ?? AM24_NODE.start;
  const resolved = serverId
    ?? (await resolveApiMockStudioServerId({ name: AM24_SERVER_NAME, templateId: AM24_SERVER_ID }))
    ?? AM24_SERVER_ID;
  patchWorkflowNodeDataById(id, {
    serverId: resolved,
    isolateRun: true,
    savePortAs: 'mockPort',
    saveBaseUrlAs: 'mockBaseUrl',
  });
}

async function quietStart(ctx: DemoActionContext): Promise<void> {
  quietAdd('apiMockStart', AM24_NODE.start, 'Start Mock Server', POS.start, API_MOCK.CANVAS_START);
  await ctx.delay(80);
  await persistAm24Start();
  await linkIntoChain(ctx, API_MOCK.CANVAS_START, false);
}

async function quietHttp(ctx: DemoActionContext): Promise<void> {
  quietAdd('http', AM24_NODE.http, 'HTTP Request', POS.http, WF.NODE_HTTP);
  await ctx.delay(80);
  const id = am24CanvasNodeId(WF.NODE_HTTP) ?? AM24_NODE.http;
  patchWorkflowNodeDataById(id, {
    scenario: {
      id: 'am24-order',
      name: 'POST orders',
      url: AM24_HTTP_URL,
      method: AM24_HTTP_METHOD,
      headers: [{ key: 'Content-Type', value: AM24_CONTENT_JSON }],
      body: AM24_MATCH_BODY,
      auth: { type: 'none' },
      validation: { mode: 'none' },
    },
  });
  await linkIntoChain(ctx, WF.NODE_HTTP, false);
}

async function quietAssert(ctx: DemoActionContext): Promise<void> {
  quietAdd('apiMockAssertCalls', AM24_NODE.assert, 'Assert Mock Calls', POS.assert, API_MOCK.CANVAS_ASSERT);
  await ctx.delay(80);
  const id = am24CanvasNodeId(API_MOCK.CANVAS_ASSERT) ?? AM24_NODE.assert;
  patchWorkflowNodeDataById(id, {
    serverId: AM24_ISOLATED_SERVER,
    minCount: Number(AM24_ASSERT_MIN),
    statusContains: AM24_ASSERT_STATUS,
    bodyContains: AM24_ASSERT_BODY,
    recencyMs: Number(AM24_ASSERT_RECENCY),
  });
  await linkIntoChain(ctx, API_MOCK.CANVAS_ASSERT, false);
}

async function quietStop(ctx: DemoActionContext): Promise<void> {
  quietAdd('apiMockStop', AM24_NODE.stop, 'Stop Mock Server', POS.stop, API_MOCK.CANVAS_STOP);
  await ctx.delay(80);
  const id = am24CanvasNodeId(API_MOCK.CANVAS_STOP) ?? AM24_NODE.stop;
  patchWorkflowNodeDataById(id, { serverId: AM24_ISOLATED_SERVER });
  await linkIntoChain(ctx, API_MOCK.CANVAS_STOP, false);
}

async function quietWire(): Promise<void> {
  const trigger = am24CanvasNodeId(WF.NODE_START);
  const start = am24CanvasNodeId(API_MOCK.CANVAS_START);
  const http = am24CanvasNodeId(WF.NODE_HTTP);
  const assert = am24CanvasNodeId(API_MOCK.CANVAS_ASSERT);
  const stop = am24CanvasNodeId(API_MOCK.CANVAS_STOP);
  if (trigger && start) connectWorkflowNodes(trigger, start);
  if (start && http) connectWorkflowNodes(start, http);
  if (http && assert) connectWorkflowNodes(http, assert);
  if (assert && stop) connectWorkflowNodes(assert, stop);
}

async function dropFromPalette(
  ctx: DemoActionContext,
  paletteSel: string,
  canvasSel: string,
): Promise<void> {
  await revealPaletteBlock(ctx, paletteSel, { showNav: true });
  if (document.querySelector(canvasSel)) {
    await am24Look(ctx, canvasSel);
    return;
  }
  await am24ClickNow(ctx, paletteSel);
  await am24Reveal(ctx, canvasSel);
  await am24Look(ctx, canvasSel);
}

export async function ensureAm24ForMatching(ctx: DemoActionContext): Promise<void> {
  await ensureAm24Server(ctx);
  if (!hasAm24Draft() && !hasAm24EnabledOrders()) {
    await quietParseOpenApi(ctx);
  }
  await quietEnableOrders(ctx);
  await closeAm24Simulate(ctx);
}

export async function ensureAm24ForResponse(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForMatching(ctx);
  await quietJsonPath(ctx);
  await closeAm24Simulate(ctx);
}

export async function ensureAm24ForVariants(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForResponse(ctx);
  await quietFakerBody(ctx);
}

export async function ensureAm24ForResilience(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForVariants(ctx);
  await quietNotFoundVariant(ctx);
}

/** preAction for the suite step (step 6) — prove POST /orders before any health overlap. */
export async function ensureAm24ForSuite(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForResilience(ctx);
  await quietDelayAndFault(ctx);
  // Pre-seed WIDGET + MISSING + FLAKY so Simulate opens onto Saved samples
  // the viewer can re-run. If the live matching step already saved WIDGET,
  // upsert keeps that row and adds the other two.
  await quietSample(ctx);
  await closeAm24Simulate(ctx);
}

/** preAction for the conflicts step (step 7) — purge any /health routes left from a
 *  prior run so the live step always authors them from zero, and strip leftover GET /. */
export async function ensureAm24ForConflicts(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForSuite(ctx);
  await quietRemoveStrayRootRoutes();
  // Count /health rows from the DOM (accurate here — no health patches yet in this call).
  const haveHealth = am24HealthRows().length;
  for (let i = 0; i < haveHealth; i++) {
    patchApiMockActiveRoute({
      removeRoute: true,
      selectPath: AM24_HEALTH_PATH,
      selectMethod: 'GET',
    });
  }
  await closeAm24Simulate(ctx);
}

export async function ensureAm24ForLive(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForConflicts(ctx);
  await quietOverlap(ctx);
  await quietFixPriority(ctx);
  await quietAnalyze(ctx);
  await quietEnableGetOrderId(ctx);
  await closeAm24Simulate(ctx);
}

/** preAction for the export step (step 9). */
export async function ensureAm24ForExport(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForLive(ctx);
  await closeAm24Export(ctx, false);
  await closeAm24Simulate(ctx);
}

/** preAction for the workflow Quick Test step (step 10). */
export async function ensureAm24ForShip(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ForExport(ctx);
}

export async function runAm24FromSpec(ctx: DemoActionContext): Promise<void> {
  await ensureAm24Server(ctx);
  await openAm24Import(ctx, true);
  await am24Look(ctx, API_MOCK.IMPORT_SOURCES);
  await selectOpenApiSource(ctx, true);
  if (firstVisibleElement(API_MOCK.IMPORT_PASTE)) {
    await am24AimFill(ctx, API_MOCK.IMPORT_PASTE, AM24_OPENAPI, T.payoff);
    await prettyFormatImportPaste(ctx, { look: T.look, hold: T.payoff });
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await am24Aim(ctx, API_MOCK.IMPORT_PARSE);
  }
  await am24Reveal(ctx, API_MOCK.IMPORT_ROUTE_LIST, T.payoff);
  await am24Look(ctx, API_MOCK.IMPORT_ROUTE_LIST);
  await am24Break(ctx);
  if (firstVisibleElement(API_MOCK.IMPORT_GENERALIZE) && !checkboxChecked(API_MOCK.IMPORT_GENERALIZE)) {
    await am24Aim(ctx, API_MOCK.IMPORT_GENERALIZE, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_LOSS)) {
    await am24Look(ctx, API_MOCK.IMPORT_LOSS);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_FOLDER)) {
    await am24Look(ctx, API_MOCK.IMPORT_FOLDER);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PREVIEW)) {
    await am24Look(ctx, API_MOCK.IMPORT_PREVIEW);
  }
  await am24Payoff(ctx, API_MOCK.IMPORT_REVIEW);
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await clickBeat(ctx, API_MOCK.IMPORT_CONFIRM, { look: T.reviewModal, hold: T.payoff });
  }
  await ctx.waitFor(API_MOCK.DRAFT_ROUTE, REVEAL_MS).catch(() => undefined);
  await closeAm24Import(ctx);
  const drafts = am24DraftRows().slice(0, 2);
  for (const row of drafts) {
    const testid = row.getAttribute('data-testid');
    if (testid) await am24Look(ctx, `[data-testid="${testid}"]`);
  }
  await am24Break(ctx);
  await selectOrdersRoute(ctx, true);
  if (!isAm24RouteEnabled() && firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am24Aim(ctx, API_MOCK.ROUTE_ENABLED, T.payoff);
  }
  await am24Payoff(ctx, API_MOCK.ROUTE_ENABLED);
  await am24Break(ctx);
  await enableGetOrderIdFromUi(ctx, true);
  await selectOrdersRoute(ctx, true);
  await am24Payoff(ctx, API_MOCK.ROUTE_ENABLED);
}

export async function runAm24Matching(ctx: DemoActionContext): Promise<void> {
  await ensureAm24MatchTab(ctx);
  if (!firstVisibleElement(API_MOCK.PATTERN_TOOLBOX) && firstVisibleElement(API_MOCK.PATH_TOOLBOX)) {
    await am24ClickNow(ctx, API_MOCK.PATH_TOOLBOX, T.fieldFilled);
    await am24Reveal(ctx, API_MOCK.PATTERN_TOOLBOX);
  }
  if (firstVisibleElement(API_MOCK.TOOLBOX_TAB_JSONPATH)) {
    await am24Aim(ctx, API_MOCK.TOOLBOX_TAB_JSONPATH, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.TOOLBOX_JSON_SAMPLE)) {
    await am24AimFill(ctx, API_MOCK.TOOLBOX_JSON_SAMPLE, AM24_MATCH_BODY, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TOOLBOX_JSONPATH) && inputValue(API_MOCK.TOOLBOX_JSONPATH) !== AM24_JSONPATH) {
    await am24AimFill(ctx, API_MOCK.TOOLBOX_JSONPATH, AM24_JSONPATH);
  }
  if (firstVisibleElement(API_MOCK.TOOLBOX_JSON_EXPECTED)) {
    await am24AimFill(ctx, API_MOCK.TOOLBOX_JSON_EXPECTED, AM24_SKU, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.TOOLBOX_APPLY)) {
    await am24Aim(ctx, API_MOCK.TOOLBOX_APPLY, T.panelReady);
  }
  patchAm24Orders({ predicates: ROOT_GROUP });
  await am24Break(ctx);
  await openAm24Simulate(ctx, true);
  await runOrdersSimulation(ctx, AM24_MATCH_BODY, AM24_SAMPLE_NAME);
  await am24Payoff(ctx, API_MOCK.SIMULATE_OUTCOME);
  await closeAm24Simulate(ctx, { review: true });
  if (firstVisibleElement(API_MOCK.PATH_TOOLBOX)) {
    await am24Payoff(ctx, API_MOCK.PATH_TOOLBOX);
  }
}

export async function runAm24Response(ctx: DemoActionContext): Promise<void> {
  await closeAm24Simulate(ctx);
  await ensureAm24ResponseTab(ctx);
  if (firstVisibleElement(API_MOCK.BTAB_RESPONSE) && !firstVisibleElement(API_MOCK.VARIANT_BODY)) {
    await am24ClickNow(ctx, API_MOCK.BTAB_RESPONSE, T.tabSwitch);
  }
  await am24Reveal(ctx, API_MOCK.VARIANT_BODY);
  patchAm24Orders({
    body: AM24_FAKER_BODY,
    contentType: AM24_CONTENT_JSON,
    status: 201,
  });
  await am24Payoff(ctx, API_MOCK.VARIANT_BODY);
  await am24Break(ctx);
  if (firstVisibleElement(API_MOCK.BODY_FORMAT)) {
    await am24Aim(ctx, API_MOCK.BODY_FORMAT, T.generate);
  }
  if (firstVisibleElement(API_MOCK.PREVIEW_BODY)) {
    await am24Reveal(ctx, API_MOCK.PREVIEW_BODY, T.payoff);
    await am24Payoff(ctx, API_MOCK.PREVIEW_BODY);
  }
}

export async function runAm24Variants(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ResponseTab(ctx);
  if (!(hasAm24NotFoundVariant() && am24VariantCards().length >= 2)) {
    if (firstVisibleElement(API_MOCK.ADD_VARIANT)) {
      await am24ClickNow(ctx, API_MOCK.ADD_VARIANT, T.fieldFilled);
    }
    await am24Reveal(ctx, API_MOCK.VARIANT_CARD_LAST);
    if (firstVisibleElement(API_MOCK.VARIANT_NAME)) {
      await am24AimFill(ctx, API_MOCK.VARIANT_NAME, AM24_VARIANT_NAME);
    }
    if (firstVisibleElement(API_MOCK.VARIANT_STATUS_QUICK_404)) {
      await am24Aim(ctx, API_MOCK.VARIANT_STATUS_QUICK_404);
    }
    patchAm24Orders({
      variantIndex: 1,
      variantName: AM24_VARIANT_NAME,
      status: 404,
      body: AM24_ERR_BODY,
      contentType: AM24_CONTENT_JSON,
      isDefault: false,
    });
    await am24Payoff(ctx, API_MOCK.VARIANT_CARD_LAST);
  }
  await am24Break(ctx);
  const last = am24VariantCards().at(-1);
  const lastId = last?.getAttribute('data-testid');
  if (lastId) await am24ClickNow(ctx, `[data-testid="${lastId}"]`, 0);
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_SELECTION)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_TAB_SELECTION, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.SELECTION_CONDITION_PATH)) {
    await am24AimFill(ctx, API_MOCK.SELECTION_CONDITION_PATH, AM24_JSONPATH);
  }
  if (firstVisibleElement(API_MOCK.SELECTION_CONDITION_VALUE)) {
    await am24AimFill(ctx, API_MOCK.SELECTION_CONDITION_VALUE, AM24_SKU_MISSING);
  }
  applyAm24NotFoundCondition();
  if (firstVisibleElement(API_MOCK.SELECTION_CONDITION)) {
    await am24Payoff(ctx, API_MOCK.SELECTION_CONDITION);
  }
  await am24Break(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_SEQUENCE)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_MODE_SEQUENCE);
  }
  patchAm24Orders({ responseMode: 'sequence' });
  if (firstVisibleElement(API_MOCK.SEQUENCE_ORDER_NOTE)) {
    await am24Payoff(ctx, API_MOCK.SEQUENCE_ORDER_NOTE);
  }
  await am24Break(ctx);
  if (firstVisibleElement(API_MOCK.RESPONSE_MODE_RULES)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_MODE_RULES);
  }
  patchAm24Orders({ responseMode: 'rules', variantIndex: 0, isDefault: true });
  applyAm24NotFoundCondition();
  // Clear the route-level body predicate so MISSING and FLAKY SKUs can
  // reach the route and be handled by variant conditions.
  patchAm24Orders({ predicates: OPEN_GROUP });
  const card = am24VariantCards().at(-1);
  const cardId = card?.getAttribute('data-testid');
  if (cardId) await am24ClickNow(ctx, `[data-testid="${cardId}"]`, 0);
  if (!firstVisibleElement(API_MOCK.SELECTION_CONDITION) && firstVisibleElement(API_MOCK.RESPONSE_TAB_SELECTION)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_TAB_SELECTION, T.tabSwitch);
  }
  await am24Payoff(
    ctx,
    firstVisibleElement(API_MOCK.SELECTION_CONDITION)
      ? API_MOCK.SELECTION_CONDITION
      : API_MOCK.RESPONSE_MODE_RULES,
  );
}

export async function runAm24Resilience(ctx: DemoActionContext): Promise<void> {
  await ensureAm24ResponseTab(ctx);

  // Beat 1 — latency on the happy path: a 200 ms delay at probability 1 on the
  // default 201 so every good order is slightly slow (and never faults).
  if (firstVisibleElement(API_MOCK.VARIANT_CARD_FIRST)) {
    await am24ClickNow(ctx, API_MOCK.VARIANT_CARD_FIRST, 0);
  }
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_TIMING)) {
    await am24ClickNow(ctx, API_MOCK.RESPONSE_TAB_TIMING, T.tabSwitch);
  }
  await am24Reveal(ctx, API_MOCK.TIMING_PANEL);
  if (firstVisibleElement(API_MOCK.VARIANT_DELAY)) {
    await am24AimFill(ctx, API_MOCK.VARIANT_DELAY, AM24_DELAY);
  }
  if (firstVisibleElement(API_MOCK.VARIANT_PROBABILITY)) {
    await am24AimFill(ctx, API_MOCK.VARIANT_PROBABILITY, AM24_PROBABILITY, T.payoff);
  }
  patchAm24Orders({
    variantIndex: 0,
    behavior: { delayMs: Number(AM24_DELAY), probability: 1 },
  });
  await am24Break(ctx);

  // Beat 2 — add a third "degraded" branch (503) for an unreliable dependency,
  // conditioned on its own flaky SKU so it never overlaps the 201 or the real 404.
  if (!(hasAm24DegradedVariant() && am24VariantCards().length >= 3)) {
    if (firstVisibleElement(API_MOCK.ADD_VARIANT)) {
      await am24ClickNow(ctx, API_MOCK.ADD_VARIANT, T.fieldFilled);
    }
    if (am24VariantCards().length < 3) {
      patchAm24Orders({ addVariant: true });
    }
    await am24Reveal(ctx, API_MOCK.VARIANT_CARD_LAST);
    if (firstVisibleElement(API_MOCK.VARIANT_NAME)) {
      await am24AimFill(ctx, API_MOCK.VARIANT_NAME, AM24_FLAKY_VARIANT_NAME);
    }
    patchAm24Orders({
      variantIndex: 2,
      variantName: AM24_FLAKY_VARIANT_NAME,
      status: Number(AM24_FLAKY_STATUS),
      body: AM24_FLAKY_BODY,
      contentType: AM24_CONTENT_JSON,
      isDefault: false,
      variantConditions: DEGRADED_CONDITIONS,
    });
    await am24Payoff(ctx, API_MOCK.VARIANT_CARD_LAST);
  } else {
    applyAm24DegradedCondition();
  }
  await am24Break(ctx);

  // Beat 3 — the degraded branch is the *only* place the transport fault lives:
  // gate it at 50% on Timing, then arm the timeout on Faults. A 404 is a
  // response; a timeout is no response — they must stay on separate variants.
  const last = am24VariantCards().at(-1);
  const lastId = last?.getAttribute('data-testid');
  if (lastId) await am24ClickNow(ctx, `[data-testid="${lastId}"]`, 0);
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_TIMING)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_TAB_TIMING, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.VARIANT_PROBABILITY)) {
    await am24AimFill(ctx, API_MOCK.VARIANT_PROBABILITY, AM24_FAULT_PROBABILITY, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.RESPONSE_TAB_FAULTS)) {
    await am24Aim(ctx, API_MOCK.RESPONSE_TAB_FAULTS, T.tabSwitch);
  }
  await am24Reveal(ctx, API_MOCK.FAULTS_PANEL);
  if (firstVisibleElement(API_MOCK.FAULT_TIMEOUT)) {
    await am24Aim(ctx, API_MOCK.FAULT_TIMEOUT);
  }
  patchAm24Orders({
    variantIndex: 2,
    behavior: { fault: 'timeout', longRunningMs: 50, probability: Number(AM24_FAULT_PROBABILITY) },
  });
  await am24Payoff(ctx, API_MOCK.FAULTS_PANEL);
}

async function authorAm24HealthRoute(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.ADD_ROUTE)) {
    patchApiMockActiveRoute({
      addRoute: true,
      path: AM24_HEALTH_PATH,
      method: 'GET',
      selectMethod: 'GET',
    });
    return;
  }
  await am24Aim(ctx, API_MOCK.ADD_ROUTE, T.fieldFilled);
  if (firstVisibleElement(API_MOCK.ROUTE_EDITOR)) {
    await am24Reveal(ctx, API_MOCK.ROUTE_EDITOR, T.panelReady);
  } else {
    await ctx.waitFor(API_MOCK.ROUTE_EDITOR, REVEAL_MS).catch(() => undefined);
  }
  await ctx.delay(200);
  // Type /health in the new rule's editor (ADD_ROUTE defaults to GET /).
  if (firstVisibleElement(API_MOCK.PATH_INPUT) && inputValue(API_MOCK.PATH_INPUT) !== AM24_HEALTH_PATH) {
    await am24AimFill(ctx, API_MOCK.PATH_INPUT, AM24_HEALTH_PATH);
  }
  if (firstVisibleElement(API_MOCK.METHOD_SELECT)) {
    await ctx.selectOption(API_MOCK.METHOD_SELECT, 'GET').catch(() => undefined);
  }
  // Belt: retarget leftover GET / — never patch the selected POST /orders rule.
  patchApiMockActiveRoute({
    selectPath: '/',
    selectMethod: 'GET',
    path: AM24_HEALTH_PATH,
    method: 'GET',
  });
}

export async function runAm24Conflicts(ctx: DemoActionContext): Promise<void> {
  await closeAm24Simulate(ctx);
  await ensureAm24StudioView(ctx);
  await quietRemoveStrayRootRoutes();

  // Beat 1 — author two GET /health rules (the duplicate the description names).
  // Read DOM count NOW (before any state patches) — accurate at this point.
  // Do NOT re-check after authoring: patchApiMockActiveRoute is async React state
  // and the DOM won't update until the next render cycle.
  if (firstVisibleElement(API_MOCK.ROUTE_EXPLORER)) {
    await am24Look(ctx, API_MOCK.ROUTE_EXPLORER);
  }
  const healthAtStart = am24HealthRows().length;
  const toAdd = Math.max(0, 2 - healthAtStart);
  for (let i = 0; i < toAdd; i++) {
    await authorAm24HealthRoute(ctx);
  }
  const healthRows = am24HealthRows();
  if (healthRows[0]) await am24Look(ctx, `[data-testid="${healthRows[0].getAttribute('data-testid')}"]`);
  if (healthRows[1]) await am24Look(ctx, `[data-testid="${healthRows[1].getAttribute('data-testid')}"]`);
  await am24Break(ctx);

  // Beat 2 — Analyze and click the finding to open its detail.
  // With both health routes at P10 (equal priority + reject policy) the detail
  // shows "returns 409" — that is the BEFORE state the viewer needs to see.
  // Spotlight the "Duplicate" filter badge so the viewer sees the kind label BEFORE the fix.
  if (firstVisibleElement(API_MOCK.ANALYZE)) {
    await am24Aim(ctx, API_MOCK.ANALYZE, T.fieldFilled);
  } else if (firstVisibleElement(API_MOCK.VIEW_CONFLICTS)) {
    await am24Aim(ctx, API_MOCK.VIEW_CONFLICTS);
  }
  await am24Reveal(ctx, API_MOCK.CONFLICT_LIST);
  if (firstVisibleElement(API_MOCK.CONFLICT_FILTER_DUPLICATE)) {
    // Spotlight the "Duplicate" badge — the BEFORE kind (error, equal priority → reject tie).
    await am24Look(ctx, API_MOCK.CONFLICT_FILTER_DUPLICATE);
  }
  if (firstVisibleElement(API_MOCK.FIRST_FINDING)) {
    // Click the row to open the detail panel showing the 409 / reject notice.
    await am24Aim(ctx, API_MOCK.FIRST_FINDING, T.fieldFilled);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_DETAIL)) {
    await am24Payoff(ctx, API_MOCK.CONFLICT_DETAIL);
  }
  await am24Break(ctx);

  // Beat 3 — raise one GET /health so it wins.
  // Click CONFLICT_ADJUST_PRIORITY to open the prio menu, then click
  // CONFLICT_PRIO_LEFT ("Raise left"). Belt: always patch state too.
  if (firstVisibleElement(API_MOCK.CONFLICT_ADJUST_PRIORITY)) {
    await am24Aim(ctx, API_MOCK.CONFLICT_ADJUST_PRIORITY, T.fieldFilled);
    if (firstVisibleElement(API_MOCK.CONFLICT_PRIO_LEFT)) {
      await am24Aim(ctx, API_MOCK.CONFLICT_PRIO_LEFT, T.fieldFilled);
    }
  } else {
    await selectHealthRoute(ctx, true);
    if (firstVisibleElement(API_MOCK.PRIORITY_INPUT)) {
      await am24AimFill(ctx, API_MOCK.PRIORITY_INPUT, AM24_PRIORITY);
    }
  }
  patchAm24Health({ priority: Number(AM24_PRIORITY) });

  // Beat 4 — Re-analyze. The detail now shows "Outcome: Left wins" instead of
  // "returns 409" — that is the AFTER / "clean" state: one unambiguous winner.
  // The kind badge transitions from "Duplicate" (error) → "Shadowed" (warning).
  if (firstVisibleElement(API_MOCK.CONFLICTS_ANALYZE)) {
    await am24Aim(ctx, API_MOCK.CONFLICTS_ANALYZE, T.fieldFilled);
  } else if (firstVisibleElement(API_MOCK.ANALYZE)) {
    await am24Aim(ctx, API_MOCK.ANALYZE, T.fieldFilled);
  }
  // Re-select the finding so the detail refreshes with the new outcome.
  if (firstVisibleElement(API_MOCK.FIRST_FINDING)) {
    await am24Aim(ctx, API_MOCK.FIRST_FINDING, T.fieldFilled);
  }
  if (firstVisibleElement(API_MOCK.CONFLICT_FILTER_SHADOWED)) {
    // Spotlight the "Shadowed" badge — the AFTER kind (warning, left wins deterministically).
    await am24Look(ctx, API_MOCK.CONFLICT_FILTER_SHADOWED);
  }
  // Payoff on the detail showing "Left wins" (not "1 finding" summary).
  if (firstVisibleElement(API_MOCK.CONFLICT_DETAIL)) {
    await am24Payoff(ctx, API_MOCK.CONFLICT_DETAIL);
  } else if (firstVisibleElement(API_MOCK.CONFLICT_SUMMARY)) {
    await am24Payoff(ctx, API_MOCK.CONFLICT_SUMMARY);
  }

  // Beat 5 — return to Studio view.
  if (firstVisibleElement(API_MOCK.VIEW_STUDIO) && !isAm24StudioActive()) {
    await am24Aim(ctx, API_MOCK.VIEW_STUDIO);
  }
}

export async function runAm24Suite(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  await closeAm24Simulate(ctx);
  upsertAm24ContractSamples();
  if (firstVisibleElement(API_MOCK.SIMULATE)) {
    await am24Aim(ctx, API_MOCK.SIMULATE, T.panelReady);
  }
  await am24Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE);
  if (!hasAm24ContractSamples()) {
    if (!hasAm24NamedSample(AM24_SAMPLE_NAME)) {
      await runOrdersSimulation(ctx, AM24_MATCH_BODY, AM24_SAMPLE_NAME, {
        formHold: 1800,
        fieldHold: 1800,
        reviewHold: 2200,
        beforeRunHold: 2800,
      });
    }
    if (!hasAm24NamedSample(AM24_SAMPLE_NAME_MISSING)) {
      await runOrdersSimulation(ctx, AM24_MISS_BODY, AM24_SAMPLE_NAME_MISSING);
    }
    if (!hasAm24NamedSample(AM24_SAMPLE_NAME_FLAKY)) {
      await runOrdersSimulation(ctx, AM24_FLAKY_REQ_BODY, AM24_SAMPLE_NAME_FLAKY);
    }
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_SECTION_SAVED)) {
    await am24Reveal(ctx, API_MOCK.SIMULATE_SECTION_SAVED, T.panelReady);
  }
  const missingId = resolveAm24SampleId(AM24_SAMPLE_NAME_MISSING);
  const flakyId = resolveAm24SampleId(AM24_SAMPLE_NAME_FLAKY);
  if (missingId) await am24Look(ctx, API_MOCK.simSample(missingId));
  if (flakyId) await am24Look(ctx, API_MOCK.simSample(flakyId));
  const widgetId = resolveAm24SampleId(AM24_SAMPLE_NAME);
  if (widgetId) {
    await am24Look(ctx, API_MOCK.simSample(widgetId));
    await am24Aim(ctx, API_MOCK.simSampleBtn(widgetId), T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_ASSERTIONS)) {
    await am24Aim(ctx, API_MOCK.SIMULATE_TAB_ASSERTIONS, T.tabSwitch);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_ASSERT_STATUS) && inputValue(API_MOCK.SIMULATE_ASSERT_STATUS) !== '201') {
    await am24AimFill(ctx, API_MOCK.SIMULATE_ASSERT_STATUS, '201');
  }
  await am24Break(ctx);

  // Beat — ring + click "Run all samples" → wait for suite summary.
  if (firstVisibleElement(API_MOCK.SIMULATE_RUN_ALL)) {
    await am24Aim(ctx, API_MOCK.SIMULATE_RUN_ALL);
  }
  await am24Reveal(ctx, API_MOCK.SIMULATE_SUMMARY, T.simOutcome);
  await am24Payoff(ctx, API_MOCK.SIMULATE_SUMMARY);
  await am24Break(ctx);

  // Beat — open FLAKY so the viewer can re-check 503 (not the unmatched 404).
  if (flakyId) {
    await am24Look(ctx, API_MOCK.simSample(flakyId));
    await am24Aim(ctx, API_MOCK.simSampleBtn(flakyId), T.panelReady);
  } else if (widgetId) {
    await am24Look(ctx, API_MOCK.simSample(widgetId));
    await am24Aim(ctx, API_MOCK.simSampleBtn(widgetId), T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_TAB_RENDERED)) {
    await am24Aim(ctx, API_MOCK.SIMULATE_TAB_RENDERED, T.tabSwitch);
  }
  const renderedTarget = firstVisibleElement(API_MOCK.SIMULATE_RENDERED_STATUS)
    ? API_MOCK.SIMULATE_RENDERED_STATUS
    : API_MOCK.SIMULATE_RENDERED;
  await am24Reveal(ctx, renderedTarget, T.panelReady);
  await am24Payoff(ctx, renderedTarget);

  await closeAm24Simulate(ctx, { review: true });
}

export async function runAm24Live(ctx: DemoActionContext): Promise<void> {
  await closeAm24Simulate(ctx);
  await ensureAm24StudioView(ctx);
  await enableGetOrderIdFromUi(ctx, true);
  await applyIfDirty(ctx);

  // Beat 1 — Start the listener so real traffic can reach it.
  if (!am24ServerRunning() && firstVisibleElement(API_MOCK.START)) {
    await am24Aim(ctx, API_MOCK.START, T.lifecycle);
    await am24Reveal(ctx, API_MOCK.STOP, T.lifecycle);
  }
  // Re-enable from the list (product control) + Apply after Start so a
  // listener that booted while GET /orders/{id} was still a draft picks it up.
  await enableGetOrderIdFromUi(ctx, false);
  await applyIfDirty(ctx);
  await am24Payoff(ctx, API_MOCK.STATUS_LABEL);
  await am24Break(ctx);

  // Beat 2 — Send POST /orders first (so the row arrives while the journal is
  // opening), then click Transactions and hold on the row that's already there.
  await sendApiMockRequest({
    path: AM24_ORDERS_PATH,
    method: 'POST',
    headers: { 'Content-Type': AM24_CONTENT_JSON },
    body: AM24_MATCH_BODY,
  });
  await ctx.delay(600);
  await openAm24Journal(ctx, true);
  await am24Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.journalWrite);
  await am24Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  await am24Break(ctx);

  // Beat 3 — GET /orders/42 hits the parameterized GET /orders/{id} rule.
  await sendApiMockRequest({ path: AM24_HIT_PATH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await am24Aim(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.tabSwitch);
  await am24Reveal(ctx, API_MOCK.TX_DETAIL, T.journalWrite);
  if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am24Payoff(ctx, API_MOCK.TX_OUTCOME);
  } else {
    await am24Payoff(ctx, API_MOCK.TX_DETAIL);
  }
  await am24Break(ctx);

  // Beat 4 — Fire GET /ordrs/42 (misspelled) → near-miss row in the journal.
  await sendApiMockRequest({ path: AM24_MISS_PATH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  // JOURNAL_FIRST_ROW is always the newest row — ring it, click to expand, hold.
  await am24Aim(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.tabSwitch);
  await am24Reveal(ctx, API_MOCK.TX_DETAIL, T.journalWrite);
  await am24Payoff(ctx, API_MOCK.TX_DETAIL);
  if (firstVisibleElement(API_MOCK.TX_NEAR_MISSES)) {
    await am24Payoff(ctx, API_MOCK.TX_NEAR_MISSES);
  } else if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am24Payoff(ctx, API_MOCK.TX_OUTCOME);
  }
}

async function openAm24ExportMenu(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm24OnStudio(ctx);
  await closeAm24Export(ctx, visible);
  if (isAm24ExportMenuOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT)) return;
  if (visible) await am24ClickNow(ctx, API_MOCK.EXPORT, T.fieldFilled);
  else await ctx.click(API_MOCK.EXPORT);
  await ctx.waitFor(API_MOCK.EXPORT_MENU, REVEAL_MS).catch(() => undefined);
}

async function pickExport(ctx: DemoActionContext, item: string, visible: boolean): Promise<void> {
  await openAm24ExportMenu(ctx, visible);
  if (!firstVisibleElement(item)) return;
  if (visible) await am24Aim(ctx, item);
  else await ctx.click(item);
  if (visible) await am24Reveal(ctx, API_MOCK.EXPORT_CONFIRM, T.payoff);
  else await ctx.waitFor(API_MOCK.EXPORT_CONFIRM, REVEAL_MS).catch(() => undefined);
}

export async function ensureAm24Designer(ctx: DemoActionContext): Promise<void> {
  await ensureAm24OnDesigner(ctx);
  await closeWfSamplePreviewIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await closeWfConsoleIfOpen(ctx);
  await ensureLessonBlankWorkflow(ctx, AM24_WF_NAME, { dismissOnboarding: dismissWfOnboarding });
  await collapseWfDemoAppSidebar(ctx);
  await revealPaletteBlock(ctx, WF.PAL_API_MOCK_START, { quiet: true });
}

async function holdOrEnableIsolate(ctx: DemoActionContext): Promise<void> {
  if (isAm24IsolateOn()) {
    await holdWfSpotlight(ctx, API_MOCK.WF_ISOLATE, T.look);
    return;
  }
  await clickWfConfigControl(ctx, API_MOCK.WF_ISOLATE);
}

async function connectPair(
  ctx: DemoActionContext,
  fromSel: string,
  toSel: string,
): Promise<void> {
  const from = am24CanvasNodeId(fromSel);
  const to = am24CanvasNodeId(toSel);
  if (!from || !to) return;
  await am24Look(ctx, fromSel);
  connectWorkflowNodes(from, to);
  await ctx.delay(T.fieldFilled);
}

async function fitAm24Canvas(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WF.FIT_VIEW_BTN)) {
    await am24Aim(ctx, WF.FIT_VIEW_BTN, T.fieldFilled);
  } else {
    await fitWfCanvasQuiet(ctx);
  }
}

function nearestAm24Neighbor(addedSel: string, dir: -1 | 1): string | null {
  const idx = AM24_CHAIN.indexOf(addedSel as typeof AM24_CHAIN[number]);
  if (idx < 0) return null;
  for (let i = idx + dir; i >= 0 && i < AM24_CHAIN.length; i += dir) {
    if (am24CanvasNodeId(AM24_CHAIN[i])) return AM24_CHAIN[i];
  }
  return null;
}

async function linkIntoChain(
  ctx: DemoActionContext,
  addedSel: string,
  visible: boolean,
): Promise<void> {
  const upstream = nearestAm24Neighbor(addedSel, -1);
  const downstream = nearestAm24Neighbor(addedSel, 1);
  if (upstream && downstream) {
    const from = am24CanvasNodeId(upstream);
    const to = am24CanvasNodeId(downstream);
    if (from && to) removeWorkflowEdge(from, to);
  }
  if (visible) {
    if (upstream) await connectPair(ctx, upstream, addedSel);
    if (downstream) await connectPair(ctx, addedSel, downstream);
    await fitAm24Canvas(ctx);
    return;
  }
  const added = am24CanvasNodeId(addedSel);
  if (upstream && added) {
    const from = am24CanvasNodeId(upstream);
    if (from) connectWorkflowNodes(from, added);
  }
  if (added && downstream) {
    const to = am24CanvasNodeId(downstream);
    if (to) connectWorkflowNodes(added, to);
  }
}

export async function runAm24Export(ctx: DemoActionContext): Promise<void> {
  await closeAm24Simulate(ctx);
  await ensureAm24OnStudio(ctx);
  await pickExport(ctx, API_MOCK.EXPORT_WORKSPACE, true);
  await am24Payoff(ctx, API_MOCK.EXPORT_CONFIRM);
  await closeAm24Export(ctx, true);
  await am24Break(ctx);
  await pickExport(ctx, API_MOCK.EXPORT_WIREMOCK, true);
  if (firstVisibleElement(API_MOCK.EXPORT_LOSS)) {
    await am24Look(ctx, API_MOCK.EXPORT_LOSS);
  }
  await am24Payoff(ctx, API_MOCK.EXPORT_CONFIRM);
  await closeAm24Export(ctx, true);
}

/**
 * Quietly stop the AM24 main server so the Quick Test's isolated copy can
 * claim port 4600. The isolated definition copies the workspace port; if the
 * main server is still running on that port the pool rejects the start with 409.
 * This is the last lesson step — the server is no longer needed after the test.
 */
async function quietStopAm24Server(ctx: DemoActionContext): Promise<void> {
  await ensureAm24StudioView(ctx);
  if (!am24ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.STOP)) return;
  await ctx.click(API_MOCK.STOP);
  await ctx.waitFor(API_MOCK.START, REVEAL_MS).catch(() => undefined);
}

export async function runAm24Ship(ctx: DemoActionContext): Promise<void> {
  await closeAm24Export(ctx, false);
  await closeAm24Simulate(ctx);
  // Free port 4600 before the Quick Test's Start Mock Server tries to claim it.
  await quietStopAm24Server(ctx);

  await ensureAm24Designer(ctx);
  await dropFromPalette(ctx, WF.PAL_API_MOCK_START, API_MOCK.CANVAS_START);
  await linkIntoChain(ctx, API_MOCK.CANVAS_START, true);
  await am24Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_START });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_START_CONFIG);
  await ctx.delay(T.panelReady);
  const serverId = await selectAm24StudioServer(ctx);
  await pauseWfConfigSection(ctx);
  await holdOrEnableIsolate(ctx);
  if (firstVisibleElement(API_MOCK.WF_SAVE_PORT)) {
    await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_PORT, T.look);
  }
  if (firstVisibleElement(API_MOCK.WF_SAVE_BASE_URL)) {
    await holdWfSpotlight(ctx, API_MOCK.WF_SAVE_BASE_URL, T.payoff);
  }
  await saveAndCloseWfConfigModal(ctx);
  await persistAm24Start(serverId);
  await am24Break(ctx);

  await dropFromPalette(ctx, WF.PAL_HTTP, WF.NODE_HTTP);
  await linkIntoChain(ctx, WF.NODE_HTTP, true);
  await am24Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: WF.NODE_HTTP, nodeSelector: WF.NODE_HTTP });
  await waitForWfConfigPanel(ctx, WF.CFG_HTTP_URL);
  await selectWfConfigOption(ctx, WF.CFG_HTTP_METHOD, AM24_HTTP_METHOD);
  await fillWfConfigField(ctx, WF.CFG_HTTP_URL, AM24_HTTP_URL);
  await holdWfSpotlight(ctx, WF.CFG_HTTP_URL, T.payoff);
  await saveAndCloseWfConfigModal(ctx);
  await quietHttp(ctx);
  await am24Break(ctx);

  await dropFromPalette(ctx, WF.PAL_API_MOCK_ASSERT, API_MOCK.CANVAS_ASSERT);
  await linkIntoChain(ctx, API_MOCK.CANVAS_ASSERT, true);
  await am24Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_ASSERT });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_ASSERT_CONFIG);
  await selectAm24StudioServer(ctx);
  if (inputValue(API_MOCK.WF_ASSERT_MIN) !== AM24_ASSERT_MIN) {
    await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_MIN, AM24_ASSERT_MIN);
  }
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_STATUS, AM24_ASSERT_STATUS);
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_BODY, AM24_ASSERT_BODY);
  await fillWfConfigField(ctx, API_MOCK.WF_ASSERT_RECENCY, AM24_ASSERT_RECENCY);
  await saveAndCloseWfConfigModal(ctx);
  const assertId = am24CanvasNodeId(API_MOCK.CANVAS_ASSERT);
  if (assertId) patchWorkflowNodeDataById(assertId, { serverId: AM24_ISOLATED_SERVER });
  await am24Break(ctx);

  await dropFromPalette(ctx, WF.PAL_API_MOCK_STOP, API_MOCK.CANVAS_STOP);
  await linkIntoChain(ctx, API_MOCK.CANVAS_STOP, true);
  await am24Break(ctx);
  await openWfNodeConfigModal(ctx, { canvasTestId: API_MOCK.CANVAS_STOP });
  await waitForWfConfigPanel(ctx, API_MOCK.WF_STOP_CONFIG);
  await selectAm24StudioServer(ctx);
  await saveAndCloseWfConfigModal(ctx);
  const stopId = am24CanvasNodeId(API_MOCK.CANVAS_STOP);
  if (stopId) patchWorkflowNodeDataById(stopId, { serverId: AM24_ISOLATED_SERVER });

  await connectPair(ctx, WF.NODE_START, API_MOCK.CANVAS_START);
  await connectPair(ctx, API_MOCK.CANVAS_START, WF.NODE_HTTP);
  await connectPair(ctx, WF.NODE_HTTP, API_MOCK.CANVAS_ASSERT);
  await connectPair(ctx, API_MOCK.CANVAS_ASSERT, API_MOCK.CANVAS_STOP);
  await fitAm24Canvas(ctx);
  await am24Break(ctx);

  // Beat — open the Console so the viewer can see live logs before clicking Quick Test.
  await openWfConsoleIfClosed(ctx);
  await ctx.delay(T.panelReady);
  // Spotlight only — do NOT click the panel container (that shifts focus away from the toolbar).
  await spotlightBeat(ctx, WF.CONSOLE, T.look);

  // Quick Test results can take up to 30s — use explicit timeouts instead of the 8s default.
  if (firstVisibleElement(WF.QUICK_TEST)) {
    await am24ClickNow(ctx, WF.QUICK_TEST, T.lifecycle);
  } else {
    triggerWorkflowQuickTest();
    await ctx.delay(T.lifecycle);
  }
  await am24Reveal(ctx, am24PassSelector(API_MOCK.CANVAS_START), T.simOutcome, 60_000);
  if (document.querySelector(am24PassSelector(WF.NODE_HTTP))) {
    await am24Look(ctx, am24PassSelector(WF.NODE_HTTP));
  }
  await am24Reveal(ctx, am24PassSelector(API_MOCK.CANVAS_ASSERT), T.simOutcome, 60_000);
}

/** @internal exported for helper tests */
export const am24TestHooks = {
  am24Aim,
  am24ClickNow,
  am24FillNow,
  am24AimFill,
  closeAm24Export,
  openAm24Import,
  selectOpenApiSource,
  quietParseOpenApi,
  quietEnableOrders,
  quietJsonPath,
  quietFakerBody,
  quietNotFoundVariant,
  quietDegradedVariant,
  quietDelayAndFault,
  quietOverlap,
  quietAnalyze,
  quietFixPriority,
  quietSample,
  quietJournal,
  quietStart,
  quietHttp,
  quietAssert,
  quietStop,
  quietWire,
  dropFromPalette,
  pickExport,
  openAm24ExportMenu,
  dismissWfOnboarding,
  holdOrEnableIsolate,
  applyIfDirty,
  ensureAm24MatchTab,
  ensureAm24ResponseTab,
  ensureAm24RuleOpen,
  ensureAm24Running,
  ensureAm24ForExport,
  openAm24Simulate,
  connectPair,
  linkIntoChain,
  runOrdersSimulation,
  selectOrdersRoute,
  resolveAm24SampleId,
  quietEnableGetOrderId,
};
