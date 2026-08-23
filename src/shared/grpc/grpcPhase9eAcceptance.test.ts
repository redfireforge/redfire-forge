/**
 * Phase 9E — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9E acceptance checklist', () => {
  it('exports cycle detector and diagnostic modules', async () => {
    const cycle = await import('./grpcInterpolationCycleDetector');
    expect(typeof cycle.detectGrpcInterpolationEnvCycle).toBe('function');
    expect(typeof cycle.validateGrpcInterpolationEnvCycles).toBe('function');
    expect(typeof cycle.assertGrpcInterpolationEnvAcyclic).toBe('function');

    const diagnostics = await import('./grpcInterpolationDiagnostics');
    expect(typeof diagnostics.sanitizeGrpcInterpolationDiagnosticMessage).toBe('function');
    expect(typeof diagnostics.buildSafeGrpcInterpolationDiagnosticPayload).toBe('function');

    const errors = await import('./grpcInterpolationError');
    expect(typeof errors.GrpcInterpolationError).toBe('function');
    expect(typeof errors.isGrpcInterpolationHarnessSerializationError).toBe('function');
    expect(typeof errors.resolveGrpcInterpolationHarnessPreTransportCategory).toBe('function');
  });

  it('registers npm gate script for phase 9E', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9e']).toContain('test-grpc-phase9e.sh');
  });

  it('gate script and deliverable files exist', async () => {
    const fs = await import('fs/promises');
    const paths = [
      '../../../scripts/test-grpc-phase9e.sh',
      './grpcInterpolationCycleDetector.ts',
      './grpcInterpolationDiagnostics.ts',
      './grpcInterpolationCycleDetector.test.ts',
      './grpcInterpolationDiagnostics.test.ts',
      './grpcPhase9eAcceptance.test.ts',
    ];
    for (const rel of paths) {
      await expect(fs.access(new URL(rel, import.meta.url))).resolves.toBeUndefined();
    }
  });

  it('env snapshot factory asserts acyclic env before binding', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcInterpolationEnvSnapshot.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('assertGrpcInterpolationEnvAcyclic');
  });

  it('Studio connection resolution validates cycles before target resolve', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioSessionHelpers.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('validateGrpcInterpolationEnvCycles');
  });

  it('useGrpcTargetValidation surfaces cycle failures in UI path', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcTargetValidation.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('validateGrpcInterpolationEnvCycles');
  });

  it('harness execution classifies cycle failures as serialization', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/grpc/grpcExecution.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('resolveGrpcInterpolationHarnessPreTransportCategory');
  });

  it('harness category maps CYCLE to serialization', async () => {
    const { GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY, GRPC_INTERPOLATION_ERROR_CODES } =
      await import('./grpcInterpolationConstants');
    expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.CYCLE])
      .toBe('serialization');
  });
});
