import { describe, it, expect } from 'vitest';
import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';
import {
  buildTimelineBars,
  assignLanes,
  generateTicks,
  getTimelineSpan,
  getMaxLane,
  buildAggregateBars,
  calcP95,
  topologicalNodeOrder,
  type TimelineBar,
} from './timelineLayout';

function makeEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'Node 1',
    timestamp: 1000,
    state: 'pass',
    durationMs: 100,
    ...overrides,
  };
}

describe('buildTimelineBars', () => {
  it('returns empty array for no events', () => {
    expect(buildTimelineBars([])).toEqual([]);
  });

  it('normalizes timestamps to start at 0', () => {
    const events: ExecutionEvent[] = [
      makeEvent({ nodeId: 'n1', timestamp: 5000, durationMs: 100 }),
      makeEvent({ nodeId: 'n2', timestamp: 5200, durationMs: 150 }),
    ];
    const bars = buildTimelineBars(events);
    expect(bars[0].startMs).toBe(0);
    expect(bars[1].startMs).toBe(200);
  });

  it('preserves node metadata', () => {
    const events: ExecutionEvent[] = [
      makeEvent({
        nodeId: 'n1',
        nodeLabel: 'Get Users',
        nodeType: 'http',
        state: 'fail',
        details: { statusCode: 500, responseTimeMs: 250 },
      }),
    ];
    const bars = buildTimelineBars(events);
    expect(bars[0].nodeId).toBe('n1');
    expect(bars[0].nodeLabel).toBe('Get Users');
    expect(bars[0].nodeType).toBe('http');
    expect(bars[0].state).toBe('fail');
    expect(bars[0].statusCode).toBe(500);
    expect(bars[0].responseTimeMs).toBe(250);
  });

  it('ensures minimum bar width of 1ms', () => {
    const events: ExecutionEvent[] = [
      makeEvent({ durationMs: 0 }),
      makeEvent({ nodeId: 'n2', durationMs: undefined }),
    ];
    const bars = buildTimelineBars(events);
    expect(bars[0].durationMs).toBe(1);
    expect(bars[1].durationMs).toBe(1);
  });

  it('assigns lanes for parallel events', () => {
    const events: ExecutionEvent[] = [
      makeEvent({ nodeId: 'n1', timestamp: 1000, durationMs: 200 }),
      makeEvent({ nodeId: 'n2', timestamp: 1050, durationMs: 100 }),
      makeEvent({ nodeId: 'n3', timestamp: 1250, durationMs: 50 }),
    ];
    const bars = buildTimelineBars(events);
    expect(bars[0].lane).toBe(0);
    expect(bars[1].lane).toBe(1);
    expect(bars[2].lane).toBe(0);
  });
});

describe('assignLanes', () => {
  it('puts non-overlapping bars in the same lane', () => {
    const bars: TimelineBar[] = [
      { nodeId: 'a', nodeLabel: 'A', nodeType: 'http', state: 'pass', startMs: 0, durationMs: 100, lane: 0 },
      { nodeId: 'b', nodeLabel: 'B', nodeType: 'http', state: 'pass', startMs: 100, durationMs: 50, lane: 0 },
    ];
    assignLanes(bars);
    expect(bars[0].lane).toBe(0);
    expect(bars[1].lane).toBe(0);
  });

  it('stacks overlapping bars into separate lanes', () => {
    const bars: TimelineBar[] = [
      { nodeId: 'a', nodeLabel: 'A', nodeType: 'http', state: 'pass', startMs: 0, durationMs: 200, lane: 0 },
      { nodeId: 'b', nodeLabel: 'B', nodeType: 'http', state: 'pass', startMs: 50, durationMs: 100, lane: 0 },
      { nodeId: 'c', nodeLabel: 'C', nodeType: 'http', state: 'pass', startMs: 75, durationMs: 50, lane: 0 },
    ];
    assignLanes(bars);
    expect(bars[0].lane).toBe(0);
    expect(bars[1].lane).toBe(1);
    expect(bars[2].lane).toBe(2);
  });

  it('reuses lanes when bars end before next starts', () => {
    const bars: TimelineBar[] = [
      { nodeId: 'a', nodeLabel: 'A', nodeType: 'http', state: 'pass', startMs: 0, durationMs: 50, lane: 0 },
      { nodeId: 'b', nodeLabel: 'B', nodeType: 'http', state: 'pass', startMs: 10, durationMs: 50, lane: 0 },
      { nodeId: 'c', nodeLabel: 'C', nodeType: 'http', state: 'pass', startMs: 60, durationMs: 50, lane: 0 },
    ];
    assignLanes(bars);
    expect(bars[2].lane).toBe(0);
  });

  it('handles empty array', () => {
    const bars: TimelineBar[] = [];
    assignLanes(bars);
    expect(bars).toEqual([]);
  });
});

describe('generateTicks', () => {
  it('returns single tick for 0 duration', () => {
    const ticks = generateTicks(0);
    expect(ticks).toEqual([{ positionMs: 0, label: '0ms' }]);
  });

  it('returns single tick for negative duration', () => {
    const ticks = generateTicks(-100);
    expect(ticks).toEqual([{ positionMs: 0, label: '0ms' }]);
  });

  it('generates ms-scale ticks for short durations', () => {
    const ticks = generateTicks(500);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0].positionMs).toBe(0);
    expect(ticks[0].label).toBe('0ms');
    for (const tick of ticks) {
      if (tick.positionMs > 0 && tick.positionMs < 1000) {
        expect(tick.label).toMatch(/^\d+ms$/);
      }
    }
  });

  it('generates second-scale ticks for longer durations', () => {
    const ticks = generateTicks(5000);
    const hasSeconds = ticks.some(t => t.label.endsWith('s'));
    expect(hasSeconds).toBe(true);
  });

  it('always includes the final tick at totalMs', () => {
    const ticks = generateTicks(750);
    const lastTick = ticks[ticks.length - 1];
    expect(lastTick.positionMs).toBe(750);
  });

  it('produces between 2 and 15 ticks', () => {
    for (const dur of [10, 100, 500, 1000, 5000, 30000, 120000]) {
      const ticks = generateTicks(dur);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(15);
    }
  });
});

describe('getTimelineSpan', () => {
  it('returns 0 for empty bars', () => {
    expect(getTimelineSpan([])).toBe(0);
  });

  it('returns max of startMs + durationMs', () => {
    const bars: TimelineBar[] = [
      { nodeId: 'a', nodeLabel: 'A', nodeType: 'http', state: 'pass', startMs: 0, durationMs: 100, lane: 0 },
      { nodeId: 'b', nodeLabel: 'B', nodeType: 'http', state: 'pass', startMs: 50, durationMs: 200, lane: 0 },
    ];
    expect(getTimelineSpan(bars)).toBe(250);
  });
});

describe('getMaxLane', () => {
  it('returns 0 for empty bars', () => {
    expect(getMaxLane([])).toBe(0);
  });

  it('returns correct lane count', () => {
    const bars: TimelineBar[] = [
      { nodeId: 'a', nodeLabel: 'A', nodeType: 'http', state: 'pass', startMs: 0, durationMs: 100, lane: 0 },
      { nodeId: 'b', nodeLabel: 'B', nodeType: 'http', state: 'pass', startMs: 50, durationMs: 100, lane: 1 },
      { nodeId: 'c', nodeLabel: 'C', nodeType: 'http', state: 'pass', startMs: 75, durationMs: 50, lane: 2 },
    ];
    expect(getMaxLane(bars)).toBe(3);
  });
});

describe('buildAggregateBars', () => {
  it('filters out non-sampled iterations', () => {
    const iterations: WorkflowIterationTrace[] = [
      { index: 0, passed: true, durationMs: 100, events: [makeEvent()], finalVariables: {}, traversedEdges: [] },
      { index: 1, passed: true, durationMs: 200, events: [makeEvent({ nodeId: 'n2' })], finalVariables: {}, traversedEdges: [], sampled: false },
    ];
    const result = buildAggregateBars(iterations);
    expect(result.length).toBe(1);
  });

  it('returns one bar array per iteration', () => {
    const iterations: WorkflowIterationTrace[] = [
      { index: 0, passed: true, durationMs: 100, events: [makeEvent()], finalVariables: {}, traversedEdges: [] },
      { index: 1, passed: true, durationMs: 200, events: [makeEvent({ timestamp: 2000 })], finalVariables: {}, traversedEdges: [] },
    ];
    const result = buildAggregateBars(iterations);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(1);
    expect(result[1].length).toBe(1);
  });
});

describe('calcP95', () => {
  it('returns 0 for empty array', () => {
    expect(calcP95([])).toBe(0);
  });

  it('returns the single value for one element', () => {
    expect(calcP95([42])).toBe(42);
  });

  it('returns correct P95 for 20 values', () => {
    const durations = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    const p95 = calcP95(durations);
    expect(p95).toBe(190);
  });

  it('returns max for small arrays', () => {
    expect(calcP95([10, 20, 30])).toBe(30);
  });
});

describe('topologicalNodeOrder', () => {
  it('returns nodes in topological order for a linear chain', () => {
    const nodes = [
      { id: 'c', data: { label: 'C' } },
      { id: 'a', data: { label: 'A' } },
      { id: 'b', data: { label: 'B' } },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    expect(topologicalNodeOrder(nodes, edges)).toEqual(['a', 'b', 'c']);
  });

  it('puts Start node first when it has no incoming edges', () => {
    const nodes = [
      { id: 'fetch', data: { label: 'Fast Fetch' } },
      { id: 'start', type: 'start', data: { label: 'Start' } },
      { id: 'slow', data: { label: 'Slow Service' } },
    ];
    const edges = [
      { source: 'start', target: 'fetch' },
      { source: 'fetch', target: 'slow' },
    ];
    const order = topologicalNodeOrder(nodes, edges);
    expect(order[0]).toBe('start');
    expect(order).toEqual(['start', 'fetch', 'slow']);
  });

  it('handles a diamond/fork graph', () => {
    const nodes = [
      { id: 's' }, { id: 'a' }, { id: 'b' }, { id: 'j' },
    ];
    const edges = [
      { source: 's', target: 'a' },
      { source: 's', target: 'b' },
      { source: 'a', target: 'j' },
      { source: 'b', target: 'j' },
    ];
    const order = topologicalNodeOrder(nodes, edges);
    expect(order[0]).toBe('s');
    expect(order[order.length - 1]).toBe('j');
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('j'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('j'));
  });

  it('returns snapshot order for nodes with no edges', () => {
    const nodes = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const order = topologicalNodeOrder(nodes, []);
    expect(order).toEqual(['x', 'y', 'z']);
  });

  it('handles empty input', () => {
    expect(topologicalNodeOrder([], [])).toEqual([]);
  });

  it('ignores edges referencing unknown node IDs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'ghost' },
    ];
    expect(topologicalNodeOrder(nodes, edges)).toEqual(['a', 'b']);
  });
});
