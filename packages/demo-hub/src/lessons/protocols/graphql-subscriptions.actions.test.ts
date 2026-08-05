/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql7'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

import {
  setupGraphqlSubscriptionsBeforeEach,
  teardownGraphqlSubscriptionsAfterEach,
} from './graphql-subscriptions.testHelpers';
import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {GQL_ORDER_STATUS_SUBSCRIPTION,
  resetGqlLesson5SessionFlags,
  storeCreatedOrderIdFromResponse,
  prepareGql5SubscriptionAuthReading,
  ensureSubscriptionAuthConfigured,
  markSubscriptionAuthDone,
  resetGqlLesson6SessionFlags,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor, stubSubscriptionShell } from './__test-utils__/graphql-test-fixtures';

describe('gql-subscriptions lesson — actions', () => {
  beforeEach(() => {
    setupGraphqlSubscriptionsBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlSubscriptionsAfterEach();
  });

// ─── New step actions ────────────────────────────────────────────────────

  it('gql5-connection-bar preAction waits for Subscribe after subscription is written', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-subscribe-btn"></button>
    `);
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-bar' } } }),
    }));
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN, 8000);
  });

  it('gql5-transport-select action calls ensureWsTransport', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.TRANSPORT_SELECT, 'graphql-transport-ws');
  });

  it('gql5-transport-select preAction uses ensureSubscriptionQueryWritten', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-ts' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('subscription { orderStatus }');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    const ctx = makeCtx();
    // preAction is ensureSubscriptionQueryWritten — resolves without error
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });

  it('gql5-subscription-auth description mentions connectionParams handshake', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscription-auth')!;
    expect(step.description).toContain('connectionParams');
    expect(step.description).toContain('connection_init');
    expect(step.description).toContain('Auth preview');
    expect(step.description).not.toContain('Environment Manager');
  });

  it('gql5-subscription-auth action configures bearer auth preview', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-bottom-tab-auth" aria-selected="true"></div>
      <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
      <input data-testid="gql-auth-bearer-input" />
      <div data-testid="gql-auth-preview">Authorization: Bearer lesson6-demo-jwt</div>
    `);
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-auth' } } }),
    }));
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscription-auth')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, 'lesson6-demo-jwt');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
  });

  it('gql5-subscription-auth preAction opens Auth without Env modal / Bearer fill', async () => {
    resetGqlLesson6SessionFlags();
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-env-badge"></button>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-bottom-tab-auth" aria-selected="true"></div>
      <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
      <input data-testid="gql-auth-bearer-input" />
      <div data-testid="gql-auth-preview">Authorization: Bearer lesson6-demo-jwt</div>
    `);
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-pre' } } }),
    }));
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = vi.fn();
    const ctx = makeCtx();
    await prepareGql5SubscriptionAuthReading(ctx);
    expect((window as unknown as Record<string, unknown>).__demoUpsertGqlEnv).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, expect.anything());
  });

  it('ensureSubscriptionAuthConfigured guard skips when auth already done', async () => {
    markSubscriptionAuthDone();
    const ctx = makeCtx();
    await ensureSubscriptionAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('gql5-endpoint preAction ensures demo endpoint is ready', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('gql5-endpoint skips introspect when badge already present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql5-create-order loads createOrder mutation and vars', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery, setVars } = stubMonacoEditor('query { }');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-create-order')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalled();
    expect(setVars).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql5-exec-create-order executes createOrder', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('mutation CreateOrder { createOrder { id } }');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-exec-create-order')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql5-write-sub skips vars when order id missing', async () => {
    stubSubscriptionShell();
    stubMonacoEditor('subscription { }');
    resetGqlLesson5SessionFlags();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Transport select is handled in the separate gql5-transport-select step
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('gql5-write-sub fills vars when order id present', async () => {
    stubSubscriptionShell();
    const { setVars } = stubMonacoEditor('subscription { }');
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      '{"data":{"createOrder":{"id":"ord-77"}}}';
    storeCreatedOrderIdFromResponse();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(setVars).toHaveBeenCalledWith(JSON.stringify({ orderId: 'ord-77' }, null, 2));
  });

  it('gql5-watch-log waits for message list', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-watch-log')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SUBSCRIPTION_MSG_LIST, 5000);
  });

  it('gql5-pause uses pause/resume buttons when present', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUME_BTN);
  });

  it('gql5-pause highlights stream control buttons', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    expect(step.highlight).toBe(GQL.SUBSCRIPTION_STREAM_CONTROLS);
    expect(step.verify).toBe(GQL.SUBSCRIPTION_STREAM_CONTROLS);
  });

  it('gql5-pause falls back to ensurePauseResumeDemo when pause btn missing', async () => {
    stubSubscriptionShell();
    document.querySelector(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN)?.remove();
    document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN)?.remove();
    document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN)!.disabled = true;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql5-filter skips filter bar open when already visible', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  });

  it('gql5-assertions adds assertion then re-subscribes for badge demo', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-assertions')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ASSERTION_JSONPATH, '$.orderStatus.status');
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN);
  });

  it('gql5-disconnect preAction re-subscribes when stop is not yet visible', async () => {
    stubSubscriptionShell();
    document.querySelector(GQL.STOP_SUB_BTN)?.remove();
    document.querySelector(GQL.SUB_STOP_BTN)?.remove();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN);
  });

  it('gql5-disconnect clicks stop on connection bar', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.STOP_SUB_BTN);
  });

  it('gql5-disconnect falls back to log stop button', async () => {
    stubSubscriptionShell();
    document.querySelector(GQL.STOP_SUB_BTN)?.remove();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUB_STOP_BTN);
  });
});
