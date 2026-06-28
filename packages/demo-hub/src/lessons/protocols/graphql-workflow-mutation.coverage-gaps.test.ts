/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gqlWorkflowMutationLesson } from './graphql-workflow-mutation';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { LESSON18_WF_NAME, resetGqlLesson18SessionFlags } from './graphql-lesson-helpers';

vi.mock('@graphql/utils/graphqlProxyTransports', () => ({
  getProxyBase: vi.fn(() => 'http://localhost:4000'),
  createWsProxyTransport: vi.fn(),
  createSseProxyTransport: vi.fn(),
}));

vi.mock('@graphql/utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

describe('graphql-workflow-mutation wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson18SessionFlags();
    stubWorkflowSeedBridge(LESSON18_WF_NAME);
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
  });

  it('walks all step preAction/action handlers', async () => {
    const ctx = makeCtx();
    for (const step of gqlWorkflowMutationLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
    expect(gqlWorkflowMutationLesson.steps.length).toBe(15);
  });

  it('setup and cleanup run', async () => {
    const ctx = makeCtx();
    await gqlWorkflowMutationLesson.setup!(ctx);
    await gqlWorkflowMutationLesson.cleanup!(ctx);
  });
});
