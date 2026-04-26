import { describe, it, expect } from 'vitest';
import {
  applyTemplateLiteralsFromMap,
  coerceStringMap,
  applyTemplateLiteralsToScenario,
  findStartNodes,
  collectReachableFromEdges,
  markSubtreeSkipped,
  compareValues,
  evaluateCondition,
  classifyErrorType,
  matchesErrorFilter,
  evaluateWaitCondition,
} from './graphRunnerHelpers';
import type { WorkflowNode, WorkflowEdge, ConditionNodeData } from '../types/workflow';
import type { RequestResult, Scenario } from '../../../shared/types';
import { VariableContext } from './variableContext';

// ── applyTemplateLiteralsFromMap ──

describe('applyTemplateLiteralsFromMap', () => {
  it('returns input unchanged when no {{ present', () => {
    expect(applyTemplateLiteralsFromMap('hello world', { foo: 'bar' })).toBe('hello world');
  });

  it('replaces simple variables', () => {
    expect(applyTemplateLiteralsFromMap('{{name}}', { name: 'Alice' })).toBe('Alice');
  });

  it('replaces with spaces around key', () => {
    expect(applyTemplateLiteralsFromMap('{{ name }}', { name: 'Bob' })).toBe('Bob');
  });

  it('skips empty keys', () => {
    expect(applyTemplateLiteralsFromMap('{{a}}', { '': 'bad', a: 'ok' })).toBe('ok');
  });
});

// ── coerceStringMap ──

describe('coerceStringMap', () => {
  it('returns empty for undefined', () => {
    expect(coerceStringMap(undefined)).toEqual({});
  });

  it('coerces non-string values', () => {
    const src = { a: 'hello', b: '42' } as Record<string, string>;
    expect(coerceStringMap(src)).toEqual({ a: 'hello', b: '42' });
  });

  it('skips null values', () => {
    expect(coerceStringMap({ a: null as unknown as string, b: 'ok' })).toEqual({ b: 'ok' });
  });

  it('skips empty keys', () => {
    expect(coerceStringMap({ '': 'bad', ' ': 'also-bad', a: 'good' })).toEqual({ a: 'good' });
  });

  it('coerces numeric values to string', () => {
    const src = { num: 123 as unknown as string };
    expect(coerceStringMap(src)).toEqual({ num: '123' });
  });
});

// ── applyTemplateLiteralsToScenario ──

describe('applyTemplateLiteralsToScenario', () => {
  const baseScenario: Scenario = {
    id: '1',
    name: 'test',
    method: 'GET',
    url: 'https://{{host}}/api',
    headers: [{ key: 'X-Token', value: '{{token}}' }],
    body: '{"key":"{{val}}"}',
    bodyForm: [{ key: '{{fk}}', value: '{{fv}}' }],
    auth: { type: 'bearer', token: '{{token}}', apiKeyValue: '{{apk}}', username: '{{user}}', password: '{{pass}}' },
    validation: { mode: 'none' },
  };

  it('returns scenario unchanged when flat map is empty', () => {
    expect(applyTemplateLiteralsToScenario(baseScenario, {})).toBe(baseScenario);
  });

  it('replaces all fields', () => {
    const result = applyTemplateLiteralsToScenario(baseScenario, {
      host: 'example.com', token: 'abc', val: '42', fk: 'field', fv: 'data', apk: 'key1', user: 'admin', pass: 'secret',
    });
    expect(result.url).toBe('https://example.com/api');
    expect(result.headers[0].value).toBe('abc');
    expect(result.body).toBe('{"key":"42"}');
    expect(result.bodyForm![0].key).toBe('field');
    expect(result.auth.token).toBe('abc');
    expect(result.auth.apiKeyValue).toBe('key1');
    expect(result.auth.username).toBe('admin');
    expect(result.auth.password).toBe('secret');
  });

  it('handles null auth fields', () => {
    const sc: Scenario = {
      ...baseScenario,
      bodyForm: undefined,
      auth: { type: 'none', token: null as unknown as string, apiKeyValue: null as unknown as string, username: null as unknown as string, password: null as unknown as string },
    };
    const result = applyTemplateLiteralsToScenario(sc, { host: 'h' });
    expect(result.auth.token).toBeNull();
    expect(result.bodyForm).toBeUndefined();
  });
});

// ── findStartNodes ──

describe('findStartNodes', () => {
  it('finds start/webhook/schedule trigger nodes', () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    expect(findStartNodes(nodes, []).map(n => n.id)).toEqual(['1']);
  });

  it('falls back to root nodes when no trigger nodes', () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];
    expect(findStartNodes(nodes, edges).map(n => n.id)).toEqual(['1']);
  });

  it('returns all nodes when none are targets', () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    expect(findStartNodes(nodes, [])).toHaveLength(2);
  });
});

// ── collectReachableFromEdges ──

describe('collectReachableFromEdges', () => {
  it('collects reachable nodes', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'B', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'C', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ];
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('A', [edges[0]]);
    outgoing.set('B', [edges[1]]);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const result = collectReachableFromEdges([edges[0]], outgoing, nodeMap, []);
    expect(result).toEqual(new Set(['B', 'C']));
  });

  it('respects boundary nodes', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'B', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'A', target: 'B' }];
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('A', [edges[0]]);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const result = collectReachableFromEdges([edges[0]], outgoing, nodeMap, ['B']);
    expect(result.size).toBe(0);
  });

  it('skips unknown node ids', () => {
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'X', target: 'Y' }];
    const result = collectReachableFromEdges(edges, new Map(), new Map(), []);
    expect(result.size).toBe(0);
  });
});

// ── markSubtreeSkipped ──

describe('markSubtreeSkipped', () => {
  it('marks nodes as skipped', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'B', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'A', target: 'B' }];
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('A', [edges[0]]);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set<string>();
    const states: Record<string, string> = {};
    const callbacks = { onNodeStateChange: (id: string, s: { state: string }) => { states[id] = s.state; } } as any;
    markSubtreeSkipped('A', outgoing, nodeMap, visited, callbacks);
    expect(states['A']).toBe('skipped');
    expect(states['B']).toBe('skipped');
  });

  it('stops at join nodes and decrements incoming count', () => {
    const nodes: WorkflowNode[] = [
      { id: 'J', type: 'join', position: { x: 0, y: 0 }, data: {} },
    ];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set<string>();
    const states: Record<string, string> = {};
    const callbacks = { onNodeStateChange: (id: string, s: { state: string }) => { states[id] = s.state; } } as any;
    const incomingCount = new Map([['J', 2]]);
    markSubtreeSkipped('J', new Map(), nodeMap, visited, callbacks, incomingCount);
    expect(states['J']).toBeUndefined();
    expect(incomingCount.get('J')).toBe(1);
  });

  it('decrements incoming count for non-join nodes with multiple incoming edges', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set<string>();
    const states: Record<string, string> = {};
    const callbacks = { onNodeStateChange: (id: string, s: { state: string }) => { states[id] = s.state; } } as any;
    const incomingCount = new Map([['A', 3]]);
    markSubtreeSkipped('A', new Map(), nodeMap, visited, callbacks, incomingCount);
    expect(states['A']).toBeUndefined();
    expect(incomingCount.get('A')).toBe(2);
  });

  it('skips already-visited nodes', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set<string>(['A']);
    const states: Record<string, string> = {};
    const callbacks = { onNodeStateChange: (id: string, s: { state: string }) => { states[id] = s.state; } } as any;
    markSubtreeSkipped('A', new Map(), nodeMap, visited, callbacks);
    expect(states['A']).toBeUndefined();
  });
});

// ── compareValues ──

describe('compareValues', () => {
  it('== equality', () => {
    expect(compareValues('abc', 'abc', '==')).toBe(true);
    expect(compareValues('abc', 'def', '==')).toBe(false);
  });
  it('!= inequality', () => {
    expect(compareValues('a', 'b', '!=')).toBe(true);
    expect(compareValues('a', 'a', '!=')).toBe(false);
  });
  it('numeric comparisons', () => {
    expect(compareValues('10', '5', '>')).toBe(true);
    expect(compareValues('3', '7', '<')).toBe(true);
    expect(compareValues('5', '5', '>=')).toBe(true);
    expect(compareValues('4', '5', '<=')).toBe(true);
    expect(compareValues('5', '5', '<=')).toBe(true);
    expect(compareValues('5', '5', '>=')).toBe(true);
  });
  it('contains / not-contains / !contains', () => {
    expect(compareValues('hello world', 'world', 'contains')).toBe(true);
    expect(compareValues('hello', 'xyz', 'contains')).toBe(false);
    expect(compareValues('hello', 'xyz', 'not-contains')).toBe(true);
    expect(compareValues('hello world', 'world', 'not-contains')).toBe(false);
    expect(compareValues('hello', 'xyz', '!contains')).toBe(true);
  });
  it('regex', () => {
    expect(compareValues('abc123', '\\d+', 'regex')).toBe(true);
    expect(compareValues('abc', '\\d+', 'regex')).toBe(false);
  });
  it('regex with invalid pattern returns false', () => {
    expect(compareValues('abc', '[invalid', 'regex')).toBe(false);
  });
  it('unknown operator returns false', () => {
    expect(compareValues('a', 'b', 'unknown')).toBe(false);
  });
});

// ── evaluateCondition ──

describe('evaluateCondition', () => {
  it('evaluates resolved condition', () => {
    const ctx = new VariableContext();
    ctx.set('status', '200');
    const data: ConditionNodeData = { left: '{{status}}', right: '200', operator: '==' };
    expect(evaluateCondition(data, ctx)).toBe(true);
  });
});

// ── classifyErrorType ──

describe('classifyErrorType', () => {
  it('network-error for status 0', () => {
    expect(classifyErrorType({ httpStatus: 0 } as RequestResult)).toBe('network-error');
  });
  it('http-error for status >= 400', () => {
    expect(classifyErrorType({ httpStatus: 500 } as RequestResult)).toBe('http-error');
  });
  it('assertion-failure when failures exist', () => {
    expect(classifyErrorType({ httpStatus: 200, failureDetails: [{ path: 'x', expected: 'y', actual: 'z' }] } as RequestResult)).toBe('assertion-failure');
  });
  it('http-error default', () => {
    expect(classifyErrorType({ httpStatus: 200, failureDetails: [] } as RequestResult)).toBe('http-error');
  });
});

// ── matchesErrorFilter ──

describe('matchesErrorFilter', () => {
  it('all filter matches everything', () => {
    expect(matchesErrorFilter('network-error', 'all')).toBe(true);
    expect(matchesErrorFilter('http-error', 'all')).toBe(true);
  });
  it('specific filter matches only that type', () => {
    expect(matchesErrorFilter('http-error', 'http-error')).toBe(true);
    expect(matchesErrorFilter('network-error', 'http-error')).toBe(false);
  });
});

// ── evaluateWaitCondition ──

describe('evaluateWaitCondition', () => {
  it('returns false for empty expression', () => {
    const ctx = new VariableContext();
    expect(evaluateWaitCondition('', ctx)).toBe(false);
    expect(evaluateWaitCondition('  ', ctx)).toBe(false);
  });

  it('evaluates == condition', () => {
    const ctx = new VariableContext();
    ctx.set('status', '200');
    expect(evaluateWaitCondition('{{status}} == 200', ctx)).toBe(true);
  });

  it('evaluates != condition', () => {
    const ctx = new VariableContext();
    ctx.set('status', '500');
    expect(evaluateWaitCondition('{{status}} != 200', ctx)).toBe(true);
  });

  it('evaluates >= condition', () => {
    const ctx = new VariableContext();
    ctx.set('count', '10');
    expect(evaluateWaitCondition('{{count}} >= 5', ctx)).toBe(true);
  });

  it('evaluates <= condition', () => {
    const ctx = new VariableContext();
    ctx.set('count', '3');
    expect(evaluateWaitCondition('{{count}} <= 5', ctx)).toBe(true);
  });

  it('evaluates > condition', () => {
    const ctx = new VariableContext();
    ctx.set('count', '10');
    expect(evaluateWaitCondition('{{count}} > 5', ctx)).toBe(true);
  });

  it('evaluates < condition', () => {
    const ctx = new VariableContext();
    ctx.set('count', '3');
    expect(evaluateWaitCondition('{{count}} < 5', ctx)).toBe(true);
  });

  it('evaluates contains condition', () => {
    const ctx = new VariableContext();
    ctx.set('msg', 'hello world');
    expect(evaluateWaitCondition('{{msg}} contains world', ctx)).toBe(true);
  });

  it('evaluates !contains condition', () => {
    const ctx = new VariableContext();
    ctx.set('msg', 'hello');
    expect(evaluateWaitCondition('{{msg}} !contains world', ctx)).toBe(true);
  });

  it('truthy fallback for non-condition expressions', () => {
    const ctx = new VariableContext();
    ctx.set('ready', 'true');
    expect(evaluateWaitCondition('{{ready}}', ctx)).toBe(true);
  });

  it('falsy fallback for false/0/null/undefined/empty', () => {
    const ctx = new VariableContext();
    ctx.set('a', 'false');
    expect(evaluateWaitCondition('{{a}}', ctx)).toBe(false);
    ctx.set('a', '0');
    expect(evaluateWaitCondition('{{a}}', ctx)).toBe(false);
    ctx.set('a', 'null');
    expect(evaluateWaitCondition('{{a}}', ctx)).toBe(false);
    ctx.set('a', 'undefined');
    expect(evaluateWaitCondition('{{a}}', ctx)).toBe(false);
    ctx.set('a', '');
    expect(evaluateWaitCondition('{{a}}', ctx)).toBe(false);
  });
});
