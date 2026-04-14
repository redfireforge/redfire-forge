import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, KeyValue, ExpectedField, ValidationMode, SelectiveMode, AuthConfig } from '../types';

// ---------------------------------------------------------------------------
// Column prefixes for CSV headers
// ---------------------------------------------------------------------------
const PARAM_PREFIX = 'param:';
const PATH_PREFIX = 'path:';
const VALIDATE_PREFIX = 'validate:';
const META_LINE_PREFIX = '#META:';

// ---------------------------------------------------------------------------
// Template metadata — stored as a JSON comment line at top of CSV
// ---------------------------------------------------------------------------

export interface TemplateMetadata {
  version: 1;
  method: string;
  urlPattern: string;          // e.g. https://host/v1/vehicles/management/{{vin}}/onboarding/...
  headers: KeyValue[];
  body: string;
  auth: AuthConfig;
  validationMode: ValidationMode;
  selectiveMode?: SelectiveMode;
  unorderedArrays?: boolean;
  excludedPaths?: string[];
  pathVariables: string[];     // e.g. ['vin']
}

// ---------------------------------------------------------------------------
// URL analysis: detect which path segments are "variable"
// ---------------------------------------------------------------------------

function parseUrl(url: string): { origin: string; pathname: string; params: KeyValue[] } {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return { origin: u.origin, pathname: u.pathname, params };
  } catch {
    return { origin: '', pathname: url, params: [] };
  }
}

/**
 * Heuristic: a path segment is likely a variable if it looks like an ID/VIN
 * (contains digits mixed with letters and is 8+ chars, or is purely numeric).
 */
function looksLikeVariable(segment: string): boolean {
  if (/^\d+$/.test(segment)) return true;
  if (segment.length >= 8 && /\d/.test(segment) && /[A-Za-z]/.test(segment)) return true;
  return false;
}

export interface PathSegmentChoice {
  index: number;
  segment: string;
  suggestedVariable: boolean;
  variableName: string;
}

export function analyzeUrlPath(url: string): { segments: PathSegmentChoice[]; origin: string; params: KeyValue[] } {
  const { origin, pathname, params } = parseUrl(url);
  const parts = pathname.split('/').filter(Boolean);

  const segments: PathSegmentChoice[] = parts.map((seg, i) => {
    const suggested = looksLikeVariable(seg);
    return {
      index: i,
      segment: seg,
      suggestedVariable: suggested,
      variableName: suggested ? `path_var_${i}` : '',
    };
  });

  return { segments, origin, params };
}

// ---------------------------------------------------------------------------
// Export: Generate CSV template from an existing test + user's variable choices
// ---------------------------------------------------------------------------

export interface ExportOptions {
  test: Scenario;
  pathVariables: { segmentIndex: number; variableName: string }[];
}

export function generateCsvTemplate(opts: ExportOptions): string {
  const { test, pathVariables } = opts;
  const { origin, pathname, params } = parseUrl(test.url);
  const pathParts = pathname.split('/').filter(Boolean);

  // Build URL pattern with {{placeholders}}
  const varIndexMap = new Map(pathVariables.map(pv => [pv.segmentIndex, pv.variableName]));
  const patternParts = pathParts.map((seg, i) => {
    const varName = varIndexMap.get(i);
    return varName ? `{{${varName}}}` : seg;
  });
  const urlPattern = `${origin}/${patternParts.join('/')}`;

  const meta: TemplateMetadata = {
    version: 1,
    method: test.method,
    urlPattern,
    headers: test.headers.filter(h => h.key.trim()),
    body: test.body || '',
    auth: test.auth,
    validationMode: test.validation.mode,
    selectiveMode: test.validation.selectiveMode,
    unorderedArrays: test.validation.unorderedArrays,
    excludedPaths: test.validation.excludedPaths,
    pathVariables: pathVariables.map(pv => pv.variableName),
  };

  // Build CSV columns: name, path variables, query params, validate fields
  const columns: string[] = ['name'];

  // Path variable columns
  for (const pv of pathVariables) {
    columns.push(`${PATH_PREFIX}${pv.variableName}`);
  }

  // Query param columns
  for (const p of params) {
    columns.push(`${PARAM_PREFIX}${p.key}`);
  }

  // Validation columns
  const expectedFields = test.validation.expectedFields ?? [];
  for (const f of expectedFields) {
    columns.push(`${VALIDATE_PREFIX}${f.jsonPath}`);
  }

  // First row = current test data
  const row: Record<string, string> = { name: test.name };

  for (const pv of pathVariables) {
    row[`${PATH_PREFIX}${pv.variableName}`] = pathParts[pv.segmentIndex] || '';
  }
  for (const p of params) {
    row[`${PARAM_PREFIX}${p.key}`] = p.value;
  }
  for (const f of expectedFields) {
    row[`${VALIDATE_PREFIX}${f.jsonPath}`] = f.expectedValue;
  }

  const csvData = Papa.unparse({ fields: columns, data: [row] });
  const metaLine = `${META_LINE_PREFIX}${JSON.stringify(meta)}`;

  return `${metaLine}\n${csvData}`;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import: Parse CSV (with metadata header) back into Scenario objects
// ---------------------------------------------------------------------------

export interface ParsedRow {
  rowIndex: number;
  scenario: Scenario | null;
  errors: string[];
  raw: Record<string, string>;
}

export interface CsvParseResult {
  rows: ParsedRow[];
  columns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  meta: TemplateMetadata | null;
}

function buildUrlFromTemplate(
  urlPattern: string,
  pathValues: Record<string, string>,
  params: KeyValue[]
): string {
  let url = urlPattern;
  for (const [name, value] of Object.entries(pathValues)) {
    url = url.replace(`{{${name}}}`, encodeURIComponent(value));
  }
  if (params.length > 0) {
    const qs = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    url = `${url}?${qs}`;
  }
  return url;
}

export function parseCsvToScenarios(csvText: string): CsvParseResult {
  const lines = csvText.split('\n');
  let meta: TemplateMetadata | null = null;
  let csvBody = csvText;

  // Extract metadata line if present
  if (lines[0]?.startsWith(META_LINE_PREFIX)) {
    try {
      meta = JSON.parse(lines[0].slice(META_LINE_PREFIX.length));
    } catch { /* ignore parse error */ }
    csvBody = lines.slice(1).join('\n');
  }

  const parsed = Papa.parse<Record<string, string>>(csvBody, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const columns = parsed.meta.fields ?? [];
  const rows: ParsedRow[] = [];
  let validRows = 0;
  let errorRows = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i];
    const errors: string[] = [];

    const name = (raw['name'] ?? '').trim();
    if (!name) errors.push('Missing name');

    // Collect path variables, query params, validation fields
    const pathValues: Record<string, string> = {};
    const paramValues: KeyValue[] = [];
    const expectedFields: ExpectedField[] = [];

    for (const col of columns) {
      const val = (raw[col] ?? '').trim();

      if (col.startsWith(PATH_PREFIX)) {
        const varName = col.slice(PATH_PREFIX.length);
        if (!val) errors.push(`Missing path variable: ${varName}`);
        else pathValues[varName] = val;
      } else if (col.startsWith(PARAM_PREFIX)) {
        const key = col.slice(PARAM_PREFIX.length);
        paramValues.push({ key, value: val });
      } else if (col.startsWith(VALIDATE_PREFIX)) {
        if (val) {
          expectedFields.push({
            jsonPath: col.slice(VALIDATE_PREFIX.length),
            expectedValue: val,
          });
        }
      }
    }

    if (errors.length > 0) {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw });
      continue;
    }

    // Build URL from template pattern or fall back to raw url column
    let fullUrl: string;
    if (meta?.urlPattern) {
      fullUrl = buildUrlFromTemplate(meta.urlPattern, pathValues, paramValues);
    } else {
      const baseUrl = (raw['url'] ?? '').trim();
      if (!baseUrl) {
        errors.push('Missing url (no template metadata found)');
        errorRows++;
        rows.push({ rowIndex: i + 1, scenario: null, errors, raw });
        continue;
      }
      if (paramValues.length > 0) {
        const qs = paramValues.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        fullUrl = `${baseUrl}?${qs}`;
      } else {
        fullUrl = baseUrl;
      }
    }

    const method = meta?.method ?? (raw['method'] ?? 'GET').trim().toUpperCase();
    const headers = meta?.headers ?? [];
    const body = meta?.body ?? (raw['body'] ?? '');
    const auth = meta?.auth ?? { type: 'inherit' as const };

    const hasValidation = expectedFields.length > 0;
    const validationMode: ValidationMode = meta?.validationMode ?? (hasValidation ? 'selective' : 'none');
    const selectiveMode: SelectiveMode = meta?.selectiveMode ?? 'include';

    const scenario: Scenario = {
      id: uuidv4(),
      name,
      method: method as Scenario['method'],
      url: fullUrl,
      headers: headers.map(h => ({ ...h })),
      body,
      auth: { ...auth },
      validation: {
        mode: validationMode,
        expectedFields: hasValidation ? expectedFields : undefined,
        selectiveMode: hasValidation ? selectiveMode : undefined,
        unorderedArrays: meta?.unorderedArrays,
        excludedPaths: meta?.excludedPaths,
      },
    };

    validRows++;
    rows.push({ rowIndex: i + 1, scenario, errors: [], raw });
  }

  return {
    rows,
    columns,
    totalRows: parsed.data.length,
    validRows,
    errorRows,
    meta,
  };
}
