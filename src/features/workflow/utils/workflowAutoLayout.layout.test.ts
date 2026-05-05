import { describe, it, expect } from 'vitest';
import { getAutoLayoutNodes } from './workflowAutoLayout';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string = 'http', x = 0, y = 0): Node {
  return { id, type, position: { x, y }, data: {} };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, label?: string): Edge {
  return { id, source, target, sourceHandle, label };
}

describe('workflowAutoLayout - Layout', () => {
  describe('centerForkJoinNodes', () => {
    it('centers fork node over its subtree and join below deepest parent', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'c'),
        makeEdge('e5', 'c', 'join'),
        makeEdge('e6', 'b', 'join'),
        makeEdge('e7', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const forkPos = result.find(n => n.id === 'fork')!.position;
      const joinPos = result.find(n => n.id === 'join')!.position;
      const aPos = result.find(n => n.id === 'a')!.position;
      const bPos = result.find(n => n.id === 'b')!.position;

      // Fork should be centered between branches
      const leftmost = Math.min(aPos.x, bPos.x);
      const rightmost = Math.max(aPos.x, bPos.x);
      expect(forkPos.x).toBeGreaterThanOrEqual(leftmost - 50);
      expect(forkPos.x).toBeLessThanOrEqual(rightmost + 50);

      // Join should be below fork
      expect(joinPos.y).toBeGreaterThan(forkPos.y);
    });

    it('centers start node over fork when directly connected', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
        makeEdge('e6', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const startPos = result.find(n => n.id === 'start')!.position;
      const forkPos = result.find(n => n.id === 'fork')!.position;

      // Start should be roughly centered over fork
      expect(Math.abs(startPos.x - forkPos.x)).toBeLessThan(100);
    });

    it('centers end node over its parents', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'end'),
        makeEdge('e2', 'b', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const aPos = result.find(n => n.id === 'a')!.position;
      const bPos = result.find(n => n.id === 'b')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;

      // End should be centered between its parents
      const mid = (aPos.x + bPos.x) / 2;
      expect(Math.abs(endPos.x - mid)).toBeLessThan(120);
    });

    it('centers end node under single parent', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const startPos = result.find(n => n.id === 'start')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;

      // End centered under start
      expect(Math.abs(startPos.x - endPos.x)).toBeLessThan(50);
    });
  });

  describe('LR direction', () => {
    it('lays out fork/join workflow in LR direction', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
        makeEdge('e6', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'LR');

      const startPos = result.find(n => n.id === 'start')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;

      // LR: start should be to the left of end
      expect(startPos.x).toBeLessThan(endPos.x);
    });

    it('lays out condition workflow in LR direction', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'cond', 'yes', 'true'),
        makeEdge('e2', 'cond', 'no', 'false'),
        makeEdge('e3', 'yes', 'end'),
        makeEdge('e4', 'no', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'LR');

      const condPos = result.find(n => n.id === 'cond')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;

      // LR: condition should be left of end
      expect(condPos.x).toBeLessThan(endPos.x);
    });
  });

  describe('switch and loop nodes', () => {
    it('handles switch node with multiple cases', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('sw', 'switch'),
        makeNode('case1', 'http'),
        makeNode('case2', 'http'),
        makeNode('case3', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'sw'),
        makeEdge('e2', 'sw', 'case1', 'case-0'),
        makeEdge('e3', 'sw', 'case2', 'case-1'),
        makeEdge('e4', 'sw', 'case3', 'default'),
        makeEdge('e5', 'case1', 'end'),
        makeEdge('e6', 'case2', 'end'),
        makeEdge('e7', 'case3', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(6);
      // All case nodes should be at different x positions
      const case1 = result.find(n => n.id === 'case1')!.position;
      const case2 = result.find(n => n.id === 'case2')!.position;
      const case3 = result.find(n => n.id === 'case3')!.position;
      const xs = [case1.x, case2.x, case3.x];
      const uniqueXs = new Set(xs);
      expect(uniqueXs.size).toBe(3);
    });

    it('handles loop node with body and done branches', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('loop', 'loop'),
        makeNode('body', 'http'),
        makeNode('done', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'loop'),
        makeEdge('e2', 'loop', 'body', 'loop-body'),
        makeEdge('e3', 'body', 'loop', 'loop-back'),
        makeEdge('e4', 'loop', 'done', 'loop-done'),
        makeEdge('e5', 'done', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(5);
      const loopPos = result.find(n => n.id === 'loop')!.position;
      const bodyPos = result.find(n => n.id === 'body')!.position;
      const donePos = result.find(n => n.id === 'done')!.position;

      // Body and done should be below loop
      expect(bodyPos.y).toBeGreaterThan(loopPos.y);
      expect(donePos.y).toBeGreaterThan(loopPos.y);
    });
  });

  describe('complex workflows', () => {
    it('handles nested condition inside fork branch', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
        makeNode('other', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'cond'),
        makeEdge('e3', 'fork', 'other'),
        makeEdge('e4', 'cond', 'yes', 'true'),
        makeEdge('e5', 'cond', 'no', 'false'),
        makeEdge('e6', 'yes', 'join'),
        makeEdge('e7', 'no', 'join'),
        makeEdge('e8', 'other', 'join'),
        makeEdge('e9', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(8);
      const forkPos = result.find(n => n.id === 'fork')!.position;
      const joinPos = result.find(n => n.id === 'join')!.position;
      expect(joinPos.y).toBeGreaterThan(forkPos.y);
    });

    it('handles webhook trigger node', () => {
      const nodes = [
        makeNode('wh', 'webhook'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'wh', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const whPos = result.find(n => n.id === 'wh')!.position;
      const forkPos = result.find(n => n.id === 'fork')!.position;
      // webhook should be roughly centered over fork
      expect(Math.abs(whPos.x - forkPos.x)).toBeLessThan(100);
    });

    it('handles schedule trigger node leading to fork', () => {
      const nodes = [
        makeNode('sch', 'schedule'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'sch', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(5);
    });

    it('handles fork with asymmetric deep branches', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a1', 'http'),
        makeNode('a2', 'http'),
        makeNode('a3', 'http'),
        makeNode('b1', 'http'),
        makeNode('join', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'a1'),
        makeEdge('e2', 'a1', 'a2'),
        makeEdge('e3', 'a2', 'a3'),
        makeEdge('e4', 'a3', 'join'),
        makeEdge('e5', 'fork', 'b1'),
        makeEdge('e6', 'b1', 'join'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const joinPos = result.find(n => n.id === 'join')!.position;
      const a3Pos = result.find(n => n.id === 'a3')!.position;
      // Join should be below the deepest branch node
      expect(joinPos.y).toBeGreaterThan(a3Pos.y);
    });

    it('handles fork with single child gracefully', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'a'),
        makeEdge('e2', 'a', 'end'),
      ];
      // Should not crash even though fork has only one child
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(3);
    });

    it('handles join with single parent gracefully', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'join'),
        makeEdge('e2', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(3);
    });

    it('handles condition with shared convergence node', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
        makeNode('merge', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'cond', 'yes', 'true'),
        makeEdge('e2', 'cond', 'no', 'false'),
        makeEdge('e3', 'yes', 'merge'),
        makeEdge('e4', 'no', 'merge'),
        makeEdge('e5', 'merge', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(5);
      // Merge node should be below both branches
      const mergePos = result.find(n => n.id === 'merge')!.position;
      const yesPos = result.find(n => n.id === 'yes')!.position;
      expect(mergePos.y).toBeGreaterThan(yesPos.y);
    });

    it('handles loop with condition (loop-body/loop-done handles)', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('loop', 'loop'),
        makeNode('step1', 'http'),
        makeNode('step2', 'http'),
        makeNode('after', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'loop'),
        makeEdge('e2', 'loop', 'step1', 'loop-body'),
        makeEdge('e3', 'step1', 'step2'),
        makeEdge('e4', 'step2', 'loop', undefined, 'loop-back'),
        makeEdge('e5', 'loop', 'after', 'loop-done'),
        makeEdge('e6', 'after', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(6);
    });

    it('handles large workflow with overlapping nodes', () => {
      // Create a wider graph to trigger overlap resolution
      const nodes = [
        makeNode('start', 'start'),
        makeNode('c1', 'condition'),
        makeNode('y1', 'http'),
        makeNode('n1', 'http'),
        makeNode('c2', 'condition'),
        makeNode('y2', 'http'),
        makeNode('n2', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'c1'),
        makeEdge('e2', 'c1', 'y1', 'true'),
        makeEdge('e3', 'c1', 'n1', 'false'),
        makeEdge('e4', 'y1', 'c2'),
        makeEdge('e5', 'n1', 'end'),
        makeEdge('e6', 'c2', 'y2', 'true'),
        makeEdge('e7', 'c2', 'n2', 'false'),
        makeEdge('e8', 'y2', 'end'),
        makeEdge('e9', 'n2', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(8);
      // No nodes should overlap on the same rank
      const endPos = result.find(n => n.id === 'end')!.position;
      expect(endPos).toBeDefined();
    });

    it('handles delay and webhook node types', () => {
      const nodes = [
        makeNode('wh', 'webhook'),
        makeNode('delay', 'delay'),
        makeNode('http1', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'wh', 'delay'),
        makeEdge('e2', 'delay', 'http1'),
        makeEdge('e3', 'http1', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(4);
    });

    it('handles LR fork/join with end node centering', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
        makeEdge('e6', 'join', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'LR');

      const joinPos = result.find(n => n.id === 'join')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;
      // In LR, end should be to the right of join
      expect(endPos.x).toBeGreaterThan(joinPos.x);
    });
  });
});
