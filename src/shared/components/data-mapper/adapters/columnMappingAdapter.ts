/**
 * ColumnMappingAdapter — MapperAdapter<DataSourceColumn[]>
 *
 * Bridges the Data Mapper to the column ↔ request template mapping workflow.
 * Source: data source column names (each column is a draggable leaf).
 * Target: request template slots parsed from the Scenario — URL path variables,
 *   query params, body `{{placeholders}}`, header `{{placeholders}}`, and a
 *   "Validation Fields" group for validate-type columns.
 *
 * Dragging a column to a target slot sets the column's `type` and `mapping`
 * to match the target category (path/param/body/header/validate).
 *
 * Serialize produces an updated `DataSourceColumn[]` with type/mapping set.
 * Deserialize reconstructs mappings from existing column type/mapping values.
 */

import type { DataSourceColumn, Scenario } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  TargetField,
  ValidationIssue,
} from '../types';
import { decodeTemplateBraces } from '../../../utils/templateHelpers';

// ─── Output type ──────────────────────────────────────────

export type ColumnMappingOutput = DataSourceColumn[];

// ─── Options ──────────────────────────────────────────────

export interface ColumnMappingAdapterOptions {
  /** Existing data source columns. */
  columns: DataSourceColumn[];
  /** The scenario whose URL/body/headers define target template slots. */
  scenario: Scenario;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'data-source-columns';
const SOURCE_LABEL = 'Data Source Columns';

const TYPE_LABELS: Record<DataSourceColumn['type'], string> = {
  path: 'URL Path',
  param: 'Query Param',
  body: 'Request Body',
  header: 'Header',
  validate: 'Validation',
};

const TARGET_TYPE_SEPARATOR = '::';

// ─── Template Parser ──────────────────────────────────────

import type { TargetFieldLocation } from '../types';

export interface TemplatePlaceholder {
  /** e.g. 'vin', 'channel', 'Content-Type' */
  name: string;
  /** Column type this slot maps to */
  type: DataSourceColumn['type'];
  /** Target path in the mapper (includes type prefix for disambiguation) */
  targetPath: string;
  /** Human-readable label */
  label: string;
  /** HTTP location for grouping in the target panel */
  location: TargetFieldLocation;
}

/**
 * Extract all `{{varName}}` tokens from a string.
 * Returns unique variable names (without braces).
 */
function extractTokens(value: string | undefined): string[] {
  if (!value) return [];
  let decoded: string;
  try {
    decoded = decodeTemplateBraces(decodeURIComponent(value));
  } catch {
    decoded = decodeTemplateBraces(value);
  }
  const matches = decoded.match(/\{\{\s*(\w+)\s*\}\}/g) ?? [];
  const names = matches.map(m => {
    const inner = m.match(/\{\{\s*(\w+)\s*\}\}/);
    return inner ? inner[1] : '';
  }).filter(Boolean);
  return [...new Set(names)];
}

/**
 * Parse a Scenario's URL, body, and headers to discover all mappable
 * template slots. Returns a deduplicated list of TemplatePlaceholders.
 */
export function parseScenarioTemplate(scenario: Scenario): TemplatePlaceholder[] {
  const seen = new Set<string>();
  const placeholders: TemplatePlaceholder[] = [];

  const typeToLocation: Record<DataSourceColumn['type'], TargetFieldLocation> = {
    path: 'path',
    param: 'query',
    body: 'body',
    header: 'header',
    validate: 'body',
  };

  function add(name: string, type: DataSourceColumn['type']): void {
    const targetPath = `${type}${TARGET_TYPE_SEPARATOR}${name}`;
    if (seen.has(targetPath)) return;
    seen.add(targetPath);
    placeholders.push({
      name,
      type,
      targetPath,
      label: `${name} (${TYPE_LABELS[type]})`,
      location: typeToLocation[type],
    });
  }

  // URL path variables: {{var}} in the path portion
  const url = decodeTemplateBraces(scenario.url || '');
  try {
    const urlObj = new URL(url);
    for (const token of extractTokens(urlObj.pathname)) {
      add(token, 'path');
    }
    // Query param placeholders: param names whose values are {{var}},
    // or {{var}} tokens found in query string values
    for (const [, value] of urlObj.searchParams.entries()) {
      const tokensInValue = extractTokens(value);
      if (tokensInValue.length > 0) {
        for (const t of tokensInValue) add(t, 'param');
      }
    }
    // Also detect query param names from {{var}} in the raw query string
    // (handles cases where the entire key=value might be templated)
    for (const token of extractTokens(urlObj.search)) {
      if (!seen.has(`path${TARGET_TYPE_SEPARATOR}${token}`)) {
        add(token, 'param');
      }
    }
  } catch {
    // URL is not parseable (e.g. "{{host}}/api/{{vin}}")
    // Split on '?' to distinguish path vs query tokens
    const qIdx = url.indexOf('?');
    const pathPart = qIdx >= 0 ? url.slice(0, qIdx) : url;
    const queryPart = qIdx >= 0 ? url.slice(qIdx + 1) : '';
    for (const token of extractTokens(pathPart)) {
      add(token, 'path');
    }
    for (const token of extractTokens(queryPart)) {
      if (!seen.has(`path${TARGET_TYPE_SEPARATOR}${token}`)) {
        add(token, 'param');
      }
    }
  }

  // Body placeholders (string body)
  if (scenario.body) {
    for (const token of extractTokens(scenario.body)) {
      add(token, 'body');
    }
  }

  // Body form placeholders (form-data / x-www-form-urlencoded)
  if (scenario.bodyForm?.length) {
    for (const field of scenario.bodyForm) {
      for (const token of extractTokens(field.value)) {
        add(token, 'body');
      }
    }
  }

  // Header placeholders
  if (scenario.headers?.length) {
    for (const header of scenario.headers) {
      for (const token of extractTokens(header.value)) {
        add(token, 'header');
      }
    }
  }

  return placeholders;
}

/**
 * Build target path from a column type and mapping.
 * Inverse of parseTargetPath.
 */
function buildTargetPath(type: DataSourceColumn['type'], mapping: string): string {
  return `${type}${TARGET_TYPE_SEPARATOR}${mapping}`;
}

/**
 * Parse a target path back into type and mapping name.
 * Target paths are formatted as `type::name`.
 */
function parseTargetPath(targetPath: string): { type: DataSourceColumn['type']; mapping: string } | null {
  const sepIdx = targetPath.indexOf(TARGET_TYPE_SEPARATOR);
  if (sepIdx < 0) return null;
  const type = targetPath.slice(0, sepIdx) as DataSourceColumn['type'];
  const mapping = targetPath.slice(sepIdx + TARGET_TYPE_SEPARATOR.length);
  if (!mapping || !['path', 'param', 'body', 'header', 'validate'].includes(type)) return null;
  return { type, mapping };
}

// ─── Adapter Factory ──────────────────────────────────────

export function createColumnMappingAdapter(
  opts: ColumnMappingAdapterOptions,
): MapperAdapter<ColumnMappingOutput> {
  const { columns, scenario } = opts;

  // Source: each column is a leaf node keyed by column id (avoids collisions
  // when multiple columns share the same name).
  const sourceData: Record<string, string> = {};
  const colIdToName = new Map<string, string>();
  for (const col of columns) {
    sourceData[col.id] = col.name;
    colIdToName.set(col.id, col.name);
  }

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: sourceData,
    format: 'json',
    supportsLiveFetch: false,
  };

  // Target: template slots parsed from the scenario + a validate group.
  const templateSlots = parseScenarioTemplate(scenario);
  const targetFields: TargetField[] = templateSlots.map(p => ({
    path: p.targetPath,
    label: p.label,
    type: p.type,
    required: false,
    location: p.location,
  }));

  // Add a "Validation" catch-all field group so users can also map
  // columns to validate type (for expected-value checking).
  // Only add if there are columns that could be validate-type.
  if (!templateSlots.some(p => p.type === 'validate')) {
    targetFields.push({
      path: `validate${TARGET_TYPE_SEPARATOR}__custom__`,
      label: 'Validation Field (custom)',
      type: 'validate',
      required: false,
      location: 'body',
    });
  }

  const target: MapperTarget = {
    label: 'Request Template Slots',
    sampleData: undefined,
    fields: targetFields,
    allowCustomFields: true,
  };

  return {
    contextId: 'column-mapping',
    title: 'Columns → Request Template',
    category: 'data-source',
    sources: [source],
    target,

    serialize(mappings: Mapping[]): ColumnMappingOutput {
      const mappingBySource = new Map<string, Mapping>();
      for (const m of mappings) {
        mappingBySource.set(m.sourcePath, m);
      }

      return columns.map(col => {
        const m = mappingBySource.get(col.id);
        if (!m) return col;

        const parsed = parseTargetPath(m.targetPath);
        if (!parsed) return col;

        return {
          ...col,
          type: parsed.type,
          mapping: parsed.mapping === '__custom__' ? (col.mapping || col.name) : parsed.mapping,
        };
      });
    },

    deserialize(existing: ColumnMappingOutput): Mapping[] {
      if (!existing?.length) return [];

      return existing
        .filter(col => col.mapping && col.mapping.trim() !== '')
        .map((col, i) => ({
          id: `colmap-${i}`,
          sourceId: SOURCE_ID,
          sourcePath: col.id,
          targetPath: buildTargetPath(col.type, col.mapping),
        }));
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];

      if (mappings.length === 0) {
        issues.push({
          severity: 'info',
          message: 'No columns mapped to request slots. Drag columns to assign them.',
        });
        return issues;
      }

      const targetPaths = new Set<string>();
      const sourceNames = new Set<string>();

      for (const m of mappings) {
        const displayName = colIdToName.get(m.sourcePath) ?? m.sourcePath;

        if (!m.sourcePath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'Column name is empty.',
          });
          continue;
        }

        if (!m.targetPath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `No target slot assigned for column "${displayName}".`,
          });
          continue;
        }

        const parsed = parseTargetPath(m.targetPath);
        if (!parsed) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Invalid target path "${m.targetPath}".`,
          });
          continue;
        }

        if (sourceNames.has(m.sourcePath)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Column "${displayName}" is mapped multiple times.`,
          });
        }
        sourceNames.add(m.sourcePath);

        if (targetPaths.has(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Target slot "${parsed.mapping}" (${TYPE_LABELS[parsed.type]}) has multiple columns mapped to it.`,
          });
        }
        targetPaths.add(m.targetPath);
      }

      // Warn about unmapped template placeholders
      const unmappedSlots = templateSlots.filter(
        s => !targetPaths.has(s.targetPath),
      );
      if (unmappedSlots.length > 0) {
        issues.push({
          severity: 'info',
          message: `${unmappedSlots.length} template placeholder(s) not mapped: ${unmappedSlots.map(s => s.name).join(', ')}`,
        });
      }

      return issues;
    },
  };
}
