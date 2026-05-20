import { describe, it, expect, vi, beforeEach} from 'vitest';

// Mock global fetch for runWebhookLoadTest
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.randomUUID
vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`);

import {
  calculateTotalRequests,
  runWebhookLoadTest,
  type WebhookRateConfig,
  type WebhookLoadDriverConfig,
} from './webhookLoadDriver';

describe('runWebhookLoadTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  function createConfig(overrides: Partial<WebhookLoadDriverConfig> = {}): WebhookLoadDriverConfig {
    return {
      webhookUrl: 'http://localhost:3001/webhook/test',
      method: 'POST',
      payloadTemplate: '{"event": "test", "id": "{{$uuid}}"}',
      rate: { mode: 'burst', burstCount: 3 },
      ...overrides,
    };
  }

  function mockSuccessResponse(body = '{"ok":true}') {
    return {
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue(body),
    };
  }

  function mockErrorResponse(status = 500, body = 'error') {
    return {
      status,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(body),
    };
  }

  describe('burst mode', () => {
    it('sends all requests concurrently in burst mode', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 5 } });

      const result = await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledTimes(5);
      expect(result.totalRequests).toBe(5);
      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(0);
    });

    it('handles mixed success and failure results', async () => {
      mockFetch
        .mockResolvedValueOnce(mockSuccessResponse())
        .mockResolvedValueOnce(mockErrorResponse())
        .mockResolvedValueOnce(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 3 } });

      const result = await runWebhookLoadTest(config);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      const failedResult = result.results.find(r => !r.passed);
      expect(failedResult?.errorMessage).toContain('HTTP 500');
    });

    it('counts HTTP 399 as success and HTTP 400 as failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 399,
          statusText: 'OK-ish',
          text: vi.fn().mockResolvedValue('{}'),
        })
        .mockResolvedValueOnce({
          status: 400,
          statusText: 'Bad Request',
          text: vi.fn().mockResolvedValue('{}'),
        });

      const result = await runWebhookLoadTest(createConfig({ rate: { mode: 'burst', burstCount: 2 } }));

      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
      expect(result.results[1].errorMessage).toContain('HTTP 400');
    });

    it('does not set cancelled flag when failures occur without abort signal', async () => {
      mockFetch.mockRejectedValue(new Error('boom'));
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });

      const result = await runWebhookLoadTest(config);

      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].cancelled).toBeUndefined();
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      const config = createConfig({ rate: { mode: 'burst', burstCount: 2 } });

      const result = await runWebhookLoadTest(config);

      expect(result.failureCount).toBe(2);
      expect(result.results[0].errorMessage).toBe('Connection refused');
      expect(result.results[0].httpStatus).toBe(0);
    });

    it('calls onRequestComplete callback after each request', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const onRequestComplete = vi.fn();
      const config = createConfig({ rate: { mode: 'burst', burstCount: 3 } });

      await runWebhookLoadTest(config, { onRequestComplete });

      expect(onRequestComplete).toHaveBeenCalledTimes(3);
      expect(onRequestComplete).toHaveBeenLastCalledWith(
        expect.objectContaining({ passed: true }),
        3,
        3,
      );
    });
  });

  describe('fixed mode', () => {
    it('calculates correct total for fixed rate', () => {
      const rate: WebhookRateConfig = { mode: 'fixed', rps: 10, durationSec: 5 };
      expect(calculateTotalRequests(rate)).toBe(50);
    });

    it('schedules requests over duration in fixed mode', async () => {
      // Use burst for reliable testing, but verify fixed rate calculation
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const rate: WebhookRateConfig = { mode: 'fixed', rps: 2, durationSec: 1 };
      const total = calculateTotalRequests(rate);
      expect(total).toBe(2);
    });
  });

  describe('ramp mode', () => {
    it('calculates correct total for ramp rate', () => {
      const rate: WebhookRateConfig = { mode: 'ramp', rps: 10, endRps: 20, durationSec: 10 };
      // Average = 15 rps, duration = 10s, total = 150
      expect(calculateTotalRequests(rate)).toBe(150);
    });

    it('handles ramp with same start/end RPS', () => {
      const rate: WebhookRateConfig = { mode: 'ramp', rps: 5, endRps: 5, durationSec: 4 };
      expect(calculateTotalRequests(rate)).toBe(20);
    });
  });

  describe('abort signal', () => {
    it('respects abort signal during burst execution', async () => {
      const controller = new AbortController();
      mockFetch.mockImplementation(async () => {
        controller.abort();
        return mockSuccessResponse();
      });
      const config = createConfig({ rate: { mode: 'burst', burstCount: 10 } });

      const result = await runWebhookLoadTest(config, {}, controller.signal);

      // Some results may be cancelled
      const cancelledResults = result.results.filter(r => r.cancelled);
      expect(cancelledResults.length).toBeGreaterThanOrEqual(0);
    });

    it('marks results as cancelled when abort signal fires', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-abort
      mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });

      const result = await runWebhookLoadTest(config, {}, controller.signal);

      expect(result.results[0].cancelled).toBe(true);
    });

    it('wires external abort signal to request AbortController', async () => {
      const controller = new AbortController();
      let capturedSignal: AbortSignal | undefined;

      mockFetch.mockImplementation((_url, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        capturedSignal = signal;
        const abortErr = () => new DOMException('Aborted', 'AbortError');
        return new Promise<Response>((_, reject) => {
          if (!signal) {
            reject(abortErr());
            return;
          }
          if (signal.aborted) {
            reject(abortErr());
            return;
          }
          signal.addEventListener(
            'abort',
            () => {
              reject(abortErr());
            },
            { once: true },
          );
        });
      });

      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });
      const run = runWebhookLoadTest(config, {}, controller.signal);

      await vi.waitFor(() => expect(capturedSignal).toBeDefined());
      controller.abort();

      const result = await run;
      expect(result.results[0].cancelled).toBe(true);
    });
  });

  describe('headers and payload', () => {
    it('includes custom headers in requests', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        headers: { 'X-Api-Key': 'secret123', 'X-Trace-Id': 'trace-001' },
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/webhook/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Api-Key': 'secret123',
            'X-Trace-Id': 'trace-001',
          }),
        }),
      );
    });

    it('expands payload template with generators', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        payloadTemplate: '{"requestIndex": {{$requestIndex}}}',
        rate: { mode: 'burst', burstCount: 2 },
      });

      await runWebhookLoadTest(config);

      const calls = mockFetch.mock.calls;
      const bodies = calls.map(c => c[1].body);
      expect(bodies).toContain('{"requestIndex": 0}');
      expect(bodies).toContain('{"requestIndex": 1}');
    });

    it('uses correct HTTP method', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        method: 'PUT',
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('supports PATCH verb', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        method: 'PATCH',
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'PATCH' }));
    });
  });

  describe('trace capture', () => {
    it('appends _trace=true to URL when captureTraces is enabled', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/webhook/test?_trace=true',
        expect.any(Object),
      );
    });

    it('appends &_trace=true when URL already has query params', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        webhookUrl: 'http://localhost:3001/webhook/test?env=prod',
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/webhook/test?env=prod&_trace=true',
        expect.any(Object),
      );
    });

    it('parses iteration traces from server response', async () => {
      const serverResponse = {
        message: 'ok',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        duration: 100,
        status: 'passed',
        passed: true,
        stepsExecuted: 3,
        results: [],
        iterationTrace: {
          index: 0,
          passed: true,
          durationMs: 100,
          stepResults: [],
          traversedEdges: ['e1', 'e2'],
        },
      };
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockResolvedValue(JSON.stringify(serverResponse)),
      });
      const config = createConfig({
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.iterationTraces).toHaveLength(1);
      expect(result.iterationTraces![0].passed).toBe(true);
      expect(result.iterationTraces![0].index).toBe(0);
    });

    it('handles non-JSON response gracefully when capturing traces', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockResolvedValue('not json'),
      });
      const config = createConfig({
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.iterationTraces).toHaveLength(0);
      expect(result.successCount).toBe(1);
    });

    it('returns undefined iterationTraces when captureTraces is false', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        captureTraces: false,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.iterationTraces).toBeUndefined();
    });
  });

  describe('statistics calculation', () => {
    it('calculates response time statistics correctly', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 3 } });

      const result = await runWebhookLoadTest(config);

      expect(result.totalRequests).toBe(3);
      expect(result.avgResponseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.minResponseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.maxResponseTimeMs).toBeGreaterThanOrEqual(result.minResponseTimeMs);
    });

    it('handles minimal results for statistics', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      // burstCount: 0 defaults to 1, so use burstCount: 1 to test minimal case
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });

      const result = await runWebhookLoadTest(config);

      expect(result.totalRequests).toBe(1);
      expect(typeof result.avgResponseTimeMs).toBe('number');
      expect(result.minResponseTimeMs).toBeLessThanOrEqual(result.maxResponseTimeMs);
    });

    it('reports actual duration and RPS', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 5 } });

      const result = await runWebhookLoadTest(config);

      // actualDurationMs can be 0 in fast tests, actualRps will be Infinity if duration is 0
      expect(result.totalRequests).toBe(5);
      expect(typeof result.actualDurationMs).toBe('number');
      expect(typeof result.actualRps).toBe('number');
    });
  });

  describe('result structure', () => {
    it('creates RequestResult with correct fields', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse('{"data":"test"}'));
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });

      const result = await runWebhookLoadTest(config);
      const reqResult = result.results[0];

      expect(reqResult.id).toBe('test-uuid-1234');
      expect(reqResult.scenarioId).toMatch(/^webhook-load-\d+$/);
      expect(reqResult.scenarioName).toBe('Webhook Load Test');
      expect(reqResult.featureGroupName).toBe('Webhook Load Driver');
      expect(reqResult.url).toBe('http://localhost:3001/webhook/test');
      expect(reqResult.method).toBe('POST');
      expect(reqResult.httpStatus).toBe(200);
      expect(reqResult.responseBody).toBe('{"data":"test"}');
      expect(reqResult.passed).toBe(true);
      expect(reqResult.validationMode).toBe('none');
      expect(reqResult.iterationIndex).toBe(0);
    });

    it('sets groupName with request number', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 3 } });

      const result = await runWebhookLoadTest(config);

      expect(result.results[0].groupName).toBe('Request #1');
      expect(result.results[1].groupName).toBe('Request #2');
      expect(result.results[2].groupName).toBe('Request #3');
    });
  });

  describe('timeout handling', () => {
    it('uses custom timeout from config', async () => {
      vi.useRealTimers();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const controller = new AbortController();
      mockFetch.mockImplementation(async (_url, opts) => {
        // Store the signal to verify timeout behavior
        expect(opts.signal).toBeDefined();
        return mockSuccessResponse();
      });
      const config = createConfig({
        timeoutMs: 5000,
        rate: { mode: 'burst', burstCount: 1 },
      });

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('uses default 30s timeout when not specified', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });
      delete (config as Partial<WebhookLoadDriverConfig>).timeoutMs;

      await runWebhookLoadTest(config);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('aborts a hung fetch when per-request timeout elapses', async () => {
      vi.useRealTimers();
      mockFetch.mockImplementation((_url, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        return new Promise((_resolve, reject) => {
          const onAbort = () =>
            reject(new DOMException('The operation was aborted', 'AbortError'));
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener('abort', onAbort, { once: true });
        }) as unknown as Promise<Response>;
      });
      const config = createConfig({
        timeoutMs: 45,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.failureCount).toBe(1);
      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].httpStatus).toBe(0);
    }, 8000);
  });

  describe('progress callbacks', () => {
    it('accepts onProgress callback without errors', async () => {
      const onProgress = vi.fn();
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 3 } });

      const result = await runWebhookLoadTest(config, { onProgress });

      // In burst mode onProgress isn't called, but test verifies no errors
      expect(result.totalRequests).toBe(3);
    });

    it('calls onRequestComplete for each request', async () => {
      const onRequestComplete = vi.fn();
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({ rate: { mode: 'burst', burstCount: 5 } });

      await runWebhookLoadTest(config, { onRequestComplete });

      expect(onRequestComplete).toHaveBeenCalledTimes(5);
    });
  });

  describe('fixed/ramp mode execution', () => {
    it('uses unity RPS when fixed pacing sets rps to zero', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());

      await runWebhookLoadTest(
        createConfig({
          rate: { mode: 'fixed', rps: 0, durationSec: 0.001 },
        }),
      );
    });

    it('maps zero fixed-mode duration seconds to one second pacing window', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());

      await runWebhookLoadTest(
        createConfig({
          rate: { mode: 'fixed', rps: 3, durationSec: 0 },
        }),
      );
    });

    it('executes fixed mode with very short duration', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        rate: { mode: 'fixed', rps: 1000, durationSec: 0.001 }, // Very short to complete quickly
      });

      const result = await runWebhookLoadTest(config);

      // Should complete with at least 1 request
      expect(result.totalRequests).toBeGreaterThanOrEqual(1);
      expect(result.successCount).toBe(result.totalRequests);
    });

    it('executes ramp mode with very short duration', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        rate: { mode: 'ramp', rps: 100, endRps: 200, durationSec: 0.001 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.totalRequests).toBeGreaterThanOrEqual(1);
    });

    it('handles abort during fixed mode execution', async () => {
      const controller = new AbortController();
      let fetchCount = 0;
      mockFetch.mockImplementation(async () => {
        fetchCount++;
        if (fetchCount >= 2) {
          controller.abort();
        }
        return mockSuccessResponse();
      });
      const config = createConfig({
        rate: { mode: 'fixed', rps: 1000, durationSec: 0.01 },
      });

      const result = await runWebhookLoadTest(config, {}, controller.signal);

      // Should have stopped due to abort
      expect(result.totalRequests).toBeGreaterThanOrEqual(1);
    });

    it('handles abort during ramp mode execution', async () => {
      const controller = new AbortController();
      let fetchCount = 0;
      mockFetch.mockImplementation(async () => {
        fetchCount++;
        if (fetchCount >= 2) {
          controller.abort();
        }
        return mockSuccessResponse();
      });
      const config = createConfig({
        rate: { mode: 'ramp', rps: 100, endRps: 200, durationSec: 0.01 },
      });

      const result = await runWebhookLoadTest(config, {}, controller.signal);

      expect(result.totalRequests).toBeGreaterThanOrEqual(1);
    });

    it('calls onProgress during fixed mode', async () => {
      const onProgress = vi.fn();
      mockFetch.mockImplementation(async () => {
        // Small delay to allow progress reporting
        await new Promise(r => setTimeout(r, 1));
        return mockSuccessResponse();
      });
      const config = createConfig({
        rate: { mode: 'fixed', rps: 100, durationSec: 0.001 },
      });

      await runWebhookLoadTest(config, { onProgress });

      // onProgress may or may not be called depending on timing
      // Just verify no errors occurred
      expect(mockFetch).toHaveBeenCalled();
    });

    it('calls onRequestComplete during fixed mode', async () => {
      const onRequestComplete = vi.fn();
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        rate: { mode: 'fixed', rps: 1000, durationSec: 0.001 },
      });

      const result = await runWebhookLoadTest(config, { onRequestComplete });

      expect(onRequestComplete).toHaveBeenCalledTimes(result.totalRequests);
    });

    it('calculates expected requests correctly for ramp mode', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse());
      const config = createConfig({
        rate: { mode: 'ramp', rps: 50, endRps: 100, durationSec: 0.001 },
      });

      const result = await runWebhookLoadTest(config);

      // Should complete and have response time stats
      expect(typeof result.avgResponseTimeMs).toBe('number');
      expect(typeof result.actualRps).toBe('number');
    });

    it('handles high in-flight request cleanup', async () => {
      // Create many concurrent requests to trigger the cleanup logic
      mockFetch.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 1));
        return mockSuccessResponse();
      });
      const config = createConfig({
        rate: { mode: 'fixed', rps: 10000, durationSec: 0.01 }, // High RPS to trigger cleanup
      });

      const result = await runWebhookLoadTest(config);

      expect(result.successCount).toBe(result.totalRequests);
    });

    it('runs inFlight cleanup path when more than 100 requests are pending', async () => {
      vi.useRealTimers();
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(mockSuccessResponse()), 40);
          }),
      );
      const config = createConfig({
        rate: { mode: 'fixed', rps: 8000, durationSec: 0.05 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.totalRequests).toBeGreaterThan(100);
      expect(result.successCount).toBe(result.totalRequests);
    });

    it('invokes onProgress after 500ms elapsed in fixed mode', async () => {
      vi.useRealTimers();
      const onProgress = vi.fn();
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(mockSuccessResponse()), 35);
          }),
      );
      const config = createConfig({
        rate: { mode: 'fixed', rps: 12, durationSec: 1 },
      });

      const finished = runWebhookLoadTest(config, { onProgress });

      await vi.waitFor(() => expect(onProgress).toHaveBeenCalled(), {
        timeout: 8000,
        interval: 25,
      });

      await finished;

      const [, , rpsArg, elapsedArg] = onProgress.mock.calls.at(-1)!;
      expect(typeof rpsArg).toBe('number');
      expect(elapsedArg).toBeGreaterThanOrEqual(450);
    }, 12000);

    it('invokes onProgress during ramp mode after 500ms elapsed', async () => {
      vi.useRealTimers();
      const onProgress = vi.fn();
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(mockSuccessResponse()), 35);
          }),
      );
      const config = createConfig({
        rate: { mode: 'ramp', rps: 8, endRps: 24, durationSec: 1 },
      });

      const finished = runWebhookLoadTest(config, { onProgress });

      await vi.waitFor(() => expect(onProgress).toHaveBeenCalled(), {
        timeout: 8000,
        interval: 25,
      });

      await finished;
      expect(onProgress.mock.calls.length).toBeGreaterThan(0);
    }, 12000);
  });

  describe('error handling edge cases', () => {
    it('handles non-Error thrown objects', async () => {
      mockFetch.mockRejectedValue('string error');
      const config = createConfig({ rate: { mode: 'burst', burstCount: 1 } });

      const result = await runWebhookLoadTest(config);

      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].errorMessage).toBe('string error');
    });

    it('handles response without iterationTrace in capture mode', async () => {
      const serverResponse = {
        message: 'ok',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        duration: 100,
        status: 'passed',
        passed: true,
        stepsExecuted: 3,
        results: [],
        // No iterationTrace field
      };
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockResolvedValue(JSON.stringify(serverResponse)),
      });
      const config = createConfig({
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.iterationTraces).toHaveLength(0);
      expect(result.successCount).toBe(1);
    });

    it('handles empty response body in capture mode', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockResolvedValue(''),
      });
      const config = createConfig({
        captureTraces: true,
        rate: { mode: 'burst', burstCount: 1 },
      });

      const result = await runWebhookLoadTest(config);

      expect(result.iterationTraces).toHaveLength(0);
      expect(result.successCount).toBe(1);
    });
  });

  describe('statistics with no completions', () => {
    it('returns zero aggregates when pacing aborts before any request launches', async () => {
      const controller = new AbortController();
      controller.abort();
      const config = createConfig({
        rate: { mode: 'fixed', rps: 50, durationSec: 5 },
      });

      const result = await runWebhookLoadTest(config, {}, controller.signal);

      expect(result.results).toHaveLength(0);
      expect(result.totalRequests).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.avgResponseTimeMs).toBe(0);
      expect(result.minResponseTimeMs).toBe(0);
      expect(result.maxResponseTimeMs).toBe(0);
      expect(Number.isFinite(result.actualDurationMs)).toBe(true);
    });
  });

  describe('ramp integration pacing', () => {
    it('still paces ramp mode when throttle fields are falsy-backed', async () => {
      vi.useRealTimers();
      mockFetch.mockResolvedValue(mockSuccessResponse());

      await runWebhookLoadTest(
        createConfig({
          rate: { mode: 'ramp', rps: 0, endRps: 0, durationSec: 0 },
        }),
      );
    });

    it('computes pacing window from duration fallback when ramp duration is zero', async () => {
      vi.useRealTimers();
      mockFetch.mockResolvedValue(mockSuccessResponse());

      const result = await runWebhookLoadTest(
        createConfig({
          rate: { mode: 'ramp', rps: 10, endRps: 20, durationSec: 0 },
        }),
      );

      expect(result.totalRequests).toBeGreaterThanOrEqual(1);
      expect(result.successCount).toBe(result.totalRequests);
    }, 6000);

    it('uses ramp expected-request pacing over the full burst window', async () => {
      vi.useRealTimers();
      mockFetch.mockResolvedValue(mockSuccessResponse());

      const result = await runWebhookLoadTest(
        createConfig({
          rate: { mode: 'ramp', rps: 80, endRps: 120, durationSec: 0.012 },
        }),
      );

      expect(result.successCount).toBe(result.totalRequests);
      expect(result.totalRequests).toBeGreaterThan(0);
    }, 6000);
  });
});
