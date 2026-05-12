/**
 * RequestBodyAdapter — MapperAdapter<string>
 *
 * Bridges the Data Mapper to request body construction ("reverse" mapping).
 * Instead of extracting fields FROM a response, the user maps available
 * variables INTO a JSON body template.
 *
 * Source: multiple sources — upstream workflow variables (grouped by node),
 *         built-in generators ($uuid, $timestamp, etc.), environment variables.
 * Target: JSON body template structure. Users drag variables from source
 *         panels onto target fields to fill them.
 *
 * Output: serialized JSON body string with {{variableName}} placeholders
 *         inserted at mapped positions.
 */

import { setByPath } from '../../../utils/jsonPath';
import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  TargetField,
  ValidationIssue,
} from '../types';
import { findSourceForRef, hasUnsafePathSegment } from '../utils/bodyMappingShared';

// ─── Types ────────────────────────────────────────────────

export interface RequestBodyAdapterOptions {
  /** Existing body template string (JSON). Empty string or undefined for new bodies. */
  existingBody?: string;
  /** Upstream workflow variable hints, same shape as variableBindingAdapter. */
  variableHints?: VariableHintForBody[];
  /** Environment variable names available for injection. */
  envVariables?: string[];
  /** Optional body schema (field paths with types) for pre-populating the target tree. */
  bodySchema?: BodySchemaField[];
}

export interface VariableHintForBody {
  ref: string;
  label: string;
  description?: string;
  type?: string;
  source?: {
    nodeId?: string;
    nodeLabel: string;
    nodeType: string;
    category: string;
  };
}

export interface BodySchemaField {
  path: string;
  type?: string;
  required?: boolean;
  description?: string;
}

// ─── Constants ────────────────────────────────────────────

const GENERATORS_SOURCE_ID = '__generators__';
const ENV_SOURCE_ID = '__env__';
const TEMPLATE_REF_PATTERN = /\{\{([^}]+)\}\}/g;

const BUILT_IN_GENERATORS: Array<{ ref: string; label: string; type: string; description: string }> = [
  { ref: '$uuid', label: '$uuid', type: 'string', description: 'Random UUID v4' },
  { ref: '$timestamp', label: '$timestamp', type: 'number', description: 'Current Unix timestamp (ms)' },
  { ref: '$isoDate', label: '$isoDate', type: 'string', description: 'Current date in ISO 8601 format' },
  { ref: '$randomInt', label: '$randomInt', type: 'number', description: 'Random integer (0–999999)' },
  { ref: '$randomFloat', label: '$randomFloat', type: 'number', description: 'Random float (0–1)' },
  { ref: '$randomString', label: '$randomString', type: 'string', description: 'Random alphanumeric string (8 chars)' },
  { ref: '$sequenceId', label: '$sequenceId', type: 'number', description: 'Auto-incrementing sequence number' },
];

// ─── Helpers ──────────────────────────────────────────────

/**
 * Extract all {{var}} template references from a string.
 * Returns the inner ref strings (without braces).
 */
export function extractBodyTemplateRefs(template: string): string[] {
  const refs: string[] = [];
  const pattern = new RegExp(TEMPLATE_REF_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    const inner = match[1].trim();
    if (inner) refs.push(inner);
  }
  return refs;
}

/**
 * Parse a JSON body string into a structured object, returning null on failure.
 */
export function parseBodyJson(body: string): Record<string, unknown> | null {
  if (!body?.trim()) return null;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a JSON path string from dot-separated segments.
 * e.g. ["user", "name"] → "user.name"
 */
function buildPath(segments: string[]): string {
  return segments.join('.');
}

/**
 * Walk a JSON object and collect all leaf paths with their current values.
 * Returns entries like ["user.name", "John"] or ["user.age", 25].
 */
export function collectBodyLeafPaths(
  obj: unknown,
  prefix: string[] = [],
): Array<{ path: string; value: unknown }> {
  const leaves: Array<{ path: string; value: unknown }> = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    if (prefix.length > 0) {
      leaves.push({ path: buildPath(prefix), value: obj });
    }
    return leaves;
  }
  if (Array.isArray(obj)) {
    leaves.push({ path: buildPath(prefix), value: obj });
    return leaves;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0 && prefix.length > 0) {
    leaves.push({ path: buildPath(prefix), value: obj });
    return leaves;
  }
  for (const [key, val] of entries) {
    leaves.push(...collectBodyLeafPaths(val, [...prefix, key]));
  }
  return leaves;
}

/**
 * Build a JSON body string from mappings. Each mapping's targetPath is
 * a dot-separated JSON path, and its source reference becomes {{ref}}.
 */
export function buildBodyFromMappings(
  mappings: Mapping[],
  baseObj: Record<string, unknown> | null,
): string {
  let result: Record<string, unknown>;
  try {
    result = baseObj ? structuredClone(baseObj) : {};
  } catch {
    result = baseObj ? JSON.parse(JSON.stringify(baseObj)) as Record<string, unknown> : {};
  }

  // Group placeholders by targetPath so multi-ref fields (e.g. {{a}}{{b}})
  // are concatenated rather than last-write-wins
  const placeholdersByTarget = new Map<string, string>();
  for (const m of mappings) {
    const ref = m.expression?.trim() || m.sourcePath?.trim();
    if (!m.targetPath.trim() || !ref) continue;
    const placeholder = `{{${ref}}}`;
    const existing = placeholdersByTarget.get(m.targetPath);
    placeholdersByTarget.set(m.targetPath, existing ? existing + placeholder : placeholder);
  }

  for (const [targetPath, value] of placeholdersByTarget) {
    setByPath(result, targetPath, value);
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Group variable hints by their source node.
 */
function groupHintsBySource(hints: VariableHintForBody[]): Map<string, VariableHintForBody[]> {
  const groups = new Map<string, VariableHintForBody[]>();
  for (const h of hints) {
    const key = h.source?.nodeId ?? h.source?.nodeLabel ?? 'Workflow';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }
  return groups;
}

// ─── Target Building ──────────────────────────────────────

/**
 * Build target fields from an existing body template and/or schema.
 */
function buildTargetFromBody(
  existingBody: string | undefined,
  bodySchema: BodySchemaField[] | undefined,
): { targetFields: TargetField[]; sampleData: Record<string, unknown> | undefined; parsedBody: Record<string, unknown> | null } {
  const targetFields: TargetField[] = [];
  const sampleData: Record<string, unknown> = {};
  let parsedBody: Record<string, unknown> | null = null;

  if (existingBody?.trim()) {
    parsedBody = parseBodyJson(existingBody);
    if (parsedBody) {
      const leaves = collectBodyLeafPaths(parsedBody);

      for (const leaf of leaves) {
        if (!leaf.path) continue;
        const resolvedValue = resolveTemplateValue(leaf.value);

        targetFields.push({
          path: leaf.path,
          label: leaf.path.split('.').pop() ?? leaf.path,
          type: resolvedValue.type,
          required: false,
          location: 'body',
        });
        sampleData[leaf.path] = resolvedValue.display;
      }
    }
  }

  if (bodySchema?.length) {
    const existingPaths = new Set(targetFields.map(f => f.path));
    for (const field of bodySchema) {
      if (existingPaths.has(field.path)) continue;
      targetFields.push({
        path: field.path,
        label: field.path.split('.').pop() ?? field.path,
        type: field.type ?? 'string',
        required: field.required ?? false,
        location: 'body',
      });
      sampleData[field.path] = field.description ?? `<${field.type ?? 'string'}>`;
    }
  }

  return {
    targetFields,
    sampleData: Object.keys(sampleData).length > 0 ? sampleData : undefined,
    parsedBody,
  };
}

/**
 * Resolve the display value and type for a body template field value.
 * If the value is a {{ref}} placeholder, show the ref name.
 */
export function resolveTemplateValue(value: unknown): { display: string; type: string } {
  if (typeof value === 'string') {
    const match = value.match(/^\{\{([^}]+)\}\}$/);
    if (match) {
      return { display: `→ ${match[1].trim()}`, type: 'string' };
    }
    return { display: value, type: 'string' };
  }
  if (typeof value === 'number') return { display: String(value), type: 'number' };
  if (typeof value === 'boolean') return { display: String(value), type: 'boolean' };
  if (value === null) return { display: 'null', type: 'null' };
  if (Array.isArray(value)) return { display: JSON.stringify(value), type: 'array' };
  if (typeof value === 'object') return { display: JSON.stringify(value), type: 'object' };
  return { display: String(value), type: 'string' };
}

// ─── Adapter Factory ──────────────────────────────────────

export function createRequestBodyAdapter(
  opts: RequestBodyAdapterOptions,
): MapperAdapter<string> {
  const { existingBody, variableHints = [], envVariables = [], bodySchema } = opts;

  // Build sources: upstream variables grouped by node
  const sources: MapperSource[] = [];
  const groups = groupHintsBySource(variableHints);

  for (const [key, hints] of groups) {
    const sampleData: Record<string, string> = {};
    const descriptions: Record<string, string> = {};
    for (const h of hints) {
      sampleData[h.ref] = h.type ?? 'string';
      if (h.description) descriptions[h.ref] = h.description;
    }
    const firstHint = hints[0];
    sources.push({
      id: key,
      label: firstHint?.source?.nodeLabel ?? key,
      sampleData,
      format: 'json',
      fieldDescriptions: Object.keys(descriptions).length > 0 ? descriptions : undefined,
    });
  }

  // Built-in generators source
  const generatorSample: Record<string, string> = {};
  const generatorDescriptions: Record<string, string> = {};
  for (const gen of BUILT_IN_GENERATORS) {
    generatorSample[gen.ref] = gen.type;
    generatorDescriptions[gen.ref] = gen.description;
  }
  sources.push({
    id: GENERATORS_SOURCE_ID,
    label: 'Generators',
    icon: '⚡',
    sampleData: generatorSample,
    format: 'json',
    fieldDescriptions: generatorDescriptions,
  });

  // Environment variables source (if any)
  if (envVariables.length > 0) {
    const envSample: Record<string, string> = {};
    for (const name of envVariables) {
      envSample[name] = 'string';
    }
    sources.push({
      id: ENV_SOURCE_ID,
      label: 'Environment',
      icon: '🌍',
      sampleData: envSample,
      format: 'json',
    });
  }

  // Ensure at least one source
  if (sources.length === 1 && sources[0].id === GENERATORS_SOURCE_ID) {
    sources.unshift({
      id: '__empty__',
      label: 'No upstream variables',
      sampleData: {},
      format: 'json',
    });
  }

  // Build target from existing body and/or schema
  const { targetFields, sampleData, parsedBody } = buildTargetFromBody(existingBody, bodySchema);

  const target: MapperTarget = {
    label: 'Request Body',
    sampleData,
    fields: targetFields.length > 0 ? targetFields : undefined,
    allowCustomFields: true,
  };

  return {
    contextId: 'request-body',
    title: 'Variables → Request Body',
    category: 'http',
    sources,
    target,

    serialize(mappings: Mapping[]): string {
      if (parsedBody === null && existingBody?.trim()) {
        return existingBody;
      }
      return buildBodyFromMappings(mappings, parsedBody);
    },

    deserialize(existing: string): Mapping[] {
      if (!existing?.trim()) return [];
      const parsed = parseBodyJson(existing);
      if (!parsed) return [];

      const mappings: Mapping[] = [];
      const leaves = collectBodyLeafPaths(parsed);

      for (const leaf of leaves) {
        if (typeof leaf.value !== 'string') continue;
        const refs = extractBodyTemplateRefs(leaf.value);
        if (refs.length === 0) continue;

        for (const ref of refs) {
          mappings.push({
            id: `rb-${mappings.length}`,
            sourceId: findSourceForRef(ref, sources),
            sourcePath: ref,
            targetPath: leaf.path,
          });
        }
      }

      return mappings;
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      const targetPaths = new Set<string>();

      if (mappings.length === 0) {
        issues.push({
          severity: 'info',
          message: 'No mappings defined. Drag variables onto body fields to build the request.',
        });
        return issues;
      }

      for (const m of mappings) {
        if (!m.targetPath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'Target field path is required.',
          });
          continue;
        }

        const ref = m.expression?.trim() || m.sourcePath?.trim() || '';
        if (!ref) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `No variable bound to field "${m.targetPath}".`,
          });
        }

        if (hasUnsafePathSegment(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `Field path "${m.targetPath}" contains a reserved segment (__proto__, prototype, or constructor) and will be ignored.`,
          });
        }

        if (targetPaths.has(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Field "${m.targetPath}" has multiple mappings — values will be concatenated as {{ref1}}{{ref2}}.`,
          });
        }
        targetPaths.add(m.targetPath);
      }

      return issues;
    },
  };
}
