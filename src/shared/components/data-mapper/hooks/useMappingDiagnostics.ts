import { useMemo } from 'react';
import type { MapperSource, MapperTarget, Mapping } from '../types';
import type { MapperRepairIssue } from '../ValidationRepairPanel';
import type { TypeMismatch } from '../utils/typeMismatch';
import { buildJsonTree, getAllLeafPaths } from '../../../utils/jsonTreeModel';
import { normalizeMapperPath } from '../utils/pathNormalization';
import { buildRepairIssueId } from '../utils/subtreeMapping';

export interface MappingDiagnosticsResult {
  unresolved: number;
  resolved: number;
  issues: MapperRepairIssue[];
}

export function useMappingDiagnostics(
  mappings: Mapping[],
  activeSourceId: string,
  effectiveSources: MapperSource[],
  effectiveTarget: MapperTarget,
  typeMismatches: TypeMismatch[],
): MappingDiagnosticsResult {
  return useMemo(() => {
    const sourcePathsById = new Map<string, Set<string>>();
    for (const source of effectiveSources) {
      const paths = new Set<string>();
      if (source.sampleData != null) {
        try {
          const parsed = typeof source.sampleData === 'string'
            ? JSON.parse(source.sampleData)
            : source.sampleData;
          const tree = buildJsonTree(parsed, '', '');
          for (const path of getAllLeafPaths(tree)) {
            paths.add(normalizeMapperPath(path));
          }
        } catch {
          // Keep empty set when sample cannot be parsed.
        }
      }
      sourcePathsById.set(source.id, paths);
    }

    const targetPaths = new Set<string>();
    if (effectiveTarget.sampleData != null) {
      try {
        const parsed = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData)
          : effectiveTarget.sampleData;
        const tree = buildJsonTree(parsed, '', '');
        for (const path of getAllLeafPaths(tree)) {
          targetPaths.add(normalizeMapperPath(path));
        }
      } catch {
        // Keep empty set when target sample cannot be parsed.
      }
    } else if (effectiveTarget.fields && effectiveTarget.fields.length > 0) {
      for (const field of effectiveTarget.fields) {
        targetPaths.add(normalizeMapperPath(field.path));
      }
    }

    let unresolved = 0;
    const issues: MapperRepairIssue[] = [];
    const mappingsByNormalizedTarget = new Map<string, Mapping[]>();

    for (const mapping of mappings) {
      const sourceId = mapping.sourceId || activeSourceId;
      const sourcePath = normalizeMapperPath(mapping.sourcePath);
      const targetPath = normalizeMapperPath(mapping.targetPath);
      const sourceSet = sourcePathsById.get(sourceId);
      const sourceHasData = sourceSet != null && sourceSet.size > 0;
      const sourceMissing = sourceHasData && !sourceSet.has(sourcePath);
      const targetMissing = targetPaths.size === 0 || !targetPaths.has(targetPath);
      if (sourceMissing || targetMissing) unresolved += 1;

      if (targetMissing) {
        issues.push({
          id: buildRepairIssueId('missing-target', mapping.id, mapping.sourcePath, mapping.targetPath),
          kind: 'missing-target',
          severity: 'error',
          message: `Target "${mapping.targetPath}" is not present in the current target schema.`,
          mappingId: mapping.id,
          sourceId,
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
        });
      }

      if (sourceMissing) {
        issues.push({
          id: buildRepairIssueId('unresolved-path', mapping.id, mapping.sourcePath, mapping.targetPath),
          kind: 'unresolved-path',
          severity: 'warning',
          message: `Source "${mapping.sourcePath}" cannot be resolved from source "${sourceId}".`,
          mappingId: mapping.id,
          sourceId,
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
        });
      }

      const duplicates = mappingsByNormalizedTarget.get(targetPath) ?? [];
      duplicates.push(mapping);
      mappingsByNormalizedTarget.set(targetPath, duplicates);
    }

    for (const duplicates of mappingsByNormalizedTarget.values()) {
      if (duplicates.length < 2) continue;
      for (const mapping of duplicates.slice(1)) {
        issues.push({
          id: buildRepairIssueId('duplicate-target', mapping.id, mapping.sourcePath, mapping.targetPath),
          kind: 'duplicate-target',
          severity: 'warning',
          message: `Target "${mapping.targetPath}" has ${duplicates.length} competing mappings.`,
          mappingId: mapping.id,
          sourceId: mapping.sourceId || activeSourceId,
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
        });
      }
    }

    for (const mismatch of typeMismatches) {
      const mapping = mappings.find((item) => item.id === mismatch.mappingId);
      if (!mapping) continue;
      issues.push({
        id: buildRepairIssueId('type-mismatch', mapping.id, mapping.sourcePath, mapping.targetPath),
        kind: 'type-mismatch',
        severity: mismatch.severity === 'warning' ? 'warning' : 'info',
        message: mismatch.message,
        mappingId: mapping.id,
        sourceId: mapping.sourceId || activeSourceId,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        suggestedFixExpression: mismatch.suggestedFix,
        suggestedOperator: mismatch.suggestedOperator,
      });
    }

    const severityRank: Record<'error' | 'warning' | 'info', number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    issues.sort(
      (left, right) => severityRank[left.severity] - severityRank[right.severity]
        || left.kind.localeCompare(right.kind)
        || left.targetPath.localeCompare(right.targetPath),
    );

    return { unresolved, resolved: Math.max(mappings.length - unresolved, 0), issues };
  }, [mappings, activeSourceId, effectiveSources, effectiveTarget.sampleData, effectiveTarget.fields, typeMismatches]);
}
