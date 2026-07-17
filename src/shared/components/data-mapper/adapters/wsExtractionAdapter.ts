/**
 * WsExtractionAdapter — MapperAdapter<Extraction[]>
 *
 * Bridges the Data Mapper to WebSocket message variable extraction.
 * Used by the test editor for WS receive/send+wait scenarios.
 *
 * Source: single 'ws-message' source built from sample message JSON.
 * Target: variable name fields (allowCustomFields: true).
 * Output: Extraction[] — body-only extractions matching the HTTP extraction format.
 */

import type { Extraction, ExtractionSource } from '../../../types';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
} from '../types';
import { coerceSampleData } from '../utils/mapperParsing';
import { validateVariableMappings } from './utils/variableMappingValidation';

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'ws-message';
const SOURCE_LABEL = 'WS Message';

// ─── Types ────────────────────────────────────────────────

export interface WsExtractionAdapterOptions {
  /** JSON message sample — string or parsed object. */
  sampleMessage?: string | Record<string, unknown>;
  /** Source label override (default: "WS Message"). */
  sourceLabel?: string;
  /** Title override (default: "WS Message → Variables"). */
  title?: string;
}

// ─── Helpers ──────────────────────────────────────────────

function normalizePath(path: string): string {
  const p = String(path ?? '').replace(/^\.+/, '');
  if (!p || p === '$') return p || '$';
  if (p.startsWith('$.') || p.startsWith('$[')) return p;
  if (p.startsWith('[')) return `$${p}`;
  if (/^\$[A-Za-z]/.test(p)) return p;
  return `$.${p}`;
}

// ─── Adapter Factory ──────────────────────────────────────

export function createWsExtractionAdapter(
  opts: WsExtractionAdapterOptions = {},
): MapperAdapter<Extraction[]> {
  const parsed = coerceSampleData(opts.sampleMessage);
  const label = opts.sourceLabel ?? SOURCE_LABEL;
  const fallbackMap = new Map<string, string>();

  const source: MapperSource = {
    id: SOURCE_ID,
    label,
    sampleData: parsed,
    format: 'json',
  };

  const target: MapperTarget = {
    label: 'Extracted Variables',
    sampleData: undefined,
    allowCustomFields: true,
  };

  return {
    contextId: 'ws-extraction',
    title: opts.title ?? `${label} → Variables`,
    category: 'messaging',
    capabilities: { expressions: true },
    sources: [source],
    target,

    serialize(mappings: Mapping[]): Extraction[] {
      return mappings.map((m) => {
        const ext: Extraction = {
          name: m.targetPath,
          source: 'body' as ExtractionSource,
          expression: normalizePath(m.expression ?? m.sourcePath),
        };
        const fallback = m.fallback ?? fallbackMap.get(m.id);
        if (fallback !== undefined) ext.fallback = fallback;
        return ext;
      });
    },

    deserialize(existing: Extraction[]): Mapping[] {
      fallbackMap.clear();
      if (!existing?.length) return [];
      return existing
        .filter((e) => e.source === 'body')
        .map((e, i) => {
          const id = `ws-${i}`;
          if (e.fallback !== undefined) fallbackMap.set(id, e.fallback);
          return {
            id,
            sourceId: SOURCE_ID,
            sourcePath: normalizePath(e.expression),
            targetPath: e.name,
          };
        });
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      return validateVariableMappings(mappings, {
        emptyValueMessage: (targetPath) =>
          `JSON path is empty for variable "${targetPath}".`,
      });
    },
  };
}
