// ── Lesson 10: Performance Tracing ────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  ensureDemoTabDirectHttpEndpoint,
  ensureEditorMode,
  ensureIntrospectedOnDirectEndpoint,
  fillGqlEditor,
  getDemoUserAId,
  getGqlEditorQuery,
  hasUsableSchemaBadge,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
} from './core';
import { navigateToGraphqlStudio } from '../../env-manager-lesson-helpers';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { closeEnvIfOpen, resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { closeGqlDemoTabs, ensureGqlDemoTab, activateGqlDemoTabQuiet } from './gql-demo-tab';
import { ensureResponseDataOnlyMode } from './response-viewer-mode';
import { spotlightAndPause } from './gql-demo-spotlight';
import { patchDemoTabConnection } from '../../../adapters';

export { spotlightAndPause } from './gql-demo-spotlight';

/** Keep waits well under DEMO_ACTION_TIMEOUT_MS (16s) — Execute remounts the response viewer. */
const TRACE_EXECUTE_WAIT_MS = 4_000;
const TRACE_UI_WAIT_MS = 2_000;
const TRACE_HOLD_MS = 700;
/** Extra histogram executes — wait for the strip itself, not a full tracing recovery chain. */
const HIST_SAMPLE_WAIT_MS = 2_500;

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

let _lesson10Executed = false;
let _lesson10Hovered = false;
let _lesson10Sorted = false;
let _lesson10HistogramReady = false;

export function resetGqlLesson10SessionFlags(): void {
  _lesson10Executed = false;
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

function isTracingExpandedQuery(query: string): boolean {
  return query.includes('user(id:') && query.includes('health');
}

async function ensureTracingStudioReady(ctx: DemoActionContext): Promise<void> {
  // Once the schema badge is green, skip full introspect — runEnsureIntrospected
  // opens the Schema tab and steals focus from Tracing (waterfall timeout / flicker).
  if (hasUsableSchemaBadge()) {
    await ensureEditorMode(ctx);
    return;
  }
  // Direct HTTP — never open Environment Manager during Preparing.
  await ensureIntrospectedOnDirectEndpoint(ctx);
  await ensureEditorMode(ctx);
}

/**
 * Ensure editor mode with introspected schema and the health-only baseline query.
 * @param opts.force — when true, replace an already-expanded query (step 2 reading only).
 *   Without force, never downgrade expanded → health (that flashes the badge ≈1 → ≈6 on Next).
 */
export async function ensureTracingHealthQuery(
  ctx: DemoActionContext,
  opts?: { force?: boolean },
): Promise<void> {
  await ensureTracingStudioReady(ctx);
  const current = getGqlEditorQuery();
  if (current.trim() === GQL_TRACING_HEALTH_QUERY.trim()) {
    await ctx.waitFor(GQL.COMPLEXITY_BADGE, TRACE_UI_WAIT_MS);
    return;
  }
  // Later steps recover via ensureTracingUserQuery → this helper. Do not clobber ≈6 back to ≈1.
  if (!opts?.force && isTracingExpandedQuery(current)) {
    return;
  }
  await fillGqlEditor(ctx, GQL_TRACING_HEALTH_QUERY, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, TRACE_UI_WAIT_MS);
  await ctx.delay(300);
}

/** Ensure the expanded `health` + `user` query is in the editor (complexity badge increases). */
export async function ensureTracingUserQuery(
  ctx: DemoActionContext,
  opts?: { force?: boolean },
): Promise<void> {
  await ensureTracingStudioReady(ctx);
  const userId = getDemoUserAId() || 'usr-1';
  const target = buildTracingUserQuery(userId);
  const current = getGqlEditorQuery();
  if (!opts?.force && isTracingExpandedQuery(current)) {
    return;
  }
  await fillGqlEditor(ctx, target, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, TRACE_UI_WAIT_MS);
  await ctx.delay(300);
}

/** Step 1 reading — health query + complexity badge ready for a steady spotlight. */
export async function prepareGql10ComplexityReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingHealthQuery(ctx);
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, TRACE_UI_WAIT_MS);
}

/** Step 1 action — hold on the complexity badge so the viewer can read ≈N. */
export async function demonstrateGql10Complexity(ctx: DemoActionContext): Promise<void> {
  await ensureTracingHealthQuery(ctx);
  await spotlightAndPause(ctx, GQL.COMPLEXITY_BADGE, TRACE_HOLD_MS);
}

/** Step 2 reading — keep health-only query so the expand action is visible. */
export async function prepareGql10ExpandReading(ctx: DemoActionContext): Promise<void> {
  // Force baseline even if a prior step left the expanded query in the editor.
  await ensureTracingHealthQuery(ctx, { force: true });
  await ctx.waitFor(GQL.EDITOR, TRACE_UI_WAIT_MS);
}

/** Step 2 action — expand query, then hold on the increased complexity badge. */
export async function demonstrateGql10Expand(ctx: DemoActionContext): Promise<void> {
  const before = getComplexityBadgeScore();
  await ensureTracingUserQuery(ctx);
  const after = getComplexityBadgeScore();
  if (after <= before && before > 0) {
    // Force a re-fill so the badge recomputes when the first fill was a no-op.
    await ensureTracingUserQuery(ctx, { force: true });
  }
  await spotlightAndPause(ctx, GQL.COMPLEXITY_BADGE, TRACE_HOLD_MS);
}

/** Step 3 reading — expanded query ready; Execute is the spotlight target. */
export async function prepareGql10ExecuteReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingUserQuery(ctx);
  await ctx.waitFor(GQL.EXECUTE_BTN, TRACE_UI_WAIT_MS);
}

/** Step 3 action — execute, then hold on the Tracing badge (payoff). */
export async function demonstrateGql10Execute(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  await spotlightAndPause(ctx, GQL.RV_TRACING_BADGE, TRACE_HOLD_MS);
}

/** Execute the tracing query and wait for response + tracing badge. */
export async function ensureTracingExecuted(ctx: DemoActionContext): Promise<void> {
  if (_lesson10Executed && document.querySelector(GQL.RV_TRACING_BADGE)) return;
  // Avoid ensureTracingStudioReady/introspect when the expanded query is already loaded.
  if (!isTracingExpandedQuery(getGqlEditorQuery())) {
    await ensureTracingUserQuery(ctx);
  } else {
    await ensureEditorMode(ctx);
  }
  await ctx.click(GQL.EXECUTE_BTN);
  // Prefer the tracing badge — RESPONSE_VIEWER remounts during loading and can stall waitFor.
  await ctx.waitFor(GQL.RV_TRACING_BADGE, TRACE_EXECUTE_WAIT_MS);
  if (!document.querySelector(GQL.RV_TRACING_BADGE)) {
    await ctx.waitFor(GQL.RESPONSE_VIEWER, TRACE_UI_WAIT_MS);
  }
  await ctx.delay(300);
  _lesson10Executed = true;
}

/** Step 4 reading — Tracing badge visible; waterfall opens on the visible click. */
export async function prepareGql10TracingBadgeReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  await ctx.waitFor(GQL.RV_TRACING_BADGE, TRACE_UI_WAIT_MS);
}

/** Step 4 action — open waterfall and hold a steady spotlight on it. */
export async function demonstrateGql10TracingBadge(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  await spotlightAndPause(ctx, GQL.TRACE_VIEW, TRACE_HOLD_MS);
}

/** Open the Apollo Tracing waterfall view in the response viewer. */
export async function ensureTracingViewOpen(ctx: DemoActionContext): Promise<void> {
  // Fast path: waterfall already visible — do not re-introspect or re-execute.
  if (document.querySelector(GQL.TRACE_VIEW)) return;

  // Open existing tracing UI only — never call ensureTracingUserQuery/introspect
  // from later steps (Schema tab focus steal → gql10-sort 16s timeouts).
  if (document.querySelector(GQL.RV_TRACING_BADGE)) {
    await ctx.click(GQL.RV_TRACING_BADGE);
    await ctx.waitFor(GQL.TRACE_VIEW, TRACE_UI_WAIT_MS);
    if (document.querySelector(GQL.TRACE_VIEW)) return;
  }
  if (document.querySelector(GQL.RV_TAB_TRACING)) {
    await ctx.click(GQL.RV_TAB_TRACING);
    await ctx.waitFor(GQL.TRACE_VIEW, TRACE_UI_WAIT_MS);
    if (document.querySelector(GQL.TRACE_VIEW)) return;
  }

  // Last resort: one Execute when response/tracing chrome is gone.
  // Cap tightly — callers in timed actions cannot afford stacked 6s waits.
  if (document.querySelector(GQL.EXECUTE_BTN)) {
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RV_TRACING_BADGE, TRACE_EXECUTE_WAIT_MS);
    if (document.querySelector(GQL.RV_TRACING_BADGE)) {
      await ctx.click(GQL.RV_TRACING_BADGE);
      await ctx.waitFor(GQL.TRACE_VIEW, TRACE_UI_WAIT_MS);
    }
  }
}

/** Step 5 reading — waterfall already open for a stable TRACE_VIEW spotlight. */
export async function prepareGql10WaterfallReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  await ctx.waitFor(GQL.TRACE_VIEW, TRACE_UI_WAIT_MS);
  await ctx.waitFor(GQL.TRACE_RESOLVER_ROW, TRACE_UI_WAIT_MS);
}

/** Step 5 action — hold on the waterfall, then on a resolver row. */
export async function demonstrateGql10Waterfall(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  await spotlightAndPause(ctx, GQL.TRACE_VIEW, TRACE_HOLD_MS);
  await spotlightAndPause(ctx, GQL.TRACE_RESOLVER_ROW, TRACE_HOLD_MS);
}

/** Step 6 reading — resolver rows visible before the hover beat. */
export async function prepareGql10HoverReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  await ctx.waitFor(GQL.TRACE_RESOLVER_ROW, TRACE_UI_WAIT_MS);
}

/** Hover the first resolver row to reveal the duration tooltip on the Gantt bar. */
export async function ensureTracingResolverHovered(ctx: DemoActionContext): Promise<void> {
  // Prep opens the waterfall in preAction — only recover if rows vanished.
  if (!document.querySelector(GQL.TRACE_RESOLVER_ROW)) {
    if (!document.querySelector(GQL.TRACE_VIEW)) {
      await ensureTracingViewOpen(ctx);
    }
    await ctx.waitFor(GQL.TRACE_RESOLVER_ROW, TRACE_UI_WAIT_MS);
  }
  if (_lesson10Hovered) {
    await spotlightAndPause(ctx, GQL.TRACE_RESOLVER_ROW, TRACE_HOLD_MS);
    return;
  }
  const row = document.querySelector<HTMLElement>(GQL.TRACE_RESOLVER_ROW);
  const bar = row?.querySelector<HTMLElement>('.gql-trace-bar');
  if (bar) {
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await ctx.delay(250);
  }
  await spotlightAndPause(ctx, GQL.TRACE_RESOLVER_ROW, TRACE_HOLD_MS);
  _lesson10Hovered = true;
}

/** Step 7 reading — Slowest first control ready (waterfall open). */
export async function prepareGql10SortReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  await ctx.waitFor(GQL.TRACE_SORT_DURATION, TRACE_UI_WAIT_MS);
}

/** Quietly apply Slowest-first sort (no spotlight — for preAction / recovery). */
export async function ensureTracingSortedByDurationQuiet(ctx: DemoActionContext): Promise<void> {
  if (_lesson10Sorted && document.querySelector(GQL.TRACE_SORT_DURATION)) return;
  if (!document.querySelector(GQL.TRACE_SORT_DURATION)) {
    await ensureTracingViewOpen(ctx);
    await ctx.waitFor(GQL.TRACE_SORT_DURATION, TRACE_UI_WAIT_MS);
  }
  if (!document.querySelector(GQL.TRACE_SORT_DURATION)) return;
  if (_lesson10Sorted) return;
  await ctx.click(GQL.TRACE_SORT_DURATION);
  await ctx.delay(250);
  _lesson10Sorted = true;
}

/** Sort resolver rows by duration (slowest first), then hold on the top resolver. */
export async function ensureTracingSortedByDuration(ctx: DemoActionContext): Promise<void> {
  // Prefer the sort control if already visible — avoid any recovery that can reopen Schema.
  if (document.querySelector(GQL.TRACE_SORT_DURATION)) {
    if (!_lesson10Sorted) {
      await ctx.click(GQL.TRACE_SORT_DURATION);
      await ctx.delay(250);
      _lesson10Sorted = true;
    }
  } else {
    await ensureTracingSortedByDurationQuiet(ctx);
  }
  // Payoff: longest-running resolver is now at the top of the list.
  await spotlightAndPause(ctx, GQL.TRACE_RESOLVER_ROW, TRACE_HOLD_MS);
}

/** Step 8 reading — Execute is the target (histogram does not exist yet). */
export async function prepareGql10HistogramReading(ctx: DemoActionContext): Promise<void> {
  await ensureTracingSortedByDurationQuiet(ctx);
  // Uncapped preAction: ensure first sample exists so the timed action only needs ≤2 more.
  if (!_lesson10Executed || !document.querySelector(GQL.RV_TRACING_BADGE)) {
    await ensureTracingExecuted(ctx);
  }
  await ctx.waitFor(GQL.EXECUTE_BTN, TRACE_UI_WAIT_MS);
}

/** Run additional executions until the latency histogram strip appears (≥2 samples). */
export async function ensureLatencyHistogramVisible(ctx: DemoActionContext): Promise<void> {
  if (_lesson10HistogramReady && document.querySelector(GQL.HISTOGRAM_STRIP)) {
    await spotlightAndPause(ctx, GQL.HISTOGRAM_STRIP, TRACE_HOLD_MS);
    return;
  }
  if (document.querySelector(GQL.HISTOGRAM_STRIP)) {
    await spotlightAndPause(ctx, GQL.HISTOGRAM_STRIP, TRACE_HOLD_MS);
    _lesson10HistogramReady = true;
    return;
  }

  // Timed action: click Execute up to twice and wait for the strip directly.
  // Do NOT call ensureTracingExecuted / stacked badge+viewer waits (was >16s).
  let attempts = 0;
  while (!document.querySelector(GQL.HISTOGRAM_STRIP) && attempts < 2) {
    if (!document.querySelector(GQL.EXECUTE_BTN)) break;
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.HISTOGRAM_STRIP, HIST_SAMPLE_WAIT_MS);
    if (document.querySelector(GQL.HISTOGRAM_STRIP)) break;
    await ctx.delay(300);
    attempts++;
  }

  if (document.querySelector(GQL.HISTOGRAM_STRIP)) {
    await spotlightAndPause(ctx, GQL.HISTOGRAM_STRIP, TRACE_HOLD_MS);
    _lesson10HistogramReady = true;
  }
}

/**
 * Setup for Lesson 10 (GQL-11) — demo tab + direct HTTP.
 * Never open Environment Manager or the GraphQL Env modal.
 */
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

  await navigateToGraphqlStudio(ctx);
  await ensureResponseDataOnlyMode(ctx, false);
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
  await patchDemoTabConnection({
    endpoint: GQL_DEMO_HTTP,
    skipTlsVerify: undefined,
    tlsCaCert: undefined,
    tlsClientCert: undefined,
    tlsClientKey: undefined,
  });
  await activateGqlDemoTabQuiet(ctx);
  await ensureDemoTabDirectHttpEndpoint(ctx);
  await closeEnvIfOpen(ctx);

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

