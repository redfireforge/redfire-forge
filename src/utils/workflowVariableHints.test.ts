import { describe, expect, it } from 'vitest';
import {
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
    expect(refs(hints)).toContain('node:"H".status');
  });

  it('does not add status without an HTTP ancestor', () => {
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

  it('includes loop built-in variables from upstream', () => {
    const nodes = [loop('l1'), cond('c')];
    const edges: WorkflowEdge[] = [{ id: 'e', source: 'l1', target: 'c' }];
    const hints = collectConditionVariableHints(nodes, edges, 'c', {});
    const refs = hints.map(h => h.ref);
    expect(refs).toContain('item');
    expect(refs).toContain('idx');
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
