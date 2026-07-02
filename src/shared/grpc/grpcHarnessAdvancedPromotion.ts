/**
 * Phase 11N — Harness promotion helpers for advanced gRPC artifacts.
 */
import type { GrpcTabExecuteSnapshot } from './contracts';
import type { GrpcLoadTestConfig } from './grpcAdvancedFeatureContracts';
import type { GrpcSchemaDiffReport } from './grpcSchemaDiffContracts';
import type { GrpcLoadTestRunSummaryExport } from './grpcLoadTestMetrics';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  prepareGrpcLoadTestRunSummaryExportSafe,
  prepareGrpcSchemaDiffReportExportSafe,
  serializeGrpcSchemaDiffReportExportSafeMarkdown,
  type GrpcAdvancedFeatureSourceMetadata,
  type GrpcLoadTestRunSummaryExportSafe,
  type GrpcSchemaDiffReportExportSafe,
} from './grpcAdvancedFeatureExport';
import { assertGrpcCrossFeatureExportSafe } from './grpcPersistRedactionMiddleware';
import {
  prepareGrpcHarnessResultReportExport,
  type GrpcHarnessResultReportExport,
} from './grpcHarnessExport';

export interface GrpcLoadTestHarnessProfileFixture {
  schemaVersion: 1;
  kind: 'grpc_load_test_profile';
  name: string;
  config: GrpcLoadTestConfig;
  sourceMetadata?: GrpcAdvancedFeatureSourceMetadata;
}

export interface GrpcHarnessAdvancedAttachments {
  loadTestProfile?: GrpcLoadTestHarnessProfileFixture;
  loadTestSummary?: GrpcLoadTestRunSummaryExportSafe;
  schemaDiffReport?: GrpcSchemaDiffReportExportSafe;
  schemaDiffMarkdown?: string;
}

export interface GrpcHarnessResultReportExportWithAdvanced extends GrpcHarnessResultReportExport {
  advancedAttachments?: GrpcHarnessAdvancedAttachments;
}

export function prepareGrpcLoadTestProfileHarnessFixture(input: {
  name: string;
  config: GrpcLoadTestConfig;
  executeSnapshot?: GrpcTabExecuteSnapshot;
  connectionId?: string;
}): GrpcLoadTestHarnessProfileFixture {
  const fixture: GrpcLoadTestHarnessProfileFixture = {
    schemaVersion: 1,
    kind: 'grpc_load_test_profile',
    name: input.name,
    config: structuredClone(input.config),
    sourceMetadata: input.executeSnapshot
      ? buildGrpcAdvancedFeatureSourceMetadata(input.executeSnapshot, {
        connectionId: input.connectionId,
      })
      : undefined,
  };
  assertGrpcCrossFeatureExportSafe({ grpc_load_test_profile_fixture: fixture }, 'grpc_load_test_profile_fixture');
  return fixture;
}

export function prepareGrpcHarnessResultReportExportWithAdvanced(input: {
  base: Parameters<typeof prepareGrpcHarnessResultReportExport>[0];
  loadTestProfile?: GrpcLoadTestHarnessProfileFixture;
  loadTestSummary?: GrpcLoadTestRunSummaryExport;
  loadTestSourceMetadata?: GrpcAdvancedFeatureSourceMetadata;
  schemaDiffReport?: GrpcSchemaDiffReport;
  schemaDiffBaselineCapturedAt?: string;
}): GrpcHarnessResultReportExportWithAdvanced {
  const report = prepareGrpcHarnessResultReportExport(input.base);
  const advancedAttachments: GrpcHarnessAdvancedAttachments = {};

  if (input.loadTestProfile) {
    advancedAttachments.loadTestProfile = input.loadTestProfile;
  }
  if (input.loadTestSummary && input.loadTestSourceMetadata) {
    advancedAttachments.loadTestSummary = prepareGrpcLoadTestRunSummaryExportSafe(
      input.loadTestSummary,
      input.loadTestSourceMetadata,
    );
  }
  if (input.schemaDiffReport) {
    const safeReport = prepareGrpcSchemaDiffReportExportSafe(input.schemaDiffReport, {
      baselineCapturedAt: input.schemaDiffBaselineCapturedAt,
    });
    advancedAttachments.schemaDiffReport = safeReport;
    advancedAttachments.schemaDiffMarkdown = serializeGrpcSchemaDiffReportExportSafeMarkdown(
      input.schemaDiffReport,
      { baselineCapturedAt: input.schemaDiffBaselineCapturedAt },
    );
  }

  const bundle: GrpcHarnessResultReportExportWithAdvanced = {
    ...report,
    ...(Object.keys(advancedAttachments).length > 0 ? { advancedAttachments } : {}),
  };
  assertGrpcCrossFeatureExportSafe({ harness_advanced_result_export: bundle }, 'harness_advanced_result_export');
  return bundle;
}
