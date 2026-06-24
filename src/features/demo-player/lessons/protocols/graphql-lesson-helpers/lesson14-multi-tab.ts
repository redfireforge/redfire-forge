// ── Lesson 14: Multi-Tab Workspaces ──────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  clearActiveTabEndpointOverride,
  configureDemoTabEndpointOverride,
  configureDemoTabInheritPageDefault,
  ensureEditorMode,
  ensureGqlDemoPageDefaultEndpoint,
  fillActiveTabEndpoint,
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
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import {
  closeAuthPanelIfOpen,
  openAuthPanelQuiet,
  selectAuthInPanel,
  selectNoAuthInPanel,
} from './core';
import { fillControlledInput } from '../../setup-helpers';
import {
  GQL14_PRODUCTION_PROFILE_NAME,
  GQL14_STAGING_PROFILE_NAME,
  purgeGqlDemoConnectionProfiles,
} from '../../../../graphql/utils/gqlDemoConnectionProfiles';

const GQL14_LESSON_ID = 'gql-multi-tab';

/** Demo-only tabs for GQL-14 — never touch user tabs 1–7. */
const GQL14_DEMO_TAB_SELECTOR = `${GQL.TAB_BAR} [role="tab"][data-demo-lesson="${GQL14_LESSON_ID}"]`;

/** Label for the first tab endpoint override in the staging vs. production demo. */
export const LESSON14_STAGING_LABEL = 'Staging';
/** Label for the second tab in the staging vs. production demo. */
export const LESSON14_PRODUCTION_LABEL = 'Production';
/** Direct endpoint used as Tab 2 override so the badge is clearly visible. */
export const LESSON14_TAB2_ENDPOINT = GQL_DEMO_HTTP;
/** Bearer token used on Tab 2 during the per-tab auth beat (Phase 6H). */
export const LESSON14_TAB2_BEARER_TOKEN = 'gql14-production-bearer';

/** Connection profile names saved during GQL-14 profile step — lesson-scoped to avoid clobbering user profiles. */
export const LESSON14_STAGING_PROFILE_NAME = GQL14_STAGING_PROFILE_NAME;
export const LESSON14_PRODUCTION_PROFILE_NAME = GQL14_PRODUCTION_PROFILE_NAME;

const GQL14_LESSON_PROFILE_NAMES = [
  GQL14_STAGING_PROFILE_NAME,
  GQL14_PRODUCTION_PROFILE_NAME,
] as const;

let _lesson14Tab1Set = false;
let _lesson14Tab2Added = false;
let _lesson14Tab2Set = false;
let _lesson14Tab2Executed = false;
let _lesson14SwitchedToTab1 = false;
let _lesson14TabsRenamed = false;
let _lesson14PerTabAuthConfigured = false;
let _lesson14ProfilesLinked = false;
let _lesson14PollingConfigured = false;

export function resetGqlLesson14SessionFlags(): void {
  _lesson14Tab1Set = false;
  _lesson14Tab2Added = false;
  _lesson14Tab2Set = false;
  _lesson14Tab2Executed = false;
  _lesson14SwitchedToTab1 = false;
  _lesson14TabsRenamed = false;
  _lesson14PerTabAuthConfigured = false;
  _lesson14ProfilesLinked = false;
  _lesson14PollingConfigured = false;
}

/** Count demo workspace tabs for GQL-14. */
function getDemoTabCount(): number {
  return document.querySelectorAll(GQL14_DEMO_TAB_SELECTOR).length;
}

/** Return the Nth demo tab (0-based) for GQL-14. */
function getDemoTabByIndex(index: number): HTMLElement | null {
  const tabs = document.querySelectorAll<HTMLElement>(GQL14_DEMO_TAB_SELECTOR);
  return tabs[index] ?? null;
}

/** Return the text content of the active response body. */
function responseBodyText(): string {
  return document.querySelector(GQL.RESPONSE_BODY)?.textContent ?? '';
}

/** True when the schema badge element is present in the DOM. */
function hasSchemaBadge(): boolean {
  return !!document.querySelector(GQL.SCHEMA_BADGE_OK);
}

// ── Shared utility helpers (exported for test access) ────────────────────────

/**
 * Activate the Nth workspace tab (0-based) by tagging it with a lesson-target
 * attribute and using ctx.click — following the same pattern as other lesson helpers.
 */
export async function activateGqlTabByIndex(ctx: DemoActionContext, index: number): Promise<void> {
  const tab = getDemoTabByIndex(index);
  if (!tab) return;
  const attr = `gql14-tab-${index}`;
  tab.setAttribute('data-lesson-target', attr);
  await ctx.click(`[data-lesson-target="${attr}"]`);
  await ctx.delay(800);
}

/**
 * Add demo workspace tabs via GQL.TAB_ADD_BTN until the demo count reaches `n`.
 */
export async function ensureGqlTabCount(ctx: DemoActionContext, n: number): Promise<void> {
  let count = getDemoTabCount();
  let attempts = 0;
  while (count < n && attempts < n + 3) {
    attempts++;
    await ctx.click(GQL.TAB_ADD_BTN);
    await ctx.waitFor(GQL14_DEMO_TAB_SELECTOR, 5000);
    await ctx.delay(800);
    count = getDemoTabCount();
  }
}

/**
 * Fill the connection bar endpoint and blur so the override persists in the active tab.
 */
export async function setActiveTabEndpoint(ctx: DemoActionContext, url: string): Promise<void> {
  await fillActiveTabEndpoint(ctx, url);
}

export { clearActiveTabEndpointOverride };

/**
 * Introspect the active tab's schema quietly — skips if the badge is already present.
 * Avoids re-introspecting when switching tabs (each tab caches its own schema).
 */
export async function introspectActiveTabQuiet(ctx: DemoActionContext): Promise<void> {
  if (hasSchemaBadge()) return;
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await ctx.delay(1200);
}

/**
 * Execute a query on the active tab quietly — skips if a response is already cached.
 */
export async function executeOnActiveTabQuiet(ctx: DemoActionContext, query: string): Promise<void> {
  if (responseBodyText().includes('health')) return;
  await fillGqlEditor(ctx, query, { focus: false });
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(1000);
}

// ── Lesson-specific guard helpers ────────────────────────────────────────────

/**
 * Guard: Tab 1 uses the `{{graphqlUrl}}` env-var endpoint, introspected, and executed.
 */
export async function ensureLesson14Tab1Configured(ctx: DemoActionContext): Promise<void> {
  if (_lesson14Tab1Set) return;
  await activateGqlTabByIndex(ctx, 0);
  await configureDemoTabInheritPageDefault(ctx);
  await introspectActiveTabQuiet(ctx);
  await executeOnActiveTabQuiet(ctx, GQL_HEALTH_QUERY);
  _lesson14Tab1Set = true;
}

/**
 * Guard: At least two workspace tabs exist. Creates Tab 2 if missing.
 */
export async function ensureLesson14Tab2Added(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14Tab1Configured(ctx);
  if (_lesson14Tab2Added && getDemoTabCount() >= 2) return;
  await ensureGqlTabCount(ctx, 2);
  // Re-assert Tab 1 has no per-tab override once a second tab exists.
  await activateGqlTabByIndex(ctx, 0);
  await ensureGqlDemoPageDefaultEndpoint(ctx);
  await clearActiveTabEndpointOverride(ctx);
  getDemoTabByIndex(1)?.setAttribute('data-lesson-target', 'gql14-tab-1');
  _lesson14Tab2Added = true;
}

/**
 * Guard: Tab 2 is active and has a direct `http://localhost:4010/graphql` endpoint override.
 * The override causes a hostname badge to appear on the tab.
 */
export async function ensureLesson14Tab2Configured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14Tab2Added(ctx);
  if (_lesson14Tab2Set) return;
  await activateGqlTabByIndex(ctx, 1);
  await configureDemoTabEndpointOverride(ctx, LESSON14_TAB2_ENDPOINT);
  await introspectActiveTabQuiet(ctx);
  _lesson14Tab2Set = true;
}

/**
 * Guard: Tab 2 has executed `query { health }` so its response is cached.
 */
export async function ensureLesson14Tab2Executed(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14Tab2Configured(ctx);
  if (_lesson14Tab2Executed) return;
  await executeOnActiveTabQuiet(ctx, GQL_HEALTH_QUERY);
  _lesson14Tab2Executed = true;
}

/** Visible tab-switch beat: pause on Tab 2 response, then switch to Tab 1 cache. */
export async function demonstrateLesson14TabResponseSwitch(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14Tab2Executed(ctx);
  await activateGqlTabByIndex(ctx, 1);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
  await ctx.delay(1500);
  await activateGqlTabByIndex(ctx, 0);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
  await ctx.delay(1500);
  _lesson14SwitchedToTab1 = true;
}

/** Guard: switched to Tab 1 with Tab 2 response cached (used by later steps). */
export async function ensureLesson14SwitchedToTab1(ctx: DemoActionContext): Promise<void> {
  if (_lesson14SwitchedToTab1) {
    await activateGqlTabByIndex(ctx, 0);
    return;
  }
  await demonstrateLesson14TabResponseSwitch(ctx);
}

function demoTabLabelText(index: number): string {
  const tab = getDemoTabByIndex(index);
  return tab?.querySelector('.gql-tab-label')?.textContent?.trim() ?? '';
}

function demoTabId(index: number): string | undefined {
  const testId = getDemoTabByIndex(index)?.getAttribute('data-testid');
  return testId?.startsWith('gql-tab-') ? testId.slice('gql-tab-'.length) : undefined;
}

/** Rename a demo tab by index (double-click label → fill → Enter). */
export async function renameDemoTabByIndex(
  ctx: DemoActionContext,
  index: number,
  name: string,
): Promise<void> {
  await activateGqlTabByIndex(ctx, index);
  const tab = getDemoTabByIndex(index);
  if (!tab) return;

  const label = tab.querySelector<HTMLElement>('.gql-tab-label');
  if (label) {
    label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await ctx.delay(700);
  }

  const tabId = demoTabId(index);
  const renameSel = tabId ? GQL.tabRename(tabId) : GQL.TAB_RENAME_INPUT;
  await ctx.waitFor(renameSel, 5000);
  await ctx.delay(600);

  const input = document.querySelector<HTMLInputElement>(renameSel);
  if (input) {
    fillControlledInput(input, name);
    await ctx.delay(500);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await ctx.delay(700);
  }
}

/** Guard: Tab 1 → "Staging", Tab 2 → "Production" (step 7 narration). */
export async function ensureLesson14TabsRenamed(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14SwitchedToTab1(ctx);
  if (
    _lesson14TabsRenamed
    && demoTabLabelText(0) === LESSON14_STAGING_LABEL
    && demoTabLabelText(1) === LESSON14_PRODUCTION_LABEL
  ) {
    return;
  }

  if (demoTabLabelText(0) !== LESSON14_STAGING_LABEL) {
    await renameDemoTabByIndex(ctx, 0, LESSON14_STAGING_LABEL);
  }
  if (demoTabLabelText(1) !== LESSON14_PRODUCTION_LABEL) {
    await renameDemoTabByIndex(ctx, 1, LESSON14_PRODUCTION_LABEL);
  }
  _lesson14TabsRenamed = true;
}

function findProfileRowByName(name: string): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>('.gql-profile-row');
  for (const row of rows) {
    const nameEl = row.querySelector('.gql-profile-row__name');
    if (nameEl?.textContent?.trim() === name) return row;
  }
  return null;
}

async function closeProfileModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.PROFILE_MODAL)) return;
  await ctx.click(GQL.PROFILE_CLOSE_BTN);
  await ctx.delay(300);
}

/**
 * Remove Staging/Production lesson snapshots so a fresh run can save current tab state.
 * Storage purge removes all duplicates; the open modal refreshes via gql-profiles-reload.
 */
export async function purgeLesson14ConnectionProfiles(ctx: DemoActionContext): Promise<void> {
  await purgeGqlDemoConnectionProfiles(GQL14_LESSON_PROFILE_NAMES);
  await closeProfileModalIfOpen(ctx);
}

async function setActiveTabNoAuth(ctx: DemoActionContext): Promise<void> {
  await selectNoAuthInPanel(ctx);
  await closeAuthPanelIfOpen(ctx);
}

async function setActiveTabBearer(ctx: DemoActionContext, token: string): Promise<void> {
  await selectAuthInPanel(ctx, 'bearer');
  const current = document.querySelector<HTMLInputElement>(GQL.AUTH_BEARER_INPUT)?.value?.trim() ?? '';
  if (current !== token) {
    await ctx.fill(GQL.AUTH_BEARER_INPUT, token);
    await ctx.delay(400);
  }
  await closeAuthPanelIfOpen(ctx);
}

/** Guard: Tab 1 (Staging) uses explicit No Auth override. */
export async function ensureLesson14Tab1NoAuth(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14TabsRenamed(ctx);
  await activateGqlTabByIndex(ctx, 0);
  await setActiveTabNoAuth(ctx);
}

/** Guard: Tab 2 (Production) uses explicit Bearer override. */
export async function ensureLesson14Tab2Bearer(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14Tab1NoAuth(ctx);
  await activateGqlTabByIndex(ctx, 1);
  await setActiveTabBearer(ctx, LESSON14_TAB2_BEARER_TOKEN);
}

/** Visible per-tab auth beat: No Auth on Staging, Bearer on Production, Metadata compare. */
export async function demonstrateLesson14PerTabAuth(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14TabsRenamed(ctx);

  await activateGqlTabByIndex(ctx, 0);
  await selectNoAuthInPanel(ctx);
  await ctx.delay(800);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(1200);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(1500);

  await activateGqlTabByIndex(ctx, 1);
  await selectAuthInPanel(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON14_TAB2_BEARER_TOKEN);
  await ctx.delay(800);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(1200);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(1500);

  _lesson14PerTabAuthConfigured = true;
}

/**
 * Guard: both demo tabs share the same server but carry different per-tab auth
 * (Tab 1 No Auth, Tab 2 Bearer — Phase 6H).
 */
export async function ensureLesson14PerTabAuthConfigured(ctx: DemoActionContext): Promise<void> {
  if (_lesson14PerTabAuthConfigured) return;
  await ensureLesson14Tab2Bearer(ctx);
  _lesson14PerTabAuthConfigured = true;
}

async function saveCurrentTabAsProfile(ctx: DemoActionContext, name: string): Promise<void> {
  if (findProfileRowByName(name)) return;
  await ctx.click(GQL.PROFILE_BADGE);
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(800);
  await ctx.fill(GQL.PROFILE_NAME_INPUT, name);
  await ctx.delay(500);
  await ctx.click(GQL.PROFILE_SAVE_BTN);
  await ctx.delay(1200);
  await closeProfileModalIfOpen(ctx);
}

async function loadProfileOntoActiveTab(ctx: DemoActionContext, name: string): Promise<void> {
  const row = findProfileRowByName(name);
  if (!row) return;
  await ctx.click(GQL.PROFILE_BADGE);
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(700);
  const loadBtn = row.querySelector<HTMLElement>('.gql-profile-btn--load');
  loadBtn?.click();
  await ctx.delay(1200);
  await closeProfileModalIfOpen(ctx);
}

/**
 * Visible profile save/load beat for the lesson (step 9 action).
 * Saves Staging + Production profiles, reloads them, then opens the inherit banner.
 */
export async function demonstrateLesson14ProfileLinks(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14PerTabAuthConfigured(ctx);

  if (!_lesson14ProfilesLinked) {
    await activateGqlTabByIndex(ctx, 0);
    await saveCurrentTabAsProfile(ctx, LESSON14_STAGING_PROFILE_NAME);
    await activateGqlTabByIndex(ctx, 1);
    await saveCurrentTabAsProfile(ctx, LESSON14_PRODUCTION_PROFILE_NAME);
    await ctx.delay(1000);
    await activateGqlTabByIndex(ctx, 0);
    await loadProfileOntoActiveTab(ctx, LESSON14_STAGING_PROFILE_NAME);
    await activateGqlTabByIndex(ctx, 1);
    await loadProfileOntoActiveTab(ctx, LESSON14_PRODUCTION_PROFILE_NAME);
    await ctx.delay(1000);
    _lesson14ProfilesLinked = true;
  }

  await activateGqlTabByIndex(ctx, 1);
  await closeAuthPanelIfOpen(ctx);
  await openAuthPanelQuiet(ctx);
  await ctx.waitFor(GQL.AUTH_INHERIT_BANNER, 5000);
  await ctx.delay(1500);
}

/**
 * Link demo Tab 1 → Staging profile, Tab 2 → Production profile (Phase 6F / 7C).
 */
export async function ensureLesson14TabProfileLinks(ctx: DemoActionContext): Promise<void> {
  if (_lesson14ProfilesLinked) return;
  await demonstrateLesson14ProfileLinks(ctx);
}

/** Alias for plan §7C helper name. */
export const ensureTabProfileLink = ensureLesson14TabProfileLinks;

async function pollingConfigSelector(): Promise<string> {
  if (document.querySelector(GQL.POLLING_CONFIG_BTN)) return GQL.POLLING_CONFIG_BTN;
  return GQL.POLLING_CONFIG_BTN_STANDALONE;
}

async function openPollingConfig(ctx: DemoActionContext): Promise<void> {
  const sel = await pollingConfigSelector();
  await ctx.click(sel);
  await ctx.waitFor(GQL.POLLING_POPOVER, 5000);
  await ctx.delay(400);
}

async function closePollingPopover(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.POLLING_POPOVER)) return;
  const close = document.querySelector<HTMLElement>(GQL.POLLING_POPOVER_CLOSE);
  close?.click();
  await ctx.delay(300);
}

async function setActiveTabPolling(ctx: DemoActionContext, enabled: boolean): Promise<void> {
  await openPollingConfig(ctx);
  const toggle = document.querySelector<HTMLElement>(GQL.POLLING_TOGGLE);
  const isOn = toggle?.getAttribute('aria-checked') === 'true';
  if (isOn !== enabled) {
    await ctx.click(GQL.POLLING_TOGGLE);
    await ctx.delay(800);
  }
}

/**
 * Visible polling beat: enable on Staging (Tab 1), confirm off on Production (Tab 2).
 */
export async function demonstrateLesson14TabPolling(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14TabProfileLinks(ctx);
  if (_lesson14PollingConfigured) {
    await activateGqlTabByIndex(ctx, 0);
    await openPollingConfig(ctx);
    await ctx.delay(1500);
    return;
  }

  await activateGqlTabByIndex(ctx, 0);
  await setActiveTabPolling(ctx, true);
  await ctx.delay(1500);
  await closePollingPopover(ctx);

  await activateGqlTabByIndex(ctx, 1);
  await openPollingConfig(ctx);
  await ctx.delay(1200);
  await closePollingPopover(ctx);

  _lesson14PollingConfigured = true;
}

/**
 * Enable schema polling on demo Tab 1 only; Tab 2 inherits page default (off).
 */
export async function ensureLesson14TabPolling(ctx: DemoActionContext): Promise<void> {
  if (_lesson14PollingConfigured) return;
  await demonstrateLesson14TabPolling(ctx);
}

/** Alias for plan §7C helper name. */
export const ensureTabPolling = ensureLesson14TabPolling;

/** Open Auth panel on Production tab to surface profile inherit banner (Phase 6H). */
export async function ensureLesson14ProfileAuthHintVisible(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14TabProfileLinks(ctx);
  await activateGqlTabByIndex(ctx, 1);
  await closeAuthPanelIfOpen(ctx);
  await openAuthPanelQuiet(ctx);
  await ctx.waitFor(GQL.AUTH_INHERIT_BANNER, 5000);
  await ctx.delay(400);
}

/** Tag demo Tab 2 for the step-6 spotlight (whole tab — title + hostname subtitle). */
export async function ensureLesson14Tab2BadgeHighlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson14SwitchedToTab1(ctx);
  const tab = getDemoTabByIndex(1);
  if (!tab) return;
  tab.setAttribute('data-lesson-target', 'gql14-tab2-badge');
}

// ── Setup / cleanup ───────────────────────────────────────────────────────────

/** Multi-Tab lesson setup (GQL-14) — demo tab with tabBudget 2. */
export async function gqlMultiTabLessonSetup(ctx: DemoActionContext): Promise<void> {
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

  await ensureEditorMode(ctx);
  await ensureGqlDemoTab(ctx, GQL14_LESSON_ID, 'Multi-Tab Workspaces', 2);
  await ctx.waitFor(GQL.PROFILE_BADGE, 5000);
  await purgeLesson14ConnectionProfiles(ctx);
}

/** Multi-Tab lesson cleanup (GQL-14) — purge lesson profiles and close demo tabs. */
export async function gqlMultiTabLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson14SessionFlags();
  if (document.querySelector(GQL.PROFILE_BADGE)) {
    await purgeLesson14ConnectionProfiles(ctx);
  }
  await closeGqlDemoTabs(ctx, GQL14_LESSON_ID);
}
