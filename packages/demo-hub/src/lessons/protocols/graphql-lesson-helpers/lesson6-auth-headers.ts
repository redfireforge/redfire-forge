// ── Lesson 6: Authentication & Headers ──────────────────────────────────────
//
// 13-step lesson flow (config + Metadata observe splits per auth mode):
//   1 Intro (Demo env seeded quietly in setup — no Env modal tour)
//   2–3 Bearer config + Metadata verify
//   4–5 API Key config + Metadata verify
//   6–7 Basic config + Metadata verify
//   8 OAuth preview
//   9–10 Inherit config + Metadata verify
//  11 Connection profile
//  12–13 Subscription auth exec + Metadata verify
//
// Preparing must stay invisible and fast:
//   - Do not select the Auth type the step will teach (action shows it once).
//   - Do not Execute (observe actions own Execute + Metadata).
//   - Only quietly restore missing prior credentials for Next-skip recovery.

import type { DemoActionContext } from '../../../types';
import { showSpotlightRing } from '../../../demoRipple';
import { scrollDemoTargetIntoView } from '../../../demoSpotlightUtils';
import { GQL } from '@shared/selectors';
import {
  GQL_HEALTH_QUERY,
  closeAuthPanelIfOpen,
  configureDemoTabInheritPageAuth,
  ensureAuthPanelVisible,
  ensureDemoTabDirectHttpEndpoint,
  ensureHealthQuery,
  fillGqlEditor,
  resetDemoTabToPlainHttp,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  selectAuthInPanel,
} from './core';
import { navigateToGraphqlStudio } from '../../env-manager-lesson-helpers';
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
  // Let React add the catalog entry to Auth type options before selecting.
  await ctx.delay(400);
  await selectAuthInPanel(ctx, 'inherit');
  await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 5000);
  const profileEl = document.querySelector(GQL.AUTH_PROFILE_SELECT);
  const profileAlready = profileEl instanceof HTMLSelectElement
    ? profileEl.value === LESSON6_GLOBAL_AUTH_PROFILE_ID
    : profileEl?.getAttribute('data-value') === LESSON6_GLOBAL_AUTH_PROFILE_ID;
  if (!profileAlready) {
    await ctx.selectOption(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
    await ctx.delay(400);
  }
}

// ── Core DOM helpers ──────────────────────────────────────────────────────────

/** Close GraphQL Studio Env modal if open (quiet recovery / lesson belts). */
export async function closeEnvIfOpen(ctx: DemoActionContext): Promise<void> {
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

  // Do not close Auth before the Env modal — that flashes the bottom panel during
  // Preparing. The Env modal overlays Studio; Auth can stay as-is.
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
 * Ensure Demo env has `authToken` / `apiKey` so `{{vars}}` resolve.
 * Prefer the bridge (no Env modal). Never open Environment Manager.
 * Idempotent — skips on second call via session flag.
 */
export async function ensureEnvReady(ctx: DemoActionContext): Promise<void> {
  if (_envReady) return;
  await ensureDemoTabDirectHttpEndpoint(ctx);

  // Keep Auth closed — step 1 teaches the Auth badge click; opening Auth here
  // flashes the panel during Preparing before the lesson card appears.
  await upsertGqlDemoEnvVars(ctx, [
    { key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE },
    { key: 'apiKey', value: LESSON6_API_KEY_VALUE },
    { key: 'oauth_secret', value: 'lesson6-oauth-client-secret' },
  ], GQL_DEMO_ENV_NAME);

  _envReady = true;
}

/** Quiet recovery fills — short delays (scaled further in Preparing). */
async function configureBearerOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  await ctx.delay(200);
}

async function configureApiKeyOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'apiKey');
  await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
  await ctx.delay(120);
  await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  await ctx.delay(200);
}

async function configureBasicOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'basic');
  await ctx.fill(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  await ctx.delay(120);
  await ctx.fill(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
  await ctx.delay(200);
}

async function configureOauthOnly(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'oauth2');
  await ctx.fill(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
  await ctx.delay(120);
  await ctx.fill(GQL.AUTH_OAUTH_CLIENT_ID, LESSON6_OAUTH_CLIENT_ID);
  await ctx.delay(120);
  await ctx.fill(GQL.AUTH_OAUTH_CLIENT_SECRET, LESSON6_OAUTH_CLIENT_SECRET);
  await ctx.delay(200);
}

async function configureInheritOnly(ctx: DemoActionContext): Promise<void> {
  await selectInheritGlobalProfileInPanel(ctx);
  await ctx.delay(200);
}

/** Configured-only guards for Preparing — never Execute (that is the visible action). */
async function ensureBearerConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  if (!isBearerConfigured()) await configureBearerOnly(ctx);
}

async function ensureApiKeyConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureBearerConfigured(ctx);
  if (!isApiKeyConfigured()) await configureApiKeyOnly(ctx);
}

async function ensureBasicConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyConfigured(ctx);
  if (!isBasicConfigured()) await configureBasicOnly(ctx);
}

async function ensureOauthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureBasicConfigured(ctx);
  const tokenUrl = document.querySelector<HTMLInputElement>(GQL.AUTH_OAUTH_TOKEN_URL);
  if (tokenUrl?.value !== LESSON6_OAUTH_TOKEN_URL) await configureOauthOnly(ctx);
}

async function ensureInheritConfigured(ctx: DemoActionContext): Promise<void> {
  seedLesson6GlobalAuthProfile();
  await ctx.delay(200);
  if (isInheritProfileConfigured()) return;
  await ensureOauthConfigured(ctx);
  if (!isInheritProfileConfigured()) await configureInheritOnly(ctx);
}

/** Hold the demo spotlight on a Metadata request-header value cell. */
async function spotlightMetadataHeaderValue(
  ctx: DemoActionContext,
  headerValueSelector: string,
  holdMs = 1400,
): Promise<void> {
  const el = document.querySelector(headerValueSelector);
  if (!(el instanceof HTMLElement)) return;
  scrollDemoTargetIntoView(el, { block: 'center' });
  const removeRing = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
  }
}

async function openMetadataRequestHeaders(ctx: DemoActionContext): Promise<void> {
  const responseTab = document.querySelector(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
  }
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.delay(400);
  const toggle = document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS_TOGGLE);
  if (toggle?.getAttribute('aria-expanded') === 'false') {
    await ctx.click(GQL.RV_REQUEST_HEADERS_TOGGLE);
    await ctx.delay(300);
  }
}

/**
 * Execute → Metadata → Request headers, then spotlight the auth header value
 * (e.g. `Authorization` → `Bearer lesson6-demo-jwt` or `X-API-Key` → secret).
 */
export async function runAuthExecuteWithMetadata(
  ctx: DemoActionContext,
  headerValueSelector: string,
): Promise<void> {
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(600);
  await openMetadataRequestHeaders(ctx);
  await ctx.waitFor(headerValueSelector, 5000);
  await spotlightMetadataHeaderValue(ctx, headerValueSelector, 1400);
  // Keep Auth panel open in the bottom-left while Metadata is on the right.
  await ensureAuthPanelVisible(ctx);
}

/** Open Metadata → Request headers and spotlight an existing auth header value (no Execute). */
export async function spotlightAuthMetadataHeader(
  ctx: DemoActionContext,
  headerValueSelector: string,
): Promise<void> {
  if (!document.querySelector(GQL.RESPONSE_VIEWER)) {
    await runAuthExecuteWithMetadata(ctx, headerValueSelector);
    return;
  }
  await openMetadataRequestHeaders(ctx);
  await ctx.waitFor(headerValueSelector, 5000);
  await spotlightMetadataHeaderValue(ctx, headerValueSelector, 1400);
  await ensureAuthPanelVisible(ctx);
}

/** True when the Auth panel already has inherit + Lesson 6 global profile selected. */
export function isInheritProfileConfigured(): boolean {
  const typeEl = document.querySelector(GQL.AUTH_TYPE_SELECT);
  const profileEl = document.querySelector(GQL.AUTH_PROFILE_SELECT);
  if (!typeEl || !profileEl) return false;

  if (typeEl instanceof HTMLSelectElement && profileEl instanceof HTMLSelectElement) {
    return typeEl.value === 'inherit'
      && profileEl.value === LESSON6_GLOBAL_AUTH_PROFILE_ID;
  }

  // CustomSelect exposes the selected value on data-value (no menu open required).
  return typeEl.getAttribute('data-value') === 'inherit'
    && profileEl.getAttribute('data-value') === LESSON6_GLOBAL_AUTH_PROFILE_ID;
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

/** Ensure OAuth 2.0 client credentials are configured (skip-recovery). */
export async function ensureOauthDone(ctx: DemoActionContext): Promise<void> {
  if (_oauthDone) return;
  await ensureBasicDone(ctx);
  await configureOauthOnly(ctx);
  await ctx.waitFor(GQL.AUTH_PREVIEW, 5000);
  _oauthDone = true;
}

/** Ensure Inherit auth is configured (profile bound), executed, and Metadata verified. */
export async function ensureInheritDone(ctx: DemoActionContext): Promise<void> {
  if (_inheritDone) return;
  await ensureOauthDone(ctx);
  seedLesson6GlobalAuthProfile();
  await ctx.delay(200);
  if (!isInheritProfileConfigured()) await configureInheritOnly(ctx);
  await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  _inheritDone = true;
}

function findConnectionProfileRowByName(name: string): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>('.gql-profile-row');
  for (const row of rows) {
    const nameEl = row.querySelector('.gql-profile-row__name');
    if (nameEl?.textContent?.trim() === name) return row;
  }
  return null;
}

function isConnectionProfileLinked(name: string): boolean {
  const row = findConnectionProfileRowByName(name);
  if (!row) return false;
  if (row.querySelector('.gql-profile-row__unused-hint')) return false;
  if (row.querySelector('.gql-profile-loaded-badge')) return true;
  if (row.querySelector('.gql-profile-row__tab-pill')) return true;
  return false;
}

/** Click Load on a saved profile row so Used by shows the active workspace tab. */
export async function loadConnectionProfileOntoActiveTab(
  ctx: DemoActionContext,
  name: string = LESSON6_PROFILE_NAME,
): Promise<void> {
  const loadSel = GQL.profileLoadBtn(name);
  if (isConnectionProfileLinked(name)) return;
  if (!document.querySelector(loadSel)) return;
  await ctx.click(loadSel);
  await ctx.delay(2500); // modal stays open — read Used by on the loaded row
}

/** Human-paced visible beat: open Profiles modal, name, save, load, pause on Used by. */
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

  if (!findConnectionProfileRowByName(LESSON6_PROFILE_NAME)) {
    await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    await ctx.delay(600); // viewer reads typed profile name

    await ctx.click(GQL.PROFILE_SAVE_BTN);
    await ctx.delay(1500); // outcome: ✓ Saved flash + profile row in list
  }

  await loadConnectionProfileOntoActiveTab(ctx, LESSON6_PROFILE_NAME);

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

/**
 * Preparing rules for this lesson:
 * - Never select the Auth type the step will teach (action shows it once).
 * - Never Execute (observe actions own Execute + Metadata).
 * - Only restore missing prior credentials for Next-skip recovery.
 */

/** Step 1 preAction — Studio + quiet Demo env; leave Auth panel closed for badge click. */
export async function preIntroStep(ctx: DemoActionContext): Promise<void> {
  await navigateToGraphqlStudio(ctx);
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  await closeAuthPanelIfOpen(ctx);
}

/** @deprecated Env modal tour removed — kept for helpers that still close a stray modal. */
export async function preEnvStep(ctx: DemoActionContext): Promise<void> {
  await closeEnvIfOpen(ctx);
}

/** Bearer config Preparing — env only; do not switch Auth type. */
export async function preBearerStep(ctx: DemoActionContext): Promise<void> {
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** API Key config Preparing — prior Bearer credentials only (no Execute). */
export async function preApiKeyStep(ctx: DemoActionContext): Promise<void> {
  await ensureBearerConfigured(ctx);
  await closeEnvIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** Basic config Preparing — prior API Key credentials only (no Execute). */
export async function preBasicStep(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyConfigured(ctx);
  await closeEnvIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** OAuth config Preparing — prior Basic credentials only (no Execute / no OAuth select). */
export async function preOauthStep(ctx: DemoActionContext): Promise<void> {
  await ensureBasicConfigured(ctx);
  await closeEnvIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** Inherit config Preparing — seed catalog; do not select Inherit (action shows it). */
export async function preInheritStep(ctx: DemoActionContext): Promise<void> {
  await ensureOauthConfigured(ctx);
  seedLesson6GlobalAuthProfile();
  await ctx.delay(200);
  await closeEnvIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** Profile step Preparing — inherit bound; purge stale saved profile. */
export async function preProfileStep(ctx: DemoActionContext): Promise<void> {
  await ensureInheritConfigured(ctx);
  await closeEnvIfOpen(ctx);
  await purgeGqlDemoConnectionProfiles([GQL6_DEMO_PROFILE_NAME]);
  await closeProfileIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

/** Subscription Preparing — profile saved; close profile modal. */
export async function preSubscriptionStep(ctx: DemoActionContext): Promise<void> {
  if (!_profileDone) {
    await ensureProfileDone(ctx);
  }
  await closeProfileIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

export async function prepareBearerConfigReading(ctx: DemoActionContext): Promise<void> {
  await preBearerStep(ctx);
}

export async function prepareOauthConfigReading(ctx: DemoActionContext): Promise<void> {
  await preOauthStep(ctx);
  const typeSelect = document.querySelector(GQL.AUTH_TYPE_SELECT);
  if (typeSelect instanceof HTMLElement) {
    scrollDemoTargetIntoView(typeSelect, { block: 'center' });
  }
}

/** Open Response → Metadata headers when a response already exists (no Execute). */
export async function prepareMetadataRequestHeadersReading(
  ctx: DemoActionContext,
  headerName: string,
): Promise<void> {
  if (!document.querySelector(GQL.RESPONSE_VIEWER)) return;
  const responseTab = document.querySelector(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
  }
  const metaTab = document.querySelector(GQL.RV_TAB_METADATA);
  if (metaTab?.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RV_TAB_METADATA);
    await ctx.delay(200);
  }
  const toggle = document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS_TOGGLE);
  if (toggle?.getAttribute('aria-expanded') === 'false') {
    await ctx.click(GQL.RV_REQUEST_HEADERS_TOGGLE);
    await ctx.delay(120);
  }
  const rowSelector = GQL.rvMetadataRequestHeaderVal(headerName);
  if (document.querySelector(rowSelector)) {
    const row = document.querySelector(rowSelector);
    if (row instanceof HTMLElement) {
      scrollDemoTargetIntoView(row, { block: 'center' });
    }
  }
}

export async function prepareBearerObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureBearerConfigured(ctx);
  await ensureAuthPanelVisible(ctx);
}

export async function prepareApiKeyConfigReading(ctx: DemoActionContext): Promise<void> {
  await preApiKeyStep(ctx);
}

export async function prepareApiKeyObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyConfigured(ctx);
  await ensureAuthPanelVisible(ctx);
}

export async function prepareBasicConfigReading(ctx: DemoActionContext): Promise<void> {
  await preBasicStep(ctx);
}

export async function prepareBasicObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureBasicConfigured(ctx);
  await ensureAuthPanelVisible(ctx);
}

export async function prepareInheritConfigReading(ctx: DemoActionContext): Promise<void> {
  await preInheritStep(ctx);
  const typeSelect = document.querySelector(GQL.AUTH_TYPE_SELECT);
  if (typeSelect instanceof HTMLElement) {
    scrollDemoTargetIntoView(typeSelect, { block: 'center' });
  }
}

export async function prepareInheritObserveReading(ctx: DemoActionContext): Promise<void> {
  await ensureInheritConfigured(ctx);
  await closeEnvIfOpen(ctx);
  await closeProfileIfOpen(ctx);
  await ensureAuthPanelVisible(ctx);
}

export async function prepareSubscriptionExecReading(ctx: DemoActionContext): Promise<void> {
  await preSubscriptionStep(ctx);
  seedLesson6GlobalAuthProfile();
  await ctx.delay(200);
  if (!isInheritProfileConfigured()) {
    await configureInheritOnly(ctx);
  }
}

export async function prepareSubscriptionObserveReading(ctx: DemoActionContext): Promise<void> {
  await prepareSubscriptionExecReading(ctx);
  // Prefer existing response from the prior exec step — never Execute during Preparing.
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

  // Stay on GraphQL Studio — never open Environment Manager during Preparing.
  await navigateToGraphqlStudio(ctx);

  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(80);
  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(80);
  }

  await ensureGqlDemoTab(ctx, 'gql-auth-headers', 'Authentication & Headers');
  await resetDemoTabToPlainHttp(ctx);
  await ensureDemoTabDirectHttpEndpoint(ctx);
  await configureDemoTabInheritPageAuth(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  // Seed Demo env via bridge (no Env modal tour) before live step 1.
  await ensureEnvReady(ctx);
  await closeEnvIfOpen(ctx);
  // Leave Auth closed so step 1 can show the Auth badge click.
  await closeAuthPanelIfOpen(ctx);
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
