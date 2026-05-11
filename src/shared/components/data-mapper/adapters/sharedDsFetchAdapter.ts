/**
 * SharedDsFetchAdapter — MapperAdapter<SharedDsFetchOutput>
 *
 * Purpose-built adapter for the Shared Data Source "Populate from API" flow.
 * Source: fetched API response from the shared data source's fetchConfig.
 * Target: column definitions for the shared data source.
 *
 * This is a specialisation of the populate adapter that works directly with
 * SharedDataSourceFetchConfig instead of requiring a Scenario conversion.
 * The fetchConfig pipeline (URL, method, headers, body, auth, pathVariables)
 * is preserved and the adapter delegates actual HTTP execution to the
 * caller-provided `fetchSampleData` callback.
 *
 * serialize → { columns, rows, mode } ready for merge into SharedDataSource.dataSource.
 * deserialize → reconstruct Mapping[] from existing column definitions.
 */

import { v4 as uuidv4 } from 'uuid';
import type { DataSource, DataSourceColumn, DataSourceRow, SharedDataSourceFetchConfig } from '../../../types';
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

export interface SharedDsFetchOutput {
  columns: DataSourceColumn[];
  rows: DataSourceRow[];
  mode: 'append' | 'replace';
}

// ─── Options ──────────────────────────────────────────────

export interface SharedDsFetchAdapterOptions {
  /** Existing data source (for column matching and baseline row values). */
  dataSource: DataSource;
  /** The fetch configuration driving the request. Used for adapter title/label context. */
  fetchConfig?: SharedDataSourceFetchConfig;
  /** Pre-fetched response JSON (set after the fetch step). */
  responseJson?: unknown;
  /** Which array path is selected (e.g. 'results' or '$'). */
  selectedArrayPath?: string;
  /** Append vs replace mode for rows. Default: 'append'. */
  mode?: 'append' | 'replace';
  /**
   * Live-fetch callback: returns the full parsed JSON response.
   * The caller is responsible for building the HTTP request from fetchConfig,
   * resolving pathVariables, applying auth, and executing the fetch.
   * The adapter stores the full response internally for serialize to extract rows.
   */
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'shared-ds-response';
const SOURCE_LABEL = 'Shared DS API Response';

const COLUMN_TYPE_LABELS: Record<DataSourceColumn['type'], string> = {
  path: 'Path Variable',
  param: 'Query Param',
  body: 'Body Variable',
  header: 'Header',
  validate: 'Validate Field',
};

// ─── Helpers ──────────────────────────────────────────────

function buildSourceSample(responseJson: unknown, arrayPath: string): unknown {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr.find(item => item != null && typeof item === 'object');
  return first ?? undefined;
}

function extractArrayItems(responseJson: unknown, arrayPath: string): Record<string, unknown>[] {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
}

function buildTargetFields(columns: DataSourceColumn[]): TargetField[] {
  return columns.map(col => ({
    path: col.name,
    label: `${col.name} (${COLUMN_TYPE_LABELS[col.type] ?? col.type})`,
    type: col.type,
    required: false,
  }));
}

function buildAdapterTitle(fetchConfig?: SharedDataSourceFetchConfig): string {
  if (!fetchConfig?.url) return 'Shared DS API → Data Source';
  try {
    const u = new URL(fetchConfig.url, 'http://x');
    return `${fetchConfig.method ?? 'GET'} ${u.pathname} → Data Source`;
  } catch {
    return `${fetchConfig.method ?? 'GET'} API → Data Source`;
  }
}

// ─── Adapter Factory ──────────────────────────────────────

export function createSharedDsFetchAdapter(
  opts: SharedDsFetchAdapterOptions,
): MapperAdapter<SharedDsFetchOutput> & {
  detectedArrays: DetectedArray[];
  selectedArrayPath: string;
  mode: 'append' | 'replace';
  getResponseJson: () => unknown;
} {
  const { dataSource, fetchConfig, mode = 'append' } = opts;

  let storedResponseJson: unknown = opts.responseJson ?? null;
  let storedArrayPath: string = '';
  let storedDetectedArrays: DetectedArray[] = [];

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
    contextId: 'shared-ds-fetch',
    title: buildAdapterTitle(fetchConfig),
    category: 'data-source',
    sources: [source],
    target,

    get detectedArrays() { return storedDetectedArrays; },
    get selectedArrayPath() { return storedArrayPath; },
    mode,
    getResponseJson: () => storedResponseJson,

    serialize(mappings: Mapping[]): SharedDsFetchOutput {
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

    deserialize(existing: SharedDsFetchOutput): Mapping[] {
      if (!existing?.columns?.length) return [];

      const cols = existing.columns;
      return cols
        .filter(col => col.mapping && col.mapping.trim() !== '')
        .map((col, i) => ({
          id: `sdf-${i}`,
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
