/**
 * Phase 9F — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9F acceptance checklist', () => {
  it('exports persist guard and replay compatibility modules', async () => {
    const guard = await import('./grpcInterpolationPersistGuard');
    expect(typeof guard.sanitizeGrpcSavedRequestForTemplatePersist).toBe('function');
    expect(typeof guard.assertGrpcSavedRequestTemplatePersistSafe).toBe('function');
    expect(typeof guard.prepareGrpcHarnessCallActionDefinitionSnapshot).toBe('function');
    expect(typeof guard.sanitizeGrpcHarnessCallActionForTemplatePersist).toBe('function');

    const replay = await import('./grpcReplayTemplateCompatibility');
    expect(typeof replay.buildGrpcSavedRequestTemplateSource).toBe('function');
    expect(typeof replay.assertGrpcSavedRequestPortable).toBe('function');
    expect(typeof replay.grpcReplayTargetMatchesEnvResolution).toBe('function');
  });

  it('registers npm gate script for phase 9F', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9f']).toContain('test-grpc-phase9f.sh');
  });

  it('grpcSavedRequest uses template guard at create boundary', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcSavedRequest.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('sanitizeGrpcSavedRequestForTemplatePersist');
    expect(source).toContain('containsGrpcInterpolationToken');
  });

  it('persist middleware validates saved request portability', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcPersistRedactionMiddleware.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('assertGrpcSavedRequestPortable');
    expect(source).toContain('prepareGrpcSavedRequestForPersistSafe');
  });

  it('Studio save path passes expanded tabContext template source', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/GrpcStudioPage.tsx', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('rawBody: tab.body');
    expect(source).toContain('interpolationEnv: envVarMap');
  });

  it('replay resolver binds fresh interpolation env at execute time', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/utils/grpcReplayResolver.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('bindTabInterpolationEnvForExecute');
    expect(source).toContain('assertGrpcReplayUsesFreshInterpolationEnv');
  });

  it('history capture preserves template target with resolved filterTarget', async () => {
    const capture = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/utils/grpcStudioCallHistoryCapture.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(capture).toContain('applyGrpcCallHistoryTemplateContext');
    expect(capture).toContain('filterTarget');
  });

  it('testDefinitionVersioning wires harness definition snapshot helper', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/scenarios/utils/testDefinitionVersioning.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('prepareGrpcHarnessCallActionDefinitionSnapshot');
  });
});
