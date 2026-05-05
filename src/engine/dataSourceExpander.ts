/**
 * Data Source Expander — resolves a single Scenario with an attached DataSource
 * into N concrete Scenarios, one per enabled data row, with variables substituted
 * into URL path, query params, headers, body, and validation fields.
 */
import type { Scenario, DataSourceColumn, DataSourceRow, DataSubset, KeyValue, ExpectedField, ValidationConfig, SharedDataSource } from '../shared/types';

// ─── Shared Data Source Resolution ────────────────────────────

/**
 * Resolve a Scenario's data source: if it references a shared data source,
 * attach the shared DataSource inline. Returns the scenario unchanged if
 * it already has inline data or no data source at all.
 */
export function resolveSharedDataSource(
  scenario: Scenario,
  sharedDataSources?: SharedDataSource[],
): Scenario {
  if (!scenario.sharedDataSourceId || scenario.dataSource) return scenario;
  if (!sharedDataSources || sharedDataSources.length === 0) return scenario;

  const shared = sharedDataSources.find(s => s.id === scenario.sharedDataSourceId);
  if (!shared) return scenario;
  return { ...scenario, dataSource: shared.dataSource };
}

/**
 * Resolve all tests in a queue, attaching shared data sources.
 */
export function resolveSharedDataSources(
  queue: Scenario[],
  sharedDataSources: SharedDataSource[],
): Scenario[] {
  return queue.map(sc => {
    if (!sc.sharedDataSourceId || sc.dataSource) return sc;
    const shared = sharedDataSources.find(s => s.id === sc.sharedDataSourceId);
    if (!shared) return sc;
    return { ...sc, dataSource: shared.dataSource };
  });
}

// ─── Helpers ──────────────────────────────────────────────────

/** Build a human-readable label for a data row (e.g., "Row 1: vin=1GY..338, channel=WEBRNW"). */
export function buildRowLabel(row: DataSourceRow, columns: DataSourceColumn[], index: number): string {
  const parts = columns
    .filter(c => c.type !== 'validate')
    .slice(0, 3) // limit to first 3 non-validate columns
    .map(c => {
      const val = row.values[c.id] ?? '';
      const truncated = val.length > 16 ? val.slice(0, 14) + '…' : val;
      return `${c.name}=${truncated}`;
    });
  const suffix = parts.length > 0 ? `: ${parts.join(', ')}` : '';
  return `Row ${index + 1}${suffix}`;
}

/** Replace all `{{varName}}` placeholders in a string with values from the variable map. */
function substituteVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    return vars[name] ?? `{{${name}}}`;
  });
}

import { isTemplateToken, decodeTemplateBraces } from '../shared/utils/templateHelpers';

function normalizeUnresolvedQueryPlaceholders(url: string): string {
  try {
    const u = new URL(url);
    for (const [key, value] of u.searchParams.entries()) {
      if (isTemplateToken(value)) {
        u.searchParams.set(key, '');
      }
    }
    return decodeTemplateBraces(u.toString());
  } catch {
    return decodeTemplateBraces(url);
  }
}

// ─── Column Resolution ───────────────────────────────────────

/** Apply path column values — replace {{varName}} in URL path segments. */
function applyPathColumns(url: string, columns: DataSourceColumn[], row: DataSourceRow): string {
  const vars: Record<string, string> = {};
  for (const col of columns) {
    if (col.type === 'path') {
      const rowValue = row.values[col.id] ?? '';
      if (!rowValue || isTemplateToken(rowValue)) continue;
      const mapping = (col.mapping ?? '').trim();
      const name = (col.name ?? '').trim();
      const hasMappingPlaceholder = mapping ? url.includes(`{{${mapping}}}`) : false;
      const hasNamePlaceholder = name ? url.includes(`{{${name}}}`) : false;
      const key = hasMappingPlaceholder || !hasNamePlaceholder ? mapping : name;
      if (key) {
        vars[key] = rowValue;
      }
    }
  }
  return substituteVariables(url, vars);
}

/** Apply param column values — set/override query parameters. */
function applyParamColumns(url: string, columns: DataSourceColumn[], row: DataSourceRow): string {
  const paramCols = columns.filter(c => c.type === 'param');
  if (paramCols.length === 0) return normalizeUnresolvedQueryPlaceholders(url);

  // First, substitute {{placeholder}} in the URL template (same pattern as path/body columns)
  const vars: Record<string, string> = {};
  for (const col of paramCols) {
    const rowValue = row.values[col.id] ?? '';
    if (!rowValue || isTemplateToken(rowValue)) continue;
    const mapping = (col.mapping ?? '').trim();
    const name = (col.name ?? '').trim();
    if (mapping) vars[mapping] = rowValue;
    if (name && name !== mapping) vars[name] = rowValue;
  }
  const substituted = substituteVariables(url, vars);

  try {
    // Then use URL parsing to ensure proper encoding
    const u = new URL(substituted);
    const existingKeys = new Set(Array.from(u.searchParams.keys()));
    for (const col of paramCols) {
      const value = row.values[col.id];
      if (value !== undefined && value !== '' && !isTemplateToken(value)) {
        const mapping = (col.mapping ?? '').trim();
        const name = (col.name ?? '').trim();
        const key = mapping && (existingKeys.has(mapping) || !name || !existingKeys.has(name))
          ? mapping
          : name || mapping;
        if (key) u.searchParams.set(key, value);
      }
    }
    for (const [key, current] of u.searchParams.entries()) {
      if (isTemplateToken(current)) {
        u.searchParams.set(key, '');
      }
    }
    return u.toString();
  } catch {
    return normalizeUnresolvedQueryPlaceholders(substituted);
  }
}

/** Apply header column values — set/override headers. */
function applyHeaderColumns(headers: KeyValue[], columns: DataSourceColumn[], row: DataSourceRow): KeyValue[] {
  const headerCols = columns.filter(c => c.type === 'header');
  if (headerCols.length === 0) return headers;

  const result = [...headers];
  for (const col of headerCols) {
    const value = row.values[col.id] ?? '';
    const existing = result.findIndex(h => h.key.toLowerCase() === col.mapping.toLowerCase());
    if (existing >= 0) {
      result[existing] = { key: col.mapping, value };
    } else {
      result.push({ key: col.mapping, value });
    }
  }
  return result;
}

/** Apply body column values — replace {{varName}} in request body. */
function applyBodyColumns(body: string, columns: DataSourceColumn[], row: DataSourceRow): string {
  const bodyCols = columns.filter(c => c.type === 'body');
  if (bodyCols.length === 0 || !body) return body;

  const vars: Record<string, string> = {};
  for (const col of bodyCols) {
    vars[col.mapping] = row.values[col.id] ?? '';
  }
  return substituteVariables(body, vars);
}

// ─── Main Expander ────────────────────────────────────────────

/**
 * Resolve a Scenario's data source row into a concrete Scenario with
 * all variables substituted and data row metadata attached.
 */
export function resolveScenarioFromDataRow(
  base: Scenario,
  columns: DataSourceColumn[],
  row: DataSourceRow,
  rowIndex: number,
  arrayValidationMode?: Record<string, 'ordered' | 'unordered'>,
  validationMode?: 'none' | 'selective' | 'full',
): Scenario {
  let url = decodeTemplateBraces(base.url);
  url = applyPathColumns(url, columns, row);
  url = applyParamColumns(url, columns, row);

  const headers = applyHeaderColumns(base.headers, columns, row);
  const body = applyBodyColumns(base.body, columns, row);
  const label = buildRowLabel(row, columns, rowIndex);

  // Build expectedFields from validate columns that have values in this row
  const validateCols = columns.filter(c => c.type === 'validate');
  const expectedFields: ExpectedField[] = validateCols
    .filter(col => row.values[col.id]?.trim())
    .map(col => ({ jsonPath: col.mapping, expectedValue: row.values[col.id].trim() }));

  // Determine validation config based on validationMode + isSample
  // - 'none': skip validation entirely for all rows
  // - 'selective': only validate sample rows (isSample=true)
  // - 'full': validate all rows that have validate column values
  const effectiveMode = validationMode ?? 'full';
  const skipValidation = effectiveMode === 'none'
    || (effectiveMode === 'selective' && !row.isSample);

  const hasUnordered = arrayValidationMode && Object.values(arrayValidationMode).some(m => m === 'unordered');
  let validation: ValidationConfig = base.validation;

  if (skipValidation) {
    // Force validation off for this row
    validation = { ...validation, mode: 'none' };
  } else if (expectedFields.length > 0) {
    validation = {
      ...validation,
      mode: 'selective',
      expectedFields,
      unorderedArrays: hasUnordered || validation.unorderedArrays || false,
    };
  } else if (hasUnordered && !validation.unorderedArrays) {
    validation = { ...validation, unorderedArrays: true };
  }

  return {
    ...base,
    url,
    headers,
    body,
    validation,
    // Clear the data source on expanded scenarios — they are already resolved
    dataSource: undefined,
    // Tag with row context for result tracking
    dataRowId: row.id,
    dataRowLabel: label,
  };
}

/**
 * Expand a Scenario with an attached DataSource into N concrete Scenarios,
 * one per enabled data row. Scenarios without a data source are returned as-is.
 *
 * @param scenario The base scenario (may or may not have a dataTable)
 * @returns Array of resolved scenarios. Length = enabled row count (or 1 if no table).
 */
export function expandDataSource(scenario: Scenario): Scenario[] {
  const dt = scenario.dataSource;
  if (!dt || dt.columns.length === 0 || dt.rows.length === 0) {
    return [scenario];
  }

  const enabledRows = dt.rows.filter(r => r.enabled);
  if (enabledRows.length === 0) {
    return [scenario];
  }

  // Apply distribution strategy
  const orderedRows = applyDistribution(enabledRows, dt.distribution);

  return orderedRows.map((row, idx) =>
    resolveScenarioFromDataRow(scenario, dt.columns, row, idx, dt.arrayValidationMode, dt.validationMode),
  );
}

/**
 * Apply the distribution strategy to order/shuffle rows.
 */
function applyDistribution(
  rows: DataSourceRow[],
  distribution?: 'sequential' | 'random' | 'round-robin',
): DataSourceRow[] {
  const mode = distribution ?? 'sequential';

  if (mode === 'random') {
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 'sequential' and 'round-robin' are identical for a single expansion pass.
  // 'round-robin' differs when the same data source is expanded across multiple VUs (Phase 6).
  return rows;
}

/**
 * Expand a queue of Scenarios, resolving any data sources into individual rows.
 * Non-parameterized scenarios pass through unchanged.
 */
export function expandQueue(queue: Scenario[]): Scenario[] {
  const expanded: Scenario[] = [];
  for (const scenario of queue) {
    expanded.push(...expandDataSource(scenario));
  }
  return expanded;
}

/**
 * Expand only specific data rows (by ID) from a Scenario's data source.
 * Used for re-running failed rows without re-executing the entire data set.
 *
 * @param scenario The base scenario with an attached dataSource
 * @param rowIds   The data row IDs to expand (e.g. failed row IDs from a previous run)
 * @returns Array of resolved scenarios, one per matching row
 */
export function expandDataSourceForRows(scenario: Scenario, rowIds: string[]): Scenario[] {
  const dt = scenario.dataSource;
  if (!dt || dt.columns.length === 0 || rowIds.length === 0) return [];

  const rowIdSet = new Set(rowIds);
  const matchedRows = dt.rows.filter(r => rowIdSet.has(r.id));
  if (matchedRows.length === 0) return [];

  return matchedRows.map((row, idx) =>
    resolveScenarioFromDataRow(scenario, dt.columns, row, idx, dt.arrayValidationMode, dt.validationMode),
  );
}

// ─── Tag & Subset Filtering ──────────────────────────────────

/** Built-in tag suggestions shown in the UI autocomplete. */
export const BUILT_IN_TAGS = ['happy-path', 'edge-case', 'negative', 'boundary', 'regression', 'smoke'] as const;

/**
 * Filter rows by tags.
 * @param rows  The rows to filter
 * @param tags  Tags to match against
 * @param mode  'any' = row matches if it has ANY of the tags, 'all' = row must have ALL tags
 */
export function filterRowsByTags(
  rows: DataSourceRow[],
  tags: string[],
  mode: 'any' | 'all' = 'any',
): DataSourceRow[] {
  if (tags.length === 0) return rows;
  return rows.filter(r => {
    const rowTags = r.tags ?? [];
    if (rowTags.length === 0) return false;
    return mode === 'any'
      ? tags.some(t => rowTags.includes(t))
      : tags.every(t => rowTags.includes(t));
  });
}

/**
 * Apply a DataSubset filter to rows.
 */
export function filterRowsBySubset(
  rows: DataSourceRow[],
  subset: DataSubset,
): DataSourceRow[] {
  if (subset.filter.type === 'tags') {
    return filterRowsByTags(rows, subset.filter.tags, subset.filter.mode);
  }
  const idSet = new Set(subset.filter.rowIds);
  return rows.filter(r => idSet.has(r.id));
}

/**
 * Collect all unique tags across all rows in a data source.
 */
export function collectAllTags(rows: DataSourceRow[]): string[] {
  const tagSet = new Set<string>();
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

/**
 * Count rows per tag.
 */
export function countRowsByTag(rows: DataSourceRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Expand a Scenario but only include rows matching the given tags.
 * Combines tag filtering with standard data source expansion.
 */
export function expandDataSourceWithTags(
  scenario: Scenario,
  tags: string[],
  mode: 'any' | 'all' = 'any',
): Scenario[] {
  const dt = scenario.dataSource;
  if (!dt || dt.columns.length === 0 || dt.rows.length === 0) {
    return [scenario];
  }

  let rows = dt.rows.filter(r => r.enabled);
  if (tags.length > 0) {
    rows = filterRowsByTags(rows, tags, mode);
  }
  if (rows.length === 0) return [];

  const orderedRows = applyDistribution(rows, dt.distribution);
  return orderedRows.map((row, idx) =>
    resolveScenarioFromDataRow(scenario, dt.columns, row, idx, dt.arrayValidationMode, dt.validationMode),
  );
}

/**
 * Expand a Scenario but only include rows matching a named subset.
 */
export function expandDataSourceWithSubset(
  scenario: Scenario,
  subsetName: string,
): Scenario[] {
  const dt = scenario.dataSource;
  if (!dt || dt.columns.length === 0 || dt.rows.length === 0) {
    return [scenario];
  }

  const subset = dt.subsets?.find(s => s.name === subsetName);
  if (!subset) return expandDataSource(scenario);

  let rows = dt.rows.filter(r => r.enabled);
  rows = filterRowsBySubset(rows, subset);
  if (rows.length === 0) return [];

  const orderedRows = applyDistribution(rows, dt.distribution);
  return orderedRows.map((row, idx) =>
    resolveScenarioFromDataRow(scenario, dt.columns, row, idx, dt.arrayValidationMode, dt.validationMode),
  );
}
