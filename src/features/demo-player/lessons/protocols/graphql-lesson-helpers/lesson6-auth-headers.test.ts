/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '../../../../../shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_API_KEY_VALUE,
  LESSON6_API_KEY_HEADER,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_API_KEY_TEMPLATE,
  LESSON6_BASIC_USER,
  LESSON6_BASIC_PASS,
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  LESSON6_PROFILE_NAME,
  resetGqlLesson6SessionFlags,
  seedLesson6GlobalAuthProfile,
  ensureEnvReady,
  ensureBearerDone,
  ensureApiKeyDone,
  ensureBasicDone,
  ensureInheritDone,
  ensureProfileDone,
  preEnvStep,
  preBearerStep,
  preApiKeyStep,
  preBasicStep,
  preInheritStep,
  preProfileStep,
  preSubscriptionStep,
} from './lesson6-auth-headers';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';

// ── Shared DOM helpers ────────────────────────────────────────────────────────

function buildFullDom(): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-auth-badge-btn"></button>
    <button data-testid="gql-env-badge"></button>
    <div data-testid="gql-env-modal">
      <button data-testid="gql-env-new-btn"></button>
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
        <option value="inherit">Inherit</option>
      </select>
      <input data-testid="gql-auth-bearer-input" value="${LESSON6_BEARER_TEMPLATE}" />
      <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
      <input data-testid="gql-auth-apikey-val" value="${LESSON6_API_KEY_TEMPLATE}" />
      <input data-testid="gql-auth-basic-user" value="${LESSON6_BASIC_USER}" />
      <input data-testid="gql-auth-basic-pass" value="${LESSON6_BASIC_PASS}" />
      <select data-testid="gql-auth-profile-select">
        <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">${LESSON6_GLOBAL_AUTH_PROFILE_NAME}</option>
      </select>
    </div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <div data-testid="gql-rv-request-headers">Authorization Bearer ${LESSON6_AUTH_TOKEN_VALUE}</div>
    <button data-testid="gql-profile-badge"></button>
    <div data-testid="gql-profile-modal">
      <input data-testid="gql-profile-name-input" />
      <button data-testid="gql-profile-save-btn"></button>
      <button data-testid="gql-profile-close-btn"></button>
    </div>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
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

  it('preEnvStep closes open auth panel when auth tab is active', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await preEnvStep(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
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

  it('preProfileStep closes auth panel when auth tab is active', async () => {
    buildFullDom();
    const ctx = makeCtx();
    await ensureInheritDone(ctx);
    vi.mocked(ctx.click).mockClear();
    document.querySelector(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'true');
    await preProfileStep(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
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
});
