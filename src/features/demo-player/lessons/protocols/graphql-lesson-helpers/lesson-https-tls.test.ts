/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '../../../../../shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  GQL_TLS_MTLS_ENDPOINT,
  GQL_TLS_CA_CERT,
  GQL_TLS_CLIENT_CERT,
  GQL_TLS_CLIENT_KEY,
  GQL_HEALTH_QUERY,
  resetGqlTlsSessionFlags,
  ensureTlsEndpoint,
  ensureSkipCertEnabled,
  ensureTlsIntrospected,
  ensureTlsAuthConfigured,
  ensureTlsAuthExecuted,
  ensureTlsCaConfigured,
  ensureTlsCaIntrospected,
  ensureMtlsEndpoint,
  ensureMtlsConfigured,
  ensureMtlsIntrospected,
  gqlTlsLessonSetup,
  gqlTlsLessonCleanup,
} from './lesson-https-tls';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';

function stubTlsChainDom(opts: {
  endpoint?: string;
  skipCert?: boolean;
  schemaOk?: boolean;
  tlsPanelOpen?: boolean;
} = {}): void {
  const {
    endpoint = GQL_TLS_HTTPS_ENDPOINT,
    skipCert = true,
    schemaOk = true,
    tlsPanelOpen = false,
  } = opts;
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="${endpoint}" />
    <button data-testid="gql-tls-toggle" aria-pressed="${skipCert ? 'true' : 'false'}"></button>
    <button data-testid="gql-tls-configure"></button>
    ${tlsPanelOpen ? `
      <div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert">
          <input type="checkbox" ${skipCert ? 'checked' : ''} />
        </div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>
    ` : ''}
    <span data-testid="gql-tls-indicator">TLS</span>
    <button data-testid="gql-introspect-btn"></button>
    ${schemaOk ? '<span data-testid="gql-schema-badge-ok"></span>' : ''}
    <button data-testid="gql-auth-badge-btn"></button>
    <div data-testid="gql-auth-popover">
      <select data-testid="gql-auth-type-select">
        <option value="bearer">Bearer</option>
      </select>
      <input data-testid="gql-auth-bearer-input" value="" />
      <button data-testid="gql-auth-popover-close"></button>
    </div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <div data-testid="gql-rv-request-headers">Authorization</div>
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
  `;
  stubMonacoEditor(GQL_HEALTH_QUERY);
}

describe('lesson-https-tls helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlTlsSessionFlags();
  });

  it('ensureTlsEndpoint skips when flag set and endpoint is https', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureSkipCertEnabled skips when flag set and toggle active', async () => {
    stubTlsChainDom({ skipCert: true });
    const ctx = makeCtx();
    await ensureSkipCertEnabled(ctx);
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    const clickSpy = vi.spyOn(toggle, 'click');
    await ensureSkipCertEnabled(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureTlsIntrospected skips when schema badge already present', async () => {
    stubTlsChainDom({ schemaOk: true });
    const ctx = makeCtx();
    await ensureTlsIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsAuthConfigured skips when already configured', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureTlsAuthExecuted skips repeat execution', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsAuthExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsAuthExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureTlsCaConfigured opens TLS panel and pastes CA cert', async () => {
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
    stubTlsChainDom({ tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureTlsCaConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsCaConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('ensureTlsCaConfigured clicks TLS toggle when skip-cert still active', async () => {
    stubTlsChainDom({ skipCert: true, tlsPanelOpen: true });
    const ctx = makeCtx();
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    const clickSpy = vi.spyOn(toggle, 'click');
    await ensureTlsCaConfigured(ctx);
    expect(clickSpy).toHaveBeenCalled();
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

  it('ensureMtlsEndpoint switches to mTLS port 4445', async () => {
    stubTlsChainDom({ tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_MTLS_ENDPOINT);
  });

  it('ensureMtlsEndpoint skips when already on mTLS endpoint', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureMtlsEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureMtlsConfigured fills client cert and key', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
    const ctx = makeCtx();
    await ensureMtlsConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, GQL_TLS_CLIENT_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('ensureMtlsConfigured skips when already configured', async () => {
    stubTlsChainDom({ endpoint: GQL_TLS_MTLS_ENDPOINT, tlsPanelOpen: true });
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
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlTlsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-https-tls', 'HTTPS, TLS & Certificates');
  });

  it('gqlTlsLessonCleanup closes demo tabs', async () => {
    const ctx = makeCtx();
    await gqlTlsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-https-tls');
  });

  it('ensureTlsCaConfigured unchecks skip-cert checkbox in modal when checked', async () => {
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

  it('ensureTlsAuthConfigured closes popover via close button', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    const closeBtn = document.querySelector<HTMLButtonElement>(GQL.AUTH_POPOVER_CLOSE)!;
    const closeSpy = vi.spyOn(closeBtn, 'click');
    await ensureTlsAuthConfigured(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });
});
