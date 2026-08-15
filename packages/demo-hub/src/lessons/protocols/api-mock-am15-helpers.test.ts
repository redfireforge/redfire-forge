/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const ensureBlankApiMockServer = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true}' }));
const isCatalogLoaded = vi.fn(() => true);
const seedCatalogEntry = vi.fn(async () => 'cat-1');
const seedRequestCollection = vi.fn(() => 'col-1');
const deleteCatalogEntryByName = vi.fn();
const deleteCollectionsByName = vi.fn(() => 1);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  ensureBlankApiMockServer: (...a: unknown[]) => ensureBlankApiMockServer(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  isCatalogLoaded: (...a: unknown[]) => isCatalogLoaded(...(a as [])),
  seedCatalogEntry: (...a: unknown[]) => seedCatalogEntry(...(a as [])),
  seedRequestCollection: (...a: unknown[]) => seedRequestCollection(...(a as [])),
  deleteCatalogEntryByName: (...a: unknown[]) => deleteCatalogEntryByName(...(a as [])),
  deleteCollectionsByName: (...a: unknown[]) => deleteCollectionsByName(...(a as [])),
}));

import {
  AM15_CATALOG_NAME,
  AM15_CURL,
  AM15_FOLDER,
  AM15_GENERALIZED,
  AM15_HAR,
  AM15_OPENAPI,
  AM15_PRIORITY,
  AM15_PROVE_PATH,
  AM15_REQUESTS_NAME,
  AM15_TIMING,
  AM15_WIREMOCK,
  am15DraftCount,
  am15PreviewPath,
  am15ProveDraftRow,
  cleanupAm15,
  closeAm15Import,
  ensureAm15CurlDraft,
  ensureAm15CurlPreview,
  ensureAm15ForCurl,
  ensureAm15ForDrafts,
  ensureAm15ForHar,
  ensureAm15ForInternal,
  ensureAm15ForOpenApi,
  ensureAm15ForProve,
  ensureAm15ForReplace,
  ensureAm15ForWireMock,
  ensureAm15HarDrafts,
  ensureAm15InternalDrafts,
  ensureAm15OpenApiDrafts,
  ensureAm15Running,
  ensureAm15Server,
  ensureAm15StudioView,
  hasAm15Draft,
  hasAm15Server,
  hasAm15Traffic,
  isAm15CurlGeneralized,
  isAm15ImportOpen,
  isAm15ReplaceWarningVisible,
  isAm15RouteEnabled,
  isAm15ServerRunning,
  isAm15SourceActive,
  isAm15StudioViewActive,
  openAm15Import,
  prepareAm15Workspace,
  runAm15Curl,
  runAm15Drafts,
  runAm15EnableAndProve,
  runAm15Har,
  runAm15ImportPanel,
  runAm15InternalSources,
  runAm15OpenApi,
  runAm15ReplaceMode,
  runAm15WireMock,
  selectAm15Source,
} from './api-mock-am15-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement(inputTag(testid));
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function inputTag(testid: string): 'input' | 'textarea' {
  if (testid.includes('paste') || testid.includes('curl-input')) return 'textarea';
  return 'input';
}

function mountServerBar(running: boolean, extras: { apply?: boolean } = {}): void {
  const bar = el('div', 'am-server-bar', 'api-mock-server-bar');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status);
  if (running) bar.append(el('button', 'am-btn', 'api-mock-stop'));
  else bar.append(el('button', 'am-btn', 'api-mock-start'));
  if (extras.apply) bar.append(el('button', 'am-btn', 'api-mock-apply'));
  document.body.append(bar);
}

function mountExplorer(drafts = 1, enabled = 0): void {
  const explorer = el('div', 'am-explorer', 'api-mock-route-explorer');
  for (let i = 0; i < drafts; i++) {
    const row = el('button', 'am-route-item disabled', 'api-mock-route-row');
    row.setAttribute('role', 'treeitem');
    const path = el('span', 'am-route-path');
    path.textContent = i === 0 ? '/users/:id' : `/draft-${i}`;
    row.append(path);
    explorer.append(row);
  }
  for (let i = 0; i < enabled; i++) {
    const row = el('button', 'am-route-item', 'api-mock-route-row-on');
    row.setAttribute('role', 'treeitem');
    explorer.append(row);
  }
  const footer = el('span', 'am-faint', 'api-mock-routes-footer');
  footer.textContent = `${enabled} enabled · ${drafts} draft${drafts === 1 ? '' : 's'}`;
  explorer.append(footer);
  document.body.append(explorer);
}

function mountImport(opts: {
  source?: string;
  preview?: boolean;
  path?: string;
  generalize?: boolean;
  loss?: boolean;
  warning?: boolean;
  catalog?: boolean;
  requests?: boolean;
  routeList?: boolean;
} = {}): void {
  const review = el('div', 'api-mock-import-review', 'api-mock-import-review');
  const sources = el('aside', 'am-import-sources', 'api-mock-import-sources');
  for (const id of ['curl', 'openapi', 'catalog', 'requests', 'native', 'wiremock', 'har']) {
    const btn = el('button', `am-source-btn${id === (opts.source ?? 'curl') ? ' active' : ''}`, `api-mock-import-source-${id}`);
    sources.append(btn);
  }
  review.append(sources);
  review.append(el('button', opts.warning ? 'active' : '', 'api-mock-import-mode-merge'));
  review.append(el('button', opts.warning ? 'active' : '', 'api-mock-import-mode-replace'));
  review.append(el('button', undefined, 'api-mock-import-mode-copy'));
  if (opts.warning) review.append(el('div', 'am-notice danger', 'api-mock-import-replace-warning'));
  review.append(el('textarea', 'am-textarea', 'api-mock-curl-input'));
  review.append(el('button', 'am-btn', 'api-mock-curl-parse'));
  review.append(el('textarea', 'am-textarea', 'api-mock-import-paste'));
  review.append(el('button', 'am-format-badge', 'api-mock-import-pretty'));
  review.append(el('button', 'am-btn', 'api-mock-import-parse'));
  review.append(el('button', 'am-folder-trigger', 'api-mock-import-folder'));
  const folderMenu = el('div', 'am-folder-menu', 'api-mock-import-folder-menu');
  folderMenu.append(el('button', 'am-folder-option', 'api-mock-import-folder-new'));
  review.append(folderMenu);
  const folderName = input('api-mock-import-new-folder-name');
  review.append(folderName);
  const priority = input('api-mock-import-priority', '10');
  review.append(priority);
  if (opts.catalog) {
    review.append(input('api-mock-import-catalog-filter'));
    review.append(el('button', 'am-btn', 'api-mock-import-catalog-select-all'));
    const list = el('div', 'am-pick-list', 'api-mock-import-catalog-list');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('data-testid', 'api-mock-import-catalog-ep-1');
    makeVisible(box);
    list.append(box);
    review.append(list);
  }
  if (opts.requests) {
    review.append(input('api-mock-import-requests-filter'));
    review.append(el('button', 'am-btn', 'api-mock-import-requests-select-all'));
    const list = el('div', 'am-pick-list', 'api-mock-import-requests-list');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('data-testid', 'api-mock-import-request-req-1');
    makeVisible(box);
    list.append(box);
    review.append(list);
  }
  if (opts.preview) {
    const preview = el('div', 'am-import-result', 'api-mock-import-preview-block');
    const path = el('span', 'am-mono', 'api-mock-import-preview-path');
    path.textContent = opts.path ?? '/users/42';
    preview.append(path);
    if (opts.generalize) preview.append(el('button', 'am-btn', 'api-mock-import-generalize'));
    if (opts.loss) preview.append(el('div', 'am-notice', 'api-mock-import-loss'));
    if (opts.routeList) preview.append(el('ul', 'am-import-route-list', 'api-mock-import-route-list'));
    preview.append(el('button', 'am-btn primary', 'api-mock-import-confirm'));
    preview.append(el('button', 'am-btn', 'api-mock-import-cancel'));
    review.append(preview);
  }
  document.body.append(review);
  document.body.append(el('button', 'am-btn', 'api-mock-import-close'));
  document.body.append(el('button', 'am-btn', 'api-mock-import-menu'));
}

function mountEditor(enabled: boolean): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const toggle = el('button', undefined, 'api-mock-route-enabled');
  toggle.setAttribute('title', enabled ? 'Disable route' : 'Enable route');
  editor.append(toggle);
  document.body.append(editor);
}

function mountJournal(): void {
  const dock = el('div', undefined, 'api-mock-dock');
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  row.setAttribute('data-testid', 'api-mock-tx-1');
  makeVisible(row);
  tbody.append(row);
  table.append(tbody);
  dock.append(table);
  document.body.append(dock);
  document.body.append(el('div', undefined, 'api-mock-live-transactions'));
  const detail = el('div', undefined, 'api-mock-tx-detail');
  const outcome = el('span', undefined, 'api-mock-tx-outcome');
  outcome.textContent = 'matched';
  detail.append(outcome);
  document.body.append(detail);
}

describe('AM-15 import helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    isCatalogLoaded.mockReturnValue(true);
    ensureBlankApiMockServer.mockResolvedValue(true);
  });

  it('exports slower pacing and import fixtures', () => {
    expect(AM15_TIMING.beforeOpen).toBe(1400);
    expect(AM15_TIMING.payoff).toBe(1600);
    expect(AM15_CURL).toContain('/users/42');
    expect(AM15_GENERALIZED).toBe('/users/:id');
    expect(AM15_FOLDER).toBe('Imported');
    expect(AM15_PRIORITY).toBe('20');
    expect(JSON.parse(AM15_OPENAPI).paths['/widgets'].get).toBeTruthy();
    expect(JSON.parse(AM15_WIREMOCK).mappings).toHaveLength(1);
    const wm = JSON.parse(AM15_WIREMOCK).mappings[0];
    expect(wm.request.headers['X-Tenant'].equalTo).toBe('acme');
    expect(wm.request.queryParameters.page.equalTo).toBe('1');
    expect(wm.response.delayDistribution).toBeUndefined();
    expect(wm.response.fixedDelayMilliseconds).toBe(40);
    expect(JSON.parse(AM15_HAR).log.entries).toHaveLength(2);
    expect(AM15_PROVE_PATH).toBe('/users/42');
  });

  it('probes are false on an empty document', () => {
    expect(hasAm15Server()).toBe(false);
    expect(isAm15StudioViewActive()).toBe(false);
    expect(isAm15ImportOpen()).toBe(false);
    expect(isAm15ServerRunning()).toBe(false);
    expect(hasAm15Draft()).toBe(false);
    expect(am15DraftCount()).toBe(0);
    expect(am15PreviewPath()).toBe('');
    expect(isAm15CurlGeneralized()).toBe(false);
    expect(isAm15SourceActive('curl')).toBe(false);
    expect(isAm15ReplaceWarningVisible()).toBe(false);
    expect(isAm15RouteEnabled()).toBe(false);
    expect(hasAm15Traffic()).toBe(false);
  });

  it('probes read mounted studio, import, drafts, and journal', () => {
    mountServerBar(true);
    mountExplorer(2);
    mountImport({ source: 'curl', preview: true, path: '/users/:id', warning: true });
    mountEditor(true);
    mountJournal();
    expect(hasAm15Server()).toBe(true);
    expect(isAm15StudioViewActive()).toBe(true);
    expect(isAm15ImportOpen()).toBe(true);
    expect(isAm15ServerRunning()).toBe(true);
    expect(hasAm15Draft()).toBe(true);
    expect(am15DraftCount()).toBe(2);
    expect(isAm15CurlGeneralized()).toBe(true);
    expect(isAm15SourceActive('curl')).toBe(true);
    expect(isAm15ReplaceWarningVisible()).toBe(true);
    expect(isAm15RouteEnabled()).toBe(true);
    expect(hasAm15Traffic()).toBe(true);
  });

  it('prepare seeds a blank server plus Catalog and Requests; cleanup removes them', async () => {
    await prepareAm15Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(seedCatalogEntry).toHaveBeenCalledWith(AM15_CATALOG_NAME, expect.any(String));
    expect(seedRequestCollection).toHaveBeenCalledWith(AM15_REQUESTS_NAME, expect.any(Array));
    await cleanupAm15();
    expect(deleteCatalogEntryByName).toHaveBeenCalledWith(AM15_CATALOG_NAME);
    expect(deleteCollectionsByName).toHaveBeenCalledWith(AM15_REQUESTS_NAME);
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('prepare throws when the blank server cannot be created', async () => {
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    await expect(prepareAm15Workspace()).rejects.toThrow(/blank mock server/);
  });

  it('ensureAm15StudioView clicks Studio when the explorer is gone', async () => {
    const ctx = makeCtx();
    const studio = el('button', undefined, 'api-mock-view-studio');
    document.body.append(studio);
    await ensureAm15StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm15Server skips when the bar is already up', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    await ensureAm15Server(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm15Server falls back to Create first when the adapter fails', async () => {
    const ctx = makeCtx();
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    document.body.append(el('button', undefined, 'api-mock-create-first'));
    await ensureAm15Server(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.CREATE_FIRST);
  });

  it('open / close / select source are idempotent when already in place', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'openapi' });
    await openAm15Import(ctx, false);
    await closeAm15Import(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CLOSE);
    await selectAm15Source(ctx, 'openapi', false);
    expect(isAm15SourceActive('openapi')).toBe(true);
  });

  it('ensureAm15CurlPreview fills curl, folder, priority, and generalizes', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl', preview: true, path: '/users/42', generalize: true });
    await ensureAm15CurlPreview(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.CURL_INPUT, AM15_CURL);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_NEW_FOLDER_NAME, AM15_FOLDER);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PRIORITY, AM15_PRIORITY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_FOLDER);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_FOLDER_NEW);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_GENERALIZE);
  });

  it('ensure draft helpers skip when enough drafts already exist', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    await ensureAm15CurlDraft(ctx);
    await ensureAm15OpenApiDrafts(ctx);
    await ensureAm15HarDrafts(ctx);
    await ensureAm15InternalDrafts(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureAm15Running starts a stopped listener', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(1);
    await ensureAm15Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('ensureAm15For* open import or close it for the prove step', async () => {
    const ctx = makeCtx();
    mountServerBar(true, { apply: true });
    mountExplorer(8);
    mountImport({ source: 'curl' });
    await ensureAm15ForCurl(ctx);
    await ensureAm15ForDrafts(ctx);
    await ensureAm15ForOpenApi(ctx);
    await ensureAm15ForWireMock(ctx);
    await ensureAm15ForHar(ctx);
    await ensureAm15ForInternal(ctx);
    await ensureAm15ForReplace(ctx);
    await ensureAm15ForProve(ctx);
    expect(isAm15ServerRunning()).toBe(true);
  });

  it('runAm15ImportPanel opens review and holds sources and modes', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    document.body.append(el('button', 'am-btn', 'api-mock-import-menu'));
    await runAm15ImportPanel(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('runAm15Curl fills, parses, sets destination, and generalizes', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl', preview: true, path: '/users/42', generalize: true });
    await runAm15Curl(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.CURL_INPUT, AM15_CURL);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.CURL_PARSE);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PRIORITY, AM15_PRIORITY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_FOLDER_NEW);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_GENERALIZE);
  });

  it('runAm15Drafts confirms and holds the dimmed row', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(1);
    mountImport({ source: 'curl', preview: true, path: '/users/:id' });
    await runAm15Drafts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('runAm15OpenApi pastes the spec, parses, and confirms', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(4);
    mountImport({ source: 'openapi', preview: true, routeList: true });
    await runAm15OpenApi(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM15_OPENAPI);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PRETTY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PARSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('runAm15WireMock pastes mappings and holds the mapped preview', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(4);
    mountImport({ source: 'wiremock', preview: true });
    await runAm15WireMock(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM15_WIREMOCK);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PRETTY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PARSE);
  });

  it('runAm15Har pastes the capture and confirms', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(6);
    mountImport({ source: 'har', preview: true, routeList: true });
    await runAm15Har(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM15_HAR);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PRETTY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('runAm15InternalSources promotes catalog then requests', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    mountImport({ source: 'catalog', preview: true, catalog: true, requests: true });
    await runAm15InternalSources(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CATALOG_SELECT_ALL);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_REQUESTS_SELECT_ALL);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('runAm15ReplaceMode clicks Replace and holds the warning', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    mountImport({ warning: true });
    await runAm15ReplaceMode(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MODE_REPLACE);
  });

  it('runAm15EnableAndProve enables, applies, fetches, and opens the matched row', async () => {
    const ctx = makeCtx();
    mountServerBar(true, { apply: true });
    mountExplorer(1);
    mountEditor(false);
    mountJournal();
    document.body.append(el('span', undefined, 'api-mock-dirty-badge'));
    await runAm15EnableAndProve(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ENABLED);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM15_PROVE_PATH, method: 'GET' });
  });

  it('isAm15RouteEnabled is false for Enable-route title and empty', () => {
    expect(isAm15RouteEnabled()).toBe(false);
    mountEditor(false);
    expect(isAm15RouteEnabled()).toBe(false);
  });

  it('am15ProveDraftRow prefers the generalized /users/:id row', () => {
    mountExplorer(3);
    expect(am15ProveDraftRow()?.querySelector('.am-route-path')?.textContent).toBe('/users/:id');
  });

  it('ensureAm15CurlDraft confirms when no draft exists yet', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl', preview: true, path: '/users/:id', generalize: true });
    await ensureAm15CurlDraft(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CLOSE);
  });

  it('openAm15Import visible path rings the menu then reveals review', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    document.body.append(el('button', 'am-btn', 'api-mock-import-menu'));
    await openAm15Import(ctx, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('runAm15InternalSources ticks visible picks when Select all is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    const review = el('div', 'api-mock-import-review', 'api-mock-import-review');
    const sources = el('aside', 'am-import-sources', 'api-mock-import-sources');
    for (const id of ['catalog', 'requests']) {
      sources.append(el('button', `am-source-btn${id === 'catalog' ? ' active' : ''}`, `api-mock-import-source-${id}`));
    }
    review.append(sources);
    review.append(input('api-mock-import-catalog-filter'));
    const catalogList = el('div', 'am-pick-list', 'api-mock-import-catalog-list');
    const catBox = document.createElement('input');
    catBox.type = 'checkbox';
    catBox.setAttribute('data-testid', 'api-mock-import-catalog-ep-1');
    makeVisible(catBox);
    catalogList.append(catBox);
    review.append(catalogList);
    review.append(input('api-mock-import-requests-filter'));
    const reqList = el('div', 'am-pick-list', 'api-mock-import-requests-list');
    const reqBox = document.createElement('input');
    reqBox.type = 'checkbox';
    reqBox.setAttribute('data-testid', 'api-mock-import-request-req-1');
    makeVisible(reqBox);
    reqList.append(reqBox);
    review.append(reqList);
    const preview = el('div', 'am-import-result', 'api-mock-import-preview-block');
    preview.append(el('button', 'am-btn primary', 'api-mock-import-parse'));
    preview.append(el('button', 'am-btn primary', 'api-mock-import-confirm'));
    review.append(preview);
    document.body.append(review);
    document.body.append(el('button', 'am-btn', 'api-mock-import-menu'));
    await runAm15InternalSources(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-import-catalog-ep-1"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-import-request-req-1"]');
  });

  it('ensureAm15InternalDrafts ticks picks when Select all is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(2);
    const review = el('div', 'api-mock-import-review', 'api-mock-import-review');
    const sources = el('aside', 'am-import-sources', 'api-mock-import-sources');
    sources.append(el('button', 'am-source-btn active', 'api-mock-import-source-catalog'));
    sources.append(el('button', 'am-source-btn', 'api-mock-import-source-requests'));
    review.append(sources);
    const catalogList = el('div', 'am-pick-list', 'api-mock-import-catalog-list');
    const catBox = document.createElement('input');
    catBox.type = 'checkbox';
    catBox.setAttribute('data-testid', 'api-mock-import-catalog-ep-quiet');
    makeVisible(catBox);
    catalogList.append(catBox);
    review.append(catalogList);
    review.append(input('api-mock-import-catalog-filter'));
    review.append(input('api-mock-import-requests-filter'));
    const reqList = el('div', 'am-pick-list', 'api-mock-import-requests-list');
    const reqBox = document.createElement('input');
    reqBox.type = 'checkbox';
    reqBox.setAttribute('data-testid', 'api-mock-import-request-quiet');
    makeVisible(reqBox);
    reqList.append(reqBox);
    review.append(reqList);
    review.append(el('button', 'am-btn', 'api-mock-import-parse'));
    review.append(el('button', 'am-btn primary', 'api-mock-import-confirm'));
    review.append(el('button', 'am-btn', 'api-mock-import-close'));
    document.body.append(review);
    await ensureAm15InternalDrafts(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-import-catalog-ep-quiet"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-import-request-quiet"]');
  });

  it('prepare waits until the catalog bridge is loaded', async () => {
    isCatalogLoaded.mockReturnValueOnce(false).mockReturnValue(true);
    await prepareAm15Workspace();
    expect(seedCatalogEntry).toHaveBeenCalled();
  });

  it('ensureAm15Server waits after the adapter creates the blank server', async () => {
    const ctx = makeCtx();
    await ensureAm15Server(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.SERVER_BAR, 10_000);
  });

  it('ensureAm15CurlPreview skips when the path is already generalized', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl', preview: true, path: '/users/:id' });
    await ensureAm15CurlPreview(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('selectAm15Source visible path switches off the current source', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl' });
    await selectAm15Source(ctx, 'openapi', true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.importSource('openapi'));
  });

  it('openAm15Import quiet path clicks the menu without a ring', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    document.body.append(el('button', 'am-btn', 'api-mock-import-menu'));
    await openAm15Import(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('ensureAm15InternalDrafts uses Select all when the buttons exist', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(2);
    mountImport({ source: 'catalog', preview: true, catalog: true, requests: true });
    await ensureAm15InternalDrafts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CATALOG_SELECT_ALL);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_REQUESTS_SELECT_ALL);
  });

  it('ensureAm15Running is a no-op when the listener is already up', async () => {
    const ctx = makeCtx();
    mountServerBar(true);
    mountExplorer(1);
    await ensureAm15Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm15Import no-ops when the review has no close control', async () => {
    const ctx = makeCtx();
    document.body.append(el('div', 'api-mock-import-review', 'api-mock-import-review'));
    await closeAm15Import(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('clickVisiblePicks skips checked boxes and boxes without a testid', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    mountImport({ source: 'catalog', preview: true, catalog: true, requests: true });
    document.querySelector('[data-testid="api-mock-import-catalog-select-all"]')?.remove();
    document.querySelector('[data-testid="api-mock-import-requests-select-all"]')?.remove();
    const cat = document.querySelector<HTMLInputElement>('[data-testid="api-mock-import-catalog-ep-1"]');
    if (cat) cat.checked = true;
    const req = document.querySelector<HTMLInputElement>('[data-testid="api-mock-import-request-req-1"]');
    req?.removeAttribute('data-testid');
    await runAm15InternalSources(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="api-mock-import-catalog-ep-1"]');
  });

  it('runAm15EnableAndProve still fetches when Apply is absent', async () => {
    const ctx = makeCtx();
    mountServerBar(true);
    mountExplorer(1);
    mountEditor(true);
    const dock = el('div', undefined, 'api-mock-dock');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('data-testid', 'api-mock-tx-1');
    makeVisible(row);
    tbody.append(row);
    table.append(tbody);
    dock.append(table);
    document.body.append(dock);
    document.body.append(el('div', undefined, 'api-mock-live-transactions'));
    document.body.append(el('div', undefined, 'api-mock-tx-detail'));
    await runAm15EnableAndProve(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('ensureAm15StudioView is a no-op when the explorer is already visible', async () => {
    const ctx = makeCtx();
    mountExplorer(0);
    await ensureAm15StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm15Server no-ops when the adapter fails and Create first is missing', async () => {
    const ctx = makeCtx();
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    await ensureAm15Server(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openAm15Import returns when the Import control is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    await openAm15Import(ctx, true);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('selectAm15Source returns when the source button is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    const review = el('div', 'api-mock-import-review', 'api-mock-import-review');
    document.body.append(review);
    await selectAm15Source(ctx, 'wiremock', false);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.importSource('wiremock'));
  });

  it('ensureAm15OpenApiDrafts pastes when fewer than four drafts exist', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(1);
    mountImport({ source: 'curl', preview: true, path: '/users/:id' });
    await ensureAm15OpenApiDrafts(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM15_OPENAPI);
  });

  it('ensureAm15HarDrafts pastes when fewer than six drafts exist', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(4);
    mountImport({ source: 'openapi', preview: true });
    await ensureAm15HarDrafts(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM15_HAR);
  });

  it('am15ProveDraftRow is undefined when no drafts exist', () => {
    expect(am15ProveDraftRow()).toBeUndefined();
  });

  it('prove selection skips a draft row without a testid', async () => {
    const ctx = makeCtx();
    mountServerBar(true);
    const explorer = el('div', 'am-explorer', 'api-mock-route-explorer');
    const row = el('button', 'am-route-item disabled');
    row.setAttribute('role', 'treeitem');
    explorer.append(row);
    document.body.append(explorer);
    mountEditor(true);
    await runAm15EnableAndProve(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('prepare still seeds when catalog never reports loaded', async () => {
    isCatalogLoaded.mockReturnValue(false);
    await prepareAm15Workspace();
    expect(seedCatalogEntry).toHaveBeenCalled();
  }, 10_000);

  it('ensureAm15Running returns when Start is missing on a stopped server', async () => {
    const ctx = makeCtx();
    const bar = el('div', 'am-server-bar', 'api-mock-server-bar');
    const status = el('span', undefined, 'api-mock-status-label');
    status.textContent = 'Stopped';
    bar.append(status);
    document.body.append(bar);
    mountExplorer(1);
    await ensureAm15Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('runAm15Curl still generalizes when the folder menu is closed', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(0);
    mountImport({ source: 'curl', preview: true, path: '/users/42', generalize: true });
    document.querySelector('[data-testid="api-mock-import-folder-menu"]')?.remove();
    document.querySelector('[data-testid="api-mock-import-new-folder-name"]')?.remove();
    await runAm15Curl(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_GENERALIZE);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.IMPORT_FOLDER_NEW);
  });

  it('runAm15Drafts still pays off when the footer is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(1);
    document.querySelector('[data-testid="api-mock-routes-footer"]')?.remove();
    mountImport({ source: 'curl', preview: true, path: '/users/:id' });
    await runAm15Drafts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('ensureAm15InternalDrafts continues when Parse is missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(2);
    mountImport({ source: 'catalog', preview: true, catalog: true, requests: true });
    document.querySelectorAll('[data-testid="api-mock-import-parse"]').forEach(n => n.remove());
    await ensureAm15InternalDrafts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CATALOG_SELECT_ALL);
  });

  it('runAm15InternalSources still confirms when filters are missing', async () => {
    const ctx = makeCtx();
    mountServerBar(false);
    mountExplorer(8);
    mountImport({ source: 'catalog', preview: true, catalog: true, requests: true });
    document.querySelector('[data-testid="api-mock-import-catalog-filter"]')?.remove();
    document.querySelector('[data-testid="api-mock-import-requests-filter"]')?.remove();
    await runAm15InternalSources(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CATALOG_SELECT_ALL);
  });

  it('closeAm15Import falls back to Cancel when Close is missing', async () => {
    const ctx = makeCtx();
    const review = el('div', 'api-mock-import-review', 'api-mock-import-review');
    review.append(el('button', 'am-btn', 'api-mock-import-cancel'));
    document.body.append(review);
    await closeAm15Import(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CLOSE);
  });
});
