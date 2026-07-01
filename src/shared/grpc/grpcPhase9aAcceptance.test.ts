/**
 * Phase 9A — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 9A acceptance checklist', () => {
  it('exports interpolation contract modules', async () => {
    const constants = await import('./grpcInterpolationConstants');
    expect(constants.GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN).toBeTruthy();

    const grammar = await import('./grpcInterpolationGrammar');
    expect(typeof grammar.tokenizeGrpcInterpolation).toBe('function');
    expect(typeof grammar.containsGrpcInterpolationToken).toBe('function');

    const contracts = await import('./grpcInterpolationContracts');
    expect(typeof contracts.validateGrpcStructuralFieldNotTokenized).toBe('function');
    expect(typeof contracts.validateGrpcStructuralFieldIfForbidden).toBe('function');
    expect(typeof grammar.extractGrpcInterpolationTokenNamesSafe).toBe('function');
    expect(typeof grammar.inspectGrpcInterpolationTemplate).toBe('function');
    expect(typeof grammar.getGrpcInterpolationTemplateState).toBe('function');
    expect(typeof contracts.isGrpcInterpolationAllowedContext).toBe('function');
  });

  it('registers npm gate script for phase 9A', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9a']).toContain('test-grpc-phase9a.sh');
  });

  it('gate script and deliverable files exist', async () => {
    const fs = await import('fs/promises');
    const paths = [
      '../../../scripts/test-grpc-phase9a.sh',
      './grpcInterpolationConstants.ts',
      './grpcInterpolationGrammar.ts',
      './grpcInterpolationContracts.ts',
      './grpcInterpolationGrammar.test.ts',
      './grpcInterpolationContracts.test.ts',
      './grpcPhase9aAcceptance.test.ts',
      './grpcInterpolationLegacyParity.test.ts',
    ];
    for (const rel of paths) {
      await expect(fs.access(new URL(rel, import.meta.url))).resolves.toBeUndefined();
    }
  });

  it('error catalog includes all Phase 9A required categories', async () => {
    const { GRPC_INTERPOLATION_ERROR_CODES } = await import('./grpcInterpolationConstants');
    const required = [
      'missing_token',
      'cycle',
      'invalid_target',
      'serialization',
      'validation',
    ] as const;
    for (const key of required) {
      expect(Object.values(GRPC_INTERPOLATION_ERROR_CODES).some((code) => code.includes(key)))
        .toBe(true);
    }
  });

  it('grammar rejects unsupported structural-key tokenization at contract layer', async () => {
    const { validateGrpcStructuralFieldNotTokenized } = await import('./grpcInterpolationContracts');
    const { GRPC_INTERPOLATION_ERROR_CODES } = await import('./grpcInterpolationConstants');
    expect(validateGrpcStructuralFieldNotTokenized('method', '{{dynamicMethod}}')?.code)
      .toBe(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED);
    expect(validateGrpcStructuralFieldNotTokenized('descriptorKey', 'key-{{env}}')?.code)
      .toBe(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED);
  });

  it('documents legacy divergence from wsMessageUtils hasUnresolvedVars', async () => {
    const { legacyHasUnresolvedVarsDiffers, LEGACY_UNRESOLVED_VAR_PATTERN } =
      await import('./grpcInterpolationGrammar');
    expect(LEGACY_UNRESOLVED_VAR_PATTERN.source).toBe('\\{\\{[^}]+\\}\\}');
    expect(legacyHasUnresolvedVarsDiffers('{{}}')).toBe(true);
    expect(legacyHasUnresolvedVarsDiffers(String.raw`\{{grpcHost}}`)).toBe(true);
  });
});
