/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
}));

import {
  AM03_CORPUS_SAMPLE,
  AM03_DELETE_ROUTE,
  AM03_DOCS_OPERATION_ID,
  AM03_DOCS_ROUTE,
  AM03_DOCS_SUMMARY,
  AM03_DOCS_TAGS,
  AM03_MOVED_ROUTE,
  AM03_NEW_FOLDER,
  AM03_SEARCH_TERM,
  AM03_TOGGLE_ROUTE,
  am03FolderBlock,
  am03FolderBlocks,
  am03FolderId,
  am03FolderNames,
  am03Row,
  am03RowCount,
  am03RowDeleteSelector,
  am03RowId,
  am03RowMethod,
  am03RowPath,
  am03RowSelector,
  am03Rows,
  am03SearchValue,
  am03UnnamedFolder,
  cleanupAm03,
  closeAm03Filter,
  doubleClickFolder,
  dragRowToFolder,
  ensureAm03DeleteTarget,
  ensureAm03DocsTarget,
  ensureAm03DraftsVisible,
  ensureAm03Library,
  ensureAm03NewFolder,
  ensureAm03SearchCleared,
  ensureAm03StudioView,
  ensureAm03Tally,
  ensureAm03ToggleTarget,
  hasAm03Conflicts,
  hasAm03DraftRows,
  hasAm03Library,
  isAm03DocsTabActive,
  isAm03FilterOpen,
  isAm03SelectedRuleEnabled,
  isAm03StudioViewActive,
  prepareAm03Workspace,
  renameAm03Folder,
  runAm03DeleteUndo,
  runAm03Docs,
  runAm03EnableDisable,
  runAm03ExplorerTour,
  runAm03Filters,
  runAm03Folders,
  runAm03Health,
  runAm03Search,
  selectAm03Route,
} from './api-mock-am03-helpers';

// ── DOM builders (mirror ApiMockRouteExplorer markup closely enough) ─────────

interface RowSpec {
  id: string;
  method: string;
  path: string;
  priority?: number;
  disabled?: boolean;
  conflict?: boolean;
}

interface FolderSpec {
  id: string;
  name: string;
  rows?: RowSpec[];
}

interface ExplorerSpec {
  folders?: FolderSpec[];
  loose?: RowSpec[];
  conflicts?: number;
  filterOpen?: boolean;
  search?: string;
  noMatch?: boolean;
  ungrouped?: boolean;
}

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function buildRow(spec: RowSpec): HTMLElement {
  const wrap = el('div', 'am-tree-route-row');
  const row = el(
    'button',
    `am-route-item${spec.disabled ? ' disabled' : ''}${spec.conflict ? ' conflict' : ''}`,
    `api-mock-route-${spec.id}`,
  );
  row.setAttribute('role', 'treeitem');
  const method = el('span', `am-method ${spec.method.toLowerCase()}`);
  method.textContent = spec.method;
  const path = el('span', 'am-route-path');
  path.textContent = spec.path;
  const badge = el('span', `am-badge${spec.conflict ? ' warning' : ''}`);
  badge.textContent = `P${spec.priority ?? 10}`;
  row.append(method, path, badge);
  wrap.append(row, el('button', 'am-icon-btn am-route-delete', `api-mock-route-delete-${spec.id}`));
  return wrap;
}

function mountExplorer(spec: ExplorerSpec = {}): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');

  const head = el('div', 'am-panel-head');
  const count = el('span', 'am-count-badge', 'api-mock-rules-count');
  const rowTotal = (spec.folders ?? []).reduce((n, f) => n + (f.rows?.length ?? 0), 0)
    + (spec.loose?.length ?? 0);
  count.textContent = String(rowTotal);
  head.append(count);
  if (spec.conflicts) {
    const conflicts = el('span', 'am-count-badge warning', 'api-mock-conflicts-count');
    conflicts.textContent = String(spec.conflicts);
    head.append(conflicts);
  }
  head.append(el('button', 'am-icon-btn', 'api-mock-route-filter'));
  if (spec.filterOpen) {
    const panel = el('div', 'am-filter-popover', 'api-mock-route-filter-panel');
    panel.append(
      el('button', 'am-check-row', 'api-mock-filter-show-disabled'),
      el('button', 'am-check-row', 'api-mock-filter-conflicts-only'),
      el('div', 'cs-wrapper', 'api-mock-filter-method'),
    );
    head.append(panel);
  }
  explorer.append(head);

  const tools = el('div', 'am-route-tools');
  const search = document.createElement('input');
  search.setAttribute('data-testid', 'api-mock-route-search');
  search.value = spec.search ?? '';
  makeVisible(search);
  tools.append(search, el('button', 'am-icon-btn', 'api-mock-add-route'), el('button', 'am-icon-btn', 'api-mock-add-folder'));
  explorer.append(tools);

  const tree = el('div', 'am-route-tree');
  tree.setAttribute('role', 'tree');
  for (const folder of spec.folders ?? []) {
    const block = el('div', 'am-tree-folder-block', `api-mock-folder-${folder.id}`);
    block.setAttribute('data-folder-name', folder.name);
    const header = el('button', 'am-tree-folder', `api-mock-folder-toggle-${folder.id}`);
    const name = el('span', 'am-folder-name');
    name.textContent = folder.name;
    header.append(name);
    block.append(el('div', 'am-tree-folder-row').appendChild(header).parentElement!);
    for (const row of folder.rows ?? []) block.append(buildRow(row));
    tree.append(block);
  }
  if (spec.noMatch) tree.append(el('div', 'am-route-empty', 'api-mock-routes-no-match'));
  if (spec.ungrouped ?? (spec.folders?.length ?? 0) > 0) {
    const zone = el('div', 'am-ungrouped-zone', 'api-mock-ungrouped-zone');
    zone.append(el('div', 'am-tree-section-label', 'api-mock-ungrouped-label'));
    for (const row of spec.loose ?? []) zone.append(buildRow(row));
    tree.append(zone);
  } else {
    for (const row of spec.loose ?? []) tree.append(buildRow(row));
  }
  explorer.append(tree);

  const foot = el('div', 'am-panel-foot');
  const tally = el('span', 'am-faint', 'api-mock-routes-footer');
  tally.textContent = '10 enabled · 2 drafts';
  foot.append(tally, el('button', 'am-btn small ghost', 'api-mock-analyze'));
  explorer.append(foot);

  document.body.append(explorer);
}

function mountEditor(opts: { enabled?: boolean; docsOpen?: boolean } = {}): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  editor.append(el('div', 'am-route-title', 'api-mock-route-title'));
  const toggle = el('button', 'am-toggle', 'api-mock-route-enabled');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', opts.enabled === false ? 'false' : 'true');
  editor.append(toggle);
  const docsTab = el('button');
  docsTab.id = 'api-mock-btab-docs';
  editor.append(docsTab);
  if (opts.docsOpen) {
    for (const id of ['api-mock-docs-folder', 'api-mock-docs-summary', 'api-mock-docs-operation-id', 'api-mock-docs-tags']) {
      editor.append(el('input', 'am-input', id));
    }
  }
  document.body.append(editor);
}

function mount(...selectors: string[]): void {
  for (const sel of selectors) {
    const id = /data-testid="([^"]+)"/.exec(sel)?.[1];
    if (!id) continue;
    document.body.append(el('div', undefined, id));
  }
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

/** jsdom ships neither `DataTransfer` nor `DragEvent`; stub both and return a restore. */
function installDragApis(): () => void {
  const original = { DataTransfer: globalThis.DataTransfer, DragEvent: globalThis.DragEvent };
  class FakeDataTransfer {
    private data: Record<string, string> = {};
    effectAllowed = '';
    dropEffect = '';
    setData(type: string, value: string) { this.data[type] = value; }
    getData(type: string) { return this.data[type] ?? ''; }
  }
  class FakeDragEvent extends MouseEvent {
    dataTransfer: unknown;
    constructor(type: string, init: MouseEventInit & { dataTransfer?: unknown }) {
      super(type, init);
      this.dataTransfer = init.dataTransfer;
    }
  }
  Object.assign(globalThis, { DataTransfer: FakeDataTransfer, DragEvent: FakeDragEvent });
  return () => { Object.assign(globalThis, original); };
}

const CATALOG_ROWS: RowSpec[] = [
  { id: 'r-list-products', method: 'GET', path: '/products', priority: 10 },
  { id: 'r-search', method: 'GET', path: '/products/search', priority: 30, disabled: true },
  { id: 'r-reviews', method: 'GET', path: '/products/:id/reviews', priority: 20, disabled: true },
];
const CART_ROWS: RowSpec[] = [
  { id: 'r-cart', method: 'GET', path: '/cart', priority: 10 },
  { id: 'r-add-item', method: 'POST', path: '/cart/items', priority: 10 },
];
const ORDER_ROWS: RowSpec[] = [
  { id: 'r-create-order', method: 'POST', path: '/orders', priority: 10 },
  { id: 'r-get-order', method: 'GET', path: '/orders/:id', priority: 50, conflict: true },
  { id: 'r-latest-order', method: 'GET', path: '/orders/latest', priority: 50, conflict: true },
];

const LIBRARY: ExplorerSpec = {
  folders: [
    { id: 'f-catalog', name: 'Catalog', rows: CATALOG_ROWS },
    { id: 'f-cart', name: 'Cart', rows: CART_ROWS },
    { id: 'f-orders', name: 'Orders', rows: ORDER_ROWS },
  ],
};

describe('AM-03 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // ── row identity ──────────────────────────────────────────────────────────

  it('resolves rows by the method and path they render', () => {
    expect(am03Rows()).toEqual([]);
    expect(am03RowCount()).toBe(0);
    expect(am03Row(AM03_TOGGLE_ROUTE)).toBeNull();
    expect(am03RowSelector(AM03_TOGGLE_ROUTE)).toBeNull();
    expect(am03RowDeleteSelector(AM03_TOGGLE_ROUTE)).toBeNull();

    mountExplorer(LIBRARY);

    expect(am03RowCount()).toBe(8);
    const row = am03Row(AM03_TOGGLE_ROUTE)!;
    expect(am03RowPath(row)).toBe('/cart');
    expect(am03RowMethod(row)).toBe('GET');
    expect(am03RowId(row)).toBe('r-cart');
    expect(am03RowSelector(AM03_TOGGLE_ROUTE)).toBe(API_MOCK.route('r-cart'));
    expect(am03RowDeleteSelector(AM03_TOGGLE_ROUTE)).toBe(API_MOCK.routeDelete('r-cart'));
  });

  it('distinguishes two rules that share a path but differ by method', () => {
    mountExplorer({
      folders: [{
        id: 'f-cart',
        name: 'Cart',
        rows: [
          { id: 'r-patch', method: 'PATCH', path: '/cart/items/:itemId' },
          { id: 'r-delete', method: 'DELETE', path: '/cart/items/:itemId' },
        ],
      }],
    });

    expect(am03RowId(am03Row({ method: 'PATCH', path: '/cart/items/:itemId' })!)).toBe('r-patch');
    expect(am03RowId(am03Row({ method: 'DELETE', path: '/cart/items/:itemId' })!)).toBe('r-delete');
  });

  it('falls back to empty strings and a null id on unexpected markup', () => {
    const bare = document.createElement('div');
    expect(am03RowPath(bare)).toBe('');
    expect(am03RowMethod(bare)).toBe('');
    expect(am03RowId(bare)).toBeNull();
    bare.setAttribute('data-testid', 'something-else');
    expect(am03RowId(bare)).toBeNull();
  });

  // ── folder identity ───────────────────────────────────────────────────────

  it('reads folder names, ids, and the folder waiting to be renamed', () => {
    expect(am03FolderBlocks()).toEqual([]);
    expect(am03FolderNames()).toEqual([]);
    expect(am03FolderBlock('Catalog')).toBeNull();
    expect(am03FolderId('Catalog')).toBeNull();
    expect(am03UnnamedFolder()).toBeNull();

    mountExplorer({
      folders: [
        ...LIBRARY.folders!,
        { id: 'f-new', name: 'Folder 4' },
      ],
    });

    expect(am03FolderNames()).toEqual(['Catalog', 'Cart', 'Orders', 'Folder 4']);
    expect(am03FolderId('Cart')).toBe('f-cart');
    expect(am03UnnamedFolder()).toBe('Folder 4');
  });

  it('does not treat the lesson folder as unnamed once it is renamed', () => {
    mountExplorer({ folders: [...LIBRARY.folders!, { id: 'f-new', name: AM03_NEW_FOLDER }] });
    expect(am03UnnamedFolder()).toBeNull();
    expect(am03FolderId(AM03_NEW_FOLDER)).toBe('f-new');
  });

  it('tolerates folder blocks with a foreign testid or no name attribute', () => {
    const explorer = el('aside', undefined, 'api-mock-route-explorer');
    const stray = el('div', 'am-tree-folder-block', 'not-a-folder');
    stray.setAttribute('data-folder-name', 'Stray');
    explorer.append(stray, el('div', 'am-tree-folder-block', 'api-mock-folder-f-x'));
    document.body.append(explorer);

    expect(am03FolderId('Stray')).toBeNull();
    expect(am03FolderNames()).toEqual(['Stray', '']);
  });

  // ── state probes ──────────────────────────────────────────────────────────

  it('probes library, view, search, drafts, filter, and conflict state', () => {
    expect(hasAm03Library()).toBe(false);
    expect(isAm03StudioViewActive()).toBe(false);
    expect(am03SearchValue()).toBe('');
    expect(hasAm03DraftRows()).toBe(false);
    expect(isAm03FilterOpen()).toBe(false);
    expect(hasAm03Conflicts()).toBe(false);

    mountExplorer({ ...LIBRARY, conflicts: 2, filterOpen: true, search: AM03_SEARCH_TERM });

    expect(hasAm03Library()).toBe(true);
    expect(isAm03StudioViewActive()).toBe(true);
    expect(am03SearchValue()).toBe(AM03_SEARCH_TERM);
    expect(hasAm03DraftRows()).toBe(true);
    expect(isAm03FilterOpen()).toBe(true);
    expect(hasAm03Conflicts()).toBe(true);
  });

  it('counts a folderless tree with rows as a library, and the empty state as the Studio view', () => {
    mountExplorer({ loose: [{ id: 'r-1', method: 'GET', path: '/health' }], ungrouped: false });
    expect(hasAm03Library()).toBe(true);

    document.body.innerHTML = '';
    mount(API_MOCK.EMPTY);
    expect(isAm03StudioViewActive()).toBe(true);
  });

  it('reads the editor toggle and the Documentation tab', () => {
    expect(isAm03SelectedRuleEnabled()).toBe(false);
    expect(isAm03DocsTabActive()).toBe(false);

    mountEditor({ enabled: true });
    expect(isAm03SelectedRuleEnabled()).toBe(true);
    expect(isAm03DocsTabActive()).toBe(false);

    document.body.innerHTML = '';
    mountEditor({ enabled: false, docsOpen: true });
    expect(isAm03SelectedRuleEnabled()).toBe(false);
    expect(isAm03DocsTabActive()).toBe(true);
  });

  // ── raw-event primitives ──────────────────────────────────────────────────

  it('dispatches a double-click on a folder header', () => {
    mountExplorer(LIBRARY);
    const header = document.querySelector<HTMLElement>(API_MOCK.folderToggle('f-cart'))!;
    const dispatch = vi.spyOn(header, 'dispatchEvent');
    doubleClickFolder(header);
    expect((dispatch.mock.calls[0][0] as MouseEvent).type).toBe('dblclick');
  });

  describe('dragRowToFolder', () => {
    let restore = () => {};

    afterEach(() => {
      restore();
    });

    it('carries the payload from dragstart through to drop', () => {
      restore = installDragApis();

      mountExplorer({ folders: [...LIBRARY.folders!, { id: 'f-new', name: AM03_NEW_FOLDER }] });
      const row = am03Row(AM03_MOVED_ROUTE)!;
      const block = am03FolderBlock(AM03_NEW_FOLDER)!;
      const seen: string[] = [];
      for (const node of [row, block]) {
        for (const type of ['dragstart', 'dragover', 'drop', 'dragend']) {
          node.addEventListener(type, e => seen.push(e.type));
        }
      }

      expect(dragRowToFolder(row, block)).toBe(true);
      expect(seen).toEqual(['dragstart', 'dragover', 'drop', 'dragend']);
    });

    it('reports failure when the browser drag APIs are unavailable', () => {
      Object.assign(globalThis, { DataTransfer: undefined, DragEvent: undefined });
      mountExplorer(LIBRARY);
      const row = am03Row(AM03_TOGGLE_ROUTE)!;
      const block = am03FolderBlock('Cart')!;
      expect(dragRowToFolder(row, block)).toBe(false);
    });
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────

  it('boots with a wiped workspace plus the library corpus, and cleans up on exit', async () => {
    await prepareAm03Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM03_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    vi.clearAllMocks();
    await cleanupAm03();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it('returns to the Studio view only when the nav is mounted', async () => {
    const ctx = makeCtx();
    await ensureAm03StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();

    mount(API_MOCK.VIEW_STUDIO);
    await ensureAm03StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);

    vi.clearAllMocks();
    mountExplorer(LIBRARY);
    await ensureAm03StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('re-imports the corpus when the library is missing, and skips when present', async () => {
    const ctx = makeCtx();
    await ensureAm03Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM03_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    vi.clearAllMocks();
    mountExplorer(LIBRARY);
    await ensureAm03Library(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('closes the filter popover only when it is open', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await closeAm03Filter(ctx);
    expect(ctx.click).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    mountExplorer({ ...LIBRARY, filterOpen: true });
    await closeAm03Filter(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_FILTER);
  });

  it('clears a leftover search term before the next step reads the tree', async () => {
    const ctx = makeCtx();
    mountExplorer({ ...LIBRARY, search: 'cart' });
    await ensureAm03SearchCleared(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.ROUTE_SEARCH, '');

    vi.clearAllMocks();
    document.body.innerHTML = '';
    mountExplorer(LIBRARY);
    await ensureAm03SearchCleared(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('re-shows drafts through the filter popover when they are hidden', async () => {
    const ctx = makeCtx();
    mountExplorer({
      folders: [{ id: 'f-catalog', name: 'Catalog', rows: [CATALOG_ROWS[0]] }],
    });

    await ensureAm03DraftsVisible(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.ROUTE_FILTER,
      API_MOCK.FILTER_SHOW_DISABLED,
    ]);
  });

  it('leaves the filter alone when drafts are already visible', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await ensureAm03DraftsVisible(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('reuses an already-open filter popover, then closes it', async () => {
    const ctx = makeCtx();
    mountExplorer({
      folders: [{ id: 'f-catalog', name: 'Catalog', rows: [CATALOG_ROWS[0]] }],
      filterOpen: true,
    });

    await ensureAm03DraftsVisible(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.FILTER_SHOW_DISABLED,
      API_MOCK.ROUTE_FILTER,
    ]);
  });

  it('renames a folder through its inline editor', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [{ id: 'f-new', name: 'Folder 4' }] });
    const block = am03FolderBlock('Folder 4')!;
    // The product swaps the header for an input; stand that in on the fill.
    document.body.append(el('input', 'am-input am-folder-rename', 'api-mock-folder-rename-input-f-new'));
    vi.mocked(ctx.fill).mockImplementation(async (_sel: string, value: string) => {
      block.setAttribute('data-folder-name', value);
    });

    await expect(renameAm03Folder(ctx, 'Folder 4', AM03_NEW_FOLDER)).resolves.toBe(true);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.folderRenameInput('f-new'), AM03_NEW_FOLDER);
  });

  it('reports a failed rename when the folder or its header is gone', async () => {
    const ctx = makeCtx();
    await expect(renameAm03Folder(ctx, 'Folder 4', AM03_NEW_FOLDER)).resolves.toBe(false);

    mountExplorer(LIBRARY);
    document.querySelector(API_MOCK.folderToggle('f-cart'))!.remove();
    await expect(renameAm03Folder(ctx, 'Cart', AM03_NEW_FOLDER)).resolves.toBe(false);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('creates the lesson folder when the tree has none', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await ensureAm03NewFolder(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_FOLDER);
  });

  it('renames the folder the Add click just created', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector !== API_MOCK.ADD_FOLDER) return;
      const block = el('div', 'am-tree-folder-block', 'api-mock-folder-f-new');
      block.setAttribute('data-folder-name', 'Folder 4');
      block.append(el('button', 'am-tree-folder', 'api-mock-folder-toggle-f-new'));
      document.querySelector('.am-route-tree')!.append(block);
      document.body.append(el('input', 'am-input am-folder-rename', 'api-mock-folder-rename-input-f-new'));
    });

    await ensureAm03NewFolder(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.folderRenameInput('f-new'), AM03_NEW_FOLDER);
  });

  it('renames a pending folder instead of adding another', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [...LIBRARY.folders!, { id: 'f-new', name: 'Folder 4' }] });
    document.body.append(el('input', 'am-input am-folder-rename', 'api-mock-folder-rename-input-f-new'));

    await ensureAm03NewFolder(ctx);

    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_FOLDER);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.folderRenameInput('f-new'), AM03_NEW_FOLDER);
  });

  it('drags the moved rule in when the lesson folder exists without it', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [...LIBRARY.folders!, { id: 'f-new', name: AM03_NEW_FOLDER }] });
    const row = am03Row(AM03_MOVED_ROUTE)!;
    const dispatch = vi.spyOn(row, 'dispatchEvent');

    await ensureAm03NewFolder(ctx);

    expect(ctx.click).not.toHaveBeenCalled();
    // jsdom has no DataTransfer, so the drag no-ops — the guard must still settle.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips the drag when the moved rule is already filed', async () => {
    const ctx = makeCtx();
    mountExplorer({
      folders: [
        { id: 'f-catalog', name: 'Catalog', rows: CATALOG_ROWS },
        { id: 'f-new', name: AM03_NEW_FOLDER, rows: [{ id: 'r-create-order', method: 'POST', path: '/orders' }] },
      ],
    });
    await ensureAm03NewFolder(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('selects a rule row and reports when it is not in the tree', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await expect(selectAm03Route(ctx, AM03_TOGGLE_ROUTE)).resolves.toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.route('r-cart'));
    await expect(selectAm03Route(ctx, { method: 'GET', path: '/nope' })).resolves.toBe(false);
  });

  it('re-enables the toggle target when a previous run left it disabled', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mountEditor({ enabled: false });

    await ensureAm03ToggleTarget(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.ROUTE_ENABLED);
  });

  it('leaves an already-enabled toggle target alone', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mountEditor({ enabled: true });

    await ensureAm03ToggleTarget(ctx);

    expect(calls(ctx.click)).not.toContain(API_MOCK.ROUTE_ENABLED);
  });

  it('skips the toggle guard entirely when no editor is mounted', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await ensureAm03ToggleTarget(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ROUTE_ENABLED);
  });

  it('opens the delete target row', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await ensureAm03DeleteTarget(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.route('r-reviews'));
  });

  it('opens the Documentation tab for the docs target, and skips when already there', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mountEditor({ enabled: false });

    await ensureAm03DocsTarget(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.BTAB_DOCS);

    vi.clearAllMocks();
    document.body.innerHTML = '';
    mountExplorer(LIBRARY);
    mountEditor({ docsOpen: true });
    await ensureAm03DocsTarget(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.BTAB_DOCS);
  });

  it('skips the docs guard entirely when no editor is mounted', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await ensureAm03DocsTarget(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.BTAB_DOCS);
  });

  it('closes a stray filter popover before the closing step', async () => {
    const ctx = makeCtx();
    mountExplorer({ ...LIBRARY, filterOpen: true });
    await ensureAm03Tally(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ROUTE_FILTER);
  });

  // ── step bodies ───────────────────────────────────────────────────────────

  it('step 1 tours counts, folders, row anatomy, and the tally', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);

    await runAm03ExplorerTour(ctx);

    // Collapse then re-expand the Cart folder so the viewer sees folders fold.
    expect(calls(ctx.click)).toEqual([
      API_MOCK.folderToggle('f-cart'),
      API_MOCK.folderToggle('f-cart'),
    ]);
  });

  it('step 1 still finishes when the corpus folders are missing', async () => {
    const ctx = makeCtx();
    mountExplorer({ loose: [CATALOG_ROWS[0]], ungrouped: false });
    await runAm03ExplorerTour(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step 2 probes path, tag, and no-match searches, then restores the tree', async () => {
    const ctx = makeCtx();
    mountExplorer({ ...LIBRARY, noMatch: true });

    await runAm03Search(ctx);

    const filled = vi.mocked(ctx.fill).mock.calls.map(c => c[1]);
    expect(filled).toEqual([AM03_SEARCH_TERM, 'smoke', 'zzz-no-match', '']);
  });

  it('step 3 hides then re-shows drafts and narrows by method', async () => {
    const ctx = makeCtx();
    mountExplorer({ ...LIBRARY, filterOpen: true });

    await runAm03Filters(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.ROUTE_FILTER,
      API_MOCK.FILTER_SHOW_DISABLED,
      API_MOCK.FILTER_SHOW_DISABLED,
      API_MOCK.ROUTE_FILTER,
    ]);
    expect(vi.mocked(ctx.selectOption).mock.calls.map(c => c[1])).toEqual(['POST', 'ALL']);
  });

  it('step 4 adds a folder, names it, then drags a rule in', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [...LIBRARY.folders!, { id: 'f-new', name: 'Folder 4' }] });
    document.body.append(el('input', 'am-input am-folder-rename', 'api-mock-folder-rename-input-f-new'));

    await runAm03Folders(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_FOLDER]);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.folderRenameInput('f-new'), AM03_NEW_FOLDER);
  });

  it('step 4 drags the rule in when the lesson folder is already named', async () => {
    const ctx = makeCtx();
    mountExplorer({
      folders: [
        { id: 'f-catalog', name: 'Catalog', rows: CATALOG_ROWS },
        { id: 'f-new', name: AM03_NEW_FOLDER },
      ],
      loose: [{ id: 'r-create-order', method: 'POST', path: '/orders' }],
    });
    const dropped = vi.fn();
    am03FolderBlock(AM03_NEW_FOLDER)!.addEventListener('drop', dropped);
    const restore = installDragApis();

    try {
      await runAm03Folders(ctx);
    } finally {
      restore();
    }

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it('step 4 finishes when the tree exposes no pending folder', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    await runAm03Folders(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_FOLDER]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 5 toggles the rule off and back on around the tally', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mountEditor({ enabled: true });

    await runAm03EnableDisable(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ROUTE_ENABLED, API_MOCK.ROUTE_ENABLED]);
  });

  it('step 6 deletes through the confirm, then restores from the undo toast', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mount(API_MOCK.CONFIRM_DIALOG, API_MOCK.CONFIRM_ACCEPT, API_MOCK.UNDO_TOAST, API_MOCK.UNDO_RESTORE);

    await runAm03DeleteUndo(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.routeDelete('r-reviews'),
      API_MOCK.CONFIRM_ACCEPT,
      API_MOCK.UNDO_RESTORE,
    ]);
  });

  it('step 6 falls back to the explorer when undo does not bring the row back', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mount(API_MOCK.CONFIRM_DIALOG, API_MOCK.CONFIRM_ACCEPT, API_MOCK.UNDO_TOAST, API_MOCK.UNDO_RESTORE);
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector !== API_MOCK.CONFIRM_ACCEPT) return;
      am03Row(AM03_DELETE_ROUTE)?.closest('.am-tree-route-row')?.remove();
    });

    await runAm03DeleteUndo(ctx);

    expect(am03Row(AM03_DELETE_ROUTE)).toBeNull();
    expect(calls(ctx.click)).toContain(API_MOCK.UNDO_RESTORE);
  });

  it('step 6 bails out when the draft row is already gone', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [{ id: 'f-catalog', name: 'Catalog', rows: [CATALOG_ROWS[0]] }] });
    await runAm03DeleteUndo(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step 7 fills summary, operationId, and tags, then proves search finds the tag', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mountEditor({ docsOpen: true });

    await runAm03Docs(ctx);

    expect(vi.mocked(ctx.fill).mock.calls).toEqual([
      [API_MOCK.DOCS_SUMMARY, AM03_DOCS_SUMMARY],
      [API_MOCK.DOCS_OPERATION_ID, AM03_DOCS_OPERATION_ID],
      [API_MOCK.DOCS_TAGS, AM03_DOCS_TAGS],
      [API_MOCK.ROUTE_SEARCH, 'regression'],
      [API_MOCK.ROUTE_SEARCH, ''],
    ]);
  });

  it('step 8 analyzes and lands on the Conflict Inspector', async () => {
    const ctx = makeCtx();
    mountExplorer(LIBRARY);
    mount(API_MOCK.CONFLICTS_PAGE, API_MOCK.CONFLICT_INSPECTOR, API_MOCK.CONFLICT_SUMMARY, API_MOCK.CONFLICT_POLICY_EQUAL);
    const list = el('div', undefined, 'api-mock-conflict-list');
    const finding = el('button', undefined, 'api-mock-finding-orders');
    makeVisible(finding);
    list.append(finding);
    document.body.append(list);

    await runAm03Health(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ANALYZE]);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.CONFLICT_INSPECTOR, 4_000);
  });

  it('step 8 finishes on a library with no flagged rows', async () => {
    const ctx = makeCtx();
    mountExplorer({ folders: [{ id: 'f-cart', name: 'Cart', rows: CART_ROWS }] });
    await runAm03Health(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ANALYZE]);
  });

  it('exposes the delete and docs targets the narration names', () => {
    expect(AM03_DELETE_ROUTE).toEqual({ method: 'GET', path: '/products/:id/reviews' });
    expect(AM03_DOCS_ROUTE).toEqual({ method: 'GET', path: '/products/search' });
  });
});
