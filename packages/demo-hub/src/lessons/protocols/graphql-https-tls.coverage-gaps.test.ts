/**
 * @vitest-environment jsdom
 * Lightweight wrapper coverage — graphql-https-tls.test.ts is heavy and may timeout in CI pools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gqlHttpsTlsLesson } from './graphql-https-tls';
import { makeCtx } from './ws-test-utils';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql5'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

vi.mock('@graphql/utils/gqlDemoWorkspace', () => ({
  patchDemoTabConnection: vi.fn(async () => true),
  loadDemoSession: vi.fn(async () => null),
}));

describe('graphql-https-tls wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-testid="gql-endpoint"></div>';
  });

  it('setup and cleanup are defined', () => {
    expect(gqlHttpsTlsLesson.setup).toBeTypeOf('function');
    expect(gqlHttpsTlsLesson.cleanup).toBeTypeOf('function');
  });

  it('runs preAction/action for each step with minimal DOM', async () => {
    const ctx = makeCtx();
    for (const step of gqlHttpsTlsLesson.steps) {
      if (step.preAction) {
        await step.preAction(ctx);
      }
      if (step.action) {
        await step.action(ctx);
      }
    }
    expect(gqlHttpsTlsLesson.steps.length).toBeGreaterThan(0);
  });
});
