import type { DemoActionContext } from '../../../../types';
import { GQL } from '@shared/selectors';
import { GQL_DEMO_HTTP, GQL_USER_QUERY } from './constants';
import {
  fillGqlEditor,
  fillGqlVariables,
  ensureVariablesPanelOpen,
  getGqlEditorQuery,
  getGqlVariablesJson,
} from './monaco';
import { ensureIntrospected } from './schema';
import { gqlLessonSession, type GqlExecuteGuardOpts } from './sessionFlags';

/** Create two demo users (Alice & Bob) on the test server; stores IDs for variable JSON. */
export async function seedDemoUsers(): Promise<void> {
  if (gqlLessonSession.usersSeeded && gqlLessonSession.userAId && gqlLessonSession.userBId) return;

  const createUser = async (name: string, email: string): Promise<string> => {
    const resp = await fetch(GQL_DEMO_HTTP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation CreateDemoUser($name: String!, $email: String!) { createUser(name: $name, email: $email) { id name } }',
        variables: { name, email },
      }),
    });
    const body = (await resp.json()) as {
      data?: { createUser?: { id: string } };
      errors?: unknown[];
    };
    const id = body.data?.createUser?.id;
    if (!id || body.errors) {
      throw new Error(`Failed to seed demo user "${name}"`);
    }
    return id;
  };

  gqlLessonSession.userAId = await createUser('Alice', 'alice@demo.local');
  gqlLessonSession.userBId = await createUser('Bob', 'bob@demo.local');
  gqlLessonSession.usersSeeded = true;
}

function varsJsonForUser(userId: string): string {
  return JSON.stringify({ id: userId }, null, 2);
}

export function responseBodyText(): string {
  return document.querySelector(GQL.RESPONSE_BODY)?.textContent ?? '';
}

/** Ensure editor mode, introspection, demo users, and the parameterized user query are loaded. */
export async function ensureParamUserQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await seedDemoUsers();
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.delay(200);
  }
  const current = getGqlEditorQuery();
  if (gqlLessonSession.paramQueryWritten && current.includes('$id') && current.includes('GetUser')) return;
  await fillGqlEditor(ctx, GQL_USER_QUERY, { focus: false });
  gqlLessonSession.paramQueryWritten = true;
}

/** Open the Response pane and switch to the Body sub-tab. */
export async function openResponseBodyTab(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  const bodyTab = document.querySelector<HTMLElement>(GQL.RV_TAB_BODY);
  if (bodyTab && bodyTab.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RV_TAB_BODY);
    await ctx.delay(200);
  }
  scrollResponseBodyToTop();
}

/** Scroll the response Body JSON pane back to the top so `data.*` is visible. */
export function scrollResponseBodyToTop(): void {
  const scroll = document.querySelector<HTMLElement>('[data-testid="gql-rv-json-scroll"]');
  if (scroll) scroll.scrollTop = 0;
}

/** Ensure the Response pane is open and the compact data.createUser card is visible. */
export async function ensureResponseCreateUserVisible(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(300);
  await ctx.waitFor(GQL.RESPONSE_DATA_CREATE_USER, 10000);
}

/** Ensure the Response pane is open and the compact data.createOrder card is visible. */
export async function ensureResponseCreateOrderVisible(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(300);
  await ctx.waitFor(GQL.RESPONSE_DATA_CREATE_ORDER, 10000);
}

/** Ensure the Response pane is open and the compact data.deleteUser card is visible. */
export async function ensureResponseDeleteUserVisible(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(300);
  await ctx.waitFor(GQL.RESPONSE_DATA_DELETE_USER, 10000);
}

/** Ensure the Response pane is open and the compact data.user card is visible. */
export async function ensureResponseDataUserVisible(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(300);
  await ctx.waitFor(GQL.RESPONSE_DATA_USER, 10000);
}

/** Ensure the query was executed with Alice's `$id` and the response shows her name. */
export async function ensureExecutedWithAlice(
  ctx: DemoActionContext,
  opts?: GqlExecuteGuardOpts,
): Promise<void> {
  await ensureParamUserQuery(ctx);
  if (gqlLessonSession.varAExecuted && responseBodyText().includes('Alice')) {
    if (!opts?.skipResponseFocus) {
      await ensureResponseDataUserVisible(ctx);
    }
    return;
  }
  const varOpts = opts?.skipResponseFocus
    ? { focus: false as const, openPanel: false as const }
    : { focus: false as const };
  await fillGqlVariables(ctx, varsJsonForUser(gqlLessonSession.userAId), varOpts);
  if (!opts?.skipResponseFocus) {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
  }
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  if (!opts?.skipResponseFocus) {
    await ctx.waitFor(GQL.RESPONSE_DATA_USER, 8000);
  }
  await ctx.delay(500);
  gqlLessonSession.varAExecuted = true;
}

/** Ensure the query was re-executed with Bob's `$id` and the response shows his name. */
export async function ensureExecutedWithBob(
  ctx: DemoActionContext,
  opts?: GqlExecuteGuardOpts,
): Promise<void> {
  await ensureExecutedWithAlice(ctx, opts);
  if (gqlLessonSession.varBExecuted && responseBodyText().includes('Bob')) {
    if (!opts?.skipResponseFocus) {
      await ensureResponseDataUserVisible(ctx);
    }
    return;
  }
  const varOpts = opts?.skipResponseFocus
    ? { focus: false as const, openPanel: false as const }
    : { focus: false as const };
  await fillGqlVariables(ctx, varsJsonForUser(gqlLessonSession.userBId), varOpts);
  if (!opts?.skipResponseFocus) {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
  }
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  if (!opts?.skipResponseFocus) {
    await ctx.waitFor(GQL.RESPONSE_DATA_USER, 8000);
  }
  await ctx.delay(500);
  gqlLessonSession.varBExecuted = true;
}

/** Ensure the Variables panel holds Alice's `$id` JSON (Lesson 2 — set-vars step guard). */
export async function ensureAliceVarsFilled(ctx: DemoActionContext): Promise<void> {
  await ensureParamUserQuery(ctx);
  await ensureVariablesPanelOpen(ctx);
  await seedDemoUsers();
  if (gqlLessonSession.userAId && getGqlVariablesJson().includes(gqlLessonSession.userAId)) return;
  await fillGqlVariables(ctx, varsJsonForUser(gqlLessonSession.userAId), { focus: false, openPanel: false });
  await ctx.delay(400);
}

/** Ensure the Variables panel holds Bob's `$id` JSON (Lesson 2 — set-vars step guard). */
export async function ensureBobVarsFilled(ctx: DemoActionContext): Promise<void> {
  await ensureExecutedWithAlice(ctx);
  await ensureVariablesPanelOpen(ctx);
  await seedDemoUsers();
  if (gqlLessonSession.userBId && getGqlVariablesJson().includes(gqlLessonSession.userBId)) return;
  await fillGqlVariables(ctx, varsJsonForUser(gqlLessonSession.userBId), { focus: false, openPanel: false });
  await ctx.delay(400);
}
