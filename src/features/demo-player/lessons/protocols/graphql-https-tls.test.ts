/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
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

describe('gql-https-tls lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlTlsSessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ─────────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlHttpsTlsLesson.id).toBe('gql-https-tls');
    expect(gqlHttpsTlsLesson.category).toBe('graphql');
    expect(gqlHttpsTlsLesson.name).toBe('HTTPS, TLS & Certificates');
    expect(gqlHttpsTlsLesson.steps.length).toBe(12);
    expect(gqlHttpsTlsLesson.estimatedMinutes).toBe(8);
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
      'gqlt-auth-tls',
      'gqlt-ca-cert',
      'gqlt-connect-ca',
      'gqlt-mtls-intro',
      'gqlt-mtls-creds',
      'gqlt-mtls-connect',
      'gqlt-restore',
    ]);
  });

  it('stateful steps 3–12 have preAction guards', () => {
    gqlHttpsTlsLesson.steps.slice(2).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('first two steps have no preAction (entry steps)', () => {
    expect(gqlHttpsTlsLesson.steps[0].preAction).toBeUndefined();
    // gqlt-endpoint has no preAction (studio must be clean)
    expect(gqlHttpsTlsLesson.steps[1].preAction).toBeUndefined();
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
    expect(step.description).toContain('real local TLS server');
  });

  it('gqlt-skip-cert explains what skip-cert disables', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    expect(step.description).toContain('hostname check');
    expect(step.description).toContain('chain-of-trust');
    expect(step.description).toContain('loopback');
  });

  it('gqlt-connect-skip explains the security trade-off', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    expect(step.description).toContain('encrypted');
    expect(step.description).toContain('man-in-the-middle');
  });

  it('gqlt-auth-tls explains credentials are protected in transit', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls')!;
    expect(step.description).toContain('in transit');
    expect(step.description).toContain('TLS tunnel');
    expect(step.description).toContain(GQL_TLS_BEARER_TEMPLATE);
  });

  it('gqlt-ca-cert explains CA certificate chain of trust', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    expect(step.description).toContain('certificate chain');
    expect(step.description).toContain('docker/graphql/tls');
  });

  it('gqlt-restore explains when plain HTTP is acceptable', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    expect(step.description).toContain('loopback');
    expect(step.description).toContain('packet capture');
    expect(step.description).toContain(GQL_PLAIN_HTTP);
  });

  // ── Spotlight ↔ description alignment ────────────────────────────────────────

  it('gqlt-intro highlights the endpoint input', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-intro')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
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

  it('gqlt-connect-skip highlights and verifies schema badge OK', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-skip')!;
    expect(step.highlight).toBe(GQL.SCHEMA_BADGE_OK);
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gqlt-auth-tls highlights and verifies request headers in Metadata', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls')!;
    expect(step.highlight).toBe(GQL.RV_REQUEST_HEADERS);
    expect(step.verify).toBe(GQL.RV_REQUEST_HEADERS);
  });

  it('gqlt-ca-cert highlights TLS configure and has action', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    expect(step.highlight).toBe(GQL.TLS_CONFIGURE);
    expect(step.action).toBeTypeOf('function');
  });

  it('gqlt-restore highlights and verifies schema badge OK', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    expect(step.highlight).toBe(GQL.SCHEMA_BADGE_OK);
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

  it('gqlt-connect-skip action clicks Introspect and waits for schema badge', async () => {
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
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('gqlt-restore action fills plain HTTP endpoint and introspects', async () => {
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
      <span data-testid="gql-schema-badge-ok"></span>
    `;
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

  it('ensureTlsAuthConfigured opens auth popover and configures bearer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
        <button data-testid="gql-auth-popover-close"></button>
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
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
        <button data-testid="gql-auth-popover-close"></button>
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
      <div data-testid="gql-auth-popover">
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

  it('ensureTlsAuthConfigured skips auth badge click when popover already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
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

  it('gqlTlsLessonSetup closes auth popover via close button when present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-auth-popover">
        <button data-testid="gql-auth-popover-close"></button>
      </div>
    `;
    stubMonacoEditor('');
    const closeBtn = document.querySelector<HTMLElement>(GQL.AUTH_POPOVER_CLOSE)!;
    const closeSpy = vi.spyOn(closeBtn, 'click');
    await gqlTlsLessonSetup(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('gqlTlsLessonSetup toggles auth badge when popover open without close button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-auth-popover"></div>
      <button data-testid="gql-auth-badge-btn"></button>
    `;
    stubMonacoEditor('');
    const authBtn = document.querySelector<HTMLElement>(GQL.AUTH_BADGE_BTN)!;
    const authSpy = vi.spyOn(authBtn, 'click');
    await gqlTlsLessonSetup(ctx);
    expect(authSpy).toHaveBeenCalled();
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
      <div data-testid="gql-auth-popover">
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
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <button data-testid="gql-tls-toggle" aria-pressed="true"></button>
      <button data-testid="gql-tls-configure"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="${GQL_TLS_BEARER_TEMPLATE}" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Bearer</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <span data-testid="gql-tls-indicator">TLS</span>
    `;
    stubMonacoEditor('query { health }');
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
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-ca-cert')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
  });

  it('gqlt-connect-ca action clicks Introspect and waits for schema badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-ca')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('gqlt-connect-ca preAction ensures CA configured', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_HTTPS_ENDPOINT}" />
      <button data-testid="gql-tls-toggle" aria-pressed="false"></button>
      <button data-testid="gql-tls-configure"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="${GQL_TLS_BEARER_TEMPLATE}" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
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
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-connect-ca')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CA_CERT, GQL_TLS_CA_CERT);
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
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_MTLS_ENDPOINT}" />
      <button data-testid="gql-tls-configure"></button>
      <div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>
      <span data-testid="gql-tls-indicator">mTLS</span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-creds')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_CERT, GQL_TLS_CLIENT_CERT);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('gqlt-mtls-connect action introspects over mTLS', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_MTLS_ENDPOINT}" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-connect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('gqlt-mtls-connect preAction ensures mTLS configured', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_MTLS_ENDPOINT}" />
      <button data-testid="gql-tls-configure"></button>
      <div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-mtls-connect')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.TLS_CLIENT_KEY, GQL_TLS_CLIENT_KEY);
  });

  it('gqlt-restore preAction ensures mTLS introspected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_TLS_MTLS_ENDPOINT}" />
      <button data-testid="gql-tls-configure"></button>
      <div data-testid="gql-tls-body">
        <div data-testid="gql-tls-skip-cert"><input type="checkbox" /></div>
        <textarea data-testid="gql-tls-ca-cert"></textarea>
        <textarea data-testid="gql-tls-client-cert"></textarea>
        <textarea data-testid="gql-tls-client-key"></textarea>
        <button data-testid="gql-tls-close"></button>
      </div>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-restore')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlt-skip-cert preAction ensures TLS endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="" /><button data-testid="gql-tls-toggle"></button>`;
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('gqlt-connect-skip preAction delegates to ensureSkipCertEnabled', async () => {
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
      <div data-testid="gql-auth-popover">
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
});
