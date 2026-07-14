/**
 * Shared setup for split lesson-https-tls test files.
 */
import { vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import { GQL_HEALTH_QUERY } from './core';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  resetGqlTlsSessionFlags,
} from './lesson-https-tls';

export function stubTlsChainDom(opts: {
  endpoint?: string;
  skipCert?: boolean;
  schemaOk?: boolean;
  tlsPanelOpen?: boolean;
  tlsBadge?: 'ca' | 'mtls' | 'skip' | 'none';
} = {}): void {
  const {
    endpoint = GQL_TLS_HTTPS_ENDPOINT,
    skipCert = true,
    schemaOk = true,
    tlsPanelOpen = false,
    tlsBadge = 'none',
  } = opts;
  const badgeHtml = tlsBadge === 'ca'
    ? '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--ca">Custom CA</span>'
    : tlsBadge === 'mtls'
      ? '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>'
      : tlsBadge === 'skip'
        ? '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--skip">Skip Verify</span>'
        : '<span data-testid="gql-tls-indicator">TLS</span>';
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
    ${badgeHtml}
    <button data-testid="gql-introspect-btn"></button>
    ${schemaOk ? '<span data-testid="gql-schema-badge-ok"></span>' : ''}
    <button data-testid="gql-auth-badge-btn"></button>
    <button data-testid="gql-bottom-tab-variables"></button>
    <button data-testid="gql-bottom-tab-auth"></button>
    <div data-testid="gql-auth-panel">
      <select data-testid="gql-auth-type-select">
        <option value="bearer">Bearer</option>
      </select>
      <input data-testid="gql-auth-bearer-input" value="" />
    </div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer">
      <span data-testid="gql-rv-request-header-val-Authorization"></span>
    </div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
    <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
  `;
  stubMonacoEditor(GQL_HEALTH_QUERY);
}

export function installTlsBridgeMock(): void {
  (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
  (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings = (patch: {
    skipTlsVerify?: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  }) => {
    if (patch.skipTlsVerify === false) {
      document.querySelector(GQL.TLS_TOGGLE)?.setAttribute('aria-pressed', 'false');
      const skipInput = document.querySelector<HTMLInputElement>(`${GQL.TLS_SKIP_CERT} input[type="checkbox"]`);
      if (skipInput) skipInput.checked = false;
    }
    document.querySelector(GQL.TLS_INDICATOR)?.remove();
    if (patch.clientCert && patch.clientKey) {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>',
      );
    } else if (patch.caCert) {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--ca">Custom CA</span>',
      );
    }
  };
}

export function clearTlsBridge(): void {
  delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
  delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
}

export const TLS_PANEL_HTML = `
  <div data-testid="gql-tls-body">
    <div data-testid="gql-tls-skip-cert"><input type="checkbox" checked /></div>
    <textarea data-testid="gql-tls-ca-cert"></textarea>
    <textarea data-testid="gql-tls-client-cert"></textarea>
    <textarea data-testid="gql-tls-client-key"></textarea>
    <button data-testid="gql-tls-close"></button>
  </div>`;

/** Simulates TLS modal open/close and SSL toggle for human-paced demo action tests. */
export function mockTlsPanelDemoClicks(ctx: ReturnType<typeof makeCtx>, skipCert = true): void {
  vi.mocked(ctx.click).mockImplementation(async (sel) => {
    if (sel === GQL.TLS_CONFIGURE && !document.querySelector(GQL.TLS_BODY)) {
      const html = skipCert
        ? TLS_PANEL_HTML
        : TLS_PANEL_HTML.replace('checked', '');
      document.body.insertAdjacentHTML('beforeend', html);
    }
    if (sel === GQL.TLS_TOGGLE) {
      document.querySelector(GQL.TLS_TOGGLE)?.setAttribute('aria-pressed', 'false');
    }
    if (sel === GQL.TLS_CLOSE) {
      document.querySelector(GQL.TLS_BODY)?.remove();
    }
  });
}

export function setupLessonHttpsTlsBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlTlsSessionFlags();
  installTlsBridgeMock();
  vi.clearAllMocks();
}

export async function teardownLessonHttpsTlsAfterEach(): Promise<void> {
  delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
  delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
}
