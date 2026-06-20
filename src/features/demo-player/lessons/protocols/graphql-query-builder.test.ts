/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON7_EDITOR_COMMENT,
  LESSON7_USER_ALIAS,
  LESSON7_USER_FIELD_PATH,
  resetGqlLesson7SessionFlags,
  resetGqlLessonSessionFlags,
  gqlQueryBuilderLessonSetup,
} from './graphql-lesson-helpers';

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
    expect(gqlQueryBuilderLesson.estimatedMinutes).toBe(4);
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

  it('setup clears endpoint and switches to editor mode', async () => {
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('lesson constants match field option paths', () => {
    expect(LESSON7_USER_FIELD_PATH).toBe('user.id');
    expect(LESSON7_USER_ALIAS).toBe('userId');
    expect(LESSON7_EDITOR_COMMENT).toBe('# edited in editor');
  });
});
