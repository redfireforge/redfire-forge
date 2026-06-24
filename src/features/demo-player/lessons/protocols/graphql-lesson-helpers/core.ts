/** Shared helpers for GraphQL Studio demo lessons (Monaco fill, preAction guards). */
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  ensureGqlDemoHeaderContext,
  navigateToGraphqlStudio,
} from '../../env-manager-lesson-helpers';
import { resetLesson2VariablesHistoryFlags } from './lesson2-variables-history';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import { loadDemoSession } from '../../../../graphql/utils/gqlDemoWorkspace';

/** HTTP GraphQL endpoint for the Docker test server (port 4010). */
export const GQL_DEMO_HTTP = 'http://localhost:4010/graphql';
/** Template variable resolved from Environment Manager GraphQL tab. */
export const GQL_DEMO_VAR = '{{graphqlUrl}}';
/** Health probe URL for PrerequisiteGate. */
export const GQL_DEMO_HEALTH = 'http://localhost:4010/health';
/**
 * Tabs setup may visit (Environment Manager for demo env seeding).
 * Include on every GraphQL Studio lesson so useDemoShortcuts does not auto-exit live demo.
 */
export const GQL_STUDIO_LESSON_ALLOWED_TABS = ['environments', 'graphql-studio'];
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
  resetLesson2VariablesHistoryFlags();
}

export function getDemoUserAId(): string {
  return _userAId;
}

export function getDemoUserBId(): string {
  return _userBId;
}

/** Options for preAction execute guards — history steps must not refocus the Response pane. */
export interface GqlExecuteGuardOpts {
  /** When true, skip Response tab clicks and avoid re-opening Variables (for History sidebar steps). */
  skipResponseFocus?: boolean;
}

/** True after Alice and Bob GetUser runs completed in the studio (Lesson 2). */
export function areLesson2StudioExecutionsDone(): boolean {
  return _varAExecuted && _varBExecuted;
}

export function getEndpointInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT);
}

/** Fill the connection bar endpoint and blur so React persists the value on the active tab. */
export async function fillActiveTabEndpoint(ctx: DemoActionContext, url: string): Promise<void> {
  await ctx.fill(GQL.ENDPOINT_INPUT, url);
  getEndpointInput()?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await ctx.delay(400);
}

/**
 * Clear per-tab endpoint override on the active tab (reset → inherit page default).
 * No-op when the reset control is absent (single-tab page-default mode).
 */
export async function clearActiveTabEndpointOverride(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ENDPOINT_RESET_BTN)) return;
  await ctx.click(GQL.ENDPOINT_RESET_BTN);
  await ctx.delay(400);
}

/**
 * Demo tab should use page `{{graphqlUrl}}` without storing a per-tab override
 * (required when the user already has tabs open — §11.0).
 */
export async function configureDemoTabInheritPageDefault(ctx: DemoActionContext): Promise<void> {
  const session = await loadDemoSession();
  if (session?.demoTabId) {
    await ctx.waitFor(GQL.tab(session.demoTabId), 10_000);
    const demoTabSel = GQL.tab(session.demoTabId);
    const demoTabEl = document.querySelector(demoTabSel);
    if (demoTabEl?.getAttribute('aria-selected') !== 'true') {
      await ctx.click(demoTabSel);
      await ctx.delay(400);
    }
  }
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  // Wait for the demo tab to appear in the tab bar so endpoint edits stay tab-scoped (§11.0).
  const tabBarSel = `${GQL.TAB_BAR} [role="tab"]`;
  for (let i = 0; i < 20; i++) {
    if (document.querySelectorAll(tabBarSel).length >= 2) break;
    await ctx.delay(100);
  }
  await ctx.delay(400);
  const v = (getEndpointInput()?.value ?? '').trim();
  if (v !== GQL_DEMO_VAR) {
    await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
  }
  await clearActiveTabEndpointOverride(ctx);
}

/** Demo tab explicit per-tab URL override (mutations server, mock, TLS, schema literal URL). */
export async function configureDemoTabEndpointOverride(
  ctx: DemoActionContext,
  url: string,
): Promise<void> {
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  const trimmed = url.trim();
  if ((getEndpointInput()?.value ?? '').trim() !== trimmed) {
    await fillActiveTabEndpoint(ctx, trimmed);
  }
}

/** True when the bottom Auth tab is the active bottom-panel tab (Slice 7.3+). */
export function isAuthEditorOpen(): boolean {
  const authTab = document.querySelector(GQL.BOTTOM_TAB_AUTH);
  return authTab?.getAttribute('aria-selected') === 'true';
}

/** Open the bottom Auth panel when it is not already visible. */
export async function openAuthPanelQuiet(ctx: DemoActionContext): Promise<void> {
  if (isAuthEditorOpen()) return;
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await ctx.click(GQL.AUTH_BADGE_BTN);
  await ctx.waitFor(GQL.AUTH_PANEL, 5000);
  await ctx.delay(400);
}

/** Leave the Auth panel by switching back to Variables. */
export async function closeAuthPanelQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isAuthEditorOpen()) return;
  const authTab = document.querySelector(GQL.BOTTOM_TAB_AUTH);
  if (authTab?.getAttribute('aria-selected') === 'true') {
    await ctx.click(GQL.BOTTOM_TAB_VARS);
  }
  await ctx.delay(300);
}

export type GqlAuthPanelType = 'bearer' | 'apiKey' | 'basic' | 'oauth2' | 'inherit' | 'none';

async function waitForAuthTypeFields(
  ctx: DemoActionContext,
  type: GqlAuthPanelType,
): Promise<void> {
  switch (type) {
    case 'bearer':
      await ctx.waitFor(GQL.AUTH_BEARER_INPUT, 5000);
      break;
    case 'apiKey':
      await ctx.waitFor(GQL.AUTH_APIKEY_NAME, 5000);
      break;
    case 'basic':
      await ctx.waitFor(GQL.AUTH_BASIC_USER, 5000);
      break;
    case 'oauth2':
      await ctx.waitFor(GQL.AUTH_OAUTH_TOKEN_URL, 5000);
      break;
    case 'inherit':
      await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 5000);
      break;
    default:
      break;
  }
}

/** Open the bottom Auth panel (visible lesson actions). */
export async function openAuthPanel(ctx: DemoActionContext): Promise<void> {
  await openAuthPanelQuiet(ctx);
}

/** Switch away from the Auth bottom tab when it is active. */
export async function closeAuthPanelIfOpen(ctx: DemoActionContext): Promise<void> {
  await closeAuthPanelQuiet(ctx);
}

/** Open the Auth panel and select an auth type in the bottom editor. */
export async function selectAuthInPanel(
  ctx: DemoActionContext,
  type: GqlAuthPanelType,
): Promise<void> {
  await openAuthPanel(ctx);
  await ctx.waitFor(GQL.AUTH_TYPE_SELECT, 5000);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, type);
  await ctx.delay(400);
  await waitForAuthTypeFields(ctx, type);
}

/** Explicit No Auth — stored as `null` on the tab (multi-tab) or page default (single tab). */
export async function selectNoAuthInPanel(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'none');
}

/**
 * Clear a per-tab auth override (Reset to inherit workspace) when the control is available.
 * No-op when the active tab already inherits workspace auth.
 */
export async function clearActiveTabAuthOverride(ctx: DemoActionContext): Promise<void> {
  await openAuthPanelQuiet(ctx);
  if (!document.querySelector(GQL.AUTH_RESET_INHERIT_BTN)) {
    await closeAuthPanelQuiet(ctx);
    return;
  }
  await ctx.click(GQL.AUTH_RESET_INHERIT_BTN);
  await ctx.delay(400);
  await closeAuthPanelQuiet(ctx);
}

/**
 * Demo tab should inherit page-level auth without storing a per-tab override
 * (required when the user already has tabs open — §11.0).
 */
export async function configureDemoTabInheritPageAuth(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await clearActiveTabAuthOverride(ctx);
}

function hasSchemaBadge(): boolean {
  return !!document.querySelector(GQL.SCHEMA_BADGE_OK);
}

/** True when the schema badge shows a zero-type count — stale or failed introspection. */
export function schemaBadgeShowsEmpty(): boolean {
  const badge = document.querySelector(GQL.SCHEMA_BADGE_OK);
  if (!badge) return false;
  return /\(\s*0\s*\)/.test(badge.textContent ?? '');
}

/** True when the schema badge is present and reports a non-empty type count. */
export function hasUsableSchemaBadge(): boolean {
  return hasSchemaBadge() && !schemaBadgeShowsEmpty();
}

/** True when the Schema Explorer type list includes the root Query type. */
function schemaExplorerShowsQueryType(): boolean {
  return !!document.querySelector(GQL.SCHEMA_TYPE_QUERY);
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
  if (_varAExecuted && responseBodyText().includes('Alice')) {
    if (!opts?.skipResponseFocus) {
      await ensureResponseDataUserVisible(ctx);
    }
    return;
  }
  const varOpts = opts?.skipResponseFocus
    ? { focus: false as const, openPanel: false as const }
    : { focus: false as const };
  await fillGqlVariables(ctx, varsJsonForUser(_userAId), varOpts);
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
  _varAExecuted = true;
}

/** Ensure the query was re-executed with Bob's `$id` and the response shows his name. */
export async function ensureExecutedWithBob(
  ctx: DemoActionContext,
  opts?: GqlExecuteGuardOpts,
): Promise<void> {
  await ensureExecutedWithAlice(ctx, opts);
  if (_varBExecuted && responseBodyText().includes('Bob')) {
    if (!opts?.skipResponseFocus) {
      await ensureResponseDataUserVisible(ctx);
    }
    return;
  }
  const varOpts = opts?.skipResponseFocus
    ? { focus: false as const, openPanel: false as const }
    : { focus: false as const };
  await fillGqlVariables(ctx, varsJsonForUser(_userBId), varOpts);
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
  _varBExecuted = true;
}

/** Ensure the Variables panel holds Alice's `$id` JSON (Lesson 2 — set-vars step guard). */
export async function ensureAliceVarsFilled(ctx: DemoActionContext): Promise<void> {
  await ensureParamUserQuery(ctx);
  await ensureVariablesPanelOpen(ctx);
  await seedDemoUsers();
  if (_userAId && getGqlVariablesJson().includes(_userAId)) return;
  await fillGqlVariables(ctx, varsJsonForUser(_userAId), { focus: false, openPanel: false });
  await ctx.delay(400);
}

/** Ensure the Variables panel holds Bob's `$id` JSON (Lesson 2 — set-vars step guard). */
export async function ensureBobVarsFilled(ctx: DemoActionContext): Promise<void> {
  await ensureExecutedWithAlice(ctx);
  await ensureVariablesPanelOpen(ctx);
  await seedDemoUsers();
  if (_userBId && getGqlVariablesJson().includes(_userBId)) return;
  await fillGqlVariables(ctx, varsJsonForUser(_userBId), { focus: false, openPanel: false });
  await ctx.delay(400);
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

/** True when the connection bar shows a usable GraphQL demo endpoint. */
function demoEndpointLooksConfigured(): boolean {
  const v = (getEndpointInput()?.value ?? '').trim();
  // Match the template var OR the resolved http:// URL on port 4010.
  // Explicitly exclude https:// on 4010 — that's the wrong scheme.
  return v.includes('graphqlUrl') || (v.includes(':4010') && v.startsWith('http://'));
}

/** Ensure the demo endpoint is filled in the connection bar. */
export async function ensureDemoEndpoint(ctx: DemoActionContext): Promise<void> {
  await ensureGqlDemoHeaderContext(ctx);
  await navigateToGraphqlStudio(ctx);
  if (_endpointSet && demoEndpointLooksConfigured()) return;
  if (!demoEndpointLooksConfigured()) {
    await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
  }
  _endpointSet = true;
}

/** Open the Schema tab and wait until the Query type is listed. */
export async function openSchemaExplorer(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
  if (!schemaExplorerShowsQueryType()) {
    await ensureIntrospected(ctx);
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.delay(400);
  }
  await ctx.waitFor(GQL.SCHEMA_TYPE_QUERY, 15000);
  await ctx.delay(400);
}

/** Ensure schema introspection completed and the Query type is browsable. */
export async function ensureIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);

  const waitForQueryType = async (): Promise<boolean> => {
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.delay(400);
    await ctx.waitFor(GQL.SCHEMA_TYPE_QUERY, 8000);
    return schemaExplorerShowsQueryType();
  };

  // Fast-path: flag + badge both confirm schema is loaded — skip Schema-tab navigation
  if (_schemaLoaded && hasUsableSchemaBadge()) return;

  if (!hasUsableSchemaBadge()) {
    await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
    await ctx.delay(800);
  }

  if (await waitForQueryType()) {
    _schemaLoaded = true;
    return;
  }

  // Badge looked OK but explorer is still empty — re-introspect against the demo endpoint.
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
  await ctx.delay(800);
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.delay(400);
  await ctx.waitFor(GQL.SCHEMA_TYPE_QUERY, 15000);
  _schemaLoaded = hasUsableSchemaBadge() && schemaExplorerShowsQueryType();
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
  await ensureGqlDemoTab(ctx, 'gql-first-query', 'Your First GraphQL Query');
  await fillGqlEditor(ctx, 'query { }', { focus: false });
}

/** Cleanup for Lesson 1 — close demo tab and reset session flags. */
export async function gqlFirstQueryCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-first-query');
}

/** Setup for Lesson 2 — demo tab, seed Alice/Bob on the test server. */
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
  await ensureGqlDemoTab(ctx, 'gql-variables', 'Variables & Arguments');
  await configureDemoTabInheritPageDefault(ctx);
  _endpointSet = true;
  await ctx.delay(200);
  await fillGqlEditor(ctx, 'query { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });
  try {
    await seedDemoUsers();
  } catch {
    // PrerequisiteGate blocks play when Docker is down; seed retries in preAction.
  }
}

/** Cleanup for Lesson 2 — close demo tab and reset session flags. */
export async function gqlVariablesLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-variables');
}

