/**
 * Pure utility functions for DataSourceSetupModal wizard.
 * Extracted to keep the modal component lean and enable unit testing.
 */
import type { Scenario, ExpectedField, SharedDataSourceFetchConfig, DataSource } from '@shared/types';
import type { ColumnDef } from './csvTemplate';
import { decodeTemplateBraces, isTemplateToken } from '@shared/utils/templateHelpers';

export type SetupMode = 'configure' | 'export' | 'parameterize';

// ─── Variable name helpers ──────────────────────────────────

/** Strip all non-alphanumeric/underscore characters. */
export function sanitizeVariableName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, '');
}

/** Convert a label like "Content-Type" → "contentType" (camelCase, safe chars only). */
export function toVariableName(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return 'varName';
  const parts = cleaned.split(/\s+/);
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  return sanitizeVariableName([first, ...rest].join('')) || 'varName';
}

// ─── URL template helpers ───────────────────────────────────

/** Get path segments from a urlTemplate string. */
export function getTemplateSegments(urlTemplate?: string): string[] {
  if (!urlTemplate) return [];
  try {
    const qIdx = urlTemplate.indexOf('?');
    const path = qIdx === -1 ? urlTemplate : urlTemplate.slice(0, qIdx);
    const u = new URL(path, 'http://x');
    return u.pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

/** Parse query placeholder vars from URL template, e.g. ?country={{countryCode}} → { country: "countryCode" } */
export function parseTemplateParamVariables(urlTemplate: string): Record<string, string> {
  try {
    const u = new URL(urlTemplate);
    const map: Record<string, string> = {};
    for (const [key, value] of u.searchParams.entries()) {
      const match = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
      if (match) {
        map[key] = match[1];
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Validate field name shortener ──────────────────────────

/** Turn a JSON path like "offers[0].offerName" into a short column name like "offers_offerName". */
export function shortNameForValidate(path: string): string {
  const normalized = path.replace(/\$\.?/, '').replace(/\[(\d+)\]/g, '$1');
  const segments = normalized.split('.').filter(Boolean);
  if (segments.length === 0) return 'validateField';
  if (segments.length === 1) return sanitizeVariableName(segments[0]) || 'validateField';
  const tail = sanitizeVariableName(segments[segments.length - 1]) || 'field';
  const parent = sanitizeVariableName(segments[segments.length - 2]) || 'validate';
  return `${parent}_${tail}`;
}

// ─── Column definition builder ──────────────────────────────

export interface BuildColumnDefsOptions {
  mode: SetupMode;
  test: Scenario;
  pathVars: Array<{ segmentIndex: number; variableName: string }>;
  urlParams: Array<{ key: string; value: string }>;
  paramSelections: Record<string, { enabled: boolean; name: string }>;
  headerSelections: Record<string, { enabled: boolean; name: string }>;
  bodySelections: Record<string, { enabled: boolean; name: string }>;
}

/**
 * Build the initial set of column definitions from wizard state.
 * Deduplicates column names and assigns types.
 */
export function buildConfiguredColumnDefs(opts: BuildColumnDefsOptions): ColumnDef[] {
  const {
    mode,
    test,
    pathVars,
    urlParams,
    paramSelections,
    headerSelections,
    bodySelections,
  } = opts;

  const defs: ColumnDef[] = [];
  const usedNames = new Set<string>();

  const dedupe = (name: string): string => {
    const safeBase = sanitizeVariableName(name) || 'varName';
    let candidate = safeBase;
    let idx = 2;
    while (usedNames.has(candidate)) {
      candidate = `${safeBase}_${idx++}`;
    }
    usedNames.add(candidate);
    return candidate;
  };

  if (mode === 'export') {
    defs.push({
      type: 'name',
      fullKey: 'name',
      mapping: '',
      autoName: 'name',
      customName: 'name',
    });
    usedNames.add('name');
  }

  for (const pv of pathVars) {
    const auto = dedupe(pv.variableName);
    defs.push({
      type: 'path',
      fullKey: `path:${pv.variableName}`,
      mapping: pv.variableName,
      autoName: auto,
      customName: auto,
    });
  }

  for (const p of urlParams) {
    const cfg = paramSelections[p.key];
    if (!cfg?.enabled) continue;
    const custom = dedupe(cfg.name || p.key);
    defs.push({
      type: 'param',
      fullKey: `param:${p.key}`,
      mapping: p.key,
      autoName: custom,
      customName: custom,
    });
  }

  for (const [headerKey, cfg] of Object.entries(headerSelections)) {
    if (!cfg.enabled) continue;
    const custom = dedupe(cfg.name || toVariableName(headerKey));
    defs.push({
      type: 'header',
      fullKey: `header:${headerKey}`,
      mapping: headerKey,
      autoName: custom,
      customName: custom,
    } as unknown as ColumnDef);
  }

  for (const [bodyVar, cfg] of Object.entries(bodySelections)) {
    if (!cfg.enabled) continue;
    const custom = dedupe(cfg.name || bodyVar);
    defs.push({
      type: 'body',
      fullKey: `body:${bodyVar}`,
      mapping: bodyVar,
      autoName: custom,
      customName: custom,
    } as unknown as ColumnDef);
  }

  const expectedFields: ExpectedField[] = test.validation.expectedFields ?? [];
  const seenValidate = new Set<string>();
  for (const f of expectedFields) {
    if (seenValidate.has(f.jsonPath)) continue;
    seenValidate.add(f.jsonPath);
    const auto = dedupe(shortNameForValidate(f.jsonPath));
    defs.push({
      type: 'validate',
      fullKey: `validate:${f.jsonPath}`,
      mapping: f.jsonPath,
      autoName: auto,
      customName: auto,
    });
  }

  for (const c of test.dataSource?.columns ?? []) {
    if (c.type !== 'validate' || seenValidate.has(c.mapping)) continue;
    seenValidate.add(c.mapping);
    const auto = dedupe(shortNameForValidate(c.mapping));
    defs.push({
      type: 'validate',
      fullKey: `validate:${c.mapping}`,
      mapping: c.mapping,
      autoName: auto,
      customName: auto,
    });
  }

  return defs;
}

/** Format auth type for display. */
export function formatAuthLabel(auth: Scenario['auth']): string {
  switch (auth.type) {
    case 'none': return 'None';
    case 'inherit': return 'Inherited (from parent)';
    case 'bearer': {
      const prefix = (auth as { prefix?: string }).prefix ?? 'Bearer';
      return `Bearer Token (${prefix})`;
    }
    case 'basic': return 'Basic Auth';
    case 'apikey': return `API Key${(auth as { apiKeyName?: string }).apiKeyName ? ` (${(auth as { apiKeyName?: string }).apiKeyName})` : ''}`;
    case 'oauth2': return 'OAuth2 Client Credentials';
    default: return auth.type;
  }
}

// ─── Scenario builder ────────────────────────────────────────

/**
 * Build a Scenario object from a SharedDataSource's fetch config.
 * Centralizes the repeated pattern of mapping SharedDataSourceFetchConfig → Scenario.
 */
export function buildScenarioFromFetchConfig(
  id: string,
  name: string,
  cfg: SharedDataSourceFetchConfig | undefined,
  dataSource: DataSource | undefined,
  urlOverride?: string,
): Scenario {
  const url = urlOverride ?? cfg?.url ?? '';
  return {
    id,
    name,
    url,
    method: cfg?.method ?? 'GET',
    headers: cfg && cfg.headers.length > 0 ? cfg.headers : [{ key: '', value: '' }],
    body: cfg?.body ?? '',
    bodyType: cfg?.bodyType ?? (cfg?.body ? 'json' : 'none'),
    auth: cfg?.auth ?? { type: 'none' },
    validation: { mode: 'none' },
    dataSource,
  };
}

/**
 * Build the URL template string from wizard state.
 */
export function buildUrlTemplate(
  urlTemplateInput: string,
  columnDefs: ColumnDef[],
  previewUrl: string,
  urlParams: Array<{ key: string; value: string }>,
): string {
  const rawTemplate = (() => {
    if (urlTemplateInput.trim()) return urlTemplateInput.trim();
    const paramCols = columnDefs.filter(d => d.type === 'param');
    const basePath = previewUrl.split('?')[0];
    if (paramCols.length === 0) return basePath;
    const qs = paramCols.map(c => `${c.mapping}={{${c.customName.trim()}}}`).join('&');
    return `${basePath}?${qs}`;
  })();

  const fallbackQueryValues = new Map(urlParams.map(p => [p.key, p.value]));
  const paramDefs = columnDefs.filter(d => d.type === 'param');
  const enabledParamMap = new Map(paramDefs.map(d => [d.mapping, d.customName.trim()]));

  try {
    const u = new URL(rawTemplate);
    for (const [paramKey, varName] of enabledParamMap.entries()) {
      if (!varName) continue;
      u.searchParams.set(paramKey, `{{${varName}}}`);
    }
    for (const [paramKey, value] of u.searchParams.entries()) {
      if (enabledParamMap.has(paramKey)) continue;
      if (!isTemplateToken(value)) continue;
      const fallback = fallbackQueryValues.get(paramKey) ?? '';
      u.searchParams.set(paramKey, isTemplateToken(fallback) ? '' : fallback);
    }
    return decodeTemplateBraces(u.toString());
  } catch {
    return decodeTemplateBraces(rawTemplate);
  }
}
