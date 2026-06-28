/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  responseBodyText,
  scrollResponseBodyToTop,
  openResponseBodyTab,
  ensureExecutedWithAlice,
  seedDemoUsers,
} from './response';
import { resetGqlLesson2SessionFlags, gqlLessonSession } from './sessionFlags';

vi.mock('./schema', () => ({
  ensureIntrospected: vi.fn(async () => {}),
}));

vi.mock('./monaco', () => ({
  fillGqlEditor: vi.fn(async () => {}),
  fillGqlVariables: vi.fn(async () => {}),
  ensureVariablesPanelOpen: vi.fn(async () => {}),
  getGqlEditorQuery: vi.fn(() => 'query GetUser($id: ID!) { user(id: $id) { name } }'),
  getGqlVariablesJson: vi.fn(() => '{}'),
}));

describe('gql-demo-core/response — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson2SessionFlags();
    gqlLessonSession.userAId = 'usr-a';
    gqlLessonSession.userBId = 'usr-b';
    gqlLessonSession.usersSeeded = true;
    gqlLessonSession.paramQueryWritten = true;
  });

  it('responseBodyText reads response pane text', () => {
    document.body.innerHTML = `<div data-testid="gql-response-body">{"data":{}}</div>`;
    expect(responseBodyText()).toContain('data');
  });

  it('scrollResponseBodyToTop resets json scroll container', () => {
    const scroll = document.createElement('div');
    scroll.setAttribute('data-testid', 'gql-rv-json-scroll');
    scroll.scrollTop = 99;
    document.body.appendChild(scroll);
    scrollResponseBodyToTop();
    expect(scroll.scrollTop).toBe(0);
  });

  it('openResponseBodyTab switches to body sub-tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-rv-tab-response"></button>
      <button data-testid="gql-rv-tab-body" aria-selected="false"></button>
    `;
    await openResponseBodyTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_BODY);
  });

  it('ensureExecutedWithAlice short-circuits when already executed', async () => {
    gqlLessonSession.varAExecuted = true;
    document.body.innerHTML = `<div data-testid="gql-response-body">Alice</div>`;
    const ctx = makeCtx();
    await ensureExecutedWithAlice(ctx, { skipResponseFocus: true });
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('seedDemoUsers throws when createUser mutation fails', async () => {
    resetGqlLesson2SessionFlags();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ errors: [{ message: 'fail' }] }),
    }));
    await expect(seedDemoUsers()).rejects.toThrow(/Failed to seed demo user/);
  });

  it('seedDemoUsers short-circuits when users already seeded', async () => {
    gqlLessonSession.usersSeeded = true;
    gqlLessonSession.userAId = 'a';
    gqlLessonSession.userBId = 'b';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await seedDemoUsers();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ensureExecutedWithAlice runs execute flow when not yet executed', async () => {
    gqlLessonSession.varAExecuted = false;
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-response-data-user"></div>
    `;
    const ctx = makeCtx();
    await ensureExecutedWithAlice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(gqlLessonSession.varAExecuted).toBe(true);
  });

  it('ensureExecutedWithBob short-circuits when Bob already in response', async () => {
    gqlLessonSession.varAExecuted = true;
    gqlLessonSession.varBExecuted = true;
    document.body.innerHTML = `<div data-testid="gql-response-body">Alice and Bob</div>`;
    const ctx = makeCtx();
    const { ensureExecutedWithBob } = await import('./response');
    await ensureExecutedWithBob(ctx, { skipResponseFocus: true });
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('openResponseBodyTab skips body click when already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-rv-tab-response"></button>
      <button data-testid="gql-rv-tab-body" aria-selected="true"></button>
    `;
    await openResponseBodyTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RV_TAB_BODY);
  });

  it('responseBodyText returns empty string when body missing', () => {
    document.body.innerHTML = '';
    expect(responseBodyText()).toBe('');
  });

  it('ensureExecutedWithAlice focuses response when skipResponseFocus is false', async () => {
    gqlLessonSession.varAExecuted = false;
    document.body.innerHTML = `
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-response-data-user"></div>
      <button data-testid="gql-rv-tab-response"></button>
      <button data-testid="gql-rv-tab-body"></button>
    `;
    const ctx = makeCtx();
    await ensureExecutedWithAlice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureExecutedWithBob runs execute flow when Bob not yet in response', async () => {
    gqlLessonSession.varAExecuted = true;
    gqlLessonSession.varBExecuted = false;
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-response-data-user"></div>
      <button data-testid="gql-rv-tab-response"></button>
      <div data-testid="gql-response-body">Alice</div>
    `;
    const ctx = makeCtx();
    const { ensureExecutedWithBob } = await import('./response');
    await ensureExecutedWithBob(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(gqlLessonSession.varBExecuted).toBe(true);
  });

  it('ensureParamUserQuery skips editor click when editor mode already active', async () => {
    gqlLessonSession.paramQueryWritten = true;
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    const ctx = makeCtx();
    const { ensureParamUserQuery } = await import('./response');
    await ensureParamUserQuery(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('ensureAliceVarsFilled writes Alice id into variables panel', async () => {
    gqlLessonSession.userAId = 'usr-alice';
    gqlLessonSession.paramQueryWritten = true;
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-variables-panel"></div>
    `;
    const ctx = makeCtx();
    const { ensureAliceVarsFilled } = await import('./response');
    await ensureAliceVarsFilled(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureResponseCreateUserVisible opens response and waits for createUser card', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-response-data-create-user"></div>
    `;
    const ctx = makeCtx();
    const { ensureResponseCreateUserVisible } = await import('./response');
    await ensureResponseCreateUserVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });
});
