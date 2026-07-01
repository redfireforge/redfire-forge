/**
 * gRPC harness scenario types — Phase 8A.
 *
 * Follows the Kafka / WebSocket harness pattern: one `actionType` (`grpcCall`)
 * with call semantics driven by `grpcCallAction.callType`.
 */
import type {
  GrpcAuthConfig,
  GrpcCallType,
  GrpcTlsMode,
} from '../grpc/contracts';

export type { GrpcCallType };

/** Harness transport action type for runner scenarios. */
export type GrpcHarnessActionType = 'grpcCall';

export interface GrpcHarnessCollectConfig {
  maxMessages?: number;
  maxDurationMs?: number;
}

export interface GrpcHarnessRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryOnStatuses?: number[];
}

export type GrpcHarnessAssertStatusAssertion = { grpcStatus: number };

export type GrpcHarnessAssertFieldAssertion = {
  grpcField: string;
  equals?: unknown;
  contains?: unknown;
  exists?: boolean;
};

export type GrpcHarnessAssertNumericFieldAssertion = {
  grpcNumericField: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value: string | number;
};

export type GrpcHarnessAssertStreamFieldAssertion = {
  grpcStreamField: string;
  index: number;
  equals?: unknown;
  contains?: unknown;
  exists?: boolean;
};

export type GrpcHarnessAssertTrailerAssertion = {
  grpcTrailer: string;
  equals?: string;
  exists?: boolean;
};

export type GrpcHarnessAssertDurationAssertion = {
  grpcDuration: { max?: number; min?: number };
};

export type GrpcHarnessAssertStreamLengthAssertion = {
  grpcStreamLength: { equals?: number; min?: number; max?: number };
};

export type GrpcHarnessAssertion =
  | GrpcHarnessAssertStatusAssertion
  | GrpcHarnessAssertFieldAssertion
  | GrpcHarnessAssertNumericFieldAssertion
  | GrpcHarnessAssertStreamFieldAssertion
  | GrpcHarnessAssertTrailerAssertion
  | GrpcHarnessAssertDurationAssertion
  | GrpcHarnessAssertStreamLengthAssertion;

/** Configuration for a gRPC harness call scenario (`actionType: 'grpcCall'`). */
export interface GrpcHarnessCallActionConfig {
  /** Defaults to `unary` when omitted (backward compatibility). */
  callType?: GrpcCallType;
  /** Literal host:port, in-process name, or env template such as {{grpcHost}}. */
  target: string;
  connectionId?: string;
  tlsMode?: GrpcTlsMode;
  descriptorKey: string;
  service: string;
  method: string;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  timeoutMs?: number;
  retry?: GrpcHarnessRetryPolicy;
  /** Required for server_streaming / bidi_streaming inbound collection. */
  collect?: GrpcHarnessCollectConfig;
  /** Required for client_streaming / bidi_streaming outbound frames. */
  sendMessages?: Record<string, unknown>[];
  assertions?: GrpcHarnessAssertion[];
}
