/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
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
} from './graphql-lesson-helpers';

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
    expect(gqlSubscriptionsLesson.steps.length).toBe(10);
    expect(gqlSubscriptionsLesson.estimatedMinutes).toBe(4);
    expect(gqlSubscriptionsLesson.initialTab).toBe('graphql-studio');
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
      'gql5-endpoint',
      'gql5-create-order',
      'gql5-write-sub',
      'gql5-subscribe',
      'gql5-watch-log',
      'gql5-pause',
      'gql5-filter',
      'gql5-assertions',
      'gql5-disconnect',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
    gqlSubscriptionsLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–10 have preAction guards', () => {
    gqlSubscriptionsLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql5-intro has no preAction', () => {
    expect(gqlSubscriptionsLesson.steps[0].preAction).toBeUndefined();
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
    expect(ctx.selectOption).toHaveBeenCalled();
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

  it('setup resets endpoint and seeds subscription template', async () => {
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('subscription query constant includes orderStatus variable', () => {
    expect(GQL_ORDER_STATUS_SUBSCRIPTION).toContain('orderStatus');
    expect(GQL_ORDER_STATUS_SUBSCRIPTION).toContain('$orderId');
  });
});
