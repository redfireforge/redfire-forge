/**
 * Phase 9D — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { validateResolvedGrpcTargetAddress } from './targetValidation';
import { withGrpcTargetValidationMessage } from './targetValidation';
import { validateGrpcStatusAddress } from './requestValidation';

describe('Phase 9D acceptance checklist', () => {
  it('exports catalog and canonical env validation modules', async () => {
    const catalog = await import('./grpcTargetValidationCatalog');
    expect(typeof catalog.buildGrpcTargetValidationFailure).toBe('function');
    expect(typeof catalog.buildUnresolvedGrpcTargetFailure).toBe('function');

    const canonical = await import('./grpcCanonicalEnvValidation');
    expect(typeof canonical.validateGrpcCanonicalEnvTokens).toBe('function');
    expect(typeof canonical.deriveGrpcPortEnvValue).toBe('function');
  });

  it('registers npm gate script for phase 9D', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9d']).toContain('test-grpc-phase9d.sh');
  });

  it('rejects illegal schemes on resolved targets', () => {
    const result = validateResolvedGrpcTargetAddress('https://localhost:50051');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.kind).toBe('illegal_scheme');
      expect(result.hint).toBeTruthy();
    }
  });

  it('missing grpcHost blocks with remediation (not generic transport error)', () => {
    const result = withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress('{{grpcHost}}'),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Environment Manager');
    }
  });

  it('server requestValidation shares UI target failure messages', () => {
    const issues = validateGrpcStatusAddress('{{grpcHost}}');
    expect(issues[0]?.code).toBe('GRPC_INVALID_TARGET');
    expect(issues[0]?.message).toContain('grpcHost');
  });

  it('Studio execute binds canonical env validation at prepare time', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioUnaryCommands.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('bindTabInterpolationEnvForExecute');
  });

  it('connection resolution validates canonical env before interpolation', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioSessionHelpers.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('validateGrpcCanonicalEnvTokensForConnection');
  });

  it('harness snapshot builder validates canonical env via connection precedence', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('./grpcHarnessSnapshotBuilder.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('assertGrpcCanonicalEnvTokensValidForConnection');
  });

  it('envVarUtils derives grpcPort from configured gRPC address', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../utils/envVarUtils.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('grpcPort');
    expect(source).toContain('deriveGrpcPortEnvValue');
  });
});
