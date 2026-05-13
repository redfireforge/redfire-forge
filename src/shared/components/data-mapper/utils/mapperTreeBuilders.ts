import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import { buildJsonTree } from '../../../utils/jsonTreeModel';
import { buildTreeFromFields } from './targetTreeBuilder';
import type { MapperTarget } from '../types';

export function parseSampleToTree(data: unknown): JsonTreeNode | null {
  if (data == null) return null;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return buildJsonTree(parsed, '', '');
  } catch {
    return null;
  }
}

export function parseSampleData(data: unknown): unknown | undefined {
  if (data == null) return undefined;
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
}

export interface TargetTreeResult {
  tree: JsonTreeNode | null;
  targetData: unknown;
}

export function buildTargetTree(target: Pick<MapperTarget, 'sampleData' | 'fields'>): TargetTreeResult {
  if (target.sampleData != null) {
    const parsed = parseSampleData(target.sampleData);
    return {
      tree: parsed != null ? buildJsonTree(parsed as Record<string, unknown>, '', '') : null,
      targetData: parsed,
    };
  }
  if ((target.fields?.length ?? 0) > 0) {
    return {
      tree: buildTreeFromFields(target.fields!),
      targetData: undefined,
    };
  }
  return { tree: null, targetData: undefined };
}
