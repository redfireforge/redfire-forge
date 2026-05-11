/**
 * WebhookExtractionAdapter — MapperAdapter<WebhookExtractionOutput>
 *
 * Bridges the Data Mapper to webhook/correlation payload variable extraction.
 * Used by both WebhookConfig (trigger) and CorrelationWaitConfig (wait).
 *
 * Source: single 'webhook-payload' source built from samplePayload JSON.
 * Target: variable name fields (allowCustomFields: true).
 * Output: Array<{ name: string; jsonPath: string }> — matches the existing
 *         `extractVariables` shape on WebhookTriggerNodeData / CorrelationWaitNodeData.
 */

import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
} from '../types';
import { coerceSampleData } from '../utils/mapperParsing';

// ─── Constants ────────────────────────────────────────────

const SOURCE_ID = 'webhook-payload';
const SOURCE_LABEL = 'Webhook Payload';

// ─── Types ────────────────────────────────────────────────

export type WebhookExtractionOutput = Array<{ name: string; jsonPath: string }>;

export interface WebhookExtractionAdapterOptions {
  /** JSON payload sample — string or parsed object. */
  samplePayload?: string | Record<string, unknown>;
  /** Label override (e.g. "Correlation Payload" vs default "Webhook Payload"). */
  sourceLabel?: string;
  /** Title override (e.g. "Correlation Payload → Variables"). */
  title?: string;
}

// ─── Helpers ──────────────────────────────────────────────


function normalizePath(path: string): string {
  const p = String(path ?? '').replace(/^\.+/, '');
  if (!p || p === '$') return p || '$';
  if (p.startsWith('$.') || p.startsWith('$[')) return p;
  if (p.startsWith('[')) return `$${p}`;
  return `$.${p}`;
}

// ─── Adapter Factory ──────────────────────────────────────

export function createWebhookExtractionAdapter(
  opts: WebhookExtractionAdapterOptions = {},
): MapperAdapter<WebhookExtractionOutput> {
  const parsed = coerceSampleData(opts.samplePayload);
  const label = opts.sourceLabel ?? SOURCE_LABEL;

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
    contextId: 'webhook-extraction',
    title: opts.title ?? `${label} → Variables`,
    category: 'webhook',
    sources: [source],
    target,

    serialize(mappings: Mapping[]): WebhookExtractionOutput {
      return mappings.map((m) => ({
        name: m.targetPath,
        jsonPath: normalizePath(m.expression ?? m.sourcePath),
      }));
    },

    deserialize(existing: WebhookExtractionOutput): Mapping[] {
      if (!existing?.length) return [];
      return existing.map((ev, i) => ({
        id: `wh-${i}`,
        sourceId: SOURCE_ID,
        sourcePath: normalizePath(ev.jsonPath),
        targetPath: ev.name,
      }));
    },

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

        const path = m.expression ?? m.sourcePath;
        if (!path.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `JSON path is empty for variable "${m.targetPath}".`,
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
