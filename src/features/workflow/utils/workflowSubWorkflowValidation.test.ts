import { describe, it, expect } from 'vitest';
import { validateSubWorkflowNodes } from './workflowSubWorkflowValidation';
import type { Workflow, WorkflowNode, SubWorkflowNodeData, StartNodeData } from '../types/workflow';

function makeWorkflow(id: string, name: string, nodes: WorkflowNode[] = []): Workflow {
  return {
    id,
    name,
    variables: {},
    nodes,
    edges: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function subNode(id: string, overrides: Partial<SubWorkflowNodeData> = {}): WorkflowNode {
  return {
    id,
    type: 'subWorkflow',
    position: { x: 0, y: 0 },
    data: {
      label: 'Sub-Workflow',
      workflowId: 'child-1',
      inputMappings: [],
      outputMappings: [],
      ...overrides,
    } satisfies SubWorkflowNodeData,
  };
}

function startNode(inputVariables: Record<string, string> = {}): WorkflowNode {
  return {
    id: 'start-1',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start', inputVariables } satisfies StartNodeData,
  };
}

describe('validateSubWorkflowNodes', () => {
  it('returns no issues for a valid sub-workflow reference', () => {
    const parent = makeWorkflow('parent', 'Parent', [subNode('sw1')]);
    const child = makeWorkflow('child-1', 'Child');
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when workflow has no sub-workflow nodes', () => {
    const wf = makeWorkflow('wf-1', 'Workflow');
    const issues = validateSubWorkflowNodes(wf, [wf]);
    expect(issues).toHaveLength(0);
  });

  it('reports error when workflowId is empty', () => {
    const parent = makeWorkflow('parent', 'Parent', [subNode('sw1', { workflowId: '' })]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('No workflow selected');
  });

  it('reports error for dangling reference', () => {
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: 'non-existent', workflowName: 'Ghost' }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('not found');
    expect(issues[0].message).toContain('Ghost');
  });

  it('reports error for direct self-reference', () => {
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: 'parent' }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('references itself');
  });

  it('detects circular dependency (A → B → A)', () => {
    const childSub = subNode('csw1', { workflowId: 'parent' });
    const child = makeWorkflow('child-1', 'Child', [childSub]);
    const parent = makeWorkflow('parent', 'Parent', [subNode('sw1')]);

    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('Circular dependency');
    expect(issues[0].message).toContain('Child');
    expect(issues[0].message).toContain('Parent');
  });

  it('detects circular dependency through transitive chain (A → B → C → A)', () => {
    const c = makeWorkflow('wf-c', 'C', [subNode('csw', { workflowId: 'wf-a' })]);
    const b = makeWorkflow('wf-b', 'B', [subNode('bsw', { workflowId: 'wf-c' })]);
    const a = makeWorkflow('wf-a', 'A', [subNode('asw', { workflowId: 'wf-b' })]);

    const issues = validateSubWorkflowNodes(a, [a, b, c]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('Circular dependency');
  });

  it('warns about unmapped child input variables', () => {
    const child = makeWorkflow('child-1', 'Child', [
      startNode({ userId: '', token: '' }),
    ]);
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', {
        inputMappings: [{ sourceExpression: '{{uid}}', targetVariable: 'userId' }],
      }),
    ]);

    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('token');
    expect(issues[0].message).not.toContain('userId');
  });

  it('no warning when all child input variables are mapped', () => {
    const child = makeWorkflow('child-1', 'Child', [
      startNode({ userId: '', token: '' }),
    ]);
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', {
        inputMappings: [
          { sourceExpression: '{{uid}}', targetVariable: 'userId' },
          { sourceExpression: '{{tok}}', targetVariable: 'token' },
        ],
      }),
    ]);

    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(0);
  });

  it('reports error when maxDepth is less than 1', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { maxDepth: 0 }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('Max depth');
  });

  it('reports error when maxDepth exceeds 100', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { maxDepth: 101 }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('Max depth');
  });

  it('validates multiple sub-workflow nodes independently', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: '' }),
      subNode('sw2', { workflowId: 'child-1' }),
      subNode('sw3', { workflowId: 'missing' }),
    ]);

    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    expect(issues).toHaveLength(2); // sw1 empty, sw3 dangling
    expect(issues.map((i) => i.nodeId)).toEqual(['sw1', 'sw3']);
  });

  it('includes nodeId and nodeLabel in issues', () => {
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: '', label: 'Auth Sub' }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    expect(issues[0].nodeId).toBe('sw1');
    expect(issues[0].nodeLabel).toBe('Auth Sub');
  });

  // ── E5: Dynamic Workflow ID ──

  it('emits warning for dynamic {{expression}} workflowId', () => {
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: '{{targetWf}}' }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('Dynamic workflow ID');
    expect(issues[0].message).toContain('cannot validate until runtime');
  });

  it('skips further checks for dynamic workflowId (no self-ref or cycle errors)', () => {
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', { workflowId: '{{parent}}' }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent]);
    // Only the dynamic warning, no self-reference error
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });

  // ── E6: Multi-Instance forEach ──

  it('errors when multi-instance collection expression is empty', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', {
        workflowId: 'child-1',
        multiInstance: { collection: '', elementVariable: 'item', mode: 'sequential' },
      }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    const miIssue = issues.find(i => i.message.includes('collection expression is empty'));
    expect(miIssue).toBeTruthy();
    expect(miIssue!.severity).toBe('error');
  });

  it('errors when multi-instance element variable is empty', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', {
        workflowId: 'child-1',
        multiInstance: { collection: '{{items}}', elementVariable: '', mode: 'sequential' },
      }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    const miIssue = issues.find(i => i.message.includes('element variable name is empty'));
    expect(miIssue).toBeTruthy();
    expect(miIssue!.severity).toBe('error');
  });

  it('no multi-instance error when properly configured', () => {
    const child = makeWorkflow('child-1', 'Child');
    const parent = makeWorkflow('parent', 'Parent', [
      subNode('sw1', {
        workflowId: 'child-1',
        multiInstance: { collection: '{{items}}', elementVariable: 'item', mode: 'parallel' },
      }),
    ]);
    const issues = validateSubWorkflowNodes(parent, [parent, child]);
    const miIssues = issues.filter(i => i.message.includes('Multi-instance'));
    expect(miIssues).toHaveLength(0);
  });
});
