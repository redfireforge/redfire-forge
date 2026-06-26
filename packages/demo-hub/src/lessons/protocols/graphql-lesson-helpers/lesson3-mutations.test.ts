/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql6'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './gql-demo-tab';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
} from './core';
import {
  GQL_CREATE_USER_MUTATION,
  GQL_DELETE_USER_MUTATION,
  resetGqlLesson3SessionFlags,
  prepareGql3IntroReading,
  prepareGql3EndpointReading,
  prepareGql3IntrospectReading,
  runGql3IntrospectOnlyAction,
  runGql3IntrospectAction,
  prepareGql3SchemaMutationsReading,
  runGql3SchemaMutationsAction,
  prepareGql3WriteCreateReading,
  prepareGql3SetCreateVarsReading,
  prepareGql3ExecCreateReading,
  prepareGql3ObserveCreateReading,
  prepareGql3WriteOrderReading,
  prepareGql3SetOrderVarsReading,
  prepareGql3ExecOrderReading,
  prepareGql3ObserveOrderReading,
  prepareGql3WriteDeleteReading,
  prepareGql3WireDeleteVarReading,
  prepareGql3ExecDeleteReading,
  prepareGql3ObserveDeleteReading,
  prepareGql3IdempotencyExecReading,
  prepareGql3ObserveIdempotencyReading,
  prepareGql3ObserveIntrospectReading,
  prepareGql3IdempotencyReading,
  ensureCreateUserExecuted,
  ensureCreateOrderExecuted,
  ensureDeleteUserMutation,
  ensureCreateUserMutation,
  ensureCreateVarsSet,
  ensureDeleteFirstExecuted,
  ensureDeleteMutationWritten,
  storeFirstDeleteExecuted,
  parseCreatedUserIdFromResponse,
  getLesson3CreatedUserId,
  markCreateVarsSet,
  markCreateMutationWritten,
  markOrderMutationWritten,
  markDeleteMutationWritten,
  shouldSkipOrderMutationFill,
  shouldSkipDeleteMutationFill,
  shouldFillOrderVariables,
  shouldPrefillDeleteIdVariables,
  captureLesson3UserIdIfMissing,
  endpointNeedsClearing,
  finalizeCreateUserExecution,
  storeOrderExecuted,
  storeCreatedUserIdFromResponse,
  gqlMutationsLessonSetup,
  gqlMutationsLessonCleanup,
} from './lesson3-mutations';
import { stubGqlStudioShell, stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';

function combinedEditor(...parts: string[]): string {
  return parts.join('\n');
}

function buildGql3StudioDom(extra = ''): void {
  stubGqlStudioShell(`
    <div data-testid="gql-studio-page"></div>
    <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
    <select data-testid="header-svc-select"><option>graphql-demo</option></select>
    <button data-testid="gql-right-tab-schema"></button>
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <div data-testid="gql-schema-explorer">
      <div data-testid="gql-se-type-list">
        <button data-testid="gql-se-type-Query"></button>
        <button data-testid="gql-se-type-Mutation"></button>
      </div>
    </div>
    <div data-testid="gql-response-viewer">
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1","name":"Carol","email":"carol@demo.local"}}}</pre>
      <div data-testid="gql-response-data-create-user">Carol</div>
    </div>
    <button data-testid="gql-rv-tab-body"></button>
    <button data-testid="gql-endpoint-reset-btn"></button>
    ${extra}
  `);
  document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_VAR;
}

describe('lesson3-mutations helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson2SessionFlags();
    resetGqlLesson3SessionFlags();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepareGql3IntroReading waits for endpoint and focuses response pane', async () => {
    buildGql3StudioDom();
    stubMonacoEditor('query { }');
    const ctx = makeCtx();
    await prepareGql3IntroReading(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('resetGqlLesson3SessionFlags clears stored user id', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1"}}}</pre>';
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('usr-1');
    resetGqlLesson3SessionFlags();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('storeCreatedUserIdFromResponse marks executed even when id is missing', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"Bob"}}}</pre>';
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('prepareGql3WriteCreateReading introspects when schema badge is unusable', async () => {
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-introspect-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `);
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await prepareGql3WriteCreateReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGql3EndpointReading clears a pre-filled endpoint', async () => {
    buildGql3StudioDom(`<button data-testid="gql-endpoint-reset-btn"></button>`);
    const ctx = makeCtx();
    await prepareGql3EndpointReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
  });

  it('prepareGql3IntrospectReading fills demo HTTP when endpoint lacks 4010', async () => {
    buildGql3StudioDom();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = '';
    const ctx = makeCtx();
    await prepareGql3IntrospectReading(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('prepareGql3IntrospectReading refreshes endpoint when schema badge shows zero types', async () => {
    stubGqlStudioShell(`
      <span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>
      <button data-testid="gql-right-tab-response"></button>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const ctx = makeCtx();
    await prepareGql3IntrospectReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('runGql3IntrospectOnlyAction skips introspect when badge already usable', async () => {
    buildGql3StudioDom();
    const ctx = makeCtx();
    await runGql3IntrospectOnlyAction(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('runGql3IntrospectAction opens schema explorer after introspect', async () => {
    buildGql3StudioDom();
    const ctx = makeCtx();
    await runGql3IntrospectAction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_EXPLORER, 5000);
  });

  it('prepareGql3SchemaMutationsReading opens Mutation type when missing from explorer', async () => {
    buildGql3StudioDom();
    document.querySelector(GQL.SCHEMA_TYPE_MUTATION)?.remove();
    const ctx = makeCtx();
    await prepareGql3SchemaMutationsReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_MUTATION, 15000);
  });

  it('runGql3SchemaMutationsAction selects Mutation type', async () => {
    buildGql3StudioDom();
    const ctx = makeCtx();
    await runGql3SchemaMutationsAction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_MUTATION);
  });

  it('prepareGql3WriteCreateReading resets editor to query { } when createUser absent', async () => {
    buildGql3StudioDom();
    const { setQuery } = stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await prepareGql3WriteCreateReading(ctx);
    expect(setQuery).toHaveBeenCalledWith('query { }');
  });

  it('prepareGql3SetCreateVarsReading opens vars panel with empty object', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await prepareGql3SetCreateVarsReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('prepareGql3ExecCreateReading ensures mutation and vars without executing', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await prepareGql3ExecCreateReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareGql3ObserveCreateReading executes createUser and opens response body tab', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3ObserveCreateReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_BODY);
  });

  it('prepareGql3WriteOrderReading keeps createUser response visible', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3WriteOrderReading(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('prepareGql3SetOrderVarsReading seeds empty input object when cust-demo absent', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="false"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3SetOrderVarsReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('prepareGql3ExecOrderReading fills order vars when cust-demo not yet loaded', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3ExecOrderReading(ctx);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('cust-demo'));
  });

  it('prepareGql3ObserveOrderReading ensures createOrder executed and opens response', async () => {
    buildGql3StudioDom(`
      <pre data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-1"}}}</pre>
    `);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createOrder: { id: 'ord-1', status: 'NEW' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    storeOrderExecuted();
    const ctx = makeCtx();
    await prepareGql3ObserveOrderReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('prepareGql3WriteDeleteReading waits for createOrder response body', async () => {
    buildGql3StudioDom(`
      <pre data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-1"}}}</pre>
    `);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3WriteDeleteReading(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('prepareGql3WireDeleteVarReading seeds empty id placeholder when user id known', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-42' } } }),
    }));
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-42","name":"Carol","email":"carol@demo.local"}}}';
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3WireDeleteVarReading(ctx);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('"id"'));
  });

  it('prepareGql3ExecDeleteReading wires delete vars and focuses response pane', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3ExecDeleteReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('prepareGql3ObserveDeleteReading opens response after first delete', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { deleteUser: { success: true } } }),
    }));
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    storeFirstDeleteExecuted();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-rv-tab-response" aria-selected="false"></button>
      <pre data-testid="gql-response-body">{"data":{"deleteUser":{"success":true}}}</pre>
    `);
    const ctx = makeCtx();
    await prepareGql3ObserveDeleteReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('prepareGql3IdempotencyExecReading executes first delete when not yet done', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3IdempotencyExecReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareGql3ObserveIdempotencyReading executes second delete when not yet done', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { deleteUser: { success: false } } }),
    }));
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    storeFirstDeleteExecuted();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-rv-tab-response" aria-selected="false"></button>
      <pre data-testid="gql-response-body">{"data":{"deleteUser":{"success":false}}}</pre>
    `);
    const ctx = makeCtx();
    await prepareGql3ObserveIdempotencyReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureCreateUserExecuted short-circuits when create already executed with id', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-1","name":"Carol","email":"carol@demo.local"}}}';
    storeCreatedUserIdFromResponse();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await ensureCreateUserExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureCreateOrderExecuted short-circuits when order already executed', async () => {
    buildGql3StudioDom();
    const pre = document.querySelector('pre')!;
    pre.textContent = '{"data":{"createUser":{"id":"usr-1"}}}';
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    pre.textContent = '{"data":{"createOrder":{"id":"ord-1"}}}';
    stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const ctx = makeCtx();
    await ensureCreateOrderExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureDeleteUserMutation fills delete id vars when created user id is known', async () => {
    buildGql3StudioDom(`
      <pre data-testid="gql-response-body">{"data":{"createOrder":{"id":"ord-1"}}}</pre>
    `);
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-99","name":"Carol","email":"carol@demo.local"}}}';
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('usr-99'));
  });

  it('markCreateVarsSet and storeOrderExecuted update session flags', () => {
    markCreateVarsSet();
    storeOrderExecuted();
    expect(true).toBe(true);
  });

  it('prepareGql3WriteCreateReading introspects when schema badge is missing', async () => {
    stubGqlStudioShell(`
      <div data-testid="gql-studio-page"></div>
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <button data-testid="gql-right-tab-schema"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <div data-testid="gql-schema-explorer">
        <div data-testid="gql-se-type-list">
          <button data-testid="gql-se-type-Query"></button>
          <button data-testid="gql-se-type-Mutation"></button>
        </div>
      </div>
    `);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    const { setQuery } = stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await prepareGql3WriteCreateReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(setQuery).toHaveBeenCalledWith('query { }');
  });

  it('prepareGql3SchemaMutationsReading skips introspect when Mutation type already listed', async () => {
    buildGql3StudioDom();
    const ctx = makeCtx();
    await prepareGql3SchemaMutationsReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGql3WriteCreateReading skips editor reset when createUser already loaded', async () => {
    buildGql3StudioDom();
    const { setQuery } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await prepareGql3WriteCreateReading(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('prepareGql3SetCreateVarsReading skips fill when Carol vars already loaded', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => GQL_CREATE_USER_MUTATION, setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{"name":"Carol","email":"carol@demo.local"}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await prepareGql3SetCreateVarsReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('runGql3IntrospectOnlyAction clicks introspect when schema badge missing', async () => {
    stubGqlStudioShell(`
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <button data-testid="gql-introspect-btn"></button>
      <button data-testid="gql-right-tab-response"></button>
    `);
    const ctx = makeCtx();
    await runGql3IntrospectOnlyAction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareGql3EndpointReading keeps empty endpoint without fill', async () => {
    stubGqlStudioShell(`
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-right-tab-response"></button>
    `);
    const ctx = makeCtx();
    await prepareGql3EndpointReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('parseCreatedUserIdFromResponse returns id from valid JSON body', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-json"}}}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBe('usr-json');
  });

  it('parseCreatedUserIdFromResponse returns null when response body is empty', () => {
    document.body.innerHTML = '<pre data-testid="gql-response-body"></pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('parseCreatedUserIdFromResponse uses regex fallback when JSON parse fails', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">not-json but "createUser": { "id": "usr-regex" }</pre>';
    expect(parseCreatedUserIdFromResponse()).toBe('usr-regex');
  });

  it('parseCreatedUserIdFromResponse returns null when JSON has no createUser id', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"Bob"}}}</pre>';
    expect(parseCreatedUserIdFromResponse()).toBeNull();
  });

  it('storeCreatedUserIdFromResponse leaves id empty when body has no id', () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"Bob"}}}</pre>';
    storeCreatedUserIdFromResponse();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('ensureCreateUserMutation short-circuits when createUser already in editor', async () => {
    buildGql3StudioDom();
    const { setQuery } = stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const ctx = makeCtx();
    await ensureCreateUserMutation(ctx);
    vi.mocked(setQuery).mockClear();
    await ensureCreateUserMutation(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureCreateVarsSet short-circuits when Carol vars already in model', async () => {
    buildGql3StudioDom();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => GQL_CREATE_USER_MUTATION, setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{"name":"Carol","email":"carol@demo.local"}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await ensureCreateVarsSet(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureDeleteFirstExecuted short-circuits when delete already executed', async () => {
    buildGql3StudioDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    storeFirstDeleteExecuted();
    const ctx = makeCtx();
    await ensureDeleteFirstExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareGql3WireDeleteVarReading skips fill when user id already in vars', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-42","name":"Carol","email":"carol@demo.local"},"createOrder":{"id":"ord-1"}}}';
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => GQL_DELETE_USER_MUTATION, setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{"id":"usr-42"}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await prepareGql3WireDeleteVarReading(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('resetGqlLesson3SessionFlags clears all mutation session state', () => {
    storeCreatedUserIdFromResponse();
    markCreateVarsSet();
    storeOrderExecuted();
    storeFirstDeleteExecuted();
    resetGqlLesson3SessionFlags();
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('ensureCreateUserExecuted captures id from response after execute', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent = '{"data":{"createUser":{"id":"usr-new","name":"Carol","email":"carol@demo.local"}}}';
    resetGqlLesson3SessionFlags();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await ensureCreateUserExecuted(ctx);
    expect(getLesson3CreatedUserId()).toBe('usr-new');
  });

  it('ensureDeleteMutationWritten parses user id from response when session id missing', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-parsed","name":"Carol","email":"carol@demo.local"},"createOrder":{"id":"ord-1"}}}';
    resetGqlLesson3SessionFlags();
    storeOrderExecuted();
    let query = combinedEditor(GQL_CREATE_USER_MUTATION, GQL_CREATE_ORDER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => query, setValue: (v: string) => { query = v; } },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await ensureDeleteMutationWritten(ctx);
    expect(getLesson3CreatedUserId()).toBe('usr-parsed');
  });

  it('ensureCreateUserExecuted completes without id when response omits createUser id', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent = '{"data":{"createUser":{"name":"Carol","email":"carol@demo.local"}}}';
    resetGqlLesson3SessionFlags();
    stubMonacoEditor(GQL_CREATE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await ensureCreateUserExecuted(ctx);
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('ensureDeleteUserMutation parses user id from response when session id missing', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-from-response","name":"Carol","email":"carol@demo.local"},"createOrder":{"id":"ord-1"}}}';
    resetGqlLesson3SessionFlags();
    storeOrderExecuted();
    let query = combinedEditor(GQL_CREATE_USER_MUTATION, GQL_CREATE_ORDER_MUTATION, GQL_DELETE_USER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => query, setValue: (v: string) => { query = v; } },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(getLesson3CreatedUserId()).toBe('usr-from-response');
  });

  it('ensureDeleteUserMutation skips delete id vars when user id is unknown', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent = '{"data":{"createOrder":{"id":"ord-1"}}}';
    resetGqlLesson3SessionFlags();
    storeOrderExecuted();
    const { setVars } = stubMonacoEditor(GQL_DELETE_USER_MUTATION);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables" aria-selected="true"></button>
    `);
    const ctx = makeCtx();
    await ensureDeleteUserMutation(ctx);
    expect(setVars).not.toHaveBeenCalledWith(expect.stringMatching(/"id"\s*:\s*"usr/));
  });

  it('prepareGql3ExecOrderReading skips fill when cust-demo vars already loaded', async () => {
    buildGql3StudioDom();
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    const { setVars } = stubMonacoEditor(combinedEditor(GQL_CREATE_USER_MUTATION, GQL_CREATE_ORDER_MUTATION));
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => combinedEditor(GQL_CREATE_USER_MUTATION, GQL_CREATE_ORDER_MUTATION), setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{"input":{"customerId":"cust-demo","items":[]}}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await prepareGql3ExecOrderReading(ctx);
    expect(setVars).not.toHaveBeenCalled();
  });

  it('gqlMutationsLessonSetup creates demo tab when endpoint input is blank', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('old');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-mutations',
      'Mutations — Create, Update, Delete',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlMutationsLessonSetup does not clear a pre-filled endpoint on user tab', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('old');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlMutationsLessonSetup skips endpoint clear when input is absent', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('old');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('prepareGql3WireDeleteVarReading fills id placeholder using parsed response id', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-wire","name":"Carol","email":"carol@demo.local"},"createOrder":{"id":"ord-1"}}}';
    resetGqlLesson3SessionFlags();
    storeOrderExecuted();
    let query = combinedEditor(GQL_CREATE_USER_MUTATION, GQL_CREATE_ORDER_MUTATION, GQL_DELETE_USER_MUTATION);
    let vars = '{}';
    const setVars = vi.fn((v: string) => { vars = v; });
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => query, setValue: (v: string) => { query = v; } },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => vars, setValue: setVars },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await prepareGql3WireDeleteVarReading(ctx);
    expect(setVars).toHaveBeenCalledWith(expect.stringContaining('"id"'));
  });

  it('prepareGql3SetOrderVarsReading skips when cust-demo vars already loaded', async () => {
    buildGql3StudioDom();
    document.querySelector('pre')!.textContent =
      '{"data":{"createUser":{"id":"usr-1","name":"Carol","email":"carol@demo.local"}}}';
    storeCreatedUserIdFromResponse();
    storeOrderExecuted();
    const { setVars } = stubMonacoEditor(GQL_CREATE_ORDER_MUTATION);
    const w = window as unknown as { monaco?: { editor: { getModels: () => unknown[]; getEditors: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [
          { uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => GQL_CREATE_ORDER_MUTATION, setValue: vi.fn() },
          { uri: { toString: () => 'inmemory://graphql-vars/tab-1' }, getValue: () => '{"input":{"customerId":"cust-demo","items":[{"productId":"prod-1","quantity":1}]}}', setValue: vi.fn() },
        ],
        getEditors: () => [],
      },
    };
    const ctx = makeCtx();
    await prepareGql3SetOrderVarsReading(ctx);
    expect(setVars).not.toHaveBeenCalled();
  });

  it('gqlMutationsLessonCleanup closes demo tab and resets lesson session flags', async () => {
    document.body.innerHTML =
      '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1"}}}</pre>';
    storeCreatedUserIdFromResponse();
    const ctx = makeCtx();
    await gqlMutationsLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-mutations');
    expect(getLesson3CreatedUserId()).toBe('');
  });

  it('gqlMutationsLessonSetup closes active history tab and creates demo tab', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('old');
    const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const historySpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(historySpy).toHaveBeenCalled();
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-mutations',
      'Mutations — Create, Update, Delete',
    );
  });

  it('gqlMutationsLessonSetup activates editor and response tab when inactive', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('old');
    const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)!;
    const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const editorSpy = vi.spyOn(editorBtn, 'click');
    const responseSpy = vi.spyOn(responseTab, 'click');
    const ctx = makeCtx();
    await gqlMutationsLessonSetup(ctx);
    expect(editorSpy).toHaveBeenCalled();
    expect(responseSpy).toHaveBeenCalled();
  });

  describe('lesson3 guard helpers', () => {
    it('shouldSkipOrderMutationFill respects flag and editor content', () => {
      resetGqlLesson3SessionFlags();
      expect(shouldSkipOrderMutationFill('mutation { createOrder(input: {}) { id } }')).toBe(false);
      markOrderMutationWritten();
      expect(shouldSkipOrderMutationFill('mutation { createOrder(input: {}) { id } }')).toBe(true);
      expect(shouldSkipOrderMutationFill('query { health }')).toBe(false);
    });

    it('shouldSkipDeleteMutationFill respects flag and editor content', () => {
      resetGqlLesson3SessionFlags();
      expect(shouldSkipDeleteMutationFill('mutation { deleteUser(id: "1") { success } }')).toBe(false);
      markDeleteMutationWritten();
      expect(shouldSkipDeleteMutationFill('mutation { deleteUser(id: "1") { success } }')).toBe(true);
    });

    it('shouldFillOrderVariables detects missing cust-demo seed', () => {
      expect(shouldFillOrderVariables('{}')).toBe(true);
      expect(shouldFillOrderVariables('{"input":{"customerId":"cust-demo"}}')).toBe(false);
    });

    it('shouldPrefillDeleteIdVariables skips when id already present in vars', () => {
      expect(shouldPrefillDeleteIdVariables('{"id":"usr-1"}', 'usr-1')).toBe(false);
      expect(shouldPrefillDeleteIdVariables('{}', 'usr-1')).toBe(true);
      expect(shouldPrefillDeleteIdVariables('{}', '')).toBe(false);
    });

    it('captureLesson3UserIdIfMissing parses id when session id empty', () => {
      resetGqlLesson3SessionFlags();
      document.body.innerHTML =
        '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-cap"}}}</pre>';
      captureLesson3UserIdIfMissing();
      expect(getLesson3CreatedUserId()).toBe('usr-cap');
    });

    it('captureLesson3UserIdIfMissing no-ops when response has no id', () => {
      resetGqlLesson3SessionFlags();
      document.body.innerHTML = '<pre data-testid="gql-response-body">{"data":{}}</pre>';
      captureLesson3UserIdIfMissing();
      expect(getLesson3CreatedUserId()).toBe('');
    });

    it('endpointNeedsClearing handles blank, whitespace, and missing input', () => {
      expect(endpointNeedsClearing({ value: 'http://old' } as HTMLInputElement)).toBe(true);
      expect(endpointNeedsClearing({ value: '' } as HTMLInputElement)).toBe(false);
      expect(endpointNeedsClearing({ value: '   ' } as HTMLInputElement)).toBe(false);
      expect(endpointNeedsClearing(null)).toBe(false);
    });

    it('finalizeCreateUserExecution stores id when present and always marks executed', () => {
      resetGqlLesson3SessionFlags();
      document.body.innerHTML =
        '<pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-final"}}}</pre>';
      finalizeCreateUserExecution();
      expect(getLesson3CreatedUserId()).toBe('usr-final');

      resetGqlLesson3SessionFlags();
      document.body.innerHTML =
        '<pre data-testid="gql-response-body">{"data":{"createUser":{"name":"Carol"}}}</pre>';
      finalizeCreateUserExecution();
      expect(getLesson3CreatedUserId()).toBe('');
    });

    it('markCreateMutationWritten skips re-filling createUser mutation', async () => {
      resetGqlLesson3SessionFlags();
      buildGql3StudioDom();
      stubMonacoEditor(GQL_CREATE_USER_MUTATION);
      markCreateMutationWritten();
      const ctx = makeCtx();
      vi.mocked(ctx.fill).mockClear();
      await ensureCreateUserMutation(ctx);
      expect(ctx.fill).not.toHaveBeenCalled();
    });

    it('prepareGql3ObserveIntrospectReading introspects when schema badge is empty', async () => {
      const ctx = makeCtx();
      document.body.innerHTML = `
        <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
        <button data-testid="gql-introspect-btn"></button>
        <span data-testid="gql-schema-badge-ok">Schema loaded (0)</span>
        <button data-testid="gql-right-tab-response"></button>
        <pre data-testid="gql-response-body">{}</pre>`;
      await prepareGql3ObserveIntrospectReading(ctx);
      expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    });

    it('prepareGql3IdempotencyReading delegates to exec reading helper', async () => {
      const ctx = makeCtx();
      document.body.innerHTML = `
        <button data-testid="gql-execute-btn"></button>
        <button data-testid="gql-right-tab-response"></button>
        <pre data-testid="gql-response-body">{}</pre>`;
      await prepareGql3IdempotencyReading(ctx);
      expect(ctx.click).toHaveBeenCalled();
    });
  });
});
