/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '../../../../../shared/selectors';
import {
  LESSON6_GLOBAL_AUTH_PROFILE_ID,
  resetGqlLesson6SessionFlags,
  prepareBearerAuthSpotlight,
  prepareBearerExecuteSpotlight,
  prepareApiKeyAuthSpotlight,
  prepareApiKeyExecuteSpotlight,
  prepareBasicAuthSpotlight,
  prepareBasicExecuteSpotlight,
  prepareInheritAuthSpotlight,
  prepareInheritExecuteSpotlight,
  prepareProfileSpotlight,
  ensureAuthPopoverOpen,
  selectAuthType,
  seedLesson6GlobalAuthProfile,
  ensureInheritAuthConfigured,
  ensureBasicExecutedWithMetadata,
  ensureBearerExecutedWithMetadata,
  ensureApiKeyExecutedWithMetadata,
} from './lesson6-auth-headers';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';

function bearerChainDom(): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-auth-badge-btn"></button>
    <div data-testid="gql-auth-popover">
      <button data-testid="gql-auth-popover-close"></button>
      <select data-testid="gql-auth-type-select">
        <option value="bearer">Bearer</option>
        <option value="apiKey">API Key</option>
        <option value="basic">Basic</option>
        <option value="inherit">Inherit</option>
      </select>
      <input data-testid="gql-auth-bearer-input" value="{{authToken}}" />
      <input data-testid="gql-auth-apikey-name" value="X-API-Key" />
      <input data-testid="gql-auth-apikey-val" value="{{apiKey}}" />
      <input data-testid="gql-auth-basic-user" value="demo" />
      <input data-testid="gql-auth-basic-pass" value="demo-pass" />
      <select data-testid="gql-auth-profile-select">
        <option value="${LESSON6_GLOBAL_AUTH_PROFILE_ID}">Lesson 6 Bearer</option>
      </select>
    </div>
    <button data-testid="gql-env-badge"></button>
    <div data-testid="gql-env-modal">
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="authToken" />
        <input class="gql-env-var-input" value="lesson6-demo-jwt" />
      </div>
      <div data-testid="gql-env-var-row">
        <input data-testid="gql-env-var-key" value="apiKey" />
        <input class="gql-env-var-input" value="lesson6-secret-key" />
      </div>
    </div>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tab-metadata"></button>
    <div data-testid="gql-rv-request-headers">Authorization Bearer lesson6-demo-jwt</div>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
  `;
  stubMonacoEditor('query { health }');
}

describe('lesson6-auth-headers helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson6SessionFlags();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    vi.unstubAllGlobals();
  });

  it('ensureAuthPopoverOpen is no-op when popover already visible', async () => {
    document.body.innerHTML = `<div data-testid="gql-auth-popover"></div>`;
    const ctx = makeCtx();
    await ensureAuthPopoverOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('selectAuthType opens popover and selects type', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
      </div>
    `;
    const ctx = makeCtx();
    await selectAuthType(ctx, 'bearer');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
  });

  it('seedLesson6GlobalAuthProfile calls window bridge when present', () => {
    const upsert = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = upsert;
    seedLesson6GlobalAuthProfile();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: LESSON6_GLOBAL_AUTH_PROFILE_ID }),
    );
  });

  it('seedLesson6GlobalAuthProfile is safe when bridge missing', () => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    expect(() => seedLesson6GlobalAuthProfile()).not.toThrow();
  });

  it('prepareBearerAuthSpotlight selects bearer when input missing', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select"><option value="bearer">Bearer</option></select>
      </div>
    `;
    const ctx = makeCtx();
    await prepareBearerAuthSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, 5000);
  });

  it('prepareBearerExecuteSpotlight closes modals after bearer chain', async () => {
    bearerChainDom();
    const ctx = makeCtx();
    await prepareBearerExecuteSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('prepareApiKeyAuthSpotlight opens auth popover after bearer metadata', async () => {
    bearerChainDom();
    const ctx = makeCtx();
    await ensureBearerExecutedWithMetadata(ctx);
    document.querySelector(GQL.AUTH_POPOVER)?.remove();
    vi.mocked(ctx.click).mockClear();
    await prepareApiKeyAuthSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('prepareBasicAuthSpotlight opens popover after api key metadata', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Bearer X-API-Key lesson6-secret-key';
    const ctx = makeCtx();
    await ensureApiKeyExecutedWithMetadata(ctx);
    document.querySelector(GQL.AUTH_POPOVER)?.remove();
    vi.mocked(ctx.click).mockClear();
    await prepareBasicAuthSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('prepareApiKeyExecuteSpotlight closes popover and ensures health query', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Bearer lesson6-demo-jwt X-API-Key lesson6-secret';
    const ctx = makeCtx();
    await prepareApiKeyExecuteSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('prepareBasicExecuteSpotlight closes popover after basic configured', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Bearer X-API-Key Basic';
    const ctx = makeCtx();
    await prepareBasicExecuteSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('prepareInheritAuthSpotlight selects inherit without binding profile', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Basic demo';
    const ctx = makeCtx();
    await prepareInheritAuthSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'inherit');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_PROFILE_SELECT, 5000);
  });

  it('prepareInheritExecuteSpotlight closes popover when inherit configured', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Basic demo lesson6-demo-jwt';
    const ctx = makeCtx();
    await prepareInheritExecuteSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('prepareProfileSpotlight closes modals after inherit execute', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization lesson6-demo-jwt';
    const ctx = makeCtx();
    await prepareProfileSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('ensureInheritAuthConfigured binds global profile', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Basic demo';
    const ctx = makeCtx();
    await ensureInheritAuthConfigured(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      GQL.AUTH_PROFILE_SELECT,
      LESSON6_GLOBAL_AUTH_PROFILE_ID,
    );
  });

  it('ensureInheritAuthConfigured guard skips when profile already selected', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization Basic demo';
    const ctx = makeCtx();
    await ensureInheritAuthConfigured(ctx);
    vi.mocked(ctx.selectOption).mockClear();
    await ensureInheritAuthConfigured(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensureBasicExecutedWithMetadata guard skips when Basic visible', async () => {
    bearerChainDom();
    document.querySelector<HTMLElement>(GQL.RV_REQUEST_HEADERS)!.textContent =
      'Authorization X-API-Key Basic';
    const ctx = makeCtx();
    await ensureBasicExecutedWithMetadata(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBasicExecutedWithMetadata(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });
});
