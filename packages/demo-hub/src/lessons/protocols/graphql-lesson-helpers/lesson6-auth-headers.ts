// ── Lesson 6: Authentication & Headers ──────────────────────────────────────
//
// 14-step lesson flow (config + Metadata observe splits per auth mode):
//   1–2 Intro + Env
//   3–4 Bearer config + Metadata verify
//   5–6 API Key config + Metadata verify
//   7–8 Basic config + Metadata verify
//   9 OAuth preview
//  10–11 Inherit config + Metadata verify
//  12 Connection profile
//  13–14 Subscription auth exec + Metadata verify

import type { DemoActionContext } from '../../../types';
import { scrollDemoTargetIntoView } from '../../../demoSpotlightUtils';
import { GQL } from '@shared/selectors';
import {
  GQL_HEALTH_QUERY,
  closeAuthPanelIfOpen,
  configureDemoTabInheritPageAuth,
  ensureAuthPanelVisible,
  ensureDemoEndpoint,
  ensureHealthQuery,
  fillGqlEditor,
  openAuthPanel,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  selectAuthInPanel,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import { fillControlledInput } from '../../../lessons/setup-helpers';
import {
  GQL6_DEMO_PROFILE_NAME,
  GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID,
  GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME,
  purgeGqlDemoConnectionProfiles,
  purgeGqlDemoGlobalAuthProfiles,
  upsertGlobalAuthProfile,
  upsertGqlEnvironment,
  deleteGqlEnvironmentByName,
  type GqlDemoEnvVar,
} from '../../../adapters';
import { openGqlProfileModal } from '../../../adapters/gqlModalLockBridge';

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
export const LESSON6_OAUTH_TOKEN_URL          = 'https://auth.example.com/oauth/token';
export const LESSON6_OAUTH_CLIENT_ID          = 'gql-studio-demo';
export const LESSON6_OAUTH_CLIENT_SECRET      = '{{oauth_secret}}';
export const LESSON6_GLOBAL_AUTH_PROFILE_ID   = GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID;
export const LESSON6_GLOBAL_AUTH_PROFILE_NAME = GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME;
export const LESSON6_PROFILE_NAME             = GQL6_DEMO_PROFILE_NAME;
export const GQL_DEMO_ENV_NAME                = 'Demo';

/** Metadata request-headers — Authorization value cell (Bearer / Basic). */
export const LESSON6_RV_AUTHORIZATION_VAL = GQL.rvRequestHeaderVal('Authorization');
/** Metadata request-headers — API Key value cell. */
export const LESSON6_RV_API_KEY_VAL = GQL.rvRequestHeaderVal(LESSON6_API_KEY_HEADER);
/** Demo spotlight — Authorization value scoped to the response Metadata pane. */
export const LESSON6_RV_METADATA_AUTHORIZATION_VAL = GQL.rvMetadataRequestHeaderVal('Authorization');
/** Demo spotlight — API Key value scoped to the response Metadata pane. */
export const LESSON6_RV_METADATA_API_KEY_VAL = GQL.rvMetadataRequestHeaderVal(LESSON6_API_KEY_HEADER);

export type { GqlDemoEnvVar } from '../../../adapters';

let _envReady    = false;
let _bearerDone  = false;
let _apiKeyDone  = false;
let _basicDone   = false;
let _oauthDone   = false;
let _inheritDone = false;
let _profileDone = false;

export function resetGqlLesson6SessionFlags(): void {
  _envReady = _bearerDone = _apiKeyDone = _basicDone = _oauthDone = _inheritDone = _profileDone = false;
}

// ── Mark-done setters (called from lesson action callbacks once animated) ────

export function markBearerDone(): void { _bearerDone = true; }
export function markApiKeyDone(): void { _apiKeyDone = true; }
export function markBasicDone(): void { _basicDone = true; }
export function markOauthDone(): void { _oauthDone = true; }
export function markInheritDone(): void { _inheritDone = true; }
export function markProfileDone(): void { _profileDone = true; }

/**
 * Select Inherit from Auth Profile + bind global profile in one pass.
 * Bare `{ type: 'inherit' }` without profileId clears tab auth when §11.0 leaves a user tab open —
 * profile must be chosen immediately after the type switch.
 */
export async function selectInheritGlobalProfileInPanel(ctx: DemoActionContext): Promise<void> {
  seedLesson6GlobalAuthProfile();
  await ctx.delay(300);
  await openAuthPanel(ctx);
  await ctx.waitFor(GQL.AUTH_TYPE_SELECT, 5000);
  await ctx.waitFor(`${GQL.AUTH_TYPE_SELECT} option[value="inherit"]`, 8000);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, 'inherit');
  await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 8000);
  await ctx.selectOption(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
  await ctx.delay(400);
}

// ── Core DOM helpers ──────────────────────────────────────────────────────────

async function closeEnvIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ENV_MODAL)) return;
  const closeBtn = document.querySelector<HTMLElement>(GQL.ENV_CLOSE_BTN);
  if (closeBtn) {
    await ctx.click(GQL.ENV_CLOSE_BTN);
    await ctx.delay(300);
  }
}

async function closeProfileIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.PROFILE_MODAL)) return;
  const closeBtn = document.querySelector<HTMLElement>(GQL.PROFILE_CLOSE_BTN);
  if (closeBtn) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(300);
  }
}

/** Seed the demo global auth profile via the App bridge. */
export function seedLesson6GlobalAuthProfile(): void {
  upsertGlobalAuthProfile({
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

async function ensureEnvVarMasked(ctx: DemoActionContext, row: Element): Promise<void> {
  const toggle = row.querySelector<HTMLElement>('.gql-env-var-secret-toggle');
  if (toggle && !toggle.classList.contains('gql-env-var-secret-toggle--active')) {
    toggle.click();
    await ctx.delay(200);
  }
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
      await ensureEnvVarMasked(ctx, row);
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
      await ensureEnvVarMasked(ctx, row);
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
  const lastRow = document.querySelectorAll('[data-testid="gql-env-var-row"]');
  const row = lastRow[lastRow.length - 1];
  if (lastKey) nativeSetInput(lastKey, key);
  if (lastVal) nativeSetInput(lastVal, value);
  if (row) await ensureEnvVarMasked(ctx, row);
}

/**
 * Create or update the named Demo environment and activate it so {{vars}} resolve.
 * Does not touch the connection endpoint — safe for TLS and other non-4010 lessons.
 */
export async function upsertGqlDemoEnvVars(
  ctx: DemoActionContext,
  vars: GqlDemoEnvVar[],
  envName = GQL_DEMO_ENV_NAME,
  options?: { keepAuthPanelOpen?: boolean },
): Promise<void> {
  if (upsertGqlEnvironment(envName, vars)) {
    await ctx.delay(300);
    if (options?.keepAuthPanelOpen) {
      await ensureAuthPanelVisible(ctx);
    }
    return;
  }

  if (!options?.keepAuthPanelOpen) {
    await closeAuthPanelIfOpen(ctx);
  }
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
  for (const { key, value } of vars) {
    await ensureEnvVar(ctx, key, value);
    await ctx.delay(200);
  }
  await ctx.click(GQL.ENV_SET_ACTIVE_BTN);
  await ctx.delay(500);
  await closeEnvIfOpen(ctx);
  if (options?.keepAuthPanelOpen) {
    await ensureAuthPanelVisible(ctx);
  }
}

/**
 * Open the Env modal, create an environment if none exists, set `authToken`
 * and `apiKey` variables, and activate the environment so `{{vars}}` resolve.
 * Idempotent — skips on second call via session flag.
 */
export async function ensureEnvReady(ctx: DemoActionContext): Promise<void> {
  if (_envReady) return;
  await ensureDemoEndpoint(ctx);

  await upsertGqlDemoEnvVars(ctx, [
    { key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE },
    { key: 'apiKey', value: LESSON6_API_KEY_VALUE },
    { key: 'oauth_secret', value: 'lesson6-oauth-client-secret' },
  ], GQL_DEMO_ENV_NAME, { keepAuthPanelOpen: true });

  _envReady = true;
}

async function configureBearerOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  await ctx.delay(700);
}

async function configureApiKeyOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'apiKey');
  await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  await ctx.delay(700);
}

async function configureBasicOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'basic');
  await ctx.fill(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
  await ctx.delay(700);
}

async function configureInheritOnly(ctx: DemoActionContext): Promise<void> {
  await selectInheritGlobalProfileInPanel(ctx);
  await ctx.delay(700);
}

/** Execute health query and open Metadata → specific request header value row (shared observe helper). */
export async function runAuthExecuteWithMetadata(
  ctx: DemoActionContext,
  headerValueSelector: string,
): Promise<void> {
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(800);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(headerValueSelector, 5000);
  const row = document.querySelector(headerValueSelector);
  if (row instanceof HTMLElement) {
    scrollDemoTargetIntoView(row, { block: 'center' });
  }
  await ctx.delay(800);
  // Metadata spotlight is on the right pane — keep Auth visible in the bottom-left panel.
  await ensureAuthPanelVisible(ctx);
}

/** True when the Auth panel already has inherit + Lesson 6 global profile selected. */
export function isInheritProfileConfigured(): boolean {
  const typeSelect = document.querySelector<HTMLSelectElement>(GQL.AUTH_TYPE_SELECT);
  const profileSelect = document.querySelector<HTMLSelectElement>(GQL.AUTH_PROFILE_SELECT);
  return typeSelect?.value === 'inherit'
    && profileSelect?.value === LESSON6_GLOBAL_AUTH_PROFILE_ID;
}

function isBearerConfigured(): boolean {
  const input = document.querySelector<HTMLInputElement>(GQL.AUTH_BEARER_INPUT);
  return input?.value === LESSON6_BEARER_TEMPLATE;
}

function isApiKeyConfigured(): boolean {
  const name = document.querySelector<HTMLInputElement>(GQL.AUTH_APIKEY_NAME);
  const val = document.querySelector<HTMLInputElement>(GQL.AUTH_APIKEY_VAL);
  return name?.value === LESSON6_API_KEY_HEADER && val?.value === LESSON6_API_KEY_TEMPLATE;
}

function isBasicConfigured(): boolean {
  const user = document.querySelector<HTMLInputElement>(GQL.AUTH_BASIC_USER);
  const pass = document.querySelector<HTMLInputElement>(GQL.AUTH_BASIC_PASS);
  return user?.value === LESSON6_BASIC_USER && pass?.value === LESSON6_BASIC_PASS;
}

/** Execute and open Metadata for observe steps — always re-runs so header rows match the current auth mode. */
async function primeMetadataHeaderRowForObserve(
  ctx: DemoActionContext,
  headerName: string,
  headerValueSelector: string,
): Promise<void> {
  await runAuthExecuteWithMetadata(ctx, headerValueSelector);
  await prepareMetadataRequestHeadersReading(ctx, headerName);
}

// ── Ensure-executed chain ─────────────────────────────────────────────────────

/** Ensure Bearer auth is configured, executed, and Metadata tab is showing. */
export async function ensureBearerDone(ctx: DemoActionContext): Promise<void> {
  if (_bearerDone) return;
  await ensureEnvReady(ctx);
  await ensureHealthQuery(ctx);
  await closeEnvIfOpen(ctx);
  await configureBearerOnly(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  _bearerDone = true;
}

/** Ensure API Key auth is configured, executed, and Metadata shows X-API-Key header. */
export async function ensureApiKeyDone(ctx: DemoActionContext): Promise<void> {
  if (_apiKeyDone) return;
  await ensureBearerDone(ctx);
  await configureApiKeyOnly(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_API_KEY_VAL);
  _apiKeyDone = true;
}

/** Ensure Basic auth is configured, executed, and Metadata shows Basic header. */
export async function ensureBasicDone(ctx: DemoActionContext): Promise<void> {
  if (_basicDone) return;
  await ensureApiKeyDone(ctx);
  await configureBasicOnly(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  _basicDone = true;
}

/** Ensure OAuth 2.0 client credentials are configured and preview is visible. */
export async function ensureOauthDone(ctx: DemoActionContext): Promise<void> {
  if (_oauthDone) return;
  await ensureBasicDone(ctx);
  await selectAuthInPanel(ctx, 'oauth2');
  await ctx.fill(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_OAUTH_CLIENT_ID, LESSON6_OAUTH_CLIENT_ID);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_OAUTH_CLIENT_SECRET, LESSON6_OAUTH_CLIENT_SECRET);
  await ctx.delay(500);
  await ctx.waitFor(GQL.AUTH_PREVIEW, 5000);
  await ctx.delay(500);
  _oauthDone = true;
}

/** Ensure Inherit auth is configured (profile bound), executed, and Metadata verified. */
export async function ensureInheritDone(ctx: DemoActionContext): Promise<void> {
  if (_inheritDone) return;
  await ensureOauthDone(ctx);
  await configureInheritOnly(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  _inheritDone = true;
}

/** Human-paced visible beat: open Profiles modal, name, save, pause on saved list. */
export async function demonstrateSaveConnectionProfile(
  ctx: DemoActionContext,
  options?: { closeAfter?: boolean },
): Promise<void> {
  const closeAfter = options?.closeAfter ?? false;

  await ctx.delay(50);

  if (!document.querySelector(GQL.PROFILE_MODAL)) {
    const opened = openGqlProfileModal();
    if (!opened) await ctx.click(GQL.PROFILE_BADGE);
  }
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(800); // viewer reads endpoint + auth preview in empty save form

  await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
  await ctx.delay(600); // viewer reads typed profile name

  await ctx.click(GQL.PROFILE_SAVE_BTN);
  await ctx.delay(1500); // outcome: ✓ Saved flash + profile row in list

  if (closeAfter && document.querySelector(GQL.PROFILE_MODAL)) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(800);
  }
}

/** Ensure connection profile has been saved under LESSON6_PROFILE_NAME. */
export async function ensureProfileDone(ctx: DemoActionContext): Promise<void> {
  if (_profileDone) return;
  await ensureInheritDone(ctx);
  await closeEnvIfOpen(ctx);
  await demonstrateSaveConnectionProfile(ctx, { closeAfter: true });
  await ensureAuthPanelVisible(ctx);
  _profileDone = true;
}

// ── preActions (spotlight preparers for each step) ───────────────────────────

/** Step 1 preAction — demo tab + endpoint ready; close stale modals from a prior lesson. */
export async function preIntroStep(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 2 preAction — close env modal only; Auth tab stays visible for this lesson. */
export async function preEnvStep(ctx: DemoActionContext): Promise<void> {
  await closeEnvIfOpen(ctx);
}

/** Step 3 preAction — env vars must be ready; close env modal so the Auth panel can open cleanly. */
export async function preBearerStep(ctx: DemoActionContext): Promise<void> {
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 4 preAction — Bearer must be executed; Metadata shows Bearer header as "before" view. */
export async function preApiKeyStep(ctx: DemoActionContext): Promise<void> {
  await ensureBearerDone(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 5 preAction — API Key must be executed; Metadata shows X-API-Key header as "before" view. */
export async function preBasicStep(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyDone(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 9 preAction — Basic must be executed before OAuth config. */
export async function preOauthStep(ctx: DemoActionContext): Promise<void> {
  await ensureBasicDone(ctx);
  await closeEnvIfOpen(ctx);
}

/** Step 10 preAction — OAuth configured; seed global profile for inherit catalog. */
export async function preInheritStep(ctx: DemoActionContext): Promise<void> {
  await ensureOauthDone(ctx);
  seedLesson6GlobalAuthProfile();
  await closeEnvIfOpen(ctx);
  await openAuthPanel(ctx);
}

/** Step 12 preAction — inherit verified; purge stale saved profile so Save step starts clean. */
export async function preProfileStep(ctx: DemoActionContext): Promise<void> {
  await ensureInheritDone(ctx);
  await closeEnvIfOpen(ctx);
  await purgeGqlDemoConnectionProfiles([GQL6_DEMO_PROFILE_NAME]);
  if (document.querySelector(GQL.PROFILE_MODAL)) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(300);
  }
  await ensureAuthPanelVisible(ctx);
}

/** Step 13 preAction — profile saved; close profile modal. */
export async function preSubscriptionStep(ctx: DemoActionContext): Promise<void> {
  await ensureProfileDone(ctx);
  if (document.querySelector(GQL.PROFILE_MODAL)) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(300);
  }
}

export async function prepareBearerConfigReading(ctx: DemoActionContext): Promise<void> {
  await preBearerStep(ctx);
  await selectAuthInPanel(ctx, 'bearer');
}

export async function prepareOauthConfigReading(ctx: DemoActionContext): Promise<void> {
  await preOauthStep(ctx);
  await selectAuthInPanel(ctx, 'oauth2');
  const tokenUrl = document.querySelector(GQL.AUTH_OAUTH_TOKEN_URL);
  if (tokenUrl instanceof HTMLElement) {
    scrollDemoTargetIntoView(tokenUrl, { block: 'center' });
  }
  await ctx.delay(300);
}

/** Open Response → Metadata → specific request header value row named in the step narration. */
export async function prepareMetadataRequestHeadersReading(
  ctx: DemoActionContext,
  headerName: string,
): Promise<void> {
  if (!document.querySelector(GQL.RESPONSE_VIEWER)) return;
  const responseTab = document.querySelector(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
  }
  const metaTab = document.querySelector(GQL.RV_TAB_METADATA);
  if (metaTab?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RV_TAB_METADATA);
    await ctx.delay(400);
  }
  const toggle = document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS_TOGGLE);
  if (toggle?.getAttribute('aria-expanded') === 'false') {
    await ctx.click(GQL.RV_REQUEST_HEADERS_TOGGLE);
    await ctx.delay(300);
  }
  const rowSelector = GQL.rvMetadataRequestHeaderVal(headerName);
  if (document.querySelector(rowSelector)) {
    await ctx.waitFor(rowSelector, 5000);
    const row = document.querySelector(rowSelector);
    if (row instanceof HTMLElement) {
      scrollDemoTargetIntoView(row, { block: 'center' });
    }
    await ctx.delay(400);
  }
  await ensureAuthPanelVisible(ctx);
}

export async function prepareBearerObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  if (!isBearerConfigured()) {
    await configureBearerOnly(ctx);
  }
  await primeMetadataHeaderRowForObserve(ctx, 'Authorization', LESSON6_RV_METADATA_AUTHORIZATION_VAL);
}

export async function prepareApiKeyConfigReading(ctx: DemoActionContext): Promise<void> {
  await preApiKeyStep(ctx);
  await selectAuthInPanel(ctx, 'apiKey');
}

export async function prepareApiKeyObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureBearerDone(ctx);
  if (!isApiKeyConfigured()) {
    await configureApiKeyOnly(ctx);
  }
  await primeMetadataHeaderRowForObserve(ctx, LESSON6_API_KEY_HEADER, LESSON6_RV_METADATA_API_KEY_VAL);
}

export async function prepareBasicConfigReading(ctx: DemoActionContext): Promise<void> {
  await preBasicStep(ctx);
  await selectAuthInPanel(ctx, 'basic');
}

export async function prepareBasicObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyDone(ctx);
  if (!isBasicConfigured()) {
    await configureBasicOnly(ctx);
  }
  await primeMetadataHeaderRowForObserve(ctx, 'Authorization', LESSON6_RV_METADATA_AUTHORIZATION_VAL);
}

export async function prepareInheritConfigReading(ctx: DemoActionContext): Promise<void> {
  await preInheritStep(ctx);
  await ctx.waitFor(GQL.AUTH_TYPE_SELECT, 5000);
  await ctx.waitFor(`${GQL.AUTH_TYPE_SELECT} option[value="inherit"]`, 8000);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, 'inherit');
  await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 8000);
  const profileSelect = document.querySelector(GQL.AUTH_PROFILE_SELECT);
  if (profileSelect instanceof HTMLElement) {
    scrollDemoTargetIntoView(profileSelect, { block: 'center' });
  }
  await ctx.delay(300);
}

export async function prepareInheritObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureOauthDone(ctx);
  seedLesson6GlobalAuthProfile();
  await closeEnvIfOpen(ctx);
  await closeProfileIfOpen(ctx);
  if (!isInheritProfileConfigured()) {
    await configureInheritOnly(ctx);
  }
  await primeMetadataHeaderRowForObserve(ctx, 'Authorization', LESSON6_RV_METADATA_AUTHORIZATION_VAL);
}

export async function prepareSubscriptionExecReading(ctx: DemoActionContext): Promise<void> {
  await preSubscriptionStep(ctx);
  await selectInheritGlobalProfileInPanel(ctx);
  await ctx.delay(300);
}

export async function prepareSubscriptionObserveReading(ctx: DemoActionContext): Promise<void> {
  await prepareSubscriptionExecReading(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  await prepareMetadataRequestHeadersReading(ctx, 'Authorization');
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
  deleteGqlEnvironmentByName('Demo');

  await purgeGqlDemoConnectionProfiles([GQL6_DEMO_PROFILE_NAME]);
  await purgeGqlDemoGlobalAuthProfiles();

  seedLesson6GlobalAuthProfile();
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
  await ensureAuthPanelVisible(ctx);
}

export async function gqlAuthLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson6SessionFlags();
  await closeAuthPanelIfOpen(ctx);
  await closeEnvIfOpen(ctx);
  if (document.querySelector(GQL.PROFILE_MODAL)) {
    await ctx.click(GQL.PROFILE_CLOSE_BTN);
    await ctx.delay(200);
  }
  await purgeGqlDemoConnectionProfiles([GQL6_DEMO_PROFILE_NAME]);
  await purgeGqlDemoGlobalAuthProfiles();
  await closeGqlDemoTabs(ctx, 'gql-auth-headers');
  // Remove the Demo env so it doesn't persist into future lesson runs
  deleteGqlEnvironmentByName('Demo');
}
