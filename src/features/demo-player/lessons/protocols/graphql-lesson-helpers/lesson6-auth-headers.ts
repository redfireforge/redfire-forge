// ── Lesson 6: Authentication & Headers ──────────────────────────────────────

import type { GlobalAuthProfile } from '../../../../../shared/types';
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_HEALTH_QUERY,
  ensureDemoEndpoint,
  ensureHealthQuery,
  fillGqlEditor,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

export const LESSON6_BEARER_TEMPLATE = '{{authToken}}';
export const LESSON6_AUTH_TOKEN_VALUE = 'lesson6-demo-jwt';
export const LESSON6_API_KEY_HEADER = 'X-API-Key';
export const LESSON6_API_KEY_TEMPLATE = '{{apiKey}}';
export const LESSON6_API_KEY_SECRET = 'lesson6-secret-key';
export const LESSON6_PROFILE_NAME = 'Lesson 6 Demo';
export const LESSON6_BASIC_USER = 'demo';
export const LESSON6_BASIC_PASS = 'demo-pass';
export const LESSON6_GLOBAL_AUTH_PROFILE_ID = 'lesson6-gql-auth-profile';
export const LESSON6_GLOBAL_AUTH_PROFILE_NAME = 'Lesson 6 Bearer';

let _lesson6BearerConfigured = false;
let _lesson6EnvTokenSet = false;
let _lesson6BearerExecuted = false;
let _lesson6ApiKeyConfigured = false;
let _lesson6ApiKeyExecuted = false;
let _lesson6BasicConfigured = false;
let _lesson6BasicExecuted = false;
let _lesson6InheritConfigured = false;
let _lesson6InheritExecuted = false;
let _lesson6ProfileSaved = false;

export function resetGqlLesson6SessionFlags(): void {
  _lesson6BearerConfigured = false;
  _lesson6EnvTokenSet = false;
  _lesson6BearerExecuted = false;
  _lesson6ApiKeyConfigured = false;
  _lesson6ApiKeyExecuted = false;
  _lesson6BasicConfigured = false;
  _lesson6BasicExecuted = false;
  _lesson6InheritConfigured = false;
  _lesson6InheritExecuted = false;
  _lesson6ProfileSaved = false;
}

function responseInspectorText(): string {
  const meta = document.querySelector(GQL.RV_METADATA)?.textContent ?? '';
  const reqHdr = document.querySelector(GQL.RV_REQUEST_HEADERS)?.textContent ?? '';
  return `${meta}${reqHdr}`;
}

async function closeAuthPopoverIfOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.AUTH_POPOVER)) {
    const closeBtn = document.querySelector<HTMLElement>(GQL.AUTH_POPOVER_CLOSE);
    if (closeBtn) {
      await ctx.click(GQL.AUTH_POPOVER_CLOSE);
    } else {
      await ctx.click(GQL.AUTH_BADGE_BTN);
    }
    await ctx.delay(300);
  }
}

async function closeEnvModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.ENV_MODAL)) {
    const overlay = document.querySelector<HTMLElement>('[data-testid="gql-env-modal-overlay"]');
    if (overlay) {
      await ctx.click('[data-testid="gql-env-modal-overlay"]');
    }
    await ctx.delay(300);
  }
}

/** Quietly open Bearer auth popover with token field visible (reading-phase spotlight). */
export async function prepareBearerAuthSpotlight(ctx: DemoActionContext): Promise<void> {
  await closeEnvModalIfOpen(ctx);
  await ensureAuthPopoverOpen(ctx);
  const bearerInput = document.querySelector(GQL.AUTH_BEARER_INPUT);
  if (!bearerInput) {
    await ctx.selectOption(GQL.AUTH_TYPE_SELECT, 'bearer');
  }
  await ctx.waitFor(GQL.AUTH_BEARER_INPUT, 5000);
  await ctx.delay(200);
}

/** Bearer + env configured, modals closed, ready to execute (no execute yet). */
export async function prepareBearerExecuteSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureBearerAuthConfigured(ctx);
  await ensureEnvAuthToken(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ensureHealthQuery(ctx);
}

/** Open auth popover after bearer execute — spotlight targets type dropdown for API Key step. */
export async function prepareApiKeyAuthSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureBearerExecutedWithMetadata(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await ensureAuthPopoverOpen(ctx);
  await ctx.delay(200);
}

/** API Key configured, modals closed, ready to execute. */
export async function prepareApiKeyExecuteSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyAuthConfigured(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await ensureHealthQuery(ctx);
}

/** Open auth popover after API Key execute — spotlight targets type dropdown for Basic step. */
export async function prepareBasicAuthSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyExecutedWithMetadata(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await ensureAuthPopoverOpen(ctx);
  await ctx.delay(200);
}

/** Basic auth configured, modals closed, ready to execute. */
export async function prepareBasicExecuteSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureBasicAuthConfigured(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await ensureHealthQuery(ctx);
}

/** Inherit mode popover with profile dropdown visible (profile not yet selected). */
export async function prepareInheritAuthSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureBasicExecutedWithMetadata(ctx);
  seedLesson6GlobalAuthProfile();
  await closeAuthPopoverIfOpen(ctx);
  await ensureAuthPopoverOpen(ctx);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, 'inherit');
  await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 5000);
  await ctx.delay(200);
}

/** Inherit auth configured, modals closed, ready to execute. */
export async function prepareInheritExecuteSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureInheritAuthConfigured(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await ensureHealthQuery(ctx);
}

/** Inherit executed with metadata open — ready for connection profile step. */
export async function prepareProfileSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureInheritExecutedWithMetadata(ctx);
  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
}

/** Open the Auth popover from the connection bar. */
export async function ensureAuthPopoverOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.AUTH_POPOVER)) return;
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await ctx.click(GQL.AUTH_BADGE_BTN);
  await ctx.waitFor(GQL.AUTH_POPOVER, 5000);
  await ctx.delay(400);
}

/** Select auth type in the popover. */
export async function selectAuthType(
  ctx: DemoActionContext,
  type: 'inherit' | 'bearer' | 'basic' | 'apiKey',
): Promise<void> {
  await ensureAuthPopoverOpen(ctx);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, type);
  await ctx.delay(400);
}

/** Seed the demo global auth profile via the App bridge (Environment Manager catalog). */
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

/** Configure inherit auth bound to the seeded global profile. */
export async function ensureInheritAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureBasicExecutedWithMetadata(ctx);
  seedLesson6GlobalAuthProfile();
  if (_lesson6InheritConfigured && document.querySelector(GQL.AUTH_PROFILE_SELECT)) return;

  await selectAuthType(ctx, 'inherit');
  await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 5000);
  await ctx.delay(400);
  await ctx.selectOption(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
  await ctx.delay(400);
  _lesson6InheritConfigured = true;
}

/** Execute with inherited profile auth and verify Metadata headers. */
export async function ensureInheritExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureInheritAuthConfigured(ctx);
  if (_lesson6InheritExecuted && responseInspectorText().includes(LESSON6_AUTH_TOKEN_VALUE)) return;

  await closeAuthPopoverIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6InheritExecuted = true;
}

function setEnvVarInModal(key: string, value: string): void {
  const rows = document.querySelectorAll('[data-testid="gql-env-var-row"]');
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('[data-testid="gql-env-var-key"]');
    if (keyInput?.value === key) {
      const valInput = row.querySelector<HTMLInputElement>('.gql-env-var-input');
      if (valInput) {
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        desc?.set?.call(valInput, value);
        valInput.dispatchEvent(new Event('input', { bubbles: true }));
        valInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
  }
  const addBtn = document.querySelector<HTMLButtonElement>('[data-testid="gql-env-var-add-btn"]');
  addBtn?.click();
  const keyInputs = document.querySelectorAll<HTMLInputElement>('[data-testid="gql-env-var-key"]');
  const valInputs = document.querySelectorAll<HTMLInputElement>('.gql-env-var-input');
  const keyInput = keyInputs[keyInputs.length - 1];
  const valInput = valInputs[valInputs.length - 1];
  if (keyInput && valInput) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    desc?.set?.call(keyInput, key);
    keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    desc?.set?.call(valInput, value);
    valInput.dispatchEvent(new Event('input', { bubbles: true }));
    valInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/** Open environment modal and set authToken variable. */
export async function ensureEnvAuthToken(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  if (_lesson6EnvTokenSet) return;

  await closeAuthPopoverIfOpen(ctx);
  if (!document.querySelector(GQL.ENV_MODAL)) {
    await ctx.click(GQL.ENV_BADGE);
    await ctx.waitFor(GQL.ENV_MODAL, 5000);
    await ctx.delay(600);
  }

  const newEnvBtn = document.querySelector(GQL.ENV_NEW_BTN);
  if (newEnvBtn) {
    const envItems = document.querySelectorAll('[data-testid^="gql-env-item-"]');
    if (envItems.length === 0) {
      await ctx.click(GQL.ENV_NEW_BTN);
      await ctx.delay(500);
    }
  }

  setEnvVarInModal('authToken', LESSON6_AUTH_TOKEN_VALUE);
  setEnvVarInModal('apiKey', LESSON6_API_KEY_SECRET);
  await ctx.delay(500);
  _lesson6EnvTokenSet = true;
}

/** Configure Bearer auth with {{authToken}} template and close the popover for spotlight handoff. */
export async function ensureBearerAuthConfiguredQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureBearerAuthConfigured(ctx);
  await closeAuthPopoverIfOpen(ctx);
}

/** Configure Bearer auth with {{authToken}} template. */
export async function ensureBearerAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  if (_lesson6BearerConfigured) return;
  await selectAuthType(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  await ctx.delay(400);
  _lesson6BearerConfigured = true;
}

/** Execute health query with bearer auth and open Metadata tab. */
export async function ensureBearerExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureEnvAuthToken(ctx);
  await ensureBearerAuthConfigured(ctx);
  await ensureHealthQuery(ctx);
  if (_lesson6BearerExecuted && responseInspectorText().includes('Authorization')) return;

  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6BearerExecuted = true;
}

/** Switch auth to API Key with {{apiKey}} value template. */
export async function ensureApiKeyAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureBearerExecutedWithMetadata(ctx);
  if (_lesson6ApiKeyConfigured) return;
  await selectAuthType(ctx, 'apiKey');
  await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  await ctx.delay(400);
  _lesson6ApiKeyConfigured = true;
}

/** Execute again and verify API key header in Metadata. */
export async function ensureApiKeyExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyAuthConfigured(ctx);
  if (_lesson6ApiKeyExecuted && responseInspectorText().includes(LESSON6_API_KEY_HEADER)) return;

  await closeAuthPopoverIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6ApiKeyExecuted = true;
}

/** Configure Basic auth with username/password. */
export async function ensureBasicAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyExecutedWithMetadata(ctx);
  if (_lesson6BasicConfigured) return;
  await selectAuthType(ctx, 'basic');
  await ctx.fill(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
  await ctx.delay(400);
  _lesson6BasicConfigured = true;
}

/** Execute health query with basic auth and open Metadata tab. */
export async function ensureBasicExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureBasicAuthConfigured(ctx);
  if (_lesson6BasicExecuted && responseInspectorText().includes('Basic')) return;

  await closeAuthPopoverIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6BasicExecuted = true;
}

/** Save current endpoint + auth as a named connection profile. */
export async function ensureProfileSaved(ctx: DemoActionContext): Promise<void> {
  await ensureInheritExecutedWithMetadata(ctx);
  if (_lesson6ProfileSaved && document.querySelector(`[data-testid^="gql-profile-row-"]`)) return;

  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ctx.click(GQL.PROFILE_BADGE);
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(600);
  await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
  await ctx.delay(400);
  await ctx.click(GQL.PROFILE_SAVE_BTN);
  await ctx.delay(800);
  _lesson6ProfileSaved = true;
}

/** Setup for Lesson 6 (GQL-4) — demo tab, modals closed, health query template. */
export async function gqlAuthLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();

  seedLesson6GlobalAuthProfile();
  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);

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
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 6 (GQL-4) — close demo tab, popovers, and reset session flags. */
export async function gqlAuthLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson6SessionFlags();
  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await closeGqlDemoTabs(ctx, 'gql-auth-headers');
}

