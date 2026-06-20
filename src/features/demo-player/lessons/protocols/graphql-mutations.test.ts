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
  GQL_DELETE_USER_MUTATION,
  GQL_DEMO_HTTP,
  resetGqlLesson3SessionFlags,
  resetGqlLessonSessionFlags,
  resetGqlLesson2SessionFlags,
  parseCreatedUserIdFromResponse,
  storeCreatedUserIdFromResponse,
  getLesson3CreatedUserId,
  gqlMutationsLessonSetup,
} from './graphql-lesson-helpers';

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
