// ── Lesson 15: Batch Execution ───────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  GQL_HEALTH_QUERY,
  clearActiveTabEndpointOverride,
  configureDemoTabInheritPageDefault,
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
import { resetGqlLesson13SessionFlags } from './lesson13-mock-server';
import { resetGqlLesson14SessionFlags } from './lesson14-multi-tab';
import { openHistoryPanel } from './lesson8-collections-history';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

const GQL15_LESSON_ID = 'gql-batch-execution';

/** Demo-only tabs for GQL-15. */
const GQL15_DEMO_TAB_SELECTOR = `${GQL.TAB_BAR} [role="tab"][data-demo-lesson="${GQL15_LESSON_ID}"]`;

/** A second query written on Tab 2 — different operation name to distinguish cards. */
export const LESSON15_TAB2_QUERY = 'query CheckHealth { health }';
/** Query that intentionally fails schema validation — used for partial-error demonstration. */
export const LESSON15_ERROR_QUERY = 'query BadField { nonexistent }';

let _lesson15BatchEnabled = false;
let _lesson15Tab2Added = false;
let _lesson15BothChecked = false;
let _lesson15QueriesWritten = false;
let _lesson15Executed = false;
let _lesson15PartialError = false;

export function resetGqlLesson15SessionFlags(): void {
  _lesson15BatchEnabled = false;
  _lesson15Tab2Added = false;
  _lesson15BothChecked = false;
  _lesson15QueriesWritten = false;
  _lesson15Executed = false;
  _lesson15PartialError = false;
}

/** True when batch mode is active in the studio (chip or open modal toggle). */
function isBatchModeEnabledInStudio(): boolean {
  if (document.querySelector(GQL.BATCH_SUMMARY_CHIP)) return true;
  const toggle = document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE);
  return toggle?.checked ?? false;
}

/** Demo tab ids from the tab bar (`gql-tab-{id}`). */
function getDemoTabIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR))
    .map((el) => el.getAttribute('data-testid')?.replace('gql-tab-', '') ?? '')
    .filter(Boolean);
}

/** Count demo workspace tabs for GQL-15. */
function getDemoTabCount(): number {
  return document.querySelectorAll(GQL15_DEMO_TAB_SELECTOR).length;
}

/** Both demo tabs show the read-only **B** inclusion badge on the tab bar. */
function bothDemoTabsBatched(): boolean {
  const ids = getDemoTabIds();
  return ids.length >= 2 && ids.every((id) => !!document.querySelector(`[data-testid="gql-tab-batch-badge-${id}"]`));
}

/** Activate the Nth demo tab (0-based) for GQL-15. */
async function activateDemoTabByIndex(ctx: DemoActionContext, index: number): Promise<void> {
  const tab = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR)[index];
  if (!tab) return;
  const attr = `gql15-demo-tab-${index}`;
  tab.setAttribute('data-lesson-target', attr);
  await ctx.click(`[data-lesson-target="${attr}"]`);
  await ctx.delay(800);
}

/** Both demo tabs must inherit the page default — no per-tab overrides (batch parity). */
async function ensureDemoTabsInheritPageEndpoint(ctx: DemoActionContext): Promise<void> {
  const count = getDemoTabCount();
  for (let i = 0; i < count; i++) {
    await activateDemoTabByIndex(ctx, i);
    await clearActiveTabEndpointOverride(ctx);
  }
}

/** True when the batch results panel is present in the DOM. */
function batchResultsVisible(): boolean {
  return !!document.querySelector(GQL.BATCH_RESULTS);
}

/** Open Advanced Settings on the Batch tab (modal must be closed first). */
async function openAdvancedSettingsBatchTab(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ADV_SETTINGS_TAB_BATCH)) {
    await ctx.click(GQL.ADV_SETTINGS_BTN);
    await ctx.waitFor(GQL.ADV_SETTINGS_TAB_BATCH, 5000);
    await ctx.delay(600);
  }

  const batchTab = document.querySelector<HTMLElement>(GQL.ADV_SETTINGS_TAB_BATCH);
  if (!batchTab) {
    const settingsTabs = document.querySelectorAll<HTMLElement>('.gql-advsettings-tab');
    for (const tab of settingsTabs) {
      if (tab.textContent?.trim() === 'Batch') {
        tab.setAttribute('data-lesson-target', 'gql15-settings-batch-tab');
        await ctx.click('[data-lesson-target="gql15-settings-batch-tab"]');
        await ctx.delay(400);
        break;
      }
    }
  } else if (!batchTab.classList.contains('active')) {
    await ctx.click(GQL.ADV_SETTINGS_TAB_BATCH);
    await ctx.delay(500);
  }
}

async function saveAdvancedSettings(ctx: DemoActionContext): Promise<void> {
  const saveBtn = document.querySelector<HTMLElement>(GQL.ADV_SETTINGS_SAVE_BTN);
  if (saveBtn) {
    await ctx.click(GQL.ADV_SETTINGS_SAVE_BTN);
    await ctx.delay(700);
  }
}

/** Click the visible Enable query batching row (hidden checkbox is 0×0 — ctx.click skips it). */
async function clickAdvBatchEnableToggle(ctx: DemoActionContext): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE);
  if (!input || input.checked) return;
  await ctx.waitFor(GQL.ADV_BATCH_ENABLE_TOGGLE, 5000);
  await ctx.click(GQL.ADV_BATCH_ENABLE_TOGGLE);
  await ctx.delay(600);
}

/** Click the visible batch-inclusion row for a tab (hidden checkbox is 0×0). */
async function clickAdvBatchTabInclusion(ctx: DemoActionContext, tabId: string): Promise<void> {
  const cb = document.querySelector<HTMLInputElement>(GQL.advBatchTabCb(tabId));
  if (!cb || cb.checked) return;
  await ctx.click(GQL.advBatchTabLabel(tabId));
  await ctx.delay(400);
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/**
 * Guard: Batch mode is enabled in Advanced Settings.
 */
export async function ensureLesson15BatchEnabled(ctx: DemoActionContext): Promise<void> {
  if (_lesson15BatchEnabled && isBatchModeEnabledInStudio()) return;

  await openAdvancedSettingsBatchTab(ctx);

  await clickAdvBatchEnableToggle(ctx);

  await saveAdvancedSettings(ctx);
  await ctx.waitFor(GQL.BATCH_SUMMARY_CHIP, 5000);
  _lesson15BatchEnabled = true;
}

/**
 * Guard: Two workspace tabs exist, both using the same endpoint ({{graphqlUrl}}).
 */
export async function ensureLesson15TwoTabsSameEndpoint(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BatchEnabled(ctx);
  if (_lesson15Tab2Added && getDemoTabCount() >= 2) return;

  await activateDemoTabByIndex(ctx, 0);
  const endpointInput = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT);
  if (endpointInput && (endpointInput.value ?? '').trim() === '') {
    await configureDemoTabInheritPageDefault(ctx);
  }

  if (getDemoTabCount() < 2) {
    await ctx.click(GQL.TAB_ADD_BTN);
    await ctx.waitFor(GQL15_DEMO_TAB_SELECTOR, 5000);
    await ctx.delay(500);
  }

  await ensureDemoTabsInheritPageEndpoint(ctx);
  _lesson15Tab2Added = true;
}

/**
 * Guard: Both demo tabs are checked in Advanced Settings → Batch operation table.
 */
export async function ensureLesson15BothTabsChecked(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);
  if (_lesson15BothChecked && bothDemoTabsBatched()) return;

  await openAdvancedSettingsBatchTab(ctx);

  await clickAdvBatchEnableToggle(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);

  for (const tabId of getDemoTabIds()) {
    await clickAdvBatchTabInclusion(ctx, tabId);
  }

  await saveAdvancedSettings(ctx);
  _lesson15BothChecked = true;
}

/**
 * Guard: Both tabs have the health query written and the Send Batch button is present.
 */
export async function ensureLesson15ReadyToExecute(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BothTabsChecked(ctx);
  if (_lesson15QueriesWritten) return;

  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);

  const tab0 = tabs[0];
  if (tab0) {
    tab0.setAttribute('data-lesson-target', 'gql15-batch-tab-0');
    await ctx.click('[data-lesson-target="gql15-batch-tab-0"]');
    await ctx.delay(500);
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    await ctx.delay(400);
  }

  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-batch-tab-1');
    await ctx.click('[data-lesson-target="gql15-batch-tab-1"]');
    await ctx.delay(500);
    await fillGqlEditor(ctx, LESSON15_TAB2_QUERY, { focus: false });
    await ctx.delay(400);
  }

  _lesson15QueriesWritten = true;
}

/**
 * Guard: Batch execution has been run at least once and results are in the DOM.
 */
export async function ensureLesson15Executed(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15ReadyToExecute(ctx);
  if (_lesson15Executed && batchResultsVisible()) return;

  await ctx.click(GQL.BATCH_EXECUTE_BTN);
  await ctx.waitFor(GQL.BATCH_RESULTS, 15000);
  await ctx.delay(800);
  _lesson15Executed = true;
}

/**
 * Guard: Tab 2 has the error query written and a fresh batch has been executed.
 */
export async function ensureLesson15PartialErrorExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  if (_lesson15PartialError) return;

  await runPartialErrorBatch(ctx);
  _lesson15PartialError = true;
}

async function runPartialErrorBatch(ctx: DemoActionContext): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);
  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-error-tab');
    await ctx.click('[data-lesson-target="gql15-error-tab"]');
    await ctx.delay(800);
    await fillGqlEditor(ctx, LESSON15_ERROR_QUERY, { focus: false });
    await ctx.delay(500);
  }

  await ctx.click(GQL.BATCH_EXECUTE_BTN);
  await ctx.waitFor(GQL.BATCH_RESULTS, 15000);
  await ctx.delay(800);
}

// ── Visible lesson actions (human-paced) ──────────────────────────────────────

/** Step action: enable batch mode via Advanced Settings (visible gear → Batch → Save). */
export async function demonstrateLesson15EnableBatch(ctx: DemoActionContext): Promise<void> {
  if (_lesson15BatchEnabled && isBatchModeEnabledInStudio()) {
    await ctx.delay(1500);
    return;
  }

  await ctx.click(GQL.ADV_SETTINGS_BTN);
  await ctx.waitFor(GQL.ADV_SETTINGS_TAB_BATCH, 5000);
  await ctx.delay(1000);

  await ctx.click(GQL.ADV_SETTINGS_TAB_BATCH);
  await ctx.waitFor(GQL.ADV_BATCH_ENABLE_TOGGLE, 5000);
  await ctx.delay(1000);

  await clickAdvBatchEnableToggle(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);
  await ctx.delay(2000);

  await saveAdvancedSettings(ctx);
  await ctx.waitFor(GQL.BATCH_SUMMARY_CHIP, 5000);
  await ctx.delay(1200);
  _lesson15BatchEnabled = true;
}

/** Step action: add the second demo tab with the + button. */
export async function demonstrateLesson15AddSecondTab(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BatchEnabled(ctx);

  if (getDemoTabCount() >= 2) {
    await ctx.delay(900);
    return;
  }

  await ctx.click(GQL.TAB_ADD_BTN);
  await ctx.waitFor(GQL15_DEMO_TAB_SELECTOR, 5000);
  await ctx.delay(800);
  await ensureDemoTabsInheritPageEndpoint(ctx);
  _lesson15Tab2Added = true;
}

/** Step action: check both operations in Advanced Settings → Batch table, then Save. */
export async function demonstrateLesson15SelectBatchTabs(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);

  if (_lesson15BothChecked && bothDemoTabsBatched()) {
    await ctx.delay(900);
    return;
  }

  await openAdvancedSettingsBatchTab(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);
  await ctx.delay(600);

  for (const tabId of getDemoTabIds()) {
    await clickAdvBatchTabInclusion(ctx, tabId);
  }

  await saveAdvancedSettings(ctx);
  _lesson15BothChecked = true;
}

/** Step action: write distinct queries on Tab 1 and Tab 2. */
export async function demonstrateLesson15WriteQueries(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BothTabsChecked(ctx);

  if (_lesson15QueriesWritten) {
    await ctx.delay(900);
    return;
  }

  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);

  const tab0 = tabs[0];
  if (tab0) {
    tab0.setAttribute('data-lesson-target', 'gql15-write-tab-0');
    await ctx.click('[data-lesson-target="gql15-write-tab-0"]');
    await ctx.waitFor(GQL.EDITOR, 5000);
    await ctx.delay(600);
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: true });
    await ctx.delay(500);
  }

  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-write-tab-1');
    await ctx.click('[data-lesson-target="gql15-write-tab-1"]');
    await ctx.waitFor(GQL.EDITOR, 5000);
    await ctx.delay(600);
    await fillGqlEditor(ctx, LESSON15_TAB2_QUERY, { focus: true });
    await ctx.delay(500);
  }

  _lesson15QueriesWritten = true;
}

/** Step action: inject a schema error on Tab 2 and re-run the batch. */
export async function demonstrateLesson15PartialError(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);

  if (_lesson15PartialError) {
    await ctx.delay(1000);
    return;
  }

  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);
  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-partial-error-tab');
    await ctx.click('[data-lesson-target="gql15-partial-error-tab"]');
    await ctx.waitFor(GQL.EDITOR, 5000);
    await ctx.delay(800);
    await fillGqlEditor(ctx, LESSON15_ERROR_QUERY, { focus: true });
    await ctx.delay(700);
  }

  await ctx.click(GQL.BATCH_EXECUTE_BTN);
  await ctx.waitFor(GQL.BATCH_RESULTS, 15000);
  await ctx.delay(1000);
  _lesson15PartialError = true;
}

/** Step action: open History sidebar for CI export narration. */
export async function demonstrateLesson15OpenHistory(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15PartialErrorExecuted(ctx);
  await openHistoryPanel(ctx);
  await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
  await ctx.delay(1000);
}

// ── Setup / cleanup ───────────────────────────────────────────────────────────

/** Batch lesson setup (GQL-15) — demo tab with tabBudget 2. */
export async function gqlBatchLessonSetup(ctx: DemoActionContext): Promise<void> {
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
  resetGqlLesson14SessionFlags();
  resetGqlLesson15SessionFlags();

  await ensureEditorMode(ctx);
  await ensureGqlDemoTab(ctx, GQL15_LESSON_ID, 'Batch Execution', 2);
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
}

/** Batch lesson cleanup (GQL-15) — close all demo tabs. */
export async function gqlBatchLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson15SessionFlags();
  await closeGqlDemoTabs(ctx, GQL15_LESSON_ID);
}

export { GQL_DEMO_HTTP, GQL_DEMO_VAR };
