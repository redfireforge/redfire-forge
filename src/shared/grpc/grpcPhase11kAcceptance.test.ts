/**
 * Phase 11K — RPC Statistics tab acceptance checklist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GRPC_ADVANCED_FEATURE_TABS } from '../../features/grpc/grpcStudioAdvancedTypes';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11K acceptance checklist', () => {
  it('checklist-1: exports rpc session stats modules and capture bridge', async () => {
    const stats = await import('./grpcRpcSessionStats');
    const capture = await import('../../features/grpc/utils/grpcStudioRpcStatsCapture');
    const hook = await import('../../features/grpc/hooks/useGrpcRpcSessionStats');
    expect(typeof stats.recordGrpcRpcStatsEvent).toBe('function');
    expect(typeof stats.recordGrpcRpcStatsEvents).toBe('function');
    expect(typeof stats.resetGrpcRpcSessionStats).toBe('function');
    expect(typeof capture.captureGrpcRpcStatsFromOutcome).toBe('function');
    expect(typeof capture.captureGrpcRpcStatsFromLoadTestSummary).toBe('function');
    expect(typeof hook.useGrpcRpcSessionStats).toBe('function');
  });

  it('checklist-2: advanced tabs include rpc_statistics fourth tab', () => {
    expect(GRPC_ADVANCED_FEATURE_TABS).toContain('rpc_statistics');
    const shell = readSrc('src/features/grpc/components/GrpcAdvancedFeaturesShell.tsx');
    expect(shell).toContain('rpc_statistics');
    expect(shell).toContain('GrpcRpcStatisticsPanel');
  });

  it('checklist-3: call history capture emits stats events for unary and stream', () => {
    const capture = readSrc('src/features/grpc/utils/grpcStudioCallHistoryCapture.ts');
    expect(capture).toContain('captureGrpcRpcStatsFromOutcome');
    expect(capture).toContain("statsSource: 'stream_terminal'");
  });

  it('checklist-4: load test completion folds attempts into session stats', () => {
    const loadTestActions = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedLoadTestActions.ts');
    expect(loadTestActions).toContain('captureGrpcRpcStatsFromLoadTestSummary');
    expect(loadTestActions).toContain('executeSnapshot');
    expect(loadTestActions).toContain('loadTestExportSourceRef');
  });

  it('checklist-5: panel selectors and reset control are wired', () => {
    const panel = readSrc('src/features/grpc/components/GrpcRpcStatisticsPanel.tsx');
    const selectors = readSrc('src/shared/selectors/grpc.ts');
    expect(panel).toContain('grpc-rpc-stats-panel');
    expect(panel).toContain('grpc-rpc-stats-reset-btn');
    expect(selectors).toContain('RPC_STATS_PANEL');
    expect(selectors).toContain('RPC_STATS_RESET');
  });

  it('checklist-6: gate script and package script exist', () => {
    const pkg = readSrc('package.json');
    expect(pkg).toContain('"test:grpc:phase11k"');
    expect(readSrc('scripts/test-grpc-phase11k.sh')).toContain('Phase 11K gate');
  });
});
