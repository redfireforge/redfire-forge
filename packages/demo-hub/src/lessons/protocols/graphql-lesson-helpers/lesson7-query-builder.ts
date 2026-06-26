// ── Lesson 7: Query Builder ───────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  closeGqlActivityPanelIfOpen,
  fillGqlEditor,
  getDemoUserAId,
  getGqlEditorQuery,
  getMonacoGqlEditorInstance,
  syncGqlQueryToAppState,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

export const LESSON7_USER_FIELD_PATH = 'user.id';
export const LESSON7_USER_ALIAS = 'userId';
export const LESSON7_EDITOR_COMMENT = '# edited in editor';

let _lesson7HealthSelected = false;
let _lesson7SelectAllDone = false;
let _lesson7UserConfigured = false;
let _lesson7AliasSet = false;
let _lesson7IncludeSet = false;
let _lesson7EditedToEditor = false;
let _lesson7CommentAdded = false;

export function resetGqlLesson7SessionFlags(): void {
  _lesson7HealthSelected = false;
  _lesson7SelectAllDone = false;
  _lesson7UserConfigured = false;
  _lesson7AliasSet = false;
  _lesson7IncludeSet = false;
  _lesson7EditedToEditor = false;
  _lesson7CommentAdded = false;
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
  const expandSel = `[data-testid="gql-fo-expand-${path}"]`;
  const expandBtn =
    document.querySelector<HTMLElement>(expandSel) ??
    document.querySelector<HTMLElement>(`.gql-qb-fo-expand[title="${path}"]`);
  const row = expandBtn?.closest('.gql-qb-fo-row');
  if (row && !row.querySelector('.gql-qb-fo-body')) {
    await quietDomClick(ctx, expandBtn);
  }
}

/** Switch to Builder mode with introspected schema loaded. */
export async function ensureBuilderMode(ctx: DemoActionContext): Promise<void> {
  await closeGqlActivityPanelIfOpen(ctx);
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

/** Expand user › id field options so the alias input is visible for demo spotlight. */
export async function ensureUserIdFieldOptionExpanded(ctx: DemoActionContext): Promise<void> {
  await ensureUserFieldConfigured(ctx);
  await expandSummaryFieldOption(ctx, LESSON7_USER_FIELD_PATH);
}

/** Set alias `userId` on the `user.id` field in the Summary panel. */
export async function ensureAliasConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureUserIdFieldOptionExpanded(ctx);
  if (_lesson7AliasSet && getBuilderCodeText().includes(LESSON7_USER_ALIAS)) return;

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

/**
 * Step 9 preAction — Builder with full selection model visible for "Edit in Editor" reading.
 * If the user replayed from Editor without transfer yet, return to Builder so the spotlight matches the pane.
 */
export async function prepareEditInEditorReading(ctx: DemoActionContext): Promise<void> {
  if (_lesson7EditedToEditor) {
    await ensureInEditorAfterTransfer(ctx);
    return;
  }

  await ensureIncludeConfigured(ctx);

  const editorActive = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)?.classList.contains('gql-mode-btn--active');
  if (editorActive) {
    await ctx.click(GQL.MODE_BUILDER);
    await ctx.waitFor(GQL.QB_FIELD_TREE, 8000);
    await ctx.delay(400);
  }
}

/** Transfer generated SDL to Monaco via Edit in Editor (first time only — from Builder). */
export async function ensureEditedToEditor(ctx: DemoActionContext): Promise<void> {
  const editorActive = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)?.classList.contains('gql-mode-btn--active');
  if (_lesson7EditedToEditor && editorActive) return;

  await ensureIncludeConfigured(ctx);

  await ctx.click(GQL.QB_EDIT);
  await ctx.waitFor(GQL.EDITOR, 5000);
  await ctx.delay(800);
  _lesson7EditedToEditor = true;
}

/**
 * Stay in (or return to) Editor after the one-time Builder → Editor transfer.
 * Uses the Editor tab — never round-trips through Builder + Edit in Editor again.
 */
export async function ensureInEditorAfterTransfer(ctx: DemoActionContext): Promise<void> {
  const editorActive = document.querySelector<HTMLElement>(GQL.MODE_EDITOR)?.classList.contains('gql-mode-btn--active');
  if (_lesson7EditedToEditor && editorActive) return;

  if (_lesson7EditedToEditor) {
    await ctx.click(GQL.MODE_EDITOR);
    await ctx.waitFor(GQL.EDITOR, 5000);
    await ctx.delay(400);
    return;
  }

  await ensureEditedToEditor(ctx);
}

type MonacoTypingEditor = {
  getModel(): { getValue(): string; uri: { toString(): string } } | null;
  setPosition?(pos: { lineNumber: number; column: number }): void;
  getPosition?(): { lineNumber: number; column: number };
  focus?(): void;
  executeEdits?(
    source: string,
    edits: Array<{
      range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
      text: string;
      forceMoveMarkers?: boolean;
    }>,
  ): void;
  revealLineInCenter?(line: number): void;
};

async function typeTextAtMonacoCursor(
  ctx: DemoActionContext,
  editor: MonacoTypingEditor,
  text: string,
): Promise<void> {
  for (const ch of text) {
    const pos = editor.getPosition?.() ?? { lineNumber: 1, column: 1 };
    editor.executeEdits?.('demo', [{
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: ch,
      forceMoveMarkers: true,
    }]);
    const delayMs = ch === '#' ? 150 : ch === ' ' ? 120 : 70;
    await ctx.delay(delayMs);
  }
}

/**
 * Visibly add the lesson comment at the top of the Monaco document (Editor mode).
 * Types character-by-character when Monaco executeEdits is available.
 */
export async function demonstrateEditorCommentLine(ctx: DemoActionContext): Promise<void> {
  await ensureInEditorAfterTransfer(ctx);
  await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
  await ctx.click(`${GQL.EDITOR} .monaco-editor`);
  await ctx.delay(800);

  const current = getGqlEditorQuery();
  if (_lesson7CommentAdded && current.includes(LESSON7_EDITOR_COMMENT)) {
    await ctx.delay(1500);
    return;
  }
  if (current.includes(LESSON7_EDITOR_COMMENT)) {
    _lesson7CommentAdded = true;
    await ctx.delay(1500);
    return;
  }

  const editor = getMonacoGqlEditorInstance() as MonacoTypingEditor | null;
  if (editor?.executeEdits) {
    editor.setPosition?.({ lineNumber: 1, column: 1 });
    editor.focus?.();
    await ctx.delay(600);
    await typeTextAtMonacoCursor(ctx, editor, `${LESSON7_EDITOR_COMMENT}\n`);
    editor.revealLineInCenter?.(1);
    syncGqlQueryToAppState(getGqlEditorQuery());
    _lesson7CommentAdded = true;
    await ctx.delay(2500);
    return;
  }

  const withComment = `${LESSON7_EDITOR_COMMENT}\n${current.trimStart()}`;
  await fillGqlEditor(ctx, withComment, { focus: false });
  _lesson7CommentAdded = true;
  await ctx.delay(2500);
}

/**
 * Quietly ensure the lesson comment exists in Monaco (preAction guards only — no typing animation).
 */
export async function ensureEditorCommentQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureInEditorAfterTransfer(ctx);
  const current = getGqlEditorQuery();
  if (current.includes(LESSON7_EDITOR_COMMENT)) {
    _lesson7CommentAdded = true;
    return;
  }
  const withComment = `${LESSON7_EDITOR_COMMENT}\n${current.trimStart()}`;
  await fillGqlEditor(ctx, withComment, { focus: false });
  _lesson7CommentAdded = true;
}

/** @deprecated Use ensureEditorCommentQuiet — kept as alias for lesson preActions. */
export const ensureEditorCommentPresent = ensureEditorCommentQuiet;

/** Step 10 preAction — Editor mode with transferred query; no comment typing yet. */
export async function prepareEditorCommentReading(ctx: DemoActionContext): Promise<void> {
  await ensureInEditorAfterTransfer(ctx);
}

/** Step 11 preAction — Editor holds the demo comment (quiet fill if user skipped step 10). */
export async function prepareOneWaySyncReading(ctx: DemoActionContext): Promise<void> {
  await ensureEditorCommentQuiet(ctx);
}

/**
 * Visible beat for step 11: pause on Editor comment, then one switch to Builder for SDL contrast.
 * Assumes prepareOneWaySyncReading already ran — does not re-enter Builder before the switch.
 */
export async function demonstrateOneWaySyncContrast(ctx: DemoActionContext): Promise<void> {
  await ensureInEditorAfterTransfer(ctx);
  await ctx.delay(1200);

  await ctx.click(GQL.MODE_BUILDER);
  await ctx.waitFor(GQL.QB_FIELD_TREE, 8000);
  await ctx.waitFor(GQL.QB_CODE, 5000);
  await ctx.delay(800);
  document.querySelector(GQL.QB_CODE)?.scrollIntoView?.({ block: 'center' });
  await ctx.delay(1200);

  const preview = getBuilderCodeText();
  if (!preview.includes(LESSON7_EDITOR_COMMENT)) {
    await ctx.delay(2000);
  } else {
    await ctx.delay(800);
  }
}

/** Setup for Lesson 7 (GQL-8) — demo tab; seed demo user for `id` arg. */
export async function gqlQueryBuilderLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();

  await closeGqlActivityPanelIfOpen(ctx);
  await ensureEditorMode(ctx);

  await ensureGqlDemoTab(ctx, 'gql-query-builder', 'Query Builder — Visual Operations');
  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — ensureUserFieldConfigured falls back to usr-1
  }
}

/** Cleanup for Lesson 7 (GQL-8) — close demo tab and reset session flags. */
export async function gqlQueryBuilderLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson7SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-query-builder');
}

