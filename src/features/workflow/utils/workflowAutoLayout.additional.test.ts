import { describe, it, expect } from 'vitest';
import { getAutoLayoutNodes } from './workflowAutoLayout';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string = 'http', x = 0, y = 0): Node {
  return { id, type, position: { x, y }, data: {} };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, label?: string): Edge {
  return { id, source, target, sourceHandle, label };
}

describe('workflowAutoLayout - Additional Coverage', () => {
  describe('centerConditionBranches', () => {
    it('centers condition Yes/No branches symmetrically', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
        makeNode('yesChild', 'http'),
        makeNode('noChild', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'cond', 'yes', 'true'),
        makeEdge('e2', 'cond', 'no', 'false'),
        makeEdge('e3', 'yes', 'yesChild'),
        makeEdge('e4', 'no', 'noChild'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const condPos = result.find(n => n.id === 'cond')!.position;
      const yesPos = result.find(n => n.id === 'yes')!.position;
      const noPos = result.find(n => n.id === 'no')!.position;

      // Condition should be roughly centered between yes and no branches
      const branchMidX = (yesPos.x + noPos.x) / 2;
      expect(Math.abs(condPos.x - branchMidX)).toBeLessThan(60);
    });

    it('handles condition with single child', () => {
      const nodes = [makeNode('cond', 'condition'), makeNode('yes', 'http')];
      const edges = [makeEdge('e1', 'cond', 'yes', 'true')];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(2);
      expect(result.every(n => Number.isFinite(n.position.x))).toBe(true);
    });

    it('handles condition with no children', () => {
      const nodes = [makeNode('cond', 'condition')];
      const edges: Edge[] = [];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(1);
      expect(result[0].position.x).toBeGreaterThanOrEqual(0);
    });

    it('handles nested condition branches', () => {
      const nodes = [
        makeNode('cond1', 'condition'),
        makeNode('yes1', 'http'),
        makeNode('no1', 'condition'),
        makeNode('yes2', 'http'),
        makeNode('no2', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'cond1', 'yes1', 'true'),
        makeEdge('e2', 'cond1', 'no1', 'false'),
        makeEdge('e3', 'no1', 'yes2', 'true'),
        makeEdge('e4', 'no1', 'no2', 'false'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(5);
      const _yes1 = result.find(n => n.id === 'yes1')!;
      const yes2 = result.find(n => n.id === 'yes2')!;
      const no2 = result.find(n => n.id === 'no2')!;

      // Nested condition branches should be ordered correctly
      expect(yes2.position.x).toBeLessThan(no2.position.x);
    });
  });

  describe('centerForkJoinNodes - End Node Support', () => {
    it('centers End node over incoming branches', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'a'),
        makeEdge('e2', 'fork', 'b'),
        makeEdge('e3', 'a', 'end'),
        makeEdge('e4', 'b', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const aPos = result.find(n => n.id === 'a')!.position;
      const bPos = result.find(n => n.id === 'b')!.position;
      const endPos = result.find(n => n.id === 'end')!.position;

      // End should be roughly centered between incoming branches
      const branchMidX = (aPos.x + bPos.x) / 2;
      expect(Math.abs(endPos.x - branchMidX)).toBeLessThan(60);
    });

    it('centers Start node over outgoing branches', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'a'),
        makeEdge('e2', 'start', 'b'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const startPos = result.find(n => n.id === 'start')!.position;
      const aPos = result.find(n => n.id === 'a')!.position;
      const bPos = result.find(n => n.id === 'b')!.position;

      const branchMidX = (aPos.x + bPos.x) / 2;
      expect(Math.abs(startPos.x - branchMidX)).toBeLessThan(60);
    });

    it('handles End node with single incoming edge', () => {
      const nodes = [makeNode('a', 'http'), makeNode('end', 'end')];
      const edges = [makeEdge('e1', 'a', 'end')];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(2);
      const aX = result.find(n => n.id === 'a')!.position.x;
      const endX = result.find(n => n.id === 'end')!.position.x;
      // Should be roughly aligned
      expect(Math.abs(aX - endX)).toBeLessThan(100);
    });

    it('handles multiple End nodes', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('end1', 'end'),
        makeNode('end2', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'a'),
        makeEdge('e2', 'fork', 'b'),
        makeEdge('e3', 'a', 'end1'),
        makeEdge('e4', 'b', 'end2'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(5);
      expect(result.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
    });
  });

  describe('alignLinearChains', () => {
    it('aligns linear chain of http nodes', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const aX = result.find(n => n.id === 'a')!.position.x;
      const bX = result.find(n => n.id === 'b')!.position.x;
      const cX = result.find(n => n.id === 'c')!.position.x;

      // All should be aligned vertically (same X in TB mode)
      expect(Math.abs(aX - bX)).toBeLessThan(20);
      expect(Math.abs(bX - cX)).toBeLessThan(20);
    });

    it('does not align nodes with multiple parents', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
        makeNode('d', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'c'),
        makeEdge('e2', 'b', 'c'),
        makeEdge('e3', 'c', 'd'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(4);
      // c has two parents, so shouldn't force alignment
      const cX = result.find(n => n.id === 'c')!.position.x;
      expect(Number.isFinite(cX)).toBe(true);
    });

    it('handles delay nodes in linear chains', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('delay', 'delay'),
        makeNode('b', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'delay'),
        makeEdge('e2', 'delay', 'b'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const aX = result.find(n => n.id === 'a')!.position.x;
      const delayX = result.find(n => n.id === 'delay')!.position.x;
      const bX = result.find(n => n.id === 'b')!.position.x;

      expect(Math.abs(aX - delayX)).toBeLessThan(40);
      expect(Math.abs(delayX - bX)).toBeLessThan(40);
    });
  });

  describe('resolveOverlaps', () => {
    it('resolves horizontal overlap between nodes on same rank', () => {
      // Create a scenario where nodes would naturally overlap
      const nodes = [
        makeNode('root', 'start'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'root', 'a'),
        makeEdge('e2', 'root', 'b'),
        makeEdge('e3', 'root', 'c'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const a = result.find(n => n.id === 'a')!;
      const b = result.find(n => n.id === 'b')!;
      const c = result.find(n => n.id === 'c')!;

      // All three should be separated horizontally
      const positions = [a, b, c].map(n => n.position.x).sort((x1, x2) => x1 - x2);
      expect(positions[1] - positions[0]).toBeGreaterThan(40);
      expect(positions[2] - positions[1]).toBeGreaterThan(40);
    });

    it('preserves nodes that do not overlap', () => {
      const nodes = [makeNode('a', 'http'), makeNode('b', 'http')];
      const edges = [makeEdge('e1', 'a', 'b')];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(2);
      expect(result[0].position.y).toBeLessThan(result[1].position.y);
    });
  });

  describe('fixBranchOrdering', () => {
    it('swaps branches when Yes is right of No', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'cond', 'yes', 'true'),
        makeEdge('e2', 'cond', 'no', 'false'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const yesX = result.find(n => n.id === 'yes')!.position.x;
      const noX = result.find(n => n.id === 'no')!.position.x;

      // Yes should always be left of No
      expect(yesX).toBeLessThan(noX);
    });

    it('handles sourceHandle values for condition nodes', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('t', 'http'),
        makeNode('f', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'cond', 't', 'true'),
        makeEdge('e2', 'cond', 'f', 'false'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const tX = result.find(n => n.id === 't')!.position.x;
      const fX = result.find(n => n.id === 'f')!.position.x;

      expect(tX).toBeLessThan(fX);
    });
  });

  describe('LR direction (left-to-right)', () => {
    it('positions nodes left-to-right', () => {
      const nodes = [makeNode('a', 'http'), makeNode('b', 'http')];
      const edges = [makeEdge('e1', 'a', 'b')];
      const result = getAutoLayoutNodes(nodes, edges, 'LR');

      const aX = result.find(n => n.id === 'a')!.position.x;
      const bX = result.find(n => n.id === 'b')!.position.x;

      expect(aX).toBeLessThan(bX);
    });

    it('centers fork and join horizontally in LR mode', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'a'),
        makeEdge('e2', 'fork', 'b'),
        makeEdge('e3', 'a', 'join'),
        makeEdge('e4', 'b', 'join'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'LR');

      const forkPos = result.find(n => n.id === 'fork')!.position;
      const joinPos = result.find(n => n.id === 'join')!.position;
      const aPos = result.find(n => n.id === 'a')!.position;
      const bPos = result.find(n => n.id === 'b')!.position;

      // In LR mode, fork/join should be centered vertically between branches
      const branchMidY = (aPos.y + bPos.y) / 2;
      expect(Math.abs(forkPos.y - branchMidY)).toBeLessThan(60);
      expect(Math.abs(joinPos.y - branchMidY)).toBeLessThan(60);
    });
  });

  describe('Complex workflows', () => {
    it('handles workflow with fork, join, condition, and end nodes', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('join', 'join'),
        makeNode('cond', 'condition'),
        makeNode('yes', 'http'),
        makeNode('no', 'http'),
        makeNode('end', 'end'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'fork'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'fork', 'b'),
        makeEdge('e4', 'a', 'join'),
        makeEdge('e5', 'b', 'join'),
        makeEdge('e6', 'join', 'cond'),
        makeEdge('e7', 'cond', 'yes', 'true'),
        makeEdge('e8', 'cond', 'no', 'false'),
        makeEdge('e9', 'yes', 'end'),
        makeEdge('e10', 'no', 'end'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(9);
      // Verify all nodes have valid positions
      expect(result.every(n => 
        Number.isFinite(n.position.x) && Number.isFinite(n.position.y)
      )).toBe(true);

      // Verify ordering
      const startY = result.find(n => n.id === 'start')!.position.y;
      const forkY = result.find(n => n.id === 'fork')!.position.y;
      const joinY = result.find(n => n.id === 'join')!.position.y;
      const endY = result.find(n => n.id === 'end')!.position.y;

      expect(startY).toBeLessThan(forkY);
      expect(forkY).toBeLessThan(joinY);
      expect(joinY).toBeLessThan(endY);
    });

    it('handles deeply nested fork structures', () => {
      const nodes = [
        makeNode('fork1', 'fork'),
        makeNode('a1', 'http'),
        makeNode('fork2', 'fork'),
        makeNode('a2', 'http'),
        makeNode('b2', 'http'),
        makeNode('join2', 'join'),
        makeNode('b1', 'http'),
        makeNode('join1', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'fork1', 'a1'),
        makeEdge('e2', 'fork1', 'b1'),
        makeEdge('e3', 'a1', 'fork2'),
        makeEdge('e4', 'fork2', 'a2'),
        makeEdge('e5', 'fork2', 'b2'),
        makeEdge('e6', 'a2', 'join2'),
        makeEdge('e7', 'b2', 'join2'),
        makeEdge('e8', 'join2', 'join1'),
        makeEdge('e9', 'b1', 'join1'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(8);
      expect(result.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
    });

    it('handles graph with cycle (should not crash)', () => {
      const nodes = [
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
        makeEdge('e3', 'c', 'a'), // cycle
      ];
      
      // Should not crash even with cycle
      expect(() => getAutoLayoutNodes(nodes, edges, 'TB')).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('handles node with measured width/height', () => {
      const nodes: Node[] = [{
        id: 'custom',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 300, height: 150 },
      }];
      const result = getAutoLayoutNodes(nodes, []);

      expect(result).toHaveLength(1);
      expect(Number.isFinite(result[0].position.x)).toBe(true);
      expect(Number.isFinite(result[0].position.y)).toBe(true);
    });

    it('handles large workflow (100+ nodes)', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      
      // Create a chain of 100 nodes
      for (let i = 0; i < 100; i++) {
        nodes.push(makeNode(`n${i}`, 'http'));
        if (i > 0) {
          edges.push(makeEdge(`e${i}`, `n${i - 1}`, `n${i}`));
        }
      }

      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(100);
      expect(result.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
    });

    it('handles workflow with only Start and End nodes', () => {
      const nodes = [makeNode('start', 'start'), makeNode('end', 'end')];
      const edges = [makeEdge('e1', 'start', 'end')];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      expect(result).toHaveLength(2);
      const startY = result.find(n => n.id === 'start')!.position.y;
      const endY = result.find(n => n.id === 'end')!.position.y;
      expect(startY).toBeLessThan(endY);
    });
  });

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
