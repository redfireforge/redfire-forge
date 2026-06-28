/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql7'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { GQL } from '@shared/selectors';
import { resetGqlLesson5SessionFlags } from './graphql-lesson-helpers/lesson5-subscriptions';

describe('graphql-subscriptions wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson5SessionFlags();
  });

  it('cleanup runs without error', async () => {
    await gqlSubscriptionsLesson.cleanup!(makeCtx());
  });

  it('walks early step preActions with seeded transport DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <select data-testid="gql-transport-select"><option value="graphql-transport-ws">ws</option></select>
      <div data-testid="gql-response-viewer"></div>
    `;
    for (const step of gqlSubscriptionsLesson.steps.slice(0, 4)) {
      if (step.preAction) await step.preAction(ctx);
    }
  });

  it('setup runs without error', async () => {
    const ctx = makeCtx();
    if (gqlSubscriptionsLesson.setup) await gqlSubscriptionsLesson.setup(ctx);
  });

  it('disconnect step action resolves with stop button DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-stop-sub-btn"></button>
      <div data-testid="gql-sub-log"></div>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    await expect(step.action!(ctx)).resolves.toBeUndefined();
  });

  it('observe-create-order step action waits for order id card', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-response-data-create-order"></div>`;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-observe-create-order')!;
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_DATA_CREATE_ORDER, 5000);
  });

  it('gql5-write-sub fills variables when order id is parsed from response', async () => {
    const monaco = await import('./graphql-lesson-helpers/gql-demo-core/monaco');
    const fillVarsSpy = vi.spyOn(monaco, 'fillGqlVariables').mockResolvedValue(undefined);
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-from-response"}}}</div>
      <button data-testid="gql-bottom-tab-vars"></button>
      <div data-testid="gql-vars-panel"></div>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    await step.action!(ctx);
    expect(fillVarsSpy).toHaveBeenCalled();
    fillVarsSpy.mockRestore();
  });

  it('gql5-write-sub skips variables when no order id is available', async () => {
    const monaco = await import('./graphql-lesson-helpers/gql-demo-core/monaco');
    const fillVarsSpy = vi.spyOn(monaco, 'fillGqlVariables').mockResolvedValue(undefined);
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    await step.action!(ctx);
    expect(fillVarsSpy).not.toHaveBeenCalled();
    fillVarsSpy.mockRestore();
  });

  it('gql5-pause action pauses without resume when resume button is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-sub-pause-btn"></button>
      <button data-testid="gql-sub-resubscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <span data-testid="gql-sub-state">Live</span>
    `;
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SUBSCRIPTION_PAUSE_BTN);
  });

  it('gql5-pause action skips fallback when resubscribe succeeds without pause control', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-sub-resubscribe-btn"></button>
      <div data-testid="gql-sub-log"></div>
      <span data-testid="gql-sub-state">Live</span>
    `;
    const mod = await import('./graphql-lesson-helpers/lesson5-subscriptions');
    const fallbackSpy = vi.spyOn(mod, 'ensurePauseResumeDemo').mockResolvedValue(undefined);
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-pause')!;
    await step.action!(ctx);
    expect(fallbackSpy).not.toHaveBeenCalled();
    fallbackSpy.mockRestore();
  });
});
