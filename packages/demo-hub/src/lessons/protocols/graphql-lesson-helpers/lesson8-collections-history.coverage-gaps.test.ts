/**
 * @vitest-environment jsdom
 */
import { describe, it, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { gqlCollectionsHistoryLesson } from '../graphql-collections-history';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql9'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('lesson8-collections-history — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('walks collections/history lesson steps', async () => {
    const ctx = makeCtx();
    for (const step of gqlCollectionsHistoryLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });
});
