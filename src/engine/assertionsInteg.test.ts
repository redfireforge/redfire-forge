import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario, Assertion } from '../types';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../utils/bodySerializer', () => ({
  serializeWithContentType: (s: Scenario) => ({ body: s.body || undefined, contentType: 'application/json' }),
  getEffectiveBodyType: () => 'json',
}));

import { httpFetch } from '../utils/httpClient';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';

function makeScenario(assertions: Assertion[], overrides?: Partial<Scenario>): Scenario {
  return {
    id: 'test-1',
    name: 'Test',
    url: 'http://example.com/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none', assertions },
    ...overrides,
  };
}

describe('requestExecution with rich assertions', () => {
  let runSequential: typeof import('./requestExecution').runSequential;
  const mockedFetch = vi.mocked(httpFetch);

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./requestExecution');
    runSequential = mod.runSequential;
  });

  function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
    mockedFetch.mockResolvedValue({
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers,
      body,
    });
  }

  function makeOpts() {
    return {
      tokenManager: new TokenManager(),
      timeoutMs: undefined,
      retryCount: 0,
      retryDelayMs: 0,
      breaker: new CircuitBreaker('continue', 10, 50),
      onProgress: vi.fn(),
      getThinkTimeMs: () => 0,
    };
  }

  it('status assertion allows 4xx responses to pass', async () => {
    mockResponse(404, '{"error":"not found"}');
    const scenario = makeScenario([{ type: 'status', expected: '404' }]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
    expect(results[0].failureDetails).toEqual([]);
    expect(results[0].httpStatus).toBe(404);
  });

  it('status assertion fails when unexpected status', async () => {
    mockResponse(500, '{"error":"internal"}');
    const scenario = makeScenario([{ type: 'status', expected: '2xx' }]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(false);
    expect(results[0].failureDetails.some(f => f.path === '(status)')).toBe(true);
  });

  it('responseTime assertion fails slow responses', async () => {
    mockedFetch.mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          status: 200, statusText: 'OK', headers: {}, body: '{}',
        }), 50),
      ),
    );
    const scenario = makeScenario([{ type: 'responseTime', maxMs: 10 }]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].failureDetails.some(f => f.path === '(responseTime)')).toBe(true);
    expect(results[0].passed).toBe(false);
  });

  it('header assertion checks response headers', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json', 'x-custom': 'hello' },
      body: '{}',
    });
    const scenario = makeScenario([
      { type: 'header', name: 'content-type', operator: 'contains', value: 'json' },
      { type: 'header', name: 'x-custom', operator: 'equals', value: 'hello' },
    ]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
    expect(results[0].failureDetails).toEqual([]);
  });

  it('regex assertion validates JSON path values', async () => {
    mockResponse(200, '{"name":"Alice","code":"ABC-123"}');
    const scenario = makeScenario([
      { type: 'regex', jsonPath: '$.code', pattern: '^[A-Z]+-\\d+$' },
    ]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
  });

  it('combines assertions with JSON validation', async () => {
    mockResponse(200, '{"name":"Alice"}');
    const scenario = makeScenario(
      [{ type: 'status', expected: '2xx' }, { type: 'responseTime', maxMs: 5000 }],
      {
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.name', expectedValue: 'Alice' }],
          assertions: [{ type: 'status', expected: '2xx' }, { type: 'responseTime', maxMs: 5000 }],
        },
      },
    );
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
  });

  it('combined: assertion passes but JSON validation fails', async () => {
    mockResponse(200, '{"name":"Bob"}');
    const scenario = makeScenario(
      [{ type: 'status', expected: '200' }],
      {
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.name', expectedValue: 'Alice' }],
          assertions: [{ type: 'status', expected: '200' }],
        },
      },
    );
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(false);
    expect(results[0].failureDetails.some(f => f.path === '$.name')).toBe(true);
  });

  it('no assertions preserves existing behavior for 4xx', async () => {
    mockResponse(404, '{"error":"not found"}');
    const scenario = makeScenario([]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(false);
    expect(results[0].failureDetails.some(f => f.path === '(http)')).toBe(true);
  });

  it('status assertion with 4xx runs JSON validation on 404 body', async () => {
    mockResponse(404, '{"error":"not found"}');
    const scenario = makeScenario(
      [{ type: 'status', expected: '404' }],
      {
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.error', expectedValue: 'not found' }],
          assertions: [{ type: 'status', expected: '404' }],
        },
      },
    );
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
    expect(results[0].httpStatus).toBe(404);
    expect(results[0].failureDetails).toEqual([]);
  });

  it('status assertion with 4xx and no validation mode passes', async () => {
    mockResponse(404, '{"error":"not found"}');
    const scenario = makeScenario([{ type: 'status', expected: '404' }]);
    const results = await runSequential([scenario], makeOpts());
    expect(results[0].passed).toBe(true);
    expect(results[0].failureDetails).toEqual([]);
  });
});
