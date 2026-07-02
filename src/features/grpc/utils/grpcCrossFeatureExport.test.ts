/**
 * Phase 4H — cross-feature export leak-scan tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_RESULT } from '../../../shared/grpc/contractFixtures';
import { GRPC_REDACTED_PLACEHOLDER } from '../../../shared/grpc/grpcRedaction';
import { scanForbiddenGrpcPersistTargets } from '../../../shared/grpc/grpcSecretLeakScan';
import {
  prepareGrpcCallHistoryExport,
  prepareGrpcExportBundle,
  prepareGrpcHarnessExecuteSnapshotExport,
  prepareGrpcHarnessScenarioExport,
  prepareGrpcWorkflowNodeExport,
} from './grpcCrossFeatureExport';
import { buildGrpcHarnessExecuteSnapshot } from '../../../shared/grpc/grpcHarnessSnapshotBuilder';
import { FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
LEAKED-CA
-----END CERTIFICATE-----`;

const RAW_SNAPSHOT = {
  tabId: 'tab-1',
  requestId: 'req-1',
  capturedAt: '2026-01-01T00:00:00.000Z',
  callType: 'unary' as const,
  target: {
    address: 'localhost:50051',
    tlsMode: 'tls' as const,
    tlsConfig: { serverCaPem: VALID_PEM },
  },
  service: 'echo.EchoService',
  method: 'Echo',
  body: { message: 'hi' },
  metadata: { authorization: 'Bearer super-secret-token-value' },
  timeoutMs: 30000,
  descriptorKey: 'desc-1',
  auth: { type: 'bearer' as const, bearerToken: 'super-secret-token-value' },
};

describe('grpcCrossFeatureExport (Phase 4H)', () => {
  it('prepareGrpcWorkflowNodeExport passes forbidden-target leak scan', () => {
    const node = prepareGrpcWorkflowNodeExport({
      label: 'Echo unary',
      snapshot: RAW_SNAPSHOT,
    });
    expect(node.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    const findings = scanForbiddenGrpcPersistTargets({
      workflow_node_snapshot: node,
    });
    expect(findings).toHaveLength(0);
  });

  it('prepareGrpcHarnessScenarioExport passes forbidden-target leak scan', () => {
    const scenario = prepareGrpcHarnessScenarioExport({
      name: 'Echo scenario',
      snapshot: RAW_SNAPSHOT,
    });
    const findings = scanForbiddenGrpcPersistTargets({
      harness_scenario_export: scenario,
    });
    expect(findings).toHaveLength(0);
  });

  it('prepareGrpcExportBundle redacts saved request and snapshot without connectionId', () => {
    const bundle = prepareGrpcExportBundle({
      snapshot: RAW_SNAPSHOT,
      identity: { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(bundle.savedRequest.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(bundle.savedRequest.connectionId).toBeUndefined();
    const findings = scanForbiddenGrpcPersistTargets({
      grpc_export_bundle: bundle,
    });
    expect(findings).toHaveLength(0);
  });

  it('prepareGrpcExportBundle redacts saved request and snapshot with connectionId', () => {
    const bundle = prepareGrpcExportBundle({
      snapshot: RAW_SNAPSHOT,
      identity: { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      connectionId: 'profile-prod',
    });
    expect(bundle.savedRequest.connectionId).toBe('profile-prod');
  });

  it('prepareGrpcExportBundle preserves template target from tabContext (Phase 9F)', () => {
    const bundle = prepareGrpcExportBundle({
      snapshot: RAW_SNAPSHOT,
      identity: { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      tabContext: {
        rawTarget: '{{grpcHost}}',
        rawBody: { message: '{{greeting}}' },
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    });
    expect(bundle.savedRequest.target).toBe('{{grpcHost}}');
    expect(bundle.savedRequest.body).toEqual({ message: '{{greeting}}' });
  });

  it('prepareGrpcCallHistoryExport matches Phase 4E history contract', () => {
    const record = prepareGrpcCallHistoryExport({
      snapshot: RAW_SNAPSHOT,
      result: FIXTURE_UNARY_CALL_RESULT,
    });
    const findings = scanForbiddenGrpcPersistTargets({
      grpc_call_history_v1: record,
    });
    expect(findings).toHaveLength(0);
  });

  it('prepareGrpcCallHistoryExport accepts optional error alongside result', () => {
    const record = prepareGrpcCallHistoryExport({
      snapshot: RAW_SNAPSHOT,
      result: FIXTURE_UNARY_CALL_RESULT,
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'failed',
      },
    });
    expect(record.error?.message).toBe('failed');
  });

  it('prepareGrpcCallHistoryExport preserves template target for replay (Phase 9F)', () => {
    const record = prepareGrpcCallHistoryExport({
      snapshot: RAW_SNAPSHOT,
      templateContext: {
        rawTarget: '{{grpcHost}}',
        filterTarget: 'localhost:50051',
      },
    });
    expect(record.snapshot.target.address).toBe('{{grpcHost}}');
  });

  it('prepareGrpcHarnessExecuteSnapshotExport bridges Phase 8B snapshot to 4H export', () => {
    const scenario = _makeScenario({
      id: 'grpc-export',
      name: 'Harness export',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hi' },
        auth: { type: 'bearer', bearerToken: 'super-secret-token-value' },
      },
    });
    const harnessSnapshot = buildGrpcHarnessExecuteSnapshot(
      { scenario, requestId: 'req-export', capturedAt: '2026-01-01T00:00:00.000Z' },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );
    const exported = prepareGrpcHarnessExecuteSnapshotExport(harnessSnapshot);
    expect(exported.name).toBe('Harness export');
    expect(exported.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    const findings = scanForbiddenGrpcPersistTargets({ harness_scenario_export: exported });
    expect(findings).toHaveLength(0);
  });
});
