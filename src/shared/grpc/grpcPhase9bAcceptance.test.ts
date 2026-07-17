/**
 * Phase 9B — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9B acceptance checklist', () => {
  it('exports shared interpolation resolver modules', async () => {
    const resolver = await import('./grpcInterpolationResolver');
    expect(typeof resolver.resolveGrpcInterpolationTemplate).toBe('function');
    expect(typeof resolver.createGrpcInterpolationTemplateResolver).toBe('function');

    const deep = await import('./grpcInterpolationDeepResolver');
    expect(typeof deep.resolveGrpcInterpolationJsonValue).toBe('function');
    expect(typeof deep.assertGrpcInterpolationTemplatesResolved).toBe('function');
  });

  it('registers npm gate script for phase 9B', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9b']).toContain('test-grpc-phase9b.sh');
  });

  it('gate script and deliverable files exist', async () => {
    const fs = await import('fs/promises');
    const paths = [
      '../../../scripts/test-grpc-phase9b.sh',
      './grpcInterpolationResolver.ts',
      './grpcInterpolationDeepResolver.ts',
      './grpcInterpolationResolver.test.ts',
      './grpcInterpolationDeepResolver.test.ts',
      './grpcInterpolationConsumerParity.test.ts',
      './grpcPhase9bAcceptance.test.ts',
    ];
    for (const rel of paths) {
      await expect(fs.access(new URL(rel, import.meta.url))).resolves.toBeUndefined();
    }
  });

  it('harness runtime context uses Phase 9B resolver factory', async () => {
    const runtime = await import('./grpcHarnessRuntimeContext');
    const { createGrpcInterpolationTemplateResolver } = await import('./grpcInterpolationResolver');
    const env = { grpcHost: 'orders.example.com:50051' };
    const context = runtime.createGrpcHarnessSnapshotBuildContext(env);
    const expected = createGrpcInterpolationTemplateResolver(env)('{{grpcHost}}');
    expect(context.resolveTemplate('{{grpcHost}}')).toBe(expected);
  });

  it('harness template resolver delegates to shared deep resolver', async () => {
    const harness = await import('./grpcHarnessTemplateResolver');
    const deep = await import('./grpcInterpolationDeepResolver');
    expect(harness.resolveGrpcHarnessJsonValue).toBe(deep.resolveGrpcInterpolationJsonValue);
    expect(harness.assertGrpcHarnessTemplatesResolved).toBe(deep.assertGrpcInterpolationTemplatesResolved);
  });

  it('Studio target validation hook uses Phase 9B resolver factory', async () => {
    const hookPath = new URL('../../features/grpc/hooks/useGrpcTargetValidation.ts', import.meta.url);
    const source = await import('fs/promises').then((fs) => fs.readFile(hookPath, 'utf8'));
    expect(source).toContain('createGrpcInterpolationTemplateResolver');
    expect(source).not.toMatch(/from ['"].*wsMessageUtils['"]/);
  });

  it('exports gRPC studio target preview helper', async () => {
    const preview = await import('./grpcStudioTargetPreview');
    expect(typeof preview.computeGrpcStudioTargetPreview).toBe('function');
  });

  it('GrpcStudioPage uses pre-env draft for header preview', async () => {
    const fs = await import('fs/promises');
    const header = await fs.readFile(
      new URL('../../features/grpc/grpcStudioPage/GrpcStudioPageHeader.tsx', import.meta.url),
      'utf8',
    );
    const connection = await fs.readFile(
      new URL('../../features/grpc/grpcStudioPage/useGrpcStudioPageConnectionState.ts', import.meta.url),
      'utf8',
    );
    expect(header).toContain('computeGrpcStudioTargetPreview');
    expect(connection).toMatch(/endpointPreviewDraft[\s\S]*rawConnectionTarget/);
  });
});
