// ── Lesson 15: Batch Execution ───────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  clearActiveTabEndpointOverride,
  closeGqlActivityPanelIfOpen,
  configureDemoTabEndpointOverride,
  ensureEditorMode,
  ensureGqlDemoPageDefaultEndpoint,
  fillGqlEditor,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { ensureGqlDemoHeaderContext, navigateToGraphqlStudio } from '../../env-manager-lesson-helpers';
import { patchDemoTabConnection, patchDemoTabConnectionById, resetGqlDemoBatchDetection } from '../../../adapters';
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

/** Tab 1 query — named operation so batch result cards are easy to tell apart. */
export const LESSON15_TAB1_QUERY = 'query GetHealth { health }';
/** A second query written on Tab 2 — different operation name to distinguish cards. */
export const LESSON15_TAB2_QUERY = 'query CheckHealth { health }';
/** Tab 2 direct URL — resolves to the same server as Tab 1's `{{graphqlUrl}}`. */
export const LESSON15_TAB2_ENDPOINT = GQL_DEMO_HTTP;
/** Query that intentionally fails schema validation — used for partial-error demonstration. */
export const LESSON15_ERROR_QUERY = 'query BadField { nonexistent }';

let _lesson15BatchEnabled = false;
let _lesson15Tab2Added = false;
let _lesson15EndpointParityDone = false;
let _lesson15BothChecked = false;
let _lesson15QueriesWritten = false;
let _lesson15Executed = false;
let _lesson15PartialError = false;

export function resetGqlLesson15SessionFlags(): void {
  _lesson15BatchEnabled = false;
  _lesson15Tab2Added = false;
  _lesson15EndpointParityDone = false;
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

/** Return persisted demo tab id for the Nth GQL-15 tab (0-based). */
function getDemoTabIdByIndex(index: number): string | null {
  const el = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR)[index];
  const testId = el?.getAttribute('data-testid') ?? '';
  const prefix = 'gql-tab-';
  return testId.startsWith(prefix) ? testId.slice(prefix.length) : null;
}

/** Tab 1 inherits page default `{{graphqlUrl}}` (no per-tab override). */
async function ensureLesson15Tab1PageDefault(ctx: DemoActionContext): Promise<void> {
  await ensureGqlDemoPageDefaultEndpoint(ctx);
  await activateDemoTabByIndex(ctx, 0);
  await clearActiveTabEndpointOverride(ctx);
  const tabId = getDemoTabIdByIndex(0);
  if (tabId) await patchDemoTabConnectionById(tabId, { endpoint: undefined });
  await patchDemoTabConnection({ endpoint: undefined });
}

/** Tab 2 per-tab override — literal localhost URL (same resolved server as Tab 1). */
async function ensureLesson15Tab2DirectEndpoint(ctx: DemoActionContext): Promise<void> {
  if (getDemoTabCount() < 2) return;
  await activateDemoTabByIndex(ctx, 1);
  await configureDemoTabEndpointOverride(ctx, LESSON15_TAB2_ENDPOINT);
  const tabId = getDemoTabIdByIndex(1);
  if (tabId) await patchDemoTabConnectionById(tabId, { endpoint: LESSON15_TAB2_ENDPOINT });
}

/**
 * Guard: Tab 1 = `{{graphqlUrl}}`, Tab 2 = direct localhost — same **resolved** endpoint for batch.
 * Seeds Demo env/svc first so `{{graphqlUrl}}` resolves (otherwise tabs split into two groups).
 */
async function ensureLesson15BatchEndpointParity(ctx: DemoActionContext): Promise<void> {
  if (_lesson15EndpointParityDone) return;
  await ensureGqlDemoHeaderContext(ctx);
  await ensureLesson15Tab1PageDefault(ctx);
  await ensureLesson15Tab2DirectEndpoint(ctx);
  // Prefer Tab 1 active so Advanced Settings opens on the shared endpoint group.
  await activateDemoTabByIndex(ctx, 0);
  _lesson15EndpointParityDone = true;
}

/** True when batch results or per-tab slice evidence is already in the UI. */
function markLesson15ExecutedIfEvidencePresent(): boolean {
  if (_lesson15Executed) return true;
  if (batchResultsVisible() || document.querySelector(GQL.RESPONSE_BATCH_BANNER)) {
    _lesson15Executed = true;
    return true;
  }
  return false;
}

/** Ensure the Response right-pane tab is active (batch slices live there). */
async function ensureResponsePaneVisible(ctx: DemoActionContext): Promise<void> {
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(800);
  }
}

/** True when the batch results panel is present in the DOM. */
function batchResultsVisible(): boolean {
  return !!document.querySelector(GQL.BATCH_RESULTS);
}

/** True when a partial-error batch result is already visible. */
function markLesson15PartialErrorIfEvidencePresent(): boolean {
  if (_lesson15PartialError) return true;
  if (document.querySelector(GQL.BATCH_RESULTS_FAILED_PILL)) {
    _lesson15PartialError = true;
    return true;
  }
  return false;
}

/** Dismiss Advanced Settings when still open (reading prep can leave it up). */
async function closeAdvancedSettingsIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ADV_SETTINGS_MODAL)) return;
  const cancelBtn = document.querySelector<HTMLElement>(GQL.ADV_SETTINGS_CANCEL_BTN);
  if (cancelBtn) {
    await ctx.click(GQL.ADV_SETTINGS_CANCEL_BTN);
    await ctx.delay(600);
    return;
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await ctx.delay(600);
}

/** Re-open the batch modal after dismiss so verify selectors still match on replay. */
async function reopenBatchResultsIfDismissed(ctx: DemoActionContext): Promise<void> {
  if (batchResultsVisible()) return;
  if (document.querySelector(GQL.RESPONSE_OPEN_BATCH_RESULTS)) {
    await ctx.click(GQL.RESPONSE_OPEN_BATCH_RESULTS);
    await ctx.waitFor(GQL.BATCH_RESULTS, 5000);
    await ctx.delay(400);
  }
}

/** Dismiss the batch results overlay when open (Close footer or Escape). */
async function closeBatchResultsIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!batchResultsVisible()) return;
  const closeBtn = document.querySelector<HTMLElement>(GQL.BATCH_RESULTS_CLOSE_BTN);
  if (closeBtn) {
    await ctx.click(GQL.BATCH_RESULTS_CLOSE_BTN);
    await ctx.delay(700);
    return;
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await ctx.delay(700);
}

/** Open Advanced Settings on the Batch tab (modal must be closed first). */
async function openAdvancedSettingsBatchTab(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ADV_SETTINGS_MODAL)) {
    await ctx.click(GQL.ADV_SETTINGS_BTN);
    await ctx.waitFor(GQL.ADV_SETTINGS_MODAL, 5000);
    await ctx.delay(600);
  }

  if (!document.querySelector(GQL.ADV_SETTINGS_TAB_BATCH)) {
    await ctx.waitFor(GQL.ADV_SETTINGS_TAB_BATCH, 5000);
    await ctx.delay(400);
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

/** Write distinct health queries on Tab 1 and Tab 2 (quiet guard). */
async function writeLesson15DemoQueries(
  ctx: DemoActionContext,
  options: { focus?: boolean } = {},
): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);

  const tab0 = tabs[0];
  if (tab0) {
    tab0.setAttribute('data-lesson-target', 'gql15-batch-tab-0');
    await ctx.click('[data-lesson-target="gql15-batch-tab-0"]');
    await ctx.delay(options.focus ? 600 : 800);
    if (options.focus) await ctx.waitFor(GQL.EDITOR, 5000);
    await fillGqlEditor(ctx, LESSON15_TAB1_QUERY, { focus: options.focus ?? false });
    await ctx.delay(400);
  }

  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-batch-tab-1');
    await ctx.click('[data-lesson-target="gql15-batch-tab-1"]');
    await ctx.delay(options.focus ? 600 : 800);
    if (options.focus) await ctx.waitFor(GQL.EDITOR, 5000);
    await fillGqlEditor(ctx, LESSON15_TAB2_QUERY, { focus: options.focus ?? false });
    await ctx.delay(400);
  }

  // Return to Tab 1 so the Batch panel's active group is the shared endpoint.
  if (tabs[0]) await activateDemoTabByIndex(ctx, 0);
}

/**
 * Guard: Both demo tabs exist with endpoint parity and distinct queries written.
 */
export async function ensureLesson15QueriesWritten(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);
  if (_lesson15QueriesWritten) return;
  await writeLesson15DemoQueries(ctx, { focus: false });
  _lesson15QueriesWritten = true;
}

/**
 * Guard: Batch mode is enabled in Advanced Settings (after tabs + queries are ready).
 */
export async function ensureLesson15BatchEnabled(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15QueriesWritten(ctx);
  if (_lesson15BatchEnabled && isBatchModeEnabledInStudio()) return;

  await activateDemoTabByIndex(ctx, 0);
  await openAdvancedSettingsBatchTab(ctx);

  await clickAdvBatchEnableToggle(ctx);

  await saveAdvancedSettings(ctx);
  await ctx.waitFor(GQL.BATCH_SUMMARY_CHIP, 5000);
  _lesson15BatchEnabled = true;
}

/**
 * Guard: Two workspace tabs with batch endpoint parity (Tab 1 env var, Tab 2 direct URL).
 * Does not enable batch mode — callers do that after tabs and queries are ready.
 */
export async function ensureLesson15TwoTabsSameEndpoint(ctx: DemoActionContext): Promise<void> {
  if (getDemoTabCount() < 2) {
    await ensureLesson15Tab1PageDefault(ctx);
    await ctx.click(GQL.TAB_ADD_BTN);
    await ctx.waitFor(GQL15_DEMO_TAB_SELECTOR, 5000);
    await ctx.delay(500);
    _lesson15Tab2Added = true;
  } else if (!_lesson15Tab2Added) {
    _lesson15Tab2Added = true;
  }

  await ensureLesson15BatchEndpointParity(ctx);
}

/**
 * Guard: Both demo tabs are checked in Advanced Settings → Batch operation table.
 */
export async function ensureLesson15BothTabsChecked(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);
  if (_lesson15BothChecked && bothDemoTabsBatched()) return;

  await activateDemoTabByIndex(ctx, 0);
  await openAdvancedSettingsBatchTab(ctx);

  await clickAdvBatchEnableToggle(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);

  if (document.querySelector(GQL.ADV_BATCH_SELECT_ALL)) {
    await ctx.click(GQL.ADV_BATCH_SELECT_ALL);
    await ctx.delay(200);
  } else {
    for (const tabId of getDemoTabIds()) {
      await clickAdvBatchTabInclusion(ctx, tabId);
    }
  }

  await saveAdvancedSettings(ctx);
  _lesson15BothChecked = true;
  _lesson15BatchEnabled = true;
}

/**
 * Guard: Both tabs have the health query written and the Send Batch button is present.
 */
export async function ensureLesson15ReadyToExecute(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BothTabsChecked(ctx);
  await ensureLesson15QueriesWritten(ctx);
  await closeAdvancedSettingsIfOpen(ctx);
}

/** Step action: click Send Batch and wait for the results modal (step 6). */
export async function demonstrateLesson15RunBatch(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15ReadyToExecute(ctx);
  if (markLesson15ExecutedIfEvidencePresent()) {
    await reopenBatchResultsIfDismissed(ctx);
    await ctx.delay(900);
    return;
  }

  await closeAdvancedSettingsIfOpen(ctx);
  await ctx.click(GQL.BATCH_EXECUTE_BTN);
  await ctx.waitFor(GQL.BATCH_RESULTS, 15000);
  await ctx.delay(1000);
  _lesson15Executed = true;
}

/**
 * Guard: Batch execution has been run at least once and results are in the DOM.
 */
export async function ensureLesson15Executed(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15ReadyToExecute(ctx);
  if (markLesson15ExecutedIfEvidencePresent()) return;

  await closeAdvancedSettingsIfOpen(ctx);
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
  if (markLesson15PartialErrorIfEvidencePresent()) return;

  await closeAdvancedSettingsIfOpen(ctx);
  await runPartialErrorBatch(ctx);
  _lesson15PartialError = true;
}

async function runPartialErrorBatch(
  ctx: DemoActionContext,
  options: { visible?: boolean } = {},
): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(GQL15_DEMO_TAB_SELECTOR);
  const tab1 = tabs[1];
  if (tab1) {
    tab1.setAttribute('data-lesson-target', 'gql15-error-tab');
    await ctx.click('[data-lesson-target="gql15-error-tab"]');
    await ctx.delay(800);
    if (options.visible) {
      await ctx.waitFor(GQL.EDITOR, 5000);
      await ctx.delay(600);
    }
    await fillGqlEditor(ctx, LESSON15_ERROR_QUERY, { focus: options.visible ?? false });
    await ctx.delay(options.visible ? 700 : 500);
  }

  await closeAdvancedSettingsIfOpen(ctx);
  await ctx.click(GQL.BATCH_EXECUTE_BTN);
  await ctx.waitFor(GQL.BATCH_RESULTS, 15000);
  await ctx.delay(800);
}

// ── Reading-phase prep (quiet — no ripple) ───────────────────────────────────

/** Step gql15-add-tab reading — Tab 1 ready, tab bar visible. */
export async function prepareGql15AddTabReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15IntroReady(ctx);
  await ensureLesson15Tab1PageDefault(ctx);
  await ctx.delay(400);
}

/** Step gql15-write-queries reading — two tabs with endpoint parity, editor visible on Tab 1. */
export async function prepareGql15WriteQueriesReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);
  await activateDemoTabByIndex(ctx, 0);
  await ctx.waitFor(GQL.EDITOR, 5000);
  await ctx.delay(400);
}

/** Step gql15-enable-batch reading — tabs + queries ready; gear visible (modal opens in action). */
export async function prepareGql15EnableBatchReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15QueriesWritten(ctx);
  await closeAdvancedSettingsIfOpen(ctx);
  await activateDemoTabByIndex(ctx, 0);
  await ctx.waitFor(GQL.ADV_SETTINGS_BTN, 5000);
  await ctx.delay(400);
}

/** Step gql15-batch-select reading — batch enabled, modal open on operation table with both tabs. */
export async function prepareGql15BatchSelectReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15BatchEnabled(ctx);
  await activateDemoTabByIndex(ctx, 0);
  await openAdvancedSettingsBatchTab(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);
  await ctx.waitFor(GQL.ADV_BATCH_SELECT_ALL, 5000);
  await ctx.delay(400);
}

// ── Visible lesson actions (human-paced) ──────────────────────────────────────

/** Step action: enable batch mode via Advanced Settings (visible gear → Batch → Save). */
export async function demonstrateLesson15EnableBatch(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15QueriesWritten(ctx);
  if (_lesson15BatchEnabled && isBatchModeEnabledInStudio()) {
    // Already enabled — spotlight the chip so the viewer sees the outcome.
    if (document.querySelector(GQL.BATCH_SUMMARY_CHIP)) {
      await ctx.delay(1500);
    }
    return;
  }

  await closeAdvancedSettingsIfOpen(ctx);
  await activateDemoTabByIndex(ctx, 0);

  // Visible beat: gear → Batch tab → Enable toggle → confirm 2-tab group → Save → chip.
  await ctx.click(GQL.ADV_SETTINGS_BTN);
  await ctx.waitFor(GQL.ADV_SETTINGS_MODAL, 5000);
  await ctx.delay(800);

  await openAdvancedSettingsBatchTab(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_ENABLE_TOGGLE, 5000);
  await ctx.delay(1200);

  await clickAdvBatchEnableToggle(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);
  // Give viewers time to read the endpoint group chip ("2 tabs") before Save.
  if (document.querySelector(GQL.ADV_BATCH_GROUP_LABEL) || document.querySelector(GQL.ADV_BATCH_GROUP_SELECT)) {
    await ctx.delay(2000);
  } else {
    await ctx.delay(1500);
  }
  if (document.querySelector(GQL.ADV_BATCH_SELECTION_HINT)) {
    await ctx.delay(1500);
  }

  await saveAdvancedSettings(ctx);
  await ctx.waitFor(GQL.BATCH_SUMMARY_CHIP, 5000);
  await ctx.delay(1400);
  _lesson15BatchEnabled = true;
}

/** Step action: add Tab 2 and set its direct localhost endpoint override. */
export async function demonstrateLesson15AddSecondTab(ctx: DemoActionContext): Promise<void> {
  await ensureGqlDemoHeaderContext(ctx);

  if (getDemoTabCount() < 2) {
    await ensureLesson15Tab1PageDefault(ctx);
    await ctx.click(GQL.TAB_ADD_BTN);
    await ctx.waitFor(GQL15_DEMO_TAB_SELECTOR, 5000);
    await ctx.delay(800);
    _lesson15Tab2Added = true;
  } else {
    _lesson15Tab2Added = true;
    await ctx.delay(400);
  }

  await activateDemoTabByIndex(ctx, 1);
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  await configureDemoTabEndpointOverride(ctx, LESSON15_TAB2_ENDPOINT);
  const tabId = getDemoTabIdByIndex(1);
  if (tabId) await patchDemoTabConnectionById(tabId, { endpoint: LESSON15_TAB2_ENDPOINT });
  await ctx.delay(800);

  // Show Tab 1 still using {{graphqlUrl}} (no :4010 override badge).
  await activateDemoTabByIndex(ctx, 0);
  await ctx.delay(800);
  _lesson15EndpointParityDone = true;
}

/** Step action: check both operations in Advanced Settings → Batch table, then Save. */
export async function demonstrateLesson15SelectBatchTabs(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);

  if (_lesson15BothChecked && bothDemoTabsBatched()) {
    await ctx.delay(900);
    return;
  }

  await activateDemoTabByIndex(ctx, 0);
  await openAdvancedSettingsBatchTab(ctx);
  await clickAdvBatchEnableToggle(ctx);
  await ctx.waitFor(GQL.ADV_BATCH_PANEL, 5000);
  await ctx.delay(1000);

  // Prefer Select all (one clear beat) when both tabs share the endpoint group.
  if (document.querySelector(GQL.ADV_BATCH_SELECT_ALL)) {
    await ctx.click(GQL.ADV_BATCH_SELECT_ALL);
    await ctx.delay(1500);
  } else {
    for (const tabId of getDemoTabIds()) {
      await clickAdvBatchTabInclusion(ctx, tabId);
    }
    await ctx.delay(1200);
  }

  if (document.querySelector(GQL.ADV_BATCH_SELECTION_HINT)) {
    await ctx.delay(1600);
  }

  await saveAdvancedSettings(ctx);
  await ctx.waitFor(GQL.BATCH_EXECUTE_BTN, 5000);
  await ctx.delay(1200);
  _lesson15BothChecked = true;
  _lesson15BatchEnabled = true;
}

/** Step action: write distinct queries on Tab 1 and Tab 2. */
export async function demonstrateLesson15WriteQueries(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15TwoTabsSameEndpoint(ctx);

  if (_lesson15QueriesWritten) {
    await ctx.delay(900);
    return;
  }

  await writeLesson15DemoQueries(ctx, { focus: true });
  _lesson15QueriesWritten = true;
}

/** Step gql15-batch-response-slice reading — modal dismissed, Tab 1 batch banner visible. */
export async function prepareGql15BatchResponseSliceReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  await closeBatchResultsIfOpen(ctx);
  await ensureResponsePaneVisible(ctx);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 5000);
  await activateDemoTabByIndex(ctx, 0);
  await ctx.waitFor(GQL.RESPONSE_BATCH_BANNER, 5000);
  await ctx.delay(400);
}

/** Step gql15-batch-results reading — batch modal open with transport summary visible. */
export async function prepareGql15BatchResultsReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  await reopenBatchResultsIfDismissed(ctx);
  await ctx.delay(400);
}

/** Step action: observe stacked batch cards and transport summary (modal stays open). */
export async function demonstrateLesson15BatchResults(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  await reopenBatchResultsIfDismissed(ctx);
  if (document.querySelector(GQL.BATCH_RESULTS_TRANSPORT)) {
    await ctx.waitFor(GQL.BATCH_RESULTS_TRANSPORT, 5000);
  }
  await ctx.delay(2000);
}

/** Step action: close modal, inspect per-tab Response slice, reopen full batch. */
export async function demonstrateLesson15BatchResponseSlice(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  await closeBatchResultsIfOpen(ctx);
  await ensureResponsePaneVisible(ctx);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 5000);
  await ctx.delay(800);

  await activateDemoTabByIndex(ctx, 0);
  await ctx.waitFor(GQL.RESPONSE_BATCH_BANNER, 5000);
  await ctx.waitFor(GQL.RESPONSE_BATCH_PILL, 5000);
  await ctx.delay(1200);

  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RESPONSE_BATCH_META, 5000);
  await ctx.delay(800);
  if (document.querySelector(GQL.RESPONSE_WIRE_BATCH_BODY_TOGGLE)) {
    await ctx.click(GQL.RESPONSE_WIRE_BATCH_BODY_TOGGLE);
    await ctx.waitFor(GQL.RESPONSE_WIRE_BATCH_BODY, 5000);
    await ctx.delay(1200);
  }

  await activateDemoTabByIndex(ctx, 1);
  await ctx.waitFor(GQL.RESPONSE_BATCH_BANNER, 5000);
  await ctx.delay(1200);

  if (document.querySelector(GQL.RESPONSE_OPEN_BATCH_RESULTS)) {
    await ctx.click(GQL.RESPONSE_OPEN_BATCH_RESULTS);
    await ctx.waitFor(GQL.BATCH_RESULTS, 5000);
    await ctx.delay(1000);
    await closeBatchResultsIfOpen(ctx);
  }
}

/** Step gql15-partial-error reading — prep editor for first run; keep modal open on replay. */
export async function prepareGql15PartialErrorReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);
  await closeAdvancedSettingsIfOpen(ctx);

  if (markLesson15PartialErrorIfEvidencePresent()) {
    await reopenBatchResultsIfDismissed(ctx);
    await ctx.delay(400);
    return;
  }

  await closeBatchResultsIfOpen(ctx);
  await activateDemoTabByIndex(ctx, 1);
  await ctx.waitFor(GQL.EDITOR, 5000);
  await ctx.delay(400);
}

/** Step gql15-export-batch reading — partial-error batch done; modal dismissed for History focus. */
export async function prepareGql15ExportBatchReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15PartialErrorExecuted(ctx);
  await closeBatchResultsIfOpen(ctx);
  await closeAdvancedSettingsIfOpen(ctx);
  await ctx.delay(400);
}

/** Step action: inject a schema error on Tab 2 and re-run the batch. */
export async function demonstrateLesson15PartialError(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15Executed(ctx);

  if (markLesson15PartialErrorIfEvidencePresent()) {
    await reopenBatchResultsIfDismissed(ctx);
    await ctx.delay(1000);
    return;
  }

  await runPartialErrorBatch(ctx, { visible: true });
  await ctx.delay(1000);
  _lesson15PartialError = true;
}

/** Step action: open History sidebar for CI export narration. */
export async function demonstrateLesson15OpenHistory(ctx: DemoActionContext): Promise<void> {
  await ensureLesson15PartialErrorExecuted(ctx);
  await closeBatchResultsIfOpen(ctx);
  await closeAdvancedSettingsIfOpen(ctx);
  await openHistoryPanel(ctx);
  await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
  await ctx.delay(1000);
}

// ── Setup / cleanup ───────────────────────────────────────────────────────────

/** Step 1 / lesson start — tab bar visible without History/Collections sidebar open. */
export async function ensureLesson15IntroReady(ctx: DemoActionContext): Promise<void> {
  await closeGqlActivityPanelIfOpen(ctx);
  await ctx.waitFor(GQL.TAB_BAR, 5000);
}

/**
 * Batch lesson setup (GQL-15) — demo tab with tabBudget 2.
 * Keep this light: step 1 only needs the tab bar. Full introspection belongs in
 * later preActions — stacking ensureIntrospectedWithPageDefault here froze
 * Preparing for 25–70s when Docker/schema was slow or down.
 */
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

  await resetGqlDemoBatchDetection();

  await ensureEditorMode(ctx);
  await closeGqlActivityPanelIfOpen(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(120);
  }
  await navigateToGraphqlStudio(ctx);
  // Seed Demo env/svc so {{graphqlUrl}} resolves — required for Tab 1 + Tab 2 batch grouping.
  await ensureGqlDemoHeaderContext(ctx);
  await ensureGqlDemoTab(ctx, GQL15_LESSON_ID, 'Batch Execution', 2);
  // Page-default endpoint only (same as GQL-14 setup) — no introspect wait.
  await ensureGqlDemoPageDefaultEndpoint(ctx);
  await patchDemoTabConnection({ endpoint: undefined });
  await fillGqlEditor(ctx, LESSON15_TAB1_QUERY, { focus: false });
}

/** Batch lesson cleanup (GQL-15) — close sidebar panels and demo tabs. */
export async function gqlBatchLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson15SessionFlags();
  await resetGqlDemoBatchDetection();
  await closeGqlActivityPanelIfOpen(ctx);
  await closeGqlDemoTabs(ctx, GQL15_LESSON_ID);
}

export { GQL_DEMO_HTTP, GQL_DEMO_VAR };
