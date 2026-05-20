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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const yes1 = result.find(n => n.id === 'yes1')!;
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

  describe('switch handleOrder / branch sorting', () => {
    it('skips condition branch centering when both targets collapse past join stops (no drawable bounds)', () => {
      const nodes = [
        makeNode('cond', 'condition'),
        makeNode('join', 'join'),
      ];
      const edges: Edge[] = [
        makeEdge('e1', 'cond', 'join', 'true'),
        makeEdge('e2', 'cond', 'join', 'false'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(2);
    });

    it('skips fork centering when fewer than two drawable nodes exist between fork and join', () => {
      const nodes = [
        makeNode('fork', 'fork'),
        makeNode('a', 'http'),
        makeNode('join', 'join'),
      ];
      const edges = [
        makeEdge('e1', 'fork', 'join'),
        makeEdge('e2', 'fork', 'a'),
        makeEdge('e3', 'a', 'join'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(3);
    });

    it('uses fallback rank 500 for handles that are not case-N, default, or errorHandler labels', () => {
      const nodes = [
        makeNode('sw', 'switch'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges: Edge[] = [
        makeEdge('e1', 'sw', 'a', 'zebra'),
        makeEdge('e2', 'sw', 'b', 'case-12'),
        makeEdge('e3', 'sw', 'c', 'mystery'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');

      const ordered = ['a', 'b', 'c'].sort(
        (i, j) => result.find(n => n.id === i)!.position.x - result.find(n => n.id === j)!.position.x,
      );
      const bRank = ordered.indexOf('b');
      expect(bRank).toBeLessThan(ordered.indexOf('a'));
      expect(bRank).toBeLessThan(ordered.indexOf('c'));
    });

    it('treats case handles without a trailing digit as fallback rank 500', () => {
      const nodes = [
        makeNode('sw', 'switch'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
      ];
      const edges: Edge[] = [
        makeEdge('e1', 'sw', 'a', 'case-no-digits-here'),
        makeEdge('e2', 'sw', 'b', 'case-3'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result.find(n => n.id === 'b')!.position.x).toBeLessThan(result.find(n => n.id === 'a')!.position.x);
    });

    it('skips case spread when only one switch branch has a finite subtree (others converge at target)', () => {
      const nodes = [makeNode('sw', 'switch'), makeNode('a', 'http'), makeNode('b', 'http')];
      const edges: Edge[] = [
        makeEdge('e1', 'sw', 'a'),
        makeEdge('e2', 'sw', 'b'),
        makeEdge('e3', 'a', 'b'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
    });

    it('does not run case layout when switch has fewer than two outgoing edges', () => {
      const nodes = [makeNode('sw', 'switch'), makeNode('a', 'http')];
      const edges = [makeEdge('e1', 'sw', 'a')];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result).toHaveLength(2);
    });

    it('sorts null/undefined sourceHandles between case order and default', () => {
      const nodes = [
        makeNode('sw', 'switch'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'sw', target: 'a', sourceHandle: 'default' },
        { id: 'e2', source: 'sw', target: 'b' },
        { id: 'e3', source: 'sw', target: 'c', sourceHandle: 'case-0' },
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      const byX = ['a', 'b', 'c']
        .map(id => ({ id, x: result.find(n => n.id === id)!.position.x }))
        .sort((p, q) => p.x - q.x);
      expect(byX.map(p => p.id)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('Edge cases', () => {
    it('stops linear chain propagation when an intermediate node fans out to multiple children', () => {
      const nodes = [
        makeNode('start', 'start'),
        makeNode('a', 'http'),
        makeNode('b', 'http'),
        makeNode('c', 'http'),
      ];
      const edges = [
        makeEdge('e1', 'start', 'a'),
        makeEdge('e2', 'a', 'b'),
        makeEdge('e3', 'a', 'c'),
      ];
      const result = getAutoLayoutNodes(nodes, edges, 'TB');
      expect(result.every(n => Number.isFinite(n.position.x))).toBe(true);
    });

    it('treats nodes without a type as full-size (non-compact) for layout dimensions', () => {
      const nodes = [{ id: 'odd', position: { x: 0, y: 0 }, data: {} } as Node];
      const r = getAutoLayoutNodes(nodes, [], 'TB');
      expect(r).toHaveLength(1);
      expect(Number.isFinite(r[0].position.x)).toBe(true);
    });

    it('handles join node with no incoming edges', () => {
      const result = getAutoLayoutNodes([makeNode('j', 'join')], [], 'TB');
      expect(result).toHaveLength(1);
    });

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
});
