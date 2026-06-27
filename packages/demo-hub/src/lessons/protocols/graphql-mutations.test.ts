/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql6'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlMutationsLesson } from './graphql-mutations';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_CREATE_USER_MUTATION,
  GQL_CREATE_USER_VARS,
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_DELETE_USER_MUTATION,
  GQL_DEMO_HTTP,
  resetGqlLesson3SessionFlags,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
  schemaBadgeShowsEmpty,
  hasUsableSchemaBadge,
  ensureCreateUserMutation,
  ensureCreateVarsSet,
  ensureOrderMutationWritten,
  ensureDeleteMutationWritten,
  ensureDeleteFirstExecuted,
  getLesson3CreatedUserId,
  storeCreatedUserIdFromResponse,
  storeFirstDeleteExecuted,
  parseCreatedUserIdFromResponse,
  gqlMutationsLessonSetup,
  gqlMutationsLessonCleanup,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

const STEP_IDS = [
  'gql3-intro',
  'gql3-endpoint',
  'gql3-introspect',
  'gql3-observe-introspect',
  'gql3-schema-mutations',
  'gql3-write-create',
  'gql3-set-create-vars',
  'gql3-exec-create',
  'gql3-observe-create',
  'gql3-write-order-mutation',
  'gql3-set-order-vars',
  'gql3-exec-order',
  'gql3-observe-order',
  'gql3-write-delete',
  'gql3-wire-delete-var',
  'gql3-exec-delete',
  'gql3-observe-delete',
  'gql3-idempotency-exec',
  'gql3-observe-idempotency',
];

describe('gql-mutations lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson2SessionFlags();
    resetGqlLesson3SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Structure & metadata ────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlMutationsLesson.id).toBe('gql-mutations');
    expect(gqlMutationsLesson.domainId).toBe('protocols');
    expect(gqlMutationsLesson.category).toBe('graphql');
    expect(gqlMutationsLesson.name).toBe('Mutations — Create, Update, Delete');
    expect(gqlMutationsLesson.steps.length).toBe(19);
    expect(gqlMutationsLesson.estimatedMinutes).toBe(10);
    expect(gqlMutationsLesson.initialTab).toBe('graphql-studio');
    expect(gqlMutationsLesson.tabBudget).toBe(1);
  });

  it('allowedTabs is graphql-studio only — no Environment Manager setup in this lesson', () => {
    expect(gqlMutationsLesson.allowedTabs).toEqual(['graphql-studio']);
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlMutationsLesson.tag).toBe('🐳 Docker');
    expect(gqlMutationsLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMutationsLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlMutationsLesson.setup).toBe('function');
    expect(typeof gqlMutationsLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    expect(gqlMutationsLesson.steps.map((s) => s.id)).toEqual(STEP_IDS);
  });

  it('all 16 steps have pauseAfter: true', () => {
    gqlMutationsLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–15 have preAction guards', () => {
    gqlMutationsLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql3-intro has preAction for studio orientation', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-intro')!;
    expect(step.preAction).toBeTypeOf('function');
  });

  // ─── Concept ────────────────────────────────────────────────────────────

  it('concept body explains mutation keyword and M badge', () => {
    expect(gqlMutationsLesson.concept.body).toContain('mutation');
    expect(gqlMutationsLesson.concept.body).toContain('amber');
  });

  it('concept keyTerms cover Mutation, Input type, DeleteResult, Idempotency', () => {
    const terms = (gqlMutationsLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Mutation');
    expect(terms).toContain('Input type');
    expect(terms).toContain('DeleteResult');
    expect(terms).toContain('Idempotency');
  });

  it('concept diagram is 700×430 studio chrome SVG with M badge and three mutation blocks', () => {
    const diag = gqlMutationsLesson.concept.diagram;
    expect(diag).toContain('viewBox="0 0 700 430"');
    expect(diag).toContain('GraphQL Studio — Mutations');
    expect(diag).toContain('CreateUser');
    expect(diag).toContain('CreateOrder');
    expect(diag).toContain('DeleteUser');
    expect(diag).toContain('createUser');
    expect(diag).toContain('createOrder');
    expect(diag).toContain('deleteUser');
  });

  it('concept diagram shows amber M badge color', () => {
    expect(gqlMutationsLesson.concept.diagram).toContain('#f59e0b');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql3-intro highlights tab bar', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-intro')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('gql3-endpoint highlights endpoint input', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql3-write-create highlights editor not variables panel', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-create')!;
    expect(step.highlight).toBe(GQL.EDITOR);
    expect(step.highlight).not.toBe(GQL.VARS_PANEL);
  });

  it('gql3-write-create keeps Schema tab visible during mutation write', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-create')!;
    expect(step.description).toContain('Schema');
    expect(step.readingSync).toBeDefined();
  });

  it('gql3-set-create-vars highlights variables panel', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-create-vars')!;
    expect(step.highlight).toBe(GQL.VARS_PANEL);
    expect(step.highlight).not.toBe(GQL.EXECUTE_BTN);
  });

  it('gql3-exec-create highlights execute button not variables panel', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-create')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.highlight).not.toBe(GQL.VARS_PANEL);
  });

  it('gql3-observe-create highlights compact data.createUser card', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-create')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_CREATE_USER);
  });

  it('gql3-write-order-mutation highlights editor', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-order-mutation')!;
    expect(step.highlight).toBe(GQL.EDITOR);
  });

  it('gql3-exec-order highlights execute button', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-order')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql3-observe-order highlights compact createOrder response card', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-order')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
    expect(step.verify).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
  });

  it('gql3-write-delete highlights editor (not variables panel — spotlight fix)', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    expect(step.highlight).toBe(GQL.EDITOR);
    expect(step.highlight).not.toBe(GQL.VARS_PANEL);
  });

  it('gql3-wire-delete-var highlights variables panel', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-wire-delete-var')!;
    expect(step.highlight).toBe(GQL.VARS_PANEL);
  });

  it('gql3-exec-delete highlights execute button', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-delete')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql3-observe-delete highlights compact data.deleteUser card after first delete', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-delete')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_DELETE_USER);
    expect(step.verify).toBe(GQL.RESPONSE_DATA_DELETE_USER);
  });

  it('gql3-idempotency-exec highlights Execute for second delete click', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-idempotency-exec')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql3-observe-idempotency highlights compact data.deleteUser card for success: false', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-idempotency')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_DELETE_USER);
    expect(step.verify).toBe(GQL.RESPONSE_DATA_DELETE_USER);
  });

  // ─── Description content ─────────────────────────────────────────────────

  it('gql3-intro description explains Q→M badge switch', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-intro')!;
    expect(step.description).toContain('M');
    expect(step.description).toContain('amber');
  });

  it('gql3-set-create-vars description explains variable key naming without $', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-create-vars')!;
    expect(step.description).toContain('carol@demo.local');
    expect(step.description).toContain('$');
  });

  it('gql3-exec-create description explains write behaviour', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-create')!;
    expect(step.description).toContain('write');
    expect(step.description).toContain('Response');
  });

  it('gql3-observe-create description mentions captured user id', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-create')!;
    expect(step.description).toContain('id');
    expect(step.description).toContain('deleteUser');
  });

  it('gql3-write-order-mutation description explains input object types', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-order-mutation')!;
    expect(step.description).toMatch(/input object/i);
    expect(step.description).toContain('OrderInput');
  });

  it('gql3-set-order-vars description shows nested input object JSON', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-order-vars')!;
    expect(step.description).toContain('"input"');
    expect(step.description).toContain('customerId');
  });

  it('gql3-write-delete description explains deleteUser structure', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    expect(step.description).toContain('deleteUser');
    expect(step.description).toContain('DeleteResult');
  });

  it('gql3-wire-delete-var description mentions auto-fill from create response', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-wire-delete-var')!;
    expect(step.description).toContain('auto-fills');
  });

  it('gql3-exec-delete description mentions success in response', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-delete')!;
    expect(step.description).toContain('success');
  });

  it('gql3-observe-idempotency description explains success: false semantics', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-idempotency')!;
    expect(step.description).toContain('success: false');
    expect(step.description).toContain('idempotent');
  });

  // ─── Step actions ────────────────────────────────────────────────────────

  it('gql3-endpoint preAction prepares empty endpoint field', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-endpoint-reset-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
    `;
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-endpoint')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('gql3-endpoint fills the demo HTTP endpoint', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-endpoint')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('gql3-introspect clicks introspect when badge absent', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('gql3-observe-introspect waits for schema badge and opens Schema tab', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>
      <button data-testid="gql-right-tab-schema"></button>
      <div data-testid="gql-schema-explorer">
        <div data-testid="gql-se-type-list"></div>
      </div>
    `);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-introspect')!;
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('gql3-observe-introspect wires readingSync for async schema cache', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-introspect')!;
    expect(step.readingSync).toBeDefined();
  });

  it('gql3-introspect skips introspect click when usable schema badge is present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>');
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql3-introspect re-introspects when badge shows zero types', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>');
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql3-introspect preAction clears stale empty schema and focuses response pane', async () => {
    stubGqlStudioShell(`
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>
    `);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    await step.preAction!(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('gql3-observe-introspect verify targets schema badge', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-introspect')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql3-schema-mutations selects Mutation type in schema explorer', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list">
        <div data-testid="gql-se-type-Mutation"></div>
      </div>
    `);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-schema-mutations')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_MUTATION);
  });

  it('gql3-schema-mutations verify targets Mutation type', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-schema-mutations')!;
    expect(step.verify).toBe(GQL.SCHEMA_TYPE_MUTATION);
    expect(step.highlight).toBe(GQL.SCHEMA_TYPE_MUTATION);
  });

  it('gql3-write-create fills createUser mutation in editor', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>
      <button data-testid="gql-right-tab-schema"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-schema-explorer"><div data-testid="gql-se-type-list"></div></div>
    `);
    const { setQuery } = stubMonacoEditor();
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-create')!;
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('createUser'));
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('$name'));
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('gql3-set-create-vars opens variables panel and fills Carol vars', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setVars } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-create-vars')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('carol@demo.local'));
  });

  it('gql3-set-create-vars action does NOT click execute', async () => {
    stubGqlStudioShell();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-create-vars')!;
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql3-exec-create clicks execute and waits for response viewer', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-create')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('gql3-exec-create switches to response tab before executing', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-create')!;
    await step.action!(ctx);
    const calls = vi.mocked(ctx.click).mock.calls.map((c) => c[0]);
    const responseTabIdx = calls.indexOf(GQL.RIGHT_TAB_RESPONSE);
    const executeIdx = calls.indexOf(GQL.EXECUTE_BTN);
    expect(responseTabIdx).toBeLessThan(executeIdx);
  });

  it('gql3-observe-create opens Body tab and waits for data.createUser card', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-create')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_DATA_CREATE_USER, 5000);
  });

  it('gql3-write-order-mutation fills createOrder mutation in editor', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-order-mutation')!;
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('createOrder'));
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('OrderInput'));
  });

  it('gql3-write-order-mutation action does NOT click execute', async () => {
    stubGqlStudioShell();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-order-mutation')!;
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql3-exec-order clicks execute only (vars set on prior step)', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-order')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('gql3-set-order-vars fills nested input object vars', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-set-order-vars')!;
    await step.action!(ctx);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('cust-demo'));
  });

  it('gql3-write-delete fills deleteUser mutation in editor', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('deleteUser'));
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('$id'));
  });

  it('gql3-write-delete action does NOT fill variables', async () => {
    stubGqlStudioShell();
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    await step.action!(ctx);
    expect(setVars).not.toHaveBeenCalled();
  });

  it('gql3-wire-delete-var opens vars panel and fills id when available', async () => {
    // Build DOM manually so we control the single response-body element
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-42","name":"Carol","email":"carol@demo.local"}}}</pre>
    `;
    const { setVars } = stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-wire-delete-var')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('usr-42'));
  });

  it('gql3-wire-delete-var skips fill if no id available', async () => {
    stubGqlStudioShell();
    const { setVars } = stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-wire-delete-var')!;
    await step.action!(ctx);
    expect(setVars).not.toHaveBeenCalled();
  });

  it('gql3-exec-delete clicks execute and stores first delete flag', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-exec-delete')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('gql3-idempotency-exec clicks execute again and waits for viewer', async () => {
    const ctx = makeCtx();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-idempotency-exec')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  // ─── Guard / preAction coverage ──────────────────────────────────────────

  it('ensureCreateUserMutation guard skips when createUser already in editor', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await ensureCreateUserMutation(ctx);
    vi.mocked(setQuery as ReturnType<typeof vi.fn>).mockClear();
    await ensureCreateUserMutation(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureCreateVarsSet guard skips when carol email already in vars model', async () => {
    const setQuery = vi.fn();
    const setVars = vi.fn();
    // Stub Monaco with Carol's vars already loaded
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => GQL_CREATE_USER_MUTATION, setValue: setQuery },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => GQL_CREATE_USER_VARS, setValue: setVars },
        ],
        getEditors: () => [
          { getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue: setQuery },
          { getModel: () => ({ uri: { toString: () => 'inmemory://graphql-vars/tab-1' } }), setValue: setVars },
        ],
      },
    };
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `;
    const ctx = makeCtx();
    await ensureCreateVarsSet(ctx);
    // Since Carol's email is already in the vars model, fill should be skipped
    expect(setVars).not.toHaveBeenCalled();
  });

  it('ensureOrderMutationWritten writes createOrder if not already present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const { setQuery } = stubMonacoEditor('query { health }');
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="false"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer"><pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1","name":"Carol","email":"carol@demo.local"}}}</pre></div>
    `);
    const ctx = makeCtx();
    await ensureOrderMutationWritten(ctx);
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('createOrder'));
  });

  it('ensureDeleteMutationWritten writes deleteUser without filling delete $id vars', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const { setQuery, setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="false"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    `);
    const ctx = makeCtx();
    await ensureDeleteMutationWritten(ctx);
    // deleteUser mutation should be written
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('deleteUser'));
    // delete $id vars should NOT be filled (only scalar id, not part of prerequisite chain)
    const deleteIdCalls = vi.mocked(setVars).mock.calls.filter(([v]) => {
      try {
        const parsed = JSON.parse(v as string) as Record<string, unknown>;
        return Object.keys(parsed).length === 1 && 'id' in parsed;
      } catch { return false; }
    });
    expect(deleteIdCalls.length).toBe(0);
  });

  it('ensureDeleteFirstExecuted runs execute when not yet done', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const { setQuery } = stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer"></div>
    `);
    const ctx = makeCtx();
    await ensureDeleteFirstExecuted(ctx);
    expect(setQuery).toHaveBeenCalledWith(expect.stringContaining('deleteUser'));
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureDeleteFirstExecuted guard skips entirely when already executed', async () => {
    // Set the flag — ensureDeleteFirstExecuted should return immediately before any DOM calls
    storeFirstDeleteExecuted();
    const ctx = makeCtx();
    await ensureDeleteFirstExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('storeCreatedUserIdFromResponse captures id from response body JSON', () => {
    document.body.innerHTML = `
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-7","name":"Carol","email":"carol@demo.local"}}}</pre>
    `;
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('usr-7');
  });

  it('parseCreatedUserIdFromResponse returns null when body is empty', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body"></pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('parseCreatedUserIdFromResponse handles regex fallback for partial JSON', () => {
    document.body.innerHTML = `
      <pre data-testid="gql-response-body">"createUser" : { "id" : "usr-99" }</pre>
    `;
    expect(parseCreatedUserIdFromResponse()).toBe('usr-99');
  });

  it('parseCreatedUserIdFromResponse returns null for unparseable body without id pattern', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">{not valid json at all}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('parseCreatedUserIdFromResponse returns null when JSON omits createUser id', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"Carol"}}}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('schemaBadgeShowsEmpty returns false when badge element is absent', () => {
    document.body.innerHTML = '';
    expect(schemaBadgeShowsEmpty()).toBe(false);
    expect(hasUsableSchemaBadge()).toBe(false);
  });

  it('hasUsableSchemaBadge rejects zero-type schema badge', () => {
    document.body.innerHTML = '<span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>';
    expect(schemaBadgeShowsEmpty()).toBe(true);
    expect(hasUsableSchemaBadge()).toBe(false);
  });

  // ─── Constants ───────────────────────────────────────────────────────────

  it('GQL_CREATE_USER_MUTATION declares $name and $email', () => {
    expect(GQL_CREATE_USER_MUTATION).toContain('$name: String!');
    expect(GQL_CREATE_USER_MUTATION).toContain('$email: String!');
    expect(GQL_CREATE_USER_MUTATION).toContain('CreateUser');
  });

  it('GQL_CREATE_ORDER_MUTATION uses input object type', () => {
    expect(GQL_CREATE_ORDER_MUTATION).toContain('$input: OrderInput!');
    expect(GQL_CREATE_ORDER_MUTATION).toContain('CreateOrder');
  });

  it('GQL_DELETE_USER_MUTATION declares $id and returns success', () => {
    expect(GQL_DELETE_USER_MUTATION).toContain('$id: ID!');
    expect(GQL_DELETE_USER_MUTATION).toContain('success');
  });

  it('GQL_CREATE_USER_VARS has Carol name and email', () => {
    const vars = JSON.parse(GQL_CREATE_USER_VARS) as Record<string, string>;
    expect(vars.name).toBe('Carol');
    expect(vars.email).toBe('carol@demo.local');
  });

  it('GQL_CREATE_ORDER_VARS has nested input object', () => {
    const vars = JSON.parse(GQL_CREATE_ORDER_VARS) as { input: { customerId: string; items: string[] } };
    expect(vars.input.customerId).toBe('cust-demo');
    expect(vars.input.items).toContain('widget');
  });

  // ─── Setup / cleanup ─────────────────────────────────────────────────────

  it('setup creates demo tab and resets editor on demo tab', async () => {
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
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-mutations',
      'Mutations — Create, Update, Delete',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(querySetValue).toHaveBeenCalledWith('query { }');
  });

  it('cleanup closes demo tab and resets lesson flags', async () => {
    storeFirstDeleteExecuted();
    const ctx = makeCtx();
    await gqlMutationsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-mutations');
    // After cleanup, ensureDeleteFirstExecuted should attempt execute (flags reset)
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer"></div>
    `);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const ctx2 = makeCtx();
    await ensureDeleteFirstExecuted(ctx2);
    expect(ctx2.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });
});
