/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlVariablesLesson } from './graphql-variables';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_USER_QUERY,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
  getDemoUserAId,
  getDemoUserBId,
  gqlVariablesLessonSetup,
} from './graphql-lesson-helpers';

describe('gql-variables lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson2SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Structure & metadata ────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlVariablesLesson.id).toBe('gql-variables');
    expect(gqlVariablesLesson.domainId).toBe('protocols');
    expect(gqlVariablesLesson.category).toBe('graphql');
    expect(gqlVariablesLesson.name).toBe('Variables & Arguments');
    expect(gqlVariablesLesson.steps.length).toBe(8);
    expect(gqlVariablesLesson.estimatedMinutes).toBe(3);
    expect(gqlVariablesLesson.initialTab).toBe('graphql-studio');
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlVariablesLesson.tag).toBe('🐳 Docker');
    expect(gqlVariablesLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlVariablesLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlVariablesLesson.setup).toBe('function');
    expect(typeof gqlVariablesLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    const ids = gqlVariablesLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'gql2-intro',
      'gql2-endpoint',
      'gql2-introspect',
      'gql2-write-query',
      'gql2-open-vars',
      'gql2-execute-alice',
      'gql2-execute-bob',
      'gql2-compare',
    ]);
  });

  it('all 8 steps have pauseAfter: true', () => {
    gqlVariablesLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–8 have preAction guards', () => {
    const stateful = gqlVariablesLesson.steps.slice(1);
    stateful.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql2-intro has no preAction', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-intro')!;
    expect(step.preAction).toBeUndefined();
  });

  it('concept keyTerms cover variable definition, value, argument, and required', () => {
    const terms = (gqlVariablesLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms.some((t) => t.includes('Variable definition'))).toBe(true);
    expect(terms.some((t) => t.includes('Variable value'))).toBe(true);
    expect(terms).toContain('Argument');
    expect(terms.some((t) => t.includes('Required'))).toBe(true);
  });

  it('step gql2-intro highlights variables tab', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-intro')!;
    expect(step.highlight).toBe(GQL.BOTTOM_TAB_VARS);
  });

  it('step gql2-compare highlights response body', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-compare')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  // ─── Step actions ────────────────────────────────────────────

  it('step gql2-endpoint fills the demo HTTP endpoint', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('step gql2-introspect clicks introspect when badge absent', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('step gql2-open-vars opens variables panel', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-open-vars')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.VARS_PANEL, 5000);
  });

  it('step gql2-write-query fills parameterized user query', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(setValue).toHaveBeenCalled();
  });

  it('step gql2-execute-alice fills alice id and executes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    await seedDemoUsers();
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const varsSetValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{}', setValue: varsSetValue }],
        getEditors: () => [{
          getModel: () => ({ uri: { toString: () => 'inmemory://graphql-vars/tab-1' } }),
          setValue: varsSetValue,
        }],
      },
    };
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-execute-alice')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(varsSetValue).toHaveBeenCalledWith(JSON.stringify({ id: getDemoUserAId() }, null, 2));
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql2-execute-bob fills bob id and re-executes', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-1' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-2' } } }) }));
    await seedDemoUsers();
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const varsSetValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{}', setValue: varsSetValue }],
        getEditors: () => [{
          getModel: () => ({ uri: { toString: () => 'inmemory://graphql-vars/tab-1' } }),
          setValue: varsSetValue,
        }],
      },
    };
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-execute-bob')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(varsSetValue).toHaveBeenCalledWith(JSON.stringify({ id: getDemoUserBId() }, null, 2));
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql2-compare switches to response tab', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-compare')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('seedDemoUsers creates Alice and Bob and stores ids', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-10' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-11' } } }) }));
    await seedDemoUsers();
    expect(getDemoUserAId()).toBe('usr-10');
    expect(getDemoUserBId()).toBe('usr-11');
  });

  it('setup clears endpoint and resets editors', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"></div>
    `;
    const querySetValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => 'old', setValue: querySetValue }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue: querySetValue }],
      },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-1' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-2' } } }) }));
    const ctx = makeCtx();
    await gqlVariablesLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(querySetValue).toHaveBeenCalledWith('query { }');
  });
});

describe('gql-variables lesson query constant', () => {
  it('GQL_USER_QUERY declares $id and references user(id: $id)', () => {
    expect(GQL_USER_QUERY).toContain('$id: ID!');
    expect(GQL_USER_QUERY).toContain('user(id: $id)');
    expect(GQL_USER_QUERY).toContain('GetUser');
  });
});
