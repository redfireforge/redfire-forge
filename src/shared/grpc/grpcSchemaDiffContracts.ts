/**
 * Phase 11F - gRPC proto schema diff report contracts.
 *
 * Compares normalized GrpcDescriptor snapshots. UI and snapshot persistence belong to Phase 11G+.
 */

export const GRPC_SCHEMA_DIFF_SEVERITIES = [
  'breaking',
  'non_breaking',
  'informational',
] as const;

export type GrpcSchemaDiffSeverity = (typeof GRPC_SCHEMA_DIFF_SEVERITIES)[number];

export const GRPC_SCHEMA_DIFF_ENTITY_TYPES = [
  'service',
  'method',
  'message',
  'field',
  'enum',
  'enum_value',
] as const;

export type GrpcSchemaDiffEntityType = (typeof GRPC_SCHEMA_DIFF_ENTITY_TYPES)[number];

export const GRPC_SCHEMA_DIFF_CHANGE_TYPES = [
  'added',
  'removed',
  'modified',
  'renamed',
  'doc_comment_changed',
] as const;

export type GrpcSchemaDiffChangeType = (typeof GRPC_SCHEMA_DIFF_CHANGE_TYPES)[number];

export interface GrpcSchemaDiffChange {
  severity: GrpcSchemaDiffSeverity;
  entityType: GrpcSchemaDiffEntityType;
  entityPath: string;
  changeType: GrpcSchemaDiffChangeType;
  description: string;
  /** Optional wire-compatibility or client-handling note (e.g. unknown enum values). */
  caveat?: string;
}

export interface GrpcSchemaDiffSummary {
  breaking: number;
  nonBreaking: number;
  informational: number;
}

export interface GrpcSchemaDiffReport {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  summary: GrpcSchemaDiffSummary;
  changes: GrpcSchemaDiffChange[];
}

export interface GrpcSchemaDiffInput {
  leftDescriptorKey?: string;
  rightDescriptorKey?: string;
  left: import('./contracts').GrpcDescriptor;
  right: import('./contracts').GrpcDescriptor;
  generatedAt?: string;
}

const SEVERITY_RANK: Record<GrpcSchemaDiffSeverity, number> = {
  breaking: 0,
  non_breaking: 1,
  informational: 2,
};

const ENTITY_RANK: Record<GrpcSchemaDiffEntityType, number> = {
  service: 0,
  method: 1,
  message: 2,
  field: 3,
  enum: 4,
  enum_value: 5,
};

export function summarizeGrpcSchemaDiffChanges(
  changes: GrpcSchemaDiffChange[],
): GrpcSchemaDiffSummary {
  let breaking = 0;
  let nonBreaking = 0;
  let informational = 0;

  for (const change of changes) {
    if (change.severity === 'breaking') {
      breaking += 1;
    } else if (change.severity === 'non_breaking') {
      nonBreaking += 1;
    } else {
      informational += 1;
    }
  }

  return { breaking, nonBreaking, informational };
}

export function sortGrpcSchemaDiffChanges(
  changes: GrpcSchemaDiffChange[],
): GrpcSchemaDiffChange[] {
  return [...changes].sort((left, right) => {
    const severityDelta = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const entityDelta = ENTITY_RANK[left.entityType] - ENTITY_RANK[right.entityType];
    if (entityDelta !== 0) {
      return entityDelta;
    }

    const pathDelta = left.entityPath.localeCompare(right.entityPath);
    if (pathDelta !== 0) {
      return pathDelta;
    }

    const changeTypeDelta = left.changeType.localeCompare(right.changeType);
    if (changeTypeDelta !== 0) {
      return changeTypeDelta;
    }

    return left.description.localeCompare(right.description);
  });
}

export function buildGrpcSchemaDiffReport(input: {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  changes: GrpcSchemaDiffChange[];
}): GrpcSchemaDiffReport {
  const changes = sortGrpcSchemaDiffChanges(input.changes);
  return {
    leftDescriptorKey: input.leftDescriptorKey,
    rightDescriptorKey: input.rightDescriptorKey,
    generatedAt: input.generatedAt,
    summary: summarizeGrpcSchemaDiffChanges(changes),
    changes,
  };
}
