/** Demo Hub ↔ GraphQL Studio tab bridge (§11.0). */
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  closeDemoWorkspace,
  dispatchGqlTabsReload,
  loadDemoSession,
  prepareDemoWorkspace,
} from '../../../../graphql/utils/gqlDemoWorkspace';

export const GQL14_LESSON_ID = 'gql-multi-tab';
export const GQL15_LESSON_ID = 'gql-batch-execution';

export async function ensureGqlDemoTab(
  ctx: DemoActionContext,
  lessonId: string,
  displayName: string,
  tabBudget = 1,
): Promise<string | undefined> {
  const label = displayName.startsWith('Demo:') ? displayName : `Demo: ${displayName}`;
  const result = await prepareDemoWorkspace(lessonId, label, tabBudget);
  if (!result.ok) {
    console.warn('[DemoHub] Could not prepare GQL demo workspace:', result.reason);
    return undefined;
  }
  dispatchGqlTabsReload();
  await ctx.waitFor(GQL.TAB_BAR, 5000);
  await ctx.delay(400);
  const session = await loadDemoSession();
  if (session?.demoTabId) {
    await ctx.click(GQL.tab(session.demoTabId));
    await ctx.delay(400);
  }
  return result.demoTabId;
}

export async function closeGqlDemoTabs(
  ctx: DemoActionContext,
  lessonId?: string,
): Promise<void> {
  await closeDemoWorkspace(lessonId);
  dispatchGqlTabsReload();
  await ctx.delay(400);
}

/** Cleanup without DOM interaction — for hub navigation hooks. */
export async function closeGqlDemoWorkspaceQuiet(lessonId?: string): Promise<void> {
  await closeDemoWorkspace(lessonId);
  dispatchGqlTabsReload();
}
