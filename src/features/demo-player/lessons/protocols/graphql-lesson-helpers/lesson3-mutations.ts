// ── Lesson 3: Mutations ─────────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  ensureEditorMode as ensureCoreEditorMode,
  ensureIntrospected,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getGqlEditorQuery,
  getEndpointInput,
  responseBodyText,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';

/** createUser mutation — scalar arguments (Lesson 3). */
export const GQL_CREATE_USER_MUTATION = `mutation CreateUser($name: String!, $email: String!) {
  createUser(name: $name, email: $email) {
    id
    name
    email
  }
}`;

/** Variables for createUser — demo user Carol. */
export const GQL_CREATE_USER_VARS = JSON.stringify(
  { name: 'Carol', email: 'carol@demo.local' },
  null,
  2,
);

/** createOrder mutation — demonstrates input object type OrderInput!. */
export const GQL_CREATE_ORDER_MUTATION = `mutation CreateOrder($input: OrderInput!) {
  createOrder(input: $input) {
    id
    status
    customerId
  }
}`;

/** Variables for createOrder. */
export const GQL_CREATE_ORDER_VARS = JSON.stringify(
  { input: { customerId: 'cust-demo', items: ['widget', 'gadget'] } },
  null,
  2,
);

/** deleteUser mutation — uses $id from the user created in step 5–6. */
export const GQL_DELETE_USER_MUTATION = `mutation DeleteUser($id: ID!) {
  deleteUser(id: $id) {
    success
  }
}`;

let _lesson3CreatedUserId = '';
let _createMutationWritten = false;
let _createExecuted = false;
let _orderMutationWritten = false;
let _orderExecuted = false;
let _deleteMutationWritten = false;

/** Reset Lesson 3 session flags. */
export function resetGqlLesson3SessionFlags(): void {
  _lesson3CreatedUserId = '';
  _createMutationWritten = false;
  _createExecuted = false;
  _orderMutationWritten = false;
  _orderExecuted = false;
  _deleteMutationWritten = false;
}

/** Parse createUser.id from the response body JSON text. */
export function parseCreatedUserIdFromResponse(): string | null {
  const text = responseBodyText();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as { data?: { createUser?: { id?: string } } };
    const id = parsed.data?.createUser?.id;
    if (id) return id;
  } catch {
    // fall through to regex
  }
  const idMatch = text.match(/"createUser"\s*:\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"/);
  return idMatch?.[1] ?? null;
}

export function getLesson3CreatedUserId(): string {
  return _lesson3CreatedUserId;
}

/** Capture createUser id from the latest response and mark create step done. */
export function storeCreatedUserIdFromResponse(): void {
  const id = parseCreatedUserIdFromResponse();
  if (id) _lesson3CreatedUserId = id;
  _createExecuted = true;
}

function deleteVarsJson(): string {
  return JSON.stringify({ id: _lesson3CreatedUserId }, null, 2);
}

async function clickExecuteAndWait(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
}

async function ensureEditorMode(ctx: DemoActionContext): Promise<void> {
  await ensureCoreEditorMode(ctx);
}

/** Ensure createUser mutation is in the editor. */
export async function ensureCreateUserMutation(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (_createMutationWritten && current.includes('createUser')) return;
  await fillGqlEditor(ctx, GQL_CREATE_USER_MUTATION, { focus: false });
  _createMutationWritten = true;
}

/** Ensure createUser was executed and Carol's id was captured from the response. */
export async function ensureCreateUserExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserMutation(ctx);
  if (_createExecuted && _lesson3CreatedUserId) return;
  await ensureVariablesPanelOpen(ctx);
  await fillGqlVariables(ctx, GQL_CREATE_USER_VARS, { focus: false });
  await clickExecuteAndWait(ctx);
  const id = parseCreatedUserIdFromResponse();
  if (id) _lesson3CreatedUserId = id;
  _createExecuted = true;
}

/** Ensure createOrder mutation (input type) is loaded and executed. */
export async function ensureCreateOrderExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserExecuted(ctx);
  const current = getGqlEditorQuery();
  if (!_orderMutationWritten || !current.includes('createOrder')) {
    await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION, { focus: false });
    _orderMutationWritten = true;
  }
  if (_orderExecuted && responseBodyText().includes('createOrder')) return;
  await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { focus: false });
  await clickExecuteAndWait(ctx);
  _orderExecuted = true;
}

/** Ensure deleteUser mutation is loaded with $id set to the created user. */
export async function ensureDeleteUserMutation(ctx: DemoActionContext): Promise<void> {
  await ensureCreateOrderExecuted(ctx);
  if (!_lesson3CreatedUserId) {
    const id = parseCreatedUserIdFromResponse();
    if (id) _lesson3CreatedUserId = id;
  }
  const current = getGqlEditorQuery();
  if (!_deleteMutationWritten || !current.includes('deleteUser')) {
    await fillGqlEditor(ctx, GQL_DELETE_USER_MUTATION, { focus: false });
    _deleteMutationWritten = true;
  }
  if (_lesson3CreatedUserId) {
    await fillGqlVariables(ctx, deleteVarsJson(), { focus: false });
  }
}

/** Setup for Lesson 3 — clean editor/variables, no pre-seeded users. */
export async function gqlMutationsLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);
  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(200);
  }
  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }
  await fillGqlEditor(ctx, 'query { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });
}

/** Cleanup for Lesson 3. */
export async function gqlMutationsLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  await ctx.delay(100);
}

