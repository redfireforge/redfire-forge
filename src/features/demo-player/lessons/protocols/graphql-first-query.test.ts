/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gqlFirstQueryLesson } from './graphql-first-query';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  resetGqlLessonSessionFlags,
  fillGqlEditor,
  getGqlEditorQuery,
  gqlFirstQuerySetup,
} from './graphql-lesson-helpers';

describe('gql-first-query lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
  });

  // ─── Structure & metadata ────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlFirstQueryLesson.id).toBe('gql-first-query');
    expect(gqlFirstQueryLesson.domainId).toBe('protocols');
    expect(gqlFirstQueryLesson.category).toBe('graphql');
    expect(gqlFirstQueryLesson.name).toBe('Your First GraphQL Query');
    expect(gqlFirstQueryLesson.steps.length).toBe(7);
    expect(gqlFirstQueryLesson.estimatedMinutes).toBe(3);
    expect(gqlFirstQueryLesson.initialTab).toBe('graphql-studio');
    expect(gqlFirstQueryLesson.concept.title).toBeTruthy();
    expect(gqlFirstQueryLesson.concept.body).toBeTruthy();
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlFirstQueryLesson.tag).toBe('🐳 Docker');
    expect(gqlFirstQueryLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlFirstQueryLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlFirstQueryLesson.setup).toBe('function');
    expect(typeof gqlFirstQueryLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    const ids = gqlFirstQueryLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'gql1-intro',
      'gql1-endpoint',
      'gql1-introspect',
      'gql1-schema',
      'gql1-write-query',
      'gql1-execute',
      'gql1-history',
    ]);
  });

  it('all 7 steps have pauseAfter: true', () => {
    gqlFirstQueryLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–7 have preAction guards', () => {
    const stateful = gqlFirstQueryLesson.steps.slice(1);
    stateful.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql1-intro has no preAction', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-intro')!;
    expect(step.preAction).toBeUndefined();
  });

  it('concept keyTerms cover introspection, operation, schema, and history', () => {
    const terms = (gqlFirstQueryLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Introspection');
    expect(terms).toContain('Operation');
    expect(terms).toContain('Schema');
    expect(terms).toContain('History');
  });

  it('step gql1-schema highlights schema tab (visible before panel opens)', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-schema')!;
    expect(step.highlight).toBe(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql1-history highlights history activity button', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-history')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_HISTORY);
  });

  // ─── Step actions ────────────────────────────────────────────

  it('step gql1-endpoint fills the demo HTTP endpoint', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('step gql1-endpoint preAction waits for endpoint input', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql1-introspect clicks introspect when badge absent', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('step gql1-introspect skips click when badge already present', async () => {
    document.body.innerHTML = '<div data-testid="gql-schema-badge-ok"></div>';
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step gql1-schema switches to schema tab', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-schema')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_EXPLORER, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_LIST, 5000);
  });

  it('step gql1-execute clicks execute and waits for response', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-execute')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('step gql1-history opens history panel and waits for entry', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_PANEL, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_ENTRY, 5000);
  });

  it('step gql1-write-query ensures editor mode before filling', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    const setValue = vi.fn();
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
      },
    };
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-write-query')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
    expect(setValue).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
  });

  // ─── Setup ───────────────────────────────────────────────────

  it('setup clears endpoint and resets editor query', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => 'old', setValue }],
      },
    };
    const ctx = makeCtx();
    await gqlFirstQuerySetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(setValue).toHaveBeenCalledWith('query { }');
  });
});

describe('graphql-lesson-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
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
});
