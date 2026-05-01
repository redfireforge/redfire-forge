import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestDefinitionVersion, TestDefinitionSnapshot, KeyValue } from '../../../shared/types';

const MAX_VERSIONS = 20;

/** Extract a snapshot from a Scenario (excludes id, validation, runtime fields). */
export function createSnapshot(scenario: Scenario): TestDefinitionSnapshot {
  return {
    name: scenario.name,
    url: scenario.url,
    method: scenario.method,
    headers: scenario.headers.filter(h => h.key.trim()),
    body: scenario.body,
    bodyType: scenario.bodyType,
    bodyForm: scenario.bodyForm?.filter(kv => kv.key.trim()),
    auth: scenario.auth,
    extractions: scenario.extractions,
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
export function computeSnapshotFingerprint(snapshot: TestDefinitionSnapshot): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** Check if a snapshot has meaningful changes compared to the latest version. */
export function hasChanged(scenario: Scenario, versions: TestDefinitionVersion[]): boolean {
  if (versions.length === 0) return true;
  const latest = versions[0];
  const current = createSnapshot(scenario);
  return computeSnapshotFingerprint(current) !== computeSnapshotFingerprint(latest.snapshot);
}

/** Generate a change summary by comparing two snapshots. */
export function generateChangeSummary(
  oldSnap: TestDefinitionSnapshot,
  newSnap: TestDefinitionSnapshot,
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

  const oldExtractions = oldSnap.extractions ?? [];
  const newExtractions = newSnap.extractions ?? [];
  const extractDiff = newExtractions.length - oldExtractions.length;
  if (extractDiff > 0) changes.push(`${extractDiff} extraction${extractDiff > 1 ? 's' : ''} added`);
  else if (extractDiff < 0) changes.push(`${-extractDiff} extraction${-extractDiff > 1 ? 's' : ''} removed`);
  else if (oldExtractions.length > 0 && JSON.stringify(canonicalize(oldExtractions)) !== JSON.stringify(canonicalize(newExtractions))) {
    changes.push('extractions modified');
  }

  return changes.length > 0 ? changes.join(', ') : 'no changes detected';
}

/** Create a new version from a scenario. */
export function createTestDefinitionVersion(
  scenario: Scenario,
  existingVersions: TestDefinitionVersion[],
): TestDefinitionVersion {
  const snapshot = createSnapshot(scenario);
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
  versions: TestDefinitionVersion[],
  version: TestDefinitionVersion,
  maxVersions: number = MAX_VERSIONS,
): TestDefinitionVersion[] {
  return [version, ...versions].slice(0, maxVersions);
}

/** Auto-save a version for a scenario if it has changed. Returns the updated versions array, or null if no change. */
export function autoSaveVersion(
  scenario: Scenario,
  maxVersions: number = MAX_VERSIONS,
): TestDefinitionVersion[] | null {
  const versions = scenario.definitionVersions ?? [];
  if (!hasChanged(scenario, versions)) return null;
  const version = createTestDefinitionVersion(scenario, versions);
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
  extractionsAdded: number;
  extractionsRemoved: number;
  extractionsModified: boolean;
  formDataChanged: boolean;
}

export function computeSnapshotDiff(
  older: TestDefinitionSnapshot,
  newer: TestDefinitionSnapshot,
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

  const oldExtractions = older.extractions ?? [];
  const newExtractions = newer.extractions ?? [];

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
    extractionsAdded: Math.max(0, newExtractions.length - oldExtractions.length),
    extractionsRemoved: Math.max(0, oldExtractions.length - newExtractions.length),
    extractionsModified: JSON.stringify(canonicalize(oldExtractions)) !== JSON.stringify(canonicalize(newExtractions)),
    formDataChanged: JSON.stringify(canonicalize(older.bodyForm ?? [])) !== JSON.stringify(canonicalize(newer.bodyForm ?? [])),
  };
}

/** Count the number of definition versions in a scenario. */
export function countDefinitionVersions(scenario: Scenario): number {
  return scenario.definitionVersions?.length ?? 0;
}

/** Strip definition versions from a scenario (for export without versions). */
export function stripDefinitionVersions(scenario: Scenario): Scenario {
  if (!scenario.definitionVersions?.length) return scenario;
  const { definitionVersions: _, ...rest } = scenario;
  return rest as Scenario;
}

/** Check if a scenario has any definition version data. */
export function hasDefinitionVersions(scenario: Scenario): boolean {
  return (scenario.definitionVersions?.length ?? 0) > 0;
}
