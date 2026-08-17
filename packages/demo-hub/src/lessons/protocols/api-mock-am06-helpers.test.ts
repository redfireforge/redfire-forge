/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchJsonSchema } from '@shared/api-mock/schemaMatchers';
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
  AM06_TIMING,
  AM06_CORPUS_SAMPLE,
  AM06_COMPLETE_ID,
  AM06_INVALID_BODY,
  AM06_INVALID_CUSTOMER,
  AM06_RICH_NOTE,
  AM06_RICH_TIER,
  AM06_JSONPATH,
  AM06_SAMPLE_COMPLETE,
  AM06_SAMPLE_EXTRAS,
  AM06_SAMPLE_INVALID,
  AM06_SAMPLE_STRICT,
  AM06_PICK_TOKEN,
  AM06_RICH_BODY,
  AM06_RULE_METHOD,
  AM06_RULE_PATH,
  AM06_SCHEMA,
  AM06_SCHEMA_PRESET,
  AM06_SKU,
  AM06_SKU_FAMILY,
  AM06_SUBSET_EXPECTED,
  am06ConditionCount,
  am06ConditionExpr,
  am06ConditionIds,
  am06ConditionOperator,
  am06ConditionRows,
  am06ConditionSchema,
  am06ConditionValue,
  am06FindConditionByOperator,
  am06MatchStyleLabel,
  am06RootGroupId,
  am06SimMethod,
  am06SimOutcome,
  am06ToolboxExpected,
  am06ToolboxJsonPath,
  am06ToolboxResolved,
  am06TraceRowByText,
  am06TraceRows,
  cleanupAm06,
  closeAm06Simulate,
  closeAm06Toolbox,
  ensureAm06JsonPathCondition,
  ensureAm06MatchStyle,
  ensureAm06RuleOpen,
  ensureAm06Schema,
  ensureAm06StudioView,
  ensureAm06SubsetBaseline,
  ensureAm06Workspace,
  hasAm06RouteEditor,
  hasAm06Workspace,
  isAm06SimulateOpen,
  isAm06StudioViewActive,
  isAm06ToolboxOpen,
  prepareAm06Workspace,
  runAm06JsonSchema,
  runAm06MatchStyle,
  runAm06PickFromJson,
  runAm06ProveSchema,
  runAm06StrictAndBack,
  runAm06SubsetBaseline,
} from './api-mock-am06-helpers';

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
  operator: string;
  /** Subset / strict / schema rows render a textarea instead of value inputs. */
  schema?: string;
  /** JSONPath rows render a `[expression, value]` pair plus the match-style button. */
  expr?: string;
  value?: string;
  matchStyle?: 'subset' | 'exact';
}

function buildCondition(spec: CondSpec): HTMLElement {
  const leaf = el('div', 'am-matcher-leaf');
  const row = el('div', 'am-matcher-row', `api-mock-condition-${spec.id}`);
  row.append(select(`api-mock-condition-source-${spec.id}`, 'body'));
  row.append(select(`api-mock-condition-operator-${spec.id}`, spec.operator));
  if (spec.expr != null) {
    row.append(input(`api-mock-condition-expr-${spec.id}`, spec.expr));
    row.append(input(`api-mock-condition-value-${spec.id}`, spec.value ?? ''));
    const radios = el('div', 'am-matchstyle-radios', `api-mock-condition-matchstyle-${spec.id}`);
    const equals = document.createElement('input');
    equals.type = 'radio';
    equals.setAttribute('data-testid', `api-mock-condition-matchstyle-equals-${spec.id}`);
    equals.checked = spec.matchStyle !== 'subset';
    makeVisible(equals);
    const contains = document.createElement('input');
    contains.type = 'radio';
    contains.setAttribute('data-testid', `api-mock-condition-matchstyle-contains-${spec.id}`);
    contains.checked = spec.matchStyle === 'subset';
    makeVisible(contains);
    radios.append(equals, contains);
    row.append(radios);
  } else {
    row.append(textarea(`api-mock-condition-schema-${spec.id}`, spec.schema ?? ''));
  }
  row.append(el('button', 'am-icon-btn', `api-mock-condition-remove-${spec.id}`));
  leaf.append(row);
  return leaf;
}

function buildGroup(id: string, conditions: CondSpec[]): HTMLElement {
  const group = el('div', 'am-matcher-group', `api-mock-group-${id}`);
  const label = el('div', 'am-group-label');
  label.append(select(`api-mock-group-combinator-${id}`, 'all'));
  const count = el('span', 'am-faint', `api-mock-group-count-${id}`);
  count.textContent = `${conditions.length} conditions`;
  label.append(count);
  label.append(el('button', 'am-btn small ghost', 'api-mock-add-condition'));
  label.append(el('button', 'am-btn small ghost', 'api-mock-add-group'));
  group.append(label);
  for (const cond of conditions) group.append(buildCondition(cond));
  return group;
}

function mountExplorer(): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-r-orders');
  row.setAttribute('role', 'treeitem');
  const method = el('span', 'am-method post');
  method.textContent = AM06_RULE_METHOD;
  const path = el('span', 'am-route-path');
  path.textContent = AM06_RULE_PATH;
  row.append(method, path);
  explorer.append(row);
  document.body.append(explorer);
}

function mountEditor(conditions: CondSpec[] = []): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  editor.append(input('api-mock-path-input', AM06_RULE_PATH));
  editor.append(el('button', 'am-icon-btn', 'api-mock-path-toolbox'));
  editor.append(el('button', 'am-btn', 'api-mock-simulate'));
  editor.append(buildGroup('grp-root', conditions));
  document.body.append(editor);
}

interface ToolboxSpec {
  sample?: string;
  jsonPath?: string;
  resolved?: string;
  expected?: string;
  schema?: string;
}

function mountToolbox(spec: ToolboxSpec = {}): void {
  const toolbox = el('div', 'am-pattern-toolbox', 'api-mock-pattern-toolbox');
  for (const id of ['path', 'regex', 'jsonpath', 'xpath', 'schema', 'constraints']) {
    toolbox.append(el('button', 'am-builder-tab', `api-mock-toolbox-tab-${id}`));
  }
  toolbox.append(el('span', 'am-badge success', 'api-mock-toolbox-json-valid'));
  toolbox.append(textarea('api-mock-toolbox-json-sample', spec.sample ?? ''));
  toolbox.append(input('api-mock-toolbox-jsonpath', spec.jsonPath ?? ''));
  toolbox.append(input('api-mock-toolbox-json-resolved', spec.resolved ?? ''));
  toolbox.append(input('api-mock-toolbox-json-expected', spec.expected ?? ''));
  toolbox.append(el('span', 'am-matcher-result pass', 'api-mock-toolbox-json-result'));

  const schemaPanel = el('div', 'am-tool-layout', 'api-mock-toolbox-schema');
  schemaPanel.append(el('button', 'am-pattern-entry', `api-mock-toolbox-schema-preset-${AM06_SCHEMA_PRESET}`));
  schemaPanel.append(el('button', 'am-builder-tab', 'api-mock-toolbox-schema-kind-json'));
  schemaPanel.append(el('button', 'am-builder-tab', 'api-mock-toolbox-schema-kind-xml'));
  schemaPanel.append(textarea('api-mock-toolbox-schema-editor', spec.schema ?? ''));
  toolbox.append(schemaPanel);

  toolbox.append(el('button', 'am-btn', 'api-mock-toolbox-cancel'));
  toolbox.append(el('button', 'am-btn primary', 'api-mock-toolbox-apply'));
  document.body.append(toolbox);
}

interface SimulateSpec {
  outcome?: string;
  method?: string;
  hasResult?: boolean;
  predicateRows?: string[];
  bodyExpand?: boolean;
  saveSample?: boolean;
}

function mountSimulate(spec: SimulateSpec = {}): void {
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(select('api-mock-simulate-method', spec.method ?? AM06_RULE_METHOD));
  workspace.append(input('api-mock-simulate-path'));
  workspace.append(textarea('api-mock-simulate-headers'));
  workspace.append(textarea('api-mock-simulate-body'));
  workspace.append(el('button', 'am-icon-btn', 'api-mock-simulate-body-expand'));
  if (spec.bodyExpand) {
    const expand = el('div', 'am-text-expand-modal', 'api-mock-text-expand-modal');
    expand.append(input('api-mock-text-expand-search'));
    expand.append(el('span', 'am-text-expand-count', 'api-mock-text-expand-count'));
    expand.append(textarea('api-mock-text-expand-editor'));
    expand.append(el('button', 'am-btn', 'api-mock-text-expand-close'));
    workspace.append(expand);
  }
  if (spec.saveSample) {
    workspace.append(el('button', 'am-btn', 'api-mock-simulate-save-sample'));
    workspace.append(input('api-mock-simulate-sample-name'));
  }
  workspace.append(el('button', 'am-btn primary', 'api-mock-simulate-run'));
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
  result.append(el('pre', 'am-code', 'api-mock-sim-rendered-body'));
  const candidate = el('div', 'am-candidate winner', 'api-mock-sim-candidate-r-orders');
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

const picks = fills;

/** Predicate ids the quiet rebuild mints, in tree order. */
const lastPatch = (): {
  predicates: {
    combinator: string;
    children: Array<{
      id: string;
      operator: string;
      expected?: string | string[];
      options?: { matchStyle?: string };
    }>;
  };
} | undefined =>
  patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as never;

const predicateOperators = (): string[] =>
  lastPatch()?.predicates.children.map(c => c.operator) ?? [];

const SUBSET_COND: CondSpec = {
  id: 'p-subset', operator: 'json_subset', schema: AM06_SUBSET_EXPECTED,
};
const JSONPATH_COND: CondSpec = {
  id: 'p-path', operator: 'jsonPath_equals', expr: AM06_JSONPATH, value: AM06_SKU,
};
const SCHEMA_COND: CondSpec = {
  id: 'p-schema', operator: 'jsonSchema', schema: AM06_SCHEMA,
};

describe('AM-06 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
  });

  // ── lesson data ───────────────────────────────────────────────────────────

  it('ships payloads that make each matcher land where the narration says', () => {
    const rich = JSON.parse(AM06_RICH_BODY) as {
      customer: { id?: string; tier: string };
      items: Array<{ sku: string }>;
      note?: string;
    };
    const invalid = JSON.parse(AM06_INVALID_BODY) as { customer: { id?: string } };
    const subset = JSON.parse(AM06_SUBSET_EXPECTED) as { customer: { tier: string } };

    // Compact one-liner so the Match row shows the whole fragment.
    expect(AM06_SUBSET_EXPECTED).toBe('{"customer":{"tier":"gold"}}');
    expect(AM06_SUBSET_EXPECTED).not.toContain('\n');
    expect(new Set([
      AM06_SAMPLE_EXTRAS, AM06_SAMPLE_STRICT, AM06_SAMPLE_INVALID, AM06_SAMPLE_COMPLETE,
    ]).size).toBe(4);

    // Subset baseline is satisfied by both payloads — only the schema separates them.
    expect(rich.customer.tier).toBe(subset.customer.tier);
    expect(invalid.customer).toMatchObject(subset.customer);
    expect(invalid.customer.id).toBeUndefined();
    expect(rich.customer.id).toBeTruthy();
    // The picked token resolves to the path the lesson claims, and only once.
    expect(rich.items[0].sku).toBe(AM06_SKU);
    expect(AM06_JSONPATH).toBe('$.items[0].sku');
    expect(AM06_RICH_BODY.split(AM06_PICK_TOKEN)).toHaveLength(2);
    expect(AM06_RICH_BODY).toContain(AM06_RICH_TIER);
    expect(AM06_RICH_BODY).toContain(AM06_RICH_NOTE);
    expect(AM06_INVALID_BODY).toContain(AM06_INVALID_CUSTOMER);
    expect(AM06_INVALID_BODY).not.toContain(AM06_COMPLETE_ID);
    expect(AM06_RICH_BODY).toContain(AM06_COMPLETE_ID);
    // Extra fields no matcher mentions are the point of step 1.
    expect(rich.note).toBeTruthy();
    expect(rich.items).toHaveLength(2);
    // The SKU family is a prefix of the exact SKU, so contains widens the match.
    expect(AM06_SKU.startsWith(AM06_SKU_FAMILY)).toBe(true);
    expect(AM06_SKU_FAMILY).not.toBe(AM06_SKU);
  });

  it('ships a JSON Schema the rich body satisfies and the short one breaks', () => {
    const schema = JSON.parse(AM06_SCHEMA) as {
      type: string;
      required: string[];
      properties: {
        customer: {
          required: string[];
          properties: { id: { type: string }; tier: { type: string; enum: string[] } };
        };
        items: { type: string; minItems: number; items: { type: string; required: string[] } };
      };
    };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['customer', 'items']);
    expect(schema.properties.customer.required).toEqual(['id', 'tier']);
    expect(Object.keys(schema.properties.customer.properties)).toEqual(
      expect.arrayContaining(schema.properties.customer.required),
    );
    expect(schema.properties.customer.properties.id.type).toBe('string');
    expect(schema.properties.customer.properties.tier.type).toBe('string');
    expect(schema.properties.customer.properties.tier.enum).toEqual(['gold', 'platinum']);
    expect(schema.properties.items.type).toBe('array');
    expect(schema.properties.items.minItems).toBe(1);
    expect(schema.properties.items.items.type).toBe('object');
    expect(schema.properties.items.items.required).toContain('sku');
    expect(matchJsonSchema(AM06_RICH_BODY, AM06_SCHEMA)).toBe(true);
    expect(matchJsonSchema(AM06_INVALID_BODY, AM06_SCHEMA)).toBe(false);
  });

  // ── row identity ──────────────────────────────────────────────────────────

  it('resolves condition rows and what each one carries', () => {
    expect(am06ConditionRows()).toEqual([]);
    expect(am06ConditionIds()).toEqual([]);
    expect(am06ConditionCount()).toBe(0);
    expect(am06ConditionOperator('p-subset')).toBe('');
    expect(am06ConditionSchema('p-subset')).toBe('');
    expect(am06ConditionExpr('p-path')).toBe('');
    expect(am06ConditionValue('p-path')).toBe('');
    expect(am06MatchStyleLabel('p-path')).toBe('');

    mountEditor([SUBSET_COND, JSONPATH_COND]);

    expect(am06ConditionIds()).toEqual(['p-subset', 'p-path']);
    expect(am06ConditionCount()).toBe(2);
    expect(am06ConditionOperator('p-subset')).toBe('json_subset');
    expect(am06ConditionSchema('p-subset')).toBe(AM06_SUBSET_EXPECTED);
    expect(am06ConditionExpr('p-path')).toBe(AM06_JSONPATH);
    expect(am06ConditionValue('p-path')).toBe(AM06_SKU);
    expect(am06MatchStyleLabel('p-path')).toBe('equals');
  });

  it('identifies a body row by its operator, since body rows have no key', () => {
    mountEditor([SUBSET_COND, JSONPATH_COND, SCHEMA_COND]);
    expect(am06FindConditionByOperator('json_subset')).toBe('p-subset');
    expect(am06FindConditionByOperator('jsonPath_equals')).toBe('p-path');
    expect(am06FindConditionByOperator('jsonSchema')).toBe('p-schema');
    expect(am06FindConditionByOperator('json_strict')).toBeNull();
  });

  it('reads the contains reading off the checked match-style radio', () => {
    mountEditor([{ ...JSONPATH_COND, matchStyle: 'subset', value: AM06_SKU_FAMILY }]);
    expect(am06MatchStyleLabel('p-path')).toBe('contains');
    expect(am06ConditionValue('p-path')).toBe(AM06_SKU_FAMILY);
  });

  it('resolves the root group, and nothing when the add button sits outside one', () => {
    expect(am06RootGroupId()).toBeNull();
    mountEditor([SUBSET_COND]);
    expect(am06RootGroupId()).toBe('grp-root');

    document.body.innerHTML = '';
    document.body.append(el('button', 'am-btn', 'api-mock-add-condition'));
    expect(am06RootGroupId()).toBeNull();
  });

  // ── state probes ──────────────────────────────────────────────────────────

  it('reads the studio, editor and overlay state', () => {
    expect(isAm06StudioViewActive()).toBe(false);
    expect(hasAm06Workspace()).toBe(false);
    expect(hasAm06RouteEditor()).toBe(false);
    expect(isAm06ToolboxOpen()).toBe(false);
    expect(isAm06SimulateOpen()).toBe(false);
    expect(am06SimOutcome()).toBe('');
    expect(am06SimMethod()).toBe('');

    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountToolbox();
    mountSimulate({ outcome: 'UNMATCHED', method: 'GET' });

    expect(isAm06StudioViewActive()).toBe(true);
    expect(hasAm06Workspace()).toBe(true);
    expect(hasAm06RouteEditor()).toBe(true);
    expect(isAm06ToolboxOpen()).toBe(true);
    expect(isAm06SimulateOpen()).toBe(true);
    expect(am06SimOutcome()).toBe('UNMATCHED');
    expect(am06SimMethod()).toBe('GET');
  });

  it('treats the empty state as the Studio view', () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    expect(isAm06StudioViewActive()).toBe(true);
  });

  it('reads the toolbox JSONPath, resolved value and expected value', () => {
    expect(am06ToolboxJsonPath()).toBe('');
    expect(am06ToolboxResolved()).toBe('');
    expect(am06ToolboxExpected()).toBe('');

    mountToolbox({ jsonPath: AM06_JSONPATH, resolved: AM06_SKU, expected: AM06_SKU });

    expect(am06ToolboxJsonPath()).toBe(AM06_JSONPATH);
    expect(am06ToolboxResolved()).toBe(AM06_SKU);
    expect(am06ToolboxExpected()).toBe(AM06_SKU);
  });

  it('reads trace rows and finds one by the text it renders', () => {
    expect(am06TraceRows()).toEqual([]);
    expect(am06TraceRowByText('jsonSchema')).toBeNull();

    mountSimulate({
      predicateRows: ['✓ Method match', '✓ body json_subset', 'body jsonSchema failed — got "{…}"'],
    });

    expect(am06TraceRows()).toHaveLength(3);
    expect(am06TraceRowByText('jsonSchema')?.textContent).toContain('failed');
    expect(am06TraceRowByText('xmlSchema')).toBeNull();
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────

  it('boots on the subset-baseline corpus and cleans up by wiping', async () => {
    await prepareAm06Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM06_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    wipeApiMockWorkspace.mockClear();
    await cleanupAm06();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── overlay hygiene ───────────────────────────────────────────────────────

  it('closes the toolbox and Simulate only when they are open', async () => {
    const quiet = makeCtx();
    await closeAm06Toolbox(quiet);
    await closeAm06Simulate(quiet);
    expect(quiet.click).not.toHaveBeenCalled();

    mountToolbox();
    mountSimulate();
    const ctx = makeCtx();
    await closeAm06Toolbox(ctx);
    await closeAm06Simulate(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.TOOLBOX_CANCEL, API_MOCK.SIMULATE_CLOSE]);
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it('switches back to Studio only when another view is mounted', async () => {
    const missing = makeCtx();
    await ensureAm06StudioView(missing);
    expect(missing.click).not.toHaveBeenCalled();

    document.body.append(el('button', 'am-nav-btn', 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm06StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);

    mountExplorer();
    const already = makeCtx();
    await ensureAm06StudioView(already);
    expect(already.click).not.toHaveBeenCalled();
  });

  it('imports the corpus when the workspace is empty and skips when it is not', async () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    await ensureAm06Workspace(makeCtx());
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM06_CORPUS_SAMPLE);

    importApiMockGallerySample.mockClear();
    document.body.innerHTML = '';
    mountExplorer();
    await ensureAm06Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('opens the rule and switches to the Match tab when conditions are not visible', async () => {
    mountExplorer();
    const ctx = makeCtx();
    await ensureAm06RuleOpen(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.ROUTE_ROW, API_MOCK.BTAB_MATCH]);
  });

  it('leaves an already-open Match tab alone', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    const ctx = makeCtx();
    await ensureAm06RuleOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('rebuilds the body-matcher tree each step starts from', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);

    await ensureAm06SubsetBaseline(makeCtx());
    expect(predicateOperators()).toEqual(['json_subset']);

    await ensureAm06JsonPathCondition(makeCtx());
    expect(predicateOperators()).toEqual(['json_subset', 'jsonPath_equals']);

    await ensureAm06MatchStyle(makeCtx());
    expect(predicateOperators()).toEqual(['json_subset', 'jsonPath_equals']);

    await ensureAm06Schema(makeCtx());
    expect(predicateOperators()).toEqual(['json_subset', 'jsonPath_equals', 'jsonSchema']);
  });

  it('rebuilds the JSONPath row as a pair, and the widened one as a contains match', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);

    await ensureAm06JsonPathCondition(makeCtx());
    const exact = lastPatch()!.predicates.children[1];
    expect(exact.expected).toEqual([AM06_JSONPATH, AM06_SKU]);
    expect(exact.options?.matchStyle).toBeUndefined();

    await ensureAm06MatchStyle(makeCtx());
    const widened = lastPatch()!.predicates.children[1];
    expect(widened.expected).toEqual([AM06_JSONPATH, AM06_SKU_FAMILY]);
    expect(widened.options?.matchStyle).toBe('subset');
  });

  it('rebuilds every matcher on the body source with no key', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    await ensureAm06Schema(makeCtx());

    const patch = patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as unknown as {
      predicates: { combinator: string; children: Array<{ source: string; selector: string }> };
    };
    expect(patch.predicates.combinator).toBe('all');
    for (const child of patch.predicates.children) {
      expect(child).toMatchObject({ source: 'body', selector: '' });
    }
  });

  it('stops quietly when the patch bridge is unavailable', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mountExplorer();
    mountEditor([SUBSET_COND]);

    const ctx = makeCtx();
    await ensureAm06SubsetBaseline(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  // ── step bodies ───────────────────────────────────────────────────────────

  it('holds AM-06 spotlights longer than the shared pack, with extra aim time before tabs and modals', () => {
    expect(AM06_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM06_TIMING.payoff).toBeGreaterThan(AM_DEMO_TIMING.payoff);
    expect(AM06_TIMING.groupBreak).toBeGreaterThan(AM_DEMO_TIMING.groupBreak);
    expect(AM06_TIMING.traceRow).toBeGreaterThan(AM06_TIMING.look);
    expect(AM06_TIMING.simOutcome).toBeGreaterThan(AM06_TIMING.payoff);
    expect(AM06_TIMING.beforeOpen).toBeGreaterThan(AM06_TIMING.look);
    expect(AM06_TIMING.beforeRun).toBeGreaterThan(AM06_TIMING.beforeOpen);
  });

  it('step 1 reads the baseline, then proves a payload with extras still matches', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountSimulate({ bodyExpand: true, predicateRows: ['✓ body json_subset'] });

    const ctx = makeCtx();
    const outcome = await runAm06SubsetBaseline(ctx);

    expect(outcome).toBe('MATCHED');
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM06_RULE_PATH],
      [API_MOCK.SIMULATE_BODY, AM06_RICH_BODY],
      [API_MOCK.TEXT_EXPAND_SEARCH, AM06_RICH_TIER],
    ]);
    // Simulate opens seeded from the POST rule, so no method pick is needed.
    expect(ctx.selectOption).not.toHaveBeenCalled();
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_BODY_EXPAND);
    expect(calls(ctx.click)).toContain(API_MOCK.TEXT_EXPAND_CLOSE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 1 picks the method when Simulate opened on another verb', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountSimulate({ method: 'GET' });

    const ctx = makeCtx();
    await runAm06SubsetBaseline(ctx);

    expect(picks(ctx.selectOption)).toEqual([[API_MOCK.SIMULATE_METHOD, AM06_RULE_METHOD]]);
  });

  it('step 1 opens Simulate when the workspace is not up yet', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) mountSimulate();
    });
    await runAm06SubsetBaseline(ctx);

    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    // No results pane on the first run, so no detour through Request.
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
  });

  it('step 2 switches to strict, proves the failure, then restores subset', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountSimulate({
      hasResult: true,
      bodyExpand: true,
      outcome: 'UNMATCHED',
      predicateRows: ['body json_strict failed — got "{…}"'],
    });

    const ctx = makeCtx();
    const outcome = await runAm06StrictAndBack(ctx);

    expect(outcome).toBe('UNMATCHED');
    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.conditionOperator('p-subset'), 'json_strict'],
      [API_MOCK.conditionOperator('p-subset'), 'json_subset'],
    ]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.SIMULATE_BODY, AM06_RICH_BODY]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TEXT_EXPAND_SEARCH, AM06_RICH_NOTE]);
    expect(fills(ctx.fill)).not.toContainEqual([API_MOCK.TEXT_EXPAND_SEARCH, AM06_RICH_TIER]);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_BODY_EXPAND);
    expect(calls(ctx.click)).toContain(API_MOCK.TEXT_EXPAND_CLOSE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_VIEW_REQUEST);
  });

  it('step 2 bails when no subset row is on screen', async () => {
    mountExplorer();
    mountEditor([JSONPATH_COND]);

    const ctx = makeCtx();
    expect(await runAm06StrictAndBack(ctx)).toBe('');
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 3 derives the JSONPath from a selection instead of typing it', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountToolbox({ sample: AM06_RICH_BODY, jsonPath: AM06_JSONPATH, expected: AM06_SKU });

    const ctx = makeCtx();
    const selected: Array<[number, number]> = [];
    const editor = document.querySelector<HTMLTextAreaElement>(API_MOCK.TOOLBOX_JSON_SAMPLE)!;
    editor.addEventListener('select', () => {
      selected.push([editor.selectionStart, editor.selectionEnd]);
    });

    await runAm06PickFromJson(ctx);

    // The token was highlighted, so the product derives the path from the caret.
    const at = AM06_RICH_BODY.indexOf(AM06_PICK_TOKEN);
    expect(selected).toEqual([[at, at + AM06_PICK_TOKEN.length]]);
    // The pick already wrote Expected — do not clear it to demo exists.
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.TOOLBOX_JSON_SAMPLE, AM06_RICH_BODY],
    ]);
    // The toolbox was already open, so the wand is not clicked a second time.
    expect(calls(ctx.click)).toEqual([API_MOCK.TOOLBOX_TAB_JSONPATH, API_MOCK.TOOLBOX_APPLY]);
  });

  it('step 3 falls back to typing the path when the selection did not land', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountToolbox({ sample: '{ "unrelated": true }' });

    const ctx = makeCtx();
    await runAm06PickFromJson(ctx);

    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_JSONPATH, AM06_JSONPATH]);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_JSON_EXPECTED, AM06_SKU]);
  });

  it('step 3 opens the toolbox from the wand beside the path when it is closed', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector(API_MOCK.PATTERN_TOOLBOX)) {
        mountToolbox({ sample: AM06_RICH_BODY, jsonPath: AM06_JSONPATH });
      }
    });
    await runAm06PickFromJson(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.PATH_TOOLBOX,
      API_MOCK.TOOLBOX_TAB_JSONPATH,
      API_MOCK.TOOLBOX_APPLY,
    ]);
  });

  it('step 4 flips the match style and widens the value to the SKU family', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND, JSONPATH_COND]);

    const ctx = makeCtx();
    await runAm06MatchStyle(ctx);

    expect(calls(ctx.click)).toEqual([API_MOCK.conditionMatchStyleContains('p-path')]);
    expect(fills(ctx.fill)).toEqual([[API_MOCK.conditionValue('p-path'), AM06_SKU_FAMILY]]);
  });

  it('step 4 leaves an already-widened row on contains', async () => {
    mountExplorer();
    mountEditor([{ ...JSONPATH_COND, matchStyle: 'subset' }]);

    const ctx = makeCtx();
    await runAm06MatchStyle(ctx);

    expect(ctx.click).not.toHaveBeenCalled();
    expect(fills(ctx.fill)).toEqual([[API_MOCK.conditionValue('p-path'), AM06_SKU_FAMILY]]);
  });

  it('step 4 bails when there is no JSONPath row', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);

    const ctx = makeCtx();
    await runAm06MatchStyle(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 5 lands a preset, replaces it with the contract, and applies', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND, JSONPATH_COND, SCHEMA_COND]);
    mountToolbox();

    const ctx = makeCtx();
    await runAm06JsonSchema(ctx);

    expect(calls(ctx.click)).toEqual([
      API_MOCK.TOOLBOX_TAB_SCHEMA,
      API_MOCK.toolboxSchemaPreset(AM06_SCHEMA_PRESET),
      API_MOCK.TOOLBOX_APPLY,
    ]);
    expect(fills(ctx.fill)).toEqual([[API_MOCK.TOOLBOX_SCHEMA_EDITOR, AM06_SCHEMA]]);
  });

  it('step 5 still finishes when the applied schema row cannot be resolved', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND]);
    mountToolbox();

    const ctx = makeCtx();
    await runAm06JsonSchema(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 6 rejects the short payload, then renders the complete one', async () => {
    mountExplorer();
    mountEditor([SUBSET_COND, JSONPATH_COND, SCHEMA_COND]);
    mountSimulate({
      hasResult: true,
      bodyExpand: true,
      saveSample: true,
      predicateRows: [
        '✓ Method match',
        '✓ body json_subset',
        '✓ body jsonPath_equals',
        'body jsonSchema failed — got "{…}"',
      ],
    });

    const ctx = makeCtx();
    const outcomes = await runAm06ProveSchema(ctx);

    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM06_RULE_PATH],
      [API_MOCK.SIMULATE_BODY, AM06_INVALID_BODY],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM06_SAMPLE_INVALID],
      [API_MOCK.TEXT_EXPAND_SEARCH, AM06_INVALID_CUSTOMER],
      [API_MOCK.SIMULATE_PATH, AM06_RULE_PATH],
      [API_MOCK.SIMULATE_BODY, AM06_RICH_BODY],
      [API_MOCK.SIMULATE_SAMPLE_NAME, AM06_SAMPLE_COMPLETE],
      [API_MOCK.TEXT_EXPAND_SEARCH, AM06_COMPLETE_ID],
    ]);
    expect(calls(ctx.click).filter(s => s === API_MOCK.SIMULATE_SAVE_SAMPLE)).toHaveLength(2);
    expect(calls(ctx.click).filter(s => s === API_MOCK.SIMULATE_BODY_EXPAND)).toHaveLength(2);
    expect(calls(ctx.click).filter(s => s === API_MOCK.TEXT_EXPAND_CLOSE)).toHaveLength(2);
    expect(calls(ctx.click).filter(s => s === API_MOCK.SIMULATE_RUN)).toHaveLength(2);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
    const delayMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, [ms]) => sum + Number(ms ?? 0), 0);
    expect(delayMs).toBeLessThan(38_000);
  });
});
