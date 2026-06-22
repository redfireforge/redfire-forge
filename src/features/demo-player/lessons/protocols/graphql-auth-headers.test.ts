/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql4'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_BASIC_PASS,
  LESSON6_BASIC_USER,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_PROFILE_NAME,
  LESSON6_API_KEY_HEADER,
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  resetGqlLesson6SessionFlags,
  resetGqlLessonSessionFlags,
  gqlAuthLessonSetup,
  ensureBearerAuthConfigured,
  ensureEnvAuthToken,
  ensureApiKeyAuthConfigured,
  ensureBasicAuthConfigured,
  ensureBearerExecutedWithMetadata,
  ensureApiKeyExecutedWithMetadata,
  ensureAuthPopoverOpen,
  ensureProfileSaved,
  ensureBearerAuthConfiguredQuiet,
  prepareProfileSpotlight,
  gqlAuthLessonCleanup,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-auth-headers lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson6SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ─────────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlAuthHeadersLesson.id).toBe('gql-auth-headers');
    expect(gqlAuthHeadersLesson.category).toBe('graphql');
    expect(gqlAuthHeadersLesson.name).toBe('Authentication & Headers');
    expect(gqlAuthHeadersLesson.steps.length).toBe(12);
    expect(gqlAuthHeadersLesson.estimatedMinutes).toBe(6);
    expect(gqlAuthHeadersLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlAuthHeadersLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlAuthHeadersLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlAuthHeadersLesson.steps.map((s) => s.id)).toEqual([
      'gql6-intro',
      'gql6-bearer',
      'gql6-env',
      'gql6-execute-bearer',
      'gql6-apikey',
      'gql6-execute-apikey',
      'gql6-basic',
      'gql6-basic-exec',
      'gql6-inherit',
      'gql6-inherit-exec',
      'gql6-profile',
      'gql6-subscription-auth',
    ]);
  });

  it('stateful steps 2–12 have preAction guards', () => {
    gqlAuthHeadersLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept quality ──────────────────────────────────────────────────────────

  it('concept body explains WHY auth lives on the connection bar', () => {
    expect(gqlAuthHeadersLesson.concept.body).toContain('connection bar');
    expect(gqlAuthHeadersLesson.concept.body).toContain('ground truth');
  });

  it('concept has 7 key terms including Inherit from Auth Profile', () => {
    expect(gqlAuthHeadersLesson.concept.keyTerms.length).toBe(7);
    const terms = gqlAuthHeadersLesson.concept.keyTerms.map((t) => t.term);
    expect(terms).toContain('Basic Auth');
    expect(terms).toContain('Bearer token');
    expect(terms).toContain('API Key');
    expect(terms).toContain('Inherit from Auth Profile');
    expect(terms).toContain('Connection profile');
  });

  it('concept diagram is a 700x430 studio chrome SVG', () => {
    expect(gqlAuthHeadersLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlAuthHeadersLesson.concept.diagram).toContain('Auth popover');
  });

  it('step descriptions use WHY framing throughout', () => {
    const bearerStep = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(bearerStep.description).toContain('never paste a raw token');

    const executeStep = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-bearer')!;
    expect(executeStep.description).toContain('ground truth for debugging');

    const basicStep = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    expect(basicStep.description).toContain('base64 is');

    const subStep = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-auth')!;
    expect(subStep.description).toContain('WebSocket handshake');
  });

  // ── Spotlight ↔ description alignment ────────────────────────────────────────

  it('gql6-bearer highlights the bearer token input (popover open via preAction)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    expect(step.highlight).toBe(GQL.AUTH_BEARER_INPUT);
  });

  it('gql6-execute-bearer highlights Execute (first action in narration)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-bearer')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql6-apikey highlights the auth type dropdown', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    expect(step.highlight).toBe(GQL.AUTH_TYPE_SELECT);
  });

  it('gql6-execute-apikey highlights Execute (first action in narration)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-apikey')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql6-basic highlights the auth type dropdown', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    expect(step.highlight).toBe(GQL.AUTH_TYPE_SELECT);
  });

  it('gql6-basic-exec highlights Execute (first action in narration)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-exec')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql6-inherit highlights the auth profile selector', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    expect(step.highlight).toBe(GQL.AUTH_PROFILE_SELECT);
  });

  it('gql6-inherit-exec highlights Execute (first action in narration)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-exec')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql6-subscription-auth highlights the auth badge (connection bar)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-auth')!;
    expect(step.highlight).toBe(GQL.AUTH_BADGE_BTN);
  });

  it('each step highlight matches the primary control named in its description', () => {
    const rows: Array<{ id: string; highlight: string; includes: RegExp[]; excludes?: RegExp[] }> = [
      { id: 'gql6-intro', highlight: GQL.AUTH_BADGE_BTN, includes: [/Auth badge/i] },
      { id: 'gql6-bearer', highlight: GQL.AUTH_BEARER_INPUT, includes: [/token field/i, /Bearer Token/i] },
      { id: 'gql6-env', highlight: GQL.ENV_BADGE, includes: [/Env badge/i] },
      { id: 'gql6-execute-bearer', highlight: GQL.EXECUTE_BTN, includes: [/Execute/i] },
      { id: 'gql6-apikey', highlight: GQL.AUTH_TYPE_SELECT, includes: [/API Key/i] },
      { id: 'gql6-execute-apikey', highlight: GQL.EXECUTE_BTN, includes: [/Execute/i] },
      { id: 'gql6-basic', highlight: GQL.AUTH_TYPE_SELECT, includes: [/Basic Auth/i] },
      { id: 'gql6-basic-exec', highlight: GQL.EXECUTE_BTN, includes: [/Execute/i] },
      { id: 'gql6-inherit', highlight: GQL.AUTH_PROFILE_SELECT, includes: [/Auth Profile/i, /Inherit/i] },
      { id: 'gql6-inherit-exec', highlight: GQL.EXECUTE_BTN, includes: [/Execute/i] },
      { id: 'gql6-profile', highlight: GQL.PROFILE_BADGE, includes: [/Profiles/i] },
      { id: 'gql6-subscription-auth', highlight: GQL.AUTH_BADGE_BTN, includes: [/connection bar/i] },
    ];
    for (const row of rows) {
      const step = gqlAuthHeadersLesson.steps.find((s) => s.id === row.id)!;
      expect(step.highlight, row.id).toBe(row.highlight);
      for (const re of row.includes) {
        expect(step.description, `${row.id} description`).toMatch(re);
      }
      for (const re of row.excludes ?? []) {
        expect(step.description, `${row.id} description`).not.toMatch(re);
      }
    }
  });

  // ── Step actions ─────────────────────────────────────────────────────────────

  it('gql6-bearer action configures bearer token', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
        <code data-testid="gql-auth-preview"></code>
      </div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  });

  it('gql6-execute-bearer opens metadata tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };

    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-bearer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-apikey action configures API key auth', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
          <option value="apiKey">API Key</option>
        </select>
        <input data-testid="gql-auth-apikey-name" value="" />
        <input data-testid="gql-auth-apikey-val" value="" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-apikey')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'apiKey');
  });

  it('gql6-execute-apikey opens metadata after execute', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">X-API-Key</div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-apikey')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-basic action selects basic auth and fills username/password', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
          <option value="basic">Basic Auth</option>
          <option value="apiKey">API Key</option>
        </select>
        <input data-testid="gql-auth-basic-user" value="" />
        <input data-testid="gql-auth-basic-pass" value="" />
        <code data-testid="gql-auth-preview"></code>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">X-API-Key apiKey</div>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'basic');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
  });

  it('gql6-basic-exec executes and opens metadata tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Basic</div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-basic-exec')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-inherit action selects inherit auth profile', async () => {
    const ctx = makeCtx();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="inherit">Inherit</option>
          <option value="basic">Basic</option>
        </select>
        <select data-testid="gql-auth-profile-select">
          <option value="">— Select —</option>
          <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">Lesson 6 Bearer</option>
        </select>
        <code data-testid="gql-auth-preview"></code>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Basic</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
  });

  it('gql6-inherit-exec opens metadata after execute', async () => {
    const ctx = makeCtx();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="inherit">Inherit</option>
        </select>
        <select data-testid="gql-auth-profile-select">
          <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">Lesson 6 Bearer</option>
        </select>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Bearer ${LESSON6_AUTH_TOKEN_VALUE}</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-inherit-exec')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
  });

  it('gql6-profile saves connection profile', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" value="" />
        <button data-testid="gql-profile-save-btn"></button>
      </div>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
  });

  it('gql6-subscription-auth has preAction that ensures profile saved', async () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-auth')!;
    expect(step.preAction).toBe(ensureProfileSaved);
  });

  it('gql6-subscription-auth has no action (reading-only step)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-subscription-auth')!;
    expect(step.action).toBeUndefined();
  });

  // ── Env action ───────────────────────────────────────────────────────────────

  it('gql6-env action opens env modal and sets authToken', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-env-badge"></button>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-env')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENV_BADGE);
  });

  // ── Guard helpers ────────────────────────────────────────────────────────────

  it('ensureAuthPopoverOpen guard skips when popover already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div data-testid="gql-auth-popover"></div>';
    await ensureAuthPopoverOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('ensureBearerAuthConfigured guard skips repeat configuration', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="${LESSON6_BEARER_TEMPLATE}" />
      </div>
    `;
    await ensureBearerAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureBearerAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureEnvAuthToken guard skips when env token already set', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal"></div>
    `;
    await ensureEnvAuthToken(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureEnvAuthToken(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENV_BADGE);
  });

  it('ensureApiKeyAuthConfigured guard skips repeat configuration', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="apiKey">API Key</option></select>
        <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
        <input data-testid="gql-auth-apikey-val" value="{{apiKey}}" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Bearer</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-env-badge"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureApiKeyAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureApiKeyAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureBasicAuthConfigured guard skips repeat configuration', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="apiKey">API Key</option>
          <option value="basic">Basic Auth</option>
        </select>
        <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
        <input data-testid="gql-auth-apikey-val" value="{{apiKey}}" />
        <input data-testid="gql-auth-basic-user" value="${LESSON6_BASIC_USER}" />
        <input data-testid="gql-auth-basic-pass" value="${LESSON6_BASIC_PASS}" />
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">X-API-Key lesson6-secret</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-env-badge"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureBasicAuthConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureBasicAuthConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureBearerExecutedWithMetadata guard skips when Authorization visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <div data-testid="gql-rv-metadata">Authorization</div>
      <div data-testid="gql-rv-request-headers">Authorization Bearer token</div>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="${LESSON6_BEARER_TEMPLATE}" />
      </div>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureBearerExecutedWithMetadata(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBearerExecutedWithMetadata(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql6-profile preAction calls prepareProfileSpotlight (inherit chain, not basic)', () => {
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    expect(step.preAction).toBe(prepareProfileSpotlight);
  });

  it('gqlAuthLessonCleanup closes popovers, demo tab, and resets flags', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-auth-popover">
        <button data-testid="gql-auth-popover-close"></button>
      </div>
    `;
    await gqlAuthLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-auth-headers');
  });

  it('setup creates demo tab and loads health query template', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    await gqlAuthLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-auth-headers', 'Authentication & Headers');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('lesson references auth token env value constant', () => {
    expect(LESSON6_AUTH_TOKEN_VALUE).toBe('lesson6-demo-jwt');
  });

  it('lesson references basic auth constants', () => {
    expect(LESSON6_BASIC_USER).toBe('demo');
    expect(LESSON6_BASIC_PASS).toBe('demo-pass');
  });

  it('ensureEnvAuthToken sets authToken on existing env var row', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="authToken" />
          <input class="gql-env-var-input" value="" />
        </div>
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="apiKey" />
          <input class="gql-env-var-input" value="" />
        </div>
      </div>
    `;
    await ensureEnvAuthToken(ctx);
    const inputs = document.querySelectorAll<HTMLInputElement>('.gql-env-var-input');
    expect(inputs[0].value).toBe(LESSON6_AUTH_TOKEN_VALUE);
  });

  it('ensureEnvAuthToken adds new env var row when key missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <button data-testid="gql-env-var-add-btn"></button>
        <button data-testid="gql-env-new-btn"></button>
      </div>
    `;
    const addBtn = document.querySelector<HTMLButtonElement>(GQL.ENV_VAR_ADD_BTN)!;
    addBtn.addEventListener('click', () => {
      document.querySelector(GQL.ENV_MODAL)!.insertAdjacentHTML(
        'beforeend',
        `<div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="" />
          <input class="gql-env-var-input" value="" />
        </div>`,
      );
    });
    await ensureEnvAuthToken(ctx);
    expect(document.querySelectorAll('[data-testid="gql-env-var-key"]').length).toBeGreaterThan(0);
  });

  it('closeAuthPopoverIfOpen uses auth badge when close button missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-auth-popover"></div>
      <button data-testid="gql-auth-badge-btn"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-env-badge"></button>
    `;
    await ensureEnvAuthToken(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('closeEnvModalIfOpen clicks overlay when modal open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <div data-testid="gql-env-modal"></div>
      <div data-testid="gql-env-modal-overlay"></div>
    `;
    await gqlAuthLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="gql-env-modal-overlay"]');
  });

  it('ensureApiKeyExecutedWithMetadata guard skips when header visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <div data-testid="gql-rv-metadata">Authorization ${LESSON6_API_KEY_HEADER}</div>
      <div data-testid="gql-rv-request-headers">Authorization Bearer ${LESSON6_API_KEY_HEADER}</div>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option><option value="apiKey">API Key</option></select>
        <input data-testid="gql-auth-bearer-input" value="${LESSON6_BEARER_TEMPLATE}" />
        <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
        <input data-testid="gql-auth-apikey-val" value="{{apiKey}}" />
      </div>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-env-modal">
        <div data-testid="gql-env-var-row">
          <input data-testid="gql-env-var-key" value="authToken" />
          <input class="gql-env-var-input" value="${LESSON6_AUTH_TOKEN_VALUE}" />
        </div>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureApiKeyExecutedWithMetadata(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureApiKeyExecutedWithMetadata(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureProfileSaved guard skips when profile row exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-row-lesson6"></div>
      <div data-testid="gql-rv-request-headers">${LESSON6_API_KEY_HEADER}</div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="apiKey">API Key</option></select>
        <input data-testid="gql-auth-apikey-name" value="${LESSON6_API_KEY_HEADER}" />
        <input data-testid="gql-auth-apikey-val" value="{{apiKey}}" />
      </div>
      <button data-testid="gql-env-badge"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureProfileSaved(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureProfileSaved(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_BADGE);
  });

  it('ensureBearerAuthConfiguredQuiet closes auth popover after configure', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <button data-testid="gql-auth-popover-close"></button>
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
    `;
    await ensureBearerAuthConfiguredQuiet(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('prepareInheritAuthSpotlight opens inherit profile dropdown without selecting profile', async () => {
    const ctx = makeCtx();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="inherit">Inherit</option>
          <option value="basic">Basic</option>
        </select>
        <select data-testid="gql-auth-profile-select">
          <option value="">— Select —</option>
          <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">Lesson 6 Bearer</option>
        </select>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization Basic</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-env-badge"></button>
    `;
    stubMonacoEditor('query { health }');
    const { prepareInheritAuthSpotlight } = await import('./graphql-lesson-helpers');
    await prepareInheritAuthSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.selectOption).not.toHaveBeenCalledWith(GQL.AUTH_PROFILE_SELECT, LESSON6_GLOBAL_AUTH_PROFILE_ID);
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
  });

  it('gql6-bearer preAction opens bearer popover for spotlight', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
        </select>
      </div>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await step.preAction!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
  });

  it('gqlAuthLessonSetup activates inactive editor mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const clickSpy = vi.spyOn(editorBtn, 'click');
    await gqlAuthLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});
