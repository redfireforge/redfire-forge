import { v4 as uuidv4 } from 'uuid';
import type { RequestItem, RequestDefinitionVersion, RequestDefinitionSnapshot, KeyValue } from '../../../shared/types';
import { canonicalize } from '../../../shared/utils/canonicalize';

const MAX_VERSIONS = 15;

/** Extract a snapshot from a RequestItem (excludes id, savedQueryParams, catalogMeta, runtime fields). */
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

/** Compute a fingerprint string from a snapshot. */
export function computeSnapshotFingerprint(snapshot: RequestDefinitionSnapshot): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** Check if a request has meaningful changes compared to the latest version. */
export function hasChanged(request: RequestItem, versions: RequestDefinitionVersion[]): boolean {
  if (versions.length === 0) return true;
  const latest = versions[0];
  const current = createSnapshot(request);
  return computeSnapshotFingerprint(current) !== computeSnapshotFingerprint(latest.snapshot);
}

/** Generate a change summary by comparing two snapshots. */
export function generateChangeSummary(
  oldSnap: RequestDefinitionSnapshot,
  newSnap: RequestDefinitionSnapshot,
): string {
  const changes: string[] = [];

  if (oldSnap.name !== newSnap.name) changes.push('name changed');
  if (oldSnap.url !== newSnap.url) changes.push('URL changed');
  if (oldSnap.method !== newSnap.method) changes.push(`method → ${newSnap.method}`);

  const oldHeaders = oldSnap.headers.filter(h => h.key.trim());
  const newHeaders = newSnap.headers.filter(h => h.key.trim());
  const headerDiff = newHeaders.length - oldHeaders.length;
  if (headerDiff > 0) changes.push(`${headerDiff} header${headerDiff > 1 ? 's' : ''} added`);
  else if (headerDiff < 0) changes.push(`${-headerDiff} header${-headerDiff > 1 ? 's' : ''} removed`);
  else if (oldHeaders.length > 0 && JSON.stringify(canonicalize(oldHeaders)) !== JSON.stringify(canonicalize(newHeaders))) {
    changes.push('headers modified');
  }

  if (oldSnap.body !== newSnap.body) changes.push('body modified');
  if (oldSnap.bodyType !== newSnap.bodyType) changes.push(`body type → ${newSnap.bodyType ?? 'none'}`);

  const oldForm = (oldSnap.bodyForm ?? []).filter(kv => kv.key.trim());
  const newForm = (newSnap.bodyForm ?? []).filter(kv => kv.key.trim());
  if (JSON.stringify(canonicalize(oldForm)) !== JSON.stringify(canonicalize(newForm))) {
    changes.push('form data modified');
  }

  if (JSON.stringify(canonicalize(oldSnap.auth)) !== JSON.stringify(canonicalize(newSnap.auth))) {
    changes.push(`auth ${oldSnap.auth.type} → ${newSnap.auth.type}`);
  }

  return changes.length > 0 ? changes.join(', ') : 'no changes detected';
}

/** Create a new version from a request. */
export function createRequestDefinitionVersion(
  request: RequestItem,
  existingVersions: RequestDefinitionVersion[],
): RequestDefinitionVersion {
  const snapshot = createSnapshot(request);
  const latestSnap = existingVersions.length > 0 ? existingVersions[0].snapshot : undefined;
  const changeSummary = latestSnap
    ? generateChangeSummary(latestSnap, snapshot)
    : 'initial version';

  return {
    id: uuidv4(),
    timestamp: Date.now(),
    changeSummary,
    snapshot,
  };
}

/** Add a version to the list, capping at MAX_VERSIONS. Returns the new list (newest first). */
export function addVersionToList(
  versions: RequestDefinitionVersion[],
  version: RequestDefinitionVersion,
  maxVersions: number = MAX_VERSIONS,
): RequestDefinitionVersion[] {
  return [version, ...versions].slice(0, maxVersions);
}

/** Auto-save a version for a request if it has changed. Returns the updated versions array, or null if no change. */
export function autoSaveVersion(
  request: RequestItem,
  maxVersions: number = MAX_VERSIONS,
): RequestDefinitionVersion[] | null {
  const versions = request.definitionVersions ?? [];
  if (!hasChanged(request, versions)) return null;
  const version = createRequestDefinitionVersion(request, versions);
  return addVersionToList(versions, version, maxVersions);
}

/** Compute the diff between two snapshots. */
export interface SnapshotDiffResult {
  nameChanged: boolean;
  urlChanged: boolean;
  methodChanged: boolean;
  headersAdded: KeyValue[];
  headersRemoved: KeyValue[];
  headersModified: Array<{ key: string; oldValue: string; newValue: string }>;
  bodyChanged: boolean;
  bodyTypeChanged: boolean;
  authChanged: boolean;
  formDataChanged: boolean;
}

export function computeSnapshotDiff(
  older: RequestDefinitionSnapshot,
  newer: RequestDefinitionSnapshot,
): SnapshotDiffResult {
  const oldHeaders = new Map(older.headers.filter(h => h.key.trim()).map(h => [h.key, h.value]));
  const newHeaders = new Map(newer.headers.filter(h => h.key.trim()).map(h => [h.key, h.value]));

  const headersAdded: KeyValue[] = [];
  const headersRemoved: KeyValue[] = [];
  const headersModified: Array<{ key: string; oldValue: string; newValue: string }> = [];

  for (const [key, value] of newHeaders) {
    if (!oldHeaders.has(key)) headersAdded.push({ key, value });
    else if (oldHeaders.get(key) !== value) headersModified.push({ key, oldValue: oldHeaders.get(key)!, newValue: value });
  }
  for (const [key, value] of oldHeaders) {
    if (!newHeaders.has(key)) headersRemoved.push({ key, value });
  }

  return {
    nameChanged: older.name !== newer.name,
    urlChanged: older.url !== newer.url,
    methodChanged: older.method !== newer.method,
    headersAdded,
    headersRemoved,
    headersModified,
    bodyChanged: older.body !== newer.body,
    bodyTypeChanged: older.bodyType !== newer.bodyType,
    authChanged: JSON.stringify(canonicalize(older.auth)) !== JSON.stringify(canonicalize(newer.auth)),
    formDataChanged: JSON.stringify(canonicalize(older.bodyForm ?? [])) !== JSON.stringify(canonicalize(newer.bodyForm ?? [])),
  };
}

/** Restore a request from a version snapshot. Returns the patch to apply. */
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

/** Delete a version from the list. */
export function deleteVersion(
  versions: RequestDefinitionVersion[],
  versionId: string,
): RequestDefinitionVersion[] {
  return versions.filter(v => v.id !== versionId);
}

/** Rename a version. */
export function renameVersion(
  versions: RequestDefinitionVersion[],
  versionId: string,
  label: string,
): RequestDefinitionVersion[] {
  return versions.map(v => v.id === versionId ? { ...v, label } : v);
}

/** Count versions for export/import helpers. */
export function countRequestDefinitionVersions(request: RequestItem): number {
  return request.definitionVersions?.length ?? 0;
}

/** Strip versions from a request. */
export function stripRequestDefinitionVersions(request: RequestItem): RequestItem {
  const { definitionVersions, ...rest } = request;
  return rest as RequestItem;
}

/** Check if request has any definition versions. */
export function hasRequestDefinitionVersions(request: RequestItem): boolean {
  return (request.definitionVersions?.length ?? 0) > 0;
}
