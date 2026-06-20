/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_PROFILE_NAME,
  resetGqlLesson6SessionFlags,
  resetGqlLessonSessionFlags,
  gqlAuthLessonSetup,
} from './graphql-lesson-helpers';

describe('gql-auth-headers lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson6SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlAuthHeadersLesson.id).toBe('gql-auth-headers');
    expect(gqlAuthHeadersLesson.category).toBe('graphql');
    expect(gqlAuthHeadersLesson.name).toBe('Authentication & Headers');
    expect(gqlAuthHeadersLesson.steps.length).toBe(7);
    expect(gqlAuthHeadersLesson.estimatedMinutes).toBe(3);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlAuthHeadersLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlAuthHeadersLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlAuthHeadersLesson.steps.map((s) => s.id)).toEqual([
      'gql6-intro',
      'gql6-bearer',
      'gql6-env',
      'gql6-execute-bearer',
      'gql6-apikey',
      'gql6-execute-apikey',
      'gql6-profile',
    ]);
  });

  it('stateful steps 2–7 have preAction guards', () => {
    gqlAuthHeadersLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql6-bearer action configures bearer token', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-popover">
        <select data-testid="gql-auth-type-select">
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
        <code data-testid="gql-auth-preview"></code>
      </div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-bearer')!;
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  });

  it('gql6-execute-bearer opens metadata tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers">Authorization</div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };

    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-execute-bearer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('gql6-profile saves connection profile', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" value="" />
        <button data-testid="gql-profile-save-btn"></button>
      </div>
    `;
    const step = gqlAuthHeadersLesson.steps.find((s) => s.id === 'gql6-profile')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_SAVE_BTN);
  });

  it('setup clears endpoint and loads health query template', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco?: { editor: { getModels: () => []; getEditors: () => [] } } };
    w.monaco = { editor: { getModels: () => [], getEditors: () => [] } };
    await gqlAuthLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('lesson references auth token env value constant', () => {
    expect(LESSON6_AUTH_TOKEN_VALUE).toBe('lesson6-demo-jwt');
  });
});
