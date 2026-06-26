/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql7'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_ORDER_STATUS_SUBSCRIPTION,
  createDemoOrder,
  getLesson5OrderId,
  parseCreatedOrderIdFromResponse,
  resetGqlLesson5SessionFlags,
  resetGqlLessonSessionFlags,
  storeCreatedOrderIdFromResponse,
  gqlSubscriptionsLessonSetup,
  ensureDemoOrderCreated,
  ensureSubscriptionQueryWritten,
  ensureSubscriptionVars,
  ensureSubscribedWithMessages,
  ensurePauseResumeDemo,
  ensureFilterDemo,
  ensureAssertionAdded,
  ensureWsTransport,
  prepareGql5SubscriptionAuthReading,
  ensureSubscriptionAuthConfigured,
  markSubscriptionAuthDone,
  ensureEnvReady,
  resetGqlLesson6SessionFlags,
  gqlSubscriptionsLessonCleanup,
  resetGqlLesson3SessionFlags,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor, stubSubscriptionShell } from './__test-utils__/graphql-test-fixtures';

describe('gql-subscriptions lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson5SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlSubscriptionsLesson.id).toBe('gql-subscriptions');
    expect(gqlSubscriptionsLesson.domainId).toBe('protocols');
    expect(gqlSubscriptionsLesson.category).toBe('graphql');
    expect(gqlSubscriptionsLesson.name).toBe('Subscriptions — Real-Time Data');
    expect(gqlSubscriptionsLesson.steps.length).toBe(15);
    expect(gqlSubscriptionsLesson.estimatedMinutes).toBe(8);
    expect(gqlSubscriptionsLesson.initialTab).toBe('graphql-studio');
    expect(gqlSubscriptionsLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlSubscriptionsLesson.tag).toBe('🐳 Docker');
    expect(gqlSubscriptionsLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlSubscriptionsLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlSubscriptionsLesson.setup).toBe('function');
    expect(typeof gqlSubscriptionsLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    const ids = gqlSubscriptionsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'gql5-intro',
      'gql5-connection-bar',
      'gql5-endpoint',
      'gql5-create-order',
      'gql5-exec-create-order',
      'gql5-observe-create-order',
      'gql5-write-sub',
      'gql5-transport-select',
      'gql5-subscription-auth',
      'gql5-subscribe',
      'gql5-watch-log',
      'gql5-pause',
      'gql5-filter',
      'gql5-assertions',
      'gql5-disconnect',
    ]);
  });

  it('all 15 steps have pauseAfter: true', () => {
    gqlSubscriptionsLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–15 have preAction guards', () => {
    gqlSubscriptionsLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql5-intro has preAction for demo endpoint', () => {
    expect(gqlSubscriptionsLesson.steps[0].preAction).toBeTypeOf('function');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql5-intro highlights connection bar (Subscribe orientation)', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-intro')!;
    expect(step.highlight).toBe(GQL.CONNECTION_BAR);
  });

  it('gql5-connection-bar highlights connection bar (Subscribe button tour)', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    expect(step.highlight).toBe(GQL.CONNECTION_BAR);
  });

  it('gql5-endpoint highlights endpoint input for URL + introspect', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql5-transport-select highlights transport select dropdown', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    expect(step.highlight).toBe(GQL.TRANSPORT_SELECT);
  });

  it('gql5-subscription-auth highlights auth preview row', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscription-auth')!;
    expect(step.highlight).toBe(GQL.AUTH_PREVIEW);
    expect(step.verify).toBe(GQL.AUTH_PREVIEW);
  });

  it('gql5-subscribe highlights subscribe button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscribe')!;
    expect(step.highlight).toBe(GQL.SUBSCRIBE_BTN);
  });

  it('gql5-disconnect highlights stop subscription button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    expect(step.highlight).toBe(GQL.STOP_SUB_BTN);
  });

  it('gql5-observe-create-order highlights compact data.createOrder card', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-observe-create-order')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
    expect(step.verify).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
    expect(step.description).toContain('data.createOrder.id');
  });

  // ─── Concept ────────────────────────────────────────────────────────────

  it('concept body explains WHY subscriptions differ from queries', () => {
    expect(gqlSubscriptionsLesson.concept.body).toContain('server-initiated');
    expect(gqlSubscriptionsLesson.concept.body).toContain('real-time');
  });

  it('concept body explains graphql-transport-ws vs graphql-ws', () => {
    expect(gqlSubscriptionsLesson.concept.body).toContain('graphql-transport-ws');
    expect(gqlSubscriptionsLesson.concept.body).toContain('graphql-ws');
  });

  it('concept diagram is 700×430 studio chrome SVG with Subscribe button and log', () => {
    const diag = gqlSubscriptionsLesson.concept.diagram;
    expect(diag).toContain('viewBox="0 0 700 430"');
    expect(diag).toContain('GraphQL Studio — Subscriptions');
    expect(diag).toContain('Subscribe');
    expect(diag).toContain('LIVE');
    expect(diag).toContain('PENDING');
    expect(diag).toContain('COMPLETE');
  });

  it('concept diagram shows purple S badge color', () => {
    expect(gqlSubscriptionsLesson.concept.diagram).toContain('#7c3aed');
  });

  it('concept keyTerms cover Subscription, transport, message log, assertions', () => {
    const terms = (gqlSubscriptionsLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Subscription');
    expect(terms).toContain('graphql-transport-ws');
    expect(terms).toContain('Message log');
    expect(terms).toContain('Subscription assertion');
  });

  // ─── Step description content ────────────────────────────────────────────

  it('gql5-intro description explains server-push and S badge', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-intro')!;
    expect(step.description).toContain('S');
    expect(step.description).toContain('subscription');
  });

  it('gql5-connection-bar description explains transport dropdown and Subscribe button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    expect(step.description).toContain('Transport');
    expect(step.description).toContain('Subscribe');
  });

  it('gql5-transport-select description explains both sub-protocols', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    expect(step.description).toContain('graphql-transport-ws');
    expect(step.description).toContain('graphql-ws');
  });

  it('gql5-create-order description explains why orderId is required', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-create-order')!;
    expect(step.description).toContain('orderId');
    expect(step.description).toContain('createOrder');
  });

  it('gql5-write-sub description explains S badge switch', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    expect(step.description).toContain('subscription');
    expect(step.description).toContain('$orderId');
  });

  it('gql5-assertions description explains re-subscribe and pass/fail badges', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-assertions')!;
    expect(step.description).toContain('COMPLETE');
    expect(step.description).toContain('$.orderStatus.status');
    expect(step.description.toLowerCase()).toContain('re-subscrib');
    expect(step.verify).toBe(GQL.ASSERTION_BADGE);
  });

  it('gql5-disconnect description explains log persists after stop', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    expect(step.description).toContain('log');
    expect(step.description).toContain('Stop');
  });

  // ─── New step actions ────────────────────────────────────────────────────

  it('gql5-connection-bar preAction seeds subscription editor for Subscribe UI', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('query { }');
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
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
    expect(step.description).toContain('auto-seeds');
    expect(step.description).toContain('authToken');
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, '{{authToken}}');
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('gql5-subscription-auth preAction seeds env and configures bearer auth preview', async () => {
    resetGqlLesson6SessionFlags();
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-env-badge"></button>
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
    expect((window as unknown as Record<string, unknown>).__demoUpsertGqlEnv).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, '{{authToken}}');
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

  it('ensureWsTransport skips when already graphql-transport-ws', async () => {
    stubSubscriptionShell();
    const select = document.querySelector<HTMLSelectElement>(GQL.TRANSPORT_SELECT)!;
    select.value = 'graphql-transport-ws';
    const ctx = makeCtx();
    await ensureWsTransport(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensureDemoOrderCreated guard skips when order already created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-cached' } } }),
    }));
    const ctx = makeCtx();
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('mutation { createOrder }');
    await createDemoOrder();
    vi.mocked(ctx.click).mockClear();
    await ensureDemoOrderCreated(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureFilterDemo guard skips when filter bar already open', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    storeCreatedOrderIdFromResponse();
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createOrder":{"id":"ord-1"}}}';
    const ctx = makeCtx();
    await ensureFilterDemo(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureFilterDemo(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  });

  it('parseCreatedOrderIdFromResponse returns null for empty body', () => {
    document.body.innerHTML = '<div data-testid="gql-response-body"></div>';
    expect(parseCreatedOrderIdFromResponse()).toBeNull();
  });

  it('ensureDemoOrderCreated uses UI mutation when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      '{"data":{"createOrder":{"id":"ord-ui"}}}';
    const { setQuery } = stubMonacoEditor('query { }');
    const ctx = makeCtx();
    resetGqlLesson5SessionFlags();
    resetGqlLesson3SessionFlags();
    await ensureDemoOrderCreated(ctx);
    expect(setQuery).toHaveBeenCalled();
    expect(getLesson5OrderId()).toBe('ord-ui');
  });

  it('ensurePauseResumeDemo guard skips when already demonstrated', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      '{"data":{"createOrder":{"id":"ord-1"}}}';
    storeCreatedOrderIdFromResponse();
    const ctx = makeCtx();
    await ensurePauseResumeDemo(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensurePauseResumeDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
  });

  it('ensureAssertionAdded expands collapsed assertion toggle', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.ASSERTION_TOGGLE)!.setAttribute('aria-expanded', 'false');
    document.querySelector(GQL.ASSERTION_ROW)?.remove();
    const ctx = makeCtx();
    await ensureAssertionAdded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ASSERTION_TOGGLE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ASSERTION_ADD_BTN);
  });

  it('gql5-endpoint action fills endpoint and introspects', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql5-write-sub action writes subscription query', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <select data-testid="gql-transport-select"><option value="auto">Auto</option><option value="graphql-transport-ws">WS</option></select>
      <button data-testid="gql-bottom-tab-variables"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <span data-testid="gql-schema-badge-ok"></span>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };

    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    // gql5-write-sub fills the editor; transport select is in gql5-transport-select
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql5-subscribe action clicks Subscribe', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-subscribe-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-sub-log"></div>
      <div data-testid="gql-ws-status"></div>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscribe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('gql5-filter action opens filter and types COMPLETE', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-sub-filter-btn"></button>
      <div data-testid="gql-sub-message-list">
        <div data-testid="gql-sub-row">PENDING</div>
        <div data-testid="gql-sub-row">COMPLETE</div>
      </div>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-filter')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  });

  it('parseCreatedOrderIdFromResponse extracts order id from JSON', () => {
    document.body.innerHTML = `
      <div data-testid="gql-response-body">${JSON.stringify({
        data: { createOrder: { id: 'ord-42', status: 'PENDING' } },
      })}</div>
    `;
    expect(parseCreatedOrderIdFromResponse()).toBe('ord-42');
  });

  it('storeCreatedOrderIdFromResponse stores id in session', () => {
    document.body.innerHTML = `
      <div data-testid="gql-response-body">${JSON.stringify({
        data: { createOrder: { id: 'ord-99' } },
      })}</div>
    `;
    storeCreatedOrderIdFromResponse();
    expect(getLesson5OrderId()).toBe('ord-99');
  });

  it('createDemoOrder fetches order id from test server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-1', status: 'PENDING' } } }),
    }));
    const id = await createDemoOrder();
    expect(id).toBe('ord-1');
    expect(getLesson5OrderId()).toBe('ord-1');
  });

  it('setup creates demo tab and seeds subscription template', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-setup' } } }),
    }));

    await gqlSubscriptionsLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-subscriptions',
      'Subscriptions — Real-Time Data',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('subscription query constant includes orderStatus variable', () => {
    expect(GQL_ORDER_STATUS_SUBSCRIPTION).toContain('orderStatus');
    expect(GQL_ORDER_STATUS_SUBSCRIPTION).toContain('$orderId');
  });

  it('parseCreatedOrderIdFromResponse falls back to regex on invalid JSON', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">broken {"createOrder": { "id": "ord-regex" } }</pre>';
    expect(parseCreatedOrderIdFromResponse()).toBe('ord-regex');
  });

  it('ensureDemoOrderCreated falls back to UI mutation when fetch fails', async () => {
    const ctx = makeCtx();
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('');
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = GQL_DEMO_HTTP;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      JSON.stringify({ data: { createOrder: { id: 'ord-ui' } } });
    await ensureDemoOrderCreated(ctx);
    expect(getLesson5OrderId()).toBe('ord-ui');
  });

  it('ensureWsTransport skips when transport already ws', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <select data-testid="gql-transport-select">
        <option value="graphql-transport-ws" selected>WS</option>
      </select>
    `;
    await ensureWsTransport(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensurePauseResumeDemo clicks pause and resume buttons', async () => {
    const ctx = makeCtx();
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-pause' } } }),
    }));
    await ensureSubscribedWithMessages(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensurePauseResumeDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUME_BTN);
  });

  it('ensureFilterDemo guard skips when filter bar already open', async () => {
    const ctx = makeCtx();
    stubSubscriptionShell('<div data-testid="gql-sub-filter-bar"><input data-testid="gql-sub-filter-input" /></div>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-filter' } } }),
    }));
    await ensureFilterDemo(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureFilterDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_BTN);
  });

  it('ensureAssertionAdded expands collapsed assertion panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-assertion-panel">
        <button data-testid="gql-assertion-toggle" aria-expanded="false"></button>
        <button data-testid="gql-assertion-add-btn"></button>
      </div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-assert' } } }),
    }));
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.ASSERTION_ROW) {
        document.querySelector(GQL.ASSERTION_PANEL)!.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-assertion-row">
            <input data-testid="gql-assertion-jsonpath" />
            <select data-testid="gql-assertion-operator"><option value="equals">equals</option></select>
            <input data-testid="gql-assertion-expected" />
          </div>`,
        );
      }
    });
    await ensureAssertionAdded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ASSERTION_TOGGLE);
  });

  it('gqlSubscriptionsLessonSetup resets lesson6 flags so ensureEnvReady runs again after restart', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <button data-testid="gql-env-new-btn"></button>
        <button data-testid="gql-env-var-add-btn"></button>
        <button data-testid="gql-env-set-active-btn"></button>
        <button data-testid="gql-env-close-btn"></button>
      </div>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('subscription { }');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-setup' } } }),
    }));
    await ensureEnvReady(ctx);
    vi.mocked(ctx.click).mockClear();
    await gqlSubscriptionsLessonSetup(ctx);
    await ensureEnvReady(ctx);
    expect(vi.mocked(ctx.click).mock.calls.length).toBeGreaterThan(0);
  });

  it('gqlSubscriptionsLessonCleanup closes demo tab and resets flags', async () => {
    const ctx = makeCtx();
    await gqlSubscriptionsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-subscriptions');
  });

  it('ensureSubscriptionQueryWritten guard skips when orderStatus already in editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-sub' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const ctx = makeCtx();
    await ensureSubscriptionQueryWritten(ctx);
    const { setQuery } = stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.mocked(setQuery).mockClear();
    await ensureSubscriptionQueryWritten(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('gql5-endpoint action introspects when schema badge missing', async () => {
    stubGqlStudioShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureSubscribedWithMessages guard skips when log already complete', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    storeCreatedOrderIdFromResponse();
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      JSON.stringify({ data: { createOrder: { id: 'ord-1' } } });
    const ctx = makeCtx();
    await ensureSubscribedWithMessages(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureSubscribedWithMessages(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('ensureSubscriptionVars creates order via fetch when order id missing', async () => {
    resetGqlLesson5SessionFlags();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-fetch' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const ctx = makeCtx();
    await ensureSubscriptionVars(ctx);
    expect(getLesson5OrderId()).toBe('ord-fetch');
  });

  it('ensureAssertionAdded returns early when assertion panel missing', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const ctx = makeCtx();
    await ensureAssertionAdded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ASSERTION_ADD_BTN);
  });

  it('gql5-disconnect skips subscribe click when button disabled', async () => {
    stubSubscriptionShell();
    const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN)!;
    subscribeBtn.disabled = true;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.STOP_SUB_BTN);
  });

  it('gql5-pause step uses pause/resume when buttons present', async () => {
    stubSubscriptionShell();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUME_BTN);
  });

  it('createDemoOrder throws when server returns errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ errors: [{ message: 'fail' }] }),
    }));
    resetGqlLesson5SessionFlags();
    await expect(createDemoOrder()).rejects.toThrow('Failed to create demo order');
  });

  it('storeCreatedOrderIdFromResponse ignores invalid response body', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">not-json</pre>';
    resetGqlLesson5SessionFlags();
    storeCreatedOrderIdFromResponse();
    expect(getLesson5OrderId()).toBe('');
  });

  it('ensureSubscribedWithMessages skips subscribe click when button disabled', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    storeCreatedOrderIdFromResponse();
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      JSON.stringify({ data: { createOrder: { id: 'ord-sub' } } });
    document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN)!.disabled = true;
    const ctx = makeCtx();
    await ensureSubscribedWithMessages(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('createDemoOrder returns cached order id without refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-cached' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    resetGqlLesson5SessionFlags();
    const first = await createDemoOrder();
    const second = await createDemoOrder();
    expect(first).toBe('ord-cached');
    expect(second).toBe('ord-cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ensureDemoOrderCreated guard skips refetch when order already stored', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-guard' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('mutation { createOrder }');
    const ctx = makeCtx();
    await ensureDemoOrderCreated(ctx);
    const fetchCalls = vi.mocked(fetch).mock.calls.length;
    await ensureDemoOrderCreated(ctx);
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCalls);
  });

  it('ensureSubscriptionQueryWritten guard skips when orderStatus already written', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-q' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const ctx = makeCtx();
    await ensureSubscriptionQueryWritten(ctx);
    const { setQuery } = stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    vi.mocked(setQuery).mockClear();
    await ensureSubscriptionQueryWritten(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensurePauseResumeDemo skips subscribe when button disabled and no pause btn', async () => {
    stubSubscriptionShell();
    document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN)!.disabled = true;
    document.querySelector(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN)?.remove();
    document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN)?.remove();
    const ctx = makeCtx();
    await ensureSubscribedWithMessages(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensurePauseResumeDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
  });

  it('ensureFilterDemo guard skips when filter bar already open', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-sub-filter-bar"></div>');
    const ctx = makeCtx();
    await ensureFilterDemo(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureFilterDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_BTN);
  });

  it('gqlSubscriptionsLessonSetup catches createDemoOrder failure quietly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    stubGqlStudioShell();
    stubMonacoEditor('subscription { }');
    const ctx = makeCtx();
    await expect(gqlSubscriptionsLessonSetup(ctx)).resolves.toBeUndefined();
  });

  it('ensureSubscriptionVars parses order id from response when fetch fails', async () => {
    resetGqlLesson5SessionFlags();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '';
    const ctx = makeCtx();
    await ensureSubscriptionQueryWritten(ctx);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      JSON.stringify({ data: { createOrder: { id: 'ord-parsed' } } });
    await ensureSubscriptionVars(ctx);
    expect(getLesson5OrderId()).toBe('ord-parsed');
  });

  it('gql5-disconnect completes when no stop buttons are present', async () => {
    stubSubscriptionShell();
    document.querySelector(GQL.STOP_SUB_BTN)?.remove();
    document.querySelector(GQL.SUB_STOP_BTN)?.remove();
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SUBSCRIPTION_LOG, 5000);
  });

  it('gql5-write-sub action fills variables when order id available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-write' } } }),
    }));
    stubSubscriptionShell();
    const ctx = makeCtx();
    await ensureDemoOrderCreated(ctx);
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureAssertionAdded skips add when assertion row already exists', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-assertion-panel">
        <button data-testid="gql-assertion-toggle" aria-expanded="true"></button>
        <div data-testid="gql-assertion-row"></div>
      </div>
    `);
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    const ctx = makeCtx();
    await ensureAssertionAdded(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureAssertionAdded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ASSERTION_ADD_BTN);
  });

  it('ensureFilterDemo guard skips when filter demo already done', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-sub-filter-bar"></div>');
    const ctx = makeCtx();
    await ensureFilterDemo(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureFilterDemo(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  });

  it('ensurePauseResumeDemo completes when pause exists but resume missing', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.SUBSCRIPTION_RESUME_BTN)?.remove();
    const ctx = makeCtx();
    await ensurePauseResumeDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
  });

  it('gqlSubscriptionsLessonSetup closes active history tab and creates demo tab', async () => {
    stubGqlStudioShell(`
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
    `);
    stubMonacoEditor('subscription { }');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlSubscriptionsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-subscriptions',
      'Subscriptions — Real-Time Data',
    );
  });

  it('gqlSubscriptionsLessonSetup activates editor mode when inactive', async () => {
    stubGqlStudioShell();
    document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!.classList.remove('gql-mode-btn--active');
    stubMonacoEditor('subscription { }');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const clickSpy = vi.spyOn(editorBtn, 'click');
    const ctx = makeCtx();
    await gqlSubscriptionsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureFilterDemo opens filter bar when not visible', async () => {
    stubSubscriptionShell();
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      '{"data":{"createOrder":{"id":"ord-filter"}}}';
    storeCreatedOrderIdFromResponse();
    document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)?.remove();
    resetGqlLesson5SessionFlags();
    storeCreatedOrderIdFromResponse();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockClear();
    await ensureFilterDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  });

  it('ensureSubscriptionVars continues when createDemoOrder fails and no parsed id', async () => {
    resetGqlLesson5SessionFlags();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_ORDER_STATUS_SUBSCRIPTION);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = 'not-json';
    const ctx = makeCtx();
    await ensureSubscriptionQueryWritten(ctx);
    await expect(ensureSubscriptionVars(ctx)).resolves.toBeUndefined();
  });
});
