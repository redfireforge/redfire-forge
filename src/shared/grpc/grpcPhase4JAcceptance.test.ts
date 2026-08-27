/**
 * Phase 4J-E — acceptance checklist traceability.
 *
 * Maps plan § Phase 4J acceptance checklist to executable assertions.
 * Detailed UI coverage lives in `test:grpc:phase4j` vitest files; this file
 * is the lightweight 4J merge-gate summary (mirrors `grpcPhase4Acceptance.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveGrpcTlsBadgePresentation } from '@grpc/utils/grpcConnectionBarUtils';
import { mergeGrpcCompressionMetadata } from './grpcCompressionPolicy';

const ROOT = join(__dirname, '../../..');

describe('Phase 4J acceptance checklist (4J-E traceability)', () => {
  it('exposes test:grpc:phase4j gate script in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:grpc:phase4j']).toBe('bash scripts/test-grpc-phase4j.sh');
    const gate = readFileSync(join(ROOT, 'scripts/test-grpc-phase4j.sh'), 'utf8');
    expect(gate).toContain('Phase 4J gate: ALL PASSED');
    expect(gate).toContain('GrpcConnectionBar.test.tsx');
    expect(gate).toContain('GrpcCallPanel.test.tsx');
    expect(gate).toContain('GrpcTargetPanel.test.tsx');
  });

  it('TLS badge labels match tlsMode (4J-A)', () => {
    expect(resolveGrpcTlsBadgePresentation('disabled', true).label).toBe('Plaintext');
    expect(resolveGrpcTlsBadgePresentation('tls', true).label).toBe('TLS');
    expect(resolveGrpcTlsBadgePresentation('mtls', true).label).toBe('mTLS');
    expect(resolveGrpcTlsBadgePresentation('tls', false).label).toBe('TLS invalid');
  });

  it('enabled compression merges grpc-encoding at execute boundary (4J-D)', () => {
    const merged = mergeGrpcCompressionMetadata(
      { 'x-custom': '1' },
      { enabled: true, algorithm: 'gzip' },
    );
    expect(merged['grpc-encoding']).toBe('gzip');
    expect(merged['x-custom']).toBe('1');
  });

  it('GrpcAuthPanel uses auth type dropdown aligned with GraphQL (4J-B)', () => {
    const source = readFileSync(
      join(ROOT, 'src/features/grpc/components/GrpcAuthPanel.tsx'),
      'utf8',
    );
    expect(source).toContain('grpc-auth-type-select');
    expect(source).toContain('grpc-auth-no-auth-hint');
  });

  it('GrpcStudioPage wires headless TLS modal host — not inline PEM in explorer (4J-B)', () => {
    const page = readFileSync(join(ROOT, 'src/features/grpc/grpcStudioPage/GrpcStudioPage.tsx'), 'utf8');
    const panels = readFileSync(join(ROOT, 'src/features/grpc/grpcStudioPage/GrpcStudioPagePanels.tsx'), 'utf8');
    const overlays = readFileSync(join(ROOT, 'src/features/grpc/grpcStudioPage/GrpcStudioPageOverlays.tsx'), 'utf8');
    const connection = readFileSync(
      join(ROOT, 'src/features/grpc/grpcStudioPage/useGrpcStudioPageConnectionState.ts'),
      'utf8',
    );
    expect(overlays).toContain('GrpcTlsPanel');
    expect(connection).toContain('handleTlsBadgeClick');
    expect(overlays).toContain('GrpcConnectionSettingsDrawer');
    expect(panels).toContain('GrpcExplorerPane');
    const panelsRenderIdx = page.indexOf('<GrpcStudioPagePanels');
    const overlaysRenderIdx = page.indexOf('<GrpcStudioPageOverlays');
    expect(panelsRenderIdx).toBeGreaterThan(-1);
    expect(overlaysRenderIdx).toBeGreaterThan(panelsRenderIdx);
  });

  it('GrpcHealthCheckPanel shows Spring Actuator hint when health is available (4G + 4J-D)', () => {
    const source = readFileSync(
      join(ROOT, 'src/features/grpc/components/GrpcHealthCheckPanel.tsx'),
      'utf8',
    );
    expect(source).toContain('GrpcSpringHintCard');
    expect(source).toContain('spring_health_actuator');
  });

});
