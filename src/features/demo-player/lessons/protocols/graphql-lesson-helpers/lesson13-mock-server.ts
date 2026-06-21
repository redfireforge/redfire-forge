// ── Lesson 13: Mock Server ───────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  getEndpointInput,
  getGqlEditorQuery,
  responseBodyText,
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

/** Desktop mock endpoint proxied by the Tauri app. */
export const GQL_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
/** Fixed resolver value used in the lesson so restore-vs-live is obvious. */
export const LESSON13_HEALTH_OVERRIDE = 'mock-ok';

let _lesson13MockOpen = false;
let _lesson13MockEnabled = false;
let _lesson13MockIntrospected = false;
let _lesson13OverrideSet = false;
let _lesson13Executed = false;
let _lesson13LatencySet = false;
let _lesson13Restored = false;

export function resetGqlLesson13SessionFlags(): void {
  _lesson13MockOpen = false;
  _lesson13MockEnabled = false;
  _lesson13MockIntrospected = false;
  _lesson13OverrideSet = false;
  _lesson13Executed = false;
  _lesson13LatencySet = false;
  _lesson13Restored = false;
}

function mockToggleChecked(): boolean {
  return document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)?.checked ?? false;
}

function responseLatencyMs(): number {
  const text = document.querySelector(GQL.RESPONSE_LATENCY)?.textContent ?? '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function findMockTypeGroup(typeName: string): HTMLElement | null {
  const groups = document.querySelectorAll<HTMLElement>(GQL.MOCK_TYPE_GROUP);
  for (const group of groups) {
    const header = group.querySelector<HTMLElement>(GQL.MOCK_TYPE_HEADER);
    if (header?.textContent?.includes(typeName)) return group;
  }
  return null;
}

function findMockFieldRow(typeName: string, fieldName: string): HTMLElement | null {
  const group = findMockTypeGroup(typeName);
  if (!group) return null;
  const rows = group.querySelectorAll<HTMLElement>(GQL.MOCK_FIELD_ROW);
  for (const row of rows) {
    if (row.textContent?.includes(fieldName)) return row;
  }
  return null;
}

/** Open the Mock activity panel. Desktop only; web shows a guard banner. */
export async function ensureLesson13MockPanelOpen(ctx: DemoActionContext): Promise<void> {
  if (_lesson13MockOpen && (document.querySelector(GQL.MOCK_PANEL) || document.querySelector(GQL.MOCK_GUARD))) {
    return;
  }
  await ctx.click(GQL.ACTIVITY_MOCK);
  await ctx.waitFor(`${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`, 5000);
  await ctx.delay(700);
  _lesson13MockOpen = true;
}

/** Enable mock mode using the current introspected Docker SDL as the source schema. */
export async function ensureLesson13MockEnabled(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  if (_lesson13MockEnabled && mockToggleChecked()) return;
  await ctx.waitFor(GQL.MOCK_TOGGLE, 5000);
  if (!mockToggleChecked()) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }
  _lesson13MockEnabled = true;
}

/** Switch the connection bar to the mock URL and introspect the mock endpoint. */
export async function ensureLesson13MockEndpointIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEnabled(ctx);
  if (_lesson13MockIntrospected && (getEndpointInput()?.value ?? '').trim() === GQL_MOCK_HTTP) return;
  await ctx.fill(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
  await ctx.delay(500);
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await ctx.delay(800);
  _lesson13MockIntrospected = true;
}

/** Expand `Query`, set `health` resolver to Fixed, and store `"mock-ok"` as the value. */
export async function ensureLesson13HealthOverrideConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  await ensureLesson13MockEnabled(ctx);
  if (_lesson13OverrideSet) return;

  const queryGroup = findMockTypeGroup('Query');
  if (queryGroup) {
    queryGroup.setAttribute('data-lesson-target', 'mock-query');
    const existingRow = findMockFieldRow('Query', 'health');
    if (!existingRow) {
      await ctx.click('[data-lesson-target="mock-query"] [data-testid="gql-mock-type-header"]');
      await ctx.delay(700);
    }
  }

  const healthRow = findMockFieldRow('Query', 'health');
  if (healthRow) {
    healthRow.setAttribute('data-lesson-target', 'mock-health');
    await ctx.selectOption('[data-lesson-target="mock-health"] [data-testid="gql-mock-resolver-select"]', 'fixed');
    await ctx.waitFor('[data-lesson-target="mock-health"] [data-testid="gql-mock-fixed-input"]', 5000);
    await ctx.fill('[data-lesson-target="mock-health"] [data-testid="gql-mock-fixed-input"]', `"${LESSON13_HEALTH_OVERRIDE}"`);
    const input = healthRow.querySelector<HTMLInputElement>(GQL.MOCK_FIXED_INPUT);
    input?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await ctx.delay(800);
  }

  _lesson13OverrideSet = true;
}

/** Execute `query { health }` against the mock endpoint and verify the overridden value. */
export async function ensureLesson13MockExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEndpointIntrospected(ctx);
  await ensureLesson13HealthOverrideConfigured(ctx);
  const current = getGqlEditorQuery();
  if (!_lesson13Executed || !responseBodyText().includes(LESSON13_HEALTH_OVERRIDE) || current.trim() !== GQL_HEALTH_QUERY.trim()) {
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(800);
  }
  _lesson13Executed = true;
}

/** Raise mock latency, re-run, and wait for the response metadata latency to reflect the delay. */
export async function ensureLesson13LatencyDemo(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (_lesson13LatencySet && responseLatencyMs() >= 500) return;

  const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER);
  if (slider) {
    slider.value = '650';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(700);
  }

  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(800);
  _lesson13LatencySet = true;
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13MockDisabledAndRestored(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencyDemo(ctx);
  if (_lesson13Restored && responseBodyText().includes('"ok"')) return;

  await ensureLesson13MockPanelOpen(ctx);
  if (mockToggleChecked()) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }

  await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await ctx.delay(500);
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(800);
  _lesson13Restored = true;
}

/** Setup for Lesson 13 — start from the live Docker endpoint with a fresh GraphQL studio state. */
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
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 13 — disable mock if needed and restore the live endpoint. */
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
  const input = getEndpointInput();
  if (input && input.value.trim() !== GQL_DEMO_HTTP) {
    await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
    await ctx.delay(200);
  }
  resetGqlLesson13SessionFlags();
  await ctx.delay(100);
}
