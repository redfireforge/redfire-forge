import { describe, expect, it } from 'vitest';
import {
  collectAncestorNodeIds,
  collectConditionVariableHints,
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
});
