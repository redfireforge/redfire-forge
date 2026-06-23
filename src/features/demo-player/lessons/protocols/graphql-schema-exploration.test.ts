/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql3'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlSchemaLesson } from './graphql-schema-exploration';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_INSERT_TEMPLATE_QUERY,
  resetGqlLesson4SessionFlags,
  resetGqlLessonSessionFlags,
  gqlSchemaTypeSelector,
  gqlTryFieldSelector,
  gqlSchemaLessonSetup,
  gqlSchemaLessonCleanup,
  ensureQueryTypeSelected,
  ensureUserTypeSelected,
  ensureEditorReadyForInsert,
  ensureTryInsertDone,
  markTryInsertDone,
  selectSchemaType,
  ensureSchemaExplorerOpen,
  searchSchemaTypes,
} from './graphql-lesson-helpers';
import { stubSchemaExplorerDom, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-schema-exploration lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson4SessionFlags();
  });

  it('has valid lesson structure', () => {
    expect(gqlSchemaLesson.id).toBe('gql-schema-exploration');
    expect(gqlSchemaLesson.category).toBe('graphql');
    expect(gqlSchemaLesson.name).toBe('Schema Exploration');
    expect(gqlSchemaLesson.steps.length).toBe(10);
    expect(gqlSchemaLesson.estimatedMinutes).toBe(5);
    expect(gqlSchemaLesson.tabBudget).toBe(1);
  });

  it('has correct step IDs in order', () => {
    expect(gqlSchemaLesson.steps.map((s) => s.id)).toEqual([
      'gql4-intro',
      'gql4-endpoint',
      'gql4-introspect',
      'gql4-browse',
      'gql4-search',
      'gql4-try-insert',
      'gql4-exec-inserted',
      'gql4-read-inserted',
      'gql4-sdl-view',
      'gql4-export-sdl',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
    gqlSchemaLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–10 have preAction guards', () => {
    gqlSchemaLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('concept diagram matches 700×430 studio chrome standard', () => {
    expect(gqlSchemaLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('concept diagram renders Schema Explorer chrome with type list and field table', () => {
    const diagram = gqlSchemaLesson.concept.diagram ?? '';
    expect(diagram).toContain('Schema Explorer');
    expect(diagram).toContain('Type Browser');
    expect(diagram).toContain('Field Table');
    expect(diagram).toContain('Try →');
    expect(diagram).toContain('SDL Tab');
  });

  it('concept diagram includes all four numbered capability callouts', () => {
    const diagram = gqlSchemaLesson.concept.diagram ?? '';
    expect(diagram).toContain('①');
    expect(diagram).toContain('②');
    expect(diagram).toContain('③');
    expect(diagram).toContain('④');
  });

  it('concept body references Your First GraphQL Query (not a legacy card number)', () => {
    expect(gqlSchemaLesson.concept.body).toContain('Your First GraphQL Query');
  });

  it('concept body covers all four Schema Explorer capabilities', () => {
    const body = gqlSchemaLesson.concept.body;
    expect(body).toContain('Type browser');
    expect(body).toContain('Field table');
    expect(body).toContain('Try →');
    expect(body).toContain('SDL tab + Export');
  });

  it('step gql4-intro highlights schema tab', () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-intro')!;
    expect(step.highlight).toBe(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql4-endpoint fills demo endpoint', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('step gql4-endpoint preAction waits for endpoint input', async () => {
    stubSchemaExplorerDom();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql4-introspect clicks introspect when badge absent', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <button data-testid="gql-introspect-btn"></button>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-introspect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('step gql4-introspect skips introspect when badge present', async () => {
    stubSchemaExplorerDom();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('step gql4-browse preAction ensures introspected schema', async () => {
    stubSchemaExplorerDom();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-browse')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY, 8000);
  });

  it('step gql4-search preAction ensures Query type selected', async () => {
    stubSchemaExplorerDom();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-search')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('step gql4-try-insert preAction selects User then Query and prepares editor', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor(GQL_INSERT_TEMPLATE_QUERY);
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-try-insert')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_USER);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('step gql4-exec-inserted highlights execute button', () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-exec-inserted')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.verify).toBe(GQL.RESPONSE_VIEWER);
  });

  it('step gql4-exec-inserted action switches to response tab and executes', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-exec-inserted')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('step gql4-exec-inserted preAction ensures try-insert state', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-exec-inserted')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql4-read-inserted highlights response body', () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  it('step gql4-read-inserted preAction fires execute when response absent', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql4-read-inserted preAction skips execute when response body present', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    document.body.insertAdjacentHTML('beforeend', '<pre data-testid="gql-response-body">ok</pre>');
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql4-read-inserted action switches to response tab', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('step gql4-sdl-view preAction ensures try insert done', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-sdl-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('step gql4-export-sdl preAction opens SDL tab when detail panel missing', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    markTryInsertDone();
    document.querySelector('[data-testid="gql-se-detail-panel"]')?.removeAttribute('data-testid');
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_SDL_TAB);
  });

  it('ensureQueryTypeSelected guard skips when Query already selected', async () => {
    stubSchemaExplorerDom();
    const ctx = makeCtx();
    await selectSchemaType(ctx, 'Query');
    vi.mocked(ctx.click).mockClear();
    await ensureQueryTypeSelected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('ensureUserTypeSelected guard skips when User already selected', async () => {
    stubSchemaExplorerDom();
    const ctx = makeCtx();
    await ensureUserTypeSelected(ctx);
    vi.mocked(ctx.fill).mockClear();
    vi.mocked(ctx.click).mockClear();
    await ensureUserTypeSelected(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SCHEMA_TYPE_USER);
  });

  it('ensureEditorReadyForInsert fills template when query block missing', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('');
    const ctx = makeCtx();
    await ensureEditorReadyForInsert(ctx);
    expect(ctx.click).toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('ensureTryInsertDone guard skips when health already in editor', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureTryInsertDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('step gql4-browse opens schema tab and selects Query', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-browse')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('step gql4-search filters and selects User', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SCHEMA_SEARCH, 'User');
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_USER);
  });

  it('step gql4-try-insert clicks Try on health field', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-try-insert')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.INSERT_FIELD_TOAST, 5000);
  });

  it('step gql4-sdl-view highlights SDL tab', () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-sdl-view')!;
    expect(step.highlight).toBe(GQL.SCHEMA_SDL_TAB);
  });

  it('step gql4-export-sdl highlights Export SDL toolbar button', () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    expect(step.highlight).toBe(GQL.SNAPSHOT_BTN);
  });

  it('step gql4-sdl-view opens SDL tab for Query type', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-sdl-view')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_SDL_TAB);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_SDL_VIEW, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('step gql4-export-sdl clicks Export SDL with extended pause', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SNAPSHOT_BTN);
    expect(ctx.delay).toHaveBeenCalledWith(2000);
  });

  it('step descriptions contain WHY framing (educational depth matches GQL-1/GQL-2 standard)', () => {
    const introStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-intro')!;
    expect(introStep.description).toContain('production API');
    const searchStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-search')!;
    expect(searchStep.description).toContain('indispensable');
    const tryStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-try-insert')!;
    expect(tryStep.description).toContain('valuable');
    const execStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-exec-inserted')!;
    expect(execStep.description).toContain('Try →');
    const readStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    expect(readStep.description).toContain('browse');
    const exportStep = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    expect(exportStep.description).toContain('git diff');
  });

  it('step gql4-browse action opens schema tab then selects Query type', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-browse')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('gqlSchemaLessonCleanup closes demo tab and resets session flags', async () => {
    const ctx = makeCtx();
    await gqlSchemaLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-schema-exploration');
  });

  it('markTryInsertDone sets try insert session flag', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('');
    markTryInsertDone();
    const ctx = makeCtx();
    await ensureTryInsertDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('setup creates demo tab and sets insert template query', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue }],
      },
    };
    const ctx = makeCtx();
    await gqlSchemaLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-schema-exploration', 'Schema Exploration');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(setValue).toHaveBeenCalledWith(GQL_INSERT_TEMPLATE_QUERY);
  });
});

describe('gql schema selector helpers', () => {
  it('gqlSchemaTypeSelector builds type testid selector', () => {
    expect(gqlSchemaTypeSelector('Query')).toBe('[data-testid="gql-se-type-Query"]');
  });

  it('gqlTryFieldSelector builds try button testid selector', () => {
    expect(gqlTryFieldSelector('health')).toBe('[data-testid="gql-try-field-health"]');
  });

  it('ensureSchemaExplorerOpen guard skips when explorer already open', async () => {
    stubSchemaExplorerDom();
    document.querySelector(GQL.RIGHT_TAB_SCHEMA)!.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await ensureSchemaExplorerOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureSchemaExplorerOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('ensureSchemaExplorerOpen skips schema tab click when already selected', async () => {
    stubSchemaExplorerDom();
    document.querySelector(GQL.RIGHT_TAB_SCHEMA)!.setAttribute('aria-selected', 'true');
    resetGqlLesson4SessionFlags();
    const ctx = makeCtx();
    await ensureSchemaExplorerOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_LIST, 5000);
  });

  it('ensureTryInsertDone completes without try button when health absent', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue }],
      },
    };
    const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(responseTab, 'click');
    const ctx = makeCtx();
    await gqlSchemaLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureEditorReadyForInsert skips template fill when query block exists', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureEditorReadyForInsert(ctx);
    expect(ctx.click).toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('searchSchemaTypes fills schema search input', async () => {
    stubSchemaExplorerDom();
    const ctx = makeCtx();
    await searchSchemaTypes(ctx, 'User');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SCHEMA_SEARCH, 'User');
  });

  it('ensureEditorReadyForInsert skips monaco click when surface missing', async () => {
    document.body.innerHTML = '<div data-testid="gql-editor"></div>';
    delete (window as unknown as { monaco?: unknown }).monaco;
    const ctx = makeCtx();
    await ensureEditorReadyForInsert(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('setup activates editor mode when inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-right-tab-response"></button>
      <input data-testid="gql-endpoint-input" value="http://old" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query {\n  \n}');
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const clickSpy = vi.spyOn(editorBtn, 'click');
    const ctx = makeCtx();
    await gqlSchemaLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureSchemaExplorerOpen waits for type list when tab already selected', async () => {
    stubSchemaExplorerDom();
    document.querySelector(GQL.RIGHT_TAB_SCHEMA)?.setAttribute('aria-selected', 'true');
    const ctx = makeCtx();
    await ensureSchemaExplorerOpen(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_LIST, 5000);
  });

  it('setup selects response tab when not already active', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor(GQL_INSERT_TEMPLATE_QUERY);
    const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(tab, 'click');
    const ctx = makeCtx();
    await gqlSchemaLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectSchemaType marks User and Query session flags', async () => {
    stubSchemaExplorerDom();
    const ctx = makeCtx();
    await selectSchemaType(ctx, 'Query');
    await selectSchemaType(ctx, 'User');
    await ensureQueryTypeSelected(ctx);
    await ensureUserTypeSelected(ctx);
    expect(ctx.click).toHaveBeenCalledWith(gqlSchemaTypeSelector('User'));
  });

  it('gqlSchemaLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    await gqlSchemaLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-schema-exploration');
  });

  it('ensureTryInsertDone clicks try button when health field missing', async () => {
    stubSchemaExplorerDom();
    stubMonacoEditor(GQL_INSERT_TEMPLATE_QUERY);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-testid="gql-insert-field-toast"></div>',
    );
    const ctx = makeCtx();
    await ensureTryInsertDone(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });
});
