import type { DemoActionContext } from '../../../../types';
import { GQL } from '@shared/selectors';
import {
  ensureGqlDemoEndpointConfigured,
  ensureGqlDemoHeaderContext,
  navigateToGraphqlStudio,
} from '../../../env-manager-lesson-helpers';
import { closeGqlDemoTabs, ensureGqlDemoTab } from '../gql-demo-tab';
import { GQL_HEALTH_QUERY } from './constants';
import { configureDemoTabInheritPageDefault } from './endpoint';
import { fillGqlEditor, fillGqlVariables, getGqlEditorQuery } from './monaco';
import { ensureIntrospected } from './schema';
import {
  gqlLessonSession,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './sessionFlags';
import { seedDemoUsers } from './response';

/**
 * Collapse the GraphQL Studio left activity strip (History / Collections / Mock).
 * Tauri persists the Mock tab — lessons that need the main editor must close it first.
 */
export async function closeGqlActivityPanelIfOpen(ctx: DemoActionContext): Promise<void> {
  const tabs: Array<{ selector: string }> = [
    { selector: GQL.ACTIVITY_MOCK },
    { selector: GQL.ACTIVITY_HISTORY },
    { selector: GQL.ACTIVITY_COLLECTIONS },
  ];
  for (const { selector } of tabs) {
    const btn = document.querySelector<HTMLElement>(selector);
    if (btn?.classList.contains('gql-activity-tab--active')) {
      await ctx.click(selector);
      await ctx.delay(300);
      return;
    }
  }
}

/** Ensure GraphQL editor mode is active. */
export async function ensureEditorMode(ctx: DemoActionContext): Promise<void> {
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.delay(200);
  }
}

/** Ensure editor mode is active and the health query is loaded. */
export async function ensureHealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (gqlLessonSession.queryWritten && current.includes('health')) return;
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  gqlLessonSession.queryWritten = true;
}

/** Ensure a query has been executed and the response panel is populated. */
export async function ensureExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureHealthQuery(ctx);
  if (gqlLessonSession.executed && document.querySelector(GQL.RESPONSE_VIEWER)) return;
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  gqlLessonSession.executed = true;
}

/** Setup for Lesson 1 — reset UI to a clean starting state. */
export async function gqlFirstQuerySetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);
  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(200);
  }
  await ensureGqlDemoTab(ctx, 'gql-first-query', 'Your First GraphQL Query');
  await fillGqlEditor(ctx, 'query { }', { focus: false });
}

/** Cleanup for Lesson 1 — close demo tab and reset session flags. */
export async function gqlFirstQueryCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-first-query');
}

/** Setup for Lesson 2 — EM/header ready quietly, demo tab, seed Alice/Bob. */
export async function gqlVariablesLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  // Prefer header context: skips Environment Manager when GraphQL Demo already exists
  // (typical after GQL-1). Always land back on Studio before live step 1.
  try {
    await ensureGqlDemoHeaderContext(ctx);
  } catch {
    try {
      await ensureGqlDemoEndpointConfigured(ctx);
    } catch {
      // Continue — intro preAction retries via ensureDemoEndpoint.
    }
  }
  await navigateToGraphqlStudio(ctx);
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);
  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(200);
  }
  await ensureGqlDemoTab(ctx, 'gql-variables', 'Variables & Arguments');
  await configureDemoTabInheritPageDefault(ctx);
  gqlLessonSession.endpointSet = true;
  await ctx.delay(200);
  await fillGqlEditor(ctx, 'query { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });
  try {
    await seedDemoUsers();
  } catch {
    // PrerequisiteGate blocks play when Docker is down; seed retries in preAction.
  }
}

/** Cleanup for Lesson 2 — close demo tab and reset session flags. */
export async function gqlVariablesLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-variables');
}
