/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true}' }));
const patchApiMockActiveRoute = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
}));

import {
  AM20_CERT_FACET,
  AM20_CERT_SUBJECT,
  AM20_CERT_SUBJECT_WRONG,
  AM20_CN,
  AM20_CORPUS_SAMPLE,
  AM20_HEALTH,
  AM20_TIMING,
  am20AddressText,
  am20ConditionIds,
  am20ConditionKey,
  am20ConditionSource,
  am20FindCertCondition,
  am20InputValue,
  am20SimOutcome,
  cleanupAm20,
  closeAm20Export,
  closeAm20SettingsModal,
  closeAm20Simulate,
  ensureAm20ForCertPredicate,
  ensureAm20ForHttpsLive,
  ensureAm20ForInspect,
  ensureAm20ForMtls,
  ensureAm20ForProveCert,
  ensureAm20ForProveHttps,
  ensureAm20ForRedaction,
  ensureAm20Library,
  ensureAm20OnApiMock,
  ensureAm20StudioView,
  hasAm20CertPredicate,
  hasAm20Http2Badge,
  hasAm20Library,
  hasAm20MtlsIssued,
  hasAm20Server,
  hasAm20TlsPem,
  hasAm20Traffic,
  isAm20ExportConfirmOpen,
  isAm20ExportMenuOpen,
  isAm20HttpsAddress,
  isAm20MtlsOn,
  isAm20ServerRunning,
  isAm20SettingsOpen,
  isAm20SimulateOpen,
  isAm20StudioViewActive,
  isAm20TlsOn,
  isAm20ToggleOn,
  prepareAm20Workspace,
  runAm20CertPredicate,
  runAm20GenerateTls,
  runAm20HttpsLive,
  runAm20InspectCert,
  runAm20Mtls,
  runAm20ProveCertMatch,
  runAm20ProveHttps,
  runAm20RedactionParity,
} from './api-mock-am20-helpers';

const APP_AB = '[data-testid="ab-protocols"]';
const PEM = '-----BEGIN CERTIFICATE-----\nMII\n-----END CERTIFICATE-----';
const KEY = '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----';

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

function textarea(testid: string, value = ''): HTMLTextAreaElement {
  const node = document.createElement('textarea');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function toggle(testid: string, on: boolean): HTMLElement {
  const node = el('button', on ? 'am-toggle on' : 'am-toggle', testid);
  node.setAttribute('role', 'switch');
  node.setAttribute('aria-checked', on ? 'true' : 'false');
  return node;
}

function select(testid: string, value: string): HTMLElement {
  const node = el('div', 'cs-wrapper am-cs', testid);
  node.setAttribute('data-value', value);
  node.append(el('button', 'cs-trigger'));
  return node;
}

function mountServerBar(running: boolean, extras: {
  address?: string;
  http2?: boolean;
  restart?: boolean;
  warnings?: boolean;
} = {}): HTMLElement {
  const bar = el('div', undefined, 'api-mock-server-bar');
  const listen = el('div', 'am-listen-url', 'api-mock-listen-url');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  const addr = el('span', undefined, 'api-mock-address');
  addr.textContent = extras.address ?? 'http://127.0.0.1:4600';
  listen.append(status, addr);
  bar.append(listen);
  bar.append(el('button', undefined, running ? 'api-mock-stop' : 'api-mock-start'));
  if (extras.restart) bar.append(el('button', undefined, 'api-mock-restart'));
  if (extras.http2) bar.append(el('span', undefined, 'api-mock-http2-badge'));
  if (extras.warnings) bar.append(el('div', undefined, 'api-mock-native-warnings'));
  bar.append(el('button', undefined, 'api-mock-settings'));
  bar.append(el('button', undefined, 'api-mock-export'));
  document.body.append(bar);
  document.body.append(el('button', undefined, 'api-mock-view-studio'));
  document.body.append(el('button', undefined, 'api-mock-live-transactions'));
  return bar;
}

function mountExplorer(): void {
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-health');
  row.setAttribute('role', 'treeitem');
  const path = el('span', 'am-route-path');
  path.setAttribute('data-testid', 'api-mock-route-path');
  path.textContent = AM20_HEALTH;
  row.append(path);
  explorer.append(row);
  document.body.append(explorer);
}

function mountTlsModal(opts: {
  tlsOn?: boolean;
  pem?: boolean;
  mtlsOn?: boolean;
  cn?: string;
  issued?: boolean;
} = {}): HTMLElement {
  const modal = el('div', undefined, 'api-mock-settings-modal');
  modal.append(el('button', undefined, 'api-mock-settings-tab-tls'));
  modal.append(el('div', undefined, 'api-mock-settings-panel-tls'));
  modal.append(toggle('api-mock-settings-tls-enabled', Boolean(opts.tlsOn)));
  modal.append(el('button', undefined, 'api-mock-settings-tls-generate'));
  modal.append(textarea('api-mock-settings-tls-cert', opts.pem ? PEM : ''));
  modal.append(textarea('api-mock-settings-tls-key', opts.pem ? KEY : ''));
  modal.append(toggle('api-mock-settings-mtls-enabled', Boolean(opts.mtlsOn)));
  modal.append(input('api-mock-settings-mtls-cn', opts.cn ?? ''));
  modal.append(el('button', undefined, 'api-mock-settings-mtls-generate'));
  if (opts.issued) {
    modal.append(el('div', undefined, 'api-mock-settings-mtls-issued'));
    modal.append(el('button', undefined, 'api-mock-settings-mtls-download-cert'));
    modal.append(el('button', undefined, 'api-mock-settings-mtls-download-key'));
    modal.append(el('button', undefined, 'api-mock-settings-mtls-download-ca'));
  }
  modal.append(el('button', undefined, 'api-mock-settings-save'));
  modal.append(el('button', undefined, 'api-mock-settings-cancel'));
  document.body.append(modal);
  return modal;
}

function mountJournal(): void {
  const page = el('div', undefined, 'api-mock-runtime-page');
  const dock = el('div', undefined, 'api-mock-dock');
  const toolbar = el('div', undefined, 'api-mock-journal-toolbar');
  dock.append(toolbar);
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');
  tr.setAttribute('data-testid', 'api-mock-tx-tx-1');
  makeVisible(tr);
  const path = el('td', 'am-tx-path');
  path.textContent = AM20_HEALTH;
  tr.append(path);
  tbody.append(tr);
  table.append(tbody);
  dock.append(table);
  const detail = el('div', undefined, 'api-mock-tx-detail');
  const status = el('span', undefined, 'api-mock-tx-response-status');
  status.textContent = '200';
  const res = el('pre', undefined, 'api-mock-tx-response');
  res.textContent = 'HTTP 200';
  detail.append(status, res);
  dock.append(detail);
  page.append(dock);
  document.body.append(page);
}

function mountEditor(opts: { cert?: boolean; empty?: boolean } = {}): HTMLElement {
  const editor = el('div', undefined, 'api-mock-route-editor');
  editor.append(el('button', undefined, 'api-mock-add-condition'));
  editor.append(el('button', undefined, 'api-mock-simulate'));
  if (opts.cert) {
    const row = el('div', 'am-matcher-row', 'api-mock-condition-pred-am20-cert');
    row.append(select('api-mock-condition-source-pred-am20-cert', 'security'));
    row.append(select('api-mock-condition-selector-pred-am20-cert', AM20_CERT_FACET));
    row.append(select('api-mock-condition-operator-pred-am20-cert', 'exact'));
    row.append(input('api-mock-condition-value-pred-am20-cert', AM20_CERT_SUBJECT));
    editor.append(row);
  }
  if (opts.empty) {
    const row = el('div', 'am-matcher-row', 'api-mock-condition-new-1');
    row.append(select('api-mock-condition-source-new-1', 'query'));
    row.append(input('api-mock-condition-selector-new-1', ''));
    row.append(select('api-mock-condition-operator-new-1', 'exact'));
    row.append(input('api-mock-condition-value-new-1', ''));
    editor.append(row);
  }
  document.body.append(editor);
  const matchTab = el('button');
  matchTab.id = 'api-mock-btab-match';
  makeVisible(matchTab);
  document.body.append(matchTab);
  return editor;
}

function mountSimulate(opts: { outcome?: string; subject?: string } = {}): void {
  const workspace = el('div', undefined, 'api-mock-simulate-workspace');
  workspace.append(input('api-mock-simulate-path', AM20_HEALTH));
  workspace.append(input('api-mock-simulate-cert-subject', opts.subject ?? ''));
  workspace.append(el('button', undefined, 'api-mock-simulate-run'));
  workspace.append(el('button', undefined, 'api-mock-simulate-close'));
  const result = el('div', undefined, 'api-mock-simulate-result');
  const outcome = el('span', undefined, 'api-mock-sim-outcome');
  outcome.textContent = opts.outcome ?? 'MATCHED';
  result.append(outcome);
  workspace.append(result);
  document.body.append(workspace);
}

function mountExportConfirm(): void {
  const menu = el('div', undefined, 'api-mock-export-menu-panel');
  menu.append(el('button', undefined, 'api-mock-export-workspace'));
  document.body.append(menu);
  const confirm = el('div', undefined, 'api-mock-export-confirm');
  confirm.append(el('div', undefined, 'api-mock-export-redaction'));
  const key = el('span', undefined, 'api-mock-export-tls-key');
  key.textContent = '***REDACTED***';
  confirm.append(key);
  confirm.append(el('button', undefined, 'api-mock-export-close'));
  document.body.append(confirm);
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  importApiMockGallerySample.mockResolvedValue(true);
  patchApiMockActiveRoute.mockReturnValue(true);
  sendApiMockRequest.mockResolvedValue({ status: 200, body: '{"ok":true}' });
});

describe('AM-20 probes', () => {
  it('reads TLS, mTLS, HTTPS, and cert-predicate state from the DOM', () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    mountEditor({ cert: true });
    mountJournal();

    expect(hasAm20Server()).toBe(true);
    expect(hasAm20Library()).toBe(true);
    expect(isAm20StudioViewActive()).toBe(true);
    expect(isAm20ServerRunning()).toBe(true);
    expect(isAm20SettingsOpen()).toBe(true);
    expect(isAm20TlsOn()).toBe(true);
    expect(hasAm20TlsPem()).toBe(true);
    expect(isAm20MtlsOn()).toBe(true);
    expect(hasAm20MtlsIssued()).toBe(true);
    expect(hasAm20Http2Badge()).toBe(true);
    expect(isAm20HttpsAddress()).toBe(true);
    expect(am20AddressText()).toContain('https://');
    expect(hasAm20Traffic()).toBe(true);
    expect(hasAm20CertPredicate()).toBe(true);
    expect(am20FindCertCondition()).toBe('pred-am20-cert');
    expect(am20ConditionIds()).toEqual(['pred-am20-cert']);
    expect(am20InputValue(API_MOCK.SETTINGS_MTLS_CN)).toBe(AM20_CN);
    expect(isAm20ToggleOn(API_MOCK.SETTINGS_TLS_ENABLED)).toBe(true);
  });

  it('treats empty overlays and a stopped plaintext bar as absent', () => {
    mountServerBar(false);
    expect(isAm20ServerRunning()).toBe(false);
    expect(isAm20HttpsAddress()).toBe(false);
    expect(isAm20SettingsOpen()).toBe(false);
    expect(isAm20SimulateOpen()).toBe(false);
    expect(isAm20ExportConfirmOpen()).toBe(false);
    expect(hasAm20TlsPem()).toBe(false);
    expect(hasAm20CertPredicate()).toBe(false);
    expect(am20SimOutcome()).toBe('');
  });
});

describe('AM-20 boot', () => {
  it('wipes, chromes, and imports the health corpus', async () => {
    await prepareAm20Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM20_CORPUS_SAMPLE);
  });

  it('throws when the health corpus cannot import', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm20Workspace()).rejects.toThrow(/am-gallery-health/);
  });

  it('cleans up by wiping the workspace', async () => {
    await cleanupAm20();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  it('keeps generate hold at 2000ms', () => {
    expect(AM20_TIMING.generate).toBe(2000);
    expect(AM20_TIMING.beforeOpen).toBe(1400);
  });
});

describe('AM-20 quiet chrome', () => {
  it('navigates to API Mock from the activity bar', async () => {
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm20OnApiMock(ctx);
    expect(ctx.click).toHaveBeenCalledWith(APP_AB);
  });

  it('falls back to navigateToTab when chrome is missing', async () => {
    const ctx = makeCtx();
    await ensureAm20OnApiMock(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('switches to Studio when Runtime is showing', async () => {
    mountServerBar(true);
    const page = el('div', undefined, 'api-mock-runtime-page');
    page.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    document.body.append(page);
    const ctx = makeCtx();
    await ensureAm20StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('imports the library when the explorer is missing', async () => {
    mountServerBar(true);
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    const ctx = makeCtx();
    await ensureAm20Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM20_CORPUS_SAMPLE);
  });

  it('closes settings via Cancel, then Save when Cancel is missing', async () => {
    mountTlsModal();
    const ctx = makeCtx();
    await closeAm20SettingsModal(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_CANCEL);

    document.body.innerHTML = '';
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('button', undefined, 'api-mock-settings-save'));
    document.body.append(modal);
    await closeAm20SettingsModal(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
  });

  it('no-ops overlay closes when nothing is open', async () => {
    const ctx = makeCtx();
    await closeAm20SettingsModal(ctx);
    await closeAm20Simulate(ctx);
    await closeAm20Export(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});

describe('AM-20 guards', () => {
  it('opens TLS settings and generates when the PEM is missing', async () => {
    mountServerBar(false);
    mountExplorer();
    mountTlsModal({ tlsOn: false });
    const ctx = makeCtx();
    await ensureAm20ForInspect(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_ENABLED);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_GENERATE);
  });

  it('skips generate when the PEM is already present', async () => {
    mountServerBar(false);
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await ensureAm20ForHttpsLive(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_GENERATE);
  });

  it('saves and starts for the live HTTPS proof', async () => {
    mountServerBar(false);
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await ensureAm20ForProveHttps(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('skips Start when the listener is already running', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await ensureAm20ForProveHttps(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('reopens the TLS panel for the mTLS step without issuing yet', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true, restart: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await ensureAm20ForMtls(ctx);
    expect(isAm20SettingsOpen()).toBe(true);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_GENERATE);
  });

  it('patches a cert predicate quietly when the row is missing', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    mountEditor();
    const ctx = makeCtx();
    await ensureAm20ForProveCert(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      predicates: expect.objectContaining({
        children: [expect.objectContaining({
          source: 'security',
          selector: AM20_CERT_FACET,
          expected: AM20_CERT_SUBJECT,
        })],
      }),
    }));
  });

  it('authors the cert row in the editor when the patch bridge is missing', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    const editor = mountEditor({ empty: true });
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ADD_CONDITION) {
        const row = el('div', 'am-matcher-row', 'api-mock-condition-fresh');
        row.append(select('api-mock-condition-source-fresh', 'query'));
        row.append(select('api-mock-condition-selector-fresh', 'page'));
        row.append(input('api-mock-condition-value-fresh', ''));
        editor.append(row);
      }
    });
    await ensureAm20ForProveCert(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.conditionSource('fresh'), 'security');
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.conditionSelector('fresh'), AM20_CERT_FACET);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.conditionValue('fresh'), AM20_CERT_SUBJECT);
  });

  it('closes Simulate and Export before the redaction step', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    mountEditor({ cert: true });
    mountSimulate();
    mountExportConfirm();
    const ctx = makeCtx();
    await ensureAm20ForRedaction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });
});

describe('AM-20 step bodies', () => {
  it('opens Settings when the TLS modal is closed', async () => {
    mountServerBar(false);
    mountExplorer();
    const ctx = makeCtx();
    await runAm20GenerateTls(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS);
  });

  it('enables TLS and generates a self-signed cert in an open modal', async () => {
    mountServerBar(false);
    mountExplorer();
    mountTlsModal({ pem: true });
    const ctx = makeCtx();
    await runAm20GenerateTls(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_ENABLED);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_GENERATE);
  });

  it('opens the TLS tab when Settings is on another panel', async () => {
    mountServerBar(false);
    mountExplorer();
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('button', undefined, 'api-mock-settings-tab-tls'));
    document.body.append(modal);
    const ctx = makeCtx();
    await runAm20GenerateTls(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_TLS);
  });

  it('skips reopening Settings when the TLS panel is already up', async () => {
    mountServerBar(false);
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await runAm20GenerateTls(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TLS_GENERATE);
  });

  it('holds the private-key note without clicking', async () => {
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await runAm20InspectCert(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('saves, starts, and holds the https address plus HTTP/2 badge', async () => {
    mountServerBar(false, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await runAm20HttpsLive(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('skips Start when https-live already has a running listener', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    const ctx = makeCtx();
    await runAm20HttpsLive(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('fetches /health and opens the 200 journal row', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountJournal();
    const ctx = makeCtx();
    await runAm20ProveHttps(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM20_HEALTH, method: 'GET' });
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-tx-tx-1"]');
  });

  it('opens the journal from the live strip when the dock table is missing', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600' });
    mountExplorer();
    const ctx = makeCtx();
    await runAm20ProveHttps(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('toggles mTLS, fills the CN, generates, saves, and restarts', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true, restart: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, issued: true });
    const ctx = makeCtx();
    await runAm20Mtls(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_ENABLED);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_CN, AM20_CN);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_GENERATE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESTART);
  });

  it('starts instead of restarting when mTLS save leaves the listener down', async () => {
    mountServerBar(false, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    const ctx = makeCtx();
    await runAm20Mtls(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RESTART);
  });

  it('adds a security certSubject condition on Match', async () => {
    mountServerBar(true);
    mountExplorer();
    const editor = mountEditor();
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ADD_CONDITION) {
        const row = el('div', 'am-matcher-row', 'api-mock-condition-fresh');
        row.append(select('api-mock-condition-source-fresh', 'query'));
        row.append(select('api-mock-condition-selector-fresh', 'page'));
        row.append(input('api-mock-condition-value-fresh', ''));
        editor.append(row);
      }
    });
    await runAm20CertPredicate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_CONDITION);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.conditionSource('fresh'), 'security');
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.conditionSelector('fresh'), AM20_CERT_FACET);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.conditionValue('fresh'), AM20_CERT_SUBJECT);
  });

  it('reuses an existing cert condition instead of stacking a row', async () => {
    mountServerBar(true);
    mountExplorer();
    mountEditor({ cert: true });
    const ctx = makeCtx();
    await runAm20CertPredicate(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_CONDITION);
    expect(ctx.fill).toHaveBeenCalledWith(
      API_MOCK.conditionValue('pred-am20-cert'),
      AM20_CERT_SUBJECT,
    );
  });

  it('opens Match when + Condition is not on the current tab', async () => {
    mountServerBar(true);
    mountExplorer();
    document.body.append(el('div', undefined, 'api-mock-route-editor'));
    const matchTab = el('button');
    matchTab.id = 'api-mock-btab-match';
    makeVisible(matchTab);
    document.body.append(matchTab);
    const ctx = makeCtx();
    await runAm20CertPredicate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_MATCH);
  });

  it('runs Simulate twice — pinned CN then a wrong CN', async () => {
    mountServerBar(true);
    mountExplorer();
    mountEditor({ cert: true });
    mountSimulate({ outcome: 'UNMATCHED' });
    const ctx = makeCtx();
    const outcomes = await runAm20ProveCertMatch(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_CERT_SUBJECT, AM20_CERT_SUBJECT);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_CERT_SUBJECT, AM20_CERT_SUBJECT_WRONG);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
    expect(outcomes.length).toBe(2);
  });

  it('opens Simulate when the workspace is closed', async () => {
    mountServerBar(true);
    mountExplorer();
    mountEditor({ cert: true });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    const ctx = makeCtx();
    await runAm20ProveCertMatch(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE);
  });

  it('opens Export when the menu is closed, then Stop', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true, warnings: true });
    mountExplorer();
    const ctx = makeCtx();
    await runAm20RedactionParity(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STOP);
  });

  it('holds redaction in an open confirmation, then Stop', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true, warnings: true });
    mountExplorer();
    mountExportConfirm();
    const ctx = makeCtx();
    await runAm20RedactionParity(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_WORKSPACE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STOP);
  });

  it('skips native warnings when the badge is absent and still stops', async () => {
    mountServerBar(true);
    mountExplorer();
    mountExportConfirm();
    const ctx = makeCtx();
    await runAm20RedactionParity(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STOP);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.NATIVE_WARNINGS);
  });

  it('holds Start after Stop when the listener is already down', async () => {
    mountServerBar(false);
    mountExplorer();
    mountExportConfirm();
    const ctx = makeCtx();
    await runAm20RedactionParity(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.STOP);
  });

  it('falls back to the response pane when the status chip is missing', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600' });
    mountExplorer();
    mountJournal();
    document.querySelector('[data-testid="api-mock-tx-response-status"]')?.remove();
    const ctx = makeCtx();
    await runAm20ProveHttps(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('fills the Simulate path when it is not /health', async () => {
    mountServerBar(true);
    mountExplorer();
    mountEditor({ cert: true });
    mountSimulate({ outcome: 'MATCHED' });
    const path = document.querySelector<HTMLInputElement>('[data-testid="api-mock-simulate-path"]');
    if (path) path.value = '/other';
    const ctx = makeCtx();
    await runAm20ProveCertMatch(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_PATH, AM20_HEALTH);
  });
});

describe('AM-20 remaining branches', () => {
  it('clicks the studio subnav when the activity bar is already Protocols', async () => {
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm20OnApiMock(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APP_SUBNAV);
  });

  it('treats the empty studio as an active Studio view', () => {
    document.body.append(el('div', undefined, 'api-mock-empty'));
    expect(isAm20StudioViewActive()).toBe(true);
  });

  it('reads a text-input selector key on a non-security row', () => {
    mountEditor({ empty: true });
    expect(am20FindCertCondition()).toBeNull();
    expect(am20ConditionIds()[0]).toBe('new-1');
  });

  it('restarts a running listener while quietly arming mTLS', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true, restart: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true });
    mountEditor();
    const ctx = makeCtx();
    await ensureAm20ForCertPredicate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_GENERATE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESTART);
  });

  it('opens Settings quietly when inspect starts with the modal closed', async () => {
    mountServerBar(false);
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm20ForInspect(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS);
  });

  it('opens the TLS tab quietly when inspect finds Settings on another panel', async () => {
    mountServerBar(false);
    mountExplorer();
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('button', undefined, 'api-mock-settings-tab-tls'));
    document.body.append(modal);
    const ctx = makeCtx();
    await ensureAm20ForInspect(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SETTINGS_TAB_TLS);
  });

  it('skips the quiet cert patch when the row already exists', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600', http2: true });
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN, issued: true });
    mountEditor({ cert: true });
    patchApiMockActiveRoute.mockClear();
    const ctx = makeCtx();
    await ensureAm20ForProveCert(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('returns early when generate has no Settings button', async () => {
    mountExplorer();
    const ctx = makeCtx();
    await runAm20GenerateTls(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS);
  });

  it('returns early when mTLS controls are missing', async () => {
    mountServerBar(true);
    mountExplorer();
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('button', undefined, 'api-mock-settings-tab-tls'));
    modal.append(el('div', undefined, 'api-mock-settings-panel-tls'));
    modal.append(toggle('api-mock-settings-tls-enabled', true));
    document.body.append(modal);
    const ctx = makeCtx();
    await runAm20Mtls(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_MTLS_GENERATE);
  });

  it('closes an open Simulate workspace', async () => {
    mountSimulate();
    const ctx = makeCtx();
    await closeAm20Simulate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('skips export close when the footer button is missing', async () => {
    document.body.append(el('div', undefined, 'api-mock-export-confirm'));
    const ctx = makeCtx();
    await closeAm20Export(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('reads empty values from non-inputs and a missing toggle', () => {
    mountServerBar(false);
    expect(am20InputValue(API_MOCK.SETTINGS)).toBe('');
    expect(isAm20ToggleOn(API_MOCK.SETTINGS_TLS_ENABLED)).toBe(false);
    expect(hasAm20Http2Badge()).toBe(false);
    expect(hasAm20Traffic()).toBe(false);
    expect(isAm20SimulateOpen()).toBe(false);
    expect(isAm20ExportMenuOpen()).toBe(false);
    expect(hasAm20Library()).toBe(false);
  });

  it('treats a studio shell without a server bar as already on API Mock', async () => {
    document.body.append(el('div', undefined, 'api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm20OnApiMock(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('https-live is a no-op without Save or Start', async () => {
    mountServerBar(true, { address: 'https://127.0.0.1:4600' });
    mountExplorer();
    const ctx = makeCtx();
    await runAm20HttpsLive(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SETTINGS_SAVE);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('prove-https still fetches when the journal chrome is missing', async () => {
    mountServerBar(true);
    mountExplorer();
    document.body.querySelector('[data-testid="api-mock-live-transactions"]')?.remove();
    const ctx = makeCtx();
    await runAm20ProveHttps(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM20_HEALTH, method: 'GET' });
  });

  it('covers empty-control and missing-selector branches', async () => {
    mountEditor({ empty: true });
    expect(am20ConditionKey('missing')).toBe('');
    expect(am20ConditionSource('missing')).toBe('');
    expect(am20ConditionKey('new-1')).toBe('');
    expect(am20ConditionSource('new-1')).toBe('query');

    document.body.innerHTML = '';
    const page = el('div', undefined, 'api-mock-runtime-page');
    document.body.append(page);
    await ensureAm20StudioView(makeCtx());

    document.body.innerHTML = '';
    mountServerBar(true);
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await ensureAm20Library(makeCtx());

    document.body.innerHTML = '';
    document.body.append(el('div', undefined, 'api-mock-settings-modal'));
    await closeAm20SettingsModal(makeCtx());

    document.body.innerHTML = '';
    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    await closeAm20Simulate(makeCtx());

    document.body.innerHTML = '';
    mountTlsModal({ tlsOn: true });
    document.querySelector('[data-testid="api-mock-settings-tls-key"]')?.remove();
    document.querySelector('[data-testid="api-mock-settings-tls-generate"]')?.remove();
    document.querySelector('[data-testid="api-mock-settings-tls-cert"]')?.remove();
    await runAm20InspectCert(makeCtx());
    await runAm20GenerateTls(makeCtx());

    document.body.innerHTML = '';
    mountServerBar(true);
    mountExplorer();
    mountTlsModal({ tlsOn: true, pem: true, mtlsOn: true, cn: AM20_CN });
    document.querySelector('[data-testid="api-mock-settings-mtls-generate"]')?.remove();
    document.querySelector('[data-testid="api-mock-settings-save"]')?.remove();
    await runAm20Mtls(makeCtx());

    document.body.innerHTML = '';
    mountServerBar(true);
    mountExplorer();
    mountEditor({ cert: true });
    await runAm20ProveCertMatch(makeCtx());

    document.body.innerHTML = '';
    mountServerBar(false);
    mountExplorer();
    const modal = el('div', undefined, 'api-mock-settings-modal');
    modal.append(el('div', undefined, 'api-mock-settings-panel-tls'));
    modal.append(toggle('api-mock-settings-tls-enabled', true));
    modal.append(textarea('api-mock-settings-tls-cert', PEM));
    document.body.append(modal);
    await ensureAm20ForProveHttps(makeCtx());
  });
});
