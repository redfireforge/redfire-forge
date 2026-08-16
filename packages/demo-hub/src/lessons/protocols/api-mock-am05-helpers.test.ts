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
  AM05_TIMING,
  AM05_COOKIE_KEY,
  AM05_COOKIE_REGEX,
  AM05_COOKIE_SAMPLES,
  AM05_CORPUS_SAMPLE,
  AM05_FORMAT_KEY,
  AM05_FORMAT_VALUE,
  AM05_GUARD_KEY,
  AM05_HEADER_KEY,
  AM05_HEADER_PREFIX,
  AM05_HEADER_VALUE,
  AM05_QUERY_KEY,
  AM05_QUERY_VALUE,
  AM05_SECURITY_CERT_FACET,
  AM05_SECURITY_FACET,
  AM05_SAMPLE_ALL_MATCH,
  AM05_SAMPLE_DEBUG,
  AM05_SAMPLE_QUERY_MATCH,
  AM05_SAMPLE_QUERY_MISS,
  AM05_SECURITY_VALUE,
  AM05_SIM_DEBUG_HEADERS,
  AM05_SIM_FULL_PATH,
  AM05_SIM_HEADERS,
  AM05_SIM_QUERY_MATCH,
  AM05_SIM_QUERY_MISS,
  AM05_VERSION_KEY,
  AM05_VERSION_VALUE,
  am05ConditionCount,
  am05ConditionIds,
  am05ConditionKey,
  am05ConditionOperator,
  am05ConditionRows,
  am05ConditionSource,
  am05ConditionValue,
  am05ConstraintIds,
  am05FindCondition,
  am05GroupConditionIds,
  am05GuardGroupId,
  am05LastConditionId,
  am05RootGroupId,
  am05SampleRowIds,
  am05HeadersTableRowByName,
  am05SimOutcome,
  am05TraceRowByText,
  am05TraceRows,
  cleanupAm05,
  closeAm05HeadersExpand,
  closeAm05Simulate,
  closeAm05Toolbox,
  ensureAm05CookieCondition,
  ensureAm05FullShape,
  ensureAm05GuardGroup,
  ensureAm05HeaderCondition,
  ensureAm05QueryCondition,
  ensureAm05RuleOpen,
  ensureAm05SecurityCondition,
  ensureAm05StudioView,
  ensureAm05Unconditioned,
  ensureAm05Workspace,
  hasAm05RouteEditor,
  hasAm05Workspace,
  isAm05HeadersExpandOpen,
  isAm05SimulateOpen,
  isAm05StudioViewActive,
  isAm05ToolboxOpen,
  prepareAm05Workspace,
  runAm05ConstraintsBulk,
  runAm05CookieRegex,
  runAm05FirstCondition,
  runAm05GuardGroup,
  runAm05HeaderOperators,
  reviewAm05HeadersTable,
  runAm05ProveAll,
  runAm05ProveQuery,
  runAm05SecuritySource,
} from './api-mock-am05-helpers';

// ── DOM builders (mirror the Match tab markup closely enough) ────────────────

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

function select(testid: string, value: string): HTMLElement {
  const node = el('div', 'cs-wrapper am-cs', testid);
  node.setAttribute('data-value', value);
  node.append(el('button', 'cs-trigger'));
  return node;
}

interface CondSpec {
  id: string;
  source: string;
  key: string;
  operator: string;
  value?: string;
}

function buildCondition(spec: CondSpec): HTMLElement {
  const leaf = el('div', 'am-matcher-leaf');
  const row = el('div', 'am-matcher-row', `api-mock-condition-${spec.id}`);
  row.append(select(`api-mock-condition-source-${spec.id}`, spec.source));
  row.append(spec.source === 'security'
    ? select(`api-mock-condition-selector-${spec.id}`, spec.key)
    : input(`api-mock-condition-selector-${spec.id}`, spec.key));
  row.append(select(`api-mock-condition-operator-${spec.id}`, spec.operator));
  row.append(input(`api-mock-condition-value-${spec.id}`, spec.value ?? ''));
  if (spec.operator === 'regex' || spec.operator === 'glob') {
    row.append(el('button', 'am-icon-btn', `api-mock-condition-toolbox-${spec.id}`));
  }
  row.append(el('button', 'am-icon-btn', `api-mock-condition-remove-${spec.id}`));
  leaf.append(row);
  return leaf;
}

interface GroupSpec {
  id: string;
  combinator?: string;
  conditions?: CondSpec[];
  nested?: GroupSpec;
}

function buildGroup(spec: GroupSpec, depth = 0): HTMLElement {
  const group = el('div', `am-matcher-group${depth > 0 ? ' nested' : ''}`, `api-mock-group-${spec.id}`);
  const label = el('div', 'am-group-label');
  label.append(select(`api-mock-group-combinator-${spec.id}`, spec.combinator ?? 'all'));
  const conditions = spec.conditions ?? [];
  const count = el('span', 'am-faint', `api-mock-group-count-${spec.id}`);
  count.textContent = `${conditions.length} conditions`;
  label.append(count);
  label.append(el('button', 'am-btn small ghost',
    depth === 0 ? 'api-mock-add-condition' : `api-mock-group-add-condition-${spec.id}`));
  label.append(el('button', 'am-btn small ghost',
    depth === 0 ? 'api-mock-add-group' : `api-mock-group-add-group-${spec.id}`));
  group.append(label);

  if (conditions.length === 0 && !spec.nested) {
    group.append(el('div', 'am-empty-conditions',
      depth === 0 ? 'api-mock-conditions-empty' : `api-mock-group-empty-${spec.id}`));
  }
  for (const cond of conditions) group.append(buildCondition(cond));
  if (spec.nested) group.append(buildGroup(spec.nested, depth + 1));
  return group;
}

function mountExplorer(): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-r-reports');
  row.setAttribute('role', 'treeitem');
  const method = el('span', 'am-method get');
  method.textContent = 'GET';
  const path = el('span', 'am-route-path');
  path.textContent = '/reports';
  row.append(method, path);
  explorer.append(row);
  document.body.append(explorer);
}

function mountEditor(group: GroupSpec = { id: 'grp-root' }): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  editor.append(input('api-mock-path-input', '/reports'));
  editor.append(el('button', 'am-icon-btn', 'api-mock-path-toolbox'));
  editor.append(el('button', 'am-btn', 'api-mock-simulate'));
  editor.append(buildGroup(group));
  document.body.append(editor);
}

interface ToolboxSpec {
  sampleIds?: string[];
  constraintIds?: string[];
  foreignConstraintRow?: boolean;
}

function mountToolbox(spec: ToolboxSpec = {}): void {
  const toolbox = el('div', 'am-pattern-toolbox', 'api-mock-pattern-toolbox');
  for (const id of ['regex', 'path', 'constraints']) {
    toolbox.append(el('button', 'am-builder-tab', `api-mock-toolbox-tab-${id}`));
  }
  toolbox.append(input('api-mock-toolbox-regex', '/reports'));
  toolbox.append(el('span', 'am-badge success', 'api-mock-toolbox-safety'));
  toolbox.append(el('label', 'am-chip active', 'api-mock-toolbox-flag-cs'));
  toolbox.append(el('label', 'am-chip', 'api-mock-toolbox-flag-ci'));

  const list = el('div', 'am-sample-list');
  for (const id of spec.sampleIds ?? []) {
    const row = el('div', 'am-sample-row', `api-mock-toolbox-sample-row-${id}`);
    row.append(input(`api-mock-toolbox-sample-value-${id}`));
    list.append(row);
  }
  toolbox.append(list);

  toolbox.append(el('button', 'am-btn small ghost', 'api-mock-toolbox-add-constraint'));
  for (const id of spec.constraintIds ?? []) {
    const row = el('div', 'am-matcher-row am-constraint-row', `api-mock-toolbox-constraint-${id}`);
    row.append(select(`api-mock-toolbox-constraint-source-${id}`, 'header'));
    row.append(input(`api-mock-toolbox-constraint-name-${id}`));
    row.append(select(`api-mock-toolbox-constraint-operator-${id}`, 'exact'));
    row.append(input(`api-mock-toolbox-constraint-value-${id}`));
    toolbox.append(row);
  }
  if (spec.foreignConstraintRow) {
    toolbox.append(el('div', 'am-matcher-row am-constraint-row', 'not-a-constraint'));
  }

  toolbox.append(el('button', 'am-btn', 'api-mock-toolbox-cancel'));
  toolbox.append(el('button', 'am-btn primary', 'api-mock-toolbox-apply'));
  document.body.append(toolbox);
}

interface SimulateSpec {
  outcome?: string;
  hasResult?: boolean;
  predicateRows?: string[];
}

function mountSimulate(spec: SimulateSpec = {}): void {
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(input('api-mock-simulate-path'));
  const headers = document.createElement('textarea');
  headers.setAttribute('data-testid', 'api-mock-simulate-headers');
  makeVisible(headers);
  workspace.append(headers);
  workspace.append(el('button', 'am-icon-btn', 'api-mock-simulate-headers-expand'));
  const adhoc = el('div', 'am-sim-sample active', 'api-mock-sim-sample-adhoc');
  adhoc.append(el('button', 'am-sim-sample-btn'));
  workspace.append(adhoc);
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-save-sample'));
  workspace.append(input('api-mock-simulate-sample-name'));
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-run'));

  const modal = el('div', 'am-headers-expand-modal', 'api-mock-headers-expand-modal');
  const tableBtn = el('button', 'am-segmented', 'api-mock-headers-expand-view-table');
  tableBtn.setAttribute('aria-pressed', 'false');
  modal.append(tableBtn);
  const table = el('div', 'am-headers-expand-table', 'api-mock-headers-expand-table');
  const tenant = el('div', 'am-headers-expand-row', 'api-mock-headers-expand-row-hdr-1');
  tenant.append(input('api-mock-headers-expand-name-hdr-1', 'x-tenant'));
  table.append(tenant);
  const debug = el('div', 'am-headers-expand-row', 'api-mock-headers-expand-row-hdr-2');
  debug.append(input('api-mock-headers-expand-name-hdr-2', 'x-debug'));
  table.append(debug);
  modal.append(table);
  modal.append(input('api-mock-headers-expand-search'));
  const count = el('span', 'am-text-expand-count', 'api-mock-headers-expand-count');
  count.textContent = '0/0';
  modal.append(count);
  modal.append(el('button', 'am-btn', 'api-mock-headers-expand-close'));
  workspace.append(modal);
  workspace.append(el('button', 'am-btn', 'api-mock-simulate-close'));
  if (spec.hasResult) {
    workspace.append(el('button', 'am-builder-tab', 'api-mock-sim-view-request'));
    workspace.append(el('button', 'am-builder-tab', 'api-mock-sim-view-results'));
  }
  const result = el('div', 'am-sim-result', 'api-mock-simulate-result');
  const outcome = el('span', 'am-badge', 'api-mock-sim-outcome');
  outcome.textContent = spec.outcome ?? 'MATCHED';
  result.append(outcome);
  for (const id of ['trace', 'request', 'rendered']) {
    result.append(el('button', 'am-builder-tab', `api-mock-sim-tab-${id}`));
  }
  const candidate = el('div', 'am-candidate winner', 'api-mock-sim-candidate-r-reports');
  for (const text of spec.predicateRows ?? []) {
    const row = el('div', 'am-predicate');
    row.textContent = text;
    candidate.append(row);
  }
  result.append(candidate);
  workspace.append(result);
  document.body.append(workspace);
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

const fills = (fn: unknown): Array<[string, string]> =>
  vi.mocked(fn as (s: string, v: string) => Promise<void>).mock.calls.map(c => [c[0], c[1]]);

const picks = (fn: unknown): Array<[string, string]> =>
  vi.mocked(fn as (s: string, v: string) => Promise<void>).mock.calls.map(c => [c[0], c[1]]);

/** Predicate ids the quiet rebuild mints, in tree order. */
const predicateIds = (): string[] => {
  const patch = patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as unknown as {
    predicates: { children: Array<{ id: string }> };
  } | undefined;
  return patch?.predicates.children.map(c => c.id) ?? [];
};

const QUERY_COND: CondSpec = {
  id: 'p-query', source: 'query', key: AM05_QUERY_KEY, operator: 'exact', value: AM05_QUERY_VALUE,
};
const HEADER_COND: CondSpec = {
  id: 'p-tenant', source: 'header', key: AM05_HEADER_KEY, operator: 'exact', value: AM05_HEADER_VALUE,
};
const SECURITY_COND: CondSpec = {
  id: 'p-scheme', source: 'security', key: AM05_SECURITY_FACET, operator: 'exact', value: AM05_SECURITY_VALUE,
};
const COOKIE_COND: CondSpec = {
  id: 'p-cookie', source: 'cookie', key: AM05_COOKIE_KEY, operator: 'regex', value: AM05_COOKIE_REGEX,
};
const GUARD_COND: CondSpec = {
  id: 'p-debug', source: 'header', key: AM05_GUARD_KEY, operator: 'present',
};

describe('AM-05 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
  });

  // ── row identity ──────────────────────────────────────────────────────────

  it('resolves condition rows and what each one reads', () => {
    expect(am05ConditionRows()).toEqual([]);
    expect(am05ConditionIds()).toEqual([]);
    expect(am05ConditionCount()).toBe(0);
    expect(am05LastConditionId()).toBeNull();
    expect(am05ConditionSource('p-query')).toBe('');
    expect(am05ConditionKey('p-query')).toBe('');
    expect(am05ConditionOperator('p-query')).toBe('');
    expect(am05ConditionValue('p-query')).toBe('');

    mountEditor({ id: 'grp-root', conditions: [QUERY_COND, HEADER_COND] });

    expect(am05ConditionIds()).toEqual(['p-query', 'p-tenant']);
    expect(am05ConditionCount()).toBe(2);
    expect(am05LastConditionId()).toBe('p-tenant');
    expect(am05ConditionSource('p-query')).toBe('query');
    expect(am05ConditionKey('p-query')).toBe(AM05_QUERY_KEY);
    expect(am05ConditionOperator('p-query')).toBe('exact');
    expect(am05ConditionValue('p-query')).toBe(AM05_QUERY_VALUE);
  });

  it('reads the Security facet off the dropdown instead of an input', () => {
    mountEditor({ id: 'grp-root', conditions: [SECURITY_COND] });
    expect(am05ConditionSource('p-scheme')).toBe('security');
    expect(am05ConditionKey('p-scheme')).toBe(AM05_SECURITY_FACET);
  });

  it('finds an existing row by source and key, and only that pair', () => {
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND, HEADER_COND] });
    expect(am05FindCondition('header', AM05_HEADER_KEY)).toBe('p-tenant');
    expect(am05FindCondition('query', AM05_HEADER_KEY)).toBeNull();
    expect(am05FindCondition('cookie', AM05_COOKIE_KEY)).toBeNull();
  });

  it('ignores a selector dropdown with no value attribute', () => {
    const wrap = el('div', 'cs-wrapper', 'api-mock-condition-selector-p-bare');
    document.body.append(wrap);
    expect(am05ConditionKey('p-bare')).toBe('');
  });

  // ── group identity ────────────────────────────────────────────────────────

  it('resolves the root group and the nested guard group', () => {
    expect(am05RootGroupId()).toBeNull();
    expect(am05GuardGroupId()).toBeNull();
    expect(am05GroupConditionIds('grp-guard')).toEqual([]);

    mountEditor({
      id: 'grp-root',
      conditions: [QUERY_COND],
      nested: { id: 'grp-guard', combinator: 'not', conditions: [GUARD_COND] },
    });

    expect(am05RootGroupId()).toBe('grp-root');
    expect(am05GuardGroupId()).toBe('grp-guard');
    expect(am05GroupConditionIds('grp-guard')).toEqual(['p-debug']);
    // Nested rows still belong to the flat row list, and the guard row is not last.
    expect(am05ConditionIds()).toEqual(['p-query', 'p-debug']);
  });

  it('returns null when the add-condition button sits outside a group', () => {
    document.body.append(el('button', 'am-btn', 'api-mock-add-condition'));
    expect(am05RootGroupId()).toBeNull();
  });

  // ── state probes ──────────────────────────────────────────────────────────

  it('reads the studio, editor and overlay state', () => {
    expect(isAm05StudioViewActive()).toBe(false);
    expect(hasAm05Workspace()).toBe(false);
    expect(hasAm05RouteEditor()).toBe(false);
    expect(isAm05ToolboxOpen()).toBe(false);
    expect(isAm05SimulateOpen()).toBe(false);
    expect(am05SimOutcome()).toBe('');

    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    mountToolbox();
    mountSimulate({ outcome: 'UNMATCHED' });

    expect(isAm05StudioViewActive()).toBe(true);
    expect(hasAm05Workspace()).toBe(true);
    expect(hasAm05RouteEditor()).toBe(true);
    expect(isAm05ToolboxOpen()).toBe(true);
    expect(isAm05SimulateOpen()).toBe(true);
    expect(am05SimOutcome()).toBe('UNMATCHED');
  });

  it('treats the empty state as the Studio view', () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    expect(isAm05StudioViewActive()).toBe(true);
  });

  it('reads trace rows and finds one by the text it renders', () => {
    expect(am05TraceRows()).toEqual([]);
    expect(am05TraceRowByText('query')).toBeNull();

    mountSimulate({
      predicateRows: ['✓ Method match', '✓ Path /reports', 'query "page" exact failed — got "3"'],
    });

    expect(am05TraceRows()).toHaveLength(3);
    expect(am05TraceRowByText(AM05_QUERY_KEY)?.textContent).toContain('failed');
    expect(am05TraceRowByText('cookie')).toBeNull();
  });

  it('reads toolbox sample and constraint row ids, ignoring foreign rows', () => {
    expect(am05SampleRowIds()).toEqual([]);
    expect(am05ConstraintIds()).toEqual([]);
    mountToolbox({
      sampleIds: ['s1', 's2'],
      constraintIds: ['c1', 'c-2f'],
      foreignConstraintRow: true,
    });
    expect(am05SampleRowIds()).toEqual(['s1', 's2']);
    expect(am05ConstraintIds()).toEqual(['c1', 'c-2f']);
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────

  it('boots on the unconditioned corpus and cleans up by wiping', async () => {
    await prepareAm05Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM05_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    wipeApiMockWorkspace.mockClear();
    await cleanupAm05();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── overlay hygiene ───────────────────────────────────────────────────────

  it('closes the toolbox and Simulate only when they are open', async () => {
    const quiet = makeCtx();
    await closeAm05Toolbox(quiet);
    await closeAm05Simulate(quiet);
    expect(quiet.click).not.toHaveBeenCalled();

    mountToolbox();
    mountSimulate();
    const ctx = makeCtx();
    await closeAm05Toolbox(ctx);
    await closeAm05Simulate(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.TOOLBOX_CANCEL, API_MOCK.SIMULATE_CLOSE]);
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it('switches back to Studio only when another view is mounted', async () => {
    const missing = makeCtx();
    await ensureAm05StudioView(missing);
    expect(missing.click).not.toHaveBeenCalled();

    document.body.append(el('button', 'am-nav-btn', 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm05StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);

    mountExplorer();
    const already = makeCtx();
    await ensureAm05StudioView(already);
    expect(already.click).not.toHaveBeenCalled();
  });

  it('imports the corpus when the workspace is empty and skips when it is not', async () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    await ensureAm05Workspace(makeCtx());
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM05_CORPUS_SAMPLE);

    importApiMockGallerySample.mockClear();
    document.body.innerHTML = '';
    mountExplorer();
    await ensureAm05Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('opens the rule and switches to the Match tab when conditions are not visible', async () => {
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm05RuleOpen(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ROUTE_ROW, API_MOCK.BTAB_MATCH]);
  });

  it('leaves an already-open Match tab alone', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    const ctx = makeCtx();
    await ensureAm05RuleOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('rebuilds the condition tree each step starts from', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    await ensureAm05Unconditioned(makeCtx());
    expect(predicateIds()).toEqual([]);

    await ensureAm05QueryCondition(makeCtx());
    expect(predicateIds()).toEqual(['pred-am05-query']);

    await ensureAm05HeaderCondition(makeCtx());
    expect(predicateIds()).toEqual(['pred-am05-query', 'pred-am05-tenant']);

    await ensureAm05SecurityCondition(makeCtx());
    expect(predicateIds()).toEqual(['pred-am05-query', 'pred-am05-tenant', 'pred-am05-scheme']);

    await ensureAm05GuardGroup(makeCtx());
    expect(predicateIds()).toContain('grp-am05-guard');

    await ensureAm05CookieCondition(makeCtx());
    expect(predicateIds()).toContain('pred-am05-cookie');

    await ensureAm05FullShape(makeCtx());
    expect(predicateIds()).toEqual([
      'pred-am05-query', 'pred-am05-tenant', 'pred-am05-scheme', 'grp-am05-guard',
      'pred-am05-cookie', 'pred-am05-version', 'pred-am05-format',
    ]);
  });

  it('rebuilds the guard as a None-of group holding a presence check', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    await ensureAm05GuardGroup(makeCtx());

    const patch = patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as unknown as {
      predicates: {
        combinator: string;
        children: Array<{ combinator?: string; children?: Array<{ selector: string; operator: string }> }>;
      };
    };
    expect(patch.predicates.combinator).toBe('all');
    const guard = patch.predicates.children.find(c => c.combinator === 'not');
    expect(guard?.children?.[0]).toMatchObject({ selector: AM05_GUARD_KEY, operator: 'present' });
  });

  it('stops quietly when the patch bridge is unavailable', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await ensureAm05QueryCondition(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  // ── step bodies ───────────────────────────────────────────────────────────

  it('holds AM-05 spotlights longer than the shared pack, with extra time on the Simulate trace', () => {
    expect(AM05_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM05_TIMING.fieldFilled).toBeGreaterThan(AM_DEMO_TIMING.fieldFilled);
    expect(AM05_TIMING.tabSwitch).toBeGreaterThan(AM_DEMO_TIMING.tabSwitch);
    expect(AM05_TIMING.panelReady).toBeGreaterThan(AM_DEMO_TIMING.panelReady);
    expect(AM05_TIMING.payoff).toBeGreaterThan(AM_DEMO_TIMING.payoff);
    expect(AM05_TIMING.groupBreak).toBeGreaterThan(AM_DEMO_TIMING.groupBreak);
    expect(AM05_TIMING.traceRow).toBeGreaterThan(AM05_TIMING.look);
    expect(AM05_TIMING.simOutcome).toBeGreaterThan(AM05_TIMING.payoff);
    expect(AM05_TIMING.reviewForm).toBe(AM05_TIMING.payoff);
    expect(AM05_TIMING.beforeRun).toBeGreaterThan(AM05_TIMING.look);
  });

  it('step 1 adds the first condition and points it at a query parameter', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root' });

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel !== API_MOCK.ADD_CONDITION) return;
      const group = document.querySelector(API_MOCK.group('grp-root'))!;
      group.append(buildCondition({ id: 'p-new', source: 'header', key: '', operator: 'exact' }));
    });

    await runAm05FirstCondition(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_CONDITION]);
    expect(picks(ctx.selectOption)).toEqual([[API_MOCK.conditionSource('p-new'), 'query']]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionSelector('p-new'), AM05_QUERY_KEY],
      [API_MOCK.conditionValue('p-new'), AM05_QUERY_VALUE],
    ]);
  });

  it('step 1 reuses the query row instead of adding a second one', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await runAm05FirstCondition(ctx);

    expect(ctx.click).not.toHaveBeenCalled();
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.conditionValue('p-query'), AM05_QUERY_VALUE]);
  });

  it('step 1 bails when the new row never renders', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root' });

    const ctx = makeCtx();
    await runAm05FirstCondition(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_CONDITION]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 2 proves the query condition in both directions', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    mountSimulate({
      hasResult: true,
      outcome: 'UNMATCHED',
      predicateRows: ['query "page" exact failed — got "3"'],
    });

    const ctx = makeCtx();
    const outcomes = await runAm05ProveQuery(ctx);

    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM05_SIM_QUERY_MATCH],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM05_SAMPLE_QUERY_MATCH],
      [API_MOCK.SIMULATE_PATH, AM05_SIM_QUERY_MISS],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM05_SAMPLE_QUERY_MISS],
    ]);
    expect(outcomes).toEqual(['UNMATCHED', 'UNMATCHED']);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 2 opens Simulate when the modal is not up yet', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) mountSimulate();
    });
    await runAm05ProveQuery(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    // No results pane on the first run, so no detour through Request.
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
  });

  it('step 3 walks prefix then exact on a header condition', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND, HEADER_COND] });

    const ctx = makeCtx();
    await runAm05HeaderOperators(ctx);

    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.conditionOperator('p-tenant'), 'prefix'],
      [API_MOCK.conditionOperator('p-tenant'), 'exact'],
    ]);
    expect(fills(ctx.fill).map(f => f[1])).toEqual([
      AM05_HEADER_KEY, AM05_HEADER_PREFIX, AM05_HEADER_VALUE,
    ]);
  });

  it('step 3 bails when the header row cannot be added', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await runAm05HeaderOperators(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_CONDITION]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 4 tours the security facets and pins the scheme', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND, HEADER_COND, SECURITY_COND] });

    const ctx = makeCtx();
    await runAm05SecuritySource(ctx);

    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.conditionSource('p-scheme'), 'security'],
      [API_MOCK.conditionSelector('p-scheme'), AM05_SECURITY_CERT_FACET],
      [API_MOCK.conditionSelector('p-scheme'), AM05_SECURITY_FACET],
    ]);
    expect(fills(ctx.fill)).toEqual([[API_MOCK.conditionValue('p-scheme'), AM05_SECURITY_VALUE]]);
  });

  it('step 4 bails when the security row cannot be added', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await runAm05SecuritySource(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 5 creates the None-of guard and its presence check', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ADD_GROUP) {
        document.querySelector(API_MOCK.group('grp-root'))!
          .append(buildGroup({ id: 'grp-guard', combinator: 'all' }, 1));
        return;
      }
      if (sel === API_MOCK.groupAddCondition('grp-guard')) {
        document.querySelector(API_MOCK.group('grp-guard'))!
          .append(buildCondition({ id: 'p-new-debug', source: 'header', key: '', operator: 'exact' }));
      }
    });

    await runAm05GuardGroup(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_GROUP, API_MOCK.groupAddCondition('grp-guard')]);
    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.groupCombinator('grp-guard'), 'not'],
      [API_MOCK.conditionOperator('p-new-debug'), 'present'],
    ]);
    expect(fills(ctx.fill)).toEqual([[API_MOCK.conditionSelector('p-new-debug'), AM05_GUARD_KEY]]);
  });

  it('step 5 reuses an existing guard group and its row', async () => {
    mountExplorer();
    mountEditor({
      id: 'grp-root',
      conditions: [QUERY_COND],
      nested: { id: 'grp-guard', combinator: 'not', conditions: [GUARD_COND] },
    });

    const ctx = makeCtx();
    await runAm05GuardGroup(ctx);

    expect(ctx.click).not.toHaveBeenCalled();
    expect(fills(ctx.fill)).toEqual([[API_MOCK.conditionSelector('p-debug'), AM05_GUARD_KEY]]);
  });

  it('step 5 bails when neither the group nor its row appears', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await runAm05GuardGroup(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_GROUP]);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 5 bails when the guard group renders without a condition row', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel !== API_MOCK.ADD_GROUP) return;
      document.querySelector(API_MOCK.group('grp-root'))!
        .append(buildGroup({ id: 'grp-guard', combinator: 'all' }, 1));
    });

    await runAm05GuardGroup(ctx);

    expect(picks(ctx.selectOption)).toEqual([[API_MOCK.groupCombinator('grp-guard'), 'not']]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 6 tests the cookie pattern, flips Ignore case, then applies', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND, COOKIE_COND] });
    mountToolbox({ sampleIds: ['s1', 's2', 's3', 's4'] });

    const ctx = makeCtx();
    await runAm05CookieRegex(ctx);

    const clicked = calls(ctx.click);
    expect(clicked).toContain(API_MOCK.conditionToolbox('p-cookie'));
    expect(clicked).toContain(API_MOCK.TOOLBOX_FLAG_CI);
    expect(clicked).toContain(API_MOCK.TOOLBOX_APPLY);

    const filled = fills(ctx.fill);
    expect(filled).toContainEqual([API_MOCK.TOOLBOX_REGEX, AM05_COOKIE_REGEX]);
    for (const [index, sample] of AM05_COOKIE_SAMPLES.entries()) {
      expect(filled).toContainEqual([API_MOCK.toolboxSampleValue(`s${index + 1}`), sample.value]);
    }
  });

  it('step 6 survives a toolbox with no live sample rows', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [COOKIE_COND] });
    mountToolbox();

    const ctx = makeCtx();
    await runAm05CookieRegex(ctx);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_REGEX, AM05_COOKIE_REGEX]);
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 6 bails when the cookie row cannot be added', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });

    const ctx = makeCtx();
    await runAm05CookieRegex(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_CONDITION]);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 7 composes two constraints and adds them as conditions', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    mountToolbox({ constraintIds: ['c1'] });

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel !== API_MOCK.TOOLBOX_ADD_CONSTRAINT) return;
      const row = el('div', 'am-matcher-row am-constraint-row', 'api-mock-toolbox-constraint-c2');
      row.append(select('api-mock-toolbox-constraint-source-c2', 'header'));
      row.append(input('api-mock-toolbox-constraint-name-c2'));
      row.append(input('api-mock-toolbox-constraint-value-c2'));
      document.querySelector(API_MOCK.PATTERN_TOOLBOX)!.append(row);
    });

    await runAm05ConstraintsBulk(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.PATH_TOOLBOX,
      API_MOCK.TOOLBOX_TAB_CONSTRAINTS,
      API_MOCK.TOOLBOX_ADD_CONSTRAINT,
      API_MOCK.TOOLBOX_APPLY,
    ]);
    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.toolboxConstraintSource('c2'), 'query'],
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.toolboxConstraintName('c1'), AM05_VERSION_KEY],
      [API_MOCK.toolboxConstraintValue('c1'), AM05_VERSION_VALUE],
      [API_MOCK.toolboxConstraintName('c2'), AM05_FORMAT_KEY],
      [API_MOCK.toolboxConstraintValue('c2'), AM05_FORMAT_VALUE],
    ]);
  });

  it('step 7 still applies when the constraint rows cannot be resolved', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [QUERY_COND] });
    mountToolbox();

    const ctx = makeCtx();
    await runAm05ConstraintsBulk(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 8 shapes a full request, then proves the guard rejects the debug header', async () => {
    mountExplorer();
    mountEditor({
      id: 'grp-root',
      conditions: [QUERY_COND, HEADER_COND, SECURITY_COND, COOKIE_COND],
      nested: { id: 'grp-guard', combinator: 'not', conditions: [GUARD_COND] },
    });
    mountSimulate({
      hasResult: true,
      predicateRows: [
        '✓ Method match',
        '✓ Path /reports',
        '✓ query exact',
        '✓ header "x-debug" was absent — as required',
        '✓ None of passed — no child matched',
        '✓ header present',
      ],
    });

    const ctx = makeCtx();
    const outcomes = await runAm05ProveAll(ctx);

    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM05_SIM_FULL_PATH],
      [API_MOCK.SIMULATE_HEADERS, AM05_SIM_HEADERS],
      [API_MOCK.HEADERS_EXPAND_SEARCH, AM05_GUARD_KEY],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM05_SAMPLE_ALL_MATCH],
      [API_MOCK.SIMULATE_PATH, AM05_SIM_FULL_PATH],
      [API_MOCK.SIMULATE_HEADERS, AM05_SIM_DEBUG_HEADERS],
      [API_MOCK.HEADERS_EXPAND_SEARCH, AM05_GUARD_KEY],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM05_SAMPLE_DEBUG],
    ]);
    const clicks = calls(ctx.click);
    expect(clicks.filter(c => c === API_MOCK.SIMULATE_SAVE_SAMPLE)).toHaveLength(2);
    expect(clicks.filter(c => c === API_MOCK.SIMULATE_RUN)).toHaveLength(2);
    expect(clicks.indexOf(API_MOCK.SIMULATE_SAVE_SAMPLE))
      .toBeLessThan(clicks.indexOf(API_MOCK.SIMULATE_RUN));
    expect(clicks).toContain(API_MOCK.SIMULATE_HEADERS_EXPAND);
    expect(clicks).toContain(API_MOCK.HEADERS_EXPAND_VIEW_TABLE);
    expect(clicks).toContain(API_MOCK.HEADERS_EXPAND_CLOSE);
    expect(clicks).not.toContain(API_MOCK.SIMULATE_TAB_TRACE);
    expect(clicks).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('finds a Headers table row by name and ignores a blank needle', () => {
    mountSimulate();
    expect(isAm05HeadersExpandOpen()).toBe(true);
    expect(am05HeadersTableRowByName(AM05_GUARD_KEY)?.getAttribute('data-testid'))
      .toBe('api-mock-headers-expand-row-hdr-2');
    expect(am05HeadersTableRowByName('X-DEBUG')?.textContent).toBeDefined();
    expect(am05HeadersTableRowByName('')).toBeNull();
    expect(am05HeadersTableRowByName('missing')).toBeNull();
  });

  it('reviewAm05HeadersTable no-ops without the expand control', async () => {
    const ctx = makeCtx();
    await reviewAm05HeadersTable(ctx, { expectGuard: true });
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm05HeadersExpand is quiet when the popup is already closed', async () => {
    const ctx = makeCtx();
    await closeAm05HeadersExpand(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step 8 sends the debug header only on the second run', () => {
    expect(AM05_SIM_HEADERS).not.toContain('X-Debug');
    expect(AM05_SIM_DEBUG_HEADERS).toContain('X-Debug: 1');
    // Header names are normalized, so the upper-case name still matches the condition.
    expect(AM05_SIM_HEADERS).toContain('AUTHORIZATION:');
    expect(AM05_SIM_FULL_PATH).toContain(`${AM05_FORMAT_KEY}=${AM05_FORMAT_VALUE}`);
  });
});
