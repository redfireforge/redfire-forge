/** Shared helpers for GraphQL Studio demo lessons (Monaco fill, preAction guards). */
import type { DemoActionContext } from '../../types';
import { GQL, WF } from '../../../../shared/selectors';

/** HTTP GraphQL endpoint for the Docker test server (port 4010). */
export const GQL_DEMO_HTTP = 'http://localhost:4010/graphql';
/** Health probe URL for PrerequisiteGate. */
export const GQL_DEMO_HEALTH = 'http://localhost:4010/health';
/** Minimal query used in Lesson 1 — no variables required. */
export const GQL_HEALTH_QUERY = 'query { health }';

/** Parameterized query used in Lesson 2 — requires `$id` variable. */
export const GQL_USER_QUERY = `query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}`;

let _endpointSet = false;
let _schemaLoaded = false;
let _queryWritten = false;
let _executed = false;

// Lesson 2 session state
let _userAId = '';
let _userBId = '';
let _usersSeeded = false;
let _paramQueryWritten = false;
let _varAExecuted = false;
let _varBExecuted = false;

/** Reset Lesson 1 session flags — call from lesson setup/cleanup. */
export function resetGqlLessonSessionFlags(): void {
  _endpointSet = false;
  _schemaLoaded = false;
  _queryWritten = false;
  _executed = false;
}

/** Reset Lesson 2 session flags — call from lesson setup/cleanup. */
export function resetGqlLesson2SessionFlags(): void {
  _userAId = '';
  _userBId = '';
  _usersSeeded = false;
  _paramQueryWritten = false;
  _varAExecuted = false;
  _varBExecuted = false;
}

export function getDemoUserAId(): string {
  return _userAId;
}

export function getDemoUserBId(): string {
  return _userBId;
}

function getEndpointInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT);
}

function endpointMatchesDemo(): boolean {
  const input = getEndpointInput();
  return (input?.value ?? '').trim() === GQL_DEMO_HTTP;
}

function hasSchemaBadge(): boolean {
  return !!document.querySelector(GQL.SCHEMA_BADGE_OK);
}

type MonacoGqlModel = { uri: { toString(): string }; getValue(): string; setValue(v: string): void };

type MonacoGqlEditor = { getModel(): MonacoGqlModel | null; setValue(v: string): void };

function getMonacoApi(): {
  editor: { getModels: () => MonacoGqlModel[]; getEditors: () => MonacoGqlEditor[] };
} | null {
  const w = window as unknown as {
    monaco?: { editor: { getModels: () => MonacoGqlModel[]; getEditors: () => MonacoGqlEditor[] } };
  };
  return w.monaco ?? null;
}

export function getMonacoGqlModel(): MonacoGqlModel | null {
  const monaco = getMonacoApi();
  const models = monaco?.editor?.getModels?.() ?? [];
  return models.find((m) => m.uri.toString().includes('inmemory://graphql/')) ?? null;
}

function setMonacoGqlValue(query: string): boolean {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return false;
  const editors = monaco.editor.getEditors?.() ?? [];
  const editor = editors.find((e) => e.getModel()?.uri.toString().includes('inmemory://graphql/'));
  if (editor) {
    editor.setValue(query);
    return true;
  }
  const model = getMonacoGqlModel();
  if (model) {
    model.setValue(query);
    return true;
  }
  return false;
}

function getMonacoVarsModel(): MonacoGqlModel | null {
  const monaco = getMonacoApi();
  const models = monaco?.editor?.getModels?.() ?? [];
  return models.find((m) => m.uri.toString().includes('inmemory://graphql-vars/')) ?? null;
}

function setMonacoVarsValue(json: string): boolean {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return false;
  const editors = monaco.editor.getEditors?.() ?? [];
  const editor = editors.find((e) => e.getModel()?.uri.toString().includes('inmemory://graphql-vars/'));
  if (editor) {
    editor.setValue(json);
    return true;
  }
  const model = getMonacoVarsModel();
  if (model) {
    model.setValue(json);
    return true;
  }
  return false;
}

/** Read the active variables JSON from the Monaco model. */
export function getGqlVariablesJson(): string {
  return getMonacoVarsModel()?.getValue() ?? '';
}

/**
 * Set the Variables panel JSON. Opens the Variables tab first unless `openPanel: false`.
 */
export async function fillGqlVariables(
  ctx: DemoActionContext,
  json: string,
  opts?: { focus?: boolean; openPanel?: boolean },
): Promise<void> {
  if (opts?.openPanel !== false) {
    await ensureVariablesPanelOpen(ctx);
  }
  if (opts?.focus !== false) {
    const surface = document.querySelector<HTMLElement>(`${GQL.VARS_PANEL} .monaco-editor`);
    if (surface) {
      await ctx.click(`${GQL.VARS_PANEL} .monaco-editor`);
      await ctx.delay(200);
    }
  }
  if (setMonacoVarsValue(json)) {
    await ctx.delay(400);
    return;
  }
  const textarea = document.querySelector<HTMLTextAreaElement>(
    `${GQL.VARS_PANEL} .monaco-editor textarea.inputarea`,
  );
  if (textarea) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    desc?.set?.call(textarea, json);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await ctx.delay(400);
  }
}

/** Open the bottom Variables tab and wait for the panel. */
export async function ensureVariablesPanelOpen(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.BOTTOM_TAB_VARS, 5000);
  const tabSelected = document.querySelector(GQL.BOTTOM_TAB_VARS)?.getAttribute('aria-selected') === 'true';
  if (!tabSelected || !document.querySelector(GQL.VARS_PANEL)) {
    await ctx.click(GQL.BOTTOM_TAB_VARS);
    await ctx.waitFor(GQL.VARS_PANEL, 5000);
    await ctx.delay(400);
  }
}

/** Create two demo users (Alice & Bob) on the test server; stores IDs for variable JSON. */
export async function seedDemoUsers(): Promise<void> {
  if (_usersSeeded && _userAId && _userBId) return;

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

  _userAId = await createUser('Alice', 'alice@demo.local');
  _userBId = await createUser('Bob', 'bob@demo.local');
  _usersSeeded = true;
}

function varsJsonForUser(userId: string): string {
  return JSON.stringify({ id: userId }, null, 2);
}

function responseBodyText(): string {
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
  if (_paramQueryWritten && current.includes('$id') && current.includes('GetUser')) return;
  await fillGqlEditor(ctx, GQL_USER_QUERY, { focus: false });
  _paramQueryWritten = true;
}

/** Ensure the query was executed with Alice's `$id` and the response shows her name. */
export async function ensureExecutedWithAlice(ctx: DemoActionContext): Promise<void> {
  await ensureParamUserQuery(ctx);
  if (_varAExecuted && responseBodyText().includes('Alice')) return;
  await fillGqlVariables(ctx, varsJsonForUser(_userAId), { focus: false });
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  _varAExecuted = true;
}

/** Ensure the query was re-executed with Bob's `$id` and the response shows his name. */
export async function ensureExecutedWithBob(ctx: DemoActionContext): Promise<void> {
  await ensureExecutedWithAlice(ctx);
  if (_varBExecuted && responseBodyText().includes('Bob')) return;
  await fillGqlVariables(ctx, varsJsonForUser(_userBId), { focus: false });
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  _varBExecuted = true;
}

/** Read the active GraphQL query from the Monaco model (empty string if unavailable). */
export function getGqlEditorQuery(): string {
  return getMonacoGqlModel()?.getValue() ?? '';
}

/**
 * Set the GraphQL editor content. Clicks the Monaco surface first (unless focus=false)
 * so the viewer sees the interaction; falls back to the hidden textarea when Monaco
 * is not yet mounted.
 */
export async function fillGqlEditor(
  ctx: DemoActionContext,
  query: string,
  opts?: { focus?: boolean },
): Promise<void> {
  if (opts?.focus !== false) {
    const surface = document.querySelector<HTMLElement>(`${GQL.EDITOR} .monaco-editor`);
    if (surface) {
      await ctx.click(`${GQL.EDITOR} .monaco-editor`);
      await ctx.delay(200);
    }
  }
  if (setMonacoGqlValue(query)) {
    await ctx.delay(400);
    return;
  }
  const textarea = document.querySelector<HTMLTextAreaElement>('.monaco-editor textarea.inputarea');
  if (textarea) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    desc?.set?.call(textarea, query);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await ctx.delay(400);
  }
}

/** Ensure the demo endpoint is filled in the connection bar. */
export async function ensureDemoEndpoint(ctx: DemoActionContext): Promise<void> {
  if (_endpointSet && endpointMatchesDemo()) return;
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  if (!endpointMatchesDemo()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
    await ctx.delay(300);
  }
  _endpointSet = true;
}

/** Ensure schema introspection has completed (badge OK visible). */
export async function ensureIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  if (_schemaLoaded && hasSchemaBadge()) return;
  if (!hasSchemaBadge()) {
    await ctx.click(GQL.INTROSPECT_BTN);
    await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
    await ctx.delay(500);
  }
  _schemaLoaded = true;
}

/** Ensure editor mode is active and the health query is loaded. */
export async function ensureHealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.delay(200);
  }
  const current = getGqlEditorQuery();
  if (_queryWritten && current.includes('health')) return;
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  _queryWritten = true;
}

/** Ensure a query has been executed and the response panel is populated. */
export async function ensureExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureHealthQuery(ctx);
  if (_executed && document.querySelector(GQL.RESPONSE_VIEWER)) return;
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  _executed = true;
}

/** Setup for Lesson 1 — reset UI to a clean starting state. */
export async function gqlFirstQuerySetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
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
}

/** Cleanup for Lesson 1 — reset session flags only (Docker server stays running). */
export async function gqlFirstQueryCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  await ctx.delay(100);
}

/** Setup for Lesson 2 — reset UI and seed Alice/Bob on the test server. */
export async function gqlVariablesLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
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
  try {
    await seedDemoUsers();
  } catch {
    // PrerequisiteGate blocks play when Docker is down; seed retries in preAction.
  }
}

/** Cleanup for Lesson 2 — reset session flags. */
export async function gqlVariablesLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 3: Mutations ─────────────────────────────────────────────────────

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
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.delay(200);
  }
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

// ── Lesson 4: Schema Exploration ────────────────────────────────────────────

/** Minimal query template for Try → field insert demos. */
export const GQL_INSERT_TEMPLATE_QUERY = `query {
  
}`;

let _schemaExplorerOpen = false;
let _queryTypeSelected = false;
let _userTypeSelected = false;
let _tryInsertDone = false;

/** Reset Lesson 4 session flags. */
export function resetGqlLesson4SessionFlags(): void {
  _schemaExplorerOpen = false;
  _queryTypeSelected = false;
  _userTypeSelected = false;
  _tryInsertDone = false;
}

/** Build a selector for a schema type list entry. */
export function gqlSchemaTypeSelector(typeName: string): string {
  return `[data-testid="gql-se-type-${typeName}"]`;
}

/** Build a selector for a Try → field insert button. */
export function gqlTryFieldSelector(fieldName: string): string {
  return `[data-testid="gql-try-field-${fieldName}"]`;
}

/** Open the Schema right tab and wait for the explorer. */
export async function ensureSchemaExplorerOpen(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  const schemaTabSelected = document.querySelector(GQL.RIGHT_TAB_SCHEMA)?.getAttribute('aria-selected') === 'true';
  if (_schemaExplorerOpen && schemaTabSelected && document.querySelector(GQL.SCHEMA_TYPE_LIST)) return;
  if (!schemaTabSelected) {
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
    await ctx.delay(400);
  }
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
  _schemaExplorerOpen = true;
}

/** Select a type in the schema explorer type list. */
export async function selectSchemaType(ctx: DemoActionContext, typeName: string): Promise<void> {
  await ensureSchemaExplorerOpen(ctx);
  const selector = gqlSchemaTypeSelector(typeName);
  await ctx.waitFor(selector, 5000);
  await ctx.click(selector);
  await ctx.waitFor(GQL.SCHEMA_TYPE_DETAIL, 5000);
  await ctx.delay(400);
  if (typeName === 'Query') _queryTypeSelected = true;
  if (typeName === 'User') _userTypeSelected = true;
}

/** Filter the type list via the schema search box. */
export async function searchSchemaTypes(ctx: DemoActionContext, term: string): Promise<void> {
  await ensureSchemaExplorerOpen(ctx);
  await ctx.fill(GQL.SCHEMA_SEARCH, term);
  await ctx.delay(400);
}

/** Ensure Query type is selected in the schema explorer. */
export async function ensureQueryTypeSelected(ctx: DemoActionContext): Promise<void> {
  if (_queryTypeSelected && document.querySelector(GQL.SCHEMA_TYPE_DETAIL)) return;
  await selectSchemaType(ctx, 'Query');
}

/** Ensure User type was selected (search + click). */
export async function ensureUserTypeSelected(ctx: DemoActionContext): Promise<void> {
  if (_userTypeSelected && document.querySelector(GQL.SCHEMA_TYPE_DETAIL)) return;
  await searchSchemaTypes(ctx, 'User');
  await selectSchemaType(ctx, 'User');
}

/** Prepare editor with cursor inside a query block for Try → insert. */
export async function ensureEditorReadyForInsert(ctx: DemoActionContext): Promise<void> {
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (!current.includes('query')) {
    await fillGqlEditor(ctx, GQL_INSERT_TEMPLATE_QUERY, { focus: false });
  }
  const surface = document.querySelector<HTMLElement>(`${GQL.EDITOR} .monaco-editor`);
  if (surface) {
    await ctx.click(`${GQL.EDITOR} .monaco-editor`);
    await ctx.delay(300);
  }
}

/** Mark Try → insert step complete (call from lesson action after visible insert). */
export function markTryInsertDone(): void {
  _tryInsertDone = true;
}

/** Ensure Try → was used to insert the health field. */
export async function ensureTryInsertDone(ctx: DemoActionContext): Promise<void> {
  if (_tryInsertDone || getGqlEditorQuery().includes('health')) {
    _tryInsertDone = true;
    return;
  }
  await ensureQueryTypeSelected(ctx);
  await ensureEditorReadyForInsert(ctx);
  const tryBtn = document.querySelector<HTMLElement>(GQL.TRY_FIELD_HEALTH);
  if (tryBtn) {
    await ctx.click(GQL.TRY_FIELD_HEALTH);
    await ctx.waitFor(GQL.INSERT_FIELD_TOAST, 5000);
    await ctx.delay(500);
  }
  _tryInsertDone = true;
}

/** Setup for Lesson 4 — clean state with empty query template. */
export async function gqlSchemaLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);
  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }
  await fillGqlEditor(ctx, GQL_INSERT_TEMPLATE_QUERY, { focus: false });
}

/** Cleanup for Lesson 4. */
export async function gqlSchemaLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson4SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 5: Subscriptions ─────────────────────────────────────────────────

/** orderStatus subscription — requires `$orderId` from a prior createOrder. */
export const GQL_ORDER_STATUS_SUBSCRIPTION = `subscription OrderUpdates($orderId: ID!) {
  orderStatus(orderId: $orderId) {
    status
    updatedAt
  }
}`;

let _lesson5OrderId = '';
let _lesson5OrderCreated = false;
let _lesson5SubscriptionWritten = false;
let _lesson5Subscribed = false;
let _lesson5PauseDemoDone = false;
let _lesson5FilterDemoDone = false;
let _lesson5AssertionAdded = false;

/** Reset Lesson 5 session flags. */
export function resetGqlLesson5SessionFlags(): void {
  _lesson5OrderId = '';
  _lesson5OrderCreated = false;
  _lesson5SubscriptionWritten = false;
  _lesson5Subscribed = false;
  _lesson5PauseDemoDone = false;
  _lesson5FilterDemoDone = false;
  _lesson5AssertionAdded = false;
}

export function getLesson5OrderId(): string {
  return _lesson5OrderId;
}

function orderVarsJson(orderId: string): string {
  return JSON.stringify({ orderId }, null, 2);
}

function subscriptionRowCount(): number {
  return document.querySelectorAll(GQL.SUBSCRIPTION_ROW).length;
}

function subscriptionLogText(): string {
  return document.querySelector(GQL.SUBSCRIPTION_MSG_LIST)?.textContent ?? '';
}

/** Parse createOrder.id from the response body JSON text. */
export function parseCreatedOrderIdFromResponse(): string | null {
  const text = responseBodyText();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as { data?: { createOrder?: { id?: string } } };
    const id = parsed.data?.createOrder?.id;
    if (id) return id;
  } catch {
    // fall through to regex
  }
  const idMatch = text.match(/"createOrder"\s*:\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"/);
  return idMatch?.[1] ?? null;
}

/** Capture createOrder id from the latest response. */
export function storeCreatedOrderIdFromResponse(): void {
  const id = parseCreatedOrderIdFromResponse();
  if (id) {
    _lesson5OrderId = id;
    _lesson5OrderCreated = true;
  }
}

/** Create an order on the test server for orderStatus subscription demos. */
export async function createDemoOrder(): Promise<string> {
  if (_lesson5OrderId) return _lesson5OrderId;

  const resp = await fetch(GQL_DEMO_HTTP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation CreateDemoOrder($input: OrderInput!) { createOrder(input: $input) { id status } }',
      variables: {
        input: { customerId: 'cust-lesson5', items: ['lesson5-widget'] },
      },
    }),
  });
  const body = (await resp.json()) as {
    data?: { createOrder?: { id: string } };
    errors?: unknown[];
  };
  const id = body.data?.createOrder?.id;
  if (!id || body.errors) {
    throw new Error('Failed to create demo order for subscription lesson');
  }
  _lesson5OrderId = id;
  _lesson5OrderCreated = true;
  return id;
}

async function clickSubscribeAndWait(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
  if (subscribeBtn && !subscribeBtn.disabled) {
    await ctx.click(GQL.SUBSCRIBE_BTN);
  }
  await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
  await ctx.delay(500);
}

async function waitForSubscriptionComplete(ctx: DemoActionContext, minRows = 3): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const rows = subscriptionRowCount();
    const text = subscriptionLogText();
    if (rows >= minRows && text.includes('COMPLETE')) return;
    await ctx.delay(300);
  }
}

export async function ensureWsTransport(ctx: DemoActionContext): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>(GQL.TRANSPORT_SELECT);
  if (select && select.value !== 'graphql-transport-ws') {
    await ctx.selectOption(GQL.TRANSPORT_SELECT, 'graphql-transport-ws');
    await ctx.delay(400);
  }
}

/** Ensure createOrder mutation ran and order id is stored. */
export async function ensureDemoOrderCreated(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  if (_lesson5OrderCreated && _lesson5OrderId) return;

  try {
    await createDemoOrder();
    return;
  } catch {
    // Fall through to visible mutation in UI when setup fetch failed.
  }

  const current = getGqlEditorQuery();
  if (!current.includes('createOrder')) {
    await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION, { focus: false });
  }
  await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { focus: false });
  await clickExecuteAndWait(ctx);
  const id = parseCreatedOrderIdFromResponse();
  if (id) {
    _lesson5OrderId = id;
    _lesson5OrderCreated = true;
  }
}

/** Ensure orderStatus subscription query is in the editor. */
export async function ensureSubscriptionQueryWritten(ctx: DemoActionContext): Promise<void> {
  await ensureDemoOrderCreated(ctx);
  const current = getGqlEditorQuery();
  if (_lesson5SubscriptionWritten && current.includes('orderStatus')) return;
  await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION, { focus: false });
  _lesson5SubscriptionWritten = true;
}

/** Ensure subscription variables are set to the demo order id. */
export async function ensureSubscriptionVars(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionQueryWritten(ctx);
  if (!_lesson5OrderId) {
    try {
      await createDemoOrder();
    } catch {
      const id = parseCreatedOrderIdFromResponse();
      if (id) _lesson5OrderId = id;
    }
  }
  if (_lesson5OrderId) {
    await fillGqlVariables(ctx, orderVarsJson(_lesson5OrderId), { focus: false });
  }
}

/** Subscribe and wait until PENDING → COMPLETE messages appear in the log. */
export async function ensureSubscribedWithMessages(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionVars(ctx);
  await ensureWsTransport(ctx);
  if (_lesson5Subscribed && subscriptionRowCount() >= 3 && subscriptionLogText().includes('COMPLETE')) {
    return;
  }
  await clickSubscribeAndWait(ctx);
  await waitForSubscriptionComplete(ctx);
  _lesson5Subscribed = true;
}

/** Re-subscribe, pause while active, then resume (pause/resume demo). */
export async function ensurePauseResumeDemo(ctx: DemoActionContext): Promise<void> {
  await ensureSubscribedWithMessages(ctx);
  if (_lesson5PauseDemoDone) return;

  const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
  if (subscribeBtn && !subscribeBtn.disabled) {
    await ctx.click(GQL.SUBSCRIBE_BTN);
    await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
    await ctx.delay(200);
  }

  const pauseBtn = document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN);
  if (pauseBtn) {
    await ctx.click(GQL.SUBSCRIPTION_PAUSE_BTN);
    await ctx.delay(1200);
    const resumeBtn = document.querySelector(GQL.SUBSCRIPTION_RESUME_BTN);
    if (resumeBtn) {
      await ctx.click(GQL.SUBSCRIPTION_RESUME_BTN);
      await ctx.delay(800);
    }
  }
  _lesson5PauseDemoDone = true;
}

/** Open log filter and type a filter term. */
export async function ensureFilterDemo(ctx: DemoActionContext): Promise<void> {
  await ensureSubscribedWithMessages(ctx);
  if (_lesson5FilterDemoDone && document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)) return;

  if (!document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)) {
    await ctx.click(GQL.SUBSCRIPTION_FILTER_BTN);
    await ctx.waitFor(GQL.SUBSCRIPTION_FILTER_BAR, 5000);
    await ctx.delay(400);
  }
  await ctx.fill(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  await ctx.delay(600);
  _lesson5FilterDemoDone = true;
}

/** Add a JSONPath assertion on orderStatus.status. */
export async function ensureAssertionAdded(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionQueryWritten(ctx);
  if (_lesson5AssertionAdded && document.querySelector(GQL.ASSERTION_ROW)) return;

  const panel = document.querySelector(GQL.ASSERTION_PANEL);
  if (!panel) return;

  const toggle = document.querySelector<HTMLElement>(GQL.ASSERTION_TOGGLE);
  if (toggle?.getAttribute('aria-expanded') === 'false') {
    await ctx.click(GQL.ASSERTION_TOGGLE);
    await ctx.delay(400);
  }

  if (!document.querySelector(GQL.ASSERTION_ROW)) {
    await ctx.click(GQL.ASSERTION_ADD_BTN);
    await ctx.waitFor(GQL.ASSERTION_ROW, 5000);
    await ctx.delay(400);
  }

  await ctx.fill(GQL.ASSERTION_JSONPATH, '$.orderStatus.status');
  await ctx.delay(400);
  await ctx.selectOption(GQL.ASSERTION_OPERATOR, 'equals');
  await ctx.delay(300);
  await ctx.fill(GQL.ASSERTION_EXPECTED, 'COMPLETE');
  await ctx.delay(500);
  _lesson5AssertionAdded = true;
}

/** Setup for Lesson 5 — clean editor; seed order quietly when Docker is up. */
export async function gqlSubscriptionsLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();

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

  await fillGqlEditor(ctx, 'subscription { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });

  try {
    await createDemoOrder();
  } catch {
    // PrerequisiteGate blocks play when Docker is down; order created in lesson step 3.
  }
}

/** Cleanup for Lesson 5. */
export async function gqlSubscriptionsLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson5SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 6: Authentication & Headers ──────────────────────────────────────

export const LESSON6_BEARER_TEMPLATE = '{{authToken}}';
export const LESSON6_AUTH_TOKEN_VALUE = 'lesson6-demo-jwt';
export const LESSON6_API_KEY_HEADER = 'X-API-Key';
export const LESSON6_API_KEY_TEMPLATE = '{{apiKey}}';
export const LESSON6_API_KEY_SECRET = 'lesson6-secret-key';
export const LESSON6_PROFILE_NAME = 'Lesson 6 Demo';

let _lesson6BearerConfigured = false;
let _lesson6EnvTokenSet = false;
let _lesson6BearerExecuted = false;
let _lesson6ApiKeyConfigured = false;
let _lesson6ApiKeyExecuted = false;
let _lesson6ProfileSaved = false;

export function resetGqlLesson6SessionFlags(): void {
  _lesson6BearerConfigured = false;
  _lesson6EnvTokenSet = false;
  _lesson6BearerExecuted = false;
  _lesson6ApiKeyConfigured = false;
  _lesson6ApiKeyExecuted = false;
  _lesson6ProfileSaved = false;
}

function responseInspectorText(): string {
  const meta = document.querySelector(GQL.RV_METADATA)?.textContent ?? '';
  const reqHdr = document.querySelector(GQL.RV_REQUEST_HEADERS)?.textContent ?? '';
  return `${meta}${reqHdr}`;
}

async function closeAuthPopoverIfOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.AUTH_POPOVER)) {
    const closeBtn = document.querySelector<HTMLElement>(GQL.AUTH_POPOVER_CLOSE);
    if (closeBtn) {
      await ctx.click(GQL.AUTH_POPOVER_CLOSE);
    } else {
      await ctx.click(GQL.AUTH_BADGE_BTN);
    }
    await ctx.delay(300);
  }
}

async function closeEnvModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.ENV_MODAL)) {
    const overlay = document.querySelector<HTMLElement>('[data-testid="gql-env-modal-overlay"]');
    if (overlay) {
      await ctx.click('[data-testid="gql-env-modal-overlay"]');
    }
    await ctx.delay(300);
  }
}

/** Open the Auth popover from the connection bar. */
export async function ensureAuthPopoverOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GQL.AUTH_POPOVER)) return;
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await ctx.click(GQL.AUTH_BADGE_BTN);
  await ctx.waitFor(GQL.AUTH_POPOVER, 5000);
  await ctx.delay(400);
}

/** Select auth type in the popover. */
export async function selectAuthType(
  ctx: DemoActionContext,
  type: 'bearer' | 'apiKey',
): Promise<void> {
  await ensureAuthPopoverOpen(ctx);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, type);
  await ctx.delay(400);
}

function setEnvVarInModal(key: string, value: string): void {
  const rows = document.querySelectorAll('[data-testid="gql-env-var-row"]');
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('[data-testid="gql-env-var-key"]');
    if (keyInput?.value === key) {
      const valInput = row.querySelector<HTMLInputElement>('.gql-env-var-input');
      if (valInput) {
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        desc?.set?.call(valInput, value);
        valInput.dispatchEvent(new Event('input', { bubbles: true }));
        valInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
  }
  const addBtn = document.querySelector<HTMLButtonElement>('[data-testid="gql-env-var-add-btn"]');
  addBtn?.click();
  const keyInputs = document.querySelectorAll<HTMLInputElement>('[data-testid="gql-env-var-key"]');
  const valInputs = document.querySelectorAll<HTMLInputElement>('.gql-env-var-input');
  const keyInput = keyInputs[keyInputs.length - 1];
  const valInput = valInputs[valInputs.length - 1];
  if (keyInput && valInput) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    desc?.set?.call(keyInput, key);
    keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    desc?.set?.call(valInput, value);
    valInput.dispatchEvent(new Event('input', { bubbles: true }));
    valInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/** Open environment modal and set authToken variable. */
export async function ensureEnvAuthToken(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  if (_lesson6EnvTokenSet) return;

  await closeAuthPopoverIfOpen(ctx);
  if (!document.querySelector(GQL.ENV_MODAL)) {
    await ctx.click(GQL.ENV_BADGE);
    await ctx.waitFor(GQL.ENV_MODAL, 5000);
    await ctx.delay(600);
  }

  const newEnvBtn = document.querySelector(GQL.ENV_NEW_BTN);
  if (newEnvBtn) {
    const envItems = document.querySelectorAll('[data-testid^="gql-env-item-"]');
    if (envItems.length === 0) {
      await ctx.click(GQL.ENV_NEW_BTN);
      await ctx.delay(500);
    }
  }

  setEnvVarInModal('authToken', LESSON6_AUTH_TOKEN_VALUE);
  setEnvVarInModal('apiKey', LESSON6_API_KEY_SECRET);
  await ctx.delay(500);
  _lesson6EnvTokenSet = true;
}

/** Configure Bearer auth with {{authToken}} template. */
export async function ensureBearerAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  if (_lesson6BearerConfigured) return;
  await selectAuthType(ctx, 'bearer');
  await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
  await ctx.delay(400);
  _lesson6BearerConfigured = true;
}

/** Execute health query with bearer auth and open Metadata tab. */
export async function ensureBearerExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureEnvAuthToken(ctx);
  await ensureBearerAuthConfigured(ctx);
  await ensureHealthQuery(ctx);
  if (_lesson6BearerExecuted && responseInspectorText().includes('Authorization')) return;

  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6BearerExecuted = true;
}

/** Switch auth to API Key with {{apiKey}} value template. */
export async function ensureApiKeyAuthConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureBearerExecutedWithMetadata(ctx);
  if (_lesson6ApiKeyConfigured) return;
  await selectAuthType(ctx, 'apiKey');
  await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
  await ctx.delay(300);
  await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
  await ctx.delay(400);
  _lesson6ApiKeyConfigured = true;
}

/** Execute again and verify API key header in Metadata. */
export async function ensureApiKeyExecutedWithMetadata(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyAuthConfigured(ctx);
  if (_lesson6ApiKeyExecuted && responseInspectorText().includes(LESSON6_API_KEY_HEADER)) return;

  await closeAuthPopoverIfOpen(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  await ctx.click(GQL.RV_TAB_METADATA);
  await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
  await ctx.delay(600);
  _lesson6ApiKeyExecuted = true;
}

/** Save current endpoint + auth as a named connection profile. */
export async function ensureProfileSaved(ctx: DemoActionContext): Promise<void> {
  await ensureApiKeyExecutedWithMetadata(ctx);
  if (_lesson6ProfileSaved && document.querySelector(`[data-testid^="gql-profile-row-"]`)) return;

  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ctx.click(GQL.PROFILE_BADGE);
  await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
  await ctx.delay(600);
  await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
  await ctx.delay(400);
  await ctx.click(GQL.PROFILE_SAVE_BTN);
  await ctx.delay(800);
  _lesson6ProfileSaved = true;
}

/** Setup for Lesson 6 — clean editor, endpoint, modals closed. */
export async function gqlAuthLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();

  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);

  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 6. */
export async function gqlAuthLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson6SessionFlags();
  await closeAuthPopoverIfOpen(ctx);
  await closeEnvModalIfOpen(ctx);
  await ctx.delay(100);
}

// ── Lesson 7: Query Builder ───────────────────────────────────────────────────

export const LESSON7_USER_FIELD_PATH = 'user.id';
export const LESSON7_USER_ALIAS = 'userId';
export const LESSON7_EDITOR_COMMENT = '# edited in editor';

let _lesson7HealthSelected = false;
let _lesson7SelectAllDone = false;
let _lesson7UserConfigured = false;
let _lesson7AliasSet = false;
let _lesson7IncludeSet = false;
let _lesson7EditedToEditor = false;

export function resetGqlLesson7SessionFlags(): void {
  _lesson7HealthSelected = false;
  _lesson7SelectAllDone = false;
  _lesson7UserConfigured = false;
  _lesson7AliasSet = false;
  _lesson7IncludeSet = false;
  _lesson7EditedToEditor = false;
}

export function getBuilderCodeText(): string {
  return document.querySelector<HTMLElement>(GQL.QB_CODE)?.textContent?.trim() ?? '';
}

function findFieldRowByName(fieldName: string): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>('.gql-qb-field-row');
  for (const row of rows) {
    const nameEl = row.querySelector('.gql-qb-field-name');
    if (nameEl?.textContent?.trim() === fieldName) return row;
  }
  return null;
}

async function quietDomClick(ctx: DemoActionContext, el: HTMLElement | null | undefined): Promise<void> {
  if (!el) return;
  el.click();
  await ctx.delay(400);
}

async function expandSummaryFieldOption(ctx: DemoActionContext, path: string): Promise<void> {
  await ctx.waitFor(GQL.QB_FIELD_OPTIONS, 5000);
  const expandBtn = document.querySelector<HTMLElement>(`.gql-qb-fo-expand[title="${path}"]`);
  const row = expandBtn?.closest('.gql-qb-fo-row');
  if (row && !row.querySelector('.gql-qb-fo-body')) {
    await quietDomClick(ctx, expandBtn);
  }
}

/** Switch to Builder mode with introspected schema loaded. */
export async function ensureBuilderMode(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  const active = document.querySelector<HTMLElement>(GQL.MODE_BUILDER)?.classList.contains('gql-mode-btn--active');
  if (!active || !document.querySelector(GQL.QB_FIELD_TREE)) {
    await ctx.click(GQL.MODE_BUILDER);
    await ctx.waitFor(GQL.QB_FIELD_TREE, 8000);
    await ctx.delay(600);
  }
}

/** Select the `health` field in the builder tree. */
export async function ensureHealthFieldSelected(ctx: DemoActionContext): Promise<void> {
  await ensureBuilderMode(ctx);
  if (_lesson7HealthSelected && getBuilderCodeText().includes('health')) return;

  const row = findFieldRowByName('health');
  const check = row?.querySelector<HTMLElement>('.gql-qb-check');
  if (!check?.classList.contains('gql-qb-check--checked')) {
    await quietDomClick(ctx, check);
    await ctx.delay(500);
  }
  _lesson7HealthSelected = true;
}

/** Run Select All then Deselect All at the Query root level. */
export async function ensureSelectAllDemonstrated(ctx: DemoActionContext): Promise<void> {
  await ensureHealthFieldSelected(ctx);
  if (_lesson7SelectAllDone) return;

  await ctx.click(GQL.QB_SELECT_ALL);
  await ctx.delay(600);
  await ctx.click(GQL.QB_SELECT_ALL);
  await ctx.delay(600);
  _lesson7SelectAllDone = true;
}

/** Select `user` with subfields and fill the required `id` argument. */
export async function ensureUserFieldConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureSelectAllDemonstrated(ctx);
  if (_lesson7UserConfigured && getBuilderCodeText().includes('user')) return;

  const userRow = findFieldRowByName('user');
  const expandBtn = userRow?.querySelector<HTMLElement>('.gql-qb-expand-btn');
  if (expandBtn && !expandBtn.classList.contains('gql-qb-expand-btn--open')) {
    await quietDomClick(ctx, expandBtn);
  }

  const check = userRow?.querySelector<HTMLElement>('.gql-qb-check');
  const selected =
    check?.classList.contains('gql-qb-check--checked') ||
    check?.classList.contains('gql-qb-check--partial');
  if (!selected) {
    await quietDomClick(ctx, check);
    await ctx.delay(500);
  }

  await ctx.waitFor(GQL.QB_ARG_USER_ID, 5000);
  const userId = getDemoUserAId() || 'usr-1';
  await ctx.fill(GQL.QB_ARG_USER_ID, userId);
  await ctx.delay(400);
  _lesson7UserConfigured = true;
}

/** Set alias `userId` on the `user.id` field in the Summary panel. */
export async function ensureAliasConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureUserFieldConfigured(ctx);
  if (_lesson7AliasSet && getBuilderCodeText().includes(LESSON7_USER_ALIAS)) return;

  await expandSummaryFieldOption(ctx, LESSON7_USER_FIELD_PATH);
  await ctx.fill(GQL.FO_ALIAS_USER_ID, LESSON7_USER_ALIAS);
  await ctx.delay(500);
  _lesson7AliasSet = true;
}

/** Enable @include directive on `user.id`. */
export async function ensureIncludeConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureAliasConfigured(ctx);
  if (_lesson7IncludeSet && getBuilderCodeText().includes('@include')) return;

  await expandSummaryFieldOption(ctx, LESSON7_USER_FIELD_PATH);
  const toggle = document.querySelector<HTMLElement>(GQL.FO_INCLUDE_USER_ID);
  if (toggle?.getAttribute('aria-checked') !== 'true') {
    await ctx.click(GQL.FO_INCLUDE_USER_ID);
    await ctx.delay(500);
  }
  _lesson7IncludeSet = true;
}

/** Transfer generated SDL to Monaco via Edit in Editor. */
export async function ensureEditedToEditor(ctx: DemoActionContext): Promise<void> {
  await ensureIncludeConfigured(ctx);
  const editorActive = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)?.classList.contains('gql-mode-btn--active');
  if (_lesson7EditedToEditor && editorActive) return;

  await ctx.click(GQL.QB_EDIT);
  await ctx.waitFor(GQL.EDITOR, 5000);
  await ctx.delay(800);
  _lesson7EditedToEditor = true;
}

/** Setup for Lesson 7 — clean slate, seed demo user for `id` arg. */
export async function gqlQueryBuilderLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();

  await ensureEditorMode(ctx);

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — ensureUserFieldConfigured falls back to usr-1
  }
}

/** Cleanup for Lesson 7. */
export async function gqlQueryBuilderLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson7SessionFlags();
  await ensureEditorMode(ctx);
  await ctx.delay(100);
}

// ── Lesson 8: Collections & History ───────────────────────────────────────────

export const LESSON8_ITEM_NAME = 'Health Check';
export const LESSON8_ITEM_RENAME = 'Lesson 8 Health';
export const LESSON8_COLLECTION_NAME = 'Lesson 8 Collection';

let _lesson8HistoryReady = false;
let _lesson8PreviewOpen = false;
let _lesson8Loaded = false;
let _lesson8Run = false;
let _lesson8Saved = false;
let _lesson8Renamed = false;
let _lesson8Restored = false;

export function resetGqlLesson8SessionFlags(): void {
  _lesson8HistoryReady = false;
  _lesson8PreviewOpen = false;
  _lesson8Loaded = false;
  _lesson8Run = false;
  _lesson8Saved = false;
  _lesson8Renamed = false;
  _lesson8Restored = false;
}

/** Open the History activity panel. */
export async function openHistoryPanel(ctx: DemoActionContext): Promise<void> {
  const active = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)?.classList.contains('gql-activity-tab--active');
  if (!active) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
    await ctx.delay(400);
  }
}

/** Open the Collections activity panel. */
export async function openCollectionsPanel(ctx: DemoActionContext): Promise<void> {
  const active = document.querySelector<HTMLElement>(GQL.ACTIVITY_COLLECTIONS)?.classList.contains('gql-activity-tab--active');
  if (!active) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.waitFor(GQL.COLLECTIONS_PANEL, 5000);
    await ctx.delay(400);
  }
}

async function expandFirstCollection(ctx: DemoActionContext): Promise<void> {
  const node = document.querySelector<HTMLElement>(GQL.COL_NODE);
  const header = node?.querySelector<HTMLElement>('.gql-col-node-header');
  const expanded = node?.getAttribute('aria-expanded') === 'true';
  if (header && !expanded) {
    header.click();
    await ctx.delay(400);
  }
}

async function clickContextMenuItem(ctx: DemoActionContext, label: string): Promise<void> {
  const btn = Array.from(document.querySelectorAll<HTMLElement>(GQL.COL_CTX_MENU + ' button'))
    .find((b) => b.textContent?.trim().startsWith(label));
  if (btn) {
    btn.click();
    await ctx.delay(400);
  }
}

async function openFirstCollectionItemContextMenu(ctx: DemoActionContext): Promise<void> {
  const item = document.querySelector<HTMLElement>(GQL.COL_ITEM);
  if (item) {
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    await ctx.delay(400);
  }
}

async function openCollectionHeaderContextMenu(ctx: DemoActionContext): Promise<void> {
  const header = document.querySelector<HTMLElement>('.gql-col-node-header');
  if (header) {
    header.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    await ctx.delay(400);
  }
}

function injectCollectionsImportFile(json: string): void {
  const input = document.querySelector<HTMLInputElement>(GQL.COLLECTIONS_IMPORT_INPUT);
  if (!input) return;
  const file = new File([json], 'lesson8-collections.json', { type: 'application/json' });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Build a minimal collections export JSON for lesson 8 import restore. */
export function buildLesson8ImportPayload(): string {
  const colId = 'lesson8-restore-col';
  const itemId = 'lesson8-restore-item';
  const now = Date.now();
  return JSON.stringify({
    _exportMeta: { version: '1.1', exportedAt: now, appVersion: 'lesson8' },
    collections: [{
      collection: {
        id: colId,
        name: LESSON8_COLLECTION_NAME,
        variables: {},
        createdAt: now,
        updatedAt: now,
      },
      folders: [],
      items: [{
        id: itemId,
        collectionId: colId,
        name: LESSON8_ITEM_RENAME,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        operation: {
          id: 'op-lesson8',
          name: 'HealthCheck',
          query: GQL_HEALTH_QUERY,
          variables: '{}',
          operationType: 'query',
          headers: [],
        },
      }],
    }],
  }, null, 2);
}

/** Execute health query and ensure a History entry exists. */
export async function ensureHealthExecutedWithHistory(ctx: DemoActionContext): Promise<void> {
  if (_lesson8HistoryReady && document.querySelector(GQL.HISTORY_ENTRY)) return;
  await ensureExecuted(ctx);
  await openHistoryPanel(ctx);
  if (!document.querySelector(GQL.HISTORY_ENTRY)) {
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(500);
    await openHistoryPanel(ctx);
  }
  await ctx.waitFor(GQL.HISTORY_ENTRY, 8000);
  _lesson8HistoryReady = true;
}

/** Single-click history entry and open the preview panel. */
export async function ensureHistoryPreviewOpen(ctx: DemoActionContext): Promise<void> {
  await ensureHealthExecutedWithHistory(ctx);
  if (_lesson8PreviewOpen && document.querySelector(GQL.HISTORY_PREVIEW)) return;
  await ctx.click(GQL.HISTORY_ENTRY);
  await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
  await ctx.delay(400);
  _lesson8PreviewOpen = true;
}

/** Load history entry into editor without executing. */
export async function ensureHistoryLoadedToEditor(ctx: DemoActionContext): Promise<void> {
  await ensureHistoryPreviewOpen(ctx);
  if (_lesson8Loaded && getGqlEditorQuery().includes('health')) return;
  await ctx.click(GQL.HISTORY_LOAD);
  await ctx.delay(800);
  _lesson8Loaded = true;
}

/** Run history entry — loads query and executes immediately. */
export async function ensureHistoryRunExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureHistoryPreviewOpen(ctx);
  if (!document.querySelector(GQL.HISTORY_PREVIEW)) {
    await openHistoryPanel(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
  }
  if (_lesson8Run && document.querySelector(GQL.RESPONSE_VIEWER)) return;
  await ctx.click(GQL.HISTORY_RUN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
  _lesson8Run = true;
}

/** Ensure at least one collection exists in the Collections panel. */
export async function ensureDemoCollectionExists(ctx: DemoActionContext): Promise<void> {
  await openCollectionsPanel(ctx);
  if (!document.querySelector(GQL.COL_NODE)) {
    await ctx.click(GQL.COLLECTIONS_NEW);
    await ctx.waitFor(GQL.COL_NODE, 5000);
    await ctx.delay(500);
  }
}

/** Save the selected history entry to a collection via the modal. */
export async function ensureSavedToCollectionFromHistory(ctx: DemoActionContext): Promise<void> {
  await ensureDemoCollectionExists(ctx);
  await ensureHistoryPreviewOpen(ctx);
  if (_lesson8Saved && document.querySelector(GQL.COL_ITEM)) return;

  if (!document.querySelector(GQL.HISTORY_PREVIEW)) {
    await openHistoryPanel(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
  }

  await ctx.click(GQL.HISTORY_SAVE_TO_COL);
  await ctx.waitFor(GQL.SAVE_COL_MODAL, 5000);
  await ctx.delay(600);

  if (document.querySelector('.gql-save-col-empty')) {
    await ctx.click(GQL.SAVE_COL_CANCEL);
    await ensureDemoCollectionExists(ctx);
    await openHistoryPanel(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
    await ctx.click(GQL.HISTORY_SAVE_TO_COL);
    await ctx.waitFor(GQL.SAVE_COL_MODAL, 5000);
    await ctx.delay(600);
  }

  await ctx.fill(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
  await ctx.delay(400);
  await ctx.click(GQL.SAVE_COL_SAVE);
  await ctx.delay(800);

  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
  await ctx.waitFor(GQL.COL_ITEM, 8000);
  _lesson8Saved = true;
}

/** Rename the saved collection item via context menu. */
export async function ensureCollectionItemRenamed(ctx: DemoActionContext): Promise<void> {
  await ensureSavedToCollectionFromHistory(ctx);
  const itemName = document.querySelector('.gql-col-item-name')?.textContent?.trim();
  if (_lesson8Renamed && itemName === LESSON8_ITEM_RENAME) return;

  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
  await openFirstCollectionItemContextMenu(ctx);
  await clickContextMenuItem(ctx, 'Rename');
  await ctx.waitFor(GQL.COL_ITEM_RENAME, 5000);
  await ctx.fill(GQL.COL_ITEM_RENAME, LESSON8_ITEM_RENAME);
  await ctx.delay(300);
  const input = document.querySelector<HTMLInputElement>(GQL.COL_ITEM_RENAME);
  input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await ctx.delay(600);
  _lesson8Renamed = true;
}

/** Import collections JSON (after delete) to restore the saved operation. */
export async function ensureCollectionRestoredViaImport(ctx: DemoActionContext): Promise<void> {
  await ensureCollectionItemRenamed(ctx);
  if (_lesson8Restored && document.querySelector(GQL.COL_ITEM)) return;

  await openCollectionsPanel(ctx);
  await openCollectionHeaderContextMenu(ctx);
  await clickContextMenuItem(ctx, 'Delete');
  await ctx.delay(800);

  await ctx.click(GQL.COLLECTIONS_IMPORT);
  await ctx.delay(300);
  injectCollectionsImportFile(buildLesson8ImportPayload());
  await ctx.waitFor(GQL.IMPORT_MODE_DIALOG, 8000);
  await ctx.click(GQL.IMPORT_MODE_MERGE);
  await ctx.delay(1000);
  await expandFirstCollection(ctx);
  await ctx.waitFor(GQL.COL_ITEM, 8000);
  _lesson8Restored = true;
}

/** Setup for Lesson 8 — clean editor, close activity panels. */
export async function gqlCollectionsHistoryLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();

  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);

  if (document.querySelector(GQL.HISTORY_PANEL)) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.COLLECTIONS_PANEL)) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.delay(200);
  }

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await fillGqlEditor(ctx, '', { focus: false });
}

/** Cleanup for Lesson 8. */
export async function gqlCollectionsHistoryLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson8SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 9: Export & Share Queries ────────────────────────────────────────────

let _lesson9FieldsSelected = false;
let _lesson9Copied = false;
let _lesson9EditedToEditor = false;
let _lesson9Executed = false;
let _lesson9CurlCopied = false;

export function resetGqlLesson9SessionFlags(): void {
  _lesson9FieldsSelected = false;
  _lesson9Copied = false;
  _lesson9EditedToEditor = false;
  _lesson9Executed = false;
  _lesson9CurlCopied = false;
}

async function openHistoryEntryContextMenu(ctx: DemoActionContext): Promise<void> {
  const entry = document.querySelector<HTMLElement>(GQL.HISTORY_ENTRY);
  if (entry) {
    entry.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    await ctx.delay(400);
  }
}

async function clickHistoryContextMenuItem(ctx: DemoActionContext, label: string): Promise<void> {
  await ctx.waitFor(GQL.HISTORY_CONTEXT_MENU, 5000);
  const btn = Array.from(document.querySelectorAll<HTMLElement>(`${GQL.HISTORY_CONTEXT_MENU} button`))
    .find((b) => b.textContent?.includes(label));
  if (btn) {
    btn.click();
    await ctx.delay(400);
  }
}

/** Select `health` and `user` fields in Builder (with required `id` arg). */
export async function ensureBuilderHealthAndUserSelected(ctx: DemoActionContext): Promise<void> {
  await ensureBuilderMode(ctx);
  const code = getBuilderCodeText();
  if (_lesson9FieldsSelected && code.includes('health') && code.includes('user')) return;

  const healthRow = findFieldRowByName('health');
  const healthCheck = healthRow?.querySelector<HTMLElement>('.gql-qb-check');
  if (!healthCheck?.classList.contains('gql-qb-check--checked')) {
    await quietDomClick(ctx, healthCheck);
    await ctx.delay(400);
  }

  const userRow = findFieldRowByName('user');
  const expandBtn = userRow?.querySelector<HTMLElement>('.gql-qb-expand-btn');
  if (expandBtn && !expandBtn.classList.contains('gql-qb-expand-btn--open')) {
    await quietDomClick(ctx, expandBtn);
  }
  const userCheck = userRow?.querySelector<HTMLElement>('.gql-qb-check');
  const userSelected =
    userCheck?.classList.contains('gql-qb-check--checked') ||
    userCheck?.classList.contains('gql-qb-check--partial');
  if (!userSelected) {
    await quietDomClick(ctx, userCheck);
    await ctx.delay(500);
  }

  await ctx.waitFor(GQL.QB_ARG_USER_ID, 5000);
  const userId = getDemoUserAId() || 'usr-1';
  await ctx.fill(GQL.QB_ARG_USER_ID, userId);
  await ctx.delay(400);
  _lesson9FieldsSelected = true;
}

/** Copy generated SDL from Builder toolbar. */
export async function ensureBuilderSdlCopied(ctx: DemoActionContext): Promise<void> {
  await ensureBuilderHealthAndUserSelected(ctx);
  if (_lesson9Copied) return;
  await ctx.click(GQL.QB_COPY);
  await ctx.delay(1500);
  _lesson9Copied = true;
}

/** Transfer Builder SDL to Monaco via Edit in Editor. */
export async function ensureExportBuilderEditedToEditor(ctx: DemoActionContext): Promise<void> {
  await ensureBuilderHealthAndUserSelected(ctx);
  const editorActive = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)?.classList.contains('gql-mode-btn--active');
  if (_lesson9EditedToEditor && editorActive && getGqlEditorQuery().includes('health')) return;
  await ctx.click(GQL.QB_EDIT);
  await ctx.waitFor(GQL.EDITOR, 5000);
  await ctx.delay(800);
  _lesson9EditedToEditor = true;
}

/** Execute query, open History context menu, and copy as cURL. */
export async function ensureHistoryCopyAsCurl(ctx: DemoActionContext): Promise<void> {
  await ensureExportBuilderEditedToEditor(ctx);
  if (_lesson9CurlCopied) return;

  if (!_lesson9Executed) {
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(500);
    _lesson9Executed = true;
  }

  await openHistoryPanel(ctx);
  await openHistoryEntryContextMenu(ctx);
  await clickHistoryContextMenuItem(ctx, 'Copy as cURL');
  await ctx.delay(800);
  _lesson9CurlCopied = true;
}

/** Setup for Lesson 9 — clean slate, seed demo user for builder `id` arg. */
export async function gqlExportShareLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();

  await ensureEditorMode(ctx);

  if (document.querySelector(GQL.HISTORY_PANEL)) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.COLLECTIONS_PANEL)) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.delay(200);
  }

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — builder uses usr-1 fallback for user id arg
  }
}

/** Cleanup for Lesson 9. */
export async function gqlExportShareLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson9SessionFlags();
  await ensureEditorMode(ctx);
  await ctx.delay(100);
}

// ── Lesson 10: Performance Tracing ────────────────────────────────────────────

/** Query with `health` only — low complexity baseline for Lesson 10. */
export const GQL_TRACING_HEALTH_QUERY = GQL_HEALTH_QUERY;

/** Build tracing demo query with `health` + `user(id: …)` for complexity + resolver traces. */
export function buildTracingUserQuery(userId = 'usr-1'): string {
  return `query {
  health
  user(id: "${userId}") {
    id
    name
    email
  }
}`;
}

let _lesson10HealthQuery = false;
let _lesson10UserQuery = false;
let _lesson10Executed = false;
let _lesson10TracingOpen = false;
let _lesson10Hovered = false;
let _lesson10Sorted = false;
let _lesson10HistogramReady = false;

export function resetGqlLesson10SessionFlags(): void {
  _lesson10HealthQuery = false;
  _lesson10UserQuery = false;
  _lesson10Executed = false;
  _lesson10TracingOpen = false;
  _lesson10Hovered = false;
  _lesson10Sorted = false;
  _lesson10HistogramReady = false;
}

/** Parse the `~N` complexity badge text into a number. */
export function getComplexityBadgeScore(): number {
  const el = document.querySelector(GQL.COMPLEXITY_BADGE);
  if (!el) return 0;
  const m = el.textContent?.match(/~?(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** Ensure editor mode with introspected schema and the health-only baseline query. */
export async function ensureTracingHealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (_lesson10HealthQuery && current.trim() === GQL_TRACING_HEALTH_QUERY.trim()) {
    await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
    return;
  }
  await fillGqlEditor(ctx, GQL_TRACING_HEALTH_QUERY, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
  await ctx.delay(400);
  _lesson10HealthQuery = true;
}

/** Ensure the expanded `health` + `user` query is in the editor (complexity badge increases). */
export async function ensureTracingUserQuery(ctx: DemoActionContext): Promise<void> {
  await ensureTracingHealthQuery(ctx);
  const userId = getDemoUserAId() || 'usr-1';
  const target = buildTracingUserQuery(userId);
  const current = getGqlEditorQuery();
  if (_lesson10UserQuery && current.includes('user(id:') && current.includes('health')) return;
  await fillGqlEditor(ctx, target, { focus: false });
  await ctx.waitFor(GQL.COMPLEXITY_BADGE, 5000);
  await ctx.delay(400);
  _lesson10UserQuery = true;
}

/** Execute the tracing query and wait for response + tracing badge. */
export async function ensureTracingExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureTracingUserQuery(ctx);
  if (_lesson10Executed && document.querySelector(GQL.RV_TRACING_BADGE)) return;
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.waitFor(GQL.RV_TRACING_BADGE, 15000);
  await ctx.delay(500);
  _lesson10Executed = true;
}

/** Open the Apollo Tracing waterfall view in the response viewer. */
export async function ensureTracingViewOpen(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  if (_lesson10TracingOpen && document.querySelector(GQL.TRACE_VIEW)) return;
  const badge = document.querySelector<HTMLElement>(GQL.RV_TRACING_BADGE);
  if (badge) {
    await ctx.click(GQL.RV_TRACING_BADGE);
  } else {
    await ctx.click(GQL.RV_TAB_TRACING);
  }
  await ctx.waitFor(GQL.TRACE_VIEW, 5000);
  await ctx.delay(800);
  _lesson10TracingOpen = true;
}

/** Hover the first resolver row to reveal the duration tooltip on the Gantt bar. */
export async function ensureTracingResolverHovered(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  if (_lesson10Hovered) return;
  const row = document.querySelector<HTMLElement>(GQL.TRACE_RESOLVER_ROW);
  const bar = row?.querySelector<HTMLElement>('.gql-trace-bar');
  if (bar) {
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await ctx.delay(800);
  }
  _lesson10Hovered = true;
}

/** Sort resolver rows by duration (slowest first). */
export async function ensureTracingSortedByDuration(ctx: DemoActionContext): Promise<void> {
  await ensureTracingViewOpen(ctx);
  if (_lesson10Sorted) return;
  await ctx.click(GQL.TRACE_SORT_DURATION);
  await ctx.delay(800);
  _lesson10Sorted = true;
}

/** Run additional executions until the latency histogram strip appears (≥2 samples). */
export async function ensureLatencyHistogramVisible(ctx: DemoActionContext): Promise<void> {
  await ensureTracingExecuted(ctx);
  if (_lesson10HistogramReady && document.querySelector(GQL.HISTOGRAM_STRIP)) return;

  let attempts = 0;
  while (!document.querySelector(GQL.HISTOGRAM_STRIP) && attempts < 3) {
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(500);
    attempts++;
  }
  await ctx.waitFor(GQL.HISTOGRAM_STRIP, 5000);
  await ctx.delay(800);
  _lesson10HistogramReady = true;
}

/** Setup for Lesson 10 — clean slate, seed demo user for `user(id: …)` arg. */
export async function gqlPerformanceTracingLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();

  await ensureEditorMode(ctx);

  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.HISTORY_PANEL)) {
    await ctx.click(GQL.ACTIVITY_HISTORY);
    await ctx.delay(200);
  }
  if (document.querySelector(GQL.COLLECTIONS_PANEL)) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.delay(200);
  }

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — tracing query uses usr-1 fallback
  }
}

/** Cleanup for Lesson 10. */
export async function gqlPerformanceTracingLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson10SessionFlags();
  await ensureEditorMode(ctx);
  await ctx.delay(100);
}

// ── Lesson 11: Workflow Integration ───────────────────────────────────────────

export const LESSON11_WF_NAME = 'GraphQL Latency Demo';
export const LESSON11_LATENCY_VAR = 'gqlLatency';
export const LESSON11_HEALTH_QUERY = 'query { health }';

let _lesson11Created = false;
let _lesson11QueryAdded = false;
let _lesson11QueryConfigured = false;
let _lesson11AssertAdded = false;
let _lesson11AssertConfigured = false;
let _lesson11AssertThreshold = '';
let _lesson11PassRun = false;
let _lesson11FailRun = false;

export function resetGqlLesson11SessionFlags(): void {
  _lesson11Created = false;
  _lesson11QueryAdded = false;
  _lesson11QueryConfigured = false;
  _lesson11AssertAdded = false;
  _lesson11AssertConfigured = false;
  _lesson11AssertThreshold = '';
  _lesson11PassRun = false;
  _lesson11FailRun = false;
}

async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) {
    skipBtn.click();
    await ctx.delay(300);
  }
}

function wfNodeIdFromTestId(testIdSelector: string): string | null {
  const inner = document.querySelector(testIdSelector);
  const rfNode = inner?.closest('.react-flow__node');
  return rfNode?.getAttribute('data-id') ?? null;
}

async function openWfNodeConfig(ctx: DemoActionContext, testIdSelector: string): Promise<void> {
  const nodeId = wfNodeIdFromTestId(testIdSelector);
  const openConfig = (window as unknown as Record<string, unknown>).__wfOpenNodeConfig as
    | ((id: string) => void)
    | undefined;
  if (nodeId && openConfig) {
    openConfig(nodeId);
  } else {
    const deselectAll = (window as unknown as Record<string, unknown>).__wfDeselectAll as (() => void) | undefined;
    deselectAll?.();
    const node = document.querySelector<HTMLElement>(testIdSelector);
    node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }
  await ctx.delay(400);
}

function connectWfNodes(
  sourceSelector: string,
  targetSelector: string,
  sourceHandle: string | null = null,
): boolean {
  const sourceEl = document.querySelector(sourceSelector);
  const targetEl = document.querySelector(targetSelector);
  const sourceId = sourceEl?.getAttribute('data-id') ?? sourceEl?.closest('.react-flow__node')?.getAttribute('data-id');
  const targetId = targetEl?.getAttribute('data-id') ?? targetEl?.closest('.react-flow__node')?.getAttribute('data-id');
  const wfConnect = (window as unknown as Record<string, unknown>).__wfConnect as
    | ((s: string, t: string, sh: string | null, th: string | null) => void)
    | undefined;
  if (sourceId && targetId && wfConnect) {
    wfConnect(sourceId, targetId, sourceHandle, null);
    return true;
  }
  return false;
}

async function clickWfFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>('button[title="Fit view"]');
  if (btn) {
    btn.click();
    await ctx.delay(500);
  }
}

async function clickWfConfigTab(
  ctx: DemoActionContext,
  panelSelector: string,
  tabLabel: string,
): Promise<void> {
  const panel = document.querySelector(panelSelector);
  const tab = Array.from(panel?.querySelectorAll<HTMLElement>('.wf-config-tab') ?? [])
    .find((b) => b.textContent?.trim().startsWith(tabLabel));
  if (tab) tab.click();
  await ctx.delay(400);
}

async function saveWfConfigModal(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WF.CFG_SAVE);
  await ctx.delay(400);
}

async function closeWfConfigModalQuiet(ctx: DemoActionContext): Promise<void> {
  const close = document.querySelector<HTMLElement>(WF.CFG_CLOSE);
  if (close) {
    close.click();
    await ctx.delay(200);
  }
}

/** Create a blank workflow for Lesson 11. */
export async function ensureLesson11WorkflowCreated(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);

  if (_lesson11Created && document.querySelector(WF.CANVAS)) return;

  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.delay(400);
  await ctx.click(WF.NEW_BLANK_ITEM);
  await ctx.delay(400);
  await ctx.fill(WF.CREATE_INPUT, LESSON11_WF_NAME);
  await ctx.delay(200);
  await ctx.click(WF.CREATE_OK);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(800);
  _lesson11Created = true;
}

/** Add a GraphQL Query node and wire Start → Query. */
export async function ensureLesson11QueryNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowCreated(ctx);
  if (_lesson11QueryAdded && document.querySelector(GQL.WF_CANVAS_QUERY_NODE)) return;

  const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_QUERY);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.click(WF.PAL_GQL_QUERY);
  await ctx.delay(600);
  connectWfNodes(WF.NODE_START, WF.NODE_GQL_QUERY, 'out');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11QueryAdded = true;
}

/** Configure query endpoint, health query, and latencyMs output binding. */
export async function ensureLesson11QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryNodeAdded(ctx);
  if (_lesson11QueryConfigured) return;

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_QUERY_NODE);
  await ctx.waitFor(GQL.WF_QUERY_PANEL, 5000);
  await ctx.fill(WF.WF_GQL_ENDPOINT, GQL_DEMO_HTTP);
  await ctx.delay(300);
  await ctx.fill(GQL.WF_QUERY_EDITOR, LESSON11_HEALTH_QUERY);
  await ctx.delay(300);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await ctx.click(GQL.WF_OUTPUT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.selectOption(GQL.WF_OUTPUT_FIELD_SELECT, 'latencyMs');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson11QueryConfigured = true;
}

/** Add GraphQL Assert node and wire Query → Assert → End. */
export async function ensureLesson11AssertNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryConfigured(ctx);
  if (_lesson11AssertAdded && document.querySelector(GQL.WF_CANVAS_ASSERT_NODE)) return;

  const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_ASSERT);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.click(WF.PAL_GQL_ASSERT);
  await ctx.delay(600);
  connectWfNodes(WF.NODE_GQL_QUERY, WF.NODE_GQL_ASSERT);
  connectWfNodes(WF.NODE_GQL_ASSERT, WF.NODE_END);
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11AssertAdded = true;
}

/** Set assert source variable to the query latency output binding. */
export async function ensureLesson11AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertNodeAdded(ctx);

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_ASSERT_NODE);
  await ctx.waitFor(GQL.WF_ASSERT_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await ctx.fill(WF.WF_GQL_ASSERT_SOURCE, LESSON11_LATENCY_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
}

/** Configure latency assertion (jsonPath `$`, operator `less_than`, threshold ms). */
export async function ensureLesson11AssertRuleConfigured(
  ctx: DemoActionContext,
  thresholdMs = '500',
): Promise<void> {
  await ensureLesson11AssertSourceConfigured(ctx);
  if (_lesson11AssertConfigured && _lesson11AssertThreshold === thresholdMs) return;

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_ASSERT_NODE);
  await ctx.waitFor(GQL.WF_ASSERT_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await ctx.click(GQL.WF_ASSERT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.fill(GQL.WF_ASSERT_JSONPATH, '$');
  await ctx.delay(200);
  await ctx.selectOption(GQL.WF_ASSERT_OPERATOR, 'less_than');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_EXPECTED, thresholdMs);
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_DESCRIPTION, `Latency under ${thresholdMs}ms`);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson11AssertThreshold = thresholdMs;
  _lesson11AssertConfigured = true;
  if (thresholdMs !== '500') {
    _lesson11PassRun = false;
    _lesson11FailRun = false;
  }
}

/** Run Quick Test and wait for execution summary. */
export async function ensureLesson11WorkflowPassRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '500');
  if (_lesson11PassRun && document.querySelector(`${GQL.WF_CANVAS_QUERY_NODE}.wf-node-pass`)) return;

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson11PassRun = true;
}

/** Tighten assertion to fail, re-run Quick Test. */
export async function ensureLesson11WorkflowFailRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowPassRun(ctx);
  if (_lesson11FailRun && document.querySelector(`${GQL.WF_CANVAS_ASSERT_NODE}.wf-node-fail`)) return;

  await ensureLesson11AssertRuleConfigured(ctx, '1');
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson11FailRun = true;
}

/** Setup for Lesson 11 — remove stale demo workflow. */
export async function gqlWorkflowIntegrationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson11SessionFlags();
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  if (wfDelete) {
    wfDelete(LESSON11_WF_NAME);
    await ctx.delay(300);
  }
  await closeWfConfigModalQuiet(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
}

/** Cleanup for Lesson 11. */
export async function gqlWorkflowIntegrationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalQuiet(ctx);
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  wfDelete?.(LESSON11_WF_NAME);
  resetGqlLesson11SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 12: Schema Diff ─────────────────────────────────────────────────────

/** Label on the seeded prior-release snapshot (compare-to-current shows real diffs). */
export const LESSON12_BASELINE_LABEL = 'Prior release (demo)';

/**
 * Older SDL variant for the Docker test server — extra `Query.users`, no `User.email`.
 * Compared to the live introspected schema this yields BREAKING + SAFE rows.
 */
export const LESSON12_BASELINE_SDL = `
  type Query {
    health: String
    user(id: ID!): User
    users: [User!]!
  }

  type User {
    id: ID!
    name: String!
  }

  input OrderInput {
    customerId: ID!
    items: [String!]
  }

  type Order {
    id: ID!
    status: OrderStatusEnum!
    customerId: ID!
  }

  enum OrderStatusEnum {
    PENDING
    PROCESSING
    COMPLETE
  }

  type OrderStatus {
    status: OrderStatusEnum!
    updatedAt: String!
  }

  type Mutation {
    createOrder(input: OrderInput!): Order!
    createUser(name: String!, email: String!): User!
    deleteUser(id: ID!): DeleteResult!
  }

  type DeleteResult {
    success: Boolean!
  }

  type Subscription {
    orderStatus(orderId: ID!): OrderStatus!
  }
`;

let _lesson12StartTime = 0;
let _lesson12BaselineId = '';
let _lesson12SnapshotSaved = false;
let _lesson12ChangelogOpen = false;
let _lesson12DiffOpen = false;
let _lesson12FiltersDemoed = false;
let _lesson12Exported = false;

export function resetGqlLesson12SessionFlags(): void {
  _lesson12StartTime = 0;
  _lesson12BaselineId = '';
  _lesson12SnapshotSaved = false;
  _lesson12ChangelogOpen = false;
  _lesson12DiffOpen = false;
  _lesson12FiltersDemoed = false;
  _lesson12Exported = false;
}

function findBaselineChangelogRow(): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>(GQL.CHANGELOG_ROW);
  for (const row of rows) {
    if (row.textContent?.includes(LESSON12_BASELINE_LABEL)) return row;
  }
  return rows[0] ?? null;
}

/** Seed a prior-release snapshot in IDB (silent setup — UI refreshes after step 1 save). */
export async function ensureLesson12BaselineSnapshot(): Promise<void> {
  if (_lesson12BaselineId) return;
  const { loadSnapshots, saveSnapshot } = await import(
    '../../../graphql/utils/schemaSnapshot'
  );
  const existing = await loadSnapshots(GQL_DEMO_HTTP);
  const found = existing.find((s) => s.label === LESSON12_BASELINE_LABEL);
  if (found) {
    _lesson12BaselineId = found.id;
    return;
  }
  const id = crypto.randomUUID();
  await saveSnapshot({
    id,
    connectionId: GQL_DEMO_HTTP,
    sdl: LESSON12_BASELINE_SDL,
    typesCount: 10,
    capturedAt: Date.now() - 7 * 86_400_000,
    label: LESSON12_BASELINE_LABEL,
  });
  _lesson12BaselineId = id;
}

/** Open Schema Explorer on the Types tab (Save snapshot lives here). */
export async function ensureLesson12TypesTab(ctx: DemoActionContext): Promise<void> {
  await ensureSchemaExplorerOpen(ctx);
  const typesTab = document.querySelector<HTMLElement>('[data-testid="gql-se-tab-types"]');
  if (typesTab && !typesTab.classList.contains('gql-se-main-tab--active')) {
    await ctx.click('[data-testid="gql-se-tab-types"]');
    await ctx.delay(400);
  }
}

/** Click Save snapshot — persists current introspected SDL. */
export async function ensureLesson12SnapshotSaved(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12TypesTab(ctx);
  if (_lesson12SnapshotSaved && document.querySelectorAll(GQL.CHANGELOG_ROW).length >= 1) {
    return;
  }
  await ctx.waitFor(GQL.SAVE_SNAPSHOT_BTN, 5000);
  await ctx.click(GQL.SAVE_SNAPSHOT_BTN);
  await ctx.delay(700);
  _lesson12SnapshotSaved = true;
}

/** Open the Changelog tab with at least one snapshot row visible. */
export async function ensureLesson12ChangelogOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12SnapshotSaved(ctx);
  if (_lesson12ChangelogOpen && document.querySelector(GQL.CHANGELOG_PANEL)) return;
  await ctx.click(GQL.CHANGELOG_TAB);
  await ctx.waitFor(GQL.CHANGELOG_PANEL, 5000);
  await ctx.waitFor(GQL.CHANGELOG_ROW, 5000);
  await ctx.delay(800);
  _lesson12ChangelogOpen = true;
}

/** Open diff modal — baseline snapshot vs current schema. */
export async function ensureLesson12DiffOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12ChangelogOpen(ctx);
  if (_lesson12DiffOpen && document.querySelector(GQL.DIFF_MODAL)) return;
  const row = findBaselineChangelogRow();
  if (row) {
    row.setAttribute('data-lesson-target', 'baseline');
    await ctx.click('[data-lesson-target="baseline"] [data-testid="gql-changelog-diff-btn"]');
  } else {
    await ctx.click(GQL.CHANGELOG_DIFF_BTN);
  }
  await ctx.waitFor(GQL.DIFF_MODAL, 5000);
  await ctx.delay(800);
  _lesson12DiffOpen = true;
}

/** Cycle severity filters in the diff modal (breaking → safe → deprecated). */
export async function ensureLesson12DiffFilters(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12FiltersDemoed) return;
  await ctx.click(GQL.DIFF_FILTER_BREAKING);
  await ctx.delay(600);
  await ctx.click(GQL.DIFF_FILTER_SAFE);
  await ctx.delay(600);
  await ctx.click(GQL.DIFF_FILTER_DEPRECATED);
  await ctx.delay(600);
  _lesson12FiltersDemoed = true;
}

/** Click Export diff as JSON in the diff modal footer. */
export async function ensureLesson12DiffExported(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12Exported) return;
  await ctx.waitFor(GQL.DIFF_EXPORT_JSON, 5000);
  await ctx.click(GQL.DIFF_EXPORT_JSON);
  await ctx.delay(700);
  _lesson12Exported = true;
}

async function cleanupLesson12Snapshots(): Promise<void> {
  try {
    const { loadSnapshots, deleteSnapshot } = await import(
      '../../../graphql/utils/schemaSnapshot'
    );
    const snaps = await loadSnapshots(GQL_DEMO_HTTP);
    for (const s of snaps) {
      const isBaseline = s.id === _lesson12BaselineId || s.label === LESSON12_BASELINE_LABEL;
      const isLessonCapture = _lesson12StartTime > 0 && s.capturedAt >= _lesson12StartTime;
      if (isBaseline || isLessonCapture) {
        await deleteSnapshot(s.id);
      }
    }
  } catch {
    // IDB unavailable in tests — ignore
  }
}

/** Setup for Lesson 12 — introspect Docker server and seed prior-release baseline. */
export async function gqlSchemaDiffLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();
  resetGqlLesson11SessionFlags();
  resetGqlLesson12SessionFlags();
  _lesson12StartTime = Date.now();

  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await ensureLesson12BaselineSnapshot();
}

/** Cleanup for Lesson 12 — remove seeded and lesson-captured snapshots. */
export async function gqlSchemaDiffLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await cleanupLesson12Snapshots();
  resetGqlLesson12SessionFlags();
  await ctx.delay(100);
}

// ── Lesson 13: Mock Server ───────────────────────────────────────────────────

/** Desktop mock endpoint proxied by the Tauri app. */
export const GQL_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
/** Fixed resolver value used in the lesson so restore-vs-live is obvious. */
export const LESSON13_HEALTH_OVERRIDE = 'mock-ok';

let _lesson13MockOpen = false;
let _lesson13MockEnabled = false;
let _lesson13MockIntrospected = false;
let _lesson13OverrideSet = false;
let _lesson13Executed = false;
let _lesson13LatencySet = false;
let _lesson13Restored = false;

export function resetGqlLesson13SessionFlags(): void {
  _lesson13MockOpen = false;
  _lesson13MockEnabled = false;
  _lesson13MockIntrospected = false;
  _lesson13OverrideSet = false;
  _lesson13Executed = false;
  _lesson13LatencySet = false;
  _lesson13Restored = false;
}

function mockToggleChecked(): boolean {
  return document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)?.checked ?? false;
}

function responseLatencyMs(): number {
  const text = document.querySelector(GQL.RESPONSE_LATENCY)?.textContent ?? '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function findMockTypeGroup(typeName: string): HTMLElement | null {
  const groups = document.querySelectorAll<HTMLElement>(GQL.MOCK_TYPE_GROUP);
  for (const group of groups) {
    const header = group.querySelector<HTMLElement>(GQL.MOCK_TYPE_HEADER);
    if (header?.textContent?.includes(typeName)) return group;
  }
  return null;
}

function findMockFieldRow(typeName: string, fieldName: string): HTMLElement | null {
  const group = findMockTypeGroup(typeName);
  if (!group) return null;
  const rows = group.querySelectorAll<HTMLElement>(GQL.MOCK_FIELD_ROW);
  for (const row of rows) {
    if (row.textContent?.includes(fieldName)) return row;
  }
  return null;
}

/** Open the Mock activity panel. Desktop only; web shows a guard banner. */
export async function ensureLesson13MockPanelOpen(ctx: DemoActionContext): Promise<void> {
  if (_lesson13MockOpen && (document.querySelector(GQL.MOCK_PANEL) || document.querySelector(GQL.MOCK_GUARD))) {
    return;
  }
  await ctx.click(GQL.ACTIVITY_MOCK);
  await ctx.waitFor(`${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`, 5000);
  await ctx.delay(700);
  _lesson13MockOpen = true;
}

/** Enable mock mode using the current introspected Docker SDL as the source schema. */
export async function ensureLesson13MockEnabled(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  if (_lesson13MockEnabled && mockToggleChecked()) return;
  await ctx.waitFor(GQL.MOCK_TOGGLE, 5000);
  if (!mockToggleChecked()) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }
  _lesson13MockEnabled = true;
}

/** Switch the connection bar to the mock URL and introspect the mock endpoint. */
export async function ensureLesson13MockEndpointIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEnabled(ctx);
  if (_lesson13MockIntrospected && (getEndpointInput()?.value ?? '').trim() === GQL_MOCK_HTTP) return;
  await ctx.fill(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
  await ctx.delay(500);
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await ctx.delay(800);
  _lesson13MockIntrospected = true;
}

/** Expand `Query`, set `health` resolver to Fixed, and store `"mock-ok"` as the value. */
export async function ensureLesson13HealthOverrideConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  await ensureLesson13MockEnabled(ctx);
  if (_lesson13OverrideSet) return;

  const queryGroup = findMockTypeGroup('Query');
  if (queryGroup) {
    queryGroup.setAttribute('data-lesson-target', 'mock-query');
    const existingRow = findMockFieldRow('Query', 'health');
    if (!existingRow) {
      await ctx.click('[data-lesson-target="mock-query"] [data-testid="gql-mock-type-header"]');
      await ctx.delay(700);
    }
  }

  const healthRow = findMockFieldRow('Query', 'health');
  if (healthRow) {
    healthRow.setAttribute('data-lesson-target', 'mock-health');
    await ctx.selectOption('[data-lesson-target="mock-health"] [data-testid="gql-mock-resolver-select"]', 'fixed');
    await ctx.waitFor('[data-lesson-target="mock-health"] [data-testid="gql-mock-fixed-input"]', 5000);
    await ctx.fill('[data-lesson-target="mock-health"] [data-testid="gql-mock-fixed-input"]', `"${LESSON13_HEALTH_OVERRIDE}"`);
    const input = healthRow.querySelector<HTMLInputElement>(GQL.MOCK_FIXED_INPUT);
    input?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await ctx.delay(800);
  }

  _lesson13OverrideSet = true;
}

/** Execute `query { health }` against the mock endpoint and verify the overridden value. */
export async function ensureLesson13MockExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEndpointIntrospected(ctx);
  await ensureLesson13HealthOverrideConfigured(ctx);
  const current = getGqlEditorQuery();
  if (!_lesson13Executed || !responseBodyText().includes(LESSON13_HEALTH_OVERRIDE) || current.trim() !== GQL_HEALTH_QUERY.trim()) {
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(800);
  }
  _lesson13Executed = true;
}

/** Raise mock latency, re-run, and wait for the response metadata latency to reflect the delay. */
export async function ensureLesson13LatencyDemo(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (_lesson13LatencySet && responseLatencyMs() >= 500) return;

  const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER);
  if (slider) {
    slider.value = '650';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(700);
  }

  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(800);
  _lesson13LatencySet = true;
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13MockDisabledAndRestored(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencyDemo(ctx);
  if (_lesson13Restored && responseBodyText().includes('"ok"')) return;

  await ensureLesson13MockPanelOpen(ctx);
  if (mockToggleChecked()) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }

  await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await ctx.delay(500);
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(800);
  _lesson13Restored = true;
}

/** Setup for Lesson 13 — start from the live Docker endpoint with a fresh GraphQL studio state. */
export async function gqlMockServerLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();
  resetGqlLesson11SessionFlags();
  resetGqlLesson12SessionFlags();
  resetGqlLesson13SessionFlags();

  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 13 — disable mock if needed and restore the live endpoint. */
export async function gqlMockServerLessonCleanup(ctx: DemoActionContext): Promise<void> {
  try {
    if (document.querySelector(GQL.ACTIVITY_MOCK)) {
      await ensureLesson13MockPanelOpen(ctx);
      if (mockToggleChecked()) {
        await ctx.click(GQL.MOCK_TOGGLE);
        await ctx.delay(300);
      }
    }
  } catch {
    // Non-fatal in tests or if the panel is unavailable.
  }
  const input = getEndpointInput();
  if (input && input.value.trim() !== GQL_DEMO_HTTP) {
    await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
    await ctx.delay(200);
  }
  resetGqlLesson13SessionFlags();
  await ctx.delay(100);
}
