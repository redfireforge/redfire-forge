/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gqlMutationsLesson } from './graphql-mutations';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_CREATE_USER_MUTATION,
  GQL_CREATE_USER_VARS,
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_DELETE_USER_MUTATION,
  GQL_DEMO_HTTP,
  ensureCreateOrderExecuted,
  ensureCreateUserExecuted,
  ensureCreateUserMutation,
  ensureDeleteUserMutation,
  ensureDemoEndpoint,
  ensureIntrospected,
  resetGqlLesson3SessionFlags,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
  parseCreatedUserIdFromResponse,
  storeCreatedUserIdFromResponse,
  getLesson3CreatedUserId,
  getGqlEditorQuery,
  gqlMutationsLessonSetup,
  gqlMutationsLessonCleanup,
} from './graphql-lesson-helpers';
import { stubGqlStudioShell, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-mutations lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson2SessionFlags();
    resetGqlLesson3SessionFlags();
  });

  it('has valid lesson structure', () => {
    expect(gqlMutationsLesson.id).toBe('gql-mutations');
    expect(gqlMutationsLesson.category).toBe('graphql');
    expect(gqlMutationsLesson.steps.length).toBe(9);
    expect(gqlMutationsLesson.estimatedMinutes).toBe(4);
  });

  it('has correct step IDs in order', () => {
    expect(gqlMutationsLesson.steps.map((s) => s.id)).toEqual([
      'gql3-intro',
      'gql3-endpoint',
      'gql3-introspect',
      'gql3-write-create',
      'gql3-create-exec',
      'gql3-observe-create',
      'gql3-input-type',
      'gql3-write-delete',
      'gql3-idempotency',
    ]);
  });

  it('all 9 steps have pauseAfter: true', () => {
    gqlMutationsLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–9 have preAction guards', () => {
    gqlMutationsLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql3-intro highlights tab bar (M badge context)', () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-intro')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('step gql3-endpoint fills demo endpoint', async () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('step gql3-write-create fills createUser mutation', async () => {
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
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-create')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(setValue).toHaveBeenCalledWith(GQL_CREATE_USER_MUTATION);
  });

  it('step gql3-create-exec fills variables and executes', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
      <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-9","name":"Carol"}}}</pre>
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
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-create-exec')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(varsSetValue).toHaveBeenCalledWith(GQL_CREATE_USER_VARS);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(getLesson3CreatedUserId()).toBe('usr-9');
  });

  it('step gql3-idempotency executes twice', async () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-idempotency')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === GQL.EXECUTE_BTN).length).toBe(2);
  });

  it('parseCreatedUserIdFromResponse parses JSON body', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-42","name":"Carol"}}}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBe('usr-42');
  });

  it('storeCreatedUserIdFromResponse stores id from response', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-7"}}}</pre>';
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('usr-7');
  });

  it('step gql3-endpoint preAction waits for endpoint input', async () => {
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql3-introspect clicks introspect when badge absent', async () => {
    stubGqlStudioShell();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
  });

  it('step gql3-introspect skips click when badge already present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('step gql3-introspect preAction ensures demo endpoint', async () => {
    stubGqlStudioShell();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-introspect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql3-write-create preAction ensures introspected state', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-create')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql3-create-exec preAction ensures createUser mutation in editor', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-create-exec')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(getGqlEditorQuery()).toContain('createUser');
  });

  it('step gql3-observe-create opens response body', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1"}}}</pre>
    `);
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    storeCreatedUserIdFromResponse();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-observe-create')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('step gql3-input-type runs createOrder mutation', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery, setVars } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-5","name":"Carol"}}}';
    storeCreatedUserIdFromResponse();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-input-type')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalledWith(GQL_CREATE_ORDER_MUTATION);
    expect(setVars).toHaveBeenCalledWith(GQL_CREATE_ORDER_VARS);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql3-write-delete fills delete vars when user id known', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setQuery, setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-del"}}}';
    storeCreatedUserIdFromResponse();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(setQuery).toHaveBeenCalledWith(GQL_DELETE_USER_MUTATION);
    expect(setVars).toHaveBeenCalledWith(JSON.stringify({ id: 'usr-del' }, null, 2));
  });

  it('step gql3-write-delete skips vars fill when user id unknown', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    resetGqlLesson3SessionFlags();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-write-delete')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(setVars).not.toHaveBeenCalled();
  });

  it('step gql3-idempotency preAction ensures delete mutation loaded', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-x"}}}';
    storeCreatedUserIdFromResponse();
    const step = gqlMutationsLesson.steps.find((s) => s.id === 'gql3-idempotency')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureDemoEndpoint guard skips fill when endpoint already set', async () => {
    stubGqlStudioShell();
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await ensureDemoEndpoint(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureDemoEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureIntrospected guard skips introspect when badge present', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await ensureIntrospected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureIntrospected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('ensureCreateUserMutation guard skips when mutation already written', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await ensureCreateUserMutation(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureCreateUserMutation(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('ensureCreateUserExecuted guard skips re-execute when id captured', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      '{"data":{"createUser":{"id":"usr-cached"}}}';
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('usr-cached');
    const ctx = makeCtx();
    await ensureCreateUserExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureCreateUserExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureCreateOrderExecuted guard skips when order response present', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok"></span>
      <pre data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-1"}}}</pre>
    `);
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-1"}}}';
    storeCreatedUserIdFromResponse();
    const ctx = makeCtx();
    await ensureCreateOrderExecuted(ctx);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createOrder":{"id":"ord-1","status":"PENDING"}}}';
    vi.mocked(ctx.click).mockClear();
    await ensureCreateOrderExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureDeleteUserMutation loads delete mutation with id vars', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-del2"}}}';
    storeCreatedUserIdFromResponse();
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(getGqlEditorQuery()).toContain('deleteUser');
  });

  it('parseCreatedUserIdFromResponse returns null for empty body', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body"></pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('parseCreatedUserIdFromResponse falls back to regex on invalid JSON', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">broken {"createUser": { "id": "usr-regex" } }</pre>';
    expect(parseCreatedUserIdFromResponse()).toBe('usr-regex');
  });

  it('setup clears endpoint', async () => {
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
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => 'old', setValue }],
        getEditors: () => [{ getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }), setValue }],
      },
    };
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlMutationsLessonCleanup resets session flags', async () => {
    const ctx = makeCtx();
    await gqlMutationsLessonCleanup(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureDeleteUserMutation parses user id from response when session empty', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    document.body.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-parsed"},"createOrder":{"id":"ord-1"}}}';
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(getGqlEditorQuery()).toContain('deleteUser');
  });

  it('storeCreatedUserIdFromResponse does not set id when parse fails', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">invalid</pre>';
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('ensureDeleteUserMutation skips vars when created user id missing', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    document.body.querySelector('pre')!.textContent = '{"data":{"createOrder":{"id":"ord-1"}}}';
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    resetGqlLesson3SessionFlags();
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(getGqlEditorQuery()).toContain('deleteUser');
  });

  it('parseCreatedUserIdFromResponse returns null when JSON lacks createUser id', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"no-id"}}}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('ensureCreateUserExecuted re-runs when executed flag set but user id missing', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '';
    const ctx = makeCtx();
    await ensureCreateUserMutation(ctx);
    await ensureCreateUserExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureCreateOrderExecuted writes createOrder when editor still has createUser', async () => {
    stubGqlStudioShell('<span data-testid="gql-schema-badge-ok"></span>');
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<pre data-testid="gql-response-body">${JSON.stringify({ data: { createUser: { id: 'usr-x' } } })}</pre>`,
    );
    const ctx = makeCtx();
    await ensureCreateUserExecuted(ctx);
    await ensureCreateOrderExecuted(ctx);
    expect(getGqlEditorQuery()).toContain('createOrder');
  });

  it('setup closes active history tab', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <input data-testid="gql-endpoint-input" value="http://old" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query { }');
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('storeCreatedUserIdFromResponse marks executed even when id missing', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body">{"data":{}}</pre>';
    resetGqlLesson3SessionFlags();
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('setup activates editor mode and response tab when inactive', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query { }');
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const editorSpy = vi.spyOn(editorBtn, 'click');
    const responseSpy = vi.spyOn(responseTab, 'click');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(editorSpy).toHaveBeenCalled();
    expect(responseSpy).toHaveBeenCalled();
  });
});

describe('gql-mutations mutation constants', () => {
  it('GQL_CREATE_USER_MUTATION uses mutation keyword and createUser', () => {
    expect(GQL_CREATE_USER_MUTATION).toContain('mutation CreateUser');
    expect(GQL_CREATE_USER_MUTATION).toContain('createUser');
  });

  it('GQL_CREATE_ORDER_MUTATION uses OrderInput input type', () => {
    expect(GQL_CREATE_ORDER_MUTATION).toContain('$input: OrderInput!');
    expect(GQL_CREATE_ORDER_MUTATION).toContain('createOrder');
  });

  it('GQL_DELETE_USER_MUTATION returns success field', () => {
    expect(GQL_DELETE_USER_MUTATION).toContain('deleteUser');
    expect(GQL_DELETE_USER_MUTATION).toContain('success');
  });
});
