import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Mapping } from '../types';
import { upsertTargetMapping } from './dropMapping';
import {
  getMapperRelativePath,
  isSameMapperPath,
  normalizeMapperPath,
} from './pathNormalization';
import type { MapperRepairIssue } from '../ValidationRepairPanel';

export function findNodeByPath(node: JsonTreeNode, path: string): JsonTreeNode | null {
  if (isSameMapperPath(node.path, path)) return node;
  for (const child of node.children ?? []) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

export function collectLeafPathsFromNode(node: JsonTreeNode): string[] {
  if (!node.children || node.children.length === 0) {
    return node.path ? [node.path] : [];
  }
  return node.children.flatMap(collectLeafPathsFromNode);
}

export function getRelativeSubpath(fullPath: string, parentPath: string): string | null {
  return getMapperRelativePath(fullPath, parentPath);
}

export interface PathPair {
  sourcePath: string;
  targetPath: string;
}

export function getArrayParentPath(path: string): string | null {
  const match = path.match(/^(.*)\[\d+\]$/);
  if (!match) return null;
  return match[1];
}

export function buildRelativePairs(
  sourceLeaves: string[],
  targetLeaves: string[],
  sourceBasePath: string,
  targetBasePath: string,
): PathPair[] {
  const targetByRelative = new Map<string, string>();
  for (const leafPath of targetLeaves) {
    const relative = getRelativeSubpath(leafPath, targetBasePath);
    if (relative == null || targetByRelative.has(relative)) continue;
    targetByRelative.set(relative, leafPath);
  }

  const sourceByTarget = new Map<string, string>();
  for (const leafPath of sourceLeaves) {
    const relative = getRelativeSubpath(leafPath, sourceBasePath);
    if (relative == null) continue;
    const matchedTargetPath = targetByRelative.get(relative);
    if (!matchedTargetPath || sourceByTarget.has(matchedTargetPath)) continue;
    sourceByTarget.set(matchedTargetPath, leafPath);
  }

  return Array.from(sourceByTarget.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([targetPath, sourcePath]) => ({ sourcePath, targetPath }));
}

export function applyDropPairs(
  currentMappings: Mapping[],
  pairs: PathPair[],
  sourceId: string,
  suggestExpression: (sourcePath: string, sourceId: string, targetPath: string) => string | undefined,
): { nextMappings: Mapping[]; insertedCount: number; updatedCount: number; unchangedCount: number } {
  let nextMappings = [...currentMappings];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const pair of pairs) {
    const hadTargetMapping = nextMappings.some((m) => m.targetPath === pair.targetPath);
    const suggestedExpression = suggestExpression(pair.sourcePath, sourceId, pair.targetPath);
    const applied = upsertTargetMapping(
      nextMappings,
      pair.sourcePath,
      sourceId,
      pair.targetPath,
      suggestedExpression,
    );
    if (!applied.changed) {
      unchangedCount += 1;
      continue;
    }
    nextMappings = applied.next;
    if (hadTargetMapping) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  return { nextMappings, insertedCount, updatedCount, unchangedCount };
}

export function buildDropSummary(
  changedCount: number,
  insertedCount: number,
  updatedCount: number,
  options?: { scopeSuffix?: string },
): string {
  const detailParts: string[] = [];
  if (insertedCount > 0) detailParts.push(`${insertedCount} new`);
  if (updatedCount > 0) detailParts.push(`${updatedCount} updated`);
  const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
  const scopeSuffix = options?.scopeSuffix ? ` ${options.scopeSuffix}` : '';
  return `Mapped ${changedCount} field${changedCount !== 1 ? 's' : ''}${detailSuffix}${scopeSuffix}`;
}

export function buildRepairIssueId(
  kind: MapperRepairIssue['kind'],
  mappingId: string,
  sourcePath: string,
  targetPath: string,
): string {
  return `${kind}:${mappingId}:${normalizeMapperPath(sourcePath)}:${normalizeMapperPath(targetPath)}`;
}
