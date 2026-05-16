/**
 * Bi-directional sync engine for Request Body Builder.
 *
 * Keeps a raw body template string and visual Mapping[] in sync:
 * - Template → Visual: parse body, detect {{var}} refs, produce Mapping[]
 * - Visual → Template: take Mapping[], produce body string with {{var}} placeholders
 * - Conflict resolution: latest-edit-wins with merge for non-conflicting changes
 *
 * This is a pure utility module (no React dependencies). The React hook
 * that uses it lives alongside the UI in Phase 6C.
 */

import type { Mapping, MapperSource } from '../types';
import {
  extractBodyTemplateRefs,
  parseBodyJson,
  collectBodyLeafPaths,
  buildBodyFromMappings,
} from '../adapters/requestBodyAdapter';
import { findSourceForRef } from './bodyMappingShared';

// ─── Types ────────────────────────────────────────────────

export type SyncOrigin = 'template' | 'visual';

export interface BodySyncState {
  /** Current raw body template string. */
  body: string;
  /** Current visual mappings derived from or producing the body. */
  mappings: Mapping[];
  /** Which side was last edited (for conflict resolution). */
  lastOrigin: SyncOrigin;
  /** Snapshot of the body at last sync point (for diff detection). */
  lastSyncedBody: string;
  /** Snapshot of mappings at last sync point (for diff detection). */
  lastSyncedMappings: Mapping[];
}

export interface SyncResult {
  /** Updated body string. */
  body: string;
  /** Updated mappings. */
  mappings: Mapping[];
  /** Whether the body changed compared to input. */
  bodyChanged: boolean;
  /** Whether mappings changed compared to input. */
  mappingsChanged: boolean;
}

export interface BodySyncOptions {
  /** Available mapper sources for resolving sourceId on deserialized mappings. */
  sources: MapperSource[];
}

// ─── Core Sync Functions ──────────────────────────────────

/**
 * Create an initial sync state from a body string and optional existing mappings.
 */
export function createSyncState(
  body: string,
  mappings: Mapping[] = [],
): BodySyncState {
  return {
    body,
    mappings,
    lastOrigin: 'template',
    lastSyncedBody: body,
    lastSyncedMappings: mappings,
  };
}

/**
 * Sync after the template (body string) was edited by the user.
 * Detects {{var}} refs in the new body and produces updated Mapping[].
 */
export function syncFromTemplate(
  newBody: string,
  currentMappings: Mapping[],
  opts: BodySyncOptions,
): SyncResult {
  const parsed = parseBodyJson(newBody);
  if (!parsed) {
    // Preserve existing mappings when JSON is temporarily invalid (user mid-edit)
    return {
      body: newBody,
      mappings: currentMappings,
      bodyChanged: false,
      mappingsChanged: false,
    };
  }

  const leaves = collectBodyLeafPaths(parsed);
  const newMappings: Mapping[] = [];
  // Group existing mappings by targetPath to support multi-ref fields (e.g. {{a}}{{b}})
  const existingByTarget = new Map<string, Mapping[]>();
  for (const m of currentMappings) {
    const arr = existingByTarget.get(m.targetPath) ?? [];
    arr.push(m);
    existingByTarget.set(m.targetPath, arr);
  }

  for (const leaf of leaves) {
    if (typeof leaf.value !== 'string') continue;
    const refs = extractBodyTemplateRefs(leaf.value);
    if (refs.length === 0) continue;

    const candidates = existingByTarget.get(leaf.path) ?? [];
    const usedCandidateIds = new Set<string>();
    for (const ref of refs) {
      const existing = candidates.find(
        (m) => !usedCandidateIds.has(m.id) && (m.sourcePath === ref || m.expression === ref),
      );

      if (existing) {
        usedCandidateIds.add(existing.id);
        newMappings.push(existing);
      } else {
        newMappings.push({
          id: `rb-${newMappings.length}-${Date.now()}`,
          sourceId: findSourceForRef(ref, opts.sources),
          sourcePath: ref,
          targetPath: leaf.path,
        });
      }
    }
  }

  const mappingsChanged = !mappingsEqual(currentMappings, newMappings);

  return {
    body: newBody,
    mappings: newMappings,
    bodyChanged: false,
    mappingsChanged,
  };
}

/**
 * Sync after visual mappings were changed (drag-and-drop, expression edit, etc.).
 * Produces an updated body string from the new Mapping[].
 */
export function syncFromVisual(
  newMappings: Mapping[],
  currentBody: string,
): SyncResult {
  const baseParsed = parseBodyJson(currentBody);

  // If the body isn't valid JSON, preserve it as-is — avoid replacing
  // raw/in-progress content with a generated JSON object
  if (!baseParsed) {
    return {
      body: currentBody,
      mappings: newMappings,
      bodyChanged: false,
      mappingsChanged: false,
    };
  }

  const newBody = buildBodyFromMappings(newMappings, baseParsed);
  const bodyChanged = newBody !== currentBody;

  return {
    body: newBody,
    mappings: newMappings,
    bodyChanged,
    mappingsChanged: false,
  };
}

/**
 * Resolve a conflict when both sides may have changed.
 * Uses latest-edit-wins: the `origin` parameter indicates which
 * side the user last interacted with.
 */
export function resolveConflict(
  state: BodySyncState,
  opts: BodySyncOptions,
): SyncResult {
  const bodyDirty = state.body !== state.lastSyncedBody;
  const mappingsDirty = !mappingsEqual(state.mappings, state.lastSyncedMappings);

  if (!bodyDirty && !mappingsDirty) {
    return {
      body: state.body,
      mappings: state.mappings,
      bodyChanged: false,
      mappingsChanged: false,
    };
  }

  if (bodyDirty && !mappingsDirty) {
    return syncFromTemplate(state.body, state.mappings, opts);
  }

  if (!bodyDirty && mappingsDirty) {
    return syncFromVisual(state.mappings, state.body);
  }

  // Both sides changed — latest origin wins
  if (state.lastOrigin === 'template') {
    return syncFromTemplate(state.body, state.mappings, opts);
  }
  return syncFromVisual(state.mappings, state.body);
}

/**
 * Compute a diff of template refs between two body strings.
 * Returns added and removed refs.
 */
export function diffTemplateRefs(
  oldBody: string,
  newBody: string,
): { added: Array<{ path: string; ref: string }>; removed: Array<{ path: string; ref: string }> } {
  const oldRefs = extractRefsWithPaths(oldBody);
  const newRefs = extractRefsWithPaths(newBody);

  const oldSet = new Set(oldRefs.map(r => `${r.path}::${r.ref}`));
  const newSet = new Set(newRefs.map(r => `${r.path}::${r.ref}`));

  const added = newRefs.filter(r => !oldSet.has(`${r.path}::${r.ref}`));
  const removed = oldRefs.filter(r => !newSet.has(`${r.path}::${r.ref}`));

  return { added, removed };
}

/**
 * Apply an incremental template edit to existing mappings.
 * Only adds/removes mappings for refs that changed, preserving
 * existing mapping IDs and state for unchanged refs.
 */
export function applyTemplateDiff(
  oldBody: string,
  newBody: string,
  currentMappings: Mapping[],
  opts: BodySyncOptions,
): SyncResult {
  if (!parseBodyJson(newBody)) {
    return {
      body: newBody,
      mappings: currentMappings,
      bodyChanged: oldBody !== newBody,
      mappingsChanged: false,
    };
  }

  const { added, removed } = diffTemplateRefs(oldBody, newBody);

  if (added.length === 0 && removed.length === 0) {
    return {
      body: newBody,
      mappings: currentMappings,
      bodyChanged: oldBody !== newBody,
      mappingsChanged: false,
    };
  }

  const removedKeys = new Set(removed.map(r => `${r.path}::${r.ref}`));
  const surviving = currentMappings.filter(m => {
    const ref = m.expression?.trim() || m.sourcePath?.trim() || '';
    return !removedKeys.has(`${m.targetPath}::${ref}`);
  });

  const newMappings: Mapping[] = [...surviving];
  for (const { path, ref } of added) {
    const alreadyExists = newMappings.some(
      m => m.targetPath === path && (m.sourcePath === ref || m.expression === ref),
    );
    if (alreadyExists) continue;

    newMappings.push({
      id: `rb-${Date.now()}-${newMappings.length}`,
      sourceId: findSourceForRef(ref, opts.sources),
      sourcePath: ref,
      targetPath: path,
    });
  }

  return {
    body: newBody,
    mappings: newMappings,
    bodyChanged: oldBody !== newBody,
    mappingsChanged: !mappingsEqual(currentMappings, newMappings),
  };
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Extract all template refs with their JSON paths from a body string.
 */
function extractRefsWithPaths(body: string): Array<{ path: string; ref: string }> {
  const parsed = parseBodyJson(body);
  if (!parsed) return [];

  const leaves = collectBodyLeafPaths(parsed);
  const result: Array<{ path: string; ref: string }> = [];

  for (const leaf of leaves) {
    if (typeof leaf.value !== 'string') continue;
    const refs = extractBodyTemplateRefs(leaf.value);
    for (const ref of refs) {
      result.push({ path: leaf.path, ref });
    }
  }

  return result;
}

/**
 * Shallow equality check for mapping arrays (by id, sourcePath, targetPath, expression).
 */
export function mappingsEqual(a: Mapping[], b: Mapping[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].sourcePath !== b[i].sourcePath ||
      a[i].targetPath !== b[i].targetPath ||
      a[i].expression !== b[i].expression ||
      a[i].sourceId !== b[i].sourceId
    ) {
      return false;
    }
  }
  return true;
}
