/**
 * Phase 4H — redacted export bundles for workflow/harness/collection consumers.
 */
import type { GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import type { GrpcHarnessExecuteSnapshot } from '../../../shared/types/grpc-harness-snapshot';
import {
  prepareGrpcCallHistoryRecord,
  redactGrpcExecuteSnapshotForExport,
  type GrpcCallHistoryRecord,
} from '../../../shared/grpc/grpcRedaction';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import type { GrpcSavedRequestTabContext } from '../../../shared/grpc/grpcReplayTemplateCompatibility';
import {
  applyGrpcCallHistoryTemplateContext,
  type GrpcCallHistoryTemplateContext,
} from '../../../shared/grpc/grpcReplayTemplateCompatibility';
import { assertGrpcCrossFeatureExportSafe } from '../../../shared/grpc/grpcPersistRedactionMiddleware';
import { prepareGrpcHarnessResultReportExport } from '../../../shared/grpc/grpcHarnessExport';

export type { GrpcHarnessResultReportExport } from '../../../shared/grpc/grpcHarnessExport';

export interface GrpcWorkflowNodeExport {
  kind: 'grpc_call';
  label: string;
  snapshot: GrpcTabExecuteSnapshot;
}

export interface GrpcHarnessScenarioExport {
  kind: 'grpc_scenario';
  name: string;
  snapshot: GrpcTabExecuteSnapshot;
}

export interface GrpcExportBundle {
  version: 1;
  savedRequest: GrpcSavedRequest;
  snapshot: GrpcTabExecuteSnapshot;
}

export function prepareGrpcWorkflowNodeExport(input: {
  label: string;
  snapshot: GrpcTabExecuteSnapshot;
}): GrpcWorkflowNodeExport {
  const snapshot = redactGrpcExecuteSnapshotForExport(input.snapshot);
  const node: GrpcWorkflowNodeExport = {
    kind: 'grpc_call',
    label: input.label,
    snapshot,
  };
  assertGrpcCrossFeatureExportSafe({ workflow_node_snapshot: node }, 'workflow_export');
  return node;
}

export function prepareGrpcHarnessScenarioExport(input: {
  name: string;
  snapshot: GrpcTabExecuteSnapshot;
}): GrpcHarnessScenarioExport {
  const snapshot = redactGrpcExecuteSnapshotForExport(input.snapshot);
  const scenario: GrpcHarnessScenarioExport = {
    kind: 'grpc_scenario',
    name: input.name,
    snapshot,
  };
  assertGrpcCrossFeatureExportSafe({ harness_scenario_export: scenario }, 'harness_export');
  return scenario;
}

/** Phase 8B — bridge frozen harness execute snapshot to Phase 4H export contract. */
export function prepareGrpcHarnessExecuteSnapshotExport(
  snapshot: GrpcHarnessExecuteSnapshot,
): GrpcHarnessScenarioExport {
  return prepareGrpcHarnessScenarioExport({
    name: snapshot.scenarioName,
    snapshot: snapshot.execute,
  });
}

export { prepareGrpcHarnessResultReportExport };

export function prepareGrpcExportBundle(input: {
  snapshot: GrpcTabExecuteSnapshot;
  identity: {
    id: string;
    revisionId: string;
    createdAt?: string;
    updatedAt: string;
    name?: string;
  };
  connectionId?: string;
  tabContext?: GrpcSavedRequestTabContext;
}): GrpcExportBundle {
  const snapshot = redactGrpcExecuteSnapshotForExport(input.snapshot);
  const savedRequest = createGrpcSavedRequestFromSnapshot(
    snapshot,
    input.identity,
    input.tabContext ?? (input.connectionId ? { connectionId: input.connectionId } : undefined),
  );
  const bundle: GrpcExportBundle = {
    version: 1,
    savedRequest,
    snapshot,
  };
  assertGrpcCrossFeatureExportSafe({ grpc_export_bundle: bundle }, 'grpc_export_bundle');
  return bundle;
}

export function prepareGrpcCallHistoryExport(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallHistoryRecord['result'];
  error?: GrpcCallHistoryRecord['error'];
  templateContext?: GrpcCallHistoryTemplateContext;
}): GrpcCallHistoryRecord {
  const { snapshot } = applyGrpcCallHistoryTemplateContext(input.snapshot, input.templateContext);
  const record = prepareGrpcCallHistoryRecord({
    snapshot,
    result: input.result,
    error: input.error,
  });
  assertGrpcCrossFeatureExportSafe({ grpc_call_history_v1: record }, 'call_history');
  return record;
}
