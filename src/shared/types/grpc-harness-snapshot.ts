/**
 * Phase 8B — gRPC harness execution snapshot + runtime boundary contracts.
 */
import type {
  GrpcCallRequest,
  GrpcCallType,
  GrpcStreamStartRequest,
  GrpcTabExecuteSnapshot,
} from '../grpc/contracts';
import type {
  GrpcHarnessAssertion,
  GrpcHarnessCollectConfig,
  GrpcHarnessRetryPolicy,
} from './grpc-harness';

/** Immutable snapshot captured once at harness attempt start. */
export interface GrpcHarnessExecuteSnapshot {
  scenarioId: string;
  scenarioName: string;
  dataRowId?: string;
  dataRowLabel?: string;
  /** Transport-ready payload — same shape as Studio tab execute snapshot. */
  execute: GrpcTabExecuteSnapshot;
  retry?: GrpcHarnessRetryPolicy;
  /** Server/bidi inbound collection — numeric fields only (no untilExpression in harness). */
  collect?: GrpcHarnessCollectConfig;
  /** Client/bidi outbound frames — interpolated at build time. */
  sendMessages?: Record<string, unknown>[];
  /** Assertion config frozen for Phase 8D evaluation; not evaluated in 8B. */
  assertions?: GrpcHarnessAssertion[];
}

/** Runtime boundary passed from harness runner to gRPC transport handlers (8C). */
export interface GrpcHarnessRuntimeCallBoundary {
  snapshot: GrpcHarnessExecuteSnapshot;
  unaryRequest?: GrpcCallRequest;
  streamStartRequest?: GrpcStreamStartRequest;
}

export type GrpcHarnessAttemptPhase =
  | 'pending'
  | 'in_flight'
  | 'succeeded'
  | 'failed'
  | 'aborted';

/** Per-attempt record with an isolated snapshot clone for retries. */
export interface GrpcHarnessAttemptRecord {
  attemptNumber: number;
  snapshot: GrpcHarnessExecuteSnapshot;
  phase: GrpcHarnessAttemptPhase;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
}

/** Session state for a single harness scenario execution with optional retries. */
export interface GrpcHarnessExecutionSession {
  sessionId: string;
  scenarioId: string;
  scenarioName: string;
  canonicalSnapshot: GrpcHarnessExecuteSnapshot;
  maxAttempts: number;
  backoffMs: number;
  retryOnStatuses: number[];
  attempts: GrpcHarnessAttemptRecord[];
}

/** Phase 8C — normalized harness transport outcome before RequestResult mapping (8G expands). */
export type GrpcHarnessStreamStopReason =
  | 'max_messages'
  | 'max_duration'
  | 'stream_end'
  | 'stream_error'
  | 'cancelled'
  | 'transport_error';

export interface GrpcHarnessCallOutcome {
  callType: GrpcCallType;
  passed: boolean;
  grpcStatus?: number;
  grpcStatusMessage?: string;
  durationMs: number;
  body?: Record<string, unknown>;
  messages?: Record<string, unknown>[];
  trailers?: Record<string, string>;
  streamStopReason?: GrpcHarnessStreamStopReason;
  attempts: number;
  errorDetail?: string;
  errorCategory?: 'network' | 'timeout' | 'serialization' | 'internal';
}
