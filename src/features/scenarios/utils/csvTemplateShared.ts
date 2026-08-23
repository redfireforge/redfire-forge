/**
 * Shared helpers for CSV / JSON template generation and parsing.
 * Eliminates duplication between csvTemplateCsv.ts and csvTemplateJson.ts.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, KeyValue, ExpectedField, ValidationMode, SelectiveMode } from '@shared/types';
import type { TemplateMetadata, ExportOptions } from './csvTemplateTypes';
import { PATH_PREFIX, PARAM_PREFIX, VALIDATE_PREFIX } from './csvTemplateTypes';
import { parseUrl, buildUrlFromTemplate } from './csvTemplateUrl';

// ---------------------------------------------------------------------------
// Template generation helpers (shared by CSV & JSON generators)
// ---------------------------------------------------------------------------

export interface TemplateGenResult {
  meta: TemplateMetadata;
  urlPattern: string;
  sampleRow: Record<string, string>;
  columns: string[];
}

/**
 * Build template metadata, a sample data row, and column list from export
 * options. Used by both `generateCsvTemplate` and `generateJsonTemplate`.
 */
export function buildTemplateMetaAndSample(opts: ExportOptions): TemplateGenResult {
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
    bodyType: test.bodyType,
    bodyForm: test.bodyForm,
    auth: test.auth,
    validationMode: test.validation.mode,
    selectiveMode: test.validation.selectiveMode,
    unorderedArrays: test.validation.unorderedArrays,
    excludedPaths: test.validation.excludedPaths,
    pathVariables: pathVariables.map(pv => pv.variableName),
  };

  // Build columns
  const columns: string[] = ['name'];
  for (const pv of pathVariables) columns.push(`${PATH_PREFIX}${pv.variableName}`);
  for (const p of params) columns.push(`${PARAM_PREFIX}${p.key}`);
  const expectedFields = test.validation.expectedFields ?? [];
  for (const f of expectedFields) columns.push(`${VALIDATE_PREFIX}${f.jsonPath}`);

  // Build sample row
  const sampleRow: Record<string, string> = { name: test.name };
  for (const pv of pathVariables) {
    const raw = pathParts[pv.segmentIndex] || '';
    try { sampleRow[`${PATH_PREFIX}${pv.variableName}`] = decodeURIComponent(raw); } catch { sampleRow[`${PATH_PREFIX}${pv.variableName}`] = raw; }
  }
  for (const p of params) {
    sampleRow[`${PARAM_PREFIX}${p.key}`] = p.value;
  }
  for (const f of expectedFields) {
    sampleRow[`${VALIDATE_PREFIX}${f.jsonPath}`] = f.expectedValue;
  }

  return { meta, urlPattern, sampleRow, columns };
}

// ---------------------------------------------------------------------------
// Row → Scenario conversion (shared by CSV & JSON parsers)
// ---------------------------------------------------------------------------

export interface RowParseContext {
  columns: string[];
  meta: TemplateMetadata | null;
}

export interface RowParseResult {
  scenario: Scenario | null;
  errors: string[];
}

/**
 * Convert a single raw data row (keyed by column name) into a `Scenario`.
 * Shared by `parseCsvToScenarios` and `parseJsonToScenarios` (structured format).
 */
export function buildScenarioFromRow(
  raw: Record<string, string>,
  ctx: RowParseContext,
): RowParseResult {
  const errors: string[] = [];
  const { columns, meta } = ctx;

  const name = (raw['name'] ?? '').trim();
  if (!name) errors.push('Missing name');

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
    return { scenario: null, errors };
  }

  // Build URL from template pattern or fall back to raw url column
  let fullUrl: string;
  if (meta?.urlPattern) {
    fullUrl = buildUrlFromTemplate(meta.urlPattern, pathValues, paramValues);
  } else {
    const baseUrl = (raw['url'] ?? '').trim();
    if (!baseUrl) {
      return { scenario: null, errors: [...errors, 'Missing url (no template metadata found)'] };
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

  const hasSelectiveFields = expectedFields.length > 0;
  const validationMode: ValidationMode = meta?.validationMode ?? (hasSelectiveFields ? 'selective' : 'none');
  const selectiveMode: SelectiveMode = meta?.selectiveMode ?? 'include';

  const scenario: Scenario = {
    id: uuidv4(),
    name,
    method: method as Scenario['method'],
    url: fullUrl,
    headers: headers.map(h => ({ ...h })),
    body,
    bodyType: meta?.bodyType,
    bodyForm: meta?.bodyForm,
    auth: { ...auth },
    validation: {
      mode: validationMode,
      expectedJson: validationMode === 'full' && meta?.expectedJson ? meta.expectedJson : undefined,
      expectedFields: hasSelectiveFields ? expectedFields : undefined,
      selectiveMode: (validationMode === 'selective' || hasSelectiveFields) ? selectiveMode : undefined,
      unorderedArrays: meta?.unorderedArrays,
      excludedPaths: meta?.excludedPaths,
    },
  };

  return { scenario, errors: [] };
}
