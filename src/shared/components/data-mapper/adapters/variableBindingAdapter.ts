/**
 * VariableBindingAdapter — MapperAdapter<VariableBinding[]>
 *
 * Bridges the Data Mapper to workflow variable binding visualization.
 * Source: upstream workflow variable hints, grouped by producing node.
 * Target: template slots ({{var}} references) found in the current node's
 *         URL, headers, and body.
 *
 * Output: Array<{ templateRef: string; boundTo: string }> where templateRef
 * is the inner template key (without braces) and boundTo is the source
 * variable ref that feeds it.
 */

import type {
  MapperAdapter,
  MapperSource,
  MapperTarget,
  Mapping,
  ValidationIssue,
  AdapterCapabilities,
} from '../types';

// ─── Types ────────────────────────────────────────────────

export interface VariableBinding {
  /** Template key used in the scenario (inner ref, no {{}}). */
  templateRef: string;
  /** Variable ref that feeds this slot (from upstream hint). */
  boundTo: string;
}

export interface VariableHintInput {
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

export interface VariableBindingAdapterOptions {
  /** Available upstream variable hints. */
  variableHints: VariableHintInput[];
  /** Template slots to bind — parsed from the scenario's URL, headers, body. */
  templateSlots: TemplateSlot[];
}

export interface TemplateSlot {
  /** Inner ref (without braces), e.g. "orderId" or "node:abc.status". */
  ref: string;
  /** Where this template ref appears: path, query, header, body, bodyForm. */
  location: 'path' | 'query' | 'header' | 'body' | 'bodyForm';
  /** For headers: the header key where this appears. */
  headerKey?: string;
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Extract all {{var}} template references from a string.
 * Skips generator refs (those starting with $).
 */
export function extractTemplateRefs(template: string): string[] {
  const refs: string[] = [];
  template.replace(/\{\{([^}]+)\}\}/g, (_m, inner: string) => {
    const t = inner.trim();
    if (t && !t.startsWith('$')) refs.push(t);
    return '';
  });
  return refs;
}

/**
 * Parse a Scenario-like object to collect all template slots.
 */
export function collectTemplateSlots(scenario: {
  url?: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  bodyForm?: Array<{ key: string; value: string }>;
}): TemplateSlot[] {
  const slots: TemplateSlot[] = [];
  const seen = new Set<string>();

  const add = (ref: string, location: TemplateSlot['location'], headerKey?: string) => {
    const key = `${ref}::${location}::${headerKey ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    slots.push({ ref, location, ...(headerKey ? { headerKey } : {}) });
  };

  if (scenario.url) {
    const qIdx = scenario.url.indexOf('?');
    const pathPart = qIdx >= 0 ? scenario.url.slice(0, qIdx) : scenario.url;
    const queryPart = qIdx >= 0 ? scenario.url.slice(qIdx + 1) : '';

    for (const ref of extractTemplateRefs(pathPart)) {
      add(ref, 'path');
    }
    for (const ref of extractTemplateRefs(queryPart)) {
      add(ref, 'query');
    }
  }

  if (scenario.headers) {
    for (const h of scenario.headers) {
      for (const ref of extractTemplateRefs(h.value)) {
        add(ref, 'header', h.key);
      }
      for (const ref of extractTemplateRefs(h.key)) {
        add(ref, 'header');
      }
    }
  }

  if (scenario.body) {
    for (const ref of extractTemplateRefs(scenario.body)) {
      add(ref, 'body');
    }
  }

  if (scenario.bodyForm) {
    for (const f of scenario.bodyForm) {
      for (const ref of extractTemplateRefs(f.value)) {
        add(ref, 'bodyForm');
      }
      for (const ref of extractTemplateRefs(f.key)) {
        add(ref, 'bodyForm');
      }
    }
  }

  return slots;
}

function groupHintsBySource(hints: VariableHintInput[]): Map<string, VariableHintInput[]> {
  const groups = new Map<string, VariableHintInput[]>();
  for (const h of hints) {
    const key = h.source?.nodeId ?? h.source?.nodeLabel ?? 'Workflow';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }
  return groups;
}

function buildSourceLabel(groupKey: string, hints: VariableHintInput[]): string {
  const first = hints[0];
  if (first?.source?.nodeLabel) return first.source.nodeLabel;
  return groupKey;
}

function slotLabel(slot: TemplateSlot): string {
  if (slot.location === 'header' && slot.headerKey) {
    return `${slot.ref} (header: ${slot.headerKey})`;
  }
  return `${slot.ref} (${slot.location})`;
}

// ─── Adapter Factory ──────────────────────────────────────

export function createVariableBindingAdapter(
  opts: VariableBindingAdapterOptions,
): MapperAdapter<VariableBinding[]> {
  const groups = groupHintsBySource(opts.variableHints);

  const sources: MapperSource[] = [];
  for (const [key, hints] of groups) {
    const sampleData: Record<string, string> = {};
    for (const h of hints) {
      sampleData[h.ref] = h.type ?? 'string';
    }
    sources.push({
      id: key,
      label: buildSourceLabel(key, hints),
      sampleData,
      format: 'json',
    });
  }

  if (sources.length === 0) {
    sources.push({
      id: '__empty__',
      label: 'No upstream variables',
      sampleData: {},
      format: 'json',
    });
  }

  // Build unique target paths: when the same ref appears in multiple locations
  // (e.g. URL and body), disambiguate with location suffix
  const refCounts = new Map<string, number>();
  for (const slot of opts.templateSlots) {
    refCounts.set(slot.ref, (refCounts.get(slot.ref) ?? 0) + 1);
  }

  function slotTargetPath(slot: TemplateSlot): string {
    if ((refCounts.get(slot.ref) ?? 0) > 1) {
      return slot.headerKey
        ? `${slot.ref}::${slot.location}::${slot.headerKey}`
        : `${slot.ref}::${slot.location}`;
    }
    return slot.ref;
  }

  const slotPathMap = new Map<string, TemplateSlot>();
  const targetSampleData: Record<string, string> = {};
  for (const slot of opts.templateSlots) {
    const tp = slotTargetPath(slot);
    targetSampleData[tp] = slotLabel(slot);
    slotPathMap.set(tp, slot);
  }

  const target: MapperTarget = {
    label: 'Template Slots',
    sampleData: Object.keys(targetSampleData).length > 0 ? targetSampleData : undefined,
    fields: opts.templateSlots.map((slot) => ({
      path: slotTargetPath(slot),
      label: slotLabel(slot),
      type: 'string',
      required: false,
      location: slot.location,
    })),
    allowCustomFields: false,
  };

  const capabilities: AdapterCapabilities = {
    expressions: true,
    codeEditor: true,
    profiles: true,
  };

  return {
    contextId: 'variable-binding',
    title: 'Upstream Variables → Template Slots',
    category: 'workflow',
    sources,
    capabilities,
    target,

    serialize(mappings: Mapping[]): VariableBinding[] {
      return mappings.map((m) => {
        // Strip location suffix from disambiguated target paths
        const slot = slotPathMap.get(m.targetPath);
        const templateRef = slot ? slot.ref : m.targetPath.split('::')[0];
        return {
          templateRef,
          boundTo: m.expression ?? m.sourcePath,
        };
      });
    },

    deserialize(existing: VariableBinding[]): Mapping[] {
      if (!existing?.length) return [];
      // Match bindings back to disambiguated target paths.
      // Use a stable ordering: first pass grabs non-disambiguated (unique ref) slots,
      // second pass assigns remaining to disambiguated slots in declaration order.
      const usedPaths = new Set<string>();

      // Pre-build a ref → candidate paths index for efficient lookup
      const refToCandidates = new Map<string, string[]>();
      for (const [fullPath, slot] of slotPathMap) {
        if (!refToCandidates.has(slot.ref)) refToCandidates.set(slot.ref, []);
        refToCandidates.get(slot.ref)!.push(fullPath);
      }

      return existing.map((vb, i) => {
        const candidates = refToCandidates.get(vb.templateRef) ?? [];
        // Prefer exact (non-disambiguated) match first, then any unused candidate
        let tp = vb.templateRef;
        const exact = candidates.find((c) => c === vb.templateRef && !usedPaths.has(c));
        if (exact) {
          tp = exact;
        } else {
          const available = candidates.find((c) => !usedPaths.has(c));
          if (available) tp = available;
        }
        usedPaths.add(tp);
        return {
          id: `vb-${i}`,
          sourceId: findSourceForRef(vb.boundTo, groups),
          sourcePath: vb.boundTo,
          targetPath: tp,
        };
      });
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      const boundSlots = new Set<string>();

      for (const m of mappings) {
        if (!m.targetPath.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: 'Template slot is required.',
          });
          continue;
        }

        const ref = m.expression ?? m.sourcePath;
        if (!ref.trim()) {
          issues.push({
            mappingId: m.id,
            severity: 'error',
            message: `No variable bound to template slot "${m.targetPath}".`,
          });
        }

        if (boundSlots.has(m.targetPath)) {
          issues.push({
            mappingId: m.id,
            severity: 'warning',
            message: `Template slot "${m.targetPath}" is bound more than once.`,
          });
        }
        boundSlots.add(m.targetPath);
      }

      return issues;
    },
  };
}

function findSourceForRef(ref: string, groups: Map<string, VariableHintInput[]>): string {
  for (const [key, hints] of groups) {
    if (hints.some((h) => h.ref === ref)) return key;
  }
  const firstKey = groups.keys().next().value;
  return firstKey ?? '__empty__';
}
