import { describe, it, expect } from 'vitest';
import { extractToSubWorkflow } from './workflowExtractSubWorkflow';
import type { WorkflowNode, WorkflowEdge } from '../types/workflow';

function makeNode(id: string, type: string, x = 0, y = 0): WorkflowNode {
  return { id, type, position: { x, y }, data: { label: id } };
}

function makeEdge(id: string, source: string, target: string): WorkflowEdge {
  return { id, source, target };
}

describe('extractToSubWorkflow', () => {
  it('returns null when no extractable nodes selected', () => {
    const nodes = [makeNode('start', 'start'), makeNode('end', 'end')];
    const result = extractToSubWorkflow(['start', 'end'], nodes, [], 'Child');
    expect(result).toBeNull();
  });

  it('returns null for empty selection', () => {
    const result = extractToSubWorkflow([], [], [], 'Child');
    expect(result).toBeNull();
  });

  it('extracts a single HTTP node', () => {
    const nodes = [
      makeNode('start', 'start', 0, 0),
      makeNode('http1', 'http', 100, 100),
      makeNode('end', 'end', 200, 200),
    ];
    const edges = [
      makeEdge('e1', 'start', 'http1'),
      makeEdge('e2', 'http1', 'end'),
    ];

    const result = extractToSubWorkflow(['http1'], nodes, edges, 'API Call');
    expect(result).not.toBeNull();
    expect(result!.childWorkflow.name).toBe('API Call');
    expect(result!.childWorkflow.nodes).toHaveLength(3); // start + http1 + end
    expect(result!.subWorkflowNode.type).toBe('subWorkflow');
    expect(result!.extractedNodeIds.has('http1')).toBe(true);
    expect(result!.extractedNodeIds.has('start')).toBe(false);
    expect(result!.extractedEdgeIds.has('e1')).toBe(true); // incoming
    expect(result!.extractedEdgeIds.has('e2')).toBe(true); // outgoing
  });

  it('extracts multiple connected nodes', () => {
    const nodes = [
      makeNode('start', 'start', 0, 0),
      makeNode('http1', 'http', 100, 100),
      makeNode('http2', 'http', 200, 200),
      makeNode('end', 'end', 300, 300),
    ];
    const edges = [
      makeEdge('e1', 'start', 'http1'),
      makeEdge('e2', 'http1', 'http2'),
      makeEdge('e3', 'http2', 'end'),
    ];

    const result = extractToSubWorkflow(['http1', 'http2'], nodes, edges, 'Flow');
    expect(result).not.toBeNull();
    expect(result!.childWorkflow.nodes).toHaveLength(4); // start + 2 http + end
    expect(result!.extractedNodeIds.size).toBe(2);

    // Internal edge preserved in child
    const childInternalEdge = result!.childWorkflow.edges.find(
      (e) => e.source === 'http1' && e.target === 'http2',
    );
    expect(childInternalEdge).toBeTruthy();
  });

  it('skips start and end nodes', () => {
    const nodes = [
      makeNode('start', 'start'),
      makeNode('http1', 'http', 100, 100),
      makeNode('end', 'end'),
    ];

    const result = extractToSubWorkflow(['start', 'http1', 'end'], nodes, [], 'Test');
    expect(result).not.toBeNull();
    expect(result!.extractedNodeIds.has('start')).toBe(false);
    expect(result!.extractedNodeIds.has('end')).toBe(false);
    expect(result!.extractedNodeIds.has('http1')).toBe(true);
  });

  it('positions sub-workflow node at centroid of extracted nodes', () => {
    const nodes = [
      makeNode('a', 'http', 100, 100),
      makeNode('b', 'http', 200, 300),
    ];

    const result = extractToSubWorkflow(['a', 'b'], nodes, [], 'Test');
    expect(result).not.toBeNull();
    expect(result!.subWorkflowNode.position.x).toBe(150);
    expect(result!.subWorkflowNode.position.y).toBe(200);
  });

  it('child workflow has start and end nodes', () => {
    const nodes = [makeNode('http1', 'http', 100, 100)];
    const result = extractToSubWorkflow(['http1'], nodes, [], 'Test');
    expect(result).not.toBeNull();

    const childTypes = result!.childWorkflow.nodes.map((n) => n.type);
    expect(childTypes).toContain('start');
    expect(childTypes).toContain('end');
  });

  it('child workflow connects start to entry nodes', () => {
    const nodes = [makeNode('http1', 'http', 100, 100)];
    const edges = [makeEdge('e1', 'outside', 'http1')];

    const result = extractToSubWorkflow(['http1'], nodes, edges, 'Test');
    expect(result).not.toBeNull();

    const startNode = result!.childWorkflow.nodes.find((n) => n.type === 'start');
    const startEdge = result!.childWorkflow.edges.find((e) => e.source === startNode!.id);
    expect(startEdge?.target).toBe('http1');
  });

  it('child workflow connects exit nodes to end', () => {
    const nodes = [makeNode('http1', 'http', 100, 100)];
    const edges = [makeEdge('e1', 'http1', 'outside')];

    const result = extractToSubWorkflow(['http1'], nodes, edges, 'Test');
    expect(result).not.toBeNull();

    const endNode = result!.childWorkflow.nodes.find((n) => n.type === 'end');
    const endEdge = result!.childWorkflow.edges.find((e) => e.target === endNode!.id);
    expect(endEdge?.source).toBe('http1');
  });

  it('sub-workflow node references child workflow ID', () => {
    const nodes = [makeNode('http1', 'http', 100, 100)];
    const result = extractToSubWorkflow(['http1'], nodes, [], 'My Flow');
    expect(result).not.toBeNull();

    const data = result!.subWorkflowNode.data as { workflowId: string; workflowName: string };
    expect(data.workflowId).toBe(result!.childWorkflow.id);
    expect(data.workflowName).toBe('My Flow');
  });

  it('returns null when selection references only missing node ids', () => {
    const nodes = [makeNode('http1', 'http')];
    const result = extractToSubWorkflow(['ghost'], nodes, [], 'Child');
    expect(result).toBeNull();
  });

  it('classifies outgoing edges from extracted nodes to external targets', () => {
    const nodes = [
      makeNode('http1', 'http', 0, 0),
      makeNode('http2', 'http', 100, 0),
    ];
    const edges = [
      makeEdge('internal', 'http1', 'http2'),
      makeEdge('out1', 'http2', 'external'),
    ];

    const result = extractToSubWorkflow(['http1', 'http2'], nodes, edges, 'Out');
    expect(result).not.toBeNull();
    expect(result!.extractedEdgeIds.has('out1')).toBe(true);
    expect(result!.extractedEdgeIds.has('internal')).toBe(true);

    const endNode = result!.childWorkflow.nodes.find((n) => n.type === 'end');
    expect(endNode).toBeDefined();
    const exitFromHttp2 = result!.childWorkflow.edges.find(
      (e) => e.source === 'http2' && endNode && e.target === endNode.id,
    );
    expect(exitFromHttp2).toBeDefined();
  });

  it('uses all nodes as entry and exit when internal graph is a directed cycle', () => {
    const nodes = [makeNode('a', 'http', 0, 0), makeNode('b', 'http', 100, 100)];
    const edges = [
      makeEdge('eAB', 'a', 'b'),
      makeEdge('eBA', 'b', 'a'),
    ];

    const result = extractToSubWorkflow(['a', 'b'], nodes, edges, 'Cycle');
    expect(result).not.toBeNull();

    const startNode = result!.childWorkflow.nodes.find((n) => n.type === 'start');
    const endNode = result!.childWorkflow.nodes.find((n) => n.type === 'end');
    expect(startNode).toBeDefined();
    expect(endNode).toBeDefined();

    const fromStart = result!.childWorkflow.edges.filter((e) => e.source === startNode!.id);
    expect(new Set(fromStart.map((e) => e.target))).toEqual(new Set(['a', 'b']));

    const toEnd = result!.childWorkflow.edges.filter((e) => e.target === endNode!.id);
    expect(new Set(toEnd.map((e) => e.source))).toEqual(new Set(['a', 'b']));
  });

  it('ignores dangling edges that do not touch the extracted subgraph', () => {
    const nodes = [makeNode('http1', 'http', 50, 50)];
    const edges = [makeEdge('dangle', 'x', 'y')];

    const result = extractToSubWorkflow(['http1'], nodes, edges, 'Lone');
    expect(result).not.toBeNull();
    expect(result!.extractedEdgeIds.has('dangle')).toBe(false);
  });
});
