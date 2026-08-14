/**
 * AM-03 `am-03-rule-library` helpers — Rule Library: Folders, Search, Filters & Docs.
 *
 * The corpus is imported from the Gallery, which re-mints every rule and folder id,
 * so nothing here may hard-code an id: rows are resolved by the method + path they
 * render, folders by their `data-folder-name`. Steps are multi-beat (see
 * `api-mock-demo-helpers`) and every stateful step has an `ensure*` guard so rapid
 * **Next** still leaves the next step a real library to work on.
 */
import {
  importApiMockGallerySample,
  prepareApiMockStudioChrome,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  AM_DEMO_TIMING,
  clickBeat,
  fillBeat,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

/** Background corpus: a twelve-rule storefront library the lesson navigates. */
export const AM03_CORPUS_SAMPLE = 'am-gallery-store';
/** Folder names the corpus ships with — anything else in the tree was authored live. */
export const AM03_CORPUS_FOLDERS = ['Catalog', 'Cart', 'Orders'] as const;
/** Folder created live in the folders step (the product first names it `Folder 4`). */
export const AM03_NEW_FOLDER = 'Checkout';
/** Rule dragged into the new folder — a write path that belongs with checkout. */
export const AM03_MOVED_ROUTE = { method: 'POST', path: '/orders' } as const;
/** Rule toggled off and back on — unique path, so the row is unambiguous. */
export const AM03_TOGGLE_ROUTE = { method: 'GET', path: '/cart' } as const;
/** Draft deleted and restored through the undo window. */
export const AM03_DELETE_ROUTE = { method: 'GET', path: '/products/:id/reviews' } as const;
/** Draft documented live — it ships with no operationId and a single tag. */
export const AM03_DOCS_ROUTE = { method: 'GET', path: '/products/search' } as const;
/** Search probe that matches on path and name. */
export const AM03_SEARCH_TERM = 'cart';
/** Search probe that matches on tag only — three corpus rules carry it. */
export const AM03_TAG_TERM = 'smoke';
/** Documentation authored live in the docs step. */
export const AM03_DOCS_SUMMARY = 'Search products by keyword';
export const AM03_DOCS_OPERATION_ID = 'searchProducts';
export const AM03_DOCS_TAGS = 'catalog, regression';
/** Tag typed into search afterwards to prove documentation feeds discovery. */
export const AM03_DOCS_TAG_PROBE = 'regression';

interface RouteRef {
  method: string;
  path: string;
}

// ── Row identity ────────────────────────────────────────────────────────────

/** Every rule row currently rendered (filters and search apply). */
export function am03Rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.ROUTE_ROW));
}

export function am03RowCount(): number {
  return am03Rows().length;
}

/** The path a row renders — `/products/:id`, not the rule name. */
export function am03RowPath(row: HTMLElement): string {
  return row.querySelector('.am-route-path')?.textContent?.trim() ?? '';
}

export function am03RowMethod(row: HTMLElement): string {
  return row.querySelector('.am-method')?.textContent?.trim() ?? '';
}

/** Row for a method + path pair — `/cart/items/:itemId` exists twice, so both matter. */
export function am03Row(ref: RouteRef): HTMLElement | null {
  return am03Rows().find(r => am03RowPath(r) === ref.path && am03RowMethod(r) === ref.method) ?? null;
}

/** Rule id behind a row — row, delete, and folder selectors are all id-based. */
export function am03RowId(row: HTMLElement): string | null {
  const testid = row.getAttribute('data-testid') ?? '';
  const prefix = 'api-mock-route-';
  return testid.startsWith(prefix) ? testid.slice(prefix.length) : null;
}

/** Selector for a rule row, or null when it is not in the tree. */
export function am03RowSelector(ref: RouteRef): string | null {
  const row = am03Row(ref);
  const id = row ? am03RowId(row) : null;
  return id ? API_MOCK.route(id) : null;
}

/** Selector for a row's trash affordance. */
export function am03RowDeleteSelector(ref: RouteRef): string | null {
  const row = am03Row(ref);
  const id = row ? am03RowId(row) : null;
  return id ? API_MOCK.routeDelete(id) : null;
}

// ── Folder identity ─────────────────────────────────────────────────────────

export function am03FolderBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.FOLDER_BLOCK));
}

/** Folder names in tree order. */
export function am03FolderNames(): string[] {
  return am03FolderBlocks().map(b => b.getAttribute('data-folder-name') ?? '');
}

export function am03FolderBlock(name: string): HTMLElement | null {
  return am03FolderBlocks().find(b => b.getAttribute('data-folder-name') === name) ?? null;
}

export function am03FolderId(name: string): string | null {
  const testid = am03FolderBlock(name)?.getAttribute('data-testid') ?? '';
  const prefix = 'api-mock-folder-';
  return testid.startsWith(prefix) ? testid.slice(prefix.length) : null;
}

/**
 * The folder that exists but has neither a corpus name nor the lesson's name —
 * i.e. the `Folder 4` the product just created and we are about to rename.
 */
export function am03UnnamedFolder(): string | null {
  const known: string[] = [...AM03_CORPUS_FOLDERS, AM03_NEW_FOLDER];
  return am03FolderNames().find(n => n && !known.includes(n)) ?? null;
}

// ── State probes ────────────────────────────────────────────────────────────

/** True when the imported library is on screen. */
export function hasAm03Library(): boolean {
  return am03FolderNames().includes('Catalog') || am03RowCount() > 0;
}

/** True when the Studio (authoring) view is mounted — Runtime / Conflicts unmount it. */
export function isAm03StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

/** Current text in the explorer search box. */
export function am03SearchValue(): string {
  return firstVisibleElement<HTMLInputElement>(API_MOCK.ROUTE_SEARCH)?.value ?? '';
}

/** True when at least one draft (disabled) row is rendered. */
export function hasAm03DraftRows(): boolean {
  return Boolean(document.querySelector(API_MOCK.DRAFT_ROUTE));
}

/** True when the filter popover is open. */
export function isAm03FilterOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_FILTER_PANEL));
}

/** True when Analyze has already flagged overlapping rules. */
export function hasAm03Conflicts(): boolean {
  return Boolean(document.querySelector(API_MOCK.CONFLICTS_COUNT));
}

/** True when the rule open in the editor is enabled. */
export function isAm03SelectedRuleEnabled(): boolean {
  return firstVisibleElement(API_MOCK.ROUTE_ENABLED)?.getAttribute('aria-checked') === 'true';
}

/** True when the Documentation tab of the route editor is the active body tab. */
export function isAm03DocsTabActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.DOCS_TAGS));
}

// ── Raw-event primitives (no ctx equivalent) ────────────────────────────────

/** Double-click a folder header — the product's rename affordance. */
export function doubleClickFolder(header: HTMLElement): void {
  header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
}

/**
 * Drag a rule row onto a folder block. One `DataTransfer` is shared across the
 * sequence so the payload set on `dragstart` survives into `drop`, which is what
 * the explorer reads. Returns false where `DataTransfer` is unavailable (jsdom).
 */
export function dragRowToFolder(row: HTMLElement, block: HTMLElement): boolean {
  if (typeof DataTransfer === 'undefined' || typeof DragEvent === 'undefined') return false;
  const dataTransfer = new DataTransfer();
  const rect = block.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    dataTransfer,
    clientX: Math.round(rect.left + rect.width / 2),
    clientY: Math.round(rect.top + rect.height / 2),
  };
  row.dispatchEvent(new DragEvent('dragstart', opts));
  block.dispatchEvent(new DragEvent('dragover', opts));
  block.dispatchEvent(new DragEvent('drop', opts));
  row.dispatchEvent(new DragEvent('dragend', opts));
  return true;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

/** Quiet boot: one imported library and a collapsed app sidebar. */
export async function prepareAm03Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  await importApiMockGallerySample(AM03_CORPUS_SAMPLE);
  prepareApiMockStudioChrome();
}

/** Exit / restart cleanup — the lesson never binds a listener, so just clear the workspace. */
export async function cleanupAm03(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Guards ──────────────────────────────────────────────────────────────────

/** Authoring guards must not fire on Runtime / Conflicts — both unmount the explorer. */
export async function ensureAm03StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm03StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

/** Guard — the imported library must be the active workspace for every step. */
export async function ensureAm03Library(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm03StudioView(ctx);
  if (hasAm03Library()) return;
  await importApiMockGallerySample(AM03_CORPUS_SAMPLE);
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

/** Close the filter popover when a previous step left it open. */
export async function closeAm03Filter(ctx: DemoActionContext): Promise<void> {
  if (!isAm03FilterOpen()) return;
  await ctx.click(API_MOCK.ROUTE_FILTER);
  await ctx.delay(AM_DEMO_TIMING.panelReady);
}

/** Guard — an empty search box, so the next step reads the whole tree. */
export async function ensureAm03SearchCleared(ctx: DemoActionContext): Promise<void> {
  await ensureAm03Library(ctx);
  if (am03SearchValue() === '') return;
  await ctx.fill(API_MOCK.ROUTE_SEARCH, '');
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/** Guard — drafts must be visible (the show-disabled filter may have hidden them). */
export async function ensureAm03DraftsVisible(ctx: DemoActionContext): Promise<void> {
  await ensureAm03SearchCleared(ctx);
  if (hasAm03DraftRows()) return;
  if (!isAm03FilterOpen()) {
    await ctx.click(API_MOCK.ROUTE_FILTER);
    await ctx.waitFor(API_MOCK.ROUTE_FILTER_PANEL, 4_000);
  }
  await ctx.click(API_MOCK.FILTER_SHOW_DISABLED);
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
  await closeAm03Filter(ctx);
}

/** Rename a folder through its inline editor (double-click, Enter commits). */
export async function renameAm03Folder(
  ctx: DemoActionContext,
  from: string,
  to: string,
): Promise<boolean> {
  const id = am03FolderId(from);
  if (!id) return false;
  const header = document.querySelector<HTMLElement>(API_MOCK.folderToggle(id));
  if (!header) return false;
  doubleClickFolder(header);
  await ctx.waitFor(API_MOCK.folderRenameInput(id), 4_000);
  const sel = API_MOCK.folderRenameInput(id);
  await ctx.fill(sel, to);
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
  document.querySelector<HTMLInputElement>(sel)
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
  return Boolean(am03FolderId(to));
}

/** Guard — the live-authored folder must exist, holding the rule the lesson moved. */
export async function ensureAm03NewFolder(ctx: DemoActionContext): Promise<void> {
  await ensureAm03DraftsVisible(ctx);
  if (!am03FolderId(AM03_NEW_FOLDER)) {
    const pending = am03UnnamedFolder();
    if (pending) {
      await renameAm03Folder(ctx, pending, AM03_NEW_FOLDER);
    } else {
      await ctx.click(API_MOCK.ADD_FOLDER);
      await ctx.delay(AM_DEMO_TIMING.panelReady);
      const created = am03UnnamedFolder();
      if (created) await renameAm03Folder(ctx, created, AM03_NEW_FOLDER);
    }
  }
  const block = am03FolderBlock(AM03_NEW_FOLDER);
  const row = am03Row(AM03_MOVED_ROUTE);
  if (block && row && !block.contains(row)) {
    dragRowToFolder(row, block);
    await ctx.delay(AM_DEMO_TIMING.panelReady);
  }
}

/** Select a rule row and wait for its editor. */
export async function selectAm03Route(ctx: DemoActionContext, ref: RouteRef): Promise<boolean> {
  const sel = am03RowSelector(ref);
  if (!sel) return false;
  await ctx.click(sel);
  await ctx.waitFor(API_MOCK.ROUTE_EDITOR, 10_000);
  return true;
}

/** Guard — the toggle step needs its rule open in the editor and enabled. */
export async function ensureAm03ToggleTarget(ctx: DemoActionContext): Promise<void> {
  await ensureAm03NewFolder(ctx);
  await selectAm03Route(ctx, AM03_TOGGLE_ROUTE);
  if (isAm03SelectedRuleEnabled()) return;
  if (!firstVisibleElement(API_MOCK.ROUTE_ENABLED)) return;
  await ctx.click(API_MOCK.ROUTE_ENABLED);
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
}

/** Guard — the delete step needs a draft row to remove and restore. */
export async function ensureAm03DeleteTarget(ctx: DemoActionContext): Promise<void> {
  await ensureAm03NewFolder(ctx);
  const sel = am03RowSelector(AM03_DELETE_ROUTE);
  if (sel) await ctx.click(sel);
}

/** Guard — the docs step needs its rule open on the Documentation tab. */
export async function ensureAm03DocsTarget(ctx: DemoActionContext): Promise<void> {
  await ensureAm03NewFolder(ctx);
  await selectAm03Route(ctx, AM03_DOCS_ROUTE);
  if (isAm03DocsTabActive()) return;
  if (!firstVisibleElement(API_MOCK.BTAB_DOCS)) return;
  await ctx.click(API_MOCK.BTAB_DOCS);
  await ctx.waitFor(API_MOCK.DOCS_TAGS, 6_000);
}

/** Guard — the closing step reads a tally and a conflict count, so the tree must be whole. */
export async function ensureAm03Tally(ctx: DemoActionContext): Promise<void> {
  await ensureAm03NewFolder(ctx);
  await closeAm03Filter(ctx);
}

// ── Multi-beat step bodies ──────────────────────────────────────────────────

/** Step 1 — read the tree: counts, folders, method chip, path, priority, tally. */
export async function runAm03ExplorerTour(ctx: DemoActionContext): Promise<void> {
  await spotlightBeat(ctx, API_MOCK.RULES_COUNT, AM_DEMO_TIMING.payoff);
  for (const name of AM03_CORPUS_FOLDERS) {
    const id = am03FolderId(name);
    if (id) await spotlightBeat(ctx, API_MOCK.folderToggle(id), AM_DEMO_TIMING.look);
  }
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await spotlightBeat(ctx, API_MOCK.ROUTE_METHOD_CHIP, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.ROUTE_PATH, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.ROUTE_PRIORITY_BADGE, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  const cart = am03FolderId('Cart');
  if (cart) {
    await clickBeat(ctx, API_MOCK.folderToggle(cart), { hold: AM_DEMO_TIMING.payoff });
    await clickBeat(ctx, API_MOCK.folderToggle(cart), { look: 0, hold: AM_DEMO_TIMING.panelReady });
  }
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.payoff);
}

/** Step 2 — search narrows on path and name, then on tag, then restores. */
export async function runAm03Search(ctx: DemoActionContext): Promise<void> {
  await fillBeat(ctx, API_MOCK.ROUTE_SEARCH, AM03_SEARCH_TERM, { hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await fillBeat(ctx, API_MOCK.ROUTE_SEARCH, AM03_TAG_TERM, { look: 0, hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await fillBeat(ctx, API_MOCK.ROUTE_SEARCH, 'zzz-no-match', { look: 0, hold: AM_DEMO_TIMING.fieldFilled });
  await revealBeat(ctx, API_MOCK.ROUTES_NO_MATCH, { timeout: 4_000, hold: AM_DEMO_TIMING.payoff });
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await ctx.fill(API_MOCK.ROUTE_SEARCH, '');
  await revealBeat(ctx, API_MOCK.ROUTE_ROW, { timeout: 4_000, hold: AM_DEMO_TIMING.panelReady });
  await spotlightBeat(ctx, API_MOCK.RULES_COUNT, AM_DEMO_TIMING.payoff);
}

/** Step 3 — the filter popover: hide drafts, then narrow by method. */
export async function runAm03Filters(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.ROUTE_FILTER, { hold: 0 });
  await revealBeat(ctx, API_MOCK.ROUTE_FILTER_PANEL, { timeout: 6_000, hold: AM_DEMO_TIMING.panelReady });
  await spotlightBeat(ctx, API_MOCK.FILTER_SHOW_DISABLED, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.FILTER_CONFLICTS_ONLY, AM_DEMO_TIMING.look);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await spotlightBeat(ctx, API_MOCK.DRAFT_ROUTE, AM_DEMO_TIMING.look);
  await clickBeat(ctx, API_MOCK.FILTER_SHOW_DISABLED, { look: 0, hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
  await clickBeat(ctx, API_MOCK.FILTER_SHOW_DISABLED, { look: 0, hold: AM_DEMO_TIMING.fieldFilled });
  await spotlightBeat(ctx, API_MOCK.DRAFT_ROUTE, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await ctx.selectOption(API_MOCK.FILTER_METHOD, 'POST');
  await ctx.delay(AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
  await ctx.selectOption(API_MOCK.FILTER_METHOD, 'ALL');
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
  await closeAm03Filter(ctx);
  await spotlightBeat(ctx, API_MOCK.RULES_COUNT, AM_DEMO_TIMING.payoff);
}

/** Step 4 — add a folder, name it, then drag a rule into it. */
export async function runAm03Folders(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.ADD_FOLDER, { hold: AM_DEMO_TIMING.panelReady });
  const pending = am03UnnamedFolder();
  if (pending) {
    const id = am03FolderId(pending);
    if (id) await spotlightBeat(ctx, API_MOCK.folderToggle(id), AM_DEMO_TIMING.payoff);
    await renameAm03Folder(ctx, pending, AM03_NEW_FOLDER);
  }
  const renamed = am03FolderId(AM03_NEW_FOLDER);
  if (renamed) await spotlightBeat(ctx, API_MOCK.folderToggle(renamed), AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  const rowSel = am03RowSelector(AM03_MOVED_ROUTE);
  if (rowSel) await spotlightBeat(ctx, rowSel, AM_DEMO_TIMING.look);
  const row = am03Row(AM03_MOVED_ROUTE);
  const block = am03FolderBlock(AM03_NEW_FOLDER);
  if (row && block) {
    dragRowToFolder(row, block);
    await ctx.delay(AM_DEMO_TIMING.payoff);
  }
  if (block) await spotlightBeat(ctx, API_MOCK.folderNamed(AM03_NEW_FOLDER), AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await spotlightBeat(ctx, API_MOCK.UNGROUPED_LABEL, AM_DEMO_TIMING.payoff);
}

/** Step 5 — disable keeps the rule but takes it out of matching. */
export async function runAm03EnableDisable(ctx: DemoActionContext): Promise<void> {
  const rowSel = am03RowSelector(AM03_TOGGLE_ROUTE);
  if (rowSel) await spotlightBeat(ctx, rowSel, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.look);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await clickBeat(ctx, API_MOCK.ROUTE_ENABLED, { hold: AM_DEMO_TIMING.payoff });
  if (rowSel) await spotlightBeat(ctx, rowSel, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.payoff);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await clickBeat(ctx, API_MOCK.ROUTE_ENABLED, { look: 0, hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.payoff);
}

/** Step 6 — delete a rule, then take it back inside the undo window. */
export async function runAm03DeleteUndo(ctx: DemoActionContext): Promise<void> {
  const rowSel = am03RowSelector(AM03_DELETE_ROUTE);
  const deleteSel = am03RowDeleteSelector(AM03_DELETE_ROUTE);
  if (rowSel) await spotlightBeat(ctx, rowSel, AM_DEMO_TIMING.look);
  if (!deleteSel) return;

  await clickBeat(ctx, deleteSel, { hold: 0 });
  await revealBeat(ctx, API_MOCK.CONFIRM_DIALOG, { timeout: 6_000, hold: AM_DEMO_TIMING.panelReady });
  await spotlightBeat(ctx, API_MOCK.CONFIRM_DIALOG, AM_DEMO_TIMING.payoff);
  await clickBeat(ctx, API_MOCK.CONFIRM_ACCEPT, { hold: AM_DEMO_TIMING.panelReady });
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await revealBeat(ctx, API_MOCK.UNDO_TOAST, { timeout: 6_000, hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.look);
  await clickBeat(ctx, API_MOCK.UNDO_RESTORE, { hold: AM_DEMO_TIMING.payoff });
  const restored = am03RowSelector(AM03_DELETE_ROUTE);
  await spotlightBeat(ctx, restored ?? API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
}

/** Step 7 — Documentation is contract metadata: summary, operationId, tags. */
export async function runAm03Docs(ctx: DemoActionContext): Promise<void> {
  await clickBeat(ctx, API_MOCK.BTAB_DOCS, { hold: 0 });
  await revealBeat(ctx, API_MOCK.DOCS_TAGS, { timeout: 6_000, hold: AM_DEMO_TIMING.tabSwitch });
  await spotlightBeat(ctx, API_MOCK.DOCS_FOLDER, AM_DEMO_TIMING.look);
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await fillBeat(ctx, API_MOCK.DOCS_SUMMARY, AM03_DOCS_SUMMARY, { hold: AM_DEMO_TIMING.fieldFilled });
  await spotlightBeat(ctx, API_MOCK.ROUTE_TITLE, AM_DEMO_TIMING.payoff);
  await fillBeat(ctx, API_MOCK.DOCS_OPERATION_ID, AM03_DOCS_OPERATION_ID, { hold: AM_DEMO_TIMING.fieldFilled });
  await fillBeat(ctx, API_MOCK.DOCS_TAGS, AM03_DOCS_TAGS, { hold: AM_DEMO_TIMING.payoff });
  await ctx.delay(AM_DEMO_TIMING.groupBreak);

  await fillBeat(ctx, API_MOCK.ROUTE_SEARCH, AM03_DOCS_TAG_PROBE, { hold: AM_DEMO_TIMING.payoff });
  await spotlightBeat(ctx, API_MOCK.ROUTE_EXPLORER, AM_DEMO_TIMING.payoff);
  await ctx.fill(API_MOCK.ROUTE_SEARCH, '');
  await ctx.delay(AM_DEMO_TIMING.fieldFilled);
  await spotlightBeat(ctx, API_MOCK.DOCS_TAGS, AM_DEMO_TIMING.payoff);
}

/**
 * Step 8 — tally, then Analyze. Analyze all switches to the Conflict Inspector,
 * so this step follows that view instead of waiting on the (now unmounted) explorer.
 */
export async function runAm03Health(ctx: DemoActionContext): Promise<void> {
  await spotlightBeat(ctx, API_MOCK.RULES_COUNT, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, AM_DEMO_TIMING.look);

  await clickBeat(ctx, API_MOCK.ANALYZE, { hold: AM_DEMO_TIMING.panelReady });
  await revealBeat(ctx, API_MOCK.CONFLICT_INSPECTOR, { timeout: 4_000, hold: AM_DEMO_TIMING.panelReady });
  await spotlightBeat(ctx, API_MOCK.CONFLICT_SUMMARY, AM_DEMO_TIMING.look);
  await spotlightBeat(ctx, API_MOCK.FIRST_FINDING, AM_DEMO_TIMING.payoff);
  await spotlightBeat(ctx, API_MOCK.CONFLICT_POLICY_EQUAL, AM_DEMO_TIMING.payoff);
}
