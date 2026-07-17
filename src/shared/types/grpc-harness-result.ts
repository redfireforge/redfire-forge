/**
 * Phase 8G — gRPC harness result publication model.
 */
import type { GrpcCallType } from '../grpc/contracts';

/** Schema version for downstream consumers — bump on breaking field changes. */
export const GRPC_HARNESS_RESULT_SCHEMA_VERSION = '1.0' as const;

export type GrpcHarnessResultStatus = 'passed' | 'failed' | 'error' | 'timeout';

export type GrpcHarnessErrorCategory =
  | 'network'
  | 'timeout'
  | 'serialization'
  | 'assertion'
  | 'internal';

export interface GrpcHarnessAssertionResult {
  name: string;
  passed: boolean;
  message?: string;
}

/** Machine-readable harness result published on `GrpcResultMeta.harnessResult`. */
export interface GrpcHarnessResult {
  schemaVersion: typeof GRPC_HARNESS_RESULT_SCHEMA_VERSION;
  scenarioId: string;
  dataRowId?: string;
  callType: GrpcCallType;
  status: GrpcHarnessResultStatus;
  grpcStatus?: number;
  grpcStatusMessage?: string;
  durationMs: number;
  body?: Record<string, unknown>;
  messages?: Record<string, unknown>[];
  trailers?: Record<string, string>;
  assertionResults: GrpcHarnessAssertionResult[];
  errorCategory?: GrpcHarnessErrorCategory;
  errorDetail?: string;
}
