import { describe, expect, it } from 'vitest';
import {
  prepareGrpcMockRuleSetExportSafe,
  serializeGrpcMockRuleSetExportSafeJson,
} from './grpcMockRuleSetExport';
import type { GrpcMockRuleSet } from './grpcMockRuleContracts';
import { scanForbiddenGrpcPersistTargets } from './grpcSecretLeakScan';

const SECRET = 'phase11j-mock-export-leak-token-abc123xyz';

function makeRuleSetWithSecret(): GrpcMockRuleSet {
  return {
    rules: [
      {
        id: 'rule-1',
        name: 'Secret body',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: {
          body: { apiKey: SECRET, authorization: `Bearer ${SECRET}` },
        },
      },
    ],
  };
}

describe('grpcMockRuleSetExport (Phase 11J)', () => {
  it('redacts secret material in safe export', () => {
    const safe = prepareGrpcMockRuleSetExportSafe(makeRuleSetWithSecret());
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain(SECRET);
    const leaks = scanForbiddenGrpcPersistTargets({ grpc_mock_rule_export: safe });
    expect(leaks).toHaveLength(0);
  });

  it('serializes pretty JSON for clipboard export', () => {
    const json = serializeGrpcMockRuleSetExportSafeJson({ rules: [] });
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain('"rules": []');
  });
});
