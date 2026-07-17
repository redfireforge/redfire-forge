/**
 * Phase 11L — Mock rule visual builder acceptance checklist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11L acceptance checklist', () => {
  it('checklist-1: exports builder model and panel modules', async () => {
    const model = await import('../../features/grpc/utils/grpcMockRuleBuilderModel');
    const panel = await import('../../features/grpc/components/GrpcMockRuleBuilderPanel');
    expect(typeof model.parseGrpcMockRuleSetToBuilderModel).toBe('function');
    expect(typeof model.serializeGrpcMockBuilderModelToStableJson).toBe('function');
    expect(typeof model.validateGrpcMockBuilderModel).toBe('function');
    expect(typeof panel.GrpcMockRuleBuilderPanel).toBe('function');
  });

  it('checklist-2: mock server panel has Builder | JSON | Runtime sub-tabs', () => {
    const panel = readSrc('src/features/grpc/components/GrpcMockServerPanel.tsx');
    expect(panel).toContain('GrpcMockRuleBuilderPanel');
    expect(panel).toContain('grpc-mock-tab-builder');
    expect(panel).toContain('grpc-mock-tab-json');
    expect(panel).toContain('grpc-mock-tab-runtime');
    expect(panel).toContain("'builder'");
    expect(panel).toContain('parseGrpcMockRuleSetJsonForBuilder');
  });

  it('checklist-3: builder scans forbidden expression patterns', () => {
    const model = readSrc('src/features/grpc/utils/grpcMockRuleBuilderModel.ts');
    expect(model).toContain('GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS');
    expect(model).toContain('scanGrpcMockBuilderValueForForbiddenTokens');
  });

  it('checklist-4: selectors and CSS namespace wired', () => {
    const selectors = readSrc('src/shared/selectors/grpc.ts');
    const css = readSrc('src/styles/grpc-studio.css');
    expect(selectors).toContain('MOCK_BUILDER_PANEL');
    expect(selectors).toContain('MOCK_TAB_BUILDER');
    expect(css).toContain('.grpc-mock-builder-panel');
    expect(css).toContain('.grpc-mock-authoring-tab');
  });

  it('checklist-5: rulesJson remains source of truth via patchMockRulesJson', () => {
    const builder = readSrc('src/features/grpc/components/grpcMockRuleBuilder/GrpcMockRuleBuilderPanel.tsx');
    const model = readSrc('src/features/grpc/utils/grpcStudioAdvancedModel.ts');
    const panel = readSrc('src/features/grpc/components/GrpcMockServerPanel.tsx');
    expect(builder).toContain('patchMockRulesJson');
    expect(builder).toContain('serializeGrpcMockBuilderModelToStableJson');
    expect(builder).toContain('parseGrpcMockRuleSetJsonForBuilder');
    expect(model).toContain('parseGrpcMockRuleSetJsonForBuilder');
    expect(panel).toContain('parseGrpcMockRuleSetJsonForBuilder');
  });

  it('checklist-6: gate script and package script exist', () => {
    const pkg = readSrc('package.json');
    expect(pkg).toContain('"test:grpc:phase11l"');
    expect(readSrc('scripts/test-grpc-phase11l.sh')).toContain('Phase 11L gate');
  });
});
