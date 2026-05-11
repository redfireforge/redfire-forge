/**
 * Schema Drift Detection — compares two SchemaSnapshots and produces
 * a list of SchemaDrift entries describing what changed.
 *
 * Used by Phase 8B+ to classify drift severity, show notification banners,
 * and highlight affected mappings.
 */

import type { SchemaSnapshot, SchemaFieldEntry } from './schemaSnapshot';
import type { Mapping } from '../types';

// ─── Types ────────────────────────────────────────────────

export type DriftType =
  | 'added'            // Field exists in current but not saved
  | 'removed'          // Field exists in saved but not current
  | 'typeChanged'      // Field exists in both but type differs
  | 'nullableChanged'; // Field's nullability status changed

export interface SchemaDrift {
  /** The field path that drifted */
  path: string;
  /** What kind of drift occurred */
  driftType: DriftType;
  /** Source identifier for multi-source adapters (undefined for target-side drift) */
  sourceId?: string;
  /** Type in the saved snapshot (undefined for 'added') */
  savedType?: string;
  /** Type in the current snapshot (undefined for 'removed') */
  currentType?: string;
  /** Whether the field was nullable in saved (undefined for 'added') */
  savedNullable?: boolean;
  /** Whether the field is nullable in current (undefined for 'removed') */
  currentNullable?: boolean;
  /** Mapping IDs affected by this drift (populated by `findAffectedMappings`) */
  affectedMappingIds: string[];
}

// ─── Diff Engine ──────────────────────────────────────────

/**
 * Compare two snapshots and return all detected drifts.
 *
 * The comparison is path-based: fields are matched by their dot-separated path.
 * Array element paths (containing `[*]`) are included in the comparison.
 */
export function diffSchemas(
  saved: SchemaSnapshot,
  current: SchemaSnapshot,
): SchemaDrift[] {
  const drifts: SchemaDrift[] = [];

  const savedByPath = new Map<string, SchemaFieldEntry>();
  for (const f of saved.fields) {
    savedByPath.set(f.path, f);
  }

  const currentByPath = new Map<string, SchemaFieldEntry>();
  for (const f of current.fields) {
    currentByPath.set(f.path, f);
  }

  // Detect removed and changed fields
  for (const [path, savedField] of savedByPath) {
    const currentField = currentByPath.get(path);

    if (!currentField) {
      drifts.push({
        path,
        driftType: 'removed',
        savedType: savedField.type,
        savedNullable: savedField.nullable,
        affectedMappingIds: [],
      });
      continue;
    }

    if (savedField.type !== currentField.type) {
      drifts.push({
        path,
        driftType: 'typeChanged',
        savedType: savedField.type,
        currentType: currentField.type,
        savedNullable: savedField.nullable,
        currentNullable: currentField.nullable,
        affectedMappingIds: [],
      });
    } else if (savedField.nullable !== currentField.nullable) {
      drifts.push({
        path,
        driftType: 'nullableChanged',
        savedType: savedField.type,
        currentType: currentField.type,
        savedNullable: savedField.nullable,
        currentNullable: currentField.nullable,
        affectedMappingIds: [],
      });
    }
  }

  // Detect added fields
  for (const [path, currentField] of currentByPath) {
    if (!savedByPath.has(path)) {
      drifts.push({
        path,
        driftType: 'added',
        currentType: currentField.type,
        currentNullable: currentField.nullable,
        affectedMappingIds: [],
      });
    }
  }

  return drifts;
}

/**
 * Normalize a path for comparison by replacing array indices/wildcards
 * with a canonical `.[*]` form.
 * `items[0].name` → `items.[*].name`
 * `items.[*].name` → `items.[*].name` (unchanged)
 * `data[2][0].x` → `data.[*].[*].x`
 */
function normalizePathForDrift(path: string): string {
  // Strip leading $. prefix (mapping paths use $. while snapshot paths don't)
  const stripped = path.startsWith('$.') ? path.slice(2) : path;
  // Replace optional dot + bracket notation with canonical .[*]
  return stripped.replace(/\.?\[(\d+|\*)\]/g, '.[*]');
}

/**
 * Find which mappings are affected by each drift entry.
 *
 * A mapping is affected if:
 * - Its sourcePath matches the drift path (for source-side drift)
 * - Its targetPath matches the drift path (for target-side drift)
 * - Its sourcePath is a child of a removed/changed parent path
 *
 * Path comparison normalizes array notation: `items[0].name` is treated
 * the same as `items.[*].name` for matching purposes.
 */
export function findAffectedMappings(
  drifts: SchemaDrift[],
  mappings: Mapping[],
  side: 'source' | 'target',
): SchemaDrift[] {
  return drifts.map((drift) => {
    const affected: string[] = [];
    const driftNorm = normalizePathForDrift(drift.path);

    for (const m of mappings) {
      if (side === 'source' && drift.sourceId != null && m.sourceId !== drift.sourceId) {
        continue;
      }
      const relevantPath = side === 'source' ? m.sourcePath : m.targetPath;
      const mappingNorm = normalizePathForDrift(relevantPath);

      if (
        mappingNorm === driftNorm ||
        mappingNorm.startsWith(driftNorm + '.') ||
        mappingNorm.startsWith(driftNorm + '[')
      ) {
        affected.push(m.id);
      }
    }

    return { ...drift, affectedMappingIds: affected };
  });
}

// ─── Drift Severity Classification ────────────────────────

export type DriftSeverity = 'info' | 'warning' | 'breaking';

export interface ClassifiedDrift extends SchemaDrift {
  severity: DriftSeverity;
  description: string;
}

/**
 * Classify each drift entry by severity:
 * - **info**: new fields added, or nullability changed (additive/minor, no action needed)
 * - **warning**: field type changed, or field removed without affected mappings
 * - **breaking**: mapped field removed (mapping will fail at runtime)
 *
 * A removed field is only "breaking" if it affects at least one mapping;
 * otherwise it's demoted to "warning" (field disappeared but wasn't used).
 */
export function classifyDrift(drifts: SchemaDrift[]): ClassifiedDrift[] {
  return drifts.map((drift): ClassifiedDrift => {
    switch (drift.driftType) {
      case 'added':
        return {
          ...drift,
          severity: 'info',
          description: `New field "${drift.path}" (${drift.currentType}) — no action needed.`,
        };

      case 'removed': {
        const hasAffected = drift.affectedMappingIds.length > 0;
        return {
          ...drift,
          severity: hasAffected ? 'breaking' : 'warning',
          description: hasAffected
            ? `Field "${drift.path}" was removed — ${drift.affectedMappingIds.length} mapping${drift.affectedMappingIds.length !== 1 ? 's' : ''} will break.`
            : `Field "${drift.path}" (${drift.savedType}) was removed — no mappings affected.`,
        };
      }

      case 'typeChanged':
        return {
          ...drift,
          severity: 'warning',
          description: `Field "${drift.path}" changed from ${drift.savedType} to ${drift.currentType}.`,
        };

      case 'nullableChanged':
        return {
          ...drift,
          severity: 'info',
          description: drift.currentNullable
            ? `Field "${drift.path}" can now be null.`
            : `Field "${drift.path}" is no longer nullable.`,
        };
    }
  });
}

/**
 * Produce a classified drift summary with severity counts.
 */
export interface ClassifiedDriftSummary extends DriftSummary {
  breakingCount: number;
  warningCount: number;
  infoCount: number;
}

export function summarizeClassifiedDrift(classified: ClassifiedDrift[]): ClassifiedDriftSummary {
  const base = summarizeDrift(classified);
  let breakingCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const c of classified) {
    switch (c.severity) {
      case 'breaking': breakingCount++; break;
      case 'warning': warningCount++; break;
      case 'info': infoCount++; break;
    }
  }

  return { ...base, breakingCount, warningCount, infoCount };
}

// ─── Summary Helpers ──────────────────────────────────────

export interface DriftSummary {
  added: number;
  removed: number;
  typeChanged: number;
  nullableChanged: number;
  totalAffectedMappings: number;
  hasDrift: boolean;
}

/**
 * Produce a human-readable summary of drift entries.
 */
export function summarizeDrift(drifts: SchemaDrift[]): DriftSummary {
  let added = 0;
  let removed = 0;
  let typeChanged = 0;
  let nullableChanged = 0;
  const affectedIds = new Set<string>();

  for (const d of drifts) {
    switch (d.driftType) {
      case 'added': added++; break;
      case 'removed': removed++; break;
      case 'typeChanged': typeChanged++; break;
      case 'nullableChanged': nullableChanged++; break;
    }
    for (const id of d.affectedMappingIds) {
      affectedIds.add(id);
    }
  }

  return {
    added,
    removed,
    typeChanged,
    nullableChanged,
    totalAffectedMappings: affectedIds.size,
    hasDrift: drifts.length > 0,
  };
}

/**
 * Format a drift summary as a human-readable string.
 */
export function formatDriftMessage(summary: DriftSummary): string {
  if (!summary.hasDrift) return 'No schema changes detected.';

  const parts: string[] = [];
  if (summary.added > 0) parts.push(`${summary.added} added`);
  if (summary.removed > 0) parts.push(`${summary.removed} removed`);
  if (summary.typeChanged > 0) parts.push(`${summary.typeChanged} type changed`);
  if (summary.nullableChanged > 0) parts.push(`${summary.nullableChanged} nullable changed`);

  const fieldsSummary = parts.join(', ');
  const mappingSuffix = summary.totalAffectedMappings > 0
    ? ` (${summary.totalAffectedMappings} mapping${summary.totalAffectedMappings !== 1 ? 's' : ''} affected)`
    : '';

  return `Schema changed: ${fieldsSummary}${mappingSuffix}`;
}
