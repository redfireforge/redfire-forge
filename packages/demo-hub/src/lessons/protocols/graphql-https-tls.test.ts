/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

vi.mock('@graphql/utils/gqlDemoWorkspace', () => ({
  patchDemoTabConnection: vi.fn(async () => true),
  loadDemoSession: vi.fn(async () => ({
    lessonId: 'gql-https-tls',
    priorActiveTabId: 'user-1',
    demoTabId: 'demo-tab-gql5',
  })),
}));

vi.mock('@graphql/utils/tabPersistence', () => ({
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
import { closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  GQL_TLS_HEALTH_PROBE,
  GQL_TLS_DOCKER_HEALTH_PROBES,
  GQL_PLAIN_HTTP,
  GQL_TLS_CA_CERT,
  GQL_TLS_CLIENT_CERT,
  GQL_TLS_CLIENT_KEY,
  GQL_TLS_BEARER_TEMPLATE,
  resetGqlTlsSessionFlags,
  gqlTlsLessonCleanup,
} from './graphql-lesson-helpers';
import { LESSON6_RV_METADATA_AUTHORIZATION_VAL } from './graphql-lesson-helpers/lesson6-auth-headers';

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
    expect(gqlHttpsTlsLesson.steps.length).toBe(18);
    expect(gqlHttpsTlsLesson.estimatedMinutes).toBe(10);
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
      'gqlt-auth-tls-config',
      'gqlt-auth-tls-exec',
      'gqlt-auth-tls-observe',
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

  it('stateful steps 3–18 have preAction guards', () => {
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

  it('gqlt-auth-tls-observe explains credentials are protected in transit', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls-observe')!;
    expect(step.description).toContain('in transit');
    expect(step.description).toContain('TLS tunnel');
    expect(step.description).toContain('lesson6-demo-jwt');
  });

  it('gqlt-auth-tls-config explains Demo env and bearer template', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls-config')!;
    expect(step.description).toContain(GQL_TLS_BEARER_TEMPLATE);
    expect(step.description).toContain('authToken');
    expect(step.highlight).toBe(GQL.AUTH_BEARER_INPUT);
  });

  it('gqlt-auth-tls-exec highlights Execute and verifies response viewer', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls-exec')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.verify).toBe(GQL.RESPONSE_VIEWER);
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

  it('gqlt-skip-cert highlights and verifies TLS Skip Verify badge', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-skip-cert')!;
    expect(step.highlight).toBe(GQL.TLS_INDICATOR_SKIP);
    expect(step.verify).toBe(GQL.TLS_INDICATOR_SKIP);
    expect(step.highlight).not.toBe(GQL.TLS_TOGGLE);
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

  it('gqlt-auth-tls-observe highlights Authorization bearer value in Metadata', () => {
    const step = gqlHttpsTlsLesson.steps.find((s) => s.id === 'gqlt-auth-tls-observe')!;
    expect(step.highlight).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
    expect(step.verify).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
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

  // ── Setup / cleanup (wrapper wiring — helpers covered in lesson-https-tls.test.ts) ──

  it('gqlTlsLessonCleanup resets stale HTTPS endpoint before closing demo tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://localhost:4443/graphql" />
      <button data-testid="gql-tls-toggle"></button>
    `;
    await gqlTlsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-https-tls');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
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
