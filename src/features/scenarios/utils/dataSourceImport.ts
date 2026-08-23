/**
 * Data Source Import Utilities
 *
 * Pure functions for parsing CSV, JSON, Excel, and clipboard data
 * into DataSource columns + rows. Extracted from DataSourceEditor.tsx
 * to reduce component size and enable independent unit testing.
 */
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx-js-style';
import type { DataSourceColumn, DataSourceRow } from '@shared/types';
import type { CsvParseResult } from './csvTemplateTypes';

// ─── Column Header Parsing ───────────────────────────────────

const COLUMN_PREFIXES: { prefix: string; type: DataSourceColumn['type'] }[] = [
  { prefix: 'path:', type: 'path' },
  { prefix: 'param:', type: 'param' },
  { prefix: 'expect:', type: 'validate' },
  { prefix: 'header:', type: 'header' },
  { prefix: 'body:', type: 'body' },
  { prefix: 'validate:', type: 'validate' },
];

/** Parse column header with type prefix (path:name, param:name, expect:jsonPath) */
export function parseColumnHeader(header: string): { type: DataSourceColumn['type']; name: string } {
  for (const { prefix, type } of COLUMN_PREFIXES) {
    if (header.toLowerCase().startsWith(prefix)) {
      return { type, name: header.slice(prefix.length) };
    }
  }
  return { type: 'param', name: header };
}

// ─── CSV Parsing ─────────────────────────────────────────────

/** Parse a CSV line respecting quoted fields */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Clipboard Parsing ──────────────────────────────────────

/** Parse clipboard text (TSV or CSV) into headers + row data */
export function parseClipboardText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parse = (line: string) =>
    delimiter === '\t' ? line.split('\t').map(s => s.trim()) : parseCsvLine(line);

  const headers = parse(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parse);
  return { headers, rows };
}

// ─── JSON Import ─────────────────────────────────────────────

/** Parse JSON import (supports ParameterizedTestJson schema or simple array-of-objects) */
export function parseJsonImport(
  json: unknown,
  existingColumns: DataSourceColumn[],
): { columns: DataSourceColumn[]; rows: DataSourceRow[] } {
  // Schema v1/v2: { version, columns, rows }
  if (json && typeof json === 'object' && 'version' in json && 'rows' in json) {
    const typed = json as {
      columns?: Array<{ id?: string; name: string; type: string; mapping: string }>;
      rows: Array<{ id?: string; label?: string; enabled?: boolean; values: Record<string, unknown>; tags?: string[]; note?: string; isSample?: boolean }>;
    };
    const columns: DataSourceColumn[] = (typed.columns ?? []).map(c => ({
      id: c.id || uuidv4(),
      name: c.name,
      type: (c.type as DataSourceColumn['type']) || 'param',
      mapping: c.mapping || c.name,
    }));
    const rows: DataSourceRow[] = typed.rows.map(r => {
      const values: Record<string, string> = {};
      for (const col of columns) {
        const val = r.values[col.name] ?? r.values[col.mapping] ?? '';
        values[col.id] = typeof val === 'string' ? val : JSON.stringify(val);
      }
      return {
        id: r.id || uuidv4(),
        values,
        enabled: r.enabled !== false,
        ...(r.label ? { label: r.label } : {}),
        ...(r.tags?.length ? { tags: r.tags } : {}),
        ...(r.note ? { note: r.note } : {}),
        ...(r.isSample ? { isSample: true } : {}),
      };
    });
    return { columns, rows };
  }

  // Simple array of objects: [{ vin: "...", channel: "..." }]
  if (Array.isArray(json) && json.length > 0) {
    const keys = Object.keys(json[0]);
    const columns: DataSourceColumn[] = keys.map(key => {
      const existing = existingColumns.find(c => c.name.toLowerCase() === key.toLowerCase());
      if (existing) return existing;
      const { type, name } = parseColumnHeader(key);
      return { id: uuidv4(), name, type, mapping: name };
    });
    const rows: DataSourceRow[] = json.map((item: Record<string, unknown>) => {
      const values: Record<string, string> = {};
      for (const col of columns) {
        const val = item[col.name] ?? item[col.mapping] ?? '';
        values[col.id] = typeof val === 'string' ? val : JSON.stringify(val);
      }
      return { id: uuidv4(), values, enabled: true };
    });
    return { columns, rows };
  }

  throw new Error('Unrecognized JSON format');
}

// ─── Excel Import ────────────────────────────────────────────

/** Convert a CsvParseResult (from Excel/CSV template parser) into DataSource columns + rows */
export function buildColumnsAndRowsFromParseResult(
  result: CsvParseResult,
  existingColumns: DataSourceColumn[],
): { columns: DataSourceColumn[]; rows: DataSourceRow[] } {
  const columns: DataSourceColumn[] = [];
  const colNames = result.columns;
  const skipFields = new Set(['name', 'method', 'url', 'body', 'auth_type']);

  for (const colName of colNames) {
    let type: DataSourceColumn['type'] = 'param';
    let mapping = colName;
    let displayName = colName;

    if (colName.startsWith('path:')) { type = 'path'; mapping = colName.slice(5); displayName = mapping; }
    else if (colName.startsWith('param:')) { type = 'param'; mapping = colName.slice(6); displayName = mapping; }
    else if (colName.startsWith('validate:') || colName.startsWith('expect:')) { type = 'validate'; mapping = colName.startsWith('validate:') ? colName.slice(9) : colName.slice(7); displayName = mapping; }
    else if (colName.startsWith('header:')) { type = 'header'; mapping = colName.slice(7); displayName = mapping; }
    else if (colName.startsWith('body:')) { type = 'body'; mapping = colName.slice(5); displayName = mapping; }
    else if (skipFields.has(colName)) continue;
    else {
      const colInfo = result.columnTypes?.get(colName);
      if (colInfo) {
        type = colInfo.type as DataSourceColumn['type'];
        mapping = colInfo.mapping || colName;
        if (type === 'name' as string) continue;
      } else {
        const existing = existingColumns.find(c => c.name.toLowerCase() === colName.toLowerCase());
        if (existing) { type = existing.type; mapping = existing.mapping; }
      }
      displayName = colName;
    }

    columns.push({ id: uuidv4(), name: displayName, type, mapping });
  }

  const rows: DataSourceRow[] = [];
  for (const parsedRow of result.rows) {
    if (!parsedRow.scenario) continue;
    const values: Record<string, string> = {};
    for (const col of columns) {
      const rawKey = colNames.find(cn =>
        cn === col.name || cn === col.mapping ||
        cn === `path:${col.mapping}` || cn === `param:${col.mapping}` ||
        cn === `validate:${col.mapping}` || cn === `expect:${col.mapping}` ||
        cn === `header:${col.mapping}` || cn === `body:${col.mapping}`
      );
      values[col.id] = rawKey ? (parsedRow.raw[rawKey] ?? '') : '';
    }
    rows.push({ id: uuidv4(), label: parsedRow.scenario.name, values, enabled: true });
  }

  return { columns, rows };
}

/** Simple Excel import: reads first sheet, first row = headers, remaining = data rows. */
export async function parseExcelSimple(
  buffer: ArrayBuffer,
  existingColumns: DataSourceColumn[],
): Promise<{ columns: DataSourceColumn[]; rows: DataSourceRow[] }> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { columns: [], rows: [] };

  const aoa: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (aoa.length < 2) return { columns: [], rows: [] };

  const headerRow = aoa[0].map(h => String(h).trim()).filter(Boolean);
  const columns: DataSourceColumn[] = [];
  const colIds: string[] = [];

  for (const hdr of headerRow) {
    const existing = existingColumns.find(c => c.name.toLowerCase() === hdr.toLowerCase());
    if (existing) {
      columns.push({ ...existing, id: uuidv4() });
      colIds.push(columns[columns.length - 1].id);
    } else {
      const { type, name } = parseColumnHeader(hdr);
      const id = uuidv4();
      columns.push({ id, name, type, mapping: name });
      colIds.push(id);
    }
  }

  const rows: DataSourceRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i];
    if (cells.every(c => !String(c).trim())) continue;
    const values: Record<string, string> = {};
    for (const col of columns) values[col.id] = '';
    for (let j = 0; j < colIds.length; j++) {
      values[colIds[j]] = String(cells[j] ?? '');
    }
    rows.push({ id: uuidv4(), values, enabled: true });
  }

  return { columns, rows };
}

// ─── JSON Path Utilities ─────────────────────────────────────

/**
 * Extract a value from a JSON object using a simple dot/bracket path.
 * Delegates to the canonical `getByPathAsString` engine.
 */
export { getByPathAsString as extractJsonPath } from '@shared/utils/jsonPath';

/**
 * Infer dynamic patterns from existing indexed validate columns.
 * e.g. columns with mappings like "offers[0].code", "offers[1].code"
 * → infers pattern "offers[*].code".
 * Returns patterns NOT already in the explicit contract.
 */
export function inferPatternsFromColumns(
  columns: { type?: string; mapping?: string }[],
  existingContract: Set<string>,
): string[] {
  const seen = new Set<string>();
  const inferred: string[] = [];
  for (const col of columns) {
    if (col.type !== 'validate') continue;
    const m = col.mapping ?? '';
    if (!/\[\d+\]/.test(m)) continue;
    const pattern = m.replace(/\[\d+\]/g, '[*]');
    if (!seen.has(pattern) && !existingContract.has(pattern)) {
      seen.add(pattern);
      inferred.push(pattern);
    }
  }
  return inferred;
}

/** Expand a contract pattern (e.g. "offers[*].offerName") against a real response to find all concrete paths. */
export function expandPatternFromResponse(obj: unknown, pattern: string): string[] {
  const segments = pattern.split(/(\[\*\])/);
  const results: string[] = [];

  function walk(current: unknown, segIdx: number, pathSoFar: string) {
    if (segIdx >= segments.length) {
      results.push(pathSoFar);
      return;
    }
    const seg = segments[segIdx];
    if (seg === '[*]') {
      if (!Array.isArray(current)) return;
      for (let i = 0; i < current.length; i++) {
        walk(current[i], segIdx + 1, `${pathSoFar}[${i}]`);
      }
    } else {
      const parts = seg.split('.').filter(Boolean);
      let cur = current;
      let path = pathSoFar;
      for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return;
        cur = (cur as Record<string, unknown>)[part];
        path = path ? `${path}.${part}` : part;
      }
      if (segIdx === segments.length - 1) {
        results.push(path);
      } else {
        walk(cur, segIdx + 1, path);
      }
    }
  }

  walk(obj, 0, '');
  return results;
}

/** Normalize a value for comparison — trim, remove quotes, handle JSON stringified values */
export function normalizeForCompare(val: string): string {
  if (!val) return '';
  let v = val.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('{') || v.startsWith('['))) {
    try { v = String(JSON.parse(v)); } catch { /* keep as-is */ }
  }
  return v;
}
