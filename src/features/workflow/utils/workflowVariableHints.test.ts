import { describe, expect, it } from 'vitest';
import {
  buildConfigVariableInsertHints,
  collectAncestorNodeIds,
  collectConditionVariableHints,
  collectDescendantNodeIds,
  collectWaitForConditionVariableHints,
  formatNodeScopedRef,
  guessConditionLeftMode,
  guessValueType,
  buildWorkflowOnlyHints,
  httpStepDisplayLabel,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
  parseNonGeneratorRefs,
  parseSingleVariableRef,
  validateConditionLeftRefs,
} from './workflowVariableHints';
import type { HttpNodeData, WorkflowEdge, WorkflowNode } from '../types/workflow';

describe('collectAncestorNodeIds', () => {
  it('walks incoming edges only', () => {
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    expect(collectAncestorNodeIds(edges, 'c')).toEqual(new Set(['a', 'b']));
  });

  it('handles branching', () => {
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'root', target: 'x' },
      { id: 'e2', source: 'root', target: 'y' },
      { id: 'e3', source: 'x', target: 'cond' },
      { id: 'e4', source: 'y', target: 'cond' },
    ];
    expect(collectAncestorNodeIds(edges, 'cond')).toEqual(new Set(['root', 'x', 'y']));
  });
});

describe('collectConditionVariableHints', () => {
  const http = (id: string, extractions?: { name: string }[]): WorkflowNode => ({
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label: 'H',
      scenario: {
        id: 's',
        name: 's',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
        extractions: extractions?.map((e) => ({ name: e.name, source: 'body' as const, expression: '$' })),
      },
    },
  });

  const cond = (id: string): WorkflowNode => ({
    id,
    type: 'condition',
    position: { x: 0, y: 0 },
    data: { label: 'If', left: '{{status}}', operator: '==', right: '200' },
  });

  const refs = (hints: ReturnType<typeof collectConditionVariableHints>) => hints.map((h) => h.ref);

  it('includes workflow vars, upstream extraction names, scoped refs, and status when HTTP upstream exists', () => {
    const nodes: WorkflowNode[] = [http('h1', [{ name: 'token' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', { baseUrl: 'https://x' });
    expect(refs(hints)).toContain('baseUrl');
    expect(refs(hints)).toContain('token');
    expect(refs(hints)).toContain('node:"H".token');
    expect(refs(hints)).toContain('status');
    expect(refs(hints)).toContain('httpStatus');
    expect(refs(hints)).toContain('node:"H".status');
    expect(refs(hints)).toContain('node:"H".httpStatus');
  });

  it('does not add status or httpStatus without an HTTP ancestor', () => {
    const nodes: WorkflowNode[] = [cond('c')];
    const edges: WorkflowEdge[] = [];
    const hints = collectConditionVariableHints(nodes, edges, 'c', { foo: '1' });
    expect(refs(hints)).toEqual(['foo']);
  });

  it('includes this HTTP step own initial variable names for URL/params insert picker', () => {
    const h = http('h1', [{ name: 'token' }]);
    (h.data as HttpNodeData).initialVariables = { vin: '1GNxxx' };
    const nodes: WorkflowNode[] = [h];
    const edges: WorkflowEdge[] = [];
    const hints = collectConditionVariableHints(nodes, edges, 'h1', {});
    const vin = hints.find((x) => x.ref === 'vin');
    expect(vin).toBeDefined();
    expect(vin?.label).toContain('this step');
  });

  it('does not include per-step initialVariables from HTTP nodes that are not upstream', () => {
    const h1 = http('h1');
    (h1.data as HttpNodeData).initialVariables = { upstreamOnly: '1' };
    const h2 = http('h2');
    (h2.data as HttpNodeData).initialVariables = { stale: '2' };
    const nodes: WorkflowNode[] = [h1, h2, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', { global: 'g' });
    expect(refs(hints)).toContain('global');
    expect(refs(hints)).toContain('upstreamOnly');
    expect(refs(hints)).toContain('node:"H".upstreamOnly');
    expect(refs(hints)).not.toContain('stale');
    expect(refs(hints)).not.toContain('node:h2.upstreamOnly');
  });

  it('skips extractions with empty name', () => {
    const nodes: WorkflowNode[] = [http('h1', [{ name: '' }, { name: '  ' }, { name: 'valid' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(refs(hints)).toContain('valid');
    expect(refs(hints)).not.toContain('');
  });

  it('skips upstream HTTP node with no scenario', () => {
    const noScenario: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: { label: 'NoScenario' },
    };
    const nodes: WorkflowNode[] = [noScenario, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    // Should still have status since hasHttpAncestor is true
    expect(refs(hints)).toContain('status');
  });

  it('includes error.* hints when ErrorHandler is an ancestor', () => {
    const errHandler: WorkflowNode = {
      id: 'eh1', type: 'errorHandler', position: { x: 0, y: 0 },
      data: { label: 'API Guard', errorFilter: 'all', retryCount: 0, retryDelayMs: 1000, retryBackoff: 'fixed', retryTimeoutMs: 0, continueOnError: false },
    };
    const nodes: WorkflowNode[] = [errHandler, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'eh1', target: 'c', sourceHandle: 'catch' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(refs(hints)).toContain('error.message');
    expect(refs(hints)).toContain('error.statusCode');
    expect(refs(hints)).toContain('error.nodeId');
    expect(refs(hints)).toContain('error.nodeLabel');
    expect(refs(hints)).toContain('error.retryCount');
    expect(refs(hints)).toContain('error.type');
  });

  it('does not include error.* hints without an ErrorHandler ancestor', () => {
    const nodes: WorkflowNode[] = [http('h1'), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(refs(hints)).not.toContain('error.message');
    expect(refs(hints)).not.toContain('error.statusCode');
  });
});

describe('isHttpWorkflowNode', () => {
  it('treats nodes with scenario data as HTTP when type is missing', () => {
    const n: WorkflowNode = {
      id: 'x',
      type: 'http' as WorkflowNode['type'],
      position: { x: 0, y: 0 },
      data: { label: 'L', scenario: { id: 's', name: 'n', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
    };
    const loose = { ...n, type: undefined as unknown as WorkflowNode['type'] };
    expect(isHttpWorkflowNode(n)).toBe(true);
    expect(isHttpWorkflowNode(loose as WorkflowNode)).toBe(true);
  });
});

describe('mergeHttpVariableHintsWithStepInitialVars', () => {
  const minimalHttp = (): HttpNodeData => ({
    label: 'S',
    scenario: {
      id: '1',
      name: 'n',
      url: '/',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    },
    initialVariables: { vin: 'VIN1' },
  });

  it('adds this-step keys when base hints are empty', () => {
    const merged = mergeHttpVariableHintsWithStepInitialVars([], minimalHttp());
    expect(merged.map((h) => h.ref)).toContain('vin');
    expect(merged.find((h) => h.ref === 'vin')?.label).toContain('this step');
  });

  it('does not duplicate refs already in base hints', () => {
    const base = [{ ref: 'vin', label: 'vin (workflow)' }];
    const merged = mergeHttpVariableHintsWithStepInitialVars(base, minimalHttp());
    expect(merged.filter((h) => h.ref === 'vin')).toHaveLength(1);
  });

  it('skips empty/whitespace-only initialVariable keys', () => {
    const data = minimalHttp();
    data.initialVariables = { '': 'val1', '  ': 'val2', valid: 'val3' };
    const merged = mergeHttpVariableHintsWithStepInitialVars([], data);
    expect(merged.map(h => h.ref)).toEqual(['valid']);
  });

  it('handles httpData with no initialVariables', () => {
    const data = minimalHttp();
    delete (data as Record<string, unknown>).initialVariables;
    const merged = mergeHttpVariableHintsWithStepInitialVars([], data);
    expect(merged).toEqual([]);
  });
});

describe('parse and validate', () => {
  it('parseNonGeneratorRefs skips generators', () => {
    expect(parseNonGeneratorRefs('{{a}} and {{$uuid}}')).toEqual(['a']);
  });

  it('parseNonGeneratorRefs includes node-scoped inner keys', () => {
    expect(parseNonGeneratorRefs('{{node:"My Step".channel}}')).toEqual(['node:"My Step".channel']);
  });

  it('parseSingleVariableRef', () => {
    expect(parseSingleVariableRef('  {{ status }}  ')).toBe('status');
    expect(parseSingleVariableRef('{{node:abc-123.x}}')).toBe('node:abc-123.x');
    expect(parseSingleVariableRef('{{a}}x')).toBe(null);
  });

  it('validateConditionLeftRefs with string hints', () => {
    expect(validateConditionLeftRefs('{{status}}', ['status']).ok).toBe(true);
    expect(validateConditionLeftRefs('{{nope}}', ['status']).unknown).toEqual(['nope']);
  });

  it('validateConditionLeftRefs with WorkflowVariableHint[]', () => {
    const hints = [{ ref: 'node:"H".token', label: 't' }];
    expect(validateConditionLeftRefs('{{node:"H".token}}', hints).ok).toBe(true);
    expect(validateConditionLeftRefs('{{other}}', hints).unknown).toEqual(['other']);
  });

  it('validateConditionLeftRefs with empty hints array', () => {
    expect(validateConditionLeftRefs('{{x}}', []).ok).toBe(false);
    expect(validateConditionLeftRefs('{{x}}', []).unknown).toEqual(['x']);
  });

  it('validateConditionLeftRefs ok when no refs in template', () => {
    expect(validateConditionLeftRefs('plain text', []).ok).toBe(true);
    expect(validateConditionLeftRefs('plain text', []).unknown).toEqual([]);
  });
});

describe('httpStepDisplayLabel', () => {
  it('returns label when present', () => {
    expect(httpStepDisplayLabel({ label: 'My Step' } as HttpNodeData)).toBe('My Step');
  });
  it('returns scenario name when label is empty', () => {
    expect(httpStepDisplayLabel({ label: '', scenario: { name: 'Scenario Name' } } as unknown as HttpNodeData)).toBe('Scenario Name');
  });
  it('returns HTTP when both label and scenario name are empty', () => {
    expect(httpStepDisplayLabel({ label: '', scenario: { name: '' } } as unknown as HttpNodeData)).toBe('HTTP');
  });
  it('returns HTTP when label is whitespace only and no scenario name', () => {
    expect(httpStepDisplayLabel({ label: '  ', scenario: { name: '  ' } } as unknown as HttpNodeData)).toBe('HTTP');
  });
});

describe('formatNodeScopedRef', () => {
  it('uses label in quotes when safe', () => {
    expect(formatNodeScopedRef('n1', 'Step A', 'token')).toBe('node:"Step A".token');
  });
  it('falls back to nodeId when label contains double quote', () => {
    expect(formatNodeScopedRef('n1', 'Step "A"', 'token')).toBe('node:n1.token');
  });
  it('falls back to nodeId when label is empty', () => {
    expect(formatNodeScopedRef('n1', '', 'token')).toBe('node:n1.token');
  });
  it('falls back to nodeId when label has newline', () => {
    expect(formatNodeScopedRef('n1', 'Step\nA', 'token')).toBe('node:n1.token');
  });
});

describe('guessConditionLeftMode', () => {
  it('returns pick for single variable ref', () => {
    expect(guessConditionLeftMode('{{status}}')).toBe('pick');
  });
  it('returns expr for expression with text around ref', () => {
    expect(guessConditionLeftMode('value is {{x}}')).toBe('expr');
  });
  it('returns expr for plain text without ref', () => {
    expect(guessConditionLeftMode('plain')).toBe('expr');
  });
  it('returns expr for generator ref', () => {
    expect(guessConditionLeftMode('{{$uuid}}')).toBe('expr');
  });
});

describe('guessValueType', () => {
  it('returns boolean for "true"', () => {
    expect(guessValueType('true')).toBe('boolean');
  });
  it('returns boolean for "false"', () => {
    expect(guessValueType('false')).toBe('boolean');
  });
  it('returns number for numeric strings', () => {
    expect(guessValueType('42')).toBe('number');
    expect(guessValueType('3.14')).toBe('number');
    expect(guessValueType('-1')).toBe('number');
    expect(guessValueType('0')).toBe('number');
  });
  it('returns string for empty string', () => {
    expect(guessValueType('')).toBe('string');
  });
  it('returns string for non-numeric strings', () => {
    expect(guessValueType('hello')).toBe('string');
    expect(guessValueType('https://example.com')).toBe('string');
  });
});

describe('buildWorkflowOnlyHints', () => {
  it('returns empty array for empty input', () => {
    expect(buildWorkflowOnlyHints({})).toEqual([]);
  });

  it('returns sorted hints with type and description', () => {
    const hints = buildWorkflowOnlyHints({ zVar: 'hello', aVar: '42' });
    expect(hints.length).toBe(2);
    expect(hints[0].ref).toBe('aVar');
    expect(hints[0].type).toBe('number');
    expect(hints[0].label).toBe('aVar (workflow)');
    expect(hints[0].description).toContain('42');
    expect(hints[0].source).toEqual({ nodeLabel: 'Workflow Defaults', nodeType: 'workflow', category: 'Workflow' });
    expect(hints[0].defaultValue).toBe('42');
    expect(hints[1].ref).toBe('zVar');
    expect(hints[1].type).toBe('string');
    expect(hints[1].source?.category).toBe('Workflow');
  });

  it('skips empty/whitespace-only keys', () => {
    const hints = buildWorkflowOnlyHints({ '': 'x', '  ': 'y', valid: 'z' });
    expect(hints.length).toBe(1);
    expect(hints[0].ref).toBe('valid');
  });

  it('correctly types boolean values', () => {
    const hints = buildWorkflowOnlyHints({ flag: 'true' });
    expect(hints[0].type).toBe('boolean');
  });
});

describe('buildConfigVariableInsertHints', () => {
  const httpNode = (initialVariables?: Record<string, string>): WorkflowNode => ({
    id: 'http-1',
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label: 'HTTP Step',
      scenario: {
        id: 'scenario-1',
        name: 'HTTP Scenario',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables,
    },
  });

  it('merges HTTP and workflow hints without duplicates', () => {
    const hints = buildConfigVariableInsertHints({
      node: httpNode({ token: 'abc' }),
      workflowVariables: { baseUrl: 'https://example.com', token: 'workflow-token' },
      httpVariableHints: [{ ref: 'status', label: 'status (latest)' }],
    });

    expect(hints.map((hint) => hint.ref)).toEqual(['baseUrl', 'status', 'token']);
    expect(hints.find((hint) => hint.ref === 'token')?.label).toContain('this step');
  });

  it('merges condition and workflow hints for non-HTTP nodes', () => {
    const hints = buildConfigVariableInsertHints({
      node: {
        id: 'log-1',
        type: 'logDebug',
        position: { x: 0, y: 0 },
        data: { label: 'Logger', message: '{{status}}', logLevel: 'info' },
      } as WorkflowNode,
      workflowVariables: { baseUrl: 'https://example.com' },
      conditionVariableHints: [{ ref: 'status', label: 'status (latest)' }],
    });

    expect(hints.map((hint) => hint.ref)).toEqual(['baseUrl', 'status']);
  });

  it('returns workflow-only hints when there is no selected node', () => {
    const hints = buildConfigVariableInsertHints({
      node: null,
      workflowVariables: { alpha: '1', beta: '2' },
    });

    expect(hints.map((hint) => hint.ref)).toEqual(['alpha', 'beta']);
  });
});

describe('collectConditionVariableHints — non-HTTP upstream nodes', () => {
  const setVar = (id: string, vars: Record<string, string>): WorkflowNode => ({
    id,
    type: 'setVariable',
    position: { x: 0, y: 0 },
    data: { label: 'SetVar', assignments: Object.entries(vars).map(([name, expression], i) => ({ id: String(i), name, expression })) },
  });

  const aggregate = (id: string, mappings: { targetVariable: string; strategy: string }[]): WorkflowNode => ({
    id,
    type: 'aggregate',
    position: { x: 0, y: 0 },
    data: { label: 'Agg', mappings: mappings.map((m, i) => ({ id: String(i), sourceExpression: '{{x}}', ...m })) },
  });

  const loop = (id: string): WorkflowNode => ({
    id,
    type: 'loop',
    position: { x: 0, y: 0 },
    data: { label: 'Loop', mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'idx', maxIterations: 10 },
  });

  const cond = (id: string): WorkflowNode => ({
    id,
    type: 'condition',
    position: { x: 0, y: 0 },
    data: { label: 'If', left: '{{x}}', operator: '==', right: '1' },
  });

  it('includes setVariable assignments from upstream', () => {
    const nodes = [setVar('sv1', { token: 'abc', count: '5' }), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sv1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('token');
    expect(refs).toContain('count');
    // Should have type and description
    const tokenHint = hints.find(h => h.ref === 'token');
    expect(tokenHint?.type).toBe('string');
    expect(tokenHint?.description).toBeDefined();
  });

  it('includes aggregate mappings from upstream', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'total', strategy: 'sum' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const totalHint = hints.find(h => h.ref === 'total');
    expect(totalHint).toBeDefined();
    expect(totalHint?.type).toBe('number');
    expect(totalHint?.description).toContain('Sum');
  });

  it('aggregate concat strategy produces array type', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'items', strategy: 'concat' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const itemsHint = hints.find(h => h.ref === 'items');
    expect(itemsHint?.type).toBe('array');
    expect(itemsHint?.description).toContain('Append');
  });

  it('aggregate count strategy produces number type', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'total', strategy: 'count' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const totalHint = hints.find(h => h.ref === 'total');
    expect(totalHint?.type).toBe('number');
    expect(totalHint?.description).toContain('Count');
  });

  it('aggregate first strategy produces string type', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'first', strategy: 'first' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const firstHint = hints.find(h => h.ref === 'first');
    expect(firstHint?.type).toBe('string');
    expect(firstHint?.description).toContain('first');
  });

  it('aggregate last strategy produces string type', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'last', strategy: 'last' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const lastHint = hints.find(h => h.ref === 'last');
    expect(lastHint?.type).toBe('string');
    expect(lastHint?.description).toContain('last');
  });

  it('aggregate custom strategy produces string type', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'custom', strategy: 'custom' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const customHint = hints.find(h => h.ref === 'custom');
    expect(customHint?.type).toBe('string');
    expect(customHint?.description).toContain('Custom');
  });

  it('aggregate unknown strategy falls through to default', () => {
    const nodes = [aggregate('a1', [{ targetVariable: 'x', strategy: 'newStrategy' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const xHint = hints.find(h => h.ref === 'x');
    expect(xHint?.type).toBe('string');
    expect(xHint?.description).toContain('newStrategy');
  });

  it('aggregate skips mappings with empty targetVariable', () => {
    const nodes = [aggregate('a1', [{ targetVariable: '', strategy: 'sum' }, { targetVariable: '  ', strategy: 'sum' }, { targetVariable: 'valid', strategy: 'count' }]), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.some(h => h.ref === 'valid')).toBe(true);
    expect(hints.some(h => h.ref === '')).toBe(false);
  });

  it('includes loop built-in variables from upstream', () => {
    const nodes = [loop('l1'), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'l1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('item');
    expect(refs).toContain('idx');
  });

  it('loop in count mode does not add item variable', () => {
    const countLoop = (id: string): WorkflowNode => ({
      id,
      type: 'loop',
      position: { x: 0, y: 0 },
      data: { label: 'CountLoop', mode: 'count', sourceExpression: '10', itemVariable: 'item', indexVariable: 'i', maxIterations: 10 },
    });
    const nodes = [countLoop('l2'), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'l2', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    // count mode doesn't have item variable
    expect(refs).not.toContain('item');
    expect(refs).toContain('i');
  });

  it('loop with default item/index variable names', () => {
    const defaultLoop: WorkflowNode = {
      id: 'l3',
      type: 'loop',
      position: { x: 0, y: 0 },
      data: { label: 'Loop', mode: 'forEach', sourceExpression: '{{items}}', itemVariable: '', indexVariable: '', maxIterations: 10 },
    };
    const nodes = [defaultLoop, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'l3', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('item');
    expect(refs).toContain('i');
  });

  it('setVariable with empty name is skipped', () => {
    const sv: WorkflowNode = {
      id: 'sv1', type: 'setVariable', position: { x: 0, y: 0 },
      data: { label: 'SetVar', assignments: [{ id: '1', name: '', expression: 'val' }, { id: '2', name: '  ', expression: 'val2' }, { id: '3', name: 'valid', expression: 'val3' }] },
    };
    const nodes = [sv, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sv1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.some(h => h.ref === 'valid')).toBe(true);
    expect(hints.filter(h => h.ref === '' || h.ref === '  ').length).toBe(0);
  });

  it('setVariable with no label falls back to "Set Variable"', () => {
    const sv: WorkflowNode = {
      id: 'sv1', type: 'setVariable', position: { x: 0, y: 0 },
      data: { label: '', assignments: [{ id: '1', name: 'x', expression: '1' }] },
    };
    const nodes = [sv, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sv1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const xHint = hints.find(h => h.ref === 'x');
    expect(xHint?.description).toContain('Set Variable');
  });

  it('aggregate with no label falls back to "Aggregate"', () => {
    const agg: WorkflowNode = {
      id: 'a1', type: 'aggregate', position: { x: 0, y: 0 },
      data: { label: '', mappings: [{ id: '1', sourceExpression: '{{x}}', targetVariable: 'total', strategy: 'sum' }] },
    };
    const nodes = [agg, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'a1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const totalHint = hints.find(h => h.ref === 'total');
    expect(totalHint?.description).toContain('Aggregate');
  });

  it('loop with no label falls back to "Loop"', () => {
    const loopNode: WorkflowNode = {
      id: 'l1', type: 'loop', position: { x: 0, y: 0 },
      data: { label: '', mode: 'forEach', sourceExpression: '{{x}}', itemVariable: 'it', indexVariable: 'idx', maxIterations: 10 },
    };
    const nodes = [loopNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'l1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const itHint = hints.find(h => h.ref === 'it');
    expect(itHint?.description).toContain('Loop');
  });

  it('waitForCondition with no label falls back to "Wait"', () => {
    const waitNode: WorkflowNode = {
      id: 'w1', type: 'waitForCondition', position: { x: 0, y: 0 },
      data: { label: '', conditionLeft: '{{x}}', conditionOperator: '==', conditionRight: '1', pollIntervalMs: 1000, timeoutMs: 5000 },
    };
    const nodes = [waitNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'w1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const attemptHint = hints.find(h => h.ref === 'wait.attempts');
    expect(attemptHint?.description).toContain('Wait');
  });

  it('errorHandler with no label falls back to "Error Handler"', () => {
    const errHandler: WorkflowNode = {
      id: 'eh1', type: 'errorHandler', position: { x: 0, y: 0 },
      data: { label: '', errorFilter: 'all', retryCount: 0, retryDelayMs: 1000, retryBackoff: 'fixed', retryTimeoutMs: 0, continueOnError: false },
    };
    const nodes = [errHandler, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'eh1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const msgHint = hints.find(h => h.ref === 'error.message');
    expect(msgHint?.description).toContain('Error Handler');
  });

  it('start node with no label falls back to "Start"', () => {
    const startNode: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: '', inputVariables: { key: 'val' } },
    };
    const nodes = [startNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 's1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const keyHint = hints.find(h => h.ref === 'key');
    expect(keyHint?.description).toContain('Start');
  });

  it('start node with whitespace-only inputVariable keys are skipped', () => {
    const startNode: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { '': 'x', '  ': 'y', 'valid': 'z' } },
    };
    const nodes = [startNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 's1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.some(h => h.ref === 'valid')).toBe(true);
    expect(hints.some(h => h.ref === '' || h.ref === '  ')).toBe(false);
  });

  it('includes waitForCondition built-in variables from upstream', () => {
    const waitNode: WorkflowNode = {
      id: 'w1', type: 'waitForCondition', position: { x: 0, y: 0 },
      data: {
        label: 'Wait For It',
        conditionLeft: '{{status}}', conditionOperator: '==', conditionRight: '200',
        pollIntervalMs: 1000, timeoutMs: 30000,
      },
    };
    const nodes = [waitNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'w1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('wait.attempts');
    expect(refs).toContain('wait.elapsed');
    expect(refs).toContain('wait.conditionMet');
  });

  it('includes script outputVariables from upstream', () => {
    const scriptNode: WorkflowNode = {
      id: 'sc1',
      type: 'script',
      position: { x: 0, y: 0 },
      data: {
        label: 'Transform',
        code: 'return {}',
        mode: 'transform',
        inputVariables: [],
        outputVariables: ['parsed', 'count', '', '  ', 'fine'],
        timeoutMs: 5000,
        captureConsole: false,
      },
    };
    const nodes = [scriptNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sc1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.map((h) => h.ref).sort()).toEqual(['count', 'fine', 'parsed']);
    const parsed = hints.find((h) => h.ref === 'parsed');
    expect(parsed?.type).toBe('string');
    expect(parsed?.source).toEqual({ nodeId: 'sc1', nodeLabel: 'Transform', nodeType: 'script', category: 'Data' });
    expect(parsed?.description).toContain('Transform');
  });

  it('script node with missing outputVariables adds no script hints', () => {
    const scriptNode: WorkflowNode = {
      id: 'sc1',
      type: 'script',
      position: { x: 0, y: 0 },
      data: {
        label: 'X',
        code: '',
        mode: 'transform',
        inputVariables: [],
        timeoutMs: 5000,
        captureConsole: false,
      } as WorkflowNode['data'],
    };
    delete (scriptNode.data as Record<string, unknown>).outputVariables;
    const nodes = [scriptNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sc1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.length).toBe(0);
  });

  it('script with no label falls back to "Script"', () => {
    const scriptNode: WorkflowNode = {
      id: 'sc1',
      type: 'script',
      position: { x: 0, y: 0 },
      data: {
        label: '',
        code: '',
        mode: 'transform',
        inputVariables: [],
        outputVariables: ['out'],
        timeoutMs: 5000,
        captureConsole: false,
      },
    };
    const nodes = [scriptNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sc1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const out = hints.find((h) => h.ref === 'out');
    expect(out?.label).toContain('Script');
    expect(out?.description).toContain('script "Script"');
  });

  it('skips script outputVariables entries that trim to empty', () => {
    const scriptNode: WorkflowNode = {
      id: 'sc1',
      type: 'script',
      position: { x: 0, y: 0 },
      data: {
        label: 'S',
        code: '',
        mode: 'transform',
        inputVariables: [],
        outputVariables: ['\t', '\n', 'keep'],
        timeoutMs: 5000,
        captureConsole: false,
      },
    };
    const nodes = [scriptNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sc1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.map((h) => h.ref)).toEqual(['keep']);
  });

  it('includes start node inputVariables from upstream', () => {
    const startNode: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { jobId: '123', jobName: 'Test Job' } },
    };
    const nodes = [startNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 's1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('jobId');
    expect(refs).toContain('jobName');
    const jobIdHint = hints.find(h => h.ref === 'jobId');
    expect(jobIdHint?.type).toBe('number');
    expect(jobIdHint?.description).toContain('Start');
    expect(jobIdHint?.label).toContain('trigger input');
    expect(jobIdHint?.source).toEqual({ nodeId: 's1', nodeLabel: 'Start', nodeType: 'start', category: 'Triggers' });
    expect(jobIdHint?.defaultValue).toBe('123');
    const jobNameHint = hints.find(h => h.ref === 'jobName');
    expect(jobNameHint?.type).toBe('string');
    expect(jobNameHint?.source?.category).toBe('Triggers');
  });

  it('start node variables do not override workflow variables of the same name', () => {
    const startNode: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { baseUrl: 'http://start' } },
    };
    const nodes = [startNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 's1', target: 'c' }];
    // baseUrl exists in both workflow vars and start node
    const hints = collectConditionVariableHints(nodes, edges, 'c', { baseUrl: 'http://default' });
    const baseUrlHints = hints.filter(h => h.ref === 'baseUrl');
    // Workflow variable is pushed first, so start node's duplicate is skipped
    expect(baseUrlHints.length).toBe(1);
    expect(baseUrlHints[0].label).toContain('workflow');
  });

  it('start node with empty inputVariables does not add hints', () => {
    const startNode: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: {} },
    };
    const nodes = [startNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 's1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    expect(hints.length).toBe(0);
  });

  it('populates source fields for workflow variables', () => {
    const nodes = [cond('c')];
    const hints = collectConditionVariableHints(nodes, [], 'c', { env: 'prod' });
    const envHint = hints.find(h => h.ref === 'env');
    expect(envHint?.source).toEqual({ nodeLabel: 'Workflow Defaults', nodeType: 'workflow', category: 'Workflow' });
    expect(envHint?.defaultValue).toBe('prod');
  });

  it('populates source fields for setVariable nodes', () => {
    const sv = setVar('sv1', { counter: '0' });
    sv.data.label = 'Init Counter';
    const nodes = [sv, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'sv1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const counterHint = hints.find(h => h.ref === 'counter');
    expect(counterHint?.source).toEqual({ nodeId: 'sv1', nodeLabel: 'Init Counter', nodeType: 'setVariable', category: 'Logic' });
  });

  it('populates source fields for HTTP ancestor nodes', () => {
    const httpNode: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: { label: 'Login', scenario: { name: 'Login', requests: [], extractions: [{ name: 'token', source: 'body', expression: '$.token' }] }, initialVariables: { user: 'admin' } },
    };
    const nodes = [httpNode, cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'h1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const tokenHint = hints.find(h => h.ref === 'token');
    expect(tokenHint?.source).toEqual({ nodeId: 'h1', nodeLabel: 'Login', nodeType: 'http', category: 'HTTP Steps' });
    const userHint = hints.find(h => h.ref === 'user');
    expect(userHint?.source?.category).toBe('HTTP Steps');
    expect(userHint?.defaultValue).toBe('admin');
  });
});

describe('collectDescendantNodeIds', () => {
  it('walks forward from a node', () => {
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    expect(collectDescendantNodeIds(edges, 'a')).toEqual(new Set(['b', 'c']));
  });

  it('filters by sourceHandle when specified', () => {
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'wait', target: 'body1', sourceHandle: 'body' },
      { id: 'e2', source: 'wait', target: 'done1', sourceHandle: 'done' },
      { id: 'e3', source: 'body1', target: 'body2' },
    ];
    const bodyDescendants = collectDescendantNodeIds(edges, 'wait', 'body');
    expect(bodyDescendants).toEqual(new Set(['body1', 'body2']));
    expect(bodyDescendants.has('done1')).toBe(false);
  });

  it('does not loop back to the source node', () => {
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' }, // cycle back
    ];
    expect(collectDescendantNodeIds(edges, 'a')).toEqual(new Set(['b']));
  });

  it('returns empty set when no outgoing edges', () => {
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'x', target: 'a' }];
    expect(collectDescendantNodeIds(edges, 'a').size).toBe(0);
  });
});

describe('collectWaitForConditionVariableHints', () => {
  const http = (id: string, extractions?: { name: string }[]): WorkflowNode => ({
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label: 'Poll Step',
      scenario: {
        id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '',
        auth: { type: 'none' }, validation: { mode: 'none' },
        extractions: extractions?.map((e) => ({ name: e.name, source: 'body' as const, expression: '$' })),
      },
    },
  });

  const wait = (id: string): WorkflowNode => ({
    id,
    type: 'waitForCondition',
    position: { x: 0, y: 0 },
    data: {
      label: 'Wait',
      conditionLeft: '{{status}}',
      conditionOperator: '==',
      conditionRight: '200',
      pollIntervalMs: 1000,
      timeoutMs: 30000,
    },
  });

  it('includes built-in wait variables', () => {
    const nodes = [wait('w1')];
    const edges: WorkflowEdge[] = [];
    const hints = collectWaitForConditionVariableHints(nodes, edges, 'w1', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('wait.attempts');
    expect(refs).toContain('wait.elapsed');
    expect(refs).toContain('wait.conditionMet');
    const condMetHint = hints.find(h => h.ref === 'wait.conditionMet');
    expect(condMetHint?.type).toBe('boolean');
  });

  it('includes poll body HTTP extractions', () => {
    const nodes = [wait('w1'), http('poll1', [{ name: 'result' }])];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'w1', target: 'poll1', sourceHandle: 'body' },
    ];
    const hints = collectWaitForConditionVariableHints(nodes, edges, 'w1', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('result');
    const resultHint = hints.find(h => h.ref === 'result');
    expect(resultHint?.label).toContain('poll body');
  });

  it('includes poll body HTTP initialVariables', () => {
    const pollStep = http('poll1');
    (pollStep.data as HttpNodeData).initialVariables = { pollVar: 'pv1' };
    const nodes = [wait('w1'), pollStep];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'w1', target: 'poll1', sourceHandle: 'body' },
    ];
    const hints = collectWaitForConditionVariableHints(nodes, edges, 'w1', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('pollVar');
  });

  it('includes ancestor hints plus workflow defaults', () => {
    const upstream = http('h1', [{ name: 'authToken' }]);
    const nodes = [upstream, wait('w1')];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'h1', target: 'w1' },
    ];
    const hints = collectWaitForConditionVariableHints(nodes, edges, 'w1', { baseUrl: 'http://x' });
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('baseUrl');
    expect(refs).toContain('authToken');
    expect(refs).toContain('wait.attempts');
  });

  it('does not include extractions from nodes NOT in the poll body', () => {
    const pollStep = http('poll1', [{ name: 'pollResult' }]);
    const otherStep = http('other', [{ name: 'otherResult' }]);
    const nodes = [wait('w1'), pollStep, otherStep];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'w1', target: 'poll1', sourceHandle: 'body' },
      { id: 'e2', source: 'w1', target: 'other', sourceHandle: 'done' },
    ];
    const hints = collectWaitForConditionVariableHints(nodes, edges, 'w1', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('pollResult');
    // 'otherResult' should NOT appear because it's in the 'done' branch, not 'body'
    expect(refs).not.toContain('otherResult');
  });
});
