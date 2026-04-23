import { describe, it, expect } from 'vitest';
import { getAutoLayoutNodes } from './workflowAutoLayout';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, x = 0, y = 0): Node {
  return { id, type: 'http', position: { x, y }, data: {} };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe('getAutoLayoutNodes', () => {
  it('returns empty array for empty input', () => {
    const result = getAutoLayoutNodes([], []);
    expect(result).toEqual([]);
  });

  it('returns single node with updated position', () => {
    const nodes = [makeNode('a', 50, 50)];
    const result = getAutoLayoutNodes(nodes, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(typeof result[0].position.x).toBe('number');
    expect(typeof result[0].position.y).toBe('number');
  });

  it('does not mutate original nodes', () => {
    const nodes = [makeNode('a', 10, 20), makeNode('b', 30, 40)];
    const edges = [makeEdge('e1', 'a', 'b')];
    const origA = { ...nodes[0].position };
    const origB = { ...nodes[1].position };

    getAutoLayoutNodes(nodes, edges);

    expect(nodes[0].position).toEqual(origA);
    expect(nodes[1].position).toEqual(origB);
  });

  it('positions parent above child in TB direction', () => {
    const nodes = [makeNode('parent'), makeNode('child')];
    const edges = [makeEdge('e1', 'parent', 'child')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const parentY = result.find(n => n.id === 'parent')!.position.y;
    const childY = result.find(n => n.id === 'child')!.position.y;
    expect(parentY).toBeLessThan(childY);
  });

  it('positions parent left of child in LR direction', () => {
    const nodes = [makeNode('parent'), makeNode('child')];
    const edges = [makeEdge('e1', 'parent', 'child')];
    const result = getAutoLayoutNodes(nodes, edges, 'LR');

    const parentX = result.find(n => n.id === 'parent')!.position.x;
    const childX = result.find(n => n.id === 'child')!.position.x;
    expect(parentX).toBeLessThan(childX);
  });

  it('defaults to TB direction when not specified', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];
    const result = getAutoLayoutNodes(nodes, edges);

    const aY = result.find(n => n.id === 'a')!.position.y;
    const bY = result.find(n => n.id === 'b')!.position.y;
    expect(aY).toBeLessThan(bY);
  });

  it('handles a chain of three nodes', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const positions = result.map(n => ({ id: n.id, y: n.position.y }));
    positions.sort((a, b) => a.y - b.y);
    expect(positions[0].id).toBe('a');
    expect(positions[1].id).toBe('b');
    expect(positions[2].id).toBe('c');
  });

  it('handles branching (one parent, two children)', () => {
    const nodes = [makeNode('root'), makeNode('left'), makeNode('right')];
    const edges = [
      makeEdge('e1', 'root', 'left'),
      makeEdge('e2', 'root', 'right'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const rootY = result.find(n => n.id === 'root')!.position.y;
    const leftY = result.find(n => n.id === 'left')!.position.y;
    const rightY = result.find(n => n.id === 'right')!.position.y;

    expect(rootY).toBeLessThan(leftY);
    expect(rootY).toBeLessThan(rightY);
    // Siblings should be at the same rank (same y approximately)
    expect(Math.abs(leftY - rightY)).toBeLessThan(10);
  });

  it('separates sibling nodes horizontally', () => {
    const nodes = [makeNode('root'), makeNode('left'), makeNode('right')];
    const edges = [
      makeEdge('e1', 'root', 'left'),
      makeEdge('e2', 'root', 'right'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const leftX = result.find(n => n.id === 'left')!.position.x;
    const rightX = result.find(n => n.id === 'right')!.position.x;
    expect(leftX).not.toBe(rightX);
  });

  it('preserves node data and type', () => {
    const nodes: Node[] = [{
      id: 'n1',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: 'If/Else', left: '{{x}}', operator: '==', right: '1' },
    }];
    const result = getAutoLayoutNodes(nodes, []);
    expect(result[0].type).toBe('condition');
    expect(result[0].data).toEqual(nodes[0].data);
    expect(result[0].id).toBe('n1');
  });

  it('handles disconnected components', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'c', 'd')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    expect(result).toHaveLength(4);
    // All should have valid numeric positions
    for (const n of result) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('positions true-branch left and false-branch right for condition nodes in TB', () => {
    const nodes = [makeNode('cond'), makeNode('yes'), makeNode('no')];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const yesX = result.find(n => n.id === 'yes')!.position.x;
    const noX = result.find(n => n.id === 'no')!.position.x;
    // Yes (true) should be to the left of No (false)
    expect(yesX).toBeLessThan(noX);
  });

  it('positions true-branch top and false-branch bottom for condition nodes in LR', () => {
    const nodes = [makeNode('cond'), makeNode('yes'), makeNode('no')];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'LR');

    const yesY = result.find(n => n.id === 'yes')!.position.y;
    const noY = result.find(n => n.id === 'no')!.position.y;
    // Yes (true) should be above No (false)
    expect(yesY).toBeLessThan(noY);
  });

  it('swaps entire subtrees when fixing branch ordering', () => {
    // cond -> yes -> yesChild, cond -> no -> noChild
    const nodes = [makeNode('cond'), makeNode('yes'), makeNode('no'), makeNode('yc'), makeNode('nc')];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
      { id: 'e3', source: 'yes', target: 'yc' },
      { id: 'e4', source: 'no', target: 'nc' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const yesX = result.find(n => n.id === 'yes')!.position.x;
    const noX = result.find(n => n.id === 'no')!.position.x;
    const ycX = result.find(n => n.id === 'yc')!.position.x;
    const ncX = result.find(n => n.id === 'nc')!.position.x;

    expect(yesX).toBeLessThan(noX);
    expect(ycX).toBeLessThan(ncX);
  });

  it('does not alter layout when branches have no sourceHandle', () => {
    // Plain edges without sourceHandle should not trigger branch fix
    const nodes = [makeNode('root'), makeNode('a'), makeNode('b')];
    const edges: Edge[] = [
      { id: 'e1', source: 'root', target: 'a' },
      { id: 'e2', source: 'root', target: 'b' },
    ];
    const result1 = getAutoLayoutNodes(nodes, edges, 'TB');
    const result2 = getAutoLayoutNodes(nodes, edges, 'TB');

    // Results should be deterministic (no random swapping)
    expect(result1.find(n => n.id === 'a')!.position.x).toBe(result2.find(n => n.id === 'a')!.position.x);
    expect(result1.find(n => n.id === 'b')!.position.x).toBe(result2.find(n => n.id === 'b')!.position.x);
  });

  it('handles multiple condition nodes in the same graph', () => {
    const nodes = [
      makeNode('c1'), makeNode('c1y'), makeNode('c1n'),
      makeNode('c2'), makeNode('c2y'), makeNode('c2n'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'c1', target: 'c1y', sourceHandle: 'true' },
      { id: 'e2', source: 'c1', target: 'c1n', sourceHandle: 'false' },
      { id: 'e3', source: 'c1y', target: 'c2' },
      { id: 'e4', source: 'c2', target: 'c2y', sourceHandle: 'true' },
      { id: 'e5', source: 'c2', target: 'c2n', sourceHandle: 'false' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    // Both condition nodes should have true-branch left of false-branch
    expect(result.find(n => n.id === 'c1y')!.position.x).toBeLessThan(result.find(n => n.id === 'c1n')!.position.x);
    expect(result.find(n => n.id === 'c2y')!.position.x).toBeLessThan(result.find(n => n.id === 'c2n')!.position.x);
  });

  it('uses label fallback when sourceHandle is not set', () => {
    const nodes = [makeNode('cond'), makeNode('yes'), makeNode('no')];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'no', label: 'No' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const yesX = result.find(n => n.id === 'yes')!.position.x;
    const noX = result.find(n => n.id === 'no')!.position.x;
    expect(yesX).toBeLessThan(noX);
  });

  it('prefers sourceHandle over label when both are present', () => {
    const nodes = [makeNode('cond'), makeNode('yes'), makeNode('no')];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false', label: 'No' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const yesX = result.find(n => n.id === 'yes')!.position.x;
    const noX = result.find(n => n.id === 'no')!.position.x;
    expect(yesX).toBeLessThan(noX);
  });

  it('centers fork and join nodes over their parallel branches', () => {
    const start: Node = { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} };
    const fork: Node = { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} };
    const branchA = makeNode('a');
    const branchB = makeNode('b');
    const join: Node = { id: 'join', type: 'join', position: { x: 0, y: 0 }, data: {} };

    const nodes = [start, fork, branchA, branchB, join];
    const edges = [
      makeEdge('e0', 'start', 'fork'),
      makeEdge('e1', 'fork', 'a'),
      makeEdge('e2', 'fork', 'b'),
      makeEdge('e3', 'a', 'join'),
      makeEdge('e4', 'b', 'join'),
    ];

    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const forkPos = result.find(n => n.id === 'fork')!.position;
    const joinPos = result.find(n => n.id === 'join')!.position;
    const aPos = result.find(n => n.id === 'a')!.position;
    const bPos = result.find(n => n.id === 'b')!.position;

    // Fork and join should be roughly centered between the two branches
    const branchMidX = (aPos.x + bPos.x) / 2;
    expect(Math.abs(forkPos.x - branchMidX)).toBeLessThan(50);
    expect(Math.abs(joinPos.x - branchMidX)).toBeLessThan(50);

    // Branches should be horizontally separated
    expect(Math.abs(aPos.x - bPos.x)).toBeGreaterThan(40);

    // Fork should be above branches, join below
    expect(forkPos.y).toBeLessThan(aPos.y);
    expect(joinPos.y).toBeGreaterThan(aPos.y);
  });
});
