// ── Lesson 7: Query Builder ───────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  getDemoUserAId,
  getEndpointInput,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
  seedDemoUsers,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';

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

