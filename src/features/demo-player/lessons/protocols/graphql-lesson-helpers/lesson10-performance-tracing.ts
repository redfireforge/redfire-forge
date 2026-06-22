// ── Lesson 10: Performance Tracing ────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_HEALTH_QUERY,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  getDemoUserAId,
  getGqlEditorQuery,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

/** Query with `health` only — low complexity baseline for Lesson 10. */
export const GQL_TRACING_HEALTH_QUERY = GQL_HEALTH_QUERY;

/** Build tracing demo query with `health` + `user(id: …)` for complexity + resolver traces. */
export function buildTracingUserQuery(userId = 'usr-1'): string {
  return `query {
  health
  user(id: "${userId}") {
    id
    name
    email
  }
}`;
}

let _lesson10HealthQuery = false;
let _lesson10UserQuery = false;
let _lesson10Executed = false;
let _lesson10TracingOpen = false;
let _lesson10Hovered = false;
let _lesson10Sorted = false;
let _lesson10HistogramReady = false;

export function resetGqlLesson10SessionFlags(): void {
  _lesson10HealthQuery = false;
  _lesson10UserQuery = false;
  _lesson10Executed = false;
  _lesson10TracingOpen = false;
  _lesson10Hovered = false;
  _lesson10Sorted = false;
  _lesson10HistogramReady = false;
}

/** Parse the `≈N` complexity badge text into a number. */
export function getComplexityBadgeScore(): number {
  const el = document.querySelector(GQL.COMPLEXITY_BADGE);
  if (!el) return 0;
  const m = el.textContent?.match(/[≈~]?(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** Ensure editor mode with introspected schema and the health-only baseline query. */
export async function ensureTracingHealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (_lesson10HealthQuery && current.trim() === GQL_TRACING_HEALTH_QUERY.trim()) {
    await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
    return;
  }
  await fillGqlEditor(ctx, GQL_TRACING_HEALTH_QUERY, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
  await ctx.delay(400);
  _lesson10HealthQuery = true;
}

/** Ensure the expanded `health` + `user` query is in the editor (complexity badge increases). */
export async function ensureTracingUserQuery(ctx: DemoActionContext): Promise<void> {
  await ensureTracingHealthQuery(ctx);
  const userId = getDemoUserAId() || 'usr-1';
  const target = buildTracingUserQuery(userId);
  const current = getGqlEditorQuery();
  if (_lesson10UserQuery && current.includes('user(id:') && current.includes('health')) return;
  await fillGqlEditor(ctx, target, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
  await ctx.delay(400);
  _lesson10UserQuery = true;
}

/** Execute the tracing query and wait for response + tracing badge. */
export async function ensureTracingExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureTracingUserQuery(ctx);
  if (_lesson10Executed && document.querySelector(GQL.RV_TRACING_BADGE)) return;
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.waitFor(GQL.RV_TRACING_BADGE, 15000);
  await ctx.delay(500);
  _lesson10Executed = true;
}

/** Open the Apollo Tracing waterfall view in the response viewer. */
export async function ensureTracingViewOpen(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  if (_lesson10TracingOpen && document.querySelector(GQL.TRACE_VIEW)) return;
  const badge = document.querySelector<HTMLElement>(GQL.RV_TRACING_BADGE);
  if (badge) {
    await ctx.click(GQL.RV_TRACING_BADGE);
  } else {
    await ctx.click(GQL.RV_TAB_TRACING);
  }
  await ctx.waitFor(GQL.TRACE_VIEW, 5000);
  await ctx.delay(800);
  _lesson10TracingOpen = true;
}

/** Hover the first resolver row to reveal the duration tooltip on the Gantt bar. */
export async function ensureTracingResolverHovered(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  if (_lesson10Hovered) return;
  const row = document.querySelector<HTMLElement>(GQL.TRACE_RESOLVER_ROW);
  const bar = row?.querySelector<HTMLElement>('.gql-trace-bar');
  if (bar) {
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await ctx.delay(800);
  }
  _lesson10Hovered = true;
}

/** Sort resolver rows by duration (slowest first). */
export async function ensureTracingSortedByDuration(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  if (_lesson10Sorted) return;
  await ctx.click(GQL.TRACE_SORT_DURATION);
  await ctx.delay(800);
  _lesson10Sorted = true;
}

/** Run additional executions until the latency histogram strip appears (≥2 samples). */
export async function ensureLatencyHistogramVisible(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  if (_lesson10HistogramReady && document.querySelector(GQL.HISTOGRAM_STRIP)) return;

  let attempts = 0;
  while (!document.querySelector(GQL.HISTOGRAM_STRIP) && attempts < 3) {
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(500);
    attempts++;
  }
  await ctx.waitFor(GQL.HISTOGRAM_STRIP, 5000);
  await ctx.delay(800);
  _lesson10HistogramReady = true;
}

/** Setup for Lesson 10 (GQL-11) — demo tab; seed demo user for `user(id: …)` arg. */
export async function gqlPerformanceTracingLessonSetup(ctx: DemoActionContext): Promise<void> {
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

  await ensureEditorMode(ctx);

  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.HISTORY_PANEL)) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.COLLECTIONS_PANEL)) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.delay(200);
  }

  await ensureGqlDemoTab(ctx, 'gql-performance-tracing', 'Performance Tracing');
  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — tracing query uses usr-1 fallback
  }
}

/** Cleanup for Lesson 10 (GQL-11) — close demo tab and reset session flags. */
export async function gqlPerformanceTracingLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson10SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-performance-tracing');
}

