import { describe, it, expect } from 'vitest';
import type { TestRun, WorkflowExecutionTrace } from '../types';
import {
  compressTrace,
  decompressTrace,
  hasExecutionTrace,
  getExecutionTrace,
  sampleIterations,
} from './traceCompression';

function createMockTrace(iterations = 3, nodesPerIteration = 5): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-test',
    workflowName: 'Test Workflow',
    totalIterations: iterations,
    totalDurationMs: iterations * 1000,
    traversedEdges: ['e1', 'e2', 'e3'],
    workflowSnapshot: {
      nodes: Array.from({ length: nodesPerIteration }, (_, i) => ({
        id: `n${i}`,
        type: 'http',
        position: { x: i * 100, y: 0 },
        data: { label: `Node ${i}` },
      })),
      edges: Array.from({ length: nodesPerIteration - 1 }, (_, i) => ({
        id: `e${i}`,
        source: `n${i}`,
        target: `n${i + 1}`,
      })),
    },
    iterations: Array.from({ length: iterations }, (_, idx) => ({
      index: idx,
      passed: idx % 3 !== 2,
      durationMs: 800 + Math.floor(idx * 50),
      events: Array.from({ length: nodesPerIteration }, (_, ni) => ({
        nodeId: `n${ni}`,
        nodeType: 'http' as const,
        nodeLabel: `Node ${ni}`,
        timestamp: Date.now() + ni * 100,
        state: (idx % 3 === 2 && ni === nodesPerIteration - 1 ? 'fail' : 'pass') as 'pass' | 'fail',
        durationMs: 100 + ni * 20,
        details: {
          statusCode: 200,
          responseTimeMs: 100 + ni * 20,
          method: 'GET',
          url: `https://api.example.com/resource/${ni}`,
        },
      })),
      finalVariables: { orderId: `order-${idx}`, status: 'completed' },
      traversedEdges: ['e1', 'e2'],
    })),
    fullTraceCaptured: false,
  };
}

function createMockTestRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: { concurrency: 1, totalTransactions: 1, executionMode: 'workflow' } as TestRun['config'],
    summary: { total: 10, passed: 9, failed: 1 } as TestRun['summary'],
    results: [],
    ...overrides,
  };
}

describe('compressTrace / decompressTrace', () => {
  it('roundtrip produces identical trace', () => {
    const trace = createMockTrace();
    const compressed = compressTrace(trace);
    const decompressed = decompressTrace(compressed);
    expect(decompressed).toEqual(trace);
  });

  it('compressed output is smaller than raw JSON', () => {
    const trace = createMockTrace(20, 10);
    const rawSize = JSON.stringify(trace).length;
    const compressedSize = compressTrace(trace).length;
    expect(compressedSize).toBeLessThan(rawSize);
  });

  it('handles trace with zero iterations', () => {
    const trace = createMockTrace(0, 0);
    const compressed = compressTrace(trace);
    const decompressed = decompressTrace(compressed);
    expect(decompressed).toEqual(trace);
  });

  it('handles large trace (100 iterations)', () => {
    const trace = createMockTrace(100, 15);
    const compressed = compressTrace(trace);
    const decompressed = decompressTrace(compressed);
    expect(decompressed.totalIterations).toBe(100);
    expect(decompressed.iterations).toHaveLength(100);
  });

  it('decompressTrace throws on invalid base64', () => {
    expect(() => decompressTrace('not-valid-compressed-data!!!')).toThrow();
  });

  it('decompressTrace throws on empty string', () => {
    expect(() => decompressTrace('')).toThrow();
  });

  it('preserves fullTraceCaptured flag', () => {
    const trace = createMockTrace(1, 2);
    trace.fullTraceCaptured = true;
    const decompressed = decompressTrace(compressTrace(trace));
    expect(decompressed.fullTraceCaptured).toBe(true);
  });

  it('preserves nested details with all field types', () => {
    const trace = createMockTrace(1, 1);
    trace.iterations[0].events[0].details = {
      statusCode: 201,
      responseTimeMs: 345,
      method: 'POST',
      url: 'https://api.example.com/orders',
      inputVariables: { apiKey: 'secret-123' },
      extractedVariables: { orderId: 'ORD-999' },
      conditionResult: true,
      conditionExpression: '{{status}} === "ok"',
    };
    const decompressed = decompressTrace(compressTrace(trace));
    expect(decompressed.iterations[0].events[0].details).toEqual(trace.iterations[0].events[0].details);
  });
});

describe('hasExecutionTrace', () => {
  it('returns true when executionTrace is present', () => {
    const run = createMockTestRun({ executionTrace: createMockTrace() });
    expect(hasExecutionTrace(run)).toBe(true);
  });

  it('returns true when compressedTrace is present', () => {
    const run = createMockTestRun({ compressedTrace: compressTrace(createMockTrace()) });
    expect(hasExecutionTrace(run)).toBe(true);
  });

  it('returns false when neither is present', () => {
    const run = createMockTestRun();
    expect(hasExecutionTrace(run)).toBe(false);
  });

  it('returns true when both are present', () => {
    const trace = createMockTrace();
    const run = createMockTestRun({
      executionTrace: trace,
      compressedTrace: compressTrace(trace),
    });
    expect(hasExecutionTrace(run)).toBe(true);
  });
});

describe('getExecutionTrace', () => {
  it('returns uncompressed trace directly', () => {
    const trace = createMockTrace();
    const run = createMockTestRun({ executionTrace: trace });
    expect(getExecutionTrace(run)).toBe(trace);
  });

  it('decompresses and returns compressed trace', () => {
    const trace = createMockTrace();
    const run = createMockTestRun({ compressedTrace: compressTrace(trace) });
    expect(getExecutionTrace(run)).toEqual(trace);
  });

  it('returns undefined when no trace exists', () => {
    const run = createMockTestRun();
    expect(getExecutionTrace(run)).toBeUndefined();
  });

  it('prefers uncompressed over compressed when both exist', () => {
    const trace = createMockTrace(1, 1);
    const differentTrace = createMockTrace(2, 2);
    const run = createMockTestRun({
      executionTrace: trace,
      compressedTrace: compressTrace(differentTrace),
    });
    const result = getExecutionTrace(run);
    expect(result).toBe(trace);
    expect(result!.totalIterations).toBe(1);
  });
});

describe('sampleIterations', () => {
  it('returns all iterations with sampled=true when under threshold', () => {
    const trace = createMockTrace(30, 2);
    const result = sampleIterations(trace.iterations);
    expect(result).toHaveLength(30);
    expect(result.every(i => i.sampled === true)).toBe(true);
    expect(result[0].events).toHaveLength(2);
  });

  it('returns all iterations with sampled=true at exactly the threshold', () => {
    const trace = createMockTrace(50, 2);
    const result = sampleIterations(trace.iterations);
    expect(result).toHaveLength(50);
    expect(result.every(i => i.sampled === true)).toBe(true);
  });

  it('samples iterations when above threshold', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    expect(result).toHaveLength(100);

    const sampledCount = result.filter(i => i.sampled === true).length;
    const notSampledCount = result.filter(i => i.sampled === false).length;
    expect(sampledCount + notSampledCount).toBe(100);
    expect(sampledCount).toBeGreaterThan(0);
    expect(sampledCount).toBeLessThan(100);
  });

  it('always keeps the first 10 iterations', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    for (let i = 0; i < 10; i++) {
      expect(result[i].sampled).toBe(true);
      expect(result[i].events.length).toBeGreaterThan(0);
    }
  });

  it('always keeps the last 5 iterations', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    for (let i = 95; i < 100; i++) {
      expect(result[i].sampled).toBe(true);
      expect(result[i].events.length).toBeGreaterThan(0);
    }
  });

  it('always keeps all failed iterations', () => {
    const trace = createMockTrace(100, 2);
    // createMockTrace marks every 3rd iteration (idx%3===2) as failed
    const failedIndices = trace.iterations
      .map((iter, i) => ({ iter, i }))
      .filter(({ iter }) => !iter.passed)
      .map(({ i }) => i);

    expect(failedIndices.length).toBeGreaterThan(0);

    const result = sampleIterations(trace.iterations);
    for (const idx of failedIndices) {
      expect(result[idx].sampled).toBe(true);
      expect(result[idx].events.length).toBeGreaterThan(0);
    }
  });

  it('keeps every 10th iteration in the middle range', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    // 10, 20, 30, ... up to before last 5
    for (let i = 10; i < 95; i += 10) {
      expect(result[i].sampled).toBe(true);
    }
  });

  it('strips events and variables from non-sampled iterations', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    const notSampled = result.filter(i => i.sampled === false);

    expect(notSampled.length).toBeGreaterThan(0);
    for (const iter of notSampled) {
      expect(iter.events).toEqual([]);
      expect(iter.finalVariables).toEqual({});
      expect(iter.traversedEdges).toEqual([]);
    }
  });

  it('preserves index, passed, and durationMs on non-sampled iterations', () => {
    const trace = createMockTrace(100, 2);
    const result = sampleIterations(trace.iterations);
    for (let i = 0; i < 100; i++) {
      expect(result[i].index).toBe(trace.iterations[i].index);
      expect(result[i].passed).toBe(trace.iterations[i].passed);
      expect(result[i].durationMs).toBe(trace.iterations[i].durationMs);
    }
  });

  it('accepts a custom threshold', () => {
    const trace = createMockTrace(30, 2);
    const result = sampleIterations(trace.iterations, 20);
    const notSampled = result.filter(i => i.sampled === false);
    expect(notSampled.length).toBeGreaterThan(0);
  });

  it('handles edge case: 51 iterations (just above threshold)', () => {
    const trace = createMockTrace(51, 2);
    const result = sampleIterations(trace.iterations);
    expect(result).toHaveLength(51);

    // First 10 sampled
    for (let i = 0; i < 10; i++) expect(result[i].sampled).toBe(true);
    // Last 5 sampled
    for (let i = 46; i < 51; i++) expect(result[i].sampled).toBe(true);
  });

  it('handles 0 iterations', () => {
    const result = sampleIterations([]);
    expect(result).toEqual([]);
  });
});
