import { describe, it, expect } from 'vitest';
import { computeNodeStats, identifyBottlenecks, getBottleneckNodeIds } from './bottleneckAnalysis';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';

function makeEvent(nodeId: string, durationMs: number, state: 'pass' | 'fail' = 'pass', nodeType = 'http', nodeLabel?: string): ExecutionEvent {
  return {
    nodeId,
    nodeType: nodeType as any,
    nodeLabel: nodeLabel || `Node ${nodeId}`,
    timestamp: Date.now(),
    state,
    durationMs,
  };
}

function makeIteration(events: ExecutionEvent[], durationMs: number, passed = true): WorkflowIterationTrace {
  return {
    index: 0,
    iterationIndex: 0,
    passed,
    durationMs,
    events,
    finalVariables: {},
    traversedEdges: [],
    nodeResults: {},
  };
}

function makeTrace(iterations: WorkflowIterationTrace[], nodes: Array<{ id: string; type: string; data?: any }>): WorkflowExecutionTrace {
  return {
    iterations,
    traversedEdges: [],
    workflowSnapshot: {
      nodes: nodes.map(n => ({ ...n, position: { x: 0, y: 0 }, data: n.data || { label: `Node ${n.id}` } })),
      edges: [],
    },
    workflowId: 'test-wf',
    workflowName: 'Test Workflow',
    totalIterations: iterations.length,
    totalDurationMs: iterations.reduce((s, i) => s + i.durationMs, 0),
    fullTraceCaptured: true,
  };
}

describe('computeNodeStats', () => {
  it('returns empty array for trace with no events', () => {
    const trace = makeTrace([makeIteration([], 0)], [{ id: 'n1', type: 'http' }]);
    expect(computeNodeStats(trace)).toEqual([]);
  });

  it('computes correct stats for single node', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100)], 100),
        makeIteration([makeEvent('n1', 200)], 200),
        makeIteration([makeEvent('n1', 300)], 300),
      ],
      [{ id: 'n1', type: 'http' }],
    );
    const stats = computeNodeStats(trace);
    expect(stats).toHaveLength(1);
    expect(stats[0].nodeId).toBe('n1');
    expect(stats[0].avgDurationMs).toBe(200);
    expect(stats[0].minDurationMs).toBe(100);
    expect(stats[0].maxDurationMs).toBe(300);
    expect(stats[0].executionCount).toBe(3);
    expect(stats[0].failureCount).toBe(0);
    expect(stats[0].failureRate).toBe(0);
    expect(stats[0].timeSharePct).toBeGreaterThan(0);
  });

  it('tracks failure counts correctly', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100, 'fail')], 100, false),
        makeIteration([makeEvent('n1', 200, 'pass')], 200),
        makeIteration([makeEvent('n1', 300, 'fail')], 300, false),
      ],
      [{ id: 'n1', type: 'http' }],
    );
    const stats = computeNodeStats(trace);
    expect(stats[0].failureCount).toBe(2);
    expect(stats[0].failureRate).toBeCloseTo(2 / 3);
  });

  it('sorts stats by avg duration descending', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 50), makeEvent('n2', 500)], 550),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const stats = computeNodeStats(trace);
    expect(stats[0].nodeId).toBe('n2');
    expect(stats[1].nodeId).toBe('n1');
  });

  it('skips events without durationMs', () => {
    const noTimeEvent: ExecutionEvent = {
      nodeId: 'n1',
      nodeType: 'start',
      nodeLabel: 'Start',
      timestamp: Date.now(),
      state: 'pass',
      durationMs: undefined,
    };
    const trace = makeTrace(
      [makeIteration([noTimeEvent], 0)],
      [{ id: 'n1', type: 'start' }],
    );
    expect(computeNodeStats(trace)).toEqual([]);
  });

  it('excludes unsampled iterations', () => {
    const sampledIter = makeIteration([makeEvent('n1', 100)], 100);
    const unsampledIter: WorkflowIterationTrace = { ...makeIteration([], 0), sampled: false };
    const trace = makeTrace([sampledIter, unsampledIter], [{ id: 'n1', type: 'http' }]);
    const stats = computeNodeStats(trace);
    expect(stats[0].executionCount).toBe(1);
  });

  it('computes standard deviation correctly', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100)], 100),
        makeIteration([makeEvent('n1', 100)], 100),
      ],
      [{ id: 'n1', type: 'http' }],
    );
    const stats = computeNodeStats(trace);
    expect(stats[0].stdDevMs).toBe(0);
    expect(stats[0].cv).toBe(0);
  });

  it('computes CV (coefficient of variation) correctly', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100)], 100),
        makeIteration([makeEvent('n1', 300)], 300),
      ],
      [{ id: 'n1', type: 'http' }],
    );
    const stats = computeNodeStats(trace);
    expect(stats[0].avgDurationMs).toBe(200);
    expect(stats[0].cv).toBeGreaterThan(0);
  });
});

describe('identifyBottlenecks', () => {
  it('returns empty for single-node workflows', () => {
    const trace = makeTrace(
      [makeIteration([makeEvent('n1', 100)], 100)],
      [{ id: 'n1', type: 'http' }],
    );
    expect(identifyBottlenecks(trace)).toEqual([]);
  });

  it('identifies time-dominant bottleneck (>= 40% time share)', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 900), makeEvent('n2', 100)], 1000),
        makeIteration([makeEvent('n1', 900), makeEvent('n2', 100)], 1000),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const dominant = insights.find(i => i.reason === 'time-dominant');
    expect(dominant).toBeDefined();
    expect(dominant!.nodeId).toBe('n1');
    expect(dominant!.severity).toBe('critical');
  });

  it('identifies critical severity for >= 60% time share', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 800), makeEvent('n2', 100)], 900),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const dominant = insights.find(i => i.reason === 'time-dominant');
    expect(dominant).toBeDefined();
    expect(dominant!.severity).toBe('critical');
  });

  it('identifies high-variance bottleneck (CV > 0.5)', () => {
    // 3 nodes, n2 has wild variance but not time-dominant (equal avg ~150)
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 150), makeEvent('n2', 50), makeEvent('n3', 150)], 350),
        makeIteration([makeEvent('n1', 150), makeEvent('n2', 400), makeEvent('n3', 150)], 700),
        makeIteration([makeEvent('n1', 150), makeEvent('n2', 50), makeEvent('n3', 150)], 350),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }, { id: 'n3', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const variance = insights.find(i => i.reason === 'high-variance');
    expect(variance).toBeDefined();
    expect(variance!.nodeId).toBe('n2');
  });

  it('identifies high-failure bottleneck (>= 20% failure rate)', () => {
    // 3 nodes with spread timing so no single one is time-dominant; n3 fails often
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100), makeEvent('n2', 100), makeEvent('n3', 100, 'fail')], 300, false),
        makeIteration([makeEvent('n1', 100), makeEvent('n2', 100), makeEvent('n3', 100, 'pass')], 300),
        makeIteration([makeEvent('n1', 100), makeEvent('n2', 100), makeEvent('n3', 100, 'fail')], 300, false),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }, { id: 'n3', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const failure = insights.find(i => i.reason === 'high-failure');
    expect(failure).toBeDefined();
    expect(failure!.nodeId).toBe('n3');
  });

  it('surfaces all HTTP nodes as info-level insights', () => {
    // 3 HTTP nodes, none time-dominant (each ~33%), all should appear
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 120), makeEvent('n2', 110), makeEvent('n3', 100)], 330),
        makeIteration([makeEvent('n1', 120), makeEvent('n2', 110), makeEvent('n3', 100)], 330),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }, { id: 'n3', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const cpInsights = insights.filter(i => i.reason === 'critical-path');
    expect(cpInsights.length).toBe(3);
    expect(cpInsights.map(i => i.nodeId)).toContain('n1');
    expect(cpInsights.map(i => i.nodeId)).toContain('n2');
    expect(cpInsights.map(i => i.nodeId)).toContain('n3');
  });

  it('skips start/fork/join node types', () => {
    const trace = makeTrace(
      [
        makeIteration([
          makeEvent('n1', 900, 'pass', 'start', 'Start'),
          makeEvent('n2', 100, 'pass', 'http', 'API Call'),
        ], 1000),
      ],
      [{ id: 'n1', type: 'start' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    expect(insights.every(i => i.nodeId !== 'n1')).toBe(true);
  });

  it('sorts insights by severity: critical > warning > info', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 900, 'fail'), makeEvent('n2', 100)], 1000, false),
        makeIteration([makeEvent('n1', 900, 'fail'), makeEvent('n2', 100)], 1000, false),
        makeIteration([makeEvent('n1', 900, 'pass'), makeEvent('n2', 100)], 1000),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    if (insights.length >= 2) {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      for (let i = 1; i < insights.length; i++) {
        expect(severityOrder[insights[i].severity]).toBeGreaterThanOrEqual(severityOrder[insights[i - 1].severity]);
      }
    }
  });

  it('does not duplicate the same node for multiple reasons', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 900, 'fail'), makeEvent('n2', 10)], 910, false),
        makeIteration([makeEvent('n1', 100, 'fail'), makeEvent('n2', 10)], 110, false),
        makeIteration([makeEvent('n1', 900, 'pass'), makeEvent('n2', 10)], 910),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const n1Insights = insights.filter(i => i.nodeId === 'n1');
    expect(n1Insights.length).toBe(1);
  });

  it('includes suggestion text', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 900), makeEvent('n2', 100)], 1000),
        makeIteration([makeEvent('n1', 900), makeEvent('n2', 100)], 1000),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    for (const insight of insights) {
      expect(insight.suggestion.length).toBeGreaterThan(0);
      expect(insight.message.length).toBeGreaterThan(0);
      expect(insight.metric.label.length).toBeGreaterThan(0);
      expect(insight.metric.value.length).toBeGreaterThan(0);
    }
  });

  it('returns warning severity for 40-60% time share', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 500), makeEvent('n2', 300), makeEvent('n3', 200)], 1000),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }, { id: 'n3', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const dominant = insights.find(i => i.reason === 'time-dominant');
    expect(dominant).toBeDefined();
    expect(dominant!.severity).toBe('warning');
  });

  it('flags critical severity for high failure rate >= 50%', () => {
    // 3 nodes, equal timing, n3 fails 100%
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 100), makeEvent('n2', 100), makeEvent('n3', 100, 'fail')], 300, false),
        makeIteration([makeEvent('n1', 100), makeEvent('n2', 100), makeEvent('n3', 100, 'fail')], 300, false),
      ],
      [{ id: 'n1', type: 'http' }, { id: 'n2', type: 'http' }, { id: 'n3', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const failure = insights.find(i => i.reason === 'high-failure');
    expect(failure).toBeDefined();
    expect(failure!.severity).toBe('critical');
  });

  it('provides script-specific suggestion for non-http nodes', () => {
    const trace = makeTrace(
      [
        makeIteration([makeEvent('n1', 900, 'pass', 'script', 'My Script'), makeEvent('n2', 100)], 1000),
        makeIteration([makeEvent('n1', 900, 'pass', 'script', 'My Script'), makeEvent('n2', 100)], 1000),
      ],
      [{ id: 'n1', type: 'script' }, { id: 'n2', type: 'http' }],
    );
    const insights = identifyBottlenecks(trace);
    const dominant = insights.find(i => i.reason === 'time-dominant' && i.nodeId === 'n1');
    expect(dominant).toBeDefined();
    expect(dominant!.suggestion).toContain('script');
  });
});

describe('getBottleneckNodeIds', () => {
  it('returns empty map for no insights', () => {
    expect(getBottleneckNodeIds([]).size).toBe(0);
  });

  it('maps nodeId to first insight', () => {
    const insights = [
      { nodeId: 'n1', nodeLabel: 'A', reason: 'time-dominant' as const, severity: 'critical' as const, message: '', suggestion: '', metric: { label: '', value: '' } },
      { nodeId: 'n2', nodeLabel: 'B', reason: 'high-variance' as const, severity: 'warning' as const, message: '', suggestion: '', metric: { label: '', value: '' } },
    ];
    const map = getBottleneckNodeIds(insights);
    expect(map.size).toBe(2);
    expect(map.get('n1')!.reason).toBe('time-dominant');
    expect(map.get('n2')!.reason).toBe('high-variance');
  });

  it('keeps first insight for duplicate nodeIds', () => {
    const insights = [
      { nodeId: 'n1', nodeLabel: 'A', reason: 'time-dominant' as const, severity: 'critical' as const, message: '', suggestion: '', metric: { label: '', value: '' } },
      { nodeId: 'n1', nodeLabel: 'A', reason: 'high-variance' as const, severity: 'warning' as const, message: '', suggestion: '', metric: { label: '', value: '' } },
    ];
    const map = getBottleneckNodeIds(insights);
    expect(map.size).toBe(1);
    expect(map.get('n1')!.reason).toBe('time-dominant');
  });
});
