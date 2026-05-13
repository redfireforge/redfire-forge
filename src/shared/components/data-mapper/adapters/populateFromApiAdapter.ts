/**
 * PopulateFromApiAdapter — MapperAdapter<PopulateOutput>
 *
 * Bridges the Data Mapper to the "Populate from API" flow.
 * Source: single 'api-response' source built from fetched API response JSON.
 * Target: data source column definitions with name, type, and mapping.
 *
 * The adapter converts API response array items into DataSourceColumn[]
 * and DataSourceRow[] that feed the data-source parameterized runner.
 *
 * The source tree shows the detected array fields; dragging a field to
 * the target creates a column definition. Serialize produces { columns, rows }
 * ready for merge into the DataSource.
 *
 * Two usage modes:
 * 1. Pre-fetched: pass `responseJson` at creation (for re-editing existing populate).
 * 2. Live-fetch: pass `fetchSampleData` callback. The adapter stores the full
 *    response internally so `serialize` can extract all rows.
 */

import { v4 as uuidv4 } from 'uuid';
import type { DataSource, DataSourceColumn, DataSourceRow } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  TargetField,
  ValidationIssue,
} from '../types';
import {
  detectArrays,
  resolvePath,
  guessColType,
  findMatchingColumn,
  stringifyValue,
  selectBestArray,
  type DetectedArray,
} from '../../../../features/scenarios/utils/populateFromApiUtils';
import { getByPath } from '../../../utils/jsonPath';

// ─── Output type ──────────────────────────────────────────

export interface PopulateOutput {
  columns: DataSourceColumn[];
  rows: DataSourceRow[];
  mode: 'append' | 'replace';
}

// ─── Options ──────────────────────────────────────────────

export interface PopulateFromApiAdapterOptions {
  /** Existing data source (for column matching and baseline row values). */
  dataSource: DataSource;
  /** Pre-fetched response JSON (set after the fetch step). */
  responseJson?: unknown;
  /** Which array path is selected (e.g. 'results' or '$'). */
  selectedArrayPath?: string;
  /** Append vs replace mode for rows. Default: 'append'. */
  mode?: 'append' | 'replace';
  /**
   * Live-fetch callback: returns the full parsed JSON response.
   * The adapter will detect arrays, select the best one, and return
   * the first item as the source sample for the tree view.
   * The full response is stored internally for `serialize` to extract rows.
   */
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'api-response';
const SOURCE_LABEL = 'API Response';

const COLUMN_TYPE_LABELS: Record<DataSourceColumn['type'], string> = {
  path: 'Path Variable',
  param: 'Query Param',
  body: 'Body Variable',
  header: 'Header',
  validate: 'Validate Field',
};

// ─── Helpers ──────────────────────────────────────────────

/**
 * Build a flat sample object from the first item in the selected array.
 * This drives the source tree in the Data Mapper.
 */
function buildSourceSample(responseJson: unknown, arrayPath: string): unknown {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr.find(item => item != null && typeof item === 'object');
  return first ?? undefined;
}

/**
 * Extract array items from the response at the given array path.
 * Filters out non-object/null entries.
 */
function extractArrayItems(responseJson: unknown, arrayPath: string): Record<string, unknown>[] {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
}

/**
 * Build target fields from existing columns.
 * Each column becomes a target field with its type as a label hint.
 */
function buildTargetFields(columns: DataSourceColumn[]): TargetField[] {
  return columns.map(col => ({
    path: col.name,
    label: `${col.name} (${COLUMN_TYPE_LABELS[col.type] ?? col.type})`,
    type: col.type,
    required: false,
  }));
}

// ─── Adapter Factory ──────────────────────────────────────

export function createPopulateFromApiAdapter(
  opts: PopulateFromApiAdapterOptions,
): MapperAdapter<PopulateOutput> & {
  /** Detected arrays in the response (for array selector UI). */
  detectedArrays: DetectedArray[];
  /** Currently selected array path. */
  selectedArrayPath: string;
  /** Current insert mode. */
  mode: 'append' | 'replace';
  /** Access the internal response JSON (updated by fetchSampleData). */
  getResponseJson: () => unknown;
} {
  const { dataSource, mode = 'append' } = opts;

  // Mutable state — updated by fetchSampleData, read by serialize.
  let storedResponseJson: unknown = opts.responseJson ?? null;
  let storedArrayPath: string = '';
  let storedDetectedArrays: DetectedArray[] = [];

  // Initialize from pre-fetched response if provided.
  if (storedResponseJson) {
    storedDetectedArrays = detectArrays(storedResponseJson);
    const bestArray = selectBestArray(storedDetectedArrays);
    storedArrayPath = opts.selectedArrayPath ?? bestArray?.path ?? '';
  }

  const sourceSample = storedResponseJson && storedArrayPath
    ? buildSourceSample(storedResponseJson, storedArrayPath)
    : undefined;

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: sourceSample,
    format: 'json',
    supportsLiveFetch: !!opts.fetchSampleData,
  };

  const target: MapperTarget = {
    label: 'Data Source Columns',
    sampleData: undefined,
    fields: buildTargetFields(dataSource.columns),
    allowCustomFields: true,
  };

  const wrappedFetchSampleData = opts.fetchSampleData
    ? async (): Promise<unknown> => {
        const json = await opts.fetchSampleData!();
        storedResponseJson = json;
        storedDetectedArrays = json ? detectArrays(json) : [];
        const best = selectBestArray(storedDetectedArrays);
        storedArrayPath = best?.path ?? '';
        if (!storedArrayPath) return undefined;
        return buildSourceSample(json, storedArrayPath);
      }
    : undefined;

  return {
    contextId: 'populate-from-api',
    title: 'API Response → Data Source',
    category: 'data-source',
    capabilities: { schemaDrift: true },
    sources: [source],
    target,

    get detectedArrays() { return storedDetectedArrays; },
    get selectedArrayPath() { return storedArrayPath; },
    mode,
    getResponseJson: () => storedResponseJson,

    serialize(mappings: Mapping[]): PopulateOutput {
      if (mappings.length === 0 || !storedResponseJson || !storedArrayPath) {
        return { columns: [...dataSource.columns], rows: [], mode };
      }

      const columns: DataSourceColumn[] = [...dataSource.columns];
      const mappingToColId: Record<string, string> = {};

      for (const m of mappings) {
        const colType = guessColType(m.sourcePath);
        const existing = findMatchingColumn(columns, m.targetPath, colType);
        if (existing) {
          mappingToColId[m.id] = existing.id;
        } else {
          const id = uuidv4();
          columns.push({
            id,
            name: m.targetPath,
            type: colType,
            mapping: m.sourcePath,
          });
          mappingToColId[m.id] = id;
        }
      }

      const arrayItems = extractArrayItems(storedResponseJson, storedArrayPath);
      const baselineRow = dataSource.rows.find(r => r.enabled) ?? dataSource.rows[0];

      const newRows: DataSourceRow[] = arrayItems.map(item => {
        const values: Record<string, string> = {};
        for (const col of columns) {
          values[col.id] = baselineRow?.values[col.id] ?? '';
        }
        for (const m of mappings) {
          const colId = mappingToColId[m.id];
          if (colId) {
            const raw = getByPath(item, m.sourcePath) ?? item[m.sourcePath];
            values[colId] = stringifyValue(raw);
          }
        }
        return { id: uuidv4(), values, enabled: true };
      });

      return { columns, rows: newRows, mode };
    },

    deserialize(existing: PopulateOutput): Mapping[] {
      if (!existing?.columns?.length) return [];

      const cols = existing.columns;
      return cols
        .filter(col => col.mapping && col.mapping.trim() !== '')
        .map((col, i) => ({
          id: `pop-${i}`,
          sourceId: SOURCE_ID,
          sourcePath: col.mapping,
          targetPath: col.name,
        }));
    },

    fetchSampleData: wrappedFetchSampleData,

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];

      if (mappings.length === 0) {
        issues.push({
          severity: 'warning',
          message: 'No fields mapped. Select at least one field to populate.',
        });
        return issues;
      }

      const names = new Set<string>();
      for (const m of mappings) {
        if (!m.targetPath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'Column name is required.',
          });
          continue;
        }

        if (!m.sourcePath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Source field is empty for column "${m.targetPath}".`,
          });
        }

        if (names.has(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Duplicate column name "${m.targetPath}".`,
          });
        }
        names.add(m.targetPath);
      }

      if (!storedResponseJson) {
        issues.push({
          severity: 'error',
          message: 'Fetch an API response before saving. Click the fetch button to load data.',
        });
      } else if (!storedArrayPath) {
        issues.push({
          severity: 'error',
          message: 'No array found in the response to expand into rows. Adjust the API or pick an array path.',
        });
      }

      return issues;
    },
  };
}
