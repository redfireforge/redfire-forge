// ── Lesson 8: Collections & History ───────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_HEALTH_QUERY,
  ensureHealthQuery,
  ensureIntrospected,
  fillGqlEditor,
  getGqlEditorQuery,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

export const LESSON8_ITEM_NAME = 'Health Check';
export const LESSON8_ITEM_RENAME = 'Lesson 8 Health';
export const LESSON8_COLLECTION_NAME = 'Lesson 8 Collection';

let _lesson8HealthExecuted = false;
let _lesson8HistoryReady = false;
let _lesson8Loaded = false;
let _lesson8Run = false;
let _lesson8Saved = false;
let _lesson8Renamed = false;
let _lesson8Restored = false;

export function resetGqlLesson8SessionFlags(): void {
  _lesson8HealthExecuted = false;
  _lesson8HistoryReady = false;
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
    await ctx.delay(800);
  }
}

/** Open the Collections activity panel. */
export async function openCollectionsPanel(ctx: DemoActionContext): Promise<void> {
  const active = document.querySelector<HTMLElement>(GQL.ACTIVITY_COLLECTIONS)?.classList.contains('gql-activity-tab--active');
  if (!active) {
    await ctx.click(GQL.ACTIVITY_COLLECTIONS);
    await ctx.waitFor(GQL.COLLECTIONS_PANEL, 5000);
    await ctx.delay(800);
  }
}

async function expandFirstCollection(ctx: DemoActionContext): Promise<void> {
  const node = document.querySelector<HTMLElement>(GQL.COL_NODE);
  const header = node?.querySelector<HTMLElement>('.gql-col-node-header');
  const expanded = node?.getAttribute('aria-expanded') === 'true';
  if (header && !expanded) {
    header.click();
    await ctx.delay(500);
  }
}

async function clickContextMenuItem(ctx: DemoActionContext, label: string): Promise<void> {
  const btn = Array.from(document.querySelectorAll<HTMLElement>(GQL.COL_CTX_MENU + ' button'))
    .find((b) => b.textContent?.trim().startsWith(label));
  if (btn) {
    btn.click();
    await ctx.delay(500);
  }
}

async function openFirstCollectionItemContextMenu(ctx: DemoActionContext): Promise<void> {
  const item = document.querySelector<HTMLElement>(GQL.COL_ITEM);
  if (item) {
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    await ctx.delay(600);
  }
}

async function openCollectionHeaderContextMenu(ctx: DemoActionContext): Promise<void> {
  const header = document.querySelector<HTMLElement>('.gql-col-node-header');
  if (header) {
    header.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    await ctx.delay(600);
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

/** Execute health query once (visible step 1 action). */
export async function executeLesson8HealthQuery(ctx: DemoActionContext): Promise<void> {
  await ensureHealthQuery(ctx);
  if (_lesson8HealthExecuted) return;
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  _lesson8HealthExecuted = true;
  await ctx.delay(700);
}

/** Step 1 reading — health query in editor, ready to execute. */
export async function prepareGql8ExecHealthReading(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureHealthQuery(ctx);
}

/** Step 2 reading — response ready; History panel opens on the next visible click. */
export async function prepareGql8ObserveHistoryReading(ctx: DemoActionContext): Promise<void> {
  await executeLesson8HealthQuery(ctx);
}

/** Step 3 reading — history entry visible; preview opens on the visible click. */
export async function prepareGql8PreviewReading(ctx: DemoActionContext): Promise<void> {
  await ensureHealthExecutedWithHistory(ctx);
}

/** Step 4 reading — preview visible; Load runs on the visible click. */
export async function prepareGql8LoadReading(ctx: DemoActionContext): Promise<void> {
  await openHistoryPreviewIfMissing(ctx);
}

/** Step 5 reading — preview ready; Run executes on the visible click. */
export async function prepareGql8RunReading(ctx: DemoActionContext): Promise<void> {
  await openHistoryPreviewIfMissing(ctx);
}

/** Step 6 reading — collection exists and preview ready; Save runs on the visible click. */
export async function prepareGql8SaveReading(ctx: DemoActionContext): Promise<void> {
  if (!_lesson8Run) {
    await runHistoryEntry(ctx);
  } else {
    await openHistoryPreviewIfMissing(ctx);
  }
  await ensureDemoCollectionExists(ctx);
  await openHistoryPanel(ctx);
}

/** Step 7 reading — saved item visible in Collections; rename runs on the visible click. */
export async function prepareGql8RenameReading(ctx: DemoActionContext): Promise<void> {
  if (!_lesson8Saved) {
    await saveHistoryToCollection(ctx);
  }
  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
  await ctx.waitFor(GQL.COL_ITEM, 8000);
}

/** Step 8 reading — renamed item in tree; Export runs on the visible click. */
export async function prepareGql8ExportReading(ctx: DemoActionContext): Promise<void> {
  const itemName = document.querySelector('.gql-col-item-name')?.textContent?.trim();
  if (!_lesson8Renamed || itemName !== LESSON8_ITEM_RENAME) {
    if (!_lesson8Saved) await saveHistoryToCollection(ctx);
    await renameCollectionItem(ctx);
  }
  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
}

/** Step 9 reading — collection ready for delete + import demo. */
export async function prepareGql8ImportReading(ctx: DemoActionContext): Promise<void> {
  await prepareGql8ExportReading(ctx);
}

async function openHistoryPanelWithEntry(ctx: DemoActionContext): Promise<void> {
  await executeLesson8HealthQuery(ctx);
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

/** Execute health query and ensure a History entry exists. */
export async function ensureHealthExecutedWithHistory(ctx: DemoActionContext): Promise<void> {
  if (_lesson8HistoryReady && document.querySelector(GQL.HISTORY_ENTRY)) return;
  await openHistoryPanelWithEntry(ctx);
}

/** Open History panel and pause so the new entry is readable (step 2 action). */
export async function revealHistoryPanel(ctx: DemoActionContext): Promise<void> {
  await openHistoryPanel(ctx);
  await ctx.waitFor(GQL.HISTORY_ENTRY, 8000);
  await ctx.delay(1000);
  _lesson8HistoryReady = true;
}

async function openHistoryPreviewIfMissing(ctx: DemoActionContext): Promise<void> {
  await ensureHealthExecutedWithHistory(ctx);
  if (document.querySelector(GQL.HISTORY_PREVIEW)) return;
  await openHistoryPanel(ctx);
  await ctx.click(GQL.HISTORY_ENTRY);
  await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
  await ctx.delay(300);
}

/** Single-click history entry and open the preview panel (step 3 action). */
export async function openHistoryPreview(ctx: DemoActionContext): Promise<void> {
  await ensureHealthExecutedWithHistory(ctx);
  await openHistoryPanel(ctx);
  await ctx.click(GQL.HISTORY_ENTRY);
  await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
  await ctx.delay(1000);
}

/** @deprecated Use openHistoryPreview */
export const ensureHistoryPreviewOpen = openHistoryPreview;

/** Load history entry into editor without executing (step 4 action). */
export async function loadHistoryToEditor(ctx: DemoActionContext): Promise<void> {
  await openHistoryPreview(ctx);
  if (_lesson8Loaded && getGqlEditorQuery().includes('health')) return;
  await ctx.click(GQL.HISTORY_LOAD);
  await ctx.delay(1000);
  _lesson8Loaded = true;
}

/** @deprecated Use loadHistoryToEditor */
export const ensureHistoryLoadedToEditor = loadHistoryToEditor;

/** Run history entry — loads query and executes immediately (step 5 action). */
export async function runHistoryEntry(ctx: DemoActionContext): Promise<void> {
  await openHistoryPreview(ctx);
  if (!document.querySelector(GQL.HISTORY_PREVIEW)) {
    await openHistoryPanel(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
    await ctx.delay(600);
  }
  if (_lesson8Run) return;
  await ctx.click(GQL.HISTORY_RUN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(1000);
  _lesson8Run = true;
}

/** @deprecated Use runHistoryEntry */
export const ensureHistoryRunExecuted = runHistoryEntry;

/** Ensure at least one collection exists in the Collections panel. */
export async function ensureDemoCollectionExists(ctx: DemoActionContext): Promise<void> {
  await openCollectionsPanel(ctx);
  if (!document.querySelector(GQL.COL_NODE)) {
    await ctx.click(GQL.COLLECTIONS_NEW);
    await ctx.waitFor(GQL.COL_NODE, 5000);
    await ctx.delay(700);
  }
}

/** Save the selected history entry to a collection via the modal (step 6 action). */
export async function saveHistoryToCollection(ctx: DemoActionContext): Promise<void> {
  await ensureDemoCollectionExists(ctx);
  await openHistoryPanel(ctx);
  if (!document.querySelector(GQL.HISTORY_PREVIEW)) {
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
    await ctx.delay(600);
  }
  if (_lesson8Saved && document.querySelector(GQL.COL_ITEM)) return;

  await ctx.click(GQL.HISTORY_SAVE_TO_COL);
  await ctx.waitFor(GQL.SAVE_COL_MODAL, 5000);
  await ctx.delay(600);

  if (document.querySelector('.gql-save-col-empty')) {
    await ctx.click(GQL.SAVE_COL_CANCEL);
    await ensureDemoCollectionExists(ctx);
    await openHistoryPanel(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
    await ctx.delay(600);
    await ctx.click(GQL.HISTORY_SAVE_TO_COL);
    await ctx.waitFor(GQL.SAVE_COL_MODAL, 5000);
    await ctx.delay(600);
  }

  await ctx.fill(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
  await ctx.delay(500);
  await ctx.click(GQL.SAVE_COL_SAVE);
  await ctx.delay(700);

  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
  await ctx.waitFor(GQL.COL_ITEM, 8000);
  _lesson8Saved = true;
}

/** @deprecated Use saveHistoryToCollection */
export const ensureSavedToCollectionFromHistory = saveHistoryToCollection;

/** Rename the saved collection item via context menu (step 7 action). */
export async function renameCollectionItem(ctx: DemoActionContext): Promise<void> {
  if (!_lesson8Saved) {
    await saveHistoryToCollection(ctx);
  }
  const itemName = document.querySelector('.gql-col-item-name')?.textContent?.trim();
  if (_lesson8Renamed && itemName === LESSON8_ITEM_RENAME) return;

  await openCollectionsPanel(ctx);
  await expandFirstCollection(ctx);
  await openFirstCollectionItemContextMenu(ctx);
  await clickContextMenuItem(ctx, 'Rename');
  await ctx.waitFor(GQL.COL_ITEM_RENAME, 5000);
  await ctx.delay(600);
  await ctx.fill(GQL.COL_ITEM_RENAME, LESSON8_ITEM_RENAME);
  await ctx.delay(500);
  const input = document.querySelector<HTMLInputElement>(GQL.COL_ITEM_RENAME);
  input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await ctx.delay(700);
  _lesson8Renamed = true;
}

/** @deprecated Use renameCollectionItem */
export const ensureCollectionItemRenamed = renameCollectionItem;

/** Import collections JSON (after delete) to restore the saved operation (step 9 action). */
export async function restoreCollectionViaImport(ctx: DemoActionContext): Promise<void> {
  const itemName = document.querySelector('.gql-col-item-name')?.textContent?.trim();
  if (!_lesson8Renamed || itemName !== LESSON8_ITEM_RENAME) {
    await renameCollectionItem(ctx);
  }
  if (_lesson8Restored && document.querySelector(GQL.COL_ITEM)) return;

  await openCollectionsPanel(ctx);
  await openCollectionHeaderContextMenu(ctx);
  await clickContextMenuItem(ctx, 'Delete');
  await ctx.delay(800);

  await ctx.click(GQL.COLLECTIONS_IMPORT);
  await ctx.delay(500);
  injectCollectionsImportFile(buildLesson8ImportPayload());
  await ctx.waitFor(GQL.IMPORT_MODE_DIALOG, 8000);
  await ctx.delay(600);
  await ctx.click(GQL.IMPORT_MODE_MERGE);
  await ctx.delay(1500);
  await expandFirstCollection(ctx);
  await ctx.waitFor(GQL.COL_ITEM, 8000);
  _lesson8Restored = true;
}

/** @deprecated Use restoreCollectionViaImport */
export const ensureCollectionRestoredViaImport = restoreCollectionViaImport;

/** Setup for Lesson 8 (GQL-9) — demo tab; close activity panels. */
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

  await ensureGqlDemoTab(ctx, 'gql-collections-history', 'Collections & History');
  await fillGqlEditor(ctx, '', { focus: false });
}

/** Cleanup for Lesson 8 (GQL-9) — close demo tab and reset session flags. */
export async function gqlCollectionsHistoryLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson8SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-collections-history');
}
