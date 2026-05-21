import { v4 as uuidv4 } from 'uuid';
import type { KeyValue, AuthConfig } from '../types';
import { canonicalize } from './canonicalize';
import { diffKeyValueHeaders } from './keyValueDiff';

/** Base shape shared by both RequestDefinitionSnapshot and TestDefinitionSnapshot. */
export interface HttpDefinitionSnapshotBase {
  name: string;
  url: string;
  method: string;
  headers: KeyValue[];
  body: string;
  bodyType?: string;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
}

/** Base shape shared by both version types. */
export interface DefinitionVersionBase<S extends HttpDefinitionSnapshotBase> {
  id: string;
  timestamp: number;
  label?: string;
  changeSummary?: string;
  snapshot: S;
}

export function computeSnapshotFingerprint(snapshot: HttpDefinitionSnapshotBase): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** Generate a change summary comparing the HTTP-shared fields of two snapshots. */
export function generateHttpChangeSummary(
  oldSnap: HttpDefinitionSnapshotBase,
  newSnap: HttpDefinitionSnapshotBase,
): string[] {
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

  return changes;
}

export interface HttpSnapshotDiffBase {
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

/** Compute the diff for the HTTP-shared fields between two snapshots. */
export function computeHttpSnapshotDiff(
  older: HttpDefinitionSnapshotBase,
  newer: HttpDefinitionSnapshotBase,
): HttpSnapshotDiffBase {
  const { added: headersAdded, removed: headersRemoved, modified } = diffKeyValueHeaders(
    older.headers,
    newer.headers,
  );
  const headersModified = modified.map(({ key, from, to }) => ({
    key,
    oldValue: from,
    newValue: to,
  }));

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

/** Create a version entry. Generic over snapshot type. */
export function createVersionEntry<S extends HttpDefinitionSnapshotBase>(
  snapshot: S,
  changeSummary: string,
): DefinitionVersionBase<S> {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    changeSummary,
    snapshot,
  };
}

/** Add a version to the list (newest first), capping at maxVersions. */
export function addVersionToList<V>(
  versions: V[],
  version: V,
  maxVersions: number,
): V[] {
  return [version, ...versions].slice(0, maxVersions);
}

/** Delete a version by id. */
export function deleteVersionById<V extends { id: string }>(
  versions: V[],
  versionId: string,
): V[] {
  return versions.filter(v => v.id !== versionId);
}

/** Rename a version by id. */
export function renameVersionById<V extends { id: string; label?: string }>(
  versions: V[],
  versionId: string,
  label: string,
): V[] {
  return versions.map(v => v.id === versionId ? { ...v, label } : v);
}
