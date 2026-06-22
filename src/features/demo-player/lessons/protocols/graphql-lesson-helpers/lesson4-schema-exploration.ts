// ── Lesson 4: Schema Exploration ────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  getGqlEditorQuery,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

/** Minimal query template for Try → field insert demos. */
export const GQL_INSERT_TEMPLATE_QUERY = `query {
  
}`;

let _queryTypeSelected = false;
let _userTypeSelected = false;
let _tryInsertDone = false;

/** Reset Lesson 4 session flags. */
export function resetGqlLesson4SessionFlags(): void {
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
  const schemaTabSelected = () =>
    document.querySelector(GQL.RIGHT_TAB_SCHEMA)?.getAttribute('aria-selected') === 'true';
  const hasBadgeOk = () => !!document.querySelector(GQL.SCHEMA_BADGE_OK);
  const hasTypeList = () => !!document.querySelector(GQL.SCHEMA_TYPE_LIST);

  // Fast path: schema already introspected, tab already open, type list already rendered.
  // Skipping ensureIntrospected avoids the internal schema-tab click in waitForQueryType().
  if (hasBadgeOk() && schemaTabSelected() && hasTypeList()) {
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
  return;
  }

  await ensureIntrospected(ctx);

  // After ensureIntrospected, re-check whether the tab was clicked open internally.
  if (!schemaTabSelected()) {
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
    await ctx.delay(400);
  }
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
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

/** Setup for Lesson 4 (GQL-3) — demo tab with insert template query. */
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
  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(200);
  }
  await ensureGqlDemoTab(ctx, 'gql-schema-exploration', 'Schema Exploration');
  await fillGqlEditor(ctx, GQL_INSERT_TEMPLATE_QUERY, { focus: false });
}

/** Cleanup for Lesson 4 (GQL-3) — close demo tab and reset session flags. */
export async function gqlSchemaLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson4SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-schema-exploration');
}

