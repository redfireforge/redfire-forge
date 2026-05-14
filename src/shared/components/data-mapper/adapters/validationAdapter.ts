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

import type { ExpectedField, SelectiveMode, FieldOperator, Assertion } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  TargetField,
  TargetSchemaResult,
  ValidationIssue,
  AdapterCapabilities,
} from '../types';
import { getAllLeafPaths, buildJsonTree } from '../../../utils/jsonTreeModel';
import { getByPath, getByPathAsString } from '../../../utils/jsonPath';
import { coerceSampleData } from '../utils/mapperParsing';
import { inferType } from '../utils/typeMismatch';

// ─── Output Type ──────────────────────────────────────────

export interface ValidationAdapterOutput {
  selectiveMode: SelectiveMode;
  expectedFields: ExpectedField[];
  excludedPaths: string[];
  unorderedArrays?: boolean;
  assertions?: Assertion[];
}

// ─── Options ──────────────────────────────────────────────

export interface ValidationAdapterOptions {
  sampleResponseBody?: string | Record<string, unknown>;
  selectiveMode?: SelectiveMode;
  expectedFields?: ExpectedField[];
  fetchSampleData?: () => Promise<unknown>;
  unorderedArrays?: boolean;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'response-body';
const SOURCE_LABEL = 'Response Body';

// ─── Helpers ──────────────────────────────────────────────


function getLeafPaths(data: unknown): string[] {
  if (data == null || typeof data !== 'object') return [];
  const tree = buildJsonTree(data, '', '');
  return getAllLeafPaths(tree);
}

function stripDollarPrefix(path: string): string {
  return path.replace(/^\$\.?/, '');
}

// ─── Adapter Factory ──────────────────────────────────────

export function createValidationAdapter(
  opts: ValidationAdapterOptions = {},
): MapperAdapter<ValidationAdapterOutput> {
  const parsed = coerceSampleData(opts.sampleResponseBody);
  const mode: SelectiveMode = opts.selectiveMode ?? 'include';
  const resolveExpectedValue = (m: Mapping): string => {
    const sourceRef = m.expression ?? m.sourcePath;
    const sourceValue = getByPath(parsed, sourceRef);
    if (sourceValue === undefined) return m.targetPath;
    if (typeof sourceValue === 'string') return sourceValue;
    return JSON.stringify(sourceValue);
  };

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: parsed,
    format: 'json',
    supportsLiveFetch: !!opts.fetchSampleData,
  };

  const target: MapperTarget = {
    label: 'Validation Fields',
    sampleData: parsed,
    allowCustomFields: true,
  };

  const capabilities: AdapterCapabilities = {
    operators: true,
    arrayAssertions: true,
    typeChecks: true,
    codeEditor: true,
    verification: true,
    expressions: true,
    schemaDrift: true,
    profiles: true,
    unorderedArrays: true,
    hideAdvanced: true,
    autoMapDefaultOperator: 'exists',
  };

  return {
    contextId: 'validation',
    title: 'Response Body → Validation Rules',
    category: 'http',
    sources: [source],
    target,
    capabilities,

    serialize(mappings: Mapping[]): ValidationAdapterOutput {
      const deduped = new Map<string, Mapping>();
      for (const m of mappings) {
        deduped.set(stripDollarPrefix(m.targetPath), m);
      }
      const uniqueMappings = Array.from(deduped.values());

      const buildExpectedField = (m: Mapping): ExpectedField => {
        const field: ExpectedField = {
          jsonPath: stripDollarPrefix(m.sourcePath),
          expectedValue: resolveExpectedValue(m),
        };
        const op = (m.operator as FieldOperator | undefined) ?? capabilities.autoMapDefaultOperator;
        if (op) field.operator = op;
        if (m.operatorValue !== undefined) field.operatorValue = m.operatorValue;
        if (m.negate) field.negate = true;
        return field;
      };

      if (mode === 'include') {
        const expectedFields = uniqueMappings.map(buildExpectedField);
        return { selectiveMode: 'include', expectedFields, excludedPaths: [] };
      }

      const mappedPaths = new Set(uniqueMappings.map((m) => stripDollarPrefix(m.targetPath)));
      const allLeaves = getLeafPaths(parsed);
      const excludedPaths = allLeaves.filter((p) => !mappedPaths.has(p));
      const expectedFields = uniqueMappings.map(buildExpectedField);

      return { selectiveMode: 'exclude', expectedFields, excludedPaths };
    },

    deserialize(existing: ValidationAdapterOutput): Mapping[] {
      if (!existing) return [];

      const effectiveMode = existing.selectiveMode === 'exclude' ? 'exclude' : 'include';

      const fieldToMapping = (f: ExpectedField, i: number): Mapping => {
        const m: Mapping = {
          id: `val-${i}`,
          sourceId: SOURCE_ID,
          sourcePath: stripDollarPrefix(f.jsonPath),
          targetPath: stripDollarPrefix(f.jsonPath),
        };
        if (f.operator) m.operator = f.operator;
        if (f.operatorValue !== undefined) m.operatorValue = f.operatorValue;
        if (f.negate) m.negate = true;
        return m;
      };

      if (effectiveMode === 'include') {
        if (!existing.expectedFields?.length) return [];
        return existing.expectedFields.map(fieldToMapping);
      }

      // exclude mode: invert excludedPaths against all leaves
      const excluded = new Set(existing.excludedPaths ?? []);
      const allLeaves = getLeafPaths(parsed);
      const included = allLeaves.filter((p) => !excluded.has(p));

      if (included.length === 0 && (existing.expectedFields?.length ?? 0) > 0) {
        return (existing.expectedFields ?? []).map(fieldToMapping);
      }

      // Merge stored operators/values from expectedFields onto included paths
      const fieldMap = new Map<string, ExpectedField>();
      for (const f of existing.expectedFields ?? []) {
        fieldMap.set(stripDollarPrefix(f.jsonPath), f);
      }

      return included.map((path, i) => {
        const storedField = fieldMap.get(stripDollarPrefix(path));
        if (storedField) {
          return fieldToMapping(storedField, i);
        }
        return {
          id: `val-${i}`,
          sourceId: SOURCE_ID,
          sourcePath: path,
          targetPath: path,
        };
      });
    },

    fetchSampleData: opts.fetchSampleData,

    fetchTargetSchema: opts.fetchSampleData
      ? async (): Promise<TargetSchemaResult> => {
          const data = await opts.fetchSampleData!();
          const fetched = coerceSampleData(data);
          if (fetched == null || typeof fetched !== 'object') {
            return { sampleData: fetched };
          }
          const tree = buildJsonTree(fetched, '', '');
          const leafPaths = getAllLeafPaths(tree);
          const fields: TargetField[] = leafPaths.map((p) => ({
            path: p,
            label: p.includes('.') ? p.split('.').pop()! : p,
            type: inferType(getByPath(fetched, p)),
            defaultValue: getByPathAsString(fetched, p),
          }));
          return { sampleData: fetched, fields };
        }
      : undefined,

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
        const path = m.expression ?? m.sourcePath ?? '';
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
