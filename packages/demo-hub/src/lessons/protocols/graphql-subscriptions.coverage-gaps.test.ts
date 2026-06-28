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

describe('graphql-subscriptions wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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
});
