/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql2'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
  purgeAllSpotlightRings: vi.fn(),
}));

import { gqlVariablesLesson } from './graphql-variables';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_VAR,
  GQL_USER_QUERY,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
  getDemoUserAId,
  getDemoUserBId,
  ensureParamUserQuery,
  ensureDemoEndpoint,
  ensureVariablesPanelOpen,
  ensureAliceVarsFilled,
  ensureBobVarsFilled,
  getGqlEditorQuery,
  gqlVariablesLessonSetup,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';
import * as gqlCore from './graphql-lesson-helpers/core';

function stubLesson2HistoryExecutionGuards(): void {
  vi.spyOn(gqlCore, 'ensureExecutedWithBob').mockResolvedValue(undefined);
}

const STEP_IDS = [
  'gql2-intro',
  'gql2-introspect',
  'gql2-schema',
  'gql2-write-query',
  'gql2-open-vars',
  'gql2-set-alice-vars',
  'gql2-exec-alice',
  'gql2-read-alice',
  'gql2-vars-metadata',
  'gql2-set-bob-vars',
  'gql2-exec-bob',
  'gql2-read-bob',
  'gql2-history',
  'gql2-history-search',
  'gql2-history-compare-mark',
  'gql2-history-compare',
];

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
    expect(gqlVariablesLesson.concept.title).toBe(gqlVariablesLesson.name);
    expect(gqlVariablesLesson.steps.length).toBe(16);
    expect(gqlVariablesLesson.estimatedMinutes).toBe(8);
    expect(gqlVariablesLesson.initialTab).toBe('graphql-studio');
    expect(gqlVariablesLesson.tabBudget).toBe(1);
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
    expect(ids).toEqual(STEP_IDS);
  });

  it('all 16 steps have pauseAfter: true', () => {
    gqlVariablesLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('all steps have preAction guards (intro keeps Studio; later steps recover state)', () => {
    gqlVariablesLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('concept keyTerms cover variable definition, value, argument, and required', () => {
    const terms = (gqlVariablesLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms.some((t) => t.includes('Variable definition'))).toBe(true);
    expect(terms.some((t) => t.includes('Variable value'))).toBe(true);
    expect(terms).toContain('Argument');
    expect(terms.some((t) => t.includes('Required'))).toBe(true);
  });

  it('concept body explains variables are sent separately from query string', () => {
    expect(gqlVariablesLesson.concept.body).toContain('variables');
    expect(gqlVariablesLesson.concept.body).toContain('injection');
  });

  it('concept diagram is 700×430 studio chrome SVG with Alice and Bob columns', () => {
    expect(gqlVariablesLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlVariablesLesson.concept.diagram).toContain('Run 1 — Alice');
    expect(gqlVariablesLesson.concept.diagram).toContain('Run 2 — Bob');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql2-intro highlights variables tab', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-intro')!;
    expect(step.highlight).toBe(GQL.BOTTOM_TAB_VARS);
  });

  it('gql2-intro mentions GQL-1 endpoint already connected (no env setup steps)', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-intro')!;
    expect(step.highlight).toBe(GQL.BOTTOM_TAB_VARS);
    expect(step.description).toMatch(/already connected/i);
    expect(gqlVariablesLesson.steps.some((s) => s.id === 'gql2-endpoint')).toBe(false);
    expect(gqlVariablesLesson.steps.some((s) => s.id === 'gql2-endpoint-resolved')).toBe(false);
  });

  it('gql2-introspect highlights introspect button not schema tab', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-introspect')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
    expect(step.highlight).not.toBe(GQL.RIGHT_TAB_SCHEMA);
    expect(step.description).not.toContain('Schema** tab');
  });

  it('gql2-schema highlights schema tab not introspect button', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-schema')!;
    expect(step.highlight).toBe(GQL.RIGHT_TAB_SCHEMA);
    expect(step.highlight).not.toBe(GQL.INTROSPECT_BTN);
    expect(step.description).toContain('Query');
  });

  it('gql2-write-query highlights editor', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    expect(step.highlight).toBe(GQL.EDITOR);
  });

  it('gql2-write-query has anatomy diagram with signature, argument, and selection set', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    expect(step.diagram).toBeDefined();
    expect(step.diagram).toContain('viewBox="0 0 680 300"');
    expect(step.diagram).toContain('Signature');
    expect(step.diagram).toContain('Argument');
    expect(step.diagram).toContain('Selection set');
    expect(step.diagram).toContain('($id: ID!)');
    expect(step.description).toContain('declared once');
  });

  it('gql2-open-vars highlights variables tab not panel', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-open-vars')!;
    expect(step.highlight).toBe(GQL.BOTTOM_TAB_VARS);
    expect(step.highlight).not.toBe(GQL.VARS_PANEL);
  });

  it('step gql2-set-alice-vars highlights variables panel', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-set-alice-vars')!;
    expect(step.highlight).toBe(GQL.VARS_PANEL);
  });

  it('step gql2-exec-alice highlights execute button not variables panel', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-exec-alice')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.description).not.toContain('"name": "Alice"');
  });

  it('step gql2-read-alice highlights data.user card and mentions Alice', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-read-alice')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_USER);
    expect(step.description).toContain('Alice');
    expect(step.description).toContain('data.user');
  });

  it('step gql2-vars-metadata highlights metadata tab and explains variables in POST body', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-vars-metadata')!;
    expect(step.highlight).toBe(GQL.RV_TAB_METADATA);
    expect(step.verify).toBe(GQL.RV_METADATA);
    expect(step.description).toContain('variables');
    expect(step.description).toContain('POST');
  });

  it('step gql2-exec-bob highlights execute button and defers response read to next step', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-exec-bob')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.description).toContain('next step');
    expect(step.description).not.toContain('History');
  });

  it('step gql2-read-bob highlights data.user card and mentions Bob', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-read-bob')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_USER);
    expect(step.description).toContain('Bob');
    expect(step.description).toContain('data.user');
    expect(step.description).not.toMatch(/history/i);
  });

  it('step gql2-set-bob-vars highlights variables panel and describes JSON editor', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-set-bob-vars')!;
    expect(step.highlight).toBe(GQL.VARS_PANEL);
    expect(step.description).toContain('Variables panel');
    expect(step.description).not.toMatch(/Variables\*\* tab/i);
  });

  it('step gql2-history highlights activity bar History icon not entry rows', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_HISTORY);
    expect(step.highlight).not.toBe(GQL.HISTORY_ENTRY);
    expect(step.description).toContain('History** icon');
    expect(step.description).toContain('auto-saved');
    expect(step.description).toContain('GetUser');
  });

  it('step gql2-history-search highlights search input and describes search bar only', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-search')!;
    expect(step.highlight).toBe(GQL.HISTORY_SEARCH);
    expect(step.description).toContain('search bar');
    expect(step.description).toContain('GetUser');
    expect(step.description).not.toMatch(/Response panel/i);
  });

  it('step gql2-history-compare-mark highlights compare toggle', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare-mark')!;
    expect(step.highlight).toBe(GQL.HISTORY_COMPARE_TOGGLE);
    expect(step.verify).toBe(GQL.HISTORY_COMPARE_BTN_ENABLED);
    expect(step.description).toContain('Alice');
  });

  it('step gql2-history-compare highlights compare button and describes View comparison', () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare')!;
    expect(step.highlight).toBe(GQL.HISTORY_COMPARE_BTN);
    expect(step.verify).toBe(GQL.HISTORY_COMPARE_TABLE);
    expect(step.description).toContain('View comparison');
    expect(step.description).not.toMatch(/Response panel/i);
  });

  /** Every step: highlight selector matches the primary UI element named in the description. */
  it('all steps have highlight aligned with description primary target', () => {
    const alignment: Array<{ id: string; highlight: string; includes: string[]; excludes?: RegExp[] }> = [
      { id: 'gql2-intro', highlight: GQL.BOTTOM_TAB_VARS, includes: ['Variables', 'already connected'] },
      { id: 'gql2-introspect', highlight: GQL.INTROSPECT_BTN, includes: ['Introspect'] },
      { id: 'gql2-schema', highlight: GQL.RIGHT_TAB_SCHEMA, includes: ['Schema** tab'] },
      { id: 'gql2-write-query', highlight: GQL.EDITOR, includes: ['editor'] },
      { id: 'gql2-open-vars', highlight: GQL.BOTTOM_TAB_VARS, includes: ['Variables** tab'] },
      { id: 'gql2-set-alice-vars', highlight: GQL.VARS_PANEL, includes: ['Variables JSON'] },
      { id: 'gql2-exec-alice', highlight: GQL.EXECUTE_BTN, includes: ['Execute'], excludes: [/Alice.*email/i] },
      { id: 'gql2-read-alice', highlight: GQL.RESPONSE_DATA_USER, includes: ['data.user', 'Alice'] },
      { id: 'gql2-vars-metadata', highlight: GQL.RV_TAB_METADATA, includes: ['Metadata** tab'] },
      { id: 'gql2-set-bob-vars', highlight: GQL.VARS_PANEL, includes: ['Variables panel'] },
      { id: 'gql2-exec-bob', highlight: GQL.EXECUTE_BTN, includes: ['Execute'] },
      { id: 'gql2-read-bob', highlight: GQL.RESPONSE_DATA_USER, includes: ['data.user', 'Bob'] },
      { id: 'gql2-history', highlight: GQL.ACTIVITY_HISTORY, includes: ['History** icon'] },
      { id: 'gql2-history-search', highlight: GQL.HISTORY_SEARCH, includes: ['search bar'] },
      { id: 'gql2-history-compare-mark', highlight: GQL.HISTORY_COMPARE_TOGGLE, includes: ['Compare'] },
      { id: 'gql2-history-compare', highlight: GQL.HISTORY_COMPARE_BTN, includes: ['View comparison'] },
    ];

    alignment.forEach(({ id, highlight, includes, excludes }) => {
      const step = gqlVariablesLesson.steps.find((s) => s.id === id)!;
      expect(step.highlight, `${id} highlight`).toBe(highlight);
      includes.forEach((text) => {
        expect(step.description, `${id} description`).toContain(text);
      });
      excludes?.forEach((pattern) => {
        expect(step.description, `${id} description`).not.toMatch(pattern);
      });
    });
  });

  // ─── Step actions ────────────────────────────────────────────

  it('step gql2-intro preAction lands on Studio Variables tab', async () => {
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <div data-testid="header-env-select"><span class="cs-text">GraphQL Demo</span></div>
      <div data-testid="header-svc-select"><span class="cs-text">graphql-demo</span></div>
      <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
      <button data-testid="gql-bottom-tab-variables"></button>
    `);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('graphql-studio');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS, 5000);
  });

  it('step gql2-introspect clicks introspect and waits for schema badge', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql2-introspect still clicks introspect when badge already present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>');
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql2-schema opens schema explorer and selects Query type', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-schema"></button>
      <div data-testid="gql-schema-explorer">
        <div data-testid="gql-se-type-list">
          <button data-testid="gql-se-type-Query">Query</button>
        </div>
      </div>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-schema')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_EXPLORER, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY, 10000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_QUERY);
  });

  it('step gql2-write-query preAction ensures introspected schema and seeds users', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(fetchMock).toHaveBeenCalled();
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

  it('step gql2-open-vars opens variables panel', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-open-vars')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.VARS_PANEL, 5000);
  });

  it('step gql2-set-alice-vars fills alice id in variables panel', async () => {
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
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-set-alice-vars')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(varsSetValue).toHaveBeenCalledWith(JSON.stringify({ id: getDemoUserAId() }, null, 2));
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql2-exec-alice clicks execute and waits for response viewer only', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-exec-alice')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.RESPONSE_DATA_USER, 8000);
  });

  it('step gql2-read-alice ensures data.user card is visible', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-read-alice')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_DATA_USER, 10000);
  });

  it('step gql2-set-bob-vars fills bob id in variables panel', async () => {
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
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-set-bob-vars')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(varsSetValue).toHaveBeenCalledWith(JSON.stringify({ id: getDemoUserBId() }, null, 2));
  });

  it('step gql2-vars-metadata clicks metadata tab and waits for metadata panel', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-vars-metadata')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RV_METADATA, 5000);
  });

  it('step gql2-read-bob focuses data.user card via ensureResponseDataUserVisible', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-response-data-user">Bob</div>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-read-bob')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_DATA_USER, 10000);
  });

  it('step gql2-exec-bob clicks execute and waits for response viewer only', async () => {
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-exec-bob')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.RESPONSE_DATA_USER, 8000);
  });

  it('step gql2-history-search fills GetUser search term', async () => {
    document.body.innerHTML = `<input data-testid="gql-history-search" />`;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'GetUser');
  });

  it('step gql2-history-compare-mark toggles compare and marks Alice and Bob', async () => {
    stubLesson2HistoryExecutionGuards();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <div data-testid="gql-history-entry"><button data-testid="gql-history-compare-mark"></button></div>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare-mark')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_TOGGLE);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'Alice');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.HISTORY_SEARCH, 'Bob');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED, 5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_MARK_UNMARKED);
  });

  it('step gql2-history-compare-mark preAction only ensures history panel', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-1' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-2' } } }) })
      .mockResolvedValue({ json: async () => ({ data: { user: { id: 'usr-2', name: 'Bob', email: 'bob@demo.local' } } }) }));
    await seedDemoUsers();
    stubGqlStudioShell(`
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-response-viewer"><div data-testid="gql-response-data-user">Bob</div></div>
    `);
    stubMonacoEditor(GQL_USER_QUERY);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare-mark')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_TOGGLE);
  });

  it('step gql2-history-compare preAction marks slots but does not open panel', async () => {
    stubLesson2HistoryExecutionGuards();
    document.body.innerHTML = `
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <input data-testid="gql-history-search" />
      <button data-testid="gql-history-compare-mark"></button>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
  });

  it('step gql2-history-compare action opens compare panel', async () => {
    stubLesson2HistoryExecutionGuards();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-compare-toggle" class="gql-history-compare-toggle--active"></button>
      <div data-testid="gql-history-compare-bar"></div>
      <div data-testid="gql-history-entry" data-compare-slot="A"></div>
      <div data-testid="gql-history-entry" data-compare-slot="B"></div>
      <button data-testid="gql-history-compare-btn"></button>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_COMPARE_PANEL, 5000);
  });

  it('step gql2-history-compare action skips panel open when compare panel already visible', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-history-compare-panel"></div>
    `;
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history-compare')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_COMPARE_BTN);
    expect(ctx.delay).toHaveBeenCalledWith(1000);
  });

  it('step gql2-set-alice-vars preAction ensures parameterized query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    await seedDemoUsers();
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_USER_QUERY);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-set-alice-vars')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(getGqlEditorQuery()).toContain('$id');
  });

  it('step gql2-history preAction ensures history panel with entries', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-1' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-2' } } }) })
      .mockResolvedValue({ json: async () => ({ data: { user: { id: 'usr-2', name: 'Bob', email: 'bob@demo.local' } } }) }));
    await seedDemoUsers();
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
      </div>
      <div data-testid="gql-response-viewer"><div data-testid="gql-response-data-user">Bob</div></div>
    `);
    stubMonacoEditor(GQL_USER_QUERY);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_ENTRY, 8000);
  });

  it('step gql2-history action clicks History when tab is inactive', async () => {
    stubGqlStudioShell(`
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
      </div>
    `);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_PANEL, 5000);
  });

  it('step gql2-history action skips History click when tab already active', async () => {
    stubGqlStudioShell(`
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
      </div>
    `);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_ENTRY, 5000);
  });

  it('step gql2-exec-alice preAction uses ensureAliceVarsFilled guard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-a' } } }),
    }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_USER_QUERY);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `);
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-exec-alice')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('ensureDemoEndpoint uses GQL_DEMO_VAR template when filling endpoint', async () => {
    stubGqlStudioShell();
    const ctx = makeCtx();
    await ensureDemoEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('ensureParamUserQuery guard skips when query already written', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    await seedDemoUsers();
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_USER_QUERY);
    const ctx = makeCtx();
    await ensureParamUserQuery(ctx);
    const { setQuery } = stubMonacoEditor(GQL_USER_QUERY);
    vi.mocked(setQuery).mockClear();
    await ensureParamUserQuery(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureAliceVarsFilled fills alice id when vars panel is empty', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-a' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-b' } } }) }));
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_USER_QUERY);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `);
    stubMonacoEditor(GQL_USER_QUERY);
    const ctx = makeCtx();
    await ensureAliceVarsFilled(ctx);
    expect(getDemoUserAId()).toBeTruthy();
  });

  it('ensureBobVarsFilled runs after alice execution', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-a' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-b' } } }) }));
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-response-viewer"><div data-testid="gql-response-body">Alice</div></div>
    `);
    stubMonacoEditor(GQL_USER_QUERY);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `);
    const ctx = makeCtx();
    await ensureBobVarsFilled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql2-write-query preAction skips editor click when already active', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    document.querySelector(GQL.MODE_EDITOR)!.classList.add('gql-mode-btn--active');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const editorClicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === GQL.MODE_EDITOR);
    expect(editorClicks.length).toBe(0);
  });

  it('step gql2-write-query preAction clicks editor when not active', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    document.querySelector(GQL.MODE_EDITOR)!.classList.remove('gql-mode-btn--active');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const step = gqlVariablesLesson.steps.find((s) => s.id === 'gql2-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('seedDemoUsers creates Alice and Bob and stores ids', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-10' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-11' } } }) }));
    await seedDemoUsers();
    expect(getDemoUserAId()).toBe('usr-10');
    expect(getDemoUserBId()).toBe('usr-11');
  });

  it('setup pre-fills demo endpoint var and resets editors', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-studio-page"></div>
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
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
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
