/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-1'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { stubMonacoEditor, stubMultiTabMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';
import {
  GQL_DEMO_VAR,
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  demoTabShowsStaleTlsState,
  resetDemoTabToPlainHttp,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
  schemaBadgeShowsEmpty,
  hasUsableSchemaBadge,
  getMonacoGqlModel,
  getGqlVariablesJson,
  getGqlEditorQuery,
  syncGqlQueryToAppState,
  responseBodyText,
  scrollResponseBodyToTop,
  areLesson2StudioExecutionsDone,
  fillGqlEditor,
  fillGqlVariables,
  ensureVariablesPanelOpen,
  openResponseBodyTab,
  gqlFirstQuerySetup,
  gqlFirstQueryCleanup,
  gqlVariablesLessonSetup,
  clearActiveTabAuthOverride,
  ensureAuthPanelVisible,
  configureDemoTabInheritPageAuth,
  configureDemoTabInheritPageDefault,
  ensureGqlDemoPageDefaultEndpoint,
  openAuthPanelQuiet,
  closeAuthPanelQuiet,
  closeGqlActivityPanelIfOpen,
  ensureIntrospectedOnDirectEndpoint,
  _openAuthPanel,
  _closeAuthPanelIfOpen,
  selectAuthInPanel,
  selectNoAuthInPanel,
  gqlVariablesLessonCleanup,
} from './core';

describe('graphql-lesson-helpers core', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { monaco?: unknown }).monaco;
    resetGqlLessonSessionFlags();
    resetGqlLesson2SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schemaBadgeShowsEmpty detects zero-type badge text', () => {
    document.body.innerHTML = '<span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>';
    expect(schemaBadgeShowsEmpty()).toBe(true);
    expect(hasUsableSchemaBadge()).toBe(false);
  });

  it('hasUsableSchemaBadge is true for non-empty badge', () => {
    document.body.innerHTML = '<span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>';
    expect(hasUsableSchemaBadge()).toBe(true);
  });

  it('getMonacoGqlModel and getGqlEditorQuery read monaco model', () => {
    stubMonacoEditor('query { health }');
    expect(getMonacoGqlModel()).toBeTruthy();
    expect(getGqlEditorQuery()).toContain('health');
  });

  it('getMonacoGqlModel prefers the active tab when multiple query models exist', () => {
    stubMultiTabMonacoEditor({
      localQuery: 'query { health }',
      demoQuery: 'query MyQuery { health user(id: "usr-1") { userId: id @include(if: true) name email } }',
      activeTabId: 'demo-tab',
    });
    expect(getGqlEditorQuery()).toContain('MyQuery');
    expect(getGqlEditorQuery()).toContain('userId');
    expect(getGqlEditorQuery()).not.toBe('query { health }');
  });

  it('syncGqlQueryToAppState syncs the active tab query model', () => {
    stubMultiTabMonacoEditor({
      localQuery: 'query { health }',
      demoQuery: 'query MyQuery { health user(id: "usr-1") { userId: id @include(if: true) name email } }',
      activeTabId: 'demo-tab',
    });
    const setGqlQuery = vi.fn();
    (window as unknown as Record<string, unknown>).__demoSetGqlQuery = setGqlQuery;
    syncGqlQueryToAppState(getGqlEditorQuery());
    expect(setGqlQuery).toHaveBeenCalledWith(expect.stringContaining('MyQuery'));
    expect(setGqlQuery).not.toHaveBeenCalledWith('query { health }');
  });

  it('getGqlVariablesJson reads vars model', () => {
    stubMonacoEditor('query { }');
    expect(getGqlVariablesJson()).toBe('{}');
  });

  it('closeGqlActivityPanelIfOpen toggles off active mock activity tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML =
      '<button data-testid="gql-activity-mock" class="gql-activity-tab--active"></button>';
    await closeGqlActivityPanelIfOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('closeGqlActivityPanelIfOpen is a no-op when no activity tab is active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML =
      '<button data-testid="gql-activity-mock"></button>';
    await closeGqlActivityPanelIfOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('fillGqlEditor updates monaco query model', async () => {
    document.body.innerHTML = '<div data-testid="gql-editor"><div class="monaco-editor"></div></div>';
    const { setQuery } = stubMonacoEditor('');
    const setGqlQuery = vi.fn();
    (window as unknown as Record<string, unknown>).__demoSetGqlQuery = setGqlQuery;
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    expect(setQuery).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
    expect(setGqlQuery).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
  });

  it('fillGqlEditor falls back to textarea when monaco absent', async () => {
    document.body.innerHTML = '<div class="monaco-editor"><textarea class="inputarea"></textarea></div>';
    const ctx = makeCtx();
    await fillGqlEditor(ctx, 'query { x }', { focus: false });
    expect(
      (document.querySelector('.monaco-editor textarea.inputarea') as HTMLTextAreaElement).value,
    ).toBe('query { x }');
  });

  it('fillGqlVariables uses monaco vars model', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const { setVars } = stubMonacoEditor('query { }');
    const ctx = makeCtx();
    await fillGqlVariables(ctx, '{\n  "id": "1"\n}', { focus: false, openPanel: false });
    expect(setVars).toHaveBeenCalled();
  });

  it('ensureVariablesPanelOpen clicks tab when panel hidden', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="false"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureVariablesPanelOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('openResponseBodyTab clicks body sub-tab when not selected', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-rv-tab-body" aria-selected="false"></button>
      <div data-testid="gql-rv-json-scroll"></div>
    `;
    const ctx = makeCtx();
    await openResponseBodyTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_BODY);
  });

  it('scrollResponseBodyToTop is safe when scroll container missing', () => {
    expect(() => scrollResponseBodyToTop()).not.toThrow();
  });

  it('responseBodyText reads response body element', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">{"data":{}}</pre>';
    expect(responseBodyText()).toContain('data');
  });

  it('areLesson2StudioExecutionsDone is false initially', () => {
    expect(areLesson2StudioExecutionsDone()).toBe(false);
  });

  it('gqlFirstQuerySetup creates demo tab and resets editor query', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlFirstQuerySetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-first-query',
      'Your First GraphQL Query',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlFirstQueryCleanup closes demo tab and resets flags', async () => {
    const ctx = makeCtx();
    await gqlFirstQueryCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-first-query');
  });

  it('gqlVariablesLessonSetup seeds demo users when fetch succeeds', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ data: { createUser: { id: 'u1' } } }),
      }),
    );
    const ctx = makeCtx();
    await gqlVariablesLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-variables', 'Variables & Arguments');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('gqlVariablesLessonSetup survives seedDemoUsers failure', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const ctx = makeCtx();
    await expect(gqlVariablesLessonSetup(ctx)).resolves.toBeUndefined();
  });

  it('gqlVariablesLessonCleanup closes demo tab and resets lesson flags', async () => {
    const ctx = makeCtx();
    await gqlVariablesLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-variables');
  });

  it('clearActiveTabAuthOverride clicks reset when control is visible', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel">
        <button data-testid="gql-auth-reset-inherit-btn"></button>
      </div>
    `;
    const ctx = makeCtx();
    await clearActiveTabAuthOverride(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_RESET_INHERIT_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('clearActiveTabAuthOverride closes auth tab when reset control absent', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <button data-testid="gql-bottom-tab-variables"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await clearActiveTabAuthOverride(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.AUTH_RESET_INHERIT_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('clearActiveTabAuthOverride opens panel when auth tab inactive and reset absent', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-bottom-tab-variables"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await clearActiveTabAuthOverride(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.AUTH_RESET_INHERIT_BTN);
  });

  it('configureDemoTabInheritPageAuth uses quiet bridge when available', async () => {
    document.body.innerHTML = `<button data-testid="gql-auth-badge-btn"></button>`;
    const clear = vi.fn(() => true);
    (window as unknown as { __demoClearActiveTabAuth?: () => boolean }).__demoClearActiveTabAuth = clear;
    const ctx = makeCtx();
    await configureDemoTabInheritPageAuth(ctx);
    expect(clear).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
    delete (window as unknown as { __demoClearActiveTabAuth?: () => boolean }).__demoClearActiveTabAuth;
  });

  it('configureDemoTabInheritPageAuth falls back to Auth panel when bridge missing', async () => {
    document.body.innerHTML = `<button data-testid="gql-auth-badge-btn"></button>`;
    delete (window as unknown as { __demoClearActiveTabAuth?: () => boolean }).__demoClearActiveTabAuth;
    const ctx = {
      ...makeCtx(),
      // Keep the bridge wait short so the fallback path is exercised quickly.
      delay: vi.fn(async () => {}),
    };
    // Collapse the 2.5s poll: first delay call advances "time" by stubbing Date.
    const nowSpy = vi.spyOn(Date, 'now');
    let t = 0;
    nowSpy.mockImplementation(() => {
      t += 3000;
      return t;
    });
    await configureDemoTabInheritPageAuth(ctx);
    nowSpy.mockRestore();
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN, 5000);
  });

  it('configureDemoTabInheritPageDefault sets page default then clears tab override', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://127.0.0.1:4010/graphql" />
      <button data-testid="gql-endpoint-reset-btn"></button>
      <div data-testid="gql-tab-bar"><button role="tab" aria-selected="true">T1</button></div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.ENDPOINT_RESET_BTN) {
        document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_VAR;
      }
    });
    await configureDemoTabInheritPageDefault(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value).toBe(GQL_DEMO_VAR);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('ensureGqlDemoPageDefaultEndpoint writes template var to page storage', async () => {
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="" />`;
    const ctx = makeCtx();
    await ensureGqlDemoPageDefaultEndpoint(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('openAuthPanelQuiet skips when auth tab is already selected', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
    `;
    const ctx = makeCtx();
    await openAuthPanelQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openAuthPanelQuiet clicks auth badge when panel exists but auth tab inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await openAuthPanelQuiet(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('closeAuthPanelQuiet switches to Variables when auth tab is active', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await closeAuthPanelQuiet(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('closeAuthPanelQuiet is no-op when auth panel exists but auth tab inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await closeAuthPanelQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAuthPanelVisible opens auth via badge when auth tab is inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="false"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await ensureAuthPanelVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureAuthPanelVisible is no-op when auth tab is already active', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel"></div>
    `;
    const ctx = makeCtx();
    await ensureAuthPanelVisible(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('selectAuthInPanel opens panel and selects auth type', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <select data-testid="gql-auth-type-select"></select>
    `;
    const ctx = makeCtx();
    await selectAuthInPanel(ctx, 'bearer');
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, 5000);
  });

  it('selectNoAuthInPanel selects none auth type', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <select data-testid="gql-auth-type-select"></select>
    `;
    const ctx = makeCtx();
    await selectNoAuthInPanel(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'none');
  });

  it('demoTabShowsStaleTlsState detects HTTPS endpoint and TLS toggle', () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://127.0.0.1:4443/graphql" />
      <button data-testid="gql-tls-toggle"></button>
    `;
    expect(demoTabShowsStaleTlsState()).toBe(true);
  });

  it('resetDemoTabToPlainHttp fills plain HTTP when stale TLS chrome is visible', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="https://127.0.0.1:4443/graphql" />
      <button data-testid="gql-tls-toggle"></button>
    `;
    const ctx = makeCtx();
    await resetDemoTabToPlainHttp(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('ensureIntrospectedOnDirectEndpoint skips Environment Manager navigation', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="" />
      <span data-testid="gql-schema-badge-ok">Schema (9)</span>
      <button data-testid="gql-right-tab-schema"></button>
      <div data-testid="gql-schema-type-query"></div>
    `;
    const ctx = makeCtx();
    await ensureIntrospectedOnDirectEndpoint(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
    // Usable badge must not open Schema tab (steals Tracing/Response focus mid-lesson).
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('ensureIntrospectedOnDirectEndpoint clicks Introspect when schema badge is not yet loaded', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <button data-testid="gql-introspect-btn"></button>
      <button data-testid="gql-right-tab-schema"></button>
    `;
    const ctx = makeCtx();
    const introspectBtn = document.querySelector<HTMLElement>(GQL.INTROSPECT_BTN)!;
    const clicked = vi.spyOn(introspectBtn, 'click');
    await ensureIntrospectedOnDirectEndpoint(ctx);
    // No badge in the DOM — must actively trigger introspection instead of
    // passively waiting for a badge that will never appear on its own. The click
    // is a quiet DOM click: setup/preAction must not paint a ripple.
    expect(clicked).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });
});
