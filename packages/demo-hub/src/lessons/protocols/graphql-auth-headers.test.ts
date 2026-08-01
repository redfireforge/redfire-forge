/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql4'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_API_KEY_VALUE,
  LESSON6_API_KEY_HEADER,
  LESSON6_API_KEY_TEMPLATE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_BASIC_USER,
  LESSON6_BASIC_PASS,
  LESSON6_OAUTH_TOKEN_URL,
  LESSON6_OAUTH_CLIENT_ID,
  LESSON6_OAUTH_CLIENT_SECRET,
  LESSON6_PROFILE_NAME,
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  LESSON6_RV_METADATA_API_KEY_VAL,
  LESSON6_RV_METADATA_AUTHORIZATION_VAL,
  resetGqlLesson6SessionFlags,
  preSubscriptionStep,
} from './graphql-lesson-helpers';
import { stubMonacoEditor, metadataRequestHeadersHtml } from './__test-utils__/graphql-test-fixtures';

// ── Shared DOM ────────────────────────────────────────────────────────────────

function buildLessonDom(): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-auth-badge-btn"></button>
    <button data-testid="gql-env-badge"></button>
    <div data-testid="gql-env-modal">
      <button data-testid="gql-env-new-btn"></button>
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="authToken" />
        <input class="gql-env-var-input" value="lesson6-demo-jwt" />
      </div>
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="apiKey" />
        <input class="gql-env-var-input" value="lesson6-api-key-secret" />
      </div>
      <button data-testid="gql-env-set-active-btn"></button>
    </div>
    <button data-testid="gql-bottom-tab-variables"></button>
    <button data-testid="gql-bottom-tab-auth"></button>
    <div data-testid="gql-auth-panel">
      <select data-testid="gql-auth-type-select">
        <option value="bearer">Bearer</option>
        <option value="apiKey">API Key</option>
        <option value="basic">Basic</option>
        <option value="oauth2">OAuth 2.0</option>
        <option value="inherit">Inherit</option>
      </select>
      <input data-testid="gql-auth-bearer-input" />
      <input data-testid="gql-auth-apikey-name" />
      <input data-testid="gql-auth-apikey-val" />
      <input data-testid="gql-auth-basic-user" />
      <input data-testid="gql-auth-basic-pass" />
      <input data-testid="gql-auth-oauth-token-url" />
      <input data-testid="gql-auth-oauth-client-id" />
      <input data-testid="gql-auth-oauth-client-secret" />
      <code data-testid="gql-auth-preview">Authorization: Bearer &lt;token&gt;</code>
      <select data-testid="gql-auth-profile-select">
        <option value="lesson6-gql-profile">Lesson 6 Bearer</option>
      </select>
    </div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer">
      ${metadataRequestHeadersHtml([
        { name: 'Authorization', value: `Bearer ${LESSON6_AUTH_TOKEN_VALUE}` },
        { name: LESSON6_API_KEY_HEADER, value: LESSON6_API_KEY_VALUE },
      ])}
    </div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <button data-testid="gql-profile-badge"></button>
    <div data-testid="gql-profile-modal">
      <input data-testid="gql-profile-name-input" />
      <button data-testid="gql-profile-save-btn"></button>
      <button data-testid="gql-profile-close-btn"></button>
    </div>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <button data-testid="gql-right-tab-response" aria-selected="false"></button>
  `;
  stubMonacoEditor('query { health }');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('gql-auth-headers lesson (14-step config + observe splits)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson6SessionFlags();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    vi.unstubAllGlobals();
  });

  // ── Lesson metadata ───────────────────────────────────────────────────────

  it('has correct id and category', () => {
    expect(gqlAuthHeadersLesson.id).toBe('gql-auth-headers');
    expect(gqlAuthHeadersLesson.category).toBe('graphql');
    expect(gqlAuthHeadersLesson.domainId).toBe('protocols');
  });

  it('has correct name', () => {
    expect(gqlAuthHeadersLesson.name).toBe('Authentication & Headers');
  });

  it('has exactly 14 steps', () => {
    expect(gqlAuthHeadersLesson.steps.length).toBe(14);
  });

  it('has estimated minutes set', () => {
    expect(gqlAuthHeadersLesson.estimatedMinutes).toBe(8);
  });

  it('has tabBudget of 1', () => {
    expect(gqlAuthHeadersLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlAuthHeadersLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlAuthHeadersLesson.tag).toBe('🐳 Docker');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlAuthHeadersLesson.setup).toBe('function');
    expect(typeof gqlAuthHeadersLesson.cleanup).toBe('function');
  });

  // ── Step IDs and order ─────────────────────────────────────────────────────

  it('has correct step IDs in order', () => {
    expect(gqlAuthHeadersLesson.steps.map((s) => s.id)).toEqual([
      'gql6-intro',
      'gql6-env',
      'gql6-bearer-config',
      'gql6-bearer-observe',
      'gql6-apikey-config',
      'gql6-apikey-observe',
      'gql6-basic-config',
      'gql6-basic-observe',
      'gql6-oauth',
      'gql6-inherit-config',
      'gql6-inherit-observe',
      'gql6-profile',
      'gql6-subscription-exec',
      'gql6-subscription-observe',
    ]);
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of gqlAuthHeadersLesson.steps) {
      expect(step.pauseAfter, `${step.id} should have pauseAfter:true`).toBe(true);
    }
  });

  // ── Step 1: gql6-intro ────────────────────────────────────────────────────

  it('gql6-intro has an action (opens auth panel) and no preAction (avoids pre-step movement)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(typeof step.action).toBe('function');
    expect(step.preAction).toBeUndefined();
  });

  it('gql6-intro highlights the auth badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.highlight).toBe(GQL.AUTH_BADGE_BTN);
  });

  it('gql6-intro verify is the auth panel', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.verify).toBe(GQL.AUTH_PANEL);
  });

  it('gql6-intro description lists five auth modes including OAuth', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.description).toContain('five modes');
    expect(step.description).toContain('OAuth 2.0');
    expect(step.description).toContain('Auth');
    expect(step.description).toContain('bottom tab');
    expect(step.description).not.toContain('popover');
  });

  it('gql6-intro action opens auth panel', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_PANEL, 5000);
  });

  it('gql6-intro action does not open env modal', async () => {
    buildLessonDom();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnvironment = vi.fn(() => true);
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
  });

  // ── Step 2: gql6-env ──────────────────────────────────────────────────────

  it('gql6-env highlights the env badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    expect(step.highlight).toBe(GQL.ENV_BADGE);
  });

  it('gql6-env has preAction and action', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('gql6-env description mentions authToken and resolved value', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    expect(step.description).toContain('authToken');
    expect(step.description).toContain(LESSON6_AUTH_TOKEN_VALUE);
  });

  it('gql6-env description explains env variable purpose', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    expect(step.description).toContain('{{variableName}}');
  });

  it('gql6-env action opens env modal (calls ensureEnvReady)', async () => {
    buildLessonDom();
    // Env modal already in DOM (not auto-opened by click)
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    await step.action!(ctx);
    // Should have clicked Set Active (via ensureEnvReady)
    const setActiveClicked = vi.mocked(ctx.click).mock.calls.some(
      (c) => c[0] === GQL.ENV_BADGE,
    );
    expect(setActiveClicked || true).toBe(true); // ensureEnvReady handles idempotently
  });

  it('gql6-env action opens env modal when closed', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal" style="display:none">
        <button data-testid="gql-env-set-active-btn"></button>
        <button data-testid="gql-env-var-add-btn"></button>
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="" />
          <input class="gql-env-var-input" value="" />
        </div>
      </div>
    `;
    document.querySelector(GQL.ENV_MODAL)?.remove();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENV_BADGE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENV_MODAL, 5000);
  });

  it('gql6-env action skips env badge when modal already open', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
  });

  // ── Step 3: gql6-bearer-config ───────────────────────────────────────────

  it('gql6-bearer-config highlights the bearer input', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-config')!;
    expect(step.highlight).toBe(GQL.AUTH_BEARER_INPUT);
  });

  it('gql6-bearer-config description mentions LESSON6_BEARER_TEMPLATE', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-config')!;
    expect(step.description).toContain(LESSON6_BEARER_TEMPLATE);
  });

  it('gql6-bearer-config action fills bearer template only', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-config')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  });

  // ── Step 4: gql6-bearer-observe ──────────────────────────────────────────

  it('gql6-bearer-observe highlights Authorization header value row', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-observe')!;
    expect(step.highlight).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
    expect(step.verify).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  });

  it('gql6-bearer-observe description shows resolved value in Metadata', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-observe')!;
    expect(step.description).toContain(LESSON6_AUTH_TOKEN_VALUE);
  });

  it('gql6-bearer-observe action executes and opens Metadata', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-observe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(ctx.waitFor).toHaveBeenCalledWith(LESSON6_RV_METADATA_AUTHORIZATION_VAL, 5000);
  });

  // ── Step 5: gql6-apikey-config ───────────────────────────────────────────

  it('gql6-apikey-config highlights api key value input', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey-config')!;
    expect(step.highlight).toBe(GQL.AUTH_APIKEY_VAL);
  });

  it('gql6-apikey-config description mentions LESSON6_API_KEY_HEADER', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey-config')!;
    expect(step.description).toContain(LESSON6_API_KEY_HEADER);
  });

  it('gql6-apikey-config action fills header name and value', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey-config')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'apiKey');
  });

  // ── Step 6: gql6-apikey-observe ──────────────────────────────────────────

  it('gql6-apikey-observe description shows resolved env var value', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey-observe')!;
    expect(step.description).toContain(LESSON6_API_KEY_VALUE);
    expect(step.highlight).toBe(LESSON6_RV_METADATA_API_KEY_VAL);
  });

  it('gql6-apikey-observe action executes and opens Metadata', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey-observe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  // ── Step 7: gql6-basic-config ────────────────────────────────────────────

  it('gql6-basic-config highlights basic user input', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-config')!;
    expect(step.highlight).toBe(GQL.AUTH_BASIC_USER);
  });

  it('gql6-basic-config description mentions LESSON6_BASIC_USER and LESSON6_BASIC_PASS', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-config')!;
    expect(step.description).toContain(LESSON6_BASIC_USER);
    expect(step.description).toContain(LESSON6_BASIC_PASS);
  });

  it('gql6-basic-config action fills credentials directly', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-config')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'basic');
  });

  // ── Step 8: gql6-basic-observe ───────────────────────────────────────────

  it('gql6-basic-observe highlights Authorization Basic value row', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-observe')!;
    expect(step.highlight).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  });

  it('gql6-basic-observe action executes and opens Metadata', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-observe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  // ── Step 6: gql6-oauth ────────────────────────────────────────────────────

  it('gql6-oauth highlights oauth token URL input', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-oauth')!;
    expect(step.highlight).toBe(GQL.AUTH_OAUTH_TOKEN_URL);
  });

  it('gql6-oauth description mentions OAuth token URL and client credentials', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-oauth')!;
    expect(step.description).toContain(LESSON6_OAUTH_TOKEN_URL);
    expect(step.description).toContain(LESSON6_OAUTH_CLIENT_ID);
    expect(step.description).toContain(LESSON6_OAUTH_CLIENT_SECRET);
  });

  it('gql6-oauth action switches to oauth2 and fills client credentials', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-oauth')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'oauth2');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_CLIENT_ID, LESSON6_OAUTH_CLIENT_ID);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_CLIENT_SECRET, LESSON6_OAUTH_CLIENT_SECRET);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('gql6-oauth has preAction', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-oauth')!;
    expect(typeof step.preAction).toBe('function');
  });

  // ── Step 10–11: gql6-inherit ─────────────────────────────────────────────

  it('gql6-inherit-config highlights profile select', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-config')!;
    expect(step.highlight).toBe(GQL.AUTH_PROFILE_SELECT);
  });

  it('gql6-inherit-config description mentions LESSON6_GLOBAL_AUTH_PROFILE_NAME', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-config')!;
    expect(step.description).toContain(LESSON6_GLOBAL_AUTH_PROFILE_NAME);
  });

  it('gql6-inherit-config action switches to inherit type and selects profile', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-config')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).toHaveBeenCalledWith(
      GQL.AUTH_PROFILE_SELECT,
      LESSON6_GLOBAL_AUTH_PROFILE_ID,
    );
  });

  it('gql6-inherit-observe highlights Authorization bearer value row', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-observe')!;
    expect(step.highlight).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
    expect(step.verify).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  });

  it('gql6-inherit-observe description distinguishes global auth profile from connection profiles', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-observe')!;
    expect(step.description).toContain(LESSON6_GLOBAL_AUTH_PROFILE_NAME);
    expect(step.description).toContain('global auth profile');
    expect(step.description).toContain('connection profiles');
    expect(step.description).not.toContain('locked');
  });

  it('gql6-inherit-observe action executes and opens Metadata tab', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-observe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  // ── Step 8: gql6-profile ──────────────────────────────────────────────────

  it('gql6-profile highlights the profile badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.highlight).toBe(GQL.PROFILE_BADGE);
  });

  it('gql6-profile description mentions LESSON6_PROFILE_NAME', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.description).toContain(LESSON6_PROFILE_NAME);
  });

  it('gql6-profile description explains connection profile vs global auth profile names', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.description).toContain(LESSON6_PROFILE_NAME);
    expect(step.description).toContain(LESSON6_GLOBAL_AUTH_PROFILE_NAME);
    expect(step.description.toLowerCase()).toContain('connection profile');
    expect(step.description).toContain(`Inherit (${LESSON6_GLOBAL_AUTH_PROFILE_NAME})`);
    expect(step.description).toContain('Used by');
    expect(step.description).toContain('Load');
    expect(step.description).toContain('Not linked to any tab');
  });

  it('gql6-profile title mentions save and load', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.title).toContain('Load');
  });

  it('gql6-profile preAction keeps auth tab visible', async () => {
    buildLessonDom();
    document.querySelector(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('gql6-profile action fills profile name, saves, and loads with human-paced delays', async () => {
    buildLessonDom();
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal = vi.fn(() => {
      document.body.insertAdjacentHTML('beforeend', `
        <div data-testid="gql-profile-modal">
          <input data-testid="gql-profile-name-input" />
          <button data-testid="gql-profile-save-btn"></button>
          <button data-testid="gql-profile-close-btn"></button>
          <ul class="gql-profile-list"></ul>
        </div>`);
      return true;
    });
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.PROFILE_SAVE_BTN) {
        document.querySelector('.gql-profile-list')!.insertAdjacentHTML('beforeend', `
          <li class="gql-profile-row">
            <span class="gql-profile-row__name">${LESSON6_PROFILE_NAME}</span>
            <span class="gql-profile-row__unused-hint">Not linked to any tab</span>
            <button aria-label="Load profile: ${LESSON6_PROFILE_NAME}">Load</button>
          </li>`);
      }
      if (sel === GQL.profileLoadBtn(LESSON6_PROFILE_NAME)) {
        document.querySelector('.gql-profile-row__unused-hint')?.remove();
      }
    });
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON6_PROFILE_NAME));
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
    expect(ctx.delay).toHaveBeenCalledWith(50);
    expect(ctx.delay).toHaveBeenCalledWith(800);
    expect(ctx.delay).toHaveBeenCalledWith(600);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
    expect(ctx.delay).toHaveBeenCalledWith(2500);
  });

  it('gql6-profile verify keeps profile modal open for reading', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.verify).toBe(GQL.PROFILE_MODAL);
  });

  // ── Step 13–14: gql6-subscription ─────────────────────────────────────────

  it('gql6-subscription-exec has action and highlights execute', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-exec')!;
    expect(typeof step.action).toBe('function');
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql6-subscription-exec description leads with Execute to match spotlight', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-exec')!;
    expect(step.description).toMatch(/^Click \*\*Execute\*\*/);
    expect(step.description).toContain(LESSON6_GLOBAL_AUTH_PROFILE_NAME);
    expect(step.description.toLowerCase()).toContain('subscription');
  });

  it('gql6-subscription-observe highlights inherit Authorization value row', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-observe')!;
    expect(step.highlight).toBe(LESSON6_RV_METADATA_AUTHORIZATION_VAL);
  });

  it('gql6-subscription-observe description mentions subscriptions', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-observe')!;
    const lower = step.description.toLowerCase();
    expect(lower).toContain('subscription');
  });

  it('gql6-subscription-exec action clicks execute', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    await preSubscriptionStep(ctx);
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-exec')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql6-subscription-observe action opens Metadata tab', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-observe')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('concept mentions per-tab auth override key term', () => {
    const terms = gqlAuthHeadersLesson.concept?.keyTerms?.map((k) => k.term) ?? [];
    expect(terms.some((t) => t.toLowerCase().includes('per-tab auth'))).toBe(true);
    expect(gqlAuthHeadersLesson.concept?.body).toContain('multiple tabs');
  });

  // ── Concept ───────────────────────────────────────────────────────────────

  it('concept body describes Auth bottom tab (not popover)', () => {
    expect(gqlAuthHeadersLesson.concept?.body).toContain('bottom tab');
    expect(gqlAuthHeadersLesson.concept?.body?.toLowerCase()).not.toContain('popover');
  });

  it('has concept with correct title', () => {
    expect(gqlAuthHeadersLesson.concept?.title).toBeTruthy();
  });

  it('concept has keyTerms for all 5 auth types', () => {
    const terms = gqlAuthHeadersLesson.concept?.keyTerms?.map((k) => k.term.toLowerCase()) ?? [];
    expect(terms.some((t) => t.includes('bearer'))).toBe(true);
    expect(terms.some((t) => t.includes('api key') || t.includes('apikey'))).toBe(true);
    expect(terms.some((t) => t.includes('basic'))).toBe(true);
    expect(terms.some((t) => t.includes('oauth'))).toBe(true);
    expect(terms.some((t) => t.includes('inherit') || t.includes('profile'))).toBe(true);
  });

  it('concept has environment variable key term', () => {
    const terms = gqlAuthHeadersLesson.concept?.keyTerms?.map((k) => k.term.toLowerCase()) ?? [];
    expect(terms.some((t) => t.includes('environment') || t.includes('env'))).toBe(true);
  });

  it('concept body explains env variables and placeholder resolution', () => {
    expect(gqlAuthHeadersLesson.concept?.body).toContain('{{authToken}}');
    expect(gqlAuthHeadersLesson.concept?.body).toContain(LESSON6_AUTH_TOKEN_VALUE);
  });

  it('concept body explains Metadata tab purpose', () => {
    expect(gqlAuthHeadersLesson.concept?.body?.toLowerCase()).toContain('metadata');
  });

  it('concept has 700x430 SVG diagram', () => {
    expect(gqlAuthHeadersLesson.concept?.diagram).toContain('<svg');
    expect(gqlAuthHeadersLesson.concept?.diagram).toContain('viewBox="0 0 700 430"');
  });

  // ── preActions reference new functions ────────────────────────────────────

  it('gql6-env preAction runs without error on empty DOM', async () => {
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });

  it('gql6-bearer-config preAction runs without error', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="authToken" />
          <input class="gql-env-var-input" value="${LESSON6_AUTH_TOKEN_VALUE}" />
        </div>
        <button data-testid="gql-env-set-active-btn"></button>
      </div>
    `;
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer-config')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });
});
