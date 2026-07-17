// ── Lesson 18: GraphQL Mutation Node in Workflow ─────────────────────────────
export * from './lesson18-workflow-mutation.constants';
export * from './lesson18-workflow-mutation.graph';
export * from './lesson18-workflow-mutation.canvas';

import type { DemoActionContext } from '../../../types';
import { deleteWorkflowByName } from '../../../adapters';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
} from '../../wf-demo-helpers';
import { LESSON18_WF_NAME } from './lesson18-workflow-mutation.constants';
import { dismissWorkflowOnboarding } from './lesson18-workflow-mutation.canvas';
import { resetGqlLesson18SessionFlags } from './lesson18-workflow-mutation.graph';

export async function gqlWorkflowMutationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson18SessionFlags();
  if (deleteWorkflowByName(LESSON18_WF_NAME)) {
    await ctx.delay(300);
  }
  await cleanupWorkflowDemoRunUi(ctx);
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
}

export async function gqlWorkflowMutationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(LESSON18_WF_NAME);
  resetGqlLesson18SessionFlags();
  await ctx.delay(100);
}
