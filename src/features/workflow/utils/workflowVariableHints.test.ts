import { describe, expect, it } from 'vitest';
import { buildConfigVariableInsertHints, collectAncestorNodeIds, collectConditionVariableHints, formatNodeScopedRef, guessConditionLeftMode, guessValueType, buildWorkflowOnlyHints, httpStepDisplayLabel, isHttpWorkflowNode, mergeHttpVariableHintsWithStepInitialVars, parseNonGeneratorRefs, parseSingleVariableRef, validateConditionLeftRefs } from './workflowVariableHints';
import { HttpNodeData, WorkflowEdge, WorkflowNode } from '../types/workflow';

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
