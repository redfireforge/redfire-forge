/**
 * Phase 9G — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9G acceptance checklist', () => {
  it('exports interpolation preview model helpers', async () => {
    const model = await import('./grpcInterpolationPreviewModel');
    expect(typeof model.buildGrpcInterpolationTargetPreviewState).toBe('function');
    expect(typeof model.shouldShowGrpcInterpolationPreviewToggle).toBe('function');
    expect(typeof model.shouldShowGrpcInterpolationErrorBanner).toBe('function');
  });

  it('registers npm gate script for phase 9G', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9g']).toContain('test-grpc-phase9g.sh');
  });

  it('gate script and deliverable files exist', async () => {
    const fs = await import('fs/promises');
    const paths = [
      '../../../scripts/test-grpc-phase9g.sh',
      './grpcInterpolationPreviewModel.ts',
      '../../features/grpc/components/GrpcInterpolationPreviewStrip.tsx',
      '../../features/grpc/components/GrpcInterpolationErrorBanner.tsx',
      './grpcPhase9gAcceptance.test.ts',
    ];
    for (const rel of paths) {
      await expect(fs.access(new URL(rel, import.meta.url))).resolves.toBeUndefined();
    }
  });

  it('GrpcTargetPanel wires preview strip and error banner', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/components/GrpcTargetPanel.tsx', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('GrpcInterpolationPreviewStrip');
    expect(source).toContain('GrpcInterpolationErrorBanner');
    expect(source).toContain('buildGrpcInterpolationTargetPreviewState');
  });

  it('useGrpcTargetValidation exposes secret-safe diagnostic payloads', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcTargetValidation.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('buildSafeGrpcInterpolationDiagnosticPayload');
    expect(source).toContain('sanitizeGrpcInterpolationDiagnosticMessage');
  });

  it('selectors include interpolation preview test ids', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../selectors/grpc.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('INTERPOLATION_PREVIEW_STRIP');
    expect(source).toContain('INTERPOLATION_ERROR_BANNER');
  });

  it('header preview uses Phase 9A grammar for template detection', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcStudioTargetPreview.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('getGrpcInterpolationTemplateState');
    expect(source).not.toMatch(/includes\('\{\{'\)/);
  });

  it('GrpcStudioPage uses shared endpoint preview draft helper', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/GrpcStudioPage.tsx', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('resolveGrpcStudioEndpointPreviewDraft');
  });
});
