/**
 * ExtractionAdapter — MapperAdapter<Extraction[]>
 *
 * Bridges the Data Mapper to the HTTP extraction workflow.
 * Source: single 'response-body' source built from sample response JSON.
 * Target: variable name fields derived from existing Extraction[] entries.
 *
 * Only body-source extractions are handled by the mapper; header/status
 * extractions are preserved as pass-through rows outside the mapper.
 */

import type { Extraction, ExtractionSource } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
} from '../types';

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'response-body';
const SOURCE_LABEL = 'Response Body';

// ─── Options ──────────────────────────────────────────────

export interface ExtractionAdapterOptions {
  sampleResponseBody?: string | Record<string, unknown>;
  fetchSampleData?: () => Promise<unknown>;
  /** Header/status extractions kept outside the mapper. */
  nonBodyExtractions?: Extraction[];
}

// ─── Helpers ──────────────────────────────────────────────

function isBodyExtraction(e: Extraction): boolean {
  return e.source === 'body';
}

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

export function createExtractionAdapter(
  opts: ExtractionAdapterOptions = {},
): MapperAdapter<Extraction[]> {
  const parsed = parseSample(opts.sampleResponseBody);
  const nonBody = opts.nonBodyExtractions ?? [];
  const fallbackMap = new Map<string, string>();
  // Track original interleaved positions so serialize preserves ordering
  const nonBodyIndices = new Set<number>();

  const source: MapperSource = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    sampleData: parsed,
    format: 'json',
    supportsLiveFetch: !!opts.fetchSampleData,
  };

  const target: MapperTarget = {
    label: 'Extracted Variables',
    sampleData: undefined,
    allowCustomFields: true,
  };

  return {
    contextId: 'extraction',
    title: 'Response Body → Variables',
    category: 'http',
    sources: [source],
    target,

    serialize(mappings: Mapping[]): Extraction[] {
      const bodyExtractions: Extraction[] = mappings.map((m) => {
        const ext: Extraction = {
          name: m.targetPath,
          source: 'body' as ExtractionSource,
          expression: m.expression ?? m.sourcePath,
        };
        const fallback = fallbackMap.get(m.id);
        if (fallback !== undefined) ext.fallback = fallback;
        return ext;
      });
      // Re-interleave non-body extractions at their original positions
      if (nonBodyIndices.size > 0) {
        const result: Extraction[] = [];
        let bodyIdx = 0;
        let nbIdx = 0;
        const totalLen = bodyExtractions.length + nonBody.length;
        for (let i = 0; i < totalLen; i++) {
          if (nonBodyIndices.has(i) && nbIdx < nonBody.length) {
            result.push(nonBody[nbIdx++]);
          } else if (bodyIdx < bodyExtractions.length) {
            result.push(bodyExtractions[bodyIdx++]);
          }
        }
        // Append any remaining
        while (nbIdx < nonBody.length) result.push(nonBody[nbIdx++]);
        while (bodyIdx < bodyExtractions.length) result.push(bodyExtractions[bodyIdx++]);
        return result;
      }
      return [...nonBody, ...bodyExtractions];
    },

    deserialize(existing: Extraction[]): Mapping[] {
      fallbackMap.clear();
      nonBodyIndices.clear();
      if (!existing?.length) return [];
      // Track original positions of non-body extractions for ordering
      for (let i = 0; i < existing.length; i++) {
        if (!isBodyExtraction(existing[i])) nonBodyIndices.add(i);
      }
      return existing
        .filter(isBodyExtraction)
        .map((e, i) => {
          const id = `ext-${i}`;
          if (e.fallback !== undefined) fallbackMap.set(id, e.fallback);
          return {
            id,
            sourceId: SOURCE_ID,
            sourcePath: e.expression,
            targetPath: e.name,
          };
        });
    },

    fetchSampleData: opts.fetchSampleData,

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];

      const names = new Set<string>();
      for (const m of mappings) {
        if (!m.targetPath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'Variable name is required.',
          });
          continue;
        }

        const expr = m.expression ?? m.sourcePath;
        if (!expr.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Extraction expression is empty for variable "${m.targetPath}".`,
          });
        }

        if (names.has(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Duplicate variable name "${m.targetPath}".`,
          });
        }
        names.add(m.targetPath);

        if (/[{}]/.test(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Variable name "${m.targetPath}" should not contain braces.`,
          });
        }
      }

      return issues;
    },
  };
}

/**
 * Split an Extraction[] into body-only and non-body (header/status) arrays.
 * Used by parent components to pass non-body extractions through as-is.
 */
export function splitExtractions(
  extractions: Extraction[],
): { body: Extraction[]; nonBody: Extraction[] } {
  const body: Extraction[] = [];
  const nonBody: Extraction[] = [];
  for (const e of extractions) {
    (isBodyExtraction(e) ? body : nonBody).push(e);
  }
  return { body, nonBody };
}
