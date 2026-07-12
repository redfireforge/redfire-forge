/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql6'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupLesson3MutationsBeforeEach,
  teardownLesson3MutationsAfterEach,
  buildGql3StudioDom,
} from './lesson3-mutations.testHelpers';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_CREATE_USER_MUTATION,
  resetGqlLesson3SessionFlags,
  prepareGql3ObserveIntrospectReading,
  prepareGql3IdempotencyReading,
  ensureCreateUserMutation,
  getLesson3CreatedUserId,
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
} from './lesson3-mutations';
import {stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';

describe('lesson3-mutations helpers — guards & setup', () => {
  beforeEach(() => {
    setupLesson3MutationsBeforeEach();
  });
  afterEach(async () => {
    await teardownLesson3MutationsAfterEach();
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
        <button data-testid="gql-right-tab-schema"></button>
        <div data-testid="gql-schema-explorer">
          <div data-testid="gql-se-type-list"></div>
        </div>
        <pre data-testid="gql-response-body">{}</pre>`;
      await prepareGql3ObserveIntrospectReading(ctx);
      expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    });

    it('prepareGql3ObserveIntrospectReading opens Schema tab when badge is usable', async () => {
      const ctx = makeCtx();
      document.body.innerHTML = `
        <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
        <span data-testid="gql-schema-badge-ok">Schema loaded (12)</span>
        <button data-testid="gql-right-tab-schema"></button>
        <div data-testid="gql-schema-explorer">
          <div data-testid="gql-se-type-list"></div>
        </div>`;
      await prepareGql3ObserveIntrospectReading(ctx);
      expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
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
