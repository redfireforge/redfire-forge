/**
 * ValidationAdapter — MapperAdapter<ValidationAdapterOutput>
 *
 * Bridges the Data Mapper to the selective validation workflow.
 * Source: single 'response-body' source from sample JSON.
 * Target: expected field values for validation.
 *
 * Supports two modes:
 * - **include**: dragged fields become `expectedFields`; `excludedPaths` is empty.
 * - **exclude**: un-mapped leaf paths become `excludedPaths`;
 *   mapped paths become `expectedFields` with user-supplied values.
 */

import type { ExpectedField, SelectiveMode } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
} from '../types';
import { getAllLeafPaths, buildJsonTree } from '../../../utils/jsonTreeModel';
import { getByPathAsString } from '../../../utils/jsonPath';

// ─── Output Type ──────────────────────────────────────────

export interface ValidationAdapterOutput {
  selectiveMode: SelectiveMode;
  expectedFields: ExpectedField[];
  excludedPaths: string[];
}

// ─── Options ──────────────────────────────────────────────

export interface ValidationAdapterOptions {
  sampleResponseBody?: string | Record<string, unknown>;
  selectiveMode?: SelectiveMode;
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'response-body';
const SOURCE_LABEL = 'Response Body';

// ─── Helpers ──────────────────────────────────────────────

function parseSample(raw?: string | Record<string, unknown>): unknown | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function getLeafPaths(data: unknown): string[] {
  if (data == null || typeof data !== 'object') return [];
  const tree = buildJsonTree(data, '', '');
  return getAllLeafPaths(tree);
}

function stripDollarPrefix(path: string): string {
  return path.replace(/^\$\.?/, '');
}

function resolveValue(data: unknown, path: string): string {
  return getByPathAsString(data, path);
}

// ─── Adapter Factory ──────────────────────────────────────

export function createValidationAdapter(
  opts: ValidationAdapterOptions = {},
): MapperAdapter<ValidationAdapterOutput> {
  const parsed = parseSample(opts.sampleResponseBody);
  const mode: SelectiveMode = opts.selectiveMode ?? 'include';

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: parsed,
    format: 'json',
    supportsLiveFetch: !!opts.fetchSampleData,
  };

  const target: MapperTarget = {
    label: 'Validation Fields',
    sampleData: undefined,
    allowCustomFields: true,
  };

  return {
    contextId: 'validation',
    title: 'Response Body → Validation Rules',
    category: 'http',
    sources: [source],
    target,

    serialize(mappings: Mapping[]): ValidationAdapterOutput {
      // Deduplicate by normalized path — last mapping wins (matches validate() message)
      const deduped = new Map<string, Mapping>();
      for (const m of mappings) {
        const key = stripDollarPrefix(m.expression ?? m.sourcePath);
        deduped.set(key, m);
      }
      const uniqueMappings = Array.from(deduped.values());

      if (mode === 'include') {
        const expectedFields: ExpectedField[] = uniqueMappings.map((m) => ({
          jsonPath: m.expression ?? m.sourcePath,
          expectedValue: m.targetPath,
        }));
        return { selectiveMode: 'include', expectedFields, excludedPaths: [] };
      }

      // exclude mode: un-mapped leaves become excludedPaths
      const mappedPaths = new Set(
        uniqueMappings.map((m) => stripDollarPrefix(m.expression ?? m.sourcePath)),
      );
      const allLeaves = getLeafPaths(parsed);
      const excludedPaths = allLeaves.filter((p) => !mappedPaths.has(p));

      const expectedFields: ExpectedField[] = uniqueMappings.map((m) => ({
        jsonPath: m.expression ?? m.sourcePath,
        expectedValue: m.targetPath,
      }));

      return { selectiveMode: 'exclude', expectedFields, excludedPaths };
    },

    deserialize(existing: ValidationAdapterOutput): Mapping[] {
      if (!existing) return [];

      const effectiveMode = existing.selectiveMode === 'exclude' ? 'exclude' : 'include';

      if (effectiveMode === 'include') {
        if (!existing.expectedFields?.length) return [];
        return existing.expectedFields.map((f, i) => ({
          id: `val-${i}`,
          sourceId: SOURCE_ID,
          sourcePath: f.jsonPath,
          targetPath: f.expectedValue,
        }));
      }

      // exclude mode: invert excludedPaths against all leaves
      const excluded = new Set(existing.excludedPaths ?? []);
      const allLeaves = getLeafPaths(parsed);
      const included = allLeaves.filter((p) => !excluded.has(p));

      const existingFieldMap = new Map<string, string>();
      for (const f of existing.expectedFields ?? []) {
        existingFieldMap.set(stripDollarPrefix(f.jsonPath), f.expectedValue);
      }

      return included.map((path, i) => ({
        id: `val-${i}`,
        sourceId: SOURCE_ID,
        sourcePath: path,
        targetPath: existingFieldMap.get(path) ?? resolveValue(parsed, path),
      }));
    },

    fetchSampleData: opts.fetchSampleData,

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];

      if (mode === 'include' && mappings.length === 0) {
        issues.push({
          severity: 'warning',
          message: 'No fields selected for validation.',
        });
      }

      const paths = new Set<string>();
      for (const m of mappings) {
        const path = m.expression ?? m.sourcePath;
        if (!path.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'JSON path is empty.',
          });
          continue;
        }
        const normalized = stripDollarPrefix(path);
        if (paths.has(normalized)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Duplicate path "${path}" — only the last will be used.`,
          });
        }
        paths.add(normalized);
      }

      return issues;
    },
  };
}
