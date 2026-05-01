/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkflowVariableHints } from './useWorkflowCanvasSync';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';

vi.mock('../utils/workflowNodeFactory', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    enrichNodeData: (n: any, ivMap: any) => {
      const iv = ivMap[n.id];
      if (iv && n.data) return { ...n, data: { ...n.data, initialVariables: iv } };
      return n;
    },
  };
});

vi.mock('../utils/workflowVariableHints', () => ({
  isHttpWorkflowNode: (n: any) => n.type === 'http',
  collectConditionVariableHints: vi.fn(() => [{ key: 'x', source: 'workflow' }]),
  collectWaitForConditionVariableHints: vi.fn(() => [{ key: 'w', source: 'waitFor' }]),
  mergeHttpVariableHintsWithStepInitialVars: vi.fn((base: any[]) => [...base, { key: 'iv', source: 'step' }]),
}));

import { collectConditionVariableHints, collectWaitForConditionVariableHints } from '../utils/workflowVariableHints';

const makeNode = (overrides: Partial<WorkflowRFNode> = {}): WorkflowRFNode => ({
  id: 'n1',
  type: 'http',
  position: { x: 0, y: 0 },
  data: { label: 'Test', initialVariables: {} },
  ...overrides,
} as any);

const defaultOpts = () => ({
  selectedNodeId: null as string | null,
  nodes: [makeNode()] as WorkflowRFNode[],
  edges: [{ id: 'e1', source: 'n0', target: 'n1' }] as WorkflowRFEdge[],
  nodeInitialVars: {} as Record<string, Record<string, string>>,
  workflowVariables: { base: 'http://localhost' },
});

describe('useWorkflowVariableHints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selectedNode is null when no selectedNodeId', () => {
    const { result } = renderHook(() => useWorkflowVariableHints(defaultOpts()));
    expect(result.current.selectedNode).toBeNull();
  });

  it('selectedNode is found when selectedNodeId matches', () => {
    const opts = defaultOpts();
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.selectedNode?.id).toBe('n1');
  });

  it('selectedNode is null when selectedNodeId does not match', () => {
    const opts = defaultOpts();
    opts.selectedNodeId = 'missing';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.selectedNode).toBeNull();
  });

  it('conditionVariableHints is empty when no selectedNode', () => {
    const { result } = renderHook(() => useWorkflowVariableHints(defaultOpts()));
    expect(result.current.conditionVariableHints).toEqual([]);
  });

  it('conditionVariableHints calls collectConditionVariableHints for condition node', () => {
    const opts = defaultOpts();
    opts.nodes = [makeNode({ id: 'n1', type: 'condition' })];
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.conditionVariableHints).toEqual([{ key: 'x', source: 'workflow' }]);
    expect(collectConditionVariableHints).toHaveBeenCalled();
  });

  it('conditionVariableHints calls collectWaitForConditionVariableHints for waitForCondition node', () => {
    const opts = defaultOpts();
    opts.nodes = [makeNode({ id: 'n1', type: 'waitForCondition' })];
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.conditionVariableHints).toEqual([{ key: 'w', source: 'waitFor' }]);
    expect(collectWaitForConditionVariableHints).toHaveBeenCalled();
  });

  it('httpVariableHints is empty when no selectedNodeId', () => {
    const { result } = renderHook(() => useWorkflowVariableHints(defaultOpts()));
    expect(result.current.httpVariableHints).toEqual([]);
  });

  it('httpVariableHints merges step vars for http node', () => {
    const opts = defaultOpts();
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.httpVariableHints).toContainEqual({ key: 'iv', source: 'step' });
  });

  it('httpVariableHints is empty for non-http node', () => {
    const opts = defaultOpts();
    opts.nodes = [makeNode({ id: 'n1', type: 'condition' })];
    opts.selectedNodeId = 'n1';
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.httpVariableHints).toEqual([]);
  });

  it('hintNodes maps all nodes with enrichNodeData', () => {
    const opts = defaultOpts();
    opts.nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.hintNodes).toHaveLength(2);
  });

  it('hintEdges maps edges to plain objects', () => {
    const opts = defaultOpts();
    opts.edges = [
      { id: 'e1', source: 'n0', target: 'n1', sourceHandle: 'out', label: 'yes' } as any,
    ];
    const { result } = renderHook(() => useWorkflowVariableHints(opts));
    expect(result.current.hintEdges[0]).toEqual({
      id: 'e1', source: 'n0', target: 'n1', sourceHandle: 'out', label: 'yes',
    });
  });
});
