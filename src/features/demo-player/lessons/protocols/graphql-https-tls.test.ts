/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

vi.mock('../../../graphql/utils/gqlDemoWorkspace', () => ({
  patchDemoTabConnection: vi.fn(async () => true),
  loadDemoSession: vi.fn(async () => ({
    lessonId: 'gql-https-tls',
    priorActiveTabId: 'user-1',
    demoTabId: 'demo-tab-gql5',
  })),
}));

vi.mock('../../../graphql/utils/tabPersistence', () => ({
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
}));

import { gqlHttpsTlsLesson } from './graphql-https-tls';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  GQL_TLS_HEALTH_PROBE,
  GQL_TLS_DOCKER_HEALTH_PROBES,
  GQL_PLAIN_HTTP,
  GQL_TLS_CA_CERT,
  GQL_TLS_CLIENT_CERT,
  GQL_TLS_CLIENT_KEY,
  GQL_TLS_BEARER_TEMPLATE,
  GQL_HEALTH_QUERY,
  resetGqlTlsSessionFlags,
  ensureTlsEndpoint,
  ensureSkipCertEnabled,
  ensureTlsIntrospected,
  ensureTlsAuthConfigured,
  ensureTlsAuthExecuted,
  GQL_TLS_MTLS_ENDPOINT,
  gqlTlsLessonSetup,
  gqlTlsLessonCleanup,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

function installTlsBridgeMock(): void {
  (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings = (patch: {
    skipTlsVerify?: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  }) => {
    if (patch.skipTlsVerify === false) {
      document.querySelector(GQL.TLS_TOGGLE)?.setAttribute('aria-pressed', 'false');
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

function stubFullTlsLessonDom(endpoint = GQL_TLS_HTTPS_ENDPOINT): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="${endpoint}" />
    <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
    <button data-testid="gql-tls-configure"></button>
    <button data-testid="gql-introspect-btn"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-auth-badge-btn"></button>
    <button data-testid="gql-bottom-tab-variables"></button>
    <button data-testid="gql-bottom-tab-auth"></button>
    <div data-testid="gql-auth-panel">
      <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
      <input data-testid="gql-auth-bearer-input" value="${GQL_TLS_BEARER_TEMPLATE}" />
    </div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <div data-testid="gql-rv-request-headers">Authorization Bearer</div>
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
  `;
  stubMonacoEditor(GQL_HEALTH_QUERY);
}

describe('gql-https-tls lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlTlsSessionFlags();
    installTlsBridgeMock();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ─────────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlHttpsTlsLesson.id).toBe('gql-https-tls');
    expect(gqlHttpsTlsLesson.category).toBe('graphql');
    expect(gqlHttpsTlsLesson.name).toBe('HTTPS, TLS & Certificates');
    expect(gqlHttpsTlsLesson.steps.length).toBe(16);
    expect(gqlHttpsTlsLesson.estimatedMinutes).toBe(9);
    expect(gqlHttpsTlsLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields pointing to TLS health probe', () => {
    expect(gqlHttpsTlsLesson.dockerEndpoint).toBe(GQL_TLS_HEALTH_PROBE);
    expect(gqlHttpsTlsLesson.dockerEndpoints).toEqual([...GQL_TLS_DOCKER_HEALTH_PROBES]);
    expect(gqlHttpsTlsLesson.dockerCommand).toContain('docker/graphql/tls');
    expect(gqlHttpsTlsLesson.dockerCommand).toContain('generate-client-cert.sh');
    expect(gqlHttpsTlsLesson.dockerCommand).toContain('docker-compose.mtls.yml');
    expect(gqlHttpsTlsLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlHttpsTlsLesson.steps.map((s) => s.id)).toEqual([
      'gqlt-intro',
      'gqlt-endpoint',
      'gqlt-tls-panel',
      'gqlt-skip-cert',
      'gqlt-connect-skip',
      'gqlt-observe-skip',
      'gqlt-auth-tls',
      'gqlt-ca-cert',
      'gqlt-connect-ca',
      'gqlt-observe-ca',
      'gqlt-mtls-intro',
      'gqlt-mtls-creds',
      'gqlt-mtls-connect',
      'gqlt-observe-mtls',
      'gqlt-restore',
      'gqlt-observe-restore',
    ]);
  });

  it('stateful steps 3–16 have preAction guards', () => {
    gqlHttpsTlsLesson.steps.slice(2).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('intro and endpoint steps reset to plain HTTP before display', () => {
    expect(gqlHttpsTlsLesson.steps[0].preAction).toBeDefined();
    expect(gqlHttpsTlsLesson.steps[1].preAction).toBeDefined();
  });

  // ── Concept quality ──────────────────────────────────────────────────────────

  it('concept body explains WHY HTTPS is needed', () => {
    expect(gqlHttpsTlsLesson.concept.body).toContain('plain text');
    expect(gqlHttpsTlsLesson.concept.body).toContain('encrypted');
    expect(gqlHttpsTlsLesson.concept.body).toContain('Skip Certificate Validation');
  });

  it('concept has 6 key terms including self-signed certificate and TLS proxy', () => {
    expect(gqlHttpsTlsLesson.concept.keyTerms.length).toBe(6);
    const terms = gqlHttpsTlsLesson.concept.keyTerms.map((t) => t.term);
    expect(terms).toContain('TLS (Transport Layer Security)');
    expect(terms).toContain('Self-signed certificate');
    expect(terms).toContain('Skip certificate validation');
    expect(terms).toContain('Custom CA certificate');
    expect(terms).toContain('TLS proxy');
  });

  it('concept diagram is a 700x430 studio chrome SVG', () => {
    expect(gqlHttpsTlsLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlHttpsTlsLesson.concept.diagram).toContain('TLS Encrypted');
    expect(gqlHttpsTlsLesson.concept.diagram).toContain('https://localhost:4443/graphql');
  });

  it('concept body contains the port comparison table', () => {
    expect(gqlHttpsTlsLesson.concept.body).toContain('4010');
    expect(gqlHttpsTlsLesson.concept.body).toContain('4443');
    expect(gqlHttpsTlsLesson.concept.body).toContain('AES-256');
  });

  // ── Step descriptions use WHY framing ────────────────────────────────────────

  it('gqlt-intro explains WHY plain text credentials are dangerous', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-intro')!;
    expect(step.description).toContain('plain text');
    expect(step.description).toContain('encrypted');
    expect(step.description).toContain('next step switches');
  });

  it('gqlt-skip-cert explains what skip-cert disables', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    expect(step.description).toContain('hostname check');
    expect(step.description).toContain('chain-of-trust');
    expect(step.description).toContain('loopback');
  });

  it('gqlt-connect-skip describes introspect action beat', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    expect(step.description).toContain('Introspect');
    expect(step.description).toContain('skip-cert');
  });

  it('gqlt-observe-skip explains the security trade-off', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-observe-skip')!;
    expect(step.description).toContain('encrypted');
    expect(step.description).toContain('man-in-the-middle');
  });

  it('gqlt-auth-tls explains credentials are protected in transit', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls')!;
    expect(step.description).toContain('in transit');
    expect(step.description).toContain('TLS tunnel');
    expect(step.description).toContain(GQL_TLS_BEARER_TEMPLATE);
    expect(step.description).toContain('authToken');
    expect(step.description).toContain('lesson6-demo-jwt');
  });

  it('gqlt-ca-cert explains CA certificate chain of trust', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    expect(step.description).toContain('Custom CA');
    expect(step.description).toContain('Introspect');
    expect(step.description).toContain('docker/graphql/tls');
  });

  it('gqlt-restore describes endpoint restore action', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    expect(step.description).toContain(GQL_PLAIN_HTTP);
    expect(step.description).toContain('Introspect');
  });

  it('gqlt-observe-restore explains when plain HTTP is acceptable', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-observe-restore')!;
    expect(step.description).toContain('loopback');
    expect(step.description).toContain('plain HTTP');
  });

  // ── Spotlight ↔ description alignment ────────────────────────────────────────

  it('gqlt-intro highlights the connection bar (credentials-in-transit context)', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-intro')!;
    expect(step.highlight).toBe(GQL.CONNECTION_BAR);
    expect(step.preAction).toBeDefined();
  });

  it('gqlt-endpoint highlights endpoint input and verifies TLS_TOGGLE appears', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
    expect(step.verify).toBe(GQL.TLS_TOGGLE);
  });

  it('gqlt-tls-panel highlights the TLS toggle', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-tls-panel')!;
    expect(step.highlight).toBe(GQL.TLS_TOGGLE);
  });

  it('gqlt-skip-cert highlights and verifies TLS toggle', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    expect(step.highlight).toBe(GQL.TLS_TOGGLE);
    expect(step.verify).toBe(GQL.TLS_TOGGLE);
  });

  it('gqlt-connect-skip highlights Introspect (action only)', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
    expect(step.verify).toBe(GQL.INTROSPECT_BTN);
  });

  it('gqlt-observe-skip highlights schema badge OK', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-observe-skip')!;
    expect(step.highlight).toBe(GQL.SCHEMA_BADGE_OK);
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gqlt-auth-tls highlights and verifies request headers in Metadata', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls')!;
    expect(step.highlight).toBe(GQL.RV_REQUEST_HEADERS);
    expect(step.verify).toBe(GQL.RV_REQUEST_HEADERS);
  });

  it('gqlt-ca-cert highlights TLS configure and verifies Custom CA badge', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    expect(step.highlight).toBe(GQL.TLS_CONFIGURE);
    expect(step.verify).toBe(GQL.TLS_INDICATOR_CA);
    expect(step.action).toBeTypeOf('function');
  });

  it('gqlt-connect-ca highlights Introspect for Phase 2 schema reload', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-ca')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
    expect(step.verify).toBe(GQL.INTROSPECT_BTN);
  });

  it('gqlt-observe-ca verifies schema badge after CA introspect', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-observe-ca')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gqlt-mtls-creds verifies mTLS badge after client cert paste', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-creds')!;
    expect(step.highlight).toBe(GQL.TLS_CLIENT_CERT);
    expect(step.verify).toBe(GQL.TLS_INDICATOR_MTLS);
  });

  it('gqlt-restore highlights endpoint input (restore + introspect click)', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
    expect(step.verify).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gqlt-observe-restore verifies schema badge on plain HTTP', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-observe-restore')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  // ── Certificate constants ────────────────────────────────────────────────────

  it('GQL_TLS_CA_CERT contains a valid PEM certificate', () => {
    expect(GQL_TLS_CA_CERT).toContain('-----BEGIN CERTIFICATE-----');
    expect(GQL_TLS_CA_CERT).toContain('-----END CERTIFICATE-----');
    // Certificate is a non-trivial base64-encoded DER block
    expect(GQL_TLS_CA_CERT.length).toBeGreaterThan(500);
  });

  it('GQL_TLS_CLIENT_CERT contains a valid client PEM certificate', () => {
    expect(GQL_TLS_CLIENT_CERT).toContain('-----BEGIN CERTIFICATE-----');
    expect(GQL_TLS_CLIENT_CERT).toContain('-----END CERTIFICATE-----');
    expect(GQL_TLS_CLIENT_CERT.length).toBeGreaterThan(500);
  });

  it('GQL_TLS_CLIENT_KEY contains a valid private key', () => {
    expect(GQL_TLS_CLIENT_KEY).toContain('-----BEGIN PRIVATE KEY-----');
    expect(GQL_TLS_CLIENT_KEY).toContain('-----END PRIVATE KEY-----');
  });

  it('GQL_TLS_HTTPS_ENDPOINT points to port 4443', () => {
    expect(GQL_TLS_HTTPS_ENDPOINT).toBe('https://localhost:4443/graphql');
  });

  it('GQL_TLS_HEALTH_PROBE points to port 4444 on loopback', () => {
    expect(GQL_TLS_HEALTH_PROBE).toBe('http://127.0.0.1:4444/health');
  });

  it('GQL_PLAIN_HTTP points to plain port 4010', () => {
    expect(GQL_PLAIN_HTTP).toBe('http://localhost:4010/graphql');
  });

  // ── Step action tests ────────────────────────────────────────────────────────

  it('gqlt-endpoint action fills HTTPS endpoint and waits for TLS toggle', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-endpoint')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TLS_TOGGLE, 3000);
  });

  it('gqlt-skip-cert action clicks TLS toggle to enable skip-cert', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    await step.action!(ctx);
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    expect(toggle).toBeTruthy();
  });

  it('gqlt-connect-skip action clicks Introspect only', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlt-restore action fills plain HTTP endpoint and clicks introspect', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  // ── Guard helper tests ────────────────────────────────────────────────────────

  it('ensureTlsEndpoint fills https endpoint when not set', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
    `;
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('ensureTlsEndpoint skips fill when already on https endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
    `;
    await ensureTlsEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureSkipCertEnabled clicks toggle when aria-pressed is false', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
    `;
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    const clickSpy = vi.spyOn(toggle, 'click');
    await ensureSkipCertEnabled(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureSkipCertEnabled skips click when toggle already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
    `;
    await ensureSkipCertEnabled(ctx);
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    const clickSpy = vi.spyOn(toggle, 'click');
    await ensureSkipCertEnabled(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureTlsIntrospected clicks introspect and waits for schema badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.SCHEMA_BADGE_OK) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-schema-badge-ok"></span>');
      }
    });
    await ensureTlsIntrospected(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('ensureTlsIntrospected skips introspect when schema badge already present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    await ensureTlsIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsAuthConfigured opens Auth panel and configures bearer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
    `;
    await ensureTlsAuthConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, GQL_TLS_BEARER_TEMPLATE);
  });

  it('ensureTlsAuthExecuted runs health query and opens metadata tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-right-tab-schema"></button>
      <div data-testid="gql-se-type-Query"></div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
    `;
    stubMonacoEditor(GQL_HEALTH_QUERY);
    await ensureTlsAuthExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('ensureTlsAuthExecuted skips repeat run when already executed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="{{authToken}}" />
      </div>
    `;
    stubMonacoEditor(GQL_HEALTH_QUERY);
    await ensureTlsAuthExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsAuthExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureTlsAuthConfigured skips auth badge click when Auth panel already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
    `;
    const authBtn = document.querySelector<HTMLElement>(GQL.AUTH_BADGE_BTN)!;
    const authSpy = vi.spyOn(authBtn, 'click');
    await ensureTlsAuthConfigured(ctx);
    expect(authSpy).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, GQL_TLS_BEARER_TEMPLATE);
  });

  // ── Setup / cleanup ──────────────────────────────────────────────────────────

  it('gqlTlsLessonSetup creates demo tab and loads health query', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    await gqlTlsLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-https-tls', 'HTTPS, TLS & Certificates');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlTlsLessonCleanup closes demo tab without rewriting user endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
    `;
    await gqlTlsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-https-tls');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
  });

  it('gqlTlsLessonCleanup does not touch plain http endpoint on demo tab close', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    `;
    await gqlTlsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-https-tls');
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('gqlTlsLessonSetup activates inactive editor mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const clickSpy = vi.spyOn(editorBtn, 'click');
    await gqlTlsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlTlsLessonSetup closes auth panel when auth tab is active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    stubMonacoEditor('');
    await gqlTlsLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('gqlTlsLessonSetup leaves auth panel open when auth tab is inactive', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-auth-panel"></div>
      <button data-testid="gql-auth-badge-btn"></button>
    `;
    stubMonacoEditor('');
    await gqlTlsLessonSetup(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('gqlt-endpoint step action fills HTTPS endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="" /><button data-testid="gql-tls-toggle"></button>`;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-endpoint')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('gqlt-tls-panel preAction ensures TLS endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="" /><button data-testid="gql-tls-toggle"></button>`;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-tls-panel')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('gqlt-auth-tls step action delegates to ensureTlsAuthExecuted', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Bearer</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gqlt-ca-cert action delegates to ensureTlsCaConfigured', async () => {
    const ctx = makeCtx();
    stubFullTlsLessonDom();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TLS_CONFIGURE && !document.querySelector(GQL.TLS_BODY)) {
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
      if (sel === GQL.TLS_TOGGLE) {
        document.querySelector(GQL.TLS_TOGGLE)?.setAttribute('aria-pressed', 'false');
      }
      if (sel === GQL.TLS_CLOSE) {
        document.querySelector(GQL.TLS_BODY)?.remove();
      }
    });
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    await step.action!(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
    expect(ctx.click).toHaveBeenCalledWith(GQL.TLS_CONFIGURE);
  });

  it('gqlt-connect-ca action clicks Introspect only', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <span data-testid="gql-tls-indicator" class="gql-tls-mode-badge--ca"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-ca')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlt-connect-ca preAction ensures CA configured', async () => {
    const ctx = makeCtx();
    stubFullTlsLessonDom();
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-ca')!;
    await step.preAction!(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_CA)).toBeTruthy();
  });

  it('gqlt-mtls-intro action switches to mTLS endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <button data-testid="gql-tls-configure"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-intro')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_MTLS_ENDPOINT);
  });

  it('gqlt-mtls-creds action configures client cert and key', async () => {
    const ctx = makeCtx();
    stubFullTlsLessonDom(GQL_TLS_MTLS_ENDPOINT);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert">${GQL_TLS_CA_CERT}</textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>`,
    );
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-creds')!;
    vi.mocked(ctx.fill).mockImplementation(async (sel, val) => {
      if (sel === GQL.TLS_CLIENT_KEY && val === GQL_TLS_CLIENT_KEY) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<span data-testid="gql-tls-indicator" class="gql-tls-mode-badge gql-tls-mode-badge--mtls">mTLS</span>',
        );
      }
    });
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, '');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, GQL_TLS_CLIENT_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, '');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
    expect(document.querySelector(GQL.TLS_INDICATOR_MTLS)).toBeTruthy();
  });

  it('gqlt-mtls-connect action clicks Introspect only', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_MTLS_ENDPOINT}" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-connect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlt-mtls-connect preAction ensures mTLS configured', async () => {
    const ctx = makeCtx();
    stubFullTlsLessonDom(GQL_TLS_MTLS_ENDPOINT);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>`,
    );
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-creds')!;
    await step.action!(ctx);
    const connectStep = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-connect')!;
    await connectStep.preAction!(ctx);
    expect(document.querySelector(GQL.TLS_INDICATOR_MTLS)).toBeTruthy();
  });

  it('gqlt-restore preAction prepares mTLS-complete state', async () => {
    const ctx = makeCtx();
    stubFullTlsLessonDom(GQL_TLS_MTLS_ENDPOINT);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>`,
    );
    const credsStep = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-creds')!;
    await credsStep.action!(ctx);
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });

  it('gqlt-skip-cert preAction ensures TLS endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="" /><button data-testid="gql-tls-toggle"></button>`;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('gqlt-connect-skip preAction delegates to prepareGqltSkipIntrospectReading', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
    `;
    const toggle = document.querySelector<HTMLButtonElement>(GQL.TLS_TOGGLE)!;
    const clickSpy = vi.spyOn(toggle, 'click');
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlt-ca-cert preAction runs auth executed chain', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="${GQL_TLS_BEARER_TEMPLATE}" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Bearer</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('observe steps run reading delay actions', async () => {
    const ctx = makeCtx();
    for (const id of ['gqlt-observe-skip', 'gqlt-observe-ca', 'gqlt-observe-mtls', 'gqlt-observe-restore']) {
      const step = gqlHttpsTlsLesson.steps.find((s) => s.id === id)!;
      await expect(step.action!(ctx)).resolves.toBeUndefined();
    }
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gqlt-intro preAction resets endpoint to plain HTTP', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-intro')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
  });
});
