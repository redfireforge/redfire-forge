/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import type { DemoActionContext } from '../../types';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const patchApiMockActiveRoute = vi.fn(() => true);
const sendApiMockRequest = vi.fn(async () => ({ status: 201, body: '{"id":"ord-1001"}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM10_BINARY,
  AM10_CONTENT_BINARY,
  AM10_CONTENT_HTML,
  AM10_CONTENT_JSON,
  AM10_COOKIE_NAME,
  AM10_COOKIE_VALUE,
  AM10_CORPUS_SAMPLE,
  AM10_FORMATTED,
  AM10_HEADER_CACHE_KEY,
  AM10_HEADER_CACHE_VALUE,
  AM10_HEADER_TRACE_KEY,
  AM10_HTML,
  AM10_MINIFIED,
  AM10_PATH,
  AM10_REASON,
  AM10_TIMING,
  am10ContentTypeValue,
  am10CookieName,
  am10HasCookie,
  am10HasFormattedBody,
  am10HeaderKeys,
  am10HeaderRows,
  am10PreviewText,
  am10ReasonValue,
  am10StatusValue,
  cleanupAm10,
  ensureAm10ContentTab,
  ensureAm10Contract,
  ensureAm10Cookie,
  ensureAm10ForApply,
  ensureAm10Formatted,
  ensureAm10Headers,
  ensureAm10JournalOpen,
  ensureAm10Running,
  ensureAm10StatusLine,
  ensureAm10StudioView,
  ensureAm10Workspace,
  hasAm10RouteEditor,
  hasAm10Traffic,
  hasAm10Workspace,
  waitForAm10Traffic,
  isAm10ServerRunning,
  isAm10StudioViewActive,
  prepareAm10Workspace,
  runAm10Apply,
  runAm10Cookies,
  runAm10FormatJson,
  runAm10Headers,
  runAm10OtherBodyKinds,
  runAm10Preview,
  runAm10Prove,
  runAm10StatusLine,
} from './api-mock-am10-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement('input');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function tab(testid: string, selected = false): HTMLElement {
  const node = el('button', selected ? 'am-builder-tab active' : 'am-builder-tab', testid);
  node.setAttribute('role', 'tab');
  node.setAttribute('aria-selected', selected ? 'true' : 'false');
  return node;
}

function select(testid: string, value: string): HTMLElement {
  const node = el('div', 'cs-wrapper am-cs', testid);
  node.setAttribute('data-value', value);
  node.append(el('button', 'cs-trigger'));
  return node;
}

function clicks(ctx: DemoActionContext): string[] {
  return (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
}

function fills(ctx: DemoActionContext): Array<[string, string]> {
  return (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map(c => [String(c[0]), String(c[1])]);
}

function mountExplorer(): void {
  if (document.querySelector(API_MOCK.ROUTE_EXPLORER)) return;
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  const wrap = el('div', 'am-tree-route-row');
  const row = el('button', 'am-route-item', 'api-mock-route-orders');
  row.setAttribute('role', 'treeitem');
  wrap.append(row);
  explorer.append(wrap);
  document.body.append(explorer);
}

function mountServerBar(running = true, dirty = true): void {
  document.querySelector(API_MOCK.SERVER_BAR)?.remove();
  const bar = el('div', 'api-mock-server-bar', 'api-mock-server-bar');
  const status = el('span', running ? 'am-status-label running' : 'am-status-label', 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status);
  bar.append(el('span', 'am-address', 'api-mock-address'));
  if (running) {
    const gen = el('span', 'am-generation', 'api-mock-generation');
    gen.textContent = 'Generation 1';
    bar.append(gen);
    bar.append(el('button', 'am-btn', 'api-mock-stop'));
    if (dirty) {
      bar.append(el('span', 'am-badge warning', 'api-mock-dirty-badge'));
      bar.append(el('button', 'am-btn primary', 'api-mock-apply'));
    }
  } else {
    bar.append(el('button', 'am-btn primary', 'api-mock-start'));
  }
  document.body.append(bar);
}

interface EditorSpec {
  status?: string;
  reason?: string;
  contentType?: string;
  preview?: string;
  headers?: Array<[string, string]>;
  cookie?: { name: string; value: string };
  contentTab?: boolean;
  headersTab?: boolean;
  binaryHint?: boolean;
}

function mountEditor(spec: EditorSpec = {}): void {
  document.querySelector(API_MOCK.ROUTE_EDITOR)?.remove();
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const btab = document.createElement('button');
  btab.id = 'api-mock-btab-response';
  makeVisible(btab);
  editor.append(btab);

  const response = el('div', 'am-response-editor', 'api-mock-response-editor');
  response.append(tab('api-mock-response-tab-content', spec.headersTab ? false : spec.contentTab !== false));
  response.append(tab('api-mock-response-tab-headers', spec.headersTab === true));
  response.append(input('api-mock-variant-status', spec.status ?? '200'));
  response.append(input('api-mock-variant-status-reason', spec.reason ?? 'OK'));
  response.append(el('button', 'am-chip', 'api-mock-variant-status-quick-201'));
  response.append(select('api-mock-variant-content-type-select', spec.contentType ?? AM10_CONTENT_JSON));
  response.append(el('textarea', 'am-body', 'api-mock-variant-body'));
  response.append(el('span', 'am-faint', 'api-mock-body-size'));
  response.append(el('button', 'am-btn', 'api-mock-body-format'));
  if (spec.binaryHint) response.append(el('div', 'am-notice', 'api-mock-body-binary-hint'));

  const preview = el('aside', 'am-response-preview', 'api-mock-response-preview');
  const statusBadge = el('span', 'am-badge', 'api-mock-preview-status');
  statusBadge.textContent = `${spec.status ?? '200'} ${spec.reason ?? 'OK'}`;
  preview.append(statusBadge);
  if ((spec.headers?.length ?? 0) > 0) preview.append(el('span', 'am-badge', 'api-mock-preview-headers'));
  if (spec.cookie) preview.append(el('span', 'am-badge', 'api-mock-preview-cookies'));
  const body = el('pre', 'am-preview-body', 'api-mock-preview-body');
  body.textContent = spec.preview ?? '{}';
  preview.append(body);
  response.append(preview);

  response.append(el('button', 'am-btn', 'api-mock-add-header'));
  const list = el('div', 'am-header-list', 'api-mock-header-list');
  for (const [key, value] of spec.headers ?? []) {
    const row = el('div', 'am-matcher-row', 'api-mock-header-row');
    row.append(input('api-mock-header-key', key));
    row.append(input('api-mock-header-value', value));
    list.append(row);
  }
  response.append(list);
  response.append(el('button', 'am-btn', 'api-mock-add-cookie'));
  const cookieWrap = spec.cookie
    ? el('div', 'am-cookie-card', 'api-mock-cookie-row')
    : el('div', 'am-cookie-fields');
  cookieWrap.append(input('api-mock-cookie-name', spec.cookie?.name ?? ''));
  cookieWrap.append(input('api-mock-cookie-value', spec.cookie?.value ?? ''));
  const httpOnly = document.createElement('input');
  httpOnly.type = 'checkbox';
  httpOnly.checked = true;
  httpOnly.setAttribute('data-testid', 'api-mock-cookie-httpOnly');
  makeVisible(httpOnly);
  cookieWrap.append(httpOnly);
  response.append(cookieWrap);

  editor.append(response);
  document.body.append(editor);
}

function mountJournal(): void {
  const dock = el('div', 'api-mock-dock', 'api-mock-dock');
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  row.setAttribute('data-testid', 'api-mock-tx-1');
  makeVisible(row);
  tbody.append(row);
  table.append(tbody);
  dock.append(table);
  dock.append(el('div', 'am-tx-detail', 'api-mock-tx-detail'));
  dock.append(el('section', 'am-tx-io-pane', 'api-mock-tx-response'));
  document.body.append(dock);
  const live = el('button', 'am-chip', 'api-mock-live-transactions');
  const count = el('span', 'am-count-badge');
  count.textContent = '1';
  live.append(count);
  document.body.append(live);
}

describe('AM-10 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
    importApiMockGallerySample.mockResolvedValue(true);
  });

  it('uses the slower AM-09-style holds', () => {
    expect(AM10_TIMING.look).toBe(900);
    expect(AM10_TIMING.payoff).toBe(1600);
    expect(AM10_TIMING.beforeOpen).toBe(1400);
    expect(AM10_TIMING.groupBreak).toBe(1200);
  });

  it('reads status, reason, headers, cookie, and preview from the DOM', () => {
    expect(hasAm10Workspace()).toBe(false);
    expect(isAm10StudioViewActive()).toBe(false);
    expect(isAm10ServerRunning()).toBe(false);
    expect(hasAm10Traffic()).toBe(false);

    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
    });

    expect(hasAm10Workspace()).toBe(true);
    expect(hasAm10RouteEditor()).toBe(true);
    expect(isAm10StudioViewActive()).toBe(true);
    expect(isAm10ServerRunning()).toBe(true);
    expect(am10StatusValue()).toBe('201');
    expect(am10ReasonValue()).toBe(AM10_REASON);
    expect(am10ContentTypeValue()).toBe(AM10_CONTENT_JSON);
    expect(am10HeaderRows()).toHaveLength(1);
    expect(am10HeaderKeys()).toEqual([AM10_HEADER_TRACE_KEY]);
    expect(am10HasCookie()).toBe(true);
    expect(am10CookieName()).toBe(AM10_COOKIE_NAME);
    expect(am10HasFormattedBody()).toBe(true);
    expect(am10PreviewText()).toContain('ord-1001');
  });

  it('boots by importing the plain 200 {} corpus', async () => {
    await prepareAm10Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM10_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    await cleanupAm10();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the gallery sample cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm10Workspace()).rejects.toThrow(AM10_CORPUS_SAMPLE);
  });

  it('ensureAm10StudioView clicks Studio when the explorer is gone', async () => {
    const ctx = makeCtx();
    const view = el('button', 'am-btn', 'api-mock-view-studio');
    document.body.append(view);
    await ensureAm10StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm10StudioView skips when Studio is already showing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm10StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm10Workspace imports when the explorer is empty', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
    await ensureAm10Workspace(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM10_CORPUS_SAMPLE);
  });

  it('ensureAm10Workspace throws when a mid-lesson reimport fails', async () => {
    const ctx = makeCtx();
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(ensureAm10Workspace(ctx)).rejects.toThrow(AM10_CORPUS_SAMPLE);
  });

  it('ensureAm10Running starts a stopped listener and skips when already running', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(false, false);
    await ensureAm10Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);

    vi.clearAllMocks();
    document.body.innerHTML = '';
    mountExplorer();
    mountServerBar(true, true);
    await ensureAm10Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm10ContentTab clicks Content when Headers is selected', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({ headersTab: true });
    await ensureAm10ContentTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_CONTENT);
  });

  it('ensureAm10StatusLine fills 201 and the custom reason when they are missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ status: '200', reason: 'OK' });
    await ensureAm10StatusLine(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VARIANT_STATUS_QUICK_201);
    expect(fills(ctx)).toContainEqual([API_MOCK.VARIANT_STATUS_REASON, AM10_REASON]);
  });

  it('ensureAm10StatusLine skips when the status line is already authored', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ status: '201', reason: AM10_REASON });
    await ensureAm10StatusLine(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VARIANT_STATUS_QUICK_201);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureAm10Formatted patches the pretty JSON when the preview is still empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ status: '201', reason: AM10_REASON, preview: '{}' });
    await ensureAm10Formatted(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM10_FORMATTED,
      contentType: AM10_CONTENT_JSON,
      status: 201,
      reasonPhrase: AM10_REASON,
    });
  });

  it('ensureAm10Headers adds the two contract rows when the list is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ status: '201', reason: AM10_REASON, preview: AM10_FORMATTED, headersTab: true });
    await ensureAm10Headers(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_HEADER);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.HEADER_KEY_LAST, AM10_HEADER_TRACE_KEY],
      [API_MOCK.HEADER_VALUE_LAST, AM10_HEADER_CACHE_VALUE],
    ]));
  });

  it('ensureAm10Cookie adds and names the sid cookie', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      headersTab: true,
    });
    await ensureAm10Cookie(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_COOKIE);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.COOKIE_NAME, AM10_COOKIE_NAME],
      [API_MOCK.COOKIE_VALUE, AM10_COOKIE_VALUE],
    ]));
  });

  it('ensureAm10Cookie skips when the cookie is already named', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
      headersTab: true,
    });
    await ensureAm10Cookie(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_COOKIE);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureAm10ForApply restores the JSON contract on a running listener', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
    });
    await ensureAm10ForApply(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM10_FORMATTED,
      contentType: AM10_CONTENT_JSON,
      status: 201,
      reasonPhrase: AM10_REASON,
    });
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('waitForAm10Traffic returns as soon as the live count is non-zero', async () => {
    const ctx = makeCtx();
    const live = el('button', 'am-chip', 'api-mock-live-transactions');
    document.body.append(live);
    let n = 0;
    (ctx.delay as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      n += 1;
      if (n === 3) {
        const badge = document.createElement('span');
        badge.className = 'am-count-badge';
        badge.textContent = '1';
        live.append(badge);
      }
    });
    await expect(waitForAm10Traffic(ctx)).resolves.toBe(true);
    expect(n).toBe(3);
  });

  it('waitForAm10Traffic returns false when the journal never fills', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-chip', 'api-mock-live-transactions'));
    await expect(waitForAm10Traffic(ctx)).resolves.toBe(false);
    expect(ctx.delay).toHaveBeenCalledTimes(24);
  });

  it('ensureAm10JournalOpen waits for the live count before opening Runtime', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
    });
    const live = el('button', 'am-chip', 'api-mock-live-transactions');
    document.body.append(live);
    let n = 0;
    (ctx.delay as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      n += 1;
      if (n === 3) {
        const badge = document.createElement('span');
        badge.className = 'am-count-badge';
        badge.textContent = '1';
        live.append(badge);
      }
    });
    await ensureAm10JournalOpen(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM10_PATH, method: 'GET' });
    expect(n).toBe(3);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm10JournalOpen sends traffic then opens the Live strip', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
    });
    const live = el('button', 'am-chip', 'api-mock-live-transactions');
    document.body.append(live);
    await ensureAm10JournalOpen(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM10_PATH, method: 'GET' });
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('runAm10StatusLine aims Content, clicks 201, fills the reason, and selects JSON', async () => {
    const ctx = makeCtx();
    mountEditor();
    await runAm10StatusLine(ctx);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.RESPONSE_TAB_CONTENT,
      API_MOCK.VARIANT_STATUS_QUICK_201,
    ]));
    expect(fills(ctx)).toContainEqual([API_MOCK.VARIANT_STATUS_REASON, AM10_REASON]);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_JSON);
  });

  it('runAm10FormatJson patches the minified body then clicks Format', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({ status: '201', reason: AM10_REASON });
    await runAm10FormatJson(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM10_MINIFIED,
      contentType: AM10_CONTENT_JSON,
      status: 201,
      reasonPhrase: AM10_REASON,
    });
    expect(clicks(ctx)).toContain(API_MOCK.BODY_FORMAT);
  });

  it('runAm10Headers adds two named rows', async () => {
    const ctx = makeCtx();
    mountEditor({ headersTab: true });
    await runAm10Headers(ctx);
    expect(clicks(ctx).filter(s => s === API_MOCK.ADD_HEADER)).toHaveLength(2);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.HEADER_KEY_LAST, AM10_HEADER_TRACE_KEY],
      [API_MOCK.HEADER_KEY_LAST, AM10_HEADER_CACHE_KEY],
    ]));
  });

  it('runAm10Cookies names the cookie and holds HttpOnly without toggling it', async () => {
    const ctx = makeCtx();
    mountEditor({
      headersTab: true,
      cookie: { name: 'session', value: '{{uuid}}' },
    });
    await runAm10Cookies(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.ADD_COOKIE);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.COOKIE_NAME, AM10_COOKIE_NAME],
      [API_MOCK.COOKIE_VALUE, AM10_COOKIE_VALUE],
    ]));
    expect(clicks(ctx)).not.toContain(API_MOCK.COOKIE_HTTPONLY);
  });

  it('runAm10Preview holds the preview badges', async () => {
    const ctx = makeCtx();
    mountEditor({
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
      preview: AM10_FORMATTED,
    });
    await runAm10Preview(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('runAm10OtherBodyKinds tours HTML and binary then restores JSON', async () => {
    const ctx = makeCtx();
    mountEditor({ binaryHint: true });
    await runAm10OtherBodyKinds(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_HTML);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_BINARY);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.VARIANT_CONTENT_TYPE_SELECT, AM10_CONTENT_JSON);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      body: AM10_HTML,
      contentType: AM10_CONTENT_HTML,
    }));
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      body: AM10_BINARY,
      contentType: AM10_CONTENT_BINARY,
    }));
    expect(patchApiMockActiveRoute).toHaveBeenLastCalledWith(expect.objectContaining({
      body: AM10_FORMATTED,
      contentType: AM10_CONTENT_JSON,
    }));
  });

  it('runAm10Apply clicks Apply when the draft is dirty', async () => {
    const ctx = makeCtx();
    mountServerBar(true, true);
    await runAm10Apply(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.APPLY);
  });

  it('runAm10Apply still holds Generation when Apply is not mounted', async () => {
    const ctx = makeCtx();
    mountServerBar(true, false);
    await runAm10Apply(ctx);
    expect(clicks(ctx)).not.toContain(API_MOCK.APPLY);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('runAm10Prove sends GET /orders and opens the journaled response', async () => {
    const ctx = makeCtx();
    mountServerBar(true, true);
    mountJournal();
    const status = await runAm10Prove(ctx);
    expect(status).toBe(201);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM10_PATH, method: 'GET' });
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.JOURNAL_FIRST_ROW,
    ]));
    expect(clicks(ctx)).not.toContain(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('runAm10Prove waits for traffic before clicking the Live strip', async () => {
    const ctx = makeCtx();
    mountServerBar(true, true);
    const live = el('button', 'am-chip', 'api-mock-live-transactions');
    document.body.append(live);
    let n = 0;
    (ctx.delay as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      n += 1;
      if (n === 2) {
        const badge = document.createElement('span');
        badge.className = 'am-count-badge';
        badge.textContent = '1';
        live.append(badge);
      }
    });
    const status = await runAm10Prove(ctx);
    expect(status).toBe(201);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.LIVE_TRANSACTIONS,
      API_MOCK.JOURNAL_FIRST_ROW,
    ]));
  });

  it('ensureAm10Contract is a no-op add when headers and cookie already exist', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      status: '201',
      reason: AM10_REASON,
      preview: AM10_FORMATTED,
      headers: [[AM10_HEADER_TRACE_KEY, 'req-1001'], [AM10_HEADER_CACHE_KEY, 'no-store']],
      cookie: { name: AM10_COOKIE_NAME, value: AM10_COOKIE_VALUE },
    });
    await ensureAm10Contract(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_HEADER);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_COOKIE);
  });
});
