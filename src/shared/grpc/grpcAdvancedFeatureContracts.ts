/**
 * Phase 11A - Advanced feature shared contracts.
 *
 * Scope:
 * - Namespace isolation for load test / mock runtime / schema diff result channels.
 * - Unified lifecycle and error model for long-running operations.
 * - Cancellation semantics and transition guardrails.
 * - Phase 11A load-test config validation boundaries (unary-only + safety caps).
 */

import type { GrpcCallType, GrpcTabExecuteSnapshot } from './contracts';
import { validateGrpcTabExecuteSnapshot } from './requestValidation';

export const GRPC_ADVANCED_FEATURE_NAMESPACES = [
  'loadTest',
  'mockRuntime',
  'schemaDiff',
] as const;

export type GrpcAdvancedFeatureNamespace = (typeof GRPC_ADVANCED_FEATURE_NAMESPACES)[number];

export const GRPC_ADVANCED_OPERATION_STATUSES = [
  'idle',
  'validating',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type GrpcAdvancedOperationStatus = (typeof GRPC_ADVANCED_OPERATION_STATUSES)[number];

export const GRPC_ADVANCED_OPERATION_ERROR_CATEGORIES = [
  'validation',
  'runtime',
  'timeout',
  'io',
  'internal',
] as const;

export type GrpcAdvancedOperationErrorCategory =
  (typeof GRPC_ADVANCED_OPERATION_ERROR_CATEGORIES)[number];

export interface GrpcAdvancedOperationError {
  category: GrpcAdvancedOperationErrorCategory;
  message: string;
  code?: string;
  retriable?: boolean;
  details?: Record<string, unknown>;
}

export interface GrpcAdvancedOperationState {
  status: GrpcAdvancedOperationStatus;
  operationId?: string;
  startedAt?: string;
  completedAt?: string;
  cancellationRequested: boolean;
  error?: GrpcAdvancedOperationError;
}

export interface GrpcAdvancedFeatureRuntimeState {
  loadTest: GrpcAdvancedOperationState;
  mockRuntime: GrpcAdvancedOperationState;
  schemaDiff: GrpcAdvancedOperationState;
}

const GRPC_ADVANCED_ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<GrpcAdvancedOperationStatus, readonly GrpcAdvancedOperationStatus[]>
> = {
  idle: ['idle', 'validating'],
  validating: ['validating', 'running', 'failed', 'cancelled'],
  running: ['running', 'completed', 'failed', 'cancelled'],
  completed: ['completed', 'idle'],
  failed: ['failed', 'idle'],
  cancelled: ['cancelled', 'idle'],
};

export function canTransitionGrpcAdvancedOperationStatus(
  from: GrpcAdvancedOperationStatus,
  to: GrpcAdvancedOperationStatus,
): boolean {
  return GRPC_ADVANCED_ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function createInitialGrpcAdvancedOperationState(): GrpcAdvancedOperationState {
  return {
    status: 'idle',
    cancellationRequested: false,
  };
}

export function createInitialGrpcAdvancedFeatureRuntimeState(): GrpcAdvancedFeatureRuntimeState {
  return {
    loadTest: createInitialGrpcAdvancedOperationState(),
    mockRuntime: createInitialGrpcAdvancedOperationState(),
    schemaDiff: createInitialGrpcAdvancedOperationState(),
  };
}

function defaultGrpcAdvancedOperationFailureError(
  fromStatus: GrpcAdvancedOperationStatus,
): GrpcAdvancedOperationError {
  if (fromStatus === 'validating') {
    return {
      category: 'validation',
      message: 'Advanced operation validation failed',
    };
  }
  return {
    category: 'runtime',
    message: 'Advanced operation failed',
  };
}

export function requestGrpcAdvancedOperationCancellation(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  if (state.status !== 'validating' && state.status !== 'running') {
    return state;
  }
  if (state.cancellationRequested) {
    return state;
  }
  return {
    ...state,
    cancellationRequested: true,
  };
}

export function transitionGrpcAdvancedOperationState(
  state: GrpcAdvancedOperationState,
  nextStatus: GrpcAdvancedOperationStatus,
  options?: {
    operationId?: string;
    error?: GrpcAdvancedOperationError;
    nowIso?: string;
  },
): GrpcAdvancedOperationState {
  if (!canTransitionGrpcAdvancedOperationStatus(state.status, nextStatus)) {
    throw new GrpcAdvancedOperationTransitionError(state.status, nextStatus);
  }

  const nowIso = options?.nowIso ?? new Date().toISOString();
  const next: GrpcAdvancedOperationState = {
    ...state,
    status: nextStatus,
  };

  if (nextStatus === 'running') {
    next.startedAt = state.startedAt ?? nowIso;
    next.operationId = options?.operationId ?? state.operationId;
  }

  if (nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled') {
    next.completedAt = nowIso;
  }

  if (nextStatus === 'failed') {
    next.error = options?.error ?? defaultGrpcAdvancedOperationFailureError(state.status);
  } else {
    next.error = undefined;
  }

  if (nextStatus === 'idle') {
    return createInitialGrpcAdvancedOperationState();
  }

  if (nextStatus === 'cancelled' || nextStatus === 'completed' || nextStatus === 'failed') {
    next.cancellationRequested = false;
  }

  return next;
}

/** Metadata-only patch — status transitions must use transitionGrpcAdvancedOperationState. */
export type GrpcAdvancedOperationStatePatch = Pick<
  Partial<GrpcAdvancedOperationState>,
  'operationId'
>;

export class GrpcAdvancedOperationTransitionError extends Error {
  readonly category = 'validation' as const;
  readonly from: GrpcAdvancedOperationStatus;
  readonly to: GrpcAdvancedOperationStatus;

  constructor(from: GrpcAdvancedOperationStatus, to: GrpcAdvancedOperationStatus) {
    super(`Invalid advanced operation transition: ${from} -> ${to}`);
    this.name = 'GrpcAdvancedOperationTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function patchGrpcAdvancedFeatureNamespaceState(
  state: GrpcAdvancedFeatureRuntimeState,
  namespace: GrpcAdvancedFeatureNamespace,
  patch: GrpcAdvancedOperationStatePatch,
): GrpcAdvancedFeatureRuntimeState {
  return {
    ...state,
    [namespace]: {
      ...state[namespace],
      ...patch,
    },
  };
}

export const GRPC_LOAD_TEST_SAFETY_LIMITS = {
  minConcurrency: 1,
  maxConcurrency: 256,
  minDurationMs: 1_000,
  maxDurationMs: 15 * 60 * 1_000,
  minTotalCalls: 1,
  maxTotalCalls: 1_000_000,
  maxRampUpMs: 5 * 60 * 1_000,
  maxWarmupCalls: 10_000,
} as const;

export interface GrpcLoadTestConfig {
  concurrency: number;
  totalCalls?: number;
  durationMs?: number;
  rampUpMs?: number;
  warmupCalls?: number;
}

export interface GrpcLoadTestConfigIssue {
  path:
    | 'callType'
    | 'concurrency'
    | 'totalCalls'
    | 'durationMs'
    | 'rampUpMs'
    | 'warmupCalls'
    | 'runId'
    | 'executeSnapshot';
  message: string;
}

export class GrpcLoadTestConfigValidationError extends Error {
  readonly category = 'validation' as const;
  readonly issues: GrpcLoadTestConfigIssue[];

  constructor(issues: GrpcLoadTestConfigIssue[]) {
    const firstIssue = issues[0]?.message ?? 'Invalid load-test config';
    super(firstIssue);
    this.name = 'GrpcLoadTestConfigValidationError';
    this.issues = issues;
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function validateGrpcLoadTestConfig(
  callType: GrpcCallType,
  config: GrpcLoadTestConfig,
): GrpcLoadTestConfigIssue[] {
  const issues: GrpcLoadTestConfigIssue[] = [];

  if (callType !== 'unary') {
    issues.push({
      path: 'callType',
      message: 'Phase 11A load testing supports unary calls only.',
    });
  }

  if (!isPositiveInteger(config.concurrency)) {
    issues.push({
      path: 'concurrency',
      message: 'concurrency must be a positive integer.',
    });
  } else if (config.concurrency > GRPC_LOAD_TEST_SAFETY_LIMITS.maxConcurrency) {
    issues.push({
      path: 'concurrency',
      message: `concurrency exceeds max ${GRPC_LOAD_TEST_SAFETY_LIMITS.maxConcurrency}.`,
    });
  }

  if (config.totalCalls == null && config.durationMs == null) {
    issues.push({
      path: 'totalCalls',
      message: 'Either totalCalls or durationMs must be provided.',
    });
  }

  if (config.totalCalls != null) {
    if (!isPositiveInteger(config.totalCalls)) {
      issues.push({
        path: 'totalCalls',
        message: 'totalCalls must be a positive integer.',
      });
    } else if (config.totalCalls > GRPC_LOAD_TEST_SAFETY_LIMITS.maxTotalCalls) {
      issues.push({
        path: 'totalCalls',
        message: `totalCalls exceeds max ${GRPC_LOAD_TEST_SAFETY_LIMITS.maxTotalCalls}.`,
      });
    }
  }

  if (config.durationMs != null) {
    if (!isPositiveInteger(config.durationMs)) {
      issues.push({
        path: 'durationMs',
        message: 'durationMs must be a positive integer.',
      });
    } else if (config.durationMs < GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs) {
      issues.push({
        path: 'durationMs',
        message: `durationMs must be at least ${GRPC_LOAD_TEST_SAFETY_LIMITS.minDurationMs}.`,
      });
    } else if (config.durationMs > GRPC_LOAD_TEST_SAFETY_LIMITS.maxDurationMs) {
      issues.push({
        path: 'durationMs',
        message: `durationMs exceeds max ${GRPC_LOAD_TEST_SAFETY_LIMITS.maxDurationMs}.`,
      });
    }
  }

  if (config.rampUpMs != null) {
    if (!isNonNegativeInteger(config.rampUpMs)) {
      issues.push({
        path: 'rampUpMs',
        message: 'rampUpMs must be a non-negative integer.',
      });
    } else if (config.rampUpMs > GRPC_LOAD_TEST_SAFETY_LIMITS.maxRampUpMs) {
      issues.push({
        path: 'rampUpMs',
        message: `rampUpMs exceeds max ${GRPC_LOAD_TEST_SAFETY_LIMITS.maxRampUpMs}.`,
      });
    } else if (
      config.durationMs != null
      && isPositiveInteger(config.durationMs)
      && config.rampUpMs > config.durationMs
    ) {
      issues.push({
        path: 'rampUpMs',
        message: 'rampUpMs must not exceed durationMs.',
      });
    }
  }

  if (config.warmupCalls != null) {
    if (!isNonNegativeInteger(config.warmupCalls)) {
      issues.push({
        path: 'warmupCalls',
        message: 'warmupCalls must be a non-negative integer.',
      });
    } else if (config.warmupCalls > GRPC_LOAD_TEST_SAFETY_LIMITS.maxWarmupCalls) {
      issues.push({
        path: 'warmupCalls',
        message: `warmupCalls exceeds max ${GRPC_LOAD_TEST_SAFETY_LIMITS.maxWarmupCalls}.`,
      });
    }
  }

  if (
    config.totalCalls != null
    && config.warmupCalls != null
    && isNonNegativeInteger(config.warmupCalls)
    && isPositiveInteger(config.totalCalls)
    && config.warmupCalls >= config.totalCalls
  ) {
    issues.push({
      path: 'warmupCalls',
      message: 'warmupCalls must be lower than totalCalls.',
    });
  }

  return issues;
}

export function assertGrpcLoadTestConfig(
  callType: GrpcCallType,
  config: GrpcLoadTestConfig,
): void {
  const issues = validateGrpcLoadTestConfig(callType, config);
  if (issues.length > 0) {
    throw new GrpcLoadTestConfigValidationError(issues);
  }
}

export function assertGrpcLoadTestRunSnapshot(input: {
  runId: string;
  executeSnapshot: GrpcTabExecuteSnapshot;
  config: GrpcLoadTestConfig;
}): void {
  assertGrpcLoadTestExecuteSnapshotInput(input);
}

export interface GrpcLoadTestExecuteSnapshot {
  runId: string;
  capturedAt: string;
  executeSnapshot: GrpcTabExecuteSnapshot;
  config: GrpcLoadTestConfig;
  resolvedEnvName?: string;
}

export interface GrpcLoadTestExecutionAttempt {
  attemptNumber: number;
  warmup: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  statusCode?: number;
  errorMessage?: string;
}

export type GrpcLoadTestStopReason =
  | 'completed_total_calls'
  | 'completed_duration'
  | 'cancelled';

export interface GrpcLoadTestRunCounts {
  scheduled: number;
  completed: number;
  succeeded: number;
  failed: number;
  warmupScheduled: number;
  warmupCompleted: number;
  peakInFlight: number;
}

export interface GrpcLoadTestRunReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stopReason: GrpcLoadTestStopReason;
  counts: GrpcLoadTestRunCounts;
  attempts: GrpcLoadTestExecutionAttempt[];
}

function assertGrpcLoadTestExecuteSnapshotInput(input: {
  runId: string;
  executeSnapshot: GrpcTabExecuteSnapshot;
  config: GrpcLoadTestConfig;
}): void {
  const issues: GrpcLoadTestConfigIssue[] = [];

  if (!input.runId?.trim()) {
    issues.push({
      path: 'runId',
      message: 'runId is required.',
    });
  }

  for (const snapshotIssue of validateGrpcTabExecuteSnapshot(input.executeSnapshot)) {
    issues.push({
      path: 'executeSnapshot',
      message: `${snapshotIssue.field}: ${snapshotIssue.message}`,
    });
  }

  issues.push(...validateGrpcLoadTestConfig(input.executeSnapshot.callType, input.config));

  if (issues.length > 0) {
    throw new GrpcLoadTestConfigValidationError(issues);
  }
}

export function captureGrpcLoadTestExecuteSnapshot(input: {
  runId: string;
  executeSnapshot: GrpcTabExecuteSnapshot;
  config: GrpcLoadTestConfig;
  resolvedEnvName?: string;
  capturedAt?: string;
}): GrpcLoadTestExecuteSnapshot {
  assertGrpcLoadTestExecuteSnapshotInput(input);
  return {
    runId: input.runId,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    executeSnapshot: structuredClone(input.executeSnapshot),
    config: structuredClone(input.config),
    resolvedEnvName: input.resolvedEnvName,
  };
}
