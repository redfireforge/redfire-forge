/**
 * Script Library Versioning — version history for reusable script libraries.
 * Auto-saves snapshots on edit, supports restore/compare/delete.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScriptLibrary, ScriptLibraryVersion, ScriptLibrarySnapshot } from './scriptLibraries';

export const MAX_VERSIONS = 15;

// ── Snapshot & fingerprinting ───────────────────────────

/** Extract a snapshot from a ScriptLibrary. */
export function createSnapshot(lib: ScriptLibrary): ScriptLibrarySnapshot {
  return {
    name: lib.name,
    description: lib.description,
    code: lib.code,
  };
}

/** Canonical JSON string for deep equality comparison. */
function canonicalize(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(val as Record<string, unknown>).sort()) {
    out[k] = canonicalize((val as Record<string, unknown>)[k]);
  }
  return out;
}

/** Compute a fingerprint string from a snapshot. */
export function computeSnapshotFingerprint(snapshot: ScriptLibrarySnapshot): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** Check if a library has meaningful changes compared to the latest version. */
export function hasChanged(lib: ScriptLibrary): boolean {
  const versions = lib.versions ?? [];
  if (versions.length === 0) return true;
  const latest = versions[0];
  const current = createSnapshot(lib);
  return computeSnapshotFingerprint(current) !== computeSnapshotFingerprint(latest.snapshot);
}

// ── Change summary ──────────────────────────────────────

/** Generate a human-readable change summary between two snapshots. */
export function generateChangeSummary(
  oldSnap: ScriptLibrarySnapshot,
  newSnap: ScriptLibrarySnapshot,
): string {
  const parts: string[] = [];
  if (oldSnap.name !== newSnap.name) parts.push('name changed');
  if (oldSnap.description !== newSnap.description) parts.push('description changed');
  if (oldSnap.code !== newSnap.code) {
    const oldLines = oldSnap.code.split('\n').length;
    const newLines = newSnap.code.split('\n').length;
    const diff = newLines - oldLines;
    if (diff > 0) parts.push(`code changed (+${diff} lines)`);
    else if (diff < 0) parts.push(`code changed (${diff} lines)`);
    else parts.push('code changed');
  }
  return parts.length ? parts.join(', ') : 'no changes';
}

// ── Auto-save ───────────────────────────────────────────

/** Auto-save a version for a library if it has changed. Returns updated library. */
export function autoSaveVersion(
  lib: ScriptLibrary,
  maxVersions: number = MAX_VERSIONS,
): ScriptLibrary {
  if (!hasChanged(lib)) return lib;

  const snapshot = createSnapshot(lib);
  const versions = lib.versions ?? [];
  const changeSummary = versions.length > 0
    ? generateChangeSummary(versions[0].snapshot, snapshot)
    : 'initial version';

  const version: ScriptLibraryVersion = {
    id: uuidv4(),
    timestamp: Date.now(),
    changeSummary,
    snapshot,
  };

  const updated = [version, ...versions].slice(0, maxVersions);
  return { ...lib, versions: updated };
}

// ── CRUD operations ─────────────────────────────────────

/** Restore a library's fields from a specific version snapshot. */
export function restoreFromVersion(
  lib: ScriptLibrary,
  versionId: string,
): ScriptLibrary {
  const versions = lib.versions ?? [];
  const version = versions.find(v => v.id === versionId);
  if (!version) return lib;
  return {
    ...lib,
    name: version.snapshot.name,
    description: version.snapshot.description,
    code: version.snapshot.code,
    updatedAt: new Date().toISOString(),
  };
}

/** Delete a specific version from a library. */
export function deleteVersion(
  lib: ScriptLibrary,
  versionId: string,
): ScriptLibrary {
  const versions = lib.versions ?? [];
  return { ...lib, versions: versions.filter(v => v.id !== versionId) };
}

/** Rename a version's label. */
export function renameVersion(
  lib: ScriptLibrary,
  versionId: string,
  label: string,
): ScriptLibrary {
  const versions = lib.versions ?? [];
  return {
    ...lib,
    versions: versions.map(v =>
      v.id === versionId ? { ...v, label: label.trim() || undefined } : v,
    ),
  };
}

// ── Diff computation ────────────────────────────────────

export interface ScriptLibraryDiffResult {
  nameChanged: boolean;
  oldName?: string;
  newName?: string;
  descriptionChanged: boolean;
  oldDescription?: string;
  newDescription?: string;
  codeChanged: boolean;
  oldCode: string;
  newCode: string;
}

/** Compute a structured diff between two version snapshots. */
export function computeSnapshotDiff(
  older: ScriptLibrarySnapshot,
  newer: ScriptLibrarySnapshot,
): ScriptLibraryDiffResult {
  return {
    nameChanged: older.name !== newer.name,
    oldName: older.name !== newer.name ? older.name : undefined,
    newName: older.name !== newer.name ? newer.name : undefined,
    descriptionChanged: older.description !== newer.description,
    oldDescription: older.description !== newer.description ? older.description : undefined,
    newDescription: older.description !== newer.description ? newer.description : undefined,
    codeChanged: older.code !== newer.code,
    oldCode: older.code,
    newCode: newer.code,
  };
}

// ── Impact analysis ─────────────────────────────────────

export interface LibraryUsage {
  workflowId: string;
  workflowName: string;
  nodeId: string;
  nodeLabel: string;
}

/** Find all workflow nodes that reference a given script library. */
export function findLibraryUsages(
  workflows: Array<{ id: string; name: string; nodes: Array<{ id: string; type: string; data: Record<string, unknown> }> }>,
  libraryId: string,
): LibraryUsage[] {
  const usages: LibraryUsage[] = [];
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      if (node.type === 'script') {
        const data = node.data as { libraryIds?: string[]; label?: string };
        if (data.libraryIds?.includes(libraryId)) {
          usages.push({
            workflowId: wf.id,
            workflowName: wf.name,
            nodeId: node.id,
            nodeLabel: data.label || 'Script',
          });
        }
      }
    }
  }
  return usages;
}

// ── Export/import helpers ────────────────────────────────

/** Strip versions from libraries for export. */
export function stripLibraryVersions(libraries: ScriptLibrary[]): ScriptLibrary[] {
  return libraries.map(lib => {
    const { versions, ...rest } = lib;
    void versions;
    return rest;
  });
}

/** Count total versions across all libraries. */
export function countLibraryVersions(libraries: ScriptLibrary[]): number {
  return libraries.reduce((sum, lib) => sum + (lib.versions?.length ?? 0), 0);
}

/** Check if any library has version data. */
export function hasLibraryVersions(libraries: ScriptLibrary[]): boolean {
  return libraries.some(lib => (lib.versions?.length ?? 0) > 0);
}
