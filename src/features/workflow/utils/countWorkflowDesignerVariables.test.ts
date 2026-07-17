import { describe, it, expect } from 'vitest';
import { countWorkflowDesignerVariables, buildInitialRunnerVariables, collectWorkflowReferencedVariables } from './countWorkflowDesignerVariables';
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

  it('handles HTTP node with empty initial vars object', () => {
    const nodes = [httpNode('n1')];
    expect(countWorkflowDesignerVariables({ a: '1' }, nodes, { n1: {} })).toBe(1);
  });

  it('returns 0 when no variables anywhere', () => {
    expect(countWorkflowDesignerVariables({}, [], {})).toBe(0);
  });

  it('deduplicates keys between workflow vars and node vars', () => {
    const nodes = [httpNode('n1')];
    const initial = { n1: { shared: 'node' } };
    expect(countWorkflowDesignerVariables({ shared: 'global' }, nodes, initial)).toBe(1);
  });

  it('does not inflate count for graphqlQuery nodes (toolbar matches Variables modal)', () => {
    const nodes = [gqlQueryNode('gql1')];
    expect(countWorkflowDesignerVariables({ a: '1', b: '2', c: '3' }, nodes, {})).toBe(3);
  });

  it('does not inflate count for graphqlMutation with extraction rules', () => {
    const rules = [{ variableName: 'createdUserId', jsonPath: '$.id' }];
    const nodes = [gqlMutationNode('gql1', rules), gqlQueryNode('gql2')];
    expect(countWorkflowDesignerVariables({ testName: 'Demo User', createdUserId: '', fetchedUser: '' }, nodes, {})).toBe(3);
  });

  it('does not inflate count for graphqlSubscription or graphqlIntrospect', () => {
    const nodes = [otherNode('gql1', 'graphqlSubscription'), otherNode('gql2', 'graphqlIntrospect')];
    expect(countWorkflowDesignerVariables({ only: 'one' }, nodes, {})).toBe(1);
  });

  it('graphqlAssert nodes do not affect the count', () => {
    const nodes = [otherNode('gql1', 'graphqlAssert')];
    expect(countWorkflowDesignerVariables({ x: '1' }, nodes, {})).toBe(1);
  });

  it('counts multiple keys from HTTP node initial vars', () => {
    const nodes = [httpNode('n1'), otherNode('s1')];
    expect(countWorkflowDesignerVariables({}, nodes, { n1: { token: 'a', secret: 'b' } })).toBe(2);
  });

  it('skips non-HTTP nodes and counts HTTP initial vars in the same scan', () => {
    const nodes = [otherNode('start-node'), httpNode('h1')];
    expect(countWorkflowDesignerVariables({}, nodes, { h1: { scoped: 'v' } })).toBe(1);
  });

  it('handles multiple HTTP nodes where only the second has initial vars', () => {
    const nodes = [httpNode('n1'), httpNode('n2')];
    expect(countWorkflowDesignerVariables({}, nodes, { n2: { late: 'v' } })).toBe(1);
  });
});

describe('collectWorkflowReferencedVariables', () => {
  it('scans nested objects and arrays for template placeholders', () => {
    const nodes = [{
      data: {
        nested: { body: '{{nestedVar}}' },
        items: ['{{arrayVar}}'],
      },
    }];
    const found = collectWorkflowReferencedVariables(nodes as never);
    expect(found.has('nestedVar')).toBe(true);
    expect(found.has('arrayVar')).toBe(true);
  });

  it('skips null object fields while scanning node data', () => {
    const nodes = [{ data: { ignored: null, kept: '{{stillCounted}}' } }];
    const found = collectWorkflowReferencedVariables(nodes as never);
    expect(found.has('stillCounted')).toBe(true);
    expect(found.size).toBe(1);
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
