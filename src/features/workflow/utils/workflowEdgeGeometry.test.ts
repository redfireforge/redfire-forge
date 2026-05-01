import { describe, it, expect } from 'vitest';
import { pointToSegmentDistance, findClosestEdge } from './workflowEdgeGeometry';

// ─── pointToSegmentDistance ──────────────────────────────────────────────────

describe('pointToSegmentDistance', () => {
  it('returns 0 when point is on the segment', () => {
    // Midpoint of (0,0)→(10,0) at y=0
    expect(pointToSegmentDistance(5, 0, 0, 0, 10, 0)).toBeCloseTo(0);
  });

  it('returns perpendicular distance to a horizontal segment', () => {
    expect(pointToSegmentDistance(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it('returns perpendicular distance to a vertical segment', () => {
    expect(pointToSegmentDistance(4, 5, 0, 0, 0, 10)).toBeCloseTo(4);
  });

  it('returns distance to segment start when projection is before the segment', () => {
    // Point (-3,0), segment (0,0)→(10,0): closest point is (0,0), distance = 3
    expect(pointToSegmentDistance(-3, 0, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it('returns distance to segment end when projection is beyond the segment', () => {
    // Point (13,4), segment (0,0)→(10,0): closest point is (10,0), distance = 5
    expect(pointToSegmentDistance(13, 4, 0, 0, 10, 0)).toBeCloseTo(5);
  });

  it('returns Infinity for zero-length segments', () => {
    expect(pointToSegmentDistance(5, 5, 3, 3, 3, 3)).toBe(Infinity);
  });

  it('handles diagonal segments correctly', () => {
    // Segment (0,0)→(10,10), point (0,10): perpendicular distance = 5√2 ≈ 7.07
    const d = pointToSegmentDistance(0, 10, 0, 0, 10, 10);
    expect(d).toBeCloseTo(Math.SQRT2 * 5, 5);
  });

  it('returns 0 when point is at segment start', () => {
    expect(pointToSegmentDistance(0, 0, 0, 0, 10, 10)).toBeCloseTo(0);
  });

  it('returns 0 when point is at segment end', () => {
    expect(pointToSegmentDistance(10, 10, 0, 0, 10, 10)).toBeCloseTo(0);
  });
});

// ─── findClosestEdge ─────────────────────────────────────────────────────────

describe('findClosestEdge', () => {
  const nodes = [
    { id: 'n1', position: { x: 0, y: 0 }, width: 160, height: 60 },
    { id: 'n2', position: { x: 0, y: 200 }, width: 160, height: 60 },
    { id: 'n3', position: { x: 300, y: 200 }, width: 160, height: 60 },
  ];

  const edges = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n1', target: 'n3' },
  ];

  it('returns the closest edge when within threshold', () => {
    // Point near the n1→n2 edge (center-x=80, between y=60 and y=200)
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, edges);
    expect(result?.id).toBe('e1');
  });

  it('returns null when no edges are within threshold', () => {
    const result = findClosestEdge({ x: 9999, y: 9999 }, nodes, edges);
    expect(result).toBeNull();
  });

  it('respects custom threshold', () => {
    // Far from edges but within a huge threshold
    const result = findClosestEdge({ x: 9999, y: 9999 }, nodes, edges, 100000);
    expect(result).not.toBeNull();
  });

  it('returns null when threshold is 0 and point is not exactly on edge', () => {
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, edges, 0);
    expect(result).toBeNull();
  });

  it('returns null for empty edge list', () => {
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, []);
    expect(result).toBeNull();
  });

  it('returns null for empty node list', () => {
    const result = findClosestEdge({ x: 80, y: 130 }, [], edges);
    expect(result).toBeNull();
  });

  it('skips edges with branch source handles', () => {
    const branchEdges = [
      { id: 'e-true', source: 'n1', target: 'n2', sourceHandle: 'true' },
      { id: 'e-false', source: 'n1', target: 'n3', sourceHandle: 'false' },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, branchEdges);
    expect(result).toBeNull();
  });

  it('skips edges with body handle', () => {
    const bodyEdges = [
      { id: 'e-body', source: 'n1', target: 'n2', sourceHandle: 'body' },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, bodyEdges);
    expect(result).toBeNull();
  });

  it('skips edges with case- prefixed handles', () => {
    const caseEdges = [
      { id: 'e-case', source: 'n1', target: 'n2', sourceHandle: 'case-0' },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, caseEdges);
    expect(result).toBeNull();
  });

  it('allows edges with non-branch handles', () => {
    const normalEdges = [
      { id: 'e-ok', source: 'n1', target: 'n2', sourceHandle: 'output' },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, normalEdges);
    expect(result?.id).toBe('e-ok');
  });

  it('uses measured dimensions when available', () => {
    const measuredNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
      { id: 'n2', position: { x: 0, y: 200 }, measured: { width: 200, height: 80 } },
    ];
    const result = findClosestEdge({ x: 100, y: 140 }, measuredNodes, [{ id: 'e1', source: 'n1', target: 'n2' }]);
    expect(result?.id).toBe('e1');
  });

  it('uses default dimensions (160x60) when no size info', () => {
    const bareNodes = [
      { id: 'n1', position: { x: 0, y: 0 } },
      { id: 'n2', position: { x: 0, y: 200 } },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, bareNodes, [{ id: 'e1', source: 'n1', target: 'n2' }]);
    expect(result?.id).toBe('e1');
  });

  it('returns closest among multiple candidates', () => {
    const tightNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, width: 100, height: 40 },
      { id: 'n2', position: { x: 0, y: 100 }, width: 100, height: 40 },
      { id: 'n3', position: { x: 200, y: 100 }, width: 100, height: 40 },
    ];
    const twoEdges = [
      { id: 'e-close', source: 'n1', target: 'n2' },
      { id: 'e-far', source: 'n1', target: 'n3' },
    ];
    // Point near the n1→n2 edge
    const result = findClosestEdge({ x: 50, y: 70 }, tightNodes, twoEdges);
    expect(result?.id).toBe('e-close');
  });

  it('skips edges where source or target node is missing', () => {
    const partialEdges = [
      { id: 'e-missing', source: 'n1', target: 'n-missing' },
    ];
    const result = findClosestEdge({ x: 80, y: 130 }, nodes, partialEdges);
    expect(result).toBeNull();
  });
});
