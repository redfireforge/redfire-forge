import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, KeyValue, ExpectedField, ValidationMode, SelectiveMode } from '../types';

// ---------------------------------------------------------------------------
// Column prefixes
// ---------------------------------------------------------------------------
const HEADER_PREFIX = 'header:';
const PARAM_PREFIX = 'param:';
const VALIDATE_PREFIX = 'validate:';

// Fixed columns in order
const FIXED_COLUMNS = ['name', 'method', 'url', 'body', 'auth_type'] as const;

// ---------------------------------------------------------------------------
// Export: Generate CSV template from an existing test
// ---------------------------------------------------------------------------

function parseUrl(url: string): { basePath: string; params: KeyValue[] } {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return { basePath: `${u.origin}${u.pathname}`, params };
  } catch {
    return { basePath: url, params: [] };
  }
}

export function generateCsvTemplate(test: Scenario): string {
  const { basePath, params } = parseUrl(test.url);

  const paramCols = params.map(p => `${PARAM_PREFIX}${p.key}`);
  const headerCols = test.headers
    .filter(h => h.key.trim())
    .map(h => `${HEADER_PREFIX}${h.key}`);
  const validateCols = (test.validation.expectedFields ?? [])
    .map(f => `${VALIDATE_PREFIX}${f.jsonPath}`);

  const columns = [...FIXED_COLUMNS, ...paramCols, ...headerCols, ...validateCols];

  const row: Record<string, string> = {
    name: test.name,
    method: test.method,
    url: basePath,
    body: test.body || '',
    auth_type: test.auth?.type || 'inherit',
  };
  params.forEach(p => { row[`${PARAM_PREFIX}${p.key}`] = p.value; });
  test.headers.filter(h => h.key.trim()).forEach(h => {
    row[`${HEADER_PREFIX}${h.key}`] = h.value;
  });
  (test.validation.expectedFields ?? []).forEach(f => {
    row[`${VALIDATE_PREFIX}${f.jsonPath}`] = f.expectedValue;
  });

  return Papa.unparse({ fields: columns, data: [row] });
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
// Import: Parse CSV back into Scenario objects
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
}

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function buildUrlWithParams(basePath: string, params: KeyValue[]): string {
  if (params.length === 0) return basePath;
  const qs = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${basePath}?${qs}`;
}

export function parseCsvToScenarios(csvText: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
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
    const method = (raw['method'] ?? '').trim().toUpperCase();
    const url = (raw['url'] ?? '').trim();
    const body = (raw['body'] ?? '').trim();
    const authType = (raw['auth_type'] ?? 'inherit').trim().toLowerCase();

    if (!name) errors.push('Missing name');
    if (!method) errors.push('Missing method');
    else if (!VALID_METHODS.has(method)) errors.push(`Invalid method: ${method}`);
    if (!url) errors.push('Missing url');

    const params: KeyValue[] = [];
    const headers: KeyValue[] = [];
    const expectedFields: ExpectedField[] = [];

    for (const col of columns) {
      const val = (raw[col] ?? '').trim();
      if (!val) continue;

      if (col.startsWith(PARAM_PREFIX)) {
        params.push({ key: col.slice(PARAM_PREFIX.length), value: val });
      } else if (col.startsWith(HEADER_PREFIX)) {
        headers.push({ key: col.slice(HEADER_PREFIX.length), value: val });
      } else if (col.startsWith(VALIDATE_PREFIX)) {
        expectedFields.push({
          jsonPath: col.slice(VALIDATE_PREFIX.length),
          expectedValue: val,
        });
      }
    }

    const hasValidation = expectedFields.length > 0;
    const validationMode: ValidationMode = hasValidation ? 'selective' : 'none';
    const selectiveMode: SelectiveMode = 'include';

    if (errors.length > 0) {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw });
      continue;
    }

    const fullUrl = buildUrlWithParams(url, params);

    const scenario: Scenario = {
      id: uuidv4(),
      name,
      method: method as Scenario['method'],
      url: fullUrl,
      headers,
      body,
      auth: { type: authType as Scenario['auth']['type'] },
      validation: {
        mode: validationMode,
        expectedFields: hasValidation ? expectedFields : undefined,
        selectiveMode: hasValidation ? selectiveMode : undefined,
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
  };
}
