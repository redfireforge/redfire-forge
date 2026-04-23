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
});
