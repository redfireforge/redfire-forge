import type { Scenario, TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';
import { prepareGrpcHarnessCallActionDefinitionSnapshot } from '../../../shared/grpc/grpcInterpolationPersistGuard';
import { canonicalize } from '../../../shared/utils/canonicalize';
import {
  computeSnapshotFingerprint,
  generateHttpChangeSummary,
  computeHttpSnapshotDiff,
  createVersionEntry,
  addVersionToList as addVersionToListGeneric,
  type HttpSnapshotDiffBase,
} from '../../../shared/utils/definitionVersioning';

const MAX_VERSIONS = 20;

export function createSnapshot(scenario: Scenario): TestDefinitionSnapshot {
  const url = scenario.dataSource?.urlTemplate || scenario.url;
  const snap: TestDefinitionSnapshot = {
    name: scenario.name,
    url,
    method: scenario.method,
    headers: scenario.headers.filter(h => h.key.trim()),
    body: scenario.body,
    bodyType: scenario.bodyType,
    bodyForm: scenario.bodyForm?.filter(kv => kv.key.trim()),
    auth: scenario.auth,
    extractions: scenario.extractions,
  };
  if (scenario.actionType && scenario.actionType !== 'http') snap.actionType = scenario.actionType;
  if (scenario.wsConnectAction) snap.wsConnectAction = scenario.wsConnectAction;
  if (scenario.wsSendAction) snap.wsSendAction = scenario.wsSendAction;
  if (scenario.wsReceiveAction) snap.wsReceiveAction = scenario.wsReceiveAction;
  if (scenario.kafkaProduceAction) snap.kafkaProduceAction = scenario.kafkaProduceAction;
  if (scenario.kafkaConsumeAction) snap.kafkaConsumeAction = scenario.kafkaConsumeAction;
  if (scenario.grpcCallAction) {
    snap.grpcCallAction = prepareGrpcHarnessCallActionDefinitionSnapshot(scenario.grpcCallAction);
  }
  return snap;
}

export { computeSnapshotFingerprint };

export function hasChanged(scenario: Scenario, versions: TestDefinitionVersion[]): boolean {
  if (versions.length === 0) return true;
  const current = createSnapshot(scenario);
  return computeSnapshotFingerprint(current) !== computeSnapshotFingerprint(versions[0].snapshot);
}

export function generateChangeSummary(
  oldSnap: TestDefinitionSnapshot,
  newSnap: TestDefinitionSnapshot,
): string {
  const changes = generateHttpChangeSummary(oldSnap, newSnap);

  const oldExtractions = oldSnap.extractions ?? [];
  const newExtractions = newSnap.extractions ?? [];
  const extractDiff = newExtractions.length - oldExtractions.length;
  if (extractDiff > 0) changes.push(`${extractDiff} extraction${extractDiff > 1 ? 's' : ''} added`);
  else if (extractDiff < 0) changes.push(`${-extractDiff} extraction${-extractDiff > 1 ? 's' : ''} removed`);
  else if (oldExtractions.length > 0 && JSON.stringify(canonicalize(oldExtractions)) !== JSON.stringify(canonicalize(newExtractions))) {
    changes.push('extractions modified');
  }

  if ((oldSnap.actionType ?? 'http') !== (newSnap.actionType ?? 'http')) {
    changes.push('action type changed');
  }

  const transportFields: Array<{ key: keyof TestDefinitionSnapshot; label: string }> = [
    { key: 'wsConnectAction', label: 'WS connect config' },
    { key: 'wsSendAction', label: 'WS send config' },
    { key: 'wsReceiveAction', label: 'WS receive config' },
    { key: 'kafkaProduceAction', label: 'Kafka produce config' },
    { key: 'kafkaConsumeAction', label: 'Kafka consume config' },
    { key: 'grpcCallAction', label: 'gRPC call config' },
  ];
  for (const { key, label } of transportFields) {
    const oldVal = oldSnap[key];
    const newVal = newSnap[key];
    if (JSON.stringify(canonicalize(oldVal)) !== JSON.stringify(canonicalize(newVal))) {
      changes.push(`${label} changed`);
    }
  }

  return changes.length > 0 ? changes.join(', ') : 'no changes detected';
}

export function createTestDefinitionVersion(
  scenario: Scenario,
  existingVersions: TestDefinitionVersion[],
): TestDefinitionVersion {
  const snapshot = createSnapshot(scenario);
  const latestSnap = existingVersions.length > 0 ? existingVersions[0].snapshot : undefined;
  const changeSummary = latestSnap
    ? generateChangeSummary(latestSnap, snapshot)
    : 'initial version';

  return createVersionEntry(snapshot, changeSummary) as TestDefinitionVersion;
}

export function addVersionToList(
  versions: TestDefinitionVersion[],
  version: TestDefinitionVersion,
  maxVersions: number = MAX_VERSIONS,
): TestDefinitionVersion[] {
  return addVersionToListGeneric(versions, version, maxVersions);
}

export function autoSaveVersion(
  scenario: Scenario,
  maxVersions: number = MAX_VERSIONS,
): TestDefinitionVersion[] | null {
  const versions = scenario.definitionVersions ?? [];
  if (!hasChanged(scenario, versions)) return null;
  const version = createTestDefinitionVersion(scenario, versions);
  return addVersionToList(versions, version, maxVersions);
}

export interface SnapshotDiffResult extends HttpSnapshotDiffBase {
  extractionsAdded: number;
  extractionsRemoved: number;
  extractionsModified: boolean;
  actionTypeChanged: boolean;
  transportConfigChanged: boolean;
}

export function computeSnapshotDiff(
  older: TestDefinitionSnapshot,
  newer: TestDefinitionSnapshot,
): SnapshotDiffResult {
  const baseDiff = computeHttpSnapshotDiff(older, newer);

  const oldExtractions = older.extractions ?? [];
  const newExtractions = newer.extractions ?? [];

  const actionTypeChanged = (older.actionType ?? 'http') !== (newer.actionType ?? 'http');

  const transportFields = [
    'wsConnectAction',
    'wsSendAction',
    'wsReceiveAction',
    'kafkaProduceAction',
    'kafkaConsumeAction',
    'grpcCallAction',
  ] as const;
  const transportConfigChanged = transportFields.some((field) =>
    JSON.stringify(canonicalize(older[field])) !== JSON.stringify(canonicalize(newer[field])),
  );

  return {
    ...baseDiff,
    extractionsAdded: Math.max(0, newExtractions.length - oldExtractions.length),
    extractionsRemoved: Math.max(0, oldExtractions.length - newExtractions.length),
    extractionsModified: JSON.stringify(canonicalize(oldExtractions)) !== JSON.stringify(canonicalize(newExtractions)),
    actionTypeChanged,
    transportConfigChanged,
  };
}

export function countDefinitionVersions(scenario: Scenario): number {
  return scenario.definitionVersions?.length ?? 0;
}

export function stripDefinitionVersions(scenario: Scenario): Scenario {
  if (!scenario.definitionVersions?.length) return scenario;
  const { definitionVersions: _, ...rest } = scenario;
  return rest as Scenario;
}

export function hasDefinitionVersions(scenario: Scenario): boolean {
  return (scenario.definitionVersions?.length ?? 0) > 0;
}
