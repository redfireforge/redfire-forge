// ── Lesson 6: Authentication & Headers ──────────────────────────────────────
//
// Clean rewrite — 8-step lesson flow:
//   1. Intro (no action)
//   2. Set up Env variables (authToken + apiKey)
//   3. Bearer Token — configure {{authToken}}, execute, verify resolved header
//   4. API Key      — switch, configure {{apiKey}}, execute, verify resolved header
//   5. Basic Auth   — switch, fill credentials, execute, verify header
//   6. Inherit      — switch to global profile, execute, verify header
//   7. Save connection profile
//   8. Auth carries into subscriptions (no action)

import type { GlobalAuthProfile } from '../../../../../shared/types';
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_HEALTH_QUERY,
  closeAuthPanelIfOpen,
  configureDemoTabInheritPageAuth,
  ensureDemoEndpoint,
  ensureHealthQuery,
  fillGqlEditor,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  selectAuthInPanel,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import { fillControlledInput } from '../../../lessons/setup-helpers';

// ── Constants ─────────────────────────────────────────────────────────────────

export const LESSON6_AUTH_TOKEN_VALUE         = 'lesson6-demo-jwt';
export const LESSON6_API_KEY_VALUE            = 'lesson6-api-key-secret';
/** @deprecated alias – use LESSON6_API_KEY_VALUE */
export const LESSON6_API_KEY_SECRET           = LESSON6_API_KEY_VALUE;
export const LESSON6_BEARER_TEMPLATE          = '{{authToken}}';
export const LESSON6_API_KEY_TEMPLATE         = '{{apiKey}}';
export const LESSON6_API_KEY_HEADER           = 'X-API-Key';
export const LESSON6_BASIC_USER               = 'demo';
export const LESSON6_BASIC_PASS               = 'demo-pass';
export const LESSON6_GLOBAL_AUTH_PROFILE_ID   = 'lesson6-gql-profile';
export const LESSON6_GLOBAL_AUTH_PROFILE_NAME = 'Lesson 6 Bearer';
export const LESSON6_PROFILE_NAME             = 'GQL Auth Demo';

// ── Session flags ─────────────────────────────────────────────────────────────

let _envReady    = false;
let _bearerDone  = false;
let _apiKeyDone  = false;
let _basicDone   = false;
let _inheritDone = false;
let _profileDone = false;

export function resetGqlLesson6SessionFlags(): void {
  _envReady = _bearerDone = _apiKeyDone = _basicDone = _inheritDone = _profileDone = false;
}

// ── Mark-done setters (called from lesson action callbacks once animated) ────

export function markBearerDone(): void { _bearerDone = true; }
export function markApiKeyDone(): void { _apiKeyDone = true; }
export function markBasicDone(): void { _basicDone = true; }
export function markInheritDone(): void { _inheritDone = true; }

// ── Core DOM helpers ──────────────────────────────────────────────────────────

async function closeEnvIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ENV_MODAL)) return;
  // Prefer the dedicated Close button; fall back to overlay click
  const closeBtn = document.querySelector<HTMLElement>(GQL.ENV_CLOSE_BTN);
  if (closeBtn) {
    await ctx.click(GQL.ENV_CLOSE_BTN);
  } else {
    const overlay = document.querySelector<HTMLElement>('[data-testid="gql-env-modal-overlay"]');
    overlay?.click();
  }
  await ctx.delay(300);
}

/** Seed the demo global auth profile via the App bridge. */
export function seedLesson6GlobalAuthProfile(): void {
  const upsert = (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile as
    | ((profile: GlobalAuthProfile) => void)
    | undefined;
  upsert?.({
    id: LESSON6_GLOBAL_AUTH_PROFILE_ID,
    name: LESSON6_GLOBAL_AUTH_PROFILE_NAME,
    auth: { type: 'bearer', token: LESSON6_AUTH_TOKEN_VALUE },
  });
}

// ── Env variable setup ────────────────────────────────────────────────────────

/**
 * Set a React-controlled input value so React's synthetic onChange handler
 * picks up the change. Uses fillControlledInput which resets _valueTracker
 * before setting the native value — required for React 18 to fire onChange.
 */
function nativeSetInput(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  fillControlledInput(input, value);
}

/**
 * Ensure an env variable row with the given key is present in the modal and
 * has the given value.  If the row does not exist a new one is created via the
 * "+ Add variable" button — with an async delay so React renders the row
 * before we query for the new inputs.
 */
async function ensureEnvVar(
  ctx: DemoActionContext,
  key: string,
  value: string,
): Promise<void> {
  // 1. Check if a row with this key already exists → update value only
  const rows = document.querySelectorAll('[data-testid="gql-env-var-row"]');
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('[data-testid="gql-env-var-key"]');
    if (keyInput?.value === key) {
      const valInput = row.querySelector<HTMLInputElement>('.gql-env-var-input');
      if (valInput) nativeSetInput(valInput, value);
      return;
    }
  }
  // 2. Try reusing an empty row before creating a new one
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('[data-testid="gql-env-var-key"]');
    if (keyInput && !keyInput.value) {
      nativeSetInput(keyInput, key);
      const valInput = row.querySelector<HTMLInputElement>('.gql-env-var-input');
      if (valInput) nativeSetInput(valInput, value);
      return;
    }
  }
  // 3. No usable row — click "+ Add variable" and wait for React to render the new row
  await ctx.click(GQL.ENV_VAR_ADD_BTN);
  await ctx.delay(400);
  const keyInputs = document.querySelectorAll<HTMLInputElement>('[data-testid="gql-env-var-key"]');
  const valInputs = document.querySelectorAll<HTMLInputElement>('.gql-env-var-input');
  const lastKey = keyInputs[keyInputs.length - 1];
  const lastVal = valInputs[valInputs.length - 1];
  if (lastKey) nativeSetInput(lastKey, key);
  if (lastVal) nativeSetInput(lastVal, value);
}

/**
 * Open the Env modal, create an environment if none exists, set `authToken`
 * and `apiKey` variables, and activate the environment so `{{vars}}` resolve.
 * Idempotent — skips on second call via session flag.
 */
export async function ensureEnvReady(ctx: DemoActionContext): Promise<void> {
  if (_envReady) return;
  await ensureDemoEndpoint(ctx);

  // Use the window bridge to upsert the env directly into React state — much
  // more reliable than DOM manipulation of the env modal inputs.
  const bridge = (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv as
    | ((name: string, vars: Array<{ key: string; value: string }>) => void)
    | undefined;

  if (bridge) {
    bridge('Demo', [
      { key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE },
      { key: 'apiKey',    value: LESSON6_API_KEY_VALUE },
    ]);
    // Give React one tick to flush state updates before proceeding
    await ctx.delay(300);
  } else {
    // Fallback: open env modal and set vars via DOM (bridge not available)
    await closeAuthPanelIfOpen(ctx);
    if (!document.querySelector(GQL.ENV_MODAL)) {
      await ctx.click(GQL.ENV_BADGE);
      await ctx.waitFor(GQL.ENV_MODAL, 5000);
      await ctx.delay(600);
    }
    const envItems = document.querySelectorAll('[data-testid^="gql-env-item-"]');
    if (envItems.length === 0) {
      await ctx.click(GQL.ENV_NEW_BTN);
      await ctx.delay(500);
    }
    await ensureEnvVar(ctx, 'authToken', LESSON6_AUTH_TOKEN_VALUE);
    await ctx.delay(200);
    await ensureEnvVar(ctx, 'apiKey', LESSON6_API_KEY_VALUE);
    await ctx.delay(400);
    await ctx.click(GQL.ENV_SET_ACTIVE_BTN);
    await ctx.delay(500);
  }

  _envReady = true;
}

// ── Ensure-executed chain ─────────────────────────────────────────────────────

/** Ensure Bearer auth is configured, executed, and Metadata tab is showing. */
export async function ensureBearerDone(ctx: DemoActionContext): Promise<void> {
  if (_bearerDone) return;
  await ensureEnvReady(ctx);
  await ensureHealthQuery(ctx);
  await closeEnvIfOpen(ctx);
  await selectAuthInPanel(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  await ctx.delay(400);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(400);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(500);
  _bearerDone = true;
}

/** Ensure API Key auth is configured, executed, and Metadata shows X-API-Key header. */
export async function ensureApiKeyDone(ctx: DemoActionContext): Promise<void> {
  if (_apiKeyDone) return;
  await ensureBearerDone(ctx);
  await selectAuthInPanel(ctx, 'apiKey');
  await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  await ctx.delay(400);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(400);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(500);
  _apiKeyDone = true;
}

/** Ensure Basic auth is configured, executed, and Metadata shows Basic header. */
export async function ensureBasicDone(ctx: DemoActionContext): Promise<void> {
  if (_basicDone) return;
  await ensureApiKeyDone(ctx);
  await selectAuthInPanel(ctx, 'basic');
  await ctx.fill(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
  await ctx.delay(400);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(400);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(500);
  _basicDone = true;
}

/** Ensure Inherit auth is configured (profile bound), executed, and Metadata verified. */
export async function ensureInheritDone(ctx: DemoActionContext): Promise<void> {
  if (_inheritDone) return;
  await ensureBasicDone(ctx);
  seedLesson6GlobalAuthProfile();
  await selectAuthInPanel(ctx, 'inherit');
  await ctx.delay(400);
  await ctx.selectOption(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
  await ctx.delay(400);
  await closeAuthPanelIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(400);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(500);
  _inheritDone = true;
}

/** Ensure connection profile has been saved under LESSON6_PROFILE_NAME. */
export async function ensureProfileDone(ctx: DemoActionContext): Promise<void> {
  if (_profileDone) return;
  await ensureInheritDone(ctx);
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
  await ctx.click(GQL.PROFILE_BADGE);
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(600);
  await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
  await ctx.delay(400);
  await ctx.click(GQL.PROFILE_SAVE_BTN);
  await ctx.delay(800);
  _profileDone = true;
}

// ── preActions (spotlight preparers for each step) ───────────────────────────

/** Step 2 preAction — close any open modals; demo tab and endpoint are already set. */
export async function preEnvStep(ctx: DemoActionContext): Promise<void> {
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 3 preAction — env vars must be ready; close env modal so the Auth panel can open cleanly. */
export async function preBearerStep(ctx: DemoActionContext): Promise<void> {
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  await closeAuthPanelIfOpen(ctx);
}

/** Step 4 preAction — Bearer must be executed; Metadata shows Bearer header as "before" view. */
export async function preApiKeyStep(ctx: DemoActionContext): Promise<void> {
  await ensureBearerDone(ctx);
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 5 preAction — API Key must be executed; Metadata shows X-API-Key header as "before" view. */
export async function preBasicStep(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyDone(ctx);
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 6 preAction — Basic must be executed; seed global profile; Metadata shows Basic header. */
export async function preInheritStep(ctx: DemoActionContext): Promise<void> {
  await ensureBasicDone(ctx);
  seedLesson6GlobalAuthProfile();
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 7 preAction — Inherit must be executed; all modals closed; Profiles badge is spotlit. */
export async function preProfileStep(ctx: DemoActionContext): Promise<void> {
  await ensureInheritDone(ctx);
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 8 preAction — profile saved; close profile modal so Auth badge is unobstructed. */
export async function preSubscriptionStep(ctx: DemoActionContext): Promise<void> {
  await ensureProfileDone(ctx);
  if (document.querySelector(GQL.PROFILE_MODAL)) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(300);
  }
}

// ── Lesson lifecycle ──────────────────────────────────────────────────────────

export async function gqlAuthLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();

  // Delete any leftover "Demo" env from a previous run so the lesson starts clean
  const deleteEnv = (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName as
    | ((name: string) => void)
    | undefined;
  deleteEnv?.('Demo');

  seedLesson6GlobalAuthProfile();
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);

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

  await ensureGqlDemoTab(ctx, 'gql-auth-headers', 'Authentication & Headers');
  await configureDemoTabInheritPageAuth(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

export async function gqlAuthLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson6SessionFlags();
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
  await closeGqlDemoTabs(ctx, 'gql-auth-headers');
  // Remove the Demo env so it doesn't persist into future lesson runs
  const deleteEnv = (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName as
    | ((name: string) => void)
    | undefined;
  deleteEnv?.('Demo');
}
