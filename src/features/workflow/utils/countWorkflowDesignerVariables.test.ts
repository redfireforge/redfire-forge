import { describe, it, expect } from 'vitest';
import { countWorkflowDesignerVariables, buildInitialRunnerVariables } from './countWorkflowDesignerVariables';
import type { WorkflowRFNode } from './workflowNodeFactory';
import type { GraphqlQueryNodeData } from '../types/workflow';

function httpNode(id: string): WorkflowRFNode {
  return { id, type: 'http', data: {} as never, position: { x: 0, y: 0 } };
}

function otherNode(id: string, type = 'start'): WorkflowRFNode {
  return { id, type, data: {} as never, position: { x: 0, y: 0 } };
}

function gqlQueryNode(id: string, extractionRules: { variableName: string; jsonPath: string }[] = []): WorkflowRFNode {
  const data: Partial<GraphqlQueryNodeData> = { extractionRules };
  return { id, type: 'graphqlQuery', data: data as never, position: { x: 0, y: 0 } };
}

function gqlMutationNode(id: string, extractionRules: { variableName: string; jsonPath: string }[] = []): WorkflowRFNode {
  const data: Partial<GraphqlQueryNodeData> = { extractionRules };
  return { id, type: 'graphqlMutation', data: data as never, position: { x: 0, y: 0 } };
}

describe('countWorkflowDesignerVariables', () => {
  it('counts only workflow-level variables when no HTTP nodes', () => {
    expect(countWorkflowDesignerVariables({ a: '1', b: '2' }, [], {})).toBe(2);
  });

  it('counts workflow + per-HTTP-node initial variables (deduped)', () => {
    const nodes = [httpNode('n1'), httpNode('n2')];
    const initial: Record<string, Record<string, string>> = {
      n1: { token: 'x' },
      n2: { token: 'y', extra: 'z' },
    };
    const result = countWorkflowDesignerVariables({ base: '' }, nodes, initial);
    // base, token, extra = 3
    expect(result).toBe(3);
  });

  it('ignores non-HTTP nodes when collecting initial vars', () => {
    const nodes = [otherNode('s'), httpNode('h1')];
    const initial: Record<string, Record<string, string>> = {
      s: { shouldIgnore: 'yes' },
      h1: { real: 'val' },
    };
    expect(countWorkflowDesignerVariables({}, nodes, initial)).toBe(1);
  });

  it('handles HTTP node with no initial vars entry', () => {
    const nodes = [httpNode('n1')];
    expect(countWorkflowDesignerVariables({ a: '1' }, nodes, {})).toBe(1);
  });

  it('returns 0 when no variables anywhere', () => {
    expect(countWorkflowDesignerVariables({}, [], {})).toBe(0);
  });

  it('deduplicates keys between workflow vars and node vars', () => {
    const nodes = [httpNode('n1')];
    const initial = { n1: { shared: 'node' } };
    expect(countWorkflowDesignerVariables({ shared: 'global' }, nodes, initial)).toBe(1);
  });

  it('counts 5 standard slots for graphqlQuery with no extraction rules', () => {
    const nodes = [gqlQueryNode('gql1')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(5);
  });

  it('counts 5 + N slots for graphqlQuery with extraction rules', () => {
    const rules = [{ variableName: 'x', jsonPath: '$.x' }, { variableName: 'y', jsonPath: '$.y' }];
    const nodes = [gqlQueryNode('gql1', rules)];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(7);
  });

  it('counts 5 standard slots for graphqlMutation', () => {
    const nodes = [gqlMutationNode('gql1')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(5);
  });

  it('counts 5 standard slots for graphqlSubscription', () => {
    const nodes = [otherNode('gql1', 'graphqlSubscription')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(5);
  });

  it('counts 5 standard slots for graphqlIntrospect', () => {
    const nodes = [otherNode('gql1', 'graphqlIntrospect')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(5);
  });

  it('counts 0 slots for graphqlAssert (consumer only)', () => {
    const nodes = [otherNode('gql1', 'graphqlAssert')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(0);
  });

  it('deduplicates graphql slot keys across two same-type nodes (different ids)', () => {
    // Each node gets unique sentinel keys based on its id, so two nodes = 10 slots
    const nodes = [gqlQueryNode('gql1'), gqlQueryNode('gql2')];
    expect(countWorkflowDesignerVariables({}, nodes, {})).toBe(10);
  });
});

describe('buildInitialRunnerVariables', () => {
  const makeWf = (variables: Record<string, string>, nodes: unknown[] = []) =>
    ({ variables, nodes } as Parameters<typeof buildInitialRunnerVariables>[0]);

  it('returns configured workflow variables', () => {
    const result = buildInitialRunnerVariables(makeWf({ wsUrl: 'ws://localhost:9876' }));
    expect(result).toEqual({ wsUrl: 'ws://localhost:9876' });
  });

  it('surfaces referenced variables from node data as empty strings', () => {
    const nodes = [{ data: { url: '{{baseUrl}}/path', body: '{"key":"{{token}}"}' } }];
    const result = buildInitialRunnerVariables(makeWf({}, nodes));
    expect(result).toEqual({ baseUrl: '', token: '' });
  });

  it('configured values take precedence over empty defaults from scan', () => {
    const nodes = [{ data: { url: '{{wsUrl}}' } }];
    const result = buildInitialRunnerVariables(makeWf({ wsUrl: 'ws://localhost:9876' }, nodes));
    expect(result).toEqual({ wsUrl: 'ws://localhost:9876' });
  });

  it('merges scan + configured without duplicates', () => {
    const nodes = [{ data: { url: '{{wsUrl}}', topic: '{{topic}}' } }];
    const result = buildInitialRunnerVariables(makeWf({ wsUrl: 'ws://localhost:9876', extra: 'val' }, nodes));
    expect(result).toEqual({ wsUrl: 'ws://localhost:9876', topic: '', extra: 'val' });
  });

  it('skips node-scoped refs and expression refs', () => {
    const nodes = [{ data: { url: '{{node:"Step".output}}', body: '{{$uuid()}}' } }];
    const result = buildInitialRunnerVariables(makeWf({}, nodes));
    expect(result).toEqual({});
  });

  it('returns empty object when workflow has no variables and no refs', () => {
    const result = buildInitialRunnerVariables(makeWf({}));
    expect(result).toEqual({});
  });
});
