/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import type { DemoActionContext } from '../../types';
import { AM_DEMO_TIMING } from './api-mock-demo-helpers';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const patchApiMockActiveRoute = vi.fn(() => true);
const patchApiMockServerSettings = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  patchApiMockServerSettings: (...a: unknown[]) => patchApiMockServerSettings(...(a as [])),
}));

import {
  AM08_AMBIGUITY_BODY,
  AM08_CORPUS_SAMPLE,
  AM08_DEBUG_KEY,
  AM08_DEFAULT_NAME,
  AM08_PATH,
  AM08_PRIORITY_DEFAULT,
  AM08_PRIORITY_RAISED,
  AM08_REGIONAL_NAME,
  AM08_SIM_HEADERS,
  AM08_TENANT_EU,
  AM08_TENANT_KEY,
  AM08_TENANT_US,
  AM08_TIMING,
  AM08_VERSION_KEY,
  AM08_VERSION_VALUE,
  am08CandidateByName,
  am08ConditionCount,
  am08ConditionKey,
  am08ConditionOperator,
  am08ConditionRows,
  am08ConditionValue,
  am08GroupCombinator,
  am08GroupConditionIds,
  am08NestedGroupIds,
  am08OpenRuleName,
  am08PriorityValue,
  am08RootGroupId,
  am08RuleRow,
  am08RuleRows,
  am08RuleSelector,
  am08SimOutcome,
  am08TraceRowByText,
  am08TraceRows,
  cleanupAm08,
  closeAm08Settings,
  closeAm08Simulate,
  ensureAm08ForSpecificity,
  ensureAm08FullLogic,
  ensureAm08NestedAnyEmpty,
  ensureAm08PriorityRaised,
  ensureAm08StudioView,
  ensureAm08Tenants,
  ensureAm08VersionOnly,
  ensureAm08Workspace,
  hasAm08RouteEditor,
  hasAm08Workspace,
  isAm08RuleOpen,
  isAm08SettingsOpen,
  isAm08SimulateOpen,
  isAm08StudioViewActive,
  openAm08Rule,
  prepareAm08Workspace,
  runAm08AllVsAny,
  runAm08HighestPriority,
  runAm08NestedGroup,
  runAm08NotGroup,
  runAm08Priority,
  runAm08ProveLogic,
  runAm08RejectMultiple,
  runAm08Specificity,
} from './api-mock-am08-helpers';

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

function textarea(testid: string, value = ''): HTMLTextAreaElement {
  const node = document.createElement('textarea');
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
  key?: string;
  operator?: string;
  value?: string;
}

interface GroupSpec {
  id: string;
  combinator?: string;
  conditions?: CondSpec[];
  nested?: GroupSpec[];
}

function buildCondition(spec: CondSpec): HTMLElement {
  const leaf = el('div', 'am-matcher-leaf');
  const row = el('div', 'am-matcher-row', `api-mock-condition-${spec.id}`);
  row.append(select(`api-mock-condition-source-${spec.id}`, 'header'));
  row.append(input(`api-mock-condition-selector-${spec.id}`, spec.key ?? ''));
  row.append(select(`api-mock-condition-operator-${spec.id}`, spec.operator ?? 'exact'));
  row.append(input(`api-mock-condition-value-${spec.id}`, spec.value ?? ''));
  leaf.append(row);
  return leaf;
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
  if (spec.combinator === 'not') {
    group.append(el('div', 'am-hint', `api-mock-group-failclosed-${spec.id}`));
  }
  if (conditions.length === 0 && !spec.nested?.length) {
    group.append(el('div', 'am-empty-conditions',
      depth === 0 ? 'api-mock-conditions-empty' : `api-mock-group-empty-${spec.id}`));
  }
  for (const cond of conditions) group.append(buildCondition(cond));
  for (const nested of spec.nested ?? []) group.append(buildGroup(nested, depth + 1));
  return group;
}

const CORPUS = [
  { testid: 'r-regional', name: AM08_REGIONAL_NAME },
  { testid: 'r-default', name: AM08_DEFAULT_NAME },
];

function mountExplorer(): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  for (const rule of CORPUS) {
    const wrap = el('div', 'am-tree-route-row');
    const row = el('button', 'am-route-item', `api-mock-route-${rule.testid}`);
    row.setAttribute('role', 'treeitem');
    const method = el('span', 'am-method get');
    method.textContent = 'GET';
    const path = el('span', 'am-route-path');
    path.textContent = AM08_PATH;
    row.append(method, path);
    const del = el('button', 'am-icon-btn am-route-delete');
    del.setAttribute('aria-label', `Delete rule ${rule.name}`);
    wrap.append(row, del);
    explorer.append(wrap);
  }
  document.body.append(explorer);
}

function mountEditor(group: GroupSpec = { id: 'grp-root' }, name = AM08_REGIONAL_NAME, priority = '10'): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const nameField = input('api-mock-route-name', name);
  nameField.className = 'am-sr-only';
  editor.append(nameField);
  editor.append(input('api-mock-path-input', AM08_PATH));
  editor.append(input('api-mock-priority-input', priority));
  editor.append(el('button', 'am-btn', 'api-mock-simulate'));
  editor.append(buildGroup(group));
  document.body.append(editor);
}

function mountSettings(): void {
  const modal = el('div', 'am-settings', 'api-mock-settings-modal');
  modal.append(el('button', 'am-builder-tab', 'api-mock-settings-tab-selection'));
  const panel = el('div', 'am-stg-form', 'api-mock-settings-panel-selection');
  panel.append(select('api-mock-settings-multiple-match', 'highest_priority'));
  panel.append(select('api-mock-settings-equal-priority', 'reject'));
  panel.append(el('span', 'am-badge', 'api-mock-settings-ambiguity-status'));
  panel.append(textarea('api-mock-settings-ambiguity-body'));
  modal.append(panel);
  modal.append(el('button', 'am-btn primary', 'api-mock-settings-save'));
  modal.append(el('button', 'am-btn', 'api-mock-settings-cancel'));
  document.body.append(modal);
}

interface SimulateSpec {
  outcome?: string;
  hasResult?: boolean;
  predicateRows?: string[];
  winner?: boolean;
  specificity?: boolean;
}

function mountSimulate(spec: SimulateSpec = {}): void {
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(select('api-mock-simulate-method', 'GET'));
  workspace.append(input('api-mock-simulate-path', AM08_PATH));
  workspace.append(textarea('api-mock-simulate-headers'));
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-run'));
  workspace.append(el('button', 'am-btn', 'api-mock-simulate-close'));
  if (spec.hasResult) {
    workspace.append(el('button', 'am-builder-tab', 'api-mock-sim-view-request'));
  }
  const result = el('div', 'am-sim-result', 'api-mock-simulate-result');
  const outcome = el('span', 'am-badge', 'api-mock-sim-outcome');
  outcome.textContent = spec.outcome ?? 'AMBIGUOUS';
  result.append(outcome);
  for (const id of ['trace', 'request', 'rendered']) {
    result.append(el('button', 'am-builder-tab', `api-mock-sim-tab-${id}`));
  }
  result.append(el('pre', 'am-code', 'api-mock-sim-rendered-body'));
  result.append(el('div', 'am-trace-step', 'api-mock-sim-timeline-3'));
  const regional = el('div', 'am-candidate winner', 'api-mock-sim-candidate-r-regional');
  regional.append(document.createTextNode(AM08_REGIONAL_NAME));
  if (spec.winner) {
    const badge = el('span', 'am-badge success', 'api-mock-sim-winner');
    badge.textContent = 'Winner';
    regional.append(badge);
  }
  for (const text of spec.predicateRows ?? []) {
    const row = el('div', 'am-predicate');
    row.textContent = text;
    regional.append(row);
  }
  result.append(regional);
  const fallback = el('div', 'am-candidate', 'api-mock-sim-candidate-r-default');
  fallback.append(document.createTextNode(AM08_DEFAULT_NAME));
  result.append(fallback);
  if (spec.specificity) {
    result.append(el('div', 'am-specificity', 'api-mock-sim-specificity'));
  }
  workspace.append(result);
  document.body.append(workspace);
}

function mountChrome(): void {
  document.body.append(el('button', 'am-icon-btn', 'api-mock-settings'));
  document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
}

const VERSION_COND: CondSpec = {
  id: 'p-version', key: AM08_VERSION_KEY, operator: 'exact', value: AM08_VERSION_VALUE,
};
const EU_COND: CondSpec = {
  id: 'p-eu', key: AM08_TENANT_KEY, operator: 'exact', value: AM08_TENANT_EU,
};
const US_COND: CondSpec = {
  id: 'p-us', key: AM08_TENANT_KEY, operator: 'exact', value: AM08_TENANT_US,
};
const DEBUG_COND: CondSpec = {
  id: 'p-debug', key: AM08_DEBUG_KEY, operator: 'present',
};

const ANY_EMPTY: GroupSpec = { id: 'grp-any', combinator: 'any' };
const ANY_TENANTS: GroupSpec = {
  id: 'grp-any', combinator: 'any', conditions: [EU_COND, US_COND],
};
const NOT_GUARD: GroupSpec = {
  id: 'grp-not', combinator: 'not', conditions: [DEBUG_COND],
};

function reactiveCtx(): DemoActionContext {
  const ctx = makeCtx();
  let added = 0;
  vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
    const rule = CORPUS.find(r => selector === `[data-testid="api-mock-route-${r.testid}"]`);
    if (rule) {
      const name = document.querySelector<HTMLInputElement>(API_MOCK.ROUTE_NAME);
      if (name) name.value = rule.name;
      return;
    }
    if (selector === API_MOCK.ADD_GROUP) {
      added += 1;
      const root = document.querySelector('.am-matcher-group:not(.nested)');
      root?.append(buildGroup({ id: `grp-new-${added}`, combinator: 'all' }, 1));
      return;
    }
    const addCond = selector.match(/^\[data-testid="api-mock-group-add-condition-(.+)"\]$/);
    if (addCond) {
      added += 1;
      document.querySelector(API_MOCK.group(addCond[1]))
        ?.append(buildCondition({ id: `new-${added}`, key: '', operator: 'exact' }));
      return;
    }
    if (selector === API_MOCK.SIMULATE) {
      mountSimulate({ outcome: 'AMBIGUOUS', winner: true, specificity: true });
      return;
    }
    if (selector === API_MOCK.SIMULATE_CLOSE) {
      document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
      return;
    }
    if (selector === API_MOCK.SETTINGS) {
      mountSettings();
      return;
    }
    if (selector === API_MOCK.SETTINGS_SAVE || selector === API_MOCK.SETTINGS_CANCEL) {
      document.querySelector(API_MOCK.SETTINGS_MODAL)?.remove();
    }
  });
  vi.mocked(ctx.fill).mockImplementation(async (selector: string, value: string) => {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (field) field.value = value;
  });
  return ctx;
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

const fills = (fn: unknown): Array<[string, string]> =>
  vi.mocked(fn as (s: string, v: string) => Promise<void>).mock.calls.map(c => [c[0], c[1]]);

const lastPatch = (): {
  priority?: number;
  predicates: {
    combinator: string;
    children: Array<{ id?: string; combinator?: string; children?: unknown[]; selector?: string }>;
  };
} | undefined => patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as never;

describe('AM-08 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
    patchApiMockServerSettings.mockReturnValue(true);
    mountChrome();
  });

  it('boots the overlapping catalog corpus and wipes on cleanup', async () => {
    await prepareAm08Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM08_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    await cleanupAm08();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('identifies corpus rows by the delete-button name, not by path', () => {
    expect(am08RuleRows()).toEqual([]);
    expect(am08RuleRow(AM08_REGIONAL_NAME)).toBeNull();
    mountExplorer();
    expect(am08RuleRows()).toHaveLength(2);
    expect(am08RuleRow(AM08_REGIONAL_NAME)?.getAttribute('data-testid')).toBe('api-mock-route-r-regional');
    expect(am08RuleSelector(AM08_DEFAULT_NAME)).toBe('[data-testid="api-mock-route-r-default"]');
    expect(am08RuleRow('Missing')).toBeNull();
  });

  it('reads the open rule from the hidden name field', () => {
    expect(am08OpenRuleName()).toBe('');
    expect(isAm08RuleOpen(AM08_REGIONAL_NAME)).toBe(false);
    mountEditor();
    expect(am08OpenRuleName()).toBe(AM08_REGIONAL_NAME);
    expect(isAm08RuleOpen(AM08_REGIONAL_NAME)).toBe(true);
    expect(isAm08RuleOpen(AM08_DEFAULT_NAME)).toBe(false);
    expect(am08PriorityValue()).toBe('10');
  });

  it('resolves nested group ids, combinators, and direct leaf rows', () => {
    expect(am08RootGroupId()).toBeNull();
    expect(am08NestedGroupIds()).toEqual([]);
    mountEditor({
      id: 'grp-root',
      conditions: [VERSION_COND],
      nested: [ANY_TENANTS, NOT_GUARD],
    });
    expect(am08RootGroupId()).toBe('grp-root');
    expect(am08NestedGroupIds()).toEqual(['grp-any', 'grp-not']);
    expect(am08GroupCombinator('grp-any')).toBe('any');
    expect(am08GroupCombinator('grp-not')).toBe('not');
    expect(am08GroupConditionIds('grp-any')).toEqual(['p-eu', 'p-us']);
    expect(am08GroupConditionIds('grp-not')).toEqual(['p-debug']);
    expect(am08ConditionCount()).toBe(4);
    expect(am08ConditionRows()).toHaveLength(4);
    expect(am08ConditionKey('p-eu')).toBe(AM08_TENANT_KEY);
    expect(am08ConditionValue('p-eu')).toBe(AM08_TENANT_EU);
    expect(am08ConditionOperator('p-debug')).toBe('present');
  });

  it('reads studio, overlay, and simulate probes', () => {
    expect(isAm08StudioViewActive()).toBe(false);
    expect(hasAm08Workspace()).toBe(false);
    expect(hasAm08RouteEditor()).toBe(false);
    expect(isAm08SimulateOpen()).toBe(false);
    expect(isAm08SettingsOpen()).toBe(false);
    expect(am08SimOutcome()).toBe('');
    mountExplorer();
    mountEditor();
    mountSimulate({
      outcome: 'MATCHED',
      winner: true,
      predicateRows: [`header "${AM08_TENANT_EU}" exact`, `header "${AM08_TENANT_US}" miss`],
    });
    mountSettings();
    expect(isAm08StudioViewActive()).toBe(true);
    expect(hasAm08Workspace()).toBe(true);
    expect(hasAm08RouteEditor()).toBe(true);
    expect(isAm08SimulateOpen()).toBe(true);
    expect(isAm08SettingsOpen()).toBe(true);
    expect(am08SimOutcome()).toBe('MATCHED');
    expect(am08TraceRows()).toHaveLength(2);
    expect(am08TraceRowByText(AM08_TENANT_EU)?.textContent).toContain('exact');
    expect(am08CandidateByName(AM08_DEFAULT_NAME)?.textContent).toContain(AM08_DEFAULT_NAME);
  });

  it('closes Simulate and Settings when they are open, and skips when they are not', async () => {
    const idle = makeCtx();
    await closeAm08Simulate(idle);
    await closeAm08Settings(idle);
    expect(idle.click).not.toHaveBeenCalled();

    mountSimulate();
    mountSettings();
    const ctx = makeCtx();
    await closeAm08Simulate(ctx);
    await closeAm08Settings(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.SIMULATE_CLOSE, API_MOCK.SETTINGS_CANCEL]);
  });

  it('returns to Studio when the explorer is unmounted', async () => {
    const ctx = makeCtx();
    await ensureAm08StudioView(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.VIEW_STUDIO]);

    mountExplorer();
    const idle = makeCtx();
    await ensureAm08StudioView(idle);
    expect(idle.click).not.toHaveBeenCalled();
  });

  it('reimports the corpus only when the explorer is empty', async () => {
    const empty = makeCtx();
    await ensureAm08Workspace(empty);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM08_CORPUS_SAMPLE);

    importApiMockGallerySample.mockClear();
    mountExplorer();
    await ensureAm08Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('opens another rule by clicking its row, and leaves an open one alone', async () => {
    mountExplorer();
    mountEditor();
    const same = reactiveCtx();
    expect(await openAm08Rule(same, AM08_REGIONAL_NAME)).toBe(true);
    expect(same.click).not.toHaveBeenCalled();

    const switched = reactiveCtx();
    expect(await openAm08Rule(switched, AM08_DEFAULT_NAME)).toBe(true);
    expect(calls(switched.click)).toEqual(['[data-testid="api-mock-route-r-default"]']);
    expect(am08OpenRuleName()).toBe(AM08_DEFAULT_NAME);
  });

  it('gives up quietly when the rule it needs is not in the explorer', async () => {
    mountEditor();
    expect(await openAm08Rule(makeCtx(), AM08_DEFAULT_NAME)).toBe(false);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('rebuilds the Match tree a step starts from', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });

    await ensureAm08VersionOnly(reactiveCtx());
    expect(lastPatch()!.predicates.children).toHaveLength(1);
    expect(lastPatch()!.priority).toBe(AM08_PRIORITY_DEFAULT);

    await ensureAm08NestedAnyEmpty(reactiveCtx());
    expect(lastPatch()!.predicates.children[1]).toMatchObject({ combinator: 'any', children: [] });

    await ensureAm08Tenants(reactiveCtx());
    expect((lastPatch()!.predicates.children[1] as { children: unknown[] }).children).toHaveLength(2);

    await ensureAm08FullLogic(reactiveCtx());
    expect(lastPatch()!.predicates.children).toHaveLength(3);

    await ensureAm08PriorityRaised(reactiveCtx());
    expect(lastPatch()!.priority).toBe(AM08_PRIORITY_RAISED);
    expect(patchApiMockServerSettings).toHaveBeenCalledWith({
      multipleMatchPolicy: 'highest_priority',
      equalPriorityPolicy: 'reject',
    });

    await ensureAm08ForSpecificity(reactiveCtx());
    expect(lastPatch()!.priority).toBe(AM08_PRIORITY_DEFAULT);
  });

  it('skips the patch entirely when the target rule cannot be opened', async () => {
    mountEditor({ id: 'grp-root' }, AM08_DEFAULT_NAME);
    await ensureAm08FullLogic(makeCtx());
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('waits for the editor to repaint before it patches the newly opened rule', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root' }, AM08_DEFAULT_NAME);

    const ctx = makeCtx();
    let pending: string | null = null;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="api-mock-route-r-regional"]') pending = AM08_REGIONAL_NAME;
    });
    vi.mocked(ctx.delay).mockImplementation(async (ms: number) => {
      if (ms !== 100 || !pending) return;
      document.querySelector<HTMLInputElement>(API_MOCK.ROUTE_NAME)!.value = pending;
      pending = null;
    });

    expect(await openAm08Rule(ctx, AM08_REGIONAL_NAME)).toBe(true);
    expect(am08OpenRuleName()).toBe(AM08_REGIONAL_NAME);
  });

  it('clicks a closed Regional row as a visible focus beat', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] }, AM08_DEFAULT_NAME);
    const ctx = reactiveCtx();
    await runAm08AllVsAny(ctx);
    expect(calls(ctx.click)).toContain('[data-testid="api-mock-route-r-regional"]');
    expect(calls(ctx.click)).toContain(API_MOCK.ADD_GROUP);
  });

  it('switches to the Match tab when the editor is parked elsewhere', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    document.querySelector(API_MOCK.ADD_CONDITION)?.remove();
    document.querySelector(API_MOCK.ADD_GROUP)?.remove();
    const match = el('button', 'am-btn', 'api-mock-btab-match');
    match.id = 'api-mock-btab-match';
    makeVisible(match);
    document.body.append(match);

    const ctx = reactiveCtx();
    expect(await openAm08Rule(ctx, AM08_REGIONAL_NAME)).toBe(true);
    expect(calls(ctx.click)).toContain(API_MOCK.BTAB_MATCH);
  });

  it('waits for the editor to catch up after a visible rule click', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] }, AM08_DEFAULT_NAME);
    const ctx = makeCtx();
    let pending: string | null = null;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="api-mock-route-r-regional"]') pending = AM08_REGIONAL_NAME;
    });
    vi.mocked(ctx.delay).mockImplementation(async (ms: number) => {
      if (ms !== 100 || !pending) return;
      document.querySelector<HTMLInputElement>(API_MOCK.ROUTE_NAME)!.value = pending;
      pending = null;
    });
    await runAm08AllVsAny(ctx);
    expect(am08OpenRuleName()).toBe(AM08_REGIONAL_NAME);
    expect(calls(ctx.click)).toContain('[data-testid="api-mock-route-r-regional"]');
  });

  it('step 1 bails when + Group produces no nested group', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const ctx = makeCtx();
    await runAm08AllVsAny(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ADD_GROUP);
  });

  it('step 2 bails when a tenant row cannot be added', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_EMPTY] });
    const ctx = makeCtx();
    await runAm08NestedGroup(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.groupAddCondition('grp-any')]);
  });

  it('step 2 bails when the second tenant row cannot be added', async () => {
    mountExplorer();
    mountEditor({
      id: 'grp-root',
      conditions: [VERSION_COND],
      nested: [{ id: 'grp-any', combinator: 'any', conditions: [EU_COND] }],
    });
    const ctx = makeCtx();
    await runAm08NestedGroup(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.groupAddCondition('grp-any')]);
  });

  it('step 3 bails when the debug row cannot be added', async () => {
    mountExplorer();
    mountEditor({
      id: 'grp-root',
      conditions: [VERSION_COND],
      nested: [ANY_TENANTS, { id: 'grp-not', combinator: 'not' }],
    });
    const ctx = makeCtx();
    await runAm08NotGroup(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.groupAddCondition('grp-not'));
  });

  it('ignores nested groups that do not carry the group testid prefix', () => {
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const nested = el('div', 'am-matcher-group nested', 'other-group');
    document.querySelector(API_MOCK.ROUTE_EDITOR)!.append(nested);
    expect(am08NestedGroupIds()).toEqual([]);
  });

  it('step 3 bails when the second nested group cannot be created', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS] });
    const ctx = makeCtx();
    await runAm08NotGroup(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ADD_GROUP);
  });

  it('step 3 reuses an existing None-of group and its debug row', async () => {
    mountExplorer();
    mountEditor({
      id: 'grp-root',
      conditions: [VERSION_COND],
      nested: [ANY_TENANTS, NOT_GUARD],
    });
    const ctx = reactiveCtx();
    await runAm08NotGroup(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_GROUP);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionSelector('p-debug'), AM08_DEBUG_KEY],
    ]);
  });

  it('skips Simulate open when it is already on screen', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS, NOT_GUARD] });
    mountSimulate({ hasResult: true, outcome: 'AMBIGUOUS' });
    const ctx = reactiveCtx();
    await runAm08ProveLogic(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE);
  });

  it('skips Settings open when the modal is already on screen', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    mountSettings();
    const ctx = reactiveCtx();
    await runAm08Priority(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SETTINGS);
    expect(calls(ctx.click)).toContain(API_MOCK.SETTINGS_TAB_SELECTION);
  });

  it('does not patch when the route bridge returns false', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    patchApiMockActiveRoute.mockReturnValue(false);
    await ensureAm08VersionOnly(reactiveCtx());
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
  });

  it('returns empty group ids when the group is missing', () => {
    expect(am08GroupConditionIds('missing')).toEqual([]);
    expect(am08GroupCombinator('missing')).toBe('');
  });

  it('returns null root id when the add button sits outside a group', () => {
    document.body.append(el('button', 'am-btn', 'api-mock-add-condition'));
    expect(am08RootGroupId()).toBeNull();
  });

  it('gives up returning to Studio when the nav is missing', async () => {
    document.body.innerHTML = '';
    const ctx = makeCtx();
    await ensureAm08StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('holds AM-08 spotlights longer than the shared pack, with extra time on Simulate review and Run', () => {
    expect(AM08_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM08_TIMING.fieldFilled).toBeGreaterThan(AM_DEMO_TIMING.fieldFilled);
    expect(AM08_TIMING.tabSwitch).toBeGreaterThan(AM_DEMO_TIMING.tabSwitch);
    expect(AM08_TIMING.panelReady).toBeGreaterThan(AM_DEMO_TIMING.panelReady);
    expect(AM08_TIMING.payoff).toBeGreaterThan(AM_DEMO_TIMING.payoff);
    expect(AM08_TIMING.groupBreak).toBeGreaterThan(AM_DEMO_TIMING.groupBreak);
    expect(AM08_TIMING.reviewForm).toBeGreaterThan(AM08_TIMING.payoff);
    expect(AM08_TIMING.beforeRun).toBeGreaterThan(AM08_TIMING.beforeOpen);
  });

  it('step 1 adds a nested Any-of group under All of', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const ctx = reactiveCtx();
    await runAm08AllVsAny(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ADD_GROUP);
    expect(fills(ctx.selectOption as never)).toEqual([
      [API_MOCK.groupCombinator('grp-new-1'), 'any'],
    ]);
  });

  it('step 1 reuses an existing nested group instead of adding another', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_EMPTY] });
    const ctx = reactiveCtx();
    await runAm08AllVsAny(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_GROUP);
    expect(fills(ctx.selectOption as never)).toEqual([
      [API_MOCK.groupCombinator('grp-any'), 'any'],
    ]);
  });

  it('step 2 authors both tenant exacts inside the nested group', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_EMPTY] });
    const ctx = reactiveCtx();
    await runAm08NestedGroup(ctx);
    expect(calls(ctx.click)).toEqual([
      API_MOCK.groupAddCondition('grp-any'),
      API_MOCK.groupAddCondition('grp-any'),
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionSelector('new-1'), AM08_TENANT_KEY],
      [API_MOCK.conditionValue('new-1'), AM08_TENANT_EU],
      [API_MOCK.conditionSelector('new-2'), AM08_TENANT_KEY],
      [API_MOCK.conditionValue('new-2'), AM08_TENANT_US],
    ]);
  });

  it('step 2 reuses tenant rows that already carry the values', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS] });
    const ctx = reactiveCtx();
    await runAm08NestedGroup(ctx);
    expect(calls(ctx.click)).toEqual([]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionSelector('p-eu'), AM08_TENANT_KEY],
      [API_MOCK.conditionValue('p-eu'), AM08_TENANT_EU],
      [API_MOCK.conditionSelector('p-us'), AM08_TENANT_KEY],
      [API_MOCK.conditionValue('p-us'), AM08_TENANT_US],
    ]);
  });

  it('step 2 no-ops when the nested group is missing', async () => {
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const ctx = makeCtx();
    await runAm08NestedGroup(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step 3 adds a None-of guard and a present check', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS] });
    const ctx = reactiveCtx();
    await runAm08NotGroup(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ADD_GROUP);
    expect(fills(ctx.selectOption as never)).toEqual([
      [API_MOCK.groupCombinator('grp-new-1'), 'not'],
      [API_MOCK.conditionOperator('new-2'), 'present'],
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionSelector('new-2'), AM08_DEBUG_KEY],
    ]);
  });

  it('step 4 simulates the overlapping request and closes', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS, NOT_GUARD] });
    const ctx = reactiveCtx();
    const outcome = await runAm08ProveLogic(ctx);
    expect(outcome).toBe('AMBIGUOUS');
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM08_PATH],
      [API_MOCK.SIMULATE_HEADERS, AM08_SIM_HEADERS],
    ]);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
    expect(isAm08SimulateOpen()).toBe(false);
  });

  it('step 5 fills priority 20 and tours Selection settings', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const ctx = reactiveCtx();
    await runAm08Priority(ctx);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.PRIORITY_INPUT, String(AM08_PRIORITY_RAISED)],
    ]);
    expect(calls(ctx.click)).toEqual([
      API_MOCK.SETTINGS,
      API_MOCK.SETTINGS_TAB_SELECTION,
      API_MOCK.SETTINGS_SAVE,
    ]);
  });

  it('step 6 holds the Winner badge then closes Simulate', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] }, AM08_REGIONAL_NAME, '20');
    const ctx = reactiveCtx();
    const outcome = await runAm08HighestPriority(ctx);
    expect(outcome).toBe('AMBIGUOUS');
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 7 switches to reject-multiple, edits the 409 body, and proves it', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] }, AM08_REGIONAL_NAME, '20');
    const ctx = reactiveCtx();
    await runAm08RejectMultiple(ctx);
    expect(fills(ctx.selectOption as never)).toEqual([
      [API_MOCK.SETTINGS_MULTIPLE_MATCH, 'reject_multiple'],
    ]);
    expect(fills(ctx.fill)).toEqual(expect.arrayContaining([
      [API_MOCK.SETTINGS_AMBIGUITY_BODY, AM08_AMBIGUITY_BODY],
      [API_MOCK.SIMULATE_HEADERS, AM08_SIM_HEADERS],
    ]));
    expect(patchApiMockServerSettings).toHaveBeenCalledWith({
      multipleMatchPolicy: 'reject_multiple',
      ambiguityBody: AM08_AMBIGUITY_BODY,
    });
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(isAm08SettingsOpen()).toBe(false);
    expect(isAm08SimulateOpen()).toBe(false);
  });

  it('step 8 switches the equal-priority policy and holds the specificity list', async () => {
    mountExplorer();
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND], nested: [ANY_TENANTS, NOT_GUARD] });
    const ctx = reactiveCtx();
    await runAm08Specificity(ctx);
    expect(fills(ctx.selectOption as never)).toEqual([
      [API_MOCK.SETTINGS_EQUAL_POLICY, 'specificity_then_id'],
    ]);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 1 no-ops when Regional cannot be focused', async () => {
    mountEditor({ id: 'grp-root', conditions: [VERSION_COND] });
    const ctx = makeCtx();
    await runAm08AllVsAny(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});
