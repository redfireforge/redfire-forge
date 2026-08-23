import { describe, it, expect } from 'vitest';
import { getAutoLayoutNodes } from './workflowAutoLayout';
import { makeWorkflowNode, makeWorkflowEdge } from '@test-utils/factories';

describe('workflowAutoLayout — coverage gaps', () => {
  it('layout single-child fork without rank shift errors', () => {
    const start = makeWorkflowNode({ id: 'start', type: 'start', position: { x: 0, y: 0 } });
    const http = makeWorkflowNode({ id: 'http', type: 'http', position: { x: 0, y: 100 } });
    const join = makeWorkflowNode({ id: 'join', type: 'join', position: { x: 0, y: 200 } });
    const nodes = [start, http, join];
    const edges = [
      makeWorkflowEdge({ source: 'start', target: 'http' }),
      makeWorkflowEdge({ source: 'http', target: 'join' }),
    ];
    const laid = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(laid.find((n) => n.id === 'http')?.position.y).toBeDefined();
  });

  it('layout parallel fork with two branches', () => {
    const start = makeWorkflowNode({ id: 'start', type: 'start', position: { x: 0, y: 0 } });
    const a = makeWorkflowNode({ id: 'a', type: 'http', position: { x: -100, y: 100 } });
    const b = makeWorkflowNode({ id: 'b', type: 'http', position: { x: 100, y: 100 } });
    const join = makeWorkflowNode({ id: 'join', type: 'join', position: { x: 0, y: 200 } });
    const nodes = [start, a, b, join];
    const edges = [
      makeWorkflowEdge({ source: 'start', target: 'a' }),
      makeWorkflowEdge({ source: 'start', target: 'b' }),
      makeWorkflowEdge({ source: 'a', target: 'join' }),
      makeWorkflowEdge({ source: 'b', target: 'join' }),
    ];
    const laid = getAutoLayoutNodes(nodes, edges, 'TB');
    const posA = laid.find((n) => n.id === 'a')?.position;
    const posB = laid.find((n) => n.id === 'b')?.position;
    expect(posA).toBeDefined();
    expect(posB).toBeDefined();
    expect(posA!.x).not.toBe(posB!.x);
  });

  it('layout switch node with multiple case branches in LR direction', () => {
    const start = makeWorkflowNode({ id: 'start', type: 'start', position: { x: 0, y: 0 } });
    const sw = makeWorkflowNode({ id: 'sw', type: 'switch', position: { x: 100, y: 0 } });
    const a = makeWorkflowNode({ id: 'a', type: 'http', position: { x: 200, y: -50 } });
    const b = makeWorkflowNode({ id: 'b', type: 'http', position: { x: 200, y: 50 } });
    const end = makeWorkflowNode({ id: 'end', type: 'end', position: { x: 400, y: 0 } });
    const nodes = [start, sw, a, b, end];
    const edges = [
      makeWorkflowEdge({ source: 'start', target: 'sw' }),
      makeWorkflowEdge({ id: 'e-case-a', source: 'sw', target: 'a', sourceHandle: 'case-a' }),
      makeWorkflowEdge({ id: 'e-case-b', source: 'sw', target: 'b', sourceHandle: 'case-b' }),
      makeWorkflowEdge({ source: 'a', target: 'end' }),
      makeWorkflowEdge({ source: 'b', target: 'end' }),
    ];
    const laid = getAutoLayoutNodes(nodes, edges, 'LR');
    expect(laid.find((n) => n.id === 'a')?.position.x).toBeGreaterThan(sw.position.x);
  });

  it('layout large workflow uses compact spacing tier', () => {
    const nodes = Array.from({ length: 18 }, (_, i) =>
      makeWorkflowNode({ id: `n${i}`, type: 'http', position: { x: 0, y: i * 80 } }),
    );
    const edges = Array.from({ length: 17 }, (_, i) =>
      makeWorkflowEdge({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` }),
    );
    const laid = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(laid).toHaveLength(18);
    expect(laid[1]?.position.y).toBeGreaterThan(laid[0]?.position.y ?? 0);
  });

  it('layout fork/join parallel graph in TB direction', () => {
    const start = makeWorkflowNode({ id: 'start', type: 'start', position: { x: 0, y: 0 } });
    const fork = makeWorkflowNode({ id: 'fork', type: 'fork', position: { x: 0, y: 50 } });
    const a = makeWorkflowNode({ id: 'a', type: 'http', position: { x: -50, y: 100 } });
    const b = makeWorkflowNode({ id: 'b', type: 'http', position: { x: 50, y: 100 } });
    const join = makeWorkflowNode({ id: 'join', type: 'join', position: { x: 0, y: 150 } });
    const nodes = [start, fork, a, b, join];
    const edges = [
      makeWorkflowEdge({ source: 'start', target: 'fork' }),
      makeWorkflowEdge({ source: 'fork', target: 'a' }),
      makeWorkflowEdge({ source: 'fork', target: 'b' }),
      makeWorkflowEdge({ source: 'a', target: 'join' }),
      makeWorkflowEdge({ source: 'b', target: 'join' }),
    ];
    const laid = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(laid.find((n) => n.id === 'fork')).toBeDefined();
  });

  it('ignores dangling edges when laying out', () => {
    const a = makeWorkflowNode({ id: 'a', type: 'http', position: { x: 0, y: 0 } });
    const laid = getAutoLayoutNodes([a], [{ id: 'e', source: 'a', target: 'ghost' }], 'TB');
    expect(laid).toHaveLength(1);
  });

  it('alignForkChildren skips when fewer than two fork children have positions', () => {
    const start = makeWorkflowNode({ id: 'start', type: 'start', position: { x: 0, y: 0 } });
    const fork = makeWorkflowNode({ id: 'fork', type: 'fork', position: { x: 0, y: 50 } });
    const a = makeWorkflowNode({ id: 'a', type: 'http', position: { x: -50, y: 100 } });
    const join = makeWorkflowNode({ id: 'join', type: 'join', position: { x: 0, y: 150 } });
    const nodes = [start, fork, a, join];
    const edges = [
      makeWorkflowEdge({ source: 'start', target: 'fork' }),
      makeWorkflowEdge({ source: 'fork', target: 'a' }),
      makeWorkflowEdge({ source: 'fork', target: 'missing-child' }),
      makeWorkflowEdge({ source: 'a', target: 'join' }),
    ];
    const laid = getAutoLayoutNodes(nodes, edges, 'TB');
    expect(laid.find((n) => n.id === 'fork')).toBeDefined();
  });
});
