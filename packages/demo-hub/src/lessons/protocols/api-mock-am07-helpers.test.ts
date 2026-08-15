/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { API_MOCK } from '@shared/selectors';
import { AM_DEMO_TIMING } from './api-mock-demo-helpers';
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
  AM07_TIMING,
  AM07_BINARY_BODY,
  AM07_BINARY_BODY_ALTERED,
  AM07_BINARY_CONTENT_TYPE,
  AM07_BINARY_RULE,
  AM07_BINARY_SHA256,
  AM07_CORPUS_SAMPLE,
  AM07_FORM_BODY,
  AM07_FORM_BODY_VARIANT,
  AM07_FORM_CONTENT_TYPE,
  AM07_FORM_FIELD,
  AM07_FORM_PATTERN,
  AM07_FORM_RULE,
  AM07_FORM_VALUE,
  AM07_MULTIPART_BODY,
  AM07_MULTIPART_BOUNDARY,
  AM07_MULTIPART_CONTENT_TYPE,
  AM07_MULTIPART_FIELD,
  AM07_MULTIPART_FIELD_VALUE,
  AM07_MULTIPART_FILENAME,
  AM07_MULTIPART_FILE_PART,
  AM07_ORDER_ID,
  AM07_SCHEMA_PRESET,
  AM07_UPLOAD_RULE,
  AM07_XML_BODY,
  AM07_XML_BODY_INVALID,
  AM07_XML_CONTENT_TYPE,
  AM07_XML_ELEMENTS,
  AM07_XML_RULE,
  AM07_XPATH,
  AM07_XPATH_PRESET,
  am07ConditionCount,
  am07ConditionExpr,
  am07ConditionIds,
  am07ConditionOperator,
  am07ConditionRows,
  am07ConditionValue,
  am07FindConditionByOperator,
  am07OpenRulePath,
  am07RootGroupId,
  am07RuleRow,
  am07RuleRows,
  am07RuleSelector,
  am07SimMethod,
  am07SimOutcome,
  am07ToolboxSchemaText,
  am07ToolboxXPath,
  am07ToolboxXPathResolved,
  am07TraceRowByText,
  am07TraceRows,
  cleanupAm07,
  closeAm07Simulate,
  closeAm07TextExpand,
  closeAm07Toolbox,
  ensureAm07Corpus,
  ensureAm07FormExact,
  ensureAm07MultipartConditions,
  ensureAm07StudioView,
  ensureAm07Workspace,
  ensureAm07XPathCondition,
  ensureAm07XmlBare,
  hasAm07RouteEditor,
  hasAm07Workspace,
  isAm07RuleOpen,
  isAm07SimulateOpen,
  isAm07StudioViewActive,
  isAm07TextExpandOpen,
  isAm07ToolboxOpen,
  reviewAm07MultipartBody,
  openAm07Rule,
  prepareAm07Workspace,
  runAm07Binary,
  runAm07FormMatching,
  runAm07MultipartFields,
  runAm07ProveForm,
  runAm07ProveMultipart,
  runAm07XPath,
  runAm07XmlSchema,
  type Am07RuleRef,
} from './api-mock-am07-helpers';

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
  /** Pair matchers (form / multipart / XPath) render an expression box first. */
  expr?: string;
  value?: string;
}

function buildCondition(spec: CondSpec): HTMLElement {
  const leaf = el('div', 'am-matcher-leaf');
  const row = el('div', 'am-matcher-row', `api-mock-condition-${spec.id}`);
  row.append(select(`api-mock-condition-source-${spec.id}`, 'body'));
  const key = input(`api-mock-condition-selector-${spec.id}`, '');
  key.disabled = true;
  key.placeholder = '(whole body)';
  row.append(key);
  row.append(select(`api-mock-condition-operator-${spec.id}`, spec.operator));
  if (spec.expr != null) row.append(input(`api-mock-condition-expr-${spec.id}`, spec.expr));
  row.append(input(`api-mock-condition-value-${spec.id}`, spec.value ?? ''));
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
  if (conditions.length === 0) {
    group.append(el('div', 'am-faint', 'api-mock-conditions-empty'));
  }
  for (const cond of conditions) group.append(buildCondition(cond));
  return group;
}

const CORPUS: Array<{ testid: string; ref: Am07RuleRef }> = [
  { testid: 'r-form', ref: AM07_FORM_RULE },
  { testid: 'r-upload', ref: AM07_UPLOAD_RULE },
  { testid: 'r-xml', ref: AM07_XML_RULE },
  { testid: 'r-binary', ref: AM07_BINARY_RULE },
];

function mountExplorer(): void {
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  for (const rule of CORPUS) {
    const row = el('button', 'am-route-item', `api-mock-route-${rule.testid}`);
    row.setAttribute('role', 'treeitem');
    const method = el('span', `am-method ${rule.ref.method.toLowerCase()}`);
    method.textContent = rule.ref.method;
    const path = el('span', 'am-route-path');
    path.textContent = rule.ref.path;
    row.append(method, path);
    explorer.append(row);
  }
  document.body.append(explorer);
}

function mountEditor(ref: Am07RuleRef, conditions: CondSpec[] = []): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  editor.append(input('api-mock-path-input', ref.path));
  editor.append(el('button', 'am-icon-btn', 'api-mock-path-toolbox'));
  editor.append(el('button', 'am-btn', 'api-mock-simulate'));
  editor.append(buildGroup('grp-root', conditions));
  document.body.append(editor);
}

interface ToolboxSpec {
  sample?: string;
  xpath?: string;
  resolved?: string;
  xpathValue?: string;
  schema?: string;
}

function mountToolbox(spec: ToolboxSpec = {}): void {
  const toolbox = el('div', 'am-pattern-toolbox', 'api-mock-pattern-toolbox');
  for (const id of ['path', 'regex', 'jsonpath', 'xpath', 'schema', 'constraints']) {
    toolbox.append(el('button', 'am-builder-tab', `api-mock-toolbox-tab-${id}`));
  }

  const xpathPanel = el('div', 'am-tool-layout', 'api-mock-toolbox-xpath');
  xpathPanel.append(el('button', 'am-pattern-entry', `api-mock-toolbox-xpath-preset-${AM07_XPATH_PRESET}`));
  xpathPanel.append(textarea('api-mock-toolbox-xpath-sample', spec.sample ?? ''));
  xpathPanel.append(input('api-mock-toolbox-xpath-expr', spec.xpath ?? ''));
  xpathPanel.append(input('api-mock-toolbox-xpath-resolved', spec.resolved ?? ''));
  xpathPanel.append(input('api-mock-toolbox-xpath-value', spec.xpathValue ?? ''));
  xpathPanel.append(el('span', 'am-matcher-result pass', 'api-mock-toolbox-xpath-result'));
  toolbox.append(xpathPanel);

  const schemaPanel = el('div', 'am-tool-layout', 'api-mock-toolbox-schema');
  schemaPanel.append(el('button', 'am-pattern-entry', `api-mock-toolbox-schema-preset-${AM07_SCHEMA_PRESET}`));
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
}

function mountSimulate(spec: SimulateSpec = {}): void {
  const workspace = el('div', 'am-sim-workspace', 'api-mock-simulate-workspace');
  workspace.append(select('api-mock-simulate-method', spec.method ?? 'POST'));
  workspace.append(input('api-mock-simulate-path'));
  workspace.append(textarea('api-mock-simulate-headers'));
  workspace.append(textarea('api-mock-simulate-body'));
  workspace.append(el('button', 'am-icon-btn', 'api-mock-simulate-body-expand'));
  if (spec.bodyExpand) {
    const expand = el('div', 'am-text-expand-modal', 'api-mock-text-expand-modal');
    expand.append(input('api-mock-text-expand-search'));
    expand.append(el('span', 'am-text-expand-count', 'api-mock-text-expand-count'));
    expand.append(el('button', 'am-icon-btn', 'api-mock-text-expand-next'));
    expand.append(textarea('api-mock-text-expand-editor'));
    expand.append(el('button', 'am-btn', 'api-mock-text-expand-close'));
    workspace.append(expand);
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
  result.append(el('pre', 'am-code', 'api-mock-sim-normalized'));
  result.append(el('pre', 'am-code', 'api-mock-sim-rendered-body'));
  const candidate = el('div', 'am-candidate winner', 'api-mock-sim-candidate-r-form');
  for (const text of spec.predicateRows ?? []) {
    const row = el('div', 'am-predicate');
    row.textContent = text;
    candidate.append(row);
  }
  result.append(candidate);
  workspace.append(result);
  document.body.append(workspace);
}

/**
 * A context whose clicks move the DOM the way React would: selecting a rule repaints the
 * editor path, and `+ Condition` appends an empty row. Without that, every authoring beat
 * would be a no-op and the step bodies could not be exercised at all.
 */
function reactiveCtx(): DemoActionContext {
  const ctx = makeCtx();
  let added = 0;
  vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
    const rule = CORPUS.find(r => selector === `[data-testid="api-mock-route-${r.testid}"]`);
    if (rule) {
      const path = document.querySelector<HTMLInputElement>(API_MOCK.PATH_INPUT);
      if (path) path.value = rule.ref.path;
      return;
    }
    if (selector === API_MOCK.ADD_CONDITION) {
      added += 1;
      const group = document.querySelector('.am-matcher-group');
      group?.append(buildCondition({ id: `new-${added}`, operator: '', expr: '', value: '' }));
    }
  });
  vi.mocked(ctx.fill).mockImplementation(async (selector: string, value: string) => {
    const field = document.querySelector<HTMLInputElement>(selector);
    if (field) field.value = value;
  });
  return ctx;
}

const calls = (fn: unknown): string[] =>
  vi.mocked(fn as (s: string) => Promise<void>).mock.calls.map(c => c[0]);

const fills = (fn: unknown): Array<[string, string]> =>
  vi.mocked(fn as (s: string, v: string) => Promise<void>).mock.calls.map(c => [c[0], c[1]]);

const picks = fills;

const lastPatch = (): {
  predicates: {
    combinator: string;
    children: Array<{
      id: string;
      source: string;
      selector: string;
      operator: string;
      expected?: string | string[];
    }>;
  };
} | undefined => patchApiMockActiveRoute.mock.calls.at(-1)?.[0] as never;

const predicateOperators = (): string[] =>
  lastPatch()?.predicates.children.map(c => c.operator) ?? [];

const FORM_COND: CondSpec = {
  id: 'p-form', operator: 'form_field_exact', expr: AM07_FORM_FIELD, value: AM07_FORM_VALUE,
};
const MP_FIELD_COND: CondSpec = {
  id: 'p-mp-field',
  operator: 'multipart_field',
  expr: AM07_MULTIPART_FIELD,
  value: AM07_MULTIPART_FIELD_VALUE,
};
const MP_FILE_COND: CondSpec = {
  id: 'p-mp-file',
  operator: 'multipart_file',
  expr: AM07_MULTIPART_FILE_PART,
  value: AM07_MULTIPART_FILENAME,
};
const XPATH_COND: CondSpec = {
  id: 'p-xpath', operator: 'xpath_equals', expr: AM07_XPATH, value: AM07_ORDER_ID,
};
const SHA_COND: CondSpec = {
  id: 'p-sha', operator: 'binary_sha256', value: AM07_BINARY_SHA256,
};

describe('AM-07 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    patchApiMockActiveRoute.mockReturnValue(true);
  });

  // ── lesson data ───────────────────────────────────────────────────────────

  it('ships a form body the exact matcher accepts and a variant only the pattern accepts', () => {
    const params = new URLSearchParams(AM07_FORM_BODY);
    const variant = new URLSearchParams(AM07_FORM_BODY_VARIANT);
    expect(params.get(AM07_FORM_FIELD)).toBe(AM07_FORM_VALUE);
    expect(variant.get(AM07_FORM_FIELD)).not.toBe(AM07_FORM_VALUE);
    // The widened pattern has to accept both, or step 2's second run proves nothing.
    const pattern = new RegExp(AM07_FORM_PATTERN);
    expect(pattern.test(params.get(AM07_FORM_FIELD)!)).toBe(true);
    expect(pattern.test(variant.get(AM07_FORM_FIELD)!)).toBe(true);
    expect(AM07_FORM_CONTENT_TYPE).toContain('x-www-form-urlencoded');
  });

  it('ships a multipart body whose boundary, text part and file part all line up', () => {
    expect(AM07_MULTIPART_CONTENT_TYPE).toContain(`boundary=${AM07_MULTIPART_BOUNDARY}`);
    // Two parts plus the closing delimiter.
    expect(AM07_MULTIPART_BODY.split(`--${AM07_MULTIPART_BOUNDARY}`)).toHaveLength(4);
    expect(AM07_MULTIPART_BODY).toContain(`name="${AM07_MULTIPART_FIELD}"`);
    expect(AM07_MULTIPART_BODY).toContain(AM07_MULTIPART_FIELD_VALUE);
    expect(AM07_MULTIPART_BODY).toContain(
      `name="${AM07_MULTIPART_FILE_PART}"; filename="${AM07_MULTIPART_FILENAME}"`,
    );
    expect(AM07_MULTIPART_BODY.endsWith(`--${AM07_MULTIPART_BOUNDARY}--`)).toBe(true);
  });

  it('ships a namespaced envelope and a truncated one only the element list rejects', () => {
    expect(AM07_XML_BODY).toContain('xmlns:soap=');
    // The XPath must be namespace-safe, which is the whole point of the preset.
    expect(AM07_XPATH).toContain('local-name()');
    expect(AM07_XML_BODY).toContain(`<orderId>${AM07_ORDER_ID}</orderId>`);
    // The invalid envelope keeps the order id, so only the schema row can fail.
    expect(AM07_XML_BODY_INVALID).toContain(`<orderId>${AM07_ORDER_ID}</orderId>`);
    expect(AM07_XML_BODY_INVALID).not.toContain('<customer>');
    const elements = AM07_XML_ELEMENTS.split(',').map(s => s.trim());
    expect(elements).toContain('customer');
    for (const name of elements) {
      // Matched by local name, so a prefixed element counts.
      expect(AM07_XML_BODY).toMatch(new RegExp(`<([A-Za-z]+:)?${name}[\\s>]`));
    }
    expect(AM07_XML_CONTENT_TYPE).toContain('application/xml');
  });

  it('ships the real digest of the firmware payload, and an altered payload that breaks it', () => {
    expect(AM07_BINARY_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(createHash('sha256').update(AM07_BINARY_BODY).digest('hex')).toBe(AM07_BINARY_SHA256);
    expect(createHash('sha256').update(AM07_BINARY_BODY_ALTERED).digest('hex'))
      .not.toBe(AM07_BINARY_SHA256);
    expect(AM07_BINARY_CONTENT_TYPE).toContain('octet-stream');
  });

  // ── rule identity ─────────────────────────────────────────────────────────

  it('finds a corpus rule row by method and path, since import re-mints ids', () => {
    expect(am07RuleRows()).toEqual([]);
    expect(am07RuleRow(AM07_FORM_RULE)).toBeNull();
    expect(am07RuleSelector(AM07_FORM_RULE)).toBeNull();

    mountExplorer();

    expect(am07RuleRows()).toHaveLength(4);
    expect(am07RuleRow(AM07_XML_RULE)?.getAttribute('data-testid')).toBe('api-mock-route-r-xml');
    expect(am07RuleSelector(AM07_BINARY_RULE)).toBe('[data-testid="api-mock-route-r-binary"]');
    // Same path, different verb must not collide.
    expect(am07RuleRow({ method: 'GET', path: AM07_BINARY_RULE.path })).toBeNull();
  });

  it('ignores a rule row that is missing its method or path chip', () => {
    const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
    const bare = el('button', 'am-route-item', 'api-mock-route-r-bare');
    bare.setAttribute('role', 'treeitem');
    explorer.append(bare);
    document.body.append(explorer);

    expect(am07RuleRows()).toHaveLength(1);
    expect(am07RuleRow(AM07_FORM_RULE)).toBeNull();
  });

  it('reads which rule the editor has open off the path field', () => {
    expect(am07OpenRulePath()).toBe('');
    expect(isAm07RuleOpen(AM07_FORM_RULE)).toBe(false);

    mountEditor(AM07_UPLOAD_RULE);

    expect(am07OpenRulePath()).toBe(AM07_UPLOAD_RULE.path);
    expect(isAm07RuleOpen(AM07_UPLOAD_RULE)).toBe(true);
    expect(isAm07RuleOpen(AM07_FORM_RULE)).toBe(false);
  });

  // ── condition identity ────────────────────────────────────────────────────

  it('resolves condition rows and the boxes each matcher renders', () => {
    expect(am07ConditionRows()).toEqual([]);
    expect(am07ConditionIds()).toEqual([]);
    expect(am07ConditionCount()).toBe(0);
    expect(am07ConditionOperator('p-form')).toBe('');
    expect(am07ConditionExpr('p-form')).toBe('');
    expect(am07ConditionValue('p-form')).toBe('');

    mountEditor(AM07_FORM_RULE, [FORM_COND, SHA_COND]);

    expect(am07ConditionIds()).toEqual(['p-form', 'p-sha']);
    expect(am07ConditionCount()).toBe(2);
    expect(am07ConditionOperator('p-form')).toBe('form_field_exact');
    expect(am07ConditionExpr('p-form')).toBe(AM07_FORM_FIELD);
    expect(am07ConditionValue('p-form')).toBe(AM07_FORM_VALUE);
    // A digest row has no expression box — the whole payload is the input.
    expect(am07ConditionExpr('p-sha')).toBe('');
    expect(am07ConditionValue('p-sha')).toBe(AM07_BINARY_SHA256);
  });

  it('identifies a body row by its operator, since body rows have no key', () => {
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND, MP_FILE_COND]);
    expect(am07FindConditionByOperator('multipart_field')).toBe('p-mp-field');
    expect(am07FindConditionByOperator('multipart_file')).toBe('p-mp-file');
    expect(am07FindConditionByOperator('xmlSchema')).toBeNull();
  });

  it('resolves the root group, and nothing when the add button sits outside one', () => {
    expect(am07RootGroupId()).toBeNull();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    expect(am07RootGroupId()).toBe('grp-root');

    document.body.innerHTML = '';
    document.body.append(el('button', 'am-btn', 'api-mock-add-condition'));
    expect(am07RootGroupId()).toBeNull();
  });

  // ── state probes ──────────────────────────────────────────────────────────

  it('reads the studio, editor and overlay state', () => {
    expect(isAm07StudioViewActive()).toBe(false);
    expect(hasAm07Workspace()).toBe(false);
    expect(hasAm07RouteEditor()).toBe(false);
    expect(isAm07ToolboxOpen()).toBe(false);
    expect(isAm07SimulateOpen()).toBe(false);
    expect(isAm07TextExpandOpen()).toBe(false);
    expect(am07SimOutcome()).toBe('');
    expect(am07SimMethod()).toBe('');

    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    mountToolbox();
    mountSimulate({ outcome: 'UNMATCHED', method: 'PUT' });

    expect(isAm07StudioViewActive()).toBe(true);
    expect(hasAm07Workspace()).toBe(true);
    expect(hasAm07RouteEditor()).toBe(true);
    expect(isAm07ToolboxOpen()).toBe(true);
    expect(isAm07SimulateOpen()).toBe(true);
    expect(am07SimOutcome()).toBe('UNMATCHED');
    expect(am07SimMethod()).toBe('PUT');
  });

  it('treats the empty state as the Studio view', () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    expect(isAm07StudioViewActive()).toBe(true);
  });

  it('reads the XPath expression, its resolved value and the schema editor', () => {
    expect(am07ToolboxXPath()).toBe('');
    expect(am07ToolboxXPathResolved()).toBe('');
    expect(am07ToolboxSchemaText()).toBe('');

    mountToolbox({ xpath: AM07_XPATH, resolved: AM07_ORDER_ID, schema: AM07_XML_ELEMENTS });

    expect(am07ToolboxXPath()).toBe(AM07_XPATH);
    expect(am07ToolboxXPathResolved()).toBe(AM07_ORDER_ID);
    expect(am07ToolboxSchemaText()).toBe(AM07_XML_ELEMENTS);
  });

  it('reads trace rows and finds one by the text it renders', () => {
    expect(am07TraceRows()).toEqual([]);
    expect(am07TraceRowByText('xmlSchema')).toBeNull();

    mountSimulate({
      predicateRows: ['✓ Method match', '✓ body xpath_equals', 'body xmlSchema failed — got "<…>"'],
    });

    expect(am07TraceRows()).toHaveLength(3);
    expect(am07TraceRowByText('xmlSchema')?.textContent).toContain('failed');
    expect(am07TraceRowByText('binary_sha256')).toBeNull();
  });

  // ── boot / cleanup ────────────────────────────────────────────────────────

  it('boots on the non-JSON corpus and cleans up by wiping', async () => {
    await prepareAm07Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM07_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();

    wipeApiMockWorkspace.mockClear();
    await cleanupAm07();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  // ── overlay hygiene ───────────────────────────────────────────────────────

  it('closes the toolbox and Simulate only when they are open', async () => {
    const quiet = makeCtx();
    await closeAm07Toolbox(quiet);
    await closeAm07Simulate(quiet);
    expect(quiet.click).not.toHaveBeenCalled();

    mountToolbox();
    mountSimulate();
    const ctx = makeCtx();
    await closeAm07Toolbox(ctx);
    await closeAm07Simulate(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.TOOLBOX_CANCEL, API_MOCK.SIMULATE_CLOSE]);
  });

  it('reviewAm07MultipartBody no-ops without the expand control', async () => {
    const ctx = makeCtx();
    await reviewAm07MultipartBody(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm07TextExpand is quiet when the popup is already closed', async () => {
    const ctx = makeCtx();
    await closeAm07TextExpand(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it('switches back to Studio only when another view is mounted', async () => {
    const missing = makeCtx();
    await ensureAm07StudioView(missing);
    expect(missing.click).not.toHaveBeenCalled();

    document.body.append(el('button', 'am-nav-btn', 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm07StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);

    mountExplorer();
    const already = makeCtx();
    await ensureAm07StudioView(already);
    expect(already.click).not.toHaveBeenCalled();
  });

  it('imports the corpus when the workspace is empty and skips when it is not', async () => {
    document.body.append(el('div', 'am-empty', 'api-mock-empty'));
    await ensureAm07Workspace(makeCtx());
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM07_CORPUS_SAMPLE);

    importApiMockGallerySample.mockClear();
    document.body.innerHTML = '';
    mountExplorer();
    await ensureAm07Workspace(makeCtx());
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('leaves the selection alone for the steps that show the switch themselves', async () => {
    mountExplorer();
    const bare = makeCtx();
    await ensureAm07Corpus(bare);
    expect(bare.click).not.toHaveBeenCalled();

    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    const open = makeCtx();
    await ensureAm07Corpus(open);
    expect(open.click).not.toHaveBeenCalled();
  });

  it('shows the Match tab when the editor is parked on another body tab', async () => {
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    editor.append(input('api-mock-path-input', AM07_FORM_RULE.path));
    document.body.append(editor);

    const ctx = makeCtx();
    await ensureAm07Corpus(ctx);
    expect(calls(ctx.click)).toEqual([API_MOCK.BTAB_MATCH]);
  });

  it('opens another rule by clicking its row, and leaves an open one alone', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    const same = reactiveCtx();
    expect(await openAm07Rule(same, AM07_FORM_RULE)).toBe(true);
    expect(same.click).not.toHaveBeenCalled();

    const switched = reactiveCtx();
    expect(await openAm07Rule(switched, AM07_XML_RULE)).toBe(true);
    expect(calls(switched.click)).toEqual(['[data-testid="api-mock-route-r-xml"]']);
    expect(am07OpenRulePath()).toBe(AM07_XML_RULE.path);
  });

  it('gives up quietly when the rule it needs is not in the explorer', async () => {
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    const ctx = makeCtx();
    expect(await openAm07Rule(ctx, AM07_XML_RULE)).toBe(false);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('waits for the editor to repaint before it patches the newly opened rule', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    // React repaints a frame late: the path field only catches up on the next pause.
    const ctx = makeCtx();
    let pending: string | null = null;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="api-mock-route-r-xml"]') pending = AM07_XML_RULE.path;
    });
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!pending) return;
      document.querySelector<HTMLInputElement>(API_MOCK.PATH_INPUT)!.value = pending;
      pending = null;
    });

    expect(await openAm07Rule(ctx, AM07_XML_RULE)).toBe(true);
    expect(am07OpenRulePath()).toBe(AM07_XML_RULE.path);
  });

  it('skips the patch entirely when the target rule cannot be opened', async () => {
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    await ensureAm07XPathCondition(makeCtx());
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('rebuilds each rule the tree a step starts from', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    await ensureAm07FormExact(reactiveCtx());
    expect(predicateOperators()).toEqual(['form_field_exact']);
    expect(lastPatch()!.predicates.children[0].expected)
      .toEqual([AM07_FORM_FIELD, AM07_FORM_VALUE]);

    await ensureAm07MultipartConditions(reactiveCtx());
    expect(predicateOperators()).toEqual(['multipart_field', 'multipart_file']);
    expect(lastPatch()!.predicates.children[1].expected)
      .toEqual([AM07_MULTIPART_FILE_PART, AM07_MULTIPART_FILENAME]);

    await ensureAm07XPathCondition(reactiveCtx());
    expect(predicateOperators()).toEqual(['xpath_equals']);
    expect(lastPatch()!.predicates.children[0].expected).toEqual([AM07_XPATH, AM07_ORDER_ID]);
  });

  it('rebuilds every matcher on the body source with no key', async () => {
    mountExplorer();
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND]);
    await ensureAm07MultipartConditions(reactiveCtx());

    expect(lastPatch()!.predicates.combinator).toBe('all');
    for (const child of lastPatch()!.predicates.children) {
      expect(child).toMatchObject({ source: 'body', selector: '' });
    }
  });

  it('empties the SOAP rule then hands the viewer back to the upload rule', async () => {
    mountExplorer();
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND, MP_FILE_COND]);

    const ctx = reactiveCtx();
    await ensureAm07XmlBare(ctx);

    expect(lastPatch()!.predicates.children).toEqual([]);
    expect(calls(ctx.click)).toEqual([
      '[data-testid="api-mock-route-r-xml"]',
      '[data-testid="api-mock-route-r-upload"]',
    ]);
    expect(am07OpenRulePath()).toBe(AM07_UPLOAD_RULE.path);
  });

  it('stops quietly when the patch bridge is unavailable', async () => {
    patchApiMockActiveRoute.mockReturnValue(false);
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    const ctx = reactiveCtx();
    await ensureAm07FormExact(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  // ── step bodies ───────────────────────────────────────────────────────────

  it('holds AM-07 spotlights longer than the shared pack, with extra aim time before tabs, modals, and Run', () => {
    expect(AM07_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM07_TIMING.payoff).toBeGreaterThan(AM_DEMO_TIMING.payoff);
    expect(AM07_TIMING.traceRow).toBeGreaterThan(AM07_TIMING.look);
    expect(AM07_TIMING.simOutcome).toBeGreaterThan(AM07_TIMING.payoff);
    expect(AM07_TIMING.beforeOpen).toBeGreaterThan(AM07_TIMING.look);
    expect(AM07_TIMING.beforeRun).toBeGreaterThan(AM07_TIMING.beforeOpen);
  });

  it('step 1 opens the token rule and authors the form field pair', async () => {
    mountExplorer();

    const ctx = reactiveCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector(API_MOCK.ROUTE_EDITOR)) mountEditor(AM07_FORM_RULE);
    });
    const id = await runAm07FormMatching(ctx);

    expect(id).toBe('new-1');
    expect(calls(ctx.click)).toEqual([
      '[data-testid="api-mock-route-r-form"]',
      API_MOCK.ADD_CONDITION,
    ]);
    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.conditionSource('new-1'), 'body'],
      [API_MOCK.conditionOperator('new-1'), 'form_field_exact'],
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionExpr('new-1'), AM07_FORM_FIELD],
      [API_MOCK.conditionValue('new-1'), AM07_FORM_VALUE],
    ]);
  });

  it('step 1 edits the existing row instead of adding a second one on replay', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    const ctx = reactiveCtx();
    expect(await runAm07FormMatching(ctx)).toBe('p-form');
    expect(calls(ctx.click)).not.toContain(API_MOCK.ADD_CONDITION);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 1 bails when the token rule is missing from the explorer', async () => {
    mountEditor(AM07_XML_RULE, []);
    const ctx = reactiveCtx();
    expect(await runAm07FormMatching(ctx)).toBeNull();
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 1 bails when the row it added never appears', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, []);

    // A plain context clicks without moving the DOM — the add never lands.
    const ctx = makeCtx();
    expect(await runAm07FormMatching(ctx)).toBeNull();
    expect(calls(ctx.click)).toEqual([API_MOCK.ADD_CONDITION]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 1 waits for the editor when the rule row repaints a frame late', async () => {
    mountExplorer();
    mountEditor(AM07_XML_RULE, [XPATH_COND]);

    const ctx = makeCtx();
    let pending: string | null = null;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="api-mock-route-r-form"]') pending = AM07_FORM_RULE.path;
    });
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!pending) return;
      document.querySelector<HTMLInputElement>(API_MOCK.PATH_INPUT)!.value = pending;
      pending = null;
    });

    await runAm07FormMatching(ctx);
    expect(am07OpenRulePath()).toBe(AM07_FORM_RULE.path);
  });

  it('step 2 proves the exact matcher, then widens it and re-runs the variant', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    mountSimulate({ hasResult: true, predicateRows: ['✓ body form_field_exact'] });

    const ctx = reactiveCtx();
    const outcomes = await runAm07ProveForm(ctx);

    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(picks(ctx.selectOption)).toContainEqual([
      API_MOCK.conditionOperator('p-form'), 'form_field_regex',
    ]);
    expect(fills(ctx.fill).map(f => f[1])).toEqual([
      AM07_FORM_RULE.path, AM07_FORM_CONTENT_TYPE, AM07_FORM_BODY,
      AM07_FORM_PATTERN,
      AM07_FORM_RULE.path, AM07_FORM_CONTENT_TYPE, AM07_FORM_BODY_VARIANT,
    ]);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('step 2 stops after the first proof when the form row is gone', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, []);
    mountSimulate();

    const ctx = reactiveCtx();
    expect(await runAm07ProveForm(ctx)).toEqual(['MATCHED']);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('step 3 switches to the upload rule and authors both multipart matchers', async () => {
    mountExplorer();
    mountEditor(AM07_FORM_RULE, [FORM_COND]);

    const ctx = reactiveCtx();
    await runAm07MultipartFields(ctx);

    expect(calls(ctx.click)).toEqual([
      '[data-testid="api-mock-route-r-upload"]',
      API_MOCK.ADD_CONDITION,
      API_MOCK.ADD_CONDITION,
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.conditionExpr('new-1'), AM07_MULTIPART_FIELD],
      [API_MOCK.conditionValue('new-1'), AM07_MULTIPART_FIELD_VALUE],
      [API_MOCK.conditionExpr('new-2'), AM07_MULTIPART_FILE_PART],
      [API_MOCK.conditionValue('new-2'), AM07_MULTIPART_FILENAME],
    ]);
  });

  it('step 3 bails when the upload rule is missing', async () => {
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    const ctx = reactiveCtx();
    await runAm07MultipartFields(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step 3 still finishes when the Match group never rendered', async () => {
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    editor.append(input('api-mock-path-input', AM07_UPLOAD_RULE.path));
    document.body.append(editor);

    const ctx = makeCtx();
    await runAm07MultipartFields(ctx);
    // Nothing to add onto, so the step falls back to the tally spotlight and exits.
    expect(calls(ctx.click)).toEqual([
      API_MOCK.BTAB_MATCH, API_MOCK.ADD_CONDITION, API_MOCK.ADD_CONDITION,
    ]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 4 runs the multipart body and reads the normalized request', async () => {
    mountExplorer();
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND, MP_FILE_COND]);
    mountSimulate({
      bodyExpand: true,
      predicateRows: ['✓ body multipart_field', '✓ body multipart_file'],
    });

    const ctx = reactiveCtx();
    expect(await runAm07ProveMultipart(ctx)).toBe('MATCHED');
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.SIMULATE_PATH, AM07_UPLOAD_RULE.path],
      [API_MOCK.SIMULATE_HEADERS, AM07_MULTIPART_CONTENT_TYPE],
      [API_MOCK.SIMULATE_BODY, AM07_MULTIPART_BODY],
      [API_MOCK.TEXT_EXPAND_SEARCH, AM07_MULTIPART_FIELD],
      [API_MOCK.TEXT_EXPAND_SEARCH, AM07_MULTIPART_FILENAME],
    ]);
    expect(calls(ctx.click)).toEqual([
      API_MOCK.SIMULATE_BODY_EXPAND,
      API_MOCK.TEXT_EXPAND_NEXT,
      API_MOCK.TEXT_EXPAND_NEXT,
      API_MOCK.TEXT_EXPAND_CLOSE,
      API_MOCK.SIMULATE_RUN,
      API_MOCK.SIMULATE_TAB_REQUEST,
      API_MOCK.SIMULATE_TAB_RENDERED,
      API_MOCK.SIMULATE_CLOSE,
    ]);
  });

  it('step 4 opens Simulate and picks the verb when it came up on another one', async () => {
    mountExplorer();
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND, MP_FILE_COND]);

    const ctx = reactiveCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.SIMULATE_WORKSPACE) mountSimulate({ method: 'GET', bodyExpand: true });
    });
    expect(await runAm07ProveMultipart(ctx)).toBe('MATCHED');

    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    expect(picks(ctx.selectOption)).toEqual([
      [API_MOCK.SIMULATE_METHOD, AM07_UPLOAD_RULE.method],
    ]);
  });

  it('step 5 composes the XPath from a preset and the real envelope, then applies', async () => {
    mountExplorer();
    mountEditor(AM07_UPLOAD_RULE, [MP_FIELD_COND]);

    const ctx = reactiveCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.PATTERN_TOOLBOX) mountToolbox();
    });
    await runAm07XPath(ctx);

    expect(calls(ctx.click)).toEqual([
      '[data-testid="api-mock-route-r-xml"]',
      API_MOCK.PATH_TOOLBOX,
      API_MOCK.TOOLBOX_TAB_XPATH,
      API_MOCK.toolboxXPathPreset(AM07_XPATH_PRESET),
      API_MOCK.TOOLBOX_APPLY,
    ]);
    expect(fills(ctx.fill)).toEqual([
      [API_MOCK.TOOLBOX_XPATH_SAMPLE, AM07_XML_BODY],
      [API_MOCK.TOOLBOX_XPATH_EXPR, AM07_XPATH],
      [API_MOCK.TOOLBOX_XPATH_VALUE, AM07_ORDER_ID],
    ]);
  });

  it('step 5 spotlights the applied row when the toolbox minted one', async () => {
    mountExplorer();
    mountEditor(AM07_XML_RULE, [XPATH_COND]);
    mountToolbox();

    const ctx = reactiveCtx();
    await runAm07XPath(ctx);
    expect(am07FindConditionByOperator('xpath_equals')).toBe('p-xpath');
    expect(calls(ctx.click)).toContain(API_MOCK.TOOLBOX_APPLY);
  });

  it('step 5 bails when the SOAP rule is missing', async () => {
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    const ctx = reactiveCtx();
    await runAm07XPath(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step 6 lands the XML preset, fills the element list, and proves both verdicts', async () => {
    mountExplorer();
    mountEditor(AM07_XML_RULE, [XPATH_COND, { id: 'p-xml-schema', operator: 'xmlSchema', value: AM07_XML_ELEMENTS }]);
    mountToolbox();
    mountSimulate({
      hasResult: true,
      predicateRows: ['✓ body xpath_equals', 'body xmlSchema failed — got "<…>"'],
    });

    const ctx = reactiveCtx();
    const outcomes = await runAm07XmlSchema(ctx);

    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(calls(ctx.click)).toContain(API_MOCK.toolboxSchemaPreset(AM07_SCHEMA_PRESET));
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.TOOLBOX_SCHEMA_EDITOR, AM07_XML_ELEMENTS]);
    expect(fills(ctx.fill).map(f => f[1])).toEqual([
      AM07_XML_ELEMENTS,
      AM07_XML_RULE.path, AM07_XML_CONTENT_TYPE, AM07_XML_BODY,
      AM07_XML_RULE.path, AM07_XML_CONTENT_TYPE, AM07_XML_BODY_INVALID,
    ]);
  });

  it('step 7 pins the firmware by bytes, swaps to the digest, and proves both runs', async () => {
    mountExplorer();
    mountEditor(AM07_XML_RULE, [XPATH_COND]);
    mountSimulate({ hasResult: true, method: 'PUT', predicateRows: ['✓ body binary_sha256'] });

    const ctx = reactiveCtx();
    const outcomes = await runAm07Binary(ctx);

    expect(outcomes).toEqual(['MATCHED', 'MATCHED']);
    expect(picks(ctx.selectOption)).toContainEqual([
      API_MOCK.conditionOperator('new-1'), 'binary_sha256',
    ]);
    expect(fills(ctx.fill).map(f => f[1])).toEqual([
      AM07_BINARY_BODY,
      '', AM07_BINARY_SHA256,
      AM07_BINARY_RULE.path, AM07_BINARY_CONTENT_TYPE, AM07_BINARY_BODY,
      AM07_BINARY_RULE.path, AM07_BINARY_CONTENT_TYPE, AM07_BINARY_BODY_ALTERED,
    ]);
  });

  it('step 7 bails when the firmware rule is missing', async () => {
    mountEditor(AM07_FORM_RULE, [FORM_COND]);
    const ctx = reactiveCtx();
    expect(await runAm07Binary(ctx)).toEqual([]);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});
