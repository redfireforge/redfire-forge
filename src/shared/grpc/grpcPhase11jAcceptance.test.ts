/**
 * Phase 11J — Studio UX closure acceptance checklist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS } from './grpcSecretPolicy';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11J acceptance checklist', () => {
  it('checklist-1: exports load-test profile repository and schema diff ack modules', async () => {
    const profiles = await import('../../features/grpc/data/grpcLoadTestProfileRepository');
    const acks = await import('../../features/grpc/utils/grpcSchemaDiffAck');
    const mockExport = await import('./grpcMockRuleSetExport');
    expect(typeof profiles.saveGrpcLoadTestProfile).toBe('function');
    expect(typeof profiles.listGrpcLoadTestProfiles).toBe('function');
    expect(typeof acks.grpcSchemaDiffChangeId).toBe('function');
    expect(typeof acks.addGrpcSchemaDiffAck).toBe('function');
    expect(typeof mockExport.prepareGrpcMockRuleSetExportSafe).toBe('function');
  });

  it('checklist-2: IDB v12 stores and forbidden mock export target are registered', () => {
    const idb = readSrc('src/shared/utils/idbOpen.ts');
    expect(idb).toContain('export const DB_VERSION = 12');
    expect(idb).toContain('grpc-load-test-profiles');
    expect(idb).toContain('grpc-schema-diff-acks');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_mock_rule_export');
  });

  it('checklist-3: advanced panels wire profiles, ack workflow, and mock export', () => {
    const loadPanel = readSrc('src/features/grpc/components/GrpcLoadTestPanel.tsx');
    const diffPanel = readSrc('src/features/grpc/components/GrpcSchemaDiffPanel.tsx');
    const mockPanel = readSrc('src/features/grpc/components/GrpcMockServerPanel.tsx');
    const detail = readSrc('src/features/grpc/components/GrpcSavedRequestDetail.tsx');
    expect(loadPanel).toContain('grpc-load-test-profile-save');
    expect(diffPanel).toContain('grpc-schema-diff-hide-acknowledged');
    expect(diffPanel).toContain('grpc-schema-diff-ack-btn');
    expect(mockPanel).toContain('grpc-mock-export-json');
    expect(detail).toContain('grpc-saved-request-run-load-test');
  });

  it('checklist-4: collection handoff navigates to advanced load-test tab', () => {
    const page = readSrc('src/features/grpc/GrpcStudioPage.tsx');
    const replay = readSrc('src/features/grpc/hooks/useGrpcStudioReplayActions.ts');
    expect(replay).toContain('openSavedRequestForLoadTest');
    expect(replay).toMatch(/openSavedRequestForLoadTest[\s\S]*return true/);
    expect(page).toContain("setActiveFeatureTab('load_test')");
    expect(page).toContain('if (!opened) return');
  });

  it('checklist-5: gate script and package.json register test:grpc:phase11j', () => {
    const pkg = readSrc('package.json');
    const gate = readSrc('scripts/test-grpc-phase11j.sh');
    expect(pkg).toContain('"test:grpc:phase11j"');
    expect(gate).toContain('grpcPhase11jAcceptance.test.ts');
    expect(gate).toContain('grpc_gate_run_regression');
    expect(gate).toContain('test:grpc:phase11i');
  });

  it('checklist-6: selectors expose Phase 11J test ids', async () => {
    const { GRPC } = await import('../selectors/grpc');
    expect(GRPC.LOAD_TEST_PROFILE_SAVE).toContain('grpc-load-test-profile-save');
    expect(GRPC.SCHEMA_DIFF_ACK_BTN).toContain('grpc-schema-diff-ack-btn');
    expect(GRPC.MOCK_EXPORT_JSON).toContain('grpc-mock-export-json');
    expect(GRPC.SAVED_REQUEST_RUN_LOAD_TEST).toContain('grpc-saved-request-run-load-test');
  });

  it('checklist-7: baseline capture clears acknowledgements for new and prior baseline keys', () => {
    const schemaDiff = readSrc('src/features/grpc/hooks/useGrpcAdvancedSchemaDiffSession.ts');
    const profiles = readSrc('src/features/grpc/hooks/useGrpcLoadTestProfilesState.ts');
    const advanced = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    expect(schemaDiff).toContain('baselineKeysToClear');
    expect(schemaDiff).toContain('newBaselineKey');
    expect(schemaDiff).toContain('refreshSchemaDiffAcks(newBaselineKey)');
    expect(schemaDiff).toContain('schemaDiffAckRefreshGenRef');
    expect(profiles).toContain('updateExisting ? selectedLoadTestProfileId : undefined');
    expect(profiles).toContain('lastSummary: undefined');
    expect(advanced).toContain('useGrpcAdvancedSchemaDiffSession');
  });
});
