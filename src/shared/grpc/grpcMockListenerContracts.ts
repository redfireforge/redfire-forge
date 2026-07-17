/**
 * Phase 11M — network gRPC mock listener contracts (web + desktop).
 */
import type { GrpcMockLatencyPolicy } from './grpcMockLatencySimulation';
import type { GrpcMockRuleSet } from './grpcMockRuleContracts';

export const GRPC_MOCK_LISTENER_PORT_MIN = 50061;
export const GRPC_MOCK_LISTENER_PORT_MAX = 50160;

export type GrpcMockListenerLogEvent =
  | 'listener-start'
  | 'listener-stop'
  | 'rpc-unary'
  | 'rpc-server-stream'
  | 'rpc-client-stream'
  | 'rpc-bidi-stream'
  | 'error';

export interface GrpcMockListenerLogEntry {
  id: number;
  ts: string;
  event: GrpcMockListenerLogEvent;
  service?: string;
  method?: string;
  ruleName?: string;
  statusCode?: number;
  generation?: number;
  detail?: string;
}

export interface GrpcMockListenerStartRequest {
  tabId: string;
  connectionId: string;
  descriptorKey: string;
  protosetBase64?: string;
  contentSha256?: string;
  ruleSet: GrpcMockRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
  port?: number;
}

export interface GrpcMockListenerCommitRequest {
  tabId: string;
  ruleSet: GrpcMockRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
}

export interface GrpcMockListenerStatus {
  running: boolean;
  tabId: string;
  listenTarget?: string;
  port?: number;
  generation: number;
  connectionId?: string;
  descriptorKey?: string;
  inFlightCount: number;
  lastError?: string;
  startedAt?: string;
}

export interface GrpcMockListenerStartResult {
  status: GrpcMockListenerStatus;
}

export interface GrpcMockListenerCommitResult {
  generation: number;
  committedAt: string;
}

export interface GrpcMockListenerLogsResult {
  entries: GrpcMockListenerLogEntry[];
  nextCursor: number;
}
