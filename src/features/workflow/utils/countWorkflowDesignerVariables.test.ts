import { describe, it, expect } from 'vitest';
import { countWorkflowDesignerVariables } from './countWorkflowDesignerVariables';
import type { WorkflowRFNode } from './workflowNodeFactory';

function httpNode(id: string): WorkflowRFNode {
  return { id, type: 'http', data: {} as never, position: { x: 0, y: 0 } };
}

function otherNode(id: string, type = 'start'): WorkflowRFNode {
  return { id, type, data: {} as never, position: { x: 0, y: 0 } };
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
});
