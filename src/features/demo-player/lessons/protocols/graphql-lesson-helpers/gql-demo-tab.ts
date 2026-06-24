/** Demo Hub ↔ GraphQL Studio tab bridge (§11.0). */
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  closeDemoWorkspace,
  dispatchGqlTabsReload,
  loadDemoSession,
  prepareDemoWorkspace,
} from '../../../adapters';

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
  const session = await loadDemoSession();
  if (session?.demoTabId) {
    await ctx.waitFor(GQL.tab(session.demoTabId), 10_000);
    await ctx.click(GQL.tab(session.demoTabId));
    await ctx.delay(400);
  } else {
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

/** Select the demo tab when a demo session is active (quiet — no ripple). */
export async function activateGqlDemoTabQuiet(ctx: DemoActionContext): Promise<void> {
  const session = await loadDemoSession();
  if (!session?.demoTabId) return;
  await ctx.waitFor(GQL.TAB_BAR, 5000);
  const tabSel = GQL.tab(session.demoTabId);
  await ctx.waitFor(tabSel, 10_000);
  const tabEl = document.querySelector(tabSel);
  if (tabEl?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(tabSel);
    await ctx.delay(500);
  }
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
}

/** Cleanup without DOM interaction — for hub navigation hooks. */
export async function closeGqlDemoWorkspaceQuiet(lessonId?: string): Promise<void> {
  await closeDemoWorkspace(lessonId);
  dispatchGqlTabsReload();
}
