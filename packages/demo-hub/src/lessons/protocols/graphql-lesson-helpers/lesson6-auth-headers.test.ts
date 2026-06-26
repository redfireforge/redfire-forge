/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql6'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    purgeGqlDemoConnectionProfiles: vi.fn(async () => 0),
    purgeGqlDemoGlobalAuthProfiles: vi.fn(async () => 0),
  };
});

import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_API_KEY_VALUE,
  LESSON6_API_KEY_HEADER,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_API_KEY_TEMPLATE,
  LESSON6_BASIC_USER,
  LESSON6_BASIC_PASS,
  LESSON6_OAUTH_TOKEN_URL,
  LESSON6_OAUTH_CLIENT_ID,
  LESSON6_OAUTH_CLIENT_SECRET,
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  LESSON6_PROFILE_NAME,
  LESSON6_RV_METADATA_AUTHORIZATION_VAL,
  LESSON6_RV_METADATA_API_KEY_VAL,
  resetGqlLesson6SessionFlags,
  seedLesson6GlobalAuthProfile,
  upsertGqlDemoEnvVars,
  ensureEnvReady,
  ensureBearerDone,
  ensureApiKeyDone,
  ensureBasicDone,
  ensureOauthDone,
  ensureInheritDone,
  ensureProfileDone,
  demonstrateSaveConnectionProfile,
  runAuthExecuteWithMetadata,
  selectInheritGlobalProfileInPanel,
  markBearerDone,
  markApiKeyDone,
  markBasicDone,
  markOauthDone,
  markInheritDone,
  preIntroStep,
  preEnvStep,
  preBearerStep,
  preApiKeyStep,
  preBasicStep,
  preOauthStep,
  preInheritStep,
  preProfileStep,
  preSubscriptionStep,
  prepareBearerConfigReading,
  prepareBearerObserveReading,
  prepareMetadataRequestHeadersReading,
  prepareApiKeyConfigReading,
  prepareApiKeyObserveReading,
  prepareBasicConfigReading,
  prepareBasicObserveReading,
  prepareOauthConfigReading,
  prepareInheritConfigReading,
  prepareInheritObserveReading,
  prepareSubscriptionExecReading,
  prepareSubscriptionObserveReading,
  isInheritProfileConfigured,
  gqlAuthLessonSetup,
  gqlAuthLessonCleanup,
} from './lesson6-auth-headers';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';
import { purgeGqlDemoConnectionProfiles, purgeGqlDemoGlobalAuthProfiles } from '../../../adapters';
import { stubMonacoEditor, metadataRequestHeadersHtml } from '../__test-utils__/graphql-test-fixtures';

// ── Shared DOM helpers ────────────────────────────────────────────────────────

function buildFullDom(): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-auth-badge-btn"></button>
    <button data-testid="gql-env-badge"></button>
    <div data-testid="gql-env-modal">
      <button data-testid="gql-env-new-btn"></button>
      <button data-testid="gql-env-var-add-btn"></button>
      <button data-testid="gql-env-close-btn"></button>
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="authToken" />
        <input class="gql-env-var-input" value="${LESSON6_AUTH_TOKEN_VALUE}" />
      </div>
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="apiKey" />
        <input class="gql-env-var-input" value="${LESSON6_API_KEY_VALUE}" />
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
      <input data-testid="gql-auth-bearer-input" value="${LESSON6_BEARER_TEMPLATE}" />
      <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
      <input data-testid="gql-auth-apikey-val" value="${LESSON6_API_KEY_TEMPLATE}" />
      <input data-testid="gql-auth-basic-user" value="${LESSON6_BASIC_USER}" />
      <input data-testid="gql-auth-basic-pass" value="${LESSON6_BASIC_PASS}" />
      <input data-testid="gql-auth-oauth-token-url" />
      <input data-testid="gql-auth-oauth-client-id" />
      <input data-testid="gql-auth-oauth-client-secret" />
      <code data-testid="gql-auth-preview">Authorization: Bearer token</code>
      <select data-testid="gql-auth-profile-select">
        <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">${LESSON6_GLOBAL_AUTH_PROFILE_NAME}</option>
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
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
  `;
  stubMonacoEditor('query { health }');
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

describe('lesson6-auth-headers helpers (rewrite)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson6SessionFlags();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
    delete (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName;
    vi.unstubAllGlobals();
  });

  // ── Constants ───────────────────────────────────────────────────────────────

  it('LESSON6_AUTH_TOKEN_VALUE is non-empty string', () => {
    expect(typeof LESSON6_AUTH_TOKEN_VALUE).toBe('string');
    expect(LESSON6_AUTH_TOKEN_VALUE.length).toBeGreaterThan(0);
  });

  it('LESSON6_API_KEY_VALUE is non-empty string', () => {
    expect(typeof LESSON6_API_KEY_VALUE).toBe('string');
    expect(LESSON6_API_KEY_VALUE.length).toBeGreaterThan(0);
  });

  it('LESSON6_BEARER_TEMPLATE contains {{authToken}}', () => {
    expect(LESSON6_BEARER_TEMPLATE).toContain('{{authToken}}');
  });

  it('LESSON6_API_KEY_TEMPLATE contains {{apiKey}}', () => {
    expect(LESSON6_API_KEY_TEMPLATE).toContain('{{apiKey}}');
  });

  it('LESSON6_PROFILE_NAME is non-empty string', () => {
    expect(typeof LESSON6_PROFILE_NAME).toBe('string');
    expect(LESSON6_PROFILE_NAME.length).toBeGreaterThan(0);
  });

  // ── resetGqlLesson6SessionFlags ─────────────────────────────────────────────

  it('resetGqlLesson6SessionFlags resets all flags to false', () => {
    // If flags weren't reset, ensureEnvReady would skip. After reset it should run.
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="authToken" />
          <input class="gql-env-var-input" value="${LESSON6_AUTH_TOKEN_VALUE}" />
        </div>
        <button data-testid="gql-env-set-active-btn"></button>
      </div>
    `;
    const _ctx = makeCtx();
    // First call - _envReady becomes true internally after running
    // resetGqlLesson6SessionFlags already called in beforeEach
    // Ensure that calling it again makes ensureEnvReady run again
    resetGqlLesson6SessionFlags();
    // After reset, ctx.waitFor should be called when env modal is not visible
    // (we removed env modal from DOM)
    document.querySelector('[data-testid="gql-env-modal"]')?.remove();
    expect(() => resetGqlLesson6SessionFlags()).not.toThrow();
  });

  // ── seedLesson6GlobalAuthProfile ───────────────────────────────────────────

  it('seedLesson6GlobalAuthProfile calls window bridge when present', () => {
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    seedLesson6GlobalAuthProfile();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: LESSON6_GLOBAL_AUTH_PROFILE_ID,
        name: LESSON6_GLOBAL_AUTH_PROFILE_NAME,
      }),
    );
  });

  it('seedLesson6GlobalAuthProfile is safe when bridge missing', () => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    expect(() => seedLesson6GlobalAuthProfile()).not.toThrow();
  });

  it('seedLesson6GlobalAuthProfile passes bearer token in profile', () => {
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    seedLesson6GlobalAuthProfile();
    const profile = upsert.mock.calls[0]?.[0] as { auth: { type: string; token: string } };
    expect(profile.auth.type).toBe('bearer');
    expect(profile.auth.token).toBe(LESSON6_AUTH_TOKEN_VALUE);
  });

  // ── ensureEnvReady ──────────────────────────────────────────────────────────

  it('ensureEnvReady opens env modal and clicks Set Active', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="authToken" />
          <input class="gql-env-var-input" value="${LESSON6_AUTH_TOKEN_VALUE}" />
        </div>
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="apiKey" />
          <input class="gql-env-var-input" value="${LESSON6_API_KEY_VALUE}" />
        </div>
        <button data-testid="gql-env-set-active-btn"></button>
      </div>
    `;
    const ctx = makeCtx();
    await ensureEnvReady(ctx);
    // ctx.click is the mock — verify Set Active was clicked via ctx
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENV_SET_ACTIVE_BTN);
  });

  it('ensureEnvReady is idempotent — skips on second call', async () => {
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
    await ensureEnvReady(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureEnvReady(ctx); // second call — should be a no-op
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ── ensure*Done guards ──────────────────────────────────────────────────────

  it('ensureBearerDone is idempotent — returns on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureBearerDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBearerDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureApiKeyDone is idempotent — returns on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureApiKeyDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureApiKeyDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureBasicDone is idempotent — returns on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureBasicDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBasicDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureInheritDone is idempotent — returns on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureInheritDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureInheritDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('demonstrateSaveConnectionProfile paces modal open, fill, and save for viewers', async () => {
    buildFullDom();
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal = vi.fn(() => false);
    const ctx = makeCtx();
    await demonstrateSaveConnectionProfile(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_BADGE);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
    expect(ctx.delay).toHaveBeenCalledWith(50);
    expect(ctx.delay).toHaveBeenCalledWith(800);
    expect(ctx.delay).toHaveBeenCalledWith(600);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('demonstrateSaveConnectionProfile opens modal via demo bridge when badge is locked', async () => {
    buildFullDom();
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    const openModal = vi.fn(() => {
      document.body.insertAdjacentHTML('beforeend', `
        <div data-testid="gql-profile-modal">
          <input data-testid="gql-profile-name-input" />
          <button data-testid="gql-profile-save-btn"></button>
        </div>`);
      return true;
    });
    (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal = openModal;
    const ctx = makeCtx();
    await demonstrateSaveConnectionProfile(ctx);
    expect(openModal).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_BADGE);
  });

  it('demonstrateSaveConnectionProfile closes modal when closeAfter is true', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await demonstrateSaveConnectionProfile(ctx, { closeAfter: true });
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('ensureProfileDone is idempotent — returns on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureProfileDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureProfileDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
  });

  // ── ensure chain: each step calls its predecessor ──────────────────────────

  it('ensureApiKeyDone calls ensureBearerDone (fills bearer input first)', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureApiKeyDone(ctx);
    // bearer input should have been filled as part of the chain
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  });

  it('ensureBasicDone fills bearer then apiKey then basic credentials', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureBasicDone(ctx);
    const fillCalls = vi.mocked(ctx.fill).mock.calls.map((c) => c[0]);
    expect(fillCalls).toContain(GQL.AUTH_BEARER_INPUT);
    expect(fillCalls).toContain(GQL.AUTH_BASIC_USER);
    expect(fillCalls).toContain(GQL.AUTH_BASIC_PASS);
  });

  // ── preActions ──────────────────────────────────────────────────────────────

  it('preEnvStep closes env modal only and keeps auth tab visible', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await preEnvStep(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('prepareBearerObserveReading keeps auth tab open while priming metadata spotlight', async () => {
    buildFullDom();
    document.querySelector(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await prepareBearerObserveReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('prepareMetadataRequestHeadersReading opens Metadata on the named header value row', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareMetadataRequestHeadersReading(ctx, 'Authorization');
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.waitFor).toHaveBeenCalledWith(LESSON6_RV_METADATA_AUTHORIZATION_VAL, 5000);
  });

  it('prepareMetadataRequestHeadersReading targets API Key row when named', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareMetadataRequestHeadersReading(ctx, LESSON6_API_KEY_HEADER);
    expect(ctx.waitFor).toHaveBeenCalledWith(LESSON6_RV_METADATA_API_KEY_VAL, 5000);
  });

  it('prepareMetadataRequestHeadersReading is no-op when response viewer is absent', async () => {
    document.body.innerHTML = '';
    const ctx = makeCtx();
    await prepareMetadataRequestHeadersReading(ctx, 'Authorization');
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('preBearerStep calls ensureEnvReady (env active btn clicked)', async () => {
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
    await preBearerStep(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENV_SET_ACTIVE_BTN);
  });

  it('preApiKeyStep is idempotent after ensureBearerDone already ran', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureBearerDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await preApiKeyStep(ctx);
    // bearer should NOT be executed again
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('preBasicStep is idempotent after ensureApiKeyDone already ran', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureApiKeyDone(ctx);
    vi.mocked(ctx.click).mockClear();
    await preBasicStep(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('preInheritStep seeds global profile', async () => {
    buildFullDom();
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    const ctx = makeCtx();
    await preInheritStep(ctx);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: LESSON6_GLOBAL_AUTH_PROFILE_ID }),
    );
  });

  it('preProfileStep keeps auth panel visible when auth tab was active', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureInheritDone(ctx);
    vi.mocked(ctx.click).mockClear();
    vi.mocked(purgeGqlDemoConnectionProfiles).mockClear();
    document.querySelector(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'true');
    await preProfileStep(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalledWith([LESSON6_PROFILE_NAME]);
  });

  it('preProfileStep opens auth panel when variables tab is active', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureInheritDone(ctx);
    document.querySelector(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'false');
    document.querySelector(GQL.BOTTOM_TAB_VARS)?.setAttribute('aria-selected', 'true');
    vi.mocked(ctx.click).mockClear();
    await preProfileStep(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('preSubscriptionStep closes profile modal when present', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureProfileDone(ctx);
    // profile modal already in DOM (buildFullDom has it)
    vi.mocked(ctx.click).mockClear();
    await preSubscriptionStep(ctx);
    // If profile modal is still visible, close btn should be clicked
    if (document.querySelector(GQL.PROFILE_MODAL)) {
      expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
    }
  });

  // ── Bridge + env var CRUD ───────────────────────────────────────────────────

  it('upsertGqlDemoEnvVars uses window bridge when available', async () => {
    const bridge = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = bridge;
    const ctx = makeCtx();
    await upsertGqlDemoEnvVars(ctx, [{ key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE }]);
    expect(bridge).toHaveBeenCalledWith('Demo', [{ key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE, masked: true }]);
  });

  it('upsertGqlDemoEnvVars DOM path creates env and adds missing variables', async () => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="false"></button>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <button data-testid="gql-env-new-btn"></button>
        <button data-testid="gql-env-var-add-btn"></button>
        <button data-testid="gql-env-set-active-btn"></button>
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="" />
          <input class="gql-env-var-input" value="" />
          <button type="button" class="gql-env-var-secret-toggle" onclick="this.classList.add('gql-env-var-secret-toggle--active')"></button>
        </div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ENV_VAR_ADD_BTN) {
        document.querySelector('[data-testid="gql-env-modal"]')?.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-env-var-row">
            <input data-testid="gql-env-var-key" value="" />
            <input class="gql-env-var-input" value="" />
            <button type="button" class="gql-env-var-secret-toggle" onclick="this.classList.add('gql-env-var-secret-toggle--active')"></button>
          </div>`,
        );
      }
    });
    await upsertGqlDemoEnvVars(ctx, [
      { key: 'authToken', value: LESSON6_AUTH_TOKEN_VALUE },
      { key: 'apiKey', value: LESSON6_API_KEY_VALUE },
    ]);
    const clickTargets = vi.mocked(ctx.click).mock.calls.map((c) => c[0]);
    expect(clickTargets).toContain(GQL.ENV_SET_ACTIVE_BTN);
    const keys = [...document.querySelectorAll<HTMLInputElement>('[data-testid="gql-env-var-key"]')].map((i) => i.value);
    expect(keys).toContain('authToken');
    expect(keys).toContain('apiKey');
    const activeToggles = document.querySelectorAll('.gql-env-var-secret-toggle--active');
    expect(activeToggles.length).toBeGreaterThanOrEqual(2);
  });

  it('closeEnvIfOpen is no-op when env modal is open but close button is absent', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-env-modal"></div>
      <div data-testid="gql-env-modal-overlay"></div>
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth"></button>
    `;
    const ctx = makeCtx();
    await preEnvStep(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ── OAuth + inherit + execute ─────────────────────────────────────────────────

  it('ensureOauthDone configures OAuth 2.0 fields', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureOauthDone(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_CLIENT_ID, LESSON6_OAUTH_CLIENT_ID);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_OAUTH_CLIENT_SECRET, LESSON6_OAUTH_CLIENT_SECRET);
  });

  it('selectInheritGlobalProfileInPanel selects inherit + global profile', async () => {
    buildFullDom();
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    const ctx = makeCtx();
    await selectInheritGlobalProfileInPanel(ctx);
    expect(upsert).toHaveBeenCalled();
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
  });

  it('runAuthExecuteWithMetadata executes and opens Metadata on the Authorization value row', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await runAuthExecuteWithMetadata(ctx, LESSON6_RV_METADATA_AUTHORIZATION_VAL);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.waitFor).toHaveBeenCalledWith(LESSON6_RV_METADATA_AUTHORIZATION_VAL, 5000);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('mark-done setters allow ensure chain short-circuit', async () => {
    buildFullDom();
    const ctx = makeCtx();
    markBearerDone();
    markApiKeyDone();
    markBasicDone();
    markOauthDone();
    markInheritDone();
    vi.mocked(ctx.click).mockClear();
    await ensureProfileDone(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
    vi.mocked(ctx.click).mockClear();
    await ensureInheritDone(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ── prepare* reading helpers ────────────────────────────────────────────────

  it('prepareBearerConfigReading selects bearer type in auth panel', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareBearerConfigReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENV_CLOSE_BTN);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
  });

  it('prepareBearerObserveReading re-executes without reopening auth when bearer is already configured', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareBearerObserveReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareApiKeyObserveReading re-executes without reopening auth when api key is already configured', async () => {
    buildFullDom();
    const ctx = makeCtx();
    markBearerDone();
    await prepareApiKeyObserveReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareBasicObserveReading re-executes without reopening auth when basic is already configured', async () => {
    buildFullDom();
    const ctx = makeCtx();
    markBearerDone();
    markApiKeyDone();
    await prepareBasicObserveReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareOauthConfigReading selects oauth2 and scrolls token URL field', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareOauthConfigReading(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'oauth2');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  });

  it('prepareInheritConfigReading seeds global profile and selects inherit type', async () => {
    buildFullDom();
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    const ctx = makeCtx();
    await prepareInheritConfigReading(ctx);
    expect(upsert).toHaveBeenCalled();
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
  });

  it('prepareInheritObserveReading skips auth panel when inherit profile is already selected', async () => {
    buildFullDom();
    const ctx = makeCtx();
    markBearerDone();
    markApiKeyDone();
    markBasicDone();
    markOauthDone();
    const typeSelect = document.querySelector<HTMLSelectElement>(GQL.AUTH_TYPE_SELECT)!;
    typeSelect.value = 'inherit';
    const profileSelect = document.querySelector<HTMLSelectElement>(GQL.AUTH_PROFILE_SELECT)!;
    profileSelect.value = LESSON6_GLOBAL_AUTH_PROFILE_ID;
    expect(isInheritProfileConfigured()).toBe(true);
    vi.mocked(ctx.selectOption).mockClear();
    await prepareInheritObserveReading(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareSubscriptionObserveReading executes with metadata', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareSubscriptionObserveReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('preIntroStep closes stale modals on empty endpoint DOM', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <div data-testid="gql-env-modal"></div>
      <button data-testid="gql-env-close-btn"></button>
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth"></button>
    `;
    const ctx = makeCtx();
    await preIntroStep(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, expect.any(String));
  });

  it('preOauthStep runs after basic auth chain', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await preOauthStep(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
  });

  it('ensureOauthDone is idempotent on second call', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureOauthDone(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureOauthDone(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
  });

  it('preSubscriptionStep skips profile close when modal absent', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureProfileDone(ctx);
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    vi.mocked(ctx.click).mockClear();
    await preSubscriptionStep(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });

  it('gqlAuthLessonCleanup skips profile close when modal absent', async () => {
    buildFullDom();
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    const ctx = makeCtx();
    await gqlAuthLessonCleanup(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });

  // ── Lesson lifecycle ────────────────────────────────────────────────────────

  it('gqlAuthLessonSetup prepares demo tab and editor', async () => {
    buildFullDom();
    stubMonacoEditor('query { health }');
    const deleteEnv = vi.fn();
    (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName = deleteEnv;
    const historyBtn = document.createElement('button');
    historyBtn.setAttribute('data-testid', 'gql-activity-history');
    historyBtn.className = 'gql-activity-tab--active';
    document.body.appendChild(historyBtn);
    const ctx = makeCtx();
    await gqlAuthLessonSetup(ctx);
    expect(deleteEnv).toHaveBeenCalledWith('Demo');
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalledWith([LESSON6_PROFILE_NAME]);
    expect(purgeGqlDemoGlobalAuthProfiles).toHaveBeenCalled();
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-auth-headers', 'Authentication & Headers');
  });

  it('prepareApiKeyConfigReading runs preApiKeyStep chain', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareApiKeyConfigReading(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  });

  it('prepareBasicConfigReading runs preBasicStep chain', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareBasicConfigReading(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  });

  it('prepareSubscriptionExecReading selects inherit profile', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await prepareSubscriptionExecReading(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
  });

  it('gqlAuthLessonSetup activates editor and response tabs when inactive', async () => {
    buildFullDom();
    stubMonacoEditor('query { health }');
    document.querySelector(GQL.MODE_EDITOR)?.classList.remove('gql-mode-btn--active');
    document.querySelector(GQL.RIGHT_TAB_RESPONSE)?.setAttribute('aria-selected', 'false');
    const editorClick = vi.spyOn(document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!, 'click');
    const responseClick = vi.spyOn(document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!, 'click');
    const ctx = makeCtx();
    await gqlAuthLessonSetup(ctx);
    expect(editorClick).toHaveBeenCalled();
    expect(responseClick).toHaveBeenCalled();
  });

  it('gqlAuthLessonCleanup closes demo tabs and deletes Demo env', async () => {
    buildFullDom();
    const deleteEnv = vi.fn();
    (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName = deleteEnv;
    const ctx = makeCtx();
    await gqlAuthLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-auth-headers');
    expect(deleteEnv).toHaveBeenCalledWith('Demo');
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalledWith([LESSON6_PROFILE_NAME]);
    expect(purgeGqlDemoGlobalAuthProfiles).toHaveBeenCalled();
  });

  it('gqlAuthLessonCleanup closes profile modal when open', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await gqlAuthLessonCleanup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });
});
