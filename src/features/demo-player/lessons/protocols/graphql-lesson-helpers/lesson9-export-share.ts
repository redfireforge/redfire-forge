// ── Lesson 9: Export & Share Queries ────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  ensureEditorMode,
  fillGqlEditor,
  getDemoUserAId,
  getGqlEditorQuery,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import {
  ensureBuilderMode,
  getBuilderCodeText,
  resetGqlLesson7SessionFlags,
} from './lesson7-query-builder';
import { openHistoryPanel, resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

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
  // Fast-path guard: if fields are already selected and the SDL confirms it, skip setup.
  const code = getBuilderCodeText();
  if (_lesson9FieldsSelected && code.includes('health') && code.includes('user')) return;
  await ensureBuilderMode(ctx);

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

/** Setup for Lesson 9 (GQL-10) — demo tab; seed demo user for builder `id` arg. */
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

  await ensureGqlDemoTab(ctx, 'gql-export-share', 'Export & Share Queries');
  await fillGqlEditor(ctx, '', { focus: false });
  try {
    await seedDemoUsers();
  } catch {
    // Docker offline — builder uses usr-1 fallback for user id arg
  }
}

/** Cleanup for Lesson 9 (GQL-10) — close demo tab and reset session flags. */
export async function gqlExportShareLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson9SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-export-share');
}

