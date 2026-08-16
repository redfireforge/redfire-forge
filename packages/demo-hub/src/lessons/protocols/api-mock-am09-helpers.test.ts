/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import type { DemoActionContext } from '../../types';
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
  AM09_CORPUS_SAMPLE,
  AM09_DAILY,
  AM09_HEALTH_A,
  AM09_HEALTH_B,
  AM09_HEALTH_PATH,
  AM09_ORDERS_PATH,
  AM09_TENANT_HEADER,
  AM09_DAILY_PATH,
  AM09_GLOB_PATH,
  AM09_NON_DAILY_PATH,
  AM09_DAILY_SAMPLE,
  AM09_NON_DAILY_SAMPLE,
  AM09_SEARCH_PATH,
  AM09_CLIENT_HEADER_HIT,
  AM09_SEARCH_HIT_SAMPLE,
  AM09_SEARCH_MISS_SAMPLE,
  AM09_ORDERS_CATCHALL,
  AM09_ORDERS_TENANT,
  AM09_REPORTS_GLOB,
  AM09_SEARCH_PREFIX,
  AM09_SEARCH_REGION,
  AM09_KIND_DEFINITE,
  AM09_KIND_DUPLICATE,
  AM09_KIND_POTENTIAL,
  AM09_KIND_SHADOWED,
  AM09_PRIORITY_RAISED,
  AM09_PRIORITY_STALE,
  AM09_TIMING,
  am09DimRows,
  am09FilterActive,
  am09FilterCount,
  am09FindingCount,
  am09FingerprintsOpen,
  am09HasFindings,
  am09OpenRuleName,
  am09PriorityValue,
  am09RuleRow,
  am09RuleRows,
  am09RuleSelector,
  am09SimOutcome,
  am09SummaryText,
  cleanupAm09,
  closeAm09Simulate,
  ensureAm09Analyzed,
  ensureAm09ConflictsView,
  ensureAm09Filter,
  ensureAm09ForAcknowledge,
  ensureAm09ForFix,
  ensureAm09ForShadowedWitness,
  ensureAm09ForDefiniteWitness,
  ensureAm09ForPotentialWitness,
  ensureAm09ReadyForPair,
  ensureAm09PriorityRaised,
  ensureAm09StudioView,
  ensureAm09Workspace,
  hasAm09RouteEditor,
  hasAm09Workspace,
  isAm09ConflictsView,
  isAm09RuleOpen,
  isAm09SimulateOpen,
  isAm09StudioViewActive,
  openAm09Rule,
  prepareAm09Workspace,
  runAm09Acknowledge,
  runAm09Analyze,
  runAm09Definite,
  runAm09DefiniteWitness,
  runAm09DefiniteVsPotential,
  runAm09Potential,
  runAm09PotentialWitness,
  runAm09Duplicate,
  runAm09FixPriority,
  runAm09GotoRule,
  runAm09Shadowed,
  runAm09ShadowedWitness,
  runAm09Witness,
} from './api-mock-am09-helpers';

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

const CORPUS = [
  { testid: 'r-health-a', name: AM09_HEALTH_A, path: AM09_HEALTH_PATH },
  { testid: 'r-health-b', name: AM09_HEALTH_B, path: AM09_HEALTH_PATH },
  { testid: 'r-orders-all', name: AM09_ORDERS_CATCHALL, path: '/orders' },
  { testid: 'r-orders-tenant', name: AM09_ORDERS_TENANT, path: '/orders' },
  { testid: 'r-daily', name: AM09_DAILY, path: '/reports/daily' },
  { testid: 'r-glob', name: AM09_REPORTS_GLOB, path: '/reports/*' },
  { testid: 'r-search-a', name: AM09_SEARCH_PREFIX, path: '/search' },
  { testid: 'r-search-b', name: AM09_SEARCH_REGION, path: '/search' },
];

function mountExplorer(): void {
  if (document.querySelector(API_MOCK.ROUTE_EXPLORER)) return;
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  for (const rule of CORPUS) {
    const wrap = el('div', 'am-tree-route-row');
    const row = el('button', 'am-route-item', `api-mock-route-${rule.testid}`);
    row.setAttribute('role', 'treeitem');
    row.setAttribute('data-route-name', rule.name);
    const method = el('span', 'am-method get');
    method.textContent = 'GET';
    const path = el('span', 'am-route-path');
    path.textContent = rule.path;
    row.append(method, path);
    const del = el('button', 'am-icon-btn am-route-delete');
    del.setAttribute('aria-label', `Delete rule ${rule.name}`);
    wrap.append(row, del);
    explorer.append(wrap);
  }
  explorer.append(el('button', 'am-btn', 'api-mock-analyze'));
  document.body.append(explorer);
  mountChrome();
}

function mountEditor(name = AM09_HEALTH_A, priority = '10', withNotice = false): void {
  document.querySelector(API_MOCK.ROUTE_EDITOR)?.remove();
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const nameField = input('api-mock-route-name', name);
  editor.append(nameField);
  editor.append(input('api-mock-path-input', name === AM09_DAILY ? '/reports/daily' : AM09_HEALTH_PATH));
  editor.append(input('api-mock-priority-input', priority));
  if (name === AM09_ORDERS_CATCHALL || name === AM09_HEALTH_A || name === AM09_HEALTH_B) {
    editor.append(el('div', 'am-empty', 'api-mock-conditions-empty'));
  } else {
    const row = el('div', 'am-matcher-row', 'api-mock-condition-1');
    editor.append(row);
  }
  if (withNotice) editor.append(el('div', 'am-notice warning', 'api-mock-conflict-notice'));
  document.body.append(editor);
}

function mountHealthCandidate(routeId: string, path: string): HTMLElement {
  const row = el('div', 'am-candidate', `api-mock-sim-candidate-${routeId}`);
  const head = el('div', 'am-candidate-head');
  const method = el('span', 'am-method get');
  method.textContent = 'GET';
  const title = el('strong', 'am-route-title');
  title.textContent = path;
  head.append(method, title);
  row.append(head);
  return row;
}

function currentSimPath(): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.SIMULATE_PATH)?.value ?? '';
}

function currentSimHeaders(): string {
  return document.querySelector<HTMLTextAreaElement>(API_MOCK.SIMULATE_HEADERS)?.value ?? '';
}

function paintSimulateResult(result: HTMLElement, outcome: string, path: string): void {
  result.replaceChildren();
  const badge = el('span', 'am-badge', 'api-mock-sim-outcome');
  badge.textContent = outcome;
  result.append(badge);
  if (path.includes('/search')) {
    const prefix = mountHealthCandidate('search-prefix', AM09_SEARCH_PATH);
    const region = mountHealthCandidate('search-region', AM09_SEARCH_PATH);
    if (outcome === 'UNMATCHED') {
      const miss = el('span', 'am-badge warning');
      miss.textContent = 'Conditions failed';
      prefix.querySelector('.am-candidate-head')?.append(miss.cloneNode(true));
      region.querySelector('.am-candidate-head')?.append(miss);
    }
    result.append(prefix, region);
    return;
  }
  if (path.includes('non-daily')) {
    const daily = mountHealthCandidate('reports-daily', AM09_DAILY_PATH);
    const failed = el('span', 'am-badge danger');
    failed.textContent = 'Path failed';
    daily.querySelector('.am-candidate-head')?.append(failed);
    const glob = mountHealthCandidate('reports-glob', AM09_GLOB_PATH);
    const winner = el('span', 'am-badge success', 'api-mock-sim-winner');
    winner.textContent = 'Winner';
    glob.querySelector('.am-candidate-head')?.append(winner);
    result.append(daily, glob);
    return;
  }
  if (path.includes('/reports')) {
    result.append(mountHealthCandidate('reports-daily', AM09_DAILY_PATH));
    result.append(mountHealthCandidate('reports-glob', AM09_GLOB_PATH));
    return;
  }
  if (outcome === 'MATCHED') {
    const catchAll = mountHealthCandidate('orders-catch', AM09_ORDERS_PATH);
    const winner = el('span', 'am-badge success', 'api-mock-sim-winner');
    winner.textContent = 'Winner';
    catchAll.querySelector('.am-candidate-head')?.append(winner);
    result.append(catchAll);
    result.append(mountHealthCandidate('orders-tenant', AM09_ORDERS_PATH));
    return;
  }
  result.append(mountHealthCandidate('health-a', AM09_HEALTH_PATH));
  result.append(mountHealthCandidate('health-b', AM09_HEALTH_PATH));
}

function mountRenderedPane(): void {
  const result = document.querySelector(API_MOCK.SIMULATE_RESULT);
  if (!result || document.querySelector(API_MOCK.SIMULATE_RENDERED_BODY)) return;
  const outcome = document.querySelector(API_MOCK.SIMULATE_OUTCOME)?.textContent ?? '';
  const path = currentSimPath();
  const status = el('span', 'am-badge', 'api-mock-sim-rendered-status');
  const body = el('pre', 'am-code', 'api-mock-sim-rendered-body');
  if (outcome === 'UNMATCHED') {
    status.textContent = '404';
    body.textContent = '{"error":"not_found"}';
  } else if (outcome === 'MATCHED') {
    status.textContent = '200';
    body.textContent = path.includes('non-daily')
      ? '{"report":"any"}'
      : '{"orders":[],"scope":"all"}';
  } else {
    status.textContent = '409';
    body.textContent = '{"error":"ambiguous","competingRules":2}';
  }
  result.append(status, body);
}

function mountSimulate(outcome = 'AMBIGUOUS', path?: string): void {
  if (document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) return;
  const resolvedPath = path
    ?? (outcome === 'MATCHED' ? AM09_ORDERS_PATH : AM09_HEALTH_PATH);
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(select('api-mock-simulate-method', 'GET'));
  workspace.append(input('api-mock-simulate-path', resolvedPath));
  workspace.append(el('textarea', undefined, 'api-mock-simulate-headers'));
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-run'));
  workspace.append(el('button', 'am-btn', 'api-mock-simulate-close'));
  workspace.append(el('button', 'am-btn', 'api-mock-sim-view-request'));
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-save-sample'));
  workspace.append(input('api-mock-simulate-sample-name'));
  workspace.append(el('button', 'am-btn', 'api-mock-sim-tab-rendered'));
  const result = el('div', 'am-sim-result', 'api-mock-simulate-result');
  paintSimulateResult(result, outcome, resolvedPath);
  workspace.append(result);
  document.body.append(workspace);
}

function filterBtn(kind: string, label: string, count: number, active = false): HTMLElement {
  const btn = el('button', `am-btn small${active ? ' active' : ''}`, `api-mock-conflict-filter-${kind}`);
  btn.append(document.createTextNode(label));
  if (count > 0) {
    const badge = el('span', 'am-count-badge');
    badge.textContent = String(count);
    btn.append(badge);
  }
  return btn;
}

interface ConflictsSpec {
  definiteCount?: number;
  shadowedCount?: number;
  ack?: boolean;
  stale?: boolean;
  emptyDefinite?: boolean;
  prioMenu?: boolean;
  fingerprintsOpen?: boolean;
}

function mountConflicts(spec: ConflictsSpec = {}): void {
  document.querySelector(API_MOCK.CONFLICTS_PAGE)?.remove();
  const definiteCount = spec.emptyDefinite ? 0 : (spec.definiteCount ?? 1);
  const shadowedCount = spec.shadowedCount ?? 1;
  const page = el('div', 'api-mock-conflicts-page', 'api-mock-conflicts-page');
  page.append(el('button', 'am-btn', 'api-mock-conflicts-analyze'));
  const inspector = el('div', 'am-conflict-inspector', 'api-mock-conflict-inspector');
  const summary = el('div', 'am-conflict-summary', 'api-mock-conflict-summary');
  summary.innerHTML = '<strong>4 findings</strong>';
  inspector.append(summary);
  const filters = el('div', 'am-conflict-filters', 'api-mock-conflict-filters');
  filters.append(filterBtn('all', 'All', 4, true));
  filters.append(filterBtn('duplicate', 'Duplicate', 1));
  filters.append(filterBtn('shadowed', 'Shadowed', shadowedCount));
  filters.append(filterBtn('definite_overlap', 'Definite', definiteCount));
  filters.append(filterBtn('potential_overlap', 'Potential', 1));
  filters.append(filterBtn('unreachable', 'Unreachable', 0));
  inspector.append(filters);

  const list = el('div', 'am-conflict-list', 'api-mock-conflict-list');
  if (spec.emptyDefinite) {
    list.append(el('div', 'am-dock-empty', 'api-mock-conflict-filter-empty'));
  } else {
    const kinds: Array<[string, string, string]> = [
      ['cf-dup', 'duplicate', 'Duplicate routes'],
      ['cf-sh', 'shadowed', 'Shadowed'],
      ['cf-def', 'definite_overlap', 'Definite overlap'],
      ['cf-pot', 'potential_overlap', 'Potential overlap'],
    ];
    for (const [id, kind, title] of kinds) {
      const finding = el('button', `am-finding-row${id === 'cf-dup' ? ' active' : ''}`, `api-mock-finding-${id}`);
      finding.setAttribute('data-kind', kind);
      finding.textContent = title;
      list.append(finding);
    }
  }
  inspector.append(list);

  if (!spec.emptyDefinite) {
    const detail = el('div', 'am-conflict-detail', 'api-mock-conflict-detail');
    detail.append(el('div', 'am-conflict-compare', 'api-mock-conflict-compare'));
    const dims = el('div', 'am-dim-table', 'api-mock-conflict-dimensions');
    const overlap = el('div', 'am-dim-row', 'api-mock-conflict-dim-row');
    overlap.setAttribute('data-result', 'overlap');
    dims.append(overlap);
    const unknown = el('div', 'am-dim-row', 'api-mock-conflict-dim-row');
    unknown.setAttribute('data-testid', 'api-mock-conflict-dim-row');
    unknown.setAttribute('data-result', 'unknown');
    dims.append(unknown);
    detail.append(dims);
    detail.append(el('pre', 'am-code-block', 'api-mock-conflict-witness'));
    detail.append(el('button', 'am-btn small', 'api-mock-conflict-simulate'));
    detail.append(el('button', 'am-btn small', 'api-mock-conflict-goto-left'));
    const fp = el('details', 'am-fingerprints', 'api-mock-conflict-fingerprints') as HTMLDetailsElement;
    if (spec.fingerprintsOpen) fp.open = true;
    fp.append(el('summary', undefined, 'api-mock-conflict-fingerprints-summary'));
    const hashes = el('div', 'am-fingerprints-body', 'api-mock-conflict-fingerprint-hashes');
    hashes.append(el('span', 'am-badge warning', 'api-mock-conflict-fingerprint-relation'));
    hashes.append(el('code', 'am-fingerprint-hash', 'api-mock-conflict-fingerprint-left'));
    hashes.append(el('code', 'am-fingerprint-hash', 'api-mock-conflict-fingerprint-right'));
    fp.append(hashes);
    detail.append(fp);
    if (spec.stale) detail.append(el('div', 'am-notice warning', 'api-mock-conflict-stale'));
    if (spec.ack) detail.append(el('div', 'am-notice', 'api-mock-conflict-ack'));
    else detail.append(el('button', 'am-btn', 'api-mock-conflict-acknowledge'));
    detail.append(el('button', 'am-btn', 'api-mock-conflict-adjust-priority'));
    if (spec.prioMenu) {
      const menu = el('div', 'am-conflict-prio-menu', 'api-mock-conflict-prio-menu');
      menu.append(el('button', 'am-btn small', 'api-mock-conflict-prio-left'));
      detail.append(menu);
    }
    inspector.append(detail);
  }

  page.append(inspector);
  document.body.append(page);
}

function mountChrome(): void {
  if (!document.querySelector(API_MOCK.VIEW_STUDIO)) {
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
  }
  if (!document.querySelector(API_MOCK.VIEW_CONFLICTS)) {
    document.body.append(el('button', 'am-btn', 'api-mock-view-conflicts'));
  }
}

function setFilterActive(kind: string): void {
  document.querySelectorAll('[data-testid^="api-mock-conflict-filter-"]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-testid') === `api-mock-conflict-filter-${kind}`);
  });
}

function reactiveCtx(): DemoActionContext {
  const ctx = makeCtx();
  vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
    const rule = CORPUS.find(r => (
      selector === `[data-testid="api-mock-route-${r.testid}"]`
      || selector === API_MOCK.routeNamed(r.name)
    ));
    if (rule) {
      mountEditor(rule.name, rule.name === AM09_DAILY ? '10' : '10', rule.name === AM09_HEALTH_A);
      return;
    }
    if (selector === API_MOCK.ANALYZE || selector === API_MOCK.VIEW_CONFLICTS || selector === API_MOCK.CONFLICTS_ANALYZE) {
      mountConflicts();
      return;
    }
    if (selector === API_MOCK.VIEW_STUDIO) {
      mountExplorer();
      return;
    }
    if (selector === API_MOCK.conflictFilter(AM09_KIND_DUPLICATE)) {
      setFilterActive(AM09_KIND_DUPLICATE);
      return;
    }
    if (selector === API_MOCK.conflictFilter(AM09_KIND_SHADOWED)) {
      setFilterActive(AM09_KIND_SHADOWED);
      if (document.querySelector(API_MOCK.CONFLICT_FILTER_EMPTY)) {
        mountConflicts({ shadowedCount: 2 });
        setFilterActive(AM09_KIND_SHADOWED);
      }
      return;
    }
    if (selector === API_MOCK.conflictFilter(AM09_KIND_DEFINITE)) {
      setFilterActive(AM09_KIND_DEFINITE);
      return;
    }
    if (selector === API_MOCK.conflictFilter(AM09_KIND_POTENTIAL)) {
      setFilterActive(AM09_KIND_POTENTIAL);
      return;
    }
    if (selector === API_MOCK.CONFLICT_SIMULATE) {
      if (am09FilterActive(AM09_KIND_SHADOWED)) mountSimulate('MATCHED', AM09_ORDERS_PATH);
      else if (am09FilterActive(AM09_KIND_DEFINITE)) mountSimulate('AMBIGUOUS', AM09_DAILY_PATH);
      else if (am09FilterActive(AM09_KIND_POTENTIAL)) mountSimulate('AMBIGUOUS', AM09_SEARCH_PATH);
      else mountSimulate();
      return;
    }
    if (selector === API_MOCK.SIMULATE_RUN) {
      const path = currentSimPath();
      const headers = currentSimHeaders();
      const outcome = path.includes('non-daily') || am09FilterActive(AM09_KIND_SHADOWED)
        ? 'MATCHED'
        : path.includes('/search')
          ? (headers.includes('acme-west') ? 'AMBIGUOUS' : 'UNMATCHED')
          : 'AMBIGUOUS';
      const result = document.querySelector<HTMLElement>(API_MOCK.SIMULATE_RESULT);
      if (result) {
        document.querySelector(API_MOCK.SIMULATE_RENDERED_BODY)?.remove();
        document.querySelector(API_MOCK.SIMULATE_RENDERED_STATUS)?.remove();
        paintSimulateResult(result, outcome, path);
      } else {
        mountSimulate(outcome, path);
      }
      return;
    }
    if (selector === API_MOCK.SIMULATE_TAB_RENDERED) {
      mountRenderedPane();
      return;
    }
    if (selector === API_MOCK.SIMULATE_CLOSE) {
      document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
      return;
    }
    if (selector === API_MOCK.CONFLICT_ADJUST_PRIORITY) {
      const detail = document.querySelector(API_MOCK.CONFLICT_DETAIL);
      if (detail && !document.querySelector(API_MOCK.CONFLICT_PRIO_MENU)) {
        const menu = el('div', 'am-conflict-prio-menu', 'api-mock-conflict-prio-menu');
        menu.append(el('button', 'am-btn small', 'api-mock-conflict-prio-left'));
        detail.append(menu);
      }
      return;
    }
    if (selector === API_MOCK.CONFLICT_PRIO_LEFT) {
      mountConflicts({ emptyDefinite: true, shadowedCount: 2 });
      setFilterActive(AM09_KIND_DEFINITE);
      return;
    }
    if (selector === API_MOCK.CONFLICT_ACKNOWLEDGE) {
      document.querySelector(API_MOCK.CONFLICT_ACKNOWLEDGE)?.remove();
      document.querySelector(API_MOCK.CONFLICT_DETAIL)
        ?.append(el('div', 'am-notice', 'api-mock-conflict-ack'));
      return;
    }
    if (selector === API_MOCK.CONFLICT_GOTO_LEFT) {
      mountEditor(AM09_HEALTH_A, '10', true);
      return;
    }
    if (selector === API_MOCK.CONFLICT_FINGERPRINTS_SUMMARY) {
      const fp = document.querySelector<HTMLDetailsElement>(API_MOCK.CONFLICT_FINGERPRINTS);
      if (fp) fp.open = true;
    }
  });
  vi.mocked(ctx.fill).mockImplementation(async (selector: string, value: string) => {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (field) field.value = value;
  });
  vi.mocked(ctx.waitFor).mockImplementation(async (selector: string) => {
    if (selector === API_MOCK.SIMULATE_OUTCOME && !document.querySelector(selector)) {
      if (am09FilterActive(AM09_KIND_SHADOWED)) mountSimulate('MATCHED', AM09_ORDERS_PATH);
      else if (am09FilterActive(AM09_KIND_DEFINITE)) mountSimulate('AMBIGUOUS', AM09_DAILY_PATH);
      else if (am09FilterActive(AM09_KIND_POTENTIAL)) mountSimulate('AMBIGUOUS', AM09_SEARCH_PATH);
      else mountSimulate();
    }
    if (selector === API_MOCK.SIMULATE_RENDERED_BODY && !document.querySelector(selector)) {
      if (!document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) mountSimulate();
      mountRenderedPane();
    }
    if (selector === API_MOCK.CONFLICT_STALE && !document.querySelector(selector)) {
      mountConflicts({ stale: true, ack: false });
      setFilterActive(AM09_KIND_DUPLICATE);
    }
    if (selector === API_MOCK.CONFLICT_FILTER_EMPTY && !document.querySelector(selector)) {
      mountConflicts({ emptyDefinite: true, shadowedCount: 2 });
    }
    if (selector === API_MOCK.CONFLICT_ACK && !document.querySelector(selector)) {
      document.querySelector(API_MOCK.CONFLICT_DETAIL)
        ?.append(el('div', 'am-notice', 'api-mock-conflict-ack'));
    }
    if (selector === API_MOCK.CONFLICT_PRIO_MENU && !document.querySelector(selector)) {
      const detail = document.querySelector(API_MOCK.CONFLICT_DETAIL);
      if (detail) {
        const menu = el('div', 'am-conflict-prio-menu', 'api-mock-conflict-prio-menu');
        menu.append(el('button', 'am-btn small', 'api-mock-conflict-prio-left'));
        detail.append(menu);
      }
    }
  });
  return ctx;
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

describe('AM-09 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
    mountChrome();
  });

  it('boots the overlaps corpus and wipes on cleanup', async () => {
    await prepareAm09Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM09_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    await cleanupAm09();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the overlaps corpus cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm09Workspace()).rejects.toThrow(/failed to import am-gallery-overlaps/);
  });

  it('reseeds the corpus when the studio landing is empty', async () => {
    await ensureAm09Workspace(makeCtx());
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM09_CORPUS_SAMPLE);
  });

  it('identifies corpus rows by the delete-button name', () => {
    expect(am09RuleRows()).toEqual([]);
    mountExplorer();
    expect(am09RuleRows()).toHaveLength(8);
    expect(am09RuleRow(AM09_HEALTH_A)?.getAttribute('data-testid')).toBe('api-mock-route-r-health-a');
    expect(am09RuleSelector(AM09_DAILY)).toBe(API_MOCK.routeNamed(AM09_DAILY));
    expect(am09RuleRow('Missing')).toBeNull();
  });

  it('reads the open rule and probes conflicts / simulate', () => {
    expect(isAm09StudioViewActive()).toBe(false);
    expect(isAm09ConflictsView()).toBe(false);
    expect(hasAm09Workspace()).toBe(false);
    mountExplorer();
    expect(isAm09StudioViewActive()).toBe(true);
    expect(hasAm09Workspace()).toBe(true);
    mountEditor();
    expect(hasAm09RouteEditor()).toBe(true);
    expect(am09OpenRuleName()).toBe(AM09_HEALTH_A);
    expect(isAm09RuleOpen(AM09_HEALTH_A)).toBe(true);
    expect(am09PriorityValue()).toBe('10');
    mountConflicts();
    expect(isAm09ConflictsView()).toBe(true);
    expect(am09HasFindings()).toBe(true);
    expect(am09FindingCount()).toBe(4);
    expect(am09FilterActive('all')).toBe(true);
    expect(am09FilterCount(AM09_KIND_DUPLICATE)).toBe(1);
    expect(am09SummaryText()).toContain('4 findings');
    expect(am09DimRows().length).toBeGreaterThan(0);
    expect(am09FingerprintsOpen()).toBe(false);
    mountSimulate();
    expect(isAm09SimulateOpen()).toBe(true);
    expect(am09SimOutcome()).toBe('AMBIGUOUS');
  });

  it('closes Simulate when it is open, and skips when it is not', async () => {
    const ctx = reactiveCtx();
    await closeAm09Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    mountSimulate();
    await closeAm09Simulate(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.SIMULATE_CLOSE]);
    expect(isAm09SimulateOpen()).toBe(false);
  });

  it('ensure studio / conflicts / workspace skip when already ready', async () => {
    mountExplorer();
    const idle = makeCtx();
    await ensureAm09StudioView(idle);
    expect(idle.click).not.toHaveBeenCalled();

    mountConflicts();
    const alreadyConflicts = makeCtx();
    await ensureAm09ConflictsView(alreadyConflicts);
    expect(alreadyConflicts.click).not.toHaveBeenCalled();

    await ensureAm09Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();

    const analyzed = makeCtx();
    await ensureAm09Analyzed(analyzed);
    expect(analyzed.click).not.toHaveBeenCalled();
  });

  it('opens Conflicts when the inspector is not on screen', async () => {
    const ctx = reactiveCtx();
    await ensureAm09ConflictsView(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.VIEW_CONFLICTS]);
    expect(isAm09ConflictsView()).toBe(true);
  });

  it('ensure analyzed clicks Analyze when findings are missing', async () => {
    mountExplorer();
    const ctx = reactiveCtx();
    await ensureAm09Analyzed(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ANALYZE);
    expect(am09HasFindings()).toBe(true);
  });

  it('ensure filter no-ops when the kind is already active', async () => {
    mountConflicts();
    setFilterActive(AM09_KIND_DUPLICATE);
    const ctx = makeCtx();
    await ensureAm09Filter(ctx, AM09_KIND_DUPLICATE);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('opens a named rule from the explorer', async () => {
    mountExplorer();
    const ctx = reactiveCtx();
    expect(await openAm09Rule(ctx, AM09_HEALTH_A)).toBe(true);
    expect(isAm09RuleOpen(AM09_HEALTH_A)).toBe(true);
  });

  it('ensure priority-raised patches Daily when the definite filter still has a row', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await ensureAm09PriorityRaised(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ priority: AM09_PRIORITY_RAISED });
  });

  it('ensure priority-raised skips the patch when definite is already empty', async () => {
    mountConflicts({ emptyDefinite: true, shadowedCount: 2 });
    const ctx = makeCtx();
    await ensureAm09PriorityRaised(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('step 1 analyzes and stays on the four-kind map', async () => {
    mountExplorer();
    const ctx = reactiveCtx();
    await runAm09Analyze(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.ANALYZE);
    expect(calls(ctx.click)).not.toContain(API_MOCK.VIEW_STUDIO);
    expect(am09HasFindings()).toBe(true);
  });

  it('step 2 shows Health A vs Health B, then Duplicate fingerprints', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09Duplicate(ctx);
    expect(calls(ctx.click)).toEqual(expect.arrayContaining([
      API_MOCK.routeNamed(AM09_HEALTH_A),
      API_MOCK.routeNamed(AM09_HEALTH_B),
      API_MOCK.VIEW_CONFLICTS,
      API_MOCK.conflictFilter(AM09_KIND_DUPLICATE),
      API_MOCK.CONFLICT_FINGERPRINTS_SUMMARY,
    ]));
    expect(am09FingerprintsOpen()).toBe(true);
  });

  it('step 5 shows the two /orders rules, then Shadowed', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09Shadowed(ctx);
    expect(calls(ctx.click)).toEqual(expect.arrayContaining([
      API_MOCK.routeNamed(AM09_ORDERS_CATCHALL),
      API_MOCK.routeNamed(AM09_ORDERS_TENANT),
      API_MOCK.conflictFilter(AM09_KIND_SHADOWED),
    ]));
  });

  it('step 6 simulates the shadowed witness and closes Simulate', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    const outcome = await runAm09ShadowedWitness(ctx);
    expect(outcome).toBe('MATCHED');
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_SIMULATE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_HEADERS,
      AM09_TENANT_HEADER,
    ]);
    expect(isAm09SimulateOpen()).toBe(false);
  });

  it('step 7 shows daily vs glob, then Definite', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09Definite(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.routeNamed(AM09_DAILY));
    expect(calls(ctx.click)).toContain(API_MOCK.routeNamed(AM09_REPORTS_GLOB));
    expect(calls(ctx.click)).toContain(API_MOCK.conflictFilter(AM09_KIND_DEFINITE));
    expect(calls(ctx.click)).not.toContain(API_MOCK.conflictFilter(AM09_KIND_POTENTIAL));
  });

  it('step 8 simulates daily 409 then non-daily glob-only 200', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    const { daily, globOnly } = await runAm09DefiniteWitness(ctx);
    expect(daily).toBe('AMBIGUOUS');
    expect(globOnly).toBe('MATCHED');
    expect(calls(ctx.click).filter(sel => sel === API_MOCK.SIMULATE_RUN)).toHaveLength(2);
    expect(calls(ctx.click).filter(sel => sel === API_MOCK.SIMULATE_SAVE_SAMPLE)).toHaveLength(2);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_PATH,
      AM09_NON_DAILY_PATH,
    ]);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_SAMPLE_NAME,
      AM09_DAILY_SAMPLE,
    ]);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_SAMPLE_NAME,
      AM09_NON_DAILY_SAMPLE,
    ]);
    expect(isAm09SimulateOpen()).toBe(false);
  });

  it('compat runner still walks Definite then Potential', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09DefiniteVsPotential(ctx);
    expect(calls(ctx.click)).toEqual(expect.arrayContaining([
      API_MOCK.conflictFilter(AM09_KIND_DEFINITE),
      API_MOCK.conflictFilter(AM09_KIND_POTENTIAL),
    ]));
  });

  it('step 9 shows the two /search rules, then Potential', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09Potential(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.routeNamed(AM09_SEARCH_PREFIX));
    expect(calls(ctx.click)).toContain(API_MOCK.routeNamed(AM09_SEARCH_REGION));
    expect(calls(ctx.click)).toContain(API_MOCK.conflictFilter(AM09_KIND_POTENTIAL));
    expect(calls(ctx.click)).not.toContain(API_MOCK.conflictFilter(AM09_KIND_DEFINITE));
  });

  it('step 10 simulates header hit 409 then no-header 404', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    const { hit, miss } = await runAm09PotentialWitness(ctx);
    expect(hit).toBe('AMBIGUOUS');
    expect(miss).toBe('UNMATCHED');
    expect(calls(ctx.click).filter(sel => sel === API_MOCK.SIMULATE_RUN)).toHaveLength(2);
    expect(calls(ctx.click).filter(sel => sel === API_MOCK.SIMULATE_SAVE_SAMPLE)).toHaveLength(2);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_HEADERS,
      AM09_CLIENT_HEADER_HIT,
    ]);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_HEADERS,
      '',
    ]);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_SAMPLE_NAME,
      AM09_SEARCH_HIT_SAMPLE,
    ]);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.SIMULATE_SAMPLE_NAME,
      AM09_SEARCH_MISS_SAMPLE,
    ]);
    expect(isAm09SimulateOpen()).toBe(false);
    const delayMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, [ms]) => sum + Number(ms ?? 0), 0);
    expect(delayMs).toBeGreaterThan(6_000);
    expect(delayMs).toBeLessThan(28_000);
  });

  it('pair-ready guard opens the first Studio rule', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await ensureAm09ReadyForPair(ctx, AM09_HEALTH_A);
    expect(isAm09RuleOpen(AM09_HEALTH_A)).toBe(true);
  });

  it('step 3 simulates the duplicate witness and closes Simulate', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    const outcome = await runAm09Witness(ctx);
    expect(outcome).toBe('AMBIGUOUS');
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_SIMULATE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
    expect(isAm09SimulateOpen()).toBe(false);
  });

  it('step 4 opens the left rule then returns to Conflicts', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09GotoRule(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_GOTO_LEFT);
    expect(calls(ctx.click)).toContain(API_MOCK.VIEW_CONFLICTS);
    expect(hasAm09RouteEditor()).toBe(true);
  });

  it('step 11 raises left priority and reclassifies Definite to empty', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09FixPriority(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_ADJUST_PRIORITY);
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_PRIO_LEFT);
    expect(am09FilterActive(AM09_KIND_SHADOWED)).toBe(true);
    expect(am09SummaryText()).toContain('4 findings');
  });

  it('step 12 acknowledges, edits priority, and waits for Stale', async () => {
    mountExplorer();
    mountConflicts();
    const ctx = reactiveCtx();
    await runAm09Acknowledge(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.CONFLICT_ACKNOWLEDGE);
    expect(vi.mocked(ctx.fill).mock.calls).toContainEqual([
      API_MOCK.PRIORITY_INPUT,
      String(AM09_PRIORITY_STALE),
    ]);
    expect(document.querySelector(API_MOCK.CONFLICT_STALE)).toBeTruthy();
    const delayMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, [ms]) => sum + Number(ms ?? 0), 0);
    expect(delayMs).toBeLessThan(28_000);
  });

  it('step 12 no-ops further edits when Stale is already on screen', async () => {
    mountExplorer();
    mountEditor(AM09_DAILY, String(AM09_PRIORITY_RAISED));
    mountConflicts({ stale: true });
    const ctx = reactiveCtx();
    await runAm09Acknowledge(ctx);
    expect(vi.mocked(ctx.fill).mock.calls).toEqual([]);
  });

  it('step 1 uses Conflicts when Analyze is missing', async () => {
    const toggle = el('button', 'am-btn', 'api-mock-view-conflicts');
    document.body.append(toggle);
    const ctx = makeCtx();
    await runAm09Analyze(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.VIEW_CONFLICTS);
    expect(calls(ctx.click)).not.toContain(API_MOCK.ANALYZE);
  });

  it('step 1 does not wait on Analyze when the workspace is still empty', async () => {
    document.body.innerHTML = '';
    const ctx = makeCtx();
    await runAm09Analyze(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM09_CORPUS_SAMPLE);
    expect(calls(ctx.click)).toEqual([]);
  });

  it('ensure for-fix / for-acknowledge land on the expected filters', async () => {
    mountExplorer();
    mountConflicts({ emptyDefinite: true, shadowedCount: 2 });
    const ctx = reactiveCtx();
    await ensureAm09ForFix(ctx);
    expect(am09FilterActive(AM09_KIND_DEFINITE) || am09HasFindings()).toBe(true);
    await ensureAm09ForDefiniteWitness(ctx);
    expect(am09FilterActive(AM09_KIND_DEFINITE) || isAm09ConflictsView()).toBe(true);
    await ensureAm09ForShadowedWitness(ctx);
    expect(am09FilterActive(AM09_KIND_SHADOWED) || isAm09ConflictsView()).toBe(true);
    await ensureAm09ForPotentialWitness(ctx);
    expect(am09FilterActive(AM09_KIND_POTENTIAL) || isAm09ConflictsView()).toBe(true);
    await ensureAm09ForAcknowledge(ctx);
    expect(am09FilterActive(AM09_KIND_DUPLICATE) || isAm09ConflictsView()).toBe(true);
  });

  it('uses the slower AM-04…AM-08 holds', () => {
    expect(AM09_TIMING.look).toBe(900);
    expect(AM09_TIMING.payoff).toBe(1600);
    expect(AM09_TIMING.beforeOpen).toBe(1400);
    expect(AM09_TIMING.reviewForm).toBe(2400);
    expect(AM09_TIMING.beforeRun).toBe(2600);
  });
});
