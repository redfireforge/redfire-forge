import type { Mapping, MapperSource, MapperTarget } from '../types';
import { getByPath } from '../../../utils/jsonPath';
import { coerceSampleData, resolveSourceValue, resolveTargetValue as resolveTargetVal, toJsonPathRef } from './mapperParsing';

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
  'string→number': '$parseFloat($.PATH)',
  'string→boolean': '$toBool($.PATH)',
  'number→string': '$toString($.PATH)',
  'boolean→string': '$toString($.PATH)',
  'boolean→number': '$toInt($.PATH)',
  'number→boolean': '$toBool($.PATH)',
  'array→string': '$join($.PATH, ", ")',
  'string→array': '$split($.PATH, ",")',
  'array→number': '$count($.PATH)',
  'array→boolean': '$toBool($count($.PATH))',
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
export function resolveTargetType(
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
    const sample = coerceSampleData(target.sampleData);
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
  activeSourceId?: string,
): string | null {
  const val = resolveSourceValue(mapping, sources, activeSourceId);
  if (val === undefined) return null;
  return inferType(val);
}

/**
 * Check whether a string value looks like an ISO/common date format.
 */
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/,       // ISO 8601
  /^\d{2}\/\d{2}\/\d{4}/,                     // MM/DD/YYYY or DD/MM/YYYY
  /^\d{4}\/\d{2}\/\d{2}/,                     // YYYY/MM/DD
  /^\w{3},\s\d{2}\s\w{3}\s\d{4}/,             // RFC 2822
];

export function looksLikeDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return DATE_PATTERNS.some((rx) => rx.test(value));
}

/**
 * Check whether two types are compatible (no mismatch).
 */
export function typesCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  if (targetType === 'any') return true;
  if (sourceType === 'null' && targetType === 'null') return true;
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
  activeSourceId?: string,
): TypeMismatch[] {
  const mismatches: TypeMismatch[] = [];

  for (const mapping of mappings) {
    if (mapping.expression) continue;

    const sourceType = resolveSourceType(mapping, sources, activeSourceId);
    const targetType = resolveTargetType(mapping.targetPath, target);

    if (!sourceType || !targetType) continue;
    if (typesCompatible(sourceType, targetType)) continue;

    const fixKey = `${sourceType}→${targetType}`;
    const template = FIX_MAP[fixKey];
    const normalizedPath = toJsonPathRef(mapping.sourcePath);
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

  // Second pass: detect date-like strings that may need format conversion
  for (const mapping of mappings) {
    if (mapping.expression) continue;
    if (mismatches.some((m) => m.mappingId === mapping.id)) continue;

    const sourceVal = resolveSourceValue(mapping, sources, activeSourceId);
    const targetVal = resolveTargetVal(mapping.targetPath, target);

    if (sourceVal === undefined || targetVal === undefined) continue;
    const srcIsDate = looksLikeDate(sourceVal);
    const tgtIsDate = looksLikeDate(targetVal);

    if (srcIsDate && !tgtIsDate && typeof targetVal === 'string') {
      const normalizedPath = toJsonPathRef(mapping.sourcePath);
      const suggestedFix = `$formatDate(${normalizedPath}, "YYYY-MM-DD")`;
      mismatches.push({
        mappingId: mapping.id,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        sourceType: 'date-string',
        targetType: 'string',
        severity: 'info',
        message: `Source looks like a date. Try \`${suggestedFix}\` to reformat.`,
        suggestedFix,
      });
    } else if (srcIsDate && tgtIsDate) {
      const normalizedPath = toJsonPathRef(mapping.sourcePath);
      const suggestedFix = `$formatDate(${normalizedPath}, "YYYY-MM-DD")`;
      mismatches.push({
        mappingId: mapping.id,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        sourceType: 'date-string',
        targetType: 'date-string',
        severity: 'info',
        message: `Both values look like dates. Use \`${suggestedFix}\` to normalize format.`,
        suggestedFix,
      });
    }
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

