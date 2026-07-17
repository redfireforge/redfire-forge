import type {
  GrpcProtoHybridFieldValidationState,
  GrpcProtoHybridFieldLevel,
  GrpcProtoHybridValidationSummary,
} from './grpcProtoHybridState';

export type GrpcProtoHybridNodeAggregateStatus = 'error' | 'warning' | 'valid' | 'unknown';

const EMPTY_SUMMARY: GrpcProtoHybridValidationSummary = {
  errors: 0,
  warnings: 0,
  infos: 0,
};

const FIELD_LEVEL_WEIGHT: Record<GrpcProtoHybridFieldLevel, number> = {
  error: 3,
  warning: 2,
  info: 1,
  none: 0,
};

export function summarizeGrpcProtoHybridValidation(
  byPath: Record<string, GrpcProtoHybridFieldValidationState>,
): GrpcProtoHybridValidationSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const field of Object.values(byPath)) {
    if (field.level === 'error') errors += 1;
    else if (field.level === 'warning') warnings += 1;
    else if (field.level === 'info') infos += 1;
  }

  if (errors === 0 && warnings === 0 && infos === 0) {
    return EMPTY_SUMMARY;
  }

  return { errors, warnings, infos };
}

export function aggregateGrpcProtoHybridNodeStatus(
  levels: GrpcProtoHybridFieldLevel[],
): GrpcProtoHybridNodeAggregateStatus {
  if (levels.length === 0) return 'unknown';

  let maxWeight = 0;
  for (const level of levels) {
    const weight = FIELD_LEVEL_WEIGHT[level];
    if (weight > maxWeight) maxWeight = weight;
  }

  if (maxWeight === FIELD_LEVEL_WEIGHT.error) return 'error';
  if (maxWeight === FIELD_LEVEL_WEIGHT.warning) return 'warning';
  if (maxWeight === FIELD_LEVEL_WEIGHT.info || maxWeight === FIELD_LEVEL_WEIGHT.none) {
    return 'valid';
  }
  return 'unknown';
}

export function collectValidationLevelsForPathPrefix(
  byPath: Record<string, GrpcProtoHybridFieldValidationState>,
  pathPrefix: string,
): GrpcProtoHybridFieldLevel[] {
  const normalizedPrefix = pathPrefix.trim();
  if (!normalizedPrefix) {
    return Object.values(byPath).map((entry) => entry.level);
  }

  const withSeparator = normalizedPrefix.endsWith('.') ? normalizedPrefix : `${normalizedPrefix}.`;
  const levels: GrpcProtoHybridFieldLevel[] = [];

  for (const [path, issue] of Object.entries(byPath)) {
    if (path === normalizedPrefix || path.startsWith(withSeparator)) {
      levels.push(issue.level);
    }
  }

  return levels;
}

export function hasGrpcProtoHybridBlockingErrors(summary: GrpcProtoHybridValidationSummary): boolean {
  return summary.errors > 0;
}

export function hasGrpcProtoHybridApplyBlockingState(
  summary: GrpcProtoHybridValidationSummary,
  jsonError: string | null | undefined,
): boolean {
  return summary.errors > 0 || Boolean(jsonError);
}
