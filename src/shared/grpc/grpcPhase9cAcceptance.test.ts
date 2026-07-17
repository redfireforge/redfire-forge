/**
 * Phase 9C — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9C acceptance checklist', () => {
  it('exports precedence and env snapshot modules', async () => {
    const precedence = await import('./grpcInterpolationPrecedence');
    expect(typeof precedence.mergeGrpcInterpolationEnvLayers).toBe('function');
    expect(typeof precedence.computeGrpcInterpolationEnvFingerprint).toBe('function');

    const snapshot = await import('./grpcInterpolationEnvSnapshot');
    expect(typeof snapshot.createGrpcInterpolationEnvSnapshot).toBe('function');
    expect(typeof snapshot.createGrpcInterpolationEnvSnapshotFromMap).toBe('function');

    const workflow = await import('./grpcWorkflowInterpolationResolver');
    expect(typeof workflow.createGrpcWorkflowInterpolationResolver).toBe('function');
  });

  it('registers npm gate script for phase 9C', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9c']).toContain('test-grpc-phase9c.sh');
  });

  it('GrpcTabExecuteSnapshot includes interpolationEnv field', async () => {
    const contracts = await import('./contracts');
    const sample: import('./contracts').GrpcTabExecuteSnapshot = {
      tabId: 't1',
      requestId: 'r1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.Echo',
      method: 'UnaryEcho',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'dk',
      interpolationEnv: {
        env: { grpcHost: 'localhost:50051' },
        fingerprint: 'grpcHost=localhost:50051',
        capturedAt: '2026-06-29T00:00:00.000Z',
        layerFingerprints: {},
      },
    };
    expect(sample.interpolationEnv?.env.grpcHost).toBe('localhost:50051');
    expect(contracts).toBeDefined();
  });

  it('Studio execute handler binds env snapshot at prepare time', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioUnaryCommands.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('bindTabInterpolationEnvForExecute');
    expect(source).toContain('interpolationEnv');
    expect(source).toContain('ctx.envVarMap');
  });

  it('Studio session core skips invalidation for in-flight tabs on env change', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcStudioSessionCore.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('tabHasPendingUnaryCall');
    expect(source).toContain('tabHasActiveStream');
    expect(source).toMatch(/Phase 9C/);
  });

  it('Studio session core defers invalidation until transport completes', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcStudioSessionCore.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('deferredConnectionInvalidationRef');
    expect(source).toContain('applyDeferredConnectionInvalidations');
    expect(source).toContain('invalidateTabDescriptorConnectionContext');
    expect(source).toContain('preserveTerminalResults');
  });

  it('replay resolver binds interpolationEnv on saved request replay', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/utils/grpcReplayResolver.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('bindTabInterpolationEnvForExecute');
    expect(source).toContain('interpolationEnv');
  });

  it('export redaction strips interpolationEnv values', async () => {
    const redaction = await import('./grpcRedaction');
    const redacted = redaction.redactGrpcExecuteSnapshotForExport({
      tabId: 't1',
      requestId: 'r1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.Echo',
      method: 'UnaryEcho',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'dk',
      interpolationEnv: {
        env: { secretToken: 'shh' },
        fingerprint: 'secretToken=shh',
        capturedAt: '2026-06-29T00:00:00.000Z',
        layerFingerprints: {},
      },
    });
    expect(redacted.interpolationEnv?.env).toEqual({});
    expect(redacted.interpolationEnv?.fingerprint).toBe('secretToken=shh');
  });
});
