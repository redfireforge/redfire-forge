/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql8'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

import {
  setupGraphqlQueryBuilderBeforeEach,
  teardownGraphqlQueryBuilderAfterEach,
} from './graphql-query-builder.testHelpers';
import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON7_EDITOR_COMMENT,
  LESSON7_USER_ALIAS,
  LESSON7_USER_FIELD_PATH,
  gqlQueryBuilderLessonSetup,
  gqlQueryBuilderLessonCleanup,
  ensureBuilderMode,
  ensureHealthFieldSelected,
  ensureSelectAllDemonstrated,
  ensureUserFieldConfigured,
  ensureAliasConfigured,
  ensureIncludeConfigured,
  ensureEditedToEditor,
  ensureInEditorAfterTransfer,
  prepareEditInEditorReading,
  getBuilderCodeText,
  getMonacoGqlModel,
} from './graphql-lesson-helpers';
import { stubBuilderFieldTree, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-query-builder lesson — actions', () => {
  beforeEach(() => {
    setupGraphqlQueryBuilderBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlQueryBuilderAfterEach();
  });

// ─── Existing step action tests ───────────────────────────────────────────

  it('gql7-builder action switches to builder mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-activity-mock" class="gql-activity-tab--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree"></div>
    `;
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
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

  it('prepareEditInEditorReading returns to Builder when Editor is active before transfer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health user(id: "1") { userId: id @include(if: true) name email } }</pre>
      <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      <div class="gql-qb-fo-row"><button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button><div class="gql-qb-fo-body"><input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" /><button data-testid="gql-fo-include-user.id" aria-checked="true"></button></div></div>
    `;
    await prepareEditInEditorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_EDIT);
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

  it('gql7-editor-comment adds editor comment in editor mode', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-editor-comment')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(getMonacoGqlModel()?.getValue()).toContain(LESSON7_EDITOR_COMMENT);
  });

  it('gql7-editor-comment skips when comment already present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    const { setQuery } = stubMonacoEditor(`${LESSON7_EDITOR_COMMENT}\nquery { health }`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-editor-comment')!;
    await step.preAction!(ctx);
    vi.mocked(setQuery).mockClear();
    await step.action!(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('gql7-one-way action pauses on editor before switching to builder', async () => {
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
    stubMonacoEditor(`${LESSON7_EDITOR_COMMENT}\nquery { health }`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.delay).mockClear();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1200);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(getMonacoGqlModel()?.getValue()).toContain(LESSON7_EDITOR_COMMENT);
  });

  it('gql7-one-way switches to builder after comment is present', async () => {
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
    stubMonacoEditor(`${LESSON7_EDITOR_COMMENT}\nquery { health }`);
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('gql7-one-way preAction adds comment quietly when missing (no typing demo)', async () => {
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
    stubMonacoEditor('query { health }');
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step.preAction!(ctx);
    expect(getMonacoGqlModel()?.getValue()).toContain(LESSON7_EDITOR_COMMENT);
    expect(ctx.delay).not.toHaveBeenCalledWith(2500);
  });

  it('gql7-one-way skips comment append when already present in preAction', async () => {
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
    const { setQuery } = stubMonacoEditor(`${LESSON7_EDITOR_COMMENT}\nquery { health }`);
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

  it('ensureEditedToEditor guard skips builder round-trip when editor already active after transfer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    stubMonacoEditor('query { health }');
    await ensureEditedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureEditedToEditor(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('ensureInEditorAfterTransfer uses Editor tab instead of Builder round-trip', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <pre data-testid="gql-qb-code">query { health }</pre>
    `;
    stubMonacoEditor('query { health }');
    await ensureEditedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureInEditorAfterTransfer(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('steps 9–11 perform a single Builder switch on step 11 only', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      ${stubBuilderFieldTree(true)}
      <div data-testid="gql-qb-field-options"></div>
      <pre data-testid="gql-qb-code">query { health }</pre>
      <div class="gql-qb-fo-row"><button class="gql-qb-fo-expand" title="${LESSON7_USER_FIELD_PATH}"></button><div class="gql-qb-fo-body"><input data-testid="gql-fo-alias-user.id" value="${LESSON7_USER_ALIAS}" /><button data-testid="gql-fo-include-user.id" aria-checked="true"></button></div></div>
    `;
    stubMonacoEditor('query { health }');
    const step9 = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-edit')!;
    const step10 = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-editor-comment')!;
    const step11 = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    await step9.preAction!(ctx);
    await step9.action!(ctx);
    await step10.preAction!(ctx);
    await step10.action!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step11.preAction!(ctx);
    await step11.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
    expect(vi.mocked(ctx.click).mock.calls.filter((c) => c[0] === GQL.MODE_BUILDER)).toHaveLength(1);
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
