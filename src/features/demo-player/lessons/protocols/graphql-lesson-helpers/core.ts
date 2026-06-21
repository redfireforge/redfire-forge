/** Shared helpers for GraphQL Studio demo lessons (Monaco fill, preAction guards). */
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';

/** HTTP GraphQL endpoint for the Docker test server (port 4010). */
export const GQL_DEMO_HTTP = 'http://localhost:4010/graphql';
/** Template variable resolved from Environment Manager GraphQL tab. */
export const GQL_DEMO_VAR = '{{graphqlUrl}}';
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

export function getEndpointInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT);
}

function endpointMatchesDemo(): boolean {
  const input = getEndpointInput();
  const v = (input?.value ?? '').trim();
  return v === GQL_DEMO_HTTP || v === GQL_DEMO_VAR;
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
    await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
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

/** Ensure GraphQL editor mode is active. */
export async function ensureEditorMode(ctx: DemoActionContext): Promise<void> {
  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.delay(200);
  }
}

/** Ensure editor mode is active and the health query is loaded. */
export async function ensureHealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
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

