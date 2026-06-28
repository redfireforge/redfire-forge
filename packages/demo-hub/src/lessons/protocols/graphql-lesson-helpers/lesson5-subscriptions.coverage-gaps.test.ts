/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import {
  resetGqlLesson5SessionFlags,
  parseCreatedOrderIdFromResponse,
  storeCreatedOrderIdFromResponse,
  getLesson5OrderId,
  ensureWsTransport,
} from './lesson5-subscriptions';
import { GQL } from '@shared/selectors';

describe('lesson5-subscriptions — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson5SessionFlags();
  });

  it('parseCreatedOrderIdFromResponse reads createOrder id from response body', () => {
    document.body.innerHTML = `<div data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-42"}}}</div>`;
    expect(parseCreatedOrderIdFromResponse()).toBe('ord-42');
  });

  it('storeCreatedOrderIdFromResponse persists parsed order id', () => {
    document.body.innerHTML = `<div data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-99"}}}</div>`;
    storeCreatedOrderIdFromResponse();
    expect(getLesson5OrderId()).toBe('ord-99');
  });

  it('ensureWsTransport selects websocket transport in the panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<select data-testid="gql-transport-select"><option value="sse">sse</option><option value="graphql-transport-ws">ws</option></select>`;
    await ensureWsTransport(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.TRANSPORT_SELECT, 'graphql-transport-ws');
  });

  it('parseCreatedOrderIdFromResponse returns null when body missing', () => {
    document.body.innerHTML = '';
    expect(parseCreatedOrderIdFromResponse()).toBeNull();
  });

  it('ensureWsTransport short-circuits when ws already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<select data-testid="gql-transport-select"><option value="graphql-transport-ws" selected>ws</option></select>`;
    await ensureWsTransport(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('getLesson5OrderId returns stored order id after storeCreatedOrderIdFromResponse', () => {
    document.body.innerHTML = `<div data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-77"}}}</div>`;
    storeCreatedOrderIdFromResponse();
    expect(getLesson5OrderId()).toBe('ord-77');
  });

  it('parseCreatedOrderIdFromResponse returns null for empty body text', () => {
    document.body.innerHTML = `<div data-testid="gql-response-body">   </div>`;
    expect(parseCreatedOrderIdFromResponse()).toBeNull();
  });

  it('clickResubscribeAndWaitForLive uses toolbar resubscribe button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-sub-resubscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <button data-testid="gql-sub-pause-btn"></button>
    `;
    const { clickResubscribeAndWaitForLive } = await import('./lesson5-subscriptions');
    expect(await clickResubscribeAndWaitForLive(ctx)).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_RESUBSCRIBE_BTN);
  });

  it('clickResubscribeAndWaitForLive returns false when no resubscribe controls', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<button data-testid="gql-right-tab-response"></button>`;
    const { clickResubscribeAndWaitForLive } = await import('./lesson5-subscriptions');
    expect(await clickResubscribeAndWaitForLive(ctx)).toBe(false);
  });

  it('ensureSubscriptionAuthConfigured short-circuits on second call', async () => {
    const ctx = makeCtx();
    const { markSubscriptionAuthDone, ensureSubscriptionAuthConfigured } = await import('./lesson5-subscriptions');
    markSubscriptionAuthDone();
    vi.mocked(ctx.click).mockClear();
    await ensureSubscriptionAuthConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('clearSubscriptionFilterIfActive clears filter when input has value', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-sub-filter-input" value="error" />
      <button data-testid="gql-sub-filter-clear"></button>
    `;
    const { clearSubscriptionFilterIfActive } = await import('./lesson5-subscriptions');
    await clearSubscriptionFilterIfActive(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('clickResubscribeAndWaitForLive uses subscribe button when toolbar resubscribe missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-subscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <span data-testid="gql-sub-state">Live</span>
    `;
    const { clickResubscribeAndWaitForLive } = await import('./lesson5-subscriptions');
    expect(await clickResubscribeAndWaitForLive(ctx)).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('clearSubscriptionFilterIfActive no-ops when filter input is empty', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-sub-filter-input" value="" />
      <button data-testid="gql-sub-filter-clear"></button>
    `;
    const { clearSubscriptionFilterIfActive } = await import('./lesson5-subscriptions');
    await clearSubscriptionFilterIfActive(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('prepareGql5PauseReading subscribes when subscription log is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-subscribe-btn"></button>
      <div data-testid="gql-sub-row"></div>
      <div data-testid="gql-sub-row"></div>
      <div data-testid="gql-sub-row"></div>
      <div data-testid="gql-sub-message-list">COMPLETE</div>
    `;
    const { prepareGql5PauseReading, markSubscriptionAuthDone } = await import('./lesson5-subscriptions');
    markSubscriptionAuthDone();
    await prepareGql5PauseReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('prepareGql5PauseReading re-subscribes when log exists but has no rows', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-subscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <div data-testid="gql-sub-message-list">COMPLETE</div>
    `;
    const { prepareGql5PauseReading, markSubscriptionAuthDone } = await import('./lesson5-subscriptions');
    markSubscriptionAuthDone();
    await prepareGql5PauseReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });

  it('demonstrateAssertionStream falls back to subscribe when resubscribe is unavailable', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-subscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <div data-testid="gql-sub-row"></div>
      <span data-testid="gql-assertion-badge"></span>
      <span data-testid="gql-assertion-badge"></span>
      <span data-testid="gql-assertion-badge"></span>
      <div data-testid="gql-sub-message-list">COMPLETE</div>
    `;
    const { demonstrateAssertionStream, markSubscriptionAuthDone } = await import('./lesson5-subscriptions');
    markSubscriptionAuthDone();
    await demonstrateAssertionStream(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIBE_BTN);
  });
});
