import { v4 as uuidv4 } from 'uuid';
import type { Scenario } from '../../../shared/types';
import { saveFile } from '../../../shared/utils/fileSaver';
import type {
  TemplateMetadata,
  ExportOptions,
  ParsedRow,
  CsvParseResult,
} from './csvTemplateTypes';
import { buildTemplateMetaAndSample, buildScenarioFromRow } from './csvTemplateShared';

// ---------------------------------------------------------------------------
// JSON Data File schema
// ---------------------------------------------------------------------------

/** Structured JSON data file with metadata + data rows */
export interface JsonDataFile {
  meta?: TemplateMetadata;
  data: Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Generate a JSON data file string from a test definition and path variable
 * selections. Mirrors `generateCsvTemplate` — produces a structured
 * `{ meta, data }` object with one sample row.
 */
export function generateJsonTemplate(opts: ExportOptions): string {
  const { meta, sampleRow } = buildTemplateMetaAndSample(opts);
  const file: JsonDataFile = { meta, data: [sampleRow] };
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  await saveFile(blob, { filename, mimeType: 'application/json', description: 'JSON file' });
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a JSON data file into the same `CsvParseResult` shape used by CSV and
 * Excel importers. Accepts two formats:
 *
 * 1. **Structured** — `{ "meta": { ... }, "data": [ { ... }, ... ] }`
 *    Metadata provides method, URL pattern, headers, auth, etc.
 *    Data rows use the same `path:`, `param:`, `validate:` key prefixes as CSV.
 *
 * 2. **Simple array** — `[ { "name": "...", "url": "...", ... }, ... ]`
 *    Each object must have `name` and `url`. Optional keys: `method`, `body`.
 */
export function parseJsonToScenarios(jsonText: string): CsvParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return emptyResult([`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`]);
  }

  // Determine format
  if (Array.isArray(parsed)) {
    return parseSimpleArray(parsed);
  }

  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    const file = parsed as JsonDataFile;
    if (!Array.isArray(file.data)) {
      return emptyResult(['"data" must be an array of objects']);
    }
    return parseStructured(file.meta ?? null, file.data);
  }

  return emptyResult(['JSON must be an array or an object with a "data" array']);
}

// ---------------------------------------------------------------------------
// Internal: structured format (with metadata)
// ---------------------------------------------------------------------------

function parseStructured(
  meta: TemplateMetadata | null,
  data: Record<string, string>[],
): CsvParseResult {
  // Collect all keys across all rows
  const columnSet = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) columnSet.add(key);
  }
  const columns = Array.from(columnSet);

  const rows: ParsedRow[] = [];
  let validRows = 0;
  let errorRows = 0;

  for (let i = 0; i < data.length; i++) {
    const raw = data[i];

    // Coerce all values to strings for consistent handling
    const strRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      strRow[k] = String(v ?? '');
    }

    const { scenario, errors } = buildScenarioFromRow(strRow, { columns, meta });

    if (scenario) {
      validRows++;
      rows.push({ rowIndex: i + 1, scenario, errors: [], raw: strRow });
    } else {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw: strRow });
    }
  }

  return { rows, columns, totalRows: data.length, validRows, errorRows, meta, fileErrors: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Internal: simple array format (no metadata)
// ---------------------------------------------------------------------------

function parseSimpleArray(data: unknown[]): CsvParseResult {
  const rows: ParsedRow[] = [];
  let validRows = 0;
  let errorRows = 0;
  const columnSet = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object') {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors: ['Row is not an object'], raw: {} });
      continue;
    }

    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(item)) {
      raw[k] = String(v ?? '');
      columnSet.add(k);
    }

    const errors: string[] = [];
    const name = (raw['name'] ?? '').trim();
    if (!name) errors.push('Missing name');

    const url = (raw['url'] ?? '').trim();
    if (!url) errors.push('Missing url');

    if (errors.length > 0) {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw });
      continue;
    }

    const method = (raw['method'] ?? 'GET').trim().toUpperCase();
    const body = raw['body'] ?? '';

    const scenario: Scenario = {
      id: uuidv4(),
      name,
      method: method as Scenario['method'],
      url,
      headers: [],
      body,
      auth: { type: 'inherit' },
      validation: { mode: 'none' },
    };

    validRows++;
    rows.push({ rowIndex: i + 1, scenario, errors: [], raw });
  }

  return {
    rows,
    columns: Array.from(columnSet),
    totalRows: data.length,
    validRows,
    errorRows,
    meta: null,
    fileErrors: [],
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Internal: empty result helper
// ---------------------------------------------------------------------------

function emptyResult(fileErrors: string[]): CsvParseResult {
  return { rows: [], columns: [], totalRows: 0, validRows: 0, errorRows: 0, meta: null, fileErrors, warnings: [] };
}
