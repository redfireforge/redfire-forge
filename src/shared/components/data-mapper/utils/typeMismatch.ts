import type { Mapping, MapperSource, MapperTarget } from '../types';
import { getByPath } from '../../../utils/jsonPath';

export type MismatchSeverity = 'warning' | 'info';

export interface TypeMismatch {
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  sourceType: string;
  targetType: string;
  severity: MismatchSeverity;
  message: string;
  suggestedFix?: string;
}

const FIX_MAP: Record<string, string> = {
  'string→number': '$parseInt($.PATH)',
  'string→boolean': '$toBool($.PATH)',
  'number→string': '$toString($.PATH)',
  'boolean→string': '$toString($.PATH)',
  'boolean→number': '$toInt($.PATH)',
  'number→boolean': '$toBool($.PATH)',
};

/**
 * Infer the JSON type of a value at runtime.
 */
export function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object'
}

/**
 * Resolve the expected type for a target path.
 * Priority: explicit fieldConstraints > sample data inference.
 */
function resolveTargetType(
  targetPath: string,
  target: MapperTarget,
): string | null {
  if (target.fieldConstraints?.[targetPath]?.type) {
    const ct = target.fieldConstraints[targetPath].type;
    return Array.isArray(ct) ? ct[0] : ct!;
  }
  if (target.fields) {
    const field = target.fields.find((f) => f.path === targetPath);
    if (field?.type) return field.type;
  }
  if (target.sampleData != null) {
    const sample = typeof target.sampleData === 'string'
      ? safeParse(target.sampleData) : target.sampleData;
    if (sample != null) {
      const val = getByPath(sample, targetPath);
      if (val !== undefined) return inferType(val);
    }
  }
  return null;
}

/**
 * Resolve the actual type of the source value for a mapping.
 */
function resolveSourceType(
  mapping: Mapping,
  sources: MapperSource[],
): string | null {
  const src = sources.find((s) => s.id === mapping.sourceId);
  if (!src?.sampleData) return null;
  const data = typeof src.sampleData === 'string'
    ? safeParse(src.sampleData) : src.sampleData;
  if (data == null) return null;
  const val = getByPath(data, mapping.sourcePath);
  if (val === undefined) return null;
  return inferType(val);
}

/**
 * Check whether two types are compatible (no mismatch).
 */
export function typesCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  if (sourceType === 'null' || targetType === 'null') return true;
  if (targetType === 'any') return true;
  return false;
}

/**
 * Build a human-readable mismatch message.
 */
function buildMessage(sourceType: string, targetType: string, suggestedFn?: string): string {
  const base = `Source is ${sourceType}, target expects ${targetType}.`;
  if (suggestedFn) return `${base} Try \`${suggestedFn}\`.`;
  return base;
}

/**
 * Determine the severity of a type mismatch.
 * Scalar-to-scalar is a warning (likely fixable), structural mismatches are info.
 */
function classifySeverity(sourceType: string, targetType: string): MismatchSeverity {
  const scalars = new Set(['string', 'number', 'boolean']);
  if (scalars.has(sourceType) && scalars.has(targetType)) return 'warning';
  return 'info';
}

/**
 * Detect type mismatches for all mappings.
 *
 * Skips mappings that have expressions (the expression is assumed to handle
 * type coercion) and mappings where either side has no inferrable type.
 */
export function detectTypeMismatches(
  mappings: Mapping[],
  sources: MapperSource[],
  target: MapperTarget,
): TypeMismatch[] {
  const mismatches: TypeMismatch[] = [];

  for (const mapping of mappings) {
    if (mapping.expression) continue;

    const sourceType = resolveSourceType(mapping, sources);
    const targetType = resolveTargetType(mapping.targetPath, target);

    if (!sourceType || !targetType) continue;
    if (typesCompatible(sourceType, targetType)) continue;

    const fixKey = `${sourceType}→${targetType}`;
    const template = FIX_MAP[fixKey];
    const normalizedPath = mapping.sourcePath.startsWith('$.') ? mapping.sourcePath : `$.${mapping.sourcePath}`;
    const suggestedFix = template?.replace('$.PATH', normalizedPath);

    mismatches.push({
      mappingId: mapping.id,
      sourcePath: mapping.sourcePath,
      targetPath: mapping.targetPath,
      sourceType,
      targetType,
      severity: classifySeverity(sourceType, targetType),
      message: buildMessage(sourceType, targetType, suggestedFix),
      suggestedFix,
    });
  }

  return mismatches;
}

/**
 * Get the mismatch for a specific mapping id, if any.
 */
export function getMismatchForMapping(
  mismatches: TypeMismatch[],
  mappingId: string,
): TypeMismatch | undefined {
  return mismatches.find((m) => m.mappingId === mappingId);
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
