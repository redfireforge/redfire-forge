/**
 * Phase 11N — gRPC advanced workflow node contracts (load test, schema diff, mock assert).
 */
import type { GrpcLoadTestConfig } from '@shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcWorkflowBaseConfig } from './node-grpc';

export interface GrpcLoadTestNodeData extends GrpcWorkflowBaseConfig {
  [key: string]: unknown;
  callType: 'unary';
  body: Record<string, unknown>;
  /** Inline config — wins over `profileId` when both are set. */
  loadTest?: GrpcLoadTestConfig;
  /** Optional named profile id — inline `loadTest` wins when both set. */
  profileId?: string;
}

export interface GrpcSchemaDiffNodeData {
  [key: string]: unknown;
  label: string;
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  /** Fail the workflow step when breaking changes are detected (default true). */
  failOnBreaking?: boolean;
  saveAs?: string;
  onError?: 'fail' | 'continue';
}

export interface GrpcMockAssertNodeData {
  [key: string]: unknown;
  label: string;
  /** Dialable mock listener target, e.g. 127.0.0.1:50061 */
  listenTarget: string;
  descriptorKey: string;
  service: string;
  method: string;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  timeoutMs?: number;
  expectedStatus?: number;
  /** JSON path into response body for equality check */
  expectedBodyPath?: string;
  expectedBodyValue?: unknown;
  saveAs?: string;
  onError?: 'fail' | 'continue';
}

export interface GrpcWorkflowLoadTestSummaryRef {
  nodeId: string;
  status: 'success' | 'failed';
  runId: string;
  totalCalls: number;
  succeeded: number;
  failed: number;
  p50Ms?: number;
  p95Ms?: number;
  stopReason?: string;
}

export interface GrpcWorkflowSchemaDiffSummaryRef {
  nodeId: string;
  status: 'success' | 'failed';
  breaking: number;
  warning: number;
  info: number;
  leftDescriptorKey: string;
  rightDescriptorKey: string;
}

export const GRPC_WORKFLOW_ADVANCED_NODE_TYPES = [
  'grpcLoadTest',
  'grpcSchemaDiff',
  'grpcMockAssert',
] as const;

export type GrpcWorkflowAdvancedNodeType = (typeof GRPC_WORKFLOW_ADVANCED_NODE_TYPES)[number];

export function isGrpcWorkflowAdvancedNodeType(
  type: string | undefined,
): type is GrpcWorkflowAdvancedNodeType {
  return GRPC_WORKFLOW_ADVANCED_NODE_TYPES.includes(type as GrpcWorkflowAdvancedNodeType);
}
