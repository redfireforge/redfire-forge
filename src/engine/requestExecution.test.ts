import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario } from '../shared/types';
import { executeWithRetry, runSequential, runBatch, runPool, type RunOpts } from './requestExecution';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';

vi.mock('../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../shared/utils/httpClient';
const mockedFetch = vi.mocked(httpFetch);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1', name: 'TestScenario', url: 'https://api.example.com/users',
    method: 'GET', headers: [], body: '', auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function successResponse(body = '{"ok":true}') {
  return { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body };
}

function errorResponse(status = 500, body = '{"error":"Internal Server Error"}') {
  return { status, statusText: 'Error', headers: {}, body };
}

function makeRunOpts(overrides: Partial<RunOpts> = {}): RunOpts {
  return {
    tokenManager: new TokenManager(),
    timeoutMs: undefined,
    retryCount: 0,
    retryDelayMs: 0,
    breaker: new CircuitBreaker('continue'),
    onProgress: vi.fn(),
    getThinkTimeMs: () => 0,
    ...overrides,
  };
}

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes request successfully', async () => {
    mockedFetch.mockResolvedValueOnce(successResponse());
    const s = makeScenario();
    const result = await executeWithRetry(s, {}, undefined);
    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.scenarioName).toBe('TestScenario');
  });

  it('records HTTP error details', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(404, '{"message":"Not found"}'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(404);
    expect(result.errorMessage).toBe('Not found');
  });

  it('handles network errors', async () => {
    mockedFetch.mockResolvedValueOnce({
      status: 0, statusText: '', headers: {}, body: '', error: 'Connection refused',
    });
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.errorMessage).toBe('Connection refused');
  });

  it('handles fetch throwing an exception', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Network down'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('Network down');
  });

  it('retries failed requests', async () => {
    mockedFetch
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(successResponse());
    const result = await executeWithRetry(makeScenario(), {}, undefined, undefined, 1, 0);
    expect(result.passed).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('reports retry attempts on persistent failure', async () => {
    mockedFetch
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(errorResponse());
    const result = await executeWithRetry(makeScenario(), {}, undefined, undefined, 2, 0);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('after 3 attempts');
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it('captures response headers in result', async () => {
    mockedFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json', 'x-request-id': 'abc-123', 'cache-control': 'no-cache' },
      body: '{"ok":true}',
    });
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.responseHeaders).toEqual({
      'content-type': 'application/json',
      'x-request-id': 'abc-123',
      'cache-control': 'no-cache',
    });
  });

  it('captures request log with headers and body', async () => {
    mockedFetch.mockResolvedValueOnce(successResponse());
    const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer tok' };
    const reqBody = '{"name":"test"}';
    const result = await executeWithRetry(makeScenario({ method: 'POST' }), reqHeaders, reqBody);
    expect(result.requestLog).toEqual({ headers: reqHeaders, body: reqBody });
  });

  it('captures request log with undefined body for GET', async () => {
    mockedFetch.mockResolvedValueOnce(successResponse());
    const result = await executeWithRetry(makeScenario(), { 'Accept': 'application/json' }, undefined);
    expect(result.requestLog).toEqual({ headers: { 'Accept': 'application/json' }, body: undefined });
  });

  it('captures empty response headers when none returned', async () => {
    mockedFetch.mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.responseHeaders).toEqual({});
  });

  it('runs validation when enabled and request succeeds', async () => {
    mockedFetch.mockResolvedValueOnce(successResponse('{"status":"active"}'));
    const s = makeScenario({
      validation: {
        mode: 'json',
        rules: [{ path: '$.status', operator: 'equals', expected: 'active' }],
      },
    });
    const result = await executeWithRetry(s, {}, undefined);
    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('json');
  });

  it('skips validation on error responses', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500, '{"status":"error"}'));
    const s = makeScenario({
      validation: {
        mode: 'json',
        rules: [{ path: '$.status', operator: 'equals', expected: 'active' }],
      },
    });
    const result = await executeWithRetry(s, {}, undefined);
    expect(result.passed).toBe(false);
    expect(result.failureDetails[0].path).toBe('(http)');
  });

  it('extracts error from response body error field', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(400, '{"error":"bad request"}'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.errorMessage).toBe('bad request');
  });

  it('extracts error from response body detail field', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(422, '{"detail":"validation error"}'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.errorMessage).toBe('validation error');
  });

  it('extracts error from errorMessage field', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500, '{"errorMessage":"server crash"}'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.errorMessage).toBe('server crash');
  });

  it('uses truncated body when no known error fields', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500, 'Plain text error'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.errorMessage).toBe('Plain text error');
  });

  it('serializes non-string error fields', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500, '{"error":{"code":123,"msg":"oops"}}'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.errorMessage).toContain('123');
  });

  it('truncates response body to 2000 chars', async () => {
    const longBody = 'x'.repeat(3000);
    mockedFetch.mockResolvedValueOnce(successResponse(longBody));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.responseBody.length).toBe(2000);
  });

  it('handles non-JSON response body gracefully', async () => {
    mockedFetch.mockResolvedValueOnce(successResponse('<html>Not JSON</html>'));
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    expect(result.passed).toBe(true);
    expect(result.responseBody).toBe('<html>Not JSON</html>');
  });

  it('uses truncated body when error field extraction throws', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500, '{"error":{"nested":1}}'));
    const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new TypeError('stringify blocked');
    });
    const result = await executeWithRetry(makeScenario(), {}, undefined);
    stringifySpy.mockRestore();
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('{"error":{"nested":1}}'.slice(0, 300));
  });
});

describe('runSequential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scenarios one by one', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const queue = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })];
    const opts = makeRunOpts();
    const results = await runSequential(queue, opts);
    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
    expect(opts.onProgress).toHaveBeenCalledTimes(2);
  });

  it('stops on abort signal', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const controller = new AbortController();
    controller.abort();
    const queue = [makeScenario(), makeScenario()];
    const results = await runSequential(queue, makeRunOpts({ abortSignal: controller.signal }));
    expect(results).toHaveLength(0);
  });

  it('stops when breaker trips', async () => {
    mockedFetch.mockResolvedValue(errorResponse());
    const breaker = new CircuitBreaker('stop-first');
    const queue = [makeScenario(), makeScenario(), makeScenario()];
    const results = await runSequential(queue, makeRunOpts({ breaker }));
    expect(results).toHaveLength(1);
  });
});

describe('runBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scenarios in batches', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const queue = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' }), makeScenario({ id: 'c' })];
    const results = await runBatch(queue, 2, makeRunOpts());
    expect(results).toHaveLength(3);
  });

  it('stops on abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const results = await runBatch([makeScenario()], 1, makeRunOpts({ abortSignal: controller.signal }));
    expect(results).toHaveLength(0);
  });
});

describe('runPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scenarios with concurrency pool', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const queue = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' }), makeScenario({ id: 'c' })];
    const results = await runPool(queue, 2, makeRunOpts());
    expect(results).toHaveLength(3);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('handles errors within pool gracefully', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'));
    const queue = [makeScenario()];
    const results = await runPool(queue, 1, makeRunOpts());
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toBe('boom');
  });

  it('calls onProgress for pool completions', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const onProgress = vi.fn();
    const results = await runPool([makeScenario()], 1, makeRunOpts({ onProgress }));
    expect(results).toHaveLength(1);
    expect(onProgress).toHaveBeenCalled();
  });

  it('records pool error when token acquisition rejects', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const tokenManager = {
      getToken: vi.fn().mockRejectedValue(new Error('token pool fail')),
    } as unknown as TokenManager;
    const results = await runPool([makeScenario()], 1, makeRunOpts({ tokenManager }));
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toBe('token pool fail');
    expect(results[0].failureDetails[0].path).toBe('(error)');
  });

  it('resolves immediately for an empty queue', async () => {
    mockedFetch.mockResolvedValue(successResponse());
    const results = await runPool([], 2, makeRunOpts());
    expect(results).toEqual([]);
  });
});
