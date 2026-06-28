/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gqlWorkflowSubscriptionLesson } from './graphql-workflow-subscription';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import {
  LESSON19_WF_NAME,
  LESSON19_NODE_SUB,
  LESSON19_ORDER_ID_VAR,
  resetGqlLesson19SessionFlags,
} from './graphql-lesson-helpers';
import * as adapters from '../../adapters';

describe('graphql-workflow-subscription wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson19SessionFlags();
    stubWorkflowSeedBridge(LESSON19_WF_NAME);
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
  });

  it('walks all step preAction/action handlers', async () => {
    const ctx = makeCtx();
    for (const step of gqlWorkflowSubscriptionLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
    expect(gqlWorkflowSubscriptionLesson.steps.length).toBe(9);
  });

  it('setup and cleanup run', async () => {
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLesson.setup!(ctx);
    await gqlWorkflowSubscriptionLesson.cleanup!(ctx);
  });

  it('preActions skip configure when subscription query is already ready', async () => {
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue({
      nodes: [{
        id: LESSON19_NODE_SUB,
        type: 'graphqlSubscription',
        data: {
          endpoint: 'http://localhost:4010/graphql',
          subscriptionQuery: 'subscription { orderStatus(orderId: $orderId) { status } }',
          variables: `{ "orderId": {{${LESSON19_ORDER_ID_VAR}}} }`,
        },
      }],
    } as never);

    const ctx = makeCtx();
    for (const stepId of ['gql19-timeout', 'gql19-correlation', 'gql19-sample-payload']) {
      const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === stepId)!;
      await step.preAction!(ctx);
    }
  });
});
