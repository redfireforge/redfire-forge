/**
 * AM-15 `am-15-import` helpers — Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog.
 *
 * Quiet corpus is a blank server plus Catalog / Requests entries to promote from.
 * Every import is authored live. The listener stays down until the final proof.
 */
import {
  deleteCatalogEntryByName,
  deleteCollectionsByName,
  ensureBlankApiMockServer,
  expandAppSidebar,
  isCatalogLoaded,
  prepareApiMockStudioChrome,
  seedCatalogEntry,
  seedRequestCollection,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, CAT, REQ } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  prettyFormatImportPaste,
  revealBeat,
  spotlightBeat,
  spotlightElementBeat,
} from './api-mock-demo-helpers';

export const AM15_TIMING = {
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
  beforeRun: 2000,
} as const;

const T = AM15_TIMING;

export const AM15_CURL = 'curl https://api.example.com/users/42';
export const AM15_CURL_PATH = '/users/42';
export const AM15_GENERALIZED = '/users/:id';
export const AM15_FOLDER = 'Imported';
export const AM15_PRIORITY = '20';
export const AM15_PROVE_PATH = '/users/42';
export const AM15_CATALOG_NAME = 'Import demo API';
export const AM15_REQUESTS_NAME = 'Import demo requests';
export const AM15_FILTER = 'Import demo';

export const AM15_CATALOG_SPEC = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Import demo API', version: '1.0.0' },
  paths: {
    '/catalog/widgets': {
      get: {
        operationId: 'listWidgets',
        summary: 'List widgets',
        // Query param makes the "Try it out" button appear so Export to API Mock
        // is reachable — the button only renders when tryItOpen=true.
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter by name' },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/catalog/widgets/{id}': {
      get: {
        operationId: 'getWidget',
        summary: 'Get widget',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Widget ID' },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
});

export const AM15_OPENAPI = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Widgets', version: '1' },
  paths: {
    '/widgets': {
      get: { operationId: 'listWidgets', summary: 'List widgets', responses: { '200': { description: 'ok' } } },
      post: { operationId: 'createWidget', summary: 'Create widget', responses: { '201': { description: 'created' } } },
    },
    '/widgets/{id}': {
      get: { operationId: 'getWidget', summary: 'Get widget', responses: { '200': { description: 'ok' } } },
    },
  },
});

export const AM15_WIREMOCK = JSON.stringify({
  mappings: [{
    request: {
      method: 'GET',
      url: '/orders/99',
      headers: { 'X-Tenant': { equalTo: 'acme' } },
      queryParameters: { page: { equalTo: '1' } },
    },
    response: {
      status: 200,
      jsonBody: { ok: true },
      fixedDelayMilliseconds: 40,
    },
  }],
});

export const AM15_HAR = JSON.stringify({
  log: {
    version: '1.2',
    creator: { name: 'am-15', version: '1' },
    entries: [
      {
        request: { method: 'GET', url: 'https://api.example.com/session', headers: [] },
        response: { status: 200, content: { mimeType: 'application/json', text: '{"ok":true}' } },
      },
      {
        request: { method: 'GET', url: 'https://api.example.com/session/me', headers: [] },
        response: { status: 200, content: { mimeType: 'application/json', text: '{"user":"ada"}' } },
      },
    ],
  },
});

async function am15Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

async function am15Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am15Fill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.look, hold });
}

async function am15Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await revealBeat(ctx, selector, { hold });
}

async function am15Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am15Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am15Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm15Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function isAm15StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm15ImportOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.IMPORT_REVIEW));
}

export function isAm15ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function am15DraftRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.DRAFT_ROUTE));
}

export function am15ProveDraftRow(): HTMLElement | undefined {
  return am15DraftRows().find(row => (
    row.querySelector('.am-route-path')?.textContent?.trim() === AM15_GENERALIZED
  )) ?? am15DraftRows()[0];
}

async function selectAm15ProveDraft(ctx: DemoActionContext, visible: boolean): Promise<void> {
  const row = am15ProveDraftRow();
  if (!row) return;
  const id = row.getAttribute('data-testid');
  if (!id) return;
  const selector = `[data-testid="${id}"]`;
  if (visible) await am15Click(ctx, selector, 0);
  else await ctx.click(selector);
}

export function am15DraftCount(): number {
  return am15DraftRows().length;
}

export function hasAm15Draft(): boolean {
  return am15DraftCount() >= 1;
}

export function am15PreviewPath(): string {
  return firstVisibleElement(API_MOCK.IMPORT_PREVIEW_PATH)?.textContent?.trim() ?? '';
}

export function isAm15CurlGeneralized(): boolean {
  return am15PreviewPath() === AM15_GENERALIZED;
}

export function isAm15SourceActive(id: string): boolean {
  return firstVisibleElement(API_MOCK.importSource(id))?.classList.contains('active') === true;
}

export function isAm15ReplaceWarningVisible(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.IMPORT_REPLACE_WARNING));
}

export function isAm15RouteEnabled(): boolean {
  const title = firstVisibleElement(API_MOCK.ROUTE_ENABLED)?.getAttribute('title') ?? '';
  return title.toLowerCase().includes('disable');
}

export function hasAm15Traffic(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

async function waitForFlag(pred: () => boolean, tries = 40): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (pred()) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return pred();
}

async function seedAm15InternalSources(): Promise<void> {
  await waitForFlag(() => isCatalogLoaded());
  await seedCatalogEntry(AM15_CATALOG_NAME, AM15_CATALOG_SPEC);
  seedRequestCollection(AM15_REQUESTS_NAME, [
    { name: 'List inventory', method: 'GET', url: 'https://api.example.com/inventory' },
    { name: 'Create inventory', method: 'POST', url: 'https://api.example.com/inventory' },
  ]);
}

export async function prepareAm15Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const blank = await ensureBlankApiMockServer();
  if (!blank) {
    throw new Error('AM-15: failed to create a blank mock server');
  }
  await seedAm15InternalSources();
}

export async function cleanupAm15(): Promise<void> {
  deleteCatalogEntryByName(AM15_CATALOG_NAME);
  deleteCollectionsByName(AM15_REQUESTS_NAME);
  await wipeApiMockWorkspace();
}

export async function ensureAm15StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm15StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
}

export async function ensureAm15Server(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm15StudioView(ctx);
  if (hasAm15Server()) return;
  const created = await ensureBlankApiMockServer();
  if (created) {
    await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
    return;
  }
  if (firstVisibleElement(API_MOCK.CREATE_FIRST)) {
    await ctx.click(API_MOCK.CREATE_FIRST);
    await ctx.waitFor(API_MOCK.SERVER_BAR, 10_000);
  }
}

export async function closeAm15Import(ctx: DemoActionContext): Promise<void> {
  if (!isAm15ImportOpen()) return;
  const close = firstVisibleElement(API_MOCK.IMPORT_CLOSE) ?? firstVisibleElement(API_MOCK.IMPORT_CANCEL);
  if (!close) return;
  await ctx.click(API_MOCK.IMPORT_CLOSE);
  await ctx.delay(400);
}

export async function openAm15Import(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm15Server(ctx);
  if (isAm15ImportOpen()) return;
  if (!firstVisibleElement(API_MOCK.IMPORT_MENU)) return;
  if (visible) {
    await am15Aim(ctx, API_MOCK.IMPORT_MENU);
    await am15Reveal(ctx, API_MOCK.IMPORT_REVIEW);
  } else {
    await ctx.click(API_MOCK.IMPORT_MENU);
    await ctx.waitFor(API_MOCK.IMPORT_REVIEW, 10_000);
  }
}

export async function selectAm15Source(
  ctx: DemoActionContext,
  id: string,
  visible: boolean,
): Promise<void> {
  await openAm15Import(ctx, visible);
  if (isAm15SourceActive(id)) return;
  const selector = API_MOCK.importSource(id);
  if (!firstVisibleElement(selector)) return;
  if (visible) await am15Aim(ctx, selector);
  else await ctx.click(selector);
  await ctx.delay(visible ? T.panelReady : 200);
}

async function quietParsePaste(ctx: DemoActionContext, source: string, payload: string): Promise<void> {
  await selectAm15Source(ctx, source, false);
  if (firstVisibleElement(API_MOCK.IMPORT_PASTE)) {
    await ctx.fill(API_MOCK.IMPORT_PASTE, payload);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_PREVIEW, 10_000);
  }
}

async function quietConfirm(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) return;
  await ctx.click(API_MOCK.IMPORT_CONFIRM);
  await ctx.delay(500);
}

export async function ensureAm15CurlPreview(ctx: DemoActionContext): Promise<void> {
  await openAm15Import(ctx, false);
  if (isAm15CurlGeneralized()) return;
  await selectAm15Source(ctx, 'curl', false);
  if (firstVisibleElement(API_MOCK.CURL_INPUT)) {
    await ctx.fill(API_MOCK.CURL_INPUT, AM15_CURL);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_FOLDER)) {
    await ctx.click(API_MOCK.IMPORT_FOLDER);
    await ctx.waitFor(API_MOCK.IMPORT_FOLDER_NEW, 2_000);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_FOLDER_NEW)) {
    await ctx.click(API_MOCK.IMPORT_FOLDER_NEW);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_NEW_FOLDER_NAME)) {
    await ctx.fill(API_MOCK.IMPORT_NEW_FOLDER_NAME, AM15_FOLDER);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PRIORITY)) {
    await ctx.fill(API_MOCK.IMPORT_PRIORITY, AM15_PRIORITY);
  }
  if (firstVisibleElement(API_MOCK.CURL_PARSE)) {
    await ctx.click(API_MOCK.CURL_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_PREVIEW, 10_000);
  }
  if (!isAm15CurlGeneralized() && firstVisibleElement(API_MOCK.IMPORT_GENERALIZE)) {
    await ctx.click(API_MOCK.IMPORT_GENERALIZE);
  }
}

export async function ensureAm15CurlDraft(ctx: DemoActionContext): Promise<void> {
  await ensureAm15Server(ctx);
  if (hasAm15Draft()) {
    await closeAm15Import(ctx);
    return;
  }
  await ensureAm15CurlPreview(ctx);
  await quietConfirm(ctx);
  await closeAm15Import(ctx);
}

export async function ensureAm15OpenApiDrafts(ctx: DemoActionContext): Promise<void> {
  await ensureAm15CurlDraft(ctx);
  if (am15DraftCount() >= 4) {
    await closeAm15Import(ctx);
    return;
  }
  await quietParsePaste(ctx, 'openapi', AM15_OPENAPI);
  await quietConfirm(ctx);
  await closeAm15Import(ctx);
}

export async function ensureAm15HarDrafts(ctx: DemoActionContext): Promise<void> {
  await ensureAm15OpenApiDrafts(ctx);
  if (am15DraftCount() >= 6) {
    await closeAm15Import(ctx);
    return;
  }
  await quietParsePaste(ctx, 'har', AM15_HAR);
  await quietConfirm(ctx);
  await closeAm15Import(ctx);
}

async function clickVisiblePicks(
  ctx: DemoActionContext,
  listSelector: string,
): Promise<void> {
  const boxes = Array.from(document.querySelectorAll<HTMLInputElement>(`${listSelector} input[type="checkbox"]`));
  for (const box of boxes) {
    if (box.checked) continue;
    const id = box.getAttribute('data-testid');
    if (!id) continue;
    await ctx.click(`[data-testid="${id}"]`);
  }
}

export async function ensureAm15InternalDrafts(ctx: DemoActionContext): Promise<void> {
  await ensureAm15HarDrafts(ctx);
  if (am15DraftCount() >= 8) {
    await closeAm15Import(ctx);
    return;
  }
  await selectAm15Source(ctx, 'catalog', false);
  if (firstVisibleElement(API_MOCK.IMPORT_CATALOG_FILTER)) {
    await ctx.fill(API_MOCK.IMPORT_CATALOG_FILTER, AM15_FILTER);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_CATALOG_SELECT_ALL)) {
    await ctx.click(API_MOCK.IMPORT_CATALOG_SELECT_ALL);
  } else {
    await clickVisiblePicks(ctx, API_MOCK.IMPORT_CATALOG_LIST);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_PREVIEW, 10_000);
  }
  await quietConfirm(ctx);
  await selectAm15Source(ctx, 'requests', false);
  if (firstVisibleElement(API_MOCK.IMPORT_REQUESTS_FILTER)) {
    await ctx.fill(API_MOCK.IMPORT_REQUESTS_FILTER, AM15_FILTER);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_REQUESTS_SELECT_ALL)) {
    await ctx.click(API_MOCK.IMPORT_REQUESTS_SELECT_ALL);
  } else {
    await clickVisiblePicks(ctx, API_MOCK.IMPORT_REQUESTS_LIST);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_PREVIEW, 10_000);
  }
  await quietConfirm(ctx);
  await closeAm15Import(ctx);
}

export async function ensureAm15Running(ctx: DemoActionContext): Promise<void> {
  await ensureAm15Server(ctx);
  if (isAm15ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, 20_000);
}

export async function ensureAm15ForCurl(ctx: DemoActionContext): Promise<void> {
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForDrafts(ctx: DemoActionContext): Promise<void> {
  await ensureAm15CurlPreview(ctx);
}

export async function ensureAm15ForOpenApi(ctx: DemoActionContext): Promise<void> {
  await ensureAm15CurlDraft(ctx);
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForWireMock(ctx: DemoActionContext): Promise<void> {
  await ensureAm15OpenApiDrafts(ctx);
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForHar(ctx: DemoActionContext): Promise<void> {
  await ensureAm15OpenApiDrafts(ctx);
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForInternal(ctx: DemoActionContext): Promise<void> {
  await ensureAm15HarDrafts(ctx);
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForReplace(ctx: DemoActionContext): Promise<void> {
  await ensureAm15InternalDrafts(ctx);
  await openAm15Import(ctx, false);
}

export async function ensureAm15ForProve(ctx: DemoActionContext): Promise<void> {
  await ensureAm15InternalDrafts(ctx);
  await closeAm15Import(ctx);
  await ensureAm15Running(ctx);
  await selectAm15ProveDraft(ctx, false);
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const newest = journalRows()[0];
  if (newest) await ctx.click(`[data-testid="${newest.getAttribute('data-testid')}"]`);
}

async function applyIfPresent(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.DIRTY_BADGE)) {
    await am15Look(ctx, API_MOCK.DIRTY_BADGE);
  }
  if (firstVisibleElement(API_MOCK.APPLY)) {
    await am15Aim(ctx, API_MOCK.APPLY);
    await ctx.delay(T.lifecycle);
  }
}

async function openJournalMatched(ctx: DemoActionContext): Promise<void> {
  await am15Payoff(ctx, API_MOCK.LIVE_TRANSACTIONS);
  await am15Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, 0);
  await am15Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.payoff);
  await clickNewestJournalRow(ctx);
  await am15Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  if (firstVisibleElement(API_MOCK.TX_OUTCOME)) {
    await am15Payoff(ctx, API_MOCK.TX_OUTCOME);
  }
}

export async function runAm15ImportPanel(ctx: DemoActionContext): Promise<void> {
  await ensureAm15Server(ctx);
  await openAm15Import(ctx, true);
  await am15Look(ctx, API_MOCK.IMPORT_SOURCES);
  await am15Look(ctx, API_MOCK.importSource('curl'));
  await am15Look(ctx, API_MOCK.importSource('native'));
  await am15Look(ctx, API_MOCK.IMPORT_MODE_MERGE);
  await am15Look(ctx, API_MOCK.IMPORT_MODE_REPLACE);
  await am15Look(ctx, API_MOCK.IMPORT_MODE_COPY);
  await am15Payoff(ctx, API_MOCK.IMPORT_REVIEW);
}

export async function runAm15Curl(ctx: DemoActionContext): Promise<void> {
  await selectAm15Source(ctx, 'curl', true);
  await am15Fill(ctx, API_MOCK.CURL_INPUT, AM15_CURL, T.payoff);
  await am15Click(ctx, API_MOCK.CURL_PARSE, T.payoff);
  await am15Reveal(ctx, API_MOCK.IMPORT_PREVIEW, T.payoff);
  await am15Look(ctx, API_MOCK.IMPORT_PREVIEW_PATH);
  await am15Break(ctx);
  await am15Aim(ctx, API_MOCK.IMPORT_FOLDER);
  await ctx.waitFor(API_MOCK.IMPORT_FOLDER_MENU, 4_000);
  if (firstVisibleElement(API_MOCK.IMPORT_FOLDER_NEW)) {
    await am15Click(ctx, API_MOCK.IMPORT_FOLDER_NEW);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_NEW_FOLDER_NAME)) {
    await am15Fill(ctx, API_MOCK.IMPORT_NEW_FOLDER_NAME, AM15_FOLDER);
  }
  await am15Fill(ctx, API_MOCK.IMPORT_PRIORITY, AM15_PRIORITY);
  await am15Look(ctx, API_MOCK.IMPORT_PREVIEW);
  await am15Break(ctx);
  await am15Click(ctx, API_MOCK.IMPORT_GENERALIZE, T.payoff);
  await am15Payoff(ctx, API_MOCK.IMPORT_PREVIEW_PATH);
}

export async function runAm15Drafts(ctx: DemoActionContext): Promise<void> {
  await ensureAm15CurlPreview(ctx);
  await am15Click(ctx, API_MOCK.IMPORT_CONFIRM, T.payoff);
  await am15Reveal(ctx, API_MOCK.DRAFT_ROUTE, T.payoff);
  await am15Look(ctx, API_MOCK.DRAFT_ROUTE);
  if (firstVisibleElement(API_MOCK.ROUTES_FOOTER)) {
    await am15Look(ctx, API_MOCK.ROUTES_FOOTER);
  }
  await am15Payoff(ctx, API_MOCK.DRAFT_ROUTE);
}

export async function runAm15OpenApi(ctx: DemoActionContext): Promise<void> {
  await selectAm15Source(ctx, 'openapi', true);
  await am15Fill(ctx, API_MOCK.IMPORT_PASTE, AM15_OPENAPI, T.payoff);
  await prettyFormatImportPaste(ctx, { look: T.look, hold: T.payoff });
  await am15Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
  await am15Reveal(ctx, API_MOCK.IMPORT_ROUTE_LIST, T.payoff);
  await am15Look(ctx, API_MOCK.IMPORT_ROUTE_LIST);
  if (firstVisibleElement(API_MOCK.IMPORT_LOSS)) {
    await am15Look(ctx, API_MOCK.IMPORT_LOSS);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_FOLDER)) {
    await am15Look(ctx, API_MOCK.IMPORT_FOLDER);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PREVIEW)) {
    await am15Look(ctx, API_MOCK.IMPORT_PREVIEW);
  }
  await am15Payoff(ctx, API_MOCK.IMPORT_REVIEW);
  await am15Break(ctx);
  await clickBeat(ctx, API_MOCK.IMPORT_CONFIRM, { look: 2400, hold: T.payoff });
  await ctx.waitFor(API_MOCK.DRAFT_ROUTE, 10_000);
  const drafts = am15DraftRows().slice(-3);
  for (const row of drafts) {
    await spotlightElementBeat(ctx, row, T.look);
  }
  await am15Payoff(ctx, API_MOCK.ROUTES_FOOTER);
}

export async function runAm15WireMock(ctx: DemoActionContext): Promise<void> {
  await selectAm15Source(ctx, 'wiremock', true);
  await am15Fill(ctx, API_MOCK.IMPORT_PASTE, AM15_WIREMOCK, T.payoff);
  await prettyFormatImportPaste(ctx, { look: T.look, hold: T.payoff });
  await am15Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
  await am15Reveal(ctx, API_MOCK.IMPORT_PREVIEW, T.payoff);
  await am15Look(ctx, API_MOCK.IMPORT_PREVIEW);
  if (firstVisibleElement(API_MOCK.IMPORT_PREVIEW_PATH)) {
    await am15Look(ctx, API_MOCK.IMPORT_PREVIEW_PATH);
  }
  await am15Payoff(ctx, API_MOCK.IMPORT_PREVIEW);
}

export async function runAm15Har(ctx: DemoActionContext): Promise<void> {
  await selectAm15Source(ctx, 'har', true);
  await am15Fill(ctx, API_MOCK.IMPORT_PASTE, AM15_HAR, T.payoff);
  await prettyFormatImportPaste(ctx, { look: T.look, hold: T.payoff });
  await am15Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
  await am15Reveal(ctx, API_MOCK.IMPORT_ROUTE_LIST, T.payoff);
  await am15Look(ctx, API_MOCK.IMPORT_ROUTE_LIST);
  await am15Break(ctx);
  await am15Click(ctx, API_MOCK.IMPORT_CONFIRM, T.payoff);
  await ctx.waitFor(API_MOCK.DRAFT_ROUTE, 10_000);
  await am15Payoff(ctx, API_MOCK.ROUTES_FOOTER);
}

async function promotePickList(
  ctx: DemoActionContext,
  source: 'catalog' | 'requests',
  filter: string,
  selectAll: string,
  list: string,
): Promise<void> {
  await selectAm15Source(ctx, source, true);
  await am15Reveal(ctx, list);
  if (firstVisibleElement(filter)) {
    await am15Fill(ctx, filter, AM15_FILTER);
  }
  if (firstVisibleElement(selectAll)) {
    await am15Click(ctx, selectAll, T.payoff);
  } else {
    await clickVisiblePicks(ctx, list);
  }
  await am15Look(ctx, list);
  await am15Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
  await am15Reveal(ctx, API_MOCK.IMPORT_PREVIEW, T.payoff);
  await am15Click(ctx, API_MOCK.IMPORT_CONFIRM, T.payoff);
  await ctx.delay(T.panelReady);
}

export async function runAm15InternalSources(ctx: DemoActionContext): Promise<void> {
  await promotePickList(
    ctx,
    'catalog',
    API_MOCK.IMPORT_CATALOG_FILTER,
    API_MOCK.IMPORT_CATALOG_SELECT_ALL,
    API_MOCK.IMPORT_CATALOG_LIST,
  );
  await am15Break(ctx);
  await promotePickList(
    ctx,
    'requests',
    API_MOCK.IMPORT_REQUESTS_FILTER,
    API_MOCK.IMPORT_REQUESTS_SELECT_ALL,
    API_MOCK.IMPORT_REQUESTS_LIST,
  );
  await ctx.waitFor(API_MOCK.DRAFT_ROUTE, 10_000);
  await am15Payoff(ctx, API_MOCK.ROUTES_FOOTER);
}

export async function runAm15ReplaceMode(ctx: DemoActionContext): Promise<void> {
  await openAm15Import(ctx, true);
  await am15Look(ctx, API_MOCK.IMPORT_MODE_REPLACE);
  await am15Aim(ctx, API_MOCK.IMPORT_MODE_REPLACE);
  await am15Reveal(ctx, API_MOCK.IMPORT_REPLACE_WARNING, T.payoff);
  await am15Payoff(ctx, API_MOCK.IMPORT_REPLACE_WARNING);
}

export async function runAm15EnableAndProve(ctx: DemoActionContext): Promise<void> {
  await closeAm15Import(ctx);
  await selectAm15ProveDraft(ctx, true);
  if (!isAm15RouteEnabled() && firstVisibleElement(API_MOCK.ROUTE_ENABLED)) {
    await am15Click(ctx, API_MOCK.ROUTE_ENABLED);
  }
  await am15Payoff(ctx, API_MOCK.ROUTE_ENABLED);
  await am15Break(ctx);
  await applyIfPresent(ctx);
  await sendApiMockRequest({ path: AM15_PROVE_PATH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await openJournalMatched(ctx);
}

// ── Push-from-clients (Requests + Catalog → Export to API Mock) ────────────

export const AM15_PUSH_REQ_NAME = 'List inventory';
export const AM15_PUSH_CAT_ENTRY = AM15_CATALOG_NAME;
export const AM15_PUSH_CAT_PATH = '/catalog/widgets';
const REVEAL_MS = 3_000;

/** Trigger the browser contextmenu event on a request sidebar item by name. */
function triggerRequestContextMenu(reqName: string): void {
  const el = document.querySelector<HTMLElement>(REQ.reqByName(reqName));
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
}

export function hasAm15PushRouteFromRequests(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('.am-route-path'))
    .some(el => el.textContent?.trim().includes('inventory'));
}

export function hasAm15PushRouteFromCatalog(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('.am-route-path'))
    .some(el => el.textContent?.trim().includes('catalog/widgets'));
}

async function closeExportToMockModal(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.EXPORT_TO_MOCK_BODY)) return;
  const cancel = firstVisibleElement(API_MOCK.EXPORT_TO_MOCK_CANCEL);
  if (cancel) {
    await ctx.click(API_MOCK.EXPORT_TO_MOCK_CANCEL);
    await ctx.delay(300);
  }
}

/** Navigate to the Requests tab and open the context menu for a saved request. */
async function pushFromRequests(ctx: DemoActionContext): Promise<void> {
  // Expand the unified sidebar BEFORE navigating — the sidebar mounts only when
  // sidebarCollapsed=false. Without this, REQ.SIDEBAR is absent from the DOM
  // entirely, and the contextmenu event fires on a non-existent element.
  expandAppSidebar();
  await ctx.delay(400);

  ctx.navigateToTab('requests');

  // Wait until the sidebar element is in the DOM AND has real layout dimensions.
  // ctx.waitFor only checks DOM presence; we need actual width/height > 0.
  for (let i = 0; i < 30; i++) {
    if (firstVisibleElement(REQ.SIDEBAR)) break;
    await ctx.delay(200);
  }
  await ctx.delay(T.tabSwitch);

  // Spotlight the sidebar so the viewer's eye lands on the left panel.
  await spotlightBeat(ctx, REQ.SIDEBAR, T.look);

  const reqSel = REQ.reqInCollection(AM15_REQUESTS_NAME, AM15_PUSH_REQ_NAME);
  const colSel = REQ.colByName(AM15_REQUESTS_NAME);

  // If the seeded request isn't visible the collection is collapsed — expand it
  // with a visible clickBeat so the viewer sees the collection open.
  if (!firstVisibleElement(reqSel) && firstVisibleElement(colSel)) {
    await clickBeat(ctx, colSel, { look: T.look, hold: T.fieldFilled });
  }

  // Spotlight the specific request item.
  await spotlightBeat(ctx, reqSel, T.look);

  // Programmatic right-click — element has real bounding rect now so the context
  // menu positions correctly next to the item on screen.
  triggerRequestContextMenu(AM15_PUSH_REQ_NAME);
  await ctx.waitFor(REQ.CONTEXT_MENU, 4_000);
  await ctx.delay(500);

  // Spotlight and click "Export to API Mock".
  await spotlightBeat(ctx, REQ.CTX_EXPORT_TO_MOCK, T.look);
  await ctx.click(REQ.CTX_EXPORT_TO_MOCK);
  await ctx.waitFor(API_MOCK.EXPORT_TO_MOCK_BODY, 6_000);
  await ctx.delay(T.panelReady);
}

/** Navigate to the Catalog tab and click the "Export to API Mock" button. */
async function pushFromCatalog(ctx: DemoActionContext): Promise<void> {
  // Ensure sidebar is expanded so the Catalog sidebar tree is mounted.
  expandAppSidebar();
  await ctx.delay(400);

  ctx.navigateToTab('catalog');
  // Wait for sidebar to have real layout dimensions, not just DOM presence.
  for (let i = 0; i < 30; i++) {
    if (firstVisibleElement(CAT.SIDEBAR)) break;
    await ctx.delay(200);
  }
  await ctx.delay(T.tabSwitch);

  // Select the seeded demo catalog entry with a visible spotlight.
  const entrySel = CAT.entryByName(AM15_PUSH_CAT_ENTRY);
  if (firstVisibleElement(entrySel)) {
    await clickBeat(ctx, entrySel, { look: T.look, hold: T.panelReady });
  }

  // Switch to the Endpoints sub-tab with a spotlight so the viewer sees the tab change.
  if (firstVisibleElement(CAT.VIEW_ENDPOINTS)) {
    await clickBeat(ctx, CAT.VIEW_ENDPOINTS, { look: T.look, hold: T.panelReady });
  }

  // Spotlight the first endpoint card header so the viewer knows where to look.
  await spotlightBeat(ctx, CAT.ENDPOINT_CARD, T.look);

  // Step 1: Click the card header row to expand the card body.
  // The outer .sw-card div does NOT toggle expanded — only .sw-header does.
  await clickBeat(ctx, CAT.ENDPOINT_CARD_HEADER, { look: T.look, hold: T.fieldFilled });

  // Step 2: Click "Try it out" — only rendered after the card is expanded AND
  // the endpoint has parameters (guaranteed by the seeded spec).
  if (firstVisibleElement(CAT.TRYIT_BTN)) {
    await clickBeat(ctx, CAT.TRYIT_BTN, { look: T.look, hold: T.fieldFilled });
  }

  // Step 3: Spotlight and click "Export to API Mock" (only visible after tryItOpen=true).
  if (!firstVisibleElement(CAT.EXPORT_TO_MOCK_BTN)) return;
  await spotlightBeat(ctx, CAT.EXPORT_TO_MOCK_BTN, T.look);
  await ctx.click(CAT.EXPORT_TO_MOCK_BTN);
  await ctx.waitFor(API_MOCK.EXPORT_TO_MOCK_BODY, 6_000);
  await ctx.delay(T.panelReady);
}

/** Configure and confirm the ExportToApiMockModal. */
async function confirmExportToMockModal(ctx: DemoActionContext): Promise<void> {
  // Spotlight the server selector (the target API Mock server)
  if (firstVisibleElement(API_MOCK.EXPORT_TO_MOCK_SERVER)) {
    await spotlightBeat(ctx, API_MOCK.EXPORT_TO_MOCK_SERVER, T.look);
  }
  // Spotlight the routes preview
  if (firstVisibleElement(API_MOCK.EXPORT_TO_MOCK_ROUTES)) {
    await spotlightBeat(ctx, API_MOCK.EXPORT_TO_MOCK_ROUTES, T.fieldFilled);
  }
  // Confirm
  if (firstVisibleElement(API_MOCK.EXPORT_TO_MOCK_CONFIRM)) {
    await am15Click(ctx, API_MOCK.EXPORT_TO_MOCK_CONFIRM, T.panelReady);
  }
  await ctx.waitFor(`:not(${API_MOCK.EXPORT_TO_MOCK_BODY})`, REVEAL_MS).catch(() => undefined);
  await ctx.delay(T.panelReady);
}

export async function runAm15PushFromClients(ctx: DemoActionContext): Promise<void> {
  // ── Group 1: Push from Requests ──────────────────────────────────────────
  await pushFromRequests(ctx);
  await confirmExportToMockModal(ctx);
  await am15Break(ctx);

  // ── Group 2: Push from Catalog ───────────────────────────────────────────
  await pushFromCatalog(ctx);
  await confirmExportToMockModal(ctx);
  await am15Break(ctx);

  // ── Return to API Mock Studio and show the result ─────────────────────────
  ctx.navigateToTab('api-mock-studio');
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 8_000);
  await ctx.delay(T.tabSwitch);
  await am15Payoff(ctx, API_MOCK.ROUTES_FOOTER);
}

export async function ensureAm15ForPushFromClients(ctx: DemoActionContext): Promise<void> {
  // Close stray Export to API Mock modal if open from a prior run
  await closeExportToMockModal(ctx);
  // Ensure the server is present and import is closed
  await closeAm15Import(ctx);
  await ensureAm15Server(ctx);
  // If we're not on API Mock Studio, navigate back
  if (!isAm15StudioViewActive()) {
    ctx.navigateToTab('api-mock-studio');
    await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 6_000).catch(() => undefined);
  }
}
