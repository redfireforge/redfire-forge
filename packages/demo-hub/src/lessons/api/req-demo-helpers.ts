/** Shared helpers for API Testing demo lessons (Requests + Catalog). */
import type { DemoActionContext } from '../../types';
import { REQ } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';

/**
 * Draw a spotlight ring on `selector`, hold so the viewer can read it, then remove.
 * Removes any prior ring before adding a new one (via showSpotlightRing).
 */
export async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 900,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const removeRing = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
  }
}

/**
 * Navigate to the Gallery tab and filter to Requests domain.
 * Useful as a preAction guard when the lesson needs to start on the Gallery.
 */
export async function navigateToGalleryRequests(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('gallery');
  await ctx.delay(300);
  const domainBtn = document.querySelector<HTMLElement>(REQ.GALLERY_DOMAIN_REQUESTS);
  if (domainBtn && !domainBtn.classList.contains('active')) {
    domainBtn.click();
    await ctx.delay(200);
  }
}

/**
 * Click a gallery card by sample ID to select it (opens detail panel).
 */
export async function selectGalleryCard(ctx: DemoActionContext, sampleId: string): Promise<void> {
  const selector = REQ.galleryCard(sampleId);
  await ctx.waitFor(selector, 3000);
  await ctx.click(selector);
  await ctx.delay(400);
}

/**
 * Click the primary action button in the Gallery detail panel ("Send Request" for requests).
 * Spotlights the button with a pause so viewers see the import action before click.
 * After click, the app auto-navigates to the Requests tab.
 */
export async function importGallerySample(
  ctx: DemoActionContext,
  options?: { spotlightHoldMs?: number },
): Promise<void> {
  await ctx.waitFor(REQ.GALLERY_DETAIL_PANEL, 2500);
  await ctx.waitFor(REQ.GALLERY_DETAIL_ACTION, 2500);
  const holdMs = options?.spotlightHoldMs ?? 1100;
  if (holdMs > 0) {
    await spotlightAndPause(ctx, REQ.GALLERY_DETAIL_ACTION, holdMs);
  }
  await ctx.click(REQ.GALLERY_DETAIL_ACTION);
  await ctx.delay(600);
}

/**
 * Select a request in the sidebar by name. Waits for the item to appear.
 * When `collectionName` is set, scopes to that collection so duplicate names
 * (e.g. "Get All Users" in sales-* vs Gallery Samples) are not confused.
 */
export async function selectRequestByName(
  ctx: DemoActionContext,
  name: string,
  collectionName?: string,
): Promise<void> {
  if (collectionName) {
    await ensureCollectionExpanded(ctx, collectionName);
    const group = document.querySelector<HTMLElement>(REQ.colByName(collectionName))
      ?.closest('.req-col-group');
    const requestInGroup = group
      ? Array.from(group.querySelectorAll<HTMLElement>(REQ.REQ_ITEM))
        .find((el) => el.getAttribute('data-req-name') === name)
      : null;
    if (requestInGroup) {
      requestInGroup.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      requestInGroup.click();
      await ctx.delay(300);
      return;
    }
  }

  const selector = REQ.reqByName(name);
  await ctx.waitFor(selector, 3000);
  const el = document.querySelector<HTMLElement>(selector);
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  await ctx.click(selector);
  await ctx.delay(300);
}

/**
 * Ensure we're on the Requests tab. Silent guard for preAction.
 */
export function ensureRequestsTab(ctx: DemoActionContext): void {
  const editor = document.querySelector(REQ.EDITOR);
  if (!editor) {
    ctx.navigateToTab('requests');
  }
}

/**
 * Click "Shrink All" to collapse all collections in the sidebar.
 * If the toggle is currently "Expand All" (not all expanded), we click once
 * to expand all (React will batch and re-render with isAllExpanded=true),
 * then after a microtask we click again to shrink all.
 */
export async function shrinkAllCollections(): Promise<void> {
  const btn = document.querySelector<HTMLElement>(REQ.SIDEBAR_EXPAND_ALL);
  if (!btn) return;
  const label = btn.getAttribute('aria-label') || '';
  if (label.toLowerCase().includes('shrink')) {
    btn.click();
  } else {
    btn.click();
    await new Promise(r => setTimeout(r, 0));
    btn.click();
  }
}

/**
 * Expand all collections/folders in the sidebar when possible.
 */
export async function expandAllCollections(): Promise<void> {
  const btn = document.querySelector<HTMLElement>(REQ.SIDEBAR_EXPAND_ALL);
  if (!btn) return;
  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (label.includes('expand')) {
    btn.click();
    await new Promise(r => setTimeout(r, 0));
  }
}

/**
 * Resolve the collection name that currently contains a request name.
 */
export function findRequestCollectionName(requestName: string): string | null {
  const reqItem = document.querySelector<HTMLElement>(REQ.reqByName(requestName));
  if (!reqItem) return null;
  const group = reqItem.closest('.req-col-group');
  const colHeader = group?.querySelector<HTMLElement>('[data-testid="req-col-item"][data-col-name]');
  return colHeader?.getAttribute('data-col-name') ?? null;
}

/**
 * Ensure a collection is expanded by name (if found).
 */
export async function ensureCollectionExpanded(ctx: DemoActionContext, colName: string): Promise<boolean> {
  const col = document.querySelector<HTMLElement>(REQ.colByName(colName));
  if (!col) return false;
  const parent = col.closest('.req-col-group');
  const list = parent?.querySelector<HTMLElement>('.req-req-list');
  const isListVisible = !!list
    && list.getBoundingClientRect().height > 0
    && getComputedStyle(list).display !== 'none'
    && getComputedStyle(list).visibility !== 'hidden';
  if (!isListVisible) {
    col.click();
    await ctx.delay(200);
  }
  return true;
}

/**
 * Ensure the "Gallery Samples" collection exists and is expanded.
 * Used as a preAction guard when a prior gallery import may have been skipped.
 */
export async function ensureGallerySamplesCollection(ctx: DemoActionContext): Promise<boolean> {
  return ensureCollectionExpanded(ctx, 'Gallery Samples');
}

type RequestCleanupBaseline = {
  requestExactCounts: Record<string, number>;
  requestPrefixCounts: Record<string, number>;
  collectionExactCounts: Record<string, number>;
};

const lessonCleanupBaselines = new Map<string, RequestCleanupBaseline>();

function countRequestsByExactName(name: string): number {
  return document.querySelectorAll(REQ.reqByName(name)).length;
}

function countRequestsByPrefix(prefix: string): number {
  const rows = document.querySelectorAll<HTMLElement>(REQ.REQ_ITEM);
  let count = 0;
  for (const row of rows) {
    const name = row.getAttribute('data-req-name') || '';
    if (name.startsWith(prefix)) count++;
  }
  return count;
}

function countCollectionsByExactName(name: string): number {
  return document.querySelectorAll(REQ.colByName(name)).length;
}

function firstRequestByPrefix(prefix: string): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>(REQ.REQ_ITEM);
  for (const row of rows) {
    const name = row.getAttribute('data-req-name') || '';
    if (name.startsWith(prefix)) return row;
  }
  return null;
}

async function confirmRequestSidebarDeleteIfOpen(ctx: DemoActionContext): Promise<void> {
  const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
  if (confirmBtn) {
    confirmBtn.click();
    await ctx.delay(180);
  }
}

async function deleteOneRequestByExactName(
  ctx: DemoActionContext,
  name: string,
  collectionName?: string,
): Promise<boolean> {
  await expandAllCollections();
  if (collectionName) {
    await ensureCollectionExpanded(ctx, collectionName);
  }
  const selector = collectionName
    ? REQ.reqInCollection(collectionName, name)
    : REQ.reqByName(name);
  const reqEl = document.querySelector<HTMLElement>(selector);
  if (!reqEl) return false;
  triggerContextMenu(reqEl);
  await ctx.delay(160);
  const clicked = await clickContextMenuItem(ctx, 'Delete');
  if (!clicked) {
    dismissContextMenu();
    return false;
  }
  await confirmRequestSidebarDeleteIfOpen(ctx);
  return true;
}

/**
 * Delete every request with `requestNames` under a specific collection.
 * Used to clear Gallery Samples duplicates before/after demo lessons
 * without touching same-named requests in other collections.
 */
export async function cleanupRequestsInCollection(
  ctx: DemoActionContext,
  collectionName: string,
  requestNames: string[],
  maxPerName = 20,
): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(80);
  if (!document.querySelector(REQ.colByName(collectionName))) return;
  await ensureCollectionExpanded(ctx, collectionName);
  dismissContextMenu();

  for (const name of requestNames) {
    let guard = 0;
    while (
      document.querySelector(REQ.reqInCollection(collectionName, name)) &&
      guard < maxPerName
    ) {
      const deleted = await deleteOneRequestByExactName(ctx, name, collectionName);
      if (!deleted) break;
      guard++;
      await ctx.delay(80);
    }
  }
}

async function deleteOneRequestByPrefix(ctx: DemoActionContext, prefix: string): Promise<boolean> {
  await expandAllCollections();
  const reqEl = firstRequestByPrefix(prefix);
  if (!reqEl) return false;
  triggerContextMenu(reqEl);
  await ctx.delay(160);
  const clicked = await clickContextMenuItem(ctx, 'Delete');
  if (!clicked) {
    dismissContextMenu();
    return false;
  }
  await confirmRequestSidebarDeleteIfOpen(ctx);
  return true;
}

async function deleteOneCollectionByExactName(ctx: DemoActionContext, name: string): Promise<boolean> {
  await expandAllCollections();
  const colEl = document.querySelector<HTMLElement>(REQ.colByName(name));
  if (!colEl) return false;
  triggerContextMenu(colEl);
  await ctx.delay(160);
  const clicked = await clickContextMenuItem(ctx, 'Delete Collection');
  if (!clicked) {
    dismissContextMenu();
    return false;
  }
  await confirmRequestSidebarDeleteIfOpen(ctx);
  return true;
}

/**
 * Capture per-lesson cleanup baseline before the lesson mutates requests/collections.
 */
export function captureLessonCleanupBaseline(
  lessonId: string,
  options: {
    requestExactNames?: string[];
    requestNamePrefixes?: string[];
    collectionExactNames?: string[];
  },
): void {
  const requestExactCounts: Record<string, number> = {};
  const requestPrefixCounts: Record<string, number> = {};
  const collectionExactCounts: Record<string, number> = {};

  for (const name of options.requestExactNames ?? []) {
    requestExactCounts[name] = countRequestsByExactName(name);
  }
  for (const prefix of options.requestNamePrefixes ?? []) {
    requestPrefixCounts[prefix] = countRequestsByPrefix(prefix);
  }
  for (const name of options.collectionExactNames ?? []) {
    collectionExactCounts[name] = countCollectionsByExactName(name);
  }

  lessonCleanupBaselines.set(lessonId, {
    requestExactCounts,
    requestPrefixCounts,
    collectionExactCounts,
  });
}

/**
 * Cleanup lesson-created request/collection artifacts relative to the captured baseline.
 */
export async function cleanupLessonArtifacts(
  ctx: DemoActionContext,
  lessonId: string,
  options: {
    requestExactNames?: string[];
    requestNamePrefixes?: string[];
    collectionExactNames?: string[];
  },
): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(80);
  await expandAllCollections();
  dismissContextMenu();

  const baseline = lessonCleanupBaselines.get(lessonId);

  for (const name of options.requestExactNames ?? []) {
    const target = baseline?.requestExactCounts[name] ?? 0;
    let guard = 0;
    while (countRequestsByExactName(name) > target && guard < 12) {
      const deleted = await deleteOneRequestByExactName(ctx, name);
      if (!deleted) break;
      guard++;
    }
  }

  for (const prefix of options.requestNamePrefixes ?? []) {
    const target = baseline?.requestPrefixCounts[prefix] ?? 0;
    let guard = 0;
    while (countRequestsByPrefix(prefix) > target && guard < 12) {
      const deleted = await deleteOneRequestByPrefix(ctx, prefix);
      if (!deleted) break;
      guard++;
    }
  }

  for (const name of options.collectionExactNames ?? []) {
    const target = baseline?.collectionExactCounts[name] ?? 0;
    let guard = 0;
    while (countCollectionsByExactName(name) > target && guard < 8) {
      const deleted = await deleteOneCollectionByExactName(ctx, name);
      if (!deleted) break;
      guard++;
    }
  }

  lessonCleanupBaselines.delete(lessonId);
}

// ─── REQ-2 Helpers: Context menu & collection management ──────────────

/**
 * Dispatch a contextmenu event on an element. Used to trigger the sidebar
 * context menu on collections, folders, or requests.
 */
export function triggerContextMenu(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
}

/**
 * Find and click a context menu item by its text content.
 * Waits briefly for the menu to appear.
 */
export async function clickContextMenuItem(ctx: DemoActionContext, text: string): Promise<boolean> {
  await ctx.waitFor(REQ.CONTEXT_MENU, 2000);
  const menu = document.querySelector(REQ.CONTEXT_MENU);
  if (!menu) return false;
  const buttons = menu.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim() === text) {
      btn.click();
      await ctx.delay(200);
      return true;
    }
  }
  return false;
}

/**
 * Dismiss any open context menu by clicking the document.
 */
export function dismissContextMenu(): void {
  const menu = document.querySelector(REQ.CONTEXT_MENU);
  if (menu) {
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}

/**
 * Create a Direct URL collection via the + dropdown → New Collection modal.
 * Opens the modal, fills the name, and clicks Create.
 */
export async function createCollectionViaModal(ctx: DemoActionContext, name: string): Promise<void> {
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.delay(300);
  await ctx.waitFor(REQ.ADD_URL_COLLECTION, 1500);
  await ctx.click(REQ.ADD_URL_COLLECTION);
  await ctx.delay(400);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
  if (nameInput) {
    nameInput.focus();
    fillControlledInput(nameInput, name);
  }
  await ctx.delay(400);
  const saveBtn = document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary');
  if (saveBtn) saveBtn.click();
  await ctx.delay(400);
}

/**
 * Create a folder in a collection via right-click context menu.
 * Triggers context menu on the collection header, clicks "Add Folder",
 * and fills the inline input.
 */
export async function createFolderViaContextMenu(
  ctx: DemoActionContext, colName: string, folderName: string,
): Promise<void> {
  const colEl = document.querySelector<HTMLElement>(REQ.colByName(colName));
  if (!colEl) return;
  triggerContextMenu(colEl);
  await ctx.delay(300);
  await clickContextMenuItem(ctx, 'Add Folder');
  await ctx.delay(300);
  const input = document.querySelector<HTMLInputElement>(REQ.FOLDER_NAME_INPUT);
  if (input) {
    input.focus();
    fillControlledInput(input, folderName);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  await ctx.delay(400);
}

/**
 * Move a request to a folder via context menu → Move to... submenu.
 */
export async function moveRequestToFolder(
  ctx: DemoActionContext, reqName: string, folderName: string,
): Promise<void> {
  const reqEl = document.querySelector<HTMLElement>(REQ.reqByName(reqName));
  if (!reqEl) return;
  triggerContextMenu(reqEl);
  await ctx.delay(300);
  const menu = document.querySelector(REQ.CONTEXT_MENU);
  if (!menu) return;
  const moveBtn = Array.from(menu.querySelectorAll('button'))
    .find(b => b.textContent?.trim().startsWith('Move to'));
  if (moveBtn) {
    moveBtn.click();
    await ctx.delay(300);
    const submenu = document.querySelector('.req-ctx-submenu');
    if (submenu) {
      const folderBtn = Array.from(submenu.querySelectorAll('button'))
        .find(b => b.textContent?.includes(folderName));
      if (folderBtn) {
        folderBtn.click();
        await ctx.delay(300);
      }
    }
  }
}

/**
 * Duplicate a request via context menu.
 */
export async function duplicateRequestViaContextMenu(
  ctx: DemoActionContext, reqName: string,
): Promise<void> {
  const reqEl = document.querySelector<HTMLElement>(REQ.reqByName(reqName));
  if (!reqEl) return;
  triggerContextMenu(reqEl);
  await ctx.delay(300);
  await clickContextMenuItem(ctx, 'Duplicate');
  await ctx.delay(300);
}

/**
 * Ensure a collection exists by name. If not, create it via modal.
 * Returns true if the collection exists after the call.
 */
export async function ensureCollectionExists(
  ctx: DemoActionContext, colName: string,
): Promise<boolean> {
  const col = document.querySelector(REQ.colByName(colName));
  if (col) return true;
  await createCollectionViaModal(ctx, colName);
  return !!document.querySelector(REQ.colByName(colName));
}

// ─── Tab Bar Helpers ─────────────────────────────────────────────────

const REQ_TAB_ROLE_SELECTOR = `${REQ.TAB_BAR} [role="tab"]`;

/** Number of open request tabs. */
export function getRequestTabCount(): number {
  return document.querySelectorAll(REQ_TAB_ROLE_SELECTOR).length;
}

/** Close all request tabs except the first. Used in setup/cleanup. */
export async function closeExtraRequestTabs(ctx: DemoActionContext): Promise<void> {
  let guard = 0;
  while (getRequestTabCount() > 1 && guard < 10) {
    const tabs = document.querySelectorAll<HTMLElement>(REQ_TAB_ROLE_SELECTOR);
    const lastTab = tabs[tabs.length - 1];
    const closeBtn = lastTab?.querySelector<HTMLElement>(REQ.TAB_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(200);
    } else {
      break;
    }
    guard++;
  }
}

/** Click a request tab by its 0-based index. */
export async function clickRequestTabByIndex(
  ctx: DemoActionContext,
  index: number,
  delayMs = 400,
): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(REQ_TAB_ROLE_SELECTOR);
  const tab = tabs[index];
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(delayMs);
  }
}

/** Double-click a request tab to enter rename mode, type a new name, commit. */
export async function renameRequestTabByIndex(
  ctx: DemoActionContext,
  index: number,
  newName: string,
): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(REQ_TAB_ROLE_SELECTOR);
  const tab = tabs[index];
  if (!tab) return;
  tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await ctx.delay(400);
  const renameInput = tab.querySelector<HTMLInputElement>('.req-tab-bar__rename');
  if (renameInput) {
    fillControlledInput(renameInput, newName);
    await ctx.delay(300);
    renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await ctx.delay(300);
  }
}

/** Get the label text of the active request tab. */
export function getActiveRequestTabLabel(): string | null {
  const activeTab = document.querySelector<HTMLElement>(`${REQ_TAB_ROLE_SELECTOR}[aria-selected="true"]`);
  return activeTab?.querySelector<HTMLElement>(REQ.TAB_LABEL)?.textContent ?? null;
}

/** Check if a request tab at the given index has a visible close button. */
export function requestTabHasCloseButton(index: number): boolean {
  const tabs = document.querySelectorAll<HTMLElement>(REQ_TAB_ROLE_SELECTOR);
  const tab = tabs[index];
  return !!tab?.querySelector(REQ.TAB_CLOSE);
}

/** Timing constants for request demo pacing. */
export const REQ_DEMO_TIMING = {
  afterNavigate: 400,
  afterGalleryFilter: 300,
  afterCardSelect: 500,
  afterImport: 800,
  afterSidebarClick: 400,
  afterSend: 1200,
  afterTabSwitch: 600,
  afterSearch: 800,
  afterContextMenu: 500,
  afterModalOpen: 600,
  afterModalSave: 500,
  afterFolderCreate: 500,
} as const;
