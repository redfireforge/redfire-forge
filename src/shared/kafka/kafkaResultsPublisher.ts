/**
 * kafkaResultsPublisher.ts
 *
 * Client-side publisher: assembles a KafkaRunSummaryEnvelope from a completed TestRun
 * and fires it to a configured Kafka topic via dispatchKafkaOperation('produce', ...).
 *
 * Key design constraints (Phase 8B):
 *  - Never throws — always returns KafkaPublishOutcome.
 *  - Fire-and-forget safe: callers should NOT await this unless they need the outcome.
 *  - Max 3 retries, 2 000 ms fixed delay, 10 000 ms total-timeout cap.
 *  - Only retries on KafkaClientError with retryable: true.
 *  - A successful dispatch is never re-attempted (idempotency).
 */

import type {
  TestRun,
  KafkaResultsPublishConfig,
  KafkaRunSummaryEnvelope,
  KafkaPublishOutcome,
} from '../types';
import { dispatchKafkaOperation, KafkaClientError } from './kafkaClient';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2_000;
const TOTAL_TIMEOUT_MS = 10_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function publishRunResults(
  testRun: TestRun,
  config: KafkaResultsPublishConfig,
): Promise<KafkaPublishOutcome> {
  if (!config.enabled) {
    return { status: 'skipped', retryCount: 0, durationMs: 0 };
  }

  const startMs = Date.now();

  const envelope: KafkaRunSummaryEnvelope = {
    schemaVersion: '1.0',
    runId: testRun.id,
    timestamp: testRun.timestamp,
    executionMode: testRun.config.executionMode,
    summary: {
      tps: testRun.summary.tps,
      avgResponseTime: testRun.summary.avgResponseTime,
      p95ResponseTime: testRun.summary.p95ResponseTime,
      p99ResponseTime: testRun.summary.p99ResponseTime,
      errorRate: testRun.summary.errorRate,
      totalRequests: testRun.summary.totalRequests,
      successfulRequests: testRun.summary.successfulRequests,
      failedRequests: testRun.summary.failedRequests,
      totalDurationMs: testRun.summary.totalDurationMs,
    },
    ...(testRun.projectName !== undefined ? { projectName: testRun.projectName } : {}),
    ...(testRun.envName !== undefined ? { envName: testRun.envName } : {}),
    ...(testRun.svcName !== undefined ? { svcName: testRun.svcName } : {}),
    ...(testRun.workflowName !== undefined ? { workflowName: testRun.workflowName } : {}),
  };

  let retryCount = 0;
  let lastError: Error | null = null;

  while (true) {
    try {
      await dispatchKafkaOperation('produce', {
        clusterId: config.clusterId,
        topic: config.topic,
        messages: [{ value: JSON.stringify(envelope) }],
      });

      return { status: 'published', retryCount, durationMs: Date.now() - startMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const canRetry =
        err instanceof KafkaClientError &&
        err.retryable &&
        retryCount < MAX_RETRIES &&
        Date.now() - startMs < TOTAL_TIMEOUT_MS;

      if (!canRetry) break;

      retryCount++;
      await wait(BASE_DELAY_MS);
    }
  }

  return {
    status: 'failed',
    retryCount,
    errorCode:
      lastError instanceof KafkaClientError ? lastError.code : 'KAFKA_PUBLISH_UNKNOWN',
    durationMs: Date.now() - startMs,
  };
}
