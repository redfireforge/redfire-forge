/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-1'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { makeCtx } from '../ws-test-utils';
import { GQL } from '../../../../../shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';
import {
  GQL_DEMO_VAR,
  GQL_HEALTH_QUERY,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
  schemaBadgeShowsEmpty,
  hasUsableSchemaBadge,
  getMonacoGqlModel,
  getGqlVariablesJson,
  getGqlEditorQuery,
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

  it('getGqlVariablesJson reads vars model', () => {
    stubMonacoEditor('query { }');
    expect(getGqlVariablesJson()).toBe('{}');
  });

  it('fillGqlEditor updates monaco query model', async () => {
    document.body.innerHTML = '<div data-testid="gql-editor"><div class="monaco-editor"></div></div>';
    const { setQuery } = stubMonacoEditor('');
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    expect(setQuery).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
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
});
