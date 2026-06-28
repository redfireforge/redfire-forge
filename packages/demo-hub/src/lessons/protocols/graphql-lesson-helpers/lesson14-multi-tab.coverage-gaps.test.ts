/**
 * @vitest-environment jsdom
 */
import { describe, it, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { gqlMultiTabLesson } from '../graphql-multi-tab';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql14'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('lesson14-multi-tab — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('walks multi-tab lesson steps', async () => {
    const ctx = makeCtx();
    for (const step of gqlMultiTabLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('setup and cleanup run with tab bar DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-tab-bar"></div>`;
    if (gqlMultiTabLesson.setup) await gqlMultiTabLesson.setup(ctx);
    if (gqlMultiTabLesson.cleanup) await gqlMultiTabLesson.cleanup(ctx);
  });

  it('walks multi-tab steps with tab bar and editor seeded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"></div>
      <button data-testid="gql-tab-add"></button>
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    `;
    for (const step of gqlMultiTabLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });
});
