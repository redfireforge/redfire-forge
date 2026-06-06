/**
 * Unit tests for Phase 8A publish types:
 * KafkaResultsPublishConfig, KafkaRunSummaryEnvelope, KafkaPublishOutcome
 *
 * These tests verify structural validity and field constraints — the types
 * are plain interfaces, so tests check that valid objects satisfy the shape
 * and that required/optional fields behave as documented.
 */
import { describe, it, expect } from 'vitest';
import type {
  KafkaResultsPublishConfig,
  KafkaRunSummaryEnvelope,
  KafkaPublishOutcome,
} from '../types/kafka';

// ─── KafkaResultsPublishConfig ────────────────────────────────────────────────

describe('KafkaResultsPublishConfig', () => {
  it('accepts a valid enabled config', () => {
    const cfg: KafkaResultsPublishConfig = {
      enabled: true,
      clusterId: 'cluster-1',
      topic: 'redfireforge.results.summary',
    };
    expect(cfg.enabled).toBe(true);
    expect(cfg.clusterId).toBe('cluster-1');
    expect(cfg.topic).toBe('redfireforge.results.summary');
  });

  it('accepts a disabled config', () => {
    const cfg: KafkaResultsPublishConfig = {
      enabled: false,
      clusterId: 'cluster-1',
      topic: 'redfireforge.results.summary',
    };
    expect(cfg.enabled).toBe(false);
  });

  it('requires all three fields (type-level — runtime guard)', () => {
    // Verify all required fields are present; absence would be a type error at compile time.
    const cfg: KafkaResultsPublishConfig = { enabled: true, clusterId: 'c', topic: 't' };
    expect(Object.keys(cfg)).toEqual(expect.arrayContaining(['enabled', 'clusterId', 'topic']));
  });
});

// ─── KafkaRunSummaryEnvelope ──────────────────────────────────────────────────

describe('KafkaRunSummaryEnvelope', () => {
  const minimalEnvelope: KafkaRunSummaryEnvelope = {
    schemaVersion: '1.0',
    runId: 'run-abc-123',
    timestamp: 1717200000000,
    executionMode: 'batch',
    summary: {
      tps: 12.5,
      avgResponseTime: 80,
      p95ResponseTime: 150,
      p99ResponseTime: 200,
      errorRate: 0.02,
      totalRequests: 500,
      successfulRequests: 490,
      failedRequests: 10,
      totalDurationMs: 40000,
    },
  };

  it('accepts a minimal envelope (no optional fields)', () => {
    expect(minimalEnvelope.schemaVersion).toBe('1.0');
    expect(minimalEnvelope.runId).toBe('run-abc-123');
    expect(minimalEnvelope.executionMode).toBe('batch');
    expect(minimalEnvelope.summary.totalRequests).toBe(500);
    expect(minimalEnvelope.projectName).toBeUndefined();
    expect(minimalEnvelope.envName).toBeUndefined();
    expect(minimalEnvelope.svcName).toBeUndefined();
    expect(minimalEnvelope.workflowName).toBeUndefined();
  });

  it('accepts a fully-populated envelope', () => {
    const full: KafkaRunSummaryEnvelope = {
      ...minimalEnvelope,
      projectName: 'my-project',
      envName: 'staging',
      svcName: 'order-service',
      workflowName: 'checkout-flow',
    };
    expect(full.projectName).toBe('my-project');
    expect(full.envName).toBe('staging');
    expect(full.svcName).toBe('order-service');
    expect(full.workflowName).toBe('checkout-flow');
  });

  it('accepts all ExecutionMode values', () => {
    const modes = ['sequential', 'batch', 'pool', 'load-profile', 'workflow', 'constant-arrival'] as const;
    for (const mode of modes) {
      const env: KafkaRunSummaryEnvelope = { ...minimalEnvelope, executionMode: mode };
      expect(env.executionMode).toBe(mode);
    }
  });

  it('summary contains all required metric fields', () => {
    const { summary } = minimalEnvelope;
    expect(typeof summary.tps).toBe('number');
    expect(typeof summary.avgResponseTime).toBe('number');
    expect(typeof summary.p95ResponseTime).toBe('number');
    expect(typeof summary.p99ResponseTime).toBe('number');
    expect(typeof summary.errorRate).toBe('number');
    expect(typeof summary.totalRequests).toBe('number');
    expect(typeof summary.successfulRequests).toBe('number');
    expect(typeof summary.failedRequests).toBe('number');
    expect(typeof summary.totalDurationMs).toBe('number');
  });

  it('schemaVersion starts at 1.0', () => {
    expect(minimalEnvelope.schemaVersion).toBe('1.0');
  });

  it('does not include featureGroupName (absent by design — runs span multiple groups)', () => {
    // featureGroupName must NOT appear on KafkaRunSummaryEnvelope — this is intentional.
    // A single run can span multiple feature groups so no run-level group label exists.
    expect('featureGroupName' in minimalEnvelope).toBe(false);
  });
});

// ─── KafkaPublishOutcome ──────────────────────────────────────────────────────

describe('KafkaPublishOutcome', () => {
  it('accepts a published outcome', () => {
    const outcome: KafkaPublishOutcome = {
      status: 'published',
      retryCount: 0,
      durationMs: 42,
    };
    expect(outcome.status).toBe('published');
    expect(outcome.retryCount).toBe(0);
    expect(outcome.errorCode).toBeUndefined();
  });

  it('accepts a failed outcome with errorCode', () => {
    const outcome: KafkaPublishOutcome = {
      status: 'failed',
      retryCount: 3,
      errorCode: 'KAFKA_PRODUCE_FAILED',
      durationMs: 3100,
    };
    expect(outcome.status).toBe('failed');
    expect(outcome.retryCount).toBe(3);
    expect(outcome.errorCode).toBe('KAFKA_PRODUCE_FAILED');
  });

  it('accepts a skipped outcome', () => {
    const outcome: KafkaPublishOutcome = {
      status: 'skipped',
      retryCount: 0,
      durationMs: 0,
    };
    expect(outcome.status).toBe('skipped');
  });

  it('accepts all three status values', () => {
    const statuses: KafkaPublishOutcome['status'][] = ['published', 'failed', 'skipped'];
    for (const status of statuses) {
      const o: KafkaPublishOutcome = { status, retryCount: 0, durationMs: 0 };
      expect(o.status).toBe(status);
    }
  });

  it('durationMs is present and numeric', () => {
    const outcome: KafkaPublishOutcome = { status: 'published', retryCount: 0, durationMs: 123 };
    expect(typeof outcome.durationMs).toBe('number');
  });
});
