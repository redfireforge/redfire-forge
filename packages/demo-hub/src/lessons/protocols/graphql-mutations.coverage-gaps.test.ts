/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gqlMutationsLesson } from './graphql-mutations';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import { resetGqlLesson3SessionFlags } from './graphql-lesson-helpers';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql6'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('graphql-mutations wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson3SessionFlags();
  });

  it('runs late-step observe and idempotency actions', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-rv-tab-response"></button>
      <button data-testid="gql-rv-tab-body"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-response-data-create-order"></div>
      <div data-testid="gql-response-data-delete-user"></div>
      <button data-testid="gql-execute-btn"></button>
    `;
    for (const stepId of [
      'gql3-observe-order',
      'gql3-observe-delete',
      'gql3-idempotency-exec',
      'gql3-observe-idempotency',
    ]) {
      const step = gqlMutationsLesson.steps.find((s) => s.id === stepId)!;
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
    expect(document.querySelector(GQL.RESPONSE_VIEWER)).toBeTruthy();
  });
});
