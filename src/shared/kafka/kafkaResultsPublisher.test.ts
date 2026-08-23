/**
 * Unit tests for kafkaResultsPublisher.ts (Phase 8C)
 *
 * Mock strategy: vi.importActual keeps the real KafkaClientError class so tests can
 * construct realistic error instances; only dispatchKafkaOperation is overridden.
 *
 * Timer strategy: tests that exercise retry delays use vi.useFakeTimers() +
 * vi.advanceTimersByTimeAsync() so the 2 s BASE_DELAY_MS is skipped instantly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeTestRun } from '@test-utils/factories';
import type { KafkaResultsPublishConfig, KafkaRunSummaryEnvelope } from '../types';

// ── Hoisted mock ──────────────────────────────────────────────────────────────

const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));

vi.mock('./kafkaClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./kafkaClient')>();
  return { ...actual, dispatchKafkaOperation: mockDispatch };
});

// ── Import SUT after mock registration ───────────────────────────────────────

import { publishRunResults } from './kafkaResultsPublisher';
import { KafkaClientError } from './kafkaClient';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const enabledConfig: KafkaResultsPublishConfig = {
  enabled: true,
  clusterId: 'cluster-1',
  topic: 'redfireforge.results.summary',
};

const disabledConfig: KafkaResultsPublishConfig = {
  enabled: false,
  clusterId: 'cluster-1',
  topic: 'redfireforge.results.summary',
};

function makeRetryableError(code = 'KAFKA_NETWORK_ERROR'): KafkaClientError {
  return new KafkaClientError('produce', 'network failure', { code, retryable: true });
}

function makeNonRetryableError(code = 'KAFKA_INVALID_ENVELOPE'): KafkaClientError {
  return new KafkaClientError('produce', 'invalid envelope', { code, retryable: false });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publishRunResults', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    // Default: dispatch succeeds immediately (KafkaEnvelope shape)
    mockDispatch.mockResolvedValue({ ok: true, op: 'produce', data: { topic: 'redfireforge.results.summary', sentCount: 1, records: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── (a) Successful publish — envelope assembly ────────────────────────────

  describe('successful publish', () => {
    it('returns published outcome with retryCount 0 and non-negative durationMs', async () => {
      const testRun = makeTestRun({ id: 'run-001' });
      const outcome = await publishRunResults(testRun, enabledConfig);

      expect(outcome.status).toBe('published');
      expect(outcome.retryCount).toBe(0);
      expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('calls dispatchKafkaOperation once with op produce', async () => {
      const testRun = makeTestRun();
      await publishRunResults(testRun, enabledConfig);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith('produce', expect.any(Object));
    });

    it('passes clusterId and topic from config to dispatch', async () => {
      const testRun = makeTestRun();
      await publishRunResults(testRun, enabledConfig);

      const [, request] = mockDispatch.mock.calls[0];
      expect(request.clusterId).toBe('cluster-1');
      expect(request.topic).toBe('redfireforge.results.summary');
    });

    it('envelope message value is valid JSON that parses to KafkaRunSummaryEnvelope', async () => {
      const testRun = makeTestRun({ id: 'run-abc', timestamp: 1_700_000_000_000 });
      await publishRunResults(testRun, enabledConfig);

      const [, request] = mockDispatch.mock.calls[0];
      expect(Array.isArray(request.messages)).toBe(true);
      expect(request.messages).toHaveLength(1);

      const parsed: KafkaRunSummaryEnvelope = JSON.parse(request.messages[0].value);
      expect(parsed.schemaVersion).toBe('1.0');
      expect(parsed.runId).toBe('run-abc');
      expect(parsed.timestamp).toBe(1_700_000_000_000);
    });

    it('message key is set to testRun.id for broker routing and log-compaction', async () => {
      const testRun = makeTestRun({ id: 'run-key-check' });
      await publishRunResults(testRun, enabledConfig);

      const [, request] = mockDispatch.mock.calls[0];
      expect(request.messages[0].key).toBe('run-key-check');
    });

    it('envelope has correct executionMode from testRun.config', async () => {
      const testRun = makeTestRun({ config: { executionMode: 'batch', iterations: 5, concurrency: 2, skipValidation: false, skipAssertions: false, validationOverride: 'default', forceUnordered: 'default', hostMode: 'hardcoded', errorPolicy: 'continue', maxErrors: 0, maxErrorRate: 0, timeoutSec: 0, retryCount: 0, retryDelayMs: 1000 } });
      await publishRunResults(testRun, enabledConfig);

      const parsed: KafkaRunSummaryEnvelope = JSON.parse(mockDispatch.mock.calls[0][1].messages[0].value);
      expect(parsed.executionMode).toBe('batch');
    });

    it('envelope summary contains all 9 required metric fields', async () => {
      const testRun = makeTestRun();
      await publishRunResults(testRun, enabledConfig);

      const parsed: KafkaRunSummaryEnvelope = JSON.parse(mockDispatch.mock.calls[0][1].messages[0].value);
      const s = parsed.summary;
      expect(typeof s.tps).toBe('number');
      expect(typeof s.avgResponseTime).toBe('number');
      expect(typeof s.p95ResponseTime).toBe('number');
      expect(typeof s.p99ResponseTime).toBe('number');
      expect(typeof s.errorRate).toBe('number');
      expect(typeof s.totalRequests).toBe('number');
      expect(typeof s.successfulRequests).toBe('number');
      expect(typeof s.failedRequests).toBe('number');
      expect(typeof s.totalDurationMs).toBe('number');
    });
  });

  // ── (b) Disabled config ───────────────────────────────────────────────────

  describe('disabled config', () => {
    it('returns skipped outcome without calling dispatch', async () => {
      const testRun = makeTestRun();
      const outcome = await publishRunResults(testRun, disabledConfig);

      expect(outcome.status).toBe('skipped');
      expect(outcome.retryCount).toBe(0);
      expect(outcome.durationMs).toBe(0);
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  // ── (c) Max retries exhausted ─────────────────────────────────────────────

  describe('max retries exhausted', () => {
    it('calls dispatch exactly 4 times (1 initial + 3 retries) when always retryable', async () => {
      vi.useFakeTimers();
      mockDispatch.mockRejectedValue(makeRetryableError());

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(mockDispatch).toHaveBeenCalledTimes(4);
      expect(outcome.status).toBe('failed');
      expect(outcome.retryCount).toBe(3);
    });

    it('returns the error code from the last KafkaClientError', async () => {
      vi.useFakeTimers();
      mockDispatch.mockRejectedValue(makeRetryableError('KAFKA_BROKER_TIMEOUT'));

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.errorCode).toBe('KAFKA_BROKER_TIMEOUT');
    });

    it('durationMs is non-negative on all-fail path', async () => {
      vi.useFakeTimers();
      mockDispatch.mockRejectedValue(makeRetryableError());

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── (d) Non-retryable error stops immediately ─────────────────────────────

  describe('non-retryable error', () => {
    it('calls dispatch exactly once and returns failed with retryCount 0', async () => {
      mockDispatch.mockRejectedValue(makeNonRetryableError());

      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(outcome.status).toBe('failed');
      expect(outcome.retryCount).toBe(0);
    });

    it('uses the error code from the non-retryable KafkaClientError', async () => {
      mockDispatch.mockRejectedValue(makeNonRetryableError('KAFKA_INVALID_ENVELOPE'));

      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(outcome.errorCode).toBe('KAFKA_INVALID_ENVELOPE');
    });
  });

  // ── (e) Idempotency — successful first attempt not re-attempted ───────────

  describe('idempotency — successful first attempt', () => {
    it('never calls dispatch a second time after the first succeeds', async () => {
      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(outcome.status).toBe('published');
      expect(outcome.retryCount).toBe(0);
    });
  });

  // ── (f) Total timeout cap ─────────────────────────────────────────────────

  describe('total timeout cap', () => {
    it('stops retrying once total elapsed time exceeds 10 000 ms', async () => {
      vi.useFakeTimers();
      // Each dispatch call takes 3 500 ms to fail (simulates a slow broker):
      //   3500 (dispatch1) + 2000 (wait) + 3500 (dispatch2) + 2000 (wait) + 3500 (dispatch3)
      //   = 14 500 ms elapsed → TIMEOUT fires after dispatch3 (retryCount=2 < MAX_RETRIES=3),
      //   which means only 3 calls instead of the 4 that MAX_RETRIES alone would produce.
      mockDispatch.mockImplementation(
        () =>
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(makeRetryableError()), 3_500),
          ),
      );

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.status).toBe('failed');
      // 3 calls (not 4) proves the TIMEOUT cap fired, not MAX_RETRIES
      expect(mockDispatch).toHaveBeenCalledTimes(3);
      expect(outcome.retryCount).toBe(2);
      expect(outcome.durationMs).toBeGreaterThanOrEqual(10_000);
    });
  });

  // ── (g) Non-KafkaClientError caught ──────────────────────────────────────

  describe('non-KafkaClientError caught', () => {
    it('returns failed outcome with KAFKA_PUBLISH_UNKNOWN code — never throws', async () => {
      mockDispatch.mockRejectedValue(new Error('unexpected network blip'));

      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(outcome.status).toBe('failed');
      expect(outcome.retryCount).toBe(0);
      expect(outcome.errorCode).toBe('KAFKA_PUBLISH_UNKNOWN');
    });

    it('does not retry on a plain Error (no retryable flag)', async () => {
      mockDispatch.mockRejectedValue(new Error('unknown'));

      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(outcome.status).toBe('failed');
    });
  });

  // ── (h) Optional envelope fields ─────────────────────────────────────────

  describe('optional envelope fields', () => {
    it('includes projectName, envName, svcName, workflowName when set on testRun', async () => {
      const testRun = makeTestRun({
        projectName: 'MyProject',
        envName: 'staging',
        svcName: 'auth-service',
        workflowName: 'login-flow',
      });
      await publishRunResults(testRun, enabledConfig);

      const parsed: KafkaRunSummaryEnvelope = JSON.parse(mockDispatch.mock.calls[0][1].messages[0].value);
      expect(parsed.projectName).toBe('MyProject');
      expect(parsed.envName).toBe('staging');
      expect(parsed.svcName).toBe('auth-service');
      expect(parsed.workflowName).toBe('login-flow');
    });

    it('omits optional fields from envelope when testRun has no labels', async () => {
      const testRun = makeTestRun();
      // makeTestRun() does not set optional label fields
      await publishRunResults(testRun, enabledConfig);

      const raw: Record<string, unknown> = JSON.parse(mockDispatch.mock.calls[0][1].messages[0].value);
      expect('projectName' in raw).toBe(false);
      expect('envName' in raw).toBe(false);
      expect('svcName' in raw).toBe(false);
      expect('workflowName' in raw).toBe(false);
    });
  });

  // ── (i) Correct retryCount in partially-succeeded path ───────────────────

  describe('retryCount in outcome', () => {
    it('returns retryCount: 1 when first attempt fails and second succeeds', async () => {
      vi.useFakeTimers();
      mockDispatch
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce({ ok: true, op: 'produce', data: {} });

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.status).toBe('published');
      expect(outcome.retryCount).toBe(1);
      expect(mockDispatch).toHaveBeenCalledTimes(2);
    });

    it('returns retryCount: 2 when first two attempts fail and third succeeds', async () => {
      vi.useFakeTimers();
      mockDispatch
        .mockRejectedValueOnce(makeRetryableError())
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce({ ok: true, op: 'produce', data: {} });

      const promise = publishRunResults(makeTestRun(), enabledConfig);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.status).toBe('published');
      expect(outcome.retryCount).toBe(2);
      expect(mockDispatch).toHaveBeenCalledTimes(3);
    });
  });

  // ── (j) Auth error — secure-profile parity ────────────────────────────────
  // Manual only — requires secure broker profile (SASL/SCRAM-SHA-256).
  // Unit-level proxy: verifies that KAFKA_AUTH_FAILED with retryable:false
  // causes publishRunResults to stop after one attempt (retryCount: 0), exactly
  // matching the behaviour observed in the broker-level 13E scenario.

  describe('auth error — secure-profile parity', () => {
    it('returns failed with KAFKA_AUTH_FAILED code and no retry when broker rejects credentials', async () => {
      mockDispatch.mockRejectedValue(
        new KafkaClientError('produce', 'SASL authentication failed: Invalid credentials', {
          code: 'KAFKA_AUTH_FAILED',
          retryable: false,
        }),
      );

      const outcome = await publishRunResults(makeTestRun(), enabledConfig);

      expect(outcome.status).toBe('failed');
      expect(outcome.retryCount).toBe(0);
      expect(outcome.errorCode).toBe('KAFKA_AUTH_FAILED');
      expect(mockDispatch).toHaveBeenCalledTimes(1); // no retry — auth failures are non-retryable
    });
  });
});
