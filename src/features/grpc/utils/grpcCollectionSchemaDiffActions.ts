/**
 * Phase 11N — Collections schema compare / history drift actions.
 */
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import { computeGrpcSchemaDiff } from '../../../shared/grpc/grpcSchemaDiffEngine';
import type { GrpcSchemaDiffReport } from '../../../shared/grpc/grpcSchemaDiffContracts';

export type GrpcDescriptorResolver = (
  descriptorKey: string,
) => GrpcDescriptor | Promise<GrpcDescriptor>;

export interface GrpcSavedRequestSchemaCompareIntent {
  kind: 'saved_request_schema_compare';
  savedRequestId: string;
  baselineDescriptorKey: string;
  currentDescriptorKey: string;
  /** True when keys differ — UI should open diff without recomputing baseline lookup. */
  keysDiffer: boolean;
}

export interface GrpcHistoryDescriptorDriftIntent {
  kind: 'history_descriptor_drift';
  historyEntryId: string;
  baselineDescriptorKey: string;
  currentDescriptorKey: string;
  service: string;
  method: string;
}

export function buildGrpcSavedRequestSchemaCompareIntent(
  saved: GrpcSavedRequest,
  currentDescriptorKey: string,
): GrpcSavedRequestSchemaCompareIntent {
  const baselineDescriptorKey = saved.descriptorKey.trim();
  const current = currentDescriptorKey.trim();
  return {
    kind: 'saved_request_schema_compare',
    savedRequestId: saved.id,
    baselineDescriptorKey,
    currentDescriptorKey: current,
    keysDiffer: baselineDescriptorKey !== current,
  };
}

export async function compareGrpcSavedRequestSchema(input: {
  saved: GrpcSavedRequest;
  currentDescriptorKey: string;
  resolveDescriptor: GrpcDescriptorResolver;
}): Promise<GrpcSchemaDiffReport> {
  const intent = buildGrpcSavedRequestSchemaCompareIntent(input.saved, input.currentDescriptorKey);
  const [left, right] = await Promise.all([
    input.resolveDescriptor(intent.baselineDescriptorKey),
    input.resolveDescriptor(intent.currentDescriptorKey),
  ]);
  return computeGrpcSchemaDiff({
    leftDescriptorKey: intent.baselineDescriptorKey,
    rightDescriptorKey: intent.currentDescriptorKey,
    left,
    right,
  });
}

export function detectGrpcHistoryDescriptorDrift(
  entry: GrpcCallHistoryEntryV1,
  currentDescriptorKey: string,
): GrpcHistoryDescriptorDriftIntent | undefined {
  const baseline = entry.descriptorKey.trim();
  const current = currentDescriptorKey.trim();
  if (!baseline || baseline === current) {
    return undefined;
  }
  return {
    kind: 'history_descriptor_drift',
    historyEntryId: entry.id,
    baselineDescriptorKey: baseline,
    currentDescriptorKey: current,
    service: entry.service,
    method: entry.method,
  };
}

export async function buildGrpcHistoryDescriptorDriftReport(input: {
  entry: GrpcCallHistoryEntryV1;
  currentDescriptorKey: string;
  resolveDescriptor: GrpcDescriptorResolver;
}): Promise<GrpcSchemaDiffReport | undefined> {
  const intent = detectGrpcHistoryDescriptorDrift(input.entry, input.currentDescriptorKey);
  if (!intent) return undefined;
  const [left, right] = await Promise.all([
    input.resolveDescriptor(intent.baselineDescriptorKey),
    input.resolveDescriptor(intent.currentDescriptorKey),
  ]);
  return computeGrpcSchemaDiff({
    leftDescriptorKey: intent.baselineDescriptorKey,
    rightDescriptorKey: intent.currentDescriptorKey,
    left,
    right,
  });
}
