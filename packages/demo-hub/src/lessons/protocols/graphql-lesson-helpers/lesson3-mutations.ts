// ── Lesson 3: Mutations ─────────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  ensureEditorMode as ensureCoreEditorMode,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getGqlEditorQuery,
  getGqlVariablesJson,
  getEndpointInput,
  GQL_DEMO_HTTP,
  hasUsableSchemaBadge,
  responseBodyText,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  schemaBadgeShowsEmpty,
  openResponseBodyTab,
  ensureResponseCreateUserVisible,
  ensureResponseCreateOrderVisible,
  ensureResponseDeleteUserVisible,
  clearActiveTabEndpointOverride,
  configureDemoTabEndpointOverride,
  openSchemaTabWhenCached,
  resetDemoTabToPlainHttp,
} from './core';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

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
let _createVarsSet = false;
let _createExecuted = false;
let _orderMutationWritten = false;
let _orderExecuted = false;
let _deleteMutationWritten = false;
let _deleteExecuted = false;
let _secondDeleteExecuted = false;

/** Reset Lesson 3 session flags. */
export function resetGqlLesson3SessionFlags(): void {
  _lesson3CreatedUserId = '';
  _createMutationWritten = false;
  _createVarsSet = false;
  _createExecuted = false;
  _orderMutationWritten = false;
  _orderExecuted = false;
  _deleteMutationWritten = false;
  _deleteExecuted = false;
  _secondDeleteExecuted = false;
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

async function focusResponsePane(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
}

type Gql3QuietPane = 'response' | 'schema';

/** Introspect when needed, then open Response (default) or keep Schema visible. */
async function ensureGql3SchemaReadyQuiet(
  ctx: DemoActionContext,
  opts: { pane?: Gql3QuietPane } = {},
): Promise<void> {
  const pane = opts.pane ?? 'response';
  await prepareGql3IntrospectReading(ctx, { focusResponse: pane === 'response' });
  if (!hasUsableSchemaBadge()) {
    await ctx.click(GQL.INTROSPECT_BTN);
    await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
    await ctx.delay(800);
  }
  if (pane === 'schema') {
    await openSchemaTabWhenCached(ctx);
  } else {
    await focusResponsePane(ctx);
  }
}

async function clickExecuteAndWait(ctx: DemoActionContext): Promise<void> {
  await focusResponsePane(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
}

async function ensureEditorMode(ctx: DemoActionContext): Promise<void> {
  await ensureCoreEditorMode(ctx);
}

/** Ensure createUser mutation is in the editor. */
export async function ensureCreateUserMutation(ctx: DemoActionContext): Promise<void> {
  await ensureGql3SchemaReadyQuiet(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (_createMutationWritten && current.includes('createUser')) return;
  await fillGqlEditor(ctx, GQL_CREATE_USER_MUTATION, { focus: false });
  _createMutationWritten = true;
}

/**
 * Ensure the createUser mutation is in the editor AND Carol's variables are loaded
 * in the Variables panel — but the mutation has NOT yet been executed.
 * Used as the preAction guard for the gql3-exec-create step.
 */
export async function ensureCreateVarsSet(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserMutation(ctx);
  // Skip if flag set OR if the vars model already contains Carol's email
  if (_createVarsSet || getGqlVariablesJson().includes('carol@demo.local')) {
    _createVarsSet = true;
    return;
  }
  await ensureVariablesPanelOpen(ctx);
  await fillGqlVariables(ctx, GQL_CREATE_USER_VARS, { focus: false, openPanel: false });
  await ctx.delay(400);
  _createVarsSet = true;
}

/** Mark Carol's create variables as filled (called from lesson action). */
export function markCreateVarsSet(): void {
  _createVarsSet = true;
}

/** Mark createUser mutation as written (guard helper). */
export function markCreateMutationWritten(): void {
  _createMutationWritten = true;
}

/** Mark createOrder mutation as written (guard helper). */
export function markOrderMutationWritten(): void {
  _orderMutationWritten = true;
}

/** Mark deleteUser mutation as written (guard helper). */
export function markDeleteMutationWritten(): void {
  _deleteMutationWritten = true;
}

/** True when createOrder is already present and flagged as written. */
export function shouldSkipOrderMutationFill(editorQuery: string): boolean {
  return _orderMutationWritten && editorQuery.includes('createOrder');
}

/** True when deleteUser is already present and flagged as written. */
export function shouldSkipDeleteMutationFill(editorQuery: string): boolean {
  return _deleteMutationWritten && editorQuery.includes('deleteUser');
}

/** True when order execution variables still need cust-demo seed values. */
export function shouldFillOrderVariables(varsJson: string): boolean {
  return !varsJson.includes('cust-demo');
}

/** True when delete wire step should seed an empty id placeholder. */
export function shouldPrefillDeleteIdVariables(varsJson: string, userId: string): boolean {
  return Boolean(userId) && !varsJson.includes(userId);
}

/** Parse createUser id from the latest response when the session id is still empty. */
export function captureLesson3UserIdIfMissing(): void {
  if (!_lesson3CreatedUserId) {
    const id = parseCreatedUserIdFromResponse();
    if (id) _lesson3CreatedUserId = id;
  }
}

/** True when gqlMutationsLessonSetup should clear a pre-filled endpoint field. */
export function endpointNeedsClearing(input: HTMLInputElement | null | undefined): boolean {
  return Boolean((input?.value ?? '').trim());
}

/** Capture createUser id after execute and mark the create step complete. */
export function finalizeCreateUserExecution(): void {
  const id = parseCreatedUserIdFromResponse();
  if (id) _lesson3CreatedUserId = id;
  _createExecuted = true;
}

/**
 * Ensure the createOrder mutation is in the editor (without executing).
 * Used as the preAction guard for the gql3-exec-order step.
 */
export async function ensureOrderMutationWritten(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserExecuted(ctx);
  if (shouldSkipOrderMutationFill(getGqlEditorQuery())) return;
  await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION, { focus: false });
  _orderMutationWritten = true;
}

/**
 * Ensure the deleteUser mutation is in the editor WITHOUT filling the $id variable.
 * Used as the preAction guard for the gql3-wire-delete-var step.
 */
export async function ensureDeleteMutationWritten(ctx: DemoActionContext): Promise<void> {
  await ensureCreateOrderExecuted(ctx);
  captureLesson3UserIdIfMissing();
  if (!shouldSkipDeleteMutationFill(getGqlEditorQuery())) {
    await fillGqlEditor(ctx, GQL_DELETE_USER_MUTATION, { focus: false });
    _deleteMutationWritten = true;
  }
}

/** Mark the first delete execution as complete (called from lesson action). */
export function storeFirstDeleteExecuted(): void {
  _deleteExecuted = true;
}

/** Mark the second (idempotent) delete execution as complete. */
export function storeSecondDeleteExecuted(): void {
  _secondDeleteExecuted = true;
}

/** Mark createOrder execution complete (called from gql3-exec-order action). */
export function storeOrderExecuted(): void {
  _orderExecuted = true;
}

/**
 * Ensure the first delete (success: true) has been executed.
 * Used as the preAction guard for the gql3-idempotency-exec step.
 */
export async function ensureDeleteFirstExecuted(ctx: DemoActionContext): Promise<void> {
  // Check flag first — avoids running the entire prerequisite chain again
  if (_deleteExecuted) return;
  await ensureDeleteUserMutation(ctx);
  await clickExecuteAndWait(ctx);
  _deleteExecuted = true;
}

/** Ensure createUser was executed and Carol's id was captured from the response. */
export async function ensureCreateUserExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserMutation(ctx);
  if (_createExecuted && _lesson3CreatedUserId) return;
  await ensureVariablesPanelOpen(ctx);
  await fillGqlVariables(ctx, GQL_CREATE_USER_VARS, { focus: false });
  await clickExecuteAndWait(ctx);
  finalizeCreateUserExecution();
}

/** Ensure createOrder mutation (input type) is loaded and executed. */
export async function ensureCreateOrderExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserExecuted(ctx);
  if (!shouldSkipOrderMutationFill(getGqlEditorQuery())) {
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
  captureLesson3UserIdIfMissing();
  if (!shouldSkipDeleteMutationFill(getGqlEditorQuery())) {
    await fillGqlEditor(ctx, GQL_DELETE_USER_MUTATION, { focus: false });
    _deleteMutationWritten = true;
  }
  if (_lesson3CreatedUserId) {
    await fillGqlVariables(ctx, deleteVarsJson(), { focus: false });
  }
}

/**
 * Step 1 reading — studio on Response tab with the default `query { }` editor visible.
 */
export async function prepareGql3IntroReading(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  await resetDemoTabToPlainHttp(ctx);
  await ensureEditorMode(ctx);
  await focusResponsePane(ctx);
}

/**
 * Step 2 reading — empty endpoint field ready to fill (setup clears any prior URL).
 */
export async function prepareGql3EndpointReading(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  await clearActiveTabEndpointOverride(ctx);
  await focusResponsePane(ctx);
}

/**
 * Step 3 reading guard — literal demo endpoint, clear stale "Schema loaded (0)" badge,
 * and keep the Response pane visible so the Introspect spotlight matches the narration.
 */
export async function prepareGql3IntrospectReading(
  ctx: DemoActionContext,
  opts: { focusResponse?: boolean } = {},
): Promise<void> {
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  const input = getEndpointInput();
  if (!input?.value.includes('4010')) {
    await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
  }
  if (schemaBadgeShowsEmpty()) {
    await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
  }
  if (opts.focusResponse !== false) {
    await focusResponsePane(ctx);
  }
}

/** Step 3 action — click Introspect; badge read happens on the observe step. */
export async function runGql3IntrospectOnlyAction(ctx: DemoActionContext): Promise<void> {
  if (!hasUsableSchemaBadge()) {
    await ctx.click(GQL.INTROSPECT_BTN);
    await ctx.delay(400);
  }
}

/** Step 3b reading — schema badge visible; open Schema tab with type list. */
export async function prepareGql3ObserveIntrospectReading(ctx: DemoActionContext): Promise<void> {
  await prepareGql3IntrospectReading(ctx);
  if (!hasUsableSchemaBadge()) {
    await ctx.click(GQL.INTROSPECT_BTN);
    await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
    await ctx.delay(800);
  }
  await openSchemaTabWhenCached(ctx);
}

/**
 * Step 4 reading — Schema tab open with Mutation type listed (quiet introspect if needed).
 */
export async function prepareGql3SchemaMutationsReading(ctx: DemoActionContext): Promise<void> {
  await ensureGql3SchemaReadyQuiet(ctx);
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
  if (!document.querySelector(GQL.SCHEMA_TYPE_MUTATION)) {
    await ctx.click(GQL.INTROSPECT_BTN);
    await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
    await ctx.delay(800);
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.waitFor(GQL.SCHEMA_TYPE_MUTATION, 15000);
  }
  await ctx.delay(400);
}

/** Step 4 action — select Mutation so field names are visible in the detail panel. */
export async function runGql3SchemaMutationsAction(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.SCHEMA_TYPE_MUTATION);
  await ctx.delay(1200);
}

/** Step 6 reading — introspected schema, Mutation explorer visible, placeholder query in editor. */
export async function prepareGql3WriteCreateReading(ctx: DemoActionContext): Promise<void> {
  await ensureGql3SchemaReadyQuiet(ctx, { pane: 'schema' });
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (!current.includes('createUser')) {
    await fillGqlEditor(ctx, 'query { }', { focus: false });
  }
}

/** Step 6 reading — createUser mutation in editor, Variables panel open and empty. */
export async function prepareGql3SetCreateVarsReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserMutation(ctx);
  await ensureVariablesPanelOpen(ctx);
  if (!getGqlVariablesJson().includes('carol@demo.local')) {
    await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });
  }
  await focusResponsePane(ctx);
}

/** Step 7 reading — mutation + Carol vars loaded, Response pane still empty. */
export async function prepareGql3ExecCreateReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateVarsSet(ctx);
  await focusResponsePane(ctx);
}

/** Step 8 reading — createUser response visible with Carol's new id. */
export async function prepareGql3ObserveCreateReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserExecuted(ctx);
  await openResponseBodyTab(ctx);
  await ensureResponseCreateUserVisible(ctx);
}

/**
 * Step 9 reading — createUser response on the right, createUser mutation still in editor.
 */
export async function prepareGql3WriteOrderReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateUserExecuted(ctx);
  await ensureEditorMode(ctx);
  await focusResponsePane(ctx);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
}

/** Step 10 reading — createOrder mutation in editor, Variables panel open with empty input object. */
export async function prepareGql3SetOrderVarsReading(ctx: DemoActionContext): Promise<void> {
  await ensureOrderMutationWritten(ctx);
  await ensureVariablesPanelOpen(ctx);
  if (shouldFillOrderVariables(getGqlVariablesJson())) {
    await fillGqlVariables(
      ctx,
      '{\n  "input": {\n    "customerId": "",\n    "items": []\n  }\n}',
      { focus: false, openPanel: false },
    );
  }
  await focusResponsePane(ctx);
}

/** Step 11 reading — createOrder mutation + order vars filled, Response pane ready. */
export async function prepareGql3ExecOrderReading(ctx: DemoActionContext): Promise<void> {
  await ensureOrderMutationWritten(ctx);
  await ensureVariablesPanelOpen(ctx);
  if (shouldFillOrderVariables(getGqlVariablesJson())) {
    await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { focus: false, openPanel: false });
  }
  await focusResponsePane(ctx);
}

/** Step 12 reading — createOrder response visible after execute. */
export async function prepareGql3ObserveOrderReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateOrderExecuted(ctx);
  await openResponseBodyTab(ctx);
  await ensureResponseCreateOrderVisible(ctx);
}

/** Step 13 reading — createOrder response visible, editor still on createOrder. */
export async function prepareGql3WriteDeleteReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateOrderExecuted(ctx);
  await ensureEditorMode(ctx);
  await focusResponsePane(ctx);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
}

/** Step 13 reading — deleteUser mutation in editor, Variables panel open with empty id. */
export async function prepareGql3WireDeleteVarReading(ctx: DemoActionContext): Promise<void> {
  await ensureDeleteMutationWritten(ctx);
  await ensureVariablesPanelOpen(ctx);
  const id = getLesson3CreatedUserId() || parseCreatedUserIdFromResponse();
  if (shouldPrefillDeleteIdVariables(getGqlVariablesJson(), id ?? '')) {
    await fillGqlVariables(ctx, '{\n  "id": ""\n}', { focus: false, openPanel: false });
  }
  await focusResponsePane(ctx);
}

/** Step 14 reading — delete mutation + wired $id, Response pane ready for first delete. */
export async function prepareGql3ExecDeleteReading(ctx: DemoActionContext): Promise<void> {
  await ensureDeleteUserMutation(ctx);
  await focusResponsePane(ctx);
}

/** Step 15 reading — first delete response showing success: true. */
export async function prepareGql3ObserveDeleteReading(ctx: DemoActionContext): Promise<void> {
  await ensureDeleteFirstExecuted(ctx);
  await openResponseBodyTab(ctx);
  await ensureResponseDeleteUserVisible(ctx);
}

/** Step 16 reading — wired delete ready for second execute. */
export async function prepareGql3IdempotencyExecReading(ctx: DemoActionContext): Promise<void> {
  await ensureDeleteFirstExecuted(ctx);
  await focusResponsePane(ctx);
}

/**
 * Ensure the idempotent second delete has been executed.
 * Used as the preAction guard for gql3-observe-idempotency.
 */
export async function ensureSecondDeleteExecuted(ctx: DemoActionContext): Promise<void> {
  if (_secondDeleteExecuted) return;
  await ensureDeleteFirstExecuted(ctx);
  await clickExecuteAndWait(ctx);
  _secondDeleteExecuted = true;
}

/** Step 17 reading — second delete response showing success: false. */
export async function prepareGql3ObserveIdempotencyReading(ctx: DemoActionContext): Promise<void> {
  await ensureSecondDeleteExecuted(ctx);
  await openResponseBodyTab(ctx);
  await ensureResponseDeleteUserVisible(ctx);
}

/** @deprecated Use prepareGql3IdempotencyExecReading — kept for tests importing the old name. */
export async function prepareGql3IdempotencyReading(ctx: DemoActionContext): Promise<void> {
  await prepareGql3IdempotencyExecReading(ctx);
}

/** @deprecated Use runGql3IntrospectOnlyAction — kept for tests importing the old name. */
export async function runGql3IntrospectAction(ctx: DemoActionContext): Promise<void> {
  await runGql3IntrospectOnlyAction(ctx);
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
  await ctx.delay(1500);
}

/** Setup for Lesson 3 (GQL-6) — demo tab, clean editor/variables. */
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
  await ensureGqlDemoTab(ctx, 'gql-mutations', 'Mutations — Create, Update, Delete');
  await resetDemoTabToPlainHttp(ctx);
  await fillGqlEditor(ctx, 'query { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });
}

/** Cleanup for Lesson 3 (GQL-6) — close demo tab and reset session flags. */
export async function gqlMutationsLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-mutations');
}

