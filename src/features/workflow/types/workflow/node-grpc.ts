/**
 * Phase 6A — gRPC workflow node config contracts.
 *
 * Execution handlers, config panels, and palette entries ship in Phase 6C–6G.
 * Types and validators are frozen here for graph-time validation and Phase 6B snapshot builder.
 */
import type { GrpcAuthConfig, GrpcTlsConfig, GrpcTlsMode } from '@shared/grpc/contracts';

export type GrpcWorkflowOnErrorPolicy = 'fail' | 'continue';

export interface GrpcWorkflowRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  /** gRPC status codes eligible for transport retry; defaults to transport/unavailable set in 6C. */
  retryOnStatuses?: number[];
}

export interface GrpcWorkflowBaseConfig {
  label: string;
  /** Literal host:port, in-process name, or env template such as {{grpcHost}}. */
  target: string;
  /** Optional connection profile id — resolved at runtime (Phase 6B). */
  connectionId?: string;
  /** Transport TLS mode; defaults to `disabled` when omitted. */
  tlsMode?: GrpcTlsMode;
  /** PEM material for TLS/mTLS — same shape as gRPC Studio connection settings. */
  tlsConfig?: GrpcTlsConfig;
  descriptorKey: string;
  service: string;
  method: string;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  /** Per-node override; defaults to 30_000 ms when omitted. */
  timeoutMs?: number;
  retry?: GrpcWorkflowRetryPolicy;
  onError?: GrpcWorkflowOnErrorPolicy;
  /** Namespace alias for downstream expressions, e.g. createOrder → {{grpc.createOrder.*}} */
  saveAs?: string;
}

export interface GrpcUnaryNodeData extends GrpcWorkflowBaseConfig {
  [key: string]: unknown;
  callType: 'unary';
  body: Record<string, unknown>;
}

export interface GrpcServerStreamCollectConfig {
  maxMessages?: number;
  untilExpression?: string;
  maxDurationMs?: number;
}

export interface GrpcServerStreamNodeData extends GrpcWorkflowBaseConfig {
  [key: string]: unknown;
  callType: 'server_streaming';
  body: Record<string, unknown>;
  collect: GrpcServerStreamCollectConfig;
}

export type GrpcAssertStatusAssertion = { grpcStatus: number };

export type GrpcAssertFieldAssertion = {
  grpcField: string;
  equals?: unknown;
  contains?: unknown;
  exists?: boolean;
};

export type GrpcAssertTrailerAssertion = {
  grpcTrailer: string;
  equals?: string;
  exists?: boolean;
};

export type GrpcAssertDurationAssertion = {
  grpcDuration: { max?: number; min?: number };
};

export type GrpcAssertStreamLengthAssertion = {
  grpcStreamLength: { equals?: number; min?: number; max?: number };
};

export type GrpcWorkflowAssertion =
  | GrpcAssertStatusAssertion
  | GrpcAssertFieldAssertion
  | GrpcAssertTrailerAssertion
  | GrpcAssertDurationAssertion
  | GrpcAssertStreamLengthAssertion;

export interface GrpcAssertNodeData {
  [key: string]: unknown;
  label: string;
  /** Upstream gRPC call node id or saveAs alias from grpcUnary/grpcServerStream. */
  source: string;
  assertions: GrpcWorkflowAssertion[];
  onError?: GrpcWorkflowOnErrorPolicy;
}

/** Persisted per-step outcome shape (Phase 6F publication; frozen in 6A). */
export interface GrpcWorkflowStepResult {
  nodeId: string;
  callType: 'unary' | 'server_streaming';
  status: 'success' | 'failed' | 'skipped';
  grpcStatus?: number;
  grpcStatusMessage?: string;
  durationMs?: number;
  body?: Record<string, unknown>;
  messages?: Record<string, unknown>[];
  trailers?: Record<string, string>;
  errorDetail?: string;
  assertionFailures?: string[];
  /** Server-stream collection stop reason (Phase 6D diagnostics). */
  streamStopReason?: string;
}

/** Phase 6G — per-node gRPC diagnostics surfaced in NodeRunStatus.grpcMeta. */
export interface GrpcNodeStatusMeta {
  service: string;
  method: string;
  target: string;
  callType: 'unary' | 'server_streaming' | 'assert';
  grpcStatus?: number;
  grpcStatusMessage?: string;
  messageCount?: number;
  streamStopReason?: string;
  attempts?: number;
  assertionFailures?: string[];
  bodyPreview?: string;
}

export const GRPC_WORKFLOW_NODE_TYPES = [
  'grpcUnary',
  'grpcServerStream',
  'grpcAssert',
] as const;

export type GrpcWorkflowNodeType = (typeof GRPC_WORKFLOW_NODE_TYPES)[number];

export function isGrpcWorkflowNodeType(type: string | undefined): type is GrpcWorkflowNodeType {
  return GRPC_WORKFLOW_NODE_TYPES.includes(type as GrpcWorkflowNodeType);
}

export function isGrpcWorkflowNodeTypeIncludingAdvanced(type: string | undefined): boolean {
  if (type == null) return false;
  if (isGrpcWorkflowNodeType(type)) return true;
  return type === 'grpcLoadTest' || type === 'grpcSchemaDiff' || type === 'grpcMockAssert';
}

export function isGrpcWorkflowCallNodeType(type: string | undefined): boolean {
  return type === 'grpcUnary' || type === 'grpcServerStream';
}
