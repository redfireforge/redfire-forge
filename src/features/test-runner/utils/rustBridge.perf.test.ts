import { describe, it, vi } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { mapRustResult } from './rustBridge';
import type { RustExecutionResult } from './rustBridge';
import type { Scenario } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const SHOULD_RUN = process.env.PERF === '1';

const BODY_STR = JSON.stringify({
  data: {
    id: 'abc123def456',
    name: 'Test User',
    count: 42,
    active: true,
    email: 'user@example.com',
    role: 'admin',
    score: 95.5,
    tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    items: [
      { name: 'Widget A', price: 9.99 },
      { name: 'Widget B', price: 19.99 },
      { name: 'Widget C', price: 29.99 },
      { name: 'Widget D', price: 39.99 },
      { name: 'Widget E', price: 49.99 },
    ],
    metadata: { version: '1.0', region: 'us-east' },
    timestamp: '2024-01-01T00:00:00Z',
  },
});

function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
  return {
    id: 'r-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 42.5,
    responseBody: BODY_STR,
    responseHeaders: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    requestLog: { headers: { 'X-Custom': 'test' }, body: null },
    timing: { dnsLookup: 1, tcpConnect: 2, tlsHandshake: 3, ttfb: 30, download: 5, total: 41 },
    retryCount: 0,
    ...overrides,
  };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
    ...overrides,
  });
}

function printPerf(label: string, iterations: number, elapsedMs: number) {
  const usPerIter = (elapsedMs * 1000) / iterations;
  console.log(`[PERF] ${label}: ${elapsedMs.toFixed(2)} ms total, ${usPerIter.toFixed(2)} µs/iter (${iterations} iterations)`);
}

describe.skipIf(!SHOULD_RUN)('Bridge Performance Benchmarks', () => {
  it('Bridge Benchmark: mapRustResult passthrough overhead (10K)', () => {
    const rustResult = makeRustResult({
      passed: true,
      failureDetails: [],
      validationMode: 'selective',
    });
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        assertions: [
          { type: 'custom', expression: 'true' },
          { type: 'status', expected: '200' },
        ],
      },
    });
    const iterations = 10_000;

    for (let i = 0; i < 100; i++) mapRustResult(rustResult, scenario);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      mapRustResult(rustResult, scenario);
    }
    const elapsed = performance.now() - start;

    printPerf('Bridge Benchmark (mapRustResult passthrough)', iterations, elapsed);
  });
});
