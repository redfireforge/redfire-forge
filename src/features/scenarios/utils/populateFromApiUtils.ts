/**
 * Pure utility functions for PopulateFromApiModal.
 * Extracted for testability and reuse.
 */
import type { DataSourceColumn } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────

export interface DetectedArray {
  path: string;
  length: number;
  sampleKeys: string[];
}

export interface FieldMapping {
  field: string;
  colType: DataSourceColumn['type'];
  enabled: boolean;
}

export interface RequestDebugInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ResponseDebugInfo {
  status: number;
  statusText: string;
  error?: string;
  body?: string;
}

// ─── Pure functions ─────────────────────────────────────────

/**
 * Walk a JSON object to find all arrays of objects and their paths.
 * Used to detect which parts of an API response can be extracted as data rows.
 */
export function detectArrays(obj: unknown, prefix = '', _seen?: WeakSet<object>): DetectedArray[] {
  const results: DetectedArray[] = [];
  if (Array.isArray(obj) && obj.length > 0) {
    const firstObj = obj.find((item) => item != null && typeof item === 'object' && !Array.isArray(item));
    if (firstObj) {
      const keys = Object.keys(firstObj as Record<string, unknown>);
      results.push({ path: prefix || '$', length: obj.length, sampleKeys: keys });
    }
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const seen = _seen ?? new WeakSet<object>();
    if (seen.has(obj as object)) return results;
    seen.add(obj as object);
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${key}` : key;
      results.push(...detectArrays(val, p, seen));
    }
  }
  return results;
}

/**
 * Resolve a JSONPath-like string to a value in an object.
 * Supports dot notation, bracket indices, and wildcards via the canonical engine.
 */
export { getByPath as resolvePath } from '@shared/utils/jsonPath';

/**
 * Guess a column type from the field name.
 * Fields ending with "id" are typically path variables, others are validation fields.
 */
export function guessColType(field: string): DataSourceColumn['type'] {
  const lower = field.toLowerCase();
  // Check for exact 'id', underscore suffix '_id', or camelCase suffix 'Id'
  if (lower === 'id' || lower.endsWith('_id') || field.endsWith('Id')) return 'path';
  return 'validate';
}

/**
 * Extract all template tokens ({{variableName}}) from a string.
 * Used to check for unresolved variables before sending a request.
 */
export function collectTemplateTokens(value: string | undefined): string[] {
  if (!value) return [];
  const source = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const matches = source.match(/\{\{\s*[^{}\s]+\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map(m => m.replace(/\s+/g, ''))));
}

/**
 * Check if all template tokens in a request are resolved.
 * Returns an array of unresolved tokens.
 */
export function findUnresolvedTokens(url: string, body: string | undefined, headers: Record<string, string>): string[] {
  const unresolved = new Set<string>();
  for (const token of collectTemplateTokens(url)) unresolved.add(token);
  for (const token of collectTemplateTokens(body)) unresolved.add(token);
  for (const v of Object.values(headers)) {
    for (const token of collectTemplateTokens(v)) unresolved.add(token);
  }
  return Array.from(unresolved);
}

/**
 * Create field mappings for an array's fields, with intelligent defaults.
 * If existing validate columns exist, only pre-enable matching fields.
 */
export function createFieldMappings(
  sampleKeys: string[],
  existingColumns: DataSourceColumn[],
): FieldMapping[] {
  const existingValidateMappings = new Set(
    existingColumns
      .filter(c => c.type === 'validate')
      .map(c => c.mapping.replace(/.*\./, '')),
  );
  const hasExistingValidate = existingValidateMappings.size > 0;
  
  return sampleKeys.map(field => ({
    field,
    colType: guessColType(field),
    enabled: hasExistingValidate ? existingValidateMappings.has(field) : true,
  }));
}

/**
 * Find the best (largest) array in the detected arrays.
 */
export function selectBestArray(arrays: DetectedArray[]): DetectedArray | null {
  if (arrays.length === 0) return null;
  return arrays.reduce((a, b) => b.length > a.length ? b : a, arrays[0]);
}

/**
 * Normalize a string for column matching (trim and lowercase).
 */
export function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Find an existing column that matches a field by name and type.
 */
export function findMatchingColumn(
  columns: DataSourceColumn[],
  fieldName: string,
  colType: DataSourceColumn['type'],
): DataSourceColumn | undefined {
  const fieldNorm = normalizeForMatch(fieldName);
  
  return columns.find(c => c.type === colType && normalizeForMatch(c.mapping ?? '') === fieldNorm)
    || columns.find(c => c.type === colType && normalizeForMatch(c.name) === fieldNorm)
    || (colType === 'validate'
      ? columns.find(c => {
          if (c.type !== 'validate') return false;
          const m = normalizeForMatch(c.mapping ?? '');
          return m.endsWith(`.${fieldNorm}`) || m.endsWith(`[${fieldNorm}]`) || m === fieldNorm;
        })
      : undefined)
    || columns.find(c => c.type === colType && normalizeForMatch(c.name) === fieldNorm);
}

/**
 * Compute a fingerprint for a row based on specific column values.
 * Used for duplicate detection.
 */
export function computeRowFingerprint(
  values: Record<string, string>,
  colIds: string[],
): string {
  return colIds.map(cid => (values[cid] ?? '').trim().toLowerCase()).join('\x00');
}

/**
 * Detect which rows are duplicates of existing data.
 */
export function detectDuplicateRows<T extends Record<string, unknown>>(
  arrayItems: T[],
  enabledMappings: FieldMapping[],
  existingColumns: DataSourceColumn[],
  existingRows: { values: Record<string, string> }[],
): boolean[] {
  if (existingRows.length === 0 || enabledMappings.length === 0) {
    return arrayItems.map(() => false);
  }

  const colIdByField: Record<string, string> = {};
  for (const mapping of enabledMappings) {
    const existing = findMatchingColumn(existingColumns, mapping.field, mapping.colType);
    if (existing) colIdByField[mapping.field] = existing.id;
  }
  
  const colIds = enabledMappings.map(m => colIdByField[m.field]).filter(Boolean);
  if (colIds.length === 0) return arrayItems.map(() => false);
  
  const existingFps = new Set(existingRows.map(row => computeRowFingerprint(row.values, colIds)));
  
  return arrayItems.map(item => {
    const vals: Record<string, string> = {};
    for (const mapping of enabledMappings) {
      const cid = colIdByField[mapping.field];
      if (!cid) continue;
      const val = item[mapping.field];
      vals[cid] = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
    }
    const fp = computeRowFingerprint(vals, colIds);
    return existingFps.has(fp);
  });
}

/**
 * Format a value for display in a table cell, truncating if necessary.
 */
export function formatCellValue(val: unknown, maxLength = 50): string {
  const display = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
  return display.length > maxLength ? display.slice(0, maxLength) + '…' : display;
}

/**
 * Stringify a value for storage in a data source cell.
 */
export function stringifyValue(val: unknown): string {
  return val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
}
