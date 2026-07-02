/**
 * Phase 11M — Network mock listener acceptance checklist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11M acceptance checklist', () => {
  it('checklist-1: exports listener contracts and pool modules', async () => {
    const contracts = await import('./grpcMockListenerContracts');
    const pool = await import('../../../src-server/grpc/grpcMockServerPool.js');
    expect(contracts.GRPC_MOCK_LISTENER_PORT_MIN).toBe(50061);
    expect(typeof pool.GrpcMockServerPool).toBe('function');
  });

  it('checklist-2: mock routes and webhook server mount', () => {
    const routes = readSrc('src-server/routes/grpc/grpc-mock-routes.ts');
    const server = readSrc('src-server/webhook-server.ts');
    expect(routes).toContain('/api/grpc/mock/start');
    expect(routes).toContain('/api/grpc/mock/stop');
    expect(routes).toContain('/api/grpc/mock/commit');
    expect(server).toContain('createGrpcMockRouter');
  });

  it('checklist-3: network listener uses grpcMockRuntimeCore manager', () => {
    const listener = readSrc('src-server/grpc/grpcMockNetworkListener.ts');
    expect(listener).toContain('executeUnaryCall');
    expect(listener).toContain('planStreamCall');
  });

  it('checklist-4: UI exposes listen target, network toggle, and hot-swap while running', () => {
    const panel = readSrc('src/features/grpc/components/GrpcMockServerPanel.tsx');
    const builder = readSrc('src/features/grpc/components/GrpcMockRuleBuilderPanel.tsx');
    const hook = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    const selectors = readSrc('src/shared/selectors/grpc.ts');
    expect(panel).toContain('grpc-mock-listen-target');
    expect(panel).toContain('grpc-mock-expose-network');
    expect(builder).toContain('hot-swap');
    expect(hook).toContain('commitGrpcMockNetworkListener');
    expect(hook).toContain('startGrpcMockNetworkListener');
    expect(selectors).toContain('MOCK_LISTEN_TARGET');
  });

  it('checklist-5: tab-scoped pool + shutdown hook', () => {
    const pool = readSrc('src-server/grpc/grpcMockServerPool.ts');
    const index = readSrc('src-server/index.ts');
    expect(pool).toContain('class GrpcMockServerPool');
    expect(pool).toContain('stopAll');
    expect(index).toContain('grpcMockServerPool.stopAll');
  });

  it('checklist-6: gate script and package script exist', () => {
    expect(readSrc('package.json')).toContain('"test:grpc:phase11m"');
    expect(readSrc('scripts/test-grpc-phase11m.sh')).toContain('Phase 11M gate');
  });
});
