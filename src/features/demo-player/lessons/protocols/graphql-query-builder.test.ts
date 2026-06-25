/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql8'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON7_EDITOR_COMMENT,
  LESSON7_USER_ALIAS,
  LESSON7_USER_FIELD_PATH,
  resetGqlLesson7SessionFlags,
  resetGqlLessonSessionFlags,
  gqlQueryBuilderLessonSetup,
  gqlQueryBuilderLessonCleanup,
  ensureBuilderMode,
  ensureHealthFieldSelected,
  ensureSelectAllDemonstrated,
  ensureUserFieldConfigured,
  ensureAliasConfigured,
  ensureIncludeConfigured,
  ensureEditedToEditor,
  getBuilderCodeText,
  getMonacoGqlModel,
} from './graphql-lesson-helpers';
import { stubBuilderFieldTree, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-query-builder lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson7SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlQueryBuilderLesson.id).toBe('gql-query-builder');
    expect(gqlQueryBuilderLesson.category).toBe('graphql');
    expect(gqlQueryBuilderLesson.name).toBe('Query Builder — Visual Operations');
    expect(gqlQueryBuilderLesson.steps.length).toBe(10);
    expect(gqlQueryBuilderLesson.estimatedMinutes).toBe(5);
    expect(gqlQueryBuilderLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlQueryBuilderLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlQueryBuilderLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlQueryBuilderLesson.steps.map((s) => s.id)).toEqual([
      'gql7-builder',
      'gql7-expand',
      'gql7-health',
      'gql7-select-all',
      'gql7-user-arg',
      'gql7-alias',
      'gql7-include',
      'gql7-copy',
      'gql7-edit',
      'gql7-one-way',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
    gqlQueryBuilderLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 1–10 have preAction guards', () => {
    gqlQueryBuilderLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ─── Concept & diagram ───────────────────────────────────────────────────

  it('concept body explains WHY builder mode exists', () => {
    expect(gqlQueryBuilderLesson.concept.body).toContain('Builder');
    expect(gqlQueryBuilderLesson.concept.body).toContain('One-way sync');
  });

  it('concept body explains alias and directive WHY', () => {
    expect(gqlQueryBuilderLesson.concept.body).toContain('alias');
    expect(gqlQueryBuilderLesson.concept.body).toContain('@include');
  });

  it('concept diagram is 700×430 studio chrome SVG', () => {
    const diag = gqlQueryBuilderLesson.concept.diagram;
    expect(diag).toContain('viewBox="0 0 700 430"');
    expect(diag).toContain('GraphQL Studio — Query Builder');
    expect(diag).toContain('Builder');
    expect(diag).toContain('Field Tree');
    expect(diag).toContain('SDL Preview');
    expect(diag).toContain('Summary');
  });

  it('concept diagram shows one-way sync legend', () => {
    expect(gqlQueryBuilderLesson.concept.diagram).toContain('Edit in Editor');
    expect(gqlQueryBuilderLesson.concept.diagram).toContain('not synced back');
  });

  it('concept keyTerms cover Builder mode, field tree, SDL preview, summary, alias, one-way sync', () => {
    const terms = (gqlQueryBuilderLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Builder mode');
    expect(terms).toContain('Field tree');
    expect(terms).toContain('SDL preview');
    expect(terms).toContain('Summary panel');
    expect(terms).toContain('Field alias');
    expect(terms).toContain('One-way sync');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql7-builder highlights MODE_BUILDER (Builder tab before switching)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    expect(step.highlight).toBe(GQL.MODE_BUILDER);
    expect(step.verify).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-expand highlights QB_FIELD_TREE (expand button is in field tree)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-expand')!;
    expect(step.highlight).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-health highlights QB_FIELD_TREE (live SDL preview updates)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-health')!;
    expect(step.highlight).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-select-all highlights QB_SELECT_ALL', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-select-all')!;
    expect(step.highlight).toBe(GQL.QB_SELECT_ALL);
  });

  it('gql7-user-arg highlights QB_ARG_USER_ID (argument input)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-user-arg')!;
    expect(step.highlight).toBe(GQL.QB_ARG_USER_ID);
  });

  it('gql7-alias highlights FO_EXPAND_USER_ID (field options row in Summary)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-alias')!;
    expect(step.highlight).toBe(GQL.FO_EXPAND_USER_ID);
  });

  it('gql7-include highlights FO_EXPAND_USER_ID (field options row in Summary)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-include')!;
    expect(step.highlight).toBe(GQL.FO_EXPAND_USER_ID);
  });

  it('gql7-copy highlights QB_COPY button', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-copy')!;
    expect(step.highlight).toBe(GQL.QB_COPY);
  });

  it('gql7-edit highlights QB_EDIT button', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-edit')!;
    expect(step.highlight).toBe(GQL.QB_EDIT);
  });

  it('gql7-one-way highlights QB_CODE (generated SDL without editor comment)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    expect(step.highlight).toBe(GQL.QB_CODE);
    expect(step.verify).toBe(GQL.QB_CODE);
  });

  // ─── Step description WHY content ────────────────────────────────────────

  it('gql7-builder description explains why builder exists', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    expect(step.description).toContain('Builder');
    expect(step.description).toContain('health');
  });

  it('gql7-health description explains live preview feedback loop', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-health')!;
    expect(step.description).toContain('live');
    expect(step.description).toContain('health');
  });

  it('gql7-user-arg description explains required arg inline surfacing', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-user-arg')!;
    expect(step.description).toContain('required');
    expect(step.description).toContain('id');
  });

  it('gql7-alias description references user › id breadcrumb row', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-alias')!;
    expect(step.description).toContain('user › id');
    expect(step.description).toContain('userId');
  });

  it('gql7-include description explains @include directive runtime behavior', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-include')!;
    expect(step.description).toContain('@include');
    expect(step.description).toContain('@skip');
  });

  it('gql7-one-way description explains selection model limitation', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    expect(step.description).toContain('one-way');
    expect(step.description).toContain('selection model');
    expect(step.description).toContain('Generated query');
  });

  // ─── Existing step action tests ───────────────────────────────────────────

  it('gql7-builder action switches to builder mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree"></div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('gql7-health action selects health field', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <span class="gql-qb-expand-spacer"></span>
          <button class="gql-qb-check" type="button"></button>
          <span class="gql-qb-field-name">health</span>
        </div>
      </div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-health')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(step.verify).toBe(GQL.QB_CODE);
  });

  it('gql7-select-all clicks select-all twice', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <span class="gql-qb-expand-spacer"></span>
          <button class="gql-qb-check gql-qb-check--checked" type="button"></button>
          <span class="gql-qb-field-name">health</span>
        </div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-select-all')!;
    await step.preAction!(ctx);
    // Isolate action clicks from preAction guard-chain side effects
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_SELECT_ALL);
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  it('gql7-copy clicks copy button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-qb-copy"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree"></div>
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { userId: user(id: "1") { id } @include }</pre>
      <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      <div class="gql-qb-fo-row"><button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button><div class="gql-qb-fo-body"><input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" /><button data-testid="gql-fo-include-user.id" aria-checked="true"></button></div></div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-copy')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_COPY);
  });

  it('gql7-edit clicks edit in editor', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree"></div>
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
      <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      <div class="gql-qb-fo-row"><button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button><div class="gql-qb-fo-body"><input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" /><button data-testid="gql-fo-include-user.id" aria-checked="true"></button></div></div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-edit')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('gql7-expand expands user row when collapsed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(false)}
    `;
    const expandBtn = document.querySelector<HTMLElement>('.gql-qb-expand-btn')!;
    const clickSpy = vi.spyOn(expandBtn, 'click');
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-expand')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gql7-expand skips expand click when user row already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
    `;
    const expandBtn = document.querySelector<HTMLElement>('.gql-qb-expand-btn')!;
    const clickSpy = vi.spyOn(expandBtn, 'click');
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-expand')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('gql7-user-arg configures user field and id argument', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
      <button data-testid="gql-qb-select-all"></button>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-user-arg')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.QB_ARG_USER_ID, expect.any(String));
  });

  it('gql7-alias sets userId alias in summary panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
      <button data-testid="gql-qb-select-all"></button>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="" />
          </div>
        </div>
      </div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-alias')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.FO_ALIAS_USER_ID, LESSON7_USER_ALIAS);
  });

  it('gql7-include toggles @include directive', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
      <button data-testid="gql-qb-select-all"></button>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" />
            <button data-testid="gql-fo-include-user.id"></button>
          </div>
        </div>
      </div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-include')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.FO_INCLUDE_USER_ID);
  });

  it('gql7-one-way adds editor comment and switches modes', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_EDITOR);
    expect(getMonacoGqlModel()?.getValue()).toContain(LESSON7_EDITOR_COMMENT);
  });

  it('gql7-one-way skips comment append when already present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    const { setQuery } = stubMonacoEditor(`query { health }\n${LESSON7_EDITOR_COMMENT}`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    vi.mocked(setQuery).mockClear();
    await step.action!(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureBuilderMode guard skips click when builder already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree()}
    `;
    await ensureBuilderMode(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBuilderMode(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('ensureHealthFieldSelected guard skips when health already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <span class="gql-qb-expand-spacer"></span>
          <button class="gql-qb-check gql-qb-check--checked"></button>
          <span class="gql-qb-field-name">health</span>
        </div>
      </div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    await ensureHealthFieldSelected(ctx);
    const healthCheck = document.querySelector<HTMLElement>('.gql-qb-check')!;
    const clickSpy = vi.spyOn(healthCheck, 'click');
    await ensureHealthFieldSelected(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(getBuilderCodeText()).toContain('health');
  });

  it('ensureSelectAllDemonstrated guard skips repeat select-all clicks', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree()}
      <button data-testid="gql-qb-select-all"></button>
    `;
    await ensureSelectAllDemonstrated(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureSelectAllDemonstrated(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_SELECT_ALL);
  });

  it('setup creates demo tab and switches to editor mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { createUser: { id: 'usr-1' } },
      }),
    }));
    await gqlQueryBuilderLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-query-builder',
      'Query Builder — Visual Operations',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gql7-one-way keeps preview when editor comment not synced to builder', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <pre data-testid="gql-qb-code">query { health }\n${LESSON7_EDITOR_COMMENT}</pre>
    `;
    stubMonacoEditor(`query { health }\n${LESSON7_EDITOR_COMMENT}`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('lesson constants match field option paths', () => {
    expect(LESSON7_USER_FIELD_PATH).toBe('user.id');
    expect(LESSON7_USER_ALIAS).toBe('userId');
    expect(LESSON7_EDITOR_COMMENT).toBe('# edited in editor');
  });

  it('ensureIncludeConfigured guard skips when @include already in code', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
      <button data-testid="gql-qb-select-all"></button>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" />
            <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
          </div>
        </div>
      </div>
      <pre data-testid="gql-qb-code">query { userId: user(id: "1") { id @include } }</pre>
    `;
    await ensureIncludeConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureIncludeConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.FO_INCLUDE_USER_ID);
  });

  it('ensureEditedToEditor guard skips when editor already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    await ensureEditedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureEditedToEditor(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('gql7-one-way skips preview delay when comment already in builder code', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <pre data-testid="gql-qb-code">query { health }\n${LESSON7_EDITOR_COMMENT}</pre>
    `;
    stubMonacoEditor(`query { health }\n${LESSON7_EDITOR_COMMENT}`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('gql7-expand skips expand when user row not found', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <span class="gql-qb-expand-spacer"></span>
          <button class="gql-qb-check"></button>
          <span class="gql-qb-field-name">health</span>
        </div>
      </div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-expand')!;
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql7-builder step opens builder mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree"></div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('ensureUserFieldConfigured skips check click when user already partial', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button>
          <button class="gql-qb-check gql-qb-check--partial"></button>
          <span class="gql-qb-field-name">user</span>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" />
      <button data-testid="gql-qb-select-all"></button>
      <div data-testid="gql-qb-code">query { user(id: "usr-1") { id } }</div>
    `;
    await ensureSelectAllDemonstrated(ctx);
    const userCheck = document.querySelector('.gql-qb-check')!;
    const clickSpy = vi.spyOn(userCheck, 'click');
    await ensureUserFieldConfigured(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureIncludeConfigured skips toggle when @include already enabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row">
          <button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button>
          <button class="gql-qb-check gql-qb-check--checked"></button>
          <span class="gql-qb-field-name">user</span>
        </div>
        <div class="gql-qb-field-row">
          <button class="gql-qb-check gql-qb-check--checked"></button>
          <span class="gql-qb-field-name">health</span>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
      <button data-testid="gql-qb-select-all"></button>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button class="gql-qb-fo-expand" title="user.id"></button>
          <div class="gql-qb-fo-body"></div>
        </div>
        <input data-testid="gql-fo-alias-user.id" />
        <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
      </div>
      <div data-testid="gql-qb-code">query { user(id: "usr-1") { userId: id @include(if: true) } health }</div>
    `;
    await ensureAliasConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureIncludeConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.FO_INCLUDE_USER_ID);
  });

  it('gqlQueryBuilderLessonSetup catches seedDemoUsers failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <input data-testid="gql-endpoint-input" value="http://old" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('');
    const ctx = makeCtx();
    await gqlQueryBuilderLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-query-builder',
      'Query Builder — Visual Operations',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlQueryBuilderLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    await gqlQueryBuilderLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-query-builder');
  });

  it('gql7-one-way handles absent monaco model by filling comment via helper', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    delete (window as unknown as { monaco?: unknown }).monaco;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });
});
