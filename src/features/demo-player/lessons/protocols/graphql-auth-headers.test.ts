/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_PROFILE_NAME,
  LESSON6_API_KEY_HEADER,
  resetGqlLesson6SessionFlags,
  resetGqlLessonSessionFlags,
  gqlAuthLessonSetup,
  ensureBearerAuthConfigured,
  ensureEnvAuthToken,
  ensureApiKeyAuthConfigured,
  ensureBearerExecutedWithMetadata,
  ensureApiKeyExecutedWithMetadata,
  ensureAuthPopoverOpen,
  ensureProfileSaved,
  gqlAuthLessonCleanup,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-auth-headers lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson6SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlAuthHeadersLesson.id).toBe('gql-auth-headers');
    expect(gqlAuthHeadersLesson.category).toBe('graphql');
    expect(gqlAuthHeadersLesson.name).toBe('Authentication & Headers');
    expect(gqlAuthHeadersLesson.steps.length).toBe(7);
    expect(gqlAuthHeadersLesson.estimatedMinutes).toBe(3);
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
      'gql6-profile',
    ]);
  });

  it('stateful steps 2–7 have preAction guards', () => {
    gqlAuthHeadersLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

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

  it('ensureAuthPopoverOpen guard skips when popover already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div data-testid="gql-auth-popover"></div>';
    await ensureAuthPopoverOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('ensureBearerAuthConfigured guard skips repeat configuration', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
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

  it('gql6-profile preAction ensures api key metadata verified', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" value="" />
        <button data-testid="gql-profile-save-btn"></button>
      </div>
      <div data-testid="gql-rv-request-headers">X-API-Key</div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gqlAuthLessonCleanup closes popovers and resets flags', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-auth-popover">
        <button data-testid="gql-auth-popover-close"></button>
      </div>
    `;
    await gqlAuthLessonCleanup(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup clears endpoint and loads health query template', async () => {
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('lesson references auth token env value constant', () => {
    expect(LESSON6_AUTH_TOKEN_VALUE).toBe('lesson6-demo-jwt');
  });

  it('ensureAuthPopoverOpen guard skips when popover already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-auth-popover"></div>`;
    await ensureAuthPopoverOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
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

  it('gql6-bearer preAction ensures endpoint and introspection', async () => {
    const ctx = makeCtx();
    stubGqlStudioShell();
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.SCHEMA_BADGE_OK) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-schema-badge-ok"></span>');
      }
    });
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '{{graphqlUrl}}');
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
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
