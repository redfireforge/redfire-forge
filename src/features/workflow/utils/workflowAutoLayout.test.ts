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

  it('treats webhook trigger nodes like start nodes in layout', () => {
    const nodes: Node[] = [
      { id: 'webhook', type: 'webhook', position: { x: 0, y: 0 }, data: {} },
      { id: 'http', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'webhook', 'http')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const webhookPos = result.find(n => n.id === 'webhook')!.position;
    const httpPos = result.find(n => n.id === 'http')!.position;

    // Webhook should be positioned above the HTTP node
    expect(webhookPos.y).toBeLessThan(httpPos.y);
    // Webhook should have compact dimensions applied
    expect(result.find(n => n.id === 'webhook')?.type).toBe('webhook');
  });

  it('treats schedule trigger nodes like start nodes in layout', () => {
    const nodes: Node[] = [
      { id: 'schedule', type: 'schedule', position: { x: 0, y: 0 }, data: {} },
      { id: 'http', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'schedule', 'http')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const schedulePos = result.find(n => n.id === 'schedule')!.position;
    const httpPos = result.find(n => n.id === 'http')!.position;

    // Schedule should be positioned above the HTTP node
    expect(schedulePos.y).toBeLessThan(httpPos.y);
    // Schedule should have compact dimensions applied
    expect(result.find(n => n.id === 'schedule')?.type).toBe('schedule');
  });

  it('centers webhook trigger above fork node', () => {
    const nodes: Node[] = [
      { id: 'webhook', type: 'webhook', position: { x: 0, y: 0 }, data: {} },
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      { id: 'a', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [
      makeEdge('e1', 'webhook', 'fork'),
      makeEdge('e2', 'fork', 'a'),
      makeEdge('e3', 'fork', 'b'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');

    const webhookPos = result.find(n => n.id === 'webhook')!.position;
    const forkPos = result.find(n => n.id === 'fork')!.position;

    // Webhook should be centered above the fork
    expect(Math.abs(webhookPos.x - forkPos.x)).toBeLessThan(20);
    expect(webhookPos.y).toBeLessThan(forkPos.y);
  });

  it('uses compact dimensions for compact node types', () => {
    // Start, condition, end should all be compact
    const nodes: Node[] = [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'cond', type: 'condition', position: { x: 0, y: 0 }, data: {} },
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'start', 'cond'), makeEdge('e2', 'cond', 'end')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(3);
  });

  it('uses measured dimensions when available', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'http', position: { x: 0, y: 0 }, data: {}, measured: { width: 300, height: 150 } },
      { id: 'b', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'a', 'b')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(2);
  });

  it('increases spacing for switch nodes', () => {
    const nodes: Node[] = [
      { id: 'sw', type: 'switch', position: { x: 0, y: 0 }, data: {} },
      { id: 'c1', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'c2', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'c3', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'sw', target: 'c1', sourceHandle: 'case-c1' },
      { id: 'e2', source: 'sw', target: 'c2', sourceHandle: 'case-c2' },
      { id: 'e3', source: 'sw', target: 'c3', sourceHandle: 'default' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    // All case children should be at similar y (same rank)
    const ys = ['c1', 'c2', 'c3'].map(id => result.find(n => n.id === id)!.position.y);
    expect(Math.abs(ys[0] - ys[1])).toBeLessThan(30);
    expect(Math.abs(ys[1] - ys[2])).toBeLessThan(30);
  });

  it('centers switch branches evenly under switch node', () => {
    const nodes: Node[] = [
      { id: 'sw', type: 'switch', position: { x: 0, y: 0 }, data: {} },
      { id: 'c1', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'c2', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'sw', target: 'c1', sourceHandle: 'case-c1' },
      { id: 'e2', source: 'sw', target: 'c2', sourceHandle: 'case-c2' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const swX = result.find(n => n.id === 'sw')!.position.x;
    const c1X = result.find(n => n.id === 'c1')!.position.x;
    const c2X = result.find(n => n.id === 'c2')!.position.x;
    // Switch should be roughly centered between cases
    const mid = (c1X + c2X) / 2;
    expect(Math.abs(swX - mid)).toBeLessThan(80);
  });

  it('handles errorHandler node with body/catch/done branches', () => {
    const nodes: Node[] = [
      { id: 'eh', type: 'errorHandler', position: { x: 0, y: 0 }, data: {} },
      { id: 'body', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'catch', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'done', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'eh', target: 'body', sourceHandle: 'body' },
      { id: 'e2', source: 'eh', target: 'catch', sourceHandle: 'catch' },
      { id: 'e3', source: 'eh', target: 'done', sourceHandle: 'done' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(4);
    // Body should be leftmost, done rightmost
    const bodyX = result.find(n => n.id === 'body')!.position.x;
    const doneX = result.find(n => n.id === 'done')!.position.x;
    expect(bodyX).toBeLessThan(doneX);
  });

  it('handles loop node with body/done handles', () => {
    const nodes: Node[] = [
      { id: 'loop', type: 'loop', position: { x: 0, y: 0 }, data: {} },
      { id: 'body', type: 'http', position: { x: 0, y: 0 }, data: {} },
      { id: 'done', type: 'http', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'loop', target: 'body', sourceHandle: 'body' },
      { id: 'e2', source: 'loop', target: 'done', sourceHandle: 'done' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(3);
    // Body (left) should be to the left of done (right)
    const bodyX = result.find(n => n.id === 'body')!.position.x;
    const doneX = result.find(n => n.id === 'done')!.position.x;
    expect(bodyX).toBeLessThan(doneX);
  });

  it('adjusts spacing for larger graphs (>15 nodes)', () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push(makeNode(`n${i}`));
      if (i > 0) edges.push(makeEdge(`e${i}`, `n${i - 1}`, `n${i}`));
    }
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(20);
    // Should all have valid positions
    for (const n of result) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('adjusts spacing for medium graphs (6-15 nodes)', () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push(makeNode(`n${i}`));
      if (i > 0) edges.push(makeEdge(`e${i}`, `n${i - 1}`, `n${i}`));
    }
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(10);
  });

  it('aligns linear chain nodes under their parent', () => {
    // start -> fork -> a -> b (linear chain after fork)
    //               -> c
    // join
    const nodes: Node[] = [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'), makeNode('b'), makeNode('c'),
      { id: 'join', type: 'join', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [
      makeEdge('e0', 'start', 'fork'),
      makeEdge('e1', 'fork', 'a'),
      makeEdge('e2', 'a', 'b'),
      makeEdge('e3', 'fork', 'c'),
      makeEdge('e4', 'b', 'join'),
      makeEdge('e5', 'c', 'join'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(6);
  });

  it('centers end node under single parent', () => {
    const nodes: Node[] = [
      makeNode('a'),
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'a', 'end')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const aX = result.find(n => n.id === 'a')!.position.x;
    const endX = result.find(n => n.id === 'end')!.position.x;
    // End should be roughly centered under its parent
    expect(Math.abs(aX - endX)).toBeLessThan(80);
  });

  it('centers end node under multiple parents', () => {
    const nodes: Node[] = [
      makeNode('a'), makeNode('b'),
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} },
      makeNode('root'),
    ];
    const edges = [
      makeEdge('e0', 'root', 'a'),
      makeEdge('e1', 'root', 'b'),
      makeEdge('e2', 'a', 'end'),
      makeEdge('e3', 'b', 'end'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const aX = result.find(n => n.id === 'a')!.position.x;
    const bX = result.find(n => n.id === 'b')!.position.x;
    const endX = result.find(n => n.id === 'end')!.position.x;
    const midAB = (aX + bX) / 2;
    expect(Math.abs(endX - midAB)).toBeLessThan(80);
  });

  it('normalizes negative positions to positive coordinates', () => {
    // With enough centering, nodes may end up in negative territory
    const nodes: Node[] = [
      { id: 'cond', type: 'condition', position: { x: 0, y: 0 }, data: {} },
      makeNode('yes'), makeNode('no'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    for (const n of result) {
      expect(n.position.x).toBeGreaterThanOrEqual(0);
      expect(n.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles fork/join with asymmetric branch depths', () => {
    // fork -> a -> a2 -> join
    // fork -> b -> join
    const nodes: Node[] = [
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'), makeNode('a2'), makeNode('b'),
      { id: 'join', type: 'join', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [
      makeEdge('e1', 'fork', 'a'),
      makeEdge('e2', 'a', 'a2'),
      makeEdge('e3', 'fork', 'b'),
      makeEdge('e4', 'a2', 'join'),
      makeEdge('e5', 'b', 'join'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const forkY = result.find(n => n.id === 'fork')!.position.y;
    const joinY = result.find(n => n.id === 'join')!.position.y;
    expect(forkY).toBeLessThan(joinY);
  });

  it('handles condition with shared convergence node (end)', () => {
    // cond -> yes -> end
    // cond -> no -> end
    const nodes: Node[] = [
      { id: 'cond', type: 'condition', position: { x: 0, y: 0 }, data: {} },
      makeNode('yes'), makeNode('no'),
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
      { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
      makeEdge('e3', 'yes', 'end'),
      makeEdge('e4', 'no', 'end'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(4);
    // End node should be centered between yes and no branches
    const yesX = result.find(n => n.id === 'yes')!.position.x;
    const noX = result.find(n => n.id === 'no')!.position.x;
    const endX = result.find(n => n.id === 'end')!.position.x;
    const midBranch = (yesX + noX) / 2;
    expect(Math.abs(endX - midBranch)).toBeLessThan(80);
  });

  it('handles waitForCondition node with body/done handles', () => {
    const nodes: Node[] = [
      { id: 'wfc', type: 'waitForCondition', position: { x: 0, y: 0 }, data: {} },
      makeNode('body'), makeNode('done'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'wfc', target: 'body', sourceHandle: 'body' },
      { id: 'e2', source: 'wfc', target: 'done', sourceHandle: 'done' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const bodyX = result.find(n => n.id === 'body')!.position.x;
    const doneX = result.find(n => n.id === 'done')!.position.x;
    expect(bodyX).toBeLessThan(doneX);
  });

  it('handles LR direction with fork/join', () => {
    const nodes: Node[] = [
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'), makeNode('b'),
      { id: 'join', type: 'join', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [
      makeEdge('e1', 'fork', 'a'),
      makeEdge('e2', 'fork', 'b'),
      makeEdge('e3', 'a', 'join'),
      makeEdge('e4', 'b', 'join'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'LR');
    const forkX = result.find(n => n.id === 'fork')!.position.x;
    const joinX = result.find(n => n.id === 'join')!.position.x;
    expect(forkX).toBeLessThan(joinX);
  });

  it('handles switch with default and numbered cases in correct order', () => {
    const nodes: Node[] = [
      { id: 'sw', type: 'switch', position: { x: 0, y: 0 }, data: {} },
      makeNode('c1'), makeNode('c2'), makeNode('def'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'sw', target: 'c1', sourceHandle: 'case-c1' },
      { id: 'e2', source: 'sw', target: 'c2', sourceHandle: 'case-c2' },
      { id: 'e3', source: 'sw', target: 'def', sourceHandle: 'default' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const c1X = result.find(n => n.id === 'c1')!.position.x;
    const defX = result.find(n => n.id === 'def')!.position.x;
    // Default case should be to the right of numbered cases
    expect(c1X).toBeLessThan(defX);
  });

  it('handles fork with single child (no alignment needed)', () => {
    const nodes: Node[] = [
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'),
    ];
    const edges = [makeEdge('e1', 'fork', 'a')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(2);
  });

  it('handles schedule trigger node feeding into fork', () => {
    const nodes: Node[] = [
      { id: 'schedule', type: 'schedule', position: { x: 0, y: 0 }, data: {} },
      { id: 'fork', type: 'fork', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'), makeNode('b'),
    ];
    const edges = [
      makeEdge('e1', 'schedule', 'fork'),
      makeEdge('e2', 'fork', 'a'),
      makeEdge('e3', 'fork', 'b'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    const schedulePos = result.find(n => n.id === 'schedule')!.position;
    const forkPos = result.find(n => n.id === 'fork')!.position;
    expect(Math.abs(schedulePos.x - forkPos.x)).toBeLessThan(20);
  });

  it('handles switch with convergence node (shared by multiple cases)', () => {
    const nodes: Node[] = [
      { id: 'sw', type: 'switch', position: { x: 0, y: 0 }, data: {} },
      makeNode('c1'), makeNode('c2'),
      makeNode('merge'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'sw', target: 'c1', sourceHandle: 'case-c1' },
      { id: 'e2', source: 'sw', target: 'c2', sourceHandle: 'case-c2' },
      makeEdge('e3', 'c1', 'merge'),
      makeEdge('e4', 'c2', 'merge'),
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(4);
  });

  it('condition with only one outgoing edge (no branch fix)', () => {
    const nodes: Node[] = [
      { id: 'cond', type: 'condition', position: { x: 0, y: 0 }, data: {} },
      makeNode('a'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'cond', target: 'a', sourceHandle: 'true' },
    ];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(2);
  });

  it('handles join with single parent (no centering)', () => {
    const nodes: Node[] = [
      makeNode('a'),
      { id: 'join', type: 'join', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges = [makeEdge('e1', 'a', 'join')];
    const result = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(result).toHaveLength(2);
  });

  it('handles end node with no parents', () => {
    const nodes: Node[] = [
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} },
    ];
    const result = getAutoLayoutNodes(nodes, [], 'TB');
    expect(result).toHaveLength(1);
  });
});
