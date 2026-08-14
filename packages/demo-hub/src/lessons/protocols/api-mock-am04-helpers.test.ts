/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { AM_DEMO_TIMING } from './api-mock-demo-helpers';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const patchApiMockActiveRoute = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
}));

import {
  AM04_TIMING,
  AM04_ASSET_GLOB_PATH,
  AM04_ASSET_NARROW_PATTERN,
  AM04_ASSET_TEST_PATH,
  AM04_CORPUS_SAMPLE,
  AM04_LIBRARY_ENTRY,
  AM04_LIBRARY_QUERY,
  AM04_LITERAL_PATH,
  AM04_ORDER_LITERAL_PATH,
  AM04_ORDER_TEMPLATE_PATH,
  AM04_ORDER_TEST_PATH,
  AM04_PARAM_PATH,
  AM04_PRESET_GLOB,
  AM04_PRESET_NESTED,
  AM04_PRESET_SINGLE,
  AM04_REGEX_PATH,
  AM04_SIM_LITERAL_PATH,
  AM04_SIM_LOOSE_PATH,
  AM04_SIM_PARAM_PATH,
  am04PathKind,
  am04PathValue,
  am04ProductCandidateSelector,
  am04ProductRow,
  am04ProductRowSelector,
  am04Row,
  am04RowCount,
  am04RowId,
  am04RowPath,
  am04RowSelector,
  am04Rows,
  am04SampleRowIds,
  am04SimOutcome,
  cleanupAm04,
  closeAm04Simulate,
  closeAm04Toolbox,
  ensureAm04AssetRule,
  ensureAm04LiteralPath,
  ensureAm04OrderRule,
  ensureAm04ParamPath,
  ensureAm04ProductRuleOpen,
  ensureAm04ProofReady,
  ensureAm04RegexPath,
  ensureAm04RegexReady,
  ensureAm04StudioView,
  ensureAm04Workspace,
  hasAm04RouteEditor,
  hasAm04Workspace,
  isAm04SimulateOpen,
  isAm04StudioViewActive,
  isAm04ToolboxOpen,
  prepareAm04Workspace,
  runAm04ExactToParam,
  runAm04Generalize,
  runAm04Glob,
  runAm04ProveParam,
  runAm04ProveRegex,
  runAm04RegexLibrary,
  runAm04ToolboxTour,
} from './api-mock-am04-helpers';

// ── DOM builders (mirror the Studio markup closely enough) ───────────────────

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement('input');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

interface RowSpec { id: string; method: string; path: string }

function buildRow(spec: RowSpec): HTMLElement {
  const row = el('button', 'am-route-item', `api-mock-route-${spec.id}`);
  row.setAttribute('role', 'treeitem');
  const method = el('span', `am-method ${spec.method.toLowerCase()}`);
  method.textContent = spec.method;
  const path = el('span', 'am-route-path');
  path.textContent = spec.path;
  row.append(method, path);
  return row;
}

function mountExplorer(rows: RowSpec[] = []): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  explorer.append(el('button', 'am-icon-btn', 'api-mock-add-route'));
  const tree = el('div', 'am-route-tree');
  for (const row of rows) tree.append(buildRow(row));
  explorer.append(tree);
  document.body.append(explorer);
}

function mountEditor(opts: { path?: string; kind?: string } = {}): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  editor.append(input('api-mock-route-name', 'Get Product 42'));
  editor.append(input('api-mock-path-input', opts.path ?? AM04_LITERAL_PATH));
  const kind = el('span', 'am-badge info', 'api-mock-path-kind');
  kind.textContent = opts.kind ?? 'exact';
  editor.append(kind);
  editor.append(el('button', 'am-icon-btn', 'api-mock-path-toolbox'));
  editor.append(input('api-mock-priority-input', '10'));
  editor.append(el('button', 'am-btn', 'api-mock-simulate'));
  document.body.append(editor);
}

interface ToolboxSpec {
  segments?: number;
  sampleIds?: string[];
  foreignSampleRow?: boolean;
}

function mountToolbox(spec: ToolboxSpec = {}): void {
  const toolbox = el('div', 'am-pattern-toolbox', 'api-mock-pattern-toolbox');
  for (const id of ['regex', 'path', 'jsonpath', 'constraints']) {
    toolbox.append(el('button', 'am-builder-tab', `api-mock-toolbox-tab-${id}`));
  }
  for (const label of [AM04_PRESET_SINGLE, AM04_PRESET_NESTED, AM04_PRESET_GLOB]) {
    toolbox.append(el('button', 'am-pattern-entry', `api-mock-toolbox-preset-${label}`));
  }
  toolbox.append(el('div', 'cs-wrapper', 'api-mock-toolbox-kind'));
  toolbox.append(input('api-mock-toolbox-pattern', AM04_LITERAL_PATH));
  toolbox.append(el('button', 'am-toggle', 'api-mock-toolbox-ci'));
  toolbox.append(input('api-mock-toolbox-sample', AM04_LITERAL_PATH));
  toolbox.append(el('div', 'am-notice', 'api-mock-toolbox-result'));
  const segments = el('div', 'am-path-parts', 'api-mock-toolbox-segments');
  for (let i = 0; i < (spec.segments ?? 0); i++) {
    segments.append(el('button', 'am-path-part', `api-mock-toolbox-segment-${i}`));
  }
  toolbox.append(segments);
  toolbox.append(el('div', 'am-hint', 'api-mock-toolbox-suggested'));
  toolbox.append(el('div', 'am-detail-pane', 'api-mock-toolbox-extraction'));

  toolbox.append(input('api-mock-toolbox-library-search'));
  toolbox.append(el('button', 'am-pattern-entry', `api-mock-toolbox-lib-${AM04_LIBRARY_ENTRY}`));
  toolbox.append(input('api-mock-toolbox-regex', '^[0-9]+$'));
  toolbox.append(el('span', 'am-badge success', 'api-mock-toolbox-safety'));
  toolbox.append(el('label', 'am-chip', 'api-mock-toolbox-flag-ci'));
  toolbox.append(el('label', 'am-chip', 'api-mock-toolbox-flag-cs'));

  const list = el('div', 'am-sample-list');
  for (const id of spec.sampleIds ?? []) {
    const row = el('div', 'am-sample-row', `api-mock-toolbox-sample-row-${id}`);
    row.append(input(`api-mock-toolbox-sample-value-${id}`));
    list.append(row);
  }
  if (spec.foreignSampleRow) list.append(el('div', 'am-sample-row', 'not-a-sample-row'));
  toolbox.append(list);

  toolbox.append(el('button', 'am-btn', 'api-mock-toolbox-cancel'));
  toolbox.append(el('button', 'am-btn primary', 'api-mock-toolbox-apply'));
  document.body.append(toolbox);
}

function mountSimulate(opts: { outcome?: string; hasResult?: boolean; candidateId?: string } = {}): void {
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(input('api-mock-simulate-path'));
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-run'));
  workspace.append(el('button', 'am-btn', 'api-mock-simulate-close'));
  if (opts.hasResult) {
    workspace.append(el('button', 'am-builder-tab', 'api-mock-sim-view-request'));
    workspace.append(el('button', 'am-builder-tab', 'api-mock-sim-view-results'));
  }
  const result = el('div', 'am-sim-result', 'api-mock-simulate-result');
  const outcome = el('span', 'am-badge', 'api-mock-sim-outcome');
  outcome.textContent = opts.outcome ?? 'MATCHED';
  result.append(outcome);
  if (opts.candidateId) {
    result.append(el('div', 'am-candidate winner', `api-mock-sim-candidate-${opts.candidateId}`));
  }
  for (const id of ['trace', 'request', 'rendered']) {
    result.append(el('button', 'am-builder-tab', `api-mock-sim-tab-${id}`));
  }
  result.append(el('pre', 'am-code', 'api-mock-sim-normalized'));
  result.append(el('pre', 'am-code', 'api-mock-sim-rendered-body'));
  workspace.append(result);
  document.body.append(workspace);
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

const fills = (fn: unknown): Array<[string, string]> =>
  vi.mocked(fn as (s: string, v: string) => Promise<void>).mock.calls.map(c => [c[0], c[1]]);

const PRODUCT_ROW: RowSpec = { id: 'r-product', method: 'GET', path: AM04_LITERAL_PATH };
const PARAM_ROW: RowSpec = { id: 'r-product', method: 'GET', path: AM04_PARAM_PATH };
const ORDER_ROW: RowSpec = { id: 'r-order', method: 'GET', path: AM04_ORDER_TEMPLATE_PATH };
const ASSET_ROW: RowSpec = { id: 'r-asset', method: 'GET', path: AM04_ASSET_GLOB_PATH };

describe('AM-04 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
  });

  // ── row identity ──────────────────────────────────────────────────────────

  it('resolves rows by the path they render', () => {
    expect(am04Rows()).toEqual([]);
    expect(am04RowCount()).toBe(0);
    expect(am04Row(AM04_LITERAL_PATH)).toBeNull();
    expect(am04RowSelector(AM04_LITERAL_PATH)).toBeNull();
    expect(am04ProductRow()).toBeNull();
    expect(am04ProductRowSelector()).toBeNull();

    mountExplorer([PRODUCT_ROW, ORDER_ROW, ASSET_ROW]);

    expect(am04RowCount()).toBe(3);
    expect(am04RowPath(am04Row(AM04_ASSET_GLOB_PATH)!)).toBe(AM04_ASSET_GLOB_PATH);
    expect(am04RowId(am04Row(AM04_ORDER_TEMPLATE_PATH)!)).toBe('r-order');
    expect(am04RowSelector(AM04_LITERAL_PATH)).toBe(API_MOCK.route('r-product'));
  });

  it('tracks the products rule through every matcher form it wears', () => {
    for (const path of [AM04_LITERAL_PATH, AM04_PARAM_PATH, AM04_REGEX_PATH]) {
      document.body.innerHTML = '';
      mountExplorer([{ id: 'r-product', method: 'GET', path }, ASSET_ROW]);
      expect(am04RowPath(am04ProductRow()!)).toBe(path);
      expect(am04ProductRowSelector()).toBe(API_MOCK.route('r-product'));
      expect(am04ProductCandidateSelector()).toBe(API_MOCK.simCandidate('r-product'));
    }
  });

  it('falls back to the generic candidate list when the products row is gone', () => {
    expect(am04ProductCandidateSelector()).toBe(API_MOCK.SIMULATE_CANDIDATES);
    mountExplorer([ASSET_ROW]);
    expect(am04ProductCandidateSelector()).toBe(API_MOCK.SIMULATE_CANDIDATES);
  });

  it('returns empty strings and a null id on unexpected markup', () => {
    const bare = document.createElement('div');
    expect(am04RowPath(bare)).toBe('');
    expect(am04RowId(bare)).toBeNull();
    bare.setAttribute('data-testid', 'something-else');
    expect(am04RowId(bare)).toBeNull();
  });

  // ── state probes ──────────────────────────────────────────────────────────

  it('reads the matcher in the editor and the overlays around it', () => {
    expect(isAm04StudioViewActive()).toBe(false);
    expect(hasAm04Workspace()).toBe(false);
    expect(hasAm04RouteEditor()).toBe(false);
    expect(am04PathValue()).toBe('');
    expect(am04PathKind()).toBe('');
    expect(isAm04ToolboxOpen()).toBe(false);
    expect(isAm04SimulateOpen()).toBe(false);
    expect(am04SimOutcome()).toBe('');

    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    mountToolbox();
    mountSimulate({ outcome: 'UNMATCHED' });

    expect(isAm04StudioViewActive()).toBe(true);
    expect(hasAm04Workspace()).toBe(true);
    expect(hasAm04RouteEditor()).toBe(true);
    expect(am04PathValue()).toBe(AM04_PARAM_PATH);
    expect(am04PathKind()).toBe('parameterized');
    expect(isAm04ToolboxOpen()).toBe(true);
    expect(isAm04SimulateOpen()).toBe(true);
    expect(am04SimOutcome()).toBe('UNMATCHED');
  });

  it('treats the empty state as the Studio view', () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    expect(isAm04StudioViewActive()).toBe(true);
  });

  it('reads toolbox sample row ids off the DOM, ignoring foreign rows', () => {
    expect(am04SampleRowIds()).toEqual([]);
    mountToolbox({ sampleIds: ['p0', 'p1', 'f0', 'f1'], foreignSampleRow: true });
    expect(am04SampleRowIds()).toEqual(['p0', 'p1', 'f0', 'f1']);
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────

  it('boots on the one-literal corpus and cleans up by wiping', async () => {
    await prepareAm04Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM04_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    wipeApiMockWorkspace.mockClear();
    await cleanupAm04();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── overlay hygiene ───────────────────────────────────────────────────────

  it('closes the toolbox and Simulate only when they are open', async () => {
    const quiet = makeCtx();
    await closeAm04Toolbox(quiet);
    await closeAm04Simulate(quiet);
    expect(quiet.click).not.toHaveBeenCalled();

    mountToolbox();
    mountSimulate();
    const ctx = makeCtx();
    await closeAm04Toolbox(ctx);
    await closeAm04Simulate(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.TOOLBOX_CANCEL, API_MOCK.SIMULATE_CLOSE]);
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it('switches back to Studio only when another view is mounted', async () => {
    const missing = makeCtx();
    await ensureAm04StudioView(missing);
    expect(missing.click).not.toHaveBeenCalled();

    document.body.append(el('button', 'am-nav-btn', 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm04StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);

    mountExplorer([PRODUCT_ROW]);
    const already = makeCtx();
    await ensureAm04StudioView(already);
    expect(already.click).not.toHaveBeenCalled();
  });

  it('imports the corpus when the workspace is empty and skips when it is not', async () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    const empty = makeCtx();
    await ensureAm04Workspace(empty);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM04_CORPUS_SAMPLE);

    importApiMockGallerySample.mockClear();
    document.body.innerHTML = '';
    mountExplorer([PRODUCT_ROW]);
    await ensureAm04Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('opens the products rule, and bails when its row is not in the tree', async () => {
    mountExplorer([PRODUCT_ROW]);
    const ctx = makeCtx();
    await ensureAm04ProductRuleOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.route('r-product'));

    document.body.innerHTML = '';
    mountExplorer([ASSET_ROW]);
    const noRow = makeCtx();
    await ensureAm04ProductRuleOpen(noRow);
    expect(calls(noRow.click)).not.toContain(API_MOCK.route('r-product'));
  });

  it('skips reopening when the products rule is already in the editor', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    const ctx = makeCtx();
    await ensureAm04ProductRuleOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('pins the matcher shape for each stage, and never patches a matching path', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    await ensureAm04ParamPath(makeCtx());
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();

    await ensureAm04LiteralPath(makeCtx());
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ path: AM04_LITERAL_PATH, pathKind: 'exact' });

    await ensureAm04RegexPath(makeCtx());
    expect(patchApiMockActiveRoute).toHaveBeenLastCalledWith({ path: AM04_REGEX_PATH, pathKind: 'regex' });
  });

  it('falls back to typing the path when the quiet patch bridge is unavailable', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    const ctx = makeCtx();
    await ensureAm04RegexPath(ctx);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.PATH_INPUT, AM04_REGEX_PATH]);
  });

  it('authors the order and asset rules quietly when a step was skipped', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    const ctx = makeCtx();
    await ensureAm04AssetRule(ctx);
    expect(calls(ctx.click).filter(c => c === API_MOCK.ADD_ROUTE)).toHaveLength(2);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.PATH_INPUT, AM04_ORDER_TEMPLATE_PATH]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.PATH_INPUT, AM04_ASSET_GLOB_PATH]);
  });

  it('leaves already-authored rules alone', async () => {
    mountExplorer([PARAM_ROW, ORDER_ROW, ASSET_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    const ctx = makeCtx();
    await ensureAm04OrderRule(ctx);
    await ensureAm04AssetRule(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_ROUTE);
  });

  it('accepts the pre-generalized order literal as the order rule', async () => {
    mountExplorer([PARAM_ROW, { id: 'r-order', method: 'GET', path: AM04_ORDER_LITERAL_PATH }]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    const ctx = makeCtx();
    await ensureAm04OrderRule(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_ROUTE);
  });

  it('prepares the regex and proof steps with the full rule set', async () => {
    mountExplorer([PARAM_ROW, ORDER_ROW, ASSET_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    await ensureAm04RegexReady(makeCtx());
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();

    await ensureAm04ProofReady(makeCtx());
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ path: AM04_REGEX_PATH, pathKind: 'regex' });
  });

  // ── step bodies ───────────────────────────────────────────────────────────

  it('holds AM-04 spotlights longer than the shared pack', () => {
    expect(AM04_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM04_TIMING.fieldFilled).toBeGreaterThan(AM_DEMO_TIMING.fieldFilled);
    expect(AM04_TIMING.tabSwitch).toBeGreaterThan(AM_DEMO_TIMING.tabSwitch);
    expect(AM04_TIMING.panelReady).toBeGreaterThan(AM_DEMO_TIMING.panelReady);
    expect(AM04_TIMING.payoff).toBeGreaterThan(AM_DEMO_TIMING.payoff);
    expect(AM04_TIMING.groupBreak).toBeGreaterThan(AM_DEMO_TIMING.groupBreak);
    expect(AM04_TIMING.reviewForm).toBeGreaterThan(AM04_TIMING.payoff);
    expect(AM04_TIMING.beforeRun).toBeGreaterThan(AM04_TIMING.look);
  });

  it('step 1 rewrites the literal as a template', async () => {
    mountExplorer([PRODUCT_ROW]);
    mountEditor();

    const ctx = makeCtx();
    await runAm04ExactToParam(ctx);
    expect(fills(ctx.fill)).toEqual([[API_MOCK.PATH_INPUT, AM04_PARAM_PATH]]);
  });

  it('step 2 runs both probes and reports the loose match', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    mountSimulate({ hasResult: true, candidateId: 'r-product' });

    const ctx = makeCtx();
    const outcomes = await runAm04ProveParam(ctx);

    expect(fills(ctx.fill).map(f => f[1])).toEqual([AM04_SIM_PARAM_PATH, AM04_SIM_LOOSE_PATH]);
    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_REQUEST);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 2 opens Simulate when the modal is not up yet', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) mountSimulate();
    });
    await runAm04ProveParam(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    // No results pane yet on the first run, so no detour through Request.
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
  });

  it('step 3 tours three presets and cancels without applying', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    mountToolbox();

    const ctx = makeCtx();
    await runAm04ToolboxTour(ctx);

    const clicked = calls(ctx.click);
    expect(clicked).toEqual([
      API_MOCK.PATH_TOOLBOX,
      API_MOCK.toolboxPreset(AM04_PRESET_SINGLE),
      API_MOCK.toolboxPreset(AM04_PRESET_NESTED),
      API_MOCK.toolboxPreset(AM04_PRESET_GLOB),
      API_MOCK.TOOLBOX_CANCEL,
    ]);
    expect(clicked).not.toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 4 adds the recorded order rule, generalizes a segment, and applies', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    mountToolbox({ segments: 2 });

    const ctx = makeCtx();
    await runAm04Generalize(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.ADD_ROUTE);
    expect(calls(ctx.click)).toContain(API_MOCK.toolboxSegment(1));
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.PATH_INPUT, AM04_ORDER_LITERAL_PATH]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_PATTERN, AM04_ORDER_TEMPLATE_PATH]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_SAMPLE, AM04_ORDER_TEST_PATH]);
  });

  it('step 4 reopens the existing order rule instead of adding a duplicate', async () => {
    mountExplorer([PARAM_ROW, ORDER_ROW]);
    mountEditor({ path: AM04_ORDER_TEMPLATE_PATH, kind: 'parameterized' });
    mountToolbox({ segments: 2 });

    const ctx = makeCtx();
    await runAm04Generalize(ctx);

    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_ROUTE);
    expect(calls(ctx.click)).toContain(API_MOCK.route('r-order'));
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.PATH_INPUT, AM04_ORDER_LITERAL_PATH]);
  });

  it('step 5 contrasts one star with two before applying the glob', async () => {
    mountExplorer([PARAM_ROW, ORDER_ROW]);
    mountEditor({ path: AM04_ORDER_TEMPLATE_PATH, kind: 'parameterized' });
    mountToolbox();

    const ctx = makeCtx();
    await runAm04Glob(ctx);

    const patterns = fills(ctx.fill).filter(f => f[0] === API_MOCK.TOOLBOX_PATTERN).map(f => f[1]);
    expect(patterns).toEqual([AM04_ASSET_NARROW_PATTERN, AM04_ASSET_GLOB_PATH]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_SAMPLE, AM04_ASSET_TEST_PATH]);
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 6 picks a library pattern, anchors it, and re-points the pass samples', async () => {
    mountExplorer([PARAM_ROW, ORDER_ROW, ASSET_ROW]);
    mountEditor({ path: AM04_ASSET_GLOB_PATH, kind: 'glob' });
    mountToolbox({ sampleIds: ['p0', 'p1', 'f0', 'f1'] });

    const ctx = makeCtx();
    await runAm04RegexLibrary(ctx);

    const clicked = calls(ctx.click);
    expect(clicked).toContain(API_MOCK.route('r-product'));
    expect(clicked).toContain(API_MOCK.TOOLBOX_TAB_REGEX);
    expect(clicked).toContain(API_MOCK.toolboxLib(AM04_LIBRARY_ENTRY));
    expect(clicked).toContain(API_MOCK.TOOLBOX_FLAG_CI);
    expect(clicked).toContain(API_MOCK.TOOLBOX_FLAG_CS);
    expect(clicked).toContain(API_MOCK.TOOLBOX_APPLY);

    const filled = fills(ctx.fill);
    expect(filled).toContainEqual([API_MOCK.TOOLBOX_LIBRARY_SEARCH, AM04_LIBRARY_QUERY]);
    expect(filled).toContainEqual([API_MOCK.TOOLBOX_REGEX, AM04_REGEX_PATH]);
    expect(filled).toContainEqual([API_MOCK.toolboxSampleValue('p0'), '/products/42']);
    expect(filled).toContainEqual([API_MOCK.toolboxSampleValue('p1'), '/products/100234']);
    // Fail rows keep their values — they must stay non-matching paths.
    expect(filled.map(f => f[0])).not.toContain(API_MOCK.toolboxSampleValue('f0'));
  });

  it('step 6 survives a toolbox with no live sample rows', async () => {
    mountExplorer([PARAM_ROW]);
    mountEditor({ path: AM04_PARAM_PATH, kind: 'parameterized' });
    mountToolbox();

    const ctx = makeCtx();
    await runAm04RegexLibrary(ctx);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_REGEX, AM04_REGEX_PATH]);
  });

  it('step 6 works off the open editor when the products row cannot be resolved', async () => {
    mountExplorer([ASSET_ROW]);
    mountEditor({ path: AM04_ASSET_GLOB_PATH, kind: 'glob' });
    mountToolbox({ sampleIds: ['p0'] });

    const ctx = makeCtx();
    await runAm04RegexLibrary(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_TAB_REGEX);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.toolboxSampleValue('p0'), '/products/42']);
  });

  it('step 7 proves the rejection and the match, then closes Simulate', async () => {
    mountExplorer([{ id: 'r-product', method: 'GET', path: AM04_REGEX_PATH }, ORDER_ROW, ASSET_ROW]);
    mountEditor({ path: AM04_REGEX_PATH, kind: 'regex' });
    mountSimulate({ hasResult: true, outcome: 'UNMATCHED', candidateId: 'r-product' });

    const ctx = makeCtx();
    const outcomes = await runAm04ProveRegex(ctx);

    expect(fills(ctx.fill).map(f => f[1])).toEqual([AM04_SIM_LOOSE_PATH, AM04_SIM_LITERAL_PATH]);
    expect(outcomes).toEqual(['UNMATCHED', 'UNMATCHED']);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });
});
