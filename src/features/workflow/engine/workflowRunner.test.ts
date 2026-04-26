import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario } from '../../../shared/types';
import type { RunOpts } from '../../../engine/requestExecution';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runWorkflow, runWorkflowLoad } from './workflowRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { VariableContext } from './variableContext';
import { TokenManager } from '../../../engine/tokenManager';
import { CircuitBreaker } from '../../../engine/circuitBreaker';

const mockFetch = vi.mocked(httpFetch);

function makeScenario(id: string, name: string, url = 'https://example.com/api'): Scenario {
  return {
    id, name, url, method: 'GET',
    headers: [], body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
  };
}

function makeOpts(overrides: Partial<RunOpts> = {}): RunOpts {
  return {
    tokenManager: new TokenManager(),
    breaker: new CircuitBreaker(),
    onProgress: vi.fn(),
    abortSignal: undefined,
    getThinkTimeMs: () => 0,
    ...overrides,
  };
}

describe('runWorkflow', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
  });

  it('runs a single step and returns a result', async () => {
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].httpStatus).toBe(200);
  });

  it('runs multiple steps sequentially', async () => {
    const ctx = new VariableContext({});
    const steps = [
      makeScenario('s1', 'Step 1', 'https://example.com/s1'),
      makeScenario('s2', 'Step 2', 'https://example.com/s2'),
      makeScenario('s3', 'Step 3', 'https://example.com/s3'),
    ];
    const results = await runWorkflow(steps, makeOpts(), ctx);
    expect(results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Verify execution order via URLs
    const urls = mockFetch.mock.calls.map(c => String(c[0]));
    expect(urls[0]).toContain('/s1');
    expect(urls[1]).toContain('/s2');
    expect(urls[2]).toContain('/s3');
  });

  it('reports progress via onProgress callback', async () => {
    const onProgress = vi.fn();
    const ctx = new VariableContext({});
    await runWorkflow([makeScenario('s1', 'Step 1'), makeScenario('s2', 'Step 2')], makeOpts({ onProgress }), ctx);
    expect(onProgress).toHaveBeenCalledTimes(2);
    // First call should include step index and total
    const firstCall = onProgress.mock.calls[0];
    expect(firstCall).toBeDefined();
  });

  it('calls onStepComplete with extracted variables', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {},
      body: '{"token":"abc123"}',
    });
    const step: Scenario = {
      ...makeScenario('s1', 'Step 1'),
      extractions: [{ name: 'authToken', source: 'body', expression: '$.token' }],
    };
    const ctx = new VariableContext({});
    const onStepComplete = vi.fn();
    await runWorkflow([step], makeOpts(), ctx, onStepComplete);
    expect(onStepComplete).toHaveBeenCalledWith(expect.objectContaining({
      stepIndex: 0,
      stepName: 'Step 1',
      extracted: expect.objectContaining({ authToken: 'abc123' }),
    }));
  });

  it('chains extracted variables to next step', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {},
      body: '{"token":"chain-tok"}',
    });
    const step1: Scenario = {
      ...makeScenario('s1', 'Step 1'),
      extractions: [{ name: 'tok', source: 'body', expression: '$.token' }],
    };
    const step2: Scenario = {
      ...makeScenario('s2', 'Step 2', 'https://example.com/api?t={{tok}}'),
    };
    const ctx = new VariableContext({});
    await runWorkflow([step1, step2], makeOpts(), ctx);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondUrl = String(mockFetch.mock.calls[1][0]);
    expect(secondUrl).toContain('chain-tok');
  });

  it('sets status variable from response', async () => {
    const ctx = new VariableContext({});
    await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(ctx.get('status')).toBe('200');
  });

  it('stops on abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = new VariableContext({});
    const results = await runWorkflow(
      [makeScenario('s1', 'Step 1'), makeScenario('s2', 'Step 2')],
      makeOpts({ abortSignal: controller.signal }),
      ctx,
    );
    expect(results).toHaveLength(0);
  });

  it('handles HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500, statusText: 'Error', headers: {},
      body: '{"error":"server fail"}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(results[0].httpStatus).toBe(500);
    expect(results[0].passed).toBe(false);
  });

  it('handles fetch throwing network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(results[0].httpStatus).toBe(0);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('ECONNREFUSED');
  });

  it('handles httpFetch returning error field', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 0, statusText: '', headers: {},
      body: '', error: 'TLS handshake failed',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('TLS handshake');
  });

  it('applies assertions from validation config', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {},
      body: '{}',
    });
    const step: Scenario = {
      ...makeScenario('s1', 'Step 1'),
      validation: { mode: 'none', assertions: [{ type: 'status', expected: '201' }] },
    };
    const ctx = new VariableContext({});
    const results = await runWorkflow([step], makeOpts(), ctx);
    expect(results[0].passed).toBe(false);
  });

  it('strips transient fields from returned results', async () => {
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect((results[0] as unknown as Record<string, unknown>)._fullResponseBody).toBeUndefined();
  });

  it('handles timeout', async () => {
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    }), 5000)));
    const ctx = new VariableContext({});
    const results = await runWorkflow(
      [makeScenario('s1', 'Step 1')],
      makeOpts({ timeoutMs: 10 }),
      ctx,
    );
    expect(results[0].httpStatus).toBe(0);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('timeout');
  });

  it('extracts error message from JSON error response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400, statusText: 'Bad Request', headers: {},
      body: '{"message":"Invalid parameter"}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Step 1')], makeOpts(), ctx);
    expect(results[0].errorMessage).toContain('Invalid parameter');
  });
});

describe('runWorkflowLoad', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
  });

  it('runs N iterations sequentially when concurrency=1', async () => {
    const ctx = new VariableContext({});
    const steps = [makeScenario('s1', 'Step 1')];
    const results = await runWorkflowLoad(steps, 3, 1, makeOpts(), ctx);
    expect(results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('runs iterations concurrently when concurrency > 1', async () => {
    const ctx = new VariableContext({});
    const steps = [makeScenario('s1', 'Step 1')];
    const results = await runWorkflowLoad(steps, 4, 2, makeOpts(), ctx);
    expect(results).toHaveLength(4);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('stops on abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = new VariableContext({});
    const results = await runWorkflowLoad(
      [makeScenario('s1', 'Step 1')],
      5, 1,
      makeOpts({ abortSignal: controller.signal }),
      ctx,
    );
    expect(results).toHaveLength(0);
  });

  it('isolates variables per iteration via child context', async () => {
    mockFetch.mockResolvedValue({
      status: 200, statusText: 'OK', headers: {},
      body: '{"val":"iter-specific"}',
    });
    const step: Scenario = {
      ...makeScenario('s1', 'Step 1'),
      extractions: [{ name: 'myVar', source: 'body', expression: '$.val' }],
    };
    const ctx = new VariableContext({});
    const results = await runWorkflowLoad([step], 2, 1, makeOpts(), ctx);
    expect(results).toHaveLength(2);
    // Parent ctx should not have myVar (child isolated — extraction happens in child)
    expect(ctx.get('myVar')).toBeUndefined();
  });

  it('calls onStepComplete for each iteration step', async () => {
    const onStepComplete = vi.fn();
    const ctx = new VariableContext({});
    await runWorkflowLoad([makeScenario('s1', 'Step')], 2, 1, makeOpts(), ctx, onStepComplete);
    expect(onStepComplete).toHaveBeenCalledTimes(2);
  });

  it('extracts error message string from response body on HTTP failure', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500, statusText: 'Server Error', headers: {},
      body: '{"message":"Internal Server Error"}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Fail')], makeOpts(), ctx);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toBe('Internal Server Error');
  });

  it('extracts error field from response body on HTTP failure', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400, statusText: 'Bad Request', headers: {},
      body: '{"error":"validation failed"}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Fail')], makeOpts(), ctx);
    expect(results[0].errorMessage).toBe('validation failed');
  });

  it('extracts non-string error from response body via JSON.stringify', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 422, statusText: 'Unprocessable', headers: {},
      body: '{"error":{"code":"E01","msg":"bad"}}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Fail')], makeOpts(), ctx);
    expect(results[0].errorMessage).toContain('E01');
  });

  it('uses raw body slice when no message/error/detail field exists', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 503, statusText: 'Unavailable', headers: {},
      body: '{"status":"down"}',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Fail')], makeOpts(), ctx);
    expect(results[0].errorMessage).toContain('down');
  });

  it('uses body slice when response is not parseable JSON on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 502, statusText: 'Bad Gateway', headers: {},
      body: '<html>Bad Gateway</html>',
    });
    const ctx = new VariableContext({});
    const results = await runWorkflow([makeScenario('s1', 'Fail')], makeOpts(), ctx);
    expect(results[0].errorMessage).toContain('Bad Gateway');
  });
});
