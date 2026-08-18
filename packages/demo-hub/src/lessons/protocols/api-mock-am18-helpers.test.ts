/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"products":[]}' }));
const patchApiMockServerSettings = vi.fn(() => true);
const deleteCollectionsByName = vi.fn(() => 0);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  patchApiMockServerSettings: (...a: unknown[]) => patchApiMockServerSettings(...(a as [])),
  deleteCollectionsByName: (...a: unknown[]) => deleteCollectionsByName(...(a as [])),
}));

import {
  AM18_CORPUS_SAMPLE,
  AM18_FILTER,
  AM18_FILTER_MISS,
  AM18_MATCH_ITEM,
  AM18_MATCH_LIST,
  AM18_MISS_PATH,
  AM18_TIMING,
  AM18_END_TIMING,
  am18FilterValue,
  am18PathInputValue,
  am18RowWithPath,
  am18TxOutcome,
  cleanupAm18,
  closeAm18Simulate,
  ensureAm18ForClosestMatch,
  ensureAm18ForCreateRoute,
  ensureAm18ForFilter,
  ensureAm18ForMiss,
  ensureAm18ForProve,
  ensureAm18ForSaveExample,
  ensureAm18ForShare,
  ensureAm18Library,
  ensureAm18OnApiMock,
  ensureAm18Running,
  ensureAm18StudioView,
  hasAm18CreatedRoute,
  hasAm18Example,
  hasAm18Library,
  hasAm18MissRow,
  hasAm18NearMisses,
  hasAm18Server,
  hasAm18Traffic,
  isAm18FilterEmptyState,
  isAm18JournalEmpty,
  isAm18OnRequests,
  isAm18RuntimeViewActive,
  isAm18ServerRunning,
  isAm18SimulateOpen,
  isAm18StudioViewActive,
  prepareAm18Workspace,
  runAm18ClosestMatch,
  runAm18CreateRoute,
  runAm18Filter,
  runAm18JournalTour,
  runAm18ProveExample,
  runAm18SaveExample,
  runAm18ShareAndReset,
  runAm18TheMiss,
} from './api-mock-am18-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function mountServerBar(running: boolean, extras: { apply?: boolean; address?: boolean } = {}): HTMLElement {
  const bar = el('div', undefined, 'api-mock-server-bar');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status, el('button', undefined, running ? 'api-mock-stop' : 'api-mock-start'));
  if (extras.apply) bar.append(el('button', undefined, 'api-mock-apply'));
  if (extras.address) {
    const addr = el('span', undefined, 'api-mock-address');
    addr.textContent = 'http://127.0.0.1:4600';
    bar.append(addr);
  }
  document.body.append(bar);
  document.body.append(el('button', undefined, 'api-mock-view-studio'));
  document.body.append(el('button', undefined, 'api-mock-view-runtime'));
  document.body.append(el('button', undefined, 'api-mock-live-transactions'));
  return bar;
}

function mountExplorer(opts: { drafts?: boolean; missPath?: boolean } = {}): HTMLElement {
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-list');
  row.setAttribute('role', 'treeitem');
  const path = el('span', 'am-route-path');
  path.textContent = '/products';
  row.append(path);
  explorer.append(row);
  if (opts.drafts || opts.missPath) {
    const draft = el('button', 'am-route-item disabled', 'api-mock-route-draft-miss');
    draft.setAttribute('role', 'treeitem');
    const dpath = el('span', 'am-route-path');
    dpath.textContent = AM18_MISS_PATH;
    draft.append(dpath);
    explorer.append(draft);
  }
  document.body.append(explorer);
  return explorer;
}

function mountJournal(opts: {
  rows?: Array<{ id: string; path: string }>;
  detail?: boolean;
  unmatched?: boolean;
  created?: boolean;
  saved?: boolean;
  empty?: boolean;
  filterEmpty?: boolean;
  guide?: boolean;
} = {}): void {
  const page = el('div', undefined, 'api-mock-runtime-page');
  const dock = el('div', undefined, 'api-mock-dock');
  dock.append(
    el('button', undefined, 'api-mock-dock-tab-transactions'),
    el('button', undefined, 'api-mock-dock-tab-settings'),
  );
  if (opts.guide) {
    dock.append(el('div', undefined, 'api-mock-runtime-guide'));
    page.append(dock);
    document.body.append(page);
    return;
  }
  if (opts.empty) {
    dock.append(el('div', undefined, 'api-mock-dock-transactions-empty'));
    page.append(dock);
    document.body.append(page);
    return;
  }
  const toolbar = el('div', undefined, 'api-mock-journal-toolbar');
  const filter = document.createElement('input');
  filter.setAttribute('data-testid', 'api-mock-journal-filter');
  makeVisible(filter);
  toolbar.append(filter, el('button', undefined, 'api-mock-journal-export'), el('button', undefined, 'api-mock-journal-clear'));
  dock.append(toolbar);
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  if (opts.filterEmpty) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('data-testid', 'api-mock-journal-filter-empty');
    td.textContent = 'No transactions match this filter.';
    makeVisible(td);
    tr.append(td);
    tbody.append(tr);
  } else {
    const rows = opts.rows ?? [
      { id: 'tx-2', path: AM18_MATCH_ITEM },
      { id: 'tx-1', path: AM18_MATCH_LIST },
    ];
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-testid', `api-mock-tx-${r.id}`);
      makeVisible(tr);
      const path = el('td', 'am-tx-path');
      path.textContent = r.path;
      tr.append(path);
      tbody.append(tr);
    }
  }
  table.append(tbody);
  dock.append(table);
  if (opts.detail || opts.unmatched || opts.created || opts.saved) {
    const detail = el('div', undefined, 'api-mock-tx-detail');
    const outcome = el('span', undefined, 'api-mock-tx-outcome');
    outcome.textContent = opts.unmatched ? 'unmatched' : 'matched';
    detail.append(outcome);
    detail.append(el('div', undefined, 'api-mock-tx-response'));
    if (opts.unmatched) {
      detail.append(el('div', undefined, 'api-mock-tx-candidates'));
      const nearMisses = el('ul', undefined, 'api-mock-tx-near-misses');
      for (const name of ['List Products', 'Get Product by ID', 'Get Cart', 'List Orders']) {
        const li = document.createElement('li');
        makeVisible(li);
        li.textContent = name;
        nearMisses.append(li);
      }
      detail.append(nearMisses);
    }
    const actions = el('div', undefined, 'api-mock-tx-actions');
    actions.append(
      el('button', undefined, 'api-mock-tx-open-requests'),
      el('button', undefined, 'api-mock-tx-create-route'),
      el('button', undefined, 'api-mock-tx-save-example'),
      el('button', undefined, 'api-mock-tx-copy'),
    );
    detail.append(actions);
    if (opts.created) {
      detail.append(el('div', undefined, 'api-mock-tx-notice'));
      detail.append(el('button', undefined, 'api-mock-tx-open-created'));
    }
    if (opts.saved) {
      detail.append(el('div', undefined, 'api-mock-tx-notice'));
    }
    dock.append(detail);
  }
  page.append(dock);
  document.body.append(page);
}

function mountRuntimeSettings(): void {
  const panel = el('div', undefined, 'api-mock-runtime-settings-panel');
  const select = document.createElement('select');
  select.setAttribute('data-testid', 'api-mock-runtime-settings-fallback');
  const opt = document.createElement('option');
  opt.value = 'closest_match_debug';
  opt.textContent = 'Closest match debug';
  select.append(opt);
  makeVisible(select);
  panel.append(select, el('button', undefined, 'api-mock-runtime-settings-save'));
  document.body.append(panel);
}

function mountEditor(opts: { examples?: boolean; simulate?: boolean; missPath?: boolean } = {}): void {
  const editor = el('div', undefined, 'api-mock-route-editor');
  const path = document.createElement('input');
  path.setAttribute('data-testid', 'api-mock-path-input');
  path.value = opts.missPath ? AM18_MISS_PATH : '/products';
  makeVisible(path);
  editor.append(path);
  editor.append(el('button', undefined, 'api-mock-btab-examples'));
  const examplesTab = document.createElement('button');
  examplesTab.id = 'api-mock-btab-examples';
  makeVisible(examplesTab);
  editor.append(examplesTab);
  if (opts.examples) {
    const grid = el('div', undefined, 'api-mock-examples-grid');
    grid.append(el('button', undefined, 'api-mock-example-simulate-s1'));
    editor.append(grid);
  }
  document.body.append(editor);
  if (opts.simulate) {
    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    document.body.append(el('button', undefined, 'api-mock-simulate-run'));
    document.body.append(el('div', undefined, 'api-mock-simulate-result'));
    const outcome = el('span', undefined, 'api-mock-sim-outcome');
    outcome.textContent = 'unmatched';
    document.body.append(outcome);
    document.body.append(el('button', undefined, 'api-mock-simulate-close'));
  }
}

beforeEach(() => {
  document.body.replaceChildren();
  wipeApiMockWorkspace.mockClear().mockResolvedValue(true);
  importApiMockGallerySample.mockClear().mockResolvedValue(true);
  prepareApiMockStudioChrome.mockClear();
  sendApiMockRequest.mockClear().mockResolvedValue({ status: 200, body: '{}' });
  patchApiMockServerSettings.mockClear().mockReturnValue(true);
  deleteCollectionsByName.mockClear().mockReturnValue(0);
});

describe('AM-18 helpers', () => {
  it('pins corpus paths, filter strings, and slower timing', () => {
    expect(AM18_CORPUS_SAMPLE).toBe('am-gallery-store-lite');
    expect(AM18_MATCH_LIST).toBe('/products');
    expect(AM18_MATCH_ITEM).toBe('/products/42');
    expect(AM18_MISS_PATH).toBe('/produts/42');
    expect(AM18_FILTER).toBe('products');
    expect(AM18_FILTER_MISS).toContain('zzzz');
    expect(AM18_TIMING.beforeOpen).toBe(1400);
    expect(AM18_TIMING.payoff).toBe(1600);
    expect(AM18_END_TIMING.payoff).toBe(850);
    expect(AM18_END_TIMING.beforeRun).toBeLessThan(AM18_TIMING.beforeRun);
  });

  it('reads probes from an empty document as false', () => {
    expect(isAm18StudioViewActive()).toBe(false);
    expect(isAm18RuntimeViewActive()).toBe(false);
    expect(hasAm18Server()).toBe(false);
    expect(hasAm18Library()).toBe(false);
    expect(isAm18ServerRunning()).toBe(false);
    expect(hasAm18Traffic()).toBe(false);
    expect(isAm18JournalEmpty()).toBe(false);
    expect(isAm18FilterEmptyState()).toBe(false);
    expect(am18FilterValue()).toBe('');
    expect(am18TxOutcome()).toBe('');
    expect(am18PathInputValue()).toBe('');
    expect(hasAm18CreatedRoute()).toBe(false);
    expect(hasAm18NearMisses()).toBe(false);
    expect(hasAm18Example()).toBe(false);
    expect(isAm18SimulateOpen()).toBe(false);
    expect(isAm18OnRequests()).toBe(false);
    expect(hasAm18MissRow()).toBe(false);
    expect(am18RowWithPath(AM18_MISS_PATH)).toBeUndefined();
  });

  it('reads probes from a mounted studio and journal', () => {
    mountServerBar(true, { address: true });
    mountExplorer({ missPath: true });
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountEditor({ examples: true, simulate: true, missPath: true });

    expect(hasAm18Server()).toBe(true);
    expect(isAm18StudioViewActive()).toBe(true);
    expect(isAm18RuntimeViewActive()).toBe(true);
    expect(isAm18ServerRunning()).toBe(true);
    expect(hasAm18Library()).toBe(true);
    expect(hasAm18Traffic()).toBe(true);
    expect(hasAm18MissRow()).toBe(true);
    expect(hasAm18NearMisses()).toBe(true);
    expect(hasAm18CreatedRoute()).toBe(true);
    expect(hasAm18Example()).toBe(true);
    expect(isAm18SimulateOpen()).toBe(true);
    expect(am18TxOutcome()).toBe('unmatched');
    expect(am18PathInputValue()).toContain('produts');
  });

  it('detects empty journal, filter empty, and Requests', () => {
    mountJournal({ empty: true });
    expect(isAm18JournalEmpty()).toBe(true);
    document.body.replaceChildren();
    mountJournal({ guide: true });
    expect(isAm18JournalEmpty()).toBe(true);
    document.body.replaceChildren();
    mountJournal();
    expect(isAm18JournalEmpty()).toBe(false);
    document.body.replaceChildren();
    mountJournal({ filterEmpty: true });
    expect(isAm18FilterEmptyState()).toBe(true);
    document.body.replaceChildren();
    document.body.append(el('div', undefined, 'req-sidebar'));
    expect(isAm18OnRequests()).toBe(true);
    document.body.replaceChildren();
    document.body.append(el('button', undefined, 'nav-tab-requests'));
    expect(isAm18OnRequests()).toBe(true);
  });

  it('detects a created route from the explorer path when the editor is on another rule', () => {
    mountExplorer({ missPath: true });
    expect(hasAm18CreatedRoute()).toBe(true);
  });

  it('treats an open Simulate result as Simulate open', () => {
    document.body.append(el('div', undefined, 'api-mock-simulate-result'));
    expect(isAm18SimulateOpen()).toBe(true);
  });

  it('prepares the store library and wipes on cleanup', async () => {
    await prepareAm18Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM18_CORPUS_SAMPLE);
    // Step 6 "Open in Requests" leaves rows in this Requests collection — both
    // boot and cleanup must remove it so replays do not accumulate orphans.
    expect(deleteCollectionsByName).toHaveBeenCalledWith('API Mock Journal');
    await cleanupAm18();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
    expect(deleteCollectionsByName).toHaveBeenCalledTimes(2);
  });

  it('throws when the store library cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm18Workspace()).rejects.toThrow(/am-gallery-store/);
  });

  it('skips step bodies and guards when the studio is empty', async () => {
    const ctx = makeCtx();
    await ensureAm18OnApiMock(ctx);
    await ensureAm18StudioView(ctx);
    await ensureAm18Library(ctx);
    await ensureAm18Running(ctx);
    await closeAm18Simulate(ctx);
    await ensureAm18ForFilter(ctx);
    await ensureAm18ForMiss(ctx);
    await ensureAm18ForClosestMatch(ctx);
    await ensureAm18ForCreateRoute(ctx);
    await ensureAm18ForSaveExample(ctx);
    await ensureAm18ForShare(ctx);
    await ensureAm18ForProve(ctx);
    await runAm18JournalTour(ctx);
    await runAm18Filter(ctx);
    await runAm18TheMiss(ctx);
    await runAm18ClosestMatch(ctx);
    await runAm18CreateRoute(ctx);
    await runAm18SaveExample(ctx);
    await runAm18ShareAndReset(ctx);
    await runAm18ProveExample(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('navigates back to API Mock from Requests via the activity bar', async () => {
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm18OnApiMock(ctx);
    expect(ctx.click).toHaveBeenCalledWith(APP_AB);
  });
});

const APP_AB = '[data-testid="ab-protocols"]';

describe('AM-18 step bodies', () => {
  it('starts the listener and fetches two matching paths', async () => {
    mountServerBar(false, { address: true });
    mountExplorer();
    mountJournal();
    const ctx = makeCtx();
    await runAm18JournalTour(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM18_MATCH_LIST, method: 'GET' });
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM18_MATCH_ITEM, method: 'GET' });
  });

  it('skips Start when already running', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    mountJournal({ detail: true });
    const ctx = makeCtx();
    await runAm18JournalTour(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('fills the filter, shows empty, then restores the table', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ detail: true });
    const ctx = makeCtx();
    await runAm18Filter(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.JOURNAL_FILTER, AM18_FILTER);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.JOURNAL_FILTER, AM18_FILTER_MISS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.JOURNAL_FILTER, '');
  });

  it('fetches the typo and opens the unmatched row', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    mountJournal({
      unmatched: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    const ctx = makeCtx();
    await expect(runAm18TheMiss(ctx)).resolves.toBe(200);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM18_MISS_PATH, method: 'GET' });
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-tx-tx-miss"]');
  });

  it('returns null when the miss fetch is refused', async () => {
    sendApiMockRequest.mockResolvedValueOnce(null as never);
    const ctx = makeCtx();
    await expect(runAm18TheMiss(ctx)).resolves.toBeNull();
  });

  it('selects closest-match, saves, and refetches the typo', async () => {
    mountServerBar(true, { apply: true, address: true });
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountRuntimeSettings();
    const ctx = makeCtx();
    await runAm18ClosestMatch(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_FALLBACK, 'closest_match_debug');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_SAVE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: AM18_MISS_PATH, method: 'GET' });
  });

  it('creates a route and opens it in Studio', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({
      unmatched: true,
      created: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    mountEditor({ missPath: true });
    const ctx = makeCtx();
    await runAm18CreateRoute(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_CREATE_ROUTE);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.TX_OPEN_CREATED, expect.any(Number));
    expect(ctx.delay).toHaveBeenCalledWith(AM18_TIMING.simOutcome);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_OPEN_CREATED);
  });

  it('rings Open in Studio even when the button reports a zero box', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({
      unmatched: true,
      created: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    mountEditor({ missPath: true });
    const btn = document.querySelector<HTMLElement>('[data-testid="api-mock-tx-open-created"]');
    expect(btn).toBeTruthy();
    btn!.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => '{}',
    } as DOMRect);
    const ctx = makeCtx();
    await runAm18CreateRoute(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(AM18_TIMING.simOutcome);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_OPEN_CREATED);
  });

  it('saves an example, opens Requests, and returns to the Examples grid', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountJournal({
      unmatched: true,
      saved: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    mountEditor({ examples: true, missPath: true });
    document.body.append(el('div', undefined, 'req-sidebar'));
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await runAm18SaveExample(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_SAVE_EXAMPLE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_OPEN_REQUESTS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APP_SUBNAV);
  });

  it('copies, exports, and clears the journal', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ detail: true });
    const ctx = makeCtx();
    await runAm18ShareAndReset(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_COPY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.JOURNAL_EXPORT);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.JOURNAL_CLEAR);
  });

  it('simulates the saved example', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountEditor({ examples: true, simulate: true, missPath: true });
    const ctx = makeCtx();
    await runAm18ProveExample(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.BTAB_EXAMPLES);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXAMPLE_SIMULATE);
    // The example must actually be run so the green verdict appears.
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
  });
});

describe('AM-18 guards', () => {
  it('clicks Start when the listener is stopped', async () => {
    mountServerBar(false);
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm18Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('does not re-import a library that is already open', async () => {
    mountServerBar(true);
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm18Library(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('re-imports the store library when the explorer is missing', async () => {
    mountServerBar(true);
    const ctx = makeCtx();
    await ensureAm18Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM18_CORPUS_SAMPLE);
  });

  it('leaves fallback configuration untouched during preparation', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    const ctx = makeCtx();
    await ensureAm18ForClosestMatch(ctx);
    expect(patchApiMockServerSettings).not.toHaveBeenCalledWith({ fallbackMode: 'closest_match_debug' });
  });

  it('leaves the open runtime settings panel for the visible step', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountRuntimeSettings();
    const ctx = makeCtx();
    await ensureAm18ForClosestMatch(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_FALLBACK, 'closest_match_debug');
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RUNTIME_SETTINGS_SAVE);
  });

  it('clicks Create route when the draft is missing', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ unmatched: true, created: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    const ctx = makeCtx();
    await ensureAm18ForSaveExample(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_CREATE_ROUTE);
  });

  it('clicks Save as example when the grid is missing', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountJournal({ unmatched: true, saved: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountEditor({ missPath: true });
    const ctx = makeCtx();
    await ensureAm18ForShare(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_SAVE_EXAMPLE);
  });

  it('closes an open Simulate modal', async () => {
    mountEditor({ simulate: true });
    const ctx = makeCtx();
    await closeAm18Simulate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('does not open Runtime Settings when the create-route journal is already open', async () => {
    mountServerBar(true);
    mountJournal({
      unmatched: true,
      detail: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    const ctx = makeCtx();
    await ensureAm18ForCreateRoute(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.DOCK_TAB_SETTINGS);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
    expect(patchApiMockServerSettings).toHaveBeenCalledWith({ fallbackMode: 'closest_match_debug' });
  });

  it('does not bounce Runtime back through Studio when the journal is already open', async () => {
    mountServerBar(true);
    mountJournal({
      detail: true,
      rows: [
        { id: 'tx-1', path: AM18_MATCH_LIST },
        { id: 'tx-2', path: AM18_MATCH_ITEM },
      ],
    });
    const ctx = makeCtx();
    await ensureAm18ForMiss(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
    expect(hasAm18Library()).toBe(true);
  });

  it('clears a leftover journal filter', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal();
    const filter = document.querySelector('[data-testid="api-mock-journal-filter"]') as HTMLInputElement;
    filter.value = AM18_FILTER_MISS;
    const ctx = makeCtx();
    await ensureAm18ForFilter(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.JOURNAL_FILTER, '');
  });

  it('uses navigateToTab when the API Mock subnav is missing', async () => {
    document.body.append(el('div', undefined, 'req-sidebar'));
    const ctx = makeCtx();
    await ensureAm18OnApiMock(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('opens Runtime from the view switcher when the live strip is missing', async () => {
    mountServerBar(true);
    mountExplorer();
    document.querySelector('[data-testid="api-mock-live-transactions"]')?.remove();
    const ctx = makeCtx();
    await runAm18Filter(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
  });

  it('skips waitFor when a quiet re-import fails', async () => {
    mountServerBar(true);
    importApiMockGallerySample.mockResolvedValueOnce(false);
    const ctx = makeCtx();
    await ensureAm18Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM18_CORPUS_SAMPLE);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(API_MOCK.ROUTE_ROW, 10_000);
  });

  it('leaves Simulate alone when the close button is missing', async () => {
    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    const ctx = makeCtx();
    await closeAm18Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('opens the journal from the live strip when Runtime is not mounted', async () => {
    mountServerBar(true);
    mountExplorer();
    const ctx = makeCtx();
    await runAm18Filter(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('aims the Transactions dock tab during the journal tour', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    const page = el('div', undefined, 'api-mock-runtime-page');
    page.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    document.body.append(page);
    const ctx = makeCtx();
    await runAm18JournalTour(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('holds the dirty badge then Applies closest-match', async () => {
    mountServerBar(true, { apply: true, address: true });
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountRuntimeSettings();
    const dirty = el('span', undefined, 'api-mock-dirty-badge');
    dirty.textContent = 'Unsaved';
    document.body.append(dirty);
    const ctx = makeCtx();
    await runAm18ClosestMatch(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('opens Runtime Settings from the dock tab when the panel is closed', async () => {
    mountServerBar(true, { address: true });
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    const ctx = makeCtx();
    await runAm18ClosestMatch(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_SETTINGS);
  });

  it('does not quietly Apply during closest-match preparation', async () => {
    mountServerBar(true, { apply: true });
    mountExplorer();
    mountJournal({ unmatched: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    const ctx = makeCtx();
    await ensureAm18ForClosestMatch(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('selects the seeded draft when the editor is on another path', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountEditor({ examples: true, simulate: true });
    const ctx = makeCtx();
    await runAm18ProveExample(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-route-draft-miss"]');
  });

  it('saves an example from prove when the grid is missing', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountJournal({ unmatched: true, saved: true, rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }] });
    mountEditor({ missPath: true });
    const ctx = makeCtx();
    await ensureAm18ForProve(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.TX_SAVE_EXAMPLE);
  });

  it('opens the Examples tab quietly before the prove step reads', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountEditor({ missPath: true });
    const ctx = makeCtx();
    await ensureAm18ForProve(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_EXAMPLES);
  });

  it('selects a journal row before copy when the detail pane is closed', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal();
    const ctx = makeCtx();
    await runAm18ShareAndReset(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="api-mock-tx-tx-2"]');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.JOURNAL_CLEAR);
  });

  it('returns from Requests via navigateToTab when the API Mock tab is hidden', async () => {
    mountServerBar(true);
    mountExplorer({ missPath: true });
    mountJournal({
      unmatched: true,
      saved: true,
      rows: [{ id: 'tx-miss', path: AM18_MISS_PATH }],
    });
    mountEditor({ examples: true, missPath: true });
    document.body.append(el('button', undefined, 'nav-tab-requests'));
    const ctx = makeCtx();
    await runAm18SaveExample(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('reveals the dock empty state after clear when the Runtime guide is absent', async () => {
    mountServerBar(true);
    mountExplorer();
    mountJournal({ detail: true, empty: false });
    document.body.append(el('div', undefined, 'api-mock-dock-transactions-empty'));
    const ctx = makeCtx();
    await runAm18ShareAndReset(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
  });
});
