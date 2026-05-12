import type { Mapping } from '../types';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import { getAllLeafPaths } from '../../../utils/jsonTreeModel';

export interface HealthStats {
  totalMappings: number;
  totalTargetFields: number;
  mappedTargetFields: number;
  coveragePercent: number;
  brokenCount: number;
  driftWarnings: number;
  driftBreaking: number;
  typeMismatches: number;
}

export function computeHealthStats(
  mappings: Mapping[],
  targetTree: JsonTreeNode | null,
  driftMappingIds?: Map<string, 'warning' | 'breaking'>,
  typeMismatchCount?: number,
): HealthStats {
  const totalMappings = mappings.length;
  const totalTargetFields = targetTree ? getAllLeafPaths(targetTree).length : 0;

  const mappedTargetPaths = new Set(mappings.map((m) => m.targetPath));
  const mappedTargetFields = totalTargetFields > 0
    ? getAllLeafPaths(targetTree!).filter((p) => mappedTargetPaths.has(p)).length
    : 0;

  const coveragePercent = totalTargetFields > 0
    ? Math.round((mappedTargetFields / totalTargetFields) * 100)
    : 0;

  let brokenCount = 0;
  let driftWarnings = 0;
  let driftBreaking = 0;

  if (driftMappingIds) {
    for (const severity of driftMappingIds.values()) {
      if (severity === 'breaking') {
        driftBreaking++;
        brokenCount++;
      } else {
        driftWarnings++;
      }
    }
  }

  return {
    totalMappings,
    totalTargetFields,
    mappedTargetFields,
    coveragePercent,
    brokenCount,
    driftWarnings,
    driftBreaking,
    typeMismatches: typeMismatchCount ?? 0,
  };
}
