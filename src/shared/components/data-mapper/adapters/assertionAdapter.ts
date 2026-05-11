/**
 * AssertionAdapter — MapperAdapter<AssertionAdapterResult>
 *
 * Bridges the Data Mapper to the regex assertion builder.
 * Source: single 'response-body' source from sample JSON.
 * Target: single field — the selected JSONPath for the regex assertion.
 *
 * This is the simplest adapter: single-mapping path selection,
 * no multi-field mapping needed.
 */

import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
} from '../types';

// ─── Output Type ──────────────────────────────────────────

export interface AssertionAdapterResult {
  jsonPath: string;
  pattern: string;
  patternName?: string;
}

// ─── Options ──────────────────────────────────────────────

export interface AssertionAdapterOptions {
  sampleResponseBody?: string | Record<string, unknown>;
  initialPattern?: string;
  initialPatternName?: string;
  /** Live getter for current pattern/patternName, used by serialize() to avoid stale closures. */
  getPattern?: () => { pattern: string; patternName?: string };
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'response-body';
const SOURCE_LABEL = 'Response Body';
const TARGET_PATH = 'jsonPath';

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

// ─── Adapter Factory ──────────────────────────────────────

export function createAssertionAdapter(
  opts: AssertionAdapterOptions = {},
): MapperAdapter<AssertionAdapterResult> {
  const parsed = parseSample(opts.sampleResponseBody);
  const fallbackPattern = opts.initialPattern ?? '';
  const fallbackPatternName = opts.initialPatternName;

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: parsed,
    format: 'json',
    supportsLiveFetch: !!opts.fetchSampleData,
  };

  const target: MapperTarget = {
    label: 'Assertion Target',
    sampleData: { [TARGET_PATH]: '' },
    allowCustomFields: false,
    fields: [
      { path: TARGET_PATH, label: 'JSON Path', type: 'string', required: true },
    ],
  };

  return {
    contextId: 'assertion',
    title: 'Response Body → Regex Assertion',
    category: 'http',
    sources: [source],
    target,

    serialize(mappings: Mapping[]): AssertionAdapterResult {
      const first = mappings[0];
      const jsonPath = first
        ? (first.expression ?? first.sourcePath)
        : '';
      const live = opts.getPattern?.();
      const pattern = live?.pattern ?? fallbackPattern;
      const patternName = live?.patternName ?? fallbackPatternName;
      return {
        jsonPath,
        pattern,
        ...(patternName ? { patternName } : {}),
      };
    },

    deserialize(existing: AssertionAdapterResult): Mapping[] {
      if (!existing?.jsonPath) return [];
      return [
        {
          id: 'assertion-0',
          sourceId: SOURCE_ID,
          sourcePath: existing.jsonPath,
          targetPath: TARGET_PATH,
        },
      ];
    },

    fetchSampleData: opts.fetchSampleData,

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];

      if (mappings.length === 0) {
        issues.push({
          severity: 'error',
          message: 'Select a JSON path for the regex assertion.',
        });
      }

      if (mappings.length > 1) {
        issues.push({
          severity: 'warning',
          message: 'Only one JSON path can be selected for a regex assertion. The first mapping will be used.',
        });
      }

      const first = mappings[0];
      if (first) {
        const path = first.expression ?? first.sourcePath;
        if (!path.trim()) {
          issues.push({
            mappingId: first.id,
            severity: 'error',
            message: 'JSON path is empty.',
          });
        }
      }

      const live = opts.getPattern?.();
      const currentPattern = live?.pattern ?? opts.initialPattern ?? '';
      if (!currentPattern.trim()) {
        issues.push({
          severity: 'error',
          message: 'Regex pattern is required.',
        });
      }

      return issues;
    },
  };
}
