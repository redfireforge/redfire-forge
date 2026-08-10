/**
 * Data Source utilities — auto-column detection and helpers for the inline data source editor.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, DataSourceColumn, DataSource, DataSourceRow } from '../../../shared/types';
import { parseUrl } from './csvTemplateUrl';
import { extractTemplateVariables } from './dataSourceContract';

/**
 * Auto-detect columns from a scenario's URL, headers, and body.
 * Only detects: query parameters, existing {{varName}} in body/headers, and existing {{varName}} in URL path.
 * Does NOT heuristically guess path variables from URL segments.
 */
export function autoDetectColumns(scenario: Scenario): DataSourceColumn[] {
  const columns: DataSourceColumn[] = [];
  const seen = new Set<string>();

  // 1. Existing {{varName}} placeholders in the URL path only (user-defined path variables)
  const urlPath = scenario.url.split('?')[0];
  const pathVars = extractTemplateVariables(urlPath);
  for (const v of pathVars) {
    if (!seen.has(`path:${v}`)) {
      seen.add(`path:${v}`);
      columns.push({
        id: uuidv4(),
        name: v,
        type: 'path',
        mapping: v,
      });
    }
  }

  // 2. Query parameters
  const { params } = parseUrl(scenario.url);
  for (const p of params) {
    if (p.key && !seen.has(`param:${p.key}`)) {
      seen.add(`param:${p.key}`);
      columns.push({
        id: uuidv4(),
        name: p.key,
        type: 'param',
        mapping: p.key,
      });
    }
  }

  // 3. Body {{varName}} variables
  if (scenario.body) {
    const bodyVars = extractTemplateVariables(scenario.body);
    for (const v of bodyVars) {
      if (!seen.has(`body:${v}`)) {
        seen.add(`body:${v}`);
        columns.push({
          id: uuidv4(),
          name: v,
          type: 'body',
          mapping: v,
        });
      }
    }
  }

  // 4. Header {{varName}} variables
  for (const h of (scenario.headers ?? [])) {
    const headerVars = [
      ...extractTemplateVariables(h.key),
      ...extractTemplateVariables(h.value),
    ];
    for (const v of headerVars) {
      if (!seen.has(`header:${v}`)) {
        seen.add(`header:${v}`);
        columns.push({
          id: uuidv4(),
          name: v,
          type: 'header',
          mapping: v,
        });
      }
    }
  }

  return columns;
}

/** True when any non-validate column has a non-empty value. */
export function dataSourceRowHasValues(
  row: Pick<DataSourceRow, 'values'>,
  columns: DataSourceColumn[],
): boolean {
  return columns.some(
    (c) => c.type !== 'validate' && String(row.values[c.id] ?? '').trim() !== '',
  );
}

/** Create a new empty DataTable with auto-detected columns. */
export function createEmptyDataSource(scenario: Scenario): DataSource {
  const columns = autoDetectColumns(scenario);
  const row = createEmptyRow(columns);
  return {
    id: uuidv4(),
    columns,
    rows: [row],
    source: { type: 'inline' },
  };
}

/**
 * Create a data source with auto-detected columns and pre-fill first row with current values.
 * Builds a urlTemplate with {{paramName}} placeholders for query params.
 * Does NOT modify draft.url — the template is stored separately in dataTable.urlTemplate.
 */
export function createDataSourceWithTemplatizedUrl(scenario: Scenario): { dataSource: DataSource; url: string } {
  const columns = autoDetectColumns(scenario);

  // Pre-fill first row with current query param values
  const row = createEmptyRow(columns);
  const { params } = parseUrl(scenario.url);
  for (const p of params) {
    const col = columns.find(c => c.type === 'param' && c.mapping === p.key);
    if (col) {
      row.values[col.id] = p.value;
    }
  }
  // Only enable when real values were prefilled — empty starter rows stay unchecked.
  row.enabled = dataSourceRowHasValues(row, columns);

  // Build urlTemplate: base path + query params as {{varName}}
  const urlTemplate = buildUrlTemplate(scenario.url, columns);

  const dataSource: DataSource = {
    id: uuidv4(),
    columns,
    rows: [row],
    source: { type: 'inline' },
    urlTemplate,
  };

  // URL is returned unchanged
  return { dataSource, url: scenario.url };
}

/**
 * Build a URL template from a URL and detected columns.
 * Replaces query param values with {{paramName}} placeholders.
 * Preserves existing {{varName}} in the path.
 */
export function buildUrlTemplate(url: string, columns: DataSourceColumn[]): string {
  const qIdx = url.indexOf('?');
  const basePath = qIdx === -1 ? url : url.slice(0, qIdx);

  const paramCols = columns.filter(c => c.type === 'param');
  if (paramCols.length === 0) return basePath;

  const qs = paramCols.map(c => `${c.mapping}={{${c.mapping}}}`).join('&');
  return `${basePath}?${qs}`;
}

/**
 * Sync the path portion of draft.url from the urlTemplate.
 * Copies path placeholders (e.g. {{vin}}) from the template into the URL
 * so that the stored URL stays in sync with template edits.
 * Query params in draft.url are preserved as-is.
 */
export function syncUrlFromTemplate(draftUrl: string, urlTemplate: string): string {
  const templateQIdx = urlTemplate.indexOf('?');
  const templatePath = templateQIdx === -1 ? urlTemplate : urlTemplate.slice(0, templateQIdx);

  const draftQIdx = draftUrl.indexOf('?');
  const draftQuery = draftQIdx === -1 ? '' : draftUrl.slice(draftQIdx);

  return templatePath + draftQuery;
}

/**
 * Create a new empty row with blank values for all columns.
 * Starts disabled so the Data Source badge / "N enabled" counts don't imply
 * ready data when cells are still blank (placeholder text is not a value).
 */
export function createEmptyRow(columns: DataSourceColumn[]): DataSourceRow {
  const values: Record<string, string> = {};
  for (const col of columns) {
    values[col.id] = '';
  }
  return {
    id: uuidv4(),
    values,
    enabled: false,
  };
}

/** Create a new column with a default name. */
export function createEmptyColumn(existingColumns: DataSourceColumn[]): DataSourceColumn {
  const existingNames = new Set(existingColumns.map(c => c.name));
  let name = 'column';
  let idx = 1;
  while (existingNames.has(name)) {
    name = `column_${idx++}`;
  }
  return {
    id: uuidv4(),
    name,
    type: 'param',
    mapping: name,
  };
}
