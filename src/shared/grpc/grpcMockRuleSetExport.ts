/**
 * Phase 11J — safe mock rule set clipboard export.
 */
import type { GrpcMockRuleSet } from './grpcMockRuleContracts';
import { assertGrpcCrossFeatureExportSafe } from './grpcPersistRedactionMiddleware';
import { redactGrpcNestedValueForExport } from './grpcRedaction';

export interface GrpcMockRuleSetExportSafe {
  schemaVersion: 1;
  exportedFrom: 'grpc_studio_advanced';
  exportedAt: string;
  ruleSet: GrpcMockRuleSet;
}

export function prepareGrpcMockRuleSetExportSafe(ruleSet: GrpcMockRuleSet): GrpcMockRuleSetExportSafe {
  const safe: GrpcMockRuleSetExportSafe = {
    schemaVersion: 1,
    exportedFrom: 'grpc_studio_advanced',
    exportedAt: new Date().toISOString(),
    ruleSet: redactGrpcNestedValueForExport(structuredClone(ruleSet)) as GrpcMockRuleSet,
  };
  assertGrpcCrossFeatureExportSafe({ grpc_mock_rule_export: safe }, 'grpc_mock_rule_export');
  return safe;
}

export function serializeGrpcMockRuleSetExportSafeJson(ruleSet: GrpcMockRuleSet): string {
  return JSON.stringify(prepareGrpcMockRuleSetExportSafe(ruleSet), null, 2);
}
