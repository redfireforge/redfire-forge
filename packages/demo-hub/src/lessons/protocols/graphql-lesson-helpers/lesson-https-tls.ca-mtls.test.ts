/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    patchDemoTabConnection: vi.fn(async () => true),
    loadDemoSession: vi.fn(async () => ({
      lessonId: 'gql-https-tls',
      priorActiveTabId: 'user-1',
      demoTabId: 'demo-tab-gql5',
    })),
    loadTabs: vi.fn(async () => [
      {
        id: 'demo-tab-gql5',
        endpoint: 'https://127.0.0.1:4443/graphql',
        query: '',
        variables: '{}',
        headers: [],
        operationType: 'query',
        modelUri: 'file:///demo',
        label: 'Demo',
        unsavedChanges: false,
      },
    ]),
  };
});

import {
  setupLessonHttpsTlsBeforeEach,
  teardownLessonHttpsTlsAfterEach,
  stubTlsChainDom,
  installTlsBridgeMock,
  clearTlsBridge,
  TLS_PANEL_HTML,
  mockTlsPanelDemoClicks,
} from './lesson-https-tls.testHelpers';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  GQL_TLS_MTLS_ENDPOINT,
  GQL_PLAIN_HTTP,
  GQL_TLS_CA_CERT,
  GQL_TLS_CLIENT_CERT,
  GQL_TLS_CLIENT_KEY,
  ensureTlsEndpoint,
  ensurePlainHttpEndpoint,
  ensureSkipCertEnabled,
  ensureTlsEnvReady,
  ensureTlsAuthConfigured,
  ensureTlsCaConfigured,
  ensureTlsCaIntrospected,
  runTlsCaIntrospectDemoAction,
  ensureMtlsEndpoint,
  ensureMtlsConfigured,
  ensureMtlsIntrospected,
  ensureTlsPhase2Ready,
  runTlsIntrospectClickOnly,
  ensureTlsSkipIntrospectOutcome,
  prepareGqltSkipIntrospectReading,
  ensureTlsCaIntrospectOutcome,
  prepareGqltCaIntrospectReading,
  ensureMtlsIntrospectOutcome,
  prepareGqltMtlsIntrospectReading,
  ensurePlainRestoreIntrospectOutcome,
  prepareGqltRestoreReading,
  ensureMtlsPanelReady,
  gqlTlsLessonSetup,
  gqlTlsLessonCleanup,
} from './lesson-https-tls';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';
import { patchDemoTabConnection, loadDemoSession, loadTabs } from '../../../adapters';

describe('lesson-https-tls helpers — ca & mtls', () => {
  beforeEach(() => {
    setupLessonHttpsTlsBeforeEach();
  });
  afterEach(async () => {
    await teardownLessonHttpsTlsAfterEach();
  });

it('ensureTlsCaConfigured uses demo TLS bridge to apply CA cert', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx);
    await ensureTlsCaConfigured(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
  });

  it('ensureTlsCaConfigured visible demo pauses for human reading time', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx);
    await ensureTlsCaConfigured(ctx, { visible: true });
    const totalPauseMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, call) => sum + (call[0] as number), 0);
    expect(totalPauseMs).toBeGreaterThanOrEqual(5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_CONFIGURE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_CLOSE);
  });

  it('ensureTlsCaConfigured DOM fallback opens TLS panel and pastes CA cert', async () => {
    clearTlsBridge();
    stubTlsChainDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-tls-body">
            <div data-testid="gql-tls-skip-cert"><input type="checkbox" checked /></div>
            <textarea data-testid="gql-tls-ca-cert"></textarea>
            <textarea data-testid="gql-tls-client-cert"></textarea>
            <textarea data-testid="gql-tls-client-key"></textarea>
            <button data-testid="gql-tls-close"></button>
          </div>`,
        );
      }
    });
    await ensureTlsCaConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_CONFIGURE);
  });

  it('ensureTlsCaConfigured skips when already configured', async () => {
    stubTlsChainDom({ skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ctx = makeCtx();
    await ensureTlsCaConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsCaConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsCaConfigured re-runs when CA is set but skip-cert is still enabled', async () => {
    stubTlsChainDom({ skipCert: true, tlsPanelOpen: true, tlsBadge: 'skip' });
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsCaConfigured(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
  });

  it('ensureTlsCaConfigured re-runs when session flag set but CA absent from DOM', async () => {
    clearTlsBridge();
    stubTlsChainDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-tls-body">
            <div data-testid="gql-tls-skip-cert"><input type="checkbox" checked /></div>
            <textarea data-testid="gql-tls-ca-cert"></textarea>
            <textarea data-testid="gql-tls-client-cert"></textarea>
            <textarea data-testid="gql-tls-client-key"></textarea>
            <button data-testid="gql-tls-close"></button>
          </div>`,
        );
      }
    });
    await ensureTlsCaConfigured(ctx);
    document.querySelector(GQL.TLS_INDICATOR)?.remove();
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsCaConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsCaConfigured clicks TLS toggle when skip-cert still active (DOM fallback)', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, tlsPanelOpen: true });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, true);
    await ensureTlsCaConfigured(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_TOGGLE);
  });

  it('ensureTlsCaIntrospected introspects when schema badge absent', async () => {
    stubTlsChainDom({ schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureTlsCaIntrospected(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsCaIntrospected skips when already introspected with badge', async () => {
    stubTlsChainDom({ tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureTlsCaIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsCaIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsCaIntrospected skips on mTLS endpoint (4445 requires client cert)', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureTlsCaIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('runTlsCaIntrospectDemoAction pauses for human reading time', async () => {
    stubTlsChainDom({ skipCert: false, tlsBadge: 'ca' });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button data-testid="gql-right-tab-schema" aria-selected="false"></button>
       <button data-testid="gql-introspect-btn"></button>
       <span data-testid="gql-schema-badge-ok"></span>`,
    );
    const ctx = makeCtx();
    await runTlsCaIntrospectDemoAction(ctx);
    const totalPauseMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, call) => sum + (call[0] as number), 0);
    expect(totalPauseMs).toBeGreaterThanOrEqual(5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureMtlsEndpoint on mTLS port does not attempt Phase 2 introspect', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureMtlsEndpoint(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureMtlsEndpoint switches to mTLS port 4445', async () => {
    stubTlsChainDom({ tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_MTLS_ENDPOINT);
  });

  it('ensureMtlsEndpoint skips when already on mTLS endpoint', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ctx = makeCtx();
    await ensureMtlsEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureMtlsEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureMtlsConfigured applies client cert and key with visible paste animation', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, val) => {
      if (sel === GQL.TLS_CLIENT_KEY && val === GQL_TLS_CLIENT_KEY) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>',
        );
      }
    });
    await ensureMtlsConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, GQL_TLS_CLIENT_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
    expect(document.querySelector(GQL.TLS_INDICATOR_MTLS)).toBeTruthy();
  });

  it('ensureMtlsConfigured skips when already configured', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'mtls' });
    const ctx = makeCtx();
    await ensureMtlsConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureMtlsConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('ensureMtlsIntrospected introspects over mTLS', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureMtlsIntrospected(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureMtlsIntrospected skips when schema badge present', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureMtlsIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsCaConfigured uses TLS_SAVE when close button absent', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-tls-body">
            <div data-testid="gql-tls-skip-cert"><input type="checkbox" checked /></div>
            <textarea data-testid="gql-tls-ca-cert"></textarea>
            <textarea data-testid="gql-tls-client-cert"></textarea>
            <textarea data-testid="gql-tls-client-key"></textarea>
            <button data-testid="gql-tls-save"></button>
          </div>`,
        );
      }
    });
    await ensureTlsCaConfigured(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_SAVE);
  });

  it('gqlTlsLessonSetup closes history panel when active', async () => {
    stubTlsChainDom();
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = upsert;
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlTlsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-https-tls', 'HTTPS, TLS & Certificates');
    expect(upsert).toHaveBeenCalledWith('Demo', [{ key: 'authToken', value: 'lesson6-demo-jwt', masked: true }]);
  });

  it('gqlTlsLessonCleanup closes demo tabs', async () => {
    const ctx = makeCtx();
    await gqlTlsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-https-tls');
  });

  it('ensureTlsCaConfigured unchecks skip-cert checkbox in modal when checked (DOM fallback)', async () => {
    clearTlsBridge();
    stubTlsChainDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-tls-body">
            <div data-testid="gql-tls-skip-cert"><input type="checkbox" checked /></div>
            <textarea data-testid="gql-tls-ca-cert"></textarea>
            <textarea data-testid="gql-tls-client-cert"></textarea>
            <textarea data-testid="gql-tls-client-key"></textarea>
            <button data-testid="gql-tls-close"></button>
          </div>`,
        );
      }
    });
    const checkbox = () => document.querySelector<HTMLInputElement>(`${GQL.TLS_SKIP_CERT} input[type="checkbox"]`)!;
    await ensureTlsCaConfigured(ctx);
    expect(checkbox().checked).toBe(false);
  });

  it('ensureTlsAuthConfigured seeds auth via bridge without opening env modal', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsAuthConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('ensureTlsPhase2Ready chains auth executed + TLS endpoint', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsPhase2Ready(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(document.querySelector(GQL.TLS_TOGGLE)).toBeTruthy();
  });

  it('runTlsIntrospectClickOnly clicks introspect without waiting for badge', async () => {
    stubTlsChainDom({ schemaOk: false });
    const ctx = makeCtx();
    await runTlsIntrospectClickOnly(ctx);
    expect(patchDemoTabConnection).toHaveBeenCalledWith({ skipTlsVerify: true });
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('runTlsIntrospectClickOnly persists mTLS on port 4445 instead of skip-cert', async () => {
    installTlsBridgeMock();
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsBadge: 'none' });
    const ctx = makeCtx();
    vi.mocked(patchDemoTabConnection).mockClear();
    await runTlsIntrospectClickOnly(ctx);
    expect(patchDemoTabConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        skipTlsVerify: false,
        tlsClientCert: expect.stringContaining('BEGIN CERTIFICATE'),
        tlsClientKey: expect.stringContaining('BEGIN'),
      }),
    );
    expect(patchDemoTabConnection).not.toHaveBeenCalledWith({ skipTlsVerify: true });
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsSkipIntrospectOutcome introspects when badge absent', async () => {
    stubTlsChainDom({ schemaOk: false });
    const ctx = makeCtx();
    await ensureTlsSkipIntrospectOutcome(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('prepareGqltSkipIntrospectReading enables skip-cert toggle', async () => {
    stubTlsChainDom({ skipCert: false });
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    toggle.addEventListener('click', () => toggle.setAttribute('aria-pressed', 'true'));
    const clickSpy = vi.spyOn(toggle, 'click');
    const ctx = makeCtx();
    await prepareGqltSkipIntrospectReading(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('ensureTlsCaIntrospectOutcome introspects when badge absent', async () => {
    stubTlsChainDom({ schemaOk: false, tlsPanelOpen: true, skipCert: false, tlsBadge: 'ca' });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureTlsCaIntrospectOutcome(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGqltCaIntrospectReading configures CA without visible demo pacing', async () => {
    stubTlsChainDom({ tlsPanelOpen: true, skipCert: false });
    const ctx = makeCtx();
    await prepareGqltCaIntrospectReading(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
  });

  it('ensureMtlsIntrospectOutcome introspects when badge absent on mTLS port', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensureMtlsIntrospectOutcome(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGqltMtlsIntrospectReading configures mTLS quietly', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true, skipCert: false });
    const ctx = makeCtx();
    await prepareGqltMtlsIntrospectReading(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_MTLS)).toBeTruthy();
  });

  it('ensurePlainRestoreIntrospectOutcome restores plain HTTP and introspects', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    const ctx = makeCtx();
    await ensurePlainRestoreIntrospectOutcome(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGqltRestoreReading completes mTLS introspect chain', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
    const ctx = makeCtx();
    await prepareGqltRestoreReading(ctx);
    expect(document.querySelector(GQL.SCHEMA_BADGE_OK)).toBeTruthy();
  });

  it('ensureMtlsPanelReady switches to mTLS endpoint', async () => {
    stubTlsChainDom({ tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsPanelReady(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_MTLS_ENDPOINT);
  });

  it('ensureTlsCaConfigured visible mode runs human-paced CA demo action', async () => {
    stubTlsChainDom({ skipCert: true, schemaOk: true });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    await ensureTlsCaConfigured(ctx, { visible: true });
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
    const totalPauseMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, call) => sum + (call[0] as number), 0);
    expect(totalPauseMs).toBeGreaterThanOrEqual(3000);
  });

  it('ensureMtlsConfigured visible mode runs human-paced mTLS demo action', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    vi.mocked(ctx.fill).mockImplementation(async (sel, val) => {
      if (sel === GQL.TLS_CLIENT_KEY && val === GQL_TLS_CLIENT_KEY) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>',
        );
      }
    });
    await ensureMtlsConfigured(ctx, { visible: true });
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, GQL_TLS_CLIENT_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('ensureTlsCaIntrospectOutcome switches off schema tab before introspect', async () => {
    stubTlsChainDom({ schemaOk: false, tlsPanelOpen: true, skipCert: false, tlsBadge: 'ca' });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    document.querySelector<HTMLElement>(GQL.RIGHT_TAB_SCHEMA)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await ensureTlsCaIntrospectOutcome(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsCaIntrospectOutcome returns early on mTLS endpoint', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, schemaOk: false, tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureTlsCaIntrospectOutcome(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsSkipIntrospectOutcome skips introspect when badge already present', async () => {
    stubTlsChainDom({ schemaOk: true, skipCert: true });
    const ctx = makeCtx();
    await ensureTlsSkipIntrospectOutcome(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsSkipIntrospectOutcome(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureSkipCertEnabled handles missing TLS toggle gracefully', async () => {
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />`;
    const ctx = makeCtx();
    await ensureSkipCertEnabled(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureTlsEndpoint re-applies when stale mTLS port is on the tab', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('ensureMtlsConfigured DOM fallback fills cert fields when bridge absent', async () => {
    clearTlsBridge();
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE && !document.querySelector(GQL.TLS_BODY)) {
        document.body.insertAdjacentHTML('beforeend', TLS_PANEL_HTML.replace('checked', ''));
      }
      if (sel === GQL.TLS_CLOSE) document.querySelector(GQL.TLS_BODY)?.remove();
    });
    await ensureMtlsConfigured(ctx, { visible: false });
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('ensureTlsCaIntrospected switches away from schema tab before introspect', async () => {
    stubTlsChainDom({ schemaOk: false, tlsPanelOpen: true, skipCert: false, tlsBadge: 'ca' });
    document.querySelector(GQL.SCHEMA_BADGE_OK)?.remove();
    document.querySelector<HTMLElement>(GQL.RIGHT_TAB_SCHEMA)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await ensureTlsCaIntrospected(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensurePlainHttpEndpoint falls back to fill when HTTPS persists after patch', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_HTTPS_ENDPOINT });
    vi.mocked(patchDemoTabConnection).mockImplementation(async () => {
      // Simulate DOM still showing HTTPS after patch
    });
    const ctx = makeCtx();
    await ensurePlainHttpEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
  });

  it('ensureTlsCaConfigured quiet mode fills CA when bridge absent', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, schemaOk: true });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    await ensureTlsCaConfigured(ctx, { visible: false });
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsCaConfigured quiet mode uses bridge fast path when available', async () => {
    installTlsBridgeMock();
    stubTlsChainDom({ skipCert: true, schemaOk: true, tlsBadge: 'none' });
    const ctx = makeCtx();
    await ensureTlsCaConfigured(ctx, { visible: false });
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsCaConfigured visible mode fills CA when bridge absent', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, schemaOk: true });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    await ensureTlsCaConfigured(ctx, { visible: true });
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('runTlsCaIntrospectDemoAction skips schema tab click when already selected', async () => {
    stubTlsChainDom({ skipCert: false, tlsBadge: 'ca' });
    document.querySelector<HTMLElement>(GQL.RIGHT_TAB_SCHEMA)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await runTlsCaIntrospectDemoAction(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureMtlsConfigured visible mode skips CA fill when already present', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ca = document.querySelector<HTMLTextAreaElement>(GQL.TLS_CA_CERT)!;
    ca.value = GQL_TLS_CA_CERT;
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    vi.mocked(ctx.fill).mockImplementation(async (sel, val) => {
      if (sel === GQL.TLS_CLIENT_KEY && val === GQL_TLS_CLIENT_KEY) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>',
        );
      }
    });
    await ensureMtlsConfigured(ctx, { visible: true });
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsEnvReady is idempotent on second call', async () => {
    stubTlsChainDom();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
    const ctx = makeCtx();
    await ensureTlsEnvReady(ctx);
    vi.mocked((window as unknown as Record<string, unknown>).__demoUpsertGqlEnv as ReturnType<typeof vi.fn>).mockClear();
    await ensureTlsEnvReady(ctx);
    expect((window as unknown as Record<string, unknown>).__demoUpsertGqlEnv).not.toHaveBeenCalled();
  });

  it('ensureTlsAuthConfigured is idempotent after first configure', async () => {
    stubTlsChainDom({ schemaOk: true });
    const ctx = makeCtx();
    await ensureTlsAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, expect.any(String));
  });

  it('ensureMtlsConfigured quiet mode uses bridge fast path when available', async () => {
    installTlsBridgeMock();
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    const ctx = makeCtx();
    await ensureMtlsConfigured(ctx, { visible: false });
    expect(document.querySelector(GQL.TLS_INDICATOR_MTLS)).toBeTruthy();
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
    expect(patchDemoTabConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        skipTlsVerify: false,
        tlsCaCert: expect.stringContaining('BEGIN CERTIFICATE'),
        tlsClientCert: expect.stringContaining('BEGIN CERTIFICATE'),
        tlsClientKey: expect.stringContaining('BEGIN'),
      }),
    );
  });

  it('runTlsCaCertDemoAction skips modal open when TLS body already present', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, schemaOk: true, tlsPanelOpen: true });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    await ensureTlsCaConfigured(ctx, { visible: true });
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TLS_CONFIGURE);
  });

  it('gqlTlsLessonSetup activates editor and response tabs when inactive', async () => {
    stubTlsChainDom();
    document.querySelector(GQL.MODE_EDITOR)?.classList.remove('gql-mode-btn--active');
    document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)?.setAttribute('aria-selected', 'false');
    const editorClick = vi.spyOn(document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!, 'click');
    const responseClick = vi.spyOn(document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!, 'click');
    const ctx = makeCtx();
    await gqlTlsLessonSetup(ctx);
    expect(editorClick).toHaveBeenCalled();
    expect(responseClick).toHaveBeenCalled();
  });

  // ── Branch coverage: DOM detection + internal modal paths ─────────────────

  it('ensureTlsCaConfigured skips when CA textarea is populated without indicator badge', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: false, tlsPanelOpen: true, tlsBadge: 'none' });
    document.querySelector(GQL.TLS_INDICATOR)?.remove();
    document.querySelector<HTMLTextAreaElement>(GQL.TLS_CA_CERT)!.value = GQL_TLS_CA_CERT;
    const ctx = makeCtx();
    await ensureTlsCaConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsCaConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureMtlsConfigured re-syncs when DOM has PEM but mTLS badge is missing', async () => {
    clearTlsBridge();
    stubTlsChainDom({
      endpoint: GQL_TLS_MTLS_ENDPOINT,
      skipCert: false,
      tlsPanelOpen: true,
      tlsBadge: 'none',
    });
    document.querySelector(GQL.TLS_INDICATOR)?.remove();
    document.querySelector<HTMLTextAreaElement>(GQL.TLS_CLIENT_CERT)!.value = GQL_TLS_CLIENT_CERT;
    document.querySelector<HTMLTextAreaElement>(GQL.TLS_CLIENT_KEY)!.value = GQL_TLS_CLIENT_KEY;
    const ctx = makeCtx();
    await ensureMtlsConfigured(ctx, { visible: false });
    vi.mocked(ctx.fill).mockClear();
    await ensureMtlsConfigured(ctx, { visible: false });
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('ensureSkipCertDisabled clicks TLS toggle when skip-cert is active before CA setup', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, tlsPanelOpen: false });
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, true);
    await ensureTlsCaConfigured(ctx, { visible: false });
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_TOGGLE);
  });

  it('ensureTlsCaConfigured quiet mode closes modal via native close button click', async () => {
    clearTlsBridge();
    stubTlsChainDom({ skipCert: true, schemaOk: true, tlsPanelOpen: true });
    const closeBtn = document.querySelector<HTMLButtonElement>(GQL.TLS_CLOSE)!;
    const closeSpy = vi.spyOn(closeBtn, 'click');
    const ctx = makeCtx();
    mockTlsPanelDemoClicks(ctx, false);
    await ensureTlsCaConfigured(ctx, { visible: false });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('ensureMtlsConfigured quiet mode saves via TLS_SAVE when close button absent', async () => {
    clearTlsBridge();
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: true, tlsBadge: 'ca' });
    document.querySelector(GQL.TLS_CLOSE)?.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button data-testid="gql-tls-save"></button>',
    );
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_SAVE) document.querySelector(GQL.TLS_BODY)?.remove();
    });
    await ensureMtlsConfigured(ctx, { visible: false });
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_SAVE);
  });

  it('runTlsCaIntrospectDemoAction handles missing schema tab element', async () => {
    stubTlsChainDom({ skipCert: false, tlsBadge: 'ca' });
    document.querySelector(GQL.RIGHT_TAB_SCHEMA)?.remove();
    const ctx = makeCtx();
    await runTlsCaIntrospectDemoAction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('ensurePlainHttpEndpoint patches connection when session has no demoTabId', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce(null);
    stubTlsChainDom({ endpoint: GQL_TLS_HTTPS_ENDPOINT });
    const ctx = makeCtx();
    await ensurePlainHttpEndpoint(ctx);
    expect(patchDemoTabConnection).toHaveBeenCalled();
  });

  it('ensureTlsCaIntrospectOutcome skips introspect when badge already present', async () => {
    stubTlsChainDom({ tlsPanelOpen: true, skipCert: false, tlsBadge: 'ca' });
    const ctx = makeCtx();
    await ensureTlsCaIntrospectOutcome(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsCaIntrospectOutcome(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureMtlsIntrospectOutcome skips introspect when badge already present', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true, tlsBadge: 'mtls' });
    const ctx = makeCtx();
    await ensureMtlsIntrospectOutcome(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureMtlsIntrospectOutcome(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensurePlainRestoreIntrospectOutcome skips endpoint fill when already plain HTTP', async () => {
    stubTlsChainDom({ endpoint: GQL_PLAIN_HTTP, schemaOk: true });
    vi.mocked(loadTabs).mockResolvedValueOnce([
      {
        id: 'demo-tab-gql5',
        endpoint: GQL_PLAIN_HTTP,
        query: '',
        variables: '{}',
        headers: [],
        operationType: 'query',
        modelUri: 'file:///demo',
        label: 'Demo',
        unsavedChanges: false,
      },
    ]);
    const ctx = makeCtx();
    await ensureMtlsIntrospected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensurePlainRestoreIntrospectOutcome(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
  });

  it('ensureGqlTlsPanelOpen waits for configure on mTLS endpoint without configure button', async () => {
    clearTlsBridge();
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, skipCert: false, tlsPanelOpen: false });
    document.querySelector(GQL.TLS_CONFIGURE)?.remove();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE) {
        document.body.insertAdjacentHTML('beforeend', '<button data-testid="gql-tls-configure"></button>');
      }
    });
    await ensureMtlsConfigured(ctx, { visible: false });
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TLS_CONFIGURE, 5000);
  });

  it('closeGqlTlsModal returns early when TLS body is absent', async () => {
    stubTlsChainDom({ schemaOk: true });
    const ctx = makeCtx();
    await runTlsIntrospectClickOnly(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TLS_CLOSE);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TLS_SAVE);
  });
});
