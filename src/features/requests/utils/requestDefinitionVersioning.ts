import type { RequestItem, RequestDefinitionVersion, RequestDefinitionSnapshot } from '@shared/types';
import {
  computeSnapshotFingerprint,
  generateHttpChangeSummary,
  computeHttpSnapshotDiff,
  createVersionEntry,
  addVersionToList as addVersionToListGeneric,
  deleteVersionById,
  renameVersionById,
} from '@shared/utils/definitionVersioning';

export type { HttpSnapshotDiffBase as SnapshotDiffResult } from '@shared/utils/definitionVersioning';

const MAX_VERSIONS = 15;

export function createSnapshot(request: RequestItem): RequestDefinitionSnapshot {
  return {
    name: request.name,
    url: request.url,
    method: request.method,
    headers: request.headers.filter(h => h.key.trim()),
    body: request.body,
    bodyType: request.bodyType,
    bodyForm: request.bodyForm?.filter(kv => kv.key.trim()),
    auth: request.auth,
  };
}

export { computeSnapshotFingerprint };

export function hasChanged(request: RequestItem, versions: RequestDefinitionVersion[]): boolean {
  if (versions.length === 0) return true;
  const current = createSnapshot(request);
  return computeSnapshotFingerprint(current) !== computeSnapshotFingerprint(versions[0].snapshot);
}

export function generateChangeSummary(
  oldSnap: RequestDefinitionSnapshot,
  newSnap: RequestDefinitionSnapshot,
): string {
  const changes = generateHttpChangeSummary(oldSnap, newSnap);
  return changes.length > 0 ? changes.join(', ') : 'no changes detected';
}

export function createRequestDefinitionVersion(
  request: RequestItem,
  existingVersions: RequestDefinitionVersion[],
): RequestDefinitionVersion {
  const snapshot = createSnapshot(request);
  const latestSnap = existingVersions.length > 0 ? existingVersions[0].snapshot : undefined;
  const changeSummary = latestSnap
    ? generateChangeSummary(latestSnap, snapshot)
    : 'initial version';

  return createVersionEntry(snapshot, changeSummary) as RequestDefinitionVersion;
}

export function addVersionToList(
  versions: RequestDefinitionVersion[],
  version: RequestDefinitionVersion,
  maxVersions: number = MAX_VERSIONS,
): RequestDefinitionVersion[] {
  return addVersionToListGeneric(versions, version, maxVersions);
}

export function autoSaveVersion(
  request: RequestItem,
  maxVersions: number = MAX_VERSIONS,
): RequestDefinitionVersion[] | null {
  const versions = request.definitionVersions ?? [];
  if (!hasChanged(request, versions)) return null;
  const version = createRequestDefinitionVersion(request, versions);
  return addVersionToList(versions, version, maxVersions);
}

export function computeSnapshotDiff(
  older: RequestDefinitionSnapshot,
  newer: RequestDefinitionSnapshot,
) {
  return computeHttpSnapshotDiff(older, newer);
}

export function restoreFromVersion(version: RequestDefinitionVersion): Partial<RequestItem> {
  const s = version.snapshot;
  return {
    name: s.name,
    url: s.url,
    method: s.method,
    headers: s.headers.length > 0 ? s.headers : [{ key: '', value: '' }],
    body: s.body,
    bodyType: s.bodyType,
    bodyForm: s.bodyForm,
    auth: s.auth,
  };
}

export function deleteVersion(
  versions: RequestDefinitionVersion[],
  versionId: string,
): RequestDefinitionVersion[] {
  return deleteVersionById(versions, versionId);
}

export function renameVersion(
  versions: RequestDefinitionVersion[],
  versionId: string,
  label: string,
): RequestDefinitionVersion[] {
  return renameVersionById(versions, versionId, label);
}

export function countRequestDefinitionVersions(request: RequestItem): number {
  return request.definitionVersions?.length ?? 0;
}

export function stripRequestDefinitionVersions(request: RequestItem): RequestItem {
  const { definitionVersions, ...rest } = request;
  return rest as RequestItem;
}

export function hasRequestDefinitionVersions(request: RequestItem): boolean {
  return (request.definitionVersions?.length ?? 0) > 0;
}
