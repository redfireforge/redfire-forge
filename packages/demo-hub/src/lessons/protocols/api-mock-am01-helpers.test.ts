/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const patchApiMockActiveRoute = vi.fn(() => true);
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM01_HEALTH_BODY,
  cleanupAm01,
  ensureAm01JournalOpen,
  ensureAm01Response,
  ensureAm01Rule,
  ensureAm01Running,
  ensureAm01Server,
  ensureAm01Stoppable,
  ensureAm01StudioView,
  ensureAm01Traffic,
  hasAm01RouteEditor,
  hasAm01Server,
  isAm01ServerRunning,
  isAm01StudioViewActive,
  prepareAm01Workspace,
  runAm01AuthorMatch,
  runAm01AuthorResponse,
  runAm01CreateServer,
  runAm01Inspect,
  runAm01SendTraffic,
  runAm01Start,
  runAm01Stop,
  runAm01WorkspaceTour,
} from './api-mock-am01-helpers';

/**
 * Mount visible DOM stubs. Beats and guards probe with `firstVisibleElement`, so
 * jsdom nodes need a non-zero box (`makeVisible`).
 */
function mount(...selectors: string[]): void {
  for (const sel of selectors) {
    const id = /data-testid="([^"]+)"/.exec(sel)?.[1];
    const el = document.createElement(id ? 'div' : 'button');
    if (id) el.setAttribute('data-testid', id);
    else el.id = sel.replace('#', '');
    makeVisible(el);
    document.body.appendChild(el);
  }
}

function mountStatus(text: string): void {
  const el = document.createElement('span');
  el.setAttribute('data-testid', 'api-mock-status-label');
  el.textContent = text;
  makeVisible(el);
  document.body.appendChild(el);
}

function mountPathInput(value: string): void {
  const input = document.createElement('input');
  input.setAttribute('data-testid', 'api-mock-path-input');
  input.value = value;
  makeVisible(input);
  document.body.appendChild(input);
}

const clicks = (ctx: ReturnType<typeof makeCtx>): string[] =>
  vi.mocked(ctx.click).mock.calls.map(c => c[0]);

describe('AM-01 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
  });

  // ── state probes ──────────────────────────────────────────────────────────
  it('detects server, route editor, and running state from the DOM', () => {
    expect(hasAm01Server()).toBe(false);
    expect(hasAm01RouteEditor()).toBe(false);
    expect(isAm01ServerRunning()).toBe(false);

    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR);
    mountStatus('Running');
    expect(hasAm01Server()).toBe(true);
    expect(hasAm01RouteEditor()).toBe(true);
    expect(isAm01ServerRunning()).toBe(true);
  });

  it('does not read Stopped as running', () => {
    mountStatus('Stopped');
    expect(isAm01ServerRunning()).toBe(false);
  });

  it('detects the Studio view from the explorer or the empty state', () => {
    expect(isAm01StudioViewActive()).toBe(false);
    mount(API_MOCK.EMPTY);
    expect(isAm01StudioViewActive()).toBe(true);
    document.body.innerHTML = '';
    mount(API_MOCK.ROUTE_EXPLORER);
    expect(isAm01StudioViewActive()).toBe(true);
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────
  it('boots on a wiped workspace with the app sidebar collapsed', async () => {
    await prepareAm01Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
  });

  it('frees the port on cleanup', async () => {
    await cleanupAm01();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── multi-beat step bodies ────────────────────────────────────────────────
  it('step 1 tours Runtime and Conflicts then returns to Studio', async () => {
    const ctx = makeCtx();
    await runAm01WorkspaceTour(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.VIEW_RUNTIME, API_MOCK.VIEW_CONFLICTS, API_MOCK.VIEW_STUDIO]);
  });

  it('step 2 creates the server, then reads and copies the address', async () => {
    const ctx = makeCtx();
    await runAm01CreateServer(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.CREATE_FIRST, API_MOCK.COPY_ADDRESS]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.SERVER_BAR, 20_000);
  });

  it('step 3 adds a rule and aims it at /health', async () => {
    const ctx = makeCtx();
    await runAm01AuthorMatch(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.ADD_ROUTE]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.ROUTE_EDITOR, 20_000);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.PATH_INPUT, '/health');
  });

  it('step 4 sets 200 from the quick chip and patches the JSON body', async () => {
    const ctx = makeCtx();
    await runAm01AuthorResponse(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.BTAB_RESPONSE, API_MOCK.VARIANT_STATUS_QUICK_200]);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM01_HEALTH_BODY });
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.BODY_SIZE, 20_000);
  });

  it('step 5 starts the listener and waits for Stop', async () => {
    const ctx = makeCtx();
    await runAm01Start(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.START]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.STOP, 20_000);
  });

  it('step 6 sends live traffic, opens the journal, and returns the real status', async () => {
    const ctx = makeCtx();
    await expect(runAm01SendTraffic(ctx)).resolves.toBe(200);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: '/health', method: 'GET' });
    expect(clicks(ctx)).toEqual([API_MOCK.LIVE_TRANSACTIONS]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.JOURNAL_FIRST_ROW, 20_000);
  });

  it('step 6 returns null when the mock is unreachable', async () => {
    sendApiMockRequest.mockResolvedValueOnce(null as never);
    await expect(runAm01SendTraffic(makeCtx())).resolves.toBeNull();
  });

  it('step 7 opens the transaction detail and copies the cURL when offered', async () => {
    mount(API_MOCK.RUNTIME_SAMPLE_CURL, API_MOCK.RUNTIME_COPY_CURL);
    const ctx = makeCtx();
    await runAm01Inspect(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.JOURNAL_FIRST_ROW, API_MOCK.RUNTIME_COPY_CURL]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.TX_DETAIL, 20_000);
  });

  it('step 7 skips the cURL beat when the Runtime guide is not rendered', async () => {
    const ctx = makeCtx();
    await runAm01Inspect(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.JOURNAL_FIRST_ROW]);
  });

  it('step 8 stops the listener and waits for Start to return', async () => {
    const ctx = makeCtx();
    await runAm01Stop(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.STOP]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.START, 20_000);
  });

  // ── guards: recover on rapid Next ─────────────────────────────────────────
  it('ensureAm01StudioView switches back from Runtime', async () => {
    mount(API_MOCK.VIEW_STUDIO, API_MOCK.RUNTIME_PAGE);
    const ctx = makeCtx();
    await ensureAm01StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.SERVER_BAR, 10_000);
  });

  it('ensureAm01StudioView is a no-op when Studio is already visible', async () => {
    mount(API_MOCK.VIEW_STUDIO, API_MOCK.ROUTE_EXPLORER, API_MOCK.SERVER_BAR);
    const ctx = makeCtx();
    await ensureAm01StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm01StudioView bails when the workspace nav is not mounted', async () => {
    const ctx = makeCtx();
    await ensureAm01StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm01Server creates one when missing and skips when present', async () => {
    const ctx = makeCtx();
    await ensureAm01Server(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.CREATE_FIRST);

    mount(API_MOCK.SERVER_BAR);
    const ctx2 = makeCtx();
    await ensureAm01Server(ctx2);
    expect(ctx2.click).not.toHaveBeenCalled();
  });

  it('ensureAm01Rule adds a rule when the editor is absent', async () => {
    mount(API_MOCK.SERVER_BAR);
    const ctx = makeCtx();
    await ensureAm01Rule(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_ROUTE);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ path: '/health' });
  });

  it('ensureAm01Rule skips entirely when the path is already /health', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR);
    mountPathInput('/health');
    const ctx = makeCtx();
    await ensureAm01Rule(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm01Rule falls back to fill when the bridge is unavailable', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR);
    mountPathInput('/');
    const ctx = makeCtx();
    await ensureAm01Rule(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.PATH_INPUT, '/health');
  });

  it('ensureAm01Response opens the Response tab and restores the body', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR);
    mountPathInput('/health');
    const ctx = makeCtx();
    await ensureAm01Response(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM01_HEALTH_BODY });
  });

  it('ensureAm01Response skips the tab click when the body editor is visible', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    const ctx = makeCtx();
    await ensureAm01Response(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm01Running starts a stopped listener', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY, API_MOCK.START);
    mountPathInput('/health');
    mountStatus('Stopped');
    const ctx = makeCtx();
    await ensureAm01Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('ensureAm01Running skips when already running', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    mountStatus('Running');
    const ctx = makeCtx();
    await ensureAm01Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm01Running does nothing when the Start button is absent', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    mountStatus('Stopped');
    const ctx = makeCtx();
    await ensureAm01Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm01Traffic replays a request when the journal is empty', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    mountStatus('Running');
    await ensureAm01Traffic(makeCtx());
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: '/health', method: 'GET' });
  });

  it('ensureAm01Traffic skips the replay when a journal row exists', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    mountStatus('Running');
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'api-mock-dock');
    row.innerHTML = '<table><tbody><tr data-testid="api-mock-tx-1"></tr></tbody></table>';
    document.body.appendChild(row);
    makeVisible(row.querySelector('tr') as HTMLElement);
    await ensureAm01Traffic(makeCtx());
    expect(sendApiMockRequest).not.toHaveBeenCalled();
  });

  it('ensureAm01JournalOpen opens Runtime when no row is visible', async () => {
    mount(API_MOCK.SERVER_BAR, API_MOCK.ROUTE_EDITOR, API_MOCK.VARIANT_BODY);
    mountPathInput('/health');
    mountStatus('Running');
    const ctx = makeCtx();
    await ensureAm01JournalOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm01Stoppable returns to Studio with the listener still running', async () => {
    mount(API_MOCK.VIEW_STUDIO, API_MOCK.RUNTIME_PAGE);
    mountStatus('Running');
    const ctx = makeCtx();
    await ensureAm01Stoppable(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });
});
