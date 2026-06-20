/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gqlSchemaLesson } from './graphql-schema-exploration';
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
} from './graphql-lesson-helpers';

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
    expect(gqlSchemaLesson.steps.length).toBe(7);
    expect(gqlSchemaLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    expect(gqlSchemaLesson.steps.map((s) => s.id)).toEqual([
      'gql4-intro',
      'gql4-endpoint',
      'gql4-introspect',
      'gql4-browse',
      'gql4-search',
      'gql4-try-insert',
      'gql4-sdl-export',
    ]);
  });

  it('all 7 steps have pauseAfter: true', () => {
    gqlSchemaLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–7 have preAction guards', () => {
    gqlSchemaLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
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

  it('step gql4-sdl-export opens SDL tab and clicks export', async () => {
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-sdl-export')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_SDL_TAB);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SNAPSHOT_BTN);
  });

  it('setup clears endpoint and sets insert template query', async () => {
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
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
});
