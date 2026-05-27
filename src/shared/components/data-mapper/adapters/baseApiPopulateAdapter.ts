/**
 * createBaseApiPopulateAdapter — shared factory for API-response-to-DataSource adapters.
 *
 * Both `populateFromApiAdapter` and `sharedDsFetchAdapter` share identical logic for:
 * - Building source samples from detected arrays
 * - Building target fields from DataSourceColumn[]
 * - Serializing mappings → { columns, rows }
 * - Deserializing existing columns → Mapping[]
 * - Validating mappings
 * - Wrapping fetchSampleData with array detection
 *
 * This factory captures all that shared logic and is parameterised by a small
 * config object that supplies the per-adapter differences.
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

// ─── Shared output shape ──────────────────────────────────

export interface ApiPopulateOutput {
  columns: DataSourceColumn[];
  rows: DataSourceRow[];
  mode: 'append' | 'replace';
}

// ─── Shared options ───────────────────────────────────────

export interface BaseApiPopulateOptions {
  dataSource: DataSource;
  responseJson?: unknown;
  selectedArrayPath?: string;
  mode?: 'append' | 'replace';
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Per-adapter config ───────────────────────────────────

export interface ApiPopulateAdapterConfig {
  contextId: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  deserializeIdPrefix: string;
}

// ─── Shared return type ───────────────────────────────────

export type ApiPopulateAdapter<T extends ApiPopulateOutput = ApiPopulateOutput> =
  MapperAdapter<T> & {
    detectedArrays: DetectedArray[];
    selectedArrayPath: string;
    mode: 'append' | 'replace';
    getResponseJson: () => unknown;
  };

// ─── Helpers (shared) ─────────────────────────────────────

const COLUMN_TYPE_LABELS: Record<DataSourceColumn['type'], string> = {
  path: 'Path Variable',
  param: 'Query Param',
  body: 'Body Variable',
  header: 'Header',
  validate: 'Validate Field',
};

export function buildSourceSample(responseJson: unknown, arrayPath: string): unknown {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr.find(item => item != null && typeof item === 'object');
  return first ?? undefined;
}

export function extractArrayItems(responseJson: unknown, arrayPath: string): Record<string, unknown>[] {
  const arr = resolvePath(responseJson, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
}

export function buildTargetFields(columns: DataSourceColumn[]): TargetField[] {
  return columns.map(col => ({
    path: col.name,
    label: `${col.name} (${COLUMN_TYPE_LABELS[col.type] ?? col.type})`,
    type: col.type,
    required: false,
  }));
}

// ─── Factory ──────────────────────────────────────────────

export function createBaseApiPopulateAdapter<T extends ApiPopulateOutput = ApiPopulateOutput>(
  config: ApiPopulateAdapterConfig,
  opts: BaseApiPopulateOptions,
): ApiPopulateAdapter<T> {
  const { dataSource, mode = 'append' } = opts;
  const { contextId, sourceId, sourceLabel, title, deserializeIdPrefix } = config;

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
    id: sourceId,
    label: sourceLabel,
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
    contextId,
    title,
    category: 'data-source',
    capabilities: { schemaDrift: true },
    sources: [source],
    target,

    get detectedArrays() { return storedDetectedArrays; },
    get selectedArrayPath() { return storedArrayPath; },
    mode,
    getResponseJson: () => storedResponseJson,

    serialize(mappings: Mapping[]): T {
      if (mappings.length === 0 || !storedResponseJson || !storedArrayPath) {
        return { columns: [...dataSource.columns], rows: [], mode } as unknown as T;
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

      return { columns, rows: newRows, mode } as T;
    },

    deserialize(existing: T): Mapping[] {
      if (!existing?.columns?.length) return [];

      const cols = existing.columns;
      return cols
        .filter(col => col.mapping && col.mapping.trim() !== '')
        .map((col, i) => ({
          id: `${deserializeIdPrefix}${i}`,
          sourceId,
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
