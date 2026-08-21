/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 204, body: '' }));
const patchApiMockServerSettings = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  patchApiMockServerSettings: (...a: unknown[]) => patchApiMockServerSettings(...(a as [])),
}));

import {
  AM19_CALLBACK_URL,
  AM19_CART_PATH,
  AM19_CONN,
  AM19_CORPUS_SAMPLE,
  AM19_CORS_ORIGIN,
  AM19_DRAIN,
  AM19_INBOUND,
  AM19_PASSWORD_BODY,
  AM19_PRODUCTS,
  AM19_REDACT_HEADERS,
  AM19_REDACT_PATHS,
  AM19_TIMING,
  am19InputValue,
  am19JournalCount,
  cleanupAm19,
  closeAm19SettingsModal,
  ensureAm19ForConsole,
  ensureAm19ForLimits,
  ensureAm19ForPersist,
  ensureAm19ForProveRedaction,
  ensureAm19ForProveTransform,
  ensureAm19ForRedactionConfig,
  ensureAm19ForTransforms,
  ensureAm19Library,
  ensureAm19OnApiMock,
  ensureAm19Running,
  ensureAm19StudioView,
  hasAm19Callback,
  hasAm19ConsoleLines,
  hasAm19Diagnostics,
  hasAm19Library,
  hasAm19Limits,
  hasAm19RedactedDetail,
  hasAm19RedactionConfig,
  hasAm19Server,
  hasAm19Traffic,
  hasAm19Transform,
  hasAm19TransformHeader,
  isAm19CompanionUnavailable,
  isAm19CorsOn,
  isAm19PersistOn,
  isAm19RuntimeViewActive,
  isAm19ServerRunning,
  isAm19SettingsOpen,
  isAm19StudioViewActive,
  isAm19ToggleOn,
  prepareAm19Workspace,
  runAm19Console,
  runAm19Cors,
  runAm19Limits,
  runAm19PersistAndDiagnostics,
  runAm19ProveRedaction,
  runAm19ProveTransform,
  runAm19RedactionConfig,
  runAm19TransformsAndCallbacks,
} from './api-mock-am19-helpers';

const APP_AB = '[data-testid="ab-protocols"]';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function mountServerBar(running: boolean, extras: { apply?: boolean; address?: boolean; dirty?: boolean; restart?: boolean } = {}): HTMLElement {
  const bar = el('div', undefined, 'api-mock-server-bar');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status, el('button', undefined, running ? 'api-mock-stop' : 'api-mock-start'));
  if (extras.restart) bar.append(el('button', undefined, 'api-mock-restart'));
  if (extras.apply) bar.append(el('button', undefined, 'api-mock-apply'));
  if (extras.dirty) bar.append(el('span', undefined, 'api-mock-dirty-badge'));
  if (extras.address) {
    const addr = el('span', undefined, 'api-mock-address');
    addr.textContent = 'http://127.0.0.1:4600';
    bar.append(addr);
  }
  document.body.append(bar);
  document.body.append(el('button', undefined, 'api-mock-view-studio'));
  document.body.append(el('button', undefined, 'api-mock-view-runtime'));
  document.body.append(el('button', undefined, 'api-mock-live-transactions'));
  const txCount = el('span', 'am-count-badge');
  txCount.textContent = '0';
  document.body.querySelector('[data-testid="api-mock-live-transactions"]')?.append(txCount);
  document.body.append(el('button', undefined, 'api-mock-live-settings'));
  document.body.append(el('button', undefined, 'api-mock-settings'));
  return bar;
}

function mountExplorer(): HTMLElement {
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-list-products');
  row.setAttribute('role', 'treeitem');
  const path = el('span', 'am-route-path');
  path.setAttribute('data-testid', 'api-mock-route-path');
  path.textContent = AM19_PRODUCTS;
  row.append(path);
  explorer.append(row);
  document.body.append(explorer);
  return explorer;
}

function mountJournal(opts: { detail?: boolean; redacted?: boolean; transform?: boolean } = {}): void {
  const page = el('div', undefined, 'api-mock-runtime-page');
  const dock = el('div', undefined, 'api-mock-dock');
  dock.append(
    el('button', undefined, 'api-mock-dock-tab-transactions'),
    el('button', undefined, 'api-mock-dock-tab-settings'),
    el('button', undefined, 'api-mock-dock-tab-diagnostics'),
    el('button', undefined, 'api-mock-dock-tab-console'),
  );
  const toolbar = el('div', undefined, 'api-mock-journal-toolbar');
  dock.append(toolbar);
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');
  tr.setAttribute('data-testid', 'api-mock-tx-tx-1');
  makeVisible(tr);
  const path = el('td', 'am-tx-path');
  path.textContent = AM19_CART_PATH;
  tr.append(path);
  tbody.append(tr);
  table.append(tbody);
  dock.append(table);
  if (opts.detail || opts.redacted || opts.transform) {
    const detail = el('div', undefined, 'api-mock-tx-detail');
    const req = el('pre', undefined, 'api-mock-tx-request');
    req.textContent = opts.redacted
      ? 'POST /cart/items\nAuthorization: Bearer [REDACTED]\n\n{"password":"[REDACTED]"}'
      : 'POST /cart/items';
    const res = el('pre', undefined, 'api-mock-tx-response');
    res.textContent = opts.transform
      ? 'HTTP 200\nX-Mocked-By: RedfireForge\n\n{"products":[]}'
      : 'HTTP 201';
    detail.append(req, res);
    dock.append(detail);
  }
  page.append(dock);
  document.body.append(page);
}

function mountRuntimeSettings(opts: {
  cors?: boolean;
  persist?: boolean;
  dirty?: boolean;
  inbound?: string;
  drain?: string;
  paths?: string;
} = {}): void {
  const panel = el('div', undefined, 'api-mock-runtime-settings-panel');
  const cors = el('button', opts.cors ? 'am-toggle on' : 'am-toggle', 'api-mock-runtime-settings-cors');
  cors.setAttribute('role', 'switch');
  cors.setAttribute('aria-checked', opts.cors ? 'true' : 'false');
  const origins = document.createElement('input');
  origins.setAttribute('data-testid', 'api-mock-runtime-settings-cors-origins');
  origins.value = opts.cors ? AM19_CORS_ORIGIN : '*';
  makeVisible(origins);
  const inbound = document.createElement('input');
  inbound.setAttribute('data-testid', 'api-mock-runtime-settings-inbound');
  inbound.value = opts.inbound ?? '1048576';
  makeVisible(inbound);
  const conn = document.createElement('input');
  conn.setAttribute('data-testid', 'api-mock-runtime-settings-conn');
  conn.value = '100';
  makeVisible(conn);
  const drain = document.createElement('input');
  drain.setAttribute('data-testid', 'api-mock-runtime-settings-drain');
  drain.value = opts.drain ?? '5000';
  makeVisible(drain);
  const persist = el('button', opts.persist ? 'am-toggle on' : 'am-toggle', 'api-mock-runtime-settings-persist');
  persist.setAttribute('role', 'switch');
  persist.setAttribute('aria-checked', opts.persist ? 'true' : 'false');
  const headers = document.createElement('input');
  headers.setAttribute('data-testid', 'api-mock-runtime-settings-redact-headers');
  headers.value = 'authorization, cookie';
  makeVisible(headers);
  const paths = document.createElement('input');
  paths.setAttribute('data-testid', 'api-mock-runtime-settings-redact-paths');
  paths.value = opts.paths ?? '';
  makeVisible(paths);
  const save = el('button', undefined, 'api-mock-runtime-settings-save');
  panel.append(cors, origins, inbound, conn, drain, persist, headers, paths, save);
  if (opts.dirty) panel.append(el('span', undefined, 'api-mock-runtime-settings-dirty'));
  document.body.append(panel);
}

function mountDiagnostics(): void {
  const diag = el('div', undefined, 'api-mock-diagnostics');
  const p95 = el('strong', undefined, 'api-mock-diag-match-p95');
  p95.textContent = '0.4';
  const outcomes = el('div', undefined, 'api-mock-diag-outcomes');
  outcomes.textContent = 'matched 1';
  diag.append(p95, outcomes);
  document.body.append(diag);
}

function mountConsole(opts: { empty?: boolean } = {}): void {
  if (opts.empty) {
    document.body.append(el('div', undefined, 'api-mock-dock-console-empty'));
    return;
  }
  const consoleEl = el('div', 'am-console', 'api-mock-dock-console');
  const line = el('div', 'am-console-line');
  line.textContent = 'listener started';
  consoleEl.append(line);
  document.body.append(consoleEl);
}

function mountOutbound(opts: { transform?: boolean; callback?: boolean } = {}): void {
  const editor = el('div', undefined, 'api-mock-route-editor');
  const responseTab = el('button', undefined, 'api-mock-btab-response');
  responseTab.id = 'api-mock-btab-response';
  editor.append(responseTab);
  editor.append(el('button', undefined, 'api-mock-response-tab-outbound'));
  const outbound = el('div', undefined, 'api-mock-variant-outbound');
  outbound.append(el('button', undefined, 'api-mock-transform-add'));
  outbound.append(el('button', undefined, 'api-mock-callback-add'));
  if (opts.transform) {
    const row = el('div', 'am-transform-row', 'api-mock-transform-xf-1');
    row.append(el('div', undefined, 'api-mock-transform-op-xf-1'));
    outbound.append(row);
  }
  if (opts.callback) {
    const url = document.createElement('input');
    url.setAttribute('data-testid', 'api-mock-callback-url-cb-1');
    url.value = AM19_CALLBACK_URL;
    makeVisible(url);
    const body = document.createElement('textarea');
    body.setAttribute('data-testid', 'api-mock-callback-body-cb-1');
    body.value = '{}';
    makeVisible(body);
    const retries = document.createElement('input');
    retries.setAttribute('data-testid', 'api-mock-callback-retries-cb-1');
    retries.value = '3';
    makeVisible(retries);
    outbound.append(url, body, retries);
  }
  editor.append(outbound);
  document.body.append(editor);
}

function mountSettingsModal(): void {
  const modal = el('div', undefined, 'api-mock-settings-modal');
  modal.append(el('button', undefined, 'api-mock-settings-tab-proxy'));
  const allow = document.createElement('textarea');
  allow.setAttribute('data-testid', 'api-mock-settings-callback-allowlist');
  allow.value = '';
  makeVisible(allow);
  modal.append(allow);
  modal.append(el('button', undefined, 'api-mock-settings-save'));
  modal.append(el('button', undefined, 'api-mock-settings-cancel'));
  document.body.append(modal);
}

beforeEach(() => {
  document.body.replaceChildren();
  wipeApiMockWorkspace.mockClear().mockResolvedValue(true);
  importApiMockGallerySample.mockClear().mockResolvedValue(true);
  prepareApiMockStudioChrome.mockClear();
  sendApiMockRequest.mockClear().mockResolvedValue({ status: 204, body: '' });
  patchApiMockServerSettings.mockClear().mockReturnValue(true);
});

describe('AM-19 helpers', () => {
  it('pins corpus values and slower timing', () => {
    expect(AM19_CORPUS_SAMPLE).toBe('am-gallery-store');
    expect(AM19_PRODUCTS).toBe('/products');
    expect(AM19_CART_PATH).toBe('/cart/items');
    expect(AM19_CORS_ORIGIN).toContain('localhost:5173');
    expect(AM19_REDACT_PATHS).toBe('$.password');
    expect(AM19_TIMING.beforeOpen).toBe(1400);
    expect(AM19_TIMING.payoff).toBe(1600);
  });

  it('reads probes from an empty document as false', () => {
    expect(isAm19StudioViewActive()).toBe(false);
    expect(isAm19RuntimeViewActive()).toBe(false);
    expect(hasAm19Server()).toBe(false);
    expect(hasAm19Library()).toBe(false);
    expect(isAm19ServerRunning()).toBe(false);
    expect(isAm19CorsOn()).toBe(false);
    expect(isAm19PersistOn()).toBe(false);
    expect(hasAm19Limits()).toBe(false);
    expect(hasAm19RedactionConfig()).toBe(false);
    expect(hasAm19Traffic()).toBe(false);
    expect(am19JournalCount()).toBe(0);
    expect(hasAm19RedactedDetail()).toBe(false);
    expect(hasAm19Diagnostics()).toBe(false);
    expect(hasAm19ConsoleLines()).toBe(false);
    expect(hasAm19Transform()).toBe(false);
    expect(hasAm19Callback()).toBe(false);
    expect(hasAm19TransformHeader()).toBe(false);
    expect(isAm19SettingsOpen()).toBe(false);
    expect(am19InputValue(API_MOCK.RUNTIME_SETTINGS_INBOUND)).toBe('');
    expect(isAm19ToggleOn(API_MOCK.RUNTIME_SETTINGS_CORS)).toBe(false);
  });

  it('reads probes from a mounted studio and runtime', () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    mountJournal({ redacted: true, transform: true });
    mountRuntimeSettings({ cors: true, persist: true, inbound: AM19_INBOUND, drain: AM19_DRAIN, paths: AM19_REDACT_PATHS });
    mountDiagnostics();
    mountConsole();
    mountOutbound({ transform: true, callback: true });
    mountSettingsModal();

    expect(hasAm19Server()).toBe(true);
    expect(isAm19StudioViewActive()).toBe(true);
    expect(isAm19RuntimeViewActive()).toBe(true);
    expect(isAm19ServerRunning()).toBe(true);
    expect(hasAm19Library()).toBe(true);
    expect(isAm19CorsOn()).toBe(true);
    expect(isAm19PersistOn()).toBe(true);
    expect(hasAm19Limits()).toBe(true);
    expect(hasAm19RedactionConfig()).toBe(true);
    expect(hasAm19Traffic()).toBe(true);
    expect(hasAm19RedactedDetail()).toBe(true);
    expect(hasAm19Diagnostics()).toBe(true);
    expect(hasAm19ConsoleLines()).toBe(true);
    expect(hasAm19Transform()).toBe(true);
    expect(hasAm19Callback()).toBe(true);
    expect(hasAm19TransformHeader()).toBe(true);
    expect(isAm19SettingsOpen()).toBe(true);
    expect(am19JournalCount()).toBe(0);
  });

  it('counts journal rows when the live-strip badge is missing', () => {
    mountJournal();
    expect(am19JournalCount()).toBe(1);
  });

  it('prepares the store library and wipes on cleanup', async () => {
    await prepareAm19Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM19_CORPUS_SAMPLE);
    await cleanupAm19();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the store library cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm19Workspace()).rejects.toThrow(/am-gallery-store/);
  });

  it('skips step bodies and guards when the studio is empty', async () => {
    const ctx = makeCtx();
    await ensureAm19OnApiMock(ctx);
    await ensureAm19StudioView(ctx);
    await ensureAm19Library(ctx);
    await ensureAm19Running(ctx);
    await closeAm19SettingsModal(ctx);
    await ensureAm19ForLimits(ctx);
    await ensureAm19ForRedactionConfig(ctx);
    await ensureAm19ForProveRedaction(ctx);
    await ensureAm19ForPersist(ctx);
    await ensureAm19ForConsole(ctx);
    await ensureAm19ForTransforms(ctx);
    await ensureAm19ForProveTransform(ctx);
    await runAm19Cors(ctx);
    await runAm19Limits(ctx);
    await runAm19RedactionConfig(ctx);
    await runAm19ProveRedaction(ctx);
    await runAm19PersistAndDiagnostics(ctx);
    await runAm19Console(ctx);
    await runAm19TransformsAndCallbacks(ctx);
    await runAm19ProveTransform(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('navigates to API Mock from the activity bar', async () => {
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm19OnApiMock(ctx);
    expect(ctx.click).toHaveBeenCalledWith(APP_AB);
  });

  it('closes an open settings modal with Cancel', async () => {
    mountSettingsModal();
    const ctx = makeCtx();
    await closeAm19SettingsModal(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_CANCEL);
  });
});

describe('AM-19 step bodies', () => {
  it('starts the listener, opens Runtime Settings, enables CORS, and sends OPTIONS', async () => {
    mountServerBar(false, { apply: true, address: true, dirty: true });
    mountExplorer();
    mountRuntimeSettings({ dirty: true });
    const ctx = makeCtx();
    await runAm19Cors(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_SETTINGS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS, AM19_CORS_ORIGIN);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM19_PRODUCTS,
      method: 'OPTIONS',
      headers: {
        Origin: AM19_CORS_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
  });

  it('skips the CORS toggle when it is already on', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true });
    const ctx = makeCtx();
    await runAm19Cors(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS);
  });

  it('fills inbound, connections, and drain then saves', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    mountRuntimeSettings({ cors: true, dirty: true });
    const ctx = makeCtx();
    await runAm19Limits(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_INBOUND, AM19_INBOUND);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CONN, AM19_CONN);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_DRAIN, AM19_DRAIN);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_SAVE);
  });

  it('fills redaction headers and JSONPath then saves', async () => {
    mountServerBar(true, { apply: true, dirty: true });
    mountExplorer();
    mountRuntimeSettings({ cors: true, dirty: true });
    const ctx = makeCtx();
    await runAm19RedactionConfig(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS, AM19_REDACT_HEADERS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS, AM19_REDACT_PATHS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('posts a secret and opens the journal detail', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    mountJournal({ redacted: true });
    const ctx = makeCtx();
    await runAm19ProveRedaction(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM19_CART_PATH,
      method: 'POST',
      headers: { Authorization: 'Bearer s3cret-token', 'Content-Type': 'application/json' },
      body: AM19_PASSWORD_BODY,
    });
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-tx-tx-1"]');
  });

  it('toggles persist then opens diagnostics', async () => {
    mountServerBar(true, { apply: true, dirty: true });
    mountExplorer();
    mountRuntimeSettings({ cors: true, dirty: true });
    mountJournal();
    mountDiagnostics();
    const ctx = makeCtx();
    await runAm19PersistAndDiagnostics(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_PERSIST);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_DIAGNOSTICS);
  });

  it('skips the persist toggle when it is already on', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ persist: true });
    mountJournal();
    mountDiagnostics();
    const ctx = makeCtx();
    await runAm19PersistAndDiagnostics(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_PERSIST);
  });

  it('opens the console dock and holds a lifecycle line', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal();
    mountConsole();
    const ctx = makeCtx();
    await runAm19Console(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_CONSOLE);
  });

  it('applies when the console is empty so a commit line can appear', async () => {
    mountServerBar(true, { apply: true, dirty: true });
    mountExplorer();
    mountJournal();
    mountConsole({ empty: true });
    const ctx = makeCtx();
    await runAm19Console(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('restarts the running server when the console is empty and nothing is dirty', async () => {
    mountServerBar(true, { restart: true });
    mountExplorer();
    mountJournal();
    mountConsole({ empty: true });
    const ctx = makeCtx();
    await runAm19Console(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESTART);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('treats a "not reachable" banner as not-running and recovers via Restart', async () => {
    // Badge frozen at "Running" (companion restarted mid-session, pool empty) but
    // the live region carries the unavailable notice.
    mountServerBar(true, { restart: true });
    mountExplorer();
    const notice = el('div', undefined, 'api-mock-live-region');
    notice.textContent = 'Companion unavailable: The companion runtime is not reachable. Start it, then retry.';
    document.body.append(notice);

    expect(isAm19CompanionUnavailable()).toBe(true);
    // The stale badge must not read as live while the companion is unreachable.
    expect(isAm19ServerRunning()).toBe(false);

    const ctx = makeCtx();
    await ensureAm19Running(ctx);
    // Start is hidden on a "Running" bar — Restart is the only path back to a live port.
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESTART);
  });

  it('adds a transform and callback then fills the allowlist', async () => {
    mountServerBar(true);
    mountExplorer();
    mountOutbound();
    mountSettingsModal();
    const ctx = makeCtx();
    await runAm19TransformsAndCallbacks(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TRANSFORM_ADD);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.CALLBACK_ADD);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SETTINGS_CALLBACK_ALLOWLIST, AM19_CALLBACK_URL);
  });

  it('holds an existing transform row without adding a second one', async () => {
    mountServerBar(true);
    mountExplorer();
    mountOutbound({ transform: true, callback: true });
    const ctx = makeCtx();
    await runAm19TransformsAndCallbacks(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.TRANSFORM_ADD);
  });

  it('applies and fetches products to prove the injected header', async () => {
    mountServerBar(true, { apply: true, dirty: true });
    mountExplorer();
    mountJournal({ transform: true });
    const ctx = makeCtx();
    await runAm19ProveTransform(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM19_PRODUCTS, method: 'GET' });
  });

  it('still fetches when Apply is not dirty', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ transform: true });
    const ctx = makeCtx();
    await runAm19ProveTransform(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM19_PRODUCTS, method: 'GET' });
  });
});

describe('AM-19 guards', () => {
  it('quietly enables CORS from the settings panel', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings();
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS, AM19_CORS_ORIGIN);
  });

  it('patches CORS when the runtime panel is not mounted', async () => {
    mountServerBar(true);
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(patchApiMockServerSettings).toHaveBeenCalledWith({
      corsEnabled: true,
      corsOrigins: [AM19_CORS_ORIGIN],
    });
  });

  it('quietly fills limits and redaction for later steps', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    mountRuntimeSettings({ cors: true });
    const ctx = makeCtx();
    await ensureAm19ForProveRedaction(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_INBOUND, AM19_INBOUND);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS, AM19_REDACT_PATHS);
  });

  it('seeds a plain products row so the redaction step opens on a non-empty journal', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    mountRuntimeSettings({ cors: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    const ctx = makeCtx();
    await ensureAm19ForProveRedaction(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM19_PRODUCTS, method: 'GET' });
  });

  it('sends a secret fetch when the journal is empty', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    const ctx = makeCtx();
    await ensureAm19ForPersist(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: AM19_CART_PATH,
      method: 'POST',
    }));
  });

  it('opens outbound and adds a transform on prove-transform replay', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true, persist: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    mountJournal({ redacted: true });
    mountOutbound();
    const ctx = makeCtx();
    await ensureAm19ForProveTransform(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TRANSFORM_ADD);
  });

  it('imports the library when the explorer is missing', async () => {
    mountServerBar(true);
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    const ctx = makeCtx();
    await ensureAm19Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM19_CORPUS_SAMPLE);
  });

  it('falls back to navigateToTab when chrome is missing', async () => {
    const ctx = makeCtx();
    await ensureAm19OnApiMock(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('switches to Studio when Runtime is showing', async () => {
    mountServerBar(true);
    const page = el('div', undefined, 'api-mock-runtime-page');
    page.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    document.body.append(page);
    const ctx = makeCtx();
    await ensureAm19StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('closes settings via Save when Cancel is missing', async () => {
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('button', undefined, 'api-mock-settings-save'));
    document.body.append(modal);
    const ctx = makeCtx();
    await closeAm19SettingsModal(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
  });

  it('opens Runtime Settings from the dock tab', async () => {
    mountServerBar(true);
    document.body.querySelector('[data-testid="api-mock-live-settings"]')?.remove();
    const page = el('div', undefined, 'api-mock-runtime-page');
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-settings'));
    page.append(dock);
    document.body.append(page);
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_SETTINGS);
  });

  it('opens Runtime Settings from View Runtime when the live strip is gone', async () => {
    mountServerBar(true);
    document.body.querySelector('[data-testid="api-mock-live-settings"]')?.remove();
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
  });

  it('skips filling CORS origins that are already set', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true });
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS, AM19_CORS_ORIGIN);
  });

  it('patches limits, redaction, and persist when the panel is missing', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm19ForConsole(ctx);
    expect(patchApiMockServerSettings).toHaveBeenCalledWith(expect.objectContaining({
      maxInboundBodyBytes: Number(AM19_INBOUND),
    }));
    expect(patchApiMockServerSettings).toHaveBeenCalledWith(expect.objectContaining({
      redactJsonPaths: [AM19_REDACT_PATHS],
    }));
    expect(patchApiMockServerSettings).toHaveBeenCalledWith({ persistToDisk: true });
  });

  it('skips the secret fetch when a journal row already exists', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    mountJournal();
    sendApiMockRequest.mockClear();
    const ctx = makeCtx();
    await ensureAm19ForPersist(ctx);
    expect(sendApiMockRequest).not.toHaveBeenCalled();
  });

  it('fills an empty callback URL after adding the row', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true, persist: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    mountJournal({ redacted: true });
    mountOutbound();
    const url = document.createElement('input');
    url.setAttribute('data-testid', 'api-mock-callback-url-cb-empty');
    url.value = '';
    makeVisible(url);
    document.querySelector('[data-testid="api-mock-variant-outbound"]')?.append(url);
    const ctx = makeCtx();
    await ensureAm19ForProveTransform(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.CALLBACK_URL_FIRST, AM19_CALLBACK_URL);
  });

  it('opens the journal from the live strip when the dock table is missing', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    const ctx = makeCtx();
    await runAm19ProveRedaction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('holds the console panel when there are no line nodes', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal();
    document.body.append(el('div', 'am-console', 'api-mock-dock-console'));
    const ctx = makeCtx();
    await runAm19Console(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_CONSOLE);
  });

  it('falls back to transaction detail when the response pane is missing', async () => {
    mountServerBar(true, { apply: true, dirty: true });
    mountExplorer();
    mountJournal({ detail: true });
    document.querySelector('[data-testid="api-mock-tx-response"]')?.remove();
    const ctx = makeCtx();
    await runAm19ProveTransform(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM19_PRODUCTS, method: 'GET' });
  });

  it('aims live Settings when limits start from Studio', async () => {
    mountServerBar(true);
    mountExplorer();
    const ctx = makeCtx();
    await runAm19Limits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_SETTINGS);
  });

  it('aims the Settings dock tab when limits start on Runtime', async () => {
    mountServerBar(true);
    document.body.querySelector('[data-testid="api-mock-live-settings"]')?.remove();
    mountExplorer();
    const page = el('div', undefined, 'api-mock-runtime-page');
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-settings'));
    page.append(dock);
    document.body.append(page);
    const ctx = makeCtx();
    await runAm19Limits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_SETTINGS);
  });

  it('opens Response Outbound when the panel is not mounted yet', async () => {
    mountServerBar(true);
    mountExplorer();
    const editor = el('div', undefined, 'api-mock-route-editor');
    const responseTab = el('button');
    responseTab.id = 'api-mock-btab-response';
    makeVisible(responseTab);
    editor.append(responseTab);
    editor.append(el('button', undefined, 'api-mock-response-tab-outbound'));
    editor.append(el('button', undefined, 'api-mock-transform-add'));
    document.body.append(editor);
    const ctx = makeCtx();
    await runAm19TransformsAndCallbacks(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_OUTBOUND);
  });

  it('quietly opens Outbound tabs when proving the transform', async () => {
    mountServerBar(true);
    mountExplorer();
    mountRuntimeSettings({ cors: true, persist: true, paths: AM19_REDACT_PATHS, inbound: AM19_INBOUND, drain: AM19_DRAIN });
    mountJournal({ redacted: true });
    const editor = el('div', undefined, 'api-mock-route-editor');
    const responseTab = el('button');
    responseTab.id = 'api-mock-btab-response';
    makeVisible(responseTab);
    editor.append(responseTab);
    editor.append(el('button', undefined, 'api-mock-response-tab-outbound'));
    editor.append(el('button', undefined, 'api-mock-transform-add'));
    editor.append(el('button', undefined, 'api-mock-callback-add'));
    document.body.append(editor);
    const ctx = makeCtx();
    await ensureAm19ForProveTransform(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_OUTBOUND);
  });

  it('quietly clicks Apply after a CORS patch', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm19ForLimits(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('opens the journal from the transactions dock tab', async () => {
    mountServerBar(true, { address: true });
    document.body.querySelector('[data-testid="api-mock-live-transactions"]')?.remove();
    mountExplorer();
    const page = el('div', undefined, 'api-mock-runtime-page');
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    page.append(dock);
    document.body.append(page);
    const ctx = makeCtx();
    await runAm19ProveRedaction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('looks at the dirty badge when Apply is missing', async () => {
    mountServerBar(true, { dirty: true });
    mountExplorer();
    mountRuntimeSettings({ dirty: true });
    const ctx = makeCtx();
    await runAm19Cors(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('skips waitFor when gallery import returns false', async () => {
    mountServerBar(true);
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    importApiMockGallerySample.mockResolvedValueOnce(false);
    const ctx = makeCtx();
    await ensureAm19Library(ctx);
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });
});
