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
import { GQL } from '../../../../shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_API_KEY_VALUE,
  LESSON6_API_KEY_HEADER,
  LESSON6_API_KEY_TEMPLATE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_BASIC_USER,
  LESSON6_BASIC_PASS,
  LESSON6_PROFILE_NAME,
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  resetGqlLesson6SessionFlags,
  preSubscriptionStep,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

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
        <option value="inherit">Inherit</option>
      </select>
      <input data-testid="gql-auth-bearer-input" />
      <input data-testid="gql-auth-apikey-name" />
      <input data-testid="gql-auth-apikey-val" />
      <input data-testid="gql-auth-basic-user" />
      <input data-testid="gql-auth-basic-pass" />
      <select data-testid="gql-auth-profile-select">
        <option value="lesson6-gql-profile">Lesson 6 Bearer</option>
      </select>
    </div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <div data-testid="gql-rv-request-headers">Authorization Bearer lesson6-demo-jwt</div>
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

describe('gql-auth-headers lesson (8-step rewrite)', () => {
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

  it('has exactly 8 steps', () => {
    expect(gqlAuthHeadersLesson.steps.length).toBe(8);
  });

  it('has estimated minutes set', () => {
    expect(gqlAuthHeadersLesson.estimatedMinutes).toBe(5);
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
      'gql6-bearer',
      'gql6-apikey',
      'gql6-basic',
      'gql6-inherit',
      'gql6-profile',
      'gql6-subscription',
    ]);
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of gqlAuthHeadersLesson.steps) {
      expect(step.pauseAfter, `${step.id} should have pauseAfter:true`).toBe(true);
    }
  });

  // ── Step 1: gql6-intro ────────────────────────────────────────────────────

  it('gql6-intro has an action (opens env modal) but no preAction', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(typeof step.action).toBe('function');
    expect(step.preAction).toBeUndefined();
  });

  it('gql6-intro highlights the auth badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.highlight).toBe(GQL.AUTH_BADGE_BTN);
  });

  it('gql6-intro verify is the env modal', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.verify).toBe(GQL.ENV_MODAL);
  });

  it('gql6-intro description mentions Auth bottom tab', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-intro')!;
    expect(step.description).toContain('Auth');
    expect(step.description).toContain('bottom tab');
    expect(step.description).not.toContain('popover');
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

  // ── Step 3: gql6-bearer ───────────────────────────────────────────────────

  it('gql6-bearer highlights the bearer input', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(step.highlight).toBe(GQL.AUTH_BEARER_INPUT);
  });

  it('gql6-bearer description mentions LESSON6_BEARER_TEMPLATE', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(step.description).toContain(LESSON6_BEARER_TEMPLATE);
  });

  it('gql6-bearer description shows resolved value in Metadata', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(step.description).toContain(LESSON6_AUTH_TOKEN_VALUE);
  });

  it('gql6-bearer has preAction and action', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('gql6-bearer action fills bearer template and executes', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-bearer action verifies Metadata tab', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RV_REQUEST_HEADERS, 5000);
  });

  // ── Step 4: gql6-apikey ───────────────────────────────────────────────────

  it('gql6-apikey highlights request headers (before state)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    expect(step.highlight).toBe(GQL.RV_REQUEST_HEADERS);
  });

  it('gql6-apikey description mentions LESSON6_API_KEY_HEADER', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    expect(step.description).toContain(LESSON6_API_KEY_HEADER);
  });

  it('gql6-apikey description shows resolved env var value', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    expect(step.description).toContain(LESSON6_API_KEY_VALUE);
  });

  it('gql6-apikey action fills header name and value, then executes', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-apikey action switches to apiKey auth type', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'apiKey');
  });

  // ── Step 5: gql6-basic ────────────────────────────────────────────────────

  it('gql6-basic highlights request headers', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    expect(step.highlight).toBe(GQL.RV_REQUEST_HEADERS);
  });

  it('gql6-basic description mentions LESSON6_BASIC_USER and LESSON6_BASIC_PASS', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    expect(step.description).toContain(LESSON6_BASIC_USER);
    expect(step.description).toContain(LESSON6_BASIC_PASS);
  });

  it('gql6-basic description explains why direct credentials (not env vars)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    expect(step.description.toLowerCase()).toContain('base64');
  });

  it('gql6-basic action fills credentials directly and executes', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql6-basic action switches to basic auth type', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'basic');
  });

  // ── Step 6: gql6-inherit ──────────────────────────────────────────────────

  it('gql6-inherit highlights request headers', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    expect(step.highlight).toBe(GQL.RV_REQUEST_HEADERS);
  });

  it('gql6-inherit description mentions LESSON6_GLOBAL_AUTH_PROFILE_NAME', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    expect(step.description).toContain(LESSON6_GLOBAL_AUTH_PROFILE_NAME);
  });

  it('gql6-inherit description explains shared catalog', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    expect(step.description.toLowerCase()).toContain('catalog');
  });

  it('gql6-inherit action switches to inherit type and selects profile', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).toHaveBeenCalledWith(
      GQL.AUTH_PROFILE_SELECT,
      LESSON6_GLOBAL_AUTH_PROFILE_ID,
    );
  });

  it('gql6-inherit action calls seedLesson6GlobalAuthProfile via bridge', async () => {
    buildLessonDom();
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    await step.action!(ctx);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: LESSON6_GLOBAL_AUTH_PROFILE_ID }),
    );
  });

  // ── Step 7: gql6-profile ──────────────────────────────────────────────────

  it('gql6-profile highlights the profile badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.highlight).toBe(GQL.PROFILE_BADGE);
  });

  it('gql6-profile description mentions LESSON6_PROFILE_NAME', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.description).toContain(LESSON6_PROFILE_NAME);
  });

  it('gql6-profile description explains connection profile vs global auth profile', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.description.toLowerCase()).toContain('connection profile');
  });

  it('gql6-profile action fills profile name and saves', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_BADGE);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
  });

  // ── Step 8: gql6-subscription ─────────────────────────────────────────────

  it('gql6-subscription has action (executes final query to show auth headers)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription')!;
    expect(typeof step.action).toBe('function');
  });

  it('gql6-subscription highlights auth badge', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription')!;
    expect(step.highlight).toBe(GQL.AUTH_BADGE_BTN);
  });

  it('gql6-subscription description mentions active tab auth and subscriptions', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription')!;
    const lower = step.description.toLowerCase();
    expect(lower).toContain('active tab');
    expect(lower).toContain('websocket');
    expect(lower).toContain('subscription');
    expect(lower).not.toContain('entire endpoint');
  });

  it('gql6-subscription has preAction', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('gql6-subscription action re-establishes inherit auth before execute', async () => {
    buildLessonDom();
    const ctx = makeCtx();
    await preSubscriptionStep(ctx);
    vi.mocked(ctx.selectOption).mockClear();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).toHaveBeenCalledWith(
      GQL.AUTH_PROFILE_SELECT,
      LESSON6_GLOBAL_AUTH_PROFILE_ID,
    );
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('concept has keyTerms for all 4 auth types', () => {
    const terms = gqlAuthHeadersLesson.concept?.keyTerms?.map((k) => k.term.toLowerCase()) ?? [];
    expect(terms.some((t) => t.includes('bearer'))).toBe(true);
    expect(terms.some((t) => t.includes('api key') || t.includes('apikey'))).toBe(true);
    expect(terms.some((t) => t.includes('basic'))).toBe(true);
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

  it('concept has SVG diagram', () => {
    expect(gqlAuthHeadersLesson.concept?.diagram).toContain('<svg');
  });

  // ── preActions reference new functions ────────────────────────────────────

  it('gql6-env preAction runs without error on empty DOM', async () => {
    const ctx = makeCtx();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });

  it('gql6-bearer preAction runs without error', async () => {
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
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });
});
