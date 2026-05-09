import { describe, it, expect } from 'vitest';
import {
  detectForkJoinTopology,
  computeBranchStats,
  computeBranchBounds,
  buildBranchLabel,
  BRANCH_COLORS,
  BRANCH_BORDER_COLORS,
  BRANCH_LABELS,
  type ForkJoinPair,
} from './forkJoinDetection';

// ── Test helpers ──

function n(id: string, type = 'http') {
  return { id, type };
}

function e(id: string, source: string, target: string) {
  return { id, source, target };
}

// ── detectForkJoinTopology ──

describe('detectForkJoinTopology', () => {
  it('detects a simple fork/join pair', () => {
    const nodes = [
      n('start', 'start'),
      n('fork', 'fork'),
      n('a', 'http'),
      n('b', 'http'),
      n('join', 'join'),
      n('end', 'end'),
    ];
    const edges = [
      e('e1', 'start', 'fork'),
      e('e2', 'fork', 'a'),
      e('e3', 'fork', 'b'),
      e('e4', 'a', 'join'),
      e('e5', 'b', 'join'),
      e('e6', 'join', 'end'),
    ];

    const result = detectForkJoinTopology(nodes, edges);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].forkId).toBe('fork');
    expect(result.pairs[0].joinId).toBe('join');
    expect(result.pairs[0].branches).toHaveLength(2);

    const allBranchNodes = result.pairs[0].branches.flat();
    expect(allBranchNodes).toContain('a');
    expect(allBranchNodes).toContain('b');
    expect(allBranchNodes).not.toContain('fork');
    expect(allBranchNodes).not.toContain('join');
  });

  it('assigns branch indices to nodes', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a1'),
      n('a2'),
      n('b1'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a1'),
      e('e2', 'a1', 'a2'),
      e('e3', 'a2', 'join'),
      e('e4', 'fork', 'b1'),
      e('e5', 'b1', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    const a1 = result.assignments.get('a1');
    const a2 = result.assignments.get('a2');
    const b1 = result.assignments.get('b1');

    expect(a1).toBeDefined();
    expect(a2).toBeDefined();
    expect(b1).toBeDefined();

    expect(a1!.branchIndex).toBe(a2!.branchIndex);
    expect(a1!.branchIndex).not.toBe(b1!.branchIndex);
    expect(a1!.forkId).toBe('fork');
    expect(a1!.joinId).toBe('join');
  });

  it('handles three-branch fork/join', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'), n('b'), n('c'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'fork', 'b'),
      e('e3', 'fork', 'c'),
      e('e4', 'a', 'join'),
      e('e5', 'b', 'join'),
      e('e6', 'c', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].branches).toHaveLength(3);
    expect(new Set(result.pairs[0].branches.flat())).toEqual(new Set(['a', 'b', 'c']));
  });

  it('handles multi-step branches', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a1'), n('a2'), n('a3'),
      n('b1'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a1'),
      e('e2', 'a1', 'a2'),
      e('e3', 'a2', 'a3'),
      e('e4', 'a3', 'join'),
      e('e5', 'fork', 'b1'),
      e('e6', 'b1', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    const longBranch = result.pairs[0].branches.find(b => b.length === 3);
    const shortBranch = result.pairs[0].branches.find(b => b.length === 1);

    expect(longBranch).toEqual(['a1', 'a2', 'a3']);
    expect(shortBranch).toEqual(['b1']);
  });

  it('handles nested fork/join', () => {
    const nodes = [
      n('outer-fork', 'fork'),
      n('a'),
      n('inner-fork', 'fork'),
      n('x'), n('y'),
      n('inner-join', 'join'),
      n('c'),
      n('outer-join', 'join'),
    ];
    const edges = [
      e('e1', 'outer-fork', 'a'),
      e('e2', 'a', 'outer-join'),
      e('e3', 'outer-fork', 'inner-fork'),
      e('e4', 'inner-fork', 'x'),
      e('e5', 'inner-fork', 'y'),
      e('e6', 'x', 'inner-join'),
      e('e7', 'y', 'inner-join'),
      e('e8', 'inner-join', 'c'),
      e('e9', 'c', 'outer-join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);

    expect(result.pairs.length).toBeGreaterThanOrEqual(2);

    const outerPair = result.pairs.find(p => p.forkId === 'outer-fork');
    const innerPair = result.pairs.find(p => p.forkId === 'inner-fork');

    expect(outerPair).toBeDefined();
    expect(innerPair).toBeDefined();
    expect(outerPair!.joinId).toBe('outer-join');
    expect(innerPair!.joinId).toBe('inner-join');
  });

  it('returns empty for graph with no fork nodes', () => {
    const nodes = [n('a'), n('b'), n('c')];
    const edges = [e('e1', 'a', 'b'), e('e2', 'b', 'c')];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result.pairs).toHaveLength(0);
    expect(result.assignments.size).toBe(0);
  });

  it('skips fork with only one outgoing edge', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'a', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result.pairs).toHaveLength(0);
  });

  it('handles fork with no matching join', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'), n('b'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'fork', 'b'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result.pairs).toHaveLength(0);
  });

  it('handles empty graph', () => {
    const result = detectForkJoinTopology([], []);
    expect(result.pairs).toHaveLength(0);
    expect(result.assignments.size).toBe(0);
  });

  it('does not assign fork or join nodes to branches', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'), n('b'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'fork', 'b'),
      e('e3', 'a', 'join'),
      e('e4', 'b', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result.assignments.has('fork')).toBe(false);
    expect(result.assignments.has('join')).toBe(false);
  });

  it('handles the sample parallel workflow topology', () => {
    const nodes = [
      n('sp-start', 'start'),
      n('sp-get-post', 'http'),
      n('sp-fork', 'fork'),
      n('sp-users', 'http'),
      n('sp-comments', 'http'),
      n('sp-join', 'join'),
      n('sp-summary', 'http'),
    ];
    const edges = [
      e('sp-e0', 'sp-start', 'sp-get-post'),
      e('sp-e1', 'sp-get-post', 'sp-fork'),
      e('sp-e2', 'sp-fork', 'sp-users'),
      e('sp-e3', 'sp-fork', 'sp-comments'),
      e('sp-e4', 'sp-users', 'sp-join'),
      e('sp-e5', 'sp-comments', 'sp-join'),
      e('sp-e6', 'sp-join', 'sp-summary'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].forkId).toBe('sp-fork');
    expect(result.pairs[0].joinId).toBe('sp-join');
    expect(result.pairs[0].branches).toHaveLength(2);

    const usersAssignment = result.assignments.get('sp-users');
    const commentsAssignment = result.assignments.get('sp-comments');
    expect(usersAssignment).toBeDefined();
    expect(commentsAssignment).toBeDefined();
    expect(usersAssignment!.branchIndex).not.toBe(commentsAssignment!.branchIndex);
  });

  it('handles edges referencing non-existent nodes', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'fork', 'ghost'),
      e('e3', 'a', 'join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    expect(result).toBeDefined();
  });

  it('handles nested fork inside a branch where nested join has outgoing edges', () => {
    // outer-fork → [a, inner-fork → [x, y] → inner-join → c] → outer-join
    const nodes = [
      n('outer-fork', 'fork'),
      n('a'),
      n('inner-fork', 'fork'),
      n('x'), n('y'),
      n('inner-join', 'join'),
      n('c'),
      n('outer-join', 'join'),
    ];
    const edges = [
      e('e1', 'outer-fork', 'a'),
      e('e2', 'a', 'outer-join'),
      e('e3', 'outer-fork', 'inner-fork'),
      e('e4', 'inner-fork', 'x'),
      e('e5', 'inner-fork', 'y'),
      e('e6', 'x', 'inner-join'),
      e('e7', 'y', 'inner-join'),
      e('e8', 'inner-join', 'c'),
      e('e9', 'c', 'outer-join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    const innerPair = result.pairs.find(p => p.forkId === 'inner-fork');
    expect(innerPair).toBeDefined();
    expect(innerPair!.joinId).toBe('inner-join');

    const outerPair = result.pairs.find(p => p.forkId === 'outer-fork');
    expect(outerPair).toBeDefined();
    expect(outerPair!.joinId).toBe('outer-join');
    // The branch that contains inner-fork should include inner-fork, c
    const branchWithNestedFork = outerPair!.branches.find(b => b.includes('inner-fork'));
    expect(branchWithNestedFork).toBeDefined();
    expect(branchWithNestedFork).toContain('c');
  });

  it('handles nested fork with no matching join (dead end inside nested fork)', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'),
      n('dead-fork', 'fork'),
      n('x'), n('y'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'a', 'join'),
      e('e3', 'fork', 'dead-fork'),
      e('e4', 'dead-fork', 'x'),
      e('e5', 'dead-fork', 'y'),
      // x and y go nowhere — no matching join for dead-fork
    ];

    const result = detectForkJoinTopology(nodes, edges);
    // Should not crash; outer pair might not form since one branch has no join
    expect(result).toBeDefined();
  });

  it('exercises findMatchingJoin with a nested fork inside the BFS', () => {
    // Triple nesting: mid-fork has a branch that goes through deep-fork/deep-join
    // When findMatchingJoin(mid-fork) runs, its BFS encounters deep-fork — hitting lines 162-170
    const nodes = [
      n('outer-fork', 'fork'),
      n('a'),
      n('mid-fork', 'fork'),
      n('deep-fork', 'fork'),
      n('dx'), n('dy'),
      n('deep-join', 'join'),
      n('mb'),
      n('mid-join', 'join'),
      n('after-mid'),
      n('outer-join', 'join'),
    ];
    const edges = [
      e('e1', 'outer-fork', 'a'),
      e('e2', 'a', 'outer-join'),
      e('e3', 'outer-fork', 'mid-fork'),
      e('e4', 'mid-fork', 'deep-fork'),
      e('e5', 'deep-fork', 'dx'),
      e('e6', 'deep-fork', 'dy'),
      e('e7', 'dx', 'deep-join'),
      e('e8', 'dy', 'deep-join'),
      e('e9', 'deep-join', 'mid-join'),
      e('e10', 'mid-fork', 'mb'),
      e('e11', 'mb', 'mid-join'),
      e('e12', 'mid-join', 'after-mid'),
      e('e13', 'after-mid', 'outer-join'),
    ];

    const result = detectForkJoinTopology(nodes, edges);
    // All three fork/join pairs should be detected
    expect(result.pairs.length).toBeGreaterThanOrEqual(3);

    const outerPair = result.pairs.find(p => p.forkId === 'outer-fork');
    const midPair = result.pairs.find(p => p.forkId === 'mid-fork');
    const deepPair = result.pairs.find(p => p.forkId === 'deep-fork');

    expect(outerPair).toBeDefined();
    expect(midPair).toBeDefined();
    expect(deepPair).toBeDefined();

    expect(outerPair!.joinId).toBe('outer-join');
    expect(midPair!.joinId).toBe('mid-join');
    expect(deepPair!.joinId).toBe('deep-join');
  });

  it('handles cycle prevention in branches', () => {
    const nodes = [
      n('fork', 'fork'),
      n('a'),
      n('b'),
      n('join', 'join'),
    ];
    const edges = [
      e('e1', 'fork', 'a'),
      e('e2', 'a', 'b'),
      e('e3', 'b', 'a'), // cycle!
      e('e4', 'fork', 'b'),
      e('e5', 'b', 'join'),
    ];

    // Should not infinite loop
    const result = detectForkJoinTopology(nodes, edges);
    expect(result).toBeDefined();
  });
});

// ── computeBranchStats ──

describe('computeBranchStats', () => {
  const pair: ForkJoinPair = {
    forkId: 'fork',
    joinId: 'join',
    branches: [['a1', 'a2'], ['b1']],
  };

  it('computes average duration per branch', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 100, timestamp: 1000 },
          { nodeId: 'a2', state: 'pass' as const, durationMs: 50, timestamp: 1100 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 200, timestamp: 1000 },
        ],
      },
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 120, timestamp: 2000 },
          { nodeId: 'a2', state: 'pass' as const, durationMs: 30, timestamp: 2120 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 180, timestamp: 2000 },
        ],
      },
    ];

    const stats = computeBranchStats(pair, iterations);
    expect(stats).toHaveLength(2);
    // Branch A: (100+50+120+30)/2 = 150
    expect(stats[0].totalDurationMs).toBe(150);
    // Branch B: (200+180)/2 = 190
    expect(stats[1].totalDurationMs).toBe(190);
  });

  it('identifies the critical path (slowest branch)', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 100, timestamp: 1000 },
          { nodeId: 'a2', state: 'pass' as const, durationMs: 50, timestamp: 1100 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 200, timestamp: 1000 },
        ],
      },
    ];

    const stats = computeBranchStats(pair, iterations);
    const critical = stats.find(s => s.isCriticalPath);
    expect(critical).toBeDefined();
    expect(critical!.branchIndex).toBe(1);
  });

  it('does NOT mark critical path when branches have equal duration', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 50, timestamp: 1000 },
          { nodeId: 'a2', state: 'pass' as const, durationMs: 50, timestamp: 1050 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 100, timestamp: 1000 },
        ],
      },
    ];

    const stats = computeBranchStats(pair, iterations);
    const critical = stats.find(s => s.isCriticalPath);
    expect(critical).toBeUndefined();
  });

  it('does NOT mark critical path when difference is below threshold', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 100, timestamp: 1000 },
          { nodeId: 'a2', state: 'pass' as const, durationMs: 0, timestamp: 1100 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 102, timestamp: 1000 },
        ],
      },
    ];

    // 2ms difference on 100ms base = 2% → below 10% threshold AND below 5ms absolute
    const stats = computeBranchStats(pair, iterations);
    const critical = stats.find(s => s.isCriticalPath);
    expect(critical).toBeUndefined();
  });

  it('computes pass rate per branch', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, durationMs: 100, timestamp: 1000 },
          { nodeId: 'a2', state: 'fail' as const, durationMs: 50, timestamp: 1100 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 200, timestamp: 1000 },
        ],
      },
    ];

    const stats = computeBranchStats(pair, iterations);
    expect(stats[0].passRate).toBe(50); // 1/2 nodes passed
    expect(stats[1].passRate).toBe(100); // 1/1 passed
  });

  it('handles empty iterations', () => {
    const stats = computeBranchStats(pair, []);
    expect(stats[0].totalDurationMs).toBe(0);
    expect(stats[1].totalDurationMs).toBe(0);
    expect(stats[0].passRate).toBe(100);
  });

  it('uses fallback branch labels when no label map provided', () => {
    const stats = computeBranchStats(pair, []);
    expect(stats[0].label).toBe('Branch A');
    expect(stats[1].label).toBe('Branch B');
  });

  it('uses node labels when label map is provided', () => {
    const labelMap = new Map([['a1', 'Get Users'], ['a2', 'Process'], ['b1', 'Get Posts']]);
    const stats = computeBranchStats(pair, [], labelMap);
    expect(stats[0].label).toBe('Get Users → Process');
    expect(stats[1].label).toBe('Get Posts');
  });

  it('tracks node count per branch', () => {
    const stats = computeBranchStats(pair, []);
    expect(stats[0].nodeCount).toBe(2);
    expect(stats[1].nodeCount).toBe(1);
  });

  it('handles events without durationMs', () => {
    const iterations = [
      {
        events: [
          { nodeId: 'a1', state: 'pass' as const, timestamp: 1000 },
          { nodeId: 'a2', state: 'pass' as const, timestamp: 1100 },
          { nodeId: 'b1', state: 'pass' as const, durationMs: 50, timestamp: 1000 },
        ],
      },
    ];

    const stats = computeBranchStats(pair, iterations);
    expect(stats[0].totalDurationMs).toBe(0);
    expect(stats[1].totalDurationMs).toBe(50);
  });
});

// ── computeBranchBounds ──

describe('computeBranchBounds', () => {
  it('computes bounding box for nodes', () => {
    const positions = new Map([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 300, y: 200 }],
    ]);

    const bounds = computeBranchBounds(['a', 'b'], positions, 220, 60, 20);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(80);  // 100 - 20 padding
    expect(bounds!.y).toBe(80);  // 100 - 20 padding
    expect(bounds!.width).toBe(460);  // (300-100) + 220 + 40
    expect(bounds!.height).toBe(200); // (200-100) + 60 + 40
  });

  it('returns null for empty node list', () => {
    const bounds = computeBranchBounds([], new Map());
    expect(bounds).toBeNull();
  });

  it('returns null when no positions found', () => {
    const bounds = computeBranchBounds(['a', 'b'], new Map());
    expect(bounds).toBeNull();
  });

  it('handles single node', () => {
    const positions = new Map([['a', { x: 50, y: 50 }]]);
    const bounds = computeBranchBounds(['a'], positions, 220, 60, 10);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(40);
    expect(bounds!.y).toBe(40);
    expect(bounds!.width).toBe(240);
    expect(bounds!.height).toBe(80);
  });

  it('uses default padding and dimensions', () => {
    const positions = new Map([['a', { x: 0, y: 0 }]]);
    const bounds = computeBranchBounds(['a'], positions);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(-20);
    expect(bounds!.y).toBe(-20);
  });
});

// ── buildBranchLabel ──

describe('buildBranchLabel', () => {
  it('returns fallback when no label map', () => {
    expect(buildBranchLabel(0, ['a', 'b'])).toBe('Branch A');
    expect(buildBranchLabel(1, ['c'])).toBe('Branch B');
  });

  it('returns single node label for one-node branch', () => {
    const map = new Map([['a', 'Get Users']]);
    expect(buildBranchLabel(0, ['a'], map)).toBe('Get Users');
  });

  it('returns "first → last" for two-node branch', () => {
    const map = new Map([['a', 'Get Users'], ['b', 'Process']]);
    expect(buildBranchLabel(0, ['a', 'b'], map)).toBe('Get Users → Process');
  });

  it('returns "first → … → last" for three+ node branch', () => {
    const map = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']]);
    expect(buildBranchLabel(0, ['a', 'b', 'c'], map)).toBe('A → … → C');
  });

  it('returns fallback when labels not found in map', () => {
    const map = new Map<string, string>();
    expect(buildBranchLabel(2, ['x', 'y'], map)).toBe('Branch C');
  });

  it('returns fallback for empty node list', () => {
    const map = new Map([['a', 'A']]);
    expect(buildBranchLabel(0, [], map)).toBe('Branch A');
  });
});

// ── Constants ──

describe('constants', () => {
  it('has 8 branch colors', () => {
    expect(BRANCH_COLORS).toHaveLength(8);
    expect(BRANCH_BORDER_COLORS).toHaveLength(8);
    expect(BRANCH_LABELS).toHaveLength(8);
  });

  it('colors are rgba format', () => {
    for (const c of BRANCH_COLORS) {
      expect(c).toMatch(/^rgba\(/);
    }
    for (const c of BRANCH_BORDER_COLORS) {
      expect(c).toMatch(/^rgba\(/);
    }
  });

  it('labels follow alphabetical pattern', () => {
    expect(BRANCH_LABELS[0]).toBe('Branch A');
    expect(BRANCH_LABELS[7]).toBe('Branch H');
  });
});
