/**
 * Phase 9H — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9H acceptance checklist', () => {
  it('exports cross-surface parity and studio execute interpolation modules', async () => {
    const cross = await import('./grpcInterpolationCrossSurface');
    expect(typeof cross.grpcExecuteSnapshotToComparable).toBe('function');
    expect(typeof cross.grpcExecuteSnapshotToInterpolationComparable).toBe('function');
    expect(typeof cross.assertGrpcInterpolationExecuteParity).toBe('function');
    expect(cross.GRPC_CROSS_SURFACE_FIXTURE.env.grpcHost).toBe('localhost:50051');

    const studio = await import('./grpcStudioExecuteInterpolation');
    expect(typeof studio.resolveGrpcStudioTabFieldsForExecute).toBe('function');
    expect(typeof studio.assertGrpcStudioExecuteFieldsReady).toBe('function');
  });

  it('registers npm gate script for phase 9H', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9h']).toContain('test-grpc-phase9h.sh');
  });

  it('maps checklist: same input resolves identically across Studio, Workflow, Harness', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcInterpolationCrossSurface.test.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('resolves identical execute payloads across harness, workflow, and studio');
    expect(source).toContain('assertGrpcInterpolationExecuteParity');
  });

  it('maps checklist: env switch affects only subsequent snapshots', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcInterpolationCrossSurface.test.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('keeps prior execute snapshot immutable when env map changes');
  });

  it('maps checklist: missing grpcHost blocks execution with validation error', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioUnaryCommands.coverage-gaps.test.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('blocks missing grpcHost with validation error');
  });

  it('maps checklist: nested body/metadata/auth interpolate without mutating schema keys', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcStudioExecuteInterpolation.test.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('deep-resolves body, metadata, and auth at execute time');
    expect(source).toContain('nested: { tag:');
  });

  it('maps checklist: escaped braces remain literal', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcInterpolationCrossSurface.test.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('preserves escaped literals consistently');
  });

  it('maps checklist: secret values never exposed in exported artifacts', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcInterpolationCrossSurface.test.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('does not leak secret env values into export-safe saved request previews');
  });

  it('prepareExecuteSnapshot deep-interpolates tab fields before capture', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioUnaryCommands.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('resolveGrpcStudioTabFieldsForExecute');
    expect(source).toMatch(/if \(!resolution\.targetValidation\.valid\)[\s\S]*assertTabTlsConfigValid/s);
    expect(source).not.toContain('assertTabMetadataValid(mergedTab)');
  });

  it('replay resolver deep-interpolates saved request fields at execute time', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/utils/grpcReplayResolver.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('resolveGrpcStudioTabFieldsForExecute');
  });

  it('Studio save path preserves tab templates via tabContext (9F + 9H)', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcStudioPageCollections.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('rawBody: tab.body');
    expect(source).toContain('prepareExecuteSnapshot');
  });

  it('harness and workflow snapshot builders share deep resolver exports', async () => {
    const harness = await import('./grpcHarnessTemplateResolver');
    const workflow = await import('../../features/workflow/utils/grpcWorkflowTemplateResolver');
    const deep = await import('./grpcInterpolationDeepResolver');
    expect(harness.resolveGrpcHarnessJsonValue).toBe(deep.resolveGrpcInterpolationJsonValue);
    expect(workflow.resolveGrpcWorkflowJsonValue).toBe(deep.resolveGrpcInterpolationJsonValue);
  });
});
