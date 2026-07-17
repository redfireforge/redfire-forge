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
} from './lesson-https-tls.testHelpers';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_TLS_HTTPS_ENDPOINT,
  GQL_PLAIN_HTTP,
  ensureTlsEndpoint,
  ensurePlainHttpEndpoint,
  ensureSkipCertEnabled,
  ensureTlsIntrospected,
  ensureTlsEnvReady,
  ensureTlsAuthConfigured,
  ensureTlsAuthExecuted,
  ensureTlsPhase2Ready,
  prepareGqltSkipIntrospectReading,
  prepareGqltAuthExecReading,
  prepareGqltAuthConfigReading,
  prepareGqltAuthObserveReading,
} from './lesson-https-tls';
import {activateGqlDemoTabQuiet } from './gql-demo-tab';
import { patchDemoTabConnection, loadTabs } from '../../../adapters';

describe('lesson-https-tls helpers — endpoint', () => {
  beforeEach(() => {
    setupLessonHttpsTlsBeforeEach();
  });
  afterEach(async () => {
    await teardownLessonHttpsTlsAfterEach();
  });

afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
  });

  it('ensureTlsEndpoint skips when flag set and endpoint is https', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureTlsEndpoint re-applies when session flag set but endpoint reverted to http', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsEndpoint(ctx);
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = 'http://localhost:4010/graphql';
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('ensureTlsEndpoint recovers from stale mTLS port 4445', async () => {
    stubTlsChainDom({ endpoint: 'https://127.0.0.1:4445/graphql' });
    const ctx = makeCtx();
    await ensureTlsEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_TLS_HTTPS_ENDPOINT);
  });

  it('ensurePlainHttpEndpoint resets stale HTTPS/mTLS endpoint to plain HTTP', async () => {
    stubTlsChainDom({ endpoint: 'https://127.0.0.1:4445/graphql' });
    const ctx = makeCtx();
    await ensurePlainHttpEndpoint(ctx);
    expect(patchDemoTabConnection).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: GQL_PLAIN_HTTP }),
    );
    expect(activateGqlDemoTabQuiet).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_PLAIN_HTTP);
  });

  it('ensurePlainHttpEndpoint skips when storage and DOM already plain HTTP', async () => {
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
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_PLAIN_HTTP}" />
    `;
    const ctx = makeCtx();
    await ensurePlainHttpEndpoint(ctx);
    expect(patchDemoTabConnection).not.toHaveBeenCalled();
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
    expect(patchDemoTabConnection).toHaveBeenCalledWith({ skipTlsVerify: true });
  });

  it('prepareGqltSkipIntrospectReading re-introspects when schema error badge is stale', async () => {
    stubTlsChainDom({ skipCert: true, schemaOk: false });
    document.body.insertAdjacentHTML(
      'beforeend',
      '<span data-testid="gql-schema-badge-error">Schema error</span>',
    );
    const ctx = makeCtx();
    await prepareGqltSkipIntrospectReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('ensureTlsIntrospected skips when schema badge already present', async () => {
    stubTlsChainDom({ schemaOk: true });
    const ctx = makeCtx();
    await ensureTlsIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureTlsEnvReady upserts authToken via demo bridge', async () => {
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = upsert;
    const ctx = makeCtx();
    await ensureTlsEnvReady(ctx);
    expect(upsert).toHaveBeenCalledWith('Demo', [{ key: 'authToken', value: 'lesson6-demo-jwt', masked: true }]);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsEnvReady(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
  });

  it('ensureTlsAuthConfigured skips when already configured', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureTlsAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('prepareGqltAuthExecReading does not navigate to Environment Manager', async () => {
    stubTlsChainDom();
    document.body.innerHTML += `
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    const ctx = makeCtx();
    await prepareGqltAuthExecReading(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('prepareGqltAuthConfigReading does not navigate to Environment Manager', async () => {
    stubTlsChainDom({ schemaOk: true });
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
    const ctx = makeCtx();
    await prepareGqltAuthConfigReading(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('prepareGqltAuthObserveReading does not navigate to Environment Manager', async () => {
    stubTlsChainDom({ schemaOk: true });
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
    const ctx = makeCtx();
    await prepareGqltAuthObserveReading(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('ensureTlsPhase2Ready does not navigate to Environment Manager', async () => {
    stubTlsChainDom({ schemaOk: true });
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
    const ctx = makeCtx();
    await ensureTlsPhase2Ready(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('ensureTlsAuthExecuted skips repeat execution', async () => {
    stubTlsChainDom();
    const ctx = makeCtx();
    await ensureTlsAuthExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTlsAuthExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });
});
