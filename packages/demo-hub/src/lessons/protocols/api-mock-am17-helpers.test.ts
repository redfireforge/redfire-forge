/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const ensureBlankApiMockServer = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"service":"api-mock-echo"}' }));
const patchApiMockServerSettings = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  ensureBlankApiMockServer: (...a: unknown[]) => ensureBlankApiMockServer(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  patchApiMockServerSettings: (...a: unknown[]) => patchApiMockServerSettings(...(a as [])),
}));

import {
  AM17_DOCKER_COMMAND,
  AM17_ECHO_HEALTH,
  AM17_ECHO_ORIGIN,
  AM17_ECHO_PATH,
  AM17_TIMING,
  am17AllowlistValue,
  am17DraftRows,
  am17TxOutcome,
  cleanupAm17,
  closeAm17Settings,
  ensureAm17ForDraft,
  ensureAm17ForGuards,
  ensureAm17ForProxiedCall,
  ensureAm17ForRecord,
  ensureAm17ForSafety,
  ensureAm17ForStart,
  ensureAm17ForTakeOver,
  ensureAm17Running,
  ensureAm17Server,
  ensureAm17StudioView,
  hasAm17Allowlist,
  hasAm17Draft,
  hasAm17Server,
  hasAm17Traffic,
  isAm17ForwardAuthOn,
  isAm17PrivateBlocked,
  isAm17ProxyEnabled,
  isAm17ProxyPanelOpen,
  isAm17RecordOn,
  isAm17RouteEnabled,
  isAm17SelectionPanelOpen,
  isAm17ServerRunning,
  isAm17SettingsOpen,
  isAm17StudioViewActive,
  isAm17SwitchOn,
  prepareAm17Workspace,
  runAm17DraftAppears,
  runAm17Guards,
  runAm17ProxiedCall,
  runAm17ProxyOn,
  runAm17ProxySafety,
  runAm17RecordAndFallback,
  runAm17Start,
  runAm17TakeOver,
} from './api-mock-am17-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function switchBtn(testid: string, on: boolean): HTMLElement {
  const btn = el('button', on ? 'am-toggle on' : 'am-toggle', testid);
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  return btn;
}

function mountServerBar(running: boolean, extras: { apply?: boolean; address?: boolean } = {}): HTMLElement {
  const bar = el('div', undefined, 'api-mock-server-bar');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status, el('button', undefined, running ? 'api-mock-stop' : 'api-mock-start'));
  bar.append(el('button', undefined, 'api-mock-settings'));
  if (extras.apply) bar.append(el('button', undefined, 'api-mock-apply'));
  if (extras.address) {
    const addr = el('span', undefined, 'api-mock-address');
    addr.textContent = 'http://127.0.0.1:4600';
    bar.append(addr);
  }
  document.body.append(bar);
  return bar;
}

function mountExplorer(drafts = 0): HTMLElement {
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  for (let i = 0; i < drafts; i++) {
    const row = el('button', 'am-route-item disabled', `api-mock-route-draft-${i}`);
    row.setAttribute('role', 'treeitem');
    explorer.append(row);
  }
  document.body.append(explorer);
  return explorer;
}

function mountSettings(opts: {
  proxy?: boolean;
  selection?: boolean;
  enabled?: boolean;
  privateOn?: boolean;
  forward?: boolean;
  record?: boolean;
  allowlist?: string;
} = {}): HTMLElement {
  const modal = el('div', undefined, 'api-mock-settings-modal');
  modal.append(
    el('button', undefined, 'api-mock-settings-tab-proxy'),
    el('button', undefined, 'api-mock-settings-tab-selection'),
    el('button', undefined, 'api-mock-settings-save'),
    el('button', undefined, 'api-mock-settings-cancel'),
  );
  if (opts.proxy !== false) {
    const panel = el('div', undefined, 'api-mock-settings-panel-proxy');
    panel.append(
      switchBtn('api-mock-settings-proxy-enabled', opts.enabled ?? false),
      el('p', undefined, 'api-mock-settings-proxy-deny'),
      (() => {
        const ta = document.createElement('textarea');
        ta.setAttribute('data-testid', 'api-mock-settings-proxy-allowlist');
        ta.value = opts.allowlist ?? '';
        makeVisible(ta);
        return ta;
      })(),
      switchBtn('api-mock-settings-proxy-private', opts.privateOn ?? true),
      switchBtn('api-mock-settings-proxy-forward-auth', opts.forward ?? false),
      switchBtn('api-mock-settings-proxy-record', opts.record ?? true),
      el('p', undefined, 'api-mock-settings-proxy-loop'),
    );
    modal.append(panel);
  }
  if (opts.selection) {
    modal.append(
      el('div', undefined, 'api-mock-settings-panel-selection'),
      el('div', undefined, 'api-mock-settings-fallback-mode'),
    );
  }
  document.body.append(modal);
  return modal;
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
  dock.append(el('div', undefined, 'api-mock-tx-detail'));
  const outcome = el('span', undefined, 'api-mock-tx-outcome');
  outcome.textContent = 'proxied';
  dock.append(outcome);
  const status = el('span', undefined, 'api-mock-tx-response-status');
  status.textContent = '200';
  dock.append(status);
  document.body.append(dock);
  document.body.append(el('button', undefined, 'api-mock-live-transactions'));
}

beforeEach(() => {
  document.body.replaceChildren();
  wipeApiMockWorkspace.mockClear().mockResolvedValue(true);
  ensureBlankApiMockServer.mockClear().mockResolvedValue(true);
  prepareApiMockStudioChrome.mockClear();
  sendApiMockRequest.mockClear().mockResolvedValue({ status: 200, body: '{}' });
  patchApiMockServerSettings.mockClear().mockReturnValue(true);
});

describe('AM-17 helpers', () => {
  it('pins echo origin, path, docker command, and slower timing', () => {
    expect(AM17_ECHO_ORIGIN).toBe('http://localhost:4017');
    expect(AM17_ECHO_HEALTH).toBe('http://localhost:4017/health');
    expect(AM17_ECHO_PATH).toBe('/widgets/42');
    expect(AM17_DOCKER_COMMAND).toContain('docker/api-mock');
    expect(AM17_TIMING.beforeOpen).toBe(1400);
    expect(AM17_TIMING.payoff).toBe(1600);
  });

  it('reads probes from an empty document as false', () => {
    expect(isAm17StudioViewActive()).toBe(false);
    expect(hasAm17Server()).toBe(false);
    expect(isAm17SettingsOpen()).toBe(false);
    expect(isAm17ProxyPanelOpen()).toBe(false);
    expect(isAm17SelectionPanelOpen()).toBe(false);
    expect(isAm17ServerRunning()).toBe(false);
    expect(isAm17SwitchOn(API_MOCK.SETTINGS_PROXY_ENABLED)).toBe(false);
    expect(isAm17ProxyEnabled()).toBe(false);
    expect(isAm17PrivateBlocked()).toBe(false);
    expect(isAm17ForwardAuthOn()).toBe(false);
    expect(isAm17RecordOn()).toBe(false);
    expect(am17AllowlistValue()).toBe('');
    expect(hasAm17Allowlist()).toBe(false);
    expect(am17DraftRows()).toEqual([]);
    expect(hasAm17Draft()).toBe(false);
    expect(isAm17RouteEnabled()).toBe(false);
    expect(hasAm17Traffic()).toBe(false);
    expect(am17TxOutcome()).toBe('');
  });

  it('reads probes from a mounted studio', () => {
    mountServerBar(true, { address: true });
    mountExplorer(1);
    mountSettings({ enabled: true, privateOn: true, forward: true, record: true, allowlist: AM17_ECHO_ORIGIN, selection: true });
    const enabled = el('button', undefined, 'api-mock-route-enabled');
    enabled.setAttribute('title', 'Disable route');
    document.body.append(enabled);
    mountJournal();

    expect(hasAm17Server()).toBe(true);
    expect(isAm17StudioViewActive()).toBe(true);
    expect(isAm17ServerRunning()).toBe(true);
    expect(isAm17SettingsOpen()).toBe(true);
    expect(isAm17ProxyPanelOpen()).toBe(true);
    expect(isAm17SelectionPanelOpen()).toBe(true);
    expect(isAm17ProxyEnabled()).toBe(true);
    expect(isAm17PrivateBlocked()).toBe(true);
    expect(isAm17ForwardAuthOn()).toBe(true);
    expect(isAm17RecordOn()).toBe(true);
    expect(hasAm17Allowlist()).toBe(true);
    expect(hasAm17Draft()).toBe(true);
    expect(isAm17RouteEnabled()).toBe(true);
    expect(hasAm17Traffic()).toBe(true);
    expect(am17TxOutcome()).toBe('proxied');
  });

  it('prepares a blank server and wipes on cleanup', async () => {
    await prepareAm17Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    await cleanupAm17();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when a blank server cannot be created', async () => {
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    await expect(prepareAm17Workspace()).rejects.toThrow(/blank mock server/);
  });

  it('skips step bodies and guards when the studio is empty', async () => {
    const ctx = makeCtx();
    await ensureAm17StudioView(ctx);
    await ensureAm17Server(ctx);
    await closeAm17Settings(ctx);
    await ensureAm17ForSafety(ctx);
    await ensureAm17ForRecord(ctx);
    await ensureAm17ForStart(ctx);
    await ensureAm17ForProxiedCall(ctx);
    await ensureAm17ForDraft(ctx);
    await ensureAm17ForTakeOver(ctx);
    await ensureAm17ForGuards(ctx);
    await ensureAm17Running(ctx);
    await runAm17ProxyOn(ctx);
    await runAm17ProxySafety(ctx);
    await runAm17RecordAndFallback(ctx);
    await runAm17Start(ctx);
    await runAm17ProxiedCall(ctx);
    await runAm17DraftAppears(ctx);
    await runAm17TakeOver(ctx);
    await runAm17Guards(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('creates a server from the empty-state button when the bridge fails', async () => {
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    document.body.append(el('button', undefined, 'api-mock-create-first'));
    const ctx = makeCtx();
    await ensureAm17Server(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.CREATE_FIRST);
  });

  it('switches back to Studio from Runtime', async () => {
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm17StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('starts a stopped server and no-ops when already running', async () => {
    mountServerBar(false);
    const ctx = makeCtx();
    await ensureAm17Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);

    document.body.replaceChildren();
    mountServerBar(true);
    ctx.click.mockClear();
    await ensureAm17Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closes an open settings modal', async () => {
    mountSettings();
    const ctx = makeCtx();
    await closeAm17Settings(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_CANCEL);
  });

  it('authors proxy-on: enable, deny note, allowlist', async () => {
    mountServerBar(false);
    mountSettings({ enabled: false, allowlist: '' });
    const ctx = makeCtx();
    await runAm17ProxyOn(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ENABLED);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN);
  });

  it('skips enable and fill when proxy is already armed', async () => {
    mountServerBar(false);
    mountSettings({ enabled: true, allowlist: AM17_ECHO_ORIGIN });
    const ctx = makeCtx();
    await runAm17ProxyOn(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ENABLED);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('opens Settings when the modal is closed, then aims Proxy', async () => {
    mountServerBar(false);
    const ctx = makeCtx();
    await runAm17ProxyOn(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS);
  });

  it('turns the private fence off and opts in to forward-auth', async () => {
    mountServerBar(false);
    mountSettings({ enabled: true, privateOn: true, forward: false });
    const ctx = makeCtx();
    await runAm17ProxySafety(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_PRIVATE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
  });

  it('holds safety toggles that are already in the lesson state', async () => {
    mountServerBar(false);
    mountSettings({ enabled: true, privateOn: false, forward: true });
    const ctx = makeCtx();
    await runAm17ProxySafety(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_PRIVATE);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
  });

  it('holds record-on, selects proxy fallback, and saves', async () => {
    mountServerBar(false);
    mountSettings({ record: true, selection: true });
    const ctx = makeCtx();
    await runAm17RecordAndFallback(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_RECORD);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SETTINGS_FALLBACK_MODE, 'proxy');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
  });

  it('turns record on when the default was flipped off', async () => {
    mountServerBar(false);
    mountSettings({ record: false, selection: true });
    const ctx = makeCtx();
    await runAm17RecordAndFallback(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_RECORD);
  });

  it('starts the listener and holds Running + address', async () => {
    mountServerBar(false, { address: true });
    const ctx = makeCtx();
    await runAm17Start(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('skips Start when already running', async () => {
    mountServerBar(true, { address: true });
    const ctx = makeCtx();
    await runAm17Start(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('sends an unmocked path and opens the proxied journal row', async () => {
    mountServerBar(true, { address: true });
    mountJournal();
    const ctx = makeCtx();
    await expect(runAm17ProxiedCall(ctx)).resolves.toBe(200);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM17_ECHO_PATH, method: 'GET' });
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-tx-1"]');
  });

  it('returns null when the live fetch is refused', async () => {
    sendApiMockRequest.mockResolvedValueOnce(null as never);
    const ctx = makeCtx();
    await expect(runAm17ProxiedCall(ctx)).resolves.toBeNull();
  });

  it('selects the recorded draft and holds the body', async () => {
    mountServerBar(true);
    mountExplorer(1);
    document.body.append(el('textarea', undefined, 'api-mock-variant-body'));
    const ctx = makeCtx();
    await runAm17DraftAppears(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-route-draft-0"]');
  });

  it('enables the draft, Applies, and proves a matched row', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer(1);
    const enabled = el('button', undefined, 'api-mock-route-enabled');
    enabled.setAttribute('title', 'Enable route');
    document.body.append(enabled);
    document.body.append(el('span', undefined, 'api-mock-dirty-badge'));
    mountJournal();
    const ctx = makeCtx();
    await runAm17TakeOver(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ENABLED);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM17_ECHO_PATH, method: 'GET' });
  });

  it('skips enable when the draft is already live', async () => {
    mountServerBar(true);
    const enabled = el('button', undefined, 'api-mock-route-enabled');
    enabled.setAttribute('title', 'Disable route');
    document.body.append(enabled);
    const ctx = makeCtx();
    await runAm17TakeOver(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ROUTE_ENABLED);
  });

  it('holds the 508 note and selects closest-match', async () => {
    mountServerBar(true);
    mountSettings({ selection: true });
    const ctx = makeCtx();
    await runAm17Guards(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SETTINGS_FALLBACK_MODE, 'closest_match_debug');
  });

  it('quietly patches proxy settings when the modal is closed', async () => {
    mountServerBar(false);
    const ctx = makeCtx();
    await ensureAm17ForStart(ctx);
    expect(patchApiMockServerSettings).toHaveBeenCalledWith(expect.objectContaining({
      proxyEnabled: true,
      proxyAllowlist: [AM17_ECHO_ORIGIN],
      proxyBlockPrivate: false,
      fallbackMode: 'proxy',
    }));
  });

  it('quietly clicks through an open settings modal instead of patching', async () => {
    mountServerBar(false);
    mountSettings({ enabled: false, allowlist: '', privateOn: true, forward: false, record: false, selection: true });
    const ctx = makeCtx();
    await ensureAm17ForStart(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ENABLED);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SETTINGS_FALLBACK_MODE, 'proxy');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
  });

  it('safety and record guards fill a missing allowlist', async () => {
    mountServerBar(false);
    mountSettings({ enabled: false, allowlist: '' });
    const ctx = makeCtx();
    await ensureAm17ForSafety(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ENABLED);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_ALLOWLIST, AM17_ECHO_ORIGIN);
    await ensureAm17ForRecord(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_PRIVATE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH);
  });

  it('take-over guard selects an existing draft', async () => {
    mountServerBar(true);
    mountExplorer(1);
    const ctx = makeCtx();
    await ensureAm17ForTakeOver(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-route-draft-0"]');
  });

  it('does not recreate a server that is already open', async () => {
    mountServerBar(false);
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm17Server(ctx);
    expect(ensureBlankApiMockServer).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('aims the Selection tab when the panel is not yet mounted', async () => {
    mountServerBar(false);
    mountSettings({ record: true });
    const ctx = makeCtx();
    await runAm17RecordAndFallback(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_SELECTION);
  });

  it('quietly opens Selection when arming through an open modal', async () => {
    mountServerBar(false);
    mountSettings({ enabled: true, allowlist: AM17_ECHO_ORIGIN, privateOn: false, forward: true, record: true });
    const ctx = makeCtx();
    await ensureAm17ForStart(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_SELECTION);
  });

  it('aims the Proxy tab when the panel is not yet mounted', async () => {
    mountServerBar(false);
    mountSettings({ proxy: false });
    const ctx = makeCtx();
    await runAm17ProxyOn(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_PROXY);
  });

  it('quietly opens Settings when the modal is closed', async () => {
    mountServerBar(false);
    document.body.append(el('button', undefined, 'api-mock-settings'));
    const ctx = makeCtx();
    await ensureAm17ForSafety(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS);
  });

  it('quietly opens the Proxy tab when the panel is not mounted', async () => {
    mountServerBar(false);
    mountSettings({ proxy: false });
    const ctx = makeCtx();
    await ensureAm17ForSafety(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_PROXY);
  });

  it('opens the journal from the live strip when the dock is empty', async () => {
    mountServerBar(true, { address: true });
    document.body.append(el('button', undefined, 'api-mock-live-transactions'));
    const ctx = makeCtx();
    await runAm17ProxiedCall(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });
});
