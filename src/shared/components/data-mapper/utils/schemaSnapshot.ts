/**
 * Schema Snapshot Engine — captures the structure of source and target data
 * at save time. Used by the drift detection system (Phase 8B+) to identify
 * when APIs change their response shape.
 *
 * A snapshot records every field path, its inferred type, nesting depth,
 * and whether it's nullable or an array. Two snapshots can be compared
 * via `diffSchemas()` in `schemaDrift.ts` to produce `SchemaDrift[]`.
 */

import { readKey, writeKey } from '../../../utils/storage';
import { inferType } from './typeMismatch';

// ─── Types ────────────────────────────────────────────────

export interface SchemaFieldEntry {
  /** Dot-separated field path (e.g. "user.address.city") */
  path: string;
  /** Inferred runtime type: string, number, boolean, object, array, null */
  type: string;
  /** Nesting depth (root fields = 0, nested = parent count) */
  depth: number;
  /** Whether this field was observed as null/undefined in the sample */
  nullable: boolean;
  /** Whether this field's parent (or itself) is an array element */
  isArrayElement: boolean;
}

export interface SchemaSnapshot {
  /** Unique identifier for this snapshot */
  id: string;
  /** Adapter contextId this snapshot belongs to */
  contextId: string;
  /** Which side: 'source' or 'target' */
  side: 'source' | 'target';
  /** Source ID (for multi-source adapters, identifies which source panel) */
  sourceId?: string;
  /** All field entries discovered from sample data */
  fields: SchemaFieldEntry[];
  /** ISO timestamp when the snapshot was captured */
  capturedAt: string;
  /** Number of top-level keys in the sample */
  topLevelKeyCount: number;
}

export interface SchemaSnapshotPair {
  source: SchemaSnapshot[];
  target: SchemaSnapshot | null;
}

// ─── Storage ──────────────────────────────────────────────

const STORAGE_PREFIX = 'dm-schema-snapshot-';

function storageKey(contextId: string): string {
  return `${STORAGE_PREFIX}${contextId}`;
}

export async function loadSnapshot(contextId: string): Promise<SchemaSnapshotPair | null> {
  try {
    const raw = await readKey(storageKey(contextId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'source' in parsed) {
      return parsed as SchemaSnapshotPair;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(
  contextId: string,
  pair: SchemaSnapshotPair,
): Promise<void> {
  try {
    await writeKey(storageKey(contextId), JSON.stringify(pair));
  } catch {
    // Storage full or private browsing — silently degrade
  }
}

export async function deleteSnapshot(contextId: string): Promise<void> {
  try {
    await writeKey(storageKey(contextId), '');
  } catch {
    // Silently degrade
  }
}

// ─── Field Walking ────────────────────────────────────────

const MAX_DEPTH = 20;

/**
 * Walk a JSON value recursively and collect all field entries
 * with their paths, types, depth, and array context.
 *
 * Includes cycle detection (WeakSet) and a max-depth guard (20 levels)
 * to prevent stack overflows on pathological inputs.
 */
export function collectFieldEntries(
  value: unknown,
  prefix: string[] = [],
  inArray = false,
  _visited?: WeakSet<object>,
): SchemaFieldEntry[] {
  const entries: SchemaFieldEntry[] = [];
  const depth = prefix.length;

  if (depth > MAX_DEPTH) return entries;

  if (value === null || value === undefined) {
    if (depth > 0) {
      entries.push({
        path: prefix.join('.'),
        type: 'null',
        depth: depth - 1,
        nullable: true,
        isArrayElement: inArray,
      });
    }
    return entries;
  }

  const visited = _visited ?? new WeakSet<object>();

  if (Array.isArray(value)) {
    if (visited.has(value)) return entries;
    visited.add(value);

    const path = prefix.join('.');
    if (depth > 0) {
      entries.push({
        path,
        type: 'array',
        depth: depth - 1,
        nullable: false,
        isArrayElement: inArray,
      });
    }
    // Find the first non-null element to capture array element schema
    const representative = value.find((el) => el !== null && el !== undefined);
    if (representative !== undefined && typeof representative === 'object') {
      entries.push(...collectFieldEntries(representative, [...prefix, '[*]'], true, visited));
    } else if (representative !== undefined) {
      entries.push({
        path: [...prefix, '[*]'].join('.'),
        type: inferType(representative),
        depth,
        nullable: value.some((el) => el === null || el === undefined),
        isArrayElement: true,
      });
    } else if (value.length > 0) {
      // All elements are null/undefined
      entries.push({
        path: [...prefix, '[*]'].join('.'),
        type: 'null',
        depth,
        nullable: true,
        isArrayElement: true,
      });
    }
    return entries;
  }

  if (typeof value === 'object') {
    if (visited.has(value as object)) return entries;
    visited.add(value as object);

    if (depth > 0) {
      entries.push({
        path: prefix.join('.'),
        type: 'object',
        depth: depth - 1,
        nullable: false,
        isArrayElement: inArray,
      });
    }
    const obj = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      entries.push(...collectFieldEntries(val, [...prefix, key], inArray, visited));
    }
    return entries;
  }

  // Scalar leaf
  if (depth > 0) {
    entries.push({
      path: prefix.join('.'),
      type: inferType(value),
      depth: depth - 1,
      nullable: false,
      isArrayElement: inArray,
    });
  }

  return entries;
}

// ─── Snapshot Capture ─────────────────────────────────────

/**
 * Capture a SchemaSnapshot from sample data.
 */
export function captureSchemaSnapshot(
  contextId: string,
  side: 'source' | 'target',
  sampleData: unknown,
  sourceId?: string,
): SchemaSnapshot {
  const fields = collectFieldEntries(sampleData);

  let topLevelKeyCount = 0;
  if (sampleData && typeof sampleData === 'object' && !Array.isArray(sampleData)) {
    topLevelKeyCount = Object.keys(sampleData as Record<string, unknown>).length;
  }

  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contextId,
    side,
    sourceId,
    fields,
    capturedAt: new Date().toISOString(),
    topLevelKeyCount,
  };
}

/**
 * Capture a full SchemaSnapshotPair from an adapter's sources and target.
 */
export function captureSnapshotPair(
  contextId: string,
  sources: Array<{ id: string; sampleData?: unknown }>,
  targetSampleData: unknown,
): SchemaSnapshotPair {
  const sourceSnapshots: SchemaSnapshot[] = [];

  for (const src of sources) {
    if (src.sampleData != null) {
      sourceSnapshots.push(
        captureSchemaSnapshot(contextId, 'source', src.sampleData, src.id),
      );
    }
  }

  const target = targetSampleData != null
    ? captureSchemaSnapshot(contextId, 'target', targetSampleData)
    : null;

  return { source: sourceSnapshots, target };
}
