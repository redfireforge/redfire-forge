// ── Lesson 13: Mock Server ───────────────────────────────────────────────────
export * from './lesson13-mock-server-constants';
export * from './lesson13-mock-server-session';
export * from './lesson13-mock-server-actions';

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_HEALTH_QUERY,
  closeGqlActivityPanelIfOpen,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { resetGqlLesson10SessionFlags } from './lesson10-performance-tracing';
import { resetGqlLesson11SessionFlags } from './lesson11-workflow-integration';
import { resetGqlLesson12SessionFlags } from './lesson12-schema-diff';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import { resetGqlLesson13SessionFlags, mockToggleChecked } from './lesson13-mock-server-session';
import { ensureLesson13MockPanelOpen } from './lesson13-mock-server-actions';

/** Setup for Lesson 13 (GQL-13) — demo tab with live Docker endpoint and health query. */
export async function gqlMockServerLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();
  resetGqlLesson11SessionFlags();
  resetGqlLesson12SessionFlags();
  resetGqlLesson13SessionFlags();

  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }
  await ensureGqlDemoTab(ctx, 'gql-mock-server', 'Mock Server');
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 13 (GQL-13) — disable mock on demo tab, then close it. */
export async function gqlMockServerLessonCleanup(ctx: DemoActionContext): Promise<void> {
  try {
    if (document.querySelector(GQL.ACTIVITY_MOCK)) {
      await ensureLesson13MockPanelOpen(ctx);
      if (mockToggleChecked()) {
        await ctx.click(GQL.MOCK_TOGGLE);
        await ctx.delay(300);
      }
    }
  } catch {
    // Non-fatal in tests or if the panel is unavailable.
  }
  try {
    await closeGqlActivityPanelIfOpen(ctx);
  } catch {
    // Non-fatal when the activity strip is unavailable.
  }
  resetGqlLesson13SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-mock-server');
}
