/**
 * Runner configuration types — execution modes, load profiles, think time,
 * SLA targets, and TestConfig.
 *
 * Extracted from index.ts (Phase 8 refactor).
 */
import type { ExecutionTraceOptions } from './trace';

export interface ScenarioWeight {
  scenarioId: string;
  weight: number;
}

export type ExecutionMode = 'sequential' | 'batch' | 'pool' | 'load-profile' | 'workflow' | 'constant-arrival';

export type LoadProfileType = 'ramp-up' | 'sustained' | 'spike';

export interface ArrivalRateConfig {
  targetRps: number;
  durationSec: number;
  maxInFlight?: number;
  ramp?: {
    startRps: number;
    endRps: number;
    rampDurationSec: number;
  };
}

export interface LoadProfileConfig {
  type: LoadProfileType;
  durationSec: number;
  maxConcurrency: number;
  rampUpSec?: number;
  spikeConcurrency?: number;
  spikeStartSec?: number;
  spikeDurationSec?: number;
}

export type ErrorPolicy = 'continue' | 'stop-first' | 'stop-threshold';

export type ThinkTimeMode = 'none' | 'constant' | 'uniform' | 'gaussian';

export interface ThinkTimeConfig {
  mode: ThinkTimeMode;
  constantMs?: number;
  minMs?: number;
  maxMs?: number;
  meanMs?: number;
  stdDevMs?: number;
}

/** Configuration for how CorrelationWait nodes behave during load tests. */
export interface CorrelationWaitRunnerConfig {
  /** How to handle the correlation wait during load tests. */
  mode: 'wait-for-real' | 'auto-resume' | 'synthetic-inject';
  /** Delay before synthetic injection (ms). Only used when mode is 'synthetic-inject'. */
  syntheticDelayMs?: number;
  /** Random jitter range (±ms) added to syntheticDelayMs. */
  syntheticJitterMs?: number;
  /** Per-node mock payloads. Key is node ID. If not specified, uses empty object. */
  mockPayloads?: Record<string, Record<string, unknown>>;
}

// ─── SLA types (shared: embedded in TestConfig + used by results feature) ───────────

/**
 * The metrics available for SLA targeting.
 * Field names match the computed fields in ScenarioMetrics for direct indexing.
 */
export type SlaMetric =
  | 'p50'
  | 'p95'
  | 'p99'
  | 'p999'
  | 'avg'
  | 'tps'
  | 'errorRate';

/**
 * A single persistent SLA target.
 *
 * Operator semantics:
 * - `lte` — metric must be ≤ value to pass (latency, error rate — lower is better)
 * - `gte` — metric must be ≥ value to pass (TPS — higher is better)
 *
 * Warn zone (optional):
 * - For `lte`: pass if actual ≤ warnAt, warn if warnAt < actual ≤ value, fail if actual > value
 * - For `gte`: pass if actual ≥ warnAt, warn if value ≤ actual < warnAt, fail if actual < value
 */
export interface SlaTarget {
  /** Stable identity. Use crypto.randomUUID() on creation. */
  id: string;
  metric: SlaMetric;
  operator: 'lte' | 'gte';
  /** Hard pass/fail threshold. */
  value: number;
  /**
   * Optional warn zone boundary (stricter than value).
   * lte: warnAt < value.  gte: warnAt > value.
   */
  warnAt?: number;
  /** Optional user-defined label, e.g. "Cart checkout SLA". */
  label?: string;
  /**
   * Optional: if set, this target applies only to the named scenario/test type.
   * Mutually exclusive with `featureGroupName` — set at most one.
   * If neither is set, target applies to the whole run's aggregate TestSummary.
   */
  scenarioName?: string;
  /**
   * Optional: if set, this target evaluates against the aggregate of all results
   * belonging to the named feature group (computed by `computeFeatureGroupMetrics`).
   * Mutually exclusive with `scenarioName` — set at most one.
   * Feature-group targets are not evaluated by `evaluateSla`/`evaluateSlaForScenario`;
   * use `evaluateSlaTree` (SLA-C3) instead.
   */
  featureGroupName?: string;
}

export interface TestConfig {
  concurrency: number;
  iterations: number;
  scenarioWeights: ScenarioWeight[];
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  arrivalRate?: ArrivalRateConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
  /** Initial variables to seed the workflow's VariableContext */
  workflowVariables?: Record<string, string>;
  /** Reference to a saved workflow definition (enables full graph execution) */
  workflowId?: string;
  /** Configuration for how CorrelationWait nodes behave during load tests */
  correlationWaitConfig?: CorrelationWaitRunnerConfig;
  /** Maximum concurrent poll operations for WaitForCondition nodes. Defaults to 20. */
  maxConcurrentPolls?: number;
  /** Options for trace capture (Results Explorer) */
  traceOptions?: ExecutionTraceOptions;
  /** Base URL for workflow HTTP nodes with relative paths (from environment config). */
  workflowBaseUrl?: string;
  /**
   * Embedded SLA targets (set at run configuration time). Read-only in Results view.
   * Only present when SLA was configured per-run rather than at workflow level.
   */
  slaTargets?: SlaTarget[];
}
