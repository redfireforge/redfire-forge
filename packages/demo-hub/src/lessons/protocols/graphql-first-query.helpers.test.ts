/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-1'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlFirstQueryBeforeEach,
} from './graphql-first-query.testHelpers';
import { makeCtx } from './ws-test-utils';
import {GQL } from '@shared/selectors';
import {
  GQL_DEMO_VAR,
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  resetGqlLessonSessionFlags,
  fillGqlEditor,
  getGqlEditorQuery,
  gqlFirstQuerySetup,
  gqlFirstQueryCleanup,
  gqlVariablesLessonSetup,
  gqlVariablesLessonCleanup,
  openSchemaExplorer,
  ensureVariablesPanelOpen,
  fillGqlVariables,
  getGqlVariablesJson,
  ensureExecuted,
  ensureHealthQuery,
  ensureEditorMode,
  ensureDemoEndpoint,
  ensureIntrospected,
  responseBodyText,
  getDemoUserAId,
  getDemoUserBId,
  seedDemoUsers,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

/**
 * Introspection is triggered with a plain DOM click so setup/preAction stay
 * quiet — assert on the button, not on the rippling `ctx.click`.
 */
function spyOnIntrospectClick() {
  const btn = document.querySelector<HTMLElement>(GQL.INTROSPECT_BTN);
  if (!btn) throw new Error('Introspect button missing from the stubbed shell');
  return vi.spyOn(btn, 'click');
}

describe('graphql-lesson-helpers — helpers', () => {
  beforeEach(() => {
    setupGraphqlFirstQueryBeforeEach();
  });

it('fillGqlEditor sets monaco model value', async () => {
    document.body.innerHTML = `<div data-testid="gql-editor"><div class="monaco-editor"></div></div>`;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/x' }, getValue: () => '', setValue }],
      },
    };
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    expect(setValue).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
  });

  it('getGqlEditorQuery returns model content', () => {
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/x' }, getValue: () => 'query { health }', setValue: vi.fn() },
        ],
      },
    };
    expect(getGqlEditorQuery()).toBe('query { health }');
  });

  it('ensureHealthQuery guard skips when health query already loaded', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureHealthQuery(ctx);
    const { setQuery } = stubMonacoEditor('query { health }');
    vi.mocked(setQuery).mockClear();
    await ensureHealthQuery(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureExecuted guard skips when response viewer present', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-response-viewer"></div>
    `);
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureVariablesPanelOpen opens tab when not selected', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables"></button>
    `;
    const ctx = makeCtx();
    await ensureVariablesPanelOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('fillGqlVariables uses monaco vars model when available', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const { setVars } = stubMonacoEditor();
    const ctx = makeCtx();
    await fillGqlVariables(ctx, '{ "x": 1 }', { focus: false, openPanel: false });
    expect(setVars).toHaveBeenCalledWith('{ "x": 1 }');
  });

  it('getGqlVariablesJson returns empty string without monaco model', () => {
    document.body.innerHTML = '';
    delete (window as unknown as { monaco?: unknown }).monaco;
    expect(getGqlVariablesJson()).toBe('');
  });

  it('responseBodyText reads response pre content', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">{"ok":true}</pre>';
    expect(responseBodyText()).toBe('{"ok":true}');
  });

  it('fillGqlEditor falls back to textarea when monaco unavailable', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-editor">
        <div class="monaco-editor"><textarea class="inputarea"></textarea></div>
      </div>
    `;
    delete (window as unknown as { monaco?: unknown }).monaco;
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: true });
    const textarea = document.querySelector<HTMLTextAreaElement>('.monaco-editor textarea.inputarea')!;
    expect(textarea.value).toBe(GQL_HEALTH_QUERY);
    expect(ctx.click).toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('fillGqlVariables falls back to textarea when monaco vars model missing', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel">
        <div class="monaco-editor"><textarea class="inputarea"></textarea></div>
      </div>
    `;
    delete (window as unknown as { monaco?: unknown }).monaco;
    const ctx = makeCtx();
    await fillGqlVariables(ctx, '{ "id": "1" }', { focus: true, openPanel: false });
    const textarea = document.querySelector<HTMLTextAreaElement>(`${GQL.VARS_PANEL} textarea.inputarea`)!;
    expect(textarea.value).toBe('{ "id": "1" }');
  });

  it('ensureEditorMode clicks editor tab when inactive', async () => {
    document.body.innerHTML = `<button data-testid="gql-mode-editor" class="gql-mode-btn"></button>`;
    const ctx = makeCtx();
    await ensureEditorMode(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('ensureEditorMode skips click when editor tab already active', async () => {
    document.body.innerHTML = `<button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>`;
    const ctx = makeCtx();
    await ensureEditorMode(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('ensureVariablesPanelOpen skips click when tab already selected', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"></div>
    `;
    const ctx = makeCtx();
    await ensureVariablesPanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureIntrospected clicks introspect when badge missing', async () => {
    stubGqlStudioShell();
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.SCHEMA_BADGE_OK) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-schema-badge-ok"></span>');
      }
    });
    const clicked = spyOnIntrospectClick();
    await ensureIntrospected(ctx);
    expect(clicked).toHaveBeenCalled();
  });

  it('seedDemoUsers stores Alice and Bob ids', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-a' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-b' } } }) }));
    await seedDemoUsers();
    expect(getDemoUserAId()).toBe('usr-a');
    expect(getDemoUserBId()).toBe('usr-b');
  });

  it('seedDemoUsers skips fetch when already seeded', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-a' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-b' } } }) });
    vi.stubGlobal('fetch', fetchMock);
    await seedDemoUsers();
    fetchMock.mockClear();
    await seedDemoUsers();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fillGqlEditor sets value via monaco editor path', async () => {
    document.body.innerHTML = `<div data-testid="gql-editor"><div class="monaco-editor"></div></div>`;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/x' }, getValue: () => '', setValue: vi.fn() }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/x' } }), setValue }],
      },
    };
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    expect(setValue).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
  });

  it('fillGqlVariables sets value via monaco editor path', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const setVars = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/x' }, getValue: () => '', setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/x' }, getValue: () => '{}', setValue: vi.fn() },
        ],
        getEditors: () => [{
          getModel: () => ({ uri: { toString: () => 'inmemory://graphql-vars/x' } }),
          setValue: setVars,
        }],
      },
    };
    const ctx = makeCtx();
    await fillGqlVariables(ctx, '{ "id": "1" }', { focus: false, openPanel: false });
    expect(setVars).toHaveBeenCalledWith('{ "id": "1" }');
  });

  it('ensureDemoEndpoint skips fill when endpoint already matches', async () => {
    stubGqlStudioShell(`
      <select data-testid="header-env-select">
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">graphql-demo</option>
      </select>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_VAR;
    const ctx = makeCtx();
    await ensureDemoEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureDemoEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureDemoEndpoint skips fill when literal demo HTTP already set', async () => {
    stubGqlStudioShell(`
      <select data-testid="header-env-select">
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">graphql-demo</option>
      </select>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await ensureDemoEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureDemoEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('fillGqlEditor with focus skips surface click when editor missing', async () => {
    document.body.innerHTML = `<div data-testid="gql-editor"></div>`;
    delete (window as unknown as { monaco?: unknown }).monaco;
    const ctx = makeCtx();
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: true });
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureIntrospected skips introspect when badge already present', async () => {
    resetGqlLessonSessionFlags();
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <button data-testid="gql-right-tab-schema"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-se-type-Query"></div>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await ensureIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureIntrospected re-introspects when the badge reports zero types', async () => {
    resetGqlLessonSessionFlags();
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <button data-testid="gql-right-tab-schema"></button>
      <span data-testid="gql-schema-badge-ok">Schema (0)</span>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    const clicked = spyOnIntrospectClick();
    await ensureIntrospected(ctx);
    expect(clicked).toHaveBeenCalled();
  });

  it('openSchemaExplorer re-introspects when Query type not listed', async () => {
    resetGqlLessonSessionFlags();
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <button data-testid="gql-right-tab-schema"></button>
      <span data-testid="gql-schema-badge-ok">Schema (0)</span>
      <div data-testid="gql-schema-explorer"></div>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    const clicked = spyOnIntrospectClick();
    await openSchemaExplorer(ctx);
    expect(clicked).toHaveBeenCalled();
  });

  it('openSchemaExplorer skips re-introspect when Query type already listed', async () => {
    resetGqlLessonSessionFlags();
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <button data-testid="gql-right-tab-schema"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-Query"></div>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await openSchemaExplorer(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlVariablesLessonSetup activates response tab and closes history when needed', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const responseSpy = vi.spyOn(responseTab, 'click');
    const historySpy = vi.spyOn(historyBtn, 'click');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const ctx = makeCtx();
    await gqlVariablesLessonSetup(ctx);
    expect(responseSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('gqlVariablesLessonCleanup closes demo tab and resets session flags', async () => {
    const { closeGqlDemoTabs } = await import('./graphql-lesson-helpers/gql-demo-tab');
    const ctx = makeCtx();
    await gqlVariablesLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-variables');
  });

  it('gqlFirstQueryCleanup closes demo tab and resets session flags', async () => {
    const { closeGqlDemoTabs } = await import('./graphql-lesson-helpers/gql-demo-tab');
    const ctx = makeCtx();
    await gqlFirstQueryCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-first-query');
  });

  it('gqlFirstQuerySetup activates editor and response tab when inactive', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
      },
    };
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const editorSpy = vi.spyOn(editorBtn, 'click');
    const responseSpy = vi.spyOn(responseTab, 'click');
    const ctx = makeCtx();
    await gqlFirstQuerySetup(ctx);
    expect(editorSpy).toHaveBeenCalled();
    expect(responseSpy).toHaveBeenCalled();
  });

  it('gqlVariablesLessonSetup seeds demo endpoint var and closes history tab', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const ctx = makeCtx();
    await gqlVariablesLessonSetup(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });
});
